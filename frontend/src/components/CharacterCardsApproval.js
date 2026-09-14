import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { getUserRole } from './AuthContext';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Avatar,
  Stack,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Person as PersonIcon,
  Cake as AgeIcon,
  Height as HeightIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

const API_URL = '/api';

const formatEntryDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pl-PL');
};

// Okres obowiązywania wady/zalety - "Stałe" albo zakres dat. Wpisy czasowe
// (choroby, konsekwencje z sesji, ograniczone czasowo decyzje MG) znikają z
// karty postaci po dacie końcowej, więc admin musi je tu odróżnić od stałych.
const entryPeriodLabel = (entry) => {
  const from = formatEntryDate(entry.start_date);
  const to = formatEntryDate(entry.end_date);
  if (!from && !to) return 'Stałe';
  if (from && to) return `Od: ${from} · Do: ${to}`;
  if (from) return `Od: ${from} · Stałe`;
  return `Do: ${to}`;
};

const isEntryExpired = (entry) => {
  if (!entry.end_date) return false;
  const end = new Date(entry.end_date);
  if (Number.isNaN(end.getTime())) return false;
  return end <= new Date();
};

function CharacterCardsApproval() {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [pendingCards, setPendingCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [viewCardDialogOpen, setViewCardDialogOpen] = useState(false);
  // Odrzucanie pojedynczej wady/zalety z komentarzem (wpis nie znika)
  const [entryRejectDialogOpen, setEntryRejectDialogOpen] = useState(false);
  const [entryRejectTarget, setEntryRejectTarget] = useState(null); // { characterId, type, id, kind, title }
  const [entryRejectReason, setEntryRejectReason] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    // Dekoduj token JWT i sprawdź rolę używając scentralizowanej funkcji
    try {
      const userRole = getUserRole(token);

      if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
        navigate('/home');
        return;
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      navigate('/home');
      return;
    }

    fetchPendingCards();
  }, [navigate]);

