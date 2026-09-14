import { useMediaQuery } from '@mui/material';

// Wspólne progi mobile/desktop dla CAŁEJ gry - jedno źródło prawdy zamiast
// każdy plik miał własne, rozjeżdżające się liczby.
//
// Przed ujednoliceniem w kodzie żyło SIEDEM różnych progów: 480, 600, 768, 900,
// 1050, 1250 oraz - najgorszy - `(min-height: 800px)`. Skutki były realne:
//
//  * powłoka (Sidebar/hamburger) przełączała się na 1050px, a ekrany czatu
//    (Wiadomości, Karczma, Sesje Ogólne/Prywatne, Lobby) na 900px. W zakresie
//    901-1050px gracz dostawał mobilną powłokę Z desktopowym układem czatu -
//    czyli akurat na czterech najczęściej używanych ekranach w grze RP;
//  * `isLargeScreen` liczony z WYSOKOŚCI okna decydował, czy treść otwiera się
//    w modalu (desktop), czy rozwija w miejscu (mobile). iPhone 14 (390x844)
//    łapał wariant desktopowy, iPhone SE (375x667) mobilny, a laptop 1920x720
//    - mobilny. Dwa telefony tej samej marki zachowywały się inaczej.
export const LAYOUT_BREAKPOINTS = {
  // Granica "powłoka mobilna vs desktopowa" - hamburger, pasek postaci u góry,
  // brak stałej listy online. Ten sam próg musi obowiązywać w treści stron,
  // inaczej powłoka i strona rozjeżdżają się jak wyżej.
  small: 1050,
  // Wąski desktop: jest jeszcze układ dwukolumnowy, ale lista online domyślnie
  // zwinięta do paska (za mało miejsca na treść).
  narrow: 1250,
  // Telefon "na serio" - jedna kolumna, najciaśniejsze warianty etykiet.
  verySmall: 480,
};

export default function useResponsive() {
  return {
    isSmall: useMediaQuery(`(max-width: ${LAYOUT_BREAKPOINTS.small}px)`),
    isNarrow: useMediaQuery(`(max-width: ${LAYOUT_BREAKPOINTS.narrow}px)`),
    isVerySmall: useMediaQuery(`(max-width: ${LAYOUT_BREAKPOINTS.verySmall}px)`),
    isDesktop: useMediaQuery(`(min-width: ${LAYOUT_BREAKPOINTS.small + 1}px)`),
  };
}

// Skrót dla ekranów, które pytały o `(min-height: 800px)`, żeby zdecydować
// "modal czy rozwijanie w miejscu". To pytanie o SZEROKOŚĆ (czy jest miejsce na
// modal obok treści), nie o wysokość - `useIsWideScreen` daje na nie poprawną
// odpowiedź i trzyma się wspólnego progu.
export function useIsWideScreen() {
  return useMediaQuery(`(min-width: ${LAYOUT_BREAKPOINTS.small + 1}px)`);
}
