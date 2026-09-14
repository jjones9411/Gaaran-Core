import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Avatar,
  Divider,
  Chip,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  EmojiEvents as TrophyIcon,
  ReportProblem as ProblemIcon,
  AccountBox as CardIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const CharacterCardPopup = ({ open, onClose, characterId, characterName, characterAvatar }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardData, setCardData] = useState(null);
  const [races, setRaces] = useState([]);

  useEffect(() => {
    if (open && characterId) {
      fetchCharacterCard();
    }
  }, [open, characterId]);

  // Pobierz listę ras (do mapowania klucza rasy na czytelną nazwę)
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';

  const fetchCharacterCard = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${characterId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.card) {
          setCardData(data.card);
        } else {
          setError('Postać nie ma jeszcze wypełnionej karty postaci');
        }
      } else {
        setError('Nie udało się pobrać karty postaci');
      }
    } catch (err) {
      console.error('Error fetching character card:', err);
      setError('Błąd podczas pobierania karty postaci');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL');
  };

  // Ta sama zasada co na karcie postaci w profilu: po datach filtrujemy tylko
  // wpisy ZATWIERDZONE (konsekwencje czasowe - choroby, skutki sesji, które
  // wygasają). Wady/zalety czekające na akceptację albo odrzucone do poprawy
  // pokazujemy zawsze - inaczej znikają z karty, choć administracja widzi je w
  // kolejce akceptacji KP (a gracz nie ma jak ich poprawić).
  const isItemActive = (item) => {
    if (!item) return false;
    if (!item.is_approved) return true;

    const now = new Date();
    const startDate = item.start_date ? new Date(item.start_date) : null;
    const endDate = item.end_date ? new Date(item.end_date) : null;

    if (startDate && !Number.isNaN(startDate.getTime()) && startDate > now) return false;
    if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) return false;

    return true;
  };

  const renderAchievements = () => {
    if (!cardData?.achievements || cardData.achievements.length === 0) {
      return (
        <Typography sx={{
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
          textAlign: 'center',
          py: 2,
          
          fontSize: '0.9rem'
        }}>
          Brak aktywnych zalet
        </Typography>
      );
    }

    const activeAchievements = cardData.achievements.filter(isItemActive);

    if (activeAchievements.length === 0) {
      return (
        <Typography sx={{
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
          textAlign: 'center',
          py: 2,
          
          fontSize: '0.9rem'
        }}>
          Brak aktywnych zalet
        </Typography>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {activeAchievements.map((achievement) => (
          <Box
            key={achievement.id}
            sx={{
              p: 1.5,
              backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : theme.palette.text.primary,
              borderRadius: 0,
              border: `2px solid ${theme.palette.primary.main}`,
              borderLeft: `4px solid ${theme.palette.primary.main}`,
            }}
          >
            <Typography sx={{
              color: theme.palette.primary.main,
              fontWeight: 'bold',
              fontSize: '0.95rem',
              
              textTransform: 'uppercase'
            }}>
              {achievement.title}
            </Typography>
            {achievement.description && (
              <Typography sx={{
                color: theme.palette.text.primary,
                fontSize: '0.85rem',
                mt: 0.5,
                fontStyle: 'italic',
                }}>
                {achievement.description}
              </Typography>
            )}
            <Box sx={{ mt: 0.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {achievement.level && (
                <Typography sx={{
                  color: theme.palette.primary.main,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  }}>
                  Poziom {achievement.level}/5
                </Typography>
              )}
              {achievement.start_date && (
                <Typography sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                  }}>
                  Od: {formatDate(achievement.start_date)}
                </Typography>
              )}
              {achievement.end_date ? (
                <Typography sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                  }}>
                  Do: {formatDate(achievement.end_date)}
                </Typography>
              ) : (
                <Typography sx={{
                  color: theme.palette.primary.main,
                  fontSize: '0.75rem',
                  }}>
                  Stałe
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  const renderProblems = () => {
    if (!cardData?.problems || cardData.problems.length === 0) {
      return (
        <Typography sx={{
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
          textAlign: 'center',
          py: 2,
          
          fontSize: '0.9rem'
        }}>
          Brak aktywnych wad
        </Typography>
      );
    }

    const activeProblems = cardData.problems.filter(isItemActive);

    if (activeProblems.length === 0) {
      return (
        <Typography sx={{
          color: theme.palette.text.secondary,
          fontStyle: 'italic',
          textAlign: 'center',
          py: 2,
          
          fontSize: '0.9rem'
        }}>
          Brak aktywnych wad
        </Typography>
      );
    }

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {activeProblems.map((problem) => (
          <Box
            key={problem.id}
            sx={{
              p: 1.5,
              backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.paper : theme.palette.text.primary,
              borderRadius: 0,
              border: `2px solid ${theme.palette.error.main}`,
              borderLeft: `4px solid ${theme.palette.error.main}`,
            }}
          >
            <Typography sx={{
              color: theme.palette.error.text,
              fontWeight: 'bold',
              fontSize: '0.95rem',
              
              textTransform: 'uppercase'
            }}>
              {problem.title}
            </Typography>
            {problem.description && (
              <Typography sx={{
                color: theme.palette.text.primary,
                fontSize: '0.85rem',
                mt: 0.5,
                fontStyle: 'italic',
                }}>
                {problem.description}
              </Typography>
            )}
            <Box sx={{ mt: 0.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {problem.level && (
                <Typography sx={{
                  color: theme.palette.error.text,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  }}>
                  Poziom {problem.level}/5
                </Typography>
              )}
              {problem.start_date && (
                <Typography sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                  }}>
                  Od: {formatDate(problem.start_date)}
                </Typography>
              )}
              {problem.end_date ? (
                <Typography sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.75rem',
                  }}>
                  Do: {formatDate(problem.end_date)}
                </Typography>
              ) : (
                <Typography sx={{
                  color: theme.palette.error.text,
                  fontSize: '0.75rem',
                  }}>
                  Stałe
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: `2px solid ${theme.palette.divider}`,
          borderRadius: 2,
          maxHeight: '85vh'
        }
      }}
    >
      <DialogTitle sx={{
        color: theme.palette.text.secondary,
        borderBottom: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CardIcon />
          <Typography variant="h6" component="div" sx={{ }}>
            Karta Postaci
          </Typography>
        </Box>

        <IconButton
          onClick={onClose}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.3)' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : cardData ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Avatar i podstawowe dane - avatar po lewej, dane w dwóch kolumnach po prawej */}
            <Box sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 2,
              p: 2,
              backgroundColor: 'rgba(13, 15, 14, 0.3)',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1
            }}>
              {/* Avatar */}
              <Avatar
                src={characterAvatar}
                sx={{
                  width: 80,
                  height: 100,
                  bgcolor: theme.palette.text.secondary,
                  border: `2px solid ${theme.palette.primary.main}`,
                  boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
                  borderRadius: 0,
                  flexShrink: 0
                }}
              >
                {characterName ? characterName[0]?.toUpperCase() : 'C'}
              </Avatar>

              {/* Dwie kolumny z danymi */}
              <Box sx={{ flex: 1, display: 'flex', gap: 3 }}>
                {/* Lewa kolumna: Imię, Rasa, Płeć */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography sx={{
                    fontWeight: 'bold',
                    fontSize: 18,
                    color: theme.palette.primary.main,
                    
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    mb: 1
                  }}>
                    {cardData.first_name && cardData.last_name
                      ? `${cardData.first_name} ${cardData.last_name}`
                      : characterName}
                  </Typography>
                  {cardData.faction && (
                    <Typography sx={{
                      fontSize: 14,
                      color: theme.palette.text.primary,
                      
                      mb: 0.5
                    }}>
                      <strong>Rasa:</strong> {getRaceName(cardData.faction)}
                    </Typography>
                  )}
                  {cardData.gender && (
                    <Typography sx={{
                      fontSize: 14,
                      color: theme.palette.text.primary,
                      }}>
                      <strong>Płeć:</strong> {cardData.gender}
                    </Typography>
                  )}
                </Box>

                {/* Prawa kolumna: Wiek, Wzrost */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {cardData.age && (
                    <Typography sx={{
                      fontSize: 14,
                      color: theme.palette.text.primary,
                      
                      mb: 0.5
                    }}>
                      <strong>Wiek:</strong> {cardData.age} lat
                    </Typography>
                  )}
                  {cardData.height && (
                    <Typography sx={{
                      fontSize: 14,
                      color: theme.palette.text.primary,
                      }}>
                      <strong>Wzrost:</strong> {cardData.height} cm
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Opis postaci */}
            {cardData.character_description && (
              <Box>
                <Typography variant="h6" sx={{
                  
                  color: theme.palette.text.secondary,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  mb: 1.5,
                  fontSize: '1rem'
                }}>
                  Opis postaci
                </Typography>
                <Box sx={{
                  p: 2,
                  backgroundColor: 'rgba(13, 15, 14, 0.3)',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Typography sx={{
                    color: theme.palette.text.primary,
                    whiteSpace: 'pre-wrap',
                    
                    fontSize: '0.9rem'
                  }}>
                    {cardData.character_description}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Opis wizualny */}
            {cardData.visual_description && (
              <Box>
                <Typography variant="h6" sx={{
                  
                  color: theme.palette.text.secondary,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  mb: 1.5,
                  fontSize: '1rem'
                }}>
                  Opis wizualny
                </Typography>
                <Box sx={{
                  p: 2,
                  backgroundColor: 'rgba(13, 15, 14, 0.3)',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Typography sx={{
                    color: theme.palette.text.primary,
                    whiteSpace: 'pre-wrap',
                    
                    fontSize: '0.9rem'
                  }}>
                    {cardData.visual_description}
                  </Typography>
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 1 }} />

            {/* Zalety */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <TrophyIcon sx={{ color: theme.palette.primary.main }} />
                <Typography variant="h6" sx={{
                  
                  color: theme.palette.primary.main,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  fontSize: '1rem'
                }}>
                  Zalety
                </Typography>
                <Chip
                  label={cardData.achievements?.filter(isItemActive).length || 0}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    fontWeight: 'bold',
                    height: 20,
                    fontSize: '0.7rem'
                  }}
                />
              </Box>
              {renderAchievements()}
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Wady */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <ProblemIcon sx={{ color: theme.palette.error.text }} />
                <Typography variant="h6" sx={{
                  
                  color: theme.palette.error.text,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  fontSize: '1rem'
                }}>
                  Wady
                </Typography>
                <Chip
                  label={cardData.problems?.filter(isItemActive).length || 0}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.error.main,
                    color: theme.palette.common.white,
                    fontWeight: 'bold',
                    height: 20,
                    fontSize: '0.7rem'
                  }}
                />
              </Box>
              {renderProblems()}
            </Box>
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default CharacterCardPopup;
