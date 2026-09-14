// ================================
// utils/activeCharacter.js
// „Którą postacią gram" - jedno źródło prawdy dla endpointów działających na
// postaci zalogowanego gracza (profil, karczma, sesje, notatki, kartoteka,
// zgłoszenia).
//
// Wcześniej każdy z nich pytał `WHERE user_id = ? AND is_active = 1`, czyli
// wnioskował postać z KONTA. Na koncie współdzielonym (subkonto NPC
// administracji) to jest błędne: dwóch adminów prowadzących dwa różne NPC-e ma
// jedno `user_id`, a `is_active` może być tylko jedno - wybór postaci przez
// jednego przestawiał widoki drugiemu.
//
// Właściwą odpowiedź nosi token: `characterId` jest per zalogowana sesja, więc
// każdy admin dostaje swojego NPC-a. `is_active` zostaje jako zapas dla starych
// tokenów (sprzed wyboru postaci) i dla tokenów wskazujących postać usuniętą.
//
// Własność postaci sprawdzamy ZAWSZE w bazie (`user_id`), nie na słowo tokena.
// ================================

const pool = require('../config/database');

// Postać oznaczona na koncie jako aktywna - wariant awaryjny.
function fetchActiveCharacterId(userId, callback) {
  pool.query(
    `SELECT id FROM characters
     WHERE user_id = ? AND is_active = 1 AND (is_deleted IS NULL OR is_deleted = 0)
     ORDER BY last_played DESC
     LIMIT 1`,
    [userId],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows.length ? rows[0].id : null);
    }
  );
}

/**
 * ID postaci, którą gra właściciel żądania.
 * @param {object} req - żądanie po verifyToken (musi mieć req.user)
 * @param {(err: Error|null, characterId: number|null) => void} callback
 */
function resolveCharacterId(req, callback) {
  const userId = req.user && req.user.id;
  if (!userId) return callback(null, null);

  const tokenCharacterId = req.user.characterId;
  if (!tokenCharacterId) {
    return fetchActiveCharacterId(userId, callback);
  }

  pool.query(
    `SELECT id FROM characters
     WHERE id = ? AND user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
     LIMIT 1`,
    [tokenCharacterId, userId],
    (err, rows) => {
      if (err) return callback(err);
      if (rows.length) return callback(null, rows[0].id);
      // Token wskazuje postać usuniętą albo z innego konta - nie ufamy mu.
      fetchActiveCharacterId(userId, callback);
    }
  );
}

/** Wariant async/await - dla tras pisanych na promise'ach. */
function resolveCharacterIdAsync(req) {
  return new Promise((resolve, reject) => {
    resolveCharacterId(req, (err, characterId) => (err ? reject(err) : resolve(characterId)));
  });
}

/**
 * Skrót dla tras, które i tak kończą 404, gdy postaci nie ma.
 * Wywołuje `onCharacter(characterId)` tylko przy powodzeniu.
 */