const fetchPendingCards = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/character-cards/pending`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Błąd pobierania kart');

    const data = await response.json();
    setPendingCards(data.cards || []);
  } catch (error) {
    console.error('Błąd pobierania kart:', error);
    alert('Nie udało się pobrać kart do akceptacji');
  } finally {
    setLoading(false);
  }
};

  // Zatwierdzenie pojedynczej wady/zalety z poziomu kolejki
  // (type: 'achievements' | 'problems')
  const handleEntryApprove = async (characterId, type, entryId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const url = `${API_URL}/home/profile/character-card/${characterId}/${type}/${entryId}/approve`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Błąd operacji');
      fetchPendingCards();
    } catch (error) {
      console.error('Błąd zatwierdzania wady/zalety:', error);
      alert('Nie udało się zatwierdzić pozycji');
    } finally {
      setActionLoading(false);
    }
  };

  const openEntryRejectDialog = (characterId, type, entry) => {
    setEntryRejectTarget({
      characterId,
      type,
      id: entry.id,
      kind: type === 'problems' ? 'Wada' : 'Zaleta',
      title: entry.title
    });
    setEntryRejectReason('');
    setEntryRejectDialogOpen(true);
  };

  // Odrzucenie wady/zalety z komentarzem - wpis NIE znika, dostaje powód
  // i wraca do gracza do poprawy (całej KP nie da się wtedy zaakceptować).
  const handleEntryRejectConfirm = async () => {
    if (!entryRejectTarget) return;
    if (!entryRejectReason.trim()) {
      alert('Podaj powód odrzucenia');
      return;
    }
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const { characterId, type, id } = entryRejectTarget;
      const response = await fetch(
        `${API_URL}/home/profile/character-card/${characterId}/${type}/${id}/reject`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejection_reason: entryRejectReason.trim() })
        }
      );
      if (!response.ok) throw new Error('Błąd operacji');
      setEntryRejectDialogOpen(false);
      setEntryRejectTarget(null);
      setEntryRejectReason('');
      fetchPendingCards();
    } catch (error) {
      console.error('Błąd odrzucania wady/zalety:', error);
      alert('Nie udało się odrzucić pozycji');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (cardId, characterId) => {
    if (!window.confirm('Zaakceptować tę kartę postaci? Wszystkie wady i zalety muszą być wcześniej zatwierdzone.')) return;

    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/admin/character-cards/${cardId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approved: true })
      });

      const data = await response.json().catch(() => ({}));

      // Serwer odsyła konkretny powód (np. które wady/zalety blokują akceptację) -
      // bez tego admin widział tylko ogólne "Nie udało się zaakceptować karty".
      if (!response.ok) throw new Error(data.message || 'Błąd akceptacji karty');

      alert(data.message || 'Karta postaci została zaakceptowana!');
      fetchPendingCards();
    } catch (error) {
      console.error('Błąd akceptacji karty:', error);
      alert(error.message || 'Nie udało się zaakceptować karty');
    } finally {
      setActionLoading(false);
    }
  };

const handleRejectConfirm = async () => {
  if (!rejectReason.trim()) {
    alert('Podaj powód odrzucenia karty');
    return;
  }

  try {
    setActionLoading(true);
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/admin/character-cards/${selectedCard.id}/reject`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        rejection_reason: rejectReason.trim()  // Tylko rejection_reason, bez approved
      })
    });

    if (!response.ok) throw new Error('Błąd odrzucenia karty');

    alert('Karta postaci została odrzucona');
    setRejectDialogOpen(false);
    setRejectReason('');
    setSelectedCard(null);
    fetchPendingCards();
  } catch (error) {
    console.error('Błąd odrzucenia karty:', error);
    alert('Nie udało się odrzucić karty');
  } finally {
    setActionLoading(false);
  }
};

  const openRejectDialog = (card) => {
    setSelectedCard(card);
    setRejectDialogOpen(true);
  };

  const openViewCardDialog = (card) => {
    setSelectedCard(card);
    setViewCardDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} size={60} />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{
          
          color: theme.palette.text.secondary,
          fontWeight: 'bold'
        }}>
          🃏 Karty Postaci do Akceptacji
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/home/settings')}
          sx={{
            color: theme.palette.text.secondary,
            borderColor: 'rgba(75, 85, 99, 0.6)',
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: 'rgba(156, 163, 175, 0.1)'
            }
          }}
        >
          ← Powrót
        </Button>
      </Box>

      {pendingCards.length === 0 ? (
        <Box sx={{
          textAlign: 'center',
          py: 8,
          backgroundColor: 'rgba(26, 26, 26, 0.6)',
          borderRadius: '12px',
          border: `2px solid rgba(75, 85, 99, 0.6)`
        }}>
          <Typography sx={{ 
            color: theme.palette.text.primary, 
            fontSize: '1.2rem',
            mb: 1
          }}>
            ✅ Brak kart oczekujących na akceptację
          </Typography>
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.9rem' }}>
            Wszystkie karty postaci zostały rozpatrzone
          </Typography>
        </Box>
      ) : (
<Stack spacing={2}>
  {pendingCards.map((card) => {
    const isAwaitingFix = Boolean(card.isRejected);
    const isResubmitted = Boolean(card.isResubmitted);
    const borderColor = isAwaitingFix
      ? theme.palette.error.main
      : isResubmitted
        ? theme.palette.warning.main
        : 'rgba(75, 85, 99, 0.6)';

    return (
    <Card
      key={card.id}
      sx={{
        backgroundColor: 'rgba(26, 26, 26, 0.6)',
        border: `2px solid ${borderColor}`,
        borderRadius: '12px',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(26, 26, 26, 0.8)',
          borderColor: isAwaitingFix || isResubmitted ? borderColor : theme.palette.text.secondary,
          boxShadow: '0 4px 12px rgba(156, 163, 175, 0.4)'
        }
      }}
    >
      <CardContent>
        {/* GÓRNA SEKCJA - AVATAR I DANE */}
        <Box sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          mb: 2
        }}>
          {/* AVATAR */}
          <Avatar
            src={card.character_avatar ? `/api${card.character_avatar}` : undefined}
            sx={{
              width: 56,
              height: 56,
              border: '2px solid rgba(75, 85, 99, 0.6)'
            }}
          >
            <PersonIcon sx={{ fontSize: '1.8rem' }} />
          </Avatar>

          {/* DANE */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.secondary,
                  fontWeight: 'bold',
                  
                  fontSize: '1.1rem'
                }}
              >
                {card.character_name}
              </Typography>
              {isAwaitingFix && (
                <Chip label="ODRZUCONA" color="error" size="small" sx={{ fontWeight: 'bold' }} />
              )}
              {isResubmitted && (
                <Chip label="POPRAWIONA" color="warning" size="small" sx={{ fontWeight: 'bold' }} />
              )}
            </Box>

            <Typography sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.85rem'
            }}>
              Gracz: {card.owner_name}
            </Typography>

            <Typography sx={{ 
              color: theme.palette.text.primary, 
              fontSize: '0.8rem',
              mt: 0.5
            }}>
              <strong>Imię:</strong> {card.first_name} {card.last_name || ''}
              {card.age && (
                <>
                  {' '} <AgeIcon sx={{ fontSize: '0.9rem', verticalAlign: 'middle', mx: 0.5 }} />
                  {card.age} lat
                </>
              )}
              {card.height && (
                <>
                  {' '} <HeightIcon sx={{ fontSize: '0.9rem', verticalAlign: 'middle', mx: 0.5 }} />
                  {card.height} cm
                </>
              )}
            </Typography>

            <Typography sx={{ 
              color: theme.palette.text.secondary, 
              fontSize: '0.7rem',
              mt: 0.5
            }}>
              Zgłoszono: {new Date(card.updated_at).toLocaleString('pl-PL')}
            </Typography>
          </Box>
        </Box>

        {/* WADY / ZALETY GRACZA (pokazujemy komplet: oczekujące, odrzucone i już
            zatwierdzone — dzięki temu karty sprzed zmian widać razem z wadami/zaletami) */}
        {((card.cardAchievements && card.cardAchievements.length > 0) ||
          (card.cardProblems && card.cardProblems.length > 0)) && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.palette.warning.main, mb: 1 }}>
              Wady / zalety postaci
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                ...(card.cardAchievements || []).map(e => ({ ...e, _type: 'achievements', _kind: 'Zaleta' })),
                ...(card.cardProblems || []).map(e => ({ ...e, _type: 'problems', _kind: 'Wada' })),
              ].map((entry) => {
                const isRejectedEntry = Boolean(entry.was_rejected);
                const isApprovedEntry = Boolean(entry.is_approved);
                return (
                <Box key={`${entry._type}-${entry.id}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 1, border: `1px solid ${theme.palette.divider}`, borderLeft: `3px solid ${entry._type === 'problems' ? theme.palette.error.main : theme.palette.primary.main}` }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: entry._type === 'problems' ? theme.palette.error.main : theme.palette.primary.main }}>
                        {entry._kind}: {entry.title}{entry.level ? ` (${entry.level}/5)` : ''}
                      </Typography>
                      {isRejectedEntry ? (
                        <Chip label="ODRZUCONA — czeka na poprawkę" color="error" size="small" sx={{ fontWeight: 'bold', height: 18, fontSize: '0.65rem' }} />
                      ) : isApprovedEntry ? (
                        <Chip label="ZATWIERDZONA" color="success" size="small" sx={{ fontWeight: 'bold', height: 18, fontSize: '0.65rem' }} />
                      ) : (
                        <Chip label="OCZEKUJE" color="warning" size="small" sx={{ fontWeight: 'bold', height: 18, fontSize: '0.65rem' }} />
                      )}
                      {isEntryExpired(entry) && (
                        <Chip label="WYGASŁA" size="small" sx={{ fontWeight: 'bold', height: 18, fontSize: '0.65rem', backgroundColor: theme.palette.divider, color: theme.palette.text.primary }} />
                      )}
                    </Box>
                    {entry.description && (
                      <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, fontStyle: 'italic' }}>{entry.description}</Typography>
                    )}
                    <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary, mt: 0.25 }}>
                      {entryPeriodLabel(entry)}
                    </Typography>
                    {isRejectedEntry && entry.rejection_reason && (
                      <Typography sx={{ fontSize: '0.72rem', color: theme.palette.error.text, mt: 0.25 }}>
                        Powód odrzucenia: {entry.rejection_reason}
                      </Typography>
                    )}
                  </Box>
                  {/* Odrzucona pozycja czeka na poprawkę gracza — bez akcji.
                      Oczekująca: Zatwierdź + Odrzuć. Zatwierdzona: tylko Odrzuć (można cofnąć z komentarzem). */}
                  {!isRejectedEntry && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                      {!isApprovedEntry && (
                        <Button size="small" variant="outlined" disabled={actionLoading} onClick={() => handleEntryApprove(card.character_id, entry._type, entry.id)} sx={{ minWidth: 0, borderRadius: 0, color: theme.palette.success.text, borderColor: theme.palette.success.main }}>Zatwierdź</Button>
                      )}
                      <Button size="small" variant="outlined" disabled={actionLoading} onClick={() => openEntryRejectDialog(card.character_id, entry._type, entry)} sx={{ minWidth: 0, borderRadius: 0, color: theme.palette.error.text, borderColor: theme.palette.error.main }}>Odrzuć</Button>
                    </Box>
                  )}
                </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* DOLNA SEKCJA - PRZYCISKI */}
        <Box sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'center',
          mt: 2
        }}>
          <Button
            variant="outlined"
            startIcon={<ViewIcon />}
            onClick={() => openViewCardDialog(card)}
            sx={{
              borderColor: 'rgba(75, 85, 99, 0.6)',
              color: theme.palette.text.secondary,
              fontWeight: 'bold',
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: 'rgba(156, 163, 175, 0.1)'
              }
            }}
          >
            Zobacz
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/home/profile/${card.character_id}`)}
            sx={{
              borderColor: 'rgba(75, 85, 99, 0.6)',
              color: theme.palette.text.secondary,
              fontWeight: 'bold',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                backgroundColor: 'rgba(156, 163, 175, 0.1)'
              }
            }}
          >
            Edytuj KP
          </Button>
          {!isAwaitingFix && (
            <>
              <Button
                variant="outlined"
                startIcon={<ApproveIcon />}
                onClick={() => handleApprove(card.id, card.character_id)}
                disabled={actionLoading}
                sx={{
                  borderColor: 'rgba(75, 85, 99, 0.6)',
                  color: theme.palette.text.secondary,
                  fontWeight: 'bold',
                  '&:hover': {
                    borderColor: theme.palette.text.secondary,
                    backgroundColor: 'rgba(156, 163, 175, 0.1)'
                  }
                }}
              >
                Akceptuj
              </Button>
              <Button
                variant="contained"
                startIcon={<RejectIcon />}
                onClick={() => openRejectDialog(card)}
                disabled={actionLoading}
                sx={{
                  backgroundColor: theme.palette.error.main,
                  color: theme.palette.text.primary,
                  fontWeight: 'bold',
                  '&:hover': {
                    backgroundColor: `${theme.palette.error.main}90`
                  }
                }}
              >
                Odrzuć
              </Button>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
    );
  })}
