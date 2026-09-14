import { useState, useEffect, useRef } from 'react';
import { Box, Button, Collapse, Avatar, Tooltip, Typography, LinearProgress, Divider, Badge, IconButton, Menu, MenuItem, ListItemText } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu as MenuIcon, Star as StarIcon, People as PeopleIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { NarratorMark } from './NarratorAvatar';
import { useTheme } from '@mui/material/styles';
import { appColors } from './theme';
import useResponsive from './useResponsive';
import useHudPolling from './useHudPolling';
import ActiveBuffsBadge from './ActiveBuffsBadge';
import { useAuth } from './AuthContext';
import { expNeededForNextLevel } from './characterFormulas';

// Kolory motyw wizualny - jedno źródło prawdy dla całego pliku.
// Rodzina "rust" (akcent) to GETTERY czytające żywe appColors - a te są nadpisywane
// kolorem RASY granej postaci (ColorModeProvider -> applyThemeColors). Dzięki temu
// akcenty/hovery/obwódki sidebara są w kolorze rasy, a nie zamrożone na pomarańczowo.
const apoColors = {
  get rust() { return appColors.rust; },
  get rustLight() { return appColors.rustLight; },
  get rustDark() { return appColors.rustDark; },
  get rustBorder() { return appColors.rustBorder; },
  textLight: appColors.textPrimary,
  textGray: appColors.steelLight,
  bgDark: appColors.bgDark,
  bgMedium: appColors.bgMedium,
  bgVeryDark: appColors.bgVeryDark,
  bgBlack: appColors.bgDeep,
  narrator: appColors.dangerText,
  error: appColors.dangerSoft,
  errorHover: appColors.dangerSoftHover,
};
// Tło toru paska HP/staminy - celowo jaśniejsze niż bgVeryDark używane w kartach
const statBarTrackBg = 'rgba(0, 0, 0, 0.6)';

