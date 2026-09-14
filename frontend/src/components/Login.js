import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  Box, Button, TextField, Typography, Paper, Fade, Container, Grid, Chip, InputAdornment,
  useMediaQuery, useTheme
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AuthBackdrop from './AuthBackdrop';
import AuthFrame from './AuthFrame';
import { appColors, authPanelSx, authFieldSx, authGold, authGoldLight } from './theme';
import useGameName from './useGameName';

// Dark fantasy - "Cinzel" (nagłówki/etykiety, ma ciężar rzymskiego kamienia)
// + "EB Garamond" (tekst dłuższy - kroniki, treść), zamiast terminalowego
// monospace z poprzedniego, postapo stylu tego ekranu.

const COLORS = {
  background: appColors.bgDeep,
  backgroundLight: appColors.bgSurface,
  rust: appColors.rust,
  rustLight: appColors.rustLight,
  rustDark: appColors.rustDark,
  steel: appColors.steel,
  steelLight: appColors.steelLight,
  secondary: appColors.textPrimary,
  border: appColors.rustBorder,
  bloodRust: appColors.dangerText,
  glassRust: appColors.glassRust,
};

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const gameName = useGameName();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBlockedMessage, setShowBlockedMessage] = useState(false);
  const [blockedMessageData, setBlockedMessageData] = useState(null);
  const [publicNews, setPublicNews] = useState([]);
  const [expandedNewsId, setExpandedNewsId] = useState(null);

  // Wysokość prawego panelu (wieści) jest przypięta do rzeczywistej,
  // zmierzonej wysokości lewej kolumny - zamiast rosnąć/kurczyć się przy
  // rozwijaniu wieści, box ma stałą wysokość i przewija się wewnątrz.
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const leftColRef = useRef(null);
  const [leftColHeight, setLeftColHeight] = useState(null);

  useLayoutEffect(() => {
    if (!isDesktop || !leftColRef.current) {
      setLeftColHeight(null);
      return;
    }
    const el = leftColRef.current;
    const update = () => setLeftColHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop]);

  useEffect(() => {
    fetch('/api/news/public')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => Array.isArray(data) ? setPublicNews(data) : null)
      .catch(() => {});
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Proszę wypełnić wszystkie pola');
      }

      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      // SPRAWDŹ BLOKADĘ
      if (response.status === 403 && data.blocked) {
        setShowBlockedMessage(true);
        setBlockedMessageData({
          title: 'Wygnanie',
          content: `
            <p><strong>Twoje konto zostało zablokowane do:</strong> ${data.blockedUntil}</p>
            <p><strong>Pozostało:</strong> ${data.daysLeft} dni (około ${data.hoursLeft} godzin)</p>
            <p><strong>Powód:</strong> ${data.blockReason || 'Naruszenie regulaminu'}</p>
            <hr />
            <p>Jeśli uważasz, że blokada została nałożona niesłusznie, skontaktuj się z administracją.</p>
          `,
          blockedUntil: data.blockedUntil,
          daysLeft: data.daysLeft,
          hoursLeft: data.hoursLeft
        });
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Błąd logowania');
      }

      // TYLKO TO - login() z AuthContext zapisze token i załaduje user
      if (data.token) {
        login(data.token);
      }

      // ❌ USUŃ TO - już nie potrzebne (dane są w tokenie)
      // if (data.userId) localStorage.setItem('userId', data.userId);
      // if (data.userRole) localStorage.setItem('userRole', data.userRole);

      // ❌ USUŃ TO - avatar też jest w tokenie (user.characterAvatar)
      // try {
      //   const profileRes = await fetch(`/api/home/profile/${data.userId}`, {
      //     headers: { Authorization: `Bearer ${data.token}` }
      //   });
      //   const profileData = await profileRes.json();
      //   if (profileRes.ok && profileData?.profileData) {
      //     if (profileData.profileData.avatar) {
      //       localStorage.setItem('avatarUrl', `/api${profileData.profileData.avatar}`);
      //     }
      //     if (profileData.profileData.userName) {
      //       localStorage.setItem('userName', profileData.profileData.userName);
      //     }
      //   }
      // } catch (profileError) {
      //   console.error('Błąd pobierania profilu:', profileError);
      // }

      navigate('/lobby');

    } catch (err) {
      console.error('Błąd logowania:', err);
      setError(err?.message || 'Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  // ===========================
  // EKRAN BLOKADY KONTA
  // ===========================
  if (showBlockedMessage && blockedMessageData) {
    return (
      <Box sx={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: COLORS.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <AuthBackdrop />
        
        <Fade in={true} timeout={1000}>
          <Box sx={{
            maxWidth: '800px',
            width: '90%',
            background: `rgba(0, 0, 0, 0.95)`,
            backdropFilter: 'blur(20px)',
            border: `3px solid ${COLORS.bloodRust}`,
            borderRadius: '0',
            p: { xs: 3, md: 5 },
            textAlign: 'center',
            boxShadow: `0 0 40px rgba(155, 44, 44, 0.5), inset 0 0 50px rgba(0, 0, 0, 0.5)`,
            position: 'relative',
            zIndex: 10
          }}>
            <Typography variant="h2" sx={{
              color: COLORS.bloodRust,
              
              fontWeight: 'bold',
              mb: 4,
              fontSize: { xs: '2rem', md: '3rem' },
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              ⚔ {blockedMessageData.title}
            </Typography>

            <Box sx={{ 
              mb: 5,
              color: COLORS.secondary,
              fontSize: '1.15rem',
              lineHeight: 1.7,
              
              textAlign: 'left',
              background: 'rgba(155, 44, 44, 0.1)',
              border: `1px solid ${COLORS.bloodRust}`,
              borderRadius: '4px',
              p: 3
            }} dangerouslySetInnerHTML={{
              __html: sanitizeHtml(blockedMessageData.content) }} />

            <Button 
              variant="contained" 
              onClick={() => {
                localStorage.clear();
                setShowBlockedMessage(false);
                setBlockedMessageData(null);
                window.location.reload();
              }}
              sx={{
                background: COLORS.bloodRust,
                color: COLORS.background,
                
                fontWeight: 'bold',
                fontSize: '1.1rem',
                px: 6, py: 2,
                borderRadius: '0',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                border: `2px solid ${COLORS.rustDark}`,
                '&:hover': {
                  background: COLORS.rust,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 15px 40px rgba(155, 44, 44, 0.6)`
                }
              }}
            >
              Odejdź
            </Button>
          </Box>
        </Fade>
      </Box>
    );
  }

  // ===========================
  // EKRAN LOGOWANIA
  // ===========================
return (
  <Box sx={{
    backgroundColor: COLORS.background,
    minHeight: '100vh',
    display: 'flex',
    alignItems: { xs: 'flex-start', md: 'center' },
    justifyContent: 'center',
    position: 'relative',
    overflowX: 'hidden',
    p: { xs: 1.5, sm: 2 },
  }}>
    <AuthBackdrop />

    <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 10, py: { xs: 2, md: 3 } }}>
      <Fade in={true} timeout={1200}>
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: { xs: 'stretch', md: 'flex-start' } }}>

            {/* LEWA STRONA - INFO O GRZE + FORMULARZ */}
            <Grid item xs={12} md={7} sx={{ order: { xs: 1, md: 1 }, display: 'flex' }}>
              <Box ref={leftColRef} sx={{
                ...authPanelSx,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2.5, md: 3 },
                overflow: 'visible',
                p: { xs: 2.5, sm: 3, md: 4 },
                position: 'relative',
              }}>
                <AuthFrame />
                {/* TYTUŁ */}
                <Box>
                  <Typography variant="h1" sx={{
                    
                    fontWeight: 'bold',
                    fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem', lg: '3.75rem' },
                    color: authGoldLight,
                    letterSpacing: '0.05em',
                    textShadow: `0 0 18px ${authGold}66, 2px 2px 4px rgba(0,0,0,0.9)`,
                    mb: 1
                  }}>
                    {gameName}
                  </Typography>
                  <Typography sx={{
                    color: COLORS.steelLight,
                    
                    fontStyle: 'italic',
                    fontSize: '1rem',
                    letterSpacing: '0.06em',
                    opacity: 0.85,
                  }}>
                    ✦ Kroniki spisane atramentem i krwią ✦
                  </Typography>
                </Box>

                {/* OSTRZEŻENIE 18+ */}
                <Box sx={{
                  background: 'rgba(28, 12, 12, 0.6)',
                  border: `1px solid rgba(192,57,43,0.55)`,
                  borderLeft: `3px solid #c0392b`,
                  p: 2,
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <WarningAmberIcon sx={{ color: '#e88a8a', fontSize: '1.1rem' }} />
                    <Typography sx={{
                      color: '#e88a8a',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      letterSpacing: '0.08em',
                    }}>
                      Treści dla dorosłych
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {['18+', 'Przemoc', 'Substancje', 'Język'].map((tag) => (
                      <Chip key={tag} label={tag} size="small" sx={{
                        background: 'rgba(150, 40, 40, 0.55)',
                        color: '#f4e9e9',
                        fontSize: '0.65rem',
                        border: `1px solid rgba(192,57,43,0.6)`,
                        borderRadius: '2px',
                        fontWeight: 'bold',
                      }} />
                    ))}
                  </Box>
                </Box>

                {/* FORMULARZ LOGOWANIA */}
                <Paper sx={{
                  ...authPanelSx,
                  ...authFieldSx,
                  p: { xs: 2.5, sm: 3, md: 3.5 },
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${COLORS.rust}, ${COLORS.rustLight}, ${COLORS.rust}, transparent)`,
                  },
                  '&::after': {
                    content: '"⚜ Wrota Królestwa ⚜"',
                    position: 'absolute',
                    top: 0,
                    right: 14,
                    transform: 'translateY(-50%)',
                    
                    fontSize: '0.65rem',
                    letterSpacing: '0.1em',
                    color: COLORS.rustDark,
                    background: appColors.bgBlack,
                    padding: '0 8px',
                  },
                }}>
                  {/* Ozdobna ramka jak w grze (metalowe narożniki) */}
                  <AuthFrame />

                  <Typography variant="h4" sx={{
                    color: authGoldLight,

                    textAlign: 'center',
                    mb: { xs: 2, md: 2.5 },
                    fontWeight: 700,
                    // Cap na mobile - domyślny h4 wychodził poza box na wąskim ekranie.
                    fontSize: { xs: '1.45rem', sm: '1.9rem', md: '2.125rem' },
                    letterSpacing: { xs: '0.04em', sm: '0.08em' },
                    textShadow: '1px 1px 3px rgba(0,0,0,0.9)'
                  }}>
                    Przybywaj, Wędrowcze
                  </Typography>

                  <form onSubmit={handleSubmit}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      placeholder="Adres poczty"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailOutlinedIcon sx={{ color: COLORS.steel, fontSize: '1.1rem' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: { xs: 1.5, md: 2 },
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '0',
                          
                          '& fieldset': { borderColor: COLORS.border },
                          '&:hover fieldset': { borderColor: COLORS.rust },
                          '&.Mui-focused fieldset': { borderColor: COLORS.rust, borderWidth: '2px' },
                          '& input': { color: COLORS.secondary,  fontSize: '1.05rem' },
                          '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                        }
                      }}
                    />

                    <TextField
                      fullWidth
                      type="password"
                      variant="outlined"
                      placeholder="Hasło"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon sx={{ color: COLORS.steel, fontSize: '1.1rem' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: { xs: 2, md: 2.5 },
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '0',
                          
                          '& fieldset': { borderColor: COLORS.border },
                          '&:hover fieldset': { borderColor: COLORS.rust },
                          '&.Mui-focused fieldset': { borderColor: COLORS.rust, borderWidth: '2px' },
                          '& input': { color: COLORS.secondary,  fontSize: '1.05rem' },
                          '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                        }
                      }}
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      type="submit"
                      disabled={loading}
                      sx={{
                        background: COLORS.rust,
                        color: COLORS.background,
                        
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        py: { xs: 1, md: 1.5 },
                        mb: { xs: 1.5, md: 2 },
                        borderRadius: '0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        border: `2px solid ${COLORS.rustDark}`,
                        '&:hover': {
                          background: COLORS.rustLight,
                          transform: 'translateY(-2px)',
                          borderColor: COLORS.rust,
                          boxShadow: '0 10px 30px rgba(139, 69, 19, 0.5)'
                        },
                        '&:disabled': { background: COLORS.steel, opacity: 0.6 }
                      }}
                    >
                      {loading ? 'Otwieram wrota...' : 'Przekrocz próg'}
                    </Button>
                  </form>

                  {error && (
                    <Typography color="error" sx={{
                      textAlign: 'center',
                      
                      fontSize: '1rem',
                      mb: 2,
                      background: 'rgba(155, 44, 44, 0.3)',
                      p: 2,
                      border: `1px solid ${COLORS.bloodRust}`,
                      textShadow: '0 0 10px rgba(220, 38, 38, 0.8)',
                    }}>
                      ⚠ {error}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 2 } }}>
                    <Button
                      fullWidth
                      variant="text"
                      disabled={loading}
                      onClick={() => navigate('/resetpassword')}
                      sx={{
                        color: COLORS.steel,
                        
                        textTransform: 'uppercase',
                        fontSize: '0.8rem',
                        '&:hover': { background: COLORS.glassRust, color: COLORS.steelLight }
                      }}
                    >
                      Zapomniane hasło
                    </Button>

                    <Button
                      fullWidth
                      variant="outlined"
                      disabled={loading}
                      onClick={() => navigate('/register')}
                      sx={{
                        borderColor: COLORS.border,
                        color: COLORS.rust,
                        
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        fontSize: '0.9rem',
                        borderWidth: '2px',
                        borderRadius: '0',
                        py: 1,
                        '&:hover': {
                          background: COLORS.glassRust,
                          borderColor: COLORS.rust,
                          transform: 'translateY(-2px)',
                          boxShadow: '0 5px 20px rgba(139, 69, 19, 0.4)'
                        }
                      }}
                    >
                      Rozpocznij wędrówkę
                    </Button>
                  </Box>
                </Paper>

                {/* PRZYCISK: DISCORD */}
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => window.open('https://discord.gg/4BCqgz8zBZ', '_blank')}
                    sx={{
                      borderColor: COLORS.steel,
                      color: COLORS.steelLight,
                      
                      fontSize: '0.85rem',
                      px: 3, py: 1,
                      borderRadius: '0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: `2px solid ${COLORS.steel}`,
                      '&:hover': {
                        background: COLORS.glassRust,
                        borderColor: COLORS.rust,
                        color: COLORS.rust,
                        transform: 'translateY(-2px)',
                        boxShadow: '0 5px 15px rgba(139, 69, 19, 0.4)'
                      }
                    }}
                  >
                    ⚜ Dołącz na Discordzie
                  </Button>
                </Box>
              </Box>
            </Grid>

            {/* PRAWA STRONA - WIEŚCI Z ACCORDION */}
            <Grid item xs={12} md={5} sx={{ order: { xs: 2, md: 2 }, display: 'flex', overflow: 'hidden' }}>
              <Box sx={{
                ...authPanelSx,
                width: '100%',
                height: { xs: 'auto', md: leftColHeight ? `${leftColHeight}px` : 'auto' },
                minHeight: { xs: '260px', md: 0 },
                maxHeight: { xs: '55vh', md: leftColHeight ? `${leftColHeight}px` : '75vh' },
                display: 'flex',
                flexDirection: 'column',
                // Panel ma widoczną ramkę PNG (authPanelSx) - overflow musi być
                // visible, inaczej ramka w pasie borderu zostałaby przycięta.
                // Przewijanie wieści realizuje wewnętrzny box (overflowY:auto).
                overflow: 'visible',
                p: { xs: 2.5, sm: 3 },
              }}>
                <AuthFrame />
                {/* NAGŁÓWEK */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 2,
                  pb: 1,
                  borderBottom: `1px solid ${authGold}`,
                }}>
                  <Box sx={{ width: 4, height: 18, bgcolor: authGold, flexShrink: 0 }} />
                  <Typography sx={{

                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.18em',
                    color: authGoldLight,
                    textShadow: '1px 1px 3px rgba(0,0,0,0.9)',
                  }}>
                    Obwieszczenia
                  </Typography>
                </Box>

                {publicNews.length === 0 ? (
                  <Typography sx={{
                    
                    fontStyle: 'italic',
                    fontSize: '0.95rem',
                    color: COLORS.steel,
                    opacity: 0.7,
                    textAlign: 'center',
                    mt: 4,
                    letterSpacing: '0.02em',
                  }}>
                    Cisza w kronikach...
                  </Typography>
                ) : (
                  <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                    '&::-webkit-scrollbar': { width: '4px' },
                    '&::-webkit-scrollbar-track': { background: 'rgba(0,0,0,0.3)' },
                    '&::-webkit-scrollbar-thumb': { background: COLORS.rust, borderRadius: '0' },
                  }}>
                    {publicNews.map((item) => {
                      const isOpen = expandedNewsId === item.id;
                      return (
                        <Box key={item.id} sx={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          {/* NAGŁÓWEK ITEMU - klikalny */}
                          <Box
                            onClick={() => setExpandedNewsId(isOpen ? null : item.id)}
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 1,
                              p: 1.5,
                              cursor: 'pointer',
                              borderLeft: `3px solid ${isOpen ? COLORS.rust : 'transparent'}`,
                              background: isOpen ? 'rgba(122,59,15,0.12)' : 'transparent',
                              transition: 'all 0.2s',
                              '&:hover': {
                                background: 'rgba(122,59,15,0.1)',
                                borderLeftColor: COLORS.rust,
                              },
                            }}
                          >
                            <Typography sx={{
                              
                              fontSize: '0.75rem',
                              color: isOpen ? COLORS.rust : COLORS.steel,
                              flexShrink: 0,
                              mt: '2px',
                            }}>
                              {isOpen ? '▼' : '▶'}
                            </Typography>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{
                                
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: isOpen ? COLORS.rust : COLORS.secondary,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                lineHeight: 1.4,
                              }}>
                                ✦ {item.title}
                              </Typography>
                              <Typography sx={{
                                
                                fontSize: '0.65rem',
                                color: COLORS.steel,
                                mt: 0.25,
                                opacity: 0.7,
                              }}>
                                {item.created_at ? new Date(item.created_at).toLocaleDateString('pl-PL') : '—'}
                              </Typography>
                            </Box>
                          </Box>

                          {/* TREŚĆ - widoczna tylko gdy isOpen */}
                          {isOpen && (
                            <Box sx={{
                              px: 2.5,
                              pb: 2,
                              pt: 1,
                              borderLeft: `3px solid ${COLORS.rust}`,
                              background: 'rgba(122,59,15,0.06)',
                            }}>
                              <Box
                                sx={{
                                  
                                  fontSize: '0.95rem',
                                  color: COLORS.secondary,
                                  lineHeight: 1.7,
                                  '& p': { mb: 1, mt: 0 },
                                  '& h1, & h2, & h3': {  color: COLORS.rust, mb: 0.5, mt: 1 },
                                  '& img': { maxWidth: '100%' },
                                }}
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content || '') }}
                              />
                              <Box
                                onClick={() => setExpandedNewsId(null)}
                                sx={{
                                  mt: 1.5,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                  cursor: 'pointer',
                                  
                                  fontSize: '0.7rem',
                                  color: COLORS.steel,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.1em',
                                  opacity: 0.7,
                                  '&:hover': { opacity: 1, color: COLORS.rust },
                                }}
                              >
                                ✕ Zwiń
                              </Box>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}

                <Box sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${COLORS.border}` }}>
                  <Typography sx={{
                    
                    fontSize: '0.68rem',
                    color: COLORS.steel,
                    opacity: 0.45,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    Przekrocz próg, by poznać więcej kronik
                  </Typography>
                </Box>
              </Box>
            </Grid>

        </Grid>
      </Fade>

    </Container>
  </Box>
);
}

export default Login;