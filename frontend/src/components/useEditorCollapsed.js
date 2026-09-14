// ================================
// useEditorCollapsed.js
// Stan "edytor zwinięty" dla ekranów czatu, ZAPAMIĘTYWANY na urządzeniu.
//
// Po co: zwinięcie edytora oddaje czytanej treści ~200 px (desktop) lub ~180 px
// (mobile). Bez zapamiętania wybór gracza żył tylko do przejścia na inną sesję -
// komponent montował się od nowa i edytor znów się rozwijał. Kto czyta długą
// sesję, musiał zwijać go za każdym razem.
//
// Preferencja jest trzymana ODDZIELNIE dla widoku mobilnego i desktopowego.
// Inaczej gracz, który na telefonie rozwinie edytor żeby coś napisać, straciłby
// domyślne zwinięcie na telefonie na zawsze - a to są dwa różne konteksty
// użycia i dwa różne sensowne ustawienia domyślne (mobile: zwinięty, bo liczy
// się czytanie; desktop: rozwinięty, bo miejsca jest więcej).
//
// Świadomie tylko localStorage, bez synchronizacji z kontem: to preferencja
// wynikająca z rozmiaru EKRANU, a nie z osoby, więc nie powinna wędrować
// z telefonu na desktop (inaczej niż skala czcionki - patrz fontScale.js).
// ================================

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY_MOBILE = 'ui-chat-editor-collapsed-mobile';
const STORAGE_KEY_DESKTOP = 'ui-chat-editor-collapsed-desktop';

const keyFor = (isMobile) => (isMobile ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP);

function readStored(isMobile) {
  try {
    const raw = localStorage.getItem(keyFor(isMobile));
    if (raw !== '0' && raw !== '1') return null;
    return raw === '1';
  } catch {
    // Prywatne okno / zablokowane localStorage - lecimy na domyślnych.
    return null;
  }
}

function writeStored(isMobile, collapsed) {
  try {
    localStorage.setItem(keyFor(isMobile), collapsed ? '1' : '0');
  } catch {
    /* brak pamięci to nie powód, żeby psuć interfejs */
  }
}

export default function useEditorCollapsed(isMobile) {
  const resolve = (mobile) => {
    const stored = readStored(mobile);
    return stored === null ? mobile : stored;
  };

  const [collapsed, setCollapsed] = useState(() => resolve(isMobile));

  // Przy przejściu przez próg mobile/desktop (obrót ekranu, zmiana rozmiaru
  // okna) bierzemy preferencję zapisaną dla TEGO widoku. Pierwsze uruchomienie
  // pomijamy - stan początkowy jest już policzony wyżej.
  const previousIsMobile = useRef(isMobile);
  useEffect(() => {
    if (previousIsMobile.current === isMobile) return;
    previousIsMobile.current = isMobile;
    setCollapsed(resolve(isMobile));
  }, [isMobile]);

  // Zmiana wywołana przez gracza - zapamiętujemy ją dla bieżącego widoku.
  const setCollapsedPersisted = useCallback((next) => {
    setCollapsed((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      writeStored(isMobile, value);
      return value;
    });
  }, [isMobile]);

  return [collapsed, setCollapsedPersisted];
}
