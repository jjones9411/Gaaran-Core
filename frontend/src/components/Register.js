import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
  Grid,
  Fade,
  FormControlLabel,
  Checkbox,
  Link,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import AuthBackdrop from './AuthBackdrop';
import AuthFrame from './AuthFrame';
import { appColors, authPanelSx, authFieldSx, authGold, authGoldLight } from './theme';
import useGameName from './useGameName';

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

function Register() {
  const navigate = useNavigate();
  const gameName = useGameName();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedRegulations, setAcceptedRegulations] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [usernameError, setUsernameError] = useState('');

  // Sprawdzanie siły hasła
  useEffect(() => {
    const calculatePasswordStrength = (pass) => {
      let strength = 0;
      if (pass.length >= 8) strength += 25;
      if (/[a-z]/.test(pass)) strength += 25;
      if (/[A-Z]/.test(pass)) strength += 25;
      if (/[0-9]/.test(pass)) strength += 25;
      return strength;
    };
    
    setPasswordStrength(calculatePasswordStrength(password));
  }, [password]);

  // Walidacja nazwy użytkownika
  useEffect(() => {
    if (!username) {
      setUsernameError('');
      return;
    }

    if (username.length < 3) {
      setUsernameError('Nazwa użytkownika musi mieć co najmniej 3 znaki');
      return;
    }

    if (username.length > 50) {
      setUsernameError('Nazwa użytkownika może mieć maksymalnie 50 znaków');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      setUsernameError('Nazwa może zawierać tylko litery, cyfry, myślniki i podkreślenia');
      return;
    }

    setUsernameError('');
  }, [username]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordError = confirmPassword && !passwordsMatch;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username || !email || !password || !confirmPassword) {
        throw new Error('Proszę wypełnić wszystkie pola');
      }

      if (usernameError) {
        throw new Error(usernameError);
      }

      if (!passwordsMatch) {
        throw new Error('Hasła nie są identyczne');
      }

      if (passwordStrength < 50) {
        throw new Error('Hasło jest zbyt słabe - użyj co najmniej 8 znaków z literami i cyframi');
      }

      if (!acceptedRegulations) {
        throw new Error('Musisz zaakceptować regulamin, aby się zarejestrować');
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Błąd rejestracji');
      }

      alert(`Rejestracja zakończona sukcesem! Witaj ${data.username}! Aktywuj konto - sprawdź skrzynkę e-mail.`);
      navigate('/login');

    } catch (err) {
      console.error('Błąd rejestracji:', err);
      setError(err?.message || 'Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => navigate('/login');
  const handleRegulamin = () => navigate('/regulamin');

  // Funkcja do renderowania wskaźnika siły hasła
  const renderPasswordStrength = () => {
    if (!password) return null;
    
    const getStrengthColor = (strength) => {
      if (strength < 25) return COLORS.bloodRust;
      if (strength < 50) return '#d1d5db';
      if (strength < 75) return COLORS.rust;
      return '#4caf50';
    };

    const getStrengthText = (strength) => {
      if (strength < 25) return 'Bardzo słabe';
      if (strength < 50) return 'Słabe';
      if (strength < 75) return 'Średnie';
      return 'Silne';
    };

    return (
      <Box sx={{ mt: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ 
            fontSize: '0.8rem', 
            color: COLORS.secondary,
            
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
          }}>
            Siła hasła:
          </Typography>
          <Typography sx={{ 
            fontSize: '0.8rem', 
            color: getStrengthColor(passwordStrength),
            
            fontWeight: 'bold',
            textShadow: `0 0 5px ${getStrengthColor(passwordStrength)}`
          }}>
            {getStrengthText(passwordStrength)}
          </Typography>
        </Box>
        <Box sx={{
          width: '100%',
          height: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: '2px',
          overflow: 'hidden',
          border: `1px solid ${COLORS.border}`
        }}>
          <Box sx={{
            width: `${passwordStrength}%`,
            height: '100%',
            backgroundColor: getStrengthColor(passwordStrength),
            transition: 'all 0.3s ease',
            borderRadius: '2px',
            boxShadow: `0 0 10px ${getStrengthColor(passwordStrength)}`
          }} />
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{
      backgroundColor: COLORS.background,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      p: 2
    }}>
      <AuthBackdrop />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 10 }}>
        <Fade in={true} timeout={1200}>
          {/* JEDEN WIELKI BOX - złota ramka jak w grze */}
          <Box sx={{
            ...authPanelSx,
            p: 4,
          }}>
            <AuthFrame />
            <Grid container spacing={4} alignItems="stretch">
              
              {/* LEWA STRONA - INFO */}
              <Grid item xs={12} md={6}>
                <Box sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 4
                }}>
                  {/* TYTUŁ */}
                  <Box>
                    <Typography variant="h1" sx={{

                      fontWeight: 'bold',
                      fontSize: { xs: '3rem', md: '4.5rem' },
                      color: authGoldLight,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      textShadow: `0 0 18px ${authGold}55, 2px 2px 4px rgba(0, 0, 0, 0.9)`,
                      mb: 2
                    }}>
                      {gameName}
                    </Typography>
                    
                    <Typography sx={{
                      color: COLORS.steelLight,
                      
                      fontSize: '0.9rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      opacity: 0.9,
                      textShadow: '0 0 10px rgba(113, 128, 150, 0.5)'
                    }}>
                      REJESTRACJA UŻYTKOWNIKA
                    </Typography>
                  </Box>

                  {/* PRZYCISKI */}
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
                        backdropFilter: 'blur(10px)',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: `2px solid ${COLORS.steel}`,
                        textShadow: '0 0 5px rgba(113, 128, 150, 0.5)',
                        '&:hover': {
                          background: COLORS.glassRust,
                          borderColor: COLORS.rust,
                          color: COLORS.rust,
                          transform: 'translateY(-2px)',
                          boxShadow: '0 5px 15px rgba(139, 69, 19, 0.4)'
                        }
                      }}
                    >
                      💬 DISCORD
                    </Button>
                  </Box>
                </Box>
              </Grid>

              {/* PRAWA STRONA - FORMULARZ */}
              <Grid item xs={12} md={6}>
                <Paper sx={{
                  ...authPanelSx,
                  ...authFieldSx,
                  p: { xs: 3, sm: 4, md: 5 },
                  height: '100%',
                  position: 'relative',
                  // Wewnętrzny formularz (ramkę daje zewnętrzny Box) - własne
                  // ::before/::after: górna linia + etykieta, jak wewn. panel Login.
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '2px',
                    background: `linear-gradient(90deg, transparent, ${COLORS.rust}, ${COLORS.rustLight}, ${COLORS.rust}, transparent)`,
                  },
                  '&::after': {
                    content: '"⚜ Nowy Wędrowiec ⚜"',
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
                  <AuthFrame />

                  <Typography variant="h4" sx={{
                    color: authGoldLight,

                    textAlign: 'center',
                    mb: 4,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: { xs: '1.5rem', sm: '1.9rem', md: '2.125rem' },
                    letterSpacing: { xs: '0.05em', sm: '0.1em' },
                    textShadow: '1px 1px 3px rgba(0,0,0,0.9)'
                  }}>
                    REJESTRACJA
                  </Typography>

                  <form onSubmit={handleSubmit}>
                    {/* Username Field */}
                    <Box sx={{ position: 'relative', mb: 3 }}>
                      <PersonIcon sx={{
                        position: 'absolute',
                        left: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: usernameError ? COLORS.bloodRust : COLORS.rust,
                        zIndex: 1,
                        fontSize: '1.2rem',
                        filter: `drop-shadow(0 0 5px ${usernameError ? COLORS.bloodRust : COLORS.rust})`
                      }} />
                      <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="NAZWA UŻYTKOWNIKA"
                        value={username}
                        onChange={(e) => setUsername(e.target.value || '')}
                        disabled={loading}
                        error={!!usernameError}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '0',
                            
                            pl: 6,
                            '& fieldset': { borderColor: usernameError ? COLORS.bloodRust : COLORS.border },
                            '&:hover fieldset': { borderColor: usernameError ? COLORS.bloodRust : COLORS.rust },
                            '&.Mui-focused fieldset': { borderColor: usernameError ? COLORS.bloodRust : COLORS.rust, borderWidth: '2px' },
                            '& input': { 
                              color: COLORS.secondary, 
                              
                              textShadow: '0 0 5px rgba(203, 213, 224, 0.3)'
                            },
                            '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                          }
                        }}
                      />
                      {usernameError && (
                        <Typography sx={{
                          color: COLORS.bloodRust,
                          fontSize: '0.75rem',
                          mt: 1,
                          
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          textShadow: '0 0 5px rgba(155, 44, 44, 0.8)'
                        }}>
                          <WarningIcon sx={{ fontSize: '0.9rem' }} />
                          {usernameError}
                        </Typography>
                      )}
                      {username && !usernameError && (
                        <Typography sx={{
                          color: '#4caf50',
                          fontSize: '0.75rem',
                          mt: 1,
                          
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          textShadow: '0 0 5px rgba(76, 175, 80, 0.8)'
                        }}>
                          <CheckCircleIcon sx={{ fontSize: '0.9rem' }} />
                          Nazwa dostępna
                        </Typography>
                      )}
                    </Box>

                    {/* Email Field */}
                    <Box sx={{ position: 'relative', mb: 3 }}>
                      <EmailIcon sx={{
                        position: 'absolute',
                        left: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: COLORS.rust,
                        zIndex: 1,
                        fontSize: '1.2rem',
                        filter: `drop-shadow(0 0 5px ${COLORS.rust})`
                      }} />
                      <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="E-MAIL"
                        value={email}
                        onChange={(e) => setEmail(e.target.value || '')}
                        disabled={loading}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '0',
                            
                            pl: 6,
                            '& fieldset': { borderColor: COLORS.border },
                            '&:hover fieldset': { borderColor: COLORS.rust },
                            '&.Mui-focused fieldset': { borderColor: COLORS.rust, borderWidth: '2px' },
                            '& input': { 
                              color: COLORS.secondary, 
                              
                              textShadow: '0 0 5px rgba(203, 213, 224, 0.3)'
                            },
                            '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                          }
                        }}
                      />
                    </Box>

                    {/* Password Field */}
                    <Box sx={{ position: 'relative', mb: 2 }}>
                      <LockIcon sx={{
                        position: 'absolute',
                        left: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: COLORS.rust,
                        zIndex: 1,
                        fontSize: '1.2rem',
                        filter: `drop-shadow(0 0 5px ${COLORS.rust})`
                      }} />
                      <TextField
                        fullWidth
                        type="password"
                        variant="outlined"
                        placeholder="HASŁO"
                        value={password}
                        onChange={(e) => setPassword(e.target.value || '')}
                        disabled={loading}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '0',
                            
                            pl: 6,
                            '& fieldset': { borderColor: COLORS.border },
                            '&:hover fieldset': { borderColor: COLORS.rust },
                            '&.Mui-focused fieldset': { borderColor: COLORS.rust, borderWidth: '2px' },
                            '& input': { 
                              color: COLORS.secondary, 
                              
                              textShadow: '0 0 5px rgba(203, 213, 224, 0.3)'
                            },
                            '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                          }
                        }}
                      />
                    </Box>

                    {/* Password Strength */}
                    {renderPasswordStrength()}

                    {/* Confirm Password Field */}
                    <Box sx={{ position: 'relative', mb: 4 }}>
                      <LockIcon sx={{
                        position: 'absolute',
                        left: 16,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: passwordError ? COLORS.bloodRust : COLORS.rust,
                        zIndex: 1,
                        fontSize: '1.2rem',
                        filter: `drop-shadow(0 0 5px ${passwordError ? COLORS.bloodRust : COLORS.rust})`
                      }} />
                      <TextField
                        fullWidth
                        type="password"
                        variant="outlined"
                        placeholder="POTWIERDŹ HASŁO"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value || '')}
                        disabled={loading}
                        error={passwordError}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '0',
                            
                            pl: 6,
                            '& fieldset': { borderColor: passwordError ? COLORS.bloodRust : COLORS.border },
                            '&:hover fieldset': { borderColor: passwordError ? COLORS.bloodRust : COLORS.rust },
                            '&.Mui-focused fieldset': { borderColor: passwordError ? COLORS.bloodRust : COLORS.rust, borderWidth: '2px' },
                            '& input': { 
                              color: COLORS.secondary, 
                              
                              textShadow: '0 0 5px rgba(203, 213, 224, 0.3)'
                            },
                            '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                          }
                        }}
                      />
                      {passwordError && (
                        <Typography sx={{
                          color: COLORS.bloodRust,
                          fontSize: '0.75rem',
                          mt: 1,
                          
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          textShadow: '0 0 5px rgba(155, 44, 44, 0.8)'
                        }}>
                          <WarningIcon sx={{ fontSize: '0.9rem' }} />
                          Hasła nie są identyczne
                        </Typography>
                      )}
                      {passwordsMatch && confirmPassword && (
                        <Typography sx={{
                          color: '#4caf50',
                          fontSize: '0.75rem',
                          mt: 1,
                          
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          textShadow: '0 0 5px rgba(76, 175, 80, 0.8)'
                        }}>
                          <CheckCircleIcon sx={{ fontSize: '0.9rem' }} />
                          Hasła są identyczne
                        </Typography>
                      )}
                    </Box>

                    {/* Checkbox */}
                    <Box sx={{
                      background: 'rgba(139, 69, 19, 0.1)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '0',
                      p: 2,
                      mb: 4
                    }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={acceptedRegulations}
                            onChange={(e) => setAcceptedRegulations(e.target.checked)}
                            sx={{
                              color: COLORS.rust,
                              '&.Mui-checked': {
                                color: COLORS.rust,
                              }
                            }}
                          />
                        }
                        label={
                          <Typography sx={{ 
                            color: COLORS.secondary,
                            
                            fontSize: '0.9rem',
                            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                          }}>
                            Akceptuję&nbsp;
                            <Link
                              onClick={handleRegulamin}
                              sx={{ 
                                cursor: 'pointer', 
                                color: COLORS.rust,
                                textDecoration: 'underline',
                                '&:hover': { 
                                  color: COLORS.rustLight,
                                  textShadow: `0 0 10px rgba(139, 69, 19, 0.8)`
                                }
                              }}
                            >
                              regulamin
                            </Link>
                            &nbsp;i jestem pełnoletni
                          </Typography>
                        }
                      />
                    </Box>

                    {/* Register Button */}
                    <Button
                      fullWidth
                      variant="contained"
                      type="submit"
                      disabled={loading || !acceptedRegulations || passwordError || passwordStrength < 50 || !!usernameError || !username}
                      sx={{
                        background: COLORS.rust,
                        color: COLORS.background,
                        
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        py: 2,
                        mb: 3,
                        borderRadius: '0',
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        border: `2px solid ${COLORS.rustDark}`,
                        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                        '&:hover': {
                          background: COLORS.rustLight,
                          transform: 'translateY(-2px)',
                          borderColor: COLORS.rust,
                          boxShadow: '0 10px 30px rgba(139, 69, 19, 0.5)'
                        },
                        '&:disabled': {
                          background: COLORS.steel,
                          opacity: 0.6
                        }
                      }}
                    >
                      {loading ? 'REJESTROWANIE...' : 'ZAREJESTRUJ SIĘ'}
                    </Button>
                  </form>

                  {/* Error Message */}
                  {error && (
                    <Typography color="error" sx={{
                      textAlign: 'center',
                      
                      fontSize: '14px',
                      mb: 3,
                      background: 'rgba(155, 44, 44, 0.3)',
                      p: 2,
                      borderRadius: '0',
                      border: `1px solid ${COLORS.bloodRust}`,
                      textTransform: 'uppercase',
                      textShadow: '0 0 10px rgba(220, 38, 38, 0.8)',
                      boxShadow: '0 0 15px rgba(155, 44, 44, 0.4)'
                    }}>
                      ⚠ {error}
                    </Typography>
                  )}

                  {/* Login Button */}
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={loading}
                    onClick={handleLogin}
                    sx={{
                      borderColor: COLORS.border,
                      color: COLORS.rust,
                      
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: '0.95rem',
                      borderWidth: '2px',
                      borderRadius: '0',
                      py: 1.5,
                      textShadow: '0 0 10px rgba(139, 69, 19, 0.5)',
                      '&:hover': {
                        background: COLORS.glassRust,
                        borderColor: COLORS.rust,
                        transform: 'translateY(-2px)',
                        boxShadow: '0 5px 20px rgba(139, 69, 19, 0.4)'
                      }
                    }}
                  >
                    MASZ JUŻ KONTO? ZALOGUJ SIĘ
                  </Button>
                </Paper>
              </Grid>

            </Grid>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}

export default Register;