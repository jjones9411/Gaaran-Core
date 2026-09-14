// src/components/theme.js
import { createTheme } from '@mui/material/styles';

// ==========================================
// KOLOR AKCENTU - wybierany w kreatorze instalacyjnym (game_config.theme_primary_color).
// Reszta odcieni (jasniejszy/ciemniejszy/poswiata) jest wyliczana z tego jednego
// koloru, zamiast trzymac osobna palete na sztywno dla kazdego mozliwego wyboru.
// ==========================================
export const DEFAULT_PRIMARY_COLOR = '#7a3b0f';
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clamp255(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

// UWAGA HISTORYCZNA: ta funkcja była w tym pliku zadeklarowana DWA RAZY - tutaj
// oraz drugi raz przy paletach ras. Deklaracje funkcji są hoistowane, więc druga
// po cichu nadpisywała pierwszą w CAŁYM module: mimo że tu stał fallback na
// kolor domyślny, faktycznie wszędzie działał wariant zwracający `null`
// (stąd `if (!rgb) return 0` w relativeLuminance - napisane pod tamten wariant).
// Zostaje JEDNA definicja, ta faktycznie działająca (zwraca `null` przy złym
// wejściu), a funkcje, które nie umieją obsłużyć `null`, dostają jawny fallback
// niżej. Dzięki temu zachowanie dla poprawnych kolorów jest identyczne jak
// dotąd, a złamany hex przestaje móc wysypać destrukturyzację.
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// Fallback dla funkcji, które MUSZĄ dostać kolor (odpowiednik DEFAULT_PRIMARY_COLOR).
const FALLBACK_RGB = { r: 122, g: 59, b: 15 };

function rgbToHex({ r, g, b }) {
  const toHex = (n) => clamp255(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// amount > 0 rozjasnia w strone bieli, amount < 0 sciemnia w strone czerni
function shadeHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex) || FALLBACK_RGB;
  const target = amount > 0 ? 255 : 0;
  const pct = Math.abs(amount);
  return rgbToHex({
    r: r + (target - r) * pct,
    g: g + (target - g) * pct,
    b: b + (target - b) * pct,
  });
}

function hexToRgba(hex, alphaValue) {
  const { r, g, b } = hexToRgb(hex) || FALLBACK_RGB;
  return `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
}

// Relatywna luminancja wg WCAG (0 = czern, 1 = biel). Odporne na null/niepoprawny hex.
function relativeLuminance(rgb) {
  if (!rgb) return 0;
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// Wspolczynnik kontrastu WCAG miedzy dwoma kolorami (1 = brak, 21 = max)
function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// Rozjasnia kolor w strone bieli, az osiagnie minimalny kontrast na tle `bgHex`.
// Dzieki temu ciemny kolor akcentu wybrany przez admina i tak pozostaje czytelny
// jako tekst na mrocznym tle, bez psucia samej barwy (pozostaje np. czerwony).
function ensureReadableOn(hex, bgHex, minRatio = 4.5) {
  if (!HEX_RE.test(hex || '') || !HEX_RE.test(bgHex || '')) return hex;
  let out = hex;
  let guard = 0;
  while (contrastRatio(out, bgHex) < minRatio && guard < 24) {
    out = shadeHex(out, 0.06);
    guard += 1;
  }
  return out;
}

// Bazowy rozmiar czcionki <html> w % (jedno źródło prawdy). Prawie cały tekst
// GŁÓWNEGO BOXA jest w rem, więc ta wartość skaluje go wszędzie naraz. TopBar
// i OnlineList mają fonty w px, więc NIE zależą od tej bazy. Gracz może dostroić
// swoją osobistą skalę w Ustawieniach (patrz fontScale.js) - jego preferencja
// mnoży tę bazę i jest nakładana jako inline font-size na <html>.
export const BASE_HTML_FONT_PERCENT = 120;

export const DEFAULT_TEXT_COLOR = '#cbd5e0';
// Tło CAŁOŚCI (za panelami) - neutralna czerń; właściwy świat pokazuje grafika
// tła (AuthBackdrop/Home). Neutralne #151515 jest kolorem WYPEŁNIENIA PANELI
// (background.paper + tła ::before paneli), nie tłem całości.
export const DEFAULT_BACKGROUND_COLOR = '#151515';

export function createAppTheme(
  mode = 'dark',
  primaryColor = DEFAULT_PRIMARY_COLOR,
  textColor = DEFAULT_TEXT_COLOR,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  // Jawny, czytelny odcień akcentu do TEKSTU (primary.main). Podajemy tu "Jasny
  // tekst" z kuratorowanej palety rasy - dzięki temu nagłówki/akcenty w całej grze
  // są miękkie (np. przygaszony róż wampira), zamiast auto-rozjaśnianej, ostrej
  // czerwieni. Gdy brak/nieprawidłowy - liczymy jak dotąd (ensureReadableOn).
  accentReadable = null,
  // Kolor obwódek/dividerów: "kolor środkowy" rasy (brąz/grafit) jako kontrast do
  // ramek. Gdy null - fallback do dawnego rustGlow (akcent). Robimy z niego
  // półprzezroczysty divider, żeby obwódki nie były zbyt ciężkie.
  dividerColor = null
) {
  const isDark = mode === 'dark';
  const base = HEX_RE.test(primaryColor || '') ? primaryColor : DEFAULT_PRIMARY_COLOR;
  const textBase = HEX_RE.test(textColor || '') ? textColor : DEFAULT_TEXT_COLOR;
  const bgBase = HEX_RE.test(backgroundColor || '') ? backgroundColor : DEFAULT_BACKGROUND_COLOR;

  // ==========================================
  // KOLORY BAZOWE - MROCZNY, STONOWANY MOTYW
  // ==========================================

// PALETA DARK THEME
const darkColors = {
  // AKCENT GŁÓWNY - wyliczony z koloru wybranego w kreatorze
  rust: base,                            // Główny kolor akcentu (hover background)
  rustLight: shadeHex(base, 0.35),       // Jaśniejszy odcień (hover border)
  rustDark: shadeHex(base, -0.25),       // Ciemniejszy odcień
  rustGlow: hexToRgba(shadeHex(base, 0.2), 0.4), // Obramówki

  // METAL I BETON
  steel: '#3c3f44',
  steelLight: '#4a5568',
  steelDark: '#2d3748',
  concrete: shadeHex(bgBase, 0.1),
  darkMetal: shadeHex(bgBase, 0.1),
  blackRust: bgBase,

  // AKCENTY
  warning: '#d9a441',        // Czytelny bursztyn (był surowy `base` -> fatalny kontrast tekstu/etykiet)
  danger: '#9b2c2c',         // Czerwony z Sidebar
  success: '#059669',
  info: '#0369a1',

  // TEKST - wyliczony z koloru wybranego w kreatorze
  textPrimary: textBase,
  textSecondary: shadeHex(textBase, -0.2),
  textDisabled: shadeHex(textBase, -0.4)
};

  // PALETA LIGHT THEME - stonowane brązy i szarości
const lightColors = {
  // ==========================================
  // TŁA - JASNE BETONOWE Z ODROBINĄ CIEPŁA
  // ==========================================
  sand: '#e8e4e0',              // Jasny beton (karty)
  sandDark: '#d4cfc9',          // Średni beton
  sandLight: '#f5f2ee',         // Bardzo jasny beton (główne tło)
  
  // ==========================================
  // PRIMARY - wyliczone z koloru wybranego w kreatorze
  // ==========================================
  earth: base,                       // Główny akcent
  earthDark: shadeHex(base, -0.25),  // Ciemniejszy odcień
  earthLight: shadeHex(base, 0.35),  // Jaśniejszy odcień
  
  // ==========================================
  // SECONDARY - CIEPŁE BRĄZY
  // ==========================================
  rust: '#8b4513',              // Brąz siodłowy
  rustDark: '#654321',          // Ciemny brąz
  rustLight: '#a0522d',         // Jasny brąz
  
  // ==========================================
  // AKCENTY - PRZYGASZONE
  // ==========================================
  warning: '#d97706',           
  danger: '#9b2c2c',            // Jak w sidebarze
  success: '#059669',           
  info: '#0369a1',              
  
  // ==========================================
  // TEKSTY - CIEMNE NA JASNYM TLE
  // ==========================================
  textPrimary: '#2d2d2d',       // Ciemny szary (główny tekst)
  textSecondary: '#718096',     // Średnioszary (jak sidebar)
  textDisabled: '#9ca3af'       // Jasny szary (wyłączony)
};

const colors = isDark ? darkColors : lightColors;

const lightPalette = {
  mode: 'light',
  primary: {
    main: lightColors.earth,           // #7a3b0f - ciemny brąz/rdza
    light: lightColors.earthLight,     // #a0522d - jaśniejszy brąz
    dark: lightColors.earthDark,       // #5c2b08 - bardzo ciemny brąz
    mainLight: lightColors.earthLight, // dodatkowy dla kompatybilności
    contrastText: '#ffffff'       
  },
  secondary: {
    main: lightColors.rust,            // #8b4513 - brąz
    light: lightColors.rustLight,      // #a0522d
    dark: lightColors.rustDark,        // #654321
    text: '#4a5568',                   // 5.95 na #e8e4e0
    contrastText: '#ffffff'
  },
  background: {
    default: lightColors.sandLight,    // #f5f2ee - bardzo jasny beton (główne tło)
    paper: lightColors.sand,           // #e8e4e0 - jasny beton (karty)
  },
  text: {
    primary: lightColors.textPrimary,      // #2d2d2d - ciemny tekst
    secondary: lightColors.textSecondary,  // #718096 - średnioszary
    disabled: lightColors.textDisabled,    // #9ca3af - jasny szary
  },
  divider: 'rgba(122, 59, 15, 0.15)',  // Brązowy divider z przezroczystością
  // `.text` - patrz komentarz przy darkPalette. W trybie jasnym czytelny wariant
  // jest CIEMNIEJSZY od `main` (kontrast liczony na karcie #e8e4e0).
  error: {
    main: lightColors.danger,           // #9b2c2c
    light: '#c53030',
    dark: '#742a2a',
    text: '#742a2a',                    // 7.88 na #e8e4e0
    contrastText: '#ffffff'
  },
  warning: {
    main: lightColors.warning,          // #d97706
    light: '#f59e0b',
    dark: '#92400e',
    text: '#92400e',                    // 5.61 na #e8e4e0
    contrastText: '#ffffff'
  },
  success: {
    main: lightColors.success,          // #059669
    light: '#10b981',
    dark: '#047857',
    text: '#03624a',                    // ciemniejszy od `dark` - AA na karcie
    contrastText: '#ffffff'
  },
  info: {
    main: lightColors.info,             // #0369a1
    light: '#0284c7',
    dark: '#075985',
    text: '#075985',                    // 5.98 na #e8e4e0
    contrastText: '#ffffff'
  },
};

  // Kolor akcentu czytelny jako TEKST na mrocznym tle. Jesli admin wybral ciemna
  // barwe (np. gleboki krwawy czerwony), rozjasniamy ja tylko na tyle, by spelniala
  // kontrast WCAG - barwa zostaje ta sama, ale przestaje zlewac sie z tlem.
  const readableAccent = HEX_RE.test(accentReadable || '')
    ? accentReadable
    : ensureReadableOn(base, bgBase, 4.5);

  // Kolor dividera rasy (ton środkowy). Używany zarówno jako palette.divider,
  // jak i jako PODŚWIETLENIE (hover) przycisków w całej grze - zależne od rasy.
  const hasDivider = dividerColor && HEX_RE.test(dividerColor);
  const dividerFinal = hasDivider ? hexToRgba(dividerColor, 0.5) : colors.rustGlow;
  const btnHighlight = hasDivider ? hexToRgba(dividerColor, 0.55) : `${colors.rust}30`;
  const btnHighlightStrong = hasDivider ? hexToRgba(dividerColor, 0.78) : `${colors.rust}55`;

  const darkPalette = {
    mode: 'dark',
    primary: {
      main: readableAccent,
      light: shadeHex(readableAccent, 0.25),
      dark: colors.rust,              // pierwotny, glebszy odcien do tel/obramowan/poswiaty
      accent: colors.rust,           // surowa barwa wybrana przez admina (do wypelnien)
      contrastText: colors.blackRust
    },
    secondary: {
      main: colors.steel,
      light: colors.steelLight,
      dark: colors.steelDark,
      // `main` (#3c3f44) ma na tle panelu kontrast 1.73 - nadaje się na
      // wypełnienia i obwódki, ale jako LITERY jest praktycznie niewidoczny.
      // `text` to ten sam, stalowy charakter podniesiony do 8.1.
      text: '#a0aec0',
      contrastText: colors.textPrimary
    },
    background: {
      // default = tło całości (za panelami, neutralne). paper = WYPEŁNIENIE
      // boxów/kart => neutralne #151515 (główny kolor paneli w grze).
      default: colors.blackRust,
      paper: '#151515',
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textDisabled,
    },
    // Divider/obramowania w kolorze RASY (był zaszyty brąz rgba(140,84,52) - stąd
    // pomarańczowe bordery na /profile i wielu innych ekranach). rustGlow liczy się
    // z akcentu (koloru rasy), więc wszystkie `theme.palette.divider` idą za rasą.
    divider: dividerFinal,
    // ==========================================
    // WARIANT `.text` KAŻDEGO KOLORU STATUSU
    // ==========================================
    // `main` każdej rodziny jest dobrany pod WYPEŁNIENIA i OBWÓDKI (pasek HP,
    // ramka karty, tło chipa) - stąd głębokie, nasycone barwy. Jako kolor LITER
    // na mrocznym panelu (#151515) te same wartości mają kontrast 2.4-3.1, czyli
    // poniżej progu WCAG AA (4.5). Dlatego każda rodzina dostaje osobny odcień
    // `.text`: ta sama barwa, podniesiona do czytelności. Zasada w całej grze:
    //   tło/obwódka -> `main`,  litery/ikony -> `text`.
    error: {
      main: colors.danger,
      light: '#a83a3a',
      dark: '#6d1f1f',
      text: '#d97070',            // 5.65 na #151515 (main ma 2.43)
      contrastText: colors.textPrimary
    },
    warning: {
      main: colors.warning,
      light: '#a88a2f',
      dark: '#6d5815',
      text: colors.warning,       // 8.12 - bursztyn był już czytelny
      contrastText: colors.textPrimary
    },
    success: {
      main: colors.success,
      light: '#42a87a',
      dark: '#1f6d4a',
      text: '#34b88a',            // 7.28 na #151515 (main ma 4.85)
      contrastText: colors.textPrimary
    },
    info: {
      main: colors.info,
      light: '#6d8a9a',
      dark: '#3d5564',
      text: '#5aa9d6',            // 7.03 na #151515 (main ma 3.08)
      contrastText: colors.textPrimary
    },
  };

  const palette = isDark ? darkPalette : lightPalette;

  // ==========================================
  // SHADOWS - MROCZNE CIENIE
  // ==========================================
  // UWAGA: MUI wymaga DOKŁADNIE 25 poziomów (indeksy 0-24). Wcześniej tablica
  // miała 12 wpisów, więc `theme.shadows[24]` było `undefined` - a to domyślna
  // elevation komponentu Dialog (Drawer używa 16). Efekt: WSZYSTKIE dialogi i
  // szuflady w grze renderowały się bez cienia, zlewając się z tłem, tak samo
  // jak ~12 modali pisanych wprost przez `boxShadow: 24`. `padShadows` dociąga
  // tablicę do 25 pozycji powtarzając najgłębszy zdefiniowany cień.
  const padShadows = (list) => {
    const out = list.slice(0, 25);
    while (out.length < 25) out.push(list[list.length - 1]);
    return out;
  };
  const shadows = padShadows(isDark ? [
    'none',
    '0 2px 8px rgba(0, 0, 0, 0.8)',
    '0 4px 12px rgba(0, 0, 0, 0.85)',
    '0 6px 16px rgba(0, 0, 0, 0.9)',
    '0 8px 20px rgba(0, 0, 0, 0.95)',
    '0 10px 24px rgba(0, 0, 0, 0.95)',
    '0 12px 28px rgba(0, 0, 0, 0.95)',
    '0 14px 32px rgba(0, 0, 0, 0.98)',
    '0 16px 36px rgba(0, 0, 0, 0.98)',
    '0 18px 40px rgba(0, 0, 0, 0.98)',
    '0 20px 60px rgba(0, 0, 0, 0.98)',
    '0 25px 80px rgba(0, 0, 0, 1)',
  ] : [
    'none',
    '0 1px 3px rgba(61, 47, 31, 0.12), 0 1px 2px rgba(61, 47, 31, 0.24)',
    '0 3px 6px rgba(61, 47, 31, 0.16), 0 3px 6px rgba(61, 47, 31, 0.23)',
    '0 10px 20px rgba(61, 47, 31, 0.19), 0 6px 6px rgba(61, 47, 31, 0.23)',
    '0 14px 28px rgba(61, 47, 31, 0.25), 0 10px 10px rgba(61, 47, 31, 0.22)',
    '0 19px 38px rgba(61, 47, 31, 0.30), 0 15px 12px rgba(61, 47, 31, 0.22)',
    '0 2px 4px rgba(61, 47, 31, 0.1)',
    '0 4px 8px rgba(61, 47, 31, 0.15)',
    '0 6px 12px rgba(61, 47, 31, 0.2)',
    '0 8px 16px rgba(61, 47, 31, 0.25)',
    '0 10px 20px rgba(61, 47, 31, 0.3)',
    '0 12px 24px rgba(61, 47, 31, 0.35)',
  ]);

  // ==========================================
  // THEME CONFIG
  // ==========================================

  // ROZMIARY NAGŁÓWKÓW - jawne i responsywne.
  // Wcześniej h1-h6 nie miały `fontSize`, więc brały domyślne wartości MUI
  // przemnożone przez współczynnik `typography.fontSize` (15.5/14 = 1.107).
  // Przy bazie <html> 120% dawało to np. h4 = 2.125 * 1.107 * 19.2px ~= 45px -
  // a `variant="h4"` to nagłówek KAŻDEJ strony encyklopedii (PanelHeader), więc
  // na telefonie 360px tytuły wersalikami w Cinzel łamały się i wychodziły poza
  // panel. Rozmiary podajemy w `rem`, żeby dalej szły za osobistą skalą czcionki
  // gracza (fontScale.js), i zbijamy je na wąskich ekranach.
  const heading = (desktopRem, mobileRem, extra = {}) => ({
    fontFamily: '"Cinzel", serif',
    fontSize: `${desktopRem}rem`,
    lineHeight: 1.2,
    '@media (max-width:600px)': {
      fontSize: `${mobileRem}rem`,
    },
    color: palette.text.primary,
    ...extra,
  });

  return createTheme({
    palette,
    // Gra rysuje ostre, "kute" krawędzie - w komponentach było 630 ręcznych
    // nadpisań `borderRadius: 0`, a motyw deklarował 4. Ustawiamy motyw zgodnie
    // z tym, jak gra NAPRAWDĘ wygląda, żeby nowy kod nie musiał już zerować
    // promienia u siebie (i żeby nikt tego nie przeoczył - stąd rozjazd promieni
    // 0/1/2/4/8/12/16/24 px między ekranami).
    shape: {
      borderRadius: 0
    },
    shadows,
    
    typography: {
      // JEDNO ŹRÓDŁO PRAWDY dla fontów całej gry. Baza = czytelny serif "kroniki".
      // Cinzel zostaje TYLKO na nagłówkach h1-h6 i przyciskach (warianty niżej +
      // override MuiButton). Komponenty nie ustawiają już fontu u siebie -
      // wszystko dziedziczy stąd. Chcesz zmienić font gry? Zmień te wartości.
      fontFamily: '"EB Garamond", Georgia, serif',
      // EB Garamond ma niski "x-height" i optycznie wygląda drobniej niż fonty
      // bezszeryfowe w tym samym rozmiarze - podbijamy bazę z domyślnych 14 na 15.5,
      // żeby cały tekst wariantowy (body1/body2 itd.) był czytelniejszy.
      fontSize: 15.5,
      fontWeightBold: 700,
      fontWeightMedium: 600,
      fontWeightRegular: 400,

      h1: heading(2.4, 1.75, {
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        textShadow: isDark
          ? '2px 2px 4px rgba(0,0,0,0.8)'
          : '1px 1px 2px rgba(61, 47, 31, 0.2)'
      }),
      h2: heading(2.0, 1.55, {
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        textShadow: isDark
          ? '1px 1px 3px rgba(0,0,0,0.7)'
          : '1px 1px 1px rgba(61, 47, 31, 0.15)'
      }),
      h3: heading(1.75, 1.4, {
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
      }),
      h4: heading(1.5, 1.2, {
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }),
      h5: heading(1.25, 1.05, {
        fontWeight: 600,
        letterSpacing: '0.04em',
      }),
      h6: heading(1.1, 1.0, {
        fontWeight: 600,
        letterSpacing: '0.03em',
      }),
      // Dłuższy tekst (opisy, wiadomości, treści RP) - klimatyczny serif "kroniki",
      // spójny z resztą UI (dark fantasy: Cinzel na tytuły, EB Garamond na treść).
      body1: {
        fontFamily: '"EB Garamond", Georgia, serif',
        lineHeight: 1.6,
        letterSpacing: 'normal',
      },
      body2: {
        fontFamily: '"EB Garamond", Georgia, serif',
        lineHeight: 1.5,
        letterSpacing: 'normal',
      },
      button: {
        fontFamily: '"Cinzel", serif',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      },
      caption: {
        fontFamily: '"EB Garamond", Georgia, serif',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        fontSize: '0.75rem',
      },
    },

    // ==========================================
    // KOMPONENTY
    // ==========================================
    components: {
      // PAPER - PŁASKA POWIERZCHNIA PANELU
      // Gradient + `backdrop-filter: blur` dawały trzeci, konkurencyjny wygląd
      // "karty" (obok PanelUI i ręcznych stylów w komponentach) i - co gorsza -
      // blur na każdym Paperze to osobna warstwa kompozycji GPU, kosztowna przy
      // długich listach na telefonie. Zostaje płaskie wypełnienie + cienka
      // obwódka; głębię panelu głównego daje tekstura z Home.js.
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            // Wartość wprost, NIE `appColors.borderSteel` - `appColors` jest
            // inicjalizowane niżej w tym pliku niż wywołanie createAppTheme('dark'),
            // więc odwołanie do niego stąd poleciałoby TDZ-em przy starcie apki.
            border: `1px solid ${isDark ? '#2d3748' : 'rgba(45, 31, 15, 0.35)'}`,
            borderRadius: 0,
          },
        },
      },

      // BUTTON - INDUSTRIALNE PRZYCISKI
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: '"Cinzel", serif',
            padding: '8px 20px',
            border: '2px solid',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
            // CEL DOTYKU. W grze jest ~470 przycisków `size="small"` (Profil 52,
            // Ekwipunek 43, Arena 25...), które na telefonie mają ~30px - poniżej
            // progu, przy którym da się w nie trafić palcem. Podbijamy je TYLKO
            // na urządzeniach dotykowych (`pointer: coarse`), więc na desktopie
            // z myszą gęste tabele i paski narzędzi zostają bez zmian.
            '@media (pointer: coarse)': {
              minHeight: 40,
            },
          },

          // Warianty kolorystyczne "na literach": tekstowy i konturowy Button
          // bierze kolor z `palette.<kolor>.main`, a te są dobrane pod
          // WYPEŁNIENIA (error.main ma na panelu kontrast 2.43). Dla wariantów,
          // w których barwa niesie sam NAPIS, przełączamy je na `.text`.
          textError:        { color: palette.error.text },
          outlinedError:    { color: palette.error.text, borderColor: `${palette.error.main}` },
          textSecondary:    { color: palette.secondary.text },
          outlinedSecondary:{ color: palette.secondary.text, borderColor: palette.secondary.main },
          textInfo:         { color: palette.info.text },
          outlinedInfo:     { color: palette.info.text, borderColor: palette.info.main },
          textSuccess:      { color: palette.success.text },
          outlinedSuccess:  { color: palette.success.text, borderColor: palette.success.main },
          textWarning:      { color: palette.warning.text },
          outlinedWarning:  { color: palette.warning.text, borderColor: palette.warning.main },


          contained: {
            backgroundColor: isDark 
              ? `${colors.rust}40`
              : colors.earth,        // #2d1f0f - ciemny brąz
            color: '#ffffff',
            borderColor: isDark 
              ? `${colors.rust}80`
              : colors.earthDark,    // #1a0f05
            
            '&:hover': {
              // Podświetlenie hover = kolor dividera rasy (ton środkowy).
              backgroundColor: isDark
                ? btnHighlightStrong
                : colors.earthDark,  // Ciemniejszy przy hover
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(61, 47, 31, 0.3)',
            },
          },

          outlined: {
            borderColor: isDark
              ? `${colors.rust}80`
              : colors.earth,        // #2d1f0f
            color: isDark ? colors.rustLight : colors.earth,
            backgroundColor: 'transparent',

            '&:hover': {
              // Podświetlenie hover = kolor dividera rasy (ton środkowy).
              backgroundColor: isDark
                ? btnHighlight
                : 'rgba(61, 47, 31, 0.08)',
              borderColor: isDark ? colors.rustLight : colors.earthDark,
            },
          },

          text: {
            color: isDark ? colors.steelLight : colors.earth,
            borderColor: 'transparent',
            '&:hover': {
              // Podświetlenie hover = kolor dividera rasy (ton środkowy).
              backgroundColor: isDark
                ? btnHighlight
                : 'rgba(61, 47, 31, 0.05)',
            },
          },
        },
      },

      // TEXTFIELD - INDUSTRIALNE INPUTY
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: isDark 
                ? `${colors.blackRust}60`
                : '#ffffff',          // Białe tło dla lepszego kontrastu
              borderRadius: 0,
              fontFamily: '"Cinzel", serif',
              
              '& fieldset': {
                borderColor: isDark 
                  ? `${colors.rust}40` 
                  : 'rgba(45, 31, 15, 0.5)',  // Widoczna ramka
                borderWidth: '2px',
              },
              '&:hover fieldset': {
                borderColor: isDark ? `${colors.rust}60` : colors.earth,
              },
              '&.Mui-focused fieldset': {
                borderColor: isDark ? colors.rust : colors.rust,  // Rdza przy focus
                borderWidth: '2px',
              },
            },
            
            '& .MuiInputLabel-root': {
              color: isDark ? colors.steelLight : colors.textSecondary,
              fontFamily: '"Cinzel", serif',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              '&.Mui-focused': { 
                color: isDark ? colors.rust : colors.rust
              },
            },
            
            '& .MuiInputBase-input': {
              color: isDark ? colors.textPrimary : colors.textPrimary,  // Czarny tekst
              // Cinzel to font dekoracyjny wzorowany na rzymskich kapitalikach - nie ma
              // prawdziwych małych liter, więc wpisywany tekst (hasła, nazwy userów,
              // kolory HEX) wygląda jak same wielkie litery mimo że wartość jest
              // normalna. Wymuszamy tu czytelny font z prawdziwym rozróżnieniem
              // wielkości liter, niezależnie od dekoracyjnego fontu reszty pola.
              fontFamily: '"EB Garamond", Georgia, serif',
              fontSize: '1.05rem',
            },
          },
        },
      },

      // CHIP - BRUDNE ETYKIETY
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: isDark 
              ? `${colors.rust}20`
              : 'rgba(122, 59, 15, 0.2)',  // Lekko rdzawe tło
            color: isDark ? 'inherit' : colors.earth,  // Ciemny tekst
            border: `2px solid ${isDark ? `${colors.rust}40` : 'rgba(122, 59, 15, 0.5)'}`,
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderRadius: 0,
          },
        },
      },

      // TABS
      MuiTabs: {
        styleOverrides: {
          root: {
            borderBottom: `2px solid ${isDark ? palette.divider : 'rgba(61, 47, 31, 0.2)'}`,
          },
          indicator: {
            backgroundColor: isDark ? colors.rust : colors.rust,  // Rdza
            height: 3,
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontFamily: '"Cinzel", serif',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            minHeight: 48,
            fontSize: '0.85rem',
            color: isDark ? colors.textSecondary : colors.textSecondary,
            
            '&:hover': { 
              color: isDark ? colors.rustLight : colors.rust,
              backgroundColor: isDark ? 'transparent' : 'rgba(139, 69, 19, 0.05)',
            },
            '&.Mui-selected': { 
              color: isDark ? colors.rustLight : colors.rust,
              fontWeight: 700,
            },
          },
        },
      },

      // APPBAR
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark 
              ? `${colors.darkMetal}cc` 
              : `${colors.sand}f0`,  // Prawie nieprzezroczyste
            borderBottom: `2px solid ${isDark ? palette.divider : 'rgba(61, 47, 31, 0.15)'}`,
            backdropFilter: 'blur(12px)',
          },
        },
      },

      // DRAWER
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark 
              ? `${colors.darkMetal}ee` 
              : `${colors.sand}f5`,
            borderRight: `2px solid ${isDark ? palette.divider : 'rgba(61, 47, 31, 0.15)'}`,
          },
        },
      },

      // LIST ITEM
      MuiListItem: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            margin: '1px 0',
            
            '&:hover': {
              backgroundColor: isDark
                ? `${colors.rust}15`
                : 'rgba(139, 69, 19, 0.08)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark
                ? `${colors.rust}25`
                : 'rgba(122, 59, 15, 0.2)',
              '&:hover': {
                backgroundColor: isDark
                  ? `${colors.rust}30`
                  : 'rgba(139, 69, 19, 0.2)',
              },
            },
          },
        },
      },

      // PROGRESS
      MuiCircularProgress: {
        styleOverrides: {
          root: {
            color: isDark ? colors.rust : colors.rust,
          }
        },
      },

      // CARD - JEDEN JĘZYK KART W CAŁEJ GRZE
      // Domyślna karta MUI miała własny wygląd (gradient rdzy, 2px obwódka,
      // blur, promień 4), inny niż `panelRowSx`/`panelSectionSx` z PanelUI.js.
      // Efekt było widać w obrębie JEDNEJ strony: formularz admina wyglądał
      // inaczej niż wiersze listy pod nim. Teraz domyślna karta = ten sam
      // płaski panel co w PanelUI: wypełnienie bgDeep, 1px stal, ostre rogi.
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#151515' : '#e8e4e0',
            border: `1px solid ${isDark ? '#2d3748' : 'rgba(61, 47, 31, 0.25)'}`,
            borderRadius: 0,
          },
        },
      },

      // ICONBUTTON - cel dotyku + czytelne warianty kolorystyczne
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            '@media (pointer: coarse)': {
              minWidth: 40,
              minHeight: 40,
            },
          },
          colorError:     { color: palette.error.text },
          colorSecondary: { color: palette.secondary.text },
          colorInfo:      { color: palette.info.text },
          colorSuccess:   { color: palette.success.text },
          colorWarning:   { color: palette.warning.text },
        },
      },

      // DIALOG - PRAWIE PEŁNY EKRAN NA TELEFONIE
      // W grze jest ~250 dialogów (sam Profil ma ~40) i ANI JEDEN nie ustawiał
      // `fullScreen`. Domyślnie MUI daje im `maxWidth="sm"` + 32px marginesu,
      // przez co formularze na ekranie 360px robiły się nieużywalne. Zamiast
      // dopisywać prop w 250 miejscach (i ryzykować, że gdzieś się zapomni),
      // rozpycha je CSS - działa też dla dialogów dopisanych w przyszłości.
      MuiDialog: {
        styleOverrides: {
          paper: {
            '@media (max-width:600px)': {
              margin: 8,
              width: 'calc(100% - 16px)',
              maxWidth: 'calc(100% - 16px)',
              maxHeight: 'calc(100% - 16px)',
            },
          },
        },
      },

      // TOOLTIP
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark 
              ? colors.darkMetal 
              : colors.earth,        // #2d1f0f - ciemny brąz
            color: '#ffffff',
            border: `2px solid ${isDark ? `${colors.rust}40` : colors.earthDark}`,
            fontFamily: '"Cinzel", serif',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: 0,
            padding: '8px 12px',
          },
        },
      },

      // ALERT
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            border: '2px solid',
            fontFamily: '"Cinzel", serif',
            fontWeight: 600,
          },
          standardError: {
            backgroundColor: isDark ? 'rgba(158, 5, 5, 0.1)' : 'rgba(220, 38, 38, 0.1)',
            color: isDark ? '#ff6b6b' : '#dc2626',
            borderColor: isDark ? '#9e0505' : '#dc2626',
          },
          standardWarning: {
            backgroundColor: isDark ? 'rgba(145, 41, 0, 0.1)' : 'rgba(217, 119, 6, 0.1)',
            color: isDark ? '#fbbf24' : '#d97706',
            borderColor: isDark ? '#912900' : '#d97706',
          },
          standardSuccess: {
            backgroundColor: isDark ? 'rgba(34, 46, 40, 0.2)' : 'rgba(5, 150, 105, 0.1)',
            color: isDark ? '#10b981' : '#059669',
            borderColor: isDark ? '#222e28' : '#059669',
          },
          standardInfo: {
            backgroundColor: isDark ? 'rgba(29, 34, 36, 0.2)' : 'rgba(3, 105, 161, 0.1)',
            color: isDark ? '#38bdf8' : '#0369a1',
            borderColor: isDark ? '#1d2224' : '#0369a1',
          },
        },
      },
    },
  });
}

// ==========================================
// EKSPORTY
// ==========================================
export const darkTheme = createAppTheme('dark');
export const theme = darkTheme;

// ==========================================
// TOKENY KOLORÓW APLIKACJI (APP-LEVEL UI)
// ==========================================
export const appColors = {
  bgDeep: '#151515',
  bgSurface: '#1a1d23',
  borderSteel: '#2d3748',
  steel: '#4a5568',
  steelLight: '#718096',
  steelLighter: '#a0aec0',
  // Przygaszony tekst pomocniczy (nadkreślenia, etykiety, jednostki). `steel`
  // był do tego używany w 37 miejscach, ale ma na tle panelu kontrast 2.43 -
  // przy rozmiarach rzędu 0.65rem, w jakich te etykiety występują, jest
  // nieczytelny. Ten sam, stalowy charakter, tylko podniesiony do 8.10.
  textMuted: '#a0aec0',
  textPrimary: '#cbd5e0',
  textLight: '#e2e8f0',
  dangerBorder: '#742a2a',
  dangerDark: '#5c1f1f',
  dangerText: '#9b2c2c',
  // Akcent bazowy (domyślny = człowiek). W grze appColors.rust jest nadpisywany
  // w runtime kolorem RASY (applyThemeColors); ten default łapią m.in. ekrany auth,
  // które budują lokalny COLORS z appColors.rust w momencie importu -> złoto człowieka.
  rust: '#63571D',
  rustLight: '#8a7c2e',
  rustDark: '#3f3714',
  rustBorder: 'rgba(99, 87, 29, 0.4)',
  glassRust: 'rgba(99, 87, 29, 0.2)',
  bgDark: 'rgba(0, 0, 0, 0.4)',
  bgMedium: 'rgba(0, 0, 0, 0.3)',
  bgVeryDark: 'rgba(0, 0, 0, 0.95)',
  dangerSoft: 'rgba(155, 44, 44, 0.6)',
  dangerSoftHover: 'rgba(155, 44, 44, 0.9)',
  // Trucizna / choroba - drugi filar palety obok głównego akcentu,
  // żeby alerty środowiskowe (zatrucie, klątwa) nie dzieliły koloru z combat-danger
  toxic: '#5c7a3d',
  toxicLight: '#8ca768',
  toxicDark: '#3f5729',
  toxicBorder: 'rgba(92, 122, 61, 0.4)',
  glassToxic: 'rgba(92, 122, 61, 0.2)',
  // Głęboka czerń - tła ekranów auth (Login, Register, ResetPassword)
  bgBlack: '#151515',
  // Neutralne kolory statusu (sukces/info/uwaga) - używane poza MUI theme.palette,
  // np. bezpośrednio w sx w CharacterCreator/StatsCard
  statusSuccess: '#48bb78',
  statusInfo: '#4299e1',
  statusWarning: '#ed8936',
  statusNeutral: '#718096',
  statusDanger: '#c0392b',
  statusGold: '#d9b866',
};

// Nadpisuje rodziny kolorów "rust" (akcent), tekstu i tła w appColors kolorami
// wybranymi w kreatorze instalacyjnym. appColors jest zwykłym obiektem
// importowanym przez wiele ekranów spoza MUI theme (Sidebar, TopBar, Login,
// CharacterCreator, ...), więc mutacja w miejscu jest wystarczająca - te
// komponenty czytają appColors.rust/textPrimary/bgDeep przy każdym renderze,
// nie tylko raz przy imporcie.
export function applyThemeColors({ primary, text, background } = {}) {
  const primaryBase = HEX_RE.test(primary || '') ? primary : DEFAULT_PRIMARY_COLOR;
  appColors.rust = primaryBase;
  appColors.rustLight = shadeHex(primaryBase, 0.35);
  appColors.rustDark = shadeHex(primaryBase, -0.25);
  appColors.rustBorder = hexToRgba(shadeHex(primaryBase, 0.15), 0.4);
  appColors.glassRust = hexToRgba(primaryBase, 0.2);

  const textBase = HEX_RE.test(text || '') ? text : DEFAULT_TEXT_COLOR;
  appColors.textPrimary = textBase;
  appColors.textLight = shadeHex(textBase, 0.15);
  appColors.steelLighter = shadeHex(textBase, -0.15);

  const bgBase = HEX_RE.test(background || '') ? background : DEFAULT_BACKGROUND_COLOR;
  appColors.bgDeep = bgBase;
  appColors.bgBlack = bgBase;
  appColors.bgSurface = shadeHex(bgBase, 0.1);
}

// Kolor rasy - rasy są w pełni dynamiczne (tabela `races`, dowolna liczba,
// edytowalne przez admina), więc nie da się ich zaszyć na sztywno w mapie kluczy.
// Zamiast tego liczymy zestaw {primary, light, border} na podstawie hex-a
// zapisanego w races.color (przesłanego przez GET /api/races), z domyślnym
// kolorem jako fallback gdy dana rasa go nie ma lub jeszcze się nie załadowała.
const DEFAULT_RACE_COLOR_HEX = '#8a6628';

// (Tu stała druga, identyczna deklaracja `hexToRgb` - usunięta. Jedna definicja
//  jest na górze pliku; patrz komentarz przy niej.)

// ==========================================
// KURATOROWANE PALETY RAS - przygaszone, "brudne", stare kolory w stylu
// Gothic 2 / Diablo IV (zamiast neonowych). Każda rasa dostaje 4 barwy:
//   primary (Główny)   - wypełnienia, poświata, BAZA motywu MUI (primary.*)
//   strong  (Akcent)   - mocniejszy akcent: nagłówki, aktywna zakładka
//   hover   (Hover)    - stany hover, poświata ramki tła
//   light   (Jasny tekst) - czytelny na ciemnym tle, do TEKSTU/etykiet
// Czerwień wampira jest tu celowo przygaszona i pełni rolę AKCENTU (nie zalewa
// całego UI) - większość tekstu i tak zostaje w kolorze pergaminu (text.primary).
// ==========================================
// Wspólna, mroczna baza dla wszystkich ras: bordo #211414 (Główny/deep). Każda
// rasa różni się TONEM ŚRODKOWYM (strong) i AKCENTEM (hover = operacyjny kolor
// rasy: nagłówki, obwódki, poświaty). `light` to jasny odcień akcentu - czytelny
// TEKST/etykiety na ciemnym tle.
export const RACE_PALETTES = {
  // Człowiek: stonowane, ciemne złoto (bez jaskrawej żółci). Bordo -> brąz #492f1b
  // (mid/dividery) -> ciemne złoto #63571D (akcent) -> jasne złoto na tekst.
  human:   { primary: '#211414', strong: '#492f1b', hover: '#63571D', light: '#D8D389' },
  // Wilkołak: głęboka, przygaszona leśna zieleń (bez neonu). Bordo -> brąz #2b200c
  // -> ciemna zieleń #1c321a (akcent) -> jasna szałwia na tekst.
  wolf:    { primary: '#211414', strong: '#2b200c', hover: '#1c321a', light: '#B4C9AD' },
  // Wampir: srebro/grafit. Bordo -> ciemny grafit #5a5252 -> srebro #999999
  // (akcent) -> jasne srebro na tekst.
  vampire: { primary: '#211414', strong: '#5a5252', hover: '#999999', light: '#D9D6D6' },
};

// Filtr CSS tintujący brązowo-złote ramki PNG (narożniki + belki) w kierunku
// koloru danej rasy. Ramki to statyczne grafiki (brąz), więc zamiast nowych
// plików przebarwiamy je filtrem - do dostrojenia wizualnego.
//   human   -> złota żółć (#999529)
//   wolf    -> leśna zieleń (#344931)
//   vampire -> srebro/grafit (#797777)
export function frameTintFilter(frameKey) {
  switch (frameKey) {
    case 'wolf':    return 'sepia(0.5) hue-rotate(55deg) saturate(0.6) brightness(0.72)';
    case 'vampire': return 'grayscale(1) brightness(0.95) contrast(1.0)';
    case 'human':
    default:        return 'sepia(0.55) hue-rotate(0deg) saturate(0.85) brightness(0.78)';
  }
}

// Rozpoznaje rasę kanoniczną po nazwie/kluczu (jak frameFromRace w komponentach).
// Zwraca null dla ras spoza trójki human/wolf/vampire - wtedy kolor bierzemy z
// bazy (races.color) i wyliczamy z niego zestaw, zachowując wsparcie dla ras
// dodanych przez admina.
export function raceFrameKey(name, key) {
  const nm = `${name || ''} ${key || ''}`.toLowerCase();
  if (/wampir|vampire|vamp/.test(nm)) return 'vampire';
  if (/wilko|wilk|wolf|lykan|lycan/.test(nm)) return 'wolf';
  if (/człowiek|czlowiek|human|ludz/.test(nm)) return 'human';
  return null;
}

// getRaceColorSet(hex, meta?) - gdy meta ({name, key}) wskazuje rasę kanoniczną,
// używamy jej kuratorowanej palety; w przeciwnym razie wyliczamy zestaw z `hex`
// (kolor rasy z panelu admina).
export function getRaceColorSet(hex, meta = null) {
  const frame = meta ? raceFrameKey(meta.name, meta.key) : null;
  const pal = frame ? RACE_PALETTES[frame] : null;
  if (pal) {
    // `primary` = Hover (przygaszony, "brudny" ale WIDOCZNY na ciemnym tle) - tym
    // odcieniem posługuje się większość kodu jako operacyjnym kolorem rasy (nagłówki,
    // obwódki, drobne wypełnienia). Nie jest ani neonowy, ani tak ciemny jak Główny,
    // więc etykiety pozostają czytelne, a całość jest stonowana. Najczytelniejszy
    // tekst to `accent` (Jasny tekst), mocniejsze wypełnienia to `strong` (Akcent),
    // a najgłębszy ton to `deep` (Główny).
    const h = hexToRgb(pal.hover);
    return {
      primary: pal.hover,     // operacyjny kolor rasy - przygaszony, widoczny
      accent: pal.light,      // najczytelniejszy tekst/etykiety na ciemnym tle
      strong: pal.strong,     // Akcent - mocniejsze obwódki/wypełnienia
      hover: pal.hover,       // hover / poświata ramki tła
      deep: pal.primary,      // Główny - najciemniejszy, do głębokich wypełnień/bazy
      // Kolor POŚWIATY (glow) wokół ozdobnych ramek PNG. Zwykle = strong (kolor
      // rasy), ale wampir dostaje osobne, głębokie bordo - srebrne kolory rasy
      // (strong/hover/light) zostają bez zmian, zmienia się TYLKO glow ramek.
      frameGlow: frame === 'vampire' ? '#341313' : pal.strong,
      light: `rgba(${h.r}, ${h.g}, ${h.b}, 0.15)`,
      soft: `rgba(${h.r}, ${h.g}, ${h.b}, 0.10)`,
      border: `rgba(${h.r}, ${h.g}, ${h.b}, 0.50)`,
      contrastText: '#0d0d0d',
    };
  }

  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_RACE_COLOR_HEX);
  const primary = hexToRgb(hex) ? hex : DEFAULT_RACE_COLOR_HEX;
  // `accent` to `primary` rozjasniony do minimalnego kontrastu WCAG na aktualnym
  // ciemnym tle gry - uzywac go do TEKSTU/etykiet, zeby kolor rasy byl czytelny.
  const bg = HEX_RE.test(appColors.bgDeep || '') ? appColors.bgDeep : DEFAULT_BACKGROUND_COLOR;
  const accent = ensureReadableOn(primary, bg, 4.5);
  return {
    primary,
    accent,
    strong: accent,
    hover: accent,
    deep: primary,
    frameGlow: accent,  // rasy custom: glow ramki = kolor rasy (jak dotąd)
    light: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    soft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`,
    border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
    contrastText: '#0d0d0d',
  };
}

