// frontend/src/views/Reports.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem,
  FormControl, InputLabel, Alert, Chip, Card, CardContent,
  Divider
} from '@mui/material';

const API_URL = '/api';

function Reports() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState(null);
// Funkcja do rozpoczęcia edycji
const handleEditReport = (report) => {
  setEditingReport(report);
  setFormData({
    session_id: report.session_id,
    session_type: report.session_type,
    description: report.description,
    world_consequences: report.world_consequences || '',
    character_consequences: report.character_consequences || '',
    advantages_disadvantages: report.advantages_disadvantages || ''
  });
  setShowCreateForm(true);
};
  const [formData, setFormData] = useState({
    session_id: '',
    session_type: '',
    description: '',
    world_consequences: '',
    character_consequences: '',
    advantages_disadvantages: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    fetchSessions();
    fetchMyReports();
  }, [navigate]);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/reports/my-sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Błąd pobierania sesji');
      
      const data = await response.json();
      setSessions(data.sessions);
    } catch (error) {
      console.error('Błąd pobierania sesji:', error);
    }
  };

  const fetchMyReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/reports/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Błąd pobierania zgłoszeń');
      
      const data = await response.json();
      setMyReports(data.reports);
    } catch (error) {
      console.error('Błąd pobierania zgłoszeń:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (sessionId) => {
    const selectedSession = sessions.find(s => 
      `${s.session_type}-${s.id}` === sessionId
    );
    
    if (selectedSession) {
      setFormData({
        ...formData,
        session_id: selectedSession.id,
        session_type: selectedSession.session_type
      });
    }
  };

const handleSubmit = async (e) => {
  if (e) e.preventDefault();
  
  if (!formData.session_id || !formData.description.trim()) {
    alert('Wybierz sesję i opisz co się wydarzyło!');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const isEditing = editingReport !== null;
    
    const response = await fetch(
      `${API_URL}/reports${isEditing ? `/${editingReport.id}` : ''}`,
      {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      }
    );
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Błąd wysyłania zgłoszenia');
    }
    
    alert(isEditing ? 'Zgłoszenie zaktualizowane i wysłane ponownie!' : 'Zgłoszenie zostało wysłane pomyślnie!');
    handleCloseForm();
    fetchMyReports();
  } catch (error) {
    console.error('Błąd wysyłania zgłoszenia:', error);
    alert(error.message || 'Błąd podczas wysyłania zgłoszenia');
  }
};

