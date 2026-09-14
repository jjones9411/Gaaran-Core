import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Avatar,
  Tooltip,
  Box,
  Stack,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Skeleton,
  Collapse,
  Select,
  FormControl,
  Alert,
  Paper,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Sort as SortIcon,
  WifiOff as OfflineIcon,
  Wifi as WifiIcon,
  WbSunny as SunnyIcon,
  NightsStay as MoonIcon,
  Cloud as CloudIcon,
  Opacity as RainIcon,
  AcUnit as SnowIcon,
  Thunderstorm as ThunderstormIcon,
  Warning as WarningIcon,
  Dangerous as DangerousIcon,
  Air as AirIcon,
} from '@mui/icons-material';
import { debounce } from 'lodash';
import toast from 'react-hot-toast';
import GameToaster from './GameToaster';
import { useTheme } from '@mui/material/styles';
import { getPlayStyle } from './playStyle';
import { getRaceColorSet } from './theme';
import useRaceColor from './useRaceColor';
import RoleBadge from './RoleBadge';
import { getMoonPhase } from './moonPhase';

// Constants
const REFRESH_INTERVAL = 15000;
const WEATHER_REFRESH_INTERVAL = 300000;
const MAX_NICKNAME_LENGTH = 15;
const TOOLTIP_DELAY = 500;
const SEARCH_DEBOUNCE_MS = 300;

// Weather definitions
const WEATHER_CONDITIONS = {
    sunny: { label: 'Słonecznie', icon: SunnyIcon, danger: 0 },
    clear_night: { label: 'Bezchmurna noc', icon: MoonIcon, danger: 0 },
    cloudy: { label: 'Pochmurno', icon: CloudIcon, danger: 0 },
    rainy: { label: 'Deszcz', icon: RainIcon, danger: 1 },
    snowy: { label: 'Śnieg', icon: SnowIcon, danger: 1 },
    light_fog: { label: 'Lekka mgła', icon: CloudIcon, danger: 1 },
    heavy_fog: { label: 'Gęsta mgła', icon: CloudIcon, danger: 2 },
    thunderstorm: { label: 'Burza z piorunami', icon: ThunderstormIcon, danger: 2 },
    hailstorm: { label: 'Grad', icon: SnowIcon, danger: 2 },
    blizzard: { label: 'Śnieżyca', icon: SnowIcon, danger: 3 },
    windstorm: { label: 'Wichura', icon: AirIcon, danger: 2 },
    heatwave: { label: 'Upał', icon: SunnyIcon, danger: 1 },
    dust_storm: { label: 'Burza pyłowa', icon: AirIcon, danger: 3 }
};

const MONTH_NAMES = [
    'Stycznia', 'Lutego', 'Marca', 'Kwietnia', 'Maja', 'Czerwca',
    'Lipca', 'Sierpnia', 'Września', 'Października', 'Listopada', 'Grudnia'
];

const SEASON_NAMES = {
    winter: 'Zima',
    spring: 'Wiosna',
    summer: 'Lato',
    autumn: 'Jesień'
};

const STATUS_OPTIONS = {
  looking: {
    label: '🟢 Szukam sesji',
    color: '#4caf50',
    description: 'Szukam sesji',
  },
  maybe: {
    label: '🟡 Może coś wyjątkowego',
    color: '#ff9800',
    description: 'Niekoniecznie, ale coś wyjątkowego wezmę',
  },
  not_looking: {
    label: '🔴 Nie szukam sesji',
    color: '#f44336',
    description: 'Obecnie nie szukam sesji',
  },
  now_not_looking: {
    label: '🔵 Przerwa od fabuły',
    color: '#2196f3',
    description: 'Aktualnie robię przerwę od fabularnych sesji',
  },
};

const SORT_OPTIONS = {
    status: { label: 'Status', field: 'status' },
    name: { label: 'Nazwa', field: 'user' },
    level: { label: 'Poziom', field: 'level' },
    id: { label: 'ID', field: 'id' }
};

// Utility functions
const isValidPlayer = (player) => {
    return (
        player &&
        player.id &&
        player.user &&
        typeof player.user === 'string' &&
        player.user !== 'Nowa Postać' &&
        player.user !== '' &&
        player.race &&
        player.race !== 'Brak' &&
        player.race !== '' &&
        player.gender &&
        player.gender !== 'Brak' &&
        player.gender !== ''
    );
};

// Klucz rasy -> czytelna nazwa. Funkcja MODUŁOWA, bo potrzebują jej dwa różne
// miejsca: wiersz gracza (PlayerListItem) i filtr wyszukiwania w OnlineList.
// Wcześniej istniała tylko lokalnie w PlayerListItem, a filtr i tak ją wołał -
// przy pierwszym wpisanym znaku leciał ReferenceError i lista się wywalała.
const resolveRaceName = (key, races = []) => {
    const race = Array.isArray(races) ? races.find((r) => r.key === key) : null;
    return race?.name || key || '-';
};

const truncateNickname = (nick, maxLength = MAX_NICKNAME_LENGTH) => {
    if (!nick || typeof nick !== 'string') return 'Nieznany';
    return nick.length > maxLength ? nick.substring(0, maxLength) + '...' : nick;
};


const getSeason = (month) => {
    if ([12, 1, 2].includes(month)) return 'winter';
    if ([3, 4, 5].includes(month)) return 'spring';
    if ([6, 7, 8].includes(month)) return 'summer';
    return 'autumn';
};

const getDangerIcon = (danger, theme) => {
    if (danger >= 4) return <DangerousIcon sx={{ fontSize: 14, color: '#9b2c2c' }} />;
    if (danger >= 3) return <WarningIcon sx={{ fontSize: 14, color: '#d97706' }} />;
    return null;
};

const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            setStoredValue(value);
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }, [key]);

    return [storedValue, setValue];
};