// Font czytelnej treści RP (wiadomości/sesje/karczma) - serif EB Garamond,
// ten sam co globalny font body. Cinzel jest tylko do nagłówków/etykiet.
// Jawne ustawienie na treści wiadomości ujednolica wygląd wszystkich modułów
// komunikacji (private/general sessions, messages, tavern), które wcześniej
// dziedziczyły font różnie w zależności od rodzica.
export const RP_FONT = '"EB Garamond", Georgia, serif';

export const NOISE_SVG_URL = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjbm9pc2UpIiBvcGFjaXR5PSIwLjA1Ii8+PC9zdmc+)';

// Odstęp między akapitami treści RP - JEDNO źródło prawdy dla edytora
// (.ProseMirror w globalnych stylach) i dla gotowego postu (readingSurfaceSx).
// Trzymanie tego w jednym miejscu jest tu istotne: gdy obie wartości się
// rozjadą, tekst "podskakuje" po wysłaniu wiadomości, bo w edytorze wyglądał
// inaczej niż w poście.
//
// Zero: Enter ma dawać dokładnie to samo co Shift+Enter, czyli linię pod
// linią, bez dodatkowego powietrza. Kto chce pustą linię między akapitami,
// naciska Enter dwa razy - wtedy powstaje pusty akapit o wysokości jednej
// linii i to nadal działa. Wartość zostaje osobną stałą (a nie wpisanym na
// sztywno zerem), żeby dało się ją podnieść w jednym miejscu, gdyby jednak
// okazała się za ciasna.
export const PARAGRAPH_GAP = 0;
export const PARAGRAPH_GAP_MOBILE = 0;

