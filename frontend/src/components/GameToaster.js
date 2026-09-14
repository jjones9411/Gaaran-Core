// ================================================================
// GameToaster - wspólny "dymek" powiadomień (react-hot-toast) dla całej gry.
//
// Dotąd każdy ekran montował własny <Toaster position="top-center">. Dymek
// wychodził wtedy na ŚRODEK górnej krawędzi, czyli dokładnie tam, gdzie stoi
// przycisk akcji, którym się go wywołało - a przy wydobyciu czy warzeniu klika
// się ten sam przycisk kilkanaście razy z rzędu. Na telefonie było najgorzej:
// szeroki dymek zasłaniał przycisk na całą swoją długość życia, więc kolejne
// kliknięcie trzeba było przeczekać.
//
// Dlatego tutaj:
//   * dymki lecą do PRAWEGO górnego rogu, obok kolumny treści, a nie na nią,
//   * na telefonie są mniejsze (czcionka, marginesy, szerokość) i znikają
//     szybciej - MOBILE_DURATION zamiast pełnego czasu z desktopu,
//   * na telefonie schodzą POD przyklejony pasek postaci (Sidebar, position
//     fixed, ok. 61 px + notch), zamiast lądować na nim.
//
// Ekrany wołają <GameToaster style={toastStyle.style} /> i nie ustawiają już
// pozycji same - inaczej znowu rozjechałoby się to po ekranie po ekranie.
// ================================================================

import { Toaster } from 'react-hot-toast';
import useResponsive from './useResponsive';

// Domyślny czas życia dymka na desktopie. Ekrany mogą podać własny (np. Bank
// pokazuje dłuższe komunikaty o przelewach).
export const TOAST_DURATION = 3500;

// Na telefonie skracamy niezależnie od tego, co poda ekran - dymek ma zniknąć,
// zanim gracz zdąży sięgnąć po przycisk drugi raz.
export const TOAST_DURATION_MOBILE = 1800;

// Wysokość przyklejonego paska postaci na mobile (Sidebar: avatar 45 px + p:1
// z góry i z dołu) + bezpieczny margines na notch.
const MOBILE_TOP_OFFSET = 'calc(70px + env(safe-area-inset-top, 0px))';

export default function GameToaster({
  style,
  duration = TOAST_DURATION,
  mobileDuration = TOAST_DURATION_MOBILE,
  position,
}) {
  const { isSmall } = useResponsive();

  // Uwaga: kontener MUSI zostać pełnej szerokości - react-hot-toast układa w nim
  // dymki przez `justify-content: flex-end`, więc to on odsuwa je do prawej.
  // Nadpisujemy tylko górną krawędź i prawy margines.
  const containerStyle = isSmall
    ? {
      top: MOBILE_TOP_OFFSET,
      right: 'calc(8px + env(safe-area-inset-right, 0px))',
    }
    : { top: 16, right: 16 };

  // Mniejszy dymek na telefonie: mieści się obok treści, a nie przez całą
  // szerokość ekranu.
  const compactStyle = isSmall
    ? {
      fontSize: '0.78rem',
      lineHeight: 1.3,
      padding: '6px 10px',
      maxWidth: '62vw',
    }
    : { maxWidth: 380 };

  return (
    <Toaster
      position={position || 'top-right'}
      gutter={isSmall ? 6 : 8}
      containerStyle={containerStyle}
      toastOptions={{
        duration: isSmall ? mobileDuration : duration,
        style: {
          ...(style || {}),
          ...compactStyle,
          // Dymek przepuszcza kliknięcia. Nawet gdy trafi akurat na przycisk,
          // kolejne "Wydobywaj" da się kliknąć od razu, bez czekania aż zniknie
          // - a nic na tym nie tracimy, bo react-hot-toast i tak nie zamyka
          // dymka po kliknięciu.
          pointerEvents: 'none',
        },
      }}
    />
  );
}