// Zaktualizuj handleCloseForm
const handleCloseForm = () => {
  setShowCreateForm(false);
  setEditingReport(null); // Dodaj to
  setFormData({
    session_id: '',
    session_type: '',
    description: '',
    world_consequences: '',
    character_consequences: '',
    advantages_disadvantages: ''
  });
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

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography sx={{ color: 'text.primary' }}>Ładowanie zgłoszeń...</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        📋 Zgłoszenia Sesji
      </Typography>

      <Box display="flex" flexDirection="column" gap={3}>
        <Button
          variant="outlined"
          onClick={() => navigate('/home/settings')}
          sx={{ alignSelf: 'flex-start' }}
        >
          ← Powrót do ustawień
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={() => setShowCreateForm(true)}
          sx={{ mb: 2 }}
        >
          ➕ Nowe Zgłoszenie
        </Button>

        {myReports.length === 0 ? (
          <Alert severity="info">
            Nie masz jeszcze żadnych zgłoszeń. Kliknij "Nowe Zgłoszenie" aby dodać pierwsze!
          </Alert>
        ) : (
          <Box display="flex" flexDirection="column" gap={2}>
            {myReports.map((report) => (
              <Card key={report.id}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Typography variant="h6">
                      {report.session_name}
                    </Typography>
                    <Chip 
                      label={getStatusText(report.status)}
                      color={getStatusColor(report.status)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    {report.session_type === 'general' ? '🌍 Sesja Ogólna' : '🔒 Sesja Prywatna'} • 
                    Zgłoszono: {new Date(report.created_at).toLocaleDateString('pl-PL')}
                  </Typography>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    <strong>Opis:</strong> {report.description}
                  </Typography>
                  
                  {report.world_consequences && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Konsekwencje dla świata:</strong> {report.world_consequences}
                    </Typography>
                  )}
                  
                  {report.character_consequences && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Konsekwencje dla postaci:</strong> {report.character_consequences}
                    </Typography>
                  )}
                  
                  {report.advantages_disadvantages && (
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Zgłoszone wady/zalety:</strong> {report.advantages_disadvantages}
                    </Typography>
                  )}
                  
{report.admin_comment && (
  <Box sx={{ 
    mt: 2, 
    p: 2, 
    backgroundColor: 'rgba(220, 38, 38, 0.1)', 
    borderRadius: 1, 
    border: '1px solid rgba(220, 38, 38, 0.3)' 
  }}>
    <Typography variant="body2" sx={{ color: 'error.main' }}>
      <strong>💬 Komentarz administratora:</strong> {report.admin_comment}
    </Typography>
    {report.reviewed_at && (
      <Typography variant="caption" sx={{ color: 'error.dark', display: 'block', mt: 0.5 }}>
        Sprawdzono: {new Date(report.reviewed_at).toLocaleDateString('pl-PL')}
      </Typography>
    )}
  </Box>
)}

{/* DODAJ TUTAJ 👇 */}
{report.status === 'rejected' && (
  <Button
    variant="outlined"
    size="small"
    onClick={() => handleEditReport(report)}
    sx={{ mt: 2 }}
  >
    ✏️ Edytuj i wyślij ponownie
  </Button>
)}

</CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {/* Dialog tworzenia zgłoszenia */}
      <Dialog 
        open={showCreateForm} 
        onClose={handleCloseForm}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
  {editingReport ? '✏️ Edytuj Zgłoszenie' : '📋 Nowe Zgłoszenie Sesji'}
</DialogTitle>
<DialogContent>
  <Box display="flex" flexDirection="column" gap={2} mt={1}>
    
    {/* Jeśli edytujemy - pokaż tylko nazwę sesji */}
    {editingReport ? (
      <Alert severity="info" sx={{ mb: 1 }}>
        <Typography variant="body2">
          <strong>Sesja:</strong> {editingReport.session_name}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          {editingReport.session_type === 'general' ? '🌍 Sesja Ogólna' : '🔒 Sesja Prywatna'}
        </Typography>
      </Alert>
    ) : (
      // Jeśli tworzymy nowe - pozwól wybrać
      <FormControl fullWidth>
        <InputLabel>Wybierz sesję *</InputLabel>
        <Select
          value={formData.session_id ? `${formData.session_type}-${formData.session_id}` : ''}
          onChange={(e) => handleSessionSelect(e.target.value)}
          required
        >
          {sessions.map((session) => (
            <MenuItem key={`${session.session_type}-${session.id}`} value={`${session.session_type}-${session.id}`}>
              <Box>
                <Typography variant="body1">
                  {session.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {session.session_type === 'general' ? '🌍 Sesja Ogólna' : '🔒 Sesja Prywatna'}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    )}

    <Divider />

    <TextField
      fullWidth
      multiline
      rows={4}
      label="Co się wydarzyło? *"
      value={formData.description}
      onChange={(e) => setFormData({...formData, description: e.target.value})}
      required
    />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Konsekwencje dla świata (opcjonalne)"
              value={formData.world_consequences}
              onChange={(e) => setFormData({...formData, world_consequences: e.target.value})}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Konsekwencje dla postaci (opcjonalne)"
              value={formData.character_consequences}
              onChange={(e) => setFormData({...formData, character_consequences: e.target.value})}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Zgłoszone wady/zalety (opcjonalne)"
              value={formData.advantages_disadvantages}
              onChange={(e) => setFormData({...formData, advantages_disadvantages: e.target.value})}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Anuluj</Button>
          <Button onClick={handleSubmit} variant="contained">Wyślij Zgłoszenie</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default Reports;