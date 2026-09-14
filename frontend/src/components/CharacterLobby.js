import { useEffect, useMemo, useState, useCallback } from "react";
import sanitizeHtml from './sanitizeHtml';
import { useAuth, isRegularPlayer } from './AuthContext';
import { enterNpcMode, exitNpcMode, applySwitchedToken } from './npcMode';
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  Paper,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Star as StarIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  RestartAlt as RestartAltIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  TheaterComedy as TheaterComedyIcon,
  KeyboardReturn as KeyboardReturnIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import toast from 'react-hot-toast';
import GameToaster from './GameToaster';
import { useTheme } from '@mui/material/styles';
import { appColors, getRaceColorSet, subtleAmbientOverlay } from './theme';
import EngineFooter from './EngineFooter';
import useResponsive from './useResponsive';

const API_BASE = "/api";

const getToastStyle = (theme) => ({
    style: {
        background: theme.palette.background.paper,
        color: theme.palette.text.primary,
        border: `2px solid ${theme.palette.primary.main}`,
        borderRadius: '4px',
        
        fontWeight: 'bold',
        boxShadow: `0 4px 20px ${theme.palette.primary.main}80`,
    }
});

async function safeJson(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        console.warn("Non-JSON response:", text.slice(0, 200));
        return null;
    }
}

async function safeError(res) {
    try {
        const data = await res.clone().json();
        return data?.message || data?.error || res.statusText || `HTTP ${res.status}`;
    } catch {
        return res.statusText || `HTTP ${res.status}`;
    }
}

