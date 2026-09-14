import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import toast from 'react-hot-toast';
import GameToaster from './GameToaster';
import { useAuth } from './AuthContext';
import RaceDivider from './RaceDivider';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const API_BASE = '/api';

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

function Cemetery() {
  const theme = useTheme();
  const navigate = useNavigate();
  const toastStyle = getToastStyle(theme);
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  const [deadCharacters, setDeadCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState({ open: false, character: null });
  const [editedReason, setEditedReason] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadDeadCharacters();
  }, []);

  const loadDeadCharacters = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dead-characters`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Błąd pobierania danych');
      }

      const data = await res.json();
      setDeadCharacters(data.characters || []);
    } catch (err) {
      toast.error(err.message, toastStyle);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (character) => {
    setEditDialog({ open: true, character });
    setEditedReason(character.deathReason || '');
  };

  const handleSaveReason = async () => {
    if (!editDialog.character) return;

    try {
      const res = await fetch(`${API_BASE}/dead-characters/${editDialog.character.id}/death-reason`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deathReason: editedReason }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Błąd zapisywania');
      }

      toast.success('Przyczyna śmierci zaktualizowana', toastStyle);
      loadDeadCharacters();
      setEditDialog({ open: false, character: null });
    } catch (err) {
      toast.error(err.message, toastStyle);
    }
  };

  const handleMenuOpen = (event, character) => {
    setAnchorEl(event.currentTarget);
    setSelectedCharacter(character);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCharacter(null);
  };

  const handleEditFromMenu = () => {
    if (selectedCharacter) {
      handleEditClick(selectedCharacter);
    }
    handleMenuClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nieznana';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getDeletionTypeLabel = (type) => {
    switch (type) {
      case 'deleted':
        return 'Usunięta';
      case 'reset':
        return 'Zresetowana';
      default:
        return 'Nieznany';
    }
  };


  if (loading) {
    return (
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: theme.palette.background.default,
      }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 3, minHeight: '100vh', bgcolor: theme.palette.background.default, position: 'relative' }}>
      {/* Powrót na stronę główną */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/home')}
        sx={{ mb: 2, color: theme.palette.text.secondary }}
      >
        Powrót
      </Button>

      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            
            mb: 1,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textAlign: 'center',
            mt: 2,
          }}
        >
          CMENTARZ POSTACI
        </Typography>

        <Typography
          sx={{
            color: theme.palette.text.secondary,
            
            textAlign: 'center',
            mb: 4,
            fontStyle: 'italic',
            fontSize: '0.95rem',
          }}
        >
          „In memoriam "
        </Typography>

        {deadCharacters.length === 0 ? (
          <Box sx={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Alert
              severity="info"
              sx={{
                
                borderRadius: '4px',
                maxWidth: '600px',
              }}
            >
              Nikt jeszcze nie umarł.
            </Alert>
          </Box>
        ) : (
          <Box sx={{ minHeight: '400px' }}>
            {[...deadCharacters].reverse().map((char, index) => (
              <React.Fragment key={char.id}>
              <Box
                sx={{
                  py: 3,
                  px: 2,
                  position: 'relative',
                  '&:hover': {
                    bgcolor: theme.palette.action.hover,
                    transition: 'all 0.2s ease',
                  },
                }}
              >
                {/* Menu dla admina */}
                {isAdmin && (
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, char)}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        color: theme.palette.primary.main,
                      },
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                )}

                {/* Imię postaci */}
                <Typography
                  sx={{
                    
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    color: theme.palette.text.primary,
                    mb: 2,
                  }}
                >
                  {char.name}
                </Typography>

                {/* Przyczyna śmierci */}
                <Typography
                  sx={{
                    
                    color: theme.palette.text.secondary,
                    fontSize: '0.95rem',
                    mb: 2,
                    fontStyle: 'italic',
                  }}
                >
                  {char.deathReason || 'Nieznana'}
                </Typography>

                {/* Data */}
                <Typography
                  sx={{
                    
                    color: theme.palette.text.secondary,
                    fontSize: '0.9rem',
                  }}
                >
                  {formatDate(char.deletedAt)}
                </Typography>
              </Box>
              {index < deadCharacters.length - 1 && (
                <RaceDivider variant="bottom" raceKey={char.faction} sx={{ my: 0.5 }} />
              )}
              </React.Fragment>
            ))}
          </Box>
        )}
      </Box>

      {/* Dialog edycji przyczyny śmierci */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, character: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: theme.palette.background.paper,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: '4px',
          },
        }}
      >
        <DialogTitle
          sx={{
            
            fontWeight: 'bold',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          Edytuj przyczynę śmierci
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography
            sx={{
              
              color: theme.palette.text.secondary,
              mb: 2,
            }}
          >
            Postać: <strong>{editDialog.character?.name}</strong>
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Przyczyna śmierci"
            value={editedReason}
            onChange={(e) => setEditedReason(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                
                color: theme.palette.text.primary,
              },
              '& .MuiInputLabel-root': {
                
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setEditDialog({ open: false, character: null })}
            sx={{
              
              color: theme.palette.text.secondary,
            }}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSaveReason}
            variant="contained"
            startIcon={<SaveIcon />}
            sx={{
              
              fontWeight: 'bold',
            }}
          >
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu dropdown dla admina */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '4px',
            minWidth: '200px',
          },
        }}
      >
        {selectedCharacter && (
          <Box>
            <MenuItem disabled sx={{ opacity: '1 !important' }}>
              <Box>
                <Typography
                  sx={{
                    
                    fontSize: '0.85rem',
                    color: theme.palette.text.secondary,
                  }}
                >
                  <strong>Typ:</strong> {getDeletionTypeLabel(selectedCharacter.deletionType)}
                </Typography>
                <Typography
                  sx={{
                    
                    fontSize: '0.85rem',
                    color: theme.palette.text.secondary,
                    mt: 0.5,
                  }}
                >
                  <strong>Gracz:</strong> {selectedCharacter.playerName || 'Nieznany'}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={handleEditFromMenu}
              sx={{
                
                color: theme.palette.text.primary,
                '&:hover': {
                  bgcolor: theme.palette.action.hover,
                },
              }}
            >
              <EditIcon fontSize="small" sx={{ mr: 1 }} />
              Edytuj powód
            </MenuItem>
          </Box>
        )}
      </Menu>

      <GameToaster style={toastStyle.style} duration={4000} />
    </Box>
  );
}

export default Cemetery;
