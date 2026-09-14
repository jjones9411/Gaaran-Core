// ================================
// diceRolls.js
// Rzuty kostką dołączone do wiadomości trzymane są w bazie jako longtext z
// JSON-em. Serwer rozpakowuje je przed wysłaniem (backend/utils/diceRolls.js),
// ale front dostaje wiadomości z TRZECH źródeł: REST-a, WebSocketa i własnego
// stanu optymistycznego - wystarczyło, że jedno z nich oddało surowy string, a
// klik w ikonę kostki wchodził w `.map()` na stringu i wywalał CAŁE drzewo
// Reacta (aplikacja nie ma ErrorBoundary, więc użytkownik widział czarny ekran).
//
// Dlatego przed użyciem ZAWSZE przepuszczamy wartość przez parseDiceRolls -
// koszt to JSON.parse krótkiego stringa, a zysk to brak wywrotki widoku przy
// dowolnym starym rekordzie czy nowej ścieżce danych.
// ================================

const EMPTY = [];

/**
 * @param {unknown} value - dice_rolls z wiadomości (tablica, JSON string lub null)
 * @returns {Array} zawsze tablica - pusta, gdy rzutów nie ma lub JSON jest uszkodzony
 */
export default function parseDiceRolls(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value === '') return EMPTY;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}