// ================================
// GAME TIME HEADER COMPONENT
// ================================
const GameTimeHeader = React.memo(({ gameTime, weather, onRefresh, isRefreshing, raceCombat }) => {
    const theme = useTheme();
    
    if (!gameTime || !weather) {
        return (
            <Paper sx={{ 
                p: 1.5, 
                mb: 1, 
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: '0',
                backdropFilter: 'blur(10px)'
            }}>
                <Stack spacing={0.5}>
                    <Skeleton variant="text" width="60%" height={24} sx={{ bgcolor: theme.palette.divider }} />
                    <Skeleton variant="text" width="40%" height={16} sx={{ bgcolor: theme.palette.divider }} />
                </Stack>
            </Paper>
        );
    }

    const weatherData = WEATHER_CONDITIONS[weather.type] || WEATHER_CONDITIONS.cloudy;
    const WeatherIcon = weatherData.icon;
    
    const dateString = `${gameTime.day} ${MONTH_NAMES[gameTime.month - 1]} ${gameTime.year}`;
    const timeString = `${String(gameTime.hour).padStart(2, '0')}:${String(gameTime.minute).padStart(2, '0')}`;
    
    const season = getSeason(gameTime.month);
    const seasonName = SEASON_NAMES[season];
    const dangerIcon = getDangerIcon(weather.danger, theme);

    // Faza dnia: noc od 20:00 do 6:00 (spójne z backendem gamePhase.js).
    // Wpływa na modyfikatory walki ras - dlatego pokazujemy ją przy zegarze.
    const isNight = gameTime.hour >= 20 || gameTime.hour < 6;
    const PhaseIcon = isNight ? MoonIcon : SunnyIcon;
    const phaseLabel = isNight ? 'NOC' : 'DZIEŃ';
    const phaseColor = isNight ? theme.palette.info.light : theme.palette.warning.main;

    // Faza księżyca - wyliczana z daty świata (miesiące 30-dniowe, cykl 30 dni).
    const moon = getMoonPhase(gameTime.year, gameTime.month, gameTime.day);

    return (
        <Paper sx={{
            p: 1.5,
            mb: 1,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: theme.palette.background.paper,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: '0',
            backdropFilter: 'blur(10px)',
            boxShadow: `0 4px 15px ${theme.palette.primary.main}20`
        }}>
            <Stack spacing={0.5} sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        {/* Data + godzina w jednej linii (bez ikonki kalendarza) */}
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                            <Typography sx={{
                                fontSize: 13,
                                fontWeight: 'bold',
                                color: theme.palette.primary.main,
                                lineHeight: 1.2,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                textShadow: `0 0 10px ${theme.palette.primary.main}60`
                            }}>
                                {dateString}
                            </Typography>
                            <Typography sx={{
                                fontSize: 16,
                                fontWeight: 'bold',
                                color: theme.palette.text.primary,
                                letterSpacing: 1,
                            }}>
                                {timeString}
                            </Typography>
                        </Box>
                        {/* Pora roku + pora dnia w jednej linii (bez ikon) */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Chip
                                label={seasonName}
                                size="small"
                                sx={{
                                    height: 16,
                                    fontSize: 9,
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    backgroundColor: `${theme.palette.primary.main}30`,
                                    color: theme.palette.primary.main,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: '0'
                                }}
                            />
                            <Chip
                                label={phaseLabel}
                                size="small"
                                sx={{
                                    height: 16,
                                    fontSize: 9,
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    backgroundColor: `${phaseColor}22`,
                                    color: phaseColor,
                                    border: `1px solid ${phaseColor}66`,
                                    borderRadius: '0',
                                    '& .MuiChip-label': { px: 0.75 }
                                }}
                            />
                        </Box>
                    </Box>
                    {/* Przycisk odświeżania pogody usunięty - chował się pod ozdobną ramką panelu. */}
                </Box>

                {/* Faza księżyca - nad linią pogody, stonowana */}
                <Tooltip
                    title={`${moon.name} — ${Math.round(moon.illumination * 100)}% oświetlenia tarczy`}
                    arrow
                    placement="bottom"
                    componentsProps={{
                        tooltip: {
                            sx: {
                                backgroundColor: theme.palette.background.paper,
                                border: `2px solid ${theme.palette.divider}`,
                                borderRadius: '0',
                                backdropFilter: 'blur(20px)',
                                color: theme.palette.text.primary,
                                }
                        },
                        arrow: { sx: { color: theme.palette.text.secondary } }
                    }}
                >
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        p: 0.75,
                        borderRadius: '0',
                        bgcolor: theme.palette.background.default,
                        border: `1px solid ${theme.palette.divider}`,
                        cursor: 'help',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            bgcolor: `${theme.palette.info.light}18`,
                            borderColor: `${theme.palette.info.light}66`,
                        }
                    }}>
                        <Box component="span" sx={{ fontSize: 16, lineHeight: 1 }}>{moon.emoji}</Box>
                        <Typography sx={{
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: theme.palette.info.light,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            
                        }}>
                            {moon.name}
                        </Typography>
                    </Box>
                </Tooltip>

                <Tooltip
                    title={
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography sx={{ fontWeight: 'bold', mb: 0.5, }}>
                                {weather.label}
                            </Typography>
                            <Typography sx={{ fontSize: 11, }}>
                                {weather.description}
                            </Typography>
                            {weather.danger >= 2 && (
                                <Typography sx={{ 
                                    fontSize: 10, 
                                    color: theme.palette.warning.main, 
                                    mt: 0.5,
                                    
                                    textTransform: 'uppercase'
                                }}>
                                    ⚠️ NIEBEZPIECZNIE!
                                </Typography>
                            )}
                        </Box>
                    }
                    arrow
                    placement="bottom"
                    componentsProps={{
                        tooltip: {
                            sx: {
                                backgroundColor: theme.palette.background.paper,
                                border: `2px solid ${theme.palette.divider}`,
                                borderRadius: '0',
                                backdropFilter: 'blur(20px)',
                                color: theme.palette.text.primary
                            }
                        },
                        arrow: {
                            sx: {
                                color: theme.palette.text.secondary
                            }
                        }
                    }}
                >
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        p: 0.75,
                        borderRadius: '0',
                        bgcolor: theme.palette.background.default,
                        border: `1px solid ${theme.palette.divider}`,
                        cursor: 'help',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            bgcolor: `${theme.palette.primary.main}20`,
                            borderColor: theme.palette.primary.main,
                        }
                    }}>
                        <WeatherIcon sx={{ 
                            color: theme.palette.primary.main, 
                            fontSize: 18
                        }} />
                        <Typography sx={{
                            fontSize: 11,
                            fontWeight: 'bold',
                            color: theme.palette.primary.main,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            
                            textShadow: `0 0 10px ${theme.palette.primary.main}60`
                        }}>
                            {weather.emoji} {weather.label}
                        </Typography>
                        {dangerIcon && (
                            <Box sx={{ ml: 'auto' }}>
                                {dangerIcon}
                            </Box>
                        )}
                    </Box>
                </Tooltip>

                {/* Wpływ pory dnia na TWOJĄ rasę (mechanika dzień/noc) */}
                {raceCombat && (() => {
                    const pct = isNight ? raceCombat.nightPct : raceCombat.dayPct;
                    if (!pct) return null;
                    const positive = pct > 0;
                    return (
                        <Tooltip
                            arrow
                            title={`Modyfikator walki Twojej rasy zależny od pory doby. Noc: 20:00–5:59, dzień: 6:00–19:59. Wartość zmienia siłę Twojego ataku i obrony w bieżącej porze — np. wampiry słabną w dzień, a nocą odzyskują przewagę.`}
                        >
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            p: 0.5,
                            borderRadius: '0',
                            cursor: 'help',
                            bgcolor: theme.palette.background.default,
                            border: `1px solid ${positive ? theme.palette.success.main : theme.palette.error.main}55`,
                        }}>
                            <PhaseIcon sx={{ fontSize: 13, color: phaseColor }} />
                            <Typography sx={{
                                fontSize: 10,
                                fontWeight: 'bold',
                                
                                textTransform: 'uppercase',
                                letterSpacing: 0.3,
                                color: theme.palette.text.secondary,
                            }}>
                                {raceCombat.name}:&nbsp;
                                <Box component="span" sx={{ color: positive ? theme.palette.success.main : theme.palette.error.main }}>
                                    {positive ? '+' : ''}{pct}% w walce
                                </Box>
                                &nbsp;({isNight ? 'noc' : 'dzień'})
                            </Typography>
                        </Box>
                        </Tooltip>
                    );
                })()}
            </Stack>
        </Paper>
    );
});

