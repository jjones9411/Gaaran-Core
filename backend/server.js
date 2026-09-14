// Gaaran Engine 1.0 - please do not share or use without permission
// Author: Gaaran
// Date: 2025-02-20
// Version: 1.0
// Description: A simple engine for texting games
// License: MIT
// Copyright (c) 2025 Gaaran
// If you want to use it please contact me on Discord: cerber941
// or email: vangalloth@gmail.com

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');
const bugLogger = require('./utils/bugLogger');

const app = express();

// ================================
// 1. TRUST PROXY (NAJPIERW!)
// ================================
// `true` ufa KAŻDEMU proxy w łańcuchu - każdy klient może wtedy sfałszować
// nagłówek X-Forwarded-For i podać dowolne IP, co całkowicie omija rate
// limiting oparty o IP (np. authLimiter). express-rate-limit
// odmawia w ogóle wystartować przy takiej konfiguracji (ERR_ERL_PERMISSIVE_TRUST_PROXY).
// Zamiast tego ufamy tylko określonej liczbie hopów proxy PRZED Node:
//   0 = Node wystawiony bezpośrednio (brak reverse proxy)
//   1 = jeden reverse proxy przed Node (typowy Nginx/Apache na tym samym VPS)
//   2 = Cloudflare (lub inny CDN) + Nginx przed Node
// Nadpisz przez TRUST_PROXY_HOPS w .env jeśli topologia jest inna niż domyślna.
const trustProxyHops = process.env.TRUST_PROXY_HOPS !== undefined
  ? parseInt(process.env.TRUST_PROXY_HOPS, 10)
  : 1;
app.set('trust proxy', trustProxyHops);

// ================================
// 2. MIDDLEWARE - IP LOGGING
// ================================
app.use((req, res, next) => {
  let clientIp = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.connection?.remoteAddress || 
                 req.socket?.remoteAddress ||
                 req.ip || 'unknown';

  if (clientIp && clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }
  if (clientIp && clientIp.startsWith('::ffff:')) {
    clientIp = clientIp.substring(7);
  }

  req.clientIp = clientIp;
  next();
});

// ================================
// 2A. RATE LIMITING - GLOBALNY (przed CORS i parserami ciała)
// ================================
// Stoi TU, a nie za autoryzacją, celowo: żądanie odrzucone globalnym limitem
// nie dotyka ani parsera JSON, ani bazy. Inaczej każdy zalew i tak kosztowałby
// nas trzy zapytania SQL (verifyToken + checkJail) zanim cokolwiek go zatrzyma,
// a pula MySQL ma kilkanaście połączeń - to jest cała "sztuka" położenia
// takiego serwera i nie wymaga botnetu, wystarczy pętla `fetch`.
const {
  globalLimiter,
  authLimiter,
  passwordResetLimiter,
  registerLimiter,
  characterCreateLimiter,
  uploadLimiter
} = require('./middleware/rateLimiter');

app.use(globalLimiter);

// ================================
// 3. CORS
// ================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  process.env.FRONTEND_URL || 'http://localhost:5173',
];

// Jeśli FRONTEND_URL wskazuje na domenę z/bez "www.", dopuszczamy oba warianty
// (przeglądarka może trafić na dowolny z nich, np. przez przekierowanie DNS/nginx).
if (process.env.FRONTEND_URL) {
  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL);
    const altHost = frontendUrl.hostname.startsWith('www.')
      ? frontendUrl.hostname.slice(4)
      : `www.${frontendUrl.hostname}`;
    allowedOrigins.push(`${frontendUrl.protocol}//${altHost}`);
  } catch (e) {
    // FRONTEND_URL niepoprawny URL - ignorujemy wariant z/bez www
  }
}

