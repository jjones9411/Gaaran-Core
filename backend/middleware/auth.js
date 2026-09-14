const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { hasNpcAccountColumn } = require('../utils/npcAccount');

// Dane konta potrzebne do autoryzacji. Kolumnę `is_npc_account` (migracja
// add-npc-subaccount.sql) dobieramy tylko wtedy, gdy istnieje - na bazie bez
// migracji autoryzacja ma działać jak dotąd, po prostu bez trybu NPC.
// ================================
// Dławik zapisu `last_seen`
// ================================
// `verifyToken` odpalał UPDATE users SET last_seen = NOW() przy KAŻDYM żądaniu.
// Przy graczu, którego front odpytuje HUD, karczmę i listę online, to kilka
// zapisów na sekundę NA OSOBĘ - a każdy z nich bierze blokadę wiersza `users`
// i połączenie z puli (domyślnie kilkanaście). To jest mnożnik obciążenia,
// który zamienia zwykły ruch w problem, a zalew żądań w awarię.
// `last_seen` służy tylko do pokazania "ostatnio widziany", więc dokładność
// co minutę w zupełności wystarcza.
const LAST_SEEN_THROTTLE_MS = 60 * 1000;
const lastSeenWrites = new Map(); // userId -> timestamp ostatniego zapisu

function shouldWriteLastSeen(userId) {
  const now = Date.now();
  const previous = lastSeenWrites.get(userId);
  if (previous && now - previous < LAST_SEEN_THROTTLE_MS) return false;
  lastSeenWrites.set(userId, now);
  return true;
}

// Mapa rośnie tylko o wpis na konto, ale czyścimy ją, żeby proces działający
// miesiącami nie trzymał wpisów kont, które dawno nie zajrzały do gry.
setInterval(() => {
  const cutoff = Date.now() - 10 * LAST_SEEN_THROTTLE_MS;
  for (const [userId, timestamp] of lastSeenWrites) {
    if (timestamp < cutoff) lastSeenWrites.delete(userId);
  }
}, 60 * 60 * 1000).unref?.();

const fetchAuthUser = async (userId) => {
  const withNpc = await hasNpcAccountColumn(pool);
  const columns = withNpc
    ? 'id, user, role, blocked_until, is_npc_account'
    : 'id, user, role, blocked_until';
  const [users] = await pool.promise().query(
    `SELECT ${columns} FROM users WHERE id = ?`,
    [userId]
  );
  return users;
};

// Middleware JWT - ROZSZERZONY
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    console.warn('⚠️ Brak nagłówka Authorization');
    return res.status(401).json({ message: 'Brak tokenu' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.warn('⚠️ Brak tokenu JWT w nagłówku');
    return res.status(401).json({ message: 'Brak tokenu' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      console.error('❌ Błąd weryfikacji JWT:', err.message);
      
      // ✅ NOWE - Rozróżnij typ błędu
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token wygasł',
          expired: true 
        });
      }
      
      return res.status(403).json({ message: 'Nieprawidłowy token' });
    }

    // ✅ NOWE - Weryfikuj czy user nadal istnieje i czy uprawnienia się nie zmieniły
    try {
      const users = await fetchAuthUser(decoded.id);

      if (users.length === 0) {
        return res.status(403).json({ message: 'Użytkownik nie istnieje' });
      }

      const user = users[0];

      // Sprawdź czy konto zostało usunięte
      if (user.is_deleted) {
        return res.status(403).json({ message: 'Konto zostało usunięte' });
      }

      // ✅ NOWE - Sprawdź blokadę konta
      if (user.blocked_until) {
        const now = new Date();
        const blockedUntilDate = new Date(user.blocked_until);

        if (now < blockedUntilDate) {
          // Ban nadal aktywny
          const timeLeft = blockedUntilDate - now;
          const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
          const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));

          const blockedUntilFormatted = blockedUntilDate.toLocaleString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });

          return res.status(403).json({
            blocked: true,
            message: `🔒 Twoje konto jest zablokowane do ${blockedUntilFormatted}.\n\nPozostało: ${daysLeft} dni (około ${hoursLeft} godzin).\n\nJeśli uważasz, że to pomyłka, skontaktuj się z administracją.`,
            blockedUntil: blockedUntilFormatted,
            blockedUntilISO: user.blocked_until,
            daysLeft: daysLeft,
            hoursLeft: hoursLeft
          });
        } else {
          // Ban wygasł - usuń datę bana
          await pool.promise().query(
            'UPDATE users SET blocked_until = NULL WHERE id = ?',
            [decoded.id]
          );
          // Wyczyść też kopię w pamięci, żeby `checkJail` (który czyta
          // req.user.blockedUntil) nie powtarzał tego samego UPDATE-u.
          user.blocked_until = null;
          console.log(`✅ Ban użytkownika ID:${decoded.id} wygasł i został usunięty`);
        }
      }

      // Sprawdź czy rola się zmieniła
      if (user.role !== decoded.role) {
        return res.status(403).json({
          message: 'Uprawnienia zostały zmienione, zaloguj się ponownie',
          roleChanged: true
        });
      }
