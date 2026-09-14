import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Paper,
  Container,
  CircularProgress,
  Alert,
  Fade
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LoginIcon from '@mui/icons-material/Login';
import { appColors } from './theme';
import AuthBackdrop from './AuthBackdrop';
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

const ActivateAccount = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const gameName = useGameName();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const activateAccount = async () => {
      try {
        const response = await fetch(`/api/activate/${token}`, {
          method: 'POST',
        });

        const data = await response.json();

        if (response.ok) {
          setSuccess(true);
          setError('');
        } else {
          setSuccess(false);
          setError(data.message || 'Nie udało się aktywować konta. Sprawdź czy link jest prawidłowy.');
        }
      } catch {
        setSuccess(false);
        setError('Wystąpił błąd połączenia. Spróbuj ponownie później.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      activateAccount();
    } else {
      setError('Nieprawidłowy link aktywacyjny.');
      setLoading(false);
    }
  }, [token]);

  return (
    <Box sx={{
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
            p: 5,
            background: `rgba(0, 0, 0, 0.85)`,
            backdropFilter: 'blur(20px)',
            border: `2px solid ${COLORS.border}`,
            borderRadius: '0',
            boxShadow: `
              0 20px 50px rgba(0, 0, 0, 0.9),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
            textAlign: 'center'
          }}>
            {/* TYTUŁ */}
            <Typography variant="h3" sx={{
              
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '3rem' },
              color: COLORS.rust,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textShadow: `
                0 0 20px rgba(139, 69, 19, 0.6),
                0 0 40px rgba(122, 59, 15, 0.5),
                2px 2px 4px rgba(0, 0, 0, 0.9)
              `,
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
              textShadow: '0 0 10px rgba(113, 128, 150, 0.5)',
              mb: 5
            }}>
              [ AKTYWACJA KONTA ]
            </Typography>

            {loading ? (
              // Stan ładowania
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <CircularProgress
                  size={60}
                  sx={{
                    color: COLORS.rust,
                    mb: 3,
                    filter: 'drop-shadow(0 0 10px rgba(139, 69, 19, 0.7))'
                  }}
                />
                <Typography
                  variant="h5"
                  sx={{
                    
                    color: COLORS.secondary,
                    mb: 2,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}
                >
                  [ Aktywacja konta... ]
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: COLORS.steelLight,
                    
                    fontSize: '16px',
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  Proszę czekać, trwa weryfikacja Twojego konta.
                </Typography>
              </Box>
            ) : success ? (
              // Stan sukcesu
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <CheckCircleIcon
                  sx={{
                    fontSize: '5rem',
                    color: COLORS.rust,
                    mb: 3,
                    filter: `drop-shadow(0 0 15px ${COLORS.rust})`
                  }}
                />
                <Typography
                  variant="h4"
                  sx={{
                    
                    color: COLORS.secondary,
                    mb: 3,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}
                >
                  [ Konto aktywowane! ]
                </Typography>

                <Alert
                  severity="success"
                  sx={{
                    width: '100%',
                    mb: 4,
                    backgroundColor: 'rgba(122, 59, 15, 0.2)',
                    border: `1px solid ${COLORS.rust}`,
                    color: COLORS.secondary,
                    
                    borderRadius: '0',
                    '& .MuiAlert-icon': {
                      color: COLORS.rust
                    },
                    '& .MuiAlert-message': {
                      fontSize: '1rem',
                      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                    }
                  }}
                >
                  Twoje konto zostało pomyślnie aktywowane. Możesz teraz zalogować się i rozpocząć swoją przygodę w {gameName}.
                </Alert>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={<LoginIcon />}
                  onClick={() => navigate('/login')}
                  sx={{
                    background: COLORS.rust,
                    color: COLORS.background,
                    
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    px: 4,
                    py: 2,
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
                    transition: 'all 0.3s ease',
                  }}
                >
                  [ Przejdź do logowania ]
                </Button>
              </Box>
            ) : (
              // Stan błędu
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <ErrorIcon
                  sx={{
                    fontSize: '5rem',
                    color: COLORS.bloodRust,
                    mb: 3,
                    filter: `drop-shadow(0 0 15px ${COLORS.bloodRust})`
                  }}
                />
                <Typography
                  variant="h4"
                  sx={{
                    
                    color: COLORS.secondary,
                    mb: 3,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}
                >
                  [ Błąd aktywacji ]
                </Typography>

                <Alert
                  severity="error"
                  sx={{
                    width: '100%',
                    mb: 4,
                    backgroundColor: 'rgba(155, 44, 44, 0.2)',
                    border: `1px solid ${COLORS.bloodRust}`,
                    color: '#ffcdd2',
                    
                    borderRadius: '0',
                    '& .MuiAlert-icon': {
                      color: COLORS.bloodRust
                    },
                    '& .MuiAlert-message': {
                      fontSize: '1rem',
                      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                    }
                  }}
                >
                  {error}
                </Alert>

                <Typography
                  variant="body1"
                  sx={{
                    color: COLORS.steelLight,
                    
                    fontSize: '16px',
                    lineHeight: 1.8,
                    mb: 4,
                    textAlign: 'center',
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  Możliwe przyczyny:
                  <br />• Link wygasł lub był już używany
                  <br />• Konto zostało już aktywowane
                  <br />• Nieprawidłowy adres URL
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/register')}
                    sx={{
                      borderColor: COLORS.border,
                      color: COLORS.rust,
                      
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      fontSize: '0.95rem',
                      px: 3,
                      py: 1.5,
                      borderWidth: '2px',
                      borderRadius: '0',
                      textShadow: '0 0 10px rgba(139, 69, 19, 0.5)',
                      '&:hover': {
                        background: COLORS.glassRust,
                        borderColor: COLORS.rust,
                        transform: 'translateY(-2px)',
                        boxShadow: '0 5px 20px rgba(139, 69, 19, 0.4)'
                      }
                    }}
                  >
                    [ Zarejestruj ponownie ]
                  </Button>

                  <Button
                    variant="contained"
                    onClick={() => navigate('/login')}
                    sx={{
                      background: COLORS.rust,
                      color: COLORS.background,
                      
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      px: 3,
                      py: 1.5,
                      borderRadius: '0',
                      textTransform: 'uppercase',
                      border: `2px solid ${COLORS.rustDark}`,
                      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                      '&:hover': {
                        background: COLORS.rustLight,
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 30px rgba(139, 69, 19, 0.5)'
                      },
                    }}
                  >
                    [ Przejdź do logowania ]
                  </Button>
                </Box>
              </Box>
            )}

            {/* Informacje dodatkowe */}
            <Typography
              variant="caption"
              sx={{
                mt: 4,
                color: COLORS.steel,
                
                fontSize: '12px',
                textAlign: 'center',
                fontStyle: 'italic',
                opacity: 0.7,
                textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
              }}
            >
              Jeśli nadal masz problemy z aktywacją, skontaktuj się z administratorem: admin@gaaran.cba.pl
            </Typography>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

export default ActivateAccount;