// ================================
// PLAYER STATUS INDICATOR
// ================================
const PlayerStatusIndicator = React.memo(({ status, size = 'small' }) => {
    const theme = useTheme();
    const statusData = STATUS_OPTIONS[status] || STATUS_OPTIONS['not_looking'];
    const indicatorSize = size === 'small' ? 10 : 12;

    const statusColorMap = {
        'looking': theme.palette.success.main,
        'maybe': theme.palette.warning.main,
        'not_looking': theme.palette.error.main
    };

    const statusColor = statusColorMap[status] || theme.palette.text.secondary;

    return (
        <Box
            sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: indicatorSize,
                height: indicatorSize,
                borderRadius: '0',
                backgroundColor: statusColor,
                border: '2px solid rgba(0, 0, 0, 0.9)',
                boxShadow: `0 0 10px ${statusColor}90`,
                zIndex: 1
            }}
        />
    );
});

// ================================
// SKELETON LOADER
// ================================
const OnlineListSkeleton = React.memo(() => {
    const theme = useTheme();
    
    return (
        <Stack spacing={0} sx={{ p: 0.5 }}>
            {Array.from({ length: 4 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Skeleton variant="rectangular" width={28} height={28} sx={{ bgcolor: theme.palette.divider, borderRadius: '0' }} />
                    <Box sx={{ flexGrow: 1 }}>
                        <Skeleton variant="text" width="50%" height={14} sx={{ mb: 0.25, bgcolor: theme.palette.divider }} />
                        <Skeleton variant="text" width="30%" height={10} sx={{ bgcolor: theme.palette.divider }} />
                    </Box>
                    <Skeleton variant="rectangular" width={30} height={16} sx={{ bgcolor: theme.palette.divider, borderRadius: '0' }} />
                </Box>
            ))}
        </Stack>
    );
});