// ==========================================
// GLOBALNE STYLE CSS
// ==========================================
export function createGlobalStyles(theme) {
  return {
    // ==========================================
    // TŁO GRY - JEDNO ŹRÓDŁO DLA CAŁEJ APLIKACJI
    // ==========================================
    // Grafika tła wisi na każdym ekranie (powłoka gry, lobby, kreator postaci,
    // ekrany logowania). Oryginał był PNG-iem 1536x1024 o wadze 3,2 MB - a jest
    // rozciągany przez `background-size: cover`, więc bezstratna kompresja nic
    // tu nie wnosi. WebP q80 waży 165 KB i jest wizualnie nieodróżnialny.
    //
    // Podajemy to jako zmienną CSS z DWIEMA deklaracjami: przeglądarka bez
    // `image-set()` zatrzymuje się na pierwszej (PNG, teraz też przycięty do
    // 1 MB), nowsza nadpisuje ją drugą i bierze WebP. Dzięki temu żaden ekran
    // nie zostaje bez tła, a komponenty wołają po prostu `var(--game-bg-image)`.
    ':root': {
      '--game-bg-image': 'url(/background.png)',
    },
    '@supports (background-image: image-set(url(/background.webp) type("image/webp")))': {
      ':root': {
        '--game-bg-image':
          'image-set(url(/background.webp) type("image/webp"), url(/background.png) type("image/png"))',
      },
    },
    'html, body': {
      margin: 0,
      padding: 0,
      height: '100%',
      overflow: 'auto',
      overflowY: 'auto',
      overflowX: 'hidden',
      backgroundColor: appColors.bgDeep,
    },
    // Globalne podbicie rozmiaru czcionki "o dwa w górę". Prawie cały tekst
    // GŁÓWNEGO BOXA jest w jednostkach rem, więc podniesienie bazowego font-size
    // na <html> skaluje go wszędzie naraz (city, sesje, karczma, wiadomości,
    // profil, StatsCard, wieści...). Rozmiary podane w px pozostają bez zmian -
    // dzięki temu TopBar i OnlineList (całe w px) NIE rosną razem z resztą gry,
    // tak jak avatary, ikony i wysokości przycisków/chipów. 120% = ~19.2px
    // zamiast 16px (poprzednio 110%). To BAZA - osobista skala gracza z Ustawień
    // (fontScale.js) nakłada się na to jako inline font-size na <html>.
    'html': {
      fontSize: `${BASE_HTML_FONT_PERCENT}%`,
    },
    '#root': {
      minHeight: '100vh',
      height: 'auto',
      backgroundColor: appColors.bgDeep,
    },
    '*': {
      scrollbarWidth: 'thin',
      scrollbarColor: `${appColors.steel} ${appColors.bgSurface}`,
      scrollBehavior: 'smooth',
    },
    '*::-webkit-scrollbar': { width: '10px', height: '10px' },
    '*::-webkit-scrollbar-track': {
      background: `linear-gradient(180deg, ${appColors.bgSurface} 0%, ${appColors.bgDeep} 50%, ${appColors.bgSurface} 100%)`,
      borderRadius: '0',
      border: `1px solid ${appColors.borderSteel}`,
      boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.9)',
    },
    '*::-webkit-scrollbar-thumb': {
      background: `linear-gradient(180deg, ${appColors.steel} 0%, ${appColors.borderSteel} 100%)`,
      borderRadius: '0',
      border: `1px solid ${appColors.bgSurface}`,
      boxShadow: 'inset 0 1px 2px rgba(113, 128, 150, 0.3), 0 0 5px rgba(0, 0, 0, 0.5)',
      transition: 'all 0.3s ease',
    },
    '*::-webkit-scrollbar-thumb:hover': {
      background: `linear-gradient(180deg, ${appColors.steelLight} 0%, ${appColors.steel} 100%)`,
      boxShadow: 'inset 0 1px 2px rgba(113, 128, 150, 0.5), 0 0 8px rgba(113, 128, 150, 0.3)',
    },
    '*::-webkit-scrollbar-thumb:active': {
      background: `linear-gradient(180deg, ${appColors.steelLighter} 0%, ${appColors.steelLight} 100%)`,
    },
    '*::-webkit-scrollbar-corner': { background: appColors.bgDeep },
    'html::-webkit-scrollbar, body::-webkit-scrollbar': { width: '14px' },
    'html::-webkit-scrollbar-track, body::-webkit-scrollbar-track': {
      background: `linear-gradient(90deg, ${appColors.bgDeep} 0%, ${appColors.bgSurface} 50%, ${appColors.bgDeep} 100%)`,
      borderLeft: `2px solid ${appColors.borderSteel}`,
    },
    'html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb': {
      background: `linear-gradient(180deg, ${appColors.steel} 0%, ${appColors.borderSteel} 50%, ${appColors.steel} 100%)`,
      borderRadius: '0',
      border: `2px solid ${appColors.bgDeep}`,
      boxShadow: 'inset 0 2px 4px rgba(113, 128, 150, 0.2), 0 0 10px rgba(0, 0, 0, 0.5)',
    },
    'html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover': {
      background: `linear-gradient(180deg, ${appColors.steelLight} 0%, ${appColors.steel} 50%, ${appColors.steelLight} 100%)`,
      boxShadow: 'inset 0 2px 4px rgba(113, 128, 150, 0.4), 0 0 15px rgba(113, 128, 150, 0.3)',
    },
    'body': {
      // Nie theme.typography.fontFamily (Cinzel) - to font bez prawdziwych
      // malych liter (styl rzymskich kapitalikow), wiec caly zwykly tekst bez
      // wlasnego nadpisania fontu (wiadomosci RP, opisy) wygladalby jak same
      // wielkie litery. Cinzel zostaje tylko tam, gdzie jest jawnie ustawiony
      // (naglowki, przyciski, etykiety - patrz warianty typography powyzej).
      fontFamily: '"EB Garamond", Georgia, serif',
      transition: 'all 0.3s ease',
      backgroundColor: appColors.bgDeep,
      color: appColors.textPrimary,
      position: 'relative',
    },
    'body::after': {
      content: '""',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundImage: NOISE_SVG_URL,
      animation: 'dustFloat 20s ease-in-out infinite',
      pointerEvents: 'none',
      opacity: 0.4,
      zIndex: 1,
      '@keyframes dustFloat': {
        '0%': { transform: 'translate(0, 0)' },
        '50%': { transform: 'translate(-2%, 2%)' },
        '100%': { transform: 'translate(0, 0)' },
      },
    },
    'button, [role="button"], a': {
      transition: 'all 0.2s ease',
      fontFamily: theme.typography.fontFamily,
    },
    '::selection': {
      backgroundColor: 'rgba(113, 128, 150, 0.3)',
      color: appColors.textLight,
    },
    // ODSTĘPY MIĘDZY AKAPITAMI W EDYTORZE (tiptap/ProseMirror).
    // Bez tej reguły każdy Enter tworzy akapit z domyślnym marginesem
    // przeglądarki (1em góra + 1em dół), więc między dwiema linijkami robiła się
    // przerwa wielkości całej pustej linii. Po wyzerowaniu Enter daje dokładnie
    // to samo co Shift+Enter - linię pod linią - a wartość jest ta sama co
    // w gotowym poście (patrz readingSurfaceSx niżej), więc to, co gracz widzi
    // podczas pisania, zgadza się z tym, co zobaczy po wysłaniu.
    '.ProseMirror p': {
      marginTop: 0,
      marginBottom: PARAGRAPH_GAP,
    },
    '.ProseMirror p:last-child': {
      marginBottom: 0,
    },
    '*:focus-visible': {
      outline: `2px solid ${appColors.steel}`,
      outlineOffset: '2px',
      boxShadow: 'none',
    },
    '.MuiTypography-root': {
      color: appColors.textPrimary,
    },
    '.MuiSvgIcon-root': {
      color: appColors.steelLight,
      filter: 'drop-shadow(0 0 2px rgba(113, 128, 150, 0.3))',
    },
    'a': {
      color: appColors.steelLight,
      textDecoration: 'none',
      '&:hover': {
        color: appColors.steelLighter,
        textShadow: '0 0 5px rgba(113, 128, 150, 0.5)',
      },
    },
    '@keyframes scanline': {
      '0%': { transform: 'translateY(-100%)' },
      '100%': { transform: 'translateY(100vh)' },
    },
    '@keyframes flicker': {
      '0%': { opacity: 0.97 },
      '50%': { opacity: 1 },
      '100%': { opacity: 0.97 },
    },
    '@keyframes unreadPulse': {
      '0%, 100%': { opacity: 1, boxShadow: `0 0 6px ${appColors.dangerText}` },
      '50%': { opacity: 0.5, boxShadow: `0 0 12px ${appColors.dangerText}` },
    },
    '@keyframes activeDot': {
      '0%, 100%': { opacity: 1, boxShadow: '0 0 6px #4ea94e' },
      '50%': { opacity: 0.6, boxShadow: '0 0 10px #4ea94e' },
    },
  };
}

