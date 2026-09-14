// Gaaran Engine 1.0 - please do not share or use without permission
// Author: Gaaran
// Date: 2025-02-20
// Version: 1.0
// Description: A simple engine for texting games
// License: MIT
// Copyright (c) 2025 Gaaran
// If you want to use it please contact me on Discord: cerber941
// or email: vangalloth@gmail.com

import { useEffect, useState, useContext, useMemo, Suspense, lazy } from 'react';
import sanitizeHtml from './components/sanitizeHtml';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  GlobalStyles,
  Fade,
  CircularProgress,
  Typography,
  Button,
} from '@mui/material';

// Używaj tylko nowego systemu motywów
import ColorModeProvider, { ColorModeContext } from './components/ColorModeProvider';
import {
  createAppTheme,
  createGlobalStyles,
  appColors,
  NOISE_SVG_URL,
  appBackgroundSx,
  fullScreenCenterSx,
  dangerPanelBoxSx,
  dangerTitleSx,
  dangerContentBoxSx,
  dangerButtonSx,
} from './components/theme';
import { loadFontScaleFromServer } from './components/fontScale';
import { loadContentWidthFromServer } from './components/contentWidth';

// Komponenty ładowane od razu - potrzebne na każdej trasie / przed zalogowaniem
import Home from './components/Home';
import Logout from './components/Logout';
import GlobalMessagePopup from './components/GlobalMessagePopup';
import WeatherIllnessPopup from './components/WeatherIllnessPopup';
import VersionChecker from './components/VersionChecker';
import CharacterSwitchGuard from './components/CharacterSwitchGuard';
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth, getUserRole, isRegularPlayer } from './components/AuthContext';
import useGameName from './components/useGameName';
import useThemeColor from './components/useThemeColor';
import useRaceColor from './components/useRaceColor';

// Akcent motywu = kolor RASY biezacej postaci (fallback: kolor z kreatora).
// Wspolne dla App i LoadingScreen, zeby caly motyw MUI (primary.*) byl w kolorze
// rasy - inaczej wewnetrzny ThemeProvider Appa nadpisywalby motyw rasowy z
// ColorModeProvider kolorem instalatora (stad "pomaranczowy topbar u wilkolaka").
const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
// Zwraca { base, readable }:
//  - base     = operacyjny kolor akcentu (Hover rasy) do obwódek/wypełnień/poświaty
//  - readable = miękki, czytelny odcień do TEKSTU (Jasny tekst rasy) -> primary.main
// Dzięki temu cały motyw (nagłówki, aktywne zakładki, ikony) idzie w przygaszony
// odcień rasy zamiast ostrej, auto-rozjaśnianej czerwieni.
function useAccentColor(primaryColor) {
  const race = useRaceColor();
  // useRaceColor zwraca paletę rasy, a bez rasy (auth) - kanonicznego człowieka.
  // Bierzemy więc kolor rasy ZAWSZE (nie DB-pomarańcz), z primaryColor jako
  // ostatecznym zabezpieczeniem gdyby hex był nieprawidłowy.
  return {
    base: HEX6_RE.test(race.hex || '') ? race.hex : primaryColor,
    readable: HEX6_RE.test(race.accent || '') ? race.accent : null,
    // "Kolor środkowy" rasy (brąz/grafit) -> obwódki/dividery/hover przycisków.
    mid: HEX6_RE.test(race.strong || '') ? race.strong : null,
  };
}

