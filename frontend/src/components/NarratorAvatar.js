// ================================================================
// NarratorAvatar - grafika "awatara" narratora w postach sesji.
//
// Wcześniej post narratora dostawał pustą ramkę z jedną małą ikonką MUI
// pośrodku - przy 150x190 px to było 90% pustego tła obok normalnych
// awatarów postaci (zdjęcia wypełniające całe pole). Tutaj jest rysowany
// pełny kadr: nocne niebo z księżycem, sylwetka w kapturze i podpis
// "NARRATOR", więc post narratora waży wizualnie tyle samo co post gracza.
//
// Grafika to inline SVG (nie PNG), bo:
//  - kolor bierze się z motywu (domyślnie theme.palette.error.main, czyli ten
//    sam czerwony, którym już są opisane posty narratora) i sam nadąża za
//    kolorem akcentu wybranym w instalatorze,
//  - skaluje się bez rozmycia od 72 px (telefon) do 150 px (desktop),
//  - nie dokłada requestu ani pliku do repo.
//
// NarratorMark - ten sam motyw (kaptur) jako mała ikona; wchodzi w miejsce
// TheaterComedyIcon/TheatersOutlined w nagłówku postu, w przycisku trybu
// narratora i w pasku "Tryb narratora aktywny", żeby cały tryb narratora miał
// jeden znak rozpoznawczy zamiast trzech różnych ikon z biblioteki.
// ================================================================
import { useId } from 'react';
import { Box, SvgIcon, useTheme } from '@mui/material';
import { appColors } from './theme';