// ==========================================
// REUŻYWALNE SX PROPS (App-level screens)
// ==========================================
// Delikatna, ZALEŻNA OD RASY "ramka" ambientu zamiast pełnoekranowej zasłony.
// Środek jest całkowicie przezroczysty (grafika świata ostra i widoczna), a kolor
// rasy tylko subtelnie muska KRAWĘDZIE ekranu - jak cienka poświata ramki. Do tego
// leciutkie przyciemnienie góra/dół dla czytelności paneli. Ponieważ barwa siedzi
// tylko na brzegach i ma niskie krycie, nawet czerwień wampira nie męczy oczu.
export function raceAmbientOverlay(hex) {
  const clean = HEX_RE.test(hex || '') ? hex : DEFAULT_PRIMARY_COLOR;
  const edge = hexToRgba(clean, 0.54);
  const edgeSoft = hexToRgba(clean, 0.26);
  const bottom = hexToRgba(clean, 0.42);
  const top = hexToRgba(clean, 0.22);
  // Wyraźna, "ramkowa" poświata rasy: szeroki, mocny brzeg + duża łuna u dołu
  // (jak zachód nad horyzontem) i lekka u góry. Środek pozostaje przezroczysty,
  // więc grafika świata jest ostra, a kolor rasy realnie widać. Ostatnia, płaska
  // warstwa czerni (0.12) przyciemnia całość o ~10%.
  return `
    radial-gradient(ellipse 110% 60% at 50% 116%, ${bottom} 0%, transparent 64%),
    radial-gradient(ellipse 114% 46% at 50% -12%, ${top} 0%, transparent 60%),
    radial-gradient(ellipse 130% 124% at 50% 50%, transparent 38%, ${edgeSoft} 64%, ${edge} 100%),
    linear-gradient(180deg, rgba(6,5,7,0.30) 0%, transparent 28%, transparent 72%, rgba(5,4,6,0.46) 100%),
    linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.12))
  `;
}