function withCharacterId(req, res, onCharacter, notFoundMessage = 'Brak aktywnej postaci') {
  resolveCharacterId(req, (err, characterId) => {
    if (err) {
      console.error('❌ Błąd ustalania aktywnej postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!characterId) {
      return res.status(404).json({ message: notFoundMessage });
    }
    onCharacter(characterId);
  });
}

// ================================
// Akcje na postaci: „czy grasz TĄ postacią?"
//
// Trasy zapisujące coś w imieniu postaci (posty w sesjach, karczma, notatki)
// biorą `characterId`
// z ciała żądania, a token siedzi w `localStorage`, czyli jest WSPÓLNY dla
// wszystkich kart przeglądarki. Dwie karty otwarte na dwóch postaciach tego
// samego konta dawały więc dwie równoległe sesje gry: karta otwarta wcześniej
// trzymała stare `characterId` w stanie Reacta i wysyłała je z nowym tokenem,
// a serwer to łykał - obie postacie zbierały exp i wbijały poziomy naraz.
//
// `is_active` w bazie mówi wprost, że gra się JEDNĄ postacią naraz (wybór
// postaci zeruje flagę wszystkim pozostałym). To jest egzekwowane tutaj:
// żądanie musi dotyczyć postaci z tokena, inaczej leci 409 i front wie,
// że ma się odświeżyć.
// ================================

const MISMATCH_MESSAGE =
  '⚠️ Ta zakładka jest otwarta na innej postaci niż ta, którą grasz teraz. ' +
  'Odśwież stronę (F5) - grasz jedną postacią naraz.';
const NOT_OWNED_MESSAGE = 'To nie Twoja postać!';
const NO_CHARACTER_MESSAGE = 'Brak aktywnej postaci';

function ownsCharacter(userId, characterId, callback) {
  pool.query(
    `SELECT id FROM characters
     WHERE id = ? AND user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
     LIMIT 1`,
    [characterId, userId],
    (err, rows) => (err ? callback(err) : callback(null, rows.length > 0))
  );
}

/**
 * Sprawdza, że `requestedId` to postać, którą gracz FAKTYCZNIE gra w tej sesji.
 * Nie odpowiada sama - zwraca werdykt; odpowiada dopiero `guardPlayedCharacter`.
 *
 * @param {object} req - żądanie po verifyToken
 * @param {number|string} requestedId - `characterId` z ciała/parametru żądania
 * @returns {Promise<{ok: true, characterId: number}|{ok: false, status: number, body: object}>}
 */
function checkPlayedCharacter(req, requestedId) {
  return new Promise((resolve, reject) => {
    resolveCharacterId(req, (err, characterId) => {
      if (err) return reject(err);

      if (!characterId) {
        return resolve({
          ok: false,
          status: 404,
          body: { error: NO_CHARACTER_MESSAGE, message: NO_CHARACTER_MESSAGE }
        });
      }

      // Brak `characterId` w żądaniu = trasa i tak działa na postaci z tokena.
      if (requestedId === undefined || requestedId === null || requestedId === '') {
        return resolve({ ok: true, characterId });
      }

      if (Number(requestedId) === Number(characterId)) {
        return resolve({ ok: true, characterId });
      }

      // Rozróżniamy „czyjaś postać" (403) od „Twoja, ale nią teraz nie grasz" (409),
      // bo tylko to drugie front naprawia odświeżeniem.
      ownsCharacter(req.user.id, requestedId, (ownErr, owned) => {
        if (ownErr) return reject(ownErr);
        if (!owned) {
          return resolve({
            ok: false,
            status: 403,
            body: { error: NOT_OWNED_MESSAGE, message: NOT_OWNED_MESSAGE }
          });
        }
        resolve({
          ok: false,
          status: 409,
          body: {
            error: MISMATCH_MESSAGE,
            message: MISMATCH_MESSAGE,
            characterMismatch: true,
            activeCharacterId: characterId
          }
        });
      });
    });
  });
}

/**
 * Strażnik dla tras async: sam odsyła 403/404/409 i zwraca `false`, gdy trasa
 * ma się zatrzymać. Nigdy nie rzuca (błąd bazy = 500 + `false`), więc można go
 * bezpiecznie wołać jako pierwszą linię handlera - również przed otwarciem
 * transakcji, dzięki czemu nie ma czego wycofywać.
 *
 *   if (!(await guardPlayedCharacter(req, res, characterId))) return;
 *
 * @returns {Promise<boolean>} czy trasa może działać dalej
 */
async function guardPlayedCharacter(req, res, requestedId) {
  let result;
  try {
    result = await checkPlayedCharacter(req, requestedId);
  } catch (err) {
    console.error('❌ Błąd weryfikacji granej postaci:', err);
    res.status(500).json({ error: 'Błąd serwera', message: 'Błąd serwera' });
    return false;
  }
  if (!result.ok) {
    res.status(result.status).json(result.body);
    return false;
  }
  return true;
}

module.exports = {
  resolveCharacterId,
  resolveCharacterIdAsync,
  withCharacterId,
  guardPlayedCharacter
};
