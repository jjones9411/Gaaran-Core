import React, { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import OnlineList from './OnlineList';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NpcModeBadge from './NpcModeBadge';
import { useAuth } from './AuthContext';
import {
    Box,
    Paper,
    useMediaQuery,
    useTheme,
    GlobalStyles,
} from '@mui/material';
import useGameName from './useGameName';
import useRaceColor from './useRaceColor';
import EngineFooter from './EngineFooter';
import { raceAmbientOverlay, frameTintFilter } from './theme';
import { CONTENT_WIDTH_CSS_VAR, CONTENT_WIDTH_DEFAULT, TOPBAR_MAX_WIDTH } from './contentWidth';
import useKeyboardViewport from './useKeyboardViewport';

// Ciepły, przygaszony akcent u góry paneli (bursztyn) - stały, NIEZALEŻNY od rasy,
// żeby wampiry nie miały czerwonej poświaty na każdym panelu. Kolor rasy pojawia
// się tylko jako delikatna ramka na brzegach TŁA (patrz backgroundOverlay).
const PANEL_TOP_GLOW = 'rgba(150, 92, 46, 0.14)';

function Home() {
    const { user, loading: authLoading } = useAuth();
    const gameName = useGameName();
    const [loading, setLoading] = useState(true);
    const [showOnlineList, setShowOnlineList] = useState(false);
    // Zwijanie prawej kolumny (lista online) na desktopie - więcej miejsca na treść.
    const [onlineCollapsed, setOnlineCollapsed] = useState(false);
    // Widoczny obszar okna + wykrycie klawiatury + przesunięcie layoutu na iOS.
    // Wspólny hook (useKeyboardViewport.js) - wcześniej ten sam kod był tutaj
    // ORAZ w każdym z czterech ekranów czatu, z rozjeżdżającymi się progami.
    const { viewportHeight, keyboardVisible, offsetTop } = useKeyboardViewport();

    // Wysokość mobilnego paska gry MIERZONA, nie zgadywana. Wcześniej w kodzie
    // stała sztywna wartość 90 px, a realna wysokość paska wynika z jego treści
    // (avatar, nick, poziom, paski HP/ST/XP i - opcjonalnie - plakietka bufów).
    // Gdy pasek urósł ponad 90 px, zasłaniał górę treści; gdy był niższy, między
    // paskiem a treścią świeciła szpara tła.
    const mobileHeaderRef = React.useRef(null);
    const [mobileHeaderHeight, setMobileHeaderHeight] = useState(90);

    const isSmall = useMediaQuery('(max-width: 1050px)');
    // Strefa "wąskiego desktopu" (1051-1250px): pełna lista online zabiera za dużo
    // miejsca, więc panel domyślnie zwijamy do wąskiego paska - ale nadal MOŻNA go
    // rozwinąć ręcznie. Poniżej 1050px (isSmall) w ogóle nie ma tego panelu - jest
    // hamburger (mobile). Sterujemy tym z JS (useMediaQuery), a nie regułami @media
    // na stylach inline, bo te ostatnie nadpisywały stan Reacta i blokowały rozwijanie.
    const isNarrow = useMediaQuery('(max-width: 1250px)');
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const race = useRaceColor();
    // Ramka rasowa (PNG w /ui/frames) - nakładka na panele, nie zmienia rozmiarów.
    const FRAME_H = `/ui/frames/${race.frame || 'human'}-h.png`;
    const FRAME_V = `/ui/frames/${race.frame || 'human'}-v.png`;
    const FRAME_TH = 18; // grubość poziomej belki (góra/dół)
    const FRAME_TV = 18; // grubość pionowej belki (boki)
    // Ozdobny narożnik (wspólny dla ras) - jeden PNG + 3 odbicia lustrzane.
    // Kładziony NAD belkami w rogach panelu, dopasowany grubością do belek.
    const CORNER_TL = '/ui/frames/corner-tl.png';
    const CORNER_TR = '/ui/frames/corner-tr.png';
    const CORNER_BL = '/ui/frames/corner-bl.png';
    const CORNER_BR = '/ui/frames/corner-br.png';
    const CORNER_W = 93; // szerokość narożnika (mieści się nawet na wąskim panelu online)
    const CORNER_H = 80; // wysokość = zachowana proporcja grafiki (374x322)

    const handleCloseOnlineList = () => setShowOnlineList(false);

    // Mierzenie wysokości mobilnego paska. ResizeObserver łapie każdą zmianę -
    // pojawienie się plakietki bufów, zmianę skali czcionki, obrót ekranu -
    // więc treść zaczyna się zawsze dokładnie pod paskiem.
    useEffect(() => {
        const node = mobileHeaderRef.current;
        if (!isSmall || keyboardVisible || !node || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver((entries) => {
            const height = entries[0]?.contentRect?.height;
            if (!height) return;
            setMobileHeaderHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [isSmall, keyboardVisible]);

    // Auto-zwijanie panelu online przy wchodzeniu w wąski desktop (<=1250px) i
    // auto-rozwijanie gdy znów jest miejsce (>1250px). Efekt odpala się tylko przy
    // PRZEKROCZENIU progu (isNarrow zmienia wartość), więc ręczne rozwinięcie/zwinięcie
    // w obrębie danej szerokości jest zachowane.
    useEffect(() => {
        setOnlineCollapsed(isNarrow);
    }, [isNarrow]);

    useEffect(() => {
        if (authLoading) return; // Poczekaj na załadowanie user

        if (!user) {
            navigate('/login');
        } else {
            setLoading(false);
        }
    }, [user, authLoading, navigate]);

    // POWIADOMIENIA W TYTULE TABA - ikonka poczty gdy są powiadomienia
    useEffect(() => {
        const token = localStorage.getItem('token');
        const characterId = localStorage.getItem('activeCharacterId') || localStorage.getItem('characterId');

        if (!token || !characterId) return;

        const checkNotifications = async () => {
            let totalUnread = 0; // POPRAWKA: totalUnread musi być WEWNĄTRZ funkcji

            try {
                // Sprawdź Messages
                const messagesRes = await fetch(`/api/conversations/character/${characterId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (messagesRes.ok) {
                    const messagesData = await messagesRes.json();
                    const messagesUnread = messagesData.filter(c => {
                        if (!c.is_participant) return false;
                        if (!c.seen_at) return true;
                        return new Date(c.last_activity).getTime() > new Date(c.seen_at).getTime();
                    }).length;
                    totalUnread += messagesUnread;
                }

                // Sprawdź Private Sessions
                const privateRes = await fetch(`/api/privateSessions?characterId=${characterId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (privateRes.ok) {
                    const privateData = await privateRes.json();
                    if (privateData.sessions) {
                        const privateUnread = privateData.sessions.filter(s => {
                            if (!s.is_participant) return false;
                            if (!s.seen_at) return true;
                            return new Date(s.last_activity).getTime() > new Date(s.seen_at).getTime();
                        }).length;
                        totalUnread += privateUnread;
                    }
                }

                // Sprawdź General Sessions
                const generalRes = await fetch(`/api/generalSessions?characterId=${characterId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (generalRes.ok) {
                    const generalData = await generalRes.json();
                    if (generalData.sessions) {
                        const generalUnread = generalData.sessions.filter(s => {
                            if (!s.is_participant) return false;
                            if (!s.participant_seen_at) return true;
                            const lastActivity = new Date(s.last_activity).getTime();
                            const seenAt = new Date(s.participant_seen_at).getTime();
                            return lastActivity > seenAt;
                        }).length;
                        totalUnread += generalUnread;
                    }
                }

                // Sprawdź Tavern - NIE sprawdzaj gdy jesteś w tavern
                const isInTavern = location.pathname === '/home/tavern';
                if (!isInTavern) {
                    const tavernRes = await fetch('/api/tavern/unread', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (tavernRes.ok) {
                        const tavernData = await tavernRes.json();
                        if (tavernData.hasUnread) totalUnread += 1;
                    }
                }

                // Aktualizuj tytuł
                updateTitle(totalUnread > 0);
            } catch (error) {
                console.error('Error checking notifications for title:', error);
            }
        };

        const updateTitle = (hasNotifications) => {
            if (hasNotifications) {
                document.title = `${gameName} ✉️`;
            } else {
                document.title = gameName;
            }
        };

        const handleVisibilityChange = () => {
            checkNotifications();
        };

        // Nasłuchuj eventów z komponentów gdy coś zostanie oznaczone jako przeczytane
        const handleConversationsUpdated = () => {
            checkNotifications();
        };

        const handlePrivateSessionsUpdated = () => {
            checkNotifications();
        };

        const handleGeneralSessionsUpdated = () => {
            checkNotifications();
        };

        const handleTavernUpdated = () => {
            checkNotifications();
        };

        // Sprawdź od razu
        checkNotifications();

        // Sprawdzaj co 10 sekund
        const interval = setInterval(checkNotifications, 10000);

        // Nasłuchuj zmiany widoczności taba
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Nasłuchuj eventów z komponentów
        window.addEventListener('conversationsUpdated', handleConversationsUpdated);
        window.addEventListener('privateSessionsUpdated', handlePrivateSessionsUpdated);
        window.addEventListener('generalSessionsUpdated', handleGeneralSessionsUpdated);
        window.addEventListener('tavernUpdated', handleTavernUpdated);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('conversationsUpdated', handleConversationsUpdated);
            window.removeEventListener('privateSessionsUpdated', handlePrivateSessionsUpdated);
            window.removeEventListener('generalSessionsUpdated', handleGeneralSessionsUpdated);
            window.removeEventListener('tavernUpdated', handleTavernUpdated);
            document.title = gameName; // Przywróć oryginalny tytuł
        };
    }, [user, gameName]);

    // NOWY warunek loading
    if (authLoading || loading) {
        return (
            <Box sx={{
                background: `radial-gradient(ellipse at center, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
                minHeight: `${viewportHeight}px`, // MOBILE FIX - dynamiczny viewport
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.palette.text.primary,
                
                fontSize: '1.2rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                textShadow: `0 0 10px ${theme.palette.primary.main}`,
            }}>
                [ ŁADOWANIE... ]
            </Box>
        );
    }

    // ===========================
    // STYL WIZUALNY
    // ===========================
    
    // Kolory z theme
    const rustColor = theme.palette.primary.main; // #7a3b0f lub inny z theme
    const steelColor = theme.palette.mode === 'dark' ? theme.palette.text.secondary : theme.palette.text.secondary;
    const bgColor = theme.palette.background.paper;
    const borderColor = theme.palette.mode === 'dark'
        ? (race.border || `${race.hex}66`) // obwódki (np. scrollbar) w kolorze rasy
        : theme.palette.divider;

    // Tło overlay - motyw wizualny.
    // Zasłona jest PÓŁprzezroczysta (nie 0.95-1.0 jak wcześniej, gdy grafika była
    // praktycznie niewidoczna) - grafika zniszczonego świata prześwituje, a winieta
    // i ciepła poświata rdzy u góry dają klimat jak w lobby, przy zachowaniu
    // czytelności treści (panele mają własne ciemne tła).
    const backgroundOverlay = theme.palette.mode === 'dark'
        ? raceAmbientOverlay(race.hover || race.hex)
        : `radial-gradient(ellipse at center, rgba(244, 239, 227, 0.9) 0%, rgba(232, 227, 215, 0.97) 100%)`;

    // Kamienna tekstura tła panelu + delikatny akcent rasy u góry (dark mode).
    // Wydzielona osobno, bo używa jej też wąski, ZWINIĘTY pasek listy online,
    // do którego ozdobna ramka PNG (2×26px po bokach) po prostu się nie mieści.
    const panelTexture = {
        backgroundColor: theme.palette.mode === 'dark'
            ? '#151515'
            : theme.palette.background.paper,
        ...(theme.palette.mode === 'dark' ? {
            // Neutralna tekstura + subtelna poświata rasy u góry.
            backgroundImage: `radial-gradient(ellipse at 50% 0%, ${PANEL_TOP_GLOW} 0%, transparent 60%), url(/ui/frames/panel-bg-neutral.png)`,
            backgroundSize: 'cover, cover',
            backgroundPosition: 'center, center',
            backgroundRepeat: 'no-repeat, no-repeat',
        } : {}),
    };

    // Style Paper - OSTRE KRAWĘDZIE, RDZA, STAL.
    // Architektura ramki rasowej (bez zmiany rozmiaru panelu):
    //  - przezroczysty border = pas ramki; pod nim ciemne, PEŁNE tło (frame band
    //    jest ciemny, nie prześwituje przez ażurową ramkę),
    //  - ::before = KAMIENNA TEKSTURA tylko w padding-box => kończy się dokładnie
    //    na wewnętrznej krawędzi ramki (nie "wychodzi" poza nią), wypełnia panel
    //    góra-dół niezależnie od scrolla (panel się nie scrolluje - robi to wnętrze),
    //  - ::after = ozdobna ramka PNG rysowana na pasie borderu (inset -FRAME_T),
    //  - treść panelu MUSI mieć position:relative + zIndex 1 (jest nad ::before).
    // UWAGA: NIE dawać panelowi overflow:hidden - przycięłoby ::after w pasie ramki.
    const paperStyles = {
        boxSizing: 'border-box',
        position: 'relative',
        border: `${FRAME_TH}px solid transparent`,
        // Pas ramki (border) jest PRZEZROCZYSTY - pod ażurową ramką prześwituje
        // świat (ciemna winieta tła gry), nie ma ciemnego prostokąta. Ciemne tło +
        // tekstura są tylko WEWNĄTRZ ramki, w ::before (padding-box).
        backgroundColor: theme.palette.mode === 'dark' ? 'transparent' : theme.palette.background.paper,
        borderRadius: '0', // OSTRE KRAWĘDZIE MOTYW WIZUALNY
        boxShadow: theme.palette.mode === 'dark'
            ? `0 20px 50px rgba(0, 0, 0, 0.9)`
            : '0 4px 20px rgba(78, 64, 28, .15)',
        // Bez backdrop-filter na panelu - rozmywał świat w pasie ramki i dawał
        // "kolorowe" tło pod ramką. Wnętrze i tak jest nieprzezroczyste (::before).
        transition: 'all 0.3s ease',
        '&:hover': {
            boxShadow: theme.palette.mode === 'dark'
                ? `0 25px 60px rgba(0, 0, 0, 0.95), 0 0 30px ${rustColor}40`
                : '0 6px 24px rgba(78, 64, 28, .2)',
        },
        // Kamienna tekstura wewnątrz ramki (padding-box).
        '&::before': {
            content: '""',
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            ...(theme.palette.mode === 'dark' ? {
                // Neutralne #151515 (fallback) + neutralna tekstura + subtelna
                // poświata rasy u góry. Tekstura daje panelowi głębię (faktura),
                // nie płaski kolor. cover = skalowanie proporcjonalne.
                backgroundColor: '#151515',
                backgroundImage: `radial-gradient(ellipse at 50% 0%, ${PANEL_TOP_GLOW} 0%, transparent 60%), url(/ui/frames/panel-bg-neutral.png)`,
                backgroundSize: 'cover, cover',
                backgroundPosition: 'center, center',
                backgroundRepeat: 'no-repeat, no-repeat',
            } : {}),
        },
        // Ozdobna ramka rasowa na pasie borderu. Warstwy (pierwsza = na wierzchu):
        // 4 NAROŻNIKI (w rogach) -> belki PIONOWE -> belki POZIOME. Narożniki
        // przykrywają styk belek, a pionowe rysują się nad poziomymi na bokach.
        '&::after': {
            content: '""',
            position: 'absolute',
            top: `-${FRAME_TH}px`, bottom: `-${FRAME_TH}px`,
            left: `-${FRAME_TV}px`, right: `-${FRAME_TV}px`,
            pointerEvents: 'none', zIndex: 6,
            // Tint rasowy ramki + subtelna poświata w kolorze dividera rasy
            // (race.strong) - dwie warstwy (blisko + szerzej) dla głębi.
            filter: `${frameTintFilter(race.frame || 'human')} drop-shadow(0 0 5px ${race.frameGlow}) drop-shadow(0 0 13px ${race.frameGlow})`,
            backgroundImage: `url(${CORNER_TL}), url(${CORNER_TR}), url(${CORNER_BL}), url(${CORNER_BR}), url(${FRAME_V}), url(${FRAME_V}), url(${FRAME_H}), url(${FRAME_H})`,
            backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat',
            backgroundPosition: 'top left, top right, bottom left, bottom right, left center, right center, top center, bottom center',
            backgroundSize: `${CORNER_W}px ${CORNER_H}px, ${CORNER_W}px ${CORNER_H}px, ${CORNER_W}px ${CORNER_H}px, ${CORNER_W}px ${CORNER_H}px, ${FRAME_TV}px 100%, ${FRAME_TV}px 100%, 100% ${FRAME_TH}px, 100% ${FRAME_TH}px`,
        },
    };

    // Style dla przełącznika motywu - MOTYW WIZUALNY
    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: `${viewportHeight}px`, // MOBILE FIX - dynamiczny viewport
                overflow: 'hidden',
                backgroundImage: 'var(--game-bg-image)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                // iOS przy focusie w pole tekstowe PRZEWIJA layout viewport, a
                // position:fixed jest zakotwiczone właśnie w nim - powłoka gry
                // odjeżdżała wtedy w górę i edytor chował się pod klawiaturą.
                // visualViewport.offsetTop mówi o ile, więc wracamy o tyle w dół.
                transform: offsetTop ? `translateY(${offsetTop}px)` : 'none',
            }}
        >
            {/* ODGÓRNIE na całą grę: korzeń KAŻDEJ podstrony (bezpośrednie dziecko
                kontenera treści) ma przezroczyste tło i ramkę, żeby kamienna tekstura
                panelu głównego prześwitywała wszędzie - bez ręcznego poprawiania
                każdego widoku z osobna. Karty/elementy wewnątrz zachowują swoje tła.

                FURTKA `data-keep-surface`: reguła zdejmuje tło z BEZPOŚREDNIEGO
                dziecka, więc to, czy strona zachowa swoje tło, zależało od tego,
                w ile Boxów akurat jest opakowana - a nie od decyzji projektowej.
                Widać to było na CityPageLayout, który maluje własną poświatę w
                kolorze rasy i tracił ją bezgłośnie. Strona, która ŚWIADOMIE chce
                własne tło, oznacza korzeń atrybutem `data-keep-surface`. */}
            <GlobalStyles
                styles={{
                    '.game-content-root > *:not([data-keep-surface])': {
                        backgroundColor: 'transparent !important',
                        backgroundImage: 'none !important',
                        borderColor: 'transparent !important',
                        boxShadow: 'none !important',
                    },
                    // UWAGA na przyszłość: kuszące jest dodanie tu
                    // `container-type: inline-size`, żeby strony mogły pytać
                    // `@container` o REALNĄ szerokość panelu (breakpointy MUI
                    // mierzą okno, a panel jest od niego węższy o listę online).
                    // Ma to jednak skutek uboczny: element z `container-type`
                    // staje się blokiem zawierającym dla `position: fixed`, więc
                    // plakietka zminimalizowanej eksploracji (Explore)
                    // przeskoczyłaby z kotwiczenia w oknie na kotwiczenie
                    // w panelu. Dlatego
                    // skalowanie siatek robimy przez `repeat(auto-fit, minmax())`
                    // - ono i tak liczy się względem kontenera, a nie okna, i nie
                    // zmienia niczego w pozycjonowaniu.
                }}
            />
            {/* Plakietka trybu NPC (tylko gdy admin gra postacią z subkonta NPC) */}
            <NpcModeBadge />

            {/* Nakładka motyw wizualny */}
            <Box
                sx={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    background: backgroundOverlay,
                    zIndex: 1,
                }}
            />

            {/* SIDEBAR NA GÓRZE (mobile) lub LEWA STRONA (desktop) */}
            {isSmall ? (
                !keyboardVisible && ( // UKRYJ SIDEBAR GDY KLAWIATURA OTWARTA
                    <Box
                        ref={mobileHeaderRef}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            zIndex: 1000,
                        }}
                    >
                        <Sidebar
                            isSidebarOpen={false}
                            setIsSidebarOpen={() => {}}
                            onShowOnlineList={() => setShowOnlineList((prev) => !prev)}
                        />
                    </Box>
                )
            ) : (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${viewportHeight}px`,
                        zIndex: 2,
                        display: 'flex',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        px: 2,
                        py: 2,
                    }}
                >
                    {/* Szerokość widoku gry: osobista preferencja gracza (Ustawienia ->
                        Szerokość głównego okna) żyje jako zmienna CSS na <html>, patrz
                        contentWidth.js. Ten kontener trzyma WIERSZ Z TREŚCIĄ (główny box +
                        lista online), a TopBar niżej jest osobno przypięty do stałych
                        1400px i wyśrodkowany - dzięki temu szerszy widok rozsuwa się
                        symetrycznie, o tyle samo w lewo i w prawo względem topbara. */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            maxWidth: `var(${CONTENT_WIDTH_CSS_VAR}, ${CONTENT_WIDTH_DEFAULT}px)`,
                            height: '100%',
                            gap: 1,
                        }}
                    >
                        {/* TopBar - DESKTOP. Szerokość STAŁA (nie zmienia jej preferencja
                            gracza) i wyśrodkowana względem wiersza z treścią. */}
                        <Box
                            sx={{
                                width: '100%',
                                maxWidth: `${TOPBAR_MAX_WIDTH}px`,
                                alignSelf: 'center',
                                // Wrapper jest blokiem (nie flexem) - TopBar zostaje
                                // zwykłym dzieckiem o szerokości 100%, dokładnie jak
                                // przed dodaniem opcji szerokości.
                                flexShrink: 0,
                            }}
                        >
                            <TopBar />
                        </Box>

                        {/* Zawartość + prawa kolumna - DESKTOP */}
                        <Box
                            sx={{
                                display: 'flex',
                                flex: 1,
                                gap: 2,
                                overflow: 'hidden',
                                minHeight: 0,
                            }}
                        >
                            {/* Środkowa zawartość */}
                            <Paper
                                sx={{
                                    ...paperStyles,
                                    flex: 1,
                                    height: '100%',
                                    minWidth: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Box className="game-content-root" sx={{
                                    width: '100%',
                                    height: '100%',
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    // Nad teksturą (::before ma zIndex 0).
                                    position: 'relative',
                                    zIndex: 1,
                                    '&::-webkit-scrollbar': { width: '8px' },
                                    '&::-webkit-scrollbar-track': {
                                        background: theme.palette.mode === 'dark'
                                            ? 'rgba(0, 0, 0, 0.3)'
                                            : 'rgba(0, 0, 0, 0.05)',
                                    },
                                    '&::-webkit-scrollbar-thumb': {
                                        background: rustColor,
                                        border: `1px solid ${borderColor}`,
                                    },
                                    '&::-webkit-scrollbar-thumb:hover': {
                                        background: theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark,
                                    },
                                }}>
                                    <Outlet />
                                </Box>
                            </Paper>

                            {/* Prawa kolumna: Online List. Zwijanie do wąskiego paska:
                                ręczne (przycisk ZWIŃ / klik w pasek) LUB automatyczne gdy okno
                                jest wąskie (<=1250px, patrz efekt z isNarrow). Widocznością steruje
                                wyłącznie stan onlineCollapsed - dzięki temu w wąskim desktopie panel
                                nadal DA SIĘ rozwinąć (wcześniej reguła @media nadpisywała stan). */}
                            {/* Wąski pasek "‹ ONLINE" - gdy zwinięte ręcznie ALBO okno wąskie */}
                            <Paper
                                elevation={0}
                                onClick={() => setOnlineCollapsed(false)}
                                title="Pokaż listę online"
                                sx={{
                                    // Zwinięty pasek jest za wąski na ozdobną ramkę PNG -
                                    // sama tekstura + cienka obwódka w kolorze rasy.
                                    ...panelTexture,
                                    position: 'relative',
                                    border: `1px solid ${race.hex}66`,
                                    borderRadius: 0,
                                    boxShadow: theme.palette.mode === 'dark'
                                        ? '0 20px 50px rgba(0, 0, 0, 0.9)'
                                        : '0 4px 20px rgba(78, 64, 28, .15)',
                                    backdropFilter: theme.palette.mode === 'dark' ? 'blur(20px)' : 'none',
                                    width: 38,
                                    height: '100%',
                                    flexShrink: 0,
                                    display: onlineCollapsed ? 'flex' : 'none',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: race.accent,
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'mixed',
                                    letterSpacing: '0.15em',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.3s ease',
                                    '&:hover': { color: race.accent, borderColor: race.hex },
                                }}
                            >
                                ‹ ONLINE
                            </Paper>
                            {/* Pełny panel - gdy NIE zwinięte i okno szerokie (>1250px) */}
                            <Paper
                                elevation={0}
                                sx={{
                                    ...paperStyles,
                                    width: '280px',
                                    height: '100%',
                                    flexShrink: 0,
                                    display: onlineCollapsed ? 'none' : 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                {/* Wnętrze nad teksturą (::before ma zIndex 0). */}
                                <Box sx={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                    <Box
                                        onClick={() => setOnlineCollapsed(true)}
                                        title="Zwiń listę online"
                                        sx={{
                                            flexShrink: 0,
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            // Ramkę odsuwa już przezroczysty border panelu (26px).
                                            px: 0.5,
                                            pt: 0.5,
                                            pb: 0.5,
                                            cursor: 'pointer',
                                            color: theme.palette.text.secondary,
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold',
                                            letterSpacing: '0.1em',
                                            '&:hover': { color: rustColor },
                                        }}
                                    >
                                        ZWIŃ ›
                                    </Box>
                                    <Box sx={{ flex: 1, minHeight: 0, px: 0.5, pb: 0.5, overflow: 'hidden' }}>
                                        <OnlineList />
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* MOBILNA ZAWARTOŚĆ - pod Sidebar */}
            {isSmall && (
                <Paper
                    sx={{
                        position: 'absolute',
                        // Odsunięcie od góry = ZMIERZONA wysokość paska (patrz
                        // mobileHeaderRef), a nie dawna sztywna stała 90 px.
                        // Przy otwartej klawiaturze pasek i tak jest schowany.
                        top: keyboardVisible ? '0px' : `${mobileHeaderHeight}px`,
                        left: 0,
                        right: 0,
                        width: '100%',
                        height: keyboardVisible
                            ? `${viewportHeight}px`
                            : `${Math.max(0, viewportHeight - mobileHeaderHeight)}px`,
                        // Treść nie ma własnego marginesu, więc bez tego tekst
                        // podstron dotykał krawędzi ekranu. 0.75 (6px) było na to
                        // za mało - przy dłuższych blokach RP tekst optycznie
                        // kleił się do ramki telefonu.
                        px: 1.5,
                        // Dolny bezpieczny margines (pasek gestów w iOS/Androidzie).
                        pb: 'env(safe-area-inset-bottom, 0px)',
                        overflowY: 'auto', // FIX: Zmiana z 'hidden' na 'auto' dla scrollowania
                        overflowX: 'hidden',
                        backgroundColor: bgColor,
                        border: 'none',
                        borderRadius: 0,
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        backdropFilter: theme.palette.mode === 'dark' ? 'blur(20px)' : 'none',
                        '&::-webkit-scrollbar': {
                            width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                            background: theme.palette.mode === 'dark'
                                ? 'rgba(0, 0, 0, 0.3)'
                                : 'rgba(0, 0, 0, 0.05)',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            background: rustColor,
                            border: `1px solid ${borderColor}`,
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark,
                        },
                    }}
                >
                    <Box
                        className="game-content-root"
                        sx={{
                            width: '100%',
                            minHeight: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Outlet />
                    </Box>
                </Paper>
            )}

            {/* MOBILNY PANEL ONLINE LIST */}
            {isSmall && (
                <Paper
                    sx={{
                        ...paperStyles,
                        // UWAGA: paperStyles ma position:'relative' - musi być NADPISANE
                        // przez position:'fixed' PO spreadzie, inaczej panel nie jest
                        // przyklejoną nakładką tylko wpada w normalny flow i "wystaje"
                        // kawałkiem z prawej mimo translateX(100%) (był tak widoczny <1050px).
                        position: 'fixed',
                        top: 0,
                        right: 0,
                        // 70% na ekranie 360 px to 252 px, a lista online ma w
                        // środku elementy o minWidth 300 - panel się nie mieścił.
                        width: { xs: '100%', sm: 400 },
                        maxWidth: '100vw',
                        height: `${viewportHeight}px`, // MOBILE FIX - dynamiczny viewport
                        p: 2,
                        zIndex: 9998,
                        borderRadius: '0', // OSTRE KRAWĘDZIE
                        boxShadow: theme.palette.mode === 'dark'
                            ? '-8px 0 30px rgba(0, 0, 0, 0.95)'
                            : '-4px 0 20px rgba(78, 64, 28, .2)',
                        transition: 'transform 0.3s ease-in-out',
                        transform: showOnlineList ? 'translateX(0)' : 'translateX(100%)',
                        overflowY: 'auto',
                        '&::-webkit-scrollbar': {
                            width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                            background: theme.palette.mode === 'dark' 
                                ? 'rgba(0, 0, 0, 0.3)' 
                                : 'rgba(0, 0, 0, 0.05)',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            background: rustColor,
                            border: `1px solid ${borderColor}`,
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                            background: theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark,
                        },
                    }}
                >
                    {/* UWAGA: tu było onClick={handleCloseOnlineList} na całej
                        zawartości, więc PIERWSZE dotknięcie gdziekolwiek w liście
                        zamykało panel - a lista ma wyszukiwarkę, rozwijanie i
                        klikalne wpisy graczy, których w praktyce nie dało się
                        użyć na telefonie. Zamykanie zostaje na nakładce niżej
                        i na przycisku. */}
                    <OnlineList onNavigate={handleCloseOnlineList} />
                </Paper>
            )}

            {/* Nakładka dla mobilnego panelu */}
            {isSmall && showOnlineList && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(5px)',
                        zIndex: 9997,
                    }}
                    onClick={() => setShowOnlineList(false)}
                />
            )}


            {/* STYLE GLOBALNE - SCROLLBAR */}
            <style>
                {`
                    /* Global scrollbar styling - motyw wizualny */
                    ::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                    }
                    
                    ::-webkit-scrollbar-track {
                        background: ${theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.05)'};
                    }
                    
                    ::-webkit-scrollbar-thumb {
                        background: ${rustColor};
                        border: 1px solid ${borderColor};
                    }
                    
                    ::-webkit-scrollbar-thumb:hover {
                        background: ${theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark};
                    }

                    /* Płynne przejście kolorów przy zmianie motywu/rasy.
                       Wcześniej selektor brzmiał "*", czyli KAŻDY węzeł DOM-u
                       dostawał własną animowaną właściwość - przy listach graczy,
                       ekwipunku czy logach to tysiące elementów naraz, co na
                       telefonie widać jako ociąganie się hoverów i szarpanie przy
                       przewijaniu. Przejście jest potrzebne tylko na dużych
                       płaszczyznach, które faktycznie zmieniają barwę. */
                    .MuiPaper-root,
                    .MuiCard-root,
                    .MuiAppBar-root,
                    .game-content-root {
                        transition: background-color 0.3s ease, border-color 0.3s ease;
                    }
                `}
            </style>

            {/* Dyskretna stopka silnika na dole wszystkich podstron /home/*.
                Na telefonie jej nie ma w ogóle: jest przyklejona do dołu ekranu
                (position: fixed), więc nachodziła na pasek "Napisz wiadomość..."
                i na dolną krawędź edytora - napis silnika przebijał przez treść
                interfejsu. Na mobile brakuje miejsca na dekorację, na desktopie
                stopka ma swój wolny pas i zostaje. */}
            {!isSmall && <EngineFooter />}
        </Box>
    );
}

export default Home;