// ================================
// fontScale.js
// Osobista skala czcionki GŁÓWNEGO BOXA (per KONTO gracza).
//
// Model: liczba = PROCENT BAZY (BASE_HTML_FONT_PERCENT = 120%), gdzie 100 = bez
// zmian. Efektywny font-size <html> = BAZA * (skala/100). Każdy krok w Ustawieniach
// to +/- FONT_SCALE_STEP (10), czyli +/- 10% względem bazy.
//
// Zapis jest HYBRYDOWY:
//  - localStorage: cache dla NATYCHMIASTOWEGO zastosowania przy starcie (bez
//    mrugnięcia), zanim zdążymy dopytać serwer;
//  - backend (/api/user/font-scale): źródło prawdy "na całe konto" - preferencja
//    idzie za graczem na każde urządzenie i przeglądarkę.
//
// Cały główny box używa jednostek rem, więc podmiana font-size na <html> skaluje
// go wszędzie naraz. TopBar i OnlineList mają fonty w px - ta skala ich nie dotyka.
// ================================

import { BASE_HTML_FONT_PERCENT } from './theme';

export const FONT_SCALE_MIN = 70;
export const FONT_SCALE_MAX = 160;
export const FONT_SCALE_STEP = 10;
export const FONT_SCALE_DEFAULT = 100;

const STORAGE_KEY = 'ui-font-scale';

// Przytnij do zakresu i zaokrąglij do kroku (ta sama logika co na serwerze),
// żeby żadna wartość nie rozjechała layoutu.
export function clampFontScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return FONT_SCALE_DEFAULT;
  const stepped = Math.round(n / FONT_SCALE_STEP) * FONT_SCALE_STEP;
  return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, stepped));
}

// Efektywny procent font-size <html> po nałożeniu osobistej skali na bazę.
export function effectiveHtmlPercent(scale) {
  return Math.round((BASE_HTML_FONT_PERCENT * clampFontScale(scale)) / 100);
}

// Odczyt z localStorage (cache). Zwraca FONT_SCALE_DEFAULT gdy brak/niepoprawny.
export function getStoredFontScale() {
  if (typeof localStorage === 'undefined') return FONT_SCALE_DEFAULT;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return FONT_SCALE_DEFAULT;
  return clampFontScale(raw);
}

// Zapisz cache w localStorage (bez ruszania serwera).
export function cacheFontScale(scale) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(clampFontScale(scale)));
}

// Nałóż skalę na <html> jako inline font-size (nadpisuje bazę z motywu).
export function applyFontScale(scale) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.style.fontSize = `${effectiveHtmlPercent(scale)}%`;
}

// Zastosuj + zapamiętaj w localStorage jednym ruchem (do wywołania przy starcie
// i przy każdej zmianie w Ustawieniach - natychmiastowy efekt bez mrugnięcia).
export function applyAndCacheFontScale(scale) {
  const clamped = clampFontScale(scale);
  applyFontScale(clamped);
  cacheFontScale(clamped);
  return clamped;
}

// Wczytaj skalę z serwera (źródło prawdy per konto), zastosuj i odśwież cache.
// Wymaga tokena; przy braku/niepowodzeniu zostawiamy to co jest (cache/baza).
export async function loadFontScaleFromServer(token) {
  if (!token) return null;
  try {
    const res = await fetch('/api/user/font-scale', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const scale = clampFontScale(data.fontScale);
    applyAndCacheFontScale(scale);
    return scale;
  } catch (err) {
    console.warn('Nie udało się pobrać skali czcionki z serwera:', err);
    return null;
  }
}

// Zapisz skalę na serwerze (na całe konto). Zwraca zapisaną wartość albo null.
export async function saveFontScaleToServer(scale, token) {
  if (!token) return null;
  try {
    const res = await fetch('/api/user/font-scale', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fontScale: clampFontScale(scale) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return clampFontScale(data.fontScale);
  } catch (err) {
    console.warn('Nie udało się zapisać skali czcionki na serwerze:', err);
    return null;
  }
}
