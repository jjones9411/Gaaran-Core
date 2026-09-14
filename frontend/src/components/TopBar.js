import { useState, useEffect } from 'react';
import {
  Box,
  Avatar,
  Tooltip,
  Button,
  Badge,
  Popover,
  Typography,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { appColors, frameTintFilter } from './theme';
import useHudPolling from './useHudPolling';
import ActiveBuffsBadge from './ActiveBuffsBadge';
import useRaceColor from './useRaceColor';
import { useAuth } from './AuthContext';
import { expNeededForNextLevel } from './characterFormulas';

// UWAGA: to jest baza liczona RAZ przy imporcie modułu - rodzina "rust" (akcent)
// jest tu zamrożona i NIE łapie koloru rasy. W komponencie TopBar nadpisujemy
// rust* kolorami rasy (patrz `apoColors` w środku funkcji), żeby akcenty paska
// (nawigacja, hovery, obwódki) były w kolorze granej rasy, a nie stałe pomarańczowe.
const baseApoColors = {
  rust: appColors.rust,
  rustLight: appColors.rustLight,
  rustDark: appColors.rustDark,
  rustBorder: appColors.rustBorder,
  textLight: appColors.textPrimary,
  textGray: appColors.steelLight,
  bgDark: appColors.bgDark,
  bgMedium: appColors.bgMedium,
  bgVeryDark: 'rgba(0, 0, 0, 0.85)', // celowo jaśniejsze niż appColors.bgVeryDark (popover topbara, nie karta)
  bgBlack: appColors.bgDeep,
  narrator: appColors.dangerText,
};

// Ikonki nawigacji (pliki w /public/ui/nav/). Zastępują napisy głównych tabów
// oraz przycisków utility po prawej. Nazwa taba/etykieta -> plik PNG.
const NAV_ICONS = {
  // główne taby (górny rząd)
  'POSTAĆ': 'postac.png',
  'ŚWIAT': 'swiat.png',
  'KOMUNIKACJA': 'komunikacja.png',
  'RASY': 'rasy.png',
  'PORADNIKI': 'poradniki.png',
  // przyciski utility (prawa strona)
  'Aktualności': 'aktualnosci.png',
  'Ustawienia': 'ustawienia.png',
  'Lobby': 'lobby.png',
  'Wyloguj': 'wyloguj.png',
};

// Ikona w stałym kwadratowym boxie: niezależnie od natywnego rozmiaru pliku
// (są różne) obrazek jest wpasowany przez object-fit:contain, więc wszystkie
// ikonki w pasku są jednej wielkości. Gdy pliku brak / nie wczyta się -> fallback
// na tekstową etykietę (nic się nie psuje).
function NavIcon({ label, size = 34 }) {
  const [failed, setFailed] = useState(false);
  const file = NAV_ICONS[label];
  if (!file || failed) {
    return <span>{label}</span>;
  }
  return (
    <Box
      component="img"
      src={`/ui/nav/${file}`}
      alt={label}
      onError={() => setFailed(true)}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'block',
        pointerEvents: 'none',
        // delikatny cień, żeby kolorowe ikonki odcinały się od tekstury paska
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
      }}
    />
  );
}

