import React from 'react';
import ReactDOM from 'react-dom/client';
// ============================================================================
// FONTY - tylko to, czego gra faktycznie używa, i tylko w potrzebnych alfabetach
// ============================================================================
// Wcześniej te importy ciągnęły 92 pliki (1,6 MB), bo domyślny wpis pakietu
// (np. `@fontsource/cinzel/400.css`) dołącza WSZYSTKIE subsety: cyrylicę, grekę,
// wietnamski i `math`. Gra jest po polsku, więc potrzebuje wyłącznie `latin`
// (podstawowy alfabet) oraz `latin-ext` (polskie znaki: ą, ć, ę, ł, ń, ó, ś, ź, ż -
// leżą właśnie w tym subsecie, więc NIE wolno go pominąć).
//
// Roboto zniknął w całości: był ładowany w 3 wagach x 6 subsetów, a `theme.js`
// nigdzie się do niego nie odwołuje (font gry to Cinzel + EB Garamond).
//
// EB Garamond dostaje wagę 700. Wcześniej ładowaliśmy tylko 400 i 500-italic,
// podczas gdy motyw ma `fontWeightBold: 700`, a w kodzie jest mnóstwo
// `fontWeight: 'bold'` na treści - przeglądarka musiała pogrubienie SYNTEZOWAĆ,
// czyli rozmazywać litery zamiast użyć prawdziwego kroju.
import '@fontsource/cinzel/latin-400.css';
import '@fontsource/cinzel/latin-ext-400.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-ext-600.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-ext-700.css';
import '@fontsource/cinzel-decorative/latin-700.css';
import '@fontsource/cinzel-decorative/latin-ext-700.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-ext-400.css';
import '@fontsource/eb-garamond/latin-700.css';
import '@fontsource/eb-garamond/latin-ext-700.css';
import '@fontsource/eb-garamond/latin-500-italic.css';
import '@fontsource/eb-garamond/latin-ext-500-italic.css';
import App from './App';
import { applyFontScale, getStoredFontScale } from './components/fontScale';
import { applyContentWidth, getStoredContentWidth } from './components/contentWidth';

// Osobista skala czcionki gracza z cache (localStorage) - zastosuj JAK NAJWCZEŚNIEJ,
// jeszcze przed pierwszym renderem, żeby uniknąć mrugnięcia rozmiaru. Serwer
// (źródło prawdy per konto) dosynchronizuje to po zalogowaniu (patrz App.js).
applyFontScale(getStoredFontScale());

// To samo dla szerokości głównego boxa - z cache przed pierwszym renderem, żeby
// layout nie przeskakiwał po dosynchronizowaniu z serwerem (patrz App.js).
applyContentWidth(getStoredContentWidth());

// Wycisz wyłącznie ostrzeżenia TipTapa
const originalWarn = console.warn;
console.warn = (...args) => {
  // Ignoruj tylko TipTap warnings
  if (args[0]?.includes?.('tiptap')) {
    return;
  }
  // Pozostałe warnings wyświetl normalnie
  originalWarn(...args);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);