// Neutralna wersja (bez rasy) - do /lobby (karuzela z różnymi rasami) i ekranów
// ładowania. Ciepła, przygaszona łuna zachodu + płaskie przyciemnienie ~10%.
export const subtleAmbientOverlay = `
  radial-gradient(ellipse 110% 60% at 50% 116%, rgba(150,72,38,0.38) 0%, transparent 64%),
  radial-gradient(ellipse 130% 124% at 50% 50%, transparent 38%, rgba(150,92,46,0.22) 64%, rgba(120,60,34,0.46) 100%),
  linear-gradient(180deg, rgba(6,5,7,0.30) 0%, transparent 28%, transparent 72%, rgba(5,4,6,0.48) 100%),
  linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.12))
`;

export const appBackgroundSx = {
  width: '100vw',
  height: '100vh',
  background: `radial-gradient(ellipse at center, ${appColors.bgSurface} 0%, ${appColors.bgDeep} 100%)`,
  position: 'fixed',
  top: 0,
  left: 0,
  zIndex: -1,
};

export const fullScreenCenterSx = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

export const dangerPanelBoxSx = {
  backgroundColor: appColors.bgSurface,
  border: `3px solid ${appColors.dangerBorder}`,
  borderRadius: '0',
  padding: 4,
  maxWidth: '800px',
  width: '90%',
  textAlign: 'center',
  boxShadow: `0 0 20px rgba(116, 42, 42, 0.4), inset 0 0 50px rgba(0, 0, 0, 0.5)`,
  backdropFilter: 'blur(10px)',
};

