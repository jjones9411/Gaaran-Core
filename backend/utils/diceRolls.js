// ================================
// utils/diceRolls.js
// Rzuty kością liczy WYŁĄCZNIE serwer - klient nie może przysłać gotowego
// wyniku, bo mógłby go sfałszować.
//
// Aby podgląd u gracza (w chwili rzutu) i zapis (przy wysłaniu wiadomości)
// były TĄ SAMĄ losową wartością z serwera, rzut generuje endpoint /dice/roll
// i podpisuje go HMAC-em (createRoll). Przy wysyłaniu wiadomości
// sanitizeDiceRolls ufa poprawnie podpisanemu rzutowi (nie losuje po raz drugi),
// a bez podpisu (stary klient) losuje sam - zawsze po stronie serwera.
// ================================

const crypto = require('crypto');

const MAX_SIDES = 1000000;
// Modyfikator MG: swoboda (mechanika id=9 mówi K20 ±5 / K100 ±15 dla kości
// oficjalnych, ale innych kości nie wymuszamy - to sufit sanity, nie reguła gry).
const MAX_MODIFIER = 1000;
// Podpis rzutu ważny 30 minut - tyle gracz ma na wysłanie wiadomości z rzutem.
const SIG_TTL_MS = 30 * 60 * 1000;

function rollSecret() {
  return process.env.JWT_SECRET || 'dice-fallback-secret';
}

function clampSides(rawSides) {
  const parsed = parseInt(rawSides, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_SIDES) : 20;
}

function clampModifier(rawModifier) {
  const parsed = parseInt(rawModifier, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, parsed));
}

// Podpis HMAC wiąże rzut z konkretnym użytkownikiem i momentem wygenerowania,
// więc nie da się go podmienić ani odtworzyć (replay) po TTL.
function signRoll({ sides, roll, modifier, userId, ts }) {
  return crypto
    .createHmac('sha256', rollSecret())
    .update(`${sides}:${roll}:${modifier}:${userId}:${ts}`)
    .digest('hex');
}

// Generuje pojedynczy podpisany rzut (wywoływane przez endpoint /dice/roll).
function createRoll({ sides, modifier, userId, description }) {
  const s = clampSides(sides);
  const m = clampModifier(modifier);
  const roll = Math.floor(Math.random() * s) + 1;
  const ts = Date.now();
  const sig = signRoll({ sides: s, roll, modifier: m, userId, ts });
  return {
    sides: s,
    roll,
    modifier: m,
    total: roll + m,
    description: typeof description === 'string' ? description : '',
    ts,
    sig,
  };
}

// Sprawdza, czy przysłany rzut ma ważny podpis TEGO użytkownika.
function isTrustedRoll(entry, userId) {
  if (!entry || typeof entry.sig !== 'string' || userId == null) return false;
  const sides = clampSides(entry.sides);
  const roll = parseInt(entry.roll, 10);
  const modifier = clampModifier(entry.modifier);
  const ts = parseInt(entry.ts, 10);
  if (!Number.isFinite(roll) || roll < 1 || roll > sides) return false;
  if (!Number.isFinite(ts) || Date.now() - ts > SIG_TTL_MS) return false;
  const expected = signRoll({ sides, roll, modifier, userId, ts });
  // porównanie w stałym czasie
  const a = Buffer.from(entry.sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * @param {Array<{sides?, roll?, modifier?, ts?, sig?, description?}>} diceRolls - dane z klienta
 * @param {number|string} [userId] - do weryfikacji podpisu rzutu; bez niego serwer zawsze losuje sam
 * @returns {Array<{roll, sides, modifier, total, description}>|null}
 */
function sanitizeDiceRolls(diceRolls, userId) {
  if (!Array.isArray(diceRolls) || diceRolls.length === 0) {
    return null;
  }

  return diceRolls.map(entry => {
    const description = typeof entry?.description === 'string' ? entry.description : '';
    const modifier = clampModifier(entry?.modifier);

    // Rzut z ważnym podpisem = ten sam, który gracz zobaczył w podglądzie.
    if (isTrustedRoll(entry, userId)) {
      const sides = clampSides(entry.sides);
      const roll = parseInt(entry.roll, 10);
      return { sides, roll, modifier, total: roll + modifier, description };
    }

    // Brak/niepoprawny podpis - serwer losuje sam (zawsze losowe, nie do oszukania).
    const sides = clampSides(entry?.sides);
    const roll = Math.floor(Math.random() * sides) + 1;
    return { sides, roll, modifier, total: roll + modifier, description };
  });
}

/**
 * Kolumna `dice_rolls` to longtext z JSON-em (a nie natywny typ JSON), więc
 * sterownik MySQL oddaje ją jako STRING. Trasy sesji parsowały ją u siebie,
 * karczma nie - i front dostawał string. `"[{...}]".length > 0` jest prawdą,
 * więc ikona kostki się rysowała, ale kliknięcie wchodziło w `.map()` na
 * stringu, co wywalało CAŁE drzewo Reacta (czarny ekran). Parsujemy w jednym
 * miejscu, żeby każda trasa oddawała frontowi tę samą, gotową tablicę.
 *
 * @param {unknown} value - wartość kolumny dice_rolls prosto z bazy
 * @returns {Array|null} tablica rzutów albo null (brak rzutów / uszkodzony JSON)
 */
function parseDiceRolls(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error('❌ Uszkodzony JSON w dice_rolls:', err.message);
    return null;
  }
}

module.exports = { sanitizeDiceRolls, parseDiceRolls, createRoll, MAX_SIDES, MAX_MODIFIER };