// ================================
// PLAYER LIST ITEM
// ================================
const PlayerListItem = React.memo(({
    player,
    onProfileClick,
    compact = false,
    races = [],
    open = false,
    onOpen,
    onClose
}) => {
    const theme = useTheme();
    const statusData = STATUS_OPTIONS[player.status] || STATUS_OPTIONS['not_looking'];
    
    const statusColorMap = {
        'looking': theme.palette.success.main,
        'maybe': theme.palette.warning.main,
        'not_looking': theme.palette.error.main
    };
    
    const statusColor = statusColorMap[player.status] || theme.palette.text.secondary;

    return (
        <Tooltip
            arrow
            enterDelay={TOOLTIP_DELAY}
            leaveDelay={0}
            disableInteractive
            placement="left"
            // Tooltip kontrolowany wspólnym stanem z rodzica - w danym momencie
            // otwarty jest tylko jeden. Dzięki temu przy szybkim najeżdżaniu na
            // kolejnych graczy karty nie nawarstwiają się i nie "zostają".
            open={open}
            onOpen={() => onOpen?.(player.id)}
            onClose={() => onClose?.(player.id)}
            // Znikanie natychmiastowe (exit: 0) - domyślny fade MUI (~195ms)
            // sprawiał, że tooltip "wisiał" jeszcze chwilę po zjechaniu z gracza.
            TransitionProps={{ timeout: { enter: 150, exit: 0 } }}
            componentsProps={{
                tooltip: {
                    sx: {
                        backgroundColor: theme.palette.background.paper,
                        border: `2px solid ${theme.palette.divider}`,
                        borderRadius: '0',
                        // Bez backdropFilter: blur - tło tooltipa jest nieprzezroczyste,
                        // więc rozmycie było niewidoczne, a kosztowne kompozytowanie
                        // dużej karty (portret 420px) powodowało zacinanie.
                        p: 0,
                        color: theme.palette.text.primary
                    }
                },
                arrow: {
                    sx: {
                        color: theme.palette.text.secondary
                    }
                }
            }}
            title={
                <Box sx={{ p: 0, minWidth: 300 }}>
                    <Box sx={{ position: 'relative', width: '100%', mb: 0 }}>
                        <Avatar
                            src={player.avatar ? `/api${player.avatar}` : undefined}
                            alt={player.user || 'Gracz'}
                            sx={{
                                width: '100%',
                                height: 420,
                                border: 'none',
                                borderBottom: `2px solid ${theme.palette.divider}`,
                                boxShadow: `0 6px 20px ${theme.palette.primary.main}60`,
                                fontSize: 64,
                                objectFit: 'cover',
                                objectPosition: '50% 0%',
                                borderRadius: '0',
                                
                                fontWeight: 'bold',
                                color: theme.palette.text.secondary,
                                backgroundColor: theme.palette.background.default
                            }}
                        >
                            {!player.avatar && player.user?.[0]?.toUpperCase()}
                        </Avatar>
                        <PlayerStatusIndicator status={player.status} size="large" />
                        <RoleBadge role={player.role} size="large" />
                    </Box>

                    <Box sx={{ p: 2, textAlign: 'center' }}>

                    <Typography sx={{
                        fontWeight: 'bold',
                        color: theme.palette.primary.main,
                        fontSize: 18,
                        
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        textShadow: `0 0 10px ${theme.palette.primary.main}60`,
                        mb: player.epithet && player.epithet.trim() !== '' ? 0.25 : 1.5
                    }}>
                        {player.user || 'Nieznany'}
                    </Typography>

                    {/* PRZYDOMEK - nadany przez administrację (admin/MG), stoi
                        tuż pod nazwą, bo to część tego, jak postać jest znana,
                        a nie kolejny wiersz danych. */}
                    {player.epithet && player.epithet.trim() !== '' && (
                        <Typography sx={{
                            fontSize: 13,
                            fontStyle: 'italic',
                            fontWeight: 700,
                            color: theme.palette.info.text,
                            letterSpacing: '0.04em',
                            wordBreak: 'break-word',
                            mb: 1.5
                        }}>
                            „{player.epithet}"
                        </Typography>
                    )}

                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        mb: 1.5,
                        p: 0.75,
                        borderRadius: '0',
                        backgroundColor: theme.palette.background.default,
                        border: `1px solid ${statusColor}`
                    }}>
                        <Box sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '0',
                            backgroundColor: statusColor,
                            boxShadow: `0 0 8px ${statusColor}80`
                        }} />
                        <Typography sx={{
                            fontSize: 11,
                            color: statusColor,
                            fontWeight: 'bold',
                            
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            {statusData.label}
                        </Typography>
                    </Box>

                    <Stack spacing={1} sx={{ width: '100%' }}>
                        <Box sx={{
                            p: 1,
                            borderRadius: '0',
                            backgroundColor: theme.palette.background.default,
                            border: `1px solid ${theme.palette.divider}`
                        }}>
                            <Typography sx={{
                                fontSize: 12,
                                color: theme.palette.text.secondary,
                                
                                mb: 0.5
                            }}>
                                POZIOM: <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                                    {player.level || 1}
                                </Box>
                                {player.prestige > 0 && (
                                    <Box component="span" sx={{ color: theme.palette.warning.main, fontWeight: 'bold', ml: 0.5, textShadow: `0 0 5px ${theme.palette.warning.main}aa` }}>
                                        ({player.prestige})
                                    </Box>
                                )}
                            </Typography>
                            <Typography sx={{
                                fontSize: 12,
                                color: theme.palette.text.secondary,
                                
                                mb: 0.5
                            }}>
                                RASA: <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                                    {resolveRaceName(player.faction, races)}
                                </Box>
                            </Typography>
                            <Typography sx={{
                                fontSize: 12,
                                color: theme.palette.text.secondary,
                                
                                mb: 0.5
                            }}>
                                PŁEĆ: <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                                    {player.gender || '-'}
                                </Box>
                            </Typography>
                            <Typography sx={{
                                fontSize: 12,
                                color: theme.palette.text.secondary,
                                }}>
                                STYL: <Box component="span" sx={{ color: getPlayStyle(player.playStyle).color, fontWeight: 'bold' }}>
                                    {getPlayStyle(player.playStyle).short}
                                </Box>
                            </Typography>
                        </Box>

                        {/* ROLA FABULARNA + STATUS - jeden blok "co postać robi/kim
                            jest". Rola fabularna pochodzi od administracji, status
                            wpisuje sobie sam gracz. Status ma większy tekst niż
                            wiersze danych, bo to najczęściej czytana treść dymku. */}
                        {((player.narrativeRole && player.narrativeRole.trim() !== '') ||
                          (player.characterStatus && player.characterStatus.trim() !== '')) && (
                            <Box sx={{
                                p: 1.5,
                                borderRadius: '0',
                                backgroundColor: theme.palette.background.default,
                                border: `1px solid ${theme.palette.divider}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1
                            }}>
                                {player.narrativeRole && player.narrativeRole.trim() !== '' && (
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography sx={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: '0.14em',
                                            textTransform: 'uppercase',
                                            color: theme.palette.text.secondary,
                                            mb: 0.25
                                        }}>
                                            ROLA FABULARNA
                                        </Typography>
                                        <Typography sx={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: theme.palette.warning.main,
                                            letterSpacing: '0.04em',
                                            wordBreak: 'break-word',
                                            lineHeight: 1.4
                                        }}>
                                            {player.narrativeRole}
                                        </Typography>
                                    </Box>
                                )}

                                {player.narrativeRole && player.narrativeRole.trim() !== '' &&
                                 player.characterStatus && player.characterStatus.trim() !== '' && (
                                    <Box sx={{ height: '1px', backgroundColor: theme.palette.divider }} />
                                )}

                                {player.characterStatus && player.characterStatus.trim() !== '' && (
                                    <Typography sx={{
                                        fontSize: 14,
                                        color: theme.palette.text.primary,
                                        fontStyle: 'italic',
                                        wordWrap: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.6,
                                        textAlign: 'center'
                                    }}>
                                        "{player.characterStatus}"
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Stack>
                    </Box>
                </Box>
            }
        >

<Button
    onClick={() => onProfileClick(player)}
    sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        minHeight: compact ? 42 : 50,
        p: compact ? 0.5 : 0.75,
        background: 'transparent',
        textTransform: 'uppercase',
        fontWeight: 600,
        fontSize: compact ? 11 : 12,
        borderRadius: '0',
        border: 'none',
        borderLeft: `3px solid ${(() => { const r = races.find(rr => rr.key === player.faction); return getRaceColorSet(r?.color, { name: r?.name, key: player.faction }).primary; })()}`,
        borderBottom: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.2s ease',
        
        letterSpacing: '0.05em',
        color: theme.palette.mode === 'dark' ? theme.palette.text.primary : theme.palette.text.primary,
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
            backgroundColor: `${theme.palette.primary.main}20`,
            color: theme.palette.primary.main,
            borderBottomColor: theme.palette.primary.main,
            animation: 'glitch 0.3s cubic-bezier(.25, .46, .45, .94) both',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}15, transparent)`,
                animation: 'glitch-scan 0.3s ease-in-out'
            }
        }
    }}
>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 0.75 : 1, minWidth: 0, flexGrow: 1 }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
                src={player.avatar ? `/api${player.avatar}` : undefined}
                sx={{
                    width: compact ? 34 : 42,
                    height: compact ? 46 : 56,
                    border: `2px solid ${theme.palette.divider}`,
                    fontSize: compact ? 14 : 16,
                    borderRadius: '0',
                    objectFit: 'cover',
                    objectPosition: '50% 0%',
                    
                    fontWeight: 'bold',
                    color: theme.palette.text.secondary,
                    backgroundColor: theme.palette.background.default
                }}
            >
                {!player.avatar && player.user?.[0]?.toUpperCase()}
            </Avatar>
            <PlayerStatusIndicator status={player.status} size="small" />
            <RoleBadge role={player.role} size="small" />
        </Box>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography
                sx={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: compact ? 12 : 13,
                    lineHeight: 1.3,
                    
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'inherit',
                    mb: 0.25
                }}
            >
                {truncateNickname(player.user, compact ? 10 : 14)}
            </Typography>
            <Typography
                sx={{
                    fontSize: compact ? 9 : 10,
                    color: theme.palette.text.secondary,
                    
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}
            >
                LVL {player.level || 1}{player.prestige > 0 ? ` (${player.prestige})` : ''}
            </Typography>
        </Box>
    </Box>

    <Chip
        label={`#${player.id}`}
        size="small"
        sx={{
            height: compact ? 16 : 18,
            fontSize: compact ? 9 : 10,
            
            backgroundColor: theme.palette.background.default,
            color: theme.palette.primary.main,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '0',
            '& .MuiChip-label': { px: 0.75 }
        }}
    />
</Button>
        </Tooltip>
    );
});

