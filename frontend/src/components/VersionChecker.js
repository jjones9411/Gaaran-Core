// ================================
// VersionChecker
// Wykrywa, że wyszła nowa wersja frontendu, i proponuje graczowi odświeżenie -
// dzięki temu użytkownicy ze starym plikiem w cache przeglądarki nie siedzą w
// nieskończoność na nieaktualnej wersji.
//
// Jak to działa:
//  - Przy buildzie rsbuild wstrzykuje BUILD_ID do bundla (globalny __APP_BUILD_ID__)
//    i zapisuje ten sam BUILD_ID do dist/version.json.
//  - Klient co jakiś czas pobiera /version.json (z pominięciem cache) i porównuje
//    buildId z tym zaszytym w działającym bundlu. Gdy się różnią - jest nowa wersja.
//  - Pokazujemy pasek "Odśwież" (nie przeładowujemy automatycznie, żeby nie
//    przerwać graczowi np. pisania posta).
//
// Przeglądarki nie da się "popushować" bez jej pytania serwera - stąd polling
// (dodatkowo sprawdzamy przy powrocie do karty).
// ================================

import { useEffect, useState, useCallback } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';

/* global __APP_BUILD_ID__ */
// __APP_BUILD_ID__ jest podmieniane przez rsbuild (source.define) na string z
// BUILD_ID. typeof-guard chroni na wypadek braku podmiany (bez ReferenceError).
const CURRENT_BUILD_ID = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : null;
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // co 3 minuty

export default function VersionChecker() {
  const [updateReady, setUpdateReady] = useState(false);

  const check = useCallback(async () => {
    if (!CURRENT_BUILD_ID) return;
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn('[VersionChecker] /version.json HTTP', res.status, '- czy plik jest wdrożony?');
        return;
      }
      // Gdy hosting przekierowuje wszystko na index.html (fallback SPA), /version.json
      // zwróci HTML zamiast JSON - wtedy nigdy nie wykryjemy nowej wersji. Wykryjmy to.
      const ct = res.headers.get('content-type') || '';
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn(
          '[VersionChecker] /version.json nie jest JSON-em (content-type:', ct,
          '). Prawdopodobnie przekierowanie SPA zwraca index.html - wyklucz version.json z rewrite.',
        );
        return;
      }
      if (data && data.buildId) {
        if (String(data.buildId) !== String(CURRENT_BUILD_ID)) {
          console.info('[VersionChecker] nowa wersja:', data.buildId, 'aktualna:', CURRENT_BUILD_ID);
          setUpdateReady(true);
        }
      }
    } catch {
      // offline / brak pliku (np. dev) - po prostu ignorujemy
    }
  }, []);

  useEffect(() => {
    // Brak BUILD_ID (teoretycznie) -> nic nie robimy. W dev /version.json po
    // prostu nie istnieje i fetch jest łapany po cichu.
    if (!CURRENT_BUILD_ID) {
      console.warn('[VersionChecker] brak __APP_BUILD_ID__ w bundlu - sprawdzanie wersji wyłączone.');
      return;
    }
    console.info('[VersionChecker] aktywny, build tej wersji:', CURRENT_BUILD_ID);

    check();
    const intervalId = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Snackbar
      open={updateReady}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <Alert
        severity="info"
        variant="filled"
        sx={{ borderRadius: 0, alignItems: 'center', boxShadow: 6 }}
        action={
          <Button color="inherit" size="small" onClick={handleReload} sx={{ fontWeight: 'bold' }}>
            Odśwież
          </Button>
        }
      >
        Dostępna jest nowa wersja gry.
      </Alert>
    </Snackbar>
  );
}
