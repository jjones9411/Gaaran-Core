// ============================================
// middleware/rateLimiter.js
// Rate limiting middleware dla różnych endpointów
// ============================================

const rateLimit = require('express-rate-limit');

// Helper normalizujący IP (m.in. IPv6 do /56) - wymagany przez nowsze wersje
// express-rate-limit, gdy własny keyGenerator używa adresu IP. Bez niego
// biblioteka rzuca ERR_ERL_KEY_GEN_IPV6 już przy starcie serwera.
const ipKeyGenerator = rateLimit.ipKeyGenerator;
const ipKey = (req) => (typeof ipKeyGenerator === 'function' ? ipKeyGenerator(req.ip) : req.ip);

// Klucz per KONTO, z odwrotem na IP dla żądań bez tokena. Liczenie po koncie
// jest ważniejsze niż po IP: gracze siedzą za wspólnym NAT-em (akademik, LTE),
// a atakujący i tak potrafi zmienić IP - konta zmienić już tak łatwo nie może.
//
// Działa TYLKO w limiterach montowanych ZA autoryzacją (akcje, czat, uploady) -
// wcześniej `req.user` jeszcze nie istnieje i klucz cicho spada na IP. Limiter
// globalny stoi przed autoryzacją i dlatego używa wprost `ipKey`.
const userOrIpKey = (req) => (req.user?.id ? `user_${req.user.id}` : ipKey(req));

// Nadpisywalne z .env, żeby dało się poluzować/zacisnąć bez wgrywania kodu.
const envInt = (name, fallback) => {
  const raw = parseInt(process.env[name], 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

// ============================================
// GLOBALNY LIMIT - pierwsza linia obrony przed zalewem żądań
// ============================================
// KAŻDE żądanie za `verifyToken` kosztuje backend co najmniej trzy zapytania
// do bazy (SELECT users + UPDATE last_seen + checkJail), a pula MySQL ma
// domyślnie kilkanaście połączeń. Bez limitu jeden skrypt z pętlą `fetch`
// wysyca pulę i kładzie serwer wszystkim - nie trzeba do tego botnetu.
//
// KLUCZ TO IP, nie konto - i inaczej być nie może. Ten limiter stoi w
// server.js PRZED autoryzacją (celowo: odrzucone żądanie nie ma dotykać ani
// parsera JSON, ani bazy), więc `req.user` w tym miejscu jeszcze nie istnieje.
// Wcześniej stał tu `userOrIpKey`, który sugerował liczenie po koncie, ale
// gałąź `user_...` nigdy się nie wykonywała - w logach widać wyłącznie adresy
// IP. Zostawiamy IP i mówimy to wprost, zamiast udawać, że jest inaczej.
//
// Konsekwencja, o której trzeba pamiętać przy dobieraniu liczby: pod jednym
// adresem siedzi całe mieszkanie/akademik, a każda otwarta KARTA gracza to
// osobny strumień pollingu (HUD, karczma, listy online). Limit musi mieścić
// kilka kart kilku osób naraz, bo inaczej odcina zwykłą grę - a odcięta gra
// to nie tylko brak danych w widżecie: to 429 na trasach, których odpowiedzi
// front bierze za stan gry.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt('RATE_LIMIT_GLOBAL_PER_MINUTE', 1200),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: (req, res) => {
    console.warn(`⚠️ RATE LIMIT (global): ${ipKey(req)} → ${req.method} ${req.path}`);
    res.status(429).json({
      message: 'Zbyt wiele żądań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.'
    });
  }
});

// ============================================
// LOGOWANIE / REJESTRACJA / RESET HASŁA
// ============================================
// Te trasy są PUBLICZNE i liczą bcrypta (koszt 10 = ~100 ms CPU na żądanie).
// Node jest jednowątkowy, więc zalew /login to nie tylko brute force hasła,
// ale i zagłodzenie pętli zdarzeń - cała gra staje. Limit jest po IP, bo
// konta jeszcze nie znamy. `skipSuccessfulRequests` sprawia, że gracz, który
// loguje się poprawnie, praktycznie nigdy go nie zobaczy.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: envInt('RATE_LIMIT_AUTH_PER_15MIN', 20),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  handler: (req, res) => {
    console.warn(`⚠️ RATE LIMIT (auth): ${ipKey(req)} → ${req.method} ${req.path}`);
    res.status(429).json({
      message: 'Zbyt wiele prób. Odczekaj kilkanaście minut i spróbuj ponownie.'
    });
  }
});

// Prośba o reset hasła osobno, BEZ `skipSuccessfulRequests`.
// Tutaj groźne jest właśnie żądanie UDANE: każde wysyła maila na wskazany
// adres, więc limit liczący tylko nieudane próby pozwalałby zasypać skrzynkę
// dowolnego gracza (i wypalić dzienny limit SMTP) żądaniami, które w oczach
// limitera są "poprawne".
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: envInt('RATE_LIMIT_PASSWORD_RESET_PER_HOUR', 5),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: (req, res) => {
    console.warn(`⚠️ RATE LIMIT (reset hasła): ${ipKey(req)}`);
    res.status(429).json({
      message: 'Zbyt wiele próśb o reset hasła. Spróbuj ponownie za godzinę.'
    });
  }
});

// Rejestracja osobno: każde żądanie to bcrypt.hash ORAZ wysyłka maila.
// Bez limitu jeden skrypt wypala limit SMTP i wsadza domenę na czarne listy.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: envInt('RATE_LIMIT_REGISTER_PER_HOUR', 5),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  handler: (req, res) => {
    console.warn(`⚠️ RATE LIMIT (register): ${ipKey(req)}`);
    res.status(429).json({
      message: 'Zbyt wiele rejestracji z tego adresu. Spróbuj ponownie za godzinę.'
    });
  }
});

// ============================================
// TWORZENIE POSTACI
// ============================================
// Limit slotów (4 na konto) jest egzekwowany transakcyjnie w characters.js,
// ale osobny limit tempa domyka temat: zalew równoległych żądań tworzenia
// nie ma jak trafić w okno wyścigu, jeśli w ogóle nie przechodzi dalej.
const characterCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: envInt('RATE_LIMIT_CHARACTER_CREATE_PER_HOUR', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    console.warn(`⚠️ RATE LIMIT (tworzenie postaci): ${userOrIpKey(req)}`);
    res.status(429).json({
      message: 'Zbyt wiele prób tworzenia postaci. Spróbuj ponownie później.'
    });
  }
});

// Rate limiter dla ponownego wysyłania maila aktywacyjnego
const resendActivationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 3, // Max 3 próby na 15 minut z jednego IP
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Zbyt wiele prób ponownego wysłania maila. Spróbuj ponownie później.'
    });
  }
});

// Rate limiter dla wysyłania wiadomości (Karczma, sesje, wiadomości prywatne)
// Klucz po userId (nie po IP), żeby nie karać wielu graczy za tym samym NAT-em
const chatMessageLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 sekund
  max: 15, // Max 15 wiadomości na 10 sekund na użytkownika
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Zbyt wiele wiadomości w krótkim czasie. Zwolnij tempo.'
    });
  }
});

// Rate limiter dla uploadu plików - każdy plik to zapis na dysk serwera.
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: envInt('RATE_LIMIT_UPLOADS_PER_10MIN', 30),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Zbyt wiele przesłanych plików. Odczekaj chwilę.'
    });
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  passwordResetLimiter,
  registerLimiter,
  characterCreateLimiter,
  resendActivationLimiter,
  chatMessageLimiter,
  uploadLimiter
};