req.user = {
        id: decoded.id,
        email: decoded.email,
        user: decoded.user || user.user,
        role: user.role,
        // Konto NPC (wspólne subkonto administracji) - flaga z bazy, nie z tokena.
        isNpcAccount: Boolean(user.is_npc_account),
        // Tryb NPC: kto (które konto admina) wszedł na subkonto - potrzebne,
        // żeby przyciskiem powrotu wrócić na swoje konto bez logowania.
        npcAccount: Boolean(decoded.npcAccount) && Boolean(user.is_npc_account),
        npcOwnerId: decoded.npcOwnerId || null,
        npcOwnerName: decoded.npcOwnerName || null,
        characterId: decoded.characterId || null,
        characterName: decoded.characterName || null,
        characterAvatar: decoded.characterAvatar || null,
        characterFaction: decoded.characterFaction || null,
        characterRace: decoded.characterRace || null,
        characterGender: decoded.characterGender || null,
        // Stan blokady konta, ODCZYTANY JUŻ WYŻEJ. `checkJail` (kolejne
        // middleware globalne) pytał o dokładnie tę samą kolumnę drugim
        // zapytaniem - czyli KAŻDE żądanie w grze robiło ten sam SELECT dwa
        // razy. Podajemy wynik dalej zamiast pytać ponownie.
        blockedUntil: user.blocked_until || null
      };

      // Zapis `last_seen` najwyżej raz na minutę na konto (patrz dławik wyżej)
      // i BEZ `await` - odpowiedź nie ma czekać na zapis znacznika statystycznego.
      if (shouldWriteLastSeen(decoded.id)) {
        pool.promise()
          .query('UPDATE users SET last_seen = NOW() WHERE id = ?', [decoded.id])
          .catch((e) => console.error('❌ Błąd zapisu last_seen:', e.message));
      }

      next();
    } catch (error) {
      console.error('❌ Błąd weryfikacji użytkownika:', error);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
  });
};

// Sprawdzanie admina - BEZ ZMIAN
const checkAdmin = (req, res, next) => {
  const userRole = req.user.role;

  if (userRole !== 'admin') {
    return res.status(403).json({ message: 'Brak uprawnień do panelu admina' });
  }

  next();
};

// Sprawdzanie mistrza gry lub admina - dla newsów i konsekwencji
const checkGameMasterOrAdmin = (req, res, next) => {
  const userRole = req.user.role;

  if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
    return res.status(403).json({ message: 'Brak uprawnień - wymagana rola mistrza gry lub admina' });
  }

  next();
};

// Sprawdzanie więzienia (blokady KONTA).
//
// ⚠️ WYDAJNOŚĆ: to middleware wykonywało własne `SELECT blocked_until FROM users`
// przy KAŻDYM żądaniu - dokładnie to samo zapytanie, które chwilę wcześniej
// wykonał `verifyToken`. Razem z zapisem `last_seen` dawało to trzy odwołania
// do bazy, zanim żądanie w ogóle dotarło do swojej trasy, przy puli liczącej
// kilkanaście połączeń. To jest ten mnożnik, przez który zwykły zalew żądań
// (albo po prostu większa liczba graczy naraz) kładł serwer.
// Teraz korzystamy z wartości, którą `verifyToken` już odczytał i przekazał
// w `req.user.blockedUntil`. Zachowanie i kształt odpowiedzi bez zmian.
function checkJail(req, res, next) {
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;
  const blocked_until = req.user.blockedUntil;

  // Jeśli użytkownik nie jest zablokowany, kontynuuj
  if (!blocked_until) {
    return next();
  }

  // Sprawdź czy ban jeszcze trwa (używając REALNEGO czasu)
  const now = new Date();
  const blockedUntilDate = new Date(blocked_until);

  if (now < blockedUntilDate) {
    // Ban nadal aktywny
    const timeLeft = blockedUntilDate - now;
    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));

    const blockedUntilFormatted = blockedUntilDate.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return res.json({
      blocked: true,
      message: `🔒 Twoje konto jest zablokowane do ${blockedUntilFormatted}.\n\nPozostało: ${daysLeft} dni (około ${hoursLeft} godzin).\n\nJeśli uważasz, że to pomyłka, skontaktuj się z administracją.`,
      blockedUntil: blockedUntilFormatted,
      blockedUntilISO: blocked_until,
      daysLeft: daysLeft,
      hoursLeft: hoursLeft
    });
  }

  // Ban wygasł - usuń datę bana (verifyToken robi to samo przy swoim odczycie,
  // ale zostawiamy dla ścieżek, które wołają checkJail samodzielnie).
  pool.query('UPDATE users SET blocked_until = NULL WHERE id = ?', [userId], (err) => {
    if (err) {
      console.error('Błąd resetowania blokady:', err);
    }
    console.log(`✅ Ban użytkownika ID:${userId} wygasł i został usunięty`);
    return next();
  });
}

module.exports = { verifyToken, checkAdmin, checkJail, checkGameMasterOrAdmin };