export const dangerTitleSx = {
  fontSize: '2rem',
  color: appColors.dangerText,
  textShadow: '0 0 10px rgba(155, 44, 44, 0.7)',
  margin: 0,
  mb: 3,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

export const dangerContentBoxSx = {
  fontSize: '1rem',
  color: appColors.textPrimary,
  lineHeight: 1.8,
  mb: 3,
  textAlign: 'left',
  backgroundColor: 'rgba(116, 42, 42, 0.1)',
  border: '1px solid rgba(116, 42, 42, 0.3)',
  padding: 2,
};

export const dangerButtonSx = {
  backgroundColor: appColors.dangerBorder,
  color: appColors.textLight,
  border: `2px solid ${appColors.dangerDark}`,
  borderRadius: '0',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  padding: '12px 24px',
  fontSize: '0.9rem',
  '&:hover': {
    backgroundColor: appColors.dangerText,
    boxShadow: '0 0 15px rgba(155, 44, 44, 0.7)',
  },
};

// Stałe, klimatyczne tło pod CZYTANE posty (Messages, PrivateSessions,
// GeneralSessions, Tavern). Ciemny "pergamin/skóra" z delikatną teksturą i
// wysokim kontrastem tekstu - treść RP jest czytelna niezależnie od ruchomego,
// zakurzonego tła strony. Theme-aware: ciemny panel w dark mode, jasny pergamin
// w light mode. Użycie: sx={{ ...readingSurfaceSx(theme), /* extra */ }}.
//
// TYPOGRAFIA NA MOBILE (xs) jest celowo CIAŚNIEJSZA niż na desktopie: mniejszy
// stopień pisma i wyraźnie mniejsza interlinia. Powód jest czysto praktyczny -
// przy bazie <html> 120% jedna linia miała na telefonie ~31 px wysokości
// (0.95rem x 1.7), więc na widocznym pasie treści mieściło się ledwie kilka
// linii. Wartości niżej dają ~24 px na linię, czyli około jednej czwartej
// więcej tekstu na tym samym ekranie, nadal przy czytelnym stopniu pisma
// (~17 px). Desktop zostaje bez zmian - tam miejsca nie brakuje.
// NA MOBILE (xs) post nie ma własnej "karty": znika ramka, tło i wewnętrzny
// cień, a tekst leży wprost na tle gry. Ramka z paddingiem zjadała po kilkanaście
// pikseli z każdej strony i pionowo na każdym poście, a przy jednym poście na
// ekran nie niosła żadnej informacji - posty rozdziela i tak poziomy ozdobnik
// pod każdym z nich. Na desktopie karta zostaje bez zmian.
export const readingSurfaceSx = (theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: 0,
    border: { xs: 'none', sm: `1px solid ${theme.palette.divider}` },
    borderLeft: { xs: 'none', sm: `3px solid ${theme.palette.primary.main}55` },
    px: { xs: 0, sm: 2 },
    // Desktop: 1.5 (12 px góra + 12 dół) na każdy post to przy kilku postach na
    // ekranie kilkadziesiąt pikseli samego powietrza wewnątrz ramek. 1.15 daje
    // ~5 px na post, czyli mniej więcej jedną dodatkową linię na ekran przy
    // czterech widocznych postach - a ramka wygląda tak samo.
    py: { xs: 0.25, sm: 1.15 },
    fontSize: { xs: '0.88rem', sm: '1.05rem' },
    // Interlinia na desktopie: 1.6 zamiast dawnych 1.7. Przy 20 px foncie to
    // 32 px zamiast 34 px na linię, czyli ~6% więcej tekstu na ekranie.
    // 1.6 to jednocześnie interlinia wariantu body1 z motywu, którą dziedziczy
    // edytor - dzięki temu tekst pisany i tekst wysłany mają IDENTYCZNY rytm
    // linii, a post nie "przeskakuje" po wysłaniu.
    lineHeight: { xs: 1.45, sm: 1.6 },
    color: isDark ? '#ece3d2' : '#2b2118',
    // Dark: bordo + tekstura bordo (kolor głównego tła boxu, z głębią).
    backgroundColor: { xs: 'transparent', sm: isDark ? '#151515' : '#f3ead6' },
    backgroundImage: {
      xs: 'none',
      sm: isDark
        ? 'url(/ui/frames/panel-bg-neutral.png)'
        : 'linear-gradient(180deg, rgba(255,252,244,0.7) 0%, rgba(228,216,190,0.7) 100%)',
    },
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    boxShadow: {
      xs: 'none',
      sm: isDark
        ? 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 28px rgba(0,0,0,0.4)'
        : 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 28px rgba(120,90,40,0.08)',
    },
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    width: '100%',
    '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' },
    // Treść postów przychodzi z edytora jako HTML, więc każdy akapit dostaje
    // domyślny margines przeglądarki (1em góra + 1em dół). Przy kilku akapitach
    // to kilkadziesiąt pikseli samego powietrza. Zerujemy oba - akapity mają
    // stać linia pod linią, tą samą wartością co w edytorze, żeby post po
    // wysłaniu wyglądał tak, jak wyglądał podczas pisania.
    '& p': {
      marginTop: 0,
      marginBottom: { xs: PARAGRAPH_GAP_MOBILE, sm: PARAGRAPH_GAP },
    },
    '& p:last-of-type': { marginBottom: 0 },
    '& blockquote': {
      marginTop: { xs: '0.4em', sm: '0.8em' },
      marginBottom: { xs: '0.4em', sm: '0.8em' },
      marginLeft: { xs: '0.6em', sm: '1em' },
      marginRight: 0,
    },
    '& ul, & ol': {
      marginTop: { xs: '0.35em', sm: '0.6em' },
      marginBottom: { xs: '0.35em', sm: '0.6em' },
      paddingLeft: { xs: '1.2em', sm: '1.6em' },
    },
  };
};