export default function NarratorAvatar({
  width = { xs: 72, sm: 150 },
  height = { xs: 90, sm: 190 },
  color,
  label = 'NARRATOR',
  sx,
}) {
  const theme = useTheme();
  const c = color || theme.palette.error.main;
  const deep = appColors.bgDeep;
  const surface = appColors.bgSurface;
  // useId daje ":r1:" - dwukropki w url(#...) potrafią wywrócić referencję,
  // więc lecą do kosza. Unikalne id jest konieczne, bo na jednej stronie
  // stoi wiele postów narratora, a gradienty nie mogą się nadpisywać.
  const uid = useId().replace(/:/g, '');

  return (
    <Box sx={{ width, height, lineHeight: 0, ...sx }}>
      <svg
        viewBox="0 0 120 152"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label="Narrator"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={`nar-bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={deep} />
            <stop offset="45%" stopColor={surface} />
            <stop offset="100%" stopColor={deep} />
          </linearGradient>
          <radialGradient id={`nar-moon-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c} stopOpacity="0.45" />
            <stop offset="55%" stopColor={c} stopOpacity="0.12" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`nar-vig-${uid}`} cx="50%" cy="45%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
          <linearGradient id={`nar-cloak-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04050a" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#04050a" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* nocne tło */}
        <rect x="1" y="1" width="118" height="150" fill={`url(#nar-bg-${uid})`} />

        {/* gwiazdy */}
        <g fill={c} opacity="0.4">
          <circle cx="19" cy="24" r="0.9" />
          <circle cx="100" cy="30" r="1.1" />
          <circle cx="27" cy="46" r="0.7" />
          <circle cx="96" cy="58" r="0.8" />
          <circle cx="14" cy="66" r="1" />
          <circle cx="106" cy="84" r="0.7" />
          <circle cx="34" cy="30" r="0.6" />
          <circle cx="88" cy="20" r="0.7" />
        </g>

        {/* księżyc + poświata */}
        <circle cx="60" cy="38" r="40" fill={`url(#nar-moon-${uid})`} />
        <circle cx="60" cy="36" r="19" fill={c} fillOpacity="0.2" stroke={c} strokeOpacity="0.45" />
        <g fill={c} fillOpacity="0.13">
          <circle cx="54" cy="31" r="3.6" />
          <circle cx="66" cy="41" r="2.6" />
          <circle cx="57.5" cy="44" r="1.8" />
        </g>

        {/* sylwetka w kapturze */}
        <path
          d="M60 49 C49 49 43.5 58 43.5 68 C43.5 76 41 80.5 35.5 83.5 C27 88 21 95 18 104 C16 110.5 15 115.5 14.5 120 L105.5 120 C105 115.5 104 110.5 102 104 C99 95 93 88 84.5 83.5 C79 80.5 76.5 76 76.5 68 C76.5 58 71 49 60 49 Z"
          fill={`url(#nar-cloak-${uid})`}
          stroke={c}
          strokeOpacity="0.75"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* narzutka i fałdy płaszcza */}
        <path d="M35.5 83.5 C44 95.5 76 95.5 84.5 83.5" fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="1.2" />
        <path d="M17 107 C35 114 85 114 103 107" fill="none" stroke={c} strokeOpacity="0.18" strokeWidth="1" />
        <path d="M46 97 C43 104 41.5 112 41 120" fill="none" stroke={c} strokeOpacity="0.2" strokeWidth="1" />
        <path d="M74 97 C77 104 78.5 112 79 120" fill="none" stroke={c} strokeOpacity="0.2" strokeWidth="1" />
        {/* klamra pod szyją */}
        <path d="M60 89 l3.2 3.6 l-3.2 3.6 l-3.2 -3.6 Z" fill={c} fillOpacity="0.65" />

        {/* mrok kaptura i świecące oczy */}
        <path
          d="M60 55 C52.5 55 49 61 49 68 C49 75 54 80 60 80 C66 80 71 75 71 68 C71 61 67.5 55 60 55 Z"
          fill="#020306"
          stroke={c}
          strokeOpacity="0.28"
          strokeWidth="0.8"
        />
        <g fill={c}>
          <circle cx="55.8" cy="68" r="3.6" fillOpacity="0.16" />
          <circle cx="64.2" cy="68" r="3.6" fillOpacity="0.16" />
          <ellipse cx="55.8" cy="68" rx="2" ry="1.4" fillOpacity="0.95" />
          <ellipse cx="64.2" cy="68" rx="2" ry="1.4" fillOpacity="0.95" />
        </g>

        {/* przyciemnione rogi - inaczej kadr wygląda płasko */}
        <rect x="1" y="1" width="118" height="150" fill={`url(#nar-vig-${uid})`} />

        {/* podpis */}
        <path d="M16 126 H104" stroke={c} strokeOpacity="0.3" strokeWidth="1" />
        <text
          x="60"
          y="140.5"
          textAnchor="middle"
          fill={c}
          fillOpacity="0.92"
          fontFamily="Cinzel, Georgia, serif"
          fontSize="12"
          letterSpacing="2.2"
          // litery są rozstrzelone, więc światło po ostatniej literze zbija
          // środkowanie w prawo - dx cofa napis o połowę tego odstępu
          dx="-1.1"
        >
          {label}
        </text>

        {/* rama */}
        <rect x="1" y="1" width="118" height="150" fill="none" stroke={c} strokeOpacity="0.75" strokeWidth="2" />
        <rect x="5.5" y="5.5" width="109" height="141" fill="none" stroke={c} strokeOpacity="0.28" strokeWidth="1" />
        <g fill={c} fillOpacity="0.6">
          <path d="M5.5 2 l3.5 3.5 l-3.5 3.5 l-3.5 -3.5 Z" />
          <path d="M114.5 2 l3.5 3.5 l-3.5 3.5 l-3.5 -3.5 Z" />
          <path d="M5.5 143 l3.5 3.5 l-3.5 3.5 l-3.5 -3.5 Z" />
          <path d="M114.5 143 l3.5 3.5 l-3.5 3.5 l-3.5 -3.5 Z" />
        </g>
      </svg>
    </Box>
  );
}

// Mała ikona (kaptur) - podmiana za ikony MUI w miejscach opisujących narratora.
// Jest to SvgIcon, więc działają na niej fontSize/sx/color jak na każdej ikonie MUI.
export function NarratorMark(props) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path
        d="M12 2.6 C9.4 2.6 8.1 4.7 8.1 7 C8.1 8.7 7.6 9.5 6.5 10.1 C4 11.6 2.4 14.8 2 20.8 L22 20.8 C21.6 14.8 20 11.6 17.5 10.1 C16.4 9.5 15.9 8.7 15.9 7 C15.9 4.7 14.6 2.6 12 2.6 Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.5 10.1 C8.2 13 15.8 13 17.5 10.1" fill="none" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.7" />
      <path
        d="M12 4.5 C10.2 4.5 9.4 6.1 9.4 7.7 C9.4 9.5 10.5 10.7 12 10.7 C13.5 10.7 14.6 9.5 14.6 7.7 C14.6 6.1 13.8 4.5 12 4.5 Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      <circle cx="10.9" cy="7.8" r="0.75" fill="#fff" fillOpacity="0.92" />
      <circle cx="13.1" cy="7.8" r="0.75" fill="#fff" fillOpacity="0.92" />
    </SvgIcon>
  );
}