app.use(cors(function (req, callback) {
  const origin = req.header('Origin');
  let allowed = !origin || allowedOrigins.includes(origin);

  // Fallback ogólny: jeśli origin to ta sama domena, z której serwowany jest
  // request (nagłówek Host, z/bez "www."), to zawsze dopuszczamy - dotyczy to
  // w szczególności kreatora instalacyjnego (/install), który działa zanim
  // FRONTEND_URL zostanie zapisane w .env.
  if (!allowed && origin && req.headers.host) {
    try {
      const originHost = new URL(origin).hostname;
      const requestHost = req.headers.host.split(':')[0];
      const stripWww = (h) => (h.startsWith('www.') ? h.slice(4) : h);
      allowed = stripWww(originHost) === stripWww(requestHost);
    } catch (e) {
      // origin niepoprawny URL - pomijamy fallback
    }
  }

  callback(allowed ? null : new Error('Not allowed by CORS'), { origin: allowed, credentials: true });
}));

// ================================
// 4. BODY PARSERS
// ================================
// Limit 50 MB był ustawiony "na zapas" i nic go nie potrzebowało: pliki
// (avatary 200 kB, obrazki 2 MB, wideo 50 MB) idą multipartem przez multera,
// który ma własne, znacznie niższe limity i nie przechodzi przez ten parser.
// Za to KAŻDE żądanie JSON mogło zająć 50 MB pamięci procesu - kilkanaście
// równoległych i Node wychodzi na OOM. Do najdłuższych treści w grze (opisy
// postaci, posty sesyjne) 2 MB to i tak wielokrotny zapas.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '2mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Kontekst żądania dla bugLoggera - dzięki temu błędy przechwycone z
// console.error dostają endpoint / użytkownika, na którym wystąpiły.
app.use(bugLogger.requestContext);

// ================================
// 5. STATIC FILES
// ================================
// Ścieżka liczona od katalogu backendu, nie od CWD procesu - inaczej start
// serwera spoza `backend/` rozjeżdżał zapis pliku z jego serwowaniem.
// Katalog jest też tworzony przy starcie (jest w .gitignore, więc na świeżym
// klonie nie istnieje i pierwszy upload leciał na ENOENT).
const { UPLOADS_DIR } = require('./utils/uploadStorage');
app.use('/uploads', express.static(UPLOADS_DIR));

// ================================
// 6. IMPORT MODUŁÓW
// ================================
const pool = require('./config/database');
const { verifyToken, checkJail } = require('./middleware/auth');

// ================================
// 7. IMPORT ROUTES
// ================================
const { router: installRoutes } = require('./routes/install');
const gameInfoModule = require('./routes/gameInfo');
const passwordResetRoutes = require('./routes/passwordReset');
const authRoutes = require('./routes/auth');
const charactersRoutes = require('./routes/characters'); 
const lobbyRoutes = require('./routes/lobby');
const npcAccountRoutes = require('./routes/npcAccount');
const { setupWebSocket } = require('./config/websocket');
const tavernModule = require('./routes/tavern');
const profileModule = require('./routes/profile');
const userSettingsModule = require('./routes/userSettings');
const uploadsModule = require('./routes/uploads');
const infosModule = require('./routes/infos');
const npcModule = require('./routes/npc');
const cultsModule = require('./routes/cults');
const diceRollModule = require('./routes/diceRoll');
const spellsModule = require('./routes/spells');
const rulesModule = require('./routes/rules');
const racePagesModule = require('./routes/racePages');
const adminModule = require('./routes/admin');
// Przesyłki MG: przyznawanie towarów luksusowych i z czarnego rynku (z kontrolą IP odbiorcy)
const newsModule = require('./routes/news');
const publicFeedModule = require('./routes/publicFeed');
const privateMessagesRoutes = require('./routes/privateMessages');
const onlineUsersRoutes = require('./routes/onlineUsers');
// Liczniki paska postaci w jednym żądaniu (zamiast czterech co 10 s)
const hudModule = require('./routes/hud');
const privateSessionsRoutes = require('./routes/privateSessions.js');
const playersRoutes = require('./routes/players');
const generalSessionsRoutes = require('./routes/generalSessions');
const sessionJournalRoutes = require('./routes/sessionJournal');
const characterNotes = require('./routes/characterNotes');
const reportsRoutes = require('./routes/reports');
const logsRoutes = require('./routes/logs');
const racesModule = require('./routes/races');
const classesModule = require('./routes/classes');
const clansModule = require('./routes/clans');

// ================================
// 7B. SETUP HTTP SERVER + WEBSOCKET (PRZED ROUTING!)
// ================================
const server = http.createServer(app);
const { wss, activeConnections, broadcastActiveUsersUpdate } = setupWebSocket(server, pool);

