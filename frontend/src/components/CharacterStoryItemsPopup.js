// ================================
// CharacterStoryItemsPopup
// Podgląd PRZEDMIOTÓW FABULARNYCH postaci - otwierany z panelu uczestników
// sesji (GeneralSessions / PrivateSessions) obok Karty Postaci i statystyk.
// Podczas gry mistrz gry musi mieć pod ręką spis rzeczy, które postać wygrała
// w fabule (relikwie, listy, klucze), zamiast wychodzić z sesji na profil.
//
// To ten sam spis co zakładka "Przedmioty" w profilu i to samo źródło danych
// (/api/home/profile/:id/story-items). Podgląd jest wyłącznie do czytania -
// dopisuje i zabiera przedmioty administracja z profilu postaci, bo tam jest
// jedno miejsce na tę operację (i jeden ślad w kartotece).
//
// To NIE jest ekwipunek mechaniczny: te przedmioty nie dają statystyk i nie
// wchodzą do walki ani rzemiosła.
// ================================

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Avatar,
  Chip,
  Alert,
  Stack
} from '@mui/material';
import {
  Close as CloseIcon,
  Inventory2 as InventoryIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const formatDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pl-PL');
};

const CharacterStoryItemsPopup = ({ open, onClose, characterId, characterName, characterAvatar }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${characterId}/story-items`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        setError('Nie udało się pobrać przedmiotów postaci');
        return;
      }

      const data = await response.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error('Błąd pobierania przedmiotów fabularnych:', err);
      setError('Błąd podczas pobierania przedmiotów postaci');
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    if (open && characterId) {
      fetchItems();
    }
  }, [open, characterId, fetchItems]);

  const renderItem = (item) => {
    const created = formatDate(item.created_at);

    return (
      <Box
        key={item.id}
        sx={{
          p: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          borderLeft: `3px solid ${theme.palette.primary.main}`,
          backgroundColor: 'rgba(13, 15, 14, 0.3)'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            {item.name}
          </Typography>
          {Number(item.quantity) > 1 && (
            <Chip
              label={`x${item.quantity}`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 'bold',
                borderRadius: 0,
                backgroundColor: `${theme.palette.primary.main}22`,
                color: theme.palette.primary.main,
                border: `1px solid ${theme.palette.primary.main}66`
              }}
            />
          )}
        </Box>

        {item.description && (
          <Typography
            variant="body2"
            sx={{ color: theme.palette.text.primary, mt: 0.75, whiteSpace: 'pre-wrap' }}
          >
            {item.description}
          </Typography>
        )}

        {(item.source || created) && (
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}
          >
            {item.source ? `Pochodzenie: ${item.source}` : ''}
            {item.source && created ? ' • ' : ''}
            {created ? `Wpisane: ${created}` : ''}
            {created && item.granted_by_name ? ` przez ${item.granted_by_name}` : ''}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
          <InventoryIcon />
          <Typography variant="h6" component="div">
            Przedmioty postaci
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
        {/* Nagłówek z awatarem - ten sam układ co w podglądzie statystyk, żeby
            przy przełączaniu podglądów nie skakało, czyją postać się ogląda. */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          mb: 2,
          backgroundColor: 'rgba(13, 15, 14, 0.3)',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1
        }}>
          <Avatar
            src={characterAvatar}
            sx={{
              width: 64,
              height: 80,
              bgcolor: theme.palette.text.secondary,
              border: `2px solid ${theme.palette.primary.main}`,
              borderRadius: 0,
              flexShrink: 0
            }}
          >
            {characterName ? characterName[0]?.toUpperCase() : 'C'}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontWeight: 'bold',
              fontSize: 18,
              color: theme.palette.primary.main,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {characterName}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Rzeczy zdobyte w fabule. Dopisuje je i zabiera administracja z profilu postaci.
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="warning">
            {error}
          </Alert>
        ) : items.length === 0 ? (
          <Box sx={{
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: 'rgba(13, 15, 14, 0.3)'
          }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
              Ta postać nie ma jeszcze żadnych przedmiotów fabularnych.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            {items.map(renderItem)}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CharacterStoryItemsPopup;