// ================================
// MAIN COMPONENT
// ================================
// onNavigate: opcjonalny callback wołany, gdy gracz przechodzi z listy na
// profil. Na telefonie lista żyje w wysuwanym panelu, który po takim przejściu
// trzeba zamknąć. Wcześniej panel miał onClick na CAŁEJ zawartości, przez co
// pierwsze dotknięcie gdziekolwiek go zamykało i nie dało się użyć ani
// wyszukiwarki, ani rozwijania wpisów.
const OnlineList = React.memo(({ onNavigate }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const scrollContainerRef = React.useRef(null);
    const scrollPositionRef = React.useRef(0);

    const [onlinePlayers, setOnlinePlayers] = useState([]);
    const [gameTime, setGameTime] = useState(null);
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [weatherRefreshing, setWeatherRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('status');
    const [sortOrder, setSortOrder] = useState('asc');
    // Domyślnie zwinięte: panel pokazuje po prostu listę osób online (bez
    // wyszukiwarki/filtrów), które przy małej liczbie graczy tylko zaśmiecały widok.
    // Strzałka (^) przy nagłówku ONLINE rozwija szukanie/sortowanie, gdy graczy jest dużo.
    const [expanded, setExpanded] = useState(false);
    const [compactMode, setCompactMode] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [races, setRaces] = useState([]);
    // Wspólny stan tooltipa: id gracza, którego karta jest aktualnie otwarta
    // (max jedna naraz). Zapobiega nawarstwianiu się kart przy szybkim hoverze.
    const [hoveredId, setHoveredId] = useState(null);

    const [favorites, setFavorites] = useLocalStorage('playerFavorites', []);

    // Modyfikator walki TWOJEJ rasy zależny od pory dnia (mechanika dzień/noc) -
    // pokazywany w panelu czasu, żeby gracz widział realny efekt.
    const myRace = useRaceColor();
    const myRaceData = races.find(r => r.key === myRace.key);
    const myRaceCombat = myRaceData ? {
        name: myRaceData.name,
        dayPct: Number(myRaceData.combat_day_percent) || 0,
        nightPct: Number(myRaceData.combat_night_percent) || 0,
    } : null;

    // Pobierz listę ras (do mapowania klucza rasy na czytelną nazwę)
    useEffect(() => {
        fetch('/api/races?includeInactive=1')
            .then(res => res.json())
            .then(data => setRaces(Array.isArray(data) ? data : []))
            .catch(err => console.error('Błąd pobierania ras:', err));
    }, []);

    const debouncedSearch = useMemo(
        () => debounce((term) => setSearchTerm(term), SEARCH_DEBOUNCE_MS),
        []
    );

    // Na telefonie lista żyje w wysuwanym panelu, więc bywa odmontowywana zaraz
    // po wpisaniu frazy - bez tego wisiałby jeszcze jeden setState po odmontowaniu.
    useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

    const toastStyle = useMemo(() => ({
        style: {
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: '0',
            fontWeight: 'bold',
            
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backdropFilter: 'blur(20px)',
            boxShadow: `0 8px 30px ${theme.palette.background.default}80`,
        }
    }), [theme]);

    // ================================
    // FETCH FUNCTIONS
    // ================================
    const fetchFavorites = useCallback(async () => {
        if (!token) return;
        
        try {
            const response = await fetch('/api/favorites', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data)) {
                    setFavorites(data.data);
                }
            }
        } catch (err) {
            console.error('Error fetching favorites:', err);
        }
    }, [token, setFavorites]);

    const fetchWeather = useCallback(async (isRefresh = false) => {
        if (!token) return;
        if (isRefresh) setWeatherRefreshing(true);

        try {
            const response = await fetch('/api/weather', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.success && data.weather && data.gameTime) {
                setWeather(data.weather);
                setGameTime(data.gameTime);
                
                localStorage.setItem('cachedWeather', JSON.stringify(data.weather));
                localStorage.setItem('cachedGameTime', JSON.stringify(data.gameTime));
                
                if (isRefresh) {
                    toast.success(`Pogoda: ${data.weather.emoji} ${data.weather.label}`, toastStyle);
                }
            }
        } catch (err) {
            console.error('Error fetching weather:', err);
            
            try {
                const cachedWeather = localStorage.getItem('cachedWeather');
                const cachedTime = localStorage.getItem('cachedGameTime');
                if (cachedWeather && cachedTime) {
                    setWeather(JSON.parse(cachedWeather));
                    setGameTime(JSON.parse(cachedTime));
                }
            } catch (cacheErr) {
                console.error('Cache load error:', cacheErr);
            }
        } finally {
            setWeatherRefreshing(false);
        }
    }, [token, toastStyle]);

    const fetchOnlinePlayers = useCallback(async (isRefresh = false) => {
        if (!token) return;

        // Zapisz pozycję scrolla przed aktualizacją (tylko przy automatycznym odświeżaniu)
        if (isRefresh && scrollContainerRef.current) {
            scrollPositionRef.current = scrollContainerRef.current.scrollTop;
        }

        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('/api/online-users', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.success && Array.isArray(data.data)) {
                const validPlayers = data.data.filter(isValidPlayer);
                setOnlinePlayers(validPlayers);
                setError(null);
                setIsConnected(true);

                localStorage.setItem('cachedOnlinePlayers', JSON.stringify(validPlayers));
            } else {
                setOnlinePlayers([]);
                setError(null);
            }
        } catch (err) {
            setIsConnected(false);

            if (err.name === 'AbortError') {
                setError('Przekroczono limit czasu');
            } else if (err.message.includes('Failed to fetch')) {
                setError('Brak połączenia');
            } else {
                setError(err.message);
            }

            try {
                const cached = localStorage.getItem('cachedOnlinePlayers');
                if (cached) {
                    setOnlinePlayers(JSON.parse(cached));
                }
            } catch (cacheErr) {
                console.error('Cache load error:', cacheErr);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, toastStyle]);

    // ================================
    // INITIAL LOAD
    // ================================
    useEffect(() => {
        fetchWeather();
        fetchOnlinePlayers();
        fetchFavorites();

        const playersInterval = setInterval(() => {
            fetchOnlinePlayers(true);
        }, REFRESH_INTERVAL);

        const weatherInterval = setInterval(() => {
            fetchWeather();
        }, WEATHER_REFRESH_INTERVAL);

        return () => {
            clearInterval(playersInterval);
            clearInterval(weatherInterval);
        };
    }, [fetchWeather, fetchOnlinePlayers, fetchFavorites]);

    // ================================
    // RESTORE SCROLL POSITION
    // ================================
    useEffect(() => {
        // Przywróć pozycję scrolla po aktualizacji listy graczy
        if (scrollContainerRef.current && scrollPositionRef.current > 0 && !loading) {
            // Użyj requestAnimationFrame aby upewnić się, że DOM został zaktualizowany
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollPositionRef.current;
                }
            });
        }
    }, [onlinePlayers, loading]);

    // ================================
    // PROCESS PLAYERS
    // ================================
    const processedPlayers = useMemo(() => {
        // Frazę normalizujemy RAZ, a nie w każdym porównaniu dla każdego gracza.
        const needle = searchTerm.trim().toLowerCase();

        let filtered = onlinePlayers.filter(player => {
            const matchesSearch = !needle || (
                player.user?.toLowerCase().includes(needle) ||
                resolveRaceName(player.faction, races).toLowerCase().includes(needle) ||
                String(player.id).includes(needle)
            );

            const matchesStatus = statusFilter === 'all' || player.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        filtered.sort((a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'status':
                    aVal = STATUS_OPTIONS[a.status]?.priority || 999;
                    bVal = STATUS_OPTIONS[b.status]?.priority || 999;
                    break;
                case 'name':
                    aVal = a.user?.toLowerCase() || '';
                    bVal = b.user?.toLowerCase() || '';
                    break;
                case 'level':
                    aVal = a.level || 0;
                    bVal = b.level || 0;
                    break;
                case 'id':
                    aVal = a.id;
                    bVal = b.id;
                    break;
                default:
                    aVal = a.id;
                    bVal = b.id;
            }

            if (sortBy === 'name') {
                return sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            } else {
                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                return 0;
            }
        });

        return filtered;
    }, [onlinePlayers, searchTerm, statusFilter, sortBy, sortOrder, races]);

    // ================================
    // HANDLERS
    // ================================
    const handleProfileClick = useCallback((player) => {
        navigate(`/home/profile/${player.id}`);
        if (onNavigate) onNavigate();
    }, [navigate, onNavigate]);

    const handleRefresh = useCallback(() => {
        fetchOnlinePlayers(true);
    }, [fetchOnlinePlayers]);

    const handleWeatherRefresh = useCallback(() => {
        fetchWeather(true);
    }, [fetchWeather]);

    // ================================
    // TOOLTIP CONTROL (jeden otwarty naraz)
    // ================================
    const handleTooltipOpen = useCallback((id) => {
        setHoveredId(id);
    }, []);

    const handleTooltipClose = useCallback((id) => {
        // Zamknij tylko, jeśli zamykany jest właśnie ten otwarty tooltip -
        // unika to zamknięcia karty, która w tym czasie już się otworzyła gdzie indziej.
        setHoveredId((prev) => (prev === id ? null : prev));
    }, []);

    // Zamknij kartę przy scrollowaniu listy (jej pozycja i tak byłaby nieaktualna).
    const handleListScroll = useCallback(() => {
        setHoveredId((prev) => (prev === null ? prev : null));
    }, []);

    // Gdy otwarty gracz zniknie z listy (offline / odświeżenie / filtr) - zamknij kartę,
    // żeby nie została "wisieć" bez powiązanego wiersza.
    useEffect(() => {
        setHoveredId((prev) => (prev != null && !processedPlayers.some((p) => p.id === prev) ? null : prev));
    }, [processedPlayers]);

    // ================================
    // RENDER
    // ================================
    return (
        <Box sx={{ 
            p: 1, 
            width: '100%', 
            height: '100%',  // DODANE - wypełnia kontener
            display: 'flex',  // DODANE - flexbox
            flexDirection: 'column',  // DODANE - układ kolumnowy
            minHeight: 0  // DODANE - ważne dla scrollowania
        }}>
            <GameTimeHeader
                gameTime={gameTime}
                weather={weather}
                onRefresh={handleWeatherRefresh}
                isRefreshing={weatherRefreshing}
                raceCombat={myRaceCombat}
            />

            {!isConnected && (
                <Alert 
                    severity="warning" 
                    icon={<OfflineIcon />} 
                    sx={{ 
                        mb: 1, 
                        fontSize: 11,
                        backgroundColor: 'rgba(217, 119, 6, 0.1)',
                        border: `1px solid ${theme.palette.warning.main}`,
                        borderRadius: '0',
                        color: theme.palette.warning.main,
                        
                        textTransform: 'uppercase',
                        flexShrink: 0,  // DODANE - nie zmniejsza się
                        '& .MuiAlert-icon': {
                            color: theme.palette.warning.main
                        }
                    }}
                >
                    Tryb offline
                </Alert>
            )}

            <Box sx={{ 
                mb: 1,
                flexShrink: 0  // DODANE - nagłówek nie zmniejsza się
            }}>
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    gap: 1
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{
                            color: theme.palette.primary.main,
                            fontWeight: 'bold',
                            fontSize: 16,
                            
                            textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                            textShadow: `0 0 10px ${theme.palette.primary.main}60`
                        }}>
                            ONLINE
                        </Typography>
                        <Chip
                            label={processedPlayers.length}
                            size="small"
                            sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 'bold',
                                
                                backgroundColor: theme.palette.primary.main,
                                color: theme.palette.background.default,
                                borderRadius: '0',
                                border: `1px solid ${theme.palette.divider}`,
                                '& .MuiChip-label': { px: 0.75 }
                            }}
                        />
                        {isConnected && (
                            <WifiIcon sx={{ color: theme.palette.success.text, fontSize: 16 }} />
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            sx={{
                                p: 0.25,
                                color: theme.palette.text.primary,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: '0',
                                '&:hover': { 
                                    color: theme.palette.primary.main,
                                    backgroundColor: `${theme.palette.primary.main}20`
                                }
                            }}
                        >
                            <RefreshIcon sx={{
                                fontSize: 16,
                                animation: refreshing ? 'spin 1s linear infinite' : 'none'
                            }} />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => setExpanded(!expanded)}
                            sx={{
                                p: 0.25,
                                color: theme.palette.text.primary,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: '0',
                                '&:hover': { 
                                    color: theme.palette.primary.main,
                                    backgroundColor: `${theme.palette.primary.main}20`
                                }
                            }}
                        >
                            {expanded ? 
                                <ExpandLessIcon sx={{ fontSize: 16 }} /> : 
                                <ExpandMoreIcon sx={{ fontSize: 16 }} />
                            }
                        </IconButton>
                    </Box>
                </Box>

                <Collapse in={expanded}>
                    <Stack spacing={1}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="SZUKAJ..."
                            onChange={(e) => debouncedSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                                    </InputAdornment>
                                )
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    fontSize: 12,
                                    minHeight: 32,
                                    
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    backgroundColor: theme.palette.background.default,
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: '0',
                                    color: theme.palette.text.primary,
                                    '& input': { 
                                        py: 0.5,
                                        '&::placeholder': {
                                            color: theme.palette.text.secondary,
                                            opacity: 1
                                        }
                                    },
                                    '& fieldset': {
                                        border: 'none'
                                    }
                                }
                            }}
                        />

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            <FormControl size="small" sx={{ minWidth: 90 }}>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    displayEmpty
                                    sx={{ 
                                        fontSize: 11, 
                                        height: 28,
                                        
                                        textTransform: 'uppercase',
                                        backgroundColor: theme.palette.background.default,
                                        border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: '0',
                                        color: theme.palette.text.primary,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            border: 'none'
                                        },
                                        '& .MuiSvgIcon-root': {
                                            color: theme.palette.primary.main
                                        }
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                backgroundColor: theme.palette.background.paper,
                                                border: `2px solid ${theme.palette.divider}`,
                                                borderRadius: '0',
                                                backdropFilter: 'blur(20px)'
                                            }
                                        }
                                    }}
                                >
                                    <MenuItem value="all" sx={{ 
                                        fontSize: 11,
                                        
                                        color: theme.palette.text.primary,
                                        '&:hover': {
                                            backgroundColor: `${theme.palette.primary.main}20`,
                                            color: theme.palette.primary.main
                                        }
                                    }}>
                                        Wszystkie
                                    </MenuItem>
                                    {Object.entries(STATUS_OPTIONS).map(([key, status]) => (
                                        <MenuItem key={key} value={key} sx={{ 
                                            fontSize: 11,
                                            
                                            color: theme.palette.text.primary,
                                            '&:hover': {
                                                backgroundColor: `${theme.palette.primary.main}20`,
                                                color: theme.palette.primary.main
                                            }
                                        }}>
                                            {status.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl size="small" sx={{ minWidth: 80 }}>
                                <Select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    sx={{ 
                                        fontSize: 11, 
                                        height: 28,
                                        
                                        textTransform: 'uppercase',
                                        backgroundColor: theme.palette.background.default,
                                        border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: '0',
                                        color: theme.palette.text.primary,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            border: 'none'
                                        },
                                        '& .MuiSvgIcon-root': {
                                            color: theme.palette.primary.main
                                        }
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                backgroundColor: theme.palette.background.paper,
                                                border: `2px solid ${theme.palette.divider}`,
                                                borderRadius: '0',
                                                backdropFilter: 'blur(20px)'
                                            }
                                        }
                                    }}
                                >
                                    {Object.entries(SORT_OPTIONS).map(([key, option]) => (
                                        <MenuItem key={key} value={key} sx={{ 
                                            fontSize: 11,
                                            
                                            color: theme.palette.text.primary,
                                            '&:hover': {
                                                backgroundColor: `${theme.palette.primary.main}20`,
                                                color: theme.palette.primary.main
                                            }
                                        }}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <IconButton
                                size="small"
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                sx={{
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: '0',
                                    height: 28,
                                    width: 28,
                                    color: theme.palette.text.primary,
                                    '&:hover': { 
                                        color: theme.palette.primary.main,
                                        backgroundColor: `${theme.palette.primary.main}20`
                                    }
                                }}
                            >
                                <SortIcon sx={{
                                    fontSize: 14,
                                    transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s ease'
                                }} />
                            </IconButton>
                        </Box>
                    </Stack>
                </Collapse>
            </Box>

            {/* GŁÓWNY KONTENER LISTY - teraz prawidłowo wypełnia przestrzeń */}
            <Box
                ref={scrollContainerRef}
                onScroll={handleListScroll}
                sx={{
                    flex: 1,  // DODANE - kluczowa zmiana: zajmuje całą dostępną przestrzeń
                    minHeight: 0,  // DODANE - umożliwia scrollowanie
                    overflowY: 'auto',
                    // overflowX ukryty: animacja "glitch" na hoverze przesuwa wiersz o
                    // kilka px w poziomie i przy 'auto' migał wtedy poziomy scrollbar.
                    overflowX: 'hidden',
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.palette.divider}`,  // DODANE - widoczna ramka
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${theme.palette.primary.main} ${theme.palette.background.default}`,
                    '&::-webkit-scrollbar': {
                        width: '8px'
                    },
                    '&::-webkit-scrollbar-track': {
                        background: theme.palette.background.default,
                        borderRadius: '0'
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: theme.palette.primary.main,
                        borderRadius: '0',
                        border: `1px solid ${theme.palette.divider}`,
                        '&:hover': {
                            background: theme.palette.primary.light
                        }
                    }
                }}
            >
                {loading ? (
                    <OnlineListSkeleton />
                ) : error ? (
                    <Box sx={{ p: 1, textAlign: 'center' }}>
                        <Alert
                            severity="error"
                            action={
                                <Button 
                                    size="small" 
                                    onClick={() => fetchOnlinePlayers()}
                                    sx={{
                                        
                                        textTransform: 'uppercase',
                                        fontSize: 10
                                    }}
                                >
                                    Ponów
                                </Button>
                            }
                            sx={{ 
                                fontSize: 11,
                                backgroundColor: 'rgba(155, 44, 44, 0.1)',
                                border: `1px solid ${theme.palette.error.main}`,
                                borderRadius: '0',
                                color: theme.palette.error.text,
                                
                                '& .MuiAlert-icon': {
                                    color: theme.palette.error.text
                                }
                            }}
                        >
                            {error}
                        </Alert>
                    </Box>
                ) : processedPlayers.length > 0 ? (
                    <Stack spacing={0}>
                        {processedPlayers.map((player) => (
                            <PlayerListItem
                                key={player.id}
                                player={player}
                                onProfileClick={handleProfileClick}
                                compact={compactMode}
                                races={races}
                                open={hoveredId === player.id}
                                onOpen={handleTooltipOpen}
                                onClose={handleTooltipClose}
                            />
                        ))}
                    </Stack>
                ) : (
                    <Box sx={{ 
                        p: 2, 
                        textAlign: 'center', 
                        color: theme.palette.text.secondary,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Typography variant="body2" sx={{ 
                            fontSize: 12,
                            
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em'
                        }}>
                            {searchTerm || statusFilter !== 'all'
                                ? '[ BRAK GRACZY ]'
                                : '[ NIKT NIE JEST ONLINE ]'
                            }
                        </Typography>
                    </Box>
                )}
            </Box>

            <GameToaster style={toastStyle.style} duration={3000} />

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes glitch {
                    0% { transform: translate(0); }
                    20% { transform: translate(-2px, 2px); }
                    40% { transform: translate(-2px, -2px); }
                    60% { transform: translate(2px, 2px); }
                    80% { transform: translate(2px, -2px); }
                    100% { transform: translate(0); }
                }

                @keyframes glitch-scan {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </Box>
    );
});

// Nazwa do React DevTools - bez tego komponenty owiniete w React.memo
// pokazuja sie jako "Anonymous" i nie da sie ich znalezc w drzewie.
GameTimeHeader.displayName = 'GameTimeHeader';
PlayerStatusIndicator.displayName = 'PlayerStatusIndicator';
OnlineListSkeleton.displayName = 'OnlineListSkeleton';
PlayerListItem.displayName = 'PlayerListItem';
OnlineList.displayName = 'OnlineList';

export default OnlineList;