// Inicjalizuj moduł Tavern
tavernModule.initialize({
  pool,
  broadcastActiveUsersUpdate,
  wss,
  activeConnections
});

console.log('✅ WebSocket server initialized');
console.log('✅ Tavern module initialized');

// ================================
// 8. PUBLICZNE ROUTES (PRZED MIDDLEWARE!)
// ================================
app.use('/', installRoutes);
app.use('/', gameInfoModule.router);

// Trasy liczące bcrypta (logowanie, rejestracja, reset hasła) dostają własny,
// ostry limit po IP. To jedyne kosztowne trasy dostępne BEZ tokena: bcrypt
// z kosztem 10 to ~100 ms CPU, a Node ma jeden wątek - kilkaset żądań na
// minutę wystarczy, żeby gra przestała odpowiadać wszystkim. Ten sam limit
// zamyka brute force hasła i masową enumerację kont.
// Ścieżki podajemy w obu wariantach, bo /api bywa obcinane dopiero przez proxy.
const AUTH_PATHS = ['/login', '/api/login',
                    '/newpassword', '/api/newpassword', '/reset-password', '/api/reset-password'];
const PASSWORD_RESET_PATHS = ['/forgot-password', '/api/forgot-password'];
const REGISTER_PATHS = ['/register', '/api/register'];
app.use(AUTH_PATHS, authLimiter);
// Prośba o reset hasła ma własny limiter, liczący RÓWNIEŻ udane żądania -
// każde z nich wysyła maila, więc to właśnie sukces jest tu bronią (zasypanie
// skrzynki gracza i wypalenie limitu SMTP).
app.use(PASSWORD_RESET_PATHS, passwordResetLimiter);
app.use(REGISTER_PATHS, registerLimiter);

app.use('/', passwordResetRoutes);
app.use('/', authRoutes);

// Publiczne API - otwarty CORS dla zewnętrznych serwisów
app.use('/public', cors({
  origin: '*', // Pozwól na dostęp z dowolnej domeny
  methods: ['GET'],
  credentials: false
}));
app.use('/public', publicFeedModule.router);


// ================================
// 9. MIDDLEWARE AUTORYZACJI
// ================================
// Dopasowanie PREFIKSOWE, nie podłańcuchowe. `.includes()` zwalniało z autoryzacji
// KAŻDĄ ścieżkę zawierającą frazę w dowolnym miejscu (np. `/rest/install-bed`
// pasowało do `/install`), co jest kruche i potencjalnie odsłania nowe trasy.
// Ścieżka jest publiczna tylko gdy równa się wpisowi albo zaczyna się od `wpis + '/'`.
const isPublicPath = (reqPath, publicPaths) =>
  publicPaths.some(p => reqPath === p || reqPath.startsWith(p + '/'));

app.use((req, res, next) => {
  const publicPaths = [
    '/login',
    '/api/login',
    '/api/register',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/online-users',
    '/api/online-users',
    '/api/activate',
    '/api/newpassword',
    '/api/admin/check-resident-message',
    '/news/public',
    '/races',
    '/classes',
    '/race-pages',
    '/game-info',
    '/install'
  ];

  if (isPublicPath(req.path, publicPaths)) {
    return next();
  }

  verifyToken(req, res, next);
});

// Middleware sprawdzania więzienia
app.use((req, res, next) => {
  const publicPaths = [
    '/login',
    '/register',
    '/api/login',
    '/api/register',
    '/forgot-password',
    '/reset-password',
    '/online-users',
    '/api/online-users',
    '/api/activate',
    '/api/newpassword',
    '/api/admin/check-resident-message',
    '/news/public'
  ];

  if (isPublicPath(req.path, publicPaths)) {
    return next();
  }

  checkJail(req, res, next);
});

// ================================
// 10. USE ROUTES (PO MIDDLEWARE)
// ================================
app.use('/reports', reportsRoutes);
app.use('/tavern', tavernModule.router);
app.use('/', adminModule.router);

