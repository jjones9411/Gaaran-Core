import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box, Typography, Paper, CircularProgress, useMediaQuery, Chip
} from '@mui/material';
import {
  Article as ArticleIcon,
  EmojiEvents as TrophyIcon,
  ReportProblem as ProblemIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  AccessTime as ExpiredIcon,
  CalendarToday as CalendarIcon,
  Shield as ShieldIcon,
  DirectionsRun as RunIcon,
  Security as SecurityIcon,
  Whatshot as WhatshotIcon,
} from '@mui/icons-material';
import { appColors } from './theme';

// Semantyczne kolory zdarzeń brane z tokenów motywu (appColors.status*) zamiast
// z zaszytych na sztywno neonów - spójne z resztą UI, nadal czytelne i znaczące.
const LOG_COLORS = {
  success: appColors.statusSuccess,
  danger: appColors.statusDanger,
  gold: appColors.statusGold,
  warning: appColors.statusWarning,
  neutral: appColors.statusNeutral,
};

const formatDate = (dateString) => {
  if (!dateString) return 'Brak daty';
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getLogIcon = (type) => {
  const c = getLogColor(type);
  switch(type) {
    case 'achievement_added': return <TrophyIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'achievement_expired': return <ExpiredIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'problem_added': return <ProblemIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'problem_expired': return <ExpiredIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'card_approved': return <ApprovedIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'card_rejected': return <RejectedIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'pvp_victory': return <TrophyIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'pvp_defeat': return <WhatshotIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'pvp_defended': return <ShieldIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'pvp_defeated': return <SecurityIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'pvp_chase_failed': return <RunIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    case 'pvp_escaped': return <RunIcon sx={{ color: c, fontSize: '1.5rem' }} />;
    default: return <ArticleIcon sx={{ color: c, fontSize: '1.5rem' }} />;
  }
};

const getLogColor = (type) => {
  switch(type) {
    case 'achievement_added':
    case 'card_approved':
    case 'pvp_defended':
    case 'pvp_escaped':
      return LOG_COLORS.success;
    case 'pvp_victory':
      return LOG_COLORS.gold;
    case 'problem_added':
    case 'card_rejected':
    case 'pvp_defeat':
    case 'pvp_defeated':
      return LOG_COLORS.danger;
    case 'pvp_chase_failed':
      return LOG_COLORS.warning;
    case 'achievement_expired':
    case 'problem_expired':
      return LOG_COLORS.neutral;
    default:
      return LOG_COLORS.neutral;
  }
};

const getLogTypeLabel = (type) => {
  switch(type) {
    case 'achievement_added': return 'DODANO KONSEKWENCJĘ +';
    case 'achievement_expired': return 'WYGASŁA KONSEKWENCJA +';
    case 'problem_added': return 'DODANO KONSEKWENCJĘ -';
    case 'problem_expired': return 'WYGASŁA KONSEKWENCJA -';
    case 'card_approved': return 'KARTA ZAAKCEPTOWANA';
    case 'card_rejected': return 'KARTA ODRZUCONA';
    case 'pvp_victory': return 'ZWYCIĘSTWO PVP';
    case 'pvp_defeat': return 'PORAŻKA PVP';
    case 'pvp_defended': return 'UDANA OBRONA';
    case 'pvp_defeated': return 'POKONANY W PVP';
    case 'pvp_chase_failed': return 'NIEUDANY POŚCIG';
    case 'pvp_escaped': return 'UDANA UCIECZKA';
    default: return 'WPIS';
  }
};

function Logs() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:600px)');

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/home/logs', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
        } else {
          setError('Błąd ładowania logów');
        }
      } catch (err) {
        console.error('Błąd ładowania logów:', err);
        setError('Błąd połączenia z serwerem');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [navigate]);

  // Auto-markowanie logów jako przeczytane po 2 sekundach
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const markLogsAsSeen = async () => {
      try {
        await fetch('/api/home/logs/mark-seen', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        // Powiadom Home.js o aktualizacji powiadomień
        window.dispatchEvent(new CustomEvent('logsUpdated'));
      } catch (error) {
        console.error('Błąd oznaczania logów jako przeczytane:', error);
      }
    };

    const timer = setTimeout(markLogsAsSeen, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
      }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ 
        p: 3,
        backgroundColor: theme.palette.background.paper,
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 0
      }}>
        <Typography sx={{ 
          color: theme.palette.error.text, 
          
          textTransform: 'uppercase'
        }}>
          ⚠️ {error}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{
      display: 'flex',
      flexDirection: 'column',
      p: 2,
      color: theme.palette.text.primary,
      width: '100%',
      backgroundColor: theme.palette.background.paper,
      border: `2px solid ${theme.palette.divider}`,
      borderRadius: 0,
      boxShadow: 'none'
    }}>
      {/* LOGI */}
      {logs.length === 0 ? (
        <Box sx={{
          p: 4,
          textAlign: 'center',
          backgroundColor: theme.palette.background.default,
          border: `2px dashed ${theme.palette.divider}`,
          borderRadius: 0
        }}>
          <ArticleIcon sx={{
            fontSize: '4rem',
            color: theme.palette.text.secondary,
            mb: 2,
            opacity: 0.3
          }} />
          <Typography sx={{
            color: theme.palette.text.secondary,
            fontStyle: 'italic',
            
            fontSize: '1rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            // BRAK WPISÓW W KRONICE //
          </Typography>
          <Typography sx={{
            color: theme.palette.text.secondary,
            
            fontSize: '0.85rem',
            mt: 1,
            opacity: 0.7
          }}>
            Twoja historia dopiero się zaczyna...
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {logs.map((log) => {
            const logColor = getLogColor(log.type);

            return (
              <Box
                key={log.id}
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.default,
                  border: `2px solid ${theme.palette.divider}`,
                  borderRadius: 0,
                  borderLeft: `6px solid ${logColor}`,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateX(8px)',
                    borderColor: logColor,
                    boxShadow: `0 0 20px ${logColor}40`,
                    '&::before': {
                      opacity: 1
                    }
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: `linear-gradient(to bottom, ${logColor}00, ${logColor}, ${logColor}00)`,
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }
                }}
              >
                {/* HEADER LOGU */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.5,
                  pb: 1.5,
                  borderBottom: `1px solid ${theme.palette.divider}`
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                      filter: `drop-shadow(0 0 4px ${logColor})`
                    }}>
                      {getLogIcon(log.type)}
                    </Box>
                    
                    <Chip 
                      label={getLogTypeLabel(log.type)}
                      size="small"
                      sx={{ 
                        backgroundColor: `${logColor}20`,
                        color: logColor,
                        fontWeight: 'bold',
                        
                        fontSize: '0.7rem',
                        border: `1px solid ${logColor}`,
                        letterSpacing: '0.05em',
                        px: 1
                      }}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon sx={{ fontSize: '0.9rem', color: theme.palette.text.secondary }} />
                    <Typography sx={{ 
                      color: theme.palette.text.secondary, 
                      fontSize: '0.75rem',
                      
                      textTransform: 'uppercase'
                    }}>
                      {formatDate(log.created_at)}
                    </Typography>
                  </Box>
                </Box>

                {/* CONTENT */}
                <Box>
                  {/* WIADOMOŚĆ */}
                  <Typography sx={{
                    color: theme.palette.text.primary,
                    
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    pl: 2,
                    borderLeft: `3px solid ${logColor}`
                  }}>
                    {log.message}
                  </Typography>
                </Box>

                {/* DECORATION - SCANLINES */}
                <Box sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                  opacity: theme.palette.mode === 'dark' ? 0.03 : 0.02,
                  background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${
                    theme.palette.mode === 'dark' ? theme.palette.primary.contrastText : theme.palette.text.secondary
                  } 2px, ${
                    theme.palette.mode === 'dark' ? theme.palette.primary.contrastText : theme.palette.text.secondary
                  } 4px)`
                }} />
              </Box>
            );
          })}
        </Box>
      )}

      {/* FOOTER - INFO */}
      {logs.length > 0 && (
        <Box sx={{
          mt: 3,
          pt: 2,
          borderTop: `2px solid ${theme.palette.divider}`,
          textAlign: 'center'
        }}>
          <Typography sx={{
            color: theme.palette.text.secondary,
            
            fontSize: '0.75rem',
            opacity: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            // WYŚWIETLONO {logs.length} {logs.length === 1 ? 'WPIS' : logs.length < 5 ? 'WPISY' : 'WPISÓW'} //
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

export default Logs;