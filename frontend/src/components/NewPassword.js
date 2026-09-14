import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  IconButton,
  CircularProgress,
  Container,
  Grid,
  Fade,
  Slide,
  useMediaQuery
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SecurityIcon from '@mui/icons-material/Security';
import WarningIcon from '@mui/icons-material/Warning';
import { appColors, authPanelSx, authFieldSx, authGold, authGoldLight } from './theme';
import AuthFrame from './AuthFrame';
import AuthBackdrop from './AuthBackdrop';
import useGameName from './useGameName';

// Paleta rdzy/betonu - ta sama co Login/Register/ResetPassword/ActivateAccount
const COLORS = {
  primary: appColors.bgDeep,
  secondary: appColors.textLight,
  background: appColors.bgDeep,
  backgroundDark: appColors.bgDeep,
  backgroundModal: 'rgba(0, 0, 0, 0.85)',
  border: appColors.rustBorder,
  overlay: 'rgba(0, 0, 0, 0.75)',
  buttonHover: appColors.rustDark,
  buttonDefault: appColors.bgDeep,
  buttonBorder: appColors.rustBorder,
  // Przygaszone, antyczne złoto (te same tokeny co Login/Register/ResetPassword),
  // zamiast koloru akcentu z kreatora - inaczej "złote" gradienty tutaj wychodziły
  // w kolorze rasy/instalacji (np. zielone) i ekran odstawał od reszty.
  gold: authGold,
  goldLight: authGoldLight,
  goldDark: '#6e5a2b',
  bloodGray: appColors.dangerText,
  shadowDark: 'rgba(18, 18, 18, 0.98)',
  accent: appColors.rustDark,
  glowGreen: 'rgba(138, 114, 55, 0.16)',
  glassWhite: 'rgba(255, 255, 255, 0.1)',
  glassGold: 'rgba(138, 114, 55, 0.22)'
};
const NewPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const gameName = useGameName();

  // Stan komponentu - wszystkie wartości z bezpiecznymi defaultami
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Parallax effect z bezpiecznym handlerem
  useEffect(() => {
    const handleScroll = () => {
      try {
        setScrollY(window.scrollY || 0);
      } catch (error) {
        console.error('Błąd w handleScroll:', error);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sprawdzenie tokena przy załadowaniu komponentu
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setMessage('Nieprawidłowy link resetowania hasła.');
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/newpassword/${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (response.ok) {
          setEmail(data.email);
          setIsValidating(false);
        } else {
          setMessage(data.message || 'Token jest nieprawidłowy lub wygasł.');
          setIsValidating(false);
        }
      } catch (error) {
        console.error('Błąd podczas walidacji tokena:', error);
        setMessage('Wystąpił błąd podczas sprawdzania tokena.');
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Sprawdzanie siły hasła
  useEffect(() => {
    const calculatePasswordStrength = (pass) => {
      let strength = 0;
      if (pass.length >= 6) strength += 25;
      if (pass.length >= 8) strength += 25;
      if (/[a-z]/.test(pass)) strength += 25;
      if (/[A-Z]/.test(pass)) strength += 25;
      if (/[0-9]/.test(pass)) strength += 25;
      return Math.min(strength, 100);
    };
    
    setPasswordStrength(calculatePasswordStrength(password));
  }, [password]);

  // Funkcja sprawdzająca zgodność haseł
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordError = confirmPassword && !passwordsMatch;
  // Bezpieczny handler zmiany hasła
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Walidacja hasła
    if (password.length < 6) {
      setMessage('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Hasła nie są identyczne.');
      return;
    }

    if (passwordStrength < 50) {
      setMessage('Hasło jest zbyt słabe - użyj co najmniej 8 znaków z literami i cyframi.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email,
          token: token, 
          password: password 
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setIsSuccess(true);
        setMessage('Hasło zostało pomyślnie zmienione! Zostaniesz przekierowany do logowania.');
        
        localStorage.clear();
        
        // Przekierowanie po 3 sekundach
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setIsSuccess(false);
        setMessage(data.message || 'Wystąpił błąd podczas zmiany hasła.');
      }
    } catch (error) {
      console.error('Błąd podczas resetowania hasła:', error);
      setIsSuccess(false);
      setMessage('Wystąpił błąd połączenia. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  // Funkcja do renderowania wskaźnika siły hasła
  const renderPasswordStrength = () => {
    if (!password) return null;
    
    const getStrengthColor = (strength) => {
      if (strength < 25) return COLORS.bloodGray;
      if (strength < 50) return '#d1d5db';
      if (strength < 75) return COLORS.gold;
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
            }}>
            Siła hasła:
          </Typography>
          <Typography sx={{ 
            fontSize: '0.8rem', 
            color: getStrengthColor(passwordStrength),
            
            fontWeight: 'bold'
          }}>
            {getStrengthText(passwordStrength)}
          </Typography>
        </Box>
        <Box sx={{
          width: '100%',
          height: '4px',
          backgroundColor: COLORS.buttonHover,
          borderRadius: '2px',
          overflow: 'hidden'
        }}>
          <Box sx={{
            width: `${passwordStrength}%`,
            height: '100%',
            backgroundColor: getStrengthColor(passwordStrength),
            transition: 'all 0.3s ease',
            borderRadius: '2px'
          }} />
        </Box>
      </Box>
    );
  };
  // Loading state podczas walidacji tokena z mrocznym designem
  if (isValidating) {
    return (
      <Box sx={{
        background: `
          radial-gradient(circle at 20% 10%, ${COLORS.bloodGray}10 0%, transparent 50%),
          radial-gradient(circle at 80% 90%, ${COLORS.accent}15 0%, transparent 50%),
          radial-gradient(circle at 40% 60%, ${COLORS.gold}08 0%, transparent 50%),
          linear-gradient(135deg, ${COLORS.backgroundDark} 0%, ${COLORS.background} 50%, ${COLORS.backgroundDark} 100%)
        `,
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Animowane cząsteczki tła */}
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `
            radial-gradient(circle at 20% 50%, ${COLORS.glowGreen} 0%, transparent 50%), 
            radial-gradient(circle at 80% 20%, rgba(107, 76, 76, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(154, 119, 40, 0.08) 0%, transparent 50%)
          `,
          zIndex: 0,
          animation: 'float 25s ease-in-out infinite'
        }} />

        <Fade in={true} timeout={1000}>
          <Box sx={{ 
            zIndex: 2, 
            textAlign: 'center',
            background: `
              linear-gradient(135deg, 
                rgba(0, 0, 0, 0.8) 0%, 
                rgba(13, 15, 14, 0.9) 100%
              )
            `,
            backdropFilter: 'blur(20px)',
            border: `2px solid ${COLORS.glassGold}`,
            borderRadius: '24px',
            p: 6,
            boxShadow: `
              0 25px 80px rgba(0, 0, 0, 0.6),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 0 60px rgba(75, 85, 99, 0.15)
            `
          }}>
            <CircularProgress 
              sx={{ 
                color: COLORS.gold, 
                mb: 3,
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }} 
              size={60}
              thickness={4}
            />
            <Typography sx={{ 
              color: COLORS.secondary, 
              
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              Sprawdzanie tokena...
            </Typography>
            <Typography sx={{ 
              color: COLORS.gold, 
              
              fontSize: '0.9rem',
              mt: 1,
              opacity: 0.8
            }}>
              Prosimy czekać
            </Typography>
          </Box>
        </Fade>
      </Box>
    );
  }

  // Jeśli token jest nieprawidłowy - mroczny error state
  if (!email && message) {
    return (
      <Box sx={{
        backgroundColor: COLORS.background,
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <AuthBackdrop />

        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 10 }}>
          <Fade in={true} timeout={1000}>
            <Paper sx={{
              ...authPanelSx,
              p: 5,
              textAlign: 'center',
            }}>
              <AuthFrame />
              <ErrorIcon sx={{ 
                fontSize: '4rem', 
                color: COLORS.bloodGray, 
                mb: 3,
                position: 'relative',
                zIndex: 1
              }} />
              
              <Typography variant="h4" sx={{ 
                color: COLORS.secondary, 
                 
                mb: 3,
                fontWeight: 'bold',
                position: 'relative',
                zIndex: 1
              }}>
                Błąd tokena
              </Typography>
              
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 4,
                  background: `rgba(107, 76, 76, 0.2)`,
                  border: `1px solid ${COLORS.bloodGray}`,
                  borderRadius: '16px',
                  '& .MuiAlert-message': {
                    color: COLORS.secondary,
                    
                    fontSize: '1rem'
                  },
                  '& .MuiAlert-icon': {
                    color: COLORS.bloodGray
                  },
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {message}
              </Alert>
              
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                startIcon={<ArrowBackIcon />}
                sx={{
                  background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%)`,
                  color: COLORS.backgroundDark,
                  
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  px: 5,
                  py: 2,
                  borderRadius: '50px',
                  textTransform: 'none',
                  boxShadow: `0 8px 30px rgba(154, 119, 40, 0.3)`,
                  position: 'relative',
                  zIndex: 1,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 100%)`,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 12px 40px rgba(154, 119, 40, 0.5)`
                  }
                }}
              >
                Powrót do logowania
              </Button>
            </Paper>
          </Fade>
        </Container>
      </Box>
    );
  }
  return (
    <Box sx={{
      backgroundColor: COLORS.background,
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Wspólna grafika świata (jak Login/Register/ResetPassword) zamiast
          osobnego, płaskiego gradientu - spójne tło wszystkich ekranów przed grą. */}
      <AuthBackdrop />
      {/* Animowane cząsteczki tła */}
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `
          radial-gradient(circle at ${20 + (scrollY || 0) * 0.01}% ${50 + (scrollY || 0) * 0.02}%, ${COLORS.glowGreen} 0%, transparent 50%), 
          radial-gradient(circle at ${80 - (scrollY || 0) * 0.01}% ${20 + (scrollY || 0) * 0.015}%, rgba(107, 76, 76, 0.1) 0%, transparent 50%),
          radial-gradient(circle at ${40 + (scrollY || 0) * 0.008}% ${80 - (scrollY || 0) * 0.01}%, rgba(154, 119, 40, 0.08) 0%, transparent 50%)
        `,
        zIndex: 0,
        animation: 'float 25s ease-in-out infinite'
      }} />

      {/* Glassmorphism Navbar */}
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: `
          linear-gradient(135deg, 
            rgba(0, 0, 0, 0.8) 0%, 
            rgba(13, 15, 14, 0.9) 100%
          )
        `,
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${COLORS.glassGold}`,
        transition: 'all 0.3s ease'
      }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            py: 2
          }}>
            <Typography variant="h4" sx={{
              background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',

              fontWeight: 'bold',
              fontSize: { xs: '1.5rem', sm: '1.9rem', md: '2.125rem' },
              textShadow: '0 0 20px rgba(154, 119, 40, 0.5)',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: -2,
                left: 0,
                width: '100%',
                height: '2px',
                background: `linear-gradient(90deg, ${COLORS.gold} 0%, transparent 100%)`,
                borderRadius: '1px'
              }
            }}>
              {gameName}
            </Typography>

            <Button
              onClick={() => navigate('/login')}
              startIcon={<ArrowBackIcon />}
              sx={{
                color: COLORS.gold,
                
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: '1rem',
                px: 3,
                py: 1,
                borderRadius: '8px',
                transition: 'all 0.3s ease',
                background: `rgba(154, 119, 40, 0.1)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${COLORS.glassGold}`,
                '&:hover': {
                  color: COLORS.goldLight,
                  background: `rgba(154, 119, 40, 0.2)`,
                  transform: 'translateY(-2px)',
                  borderColor: COLORS.gold
                }
              }}
            >
              Powrót do logowania
            </Button>
          </Box>
        </Container>
      </Box>
      {/* Main Password Reset Section */}
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        zIndex: 1,
        pt: 12,
        pb: 8
      }}>
        <Container maxWidth="xl">
          <Grid container spacing={6} alignItems="center">
            {/* Lewa strona - Tekst */}
            <Grid item xs={12} lg={7}>
              <Box sx={{ 
                position: 'relative',
                transform: `translateY(${(scrollY || 0) * 0.1}px)`,
                pl: { xs: 0, lg: 4 }
              }}>
                {/* Dekoracyjny element */}
                <Box sx={{
                  position: 'absolute',
                  top: -50,
                  left: -50,
                  width: 200,
                  height: 200,
                  background: `radial-gradient(circle, ${COLORS.gold}15 0%, transparent 70%)`,
                  borderRadius: '50%',
                  filter: 'blur(40px)',
                  animation: 'pulse 4s ease-in-out infinite'
                }} />

                <Fade in={true} timeout={1500}>
                  <Box sx={{ position: 'relative', zIndex: 2 }}>
                    <Typography sx={{
                      color: COLORS.gold,
                      
                      fontSize: { xs: '1rem', md: '1.2rem' },
                      fontWeight: 'bold',
                      mb: 2,
                      opacity: 0.8,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase'
                    }}>
                      Odzyskaj dostęp
                    </Typography>

                    <Typography variant={isMobile ? "h2" : "h1"} sx={{
                      
                      fontWeight: 'bold',
                      mb: 4,
                      lineHeight: 1.1,
                      fontSize: { xs: '2.5rem', md: '4rem', lg: '5rem' }
                    }}>
                      <Box component="span" sx={{ 
                        background: `linear-gradient(135deg, ${COLORS.secondary} 0%, ${COLORS.gold} 30%, ${COLORS.goldLight} 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textShadow: '0 0 30px rgba(194, 184, 163, 0.5)',
                        display: 'block'
                      }}>
                        NOWE HASŁO
                      </Box>
                    </Typography>

                    <Typography variant="h4" sx={{
                      color: COLORS.secondary,
                      mb: 5,
                      
                      fontWeight: 300,
                      opacity: 0.9,
                      lineHeight: 1.6,
                      fontSize: { xs: '1.2rem', md: '1.5rem' },
                      maxWidth: '600px'
                    }}>
                      Ustaw nowe, bezpieczne hasło dla swojego konta. 
                      Pamiętaj, aby było silne i unikalne.
                    </Typography>

                    {/* Cechy bezpieczeństwa */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                      {[
                        { icon: <SecurityIcon />, text: 'Bezpieczne szyfrowanie' },
                        { icon: <LockIcon />, text: 'Ochrona konta' },
                        { icon: <CheckCircleIcon />, text: 'Weryfikacja tokena' }
                      ].map((feature, index) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 2,
                          background: `rgba(154, 119, 40, 0.1)`,
                          backdropFilter: 'blur(10px)',
                          border: `1px solid ${COLORS.glassGold}`,
                          borderRadius: '12px',
                          p: 2,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            background: `rgba(75, 85, 99, 0.15)`,
                            transform: 'translateX(10px)'
                          }
                        }}>
                          <Box sx={{ color: COLORS.gold, fontSize: '1.5rem' }}>
                            {feature.icon}
                          </Box>
                          <Typography sx={{
                            color: COLORS.secondary,
                            
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                          }}>
                            {feature.text}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Email info jeśli dostępny */}
                    {email && (
                      <Box sx={{
                        background: `rgba(75, 85, 99, 0.15)`,
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${COLORS.gold}`,
                        borderRadius: '16px',
                        p: 3,
                        mb: 4
                      }}>
                        <Typography sx={{
                          color: COLORS.gold,
                          
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          mb: 1
                        }}>
                          📧 Resetowanie hasła dla:
                        </Typography>
                        <Typography sx={{
                          color: COLORS.secondary,
                          
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}>
                          {email}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Fade>
              </Box>
            </Grid>
            {/* Prawa strona - Formularz nowego hasła z glassmorphism */}
            <Grid item xs={12} lg={5}>
              <Slide direction="left" in={true} timeout={1000}>
                <Box sx={{ 
                  position: 'relative',
                  transform: `translateY(${(scrollY || 0) * -0.05}px)`
                }}>
                  {/* Dekoracyjne tło */}
                  <Box sx={{
                    position: 'absolute',
                    top: -30,
                    right: -30,
                    width: 300,
                    height: 300,
                    background: `radial-gradient(circle, ${COLORS.bloodGray}20 0%, transparent 70%)`,
                    borderRadius: '50%',
                    filter: 'blur(60px)',
                    animation: 'float 20s ease-in-out infinite'
                  }} />

                  <Paper sx={{
                    ...authPanelSx,
                    ...authFieldSx,
                    p: { xs: 3, sm: 4, md: 5 },
                    position: 'relative',
                  }}>
                    <AuthFrame />
                    {/* Success State */}
                    {isSuccess ? (
                      <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                        <CheckCircleIcon sx={{ 
                          fontSize: '5rem', 
                          color: COLORS.gold, 
                          mb: 3,
                          filter: 'drop-shadow(0 0 20px rgba(154, 119, 40, 0.5))',
                          animation: 'pulse 2s ease-in-out infinite'
                        }} />
                        
                        <Typography variant="h4" sx={{
                          background: `linear-gradient(135deg, ${COLORS.secondary} 0%, ${COLORS.gold} 100%)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          
                          fontWeight: 'bold',
                          mb: 3
                        }}>
                          Hasło zmienione!
                        </Typography>
                        
                        <Typography sx={{
                          color: COLORS.secondary,
                          
                          fontSize: '1.1rem',
                          mb: 4,
                          lineHeight: 1.6
                        }}>
                          Twoje hasło zostało pomyślnie zmienione. 
                          Zostaniesz przekierowany do logowania za chwilę...
                        </Typography>

                        <Box sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: 2,
                          background: `rgba(154, 119, 40, 0.1)`,
                          backdropFilter: 'blur(10px)',
                          border: `1px solid ${COLORS.gold}`,
                          borderRadius: '16px',
                          p: 3
                        }}>
                          <CircularProgress 
                            size={24} 
                            sx={{ 
                              color: COLORS.gold,
                              '& .MuiCircularProgress-circle': {
                                strokeLinecap: 'round',
                              }
                            }} 
                          />
                          <Typography sx={{
                            color: COLORS.gold,
                            
                            fontWeight: 'bold'
                          }}>
                            Przekierowywanie...
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <>
                        {/* Form Header */}
                        <Box sx={{ textAlign: 'center', mb: 4, position: 'relative', zIndex: 1 }}>
                          <LockIcon sx={{ 
                            fontSize: '3rem', 
                            color: COLORS.gold,
                            mb: 2,
                            filter: 'drop-shadow(0 0 15px rgba(154, 119, 40, 0.5))'
                          }} />
                          
                          <Typography variant="h4" sx={{
                            background: `linear-gradient(135deg, ${COLORS.secondary} 0%, ${COLORS.gold} 100%)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            
                            fontWeight: 'bold',
                            mb: 2
                          }}>
                            Nowe Hasło
                          </Typography>
                        </Box>

                        {/* Password Form */}
                        <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1 }}>
                          {/* New Password Field */}
                          <Box sx={{ position: 'relative', mb: 2 }}>
                            <LockIcon sx={{
                              position: 'absolute',
                              left: 16,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: COLORS.gold,
                              zIndex: 1,
                              fontSize: '1.2rem'
                            }} />
                            <TextField
                              fullWidth
                              type={showPassword ? 'text' : 'password'}
                              variant="outlined"
                              placeholder="Nowe hasło"
                              value={password}
                              onChange={(e) => setPassword(e.target.value || '')}
                              required
                              disabled={isLoading}
                              InputProps={{
                                endAdornment: (
                                  <IconButton
                                    onClick={() => setShowPassword(!showPassword)}
                                    edge="end"
                                    sx={{ 
                                      color: COLORS.gold,
                                      '&:hover': {
                                        backgroundColor: `rgba(154, 119, 40, 0.1)`
                                      }
                                    }}
                                  >
                                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                  </IconButton>
                                ),
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  background: `rgba(0, 0, 0, 0.6)`,
                                  backdropFilter: 'blur(10px)',
                                  borderRadius: '16px',
                                  transition: 'all 0.3s ease',
                                  pl: 6,
                                  '& fieldset': {
                                    borderColor: COLORS.glassGold,
                                    borderWidth: '1px',
                                  },
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    '& fieldset': {
                                      borderColor: COLORS.gold,
                                      boxShadow: `0 8px 25px rgba(154, 119, 40, 0.2)`
                                    }
                                  },
                                  '&.Mui-focused fieldset': {
                                    borderColor: COLORS.gold,
                                    borderWidth: '2px',
                                    boxShadow: `0 0 20px rgba(154, 119, 40, 0.25)`
                                  },
                                  '& input': {
                                    color: COLORS.secondary,
                                    
                                    fontSize: '1.1rem'
                                  },
                                  '& input::placeholder': {
                                    color: COLORS.gold,
                                    opacity: 0.7
                                  }
                                }
                              }}
                            />
                          </Box>

                          {/* Password Strength Indicator */}
                          {renderPasswordStrength()}
                          {/* Confirm Password Field */}
                          <Box sx={{ position: 'relative', mb: 4 }}>
                            <LockIcon sx={{
                              position: 'absolute',
                              left: 16,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: passwordError ? COLORS.bloodGray : COLORS.gold,
                              zIndex: 1,
                              fontSize: '1.2rem'
                            }} />
                            <TextField
                              fullWidth
                              type={showConfirmPassword ? 'text' : 'password'}
                              variant="outlined"
                              placeholder="Potwierdź hasło"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value || '')}
                              required
                              disabled={isLoading}
                              error={passwordError}
                              InputProps={{
                                endAdornment: (
                                  <IconButton
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    edge="end"
                                    sx={{ 
                                      color: passwordError ? COLORS.bloodGray : COLORS.gold,
                                      '&:hover': {
                                        backgroundColor: `rgba(154, 119, 40, 0.1)`
                                      }
                                    }}
                                  >
                                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                  </IconButton>
                                ),
                              }}
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  background: `rgba(0, 0, 0, 0.6)`,
                                  backdropFilter: 'blur(10px)',
                                  borderRadius: '16px',
                                  transition: 'all 0.3s ease',
                                  pl: 6,
                                  '& fieldset': {
                                    borderColor: passwordError ? COLORS.bloodGray : COLORS.glassGold,
                                    borderWidth: '1px',
                                  },
                                  '&:hover': {
                                    transform: 'translateY(-2px)',
                                    '& fieldset': {
                                      borderColor: passwordError ? COLORS.bloodGray : COLORS.gold,
                                      boxShadow: `0 8px 25px rgba(154, 119, 40, 0.2)`
                                    }
                                  },
                                  '&.Mui-focused fieldset': {
                                    borderColor: passwordError ? COLORS.bloodGray : COLORS.gold,
                                    borderWidth: '2px',
                                    boxShadow: `0 0 20px rgba(154, 119, 40, 0.25)`
                                  },
                                  '& input': {
                                    color: COLORS.secondary,
                                    
                                    fontSize: '1.1rem'
                                  },
                                  '& input::placeholder': {
                                    color: passwordError ? COLORS.bloodGray : COLORS.gold,
                                    opacity: 0.7
                                  }
                                }
                              }}
                            />
                            {passwordError && (
                              <Typography sx={{
                                color: COLORS.bloodGray,
                                fontSize: '0.8rem',
                                mt: 1,
                                
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}>
                                <WarningIcon sx={{ fontSize: '1rem' }} />
                                Hasła nie są identyczne
                              </Typography>
                            )}
                            {passwordsMatch && confirmPassword && (
                              <Typography sx={{
                                color: '#4caf50',
                                fontSize: '0.8rem',
                                mt: 1,
                                
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              }}>
                                <CheckCircleIcon sx={{ fontSize: '1rem' }} />
                                Hasła są identyczne
                              </Typography>
                            )}
                          </Box>

                          {/* Submit Button */}
                          <Button
                            fullWidth
                            variant="contained"
                            type="submit"
                            disabled={isLoading || passwordError || passwordStrength < 50 || !passwordsMatch}
                            sx={{
                              background: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%)`,
                              color: COLORS.backgroundDark,
                              
                              fontWeight: 'bold',
                              fontSize: '1.2rem',
                              py: 2,
                              mb: 3,
                              borderRadius: '16px',
                              textTransform: 'none',
                              boxShadow: `0 8px 30px rgba(154, 119, 40, 0.3)`,
                              position: 'relative',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: '-100%',
                                width: '100%',
                                height: '100%',
                                background: `linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)`,
                                transition: 'left 0.5s'
                              },
                              '&:hover:not(:disabled)': {
                                background: `linear-gradient(135deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 100%)`,
                                transform: 'translateY(-3px)',
                                boxShadow: `0 12px 40px rgba(154, 119, 40, 0.5)`,
                                '&::before': {
                                  left: '100%'
                                }
                              },
                              '&:disabled': {
                                background: COLORS.buttonHover,
                                color: COLORS.secondary,
                                opacity: 0.7,
                                transform: 'none',
                                boxShadow: 'none'
                              }
                            }}
                          >
                            {isLoading ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CircularProgress size={20} sx={{ color: COLORS.backgroundDark }} />
                                Zapisywanie...
                              </Box>
                            ) : (
                              '🔒 Zmień hasło'
                            )}
                          </Button>
                        </form>

                        {/* Error Message */}
                        {message && !isSuccess && (
                          <Alert 
                            severity="error"
                            sx={{
                              mb: 3,
                              background: `rgba(107, 76, 76, 0.2)`,
                              backdropFilter: 'blur(10px)',
                              border: `1px solid ${COLORS.bloodGray}`,
                              borderRadius: '16px',
                              '& .MuiAlert-message': {
                                color: COLORS.secondary,
                                
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1
                              },
                              '& .MuiAlert-icon': {
                                color: COLORS.bloodGray
                              },
                              position: 'relative',
                              zIndex: 1
                            }}
                          >
                            <WarningIcon sx={{ fontSize: '1rem', mr: 1 }} />
                            {message}
                          </Alert>
                        )}
                      </>
                    )}

                    {/* Success Message */}
                    {isSuccess && message && (
                      <Alert 
                        severity="success"
                        sx={{
                          background: `rgba(154, 119, 40, 0.2)`,
                          backdropFilter: 'blur(10px)',
                          border: `1px solid ${COLORS.gold}`,
                          borderRadius: '16px',
                          '& .MuiAlert-message': {
                            color: COLORS.secondary,
                            
                            fontSize: '0.9rem'
                          },
                          '& .MuiAlert-icon': {
                            color: COLORS.gold
                          },
                          position: 'relative',
                          zIndex: 1
                        }}
                      >
                        {message}
                      </Alert>
                    )}
                  </Paper>
                </Box>
              </Slide>
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* Security Information Section */}
      <Box sx={{ 
        py: 15, 
        position: 'relative', 
        zIndex: 1,
        background: `
          linear-gradient(135deg, 
            rgba(0, 0, 0, 0.4) 0%, 
            rgba(13, 15, 14, 0.6) 50%,
            rgba(0, 0, 0, 0.4) 100%
          )
        `,
        backdropFilter: 'blur(5px)'
      }}>
        <Container maxWidth="xl">
          <Box sx={{ 
            textAlign: 'center', 
            mb: 10,
            transform: `translateY(${(scrollY || 0) * 0.05}px)`
          }}>
            <Typography sx={{
              color: COLORS.gold,
              
              fontSize: '1rem',
              fontWeight: 'bold',
              mb: 2,
              opacity: 0.8,
              letterSpacing: '0.3em',
              textTransform: 'uppercase'
            }}>
              Bezpieczeństwo
            </Typography>

            <Typography variant="h2" sx={{
              background: `linear-gradient(135deg, ${COLORS.secondary} 0%, ${COLORS.gold} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              
              fontWeight: 'bold',
              mb: 6,
              fontSize: { xs: '2.5rem', md: '4rem' }
            }}>
              Twojego Konta
            </Typography>
          </Box>

          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Box sx={{
              maxWidth: '800px',
              width: '100%',
              background: `
                linear-gradient(135deg, 
                  rgba(0, 0, 0, 0.8) 0%, 
                  rgba(13, 15, 14, 0.9) 100%
                )
              `,
              backdropFilter: 'blur(20px)',
              border: `2px solid ${COLORS.glassGold}`,
              borderRadius: '24px',
              p: 6,
              boxShadow: `
                0 25px 80px rgba(0, 0, 0, 0.6),
                inset 0 1px 0 rgba(255, 255, 255, 0.1),
                0 0 60px rgba(75, 85, 99, 0.15)
              `,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(45deg, transparent 30%, rgba(154, 119, 40, 0.05) 50%, transparent 70%)`,
                borderRadius: '24px',
                pointerEvents: 'none'
              }
            }}>
              <Typography variant="h4" sx={{
                color: COLORS.gold,
                
                fontWeight: 'bold',
                mb: 4,
                textAlign: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                🔐 Wskazówki dotyczące bezpieczeństwa
              </Typography>

              <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
                {[
                  {
                    icon: '🔒',
                    title: 'Silne hasło',
                    desc: 'Użyj co najmniej 8 znaków z literami, cyframi i symbolami'
                  },
                  {
                    icon: '🔄',
                    title: 'Regularna zmiana',
                    desc: 'Zmieniaj hasło regularnie, szczególnie po naruszeniu bezpieczeństwa'
                  },
                  {
                    icon: '🚫',
                    title: 'Unikalne hasła',
                    desc: 'Nie używaj tego samego hasła do różnych serwisów'
                  },
                  {
                    icon: '👥',
                    title: 'Nie udostępniaj',
                    desc: 'Nigdy nie udostępniaj swojego hasła innym osobom'
                  }
                ].map((tip, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Box sx={{
                      background: `rgba(154, 119, 40, 0.1)`,
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${COLORS.glassGold}`,
                      borderRadius: '16px',
                      p: 3,
                      height: '100%',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        background: `rgba(75, 85, 99, 0.15)`,
                        transform: 'translateY(-5px)',
                        borderColor: COLORS.gold
                      }
                    }}>
                      <Typography sx={{
                        fontSize: '2rem',
                        mb: 2,
                        textAlign: 'center'
                      }}>
                        {tip.icon}
                      </Typography>
                      <Typography sx={{
                        color: COLORS.gold,
                        
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        mb: 1,
                        textAlign: 'center'
                      }}>
                        {tip.title}
                      </Typography>
                      <Typography sx={{
                        color: COLORS.secondary,
                        
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        textAlign: 'center'
                      }}>
                        {tip.desc}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{
                background: `rgba(75, 85, 99, 0.15)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${COLORS.gold}`,
                borderRadius: '16px',
                p: 3,
                mt: 4,
                textAlign: 'center',
                position: 'relative',
                zIndex: 1
              }}>
                <Typography sx={{
                  color: COLORS.gold,
                  
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}>
                  📧 Potrzebujesz pomocy? Skontaktuj się z nami:
                  <br />
                  <span style={{ color: COLORS.goldLight }}>admin@gaaran.cba.pl</span>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Advanced animations styles - dark theme */}
      <style>
        {`
          @keyframes float {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg); 
            }
            33% { 
              transform: translateY(-15px) rotate(1deg); 
            }
            66% { 
              transform: translateY(10px) rotate(-1deg); 
            }
          }
          
          @keyframes pulse {
            0%, 100% { 
              opacity: 0.6;
              transform: scale(1);
            }
            50% { 
              opacity: 1;
              transform: scale(1.05);
            }
          }
          
          html {
            scroll-behavior: smooth;
          }
          
          /* Custom scrollbar - dark style */
          ::-webkit-scrollbar {
            width: 8px;
          }
          
          ::-webkit-scrollbar-track {
            background: ${COLORS.backgroundDark};
          }
          
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%);
            border-radius: 4px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 100%);
          }
          
          /* Additional styles for better animation */
          * {
            box-sizing: border-box;
          }
          
          body {
            background-color: ${COLORS.backgroundDark};
            color: ${COLORS.secondary};
            font-family: 'EB Garamond', Georgia, serif;
          }
          
          /* Improvements for smooth scrolling */
          @media (prefers-reduced-motion: no-preference) {
            html {
              scroll-behavior: smooth;
            }
          }
          
          /* Focus styles for accessibility */
          button:focus-visible,
          .MuiButton-root:focus-visible {
            outline: 2px solid ${COLORS.gold};
            outline-offset: 2px;
          }
        `}
      </style>
    </Box>
  );
};

export default NewPassword;