// Strony ładowane leniwie (code-splitting) - nie trafiają do bundle'a startowego
const Register = lazy(() => import('./components/Register'));
const Login = lazy(() => import('./components/Login'));
const CharacterCreator = lazy(() => import('./components/CharacterCreator'));
const Profile = lazy(() => import('./components/Profile'));
const GeneralSessions = lazy(() => import('./components/GeneralSessions'));
const PrivateSessions = lazy(() => import('./components/PrivateSessions'));
const SessionJournal = lazy(() => import('./components/SessionJournal'));
const Settings = lazy(() => import('./components/Settings'));
const Tavern = lazy(() => import('./components/Tavern'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const Bugtrack = lazy(() => import('./components/Bugtrack'));
const News = lazy(() => import('./components/News'));
const Messages = lazy(() => import('./components/Messages'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const NewPassword = lazy(() => import('./components/NewPassword'));
const Bestiary = lazy(() => import('./components/Bestiary'));
const InfoPanel = lazy(() => import('./components/InfoPanel'));
const InfoPanel2 = lazy(() => import('./components/InfoPanel2'));
const AvatarComponent = lazy(() => import('./components/AvatarComponent'));
const Regulamin = lazy(() => import('./components/Regulamin'));
const Encyclopedia = lazy(() => import('./components/Encyclopedia'));
const StatsCard = lazy(() => import('./components/StatsCard'));
const RaceHall = lazy(() => import('./components/RaceHall'));
const Rules = lazy(() => import('./components/Rules'));
const Law = lazy(() => import('./components/Law'));
const Mechanics = lazy(() => import('./components/Mechanics'));
const Technology = lazy(() => import('./components/Technology'));
const AlchemyGuide = lazy(() => import('./components/AlchemyGuide'));
const PlayerList = lazy(() => import('./components/PlayerList'));
const Drugs = lazy(() => import('./components/Drugs'));
const ActivateAccount = lazy(() => import('./components/ActivateAccount'));
const NPC = lazy(() => import('./components/Npc'));
const CharacterLobby = lazy(() => import('./components/CharacterLobby'));
const Reports = lazy(() => import('./components/Reports'));
const AdminReports = lazy(() => import('./components/AdminReports'));
const Equipment = lazy(() => import('./components/Equipment'));
const Craft = lazy(() => import('./components/Craft'));
const Shop = lazy(() => import('./components/Shop'));
const BlackMarket = lazy(() => import('./components/BlackMarket'));
const Arena = lazy(() => import('./components/Arena'));
const Explore = lazy(() => import('./components/Explore'));
const Work = lazy(() => import('./components/Work'));
const Rest = lazy(() => import('./components/Rest'));
const Hospital = lazy(() => import('./components/Hospital'));
const Training = lazy(() => import('./components/Training'));
const Headquarters = lazy(() => import('./components/Headquarters'));
const CharacterNotes = lazy(() => import('./components/CharacterNotes'));
const CharacterCardsApproval = lazy(() => import('./components/CharacterCardsApproval'));
const Logs = lazy(() => import('./components/Logs'));
const Cemetery = lazy(() => import('./components/Cemetery'));
const CityHub = lazy(() => import('./components/CityHub'));
const ResourceMarket = lazy(() => import('./components/ResourceMarket'));
const Gather = lazy(() => import('./components/Gather'));
const Refine = lazy(() => import('./components/Refine'));
const Cook = lazy(() => import('./components/Cook'));
const Bazaar = lazy(() => import('./components/Bazaar'));
const Statues = lazy(() => import('./components/Statues'));
const Prison = lazy(() => import('./components/Prison'));
const Bank = lazy(() => import('./components/Bank'));

const LoadingScreen = () => {
  const { effectiveMode } = useContext(ColorModeContext);
  const { primaryColor, textColor, backgroundColor } = useThemeColor();
  const accent = useAccentColor(primaryColor);
  const theme = useMemo(
    () => createAppTheme(effectiveMode, accent.base, textColor, backgroundColor, accent.readable, accent.mid),
    [effectiveMode, accent.base, accent.readable, accent.mid, textColor, backgroundColor]
  );
  const gameName = useGameName();

  return (
    <Fade in={true} timeout={800}>
      <Box
          sx={{
            ...fullScreenCenterSx,
            background: appBackgroundSx.background,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: NOISE_SVG_URL,
              animation: 'dustFloat 20s ease-in-out infinite',
              opacity: 0.3,
              zIndex: 1,
              '@keyframes dustFloat': {
                '0%': { transform: 'translate(0, 0)' },
                '50%': { transform: 'translate(-2%, 2%)' },
                '100%': { transform: 'translate(0, 0)' },
              },
            },
          }}
      >
        <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <CircularProgress
            size={60}
            thickness={2}
            sx={{
              color: appColors.steelLight,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              }
            }}
          />
          <Box sx={{
            textAlign: 'center',
            animation: 'pulse 2s ease-in-out infinite',
            filter: 'drop-shadow(0 0 8px rgba(113, 128, 150, 0.3))',
            '@keyframes pulse': {
              '0%': { opacity: 0.6 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.6 },
            }
          }}>
            <Box component="h1" sx={{
              
              fontSize: '2.5rem',
              color: appColors.textPrimary,
              textShadow: '0 0 10px rgba(113, 128, 150, 0.5), 2px 2px 4px rgba(0,0,0,0.8)',
              margin: 0,
              mb: 1,
              letterSpacing: '0.1em',
              fontWeight: 300,
            }}>
              {gameName}
            </Box>
            <Box component="p" sx={{
              
              fontSize: '0.9rem',
              color: appColors.steelLight,
              textShadow: '0 0 5px rgba(113, 128, 150, 0.3)',
              margin: 0,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}>
              [ INICJALIZACJA SYSTEMU... ]
            </Box>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

function ProfileRoute() {
  const { id } = useParams();
  return <Profile key={id} />;
}

function App() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Stan dla komunikatu dla mieszkańców
  const [residentMessageChecked, setResidentMessageChecked] = useState(false);
  const [hasResidentMessage, setHasResidentMessage] = useState(false);
  const [residentMessageData, setResidentMessageData] = useState(null);

  // NOWY STAN - blokada użytkownika
  const [userBlockChecked, setUserBlockChecked] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [userBlockData, setUserBlockData] = useState(null);

  const { effectiveMode } = useContext(ColorModeContext);
  const { primaryColor, textColor, backgroundColor } = useThemeColor();
  const accent = useAccentColor(primaryColor);
  const theme = useMemo(
    () => createAppTheme(effectiveMode, accent.base, textColor, backgroundColor, accent.readable, accent.mid),
    [effectiveMode, accent.base, accent.readable, accent.mid, textColor, backgroundColor]
  );
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);

  // Tytuł karty przeglądarki na każdym ekranie (także login/rejestracja po
  // wylogowaniu). Bez tego document.title ustawiał tylko Home, więc po
  // wylogowaniu tab pokazywał placeholder [NAZWA_GRY] z index.html.
  const gameName = useGameName();
  useEffect(() => {
    if (gameName && gameName !== '[NAZWA_GRY]') {
      document.title = gameName;
    }
  }, [gameName]);

  // NOWA FUNKCJA - sprawdzanie blokady użytkownika
const checkUserBlock = async () => {
  const token = localStorage.getItem('token');
  
  if (!token || !user || !user.id) {
    setUserBlockChecked(true);
    setIsUserBlocked(false);
    return;
  }

    try {
const response = await fetch(`/api/admin/checkUserBlock/${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.blocked && data.daysLeft > 0) {
          setIsUserBlocked(true);
          setUserBlockData({
            title: 'KONTO ZABLOKOWANE',
            content: `
              <p><strong>Konto zablokowane do:</strong> ${data.blockedUntil}</p>
              <p><strong>Data w grze:</strong> ${data.currentDate}</p>
              <p><strong>Pozostało dni:</strong> ${data.daysLeft}</p>
              <hr />
              <p>Jeśli uważasz, że blokada została nałożona niesłusznie, skontaktuj się z administracją.</p>
            `,
            blockedUntil: data.blockedUntil,
            daysLeft: data.daysLeft
          });
        } else {
          setIsUserBlocked(false);
          setUserBlockData(null);
        }
      } else {
        setIsUserBlocked(false);
        setUserBlockData(null);
      }
    } catch (error) {
      console.error('❌ Błąd sprawdzania blokady użytkownika:', error);
      setIsUserBlocked(false);
      setUserBlockData(null);
    } finally {
      setUserBlockChecked(true);
    }
  };

const checkResidentMessage = async () => {
  // Blokada dotyczy KAŻDEGO zwykłego gracza - także zasłużonego. Medal jest
  // odznaczeniem, nie przepustką (patrz isRegularPlayer w AuthContext).
  if (!isRegularPlayer(user?.role)) {
      setResidentMessageChecked(true);
      setHasResidentMessage(false);
      return;
    }
    try {
      const response = await fetch('/api/admin/check-resident-message', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.hasMessage) {
          setHasResidentMessage(true);
          setResidentMessageData({
            title: data.title,
            content: data.content,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        } else {
          setHasResidentMessage(false);
          setResidentMessageData(null);
        }
      } else {
        setHasResidentMessage(false);
        setResidentMessageData(null);
      }
    } catch (error) {
      console.error('❌ App.js - błąd sprawdzania komunikatu:', error);
      setHasResidentMessage(false);
      setResidentMessageData(null);
    } finally {
      setResidentMessageChecked(true);
    }
  };

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setIsAuthenticated(false);
      setResidentMessageChecked(true);
      setUserBlockChecked(true);
      return;
    }
    try {
      setIsAuthenticated(true);
      await checkUserBlock(); // DODAJ - sprawdź blokadę użytkownika PRZED komunikatem
      await checkResidentMessage();
    } catch (error) {
      console.error('Błąd:', error);
      setIsAuthenticated(false);
      setResidentMessageChecked(true);
      setUserBlockChecked(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (isAuthenticated) {
        await checkResidentMessage();
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  // Osobiste preferencje widoku "na całe konto" (skala czcionki + szerokość
  // głównego boxa): po zalogowaniu pobierz źródło prawdy z serwera i nałóż je
  // (dosynchronizowanie po wczesnym zastosowaniu z cache w index.jsx). Dzięki
  // temu preferencje idą za graczem między urządzeniami.
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('token');
    loadFontScaleFromServer(token);
    loadContentWidthFromServer(token);
  }, [isAuthenticated]);

  // ZAKTUALIZOWANY WARUNEK LOADING
  if (loading || !residentMessageChecked || !userBlockChecked) {
    return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <GlobalStyles styles={globalStyles} />
          <LoadingScreen />
        </ThemeProvider>
    );
  }

  // ===========================
  // EKRAN BLOKADY UŻYTKOWNIKA (PRIORYTET)
  // ===========================
  if (isAuthenticated && isUserBlocked && userBlockData) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={globalStyles} />

        <Box sx={appBackgroundSx} />

        <Fade in={true} timeout={1000}>
          <Box sx={fullScreenCenterSx}>
            <Box sx={dangerPanelBoxSx}>
              <Box component="h1" sx={{ ...dangerTitleSx, }}>
                🚫 {userBlockData.title}
              </Box>

              <Box component="div" sx={{ ...dangerContentBoxSx, }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(userBlockData.content) }} />

              <Button onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }} variant="contained" sx={{ ...dangerButtonSx, }}>
                [ WYLOGUJ SIĘ ]
              </Button>
            </Box>
          </Box>
        </Fade>
      </ThemeProvider>
    );
  }

  // Komunikat dla mieszkańców - STYL WIZUALNY
if (isAuthenticated && hasResidentMessage && residentMessageData) {
  if (isRegularPlayer(user?.role)) {
      return (
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles styles={globalStyles} />

            <Box
                sx={{
                  ...appBackgroundSx,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `
                      repeating-linear-gradient(
                        0deg,
                        rgba(113, 128, 150, 0.03) 0px,
                        transparent 2px,
                        transparent 4px,
                        rgba(113, 128, 150, 0.03) 4px
                      )
                    `,
                    zIndex: 1,
                    animation: 'scanline 8s linear infinite',
                  },
                }}
            />

            <Fade in={true} timeout={1000}>
              <Box sx={fullScreenCenterSx}>
                <Box
                    sx={{
                      ...dangerPanelBoxSx,
                      position: 'relative',
                      animation: 'messagePulse 3s ease-in-out infinite',
                      '@keyframes messagePulse': {
                        '0%': { boxShadow: '0 0 20px rgba(116, 42, 42, 0.4), inset 0 0 50px rgba(0, 0, 0, 0.5)' },
                        '50%': { boxShadow: '0 0 30px rgba(116, 42, 42, 0.6), inset 0 0 50px rgba(0, 0, 0, 0.5)' },
                        '100%': { boxShadow: '0 0 20px rgba(116, 42, 42, 0.4), inset 0 0 50px rgba(0, 0, 0, 0.5)' },
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: `linear-gradient(90deg, transparent, ${appColors.dangerBorder}, transparent)`,
                        animation: 'scan 2s linear infinite',
                      },
                      '@keyframes scan': {
                        '0%': { top: 0 },
                        '100%': { top: '100%' },
                      },
                    }}
                >
                  <Box component="h1" sx={{ ...dangerTitleSx, }}>
                    ⚠ PILNY KOMUNIKAT ⚠
                  </Box>

                  <Box component="h2" sx={{
                    
                    fontSize: '1.3rem',
                    color: appColors.textPrimary,
                    margin: 0,
                    mb: 2,
                    letterSpacing: '0.05em',
                  }}>
                    {residentMessageData.title}
                  </Box>

                  <Box
                      component="div"
                      sx={{
                        ...dangerContentBoxSx,
                        
                        borderRadius: '0',
                        boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)',
                      }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(residentMessageData.content) }}
                  />

                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                    fontSize: '0.75rem',
                    color: appColors.steelLight,
                    
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    <Typography variant="caption">
                      UTWORZONO: {new Date(residentMessageData.createdAt).toLocaleString('pl-PL')}
                    </Typography>
                    {residentMessageData.updatedAt && residentMessageData.updatedAt !== residentMessageData.createdAt && (
                        <Typography variant="caption">
                          AKTUALIZACJA: {new Date(residentMessageData.updatedAt).toLocaleString('pl-PL')}
                        </Typography>
                    )}
                  </Box>

                  <Button
                      onClick={async () => {
                        try {
                          await fetch('/api/admin/mark-resident-message-read', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          });
                          setHasResidentMessage(false);
                          setResidentMessageData(null);
                        } catch (error) {
                          console.error('❌ Błąd oznaczania komunikatu jako przeczytany:', error);
                          setHasResidentMessage(false);
                          setResidentMessageData(null);
                        }
                      }}
                      variant="contained"
                      sx={{
                        ...dangerButtonSx,
                        
                        boxShadow: '0 0 10px rgba(116, 42, 42, 0.5)',
                      }}
                  >
                    [ POTWIERDZAM ODBIÓR ]
                  </Button>
                </Box>
              </Box>
            </Fade>

            <GlobalMessagePopup />
            <WeatherIllnessPopup />
            <CharacterSwitchGuard />
          </ThemeProvider>
      );
    }
  }

  // Normalny widok aplikacji - MOTYW WIZUALNY
  return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={globalStyles} />

        {/* Tło MOTYW WIZUALNY */}
        <Box
            sx={{
              ...appBackgroundSx,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: `
                  repeating-linear-gradient(
                    0deg,
                    rgba(113, 128, 150, 0.02) 0px,
                    transparent 1px,
                    transparent 2px,
                    rgba(113, 128, 150, 0.02) 3px
                  ),
                  radial-gradient(ellipse at 30% 70%,
                    rgba(116, 42, 42, 0.05) 0%,
                    transparent 50%
                  ),
                  radial-gradient(ellipse at 70% 30%,
                    rgba(74, 85, 104, 0.08) 0%,
                    transparent 50%
                  )
                `,
                zIndex: 1,
              },
            }}
        />



  <Suspense fallback={<LoadingScreen />}>
  <Routes>
    <Route path="/" element={isAuthenticated ? <Navigate to="/lobby" /> : <Navigate to="/login" />} />
    <Route path="/login" element={<Login onLoginSuccess={checkAuth} />} />
    <Route path="/register" element={<Register />} />
    <Route path="/regulamin" element={<Regulamin />} />
    {/* Encyklopedia świata - publiczna, dostępna przed zalogowaniem */}
    <Route path="/encyklopedia" element={<Encyclopedia />} />
    <Route path="/lore" element={<Navigate to="/encyklopedia" replace />} />
    <Route path="/activate/:token" element={<ActivateAccount />} />
    <Route path="/lobby" element={<CharacterLobby />} />
    <Route path="/resetpassword" element={<ResetPassword />} />
    <Route path="/newpassword/:token" element={<NewPassword />} />
    
    {/* CAŁA SEKCJA /home/* OWINIĘTA W PROTECTEDROUTE */}
    <Route 
      path="/home/*" 
      element={
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      }
    >
      <Route index element={<News />} />
      <Route path="profile/:id" element={<ProfileRoute />} />
      <Route path="equipment" element={<Equipment />} />
      <Route path="city" element={<CityHub />} />
      <Route path="craft" element={<Craft />} />
      <Route path="shop" element={<Shop />} />
      <Route path="market" element={<ResourceMarket />} />
      <Route path="gather" element={<Gather />} />
      <Route path="refine" element={<Refine />} />
      <Route path="cook" element={<Cook />} />
      <Route path="bazaar" element={<Bazaar />} />
      <Route path="blackmarket" element={<BlackMarket />} />
      <Route path="arena" element={<Arena />} />
      <Route path="explore" element={<Explore />} />
      <Route path="work" element={<Work />} />
      <Route path="rest" element={<Rest />} />
      <Route path="hospital" element={<Hospital />} />
      <Route path="training" element={<Training />} />
      <Route path="statues" element={<Statues />} />
      <Route path="prison" element={<Prison />} />
      <Route path="bank" element={<Bank />} />
      <Route path="headquarters" element={<Headquarters />} />
      <Route path="generalSessions" element={<GeneralSessions />} />
      <Route path="generalSessions/new" element={<GeneralSessions />} />
      <Route path="generalSessions/:sessionId" element={<GeneralSessions />} />
      <Route path="journal" element={<SessionJournal />} />
      <Route path="messages" element={<Messages />} />
      <Route path="messages/new" element={<Messages />} />
      <Route path="messages/:conversationId" element={<Messages />} />
      <Route path="settings" element={<Settings />} />
      <Route path="settings/reports" element={<Reports />} />
      <Route path="notes" element={<CharacterNotes />} />
      <Route path="logs" element={<Logs />} />
      <Route path="cemetery" element={<Cemetery />} />
      <Route
        path="settings/admin-reports"
        element={
          (() => {
            const userRole = getUserRole();
            return (userRole === 'admin' || userRole === 'mistrz_gry') ? <AdminReports /> : <Navigate to="/home" />;
          })()
        }
      />
      <Route
        path="settings/character-cards-approval"
        element={
          (() => {
            const userRole = getUserRole();
            return (userRole === 'admin' || userRole === 'mistrz_gry') ? <CharacterCardsApproval /> : <Navigate to="/home" />;
          })()
        }
      />
      <Route path="tavern" element={<Tavern />} />
      <Route path="bestiary" element={<Bestiary />} />
      <Route path="statscard" element={<StatsCard />} />
      <Route path=":raceKey" element={<RaceHall />} />
      <Route path="rules" element={<Rules />} />
      <Route path="technology" element={<Technology />} />
      <Route path="alchemy-guide" element={<AlchemyGuide />} />
      <Route path="players" element={<PlayerList />} />
      <Route path="history" element={<Drugs />} />
      {/* Stary route /home/drugs -> /home/history (zachowuje stare linki/zakładki) */}
      <Route path="drugs" element={<Navigate to="/home/history" replace />} />
      <Route path="npc" element={<NPC />} />
      <Route path="mechanics" element={<Mechanics />} />
      <Route path="law" element={<Law />} />
      <Route path="infopanel" element={<InfoPanel />} />
      <Route path="infopanel2" element={<InfoPanel2 />} />
      <Route path="avatarcomponent" element={<AvatarComponent />} />
      <Route path="privateSessions" element={<PrivateSessions />} />
      <Route path="privateSessions/new" element={<PrivateSessions />} />
      <Route path="privateSessions/:sessionId" element={<PrivateSessions />} />
      <Route
        path="adminpanel"
        element={
          (() => {
            const userRole = getUserRole();
            return (userRole === 'admin' || userRole === 'mistrz_gry') ? <AdminPanel /> : <Navigate to="/home" />;
          })()
        }
      />
      <Route
        path="adminpanel/bugtrack"
        element={
          (() => {
            const userRole = getUserRole();
            return userRole === 'admin' ? <Bugtrack /> : <Navigate to="/home" />;
          })()
        }
      />
    </Route>

    <Route path="/createCharacter" element={<CharacterCreator />} />
    <Route path="/logout" element={<Logout />} />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
  </Suspense>


        <GlobalMessagePopup />
        <WeatherIllnessPopup />
        {/* Ostrzeżenie, gdy w innej karcie wybrano inną postać */}
        <CharacterSwitchGuard />
      </ThemeProvider>
  );
}

const Installer = lazy(() => import('./components/Installer'));

// Główny komponent z providerem
function RootApp() {
  // Kreator instalacyjny (/install) - jeśli silnik nie został jeszcze
  // skonfigurowany (brak backend/.installed), pokaż WYŁĄCZNIE kreator
  // zamiast normalnej gry, niezależnie od tego jaki adres wpisano.
  //
  // Kreator jest tu WYJĄTKIEM, nie stanem domyślnym: pokazujemy go dopiero,
  // gdy backend WPROST odpowie `installed: false`. Wcześniej wystarczyła
  // dowolna odpowiedź JSON bez pola `installed` (`Boolean(undefined)` = false),
  // więc zwykłe 429 z globalnego rate limitera albo 500 z error handlera
  // podmieniało graczowi grę na kreator z `DROP DATABASE` w pierwszym kroku -
  // z loginem i hasłem uprzejmie podstawionymi przez autouzupełnianie
  // przeglądarki.
  //
  // Zalogowany gracz ma token, a token nie ma prawa istnieć na nieskonfigurowanym
  // silniku - w takim razie pytanie o status jest zbędne i w ogóle go nie zadajemy.
  const [installed, setInstalled] = useState(() =>
    localStorage.getItem('token') ? true : null
  ); // null = jeszcze nie wiadomo

  useEffect(() => {
    if (installed !== null) return;

    let cancelled = false;
    fetch('/api/install/status')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (!cancelled) setInstalled(data?.installed !== false);
      })
      // Błąd zapytania (sieć, 429, 502 przy restarcie pm2) nie ma prawa
      // wpuścić kogokolwiek do kreatora - działająca gra zostaje grą.
      .catch(() => {
        if (!cancelled) setInstalled(true);
      });
    return () => { cancelled = true; };
  }, [installed]);

  if (installed === null) {
    return null;
  }

  if (installed === false) {
    return (
      <Suspense fallback={null}>
        <Installer onComplete={() => setInstalled(true)} />
      </Suspense>
    );
  }

  return (
    <ColorModeProvider>
      {/* Pasek "nowa wersja - odśwież" gdy wyjdzie nowy build frontendu */}
      <VersionChecker />
      <Router>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </ColorModeProvider>
  );
}

export default RootApp;