import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Grid, Accordion, AccordionSummary,
  AccordionDetails, Switch, FormControlLabel, Divider, CircularProgress, Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const API = '/api';
const STATS = ['strength', 'dexterity', 'speed', 'intelligence', 'willpower', 'endurance'];
const STAT_LABEL = {
  strength: 'Siła', dexterity: 'Zręczność', speed: 'Szybkość',
  intelligence: 'Inteligencja', willpower: 'Siła woli', endurance: 'Wytrzymałość'
};
const BONUSES = [
  ['bonus_attack_percent', 'Atak %'],
  ['bonus_defense_percent', 'Obrona %'],
  ['bonus_flee_percent', 'Ucieczka %'],
  ['bonus_catch_percent', 'Pościg %'],
  ['bonus_pvp_theft_percent', 'Kradzież PvP %'],
  ['bonus_craft_quality_percent', 'Jakość craftu %'],
  ['bonus_craft_stamina_reduction_percent', 'Redukcja staminy craftu %'],
  ['bonus_heal_cost_reduction_percent', 'Redukcja kosztu leczenia %'],
];

function ClassAdminPanel({ onBack }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState(null);
  const token = localStorage.getItem('token');

  const loadClasses = () => {
    setLoading(true);
    fetch(`${API}/classes?includeInactive=1`)
      .then(res => res.json())
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setMessage({ type: 'error', text: 'Nie udało się pobrać klas' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClasses(); }, []);

  const updateField = (id, field, value) => {
    setClasses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const saveClass = async (cls) => {
    setSavingId(cls.id);
    setMessage(null);
    try {
      const res = await fetch(`${API}/classes/${cls.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cls)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd zapisu');
      }
      setMessage({ type: 'success', text: `Zapisano klasę: ${cls.name}` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSavingId(null);
    }
  };

  const addClass = async () => {
    const key = window.prompt('Techniczny klucz nowej klasy (np. KLASA_5). Bez spacji:');
    if (!key) return;
    const name = window.prompt('Nazwa wyświetlana nowej klasy:');
    if (!name) return;
    try {
      const res = await fetch(`${API}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: key.trim(), name: name.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd dodawania');
      }
      setMessage({ type: 'success', text: `Dodano klasę: ${name}` });
      loadClasses();
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
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Zarządzanie Klasami</Typography>
      </Box>

      {message && <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}

      <Button startIcon={<AddIcon />} variant="contained" onClick={addClass} sx={{ mb: 2 }}>
        Dodaj klasę
      </Button>

      {classes.map(cls => (
        <Accordion key={cls.id} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Typography sx={{ fontWeight: 'bold' }}>{cls.name}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>({cls.key})</Typography>
              {!cls.is_active && <Typography variant="caption" sx={{ color: 'error.main' }}>— nieaktywna</Typography>}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField fullWidth size="small" label="Nazwa" value={cls.name || ''}
                  onChange={e => updateField(cls.id, 'name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" label="Ikona (emoji/nazwa)" value={cls.icon || ''}
                  onChange={e => updateField(cls.id, 'icon', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" multiline minRows={2} label="Opis" value={cls.description || ''}
                  onChange={e => updateField(cls.id, 'description', e.target.value)} />
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption">Mnożniki AP (mnożą się z mnożnikiem rasy)</Typography></Divider></Grid>
              {STATS.map(stat => (
                <Grid item xs={6} sm={4} md={2} key={`mult_${stat}`}>
                  <TextField fullWidth size="small" type="number" inputProps={{ step: 0.1 }} label={STAT_LABEL[stat]}
                    value={cls[`mult_${stat}`] ?? 1}
                    onChange={e => updateField(cls.id, `mult_${stat}`, Number(e.target.value))} />
                </Grid>
              ))}

              <Grid item xs={12}><Divider><Typography variant="caption">Bonusy gameplayowe (%)</Typography></Divider></Grid>
              {BONUSES.map(([field, label]) => (
                <Grid item xs={6} sm={4} md={3} key={field}>
                  <TextField fullWidth size="small" type="number" label={label}
                    value={cls[field] ?? 0}
                    onChange={e => updateField(cls.id, field, Number(e.target.value))} />
                </Grid>
              ))}

              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" type="number" label="Kolejność"
                  value={cls.sort_order ?? 0}
                  onChange={e => updateField(cls.id, 'sort_order', Number(e.target.value))} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={<Switch checked={cls.is_active !== 0 && cls.is_active !== false}
                    onChange={e => updateField(cls.id, 'is_active', e.target.checked ? 1 : 0)} />}
                  label="Aktywna" />
              </Grid>

              <Grid item xs={12}>
                <Button variant="contained" startIcon={savingId === cls.id ? <CircularProgress size={18} /> : <SaveIcon />}
                  disabled={savingId === cls.id} onClick={() => saveClass(cls)}>
                  Zapisz klasę
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default ClassAdminPanel;
