// frontend/src/views/AdminReports.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Chip,
  Card, CardContent, Divider, Accordion, AccordionSummary,
  AccordionDetails, Stack, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';
import { useAuth } from './AuthContext';

const API_URL = '/api';

function AdminReports() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [allReportsGrouped, setAllReportsGrouped] = useState([]);
  const [selectedAdminReport, setSelectedAdminReport] = useState(null);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminComment, setAdminComment] = useState('');
  const [editPositive, setEditPositive] = useState('');
  const [editNegative, setEditNegative] = useState('');
  const [editPositiveLevel, setEditPositiveLevel] = useState('');
  const [editNegativeLevel, setEditNegativeLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState([]);

  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';

  useEffect(() => {
    if (authLoading) return;

    if (!user || !user.id) {
      navigate('/login');
      return;
    }

    if (user.role !== 'admin' && user.role !== 'mistrz_gry') {
      navigate('/home/settings');
      return;
    }

    fetchAllReports();
  }, [user, authLoading, navigate]);

  const fetchAllReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/reports/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Błąd pobierania zgłoszeń');

      const data = await response.json();
      setAllReportsGrouped(data.characters);
    } catch (error) {
      console.error('Błąd pobierania zgłoszeń dla admina:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdminDialog = (report) => {
    setSelectedAdminReport(report);
    setAdminComment(report.admin_comment || '');
    setEditPositive(report.positive_consequences || '');
    setEditNegative(report.negative_consequences || '');
    setEditPositiveLevel(report.positive_level || '');
    setEditNegativeLevel(report.negative_level || '');
    setShowAdminDialog(true);
  };

  const handleAcceptReport = async () => {
    if (!selectedAdminReport) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/reports/admin/${selectedAdminReport.id}/accept`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          positive_consequences: editPositive,
          negative_consequences: editNegative,
          positive_level: editPositiveLevel,
          negative_level: editNegativeLevel
        })
      });

      if (!response.ok) throw new Error('Błąd akceptacji');

      alert('Zgłoszenie zostało zaakceptowane! Zalety i wady zostały dodane do karty postaci gracza.');
      setShowAdminDialog(false);
      fetchAllReports();
    } catch (error) {
      console.error('Błąd akceptacji:', error);
      alert('Nie udało się zaakceptować zgłoszenia');
    }
  };

  const handleRejectReport = async () => {
    if (!selectedAdminReport) return;

    if (!adminComment.trim()) {
      alert('Musisz podać komentarz przy odrzuceniu!');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/reports/admin/${selectedAdminReport.id}/reject`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ admin_comment: adminComment })
      });

      if (!response.ok) throw new Error('Błąd odrzucenia');

      alert('Zgłoszenie zostało odrzucone!');
      setShowAdminDialog(false);
      fetchAllReports();
    } catch (error) {
      console.error('Błąd odrzucenia:', error);
      alert('Nie udało się odrzucić zgłoszenia');
    }
  };

  const handleUpdateComment = async () => {
    if (!selectedAdminReport) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/reports/admin/${selectedAdminReport.id}/comment`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ admin_comment: adminComment })
      });

      if (!response.ok) throw new Error('Błąd aktualizacji komentarza');

      alert('Komentarz został zaktualizowany!');
      setShowAdminDialog(false);
      fetchAllReports();
    } catch (error) {
      console.error('Błąd aktualizacji komentarza:', error);
      alert('Nie udało się zaktualizować komentarza');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '⏳ Oczekuje';
      case 'accepted': return '✅ Zaakceptowane';
      case 'rejected': return '❌ Odrzucone';
      default: return status;
    }
  };

  // Sortuje raporty: pending najpierw, accepted na dół; odrzucone ukryte
  const sortAndFilterReports = (reports) => {
    const visible = reports.filter(r => r.status !== 'rejected');
    return visible.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  };

  const getCardSx = (status) => {
    if (status === 'pending') {
      return {
        backgroundColor: 'rgba(255, 167, 38, 0.08)',
        border: `2px solid ${theme.palette.warning.main}`,
        borderRadius: 1
      };
    }
    if (status === 'accepted') {
      return {
        backgroundColor: 'rgba(76, 175, 80, 0.08)',
        border: `1px solid ${theme.palette.success.main}`,
        borderRadius: 1
      };
    }
    return { backgroundColor: 'rgba(0,0,0,0.02)' };
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography sx={{ color: 'text.primary' }}>Ładowanie zgłoszeń...</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2, color: 'secondary.main' }}>
        👑 Podsumowania Graczy
      </Typography>

      <Box display="flex" flexDirection="column" gap={3}>
        <Button
          variant="outlined"
          onClick={() => navigate('/home/settings')}
          sx={{ alignSelf: 'flex-start' }}
        >
          ← Powrót do ustawień
        </Button>

        {allReportsGrouped.length === 0 ? (
          <Alert severity="info">
            Brak zgłoszeń od graczy.
          </Alert>
        ) : (
          <Box display="flex" flexDirection="column" gap={1}>
            {allReportsGrouped.map((characterGroup) => {
              const visibleReports = sortAndFilterReports(characterGroup.reports);
              const pendingCount = characterGroup.reports.filter(r => r.status === 'pending').length;

              return (
                <Accordion
                  key={characterGroup.character_id}
                  sx={pendingCount > 0 ? {
                    border: `2px solid ${theme.palette.warning.main}`,
                    '&:before': { display: 'none' }
                  } : {}}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" justifyContent="space-between" width="100%" alignItems="center" pr={2}>
                      <Box>
                        <Typography variant="h6">
                          {characterGroup.character_name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Gracz: {characterGroup.player_username} • Rasa: {getRaceName(characterGroup.faction)}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1} alignItems="center">
                        {pendingCount > 0 && (
                          <Chip
                            label={`${pendingCount} oczekuje`}
                            size="small"
                            color="warning"
                          />
                        )}
                        <Chip
                          label={`${visibleReports.length} zgłoszeń`}
                          size="small"
                          color="primary"
                        />
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box display="flex" flexDirection="column" gap={2}>
                      {visibleReports.map((report) => (
                        <Card key={report.id} sx={getCardSx(report.status)}>
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                              <Typography variant="subtitle1">
                                {report.session_name}
                              </Typography>
                              <Chip
                                label={getStatusText(report.status)}
                                color={getStatusColor(report.status)}
                                size="small"
                              />
                            </Box>

                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                              {report.session_type === 'general' ? '🌍 Sesja Ogólna' : '🔒 Sesja Prywatna'} •{' '}
                              {new Date(report.created_at).toLocaleDateString('pl-PL')}
                            </Typography>

                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Opis:</strong> {report.description.substring(0, 150)}
                              {report.description.length > 150 && '...'}
                            </Typography>

                            {report.positive_consequences && (
                              <Typography variant="body2" sx={{ mb: 0.5, color: theme.palette.success.text }}>
                                <strong>✅ Zaleta{report.positive_level ? ` (poziom ${report.positive_level}/5)` : ''}:</strong> {report.positive_consequences.substring(0, 80)}
                                {report.positive_consequences.length > 80 && '...'}
                              </Typography>
                            )}

                            {report.negative_consequences && (
                              <Typography variant="body2" sx={{ mb: 1, color: theme.palette.error.text }}>
                                <strong>❌ Wada{report.negative_level ? ` (poziom ${report.negative_level}/5)` : ''}:</strong> {report.negative_consequences.substring(0, 80)}
                                {report.negative_consequences.length > 80 && '...'}
                              </Typography>
                            )}

                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleOpenAdminDialog(report)}
                              sx={{ mt: 1 }}
                            >
                              🔍 Szczegóły i Akcje
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {visibleReports.length === 0 && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          Brak aktywnych zgłoszeń.
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Dialog szczegółów zgłoszenia */}
      <Dialog
        open={showAdminDialog}
        onClose={() => setShowAdminDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>🔍 Szczegóły Zgłoszenia</DialogTitle>
        <DialogContent>
          {selectedAdminReport && (
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Postać:</Typography>
                <Typography variant="body1">{selectedAdminReport.character_name}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary">Sesja:</Typography>
                <Typography variant="body1">
                  {selectedAdminReport.session_name}
                  ({selectedAdminReport.session_type === 'general' ? 'Ogólna' : 'Prywatna'})
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" color="text.secondary">Opis:</Typography>
                <Typography variant="body1">{selectedAdminReport.description}</Typography>
              </Box>

              {selectedAdminReport.world_consequences && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Konsekwencje dla świata:</Typography>
                  <Typography variant="body1">{selectedAdminReport.world_consequences}</Typography>
                </Box>
              )}

              {selectedAdminReport.character_consequences && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Konsekwencje dla postaci:</Typography>
                  <Typography variant="body1">{selectedAdminReport.character_consequences}</Typography>
                </Box>
              )}

              {selectedAdminReport.advantages_disadvantages && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Zgłoszone wady/zalety:</Typography>
                  <Typography variant="body1">{selectedAdminReport.advantages_disadvantages}</Typography>
                </Box>
              )}

              <Divider />

              {/* Edytowalne pola konsekwencji per-player */}
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Zalety i wady dla gracza (poziom 1-5, zostaną dodane do karty postaci przy akceptacji)
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="✅ Zaleta"
                value={editPositive}
                onChange={(e) => setEditPositive(e.target.value)}
                placeholder="Osiągnięcia, nagrody, pozytywne zmiany dla postaci..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.success.main },
                    '&:hover fieldset': { borderColor: theme.palette.success.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.success.main }
                  },
                  '& .MuiInputLabel-root': { color: theme.palette.success.text },
                  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.success.text }
                }}
              />

              <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
                <InputLabel>Poziom (1-5)</InputLabel>
                <Select label="Poziom (1-5)" value={editPositiveLevel} onChange={(e) => setEditPositiveLevel(e.target.value)}>
                  <MenuItem value="">Brak</MenuItem>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <MenuItem key={l} value={l}>{l}/5</MenuItem>
                  ))}
                </Select>
              </FormControl>


              <TextField
                fullWidth
                multiline
                rows={3}
                label="❌ Wada"
                value={editNegative}
                onChange={(e) => setEditNegative(e.target.value)}
                placeholder="Urazy, problemy, negatywne zmiany dla postaci..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: theme.palette.error.main },
                    '&:hover fieldset': { borderColor: theme.palette.error.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.error.main }
                  },
                  '& .MuiInputLabel-root': { color: theme.palette.error.text },
                  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.error.text }
                }}
              />

              <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
                <InputLabel>Poziom (1-5)</InputLabel>
                <Select label="Poziom (1-5)" value={editNegativeLevel} onChange={(e) => setEditNegativeLevel(e.target.value)}>
                  <MenuItem value="">Brak</MenuItem>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <MenuItem key={l} value={l}>{l}/5</MenuItem>
                  ))}
                </Select>
              </FormControl>


              <Divider />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Komentarz administratora"
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="Dodaj komentarz dla gracza..."
              />

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleAcceptReport}
                  disabled={selectedAdminReport.status === 'accepted'}
                  fullWidth
                >
                  ✅ Zaakceptuj
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleRejectReport}
                  disabled={selectedAdminReport.status === 'rejected'}
                  fullWidth
                >
                  ❌ Odrzuć
                </Button>
              </Stack>

              <Button
                variant="outlined"
                onClick={handleUpdateComment}
                fullWidth
              >
                💬 Zaktualizuj tylko komentarz
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAdminDialog(false)}>Zamknij</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default AdminReports;
