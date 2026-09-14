// ================================
// npcMode.js
// Wejście/wyjście z trybu NPC (wspólne subkonto administracji do prowadzenia
// postaci NPC). Backend wystawia po prostu inny token - dlatego przełączenie
// sprowadza się do podmiany tokena i przeładowania widoku.
//
// Jedno miejsce prawdy dla lobby i belki nawigacji, żeby nie kopiować fetchy.
// ================================

async function switchAccount(endpoint) {
  const token = localStorage.getItem('token');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data?.token) {
    throw new Error(data?.message || 'Nie udało się przełączyć konta.');
  }

  return data.token;
}

/** Przejdź na subkonto NPC (tylko rola admin). Zwraca nowy token. */
export const enterNpcMode = () => switchAccount('/api/npc-account/enter');

/** Wróć z subkonta NPC na własne konto administratora. Zwraca nowy token. */
export const exitNpcMode = () => switchAccount('/api/npc-account/exit');

// Ustawienia interfejsu przeżywają przełączenie konta - to preferencje
// przeglądarki, nie dane postaci.
const UI_PREFERENCE_KEYS = ['ui-content-width', 'ui-font-scale', 'color-scheme'];

/**
 * Podmienia token i czyści CAŁY cache poprzedniego konta (nazwa gracza, avatar,
 * aktywna postać, pokój w karczmie, rzuty kośćmi...). Bez tego po wejściu w tryb
 * NPC widoki dociągałyby jeszcze przez chwilę dane postaci admina.
 * Kończy twardym przeładowaniem lobby - żaden komponent nie zostaje ze starym stanem.
 */
export function applySwitchedToken(token) {
  const preserved = UI_PREFERENCE_KEYS
    .map((key) => [key, localStorage.getItem(key)])
    .filter(([, value]) => value !== null);

  localStorage.clear();
  preserved.forEach(([key, value]) => localStorage.setItem(key, value));
  localStorage.setItem('token', token);

  window.location.assign('/lobby');
}
