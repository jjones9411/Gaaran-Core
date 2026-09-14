// ================================
// useKeyboardViewport.js
// JEDNO źródło prawdy o widocznym obszarze okna na mobile.
//
// Wcześniej ten sam detektor klawiatury był skopiowany w PIĘCIU miejscach
// (Home.js + GeneralSessions/PrivateSessions/Messages/Tavern), każdy z własnym
// stanem Reacta i - co gorsza - z RÓŻNYMI progami (60px vs max(25%, 100px)).
// Jedno zdarzenie klawiatury odpalało pięć niezależnych przerenderowań drzewa,
// a progi potrafiły się rozjechać (powłoka uznawała, że klawiatura jest, a widok
// sesji że jeszcze nie).
//
// Zwracamy trzy rzeczy:
//  - viewportHeight: realna wysokość WIDOCZNEGO obszaru (visualViewport),
//  - keyboardVisible: czy klawiatura zasłania część ekranu,
//  - offsetTop: o ile iOS przesunął layout viewport w górę przy focusie w input.
//
// offsetTop jest tu kluczowy: powłoka gry to position:fixed, a iOS Safari przy
// otwarciu klawiatury PRZEWIJA layout viewport - element "przyklejony" do góry
// odjeżdża wtedy poza ekran i edytor chowa się pod klawiaturą. Kompensujemy to
// przesunięciem (patrz Home.js).
// ================================

import { useEffect, useState } from 'react';

// Poniżej tej wysokości dialog przestaje być czymkolwiek użytecznym - lepiej
// pozwolić mu wystawać, niż ścisnąć go do paska.
const MIN_DIALOG_HEIGHT_PX = 160;

// Próg przy pomiarze przez visualViewport - tam różnica jest dokładna, więc
// wystarczy mały margines na paski systemowe.
const VV_THRESHOLD_PX = 60;

function readViewport() {
  if (typeof window === 'undefined') {
    return { height: 0, offsetTop: 0, hasVisualViewport: false };
  }
  const vv = window.visualViewport;
  if (vv) {
    return { height: vv.height, offsetTop: vv.offsetTop || 0, hasVisualViewport: true };
  }
  return { height: window.innerHeight, offsetTop: 0, hasVisualViewport: false };
}

export default function useKeyboardViewport() {
  const [state, setState] = useState(() => {
    const { height } = readViewport();
    return { viewportHeight: height, keyboardVisible: false, offsetTop: 0 };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    // Największa dotąd zaobserwowana wysokość = stan "klawiatura schowana".
    // Świadomie NIE używamy window.screen.height (fizyczna rozdzielczość ekranu) -
    // to dawało keyboardVisible=true na zawsze na urządzeniach bez visualViewport.
    let maxHeight = readViewport().height;
    let rafId = null;

    const read = () => {
      const { height, offsetTop, hasVisualViewport } = readViewport();
      if (height > maxHeight) maxHeight = height;

      const diff = maxHeight - height;
      const threshold = hasVisualViewport
        ? VV_THRESHOLD_PX
        : Math.max(maxHeight * 0.25, 100);
      const keyboardVisible = diff > threshold;

      setState((prev) => {
        // Zwracamy TEN SAM obiekt gdy nic się nie zmieniło - inaczej każde
        // zdarzenie scroll/resize (a tych przy scrollowaniu na iOS leci dużo)
        // przerenderowałoby cały widok sesji.
        if (
          prev.viewportHeight === height &&
          prev.keyboardVisible === keyboardVisible &&
          prev.offsetTop === offsetTop
        ) {
          return prev;
        }
        return { viewportHeight: height, keyboardVisible, offsetTop };
      });
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(read);
    };

    // Obrót ekranu zmienia wysokość "bez klawiatury", więc punkt odniesienia
    // trzeba przeliczyć od zera - inaczej po obróceniu na poziomo aplikacja
    // uznałaby, że klawiatura jest otwarta.
    const handleOrientationChange = () => {
      setTimeout(() => {
        maxHeight = readViewport().height;
        read();
      }, 400);
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', schedule);
      vv.addEventListener('scroll', schedule);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', handleOrientationChange);

    read();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener('resize', schedule);
        vv.removeEventListener('scroll', schedule);
      }
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return state;
}

// ================================
// Dialog kontra klawiatura
//
// MUI ustawia dialog względem LAYOUT viewportu (kontener to position:fixed,
// height:100%), a klawiatura systemowa layout viewportu NIE zmniejsza - ona go
// zasłania. Wyśrodkowany dialog na ekranie 640px przy otwartej klawiaturze ma
// więc dolną połowę pod klawiaturą i nie da się tam doscrollować: scroll
// chodzi WEWNĄTRZ pudełka, którego dół i tak jest niewidoczny. W podglądzie
// rzutów kostką objawiało się to tak, że widać było dwa pierwsze rzuty,
// a reszta (razem z przyciskiem "Zamknij") była nie do wyciągnięcia.
//
// Lekarstwo: przy otwartej klawiaturze dosuwamy dialog do góry WIDOCZNEGO
// obszaru (offsetTop to przewinięcie layout viewportu przez iOS) i ścinamy jego
// wysokość do tego, co realnie widać. Zwracamy gotowe propsy do rozłożenia na
// <Dialog>, żeby nie powtarzać tego przy każdym z osobna.
//
// @param {{viewportHeight: number, keyboardVisible: boolean, offsetTop?: number}} viewport - wynik useKeyboardViewport()
// @param {object} paperSx - style papieru dialogu (kolory, obwódka itd.)
// ================================
export function keyboardSafeDialogProps(viewport, paperSx = {}) {
  const { viewportHeight, keyboardVisible, offsetTop = 0 } = viewport || {};
  const visibleHeight = viewportHeight
    || (typeof window !== 'undefined' ? window.innerHeight : 0);

  // 32px = marginesy papieru (na mobile 8px z theme) + zapas na obwódkę i cień.
  const maxHeight = visibleHeight
    ? `${Math.max(visibleHeight - 32, MIN_DIALOG_HEIGHT_PX)}px`
    : undefined;

  return {
    sx: keyboardVisible
      ? { '& .MuiDialog-container': { alignItems: 'flex-start' } }
      : undefined,
    PaperProps: {
      sx: {
        ...paperSx,
        maxHeight,
        ...(keyboardVisible ? { mt: `${offsetTop + 8}px` } : null),
      },
    },
  };
}
