// ================================
// contentWidth.js
// Osobista SZEROKOŚĆ głównego boxa (per KONTO gracza).
//
// Model: liczba = maksymalna szerokość (w px) wiersza z treścią, czyli GŁÓWNEGO
// BOXA + listy online. Domyślnie 1400px - dokładnie tyle, ile ma TopBar.
//
// TopBar zostaje ZAWSZE przy TOPBAR_MAX_WIDTH (1400px) i jest wyśrodkowany, a
// wiersz z treścią rozsuwa się symetrycznie - o tyle samo w lewo i w prawo -
// więc szerszy widok nie rozjeżdża się na jedną stronę. Lista online jest
// częścią tego wiersza, więc jej prawa krawędź odjeżdża w prawo o tyle samo,
// o ile lewa krawędź głównego boxa odjeżdża w lewo.
//
// Zapis jest HYBRYDOWY (tak jak skala czcionki - patrz fontScale.js):
//  - localStorage: cache do NATYCHMIASTOWEGO zastosowania przy starcie (bez
//    przeskoku layoutu), zanim zdążymy dopytać serwer;
//  - backend (/api/user/content-width): źródło prawdy "na całe konto" -
//    preferencja idzie za graczem na każde urządzenie i przeglądarkę.
//
// Technicznie preferencja żyje jako zmienna CSS na <html>, a Home.js czyta ją
// przez var(...). Dzięki temu zmiana w Ustawieniach działa od razu, bez
// przeładowania i bez przepychania stanu przez Reacta.
//
// Ustawienie dotyczy TYLKO widoku desktopowego (>1050px). Na mobile główny box
// i tak zajmuje całą szerokość ekranu.
// ================================

// Szerokość TopBara - stała, NIEZALEŻNA od wyboru gracza (topbar zostaje jak jest).
export const TOPBAR_MAX_WIDTH = 1400;

// Dostępne szerokości głównego boxa. Trzymamy zamkniętą listę (a nie suwak),
// bo te same wartości waliduje serwer - żadne wywołanie API nie zapisze
// szerokości, która rozjechałaby layout.
export const CONTENT_WIDTH_OPTIONS = [
  { value: 1400, label: 'Standardowa (1400 px)', hint: 'Domyślna - równo z górnym paskiem' },
  { value: 1600, label: 'Szeroka (1600 px)', hint: 'Ok. 200 px więcej tekstu w linii' },
  { value: 1800, label: 'Bardzo szeroka (1800 px)', hint: 'Dla monitorów 1920 px i szerszych' },
  { value: 2000, label: 'Maksymalna (2000 px)', hint: 'Dla monitorów 2K / ultrawide' },
];

export const CONTENT_WIDTH_VALUES = CONTENT_WIDTH_OPTIONS.map((o) => o.value);
export const CONTENT_WIDTH_DEFAULT = TOPBAR_MAX_WIDTH;

// Nazwa zmiennej CSS czytanej przez layout (Home.js).
export const CONTENT_WIDTH_CSS_VAR = '--game-content-max-width';

const STORAGE_KEY = 'ui-content-width';

// Sprowadź dowolną wartość do jednej z dozwolonych (ta sama logika co na
// serwerze): nie-liczba -> domyślna, liczba -> najbliższa dozwolona.
export function clampContentWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return CONTENT_WIDTH_DEFAULT;
  return CONTENT_WIDTH_VALUES.reduce(
    (best, candidate) => (Math.abs(candidate - n) < Math.abs(best - n) ? candidate : best),
    CONTENT_WIDTH_DEFAULT
  );
}

// Odczyt z localStorage (cache). Zwraca CONTENT_WIDTH_DEFAULT gdy brak/niepoprawny.
export function getStoredContentWidth() {
  if (typeof localStorage === 'undefined') return CONTENT_WIDTH_DEFAULT;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return CONTENT_WIDTH_DEFAULT;
  return clampContentWidth(raw);
}

// Zapisz cache w localStorage (bez ruszania serwera).
export function cacheContentWidth(width) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(clampContentWidth(width)));
}

// Nałóż szerokość na <html> jako zmienną CSS (layout czyta ją przez var()).
export function applyContentWidth(width) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.style.setProperty(
    CONTENT_WIDTH_CSS_VAR,
    `${clampContentWidth(width)}px`
  );
}

// Zastosuj + zapamiętaj w localStorage jednym ruchem (start aplikacji i każda
// zmiana w Ustawieniach - natychmiastowy efekt bez przeładowania).
export function applyAndCacheContentWidth(width) {
  const clamped = clampContentWidth(width);
  applyContentWidth(clamped);
  cacheContentWidth(clamped);
  return clamped;
}

// Wczytaj szerokość z serwera (źródło prawdy per konto), zastosuj i odśwież cache.
// Wymaga tokena; przy braku/niepowodzeniu zostawiamy to co jest (cache/domyślna).
export async function loadContentWidthFromServer(token) {
  if (!token) return null;
  try {
    const res = await fetch('/api/user/content-width', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const width = clampContentWidth(data.contentWidth);
    applyAndCacheContentWidth(width);
    return width;
  } catch (err) {
    console.warn('Nie udało się pobrać szerokości głównego boxa z serwera:', err);
    return null;
  }
}

// Zapisz szerokość na serwerze (na całe konto). Zwraca zapisaną wartość albo null.
export async function saveContentWidthToServer(width, token) {
  if (!token) return null;
  try {
    const res = await fetch('/api/user/content-width', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentWidth: clampContentWidth(width) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return clampContentWidth(data.contentWidth);
  } catch (err) {
    console.warn('Nie udało się zapisać szerokości głównego boxa na serwerze:', err);
    return null;
  }
}
