// frontend/src/components/ColorModeProvider.jsx
import React from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme, applyThemeColors } from './theme';
import useThemeColor from './useThemeColor';
import useRaceColor from './useRaceColor';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const ColorModeContext = React.createContext({
    // 'system' = kieruj się systemem, 'light'/'dark' = wymuś
    mode: 'system',              // zapisany wybór użytkownika: 'system' | 'light' | 'dark'
    effectiveMode: 'dark',       // faktycznie używany w tej chwili: 'light' | 'dark'
    setMode: (_m) => {},         // ustaw 'system' | 'light' | 'dark'
    toggle: () => {},            // szybkie przełączanie light<->dark (ignoruje 'system')
});

const STORAGE_KEY = 'color-scheme'; // 'system' | 'light' | 'dark'

export default function ColorModeProvider({ children }) {
    // Gra ma JEDEN motyw - ciemny. Jasny motyw został wycofany (był słabej jakości),
    // więc tryb jest zablokowany na 'dark' niezależnie od zapisanego wyboru czy
    // preferencji systemu. Kontekst (mode/effectiveMode/setMode/toggle) zostaje dla
    // zgodności z komponentami, które go czytają - po prostu zawsze zwraca 'dark'.
    const effectiveMode = 'dark';
    const mode = 'dark';
    const setMode = React.useCallback(() => {}, []);
    const toggle = React.useCallback(() => {}, []);

    // Ustaw atrybuty dokumentu na stałe na ciemny motyw (raz).
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
            document.documentElement.classList.remove('light-theme');
            document.documentElement.classList.add('dark-theme');
        }
    }, []);

    // Wartość kontekstu
    const contextValue = React.useMemo(
        () => ({
            mode,
            effectiveMode,
            setMode,
            toggle,
            isDark: true,
            isLight: false,
            isSystem: false,
        }),
        [setMode, toggle]
    );

    // Kolory motywu wybrane w kreatorze instalacyjnym (game_config.theme_*)
    const { primaryColor, textColor, backgroundColor } = useThemeColor();

    // Kolor akcentu = KOLOR RASY biezacej postaci (zgarniany wszedzie w grze).
    // Gdy gramy postacia, akcent calego motywu bierze sie z jej rasy; na ekranach
    // bez postaci (login/rejestracja) uzywamy koloru z kreatora jako fallback.
    // Do createAppTheme podajemy SUROWY hex rasy - to on liczy z niego czytelny
    // wariant WCAG (primary.main) oraz zachowuje surowa barwe do teł (primary.dark).
    const race = useRaceColor();
    // Akcent = kolor rasy ZAWSZE. Bez rasy useRaceColor zwraca kanonicznego
    // człowieka, więc ekrany przed grą (login/rejestracja/reset) są spójnie w
    // kolorach człowieka, a nie w DB-pomarańczu.
    const accentColor = HEX_RE.test(race.hex || '') ? race.hex : primaryColor;

    // Jedno zrodlo prawdy dla appColors (Sidebar/TopBar i inne ekrany spoza MUI):
    // ten sam akcent (kolor rasy albo fallback z kreatora) co motyw MUI, zeby cala
    // gra - chrome i tresc - dzielila kolor rasy. useThemeColor juz nie mutuje
    // appColors samodzielnie, zeby nie nadpisywac koloru rasy kolorem z kreatora.
    React.useEffect(() => {
        applyThemeColors({ primary: accentColor, text: textColor, background: backgroundColor });
        // CSS var z kolorem akcentu (rasy) w formacie "r, g, b" - używamy jej w miejscach,
        // gdzie kolor rdzy był zaszyty na sztywno: rgba(var(--race-accent-rgb, 122,59,15), a).
        // Dzięki temu te akcenty też idą za rasą, a bez rasy (ekrany auth) mają fallback.
        if (typeof document !== 'undefined') {
            const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(accentColor || '');
            if (m) {
                const rgb = `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
                document.documentElement.style.setProperty('--race-accent-rgb', rgb);
            }
        }
    }, [accentColor, textColor, backgroundColor]);

    // Kolor obwódek/dividerów = "kolor środkowy" rasy (brąz/grafit) jako kontrast
    // do ramek. Bez rasy (auth) bierze się z palety fallbackowej w useRaceColor.
    const dividerMid = HEX_RE.test(race.strong || '') ? race.strong : null;

    // Tworzenie motywu
    const theme = React.useMemo(
      () => createAppTheme(effectiveMode, accentColor, textColor, backgroundColor, undefined, dividerMid),
      [effectiveMode, accentColor, textColor, backgroundColor, dividerMid]
    );

    return (
        <ColorModeContext.Provider value={contextValue}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}

// Hook pomocniczy do używania kontekstu
export function useColorMode() {
    const context = React.useContext(ColorModeContext);
    if (context === undefined) {
        throw new Error('useColorMode must be used within a ColorModeProvider');
    }
    return context;
}