// ==========================================
// UKŁAD EKRANÓW CZATU (sesje ogólne/prywatne, wiadomości, karczma)
// Wspólne wymiary dla czterech widoków, które wcześniej miały je rozsypane po
// kodzie jako literały - dzięki temu zmiana proporcji "czytanie kontra pisanie"
// jest w jednym miejscu, a nie w czterech plikach po kilkanaście razy.
// ==========================================

// Wysokość edytora na mobile. Bez klawiatury edytor startuje ZWINIĘTY, więc te
// liczby dotyczą stanu po rozwinięciu.
export const CHAT_EDITOR_MOBILE = {
  // Dolna granica przy otwartej klawiaturze. Wcześniej pole tekstowe schodziło
  // do 44 px, czyli dwóch linijek pisania - stąd skargi na "mały edytor".
  minWithKeyboard: 140,
  minWithoutKeyboard: 148,
  baseWithKeyboard: 180,
  baseWithoutKeyboard: 208,
  // Udział widocznej wysokości okna, powyżej którego edytor nie urośnie -
  // inaczej przeciąganiem dałoby się zasłonić całą czytaną treść.
  //
  // Przy otwartej klawiaturze limit jest PROCENTOWO podobny, ale liczony od
  // znacznie mniejszej wysokości, więc edytor sam zjeżdża do rozsądnego
  // rozmiaru zamiast zostać przy wartości sprzed schowania połowy ekranu.
  // Na typowym telefonie (widoczne ~380 px z klawiaturą) wychodzi ~170 px:
  // pole pisania dostaje ~4 linie, a na czytanie zostaje ~8 - w obu wypadkach
  // mniej więcej dwa razy więcej niż przed zmianą.
  maxRatio: 0.55,
  maxRatioWithKeyboard: 0.45,
};

