import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Grid, Accordion, AccordionSummary,
  AccordionDetails, Switch, FormControlLabel, CircularProgress, Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const API = '/api';

function RaceAdminPanel({ onBack }) {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [raceIntro, setRaceIntro] = useState('');
  const [savingIntro, setSavingIntro] = useState(false);
  const token = localStorage.getItem('token');

  const loadRaces = () => {
    setLoading(true);
    fetch(`${API}/races?includeInactive=1`)
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(() => setMessage({ type: 'error', text: 'Nie udało się pobrać ras' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadRaces(); }, []);

  // Tekst wprowadzający o rasach (kreator postaci)
  useEffect(() => {
    fetch(`${API}/game-info`)
      .then(res => res.json())
      .then(data => setRaceIntro(data?.creatorRaceIntro || ''))
      .catch(() => {});
  }, []);

  const saveRaceIntro = async () => {
    setSavingIntro(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/game-info/creator-race-intro`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: raceIntro }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd zapisu tekstu');
      }
      setMessage({ type: 'success', text: 'Zapisano tekst o rasach' });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSavingIntro(false);
    }
  };

  const updateField = (id, field, value) => {
    setRaces(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const saveRace = async (race) => {
    setSavingId(race.id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/races/${race.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(race)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd zapisu');
      }
      setMessage({ type: 'success', text: `Zapisano rasę: ${race.name}` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSavingId(null);
    }
  };

  const addRace = async () => {
    const key = window.prompt('Techniczny klucz nowej rasy (np. RASA_4). Bez spacji:');
    if (!key) return;
    const name = window.prompt('Nazwa wyświetlana nowej rasy:');
    if (!name) return;
    try {
      const res = await fetch(`${API}/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: key.trim(), name: name.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd dodawania');
      }
      setMessage({ type: 'success', text: `Dodano rasę: ${name}` });
      loadRaces();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  if (loading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined">Powrót</Button>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Zarządzanie Rasami</Typography>
      </Box>

      {message && <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Tekst o rasach (kreator postaci)</Typography>
        <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.75 }}>
          Wyświetla się na górze kroku wyboru rasy w pierwszym kreatorze postaci. Zostaw puste, aby ukryć.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          value={raceIntro}
          onChange={(e) => setRaceIntro(e.target.value)}
          placeholder="np. W świecie Gaaran żyją trzy rody: wampiry, wilkołaki i ludzie..."
          sx={{ mb: 1.5 }}
        />
        <Button
          startIcon={savingIntro ? <CircularProgress size={18} /> : <SaveIcon />}
          variant="contained"
          onClick={saveRaceIntro}
          disabled={savingIntro}
        >
          Zapisz tekst
        </Button>
      </Paper>

      <Button startIcon={<AddIcon />} variant="contained" onClick={addRace} sx={{ mb: 2 }}>
        Dodaj rasę
      </Button>

      {races.map(race => (
        <Accordion key={race.id} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: race.color || '#888', border: '1px solid #0006' }} />
              <Typography sx={{ fontWeight: 'bold' }}>{race.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>({race.key})</Typography>
              {!race.is_active && <Typography variant="caption" sx={{ color: 'error.main' }}>— nieaktywna</Typography>}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label="Nazwa" value={race.name || ''}
                  onChange={e => updateField(race.id, 'name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="color" label="Kolor" InputLabelProps={{ shrink: true }}
                  value={race.color || '#888888'} onChange={e => updateField(race.id, 'color', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" label="Ikona (emoji/nazwa)" value={race.icon || ''}
                  onChange={e => updateField(race.id, 'icon', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" multiline minRows={2} label="Opis" value={race.description || ''}
                  onChange={e => updateField(race.id, 'description', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Cechy (po przecinku)" value={race.traits || ''}
                  onChange={e => updateField(race.id, 'traits', e.target.value)} />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField fullWidth size="small" type="number" label="Kolejność"
                  value={race.sort_order ?? 0}
                  onChange={e => updateField(race.id, 'sort_order', Number(e.target.value))} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={<Switch checked={race.is_active !== 0 && race.is_active !== false}
                    onChange={e => updateField(race.id, 'is_active', e.target.checked ? 1 : 0)} />}
                  label="Aktywna" />
              </Grid>

              <Grid item xs={12}>
                <Button variant="contained" startIcon={savingId === race.id ? <CircularProgress size={18} /> : <SaveIcon />}
                  disabled={savingId === race.id} onClick={() => saveRace(race)}>
                  Zapisz rasę
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default RaceAdminPanel;
