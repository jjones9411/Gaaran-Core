// ================================
// utils/npcAccount.js
// Wspólne subkonto administracji do prowadzenia postaci NPC.
//
// Idea: zamiast zakładać osobne konta na każdego NPC-a, istnieje JEDNO konto
// (rekord w `users` z `is_npc_account = 1`), na którym mieszkają wszystkie
// postacie NPC. Każdy admin wchodzi na nie z lobby przyciskiem "NPC" - backend
// wystawia mu wtedy token tego konta (bez logowania, bez hasła) i wraca na
// swoje konto przyciskiem powrotu.
//
// Ponieważ postać NPC to zwykły rekord w `characters`, każda ma z automatu
// własne sesje, wiadomości i profil - nie trzeba niczego dublować.
//
// Konto NPC ma rolę `mistrz_gry`, a nie `admin`: w trybie NPC nie ma się
// dostępu do panelu admina (żeby nie robić zmian "z konta NPC"), ale nie
// obowiązują też blokady dla zwykłych mieszkańców.
// ================================

const crypto = require('crypto');

const NPC_ACCOUNT_LOGIN = 'NPC';
const NPC_ACCOUNT_EMAIL = 'npc@subkonto.local';
const NPC_ACCOUNT_ROLE = 'mistrz_gry';

// Kolumna `users.is_npc_account` pochodzi z migracji add-npc-subaccount.sql.
// Cache'ujemy jej obecność, żeby nie odpytywać schematu przy każdym żądaniu -
// bez migracji reszta gry ma działać normalnie, tryb NPC ma się po prostu nie
// włączyć (z czytelnym komunikatem) zamiast wysypać autoryzację.
let npcColumnCache = null;

async function hasNpcAccountColumn(pool) {
  if (npcColumnCache !== null) return npcColumnCache;
  try {
    const [rows] = await pool.promise().query("SHOW COLUMNS FROM `users` LIKE 'is_npc_account'");
    npcColumnCache = rows.length > 0;
    return npcColumnCache;
  } catch (err) {
    // Np. baza chwilowo niedostępna - nie zapamiętujemy wyniku, spróbujemy ponownie.
    console.error('❌ Błąd sprawdzania kolumny users.is_npc_account:', err.message);
    return false;
  }
}

class NpcAccountUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'NpcAccountUnavailable';
  }
}

// Hasło, którym NIE da się zalogować: losowy ciąg, który nie jest poprawnym
// hashem bcrypt, więc bcrypt.compare zawsze zwróci false. Na konto NPC wchodzi
// się wyłącznie przez /api/npc-account/enter (tylko rola admin).
function unusablePassword() {
  return `!npc-no-login!${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Zwraca konto NPC, zakładając je przy pierwszym użyciu.
 * @returns {Promise<{id:number, user:string, email:string, role:string}>}
 */
async function ensureNpcAccount(pool) {
  if (!(await hasNpcAccountColumn(pool))) {
    throw new NpcAccountUnavailable(
      'Tryb NPC wymaga migracji bazy: database/add-npc-subaccount.sql'
    );
  }

  const [existing] = await pool.promise().query(
    'SELECT id, user, email, role FROM users WHERE is_npc_account = 1 ORDER BY id ASC LIMIT 1'
  );
  if (existing.length) return existing[0];

  try {
    const [result] = await pool.promise().query(
      `INSERT INTO users (user, email, password, active, role, is_npc_account, created_at)
       VALUES (?, ?, ?, 1, ?, 1, NOW())`,
      [NPC_ACCOUNT_LOGIN, NPC_ACCOUNT_EMAIL, unusablePassword(), NPC_ACCOUNT_ROLE]
    );
    console.log(`✅ Założono subkonto NPC (users.id = ${result.insertId})`);
    return {
      id: result.insertId,
      user: NPC_ACCOUNT_LOGIN,
      email: NPC_ACCOUNT_EMAIL,
      role: NPC_ACCOUNT_ROLE
    };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // Login/email subkonta zajmuje ZWYKŁE konto gracza. Nie podnosimy mu
      // uprawnień po cichu - to byłoby przejęcie cudzego konta.
      throw new NpcAccountUnavailable(
        `Nazwa "${NPC_ACCOUNT_LOGIN}" lub adres ${NPC_ACCOUNT_EMAIL} należą już do zwykłego konta. ` +
        'Zmień je na tamtym koncie i spróbuj ponownie.'
      );
    }
    throw err;
  }
}

/**
 * Czy podana nazwa/email są zarezerwowane dla subkonta NPC (blokada rejestracji).
 */
function isReservedNpcIdentity({ email, username }) {
  return (
    (typeof email === 'string' && email.trim().toLowerCase() === NPC_ACCOUNT_EMAIL) ||
    (typeof username === 'string' && username.trim().toLowerCase() === NPC_ACCOUNT_LOGIN.toLowerCase())
  );
}

/**
 * Znaczniki trybu NPC przenoszone do KAŻDEGO kolejnego tokena (wybór postaci,
 * tworzenie postaci, reset, odświeżenie tokena). Bez tego admin, który wybrał
 * postać NPC, dostawałby token bez `npcOwnerId` i nie miałby czym wrócić na
 * swoje konto.
 * @param {object} reqUser - req.user ustawione przez verifyToken
 * @returns {object} claimy do rozwinięcia w payloadzie JWT (możliwie puste)
 */
function npcTokenClaims(reqUser) {
  if (!reqUser || !reqUser.npcAccount) return {};
  return {
    npcAccount: true,
    npcOwnerId: reqUser.npcOwnerId || null,
    npcOwnerName: reqUser.npcOwnerName || null
  };
}

module.exports = {
  NPC_ACCOUNT_LOGIN,
  NPC_ACCOUNT_EMAIL,
  NPC_ACCOUNT_ROLE,
  NpcAccountUnavailable,
  hasNpcAccountColumn,
  ensureNpcAccount,
  isReservedNpcIdentity,
  npcTokenClaims
};