// Komponent pojedynczej karty
const CharacterCard3D = ({
    character,
    isCenter,
    position,
    onClick,
    isSelecting,
    onReset,
    onDelete,
}) => {
    const theme = useTheme();
    const [races, setRaces] = useState([]);

    // Pobierz listę ras (do mapowania klucza rasy na czytelną nazwę)
    useEffect(() => {
        fetch('/api/races?includeInactive=1')
            .then(res => res.json())
            .then(data => setRaces(Array.isArray(data) ? data : []))
            .catch(err => console.error('Błąd pobierania ras:', err));
    }, []);

    const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';
    const getRaceColor = (key) => {
        const r = races.find(rr => rr.key === key);
        return getRaceColorSet(r?.color, { name: r?.name, key });
    };

    // Limit resetów: 1 na 7 dni na DANE ID POSTACI (backend:
    // utils/characterReset.js). Przycisk jest wygaszony, żeby gracz nie
    // wypełniał całego formularza resetu po to, by dostać odmowę dopiero przy
    // zatwierdzeniu. Właściwa blokada i tak jest na serwerze.
    const resetAvailableAt = character?.resetAvailableAt ? new Date(character.resetAvailableAt) : null;
    const resetOnCooldown = Boolean(resetAvailableAt) && resetAvailableAt.getTime() > Date.now();
    const resetTooltip = resetOnCooldown
        ? `Reset dostępny od ${resetAvailableAt.toLocaleString('pl-PL', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })} (1 reset na 7 dni)`
        : 'Resetuj postać';

    const getTransform = () => {
        if (position === 'center') {
            return {
                transform: 'translateX(0) scale(1) rotateY(0deg)',
                zIndex: 30,
                opacity: 1,
                filter: 'brightness(1)',
            };
        } else if (position === 'left') {
            return {
                transform: 'translateX(-400px) scale(0.8) rotateY(45deg)',
                zIndex: 10,
                opacity: 0.5,
                filter: 'brightness(0.6)',
                pointerEvents: 'none',
            };
        } else if (position === 'right') {
            return {
                transform: 'translateX(400px) scale(0.8) rotateY(-45deg)',
                zIndex: 10,
                opacity: 0.5,
                filter: 'brightness(0.6)',
                pointerEvents: 'none',
            };
        } else {
            return {
                transform: 'scale(0)',
                zIndex: 0,
                opacity: 0,
                pointerEvents: 'none',
            };
        }
    };

    const style = getTransform();

    if (!character) {
        return (
            <Paper
                elevation={24}
                sx={{
                    position: 'absolute',
                    width: { xs: 300, sm: 400, md: 500 },
                    height: { xs: 450, sm: 550, md: 650 },
                    bgcolor: `${appColors.bgDeep}cc`,
                    // Obwódka w kolorze rasy - bez grafik.
                    border: `1px solid ${getRaceColor(character?.faction).border}`,
                    borderTop: `3px solid ${getRaceColor(character?.faction).accent}`,
                    backgroundClip: 'padding-box',
                    overflow: 'hidden',
                    transition: 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                    boxShadow: `0 8px 32px rgba(0,0,0,0.6), inset 0 0 60px rgba(0,0,0,0.5)`,
                    ...style,
                }}
            >
                <Box sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    px: 4,
                }}>
                    <Box sx={{
                        width: 80, height: 80,
                        border: `2px solid ${appColors.rust}`,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7,
                        boxShadow: `0 0 24px ${appColors.rust}33, inset 0 0 18px ${appColors.rust}22`,
                        animation: isCenter ? 'slotPulse 2s ease-in-out infinite' : 'none',
                    }}>
                        <AddIcon sx={{ fontSize: 40, color: appColors.rustLight }} />
                    </Box>

                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{
                            color: appColors.rustLight,
                            
                            fontSize: '0.7rem',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            opacity: 0.75,
                            mb: 0.5,
                        }}>
                            Nieznana dusza
                        </Typography>
                        <Typography variant="h5" sx={{
                            color: appColors.textPrimary,
                            
                            letterSpacing: '0.08em',
                            fontSize: '1.1rem',
                        }}>
                            Puste miejsce
                        </Typography>
                    </Box>

                    {isCenter && (
                        <Button
                            size="large"
                            onClick={onClick}
                            sx={{
                                fontWeight: 'bold',
                                fontSize: '0.95rem',
                                px: 4,
                                py: 1.5,
                                
                                letterSpacing: '0.08em',
                                color: appColors.textLight,
                                bgcolor: 'transparent',
                                border: `2px solid ${appColors.rust}`,
                                borderRadius: '2px',
                                '&:hover': {
                                    bgcolor: `${appColors.rust}22`,
                                    borderColor: appColors.rustLight,
                                    color: theme.palette.common.white,
                                    transform: 'translateY(-2px)',
                                    boxShadow: `0 4px 16px ${appColors.rust}55`,
                                },
                                transition: 'all 0.3s ease',
                            }}
                        >
                            Stwórz postać
                        </Button>
                    )}
                </Box>
            </Paper>
        );
    }

    return (
        <Paper
            elevation={24}
            sx={{
                position: 'absolute',
                width: { xs: 300, sm: 400, md: 500 },
                height: { xs: 450, sm: 550, md: 650 },
                bgcolor: theme.palette.background.paper,
                // Kolumnowy flex: sekcja opisu (nazwa + chipy + WCIEL SIĘ) dostaje
                // tyle miejsca, ile potrzebuje, a obraz wypełnia resztę. Bez tego
                // sztywne 70/30% przycinały przycisk na telefonach (chipy klasy
                // zawijały się do 2 linii i "WCIEL SIĘ" wypadał poza kartę).
                display: 'flex',
                flexDirection: 'column',
                // Obwódka w kolorze rasy - bez grafik.
                border: `1px solid ${getRaceColor(character?.faction).border}`,
                borderTop: `3px solid ${getRaceColor(character?.faction).accent}`,
                backgroundClip: 'padding-box',
                overflow: 'hidden',
                cursor: isCenter ? 'pointer' : 'default',
                transition: 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                boxShadow: character.isActive
                    ? `0 8px 32px ${theme.palette.primary.main}60`
                    : theme.shadows[10],
                '&:hover': isCenter ? {
                    transform: 'translateX(0) scale(1.03) rotateY(0deg)',
                    boxShadow: theme.shadows[11],
                } : {},
                ...style,
            }}
        >
            {/* Pasek rasy - tożsamość postaci widoczna od razu w karuzeli, nie tylko w chipie na dole */}
            <Box sx={{
                height: 4,
                width: '100%',
                flexShrink: 0,
                bgcolor: getRaceColor(character.faction)?.primary || theme.palette.primary.main,
            }} />

            <Box sx={{
                flex: '1 1 auto',
                minHeight: 0,
                bgcolor: theme.palette.mode === 'dark'
                    ? 'rgba(0, 0, 0, 0.4)'
                    : 'rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: character.avatar ? `url(${character.avatar})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'brightness(0.85) contrast(1.15) saturate(0.9)',
                }} />

                {/* Vignette overlay */}
                <Box sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
                    pointerEvents: 'none',
                    zIndex: 1,
                }} />

                {character.isActive && (
                    <Box sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        bgcolor: `${theme.palette.primary.main}cc`,
                        color: theme.palette.common.white,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '2px',
                        fontWeight: 'bold',
                        
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        border: `1px solid ${theme.palette.primary.light}`,
                        boxShadow: `0 0 12px ${theme.palette.primary.main}80, 0 0 4px ${theme.palette.primary.main}`,
                        fontSize: '0.75rem',
                        letterSpacing: '0.15em',
                        zIndex: 3,
                        animation: 'activePulse 2s ease-in-out infinite',
                    }}>
                        <StarIcon sx={{ fontSize: 13 }} />
                        AKTYWNA
                    </Box>
                )}

                {isCenter && (
                    <Box sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        zIndex: 2,
                    }}>
                        {/* span pod Tooltipem - wyłączony IconButton nie wysyła
                            zdarzeń myszy, więc bez opakowania dymek z terminem
                            kolejnego resetu w ogóle by się nie pokazał. */}
                        <Tooltip title={resetTooltip} arrow>
                            <span style={{ display: 'inline-flex' }}>
                                <IconButton
                                    disabled={resetOnCooldown}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onReset(character);
                                    }}
                                    sx={{
                                        bgcolor: theme.palette.mode === 'dark'
                                            ? 'rgba(0,0,0,0.8)'
                                            : 'rgba(255,255,255,0.9)',
                                        border: `1px solid ${theme.palette.divider}`,
                                        color: theme.palette.text.secondary,
                                        borderRadius: '4px',
                                        '&:hover': {
                                            bgcolor: theme.palette.action.hover,
                                            color: theme.palette.text.primary,
                                        },
                                        '&.Mui-disabled': {
                                            bgcolor: theme.palette.mode === 'dark'
                                                ? 'rgba(0,0,0,0.5)'
                                                : 'rgba(255,255,255,0.6)',
                                            border: `1px solid ${theme.palette.divider}`,
                                            color: theme.palette.text.disabled,
                                        },
                                        width: 40,
                                        height: 40,
                                    }}
                                >
                                    <RestartAltIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Usuń postać" arrow>
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(character);
                                }}
                                sx={{
                                    bgcolor: theme.palette.mode === 'dark'
                                        ? 'rgba(0,0,0,0.8)'
                                        : 'rgba(255,255,255,0.9)',
                                    border: `1px solid ${theme.palette.error.main}`,
                                    color: theme.palette.error.text,
                                    borderRadius: '4px',
                                    '&:hover': {
                                        bgcolor: theme.palette.error.main,
                                        color: theme.palette.common.white,
                                    },
                                    width: 40,
                                    height: 40,
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

            </Box>

            <Box sx={{
                p: { xs: 1.75, sm: 2.5 },
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                bgcolor: appColors.bgDeep,
                borderTop: `1px solid ${appColors.borderSteel}`,
            }}>
                <Box>
                    <Typography variant="h4" sx={{
                        color: appColors.textLight,
                        fontWeight: 700,
                        mb: 1,
                        
                        textAlign: 'center',
                        fontSize: { xs: '1.3rem', md: '1.7rem' },
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        textShadow: `0 0 20px ${theme.palette.primary.main}60`,
                    }}>
                        {character.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap">
                        <Chip
                            label={character.gender}
                            size="small"
                            sx={{
                                bgcolor: 'transparent',
                                border: `1px solid ${appColors.steel}`,
                                color: appColors.textPrimary,
                                borderRadius: '2px',
                                
                                fontSize: '0.7rem',
                                letterSpacing: '0.08em',
                                height: 22,
                            }}
                        />
                        <Chip
                            label={getRaceName(character.faction)}
                            size="small"
                            sx={{
                                bgcolor: getRaceColor(character.faction)?.light || `${theme.palette.primary.main}18`,
                                border: `1px solid ${getRaceColor(character.faction)?.border || `${theme.palette.primary.main}60`}`,
                                color: getRaceColor(character.faction)?.accent || theme.palette.primary.light,
                                borderRadius: '2px',
                                
                                fontSize: '0.7rem',
                                letterSpacing: '0.08em',
                                height: 22,
                                fontWeight: 700,
                            }}
                        />
                        {character.className && (
                            <Chip
                                label={character.className}
                                size="small"
                                sx={{
                                    bgcolor: 'rgba(184, 146, 60, 0.12)',
                                    border: '1px solid rgba(184, 146, 60, 0.45)',
                                    color: '#d9b866',
                                    borderRadius: '2px',
                                    
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.08em',
                                    height: 22,
                                    fontWeight: 700,
                                }}
                            />
                        )}
                    </Stack>
                </Box>

                {isCenter && (
                    <Button
                        fullWidth
                        size="large"
                        onClick={() => onClick(character)}
                        disabled={isSelecting}
                        sx={{
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                            py: 1.25,
                            
                            letterSpacing: '0.12em',
                            color: isSelecting ? appColors.steel : appColors.textLight,
                            bgcolor: 'transparent',
                            border: `2px solid ${isSelecting ? appColors.steel : theme.palette.primary.main}`,
                            borderRadius: '2px',
                            boxShadow: isSelecting ? 'none' : `0 0 12px ${theme.palette.primary.main}40`,
                            '&:hover': {
                                bgcolor: `${theme.palette.primary.main}18`,
                                boxShadow: `0 0 20px ${theme.palette.primary.main}60`,
                                transform: 'translateY(-1px)',
                            },
                            '&:disabled': {
                                color: appColors.textMuted,
                                borderColor: appColors.steel,
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        {isSelecting ? '[ PRZYZYWANIE... ]' : '[ WCIEL SIĘ ]'}
                    </Button>
                )}
            </Box>
        </Paper>
    );
};

// Dialog pożegnania postaci ("reset").
//
// W tym silniku reset jest wydarzeniem FABULARNYM, nie mechanicznym: postać nie
// wraca na start z czystymi wartościami - jej historia się domyka, a ona sama
// trafia na cmentarz. Dlatego zamiast formularza nowej postaci jest tu jedno
// pytanie: jak ta historia się skończyła.
const ResetCharacterDialog = ({ open, character, onClose, onConfirm }) => {
    const theme = useTheme();
    const toastStyle = getToastStyle(theme);
    const [password, setPassword] = useState('');
    const [deathReason, setDeathReason] = useState('');
    const [confirmText, setConfirmText] = useState('');

    const handleClose = () => {
        setPassword('');
        setDeathReason('');
        setConfirmText('');
        onClose();
    };

    const handleConfirm = async () => {
        if (!password) {
            toast.error('Wpisz hasło', toastStyle);
            return;
        }
        if (confirmText !== character?.name) {
            toast.error('Przepisz imię postaci, żeby potwierdzić', toastStyle);
            return;
        }
        await onConfirm({ password, deathReason });
        handleClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: theme.palette.background.paper,
                    border: `2px solid ${theme.palette.divider}`,
                    borderRadius: '4px',
                    boxShadow: theme.shadows[10],
                }
            }}
        >
            <DialogTitle sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.05)',
                color: theme.palette.text.primary,
                fontWeight: 'bold',
                fontSize: '1.3rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                letterSpacing: '0.05em',
                borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
                ZAMKNIJ HISTORIĘ POSTACI
                <IconButton onClick={handleClose} sx={{ color: theme.palette.text.secondary }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ mt: 3 }}>
                <Stack spacing={3}>
                    <Alert severity="warning">
                        Postać <b>{character?.name}</b> odejdzie ze sceny i spocznie na cmentarzu.
                        Jej posty w sesjach i wiadomości zostają - znika z lobby i nie można nią
                        dalej grać. Slot po niej nie wraca.
                    </Alert>

                    <TextField
                        label="Jak skończyła się jej historia (epitafium)"
                        value={deathReason}
                        onChange={(e) => setDeathReason(e.target.value)}
                        placeholder="np. Zginęła, broniąc przeprawy"
                        fullWidth
                        multiline
                        minRows={2}
                        helperText="Pole opcjonalne - ten tekst zobaczą odwiedzający cmentarz."
                    />

                    <TextField
                        label="Hasło do konta"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                    />

                    <TextField
                        label={`Przepisz imię postaci: ${character?.name || ''}`}
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        fullWidth
                    />
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button onClick={handleClose} sx={{ color: theme.palette.text.secondary }}>
                    Anuluj
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="warning"
                    disabled={!password || confirmText !== character?.name}
                >
                    Pożegnaj postać
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// Dialog usuwania postaci
const DeleteCharacterDialog = ({ open, character, onClose, onConfirm }) => {
    const theme = useTheme();
    const toastStyle = getToastStyle(theme);
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');

    const handleConfirm = async () => {
        if (!password) {
            toast.error('Wpisz hasło', toastStyle);
            return;
        }
        if (confirmText !== character?.name) {
            toast.error('Nieprawidłowe potwierdzenie', toastStyle);
            return;
        }

        await onConfirm(password);
        handleClose();
    };

    const handleClose = () => {
        setPassword('');
        setConfirmText('');
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: theme.palette.background.paper,
                    border: `2px solid ${theme.palette.error.main}`,
                    borderRadius: '4px',
                    boxShadow: `0 8px 32px ${theme.palette.error.main}60`,
                }
            }}
        >
            <DialogTitle sx={{
                bgcolor: theme.palette.error.main,
                color: theme.palette.text.primary,
                
                fontWeight: 'bold',
                fontSize: '1.3rem',
                letterSpacing: '0.05em',
                borderBottom: `1px solid ${theme.palette.error.main}`,
            }}>
                ⚠️ USUŃ POSTAĆ
            </DialogTitle>

            <DialogContent sx={{ mt: 3 }}>
                <Stack spacing={3}>
                    <Alert 
                        severity="error" 
                        sx={{
                            bgcolor: 'rgba(220, 38, 38, 0.1)',
                            border: `1px solid ${theme.palette.error.main}`,
                            borderRadius: '4px',
                            color: theme.palette.text.primary,
                            
                            '& .MuiAlert-icon': { color: theme.palette.error.text },
                        }}
                    >
                        <strong>NIEODWRACALNE!</strong>
                        <br />
                        Postać zostanie oznaczona jako martwa we wszystkich czatach.
                        <br />
                        ID będzie zablokowane na zawsze.
                    </Alert>

                    <Typography sx={{ color: theme.palette.text.primary, }}>
                        Usuwasz: <strong style={{ color: theme.palette.primary.main }}>{character?.name}</strong>
                    </Typography>

                    <TextField
                        fullWidth
                        type="password"
                        label="Hasło"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: theme.palette.text.primary,
                                
                                borderRadius: '4px',
                                '& fieldset': { borderColor: theme.palette.error.main },
                                '&:hover fieldset': { borderColor: theme.palette.error.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.error.main },
                            },
                            '& .MuiInputLabel-root': { 
                                color: theme.palette.text.secondary,
                                
                                '&.Mui-focused': { color: theme.palette.error.text },
                            },
                        }}
                    />

                    <TextField
                        fullWidth
                        label={`Wpisz "${character?.name}"`}
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        required
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                color: theme.palette.text.primary,
                                
                                borderRadius: '4px',
                                '& fieldset': { borderColor: theme.palette.error.main },
                                '&:hover fieldset': { borderColor: theme.palette.error.main },
                                '&.Mui-focused fieldset': { borderColor: theme.palette.error.main },
                            },
                            '& .MuiInputLabel-root': { 
                                color: theme.palette.text.secondary,
                                
                                '&.Mui-focused': { color: theme.palette.error.text },
                            },
                        }}
                    />
                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3, bgcolor: theme.palette.secondary.dark, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button
                    onClick={handleClose}
                    sx={{
                        color: theme.palette.text.primary,
                        
                        letterSpacing: '0.05em',
                    }}
                >
                    ANULUJ
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={!password || confirmText !== character?.name}
                    sx={{
                        bgcolor: theme.palette.error.main,
                        color: theme.palette.text.primary,
                        fontWeight: 'bold',
                        
                        letterSpacing: '0.05em',
                        borderRadius: '4px',
                        '&:hover': {
                            bgcolor: theme.palette.error.dark,
                        },
                        '&:disabled': {
                            bgcolor: theme.palette.divider,
                            color: theme.palette.text.secondary,
                        }
                    }}
                >
                    USUŃ
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// GŁÓWNY KOMPONENT
function CharacterLobby() {
    const theme = useTheme();
    const toastStyle = getToastStyle(theme);
    const navigate = useNavigate();
    const { user, updateCharacter } = useAuth();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const [loading, setLoading] = useState(true);
    const [player, setPlayer] = useState(null);
    const [characters, setCharacters] = useState([]);
    // Liczba slotów postaci przysługująca kontu - backend liczy ją z roli
    // (admin ma więcej niż zwykły gracz). 4 to bezpieczny fallback, gdyby
    // stara wersja API nie zwróciła tego pola.
    const [maxCharacters, setMaxCharacters] = useState(4);
    const [error, setError] = useState(null);
    const [selectingCharacter, setSelectingCharacter] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [residentMessageChecked, setResidentMessageChecked] = useState(false);
    const [hasResidentMessage, setHasResidentMessage] = useState(false);
    const [residentMessageData, setResidentMessageData] = useState(null);
    const [resetDialog, setResetDialog] = useState({ open: false, character: null });
    const [deleteDialog, setDeleteDialog] = useState({ open: false, character: null });
    // Tryb NPC: lobby wspólnego subkonta administracji z postaciami NPC.
    // `npcMode` czytamy z tokena (AuthContext), przełączanie robi npcMode.js.
    const npcMode = Boolean(user?.npcMode);
    const canEnterNpcMode = user?.role === 'admin' && !npcMode;
    const [npcSwitching, setNpcSwitching] = useState(false);

    const checkResidentMessage = useCallback(async () => {
        // Blokada obejmuje każdego zwykłego gracza, także zasłużonego.
        if (!isRegularPlayer(user?.role)) {
            setResidentMessageChecked(true);
            setHasResidentMessage(false);
            return;
        }
        
        try {
            const response = await fetch('/api/admin/check-resident-message', {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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
            console.error('❌ CharacterLobby - błąd sprawdzania komunikatu:', error);
            setHasResidentMessage(false);
            setResidentMessageData(null);
        } finally {
            setResidentMessageChecked(true);
        }
    }, [token, user]);

    useEffect(() => {
        checkResidentMessage();
    }, [checkResidentMessage]);

    const loadCharacters = useCallback(async (retryCount = 0, isRefresh = false) => {
        if (!token) {
            navigate("/login");
            return;
        }

        if (!isRefresh) setLoading(true);
        else setRefreshing(true);

        setError(null);
        try {
            const res = await fetch(`${API_BASE}/characters`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`Błąd: ${await safeError(res)}`);
            const data = await safeJson(res);

            if (data && typeof data === "object") {
                setPlayer(data.player || "Gracz");
                const charactersArray = Array.isArray(data.characters) ? data.characters : [];
                setCharacters(charactersArray);
                if (Number.isFinite(data.maxCharacters) && data.maxCharacters > 0) {
                    setMaxCharacters(data.maxCharacters);
                }

                if (isRefresh) {
                    toast.success("Odświeżono postacie", toastStyle);
                }
            } else {
                throw new Error("Nieprawidłowa odpowiedź serwera");
            }
        } catch (e) {
            if (retryCount < 2) {
                setTimeout(() => loadCharacters(retryCount + 1, isRefresh), 1000 * (retryCount + 1));
                toast.error(`Próba ${retryCount + 2}/3...`, toastStyle);
            } else {
                setError(e.message || "Nieznany błąd");
                toast.error(e.message || "Nieznany błąd", toastStyle);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token, navigate]);

    useEffect(() => {
        loadCharacters();
    }, [loadCharacters]);

    const handleRefresh = useCallback(() => {
        loadCharacters(0, true);
    }, [loadCharacters]);

    const handleCreateCharacter = useCallback(() => {
        if (characters.length >= maxCharacters) {
            toast.error(`Możesz mieć maksymalnie ${maxCharacters} postaci.`, toastStyle);
            return;
        }
        navigate("/createCharacter");
    }, [characters.length, maxCharacters, navigate]);

const handleSelectCharacter = useCallback(async (character) => {
    if (selectingCharacter) return;

    setSelectingCharacter(character.id);
    try {
        const res = await fetch(`${API_BASE}/selectCharacter`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ characterId: character.id }),
        });

        if (!res.ok) throw new Error(await safeError(res));
        const data = await res.json();

        if (data.token) {
            // NAJPIERW zapisz komplet danych postaci w localStorage, POTEM zaktualizuj
            //    token/kontekst. Inaczej re-render wywołany przez updateCharacter mógł
            //    odczytać puste id -> "silnik nie widzi postaci" tuż po wejściu do gry.
            const ch = data.character || character;
            localStorage.setItem('characterId', character.id.toString());
            localStorage.setItem('activeCharacterId', character.id.toString());
            localStorage.setItem('activeCharacterName', ch.name || character.name || '');
            localStorage.setItem('activeCharacterData', JSON.stringify({ id: character.id, name: ch.name || character.name || '', avatar: ch.avatar || '', race: ch.race || ch.faction || '' }));

            // AKTUALIZUJ TOKEN w AuthContext (odświeża user.characterId reaktywnie)
            updateCharacter(data.token);
        }

        toast.success(`Wybrano postać: ${data.character.name}`, toastStyle);

        // UŻYJ REACT ROUTER zamiast window.location (zapobiega przeskakiwaniu ekranu)
        setTimeout(() => {
            navigate('/home');
        }, 800);
    } catch (err) {
        console.error('❌ Błąd wyboru postaci:', err);
        toast.error(err.message, toastStyle);
    } finally {
        setSelectingCharacter(null);
    }
}, [selectingCharacter, token, updateCharacter, navigate]);

    const handleResetCharacter = useCallback((character) => {
        setResetDialog({ open: true, character });
    }, []);

    const handleConfirmReset = useCallback(async ({ password, deathReason }) => {
        try {
            const res = await fetch(`${API_BASE}/lobby/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    characterId: resetDialog.character?.id,
                    password,
                    deathReason,
                }),
            });

            if (!res.ok) throw new Error(await safeError(res));

            const data = await res.json().catch(() => ({}));
            // Pożegnana postać nie może zostać w tokenie - backend oddaje świeży,
            // bez aktywnej postaci.
            if (data.token) {
                updateCharacter(data.token);
            }

            toast.success(data.message || 'Historia postaci dobiegła końca', toastStyle);
            loadCharacters(0, true);
        } catch (err) {
            toast.error(err.message, toastStyle);
        }
    }, [token, loadCharacters, updateCharacter, resetDialog.character, toastStyle]);

    const handleDeleteCharacter = useCallback((character) => {
        setDeleteDialog({ open: true, character });
    }, []);

    const handleConfirmDelete = useCallback(async (password) => {
        try {
            const res = await fetch(`${API_BASE}/lobby/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ 
                    characterId: deleteDialog.character.id,
                    password 
                }),
            });

            if (!res.ok) throw new Error(await safeError(res));

            const data = await res.json().catch(() => ({}));
            // Jeśli usunięto AKTYWNĄ postać, backend zwraca świeży token bez postaci -
            // bez tego token dalej wskazywał usuniętą postać (błędy do przelogowania).
            // Czyścimy też nieaktualne klucze postaci z localStorage.
            if (data.token) {
                ['selectedCharacterId', 'selectedCharacter', 'activeCharacterId', 'activeCharacterName',
                 'activeCharacterData', 'characterId'].forEach(k => localStorage.removeItem(k));
                updateCharacter(data.token);
            }

            toast.success('Postać została usunięta 💀', toastStyle);
            loadCharacters(0, true);
        } catch (err) {
            toast.error(err.message, toastStyle);
        }
    }, [token, deleteDialog.character, loadCharacters, updateCharacter]);

    const handleLogout = useCallback(() => {
        localStorage.clear();
        navigate("/login");
    }, [navigate]);

    // Wejście na subkonto NPC / powrót na własne konto. Backend oddaje inny
    // token, applySwitchedToken czyści cache poprzedniego konta i wraca do lobby.
    const handleToggleNpcMode = useCallback(async () => {
        setNpcSwitching(true);
        try {
            const newToken = npcMode ? await exitNpcMode() : await enterNpcMode();
            applySwitchedToken(newToken);
        } catch (err) {
            toast.error(err.message, toastStyle);
            setNpcSwitching(false);
        }
    }, [npcMode, toastStyle]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? slots.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev === slots.length - 1 ? 0 : prev + 1));
    };

    // Na telefonach chowamy strzałki (nachodziły na postać) i przełączamy karty
    // gestem przeciągnięcia (swipe). Próg 40px, żeby zwykłe tapnięcie nie liczyło się
    // jako swipe (tap na środkowej karcie = "Wciel się").
    const { isSmall: isMobile } = useResponsive(); // wspólny próg z powłoką (1050px)
    const [touchStartX, setTouchStartX] = useState(null);
    const handleTouchStart = (e) => setTouchStartX(e.touches[0].clientX);
    const handleTouchEnd = (e) => {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx <= -40) handleNext();
        else if (dx >= 40) handlePrevious();
        setTouchStartX(null);
    };

    // Karuzela rośnie w miarę tworzenia postaci: pokazujemy istniejące postacie
    // i JEDNĄ pustą kartę z plusem, dopóki konto nie wyczerpie swojego limitu
    // slotów (4 dla gracza, więcej dla admina - liczy to backend). Po osiągnięciu
    // limitu - i gdyby konto miało postaci ponad limit, np. po obniżeniu rangi -
    // pustej karty nie ma wcale.
    const slots = useMemo(() => {
        const arr = [...characters];
        if (arr.length < maxCharacters) arr.push(null);
        return arr;
    }, [characters, maxCharacters]);

    // Liczba kart zmienia się (nowa postać, usunięcie, wczytanie limitu), więc
    // pilnujemy, żeby wskaźnik nie został poza zakresem - inaczej żadna karta nie
    // byłaby na środku.
    useEffect(() => {
        setCurrentIndex((prev) => (prev > slots.length - 1 ? Math.max(0, slots.length - 1) : prev));
    }, [slots.length]);

    const getPosition = (index) => {
        if (index === currentIndex) return 'center';
        if (index === (currentIndex - 1 + slots.length) % slots.length) return 'left';
        if (index === (currentIndex + 1) % slots.length) return 'right';
        return 'hidden';
    };

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === 'ArrowLeft') handlePrevious();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'Enter') {
                const current = slots[currentIndex];
                if (current) handleSelectCharacter(current);
                else handleCreateCharacter();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentIndex, slots]);

    if (!residentMessageChecked) {
        return (
            <Box sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: theme.palette.background.default,
            }}>
                <Typography sx={{ 
                    color: theme.palette.text.primary, 
                    fontSize: '2rem', 
                    
                    letterSpacing: '0.05em',
                }}>
                    SPRAWDZANIE STATUSU...
                </Typography>
            </Box>
        );
    }

    if (hasResidentMessage && residentMessageData) {
        if (isRegularPlayer(user?.role)) {
            return (
                <Box sx={{
                    minHeight: '100vh',
                    bgcolor: theme.palette.background.default,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3,
                }}>
                    <Paper sx={{
                        maxWidth: '800px',
                        width: '100%',
                        bgcolor: theme.palette.background.paper,
                        border: `2px solid ${theme.palette.error.main}`,
                        borderRadius: '4px',
                        p: 4,
                        boxShadow: `0 8px 32px ${theme.palette.error.main}60`,
                    }}>
                        <Typography variant="h3" sx={{
                            color: theme.palette.error.text,
                            
                            letterSpacing: '0.05em',
                            textAlign: 'center',
                            mb: 3,
                            textTransform: 'uppercase',
                        }}>
                            ⚠️ KOMUNIKAT SYSTEMOWY
                        </Typography>

                        <Typography variant="h5" sx={{
                            color: theme.palette.text.primary,
                            
                            textAlign: 'center',
                            mb: 3,
                        }}>
                            {residentMessageData.title}
                        </Typography>

                        <Box
                            sx={{
                                bgcolor: 'rgba(220, 38, 38, 0.1)',
                                border: `1px solid ${theme.palette.error.main}`,
                                borderRadius: '4px',
                                p: 3,
                                mb: 3,
                                color: theme.palette.text.primary,
                                
                                '& p': { mb: 2 },
                                '& h1, & h2, & h3': { color: theme.palette.text.primary, mb: 2 },
                            }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(residentMessageData.content) }}
                        />

                        <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            mb: 3,
                            color: theme.palette.text.secondary,
                            fontSize: '0.85rem',
                            
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
                            fullWidth
                            variant="contained"
                            onClick={handleLogout}
                            startIcon={<LogoutIcon />}
                            sx={{
                                bgcolor: theme.palette.primary.main,
                                color: theme.palette.text.primary,
                                
                                fontWeight: 'bold',
                                letterSpacing: '0.05em',
                                py: 1.5,
                                borderRadius: '4px',
                                '&:hover': {
                                    bgcolor: theme.palette.primary.light,
                                    boxShadow: `0 4px 20px ${theme.palette.primary.main}80`,
                                },
                            }}
                        >
                            Odejdź
                        </Button>
                    </Paper>
                </Box>
            );
        }
    }

    if (loading) {
        return (
            <Box sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: appColors.bgDeep,
                gap: 2,
            }}>
                <Typography sx={{
                    color: appColors.textMuted,
                    fontSize: '0.75rem',
                    
                    letterSpacing: '0.25em',
                    mb: 1,
                }}>
                    // INICJALIZACJA SYSTEMU
                </Typography>
                <Typography sx={{
                    color: appColors.steelLight,
                    fontSize: '1.6rem',
                    
                    letterSpacing: '0.15em',
                }}>
                    ŁADOWANIE
                    <Box component="span" sx={{ animation: 'blink 1s step-end infinite' }}>_</Box>
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            bgcolor: theme.palette.background.default,
            // Ta sama grafika zniszczonego świata co ekrany logowania/gry - spójny,
            // mroczny klimat low-fantasy zamiast płaskiego czarnego tła (dawny
            // /lobby-bg.jpg nie istniał, więc lobby było wypłukane z klimatu).
            backgroundImage: 'var(--game-bg-image)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            py: 4,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                inset: 0,
                // Delikatna ramka ambientu (środek przezroczysty, subtelny ciepły
                // brzeg) zamiast pełnej zasłony - grafika świata jest ostra. W lobby
                // neutralna (karuzela pokazuje różne rasy); w grze /home barwi ją rasa.
                background: subtleAmbientOverlay,
            },
            '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                // Lżejsza winieta (było 0.85/220px - za ciemno) - subtelne ściemnienie rogów.
                boxShadow: 'inset 0 0 180px 40px rgba(20,10,8,0.55)',
            }
        }}>
            <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
                {/* Baner trybu NPC - żeby admin nigdy nie zgadywał, czyim kontem gra */}
                {npcMode && (
                    <Box sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1.5,
                        mb: 2,
                        px: 2.5,
                        py: 1.25,
                        border: `2px solid ${theme.palette.warning.main}`,
                        borderRadius: '2px',
                        bgcolor: `${appColors.bgDeep}cc`,
                        backdropFilter: 'blur(6px)',
                    }}>
                        <TheaterComedyIcon sx={{ color: theme.palette.warning.main }} />
                        <Typography sx={{
                            color: theme.palette.warning.main,
                            fontWeight: 'bold',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontSize: '0.85rem',
                        }}>
                            Tryb NPC — wspólne subkonto administracji
                        </Typography>
                        <Typography sx={{ color: appColors.steelLight, fontSize: '0.8rem' }}>
                            Każda postać NPC ma własne sesje i wiadomości.
                            {user?.npcOwnerName ? ` Twoje konto: ${user.npcOwnerName}.` : ''}
                        </Typography>
                    </Box>
                )}

                <Box sx={{
                    position: 'relative',
                    minHeight: '700px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    perspective: '2500px',
                    mb: 4,
                }}>
                    {/* Przy jednej karcie nie ma czego przewijać - strzałki chowamy. */}
                    {!isMobile && slots.length > 1 && (
                    <IconButton
                        onClick={handlePrevious}
                        sx={{
                            position: 'absolute',
                            left: { xs: 10, md: 50 },
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 40,
                            width: 56,
                            height: 56,
                            bgcolor: `${appColors.bgDeep}cc`,
                            border: `2px solid ${appColors.rust}`,
                            borderRadius: '2px',
                            color: appColors.rustLight,
                            backdropFilter: 'blur(4px)',
                            '&:hover': {
                                bgcolor: `${appColors.rust}33`,
                                borderColor: appColors.rustLight,
                                color: appColors.textLight,
                                transform: 'translateY(-50%) scale(1.05)',
                                boxShadow: `0 0 16px ${appColors.rust}66`,
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <ChevronLeftIcon sx={{ fontSize: 30 }} />
                    </IconButton>
                    )}

                    <Box
                        onTouchStart={isMobile ? handleTouchStart : undefined}
                        onTouchEnd={isMobile ? handleTouchEnd : undefined}
                        sx={{
                        position: 'relative',
                        width: '100%',
                        height: { xs: 450, sm: 550, md: 650 },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'pan-y',
                    }}>
                        {slots.map((slot, index) => (
                            <CharacterCard3D
                                key={index}
                                character={slot}
                                isCenter={index === currentIndex}
                                position={getPosition(index)}
                                onClick={slot ? handleSelectCharacter : handleCreateCharacter}
                                isSelecting={selectingCharacter === slot?.id}
                                onReset={handleResetCharacter}
                                onDelete={handleDeleteCharacter}
                            />
                        ))}
                    </Box>

                    {!isMobile && slots.length > 1 && (
                    <IconButton
                        onClick={handleNext}
                        sx={{
                            position: 'absolute',
                            right: { xs: 10, md: 50 },
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 40,
                            width: 56,
                            height: 56,
                            bgcolor: `${appColors.bgDeep}cc`,
                            border: `2px solid ${appColors.rust}`,
                            borderRadius: '2px',
                            color: appColors.rustLight,
                            backdropFilter: 'blur(4px)',
                            '&:hover': {
                                bgcolor: `${appColors.rust}33`,
                                borderColor: appColors.rustLight,
                                color: appColors.textLight,
                                transform: 'translateY(-50%) scale(1.05)',
                                boxShadow: `0 0 16px ${appColors.rust}66`,
                            },
                            transition: 'all 0.3s ease',
                        }}
                    >
                        <ChevronRightIcon sx={{ fontSize: 30 }} />
                    </IconButton>
                    )}
                </Box>

                {/* Podpowiedź gestu na telefonach - strzałki są ukryte, karuzela reaguje na swipe */}
                {isMobile && slots.length > 1 && (
                    <Typography sx={{
                        textAlign: 'center',
                        color: appColors.textMuted,
                        fontSize: '0.75rem',
                        letterSpacing: '0.1em',
                        mb: 1.5,
                        mt: -1,
                    }}>
                        ‹ przesuń palcem, aby zmienić postać ›
                    </Typography>
                )}

                {/* Kropki nawigacji mają sens dopiero od dwóch kart wzwyż. */}
                <Box sx={{
                    display: slots.length > 1 ? 'flex' : 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1.5,
                    mb: 4,
                }}>
                    {slots.map((_, idx) => (
                        <Box
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            sx={{
                                width: currentIndex === idx ? 36 : 10,
                                height: 4,
                                bgcolor: currentIndex === idx ? theme.palette.primary.main : appColors.steel,
                                borderRadius: '1px',
                                cursor: 'pointer',
                                transition: 'all 0.35s ease',
                                boxShadow: currentIndex === idx ? `0 0 8px ${theme.palette.primary.main}` : 'none',
                                '&:hover': {
                                    bgcolor: currentIndex === idx ? theme.palette.primary.light : appColors.steelLight,
                                    transform: 'scaleY(1.5)',
                                }
                            }}
                        />
                    ))}
                </Box>

                <Box sx={{ mt: 4, textAlign: "center" }}>
                    {/* Etykieta wędrowca (aktywnego konta) */}
                    <Box sx={{
                        display: 'inline-block',
                        mb: 2.5,
                        border: `1px solid ${appColors.borderSteel}`,
                        borderRadius: '2px',
                        px: 3,
                        py: 1.5,
                        bgcolor: `${appColors.bgDeep}99`,
                        backdropFilter: 'blur(6px)',
                        position: 'relative',
                        '&::before': {
                            content: npcMode ? '"Subkonto NPC"' : '"Wędrowiec"',
                            position: 'absolute',
                            top: -9,
                            left: 12,
                            bgcolor: appColors.bgDeep,
                            color: appColors.textMuted,
                            fontSize: '0.6rem',
                            letterSpacing: '0.2em',
                            px: 0.75,
                            
                        },
                    }}>
                        <Typography variant="h4" sx={{
                            fontWeight: 700,
                            color: appColors.textLight,
                            
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            fontSize: { xs: '1.4rem', md: '1.8rem' },
                        }}>
                            {player || "Wędrowiec"}
                        </Typography>
                    </Box>

                    <Stack
                        direction="row"
                        spacing={1.5}
                        justifyContent="center"
                        alignItems="center"
                        sx={{ mb: 3 }}
                    >
                        <Chip
                            icon={<PersonIcon sx={{ color: `${appColors.steel} !important` }} />}
                            label={`${characters.length}/${maxCharacters} postaci`}
                            sx={{
                                bgcolor: 'transparent',
                                color: appColors.textPrimary,
                                border: `1px solid ${appColors.steel}`,
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                height: 36,
                                
                                borderRadius: '2px',
                                letterSpacing: '0.08em',
                            }}
                        />
                        <Tooltip title={refreshing ? "Odświeżanie..." : "Odśwież listę"} arrow>
                            <IconButton
                                onClick={handleRefresh}
                                disabled={refreshing}
                                sx={{
                                    bgcolor: 'transparent',
                                    border: `1px solid ${appColors.steel}`,
                                    borderRadius: '2px',
                                    color: appColors.steelLight,
                                    '&:hover': {
                                        bgcolor: `${appColors.steel}22`,
                                        borderColor: appColors.steelLighter,
                                        color: appColors.textLight,
                                    },
                                }}
                            >
                                <RefreshIcon sx={{
                                    animation: refreshing ? 'spin 1s linear infinite' : 'none'
                                }} />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent="center"
                        alignItems="center"
                    >
                        {/* Przełącznik subkonta NPC - widoczny tylko dla administracji */}
                        {(canEnterNpcMode || npcMode) && (
                            <Button
                                startIcon={npcMode ? <KeyboardReturnIcon /> : <TheaterComedyIcon />}
                                onClick={handleToggleNpcMode}
                                disabled={npcSwitching}
                                sx={{
                                    px: 4,
                                    py: 1.25,
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    letterSpacing: '0.1em',
                                    borderRadius: '2px',
                                    border: `2px solid ${theme.palette.warning.main}`,
                                    color: theme.palette.warning.main,
                                    bgcolor: 'transparent',
                                    '&:hover': {
                                        bgcolor: `${theme.palette.warning.main}22`,
                                        color: appColors.textLight,
                                        boxShadow: `0 0 12px ${theme.palette.warning.main}60`,
                                    },
                                    '&:disabled': {
                                        borderColor: appColors.steel,
                                        color: appColors.textMuted,
                                    },
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {npcSwitching
                                    ? 'Przełączanie...'
                                    : npcMode ? 'Wróć na swoje konto' : 'NPC'}
                            </Button>
                        )}

                        <Button
                            startIcon={<LogoutIcon />}
                            onClick={handleLogout}
                            sx={{
                                px: 4,
                                py: 1.25,
                                fontSize: '0.9rem',
                                fontWeight: 'bold',

                                letterSpacing: '0.1em',
                                borderRadius: '2px',
                                border: `2px solid ${appColors.dangerBorder}`,
                                color: appColors.dangerText,
                                bgcolor: 'transparent',
                                '&:hover': {
                                    bgcolor: `${appColors.dangerBorder}22`,
                                    borderColor: appColors.dangerText,
                                    color: appColors.textLight,
                                    boxShadow: `0 0 12px ${appColors.dangerBorder}60`,
                                },
                                transition: 'all 0.3s ease',
                            }}
                        >
                            Odejdź
                        </Button>
                    </Stack>
                </Box>
            </Container>

            <ResetCharacterDialog
                open={resetDialog.open}
                character={resetDialog.character}
                onClose={() => setResetDialog({ open: false, character: null })}
                onConfirm={handleConfirmReset}
            />

            <DeleteCharacterDialog
                open={deleteDialog.open}
                character={deleteDialog.character}
                onClose={() => setDeleteDialog({ open: false, character: null })}
                onConfirm={handleConfirmDelete}
            />

            <GameToaster style={toastStyle.style} duration={4000} />

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes activePulse {
                    0%, 100% { box-shadow: 0 0 12px var(--primary-glow, #7a3b0f80), 0 0 4px var(--primary-glow, #7a3b0f); opacity: 1; }
                    50% { box-shadow: 0 0 24px var(--primary-glow, #7a3b0f), 0 0 8px var(--primary-glow, #7a3b0f); opacity: 0.85; }
                }
                @keyframes borderPulse {
                    0%, 100% { border-color: #4a5568; }
                    50% { border-color: #718096; }
                }
                @keyframes slotPulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50% { opacity: 0.9; transform: scale(1.05); }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>

            <EngineFooter />
        </Box>
    );
}

// EXPORT NA KOŃCU
export default CharacterLobby;