// Pełnej szerokości pasek statystyki na dół topbara (HP/STM/EXP).
// Układ: kolorowa etykieta z lewej | stonowany pasek | wartość liczbowa z prawej.
// Bez efektu "neonu" - czysty ciemny tor z płaskim, kolorowym wypełnieniem i
// delikatnym rozjaśnieniem u góry (subtelna głębia, nie świecenie).
function WideStatBar({ label, value, pct, color }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', cursor: 'default' }}>
      {/* Etykieta - w kolorze statystyki */}
      <Box sx={{
        width: 34,
        color,
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
        flexShrink: 0,
      }}>
        {label}
      </Box>

      {/* Pasek - ciemny tor + płaskie wypełnienie */}
      <Box sx={{
        position: 'relative',
        flex: 1,
        height: 11,
        borderRadius: '3px',
        backgroundColor: 'rgba(0,0,0,0.62)',
        border: '1px solid rgba(0,0,0,0.85)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}>
        <Box sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${clamped}%`,
          background: `linear-gradient(180deg, ${color}, ${color}cc)`,
          borderRight: clamped > 0 && clamped < 100 ? `1px solid ${color}` : 'none',
          transition: 'width 0.35s ease',
        }} />
      </Box>

      {/* Wartość - zawsze widoczna z prawej (np. 1240 / 1240) */}
      <Box sx={{
        minWidth: 84,
        textAlign: 'right',
        color: appColors.textPrimary,
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '0.03em',
        textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </Box>
    </Box>
  );
}

function TopBar() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const race = useRaceColor(); // kolor akcentu wg rasy granej postaci

  // Nadpisz rodzinę "rust" kolorami RASY (baza z modułu jest zamrożona na starcie).
  // Dzięki temu cała nawigacja/hovery/obwódki paska są w kolorze granej rasy.
  const apoColors = {
    ...baseApoColors,
    rust: race.accent,
    rustLight: race.light,
    rustDark: race.hex,
    rustBorder: race.border,
  };
  // Miękkie tła akcentu (aktywne/hover) z surowego koloru rasy + alfa.
  const raceSoft = `${race.hex}26`;   // ~15%
  const raceSoft2 = `${race.hex}33`;  // ~20%
  const raceSoft3 = `${race.hex}40`;  // ~25%

  const [focusMode, setFocusMode] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [tavernRooms, setTavernRooms] = useState([]);
  const [tavernPanelAnchor, setTavernPanelAnchor] = useState(null);
  const [races, setRaces] = useState([]);
  // Rozwijane menu podtematów (klik w ikonkę taba -> popover z pozycjami)
  const [navMenuAnchor, setNavMenuAnchor] = useState(null);
  const [navMenuTab, setNavMenuTab] = useState(null);

  // Rasy pochodzą z bazy (dowolna liczba, zdefiniowana w kreatorze instalacyjnym)
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';

  const { user } = useAuth();
  const token = localStorage.getItem('token');
  // Reaktywnie z kontekstu auth (aktualizowany przy wyborze postaci) z fallbackiem
  // na localStorage - inaczej zaraz po stworzeniu/wyborze postaci pasek czytał
  // pusty id raz przy montowaniu i "nic się nie ładowało" aż do odświeżenia.
  const characterId = user?.characterId || localStorage.getItem('activeCharacterId') || localStorage.getItem('characterId');

  const {
    characterData, loadingCharacter,
    generalSessionUnreadCount, privateSessionUnreadCount, messagesUnreadCount,
    tavernUnread, journalTodoCount, activeBuffs,
  } = useHudPolling(token, characterId);

  // Focus mode
  useEffect(() => {
    const handler = (e) => setFocusMode(e.detail.focusMode);
    window.addEventListener('focusModeChange', handler);
    return () => window.removeEventListener('focusModeChange', handler);
  }, []);

  // Auto-detect active tab from path
  useEffect(() => {
    const path = location.pathname;
    if (path.match(/\/(profile|statscard|equipment|notes)/)) setActiveTab('POSTAĆ');
    // Cmentarz nie ma już pozycji w menu, ale strona wciąż istnieje - niech podświetla ŚWIAT.
    else if (path.match(/\/(city|hospital|arena|rest|cemetery)(\/|$)/)) setActiveTab('ŚWIAT');
    else if (path.match(/\/(messages|privateSessions|generalSessions|journal|tavern|logs)(\/|$)/)) setActiveTab('KOMUNIKACJA');
    else if (races.some(r => path.includes(`/${r.key}`))) setActiveTab('RASY');
    else if (path.match(/\/(infopanel|law|bestiary|mechanics|technology|alchemy-guide|history|drugs|npc|players|rules)/)) setActiveTab('PORADNIKI');
    else setActiveTab(null);
  }, [location.pathname, races]);

  // EXP calculations
  const expNeededForNext = Math.max(1, expNeededForNextLevel(characterData.level));
  const expPct = Math.min((characterData.experience / expNeededForNext) * 100, 100);
  const hpPct = characterData.maxHp > 0 ? Math.min((characterData.hp / characterData.maxHp) * 100, 100) : 0;
  const staminaPct = characterData.maxStamina > 0 ? Math.min((characterData.stamina / characterData.maxStamina) * 100, 100) : 0;

  // Navigation config
  const tabItems = {
    'POSTAĆ': [
      { label: 'Profil', path: `/home/profile/${characterId}` },
      { label: 'Statystyki', path: '/home/statscard' },
      { label: 'Ekwipunek', path: '/home/equipment' },
      { label: 'Notatki', path: '/home/notes' },
    ],
    'ŚWIAT': [
      { label: 'Miasto', path: '/home/city' },
      { label: 'Szpital', path: '/home/hospital' },
      { label: 'Arena', path: '/home/arena' },
      { label: 'Odpoczynek', path: '/home/rest' },
    ],
    'KOMUNIKACJA': [
      // Codziennik pierwszy - to od niego zaczyna się "co mam dziś odpisać".
      { label: 'Codziennik', path: '/home/journal', badge: journalTodoCount },
      { label: 'Sesje Prywatne', path: '/home/privateSessions', badge: privateSessionUnreadCount },
      { label: 'Sesje Ogólne', path: '/home/generalSessions', badge: generalSessionUnreadCount },
      { label: 'Karczma', path: '/home/tavern', dot: tavernUnread },
      { label: 'Wiadomości', path: '/home/messages', badge: messagesUnreadCount },
      // Logi bez powiadomienia (patrz useHudPolling) - wpis leci po każdej akcji,
      // więc kropka i tak paliłaby się non stop.
      { label: 'Logi', path: '/home/logs' },
    ],
    'RASY': races.map(r => ({ label: r.name, path: `/home/${r.key}` })),
    'PORADNIKI': [
      { label: 'Lokacje', path: '/home/infopanel' },
      { label: 'Informacje', path: '/home/infopanel2' },
      { label: 'Prawo', path: '/home/law' },
      { label: 'Zwierzęta', path: '/home/bestiary' },
      { label: 'Mechanika', path: '/home/mechanics' },
      { label: 'Technologia', path: '/home/technology' },
      { label: 'Alchemia', path: '/home/alchemy-guide' },
      { label: 'Historia', path: '/home/history' },
      { label: 'NPC', path: '/home/npc' },
      { label: 'Lista Graczy', path: '/home/players' },
      { label: 'Regulamin', path: '/home/rules' },
    ],
  };

  const handleNavClick = (path, e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      window.open(path, '_blank');
    } else {
      navigate(path);
    }
  };

  const handleNavContextMenu = (path, e) => {
    e.preventDefault();
    window.open(path, '_blank');
  };

  const isTavernPage = location.pathname === '/home/tavern';

  // Fetch tavern rooms+participants when on tavern page
  useEffect(() => {
    if (!isTavernPage || !token) {
      setTavernRooms([]);
      return;
    }
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/tavern/rooms-with-participants', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTavernRooms((data.rooms || []).filter(r => r.participants.length > 0));
        }
      } catch {
        // Lista uczestnikow karczmy odswieza sie co 15s - pojedyncze
        // nieudane odpytanie nic nie psuje, kolejne je nadrobi.
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 15000);
    return () => clearInterval(interval);
  }, [isTavernPage, token]);

  // Dopiero TU wolno przerwac render. Kazdy hook musi sie wykonac w tej samej
  // kolejnosci w kazdym renderze, a `focusMode` przelacza sie w trakcie zycia
  // komponentu - przy wczesnym return PONAD hookiem React zobaczylby raz 8,
  // raz 7 hookow i wywalil "Rendered fewer hooks than expected".
  if (focusMode) return null;

  const isPathActive = (path) => {
    if (path === '/home') return location.pathname === '/home';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const mainTabSx = (isActive) => ({
    color: isActive ? apoColors.rust : apoColors.textGray,
    
    fontWeight: 'bold',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    borderRadius: '0',
    border: `1px solid ${isActive ? apoColors.rustBorder : 'transparent'}`,
    backgroundColor: isActive ? raceSoft : 'transparent',
    px: 1.4,
    py: 1,
    minWidth: 0,
    transition: 'all 0.2s ease',
    // aktywny tab: kolorowa ikonka w pełni + poświata w KOLORZE RASY,
    // nieaktywne lekko przygaszone (tylko zwykły cień).
    '& img': {
      opacity: isActive ? 1 : 0.72,
      filter: isActive
        ? `drop-shadow(0 1px 2px rgba(0,0,0,0.6)) drop-shadow(0 0 7px ${race.hex})`
        : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
      transition: 'opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease',
    },
    '&:hover': {
      // Podświetlenie = kolor dividera rasy (ton środkowy), tekst JASNY.
      backgroundColor: race.strong,
      color: apoColors.textLight,
      borderColor: apoColors.rustBorder,
      '& img': {
        opacity: 1,
        transform: 'translateY(-1px)',
        filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.6)) drop-shadow(0 0 7px ${race.hex})`,
      },
    }
  });

  const subItemSx = (isActive) => ({
    color: isActive ? apoColors.rust : apoColors.textLight,
    
    fontWeight: isActive ? 'bold' : 'normal',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: '0',
    border: `1px solid ${apoColors.rustBorder}`,
    backgroundColor: isActive ? raceSoft3 : apoColors.bgDark,
    px: 1.2,
    py: 0.5,
    minWidth: 0,
    transition: 'all 0.2s ease',
    '&:hover': {
      // Podświetlenie = kolor dividera rasy (ton środkowy), tekst JASNY.
      backgroundColor: race.strong,
      color: apoColors.textLight,
      borderColor: apoColors.rustBorder,
      transform: 'translateY(-1px)',
    }
  });

  const rightBtnSx = {
    color: apoColors.textGray,
    
    fontWeight: 'bold',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    borderRadius: '0',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    px: 0.9,
    py: 0.6,
    minWidth: 0,
    transition: 'all 0.2s ease',
    '& img': {
      opacity: 0.72,
      transition: 'opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease',
    },
    '&:hover': {
      // Podświetlenie = kolor dividera rasy (ton środkowy), tekst JASNY.
      backgroundColor: race.strong,
      color: apoColors.textLight,
      borderColor: apoColors.rustBorder,
      '& img': {
        opacity: 1,
        transform: 'translateY(-1px)',
        filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.6)) drop-shadow(0 0 7px ${race.hex})`,
      },
    }
  };


  // Kropka na ikonce taba KOMUNIKACJA: sesje prywatne, sesje ogólne, karczma
  // i wiadomości. Logi świadomie pominięte - nie generują powiadomień.
  const tabHasUnread = {
    'KOMUNIKACJA': privateSessionUnreadCount > 0 || generalSessionUnreadCount > 0 || messagesUnreadCount > 0 || tavernUnread,
  };

  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        // Ta sama architektura co panele (Home.js): przezroczysty border = pas ramki
        // (pod ażurową ramką prześwituje świat, brak ciemnego prostokąta), ::before =
        // ciemne tło + tekstura TYLKO wewnątrz ramki, ::after = ozdobna ramka PNG na
        // pasie borderu. NIE dawać overflow:hidden - przycięłoby ramkę (błąd "topbar bez ramek").
        backgroundColor: 'transparent',
        border: '18px solid transparent',
        flexShrink: 0,
        boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
        // Kamienna tekstura + akcent rasy wewnątrz ramki (padding-box).
        '&::before': {
          content: '""', position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          // Neutralne #151515 (fallback) + neutralna tekstura + subtelna poświata rasy.
          backgroundColor: '#151515',
          backgroundImage: `radial-gradient(ellipse at 50% 0%, ${race.hex}22 0%, transparent 60%), url(/ui/frames/panel-bg-neutral.png)`,
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat, no-repeat',
        },
        // Ozdobna ramka rasowa na pasie borderu. Warstwy (pierwsza = na wierzchu):
        // 4 narożniki -> belki pionowe -> belki poziome (jak w panelach Home).
        '&::after': {
          content: '""', position: 'absolute',
          top: '-18px', bottom: '-18px', left: '-18px', right: '-18px',
          pointerEvents: 'none', zIndex: 6,
          // Tint rasowy ramki + subtelna poświata w kolorze dividera rasy.
          filter: `${frameTintFilter(race.frame || 'human')} drop-shadow(0 0 5px ${race.frameGlow}) drop-shadow(0 0 13px ${race.frameGlow})`,
          backgroundImage: `url(/ui/frames/corner-tl.png), url(/ui/frames/corner-tr.png), url(/ui/frames/corner-bl.png), url(/ui/frames/corner-br.png), url(/ui/frames/${race.frame || 'human'}-v.png), url(/ui/frames/${race.frame || 'human'}-v.png), url(/ui/frames/${race.frame || 'human'}-h.png), url(/ui/frames/${race.frame || 'human'}-h.png)`,
          backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat',
          backgroundPosition: 'top left, top right, bottom left, bottom right, left center, right center, top center, bottom center',
          backgroundSize: '93px 80px, 93px 80px, 93px 80px, 93px 80px, 18px 100%, 18px 100%, 100% 18px, 100% 18px',
        },
      }}
    >
      {/* Główny układ: lewa (avatar+statsy) | środek (nawigacja) | prawa (utility) */}
      {/* zIndex 1 - treść nad teksturą (::before ma zIndex 0). */}
      {/* zIndex 7 - treść NAD ozdobną ramką panelu (::after ma 6), żeby awatar mógł
          "wystawać" nad krawędź topbara. Reszta treści i tak jest w padding-box. */}
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, position: 'relative', zIndex: 7 }}>

        {/* LEWA: Avatar + statsy tekstowe obok */}
        <Box
          role="button"
          tabIndex={0}
          aria-label="Otwórz profil postaci"
          sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
          onClick={(e) => handleNavClick(`/home/profile/${characterId}`, e)}
          onContextMenu={(e) => handleNavContextMenu(`/home/profile/${characterId}`, e)}
          onAuxClick={(e) => e.button === 1 && handleNavClick(`/home/profile/${characterId}`, e)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavClick(`/home/profile/${characterId}`, e); } }}
        >
          {/* Avatar w ozdobnej ramce rasowej (PNG /ui/frames/avatar-<rasa>.png).
              Ramka zastępuje dawny pierścień/border; awatar siedzi w jej otworze. */}
          <Box
            sx={{
              position: 'relative',
              flexShrink: 0,
              alignSelf: 'center',
              width: 212,
              height: 212,
              // Symetryczny ujemny margines: awatar jest WYCENTROWANY góra-dół i
              // nachodzi na górną oraz dolną krawędź topbara po równo (efekt "pop").
              my: '-34px',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.3s ease',
              '&:hover': { transform: 'scale(1.05)' },
            }}
          >
            <Avatar
              src={characterData.avatar ? `/api${characterData.avatar}` : '/default-avatar.png'}
              alt="Avatar"
              sx={{
                width: 156,
                height: 156,
                borderRadius: '50%',
                background: apoColors.bgDark,
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.55)',
                '& img': { objectPosition: 'top center' },
              }}
            />
            {/* Ozdobna ramka awatara wg rasy (nakładka nad awatarem) */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 2,
                backgroundImage: `url(/ui/frames/avatar-${race.frame || 'human'}.png)`,
                backgroundSize: 'auto 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: `${frameTintFilter(race.frame || 'human')} drop-shadow(0 3px 10px rgba(0,0,0,0.7)) drop-shadow(0 0 10px ${race.frameGlow})`,
              }}
            />
          </Box>
        </Box>

        {/* PRAWA CZĘŚĆ topbara: kolumna - GÓRA (ksywka + ikonki + utility w jednej
            linii), DÓŁ (paski statystyk na całą szerokość). space-between dociska
            ikonki do góry, a paski do dołu paska. */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1, py: 0.5 }}>

          {/* GÓRNY RZĄD: ksywka/poziom + ikonki nawigacji + utility */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, width: '100%' }}>

            {/* Ksywka + poziom (obok avatara) - wyśrodkowane w pionie i poziomie */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '2px', flexShrink: 0, minWidth: 120 }}>
              <Box sx={{ color: apoColors.rust, fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.08em', textShadow: '1px 1px 2px rgba(0,0,0,0.8)', whiteSpace: 'nowrap' }}>
                {characterData.nickname || '—'}
              </Box>
              <Box sx={{ color: apoColors.textGray, fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                POZIOM {characterData.level}
                {characterData.prestige > 0 && (
                  <span style={{ color: theme.palette.warning.main, fontWeight: 'bold', textShadow: `0 0 5px ${theme.palette.warning.main}aa` }}>
                    ({characterData.prestige})
                  </span>
                )}
                {/* Czasowe bufy z mikstur - widoczne tylko gdy jakiś leci */}
                <ActiveBuffsBadge buffs={activeBuffs} accentColor={apoColors.rust} />
              </Box>
              {/* Złoto postaci - pod poziomem, w złotym kolorze z ikonką monety */}
              <Tooltip title="Złoto" arrow enterDelay={400}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  color: '#e8c15a', fontSize: '14px', fontWeight: 'bold',
                  letterSpacing: '0.03em', whiteSpace: 'nowrap', cursor: 'default',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.9)', fontVariantNumeric: 'tabular-nums',
                }}>
                  <span style={{ fontSize: '13px', lineHeight: 1 }} aria-hidden>🪙</span>
                  {Number(characterData.gold || 0).toLocaleString('pl-PL')}
                </Box>
              </Tooltip>
            </Box>

        {/* ŚRODEK: nawigacja - duże ikonki; klik otwiera rozwijane menu (popover)
            z podtematami danego działu (styl "hamburger"). */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 0.5,
            minWidth: 0,
          }}
        >
          {/* Rząd ikonek tabów */}
          <Box sx={{ display: 'flex', gap: 1.2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.keys(tabItems).map(tab => (
              <Badge
                key={tab}
                variant="dot"
                color="error"
                invisible={!tabHasUnread[tab]}
                sx={{ '& .MuiBadge-badge': { top: 10, right: 10 } }}
              >
                <Tooltip title={tab} arrow enterDelay={400}>
                  <Button
                    aria-label={tab}
                    aria-haspopup="true"
                    onClick={(e) => { setNavMenuTab(tab); setNavMenuAnchor(e.currentTarget); }}
                    sx={mainTabSx(activeTab === tab || navMenuTab === tab)}
                  >
                    <NavIcon label={tab} size={60} />
                  </Button>
                </Tooltip>
              </Badge>
            ))}
          </Box>

          {/* Rozwijane menu podtematów aktywnego taba */}
          <Popover
            open={Boolean(navMenuAnchor)}
            anchorEl={navMenuAnchor}
            onClose={() => { setNavMenuAnchor(null); setNavMenuTab(null); }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            PaperProps={{
              sx: {
                mt: 0.5,
                backgroundColor: apoColors.bgVeryDark,
                border: `1px solid ${apoColors.rustBorder}`,
                borderRadius: 0,
                minWidth: 190,
                boxShadow: `0 12px 40px rgba(0,0,0,0.85)`,
                backgroundImage: `radial-gradient(ellipse at 50% 0%, ${race.hex}22 0%, transparent 70%)`,
              }
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', p: 0.6, gap: 0.4 }}>
              {(navMenuTab ? tabItems[navMenuTab] : []).map(item => (
                <Badge
                  key={item.path}
                  badgeContent={item.badge || 0}
                  color="error"
                  variant={item.dot ? 'dot' : 'standard'}
                  invisible={!item.dot && !item.badge}
                  sx={{ display: 'block', '& .MuiBadge-badge': { fontSize: '9px', minWidth: '14px', height: '14px',  top: 8, right: 6 } }}
                >
                  <Button
                    fullWidth
                    sx={{ ...subItemSx(isPathActive(item.path)), justifyContent: 'flex-start', width: '100%' }}
                    onClick={(e) => { handleNavClick(item.path, e); setNavMenuAnchor(null); setNavMenuTab(null); }}
                    onContextMenu={(e) => handleNavContextMenu(item.path, e)}
                    onAuxClick={(e) => { if (e.button === 1) { handleNavClick(item.path, e); setNavMenuAnchor(null); setNavMenuTab(null); } }}
                  >
                    {item.label}
                  </Button>
                </Badge>
              ))}
            </Box>
          </Popover>
          {/* Rząd 3: panel karczmy (tylko /home/tavern) */}
          {isTavernPage && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                alignItems: 'center',
                borderTop: `1px solid ${apoColors.rustBorder}`,
                pt: 0.5,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              {/* Przycisk z łączną liczbą graczy */}
              <Button
                size="small"
                startIcon={<PeopleIcon sx={{ fontSize: '13px !important' }} />}
                onClick={(e) => setTavernPanelAnchor(e.currentTarget)}
                sx={{
                  color: apoColors.textGray,
                  
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  px: 1,
                  py: 0.4,
                  border: `1px solid ${apoColors.rustBorder}`,
                  borderRadius: 0,
                  '&:hover': { color: apoColors.textLight, borderColor: apoColors.rustLight, backgroundColor: apoColors.bgMedium },
                }}
              >
                {tavernRooms.reduce((n, r) => n + r.participants.length, 0)} w karczmie
              </Button>

              <Button
                size="small"
                startIcon={<ExitToAppIcon sx={{ fontSize: '13px !important' }} />}
                onClick={() => window.dispatchEvent(new CustomEvent('tavernLeaveTavern'))}
                sx={{
                  color: apoColors.narrator,
                  
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  px: 1,
                  py: 0.4,
                  border: `1px solid rgba(155,44,44,0.4)`,
                  borderRadius: 0,
                  '&:hover': { color: theme.palette.error.light, borderColor: 'rgba(155,44,44,0.7)', backgroundColor: 'rgba(155,44,44,0.15)' },
                }}
              >
                Wyjdź z karczmy
              </Button>

              {/* Popover z podziałem na pokoje */}
              <Popover
                open={Boolean(tavernPanelAnchor)}
                anchorEl={tavernPanelAnchor}
                onClose={() => setTavernPanelAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                PaperProps={{
                  sx: {
                    backgroundColor: apoColors.bgVeryDark,
                    border: `1px solid ${apoColors.rustBorder}`,
                    borderRadius: 0,
                    width: 'min(94vw, 680px)',
                    maxHeight: '72vh',
                    overflowY: 'auto',
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-thumb': { background: apoColors.rustBorder },
                  }
                }}
              >
                <Box sx={{ p: 2.5 }}>
                  <Typography sx={{
                     fontSize: '14px', color: apoColors.textGray,
                    textTransform: 'uppercase', letterSpacing: '0.15em', mb: 2,
                    borderBottom: `1px solid ${apoColors.rustBorder}`, pb: 1,
                  }}>
                    Karczma — uczestnicy
                  </Typography>

                  {tavernRooms.length === 0 ? (
                    <Typography sx={{  fontSize: '15px', color: apoColors.textGray, textAlign: 'center', py: 2 }}>
                      Brak uczestników
                    </Typography>
                  ) : (
                    tavernRooms.map((room) => (
                      <Box key={room.id} sx={{ mb: 2.5 }}>
                        {/* Nagłówek pokoju */}
                        <Box sx={{
                          display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
                          borderBottom: `1px solid ${apoColors.rustBorder}`, pb: 0.75,
                        }}>
                          <Typography sx={{
                             fontSize: '15px', color: apoColors.rust,
                            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold',
                          }}>
                            {room.name}
                          </Typography>
                          <Typography sx={{  fontSize: '13px', color: apoColors.textGray }}>
                            ({room.participants.length})
                          </Typography>
                        </Box>

                        {/* Siatka uczestników */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                          {room.participants.map((p) => (
                            <Tooltip
                              key={p.character_id || p.id}
                              title={
                                <Box sx={{  fontSize: '13px' }}>
                                  <div>{p.character_name || p.username}</div>
                                  {p.faction && p.faction !== 'Nieznana' && <div style={{ color: theme.palette.primary.main }}>{getRaceName(p.faction)}</div>}
                                </Box>
                              }
                              arrow
                            >
                              <Box sx={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                gap: 0.75, cursor: 'default', width: 104,
                              }}>
                                <Avatar
                                  src={p.avatar ? `/api${p.avatar}` : undefined}
                                  variant="square"
                                  sx={{
                                    width: 84, height: 104,
                                    borderRadius: '2px',
                                    border: `2px solid ${apoColors.rustBorder}`,
                                    '& .MuiAvatar-img': { objectFit: 'cover', objectPosition: '50% 0%' },
                                    '&:hover': { borderColor: apoColors.rustLight },
                                    transition: 'border-color 0.2s',
                                  }}
                                >
                                  {(p.character_name || p.username || '?')[0]?.toUpperCase()}
                                </Avatar>
                                <Typography sx={{
                                   fontSize: '13px', color: apoColors.textLight,
                                  textAlign: 'center', lineHeight: 1.25,
                                  maxWidth: 104, overflow: 'hidden',
                                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                }}>
                                  {p.character_name || p.username}
                                </Typography>
                              </Box>
                            </Tooltip>
                          ))}
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              </Popover>
            </Box>
          )}
        </Box>

        {/* PRAWA: utility buttons — wyśrodkowane w pionie, na tej samej linii co ikonki tabów */}
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', flexShrink: 0, mr: 2 }}>
          <Box sx={{ display: 'flex', gap: 0.6, flexShrink: 0 }}>
              <Tooltip title="Aktualności" arrow enterDelay={300}>
                <Button
                  aria-label="Aktualności"
                  sx={rightBtnSx}
                  onClick={(e) => handleNavClick('/home', e)}
                  onContextMenu={(e) => handleNavContextMenu('/home', e)}
                >
                  <NavIcon label="Aktualności" size={60} />
                </Button>
              </Tooltip>
              <Tooltip title="Ustawienia" arrow enterDelay={300}>
                <Button
                  aria-label="Ustawienia"
                  sx={rightBtnSx}
                  onClick={(e) => handleNavClick('/home/settings', e)}
                  onContextMenu={(e) => handleNavContextMenu('/home/settings', e)}
                >
                  <NavIcon label="Ustawienia" size={60} />
                </Button>
              </Tooltip>
              <Tooltip title="Lobby" arrow enterDelay={300}>
                <Button
                  aria-label="Lobby"
                  sx={rightBtnSx}
                  onClick={(e) => handleNavClick('/lobby', e)}
                  onContextMenu={(e) => handleNavContextMenu('/lobby', e)}
                >
                  <NavIcon label="Lobby" size={60} />
                </Button>
              </Tooltip>
              <Tooltip title="Wyloguj" arrow enterDelay={300}>
                <Button
                  aria-label="Wyloguj"
                  sx={{
                    ...rightBtnSx,
                    color: apoColors.narrator,
                    '&:hover': {
                      backgroundColor: 'rgba(155, 44, 44, 0.2)',
                      color: apoColors.narrator,
                      borderColor: 'rgba(155, 44, 44, 0.4)',
                      '& img': { opacity: 1, transform: 'translateY(-1px)' },
                    }
                  }}
                  onClick={(e) => handleNavClick('/logout', e)}
                  onContextMenu={(e) => handleNavContextMenu('/logout', e)}
                >
                  <NavIcon label="Wyloguj" size={60} />
                </Button>
              </Tooltip>
            </Box>
          </Box>
          </Box>

          {/* DÓŁ: paski statystyk na całą szerokość (od avatara do prawej krawędzi);
              wartości pokazują się w dymku po najechaniu na dany pasek. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6, width: '100%', pl: 0.5, pr: 3, pb: 0.3 }}>
            <WideStatBar label="HP" value={loadingCharacter ? '…' : `${Math.floor(characterData.hp)} / ${Math.floor(characterData.maxHp)}`} pct={loadingCharacter ? 0 : hpPct} color={theme.palette.error.main} />
            <WideStatBar label="STM" value={loadingCharacter ? '…' : `${Math.floor(characterData.stamina)} / ${Math.floor(characterData.maxStamina)}`} pct={loadingCharacter ? 0 : staminaPct} color={theme.palette.success.main} />
            <WideStatBar label="EXP" value={loadingCharacter ? '…' : `${Math.floor(characterData.experience)} / ${expNeededForNext}`} pct={loadingCharacter ? 0 : expPct} color={theme.palette.warning.main} />
          </Box>
        </Box>

      </Box>
    </Box>
  );
}

export default TopBar;