export const CHAT_EDITOR_DESKTOP = {
  min: 150,
  base: 180,
  maxRatio: 0.5,
};

// Minimalna wysokość samego pola pisania (ProseMirror) - to ona decyduje, ile
// linii widzi gracz w trakcie pisania.
export const CHAT_PROSEMIRROR_MIN = {
  mobileWithKeyboard: 88,
  mobile: 96,
  desktop: 100,
};

// ==========================================
// EKRANY "PRZED GRĄ" (login / register / reset / newpassword)
// Kamienna tekstura + metalowe narożniki jak w panelach gry, wysoki kontrast.
// ==========================================

// Ramowany panel jak w grze - tło z kamiennej tekstury + ozdobne narożniki PNG
// i subtelna podwójna ramka. Użycie: sx={{ ...authPanelSx, p: 3 }}.
// Przygaszone, antyczne złoto ramek ekranów przed grą (niezależne od koloru
// rasy/akcentu) - stonowane, nie krzykliwe.
// Akcent ekranów przed grą (login/rejestracja/reset) = złoto CZŁOWIEKA:
// baza #63571D (jak akcent człowieka) + jasny, czytelny #D8D389 na tekst/hovery.
export const authGold = '#63571D';
export const authGoldLight = '#D8D389';

// Panel przed grą: ta sama ozdobna ramka PNG co na panelach w Home (main box) -
// przezroczysty pas borderu (pod ażurową ramką prześwituje tło), ::before =
// ciemne bordo + kamienna tekstura TYLKO wewnątrz ramki, ::after = narożniki +
// belki (rasa "human", bo przed logowaniem nie ma jeszcze granej rasy).
// Technika stackingu: isolation:isolate + ::before z-index:-1 => treść panelu
// jest nad teksturą BEZ konieczności ustawiania z-index na każdej stronie.
// UWAGA: panel NIE może mieć overflow:hidden - przycięłoby ramkę (::after).
const AUTH_FRAME_T = 18;   // grubość belki ramki (desktop; jak FRAME_TH/TV w Home)
const AUTH_CORNER_W = 93;  // szerokość ozdobnego narożnika (desktop)
const AUTH_CORNER_H = 80;  // wysokość narożnika (proporcja grafiki)
// Mobile: mniejsza ramka - narożniki 135px rozwalały wąski ekran (zła skala).
const AUTH_FRAME_T_XS = 10;
const AUTH_CORNER_W_XS = 51;
const AUTH_CORNER_H_XS = 44;
const authCornerSize = (cw, ch, t) =>
  `${cw}px ${ch}px, ${cw}px ${ch}px, ${cw}px ${ch}px, ${cw}px ${ch}px, ${t}px 100%, ${t}px 100%, 100% ${t}px, 100% ${t}px`;
export const authPanelSx = {
  boxSizing: 'border-box',
  position: 'relative',
  isolation: 'isolate',
  borderRadius: 0,
  border: {
    xs: `${AUTH_FRAME_T_XS}px solid transparent`,
    sm: `${AUTH_FRAME_T}px solid transparent`,
  },
  backgroundColor: 'transparent',
  boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
  // Ciemne bordo + kamienna tekstura wewnątrz ramki (padding-box).
  '&::before': {
    content: '""',
    position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none',
    backgroundColor: '#151515',
    backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(99,87,29,0.10) 0%, transparent 60%), url(/ui/frames/panel-bg-neutral.png)`,
    backgroundSize: 'cover, cover',
    backgroundPosition: 'center, center',
    backgroundRepeat: 'no-repeat, no-repeat',
  },
  // Ozdobna ramka na pasie borderu: 4 narożniki -> belki pionowe -> poziome.
  '&::after': {
    content: '""',
    position: 'absolute',
    top: { xs: `-${AUTH_FRAME_T_XS}px`, sm: `-${AUTH_FRAME_T}px` },
    bottom: { xs: `-${AUTH_FRAME_T_XS}px`, sm: `-${AUTH_FRAME_T}px` },
    left: { xs: `-${AUTH_FRAME_T_XS}px`, sm: `-${AUTH_FRAME_T}px` },
    right: { xs: `-${AUTH_FRAME_T_XS}px`, sm: `-${AUTH_FRAME_T}px` },
    pointerEvents: 'none', zIndex: 2,
    // Tint człowieka + subtelna poświata w kolorze środkowym człowieka (#492f1b).
    filter: `${frameTintFilter('human')} drop-shadow(0 0 5px #492f1b) drop-shadow(0 0 13px #492f1b)`,
    backgroundImage: `url(/ui/frames/corner-tl.png), url(/ui/frames/corner-tr.png), url(/ui/frames/corner-bl.png), url(/ui/frames/corner-br.png), url(/ui/frames/human-v.png), url(/ui/frames/human-v.png), url(/ui/frames/human-h.png), url(/ui/frames/human-h.png)`,
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat',
    backgroundPosition: 'top left, top right, bottom left, bottom right, left center, right center, top center, bottom center',
    backgroundSize: {
      xs: authCornerSize(AUTH_CORNER_W_XS, AUTH_CORNER_H_XS, AUTH_FRAME_T_XS),
      sm: authCornerSize(AUTH_CORNER_W, AUTH_CORNER_H, AUTH_FRAME_T),
    },
  },
};

// Wysokokontrastowe pole tekstowe dla ekranów przed grą.
export const authFieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    color: '#f2ecdf',
    borderRadius: 0,
    '& fieldset': { borderColor: appColors.rustBorder, borderWidth: '1.5px' },
    '&:hover fieldset': { borderColor: appColors.rustLight },
    '&.Mui-focused fieldset': { borderColor: appColors.rustLight, borderWidth: '2px' },
  },
  '& .MuiInputBase-input': { color: '#f2ecdf' },
  '& .MuiInputBase-input::placeholder': { color: 'rgba(242,236,223,0.55)', opacity: 1 },
  '& .MuiInputLabel-root': { color: '#d3c8b4' },
  '& .MuiInputLabel-root.Mui-focused': { color: appColors.rustLight },
  '& .MuiFormHelperText-root': { color: '#c9bfae' },
};