</Stack>
      )}

      {/* DIALOG ODRZUCENIA */}
      <Dialog 
        open={rejectDialogOpen} 
        onClose={() => !actionLoading && setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.default,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: '12px'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: theme.palette.primary.mainLight,
          
          fontWeight: 'bold'
        }}>
          ❌ Odrzuć kartę postaci
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: theme.palette.text.primary, mb: 2 }}>
            Podaj powód odrzucenia karty dla gracza <strong>{selectedCard?.owner_name}</strong>:
          </Typography>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            label="Powód odrzucenia"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Np. Opis postaci nie pasuje do świata gry, brak kluczowych informacji..."
            disabled={actionLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.text.primary,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.error.text,
                '&.Mui-focused': { color: theme.palette.primary.main }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setRejectDialogOpen(false)}
            disabled={actionLoading}
            sx={{ color: theme.palette.text.secondary }}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleRejectConfirm}
            disabled={actionLoading || !rejectReason.trim()}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.error.main,
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: `${theme.palette.error.main}90`
              }
            }}
          >
            {actionLoading ? 'Odrzucanie...' : 'Odrzuć kartę'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG ODRZUCENIA POJEDYNCZEJ WADY/ZALETY */}
      <Dialog
        open={entryRejectDialogOpen}
        onClose={() => !actionLoading && setEntryRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.default,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: '12px'
          }
        }}
      >
        <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold' }}>
          ❌ Odrzuć: {entryRejectTarget?.kind} „{entryRejectTarget?.title}”
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: theme.palette.text.primary, mb: 2 }}>
            Napisz graczowi, co ma poprawić. Wpis nie zniknie — gracz zobaczy ten komentarz
            i będzie mógł go poprawić oraz wysłać ponownie do akceptacji.
          </Typography>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            label="Powód odrzucenia / co poprawić"
            value={entryRejectReason}
            onChange={(e) => setEntryRejectReason(e.target.value)}
            placeholder="Np. Poziom zbyt wysoki jak na start, opisz konkretniej efekt wady..."
            disabled={actionLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.text.primary,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.error.text,
                '&.Mui-focused': { color: theme.palette.primary.main }
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEntryRejectDialogOpen(false)} disabled={actionLoading} sx={{ color: theme.palette.text.secondary }}>
            Anuluj
          </Button>
          <Button
            onClick={handleEntryRejectConfirm}
            disabled={actionLoading || !entryRejectReason.trim()}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.error.main,
              color: theme.palette.text.primary,
              '&:hover': { backgroundColor: `${theme.palette.error.main}90` }
            }}
          >
            {actionLoading ? 'Odrzucanie...' : 'Odrzuć pozycję'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG PODGLĄDU CAŁEJ KARTY */}
      <Dialog
        open={viewCardDialogOpen}
        onClose={() => setViewCardDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.default,
            border: `2px solid ${theme.palette.primary.main}`,
            borderRadius: '12px'
          }
        }}
      >
        <DialogTitle sx={{
          color: theme.palette.primary.mainLight,
          
          fontWeight: 'bold',
          borderBottom: `1px solid ${theme.palette.divider}`,
          pb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={selectedCard?.character_avatar ? `/api${selectedCard.character_avatar}` : undefined}
              sx={{
                width: 64,
                height: 64,
                border: `2px solid ${theme.palette.primary.main}`
              }}
            >
              <PersonIcon sx={{ fontSize: '2rem' }} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.primary.mainLight }}>
                {selectedCard?.character_name}
              </Typography>
              <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.9rem' }}>
                Gracz: {selectedCard?.owner_name}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {selectedCard && (
            <Stack spacing={3}>
              {/* STATUS ODRZUCENIA */}
              {Boolean(selectedCard.isRejected) && selectedCard.rejection_reason && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: `${theme.palette.error.main}20`,
                    border: `2px solid ${theme.palette.error.main}`,
                    borderRadius: '8px'
                  }}
                >
                  <Typography sx={{ color: theme.palette.error.text, fontWeight: 'bold', mb: 1 }}>
                    ⚠️ KARTA ODRZUCONA - OCZEKUJE NA POPRAWKĘ
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.9rem' }}>
                    {selectedCard.rejection_reason}
                  </Typography>
                </Box>
              )}

              {/* STATUS POPRAWY */}
              {Boolean(selectedCard.isResubmitted) && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: `${theme.palette.warning.main}20`,
                    border: `2px solid ${theme.palette.warning.main}`,
                    borderRadius: '8px'
                  }}
                >
                  <Typography sx={{ color: theme.palette.warning.main, fontWeight: 'bold' }}>
                    🔄 KARTA POPRAWIONA - OCZEKUJE NA PONOWNĄ WERYFIKACJĘ
                  </Typography>
                </Box>
              )}

              {/* DANE PODSTAWOWE */}
              <Box
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.mode === 'dark'
                    ? 'rgba(0, 0, 0, 0.4)'
                    : theme.palette.background.paper,
                  border: `2px solid ${theme.palette.primary.main}40`,
                  borderRadius: '8px'
                }}
              >
                <Typography
                  sx={{
                    color: theme.palette.primary.mainLight,
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    mb: 2
                  }}
                >
                  📋 DANE PODSTAWOWE
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem' }}>
                      Imię:
                    </Typography>
                    <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                      {selectedCard.first_name}
                    </Typography>
                  </Grid>
                  {selectedCard.last_name && (
                    <Grid item xs={6}>
                      <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem' }}>
                        Nazwisko:
                      </Typography>
                      <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                        {selectedCard.last_name}
                      </Typography>
                    </Grid>
                  )}
                  {selectedCard.age && (
                    <Grid item xs={6}>
                      <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem' }}>
                        <AgeIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />
                        Wiek:
                      </Typography>
                      <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                        {selectedCard.age} lat
                      </Typography>
                    </Grid>
                  )}
                  {selectedCard.height && (
                    <Grid item xs={6}>
                      <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem' }}>
                        <HeightIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />
                        Wzrost:
                      </Typography>
                      <Typography sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                        {selectedCard.height} cm
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* OPIS CHARAKTERU */}
              {selectedCard.character_description && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, 0.4)'
                      : theme.palette.background.paper,
                    border: `2px solid ${theme.palette.primary.main}40`,
                    borderRadius: '8px'
                  }}
                >
                  <Typography
                    sx={{
                      color: theme.palette.primary.mainLight,
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      mb: 1
                    }}
                  >
                    🎭 CHARAKTER
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.text.primary,
                      fontSize: '0.95rem',
                      fontStyle: 'italic',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {selectedCard.character_description}
                  </Typography>
                </Box>
              )}

              {/* OPIS WYGLĄDU */}
              {selectedCard.visual_description && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, 0.4)'
                      : theme.palette.background.paper,
                    border: `2px solid ${theme.palette.primary.main}40`,
                    borderRadius: '8px'
                  }}
                >
                  <Typography
                    sx={{
                      color: theme.palette.primary.mainLight,
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      mb: 1
                    }}
                  >
                    👤 WYGLĄD
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.text.primary,
                      fontSize: '0.95rem',
                      fontStyle: 'italic',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {selectedCard.visual_description}
                  </Typography>
                </Box>
              )}

              {/* DODATKOWE INFORMACJE */}
              {selectedCard.additional_info && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, 0.4)'
                      : theme.palette.background.paper,
                    border: `2px solid ${theme.palette.primary.main}40`,
                    borderRadius: '8px'
                  }}
                >
                  <Typography
                    sx={{
                      color: theme.palette.primary.mainLight,
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      mb: 1
                    }}
                  >
                    ℹ️ DODATKOWE INFORMACJE
                  </Typography>
                  <Typography
                    sx={{
                      color: theme.palette.text.primary,
                      fontSize: '0.95rem',
                      fontStyle: 'italic',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {selectedCard.additional_info}
                  </Typography>
                </Box>
              )}

              {/* DATA ZGŁOSZENIA */}
              <Box sx={{ textAlign: 'center', pt: 1 }}>
                <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem' }}>
                  Zgłoszono: {new Date(selectedCard.updated_at).toLocaleString('pl-PL')}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setViewCardDialogOpen(false)}
            sx={{ color: theme.palette.text.secondary }}
          >
            Zamknij
          </Button>
          {!selectedCard?.isRejected && (
            <>
              <Button
                onClick={() => {
                  setViewCardDialogOpen(false);
                  handleApprove(selectedCard?.id, selectedCard?.character_id);
                }}
                variant="outlined"
                startIcon={<ApproveIcon />}
                disabled={actionLoading}
                sx={{
                  borderColor: 'rgba(75, 85, 99, 0.6)',
                  color: theme.palette.text.secondary,
                  fontWeight: 'bold',
                  backgroundColor: 'transparent',
                  '&:hover': {
                    borderColor: theme.palette.text.secondary,
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    boxShadow: '0 4px 12px rgba(156, 163, 175, 0.4)'
                  }
                }}
              >
                Akceptuj
              </Button>
              <Button
                onClick={() => {
                  setViewCardDialogOpen(false);
                  openRejectDialog(selectedCard);
                }}
                variant="contained"
                startIcon={<RejectIcon />}
                disabled={actionLoading}
                sx={{
                  backgroundColor: theme.palette.error.main,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: `${theme.palette.error.main}90`
                  }
                }}
              >
                Odrzuć
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default CharacterCardsApproval;