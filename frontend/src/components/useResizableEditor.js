// ================================
// useResizableEditor.js
// Ręczna regulacja wysokości edytora wiadomości (sesje, karczma, wiadomości).
//
// Ten hook był wcześniej skopiowany w czterech plikach - i w żadnym z nich
// zwracany `resizeHandleProps` NIE BYŁ podpięty do jakiegokolwiek elementu,
// więc funkcja przeciągania po prostu nie istniała w interfejsie. Na dodatek
// każda kopia rejestrowała na `document` listener `touchmove` z
// { passive: false } NA STAŁE (nie tylko na czas przeciągania) - a taki
// listener zmusza przeglądarkę do czekania na JS przed KAŻDYM przewinięciem
// palcem. To była bezpośrednia przyczyna szarpania przy scrollowaniu długich
// sesji na telefonie.
//
// Tutaj listenery żyją WYŁĄCZNIE w trakcie przeciągania (efekt zależny od
// `isResizing`), a preventDefault w touchmove jest potrzebny tylko wtedy -
// żeby ciągnięcie uchwytu nie przewijało strony pod spodem.
//
// Hook zwraca wysokość JUŻ przyciętą do [minHeight, maxHeight]. Dzięki temu
// zmiana ograniczeń (np. wyjechała klawiatura i maxHeight zmalał) od razu
// koryguje wysokość, bez powielania Math.max/Math.min w każdym widoku.
// ================================

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useResizableEditor({
  baseHeight = 180,
  minHeight = 120,
  maxHeight = Number.POSITIVE_INFINITY,
} = {}) {
  const [rawHeight, setRawHeight] = useState(baseHeight);
  const [isResizing, setIsResizing] = useState(false);

  // Gdy zmienia się sensowna wartość domyślna (w praktyce: wyjechała lub
  // schowała się klawiatura), wracamy do niej zamiast trzymać wysokość sprzed
  // zmiany. Bez tego edytor rozwinięty na pełnym ekranie zostawał tej samej
  // wysokości po schowaniu połowy ekranu przez klawiaturę i zjadał prawie
  // wszystko, co zostało na czytanie.
  const [prevBaseHeight, setPrevBaseHeight] = useState(baseHeight);
  if (prevBaseHeight !== baseHeight) {
    setPrevBaseHeight(baseHeight);
    setRawHeight(baseHeight);
  }

  const startY = useRef(0);
  const startHeight = useRef(baseHeight);
  const rafId = useRef(null);

  // Ograniczenia czytane wewnątrz listenerów przeciągania. Trzymamy je w refach,
  // żeby zmiana min/max nie musiała przepinać listenerów w trakcie ruchu palca.
  const limits = useRef({ minHeight, maxHeight });
  limits.current = { minHeight, maxHeight };

  // Górna granica nigdy nie może być mniejsza od dolnej - inaczej przy bardzo
  // niskim widoku (klawiatura na małym telefonie) Math.min/Math.max dałyby
  // sprzeczny wynik i edytor skakałby między dwiema wartościami.
  const effectiveMax = Math.max(minHeight, maxHeight);
  const height = Math.max(minHeight, Math.min(rawHeight, effectiveMax));

  const beginResize = useCallback((clientY) => {
    startY.current = clientY;
    startHeight.current = height;
    setIsResizing(true);
  }, [height]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    beginResize(e.clientY);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  }, [beginResize]);

  const handleTouchStart = useCallback((e) => {
    if (!e.touches || e.touches.length === 0) return;
    beginResize(e.touches[0].clientY);
  }, [beginResize]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const applyFromClientY = (clientY) => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        // Ciągnięcie W GÓRĘ powiększa edytor, więc delta jest liczona odwrotnie.
        const deltaY = startY.current - clientY;
        const { minHeight: min, maxHeight: max } = limits.current;
        const next = Math.max(min, Math.min(startHeight.current + deltaY, Math.max(min, max)));
        setRawHeight(next);
      });
    };

    const handleMouseMove = (e) => applyFromClientY(e.clientY);

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      // Blokujemy przewijanie strony pod palcem TYLKO w trakcie przeciągania.
      if (e.cancelable) e.preventDefault();
      applyFromClientY(e.touches[0].clientY);
    };

    const stop = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', stop);
    document.addEventListener('touchcancel', stop);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stop);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', stop);
      document.removeEventListener('touchcancel', stop);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  return {
    editorHeight: height,
    isResizing,
    resizeHandleProps: { onMouseDown: handleMouseDown, onTouchStart: handleTouchStart },
  };
}
