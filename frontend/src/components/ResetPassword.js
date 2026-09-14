import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Container,
  Fade,
  CircularProgress
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockResetIcon from '@mui/icons-material/LockReset';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import AuthBackdrop from './AuthBackdrop';
import AuthFrame from './AuthFrame';
import { appColors, authPanelSx, authFieldSx, authGoldLight } from './theme';

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

const ResetPassword = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Walidacja email w czasie rzeczywistym
  useEffect(() => {
    if (email && !email.includes('@')) {
      setEmailError('Wprowadź prawidłowy adres e-mail');
    } else {
      setEmailError('');
    }
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setMessage('Proszę wprowadzić adres e-mail');
      return;
    }

    if (emailError) {
      setMessage('Proszę wprowadzić prawidłowy adres e-mail');
      return;
    }

    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsSuccess(true);
        setMessage('Link do resetowania hasła został wysłany na podany adres e-mail.');
      } else {
        setIsSuccess(false);
        setMessage(data.message || 'Wystąpił błąd podczas wysyłania linku.');
      }
    } catch (error) {
      console.error('Błąd podczas resetowania hasła:', error);
      setIsSuccess(false);
      setMessage('Wystąpił błąd połączenia. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
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

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 10 }}>
        <Fade in={true} timeout={1200}>
          <Paper sx={{
            ...authPanelSx,
            ...authFieldSx,
            p: { xs: 3, sm: 4, md: 6 },
            maxWidth: '600px',
            mx: 'auto',
            position: 'relative',
            // UWAGA: NIE definiować tu '&::before'/'&::after' - nadpisałyby ramkę
            // PNG i teksturę z authPanelSx (to one dają wygląd jak w Login).
          }}>
            <AuthFrame />
            {/* Success State */}
            {isSuccess ? (
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ 
                  fontSize: '5rem', 
                  color: '#4caf50',
                  mb: 3,
                  filter: 'drop-shadow(0 0 20px rgba(76, 175, 80, 0.6))',
                }} />
                
                <Typography variant="h4" sx={{
                  color: authGoldLight,

                  fontWeight: 'bold',
                  mb: 3,
                  textTransform: 'uppercase',
                  fontSize: { xs: '1.4rem', sm: '1.9rem', md: '2.125rem' },
                  textShadow: '1px 1px 3px rgba(0,0,0,0.9)'
                }}>
                  E-MAIL WYSŁANY
                </Typography>
                
                <Typography sx={{
                  color: COLORS.secondary,
                  
                  fontSize: '1rem',
                  mb: 4,
                  lineHeight: 1.8,
                  textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                }}>
                  Sprawdź swoją skrzynkę pocztową i kliknij w link, aby zresetować hasło.
                  Pamiętaj o sprawdzeniu folderu spam!
                </Typography>

                <Box sx={{
                  background: 'rgba(122, 59, 15, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${COLORS.rust}`,
                  borderRadius: '0',
                  p: 3,
                  mb: 4
                }}>
                  <Typography sx={{
                    color: COLORS.rust,
                    
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    mb: 1,
                    textTransform: 'uppercase'
                  }}>
                    📧 E-mail wysłany na:
                  </Typography>
                  <Typography sx={{
                    color: COLORS.secondary,
                    
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    wordBreak: 'break-all',
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                  }}>
                    {email}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => navigate('/login')}
                  startIcon={<ArrowBackIcon />}
                  sx={{
                    background: COLORS.rust,
                    color: COLORS.background,
                    
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    py: 2,
                    borderRadius: '0',
                    textTransform: 'uppercase',
                    border: `2px solid ${COLORS.rustDark}`,
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                    '&:hover': {
                      background: COLORS.rustLight,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 30px rgba(139, 69, 19, 0.5)'
                    }
                  }}
                >
                  POWRÓT DO LOGOWANIA
                </Button>
              </Box>
            ) : (
              <>
                {/* Form Header */}
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <LockResetIcon sx={{
                    fontSize: '3.5rem',
                    color: authGoldLight,
                    mb: 2,
                    filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.9))'
                  }} />

                  <Typography variant="h4" sx={{
                    color: authGoldLight,

                    fontWeight: 'bold',
                    mb: 2,
                    textTransform: 'uppercase',
                    fontSize: { xs: '1.5rem', sm: '1.9rem', md: '2.125rem' },
                    letterSpacing: { xs: '0.05em', sm: '0.1em' },
                    textShadow: '1px 1px 3px rgba(0,0,0,0.9)'
                  }}>
                    RESETUJ HASŁO
                  </Typography>

                  <Typography sx={{
                    color: COLORS.secondary,
                    
                    fontSize: '0.9rem',
                    opacity: 0.9,
                    lineHeight: 1.6,
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                  }}>
                    Wprowadź adres e-mail powiązany z Twoim kontem
                  </Typography>
                </Box>

                {/* Email Form */}
                <form onSubmit={handleSubmit}>
                  {/* Email Field */}
                  <Box sx={{ position: 'relative', mb: 4 }}>
                    <EmailIcon sx={{
                      position: 'absolute',
                      left: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: emailError ? COLORS.bloodRust : COLORS.rust,
                      zIndex: 1,
                      fontSize: '1.2rem',
                      filter: `drop-shadow(0 0 5px ${emailError ? COLORS.bloodRust : COLORS.rust})`
                    }} />
                    <TextField
                      fullWidth
                      type="email"
                      variant="outlined"
                      placeholder="E-MAIL"
                      value={email}
                      onChange={(e) => setEmail(e.target.value || '')}
                      required
                      disabled={isLoading}
                      error={!!emailError}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: '0',
                          
                          pl: 6,
                          '& fieldset': { borderColor: emailError ? COLORS.bloodRust : COLORS.border },
                          '&:hover fieldset': { borderColor: emailError ? COLORS.bloodRust : COLORS.rust },
                          '&.Mui-focused fieldset': { 
                            borderColor: emailError ? COLORS.bloodRust : COLORS.rust, 
                            borderWidth: '2px',
                            boxShadow: `0 0 15px ${emailError ? COLORS.bloodRust : COLORS.rust}40`
                          },
                          '& input': { 
                            color: COLORS.secondary, 
                            
                            textShadow: '0 0 5px rgba(203, 213, 224, 0.3)'
                          },
                          '& input::placeholder': { color: COLORS.steel, opacity: 0.7 }
                        }
                      }}
                    />
                    {emailError && (
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
                        {emailError}
                      </Typography>
                    )}
                  </Box>

                  {/* Submit Button */}
                  <Button
                    fullWidth
                    variant="contained"
                    type="submit"
                    disabled={isLoading || !!emailError || !email}
                    startIcon={isLoading ? <CircularProgress size={20} sx={{ color: COLORS.background }} /> : <SendIcon />}
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
                    {isLoading ? 'WYSYŁANIE...' : 'WYŚLIJ LINK'}
                  </Button>
                </form>

                {/* Error Message */}
                {message && !isSuccess && (
                  <Alert 
                    severity="error"
                    sx={{
                      mb: 3,
                      background: 'rgba(155, 44, 44, 0.3)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${COLORS.bloodRust}`,
                      borderRadius: '0',
                      
                      textTransform: 'uppercase',
                      '& .MuiAlert-message': {
                        color: COLORS.secondary,
                        
                        fontSize: '0.9rem'
                      },
                      '& .MuiAlert-icon': {
                        color: COLORS.bloodRust
                      }
                    }}
                  >
                    {message}
                  </Alert>
                )}

                {/* Return to Login Button */}
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/login')}
                  startIcon={<ArrowBackIcon />}
                  sx={{
                    borderColor: COLORS.border,
                    color: COLORS.rust,
                    
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '0.95rem',
                    borderWidth: '2px',
                    borderRadius: '0',
                    py: 1.5,
                    mb: 3,
                    textShadow: '0 0 10px rgba(139, 69, 19, 0.5)',
                    '&:hover': {
                      background: COLORS.glassRust,
                      borderColor: COLORS.rust,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 5px 20px rgba(139, 69, 19, 0.4)'
                    }
                  }}
                >
                  POWRÓT DO LOGOWANIA
                </Button>

                {/* Info Box */}
                <Box sx={{
                  background: 'rgba(139, 69, 19, 0.1)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: '0',
                  p: 2
                }}>
                  <Typography sx={{
                    color: COLORS.secondary,
                    
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    lineHeight: 1.6,
                    opacity: 0.8,
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                  }}>
                    Jeśli nie otrzymasz e-maila w ciągu kilku minut, sprawdź folder spam 
                    lub skontaktuj się z administratorem: admin@gaaran.cba.pl
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

export default ResetPassword;