// Tworzenie postaci: limit slotów (4 na konto) jest egzekwowany transakcyjnie
// w characters.js, a ten limit tempa dokłada się z zewnątrz - zalew równoległych
// żądań "utwórz postać" nie ma nawet jak dojść do sprawdzenia limitu.
app.use(['/createCharacter', '/api/createCharacter'], characterCreateLimiter);
app.use('/', charactersRoutes);
app.use('/', lobbyRoutes);
app.use('/', npcAccountRoutes);
app.use('/', profileModule.router);
app.use('/', userSettingsModule.router);
// Upload plików - każde żądanie zapisuje plik na dysku serwera. Bez limitu
// jeden gracz mógł w pętli zapełnić dysk (avatary 200 kB, wideo do 50 MB).
// Limit celuje wyłącznie w trasy przyjmujące PLIK - `GET /characters` (lobby)
// i `GET /characters/:id` muszą zostać nieograniczone, bo front je odpytuje.
const UPLOAD_PATH_RE = /^(\/api)?(\/characters\/[^/]+\/avatar|\/description-images|\/news-videos)$/;
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  if (!UPLOAD_PATH_RE.test(req.path)) return next();
  return uploadLimiter(req, res, next);
});
app.use('/', uploadsModule.router);
app.use('/', infosModule.router);
app.use('/', npcModule.router);
app.use('/', cultsModule.router);
app.use('/', diceRollModule.router);
app.use('/', spellsModule.router);
app.use('/', rulesModule.router);
app.use('/', racePagesModule.router);
// (adminModule.router jest już zamontowany wyżej - drugie `app.use` tego samego
//  routera kazało Expressowi przechodzić przez wszystkie 3.5 tys. linii tras
//  admina po raz drugi przy KAŻDYM żądaniu, które nie trafiło wcześniej.)
app.use('/', newsModule.router);
app.use('/', privateMessagesRoutes);
app.use('/', onlineUsersRoutes);
app.use('/', hudModule.router);
app.use('/', privateSessionsRoutes);
app.use('/', playersRoutes);
app.use('/', generalSessionsRoutes);
app.use('/', sessionJournalRoutes);
app.use('/', characterNotes.router);
app.use('/', logsRoutes.router);
app.use('/', racesModule.router);
app.use('/', classesModule.router);
app.use('/', clansModule.router);


// ================================
// 11. INICJALIZACJA POZOSTAŁYCH MODUŁÓW
// ================================
profileModule.initialize({ pool });
userSettingsModule.initialize({ pool });
gameInfoModule.initialize({ pool });
uploadsModule.initialize({ pool });
infosModule.initialize({ pool });
npcModule.initialize({ pool });
cultsModule.initialize({ pool });
diceRollModule.initialize({ pool });
spellsModule.initialize({ pool });
rulesModule.initialize({ pool });
racePagesModule.initialize({ pool });
adminModule.initialize({ pool });
newsModule.initialize({ pool });
publicFeedModule.initialize({ pool });
logsRoutes.initialize({ pool });
characterNotes.initialize({ pool });
hudModule.initialize({ pool });
racesModule.initialize({ pool });
classesModule.initialize({ pool });
clansModule.initialize({ pool, invalidateProfileCache: profileModule.invalidateProfileCache });

// Zbieranie błędów backendu do tabeli bug_logs (Bugtrack).
bugLogger.initialize({ pool });
bugLogger.installConsoleCapture();
bugLogger.installProcessHandlers();

// Wczytaj mnożniki/bonusy ras i klas do pamięci (tabele mogą być puste przed
// zakończeniem kreatora instalacyjnego - to jest OK, logują błąd i zostają
// puste, DEFAULT_MULTIPLIER=1.0 obsłuży brak danych bezpiecznie).

// ================================
// 11b. GLOBALNY ERROR HANDLER (po trasach)
// ================================
app.use(bugLogger.errorHandler);

// ================================
// 12. START SERVER
// ================================
server.listen(5000, () => {
  console.log('🚀 =======================================');
  console.log('🚀 Server is running on port 5000');
  console.log('🚀 =======================================');
});

// ================================
// 13. GRACEFUL SHUTDOWN
// ================================
const shutdown = () => {
  server.close(() => {
    pool.end(() => {
      console.log('🛑 Server gracefully shut down');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;