function ParticipantList({ participants, onUserClick, races = [] }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || 'Nieznana';

  const handleProfileClick = (characterId, e) => { 
    e.preventDefault(); 
    if (e.ctrlKey || e.metaKey || e.button === 1) { 
      window.open(`/home/profile/${characterId}`, '_blank'); 
    } else { 
      navigate(`/home/profile/${characterId}`); 
    } 
  };
  const handleContextMenu = (characterId, e) => { 
    e.preventDefault(); 
    window.open(`/home/profile/${characterId}`, '_blank'); 
  };

  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {participants.map((p) => {
        const characterId = p.id || p.character_id;
        const characterName = p.name || p.character_name || p.user;
        const characterType = p.character_type || 'player';
        const displayName = characterName || `Postać ${characterId}`;
        const avatar = p.avatar || p.character_avatar;
        const faction = getRaceName(p.faction || p.character_faction);
        const gender = p.gender || p.character_gender || p.user_gender || 'Nieznana';

        return (
          <Tooltip 
            key={`char-${characterId}`} 
            arrow 
            enterDelay={200} 
            placement="right" 
            componentsProps={{ 
              tooltip: { sx: { bgcolor: 'transparent', p: 0, maxWidth: 'none' } }, 
              arrow: { sx: { color: apoColors.rustBorder } } 
            }}
            title={
              <Box sx={{ 
                p: 2, 
                minWidth: 220, 
                textAlign: 'center', 
                bgcolor: apoColors.bgVeryDark, 
                borderRadius: '0',
                boxShadow: `0 12px 40px ${apoColors.bgVeryDark}`, 
                border: `2px solid ${apoColors.rustBorder}`, 
                backdropFilter: 'blur(20px)' 
              }}>
                <Avatar
                  src={avatar ? `/api${avatar}` : undefined}
                  alt={displayName}
                  sx={{
                    width: 100,
                    height: 125,
                    mb: 1.2,
                    mx: 'auto',
                    border: `2px solid ${apoColors.rustBorder}`,
                    boxShadow: `0 8px 30px ${apoColors.rust}50`,
                    background: apoColors.bgDark,
                    fontSize: 40,
                    objectFit: 'cover',
                    borderRadius: '0',
                    color: apoColors.textGray,
                    
                    fontWeight: 'bold'
                  }}
                >
                  {!avatar && displayName?.[0]}
                </Avatar>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                  <Box sx={{
                    fontWeight: 'bold',
                    color: apoColors.rust,
                    fontSize: 16,
                    
                    textShadow: `0 0 10px ${apoColors.rustBorder}`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    {displayName}
                  </Box>
                  <Box sx={{
                    bgcolor: apoColors.bgDark,
                    color: apoColors.textLight,
                    px: 1,
                    py: 0.3,
                    borderRadius: '0',
                    fontSize: 11,
                    fontWeight: 'bold',
                    height: 20,
                    border: `1px solid ${apoColors.rustBorder}`,
                    }}>
                    #{characterId}
                  </Box>
                </Box>
                {characterType === 'narrator' && (
                  <Box sx={{
                    fontSize: 14,
                    color: apoColors.narrator,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    <NarratorMark fontSize="small" />
                    Narrator
                  </Box>
                )}
                <Box sx={{
                  fontSize: 14,
                  color: apoColors.textLight,
                  
                  textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                }}>
                  <Box component="span" sx={{ color: apoColors.rust, fontWeight: 'bold' }}>{faction}</Box> • <Box component="span" sx={{ color: apoColors.rust, fontWeight: 'bold' }}>{gender}</Box>
                </Box>
              </Box>
            }
          >
            <Box 
              component="li" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5, 
                px: 2, 
                py: 1, 
                borderRadius: '0',
                transition: 'all 0.3s ease', 
                cursor: 'pointer', 
                color: apoColors.textLight, 
                fontSize: '13px', 
                fontWeight: 600, 
                 
                border: `1px solid ${apoColors.rustBorder}`, 
                backgroundColor: apoColors.bgDark, 
                mb: 0.5,
                '&:hover': { 
                  backgroundColor: apoColors.rust, 
                  color: theme.palette.background.default, 
                  borderColor: apoColors.rustLight, 
                  transform: 'translateX(5px)', 
                  boxShadow: `0 4px 12px ${apoColors.rustBorder}` 
                } 
              }} 
              onClick={(e) => handleProfileClick(characterId, e)}
              onContextMenu={(e) => handleContextMenu(characterId, e)}
              onAuxClick={(e) => e.button === 1 && handleProfileClick(characterId, e)}
              role="button"
              tabIndex={0}
              aria-label={`Otwórz profil: ${displayName}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleProfileClick(characterId, e); } }}
            >
              <Avatar
                src={avatar ? `/api${avatar}` : undefined}
                alt={displayName}
                sx={{
                  width: 40,
                  height: 40,
                  mr: 0.5,
                  border: `2px solid ${apoColors.rustBorder}`,
                  background: apoColors.bgDark,
                  fontSize: 14,
                  color: apoColors.textGray,
                  boxShadow: `0 2px 8px ${apoColors.rustBorder}`,
                  borderRadius: '0',
                  
                  fontWeight: 'bold'
                }}
              >
                {!avatar && displayName?.[0]}
              </Avatar>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ 
                  fontWeight: 600, 
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {displayName}
                </span>
                {characterType === 'narrator' && (
                  <Box sx={{ 
                    fontSize: '10px', 
                    color: apoColors.narrator, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.3, 
                    mt: 0.2, 
                    
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    <NarratorMark sx={{ fontSize: 10 }} /> Narrator
                  </Box>
                )}
              </Box>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

// Uwaga: `theme` NIE jest tu w zasięgu (to funkcja modułowa, nie ciało komponentu),
// więc kolor domyślny musi lecieć z hooka w środku. Wcześniej stało w domyślnym
// parametrze i wywaliłoby sidebar przy pierwszym użyciu <StatBar> bez `color`.
function StatBar({ label, current, max, color, icon = null, showValues = false }) {
  const theme = useTheme();
  const barColor = color || theme.palette.text.secondary;
  // Obcięte do 0-100: sam pasek i tak był clampowany, ale liczba obok nie -
  // stąd "117%" przy pasku napchanym do pełna.
  const percentage = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;

  return (
    <Box sx={{ mb: 1.2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: apoColors.textLight,
          fontSize: '11px',
          fontWeight: 'bold',
          
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}>
          {icon}
          {label}
        </Box>
        <Box sx={{
          color: barColor,
          fontSize: '12px',
          fontWeight: 'bold',
          }}>
          {showValues ? `${Math.floor(current)}/${Math.floor(max)}` : `${percentage.toFixed(0)}%`}
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 10,
          borderRadius: '0',
          backgroundColor: statBarTrackBg,
          '& .MuiLinearProgress-bar': {
            backgroundColor: barColor,
            borderRadius: '0',
            boxShadow: `0 0 8px ${barColor}60`,
            transition: 'transform 0.8s ease-in-out'
          }
        }}
      />
    </Box>
  );
}

function Sidebar({ isSidebarOpen, setIsSidebarOpen, onShowOnlineList = null }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSmall, isVerySmall, isDesktop } = useResponsive();
  const sidebarRef = useRef(null);

  const [tavernRoomsWithParticipants, setTavernRoomsWithParticipants] = useState([]);
  const [currentTavernRoom, setCurrentTavernRoom] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [username, setUsername] = useState('');
  const [loadingUsername, setLoadingUsername] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [showRaces, setShowRaces] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const [races, setRaces] = useState([]);

  // Rasy pochodzą z bazy (dowolna liczba, zdefiniowana w kreatorze instalacyjnym)
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const { user } = useAuth();
  const token = localStorage.getItem('token');
  // Reaktywnie z kontekstu auth (patrz TopBar) - fallback na localStorage.
  const characterId = user?.characterId || localStorage.getItem('activeCharacterId') || localStorage.getItem('characterId');

  const {
    characterData, setCharacterData, loadingCharacter,
    generalSessionUnreadCount, privateSessionUnreadCount, messagesUnreadCount,
    tavernUnread, journalTodoCount, journalNarrationTodoCount, activeBuffs,
  } = useHudPolling(token, characterId);

  const isPrivateSessionPage = location.pathname.startsWith('/home/privateSessions');
  const isGeneralSessionPage = location.pathname.startsWith('/home/generalSessions');
  const isTavernPage = location.pathname === '/home/tavern';
  const pathParts = location.pathname.split('/');
  const privId = isPrivateSessionPage && pathParts[3] && pathParts[3] !== 'new' && pathParts[3] !== 'archive' ? pathParts[3] : null;
  const genId = isGeneralSessionPage && pathParts[3] && pathParts[3] !== 'new' && pathParts[3] !== 'archive' ? pathParts[3] : null;

  // Tavern - czy użytkownik jest aktywnie w karczmie
  const isUserInTavern = currentTavernRoom !== null;

  useEffect(() => { const fetchCurrentCharacter = async () => { try { const response = await fetch('/api/getCurrentCharacter', { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }); if (response.ok) { const data = await response.json(); if (data.characterId && data.characterId !== characterId) { localStorage.setItem('characterId', data.characterId); setCharacterData(prevData => ({ ...prevData })); } } } catch (error) { console.error('Error fetching current character:', error); } }; fetchCurrentCharacter(); }, [location.pathname]);

  useEffect(() => { const fetchUsername = async () => { try { if (!token) { setUsername('Gość'); setLoadingUsername(false); return; } const storedUsername = localStorage.getItem('username'); if (storedUsername) { setUsername(storedUsername); setLoadingUsername(false); } const response = await fetch('/api/online-users', { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }); if (response.ok) { const data = await response.json(); if (data.success && Array.isArray(data.data)) { const currentPlayer = data.data.find(player => player.id?.toString() === characterId?.toString()); if (currentPlayer && currentPlayer.user) { setUsername(currentPlayer.user); localStorage.setItem('username', currentPlayer.user); } else { const fallbackResponse = await fetch('/api/checkCharacter', { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }); if (fallbackResponse.ok) { const fallbackData = await fallbackResponse.json(); const playerName = fallbackData.username || fallbackData.user || 'Gracz'; setUsername(playerName); localStorage.setItem('username', playerName); } else { setUsername(storedUsername || 'Gracz'); } } } else { setUsername(storedUsername || 'Gracz'); } } else { setUsername(storedUsername || 'Gracz'); } } catch (error) { console.error('Błąd pobierania nazwy gracza:', error); setUsername(localStorage.getItem('username') || 'Gracz'); } finally { setLoadingUsername(false); } }; fetchUsername(); }, [token, characterId]);

  useEffect(() => { const handleFocusMode = (e) => { setFocusMode(e.detail.focusMode); }; window.addEventListener('focusModeChange', handleFocusMode); return () => window.removeEventListener('focusModeChange', handleFocusMode); }, []);

  useEffect(() => { if (!privId || !token || !characterId) return; const markPrivateSessionAsSeen = async () => { try { await fetch(`/api/privateSessions/${privId}/seen`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId }) }); } catch (error) { console.error('Error marking private session as seen:', error); } }; markPrivateSessionAsSeen(); }, [privId, token, characterId]);

  useEffect(() => { if (!genId || !token || !characterId) return; const markGeneralSessionAsSeen = async () => { try { await fetch(`/api/generalSessions/${genId}/seen`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId }) }); } catch (error) { console.error('Error marking general session as seen:', error); } }; markGeneralSessionAsSeen(); }, [genId, token, characterId]);

  useEffect(() => { if (!isSmall || !isSidebarOpen) return; const handleClickOutside = (event) => { if (sidebarRef.current && !sidebarRef.current.contains(event.target)) { setIsSidebarOpen(false); } }; document.addEventListener('mousedown', handleClickOutside); return () => { document.removeEventListener('mousedown', handleClickOutside); }; }, [isSmall, isSidebarOpen, setIsSidebarOpen]);

  // Sprawdzanie aktualnego pokoju użytkownika i pobieranie wszystkich pokoi z uczestnikami (gdy jesteśmy na stronie tavern)
  useEffect(() => {
    if (!isTavernPage || !token) {
      setTavernRoomsWithParticipants([]);
      setCurrentTavernRoom(null);
      return;
    }

    const fetchTavernData = async () => {
      try {
        // Sprawdź status tavern (czy user jest w tavern i w jakim pokoju)
        const statusResponse = await fetch('/api/tavern/status', {
          headers: { Authorization: `Bearer ${token}` }
        });

        let userRoomId = null;
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.isInTavern && statusData.room) {
            userRoomId = statusData.room.id;
            setCurrentTavernRoom(statusData.room);
          } else {
            setCurrentTavernRoom(null);
          }
        }

        // Pobierz wszystkie pokoje z uczestnikami
        const roomsResponse = await fetch('/api/tavern/rooms-with-participants', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (roomsResponse.ok) {
          const data = await roomsResponse.json();
          setTavernRoomsWithParticipants(data.rooms || []);
        } else {
          console.error('Failed to fetch rooms with participants, status:', roomsResponse.status);
          setTavernRoomsWithParticipants([]);
        }
      } catch (error) {
        console.error('Error fetching tavern data:', error);
        setTavernRoomsWithParticipants([]);
        setCurrentTavernRoom(null);
      }
    };

    fetchTavernData();
    // 15 s, tak samo jak TopBar (desktop) dla dokładnie tych samych danych.
    // Wcześniej było tu 5 s, czyli 24 żądania na minutę z samego paska - trzy
    // razy więcej niż na desktopie, przy identycznej liście uczestników pokoi.
    const interval = setInterval(fetchTavernData, 15000);
    return () => clearInterval(interval);
  }, [isTavernPage, token]);

  const handleProfileClick = (charId) => { navigate(`/home/profile/${charId}`); };
  
  const mainButtonStyle = {
    width: '100%',
    justifyContent: 'flex-start',
    px: 1.5,
    py: 0.5,
    backgroundColor: apoColors.bgDark,
    color: apoColors.textLight,
    fontWeight: 'bold',
    
    textTransform: 'uppercase',
    fontSize: '11px',
    borderRadius: '0',
    border: `2px solid ${apoColors.rustBorder}`,
    boxShadow: `0 2px 8px ${apoColors.rustBorder}`,
    transition: 'all 0.3s ease',
    letterSpacing: '0.1em',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
    '&:hover': {
      backgroundColor: apoColors.rust,
      color: apoColors.bgBlack,
      borderColor: apoColors.rustLight,
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 15px ${apoColors.rustBorder}`
    }
  };

  const subButtonStyle = { 
    ...mainButtonStyle, 
    fontSize: '11px', 
    py: 0.7, 
    backgroundColor: apoColors.bgMedium, 
    border: `1px solid ${apoColors.rustBorder}`, 
    '&:hover': { 
      backgroundColor: apoColors.rustDark, 
      color: apoColors.textLight 
    } 
  };

  const boxParticipantStyle = {
    backgroundColor: apoColors.bgDark,
    border: `2px solid ${apoColors.rustBorder}`,
    borderRadius: '0',
    p: 1,
    mb: 1,
    backdropFilter: 'blur(10px)',
    boxShadow: `0 4px 15px ${apoColors.rustBorder}`,
    minHeight: '250px',
    maxHeight: '400px',
    overflowY: 'auto',
    flexShrink: 0,
    '&::-webkit-scrollbar': {
      width: '8px'
    },
    '&::-webkit-scrollbar-track': {
      background: apoColors.bgMedium,
      borderRadius: '0'
    },
    '&::-webkit-scrollbar-thumb': {
      background: apoColors.rust,
      borderRadius: '0',
      border: `1px solid ${apoColors.rustBorder}`,
      '&:hover': {
        background: apoColors.rustLight
      }
    }
  };

  const boxTitleStyle = {
    color: apoColors.rust,
    
    fontWeight: 'bold',
    fontSize: '13px',
    mb: 1,
    borderBottom: `2px solid ${apoColors.rustBorder}`,
    pb: 0.5,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    textShadow: `0 0 10px ${apoColors.rustBorder}`
  };

  const menuItemStyle = { 
    color: apoColors.textLight, 
     
    fontWeight: 600, 
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    fontSize: '12px',
    letterSpacing: '0.05em',
    '&:hover': { 
      backgroundColor: apoColors.rust, 
      color: apoColors.bgBlack 
    } 
  };

  const logoutMenuItemStyle = { 
    ...menuItemStyle, 
    color: apoColors.narrator, 
    '&:hover': { 
      backgroundColor: 'rgba(155, 44, 44, 0.3)', 
      color: apoColors.narrator 
    } 
  };

// Próg awansu - liczony tym samym wzorem co backend (characterFormulas.js).
// Sidebar miał własną, martwą kopię starej krzywej (500 EXP * 1.03^poziom),
// przez co pasek XP na mobile pokazywał np. 117% i wyglądał, jakby poziom
// się nie wbijał, mimo że backend liczył zupełnie inny (wyższy) próg.
const expToNextLevel = Math.max(1, expNeededForNextLevel(characterData.level));

// Exp jest resetowany do 0 po level up, więc characterData.experience to już progress
const expInCurrentLevel = Math.max(0, Math.floor(characterData.experience || 0));

// Procent postępu - obcięty do 100%, żeby chwilowy rozjazd danych z HUD-a
// (poziom z jednego odpytania, exp z kolejnego) nie wypisywał "117%"
const expPercent = Math.min(100, Math.round((expInCurrentLevel / expToNextLevel) * 100));

if (focusMode) return null;
  
if (isSmall || isVerySmall) {
  const handleMenuOpen = (e) => { setAnchorEl(e.currentTarget); };
  const handleMenuClose = () => { setAnchorEl(null); };
  const handleNavClick = (path, e) => { 
    e.preventDefault(); 
    handleMenuClose(); 
    if (e.ctrlKey || e.metaKey || e.button === 1) { 
      window.open(path, '_blank'); 
    } else { 
      navigate(path); 
    } 
  };
  const handleNavContextMenu = (path, e) => { 
    e.preventDefault(); 
    handleMenuClose(); 
    window.open(path, '_blank'); 
  };

return (
  <Box sx={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    backgroundColor: apoColors.bgVeryDark,
    backdropFilter: 'blur(20px)',
    borderBottom: `2px solid ${apoColors.rustBorder}`,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)',
    p: 1,
    // index.html deklaruje viewport-fit=cover, więc na telefonach z wycięciem
    // pasek wchodził pod notch. Dokładamy tyle, ile system podaje jako
    // bezpieczny margines (na urządzeniach bez wycięcia to 0).
    pt: 'calc(8px + env(safe-area-inset-top, 0px))',
    pl: 'calc(8px + env(safe-area-inset-left, 0px))',
    pr: 'calc(8px + env(safe-area-inset-right, 0px))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1
  }}>
    <Avatar
      src={characterData.avatar ? `/api${characterData.avatar}` : '/default-avatar.png'}
      alt={characterData.nickname}
      sx={{
        width: 45,
        height: 60,
        border: `2px solid ${apoColors.rustBorder}`,
        borderRadius: '0',
        background: apoColors.bgDark,
        cursor: 'pointer',
        
        fontWeight: 'bold',
        color: apoColors.textGray,
        flexShrink: 0
      }}
      onClick={() => navigate(`/home/profile/${characterId}`)}
      role="button"
      tabIndex={0}
      aria-label="Otwórz profil postaci"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/home/profile/${characterId}`); } }}
    >
      {!characterData.avatar && username && username[0]}
    </Avatar>

    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{
        color: apoColors.rust,
        
        fontWeight: 'bold',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textShadow: `0 0 10px ${apoColors.rustBorder}`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {loadingUsername ? '[ ... ]' : username}
      </Typography>
      <Typography sx={{
        color: apoColors.textGray,
        
        fontSize: '9px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        mb: 0.3
      }}>
        Lvl {characterData.level}
      </Typography>

      {/* Czasowe bufy z mikstur - widoczne tylko gdy jakiś leci */}
      {activeBuffs.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.4 }}>
          <ActiveBuffsBadge buffs={activeBuffs} accentColor={apoColors.rust} />
        </Box>
      )}

      {/* Mini paski statystyk */}
      {!loadingCharacter && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
          {/* HP Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{
              fontSize: '7px',
              fontWeight: 'bold',
              
              color: theme.palette.error.text,
              minWidth: '18px'
            }}>
              HP
            </Typography>
            <Box sx={{
              flex: 1,
              height: 4,
              backgroundColor: apoColors.bgVeryDark,
              border: `1px solid ${apoColors.rustBorder}`,
              borderRadius: '0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{
                height: '100%',
                width: `${Math.min((characterData.hp / characterData.maxHp) * 100, 100)}%`,
                backgroundColor: theme.palette.error.main,
                boxShadow: `0 0 4px ${theme.palette.error.main}80`,
                transition: 'width 0.8s ease-in-out'
              }} />
            </Box>
            <Typography sx={{
              fontSize: '7px',
              fontWeight: 'bold',
              
              color: apoColors.rust,
              minWidth: '32px',
              textAlign: 'right'
            }}>
              {Math.floor(characterData.hp)}/{Math.floor(characterData.maxHp)}
            </Typography>
          </Box>

          {/* Stamina Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{
              fontSize: '7px',
              fontWeight: 'bold',
              
              color: theme.palette.success.text,
              minWidth: '18px'
            }}>
              ST
            </Typography>
            <Box sx={{
              flex: 1,
              height: 4,
              backgroundColor: apoColors.bgVeryDark,
              border: `1px solid ${apoColors.rustBorder}`,
              borderRadius: '0',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <Box sx={{
                height: '100%',
                width: `${Math.min((characterData.stamina / characterData.maxStamina) * 100, 100)}%`,
                backgroundColor: theme.palette.success.main,
                boxShadow: `0 0 4px ${theme.palette.success.main}80`,
                transition: 'width 0.8s ease-in-out'
              }} />
            </Box>
            <Typography sx={{
              fontSize: '7px',
              fontWeight: 'bold',
              
              color: apoColors.rust,
              minWidth: '32px',
              textAlign: 'right'
            }}>
              {Math.floor(characterData.stamina)}/{Math.floor(characterData.maxStamina)}
            </Typography>
          </Box>

{/* EXP Bar */}
<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
  <Typography sx={{
    fontSize: '7px',
    fontWeight: 'bold',
    
    color: theme.palette.warning.main,
    minWidth: '18px'
  }}>
    XP
  </Typography>
  <Box sx={{
    flex: 1,
    height: 4,
    backgroundColor: apoColors.bgVeryDark,
    border: `1px solid ${apoColors.rustBorder}`,
    borderRadius: '0',
    position: 'relative',
    overflow: 'hidden'
  }}>
    <Box sx={{
      height: '100%',
      width: `${expPercent}%`,
      backgroundColor: theme.palette.warning.main,
      boxShadow: `0 0 4px ${theme.palette.warning.main}80`,
      transition: 'width 0.8s ease-in-out'
    }} />
  </Box>
  <Typography sx={{
    fontSize: '7px',
    fontWeight: 'bold',
    
    color: apoColors.rust,
    minWidth: '22px',
    textAlign: 'right'
  }}>
    {expPercent}%
  </Typography>
</Box>
        </Box>
      )}
    </Box>

    {/* Lista graczy online. Wcześniej wisiała jako pływający przycisk nad
        treścią - zasłaniała nagłówki podstron, a po przeniesieniu na dół
        wchodziła na pasek edytora. W pasku ma swoje miejsce i nie koliduje
        z niczym. */}
    {onShowOnlineList && (
      <IconButton
        onClick={onShowOnlineList}
        aria-label="Pokaż listę graczy online"
        sx={{
          color: apoColors.rust,
          border: `1px solid ${apoColors.rustBorder}`,
          borderRadius: '0',
          flexShrink: 0,
          p: 0.75,
          '&:hover': {
            backgroundColor: apoColors.rust,
            color: apoColors.bgBlack
          }
        }}
      >
        <PeopleIcon sx={{ fontSize: 20 }} />
      </IconButton>
    )}

    <IconButton
      onClick={handleMenuOpen}
      aria-label="Otwórz menu nawigacji"
      sx={{
        color: apoColors.rust,
        border: `1px solid ${apoColors.rustBorder}`,
        borderRadius: '0',
        flexShrink: 0,
        p: 0.75,
        '&:hover': {
          backgroundColor: apoColors.rust,
          color: apoColors.bgBlack
        }
      }}
    >
      {/* Licznik na zwiniętym menu = te same źródła co kropka KOMUNIKACJA w topbarze
          (sesje prywatne, sesje ogólne, karczma, wiadomości). Karczma nie ma licznika,
          tylko flagę, więc liczy się jako jeden nieprzeczytany kanał.
          Z codziennika doliczamy WYŁĄCZNIE zaległe narracje - zaległe odpisy siedzą
          już w licznikach sesji, więc podwójnie by się liczyły, a narracja nie ma
          żadnego innego sygnału poza codziennikiem. */}
      <Badge
        color="error"
        badgeContent={messagesUnreadCount + privateSessionUnreadCount + generalSessionUnreadCount + (tavernUnread ? 1 : 0) + journalNarrationTodoCount}
      >
        <MenuIcon sx={{ fontSize: 20 }} />
      </Badge>
    </IconButton>
    
    <Menu 
      anchorEl={anchorEl} 
      open={menuOpen} 
      onClose={handleMenuClose} 
      PaperProps={{ 
        sx: { 
          backgroundColor: 'rgba(0, 0, 0, 0.98)', 
          border: `2px solid ${apoColors.rustBorder}`, 
          borderRadius: '0',
          minWidth: 200, 
          mt: 1, 
          backdropFilter: 'blur(20px)', 
          boxShadow: `0 8px 30px ${apoColors.bgVeryDark}` 
        } 
      }}
    >
      <MenuItem onClick={(e) => handleNavClick(`/home/profile/${characterId}`, e)} onContextMenu={(e) => handleNavContextMenu(`/home/profile/${characterId}`, e)} sx={menuItemStyle}>
        <ListItemText primary="Profil" />
      </MenuItem>
      
      <MenuItem onClick={(e) => handleNavClick('/home/statscard', e)} onContextMenu={(e) => handleNavContextMenu('/home/statscard', e)} sx={menuItemStyle}>
        <ListItemText primary="Statystyki" />
      </MenuItem>
      
      <MenuItem onClick={(e) => handleNavClick('/home/equipment', e)} onContextMenu={(e) => handleNavContextMenu('/home/equipment', e)} sx={menuItemStyle}>
        <ListItemText primary="Ekwipunek" />
      </MenuItem>

      <MenuItem onClick={(e) => handleNavClick('/home/city', e)} onContextMenu={(e) => handleNavContextMenu('/home/city', e)} sx={menuItemStyle}>
        <ListItemText primary="Miasto" />
      </MenuItem>

      <MenuItem onClick={(e) => handleNavClick('/home/notes', e)} onContextMenu={(e) => handleNavContextMenu('/home/notes', e)} sx={menuItemStyle}>
        <ListItemText primary="Notatki" />
      </MenuItem>

      {/* Logi bez badge'a - powiadomienia z logów są wyłączone (patrz useHudPolling) */}
      <MenuItem onClick={(e) => handleNavClick('/home/logs', e)} onContextMenu={(e) => handleNavContextMenu('/home/logs', e)} sx={menuItemStyle}>
        <ListItemText primary="Logi" />
      </MenuItem>
      <Divider sx={{ borderColor: apoColors.rustBorder, my: 0.5 }} />
      
      {/* Codziennik pierwszy w dziale - od niego zaczyna się „co mam dziś odpisać" */}
      <MenuItem onClick={(e) => handleNavClick('/home/journal', e)} onContextMenu={(e) => handleNavContextMenu('/home/journal', e)} sx={menuItemStyle}>
          <Badge color="error" badgeContent={journalTodoCount} sx={{ mr: 2 }}>
          </Badge>
        <ListItemText primary="Codziennik" />
      </MenuItem>

      <MenuItem onClick={(e) => handleNavClick('/home/messages', e)} onContextMenu={(e) => handleNavContextMenu('/home/messages', e)} sx={menuItemStyle}>
          <Badge color="error" badgeContent={messagesUnreadCount} sx={{ mr: 2 }}>
          </Badge>
        <ListItemText primary="Wiadomości" />
      </MenuItem>

      <MenuItem onClick={(e) => handleNavClick('/home/privateSessions', e)} onContextMenu={(e) => handleNavContextMenu('/home/privateSessions', e)} sx={menuItemStyle}>
          <Badge color="error" badgeContent={privateSessionUnreadCount} sx={{ mr: 2 }}>
          </Badge>
        <ListItemText primary="Sesje Prywatne" />
      </MenuItem>

      <MenuItem onClick={(e) => handleNavClick('/home/generalSessions', e)} onContextMenu={(e) => handleNavContextMenu('/home/generalSessions', e)} sx={menuItemStyle}>
          <Badge color="error" badgeContent={generalSessionUnreadCount} sx={{ mr: 2 }}>
          </Badge>
        <ListItemText primary="Sesje Ogólne" />
      </MenuItem>
      
      <MenuItem onClick={(e) => handleNavClick('/home/tavern', e)} onContextMenu={(e) => handleNavContextMenu('/home/tavern', e)} sx={menuItemStyle}>
          <Badge color="error" variant="dot" invisible={!tavernUnread} sx={{ mr: 2 }}>
          </Badge>
        <ListItemText primary="Karczma" />
      </MenuItem>
      
      <Divider sx={{ borderColor: apoColors.rustBorder, my: 0.5 }} />
      
      <MenuItem onClick={() => setShowRaces((prev) => !prev)} sx={menuItemStyle}>
        <ListItemText primary="Rasy" />
      </MenuItem>
      <Collapse in={showRaces}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, ml: 0.5 }}>
          {races.map((race) => (
            <MenuItem key={race.key} onClick={(e) => handleNavClick(`/home/${race.key}`, e)} onContextMenu={(e) => handleNavContextMenu(`/home/${race.key}`, e)} sx={menuItemStyle}>
              <ListItemText primary={race.name} sx={{ pl: 2 }} />
            </MenuItem>
          ))}
        </Box>
      </Collapse>

      <MenuItem onClick={() => setShowGuides((prev) => !prev)} sx={menuItemStyle}>
        <ListItemText primary="Poradniki" />
      </MenuItem>
      <Collapse in={showGuides}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, ml: 0.5 }}>
          <MenuItem onClick={(e) => handleNavClick('/home/infopanel', e)} onContextMenu={(e) => handleNavContextMenu('/home/infopanel', e)} sx={menuItemStyle}>
            <ListItemText primary="Lokacje" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/infopanel2', e)} onContextMenu={(e) => handleNavContextMenu('/home/infopanel2', e)} sx={menuItemStyle}>
            <ListItemText primary="Informacje" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/law', e)} onContextMenu={(e) => handleNavContextMenu('/home/law', e)} sx={menuItemStyle}>
            <ListItemText primary="Prawo" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/bestiary', e)} onContextMenu={(e) => handleNavContextMenu('/home/bestiary', e)} sx={menuItemStyle}>
            <ListItemText primary="Zwierzęta" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/mechanics', e)} onContextMenu={(e) => handleNavContextMenu('/home/mechanics', e)} sx={menuItemStyle}>
            <ListItemText primary="Mechanika" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/technology', e)} onContextMenu={(e) => handleNavContextMenu('/home/technology', e)} sx={menuItemStyle}>
            <ListItemText primary="Technologia" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/alchemy-guide', e)} onContextMenu={(e) => handleNavContextMenu('/home/alchemy-guide', e)} sx={menuItemStyle}>
            <ListItemText primary="Alchemia" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/history', e)} onContextMenu={(e) => handleNavContextMenu('/home/history', e)} sx={menuItemStyle}>
            <ListItemText primary="Historia" sx={{ pl: 2 }} />
          </MenuItem>
          <MenuItem onClick={(e) => handleNavClick('/home/npc', e)} onContextMenu={(e) => handleNavContextMenu('/home/npc', e)} sx={menuItemStyle}>
            <ListItemText primary="NPC" sx={{ pl: 2 }} />
          </MenuItem>
        </Box>
      </Collapse>

      <Divider sx={{ borderColor: apoColors.rustBorder, my: 0.5 }} />
      
      <MenuItem onClick={(e) => handleNavClick('/home/players', e)} onContextMenu={(e) => handleNavContextMenu('/home/players', e)} sx={menuItemStyle}>
        <ListItemText primary="Lista Graczy" />
      </MenuItem>
      <MenuItem onClick={(e) => handleNavClick('/home/rules', e)} onContextMenu={(e) => handleNavContextMenu('/home/rules', e)} sx={menuItemStyle}>
        <ListItemText primary="Regulamin" />
      </MenuItem>
      <MenuItem onClick={(e) => handleNavClick('/lobby', e)} onContextMenu={(e) => handleNavContextMenu('/home/lobby', e)} sx={menuItemStyle}>
        <ListItemText primary="Lobby" />
      </MenuItem>
      <MenuItem onClick={(e) => handleNavClick('/home/settings', e)} onContextMenu={(e) => handleNavContextMenu('/home/settings', e)} sx={menuItemStyle}>
        <ListItemText primary="Ustawienia" />
      </MenuItem>
      <MenuItem onClick={(e) => handleNavClick('/logout', e)} onContextMenu={(e) => handleNavContextMenu('/logout', e)} sx={logoutMenuItemStyle}>
        <ListItemText primary="Wyloguj" />
      </MenuItem>
    </Menu>
  </Box>
);
  }
  
  if (isDesktop) {
    const handleButtonClick = (path, e) => { 
      e.preventDefault(); 
      if (e.ctrlKey || e.metaKey || e.button === 1) { 
        window.open(path, '_blank'); 
      } else { 
        navigate(path); 
      } 
    };
    const handleButtonContextMenu = (path, e) => { 
      e.preventDefault(); 
      window.open(path, '_blank'); 
    };

    return (
      <Box
        ref={sidebarRef}
        sx={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          '&::-webkit-scrollbar': {
            width: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: apoColors.bgMedium,
            borderRadius: '0'
          },
          '&::-webkit-scrollbar-thumb': {
            background: apoColors.rust,
            borderRadius: '0',
            border: `1px solid ${apoColors.rustBorder}`,
            '&:hover': {
              background: apoColors.rustLight
            }
          }
        }}
      >
        {/* PROFIL GRACZA */}
        <Box sx={{
          backgroundColor: 'transparent',
          p: 1,
          pb: 1.5,
          borderBottom: `1px solid ${apoColors.rustBorder}`
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1.5 }}>
            <Avatar
              src={characterData.avatar ? `/api${characterData.avatar}` : '/default-avatar.png'}
              alt={characterData.nickname}
              sx={{
                width: 150,
                height: 200,
                mb: 1.5,
                background: apoColors.bgDark,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                borderRadius: '0',
                
                fontWeight: 'bold',
                fontSize: '56px',
                color: apoColors.textGray,
                '&:hover': {
                  transform: 'scale(1.02)',
                  boxShadow: `0 8px 25px ${apoColors.rustBorder}`
                }
              }}
              onClick={(e) => handleButtonClick(`/home/profile/${characterId}`, e)}
              onContextMenu={(e) => handleButtonContextMenu(`/home/profile/${characterId}`, e)}
              onAuxClick={(e) => e.button === 1 && handleButtonClick(`/home/profile/${characterId}`, e)}
              role="button"
              tabIndex={0}
              aria-label="Otwórz profil postaci"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleButtonClick(`/home/profile/${characterId}`, e); } }}
            >
              {!characterData.avatar && username && username[0]}
            </Avatar>
            <Typography sx={{
              color: apoColors.rust,
              
              fontWeight: 'bold',
              fontSize: '14px',
              textAlign: 'center',
              textShadow: `0 0 10px ${apoColors.rustBorder}`,
              mb: 0.3,
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              {loadingUsername ? 'Ładowanie...' : username}
            </Typography>
            <Typography sx={{
              color: apoColors.textGray,
              
              fontWeight: 'bold',
              fontSize: '12px',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Poziom {characterData.level}
            </Typography>
            {/* Złoto postaci - pod poziomem, w złotym kolorze z ikonką monety */}
            <Typography sx={{
              color: '#e8c15a',
              fontWeight: 'bold',
              fontSize: '13px',
              textAlign: 'center',
              letterSpacing: '0.03em',
              mt: 0.3,
              textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              🪙 {Number(characterData.gold || 0).toLocaleString('pl-PL')}
            </Typography>
          </Box>
          {!loadingCharacter && (
            <Box>
              <StatBar label="HP" current={characterData.hp} max={characterData.maxHp} color={theme.palette.error.main} showValues={true} />
              <StatBar label="Stamina" current={characterData.stamina} max={characterData.maxStamina} color={theme.palette.success.main} showValues={true} />
<StatBar
  label="EXP"
  current={expInCurrentLevel}
  max={expToNextLevel}
  color={theme.palette.warning.main}
  icon={<StarIcon sx={{ fontSize: 12, color: theme.palette.warning.main }} />}
/>
            </Box>
          )}
        </Box>

        {/* TRYB KARCZMY */}
        {isTavernPage ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {/* Grid 2x2 dla nawigacji (+ Codziennik na całą szerokość) */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.3 }}>
              <Badge
                badgeContent={journalTodoCount}
                color="error"
                sx={{ gridColumn: '1 / -1', '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, width: '100%', fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/journal', e)} onContextMenu={(e) => handleButtonContextMenu('/home/journal', e)}>
                  Codziennik
                </Button>
              </Badge>

              <Badge
                badgeContent={messagesUnreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/messages', e)} onContextMenu={(e) => handleButtonContextMenu('/home/messages', e)}>
                  Wiadomości
                </Button>
              </Badge>

              <Badge
                badgeContent={privateSessionUnreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/privateSessions', e)} onContextMenu={(e) => handleButtonContextMenu('/home/privateSessions', e)}>
                  Sesje Prywatne
                </Button>
              </Badge>

              <Badge
                badgeContent={generalSessionUnreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/generalSessions', e)} onContextMenu={(e) => handleButtonContextMenu('/home/generalSessions', e)}>
                  Sesje Ogólne
                </Button>
              </Badge>

              <Badge
                color="error"
                variant="dot"
                invisible={!tavernUnread}
                sx={{ '& .MuiBadge-dot': { right: 4, top: 4 } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/tavern', e)} onContextMenu={(e) => handleButtonContextMenu('/home/tavern', e)}>
                  Karczma
                </Button>
              </Badge>
            </Box>

            {/* Miasto i Profil */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.3 }}>
              <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/city', e)} onContextMenu={(e) => handleButtonContextMenu('/home/city', e)}>
                Miasto
              </Button>
              <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick(`/home/profile/${characterId}`, e)} onContextMenu={(e) => handleButtonContextMenu(`/home/profile/${characterId}`, e)}>
                Profil
              </Button>
            </Box>

            {/* Przyciski karczmy */}
            <Button
              variant="contained"
              sx={{
                ...mainButtonStyle,
                backgroundColor: apoColors.bgMedium,
                '&:hover': {
                  backgroundColor: apoColors.rustDark,
                  color: apoColors.textLight
                }
              }}
              onClick={() => window.dispatchEvent(new CustomEvent('tavernShowRoomSelector'))}
            >
              Zmień pokój
            </Button>

            <Button
              variant="contained"
              sx={{
                ...mainButtonStyle,
                backgroundColor: apoColors.error,
                '&:hover': {
                  backgroundColor: apoColors.errorHover,
                  color: apoColors.textLight
                }
              }}
              onClick={() => window.dispatchEvent(new CustomEvent('tavernLeaveTavern'))}
            >
              Wyjdź z karczmy
            </Button>
          </Box>
        ) : (
          /* NORMALNA NAWIGACJA - gdy NIE w karczmie */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>

            {/* POSTAĆ */}
            <Typography sx={{
              color: apoColors.rust,
              
              fontWeight: 'bold',
              fontSize: '10px',
              px: 0.5,
              py: 0.3,
              mb: 0.3,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              borderBottom: `1px solid ${apoColors.rustBorder}`
            }}>
              Postać
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mb: 1 }}>
              <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick(`/home/profile/${characterId}`, e)} onContextMenu={(e) => handleButtonContextMenu(`/home/profile/${characterId}`, e)} onAuxClick={(e) => e.button === 1 && handleButtonClick(`/home/profile/${characterId}`, e)}>
                Profil
              </Button>
              <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/statscard', e)} onContextMenu={(e) => handleButtonContextMenu('/home/statscard', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/statscard', e)}>
                Statystyki
              </Button>
              <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/equipment', e)} onContextMenu={(e) => handleButtonContextMenu('/home/equipment', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/equipment', e)}>
                Ekwipunek
              </Button>
            </Box>

            {/* ŚWIAT */}
            <Typography sx={{
              color: apoColors.rust,
              
              fontWeight: 'bold',
              fontSize: '10px',
              px: 0.5,
              py: 0.3,
              mb: 0.3,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              borderBottom: `1px solid ${apoColors.rustBorder}`
            }}>
              Świat
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mb: 1 }}>
              <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/city', e)} onContextMenu={(e) => handleButtonContextMenu('/home/city', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/city', e)}>
                Miasto
              </Button>
              <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/notes', e)} onContextMenu={(e) => handleButtonContextMenu('/home/notes', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/notes', e)}>
                Notatki
              </Button>
              {/* Logi bez badge'a - powiadomienia z logów są wyłączone (patrz useHudPolling) */}
              <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/logs', e)} onContextMenu={(e) => handleButtonContextMenu('/home/logs', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/logs', e)}>
                Logs
              </Button>
            </Box>

            {/* KOMUNIKACJA */}
            <Typography sx={{
              color: apoColors.rust,
              
              fontWeight: 'bold',
              fontSize: '10px',
              px: 0.5,
              py: 0.3,
              mb: 0.3,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              borderBottom: `1px solid ${apoColors.rustBorder}`
            }}>
              Komunikacja
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.3, mb: 1 }}>
              {/* Codziennik na całą szerokość nad siatką - to wejście do listy
                  "gdzie muszę odpisać", a licznik pokazuje zaległe odpisy. */}
              <Badge
                badgeContent={journalTodoCount}
                color="error"
                sx={{ gridColumn: '1 / -1', '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, width: '100%', fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/journal', e)} onContextMenu={(e) => handleButtonContextMenu('/home/journal', e)}>
                  Codziennik
                </Button>
              </Badge>

              <Badge
                badgeContent={messagesUnreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/messages', e)} onContextMenu={(e) => handleButtonContextMenu('/home/messages', e)}>
                  Wiadomości
                </Button>
              </Badge>

              <Badge
                badgeContent={privateSessionUnreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/privateSessions', e)} onContextMenu={(e) => handleButtonContextMenu('/home/privateSessions', e)}>
                  Sesje Prywatne
                </Button>
              </Badge>

              <Badge
                badgeContent={generalSessionUnreadCount}
                color="error"
                sx={{ '& .MuiBadge-badge': { right: 4, top: 4, fontSize: '10px', minWidth: '16px', height: '16px' } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/generalSessions', e)} onContextMenu={(e) => handleButtonContextMenu('/home/generalSessions', e)}>
                  Sesje Ogólne
                </Button>
              </Badge>

              <Badge
                color="error"
                variant="dot"
                invisible={!tavernUnread}
                sx={{ '& .MuiBadge-dot': { right: 4, top: 4 } }}
              >
                <Button variant="contained" sx={{ ...mainButtonStyle, fontSize: '9px', py: 0.6 }} onClick={(e) => handleButtonClick('/home/tavern', e)} onContextMenu={(e) => handleButtonContextMenu('/home/tavern', e)}>
                  Karczma
                </Button>
              </Badge>
            </Box>

            {/* WIĘCEJ (collapsed) */}
            <Button
              variant="contained"
              onClick={() => setShowMore((prev) => !prev)}
              sx={{
                ...mainButtonStyle,
                justifyContent: 'space-between',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                WIĘCEJ
              </Box>
              {showMore ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </Button>

            <Collapse in={showMore}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mb: 1, mt: 0.3 }}>
                <Button variant="contained" onClick={() => setShowRaces((prev) => !prev)} sx={mainButtonStyle}>
                  {showRaces ? '▼' : '▶'} Rasy
                </Button>
                <Collapse in={showRaces}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, mt: 0.3, ml: 1.5 }}>
                    {races.map((race) => (
                      <Button key={race.key} variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick(`/home/${race.key}`, e)} onContextMenu={(e) => handleButtonContextMenu(`/home/${race.key}`, e)} onAuxClick={(e) => e.button === 1 && handleButtonClick(`/home/${race.key}`, e)}>
                        {race.name}
                      </Button>
                    ))}
                  </Box>
                </Collapse>

                <Button variant="contained" onClick={() => setShowGuides((prev) => !prev)} sx={mainButtonStyle}>
                  {showGuides ? '▼' : '▶'} Poradniki
                </Button>
                <Collapse in={showGuides}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, mt: 0.3, ml: 1.5 }}>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/infopanel', e)} onContextMenu={(e) => handleButtonContextMenu('/home/infopanel', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/infopanel', e)}>
                      Lokacje
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/infopanel2', e)} onContextMenu={(e) => handleButtonContextMenu('/home/infopanel2', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/infopanel2', e)}>
                      Informacje
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/law', e)} onContextMenu={(e) => handleButtonContextMenu('/home/law', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/law', e)}>
                      Prawo
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/bestiary', e)} onContextMenu={(e) => handleButtonContextMenu('/home/bestiary', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/bestiary', e)}>
                      Zwierzęta
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/mechanics', e)} onContextMenu={(e) => handleButtonContextMenu('/home/mechanics', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/mechanics', e)}>
                      Mechanika
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/technology', e)} onContextMenu={(e) => handleButtonContextMenu('/home/technology', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/technology', e)}>
                      Technologia
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/alchemy-guide', e)} onContextMenu={(e) => handleButtonContextMenu('/home/alchemy-guide', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/alchemy-guide', e)}>
                      Alchemia
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/history', e)} onContextMenu={(e) => handleButtonContextMenu('/home/history', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/history', e)}>
                      Historia
                    </Button>
                    <Button variant="contained" sx={subButtonStyle} onClick={(e) => handleButtonClick('/home/npc', e)} onContextMenu={(e) => handleButtonContextMenu('/home/npc', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/npc', e)}>
                      NPC
                    </Button>
                  </Box>
                </Collapse>

                <Divider sx={{ my: 0.3, borderColor: apoColors.rustBorder }} />

                <Button variant="contained" sx={mainButtonStyle} onClick={() => window.open('[LINK_DO_WIKI]', '_blank')}>
                  Wiki
                </Button>
                <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/players', e)} onContextMenu={(e) => handleButtonContextMenu('/home/players', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/players', e)}>
                  Lista Graczy
                </Button>
                <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/rules', e)} onContextMenu={(e) => handleButtonContextMenu('/home/rules', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/rules', e)}>
                  Regulamin
                </Button>
              </Box>
            </Collapse>

            {/* USTAWIENIA */}
            <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/home/settings', e)} onContextMenu={(e) => handleButtonContextMenu('/home/settings', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/home/settings', e)}>
              Ustawienia
            </Button>

            {/* LOBBY */}
            <Button variant="contained" sx={mainButtonStyle} onClick={(e) => handleButtonClick('/lobby', e)} onContextMenu={(e) => handleButtonContextMenu('/lobby', e)} onAuxClick={(e) => e.button === 1 && handleButtonClick('/lobby', e)}>
              Lobby
            </Button>
            
            <Button
              variant="contained"
              sx={{
                ...mainButtonStyle,
                backgroundColor: apoColors.error,
                mt: 0.5,
                '&:hover': {
                  backgroundColor: apoColors.errorHover,
                  color: apoColors.textLight,
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px rgba(155, 44, 44, 0.4)`
                }
              }} 
              onClick={(e) => handleButtonClick('/logout', e)} 
              onContextMenu={(e) => handleButtonContextMenu('/logout', e)} 
              onAuxClick={(e) => e.button === 1 && handleButtonClick('/logout', e)}
            >
              Wyloguj
            </Button>
          </Box>
        )}


        {/* POKOJE Z UCZESTNIKAMI - zawsze pokazuj podział na pokoje gdy jesteśmy w tavern */}
        {isTavernPage && tavernRoomsWithParticipants.length > 0 && (
          <Box sx={boxParticipantStyle}>
            <Box sx={boxTitleStyle}>🍺 Uczestnicy karczmy</Box>
            {tavernRoomsWithParticipants.map(room => {
              const isCurrentRoom = currentTavernRoom && currentTavernRoom.id === room.id;

              return (
                <Box key={room.id} sx={{ mb: 2 }}>
                  {/* Nazwa pokoju - podświetlona jeśli to aktualny pokój użytkownika */}
                  <Box sx={{
                    color: isCurrentRoom ? apoColors.rust : apoColors.rustLight,
                    
                    fontWeight: 'bold',
                    fontSize: '11px',
                    mb: 0.5,
                    px: 1,
                    py: 0.5,
                    backgroundColor: isCurrentRoom ? apoColors.rustDark : apoColors.bgMedium,
                    border: `1px solid ${isCurrentRoom ? apoColors.rustLight : apoColors.rustBorder}`,
                    borderRadius: '0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: isCurrentRoom ? `0 0 10px ${apoColors.rustBorder}` : 'none',
                    transition: 'all 0.3s ease'
                  }}>
                    <span>{isCurrentRoom ? `▶ ${room.name}` : room.name}</span>
                    <Box sx={{
                      fontSize: '10px',
                      color: isCurrentRoom ? apoColors.rust : apoColors.textGray,
                      backgroundColor: apoColors.bgDark,
                      px: 0.75,
                      py: 0.25,
                      border: `1px solid ${isCurrentRoom ? apoColors.rustLight : apoColors.rustBorder}`,
                      borderRadius: '0',
                      fontWeight: isCurrentRoom ? 'bold' : 'normal'
                    }}>
                      {room.participantCount}
                    </Box>
                  </Box>

                  {/* Lista uczestników pokoju */}
                  {room.participants.length > 0 ? (
                    <ParticipantList participants={room.participants} onUserClick={handleProfileClick} races={races} />
                  ) : (
                    <Box sx={{
                      color: apoColors.textGray,
                      fontSize: '10px',
                      textAlign: 'center',
                      fontStyle: 'italic',
                      
                      py: 0.5,
                      px: 1,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Pusty pokój
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    );
  }

  return null;
}

export default Sidebar;