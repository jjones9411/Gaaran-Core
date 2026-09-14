// Kreator instalacyjny silnika (/install) - widoczny automatycznie zamiast
// gry dopóki backend/.installed nie istnieje. Prowadzi przez: bazę danych,
// nazwę gry, rasy, klasy, konto administratora, opcjonalny SMTP - i na
// koniec zapisuje kompletny .env. Nie wymaga logowania (instalacja jest
// pierwszym krokiem, zanim jakikolwiek użytkownik istnieje).

import { useState, useMemo, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  Box, Paper, Typography, TextField, Button, Stepper, Step, StepLabel,
  Alert, CircularProgress, IconButton, Grid, Divider, Accordion,
  AccordionSummary, AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  createAppTheme, appColors, applyThemeColors,
  DEFAULT_PRIMARY_COLOR, DEFAULT_TEXT_COLOR, DEFAULT_BACKGROUND_COLOR,
} from './theme';

const STEPS = ['Baza danych', 'Nazwa gry i kolory', 'Rasy', 'Klasy', 'Administrator', 'E-mail (opcjonalnie)', 'Gotowe'];

// Kilka gotowych propozycji obok dowolnego wyboru z inputu color - żeby nie
// każdy musiał sam szukać sensownego HEX-a.
const PRIMARY_COLOR_PRESETS = [
  { label: 'Rdza (domyślny)', value: DEFAULT_PRIMARY_COLOR },
  { label: 'Krew', value: '#7a1010' },
  { label: 'Głębia', value: '#1a2c5c' },
  { label: 'Trucizna', value: '#3d5c1a' },
  { label: 'Popiół', value: '#4a4a52' },
  { label: 'Fiolet', value: '#4a1a5c' },
];

const BACKGROUND_COLOR_PRESETS = [
  { label: 'Czerń (domyślny)', value: DEFAULT_BACKGROUND_COLOR },
  { label: 'Głęboki granat', value: '#0b0f1a' },
  { label: 'Ciemna zieleń', value: '#0a120c' },
  { label: 'Aksamitna czerń', value: '#120a10' },
];

const TEXT_COLOR_PRESETS = [
  { label: 'Jasny szary (domyślny)', value: DEFAULT_TEXT_COLOR },
  { label: 'Kość słoniowa', value: '#e8e2d0' },
  { label: 'Chłodny błękit', value: '#c8d4e0' },
  { label: 'Ciepły piasek', value: '#d8c8a8' },
];

const emptyRace = () => ({
  name: '', description: '', color: '#7a3b0f', traits: '',
  base_strength: 5, base_dexterity: 5, base_speed: 5,
  base_intelligence: 5, base_willpower: 5, base_endurance: 5,
  mult_strength: 1.0, mult_dexterity: 1.0, mult_speed: 1.0,
  mult_intelligence: 1.0, mult_willpower: 1.0, mult_endurance: 1.0,
  combat_day_percent: 0, combat_night_percent: 0,
});

const emptyClass = () => ({
  name: '', description: '',
  mult_strength: 1.0, mult_dexterity: 1.0, mult_speed: 1.0,
  mult_intelligence: 1.0, mult_willpower: 1.0, mult_endurance: 1.0,
  bonus_attack_percent: 0, bonus_defense_percent: 0, bonus_flee_percent: 0,
  bonus_catch_percent: 0, bonus_pvp_theft_percent: 0, bonus_craft_quality_percent: 0,
  bonus_craft_stamina_reduction_percent: 0, bonus_heal_cost_reduction_percent: 0,
});

function ColorPickerRow({ label, value, onChange, presets }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ mb: 1, fontSize: '0.9rem', opacity: 0.85 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box
          component="input"
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          sx={{
            width: 48, height: 48, p: 0, border: `2px solid ${appColors.rustBorder}`,
            borderRadius: 1, cursor: 'pointer', backgroundColor: 'transparent',
          }}
        />
        <TextField
          label="HEX"
          value={value}
          onChange={e => onChange(e.target.value)}
          sx={{ width: 120 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {presets.map(preset => (
            <Box
              key={preset.value}
              onClick={() => onChange(preset.value)}
              title={preset.label}
              sx={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                backgroundColor: preset.value,
                border: value.toLowerCase() === preset.value.toLowerCase()
                  ? `3px solid ${appColors.textLight}`
                  : `2px solid ${appColors.rustBorder}`,
                transition: 'transform 0.15s',
                '&:hover': { transform: 'scale(1.1)' },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function Installer({ onComplete }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [db, setDb] = useState({ host: 'localhost', port: '3306', user: '', password: '', database: '' });
  const [gameName, setGameName] = useState('');
  const [themeColor, setThemeColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND_COLOR);

  // Motyw kreatora aktualizuje się na żywo w miarę wyboru kolorów - to samo
  // co zobaczy gracz na ekranie logowania/lobby po instalacji.
  const theme = useMemo(
    () => createAppTheme('dark', themeColor, textColor, backgroundColor),
    [themeColor, textColor, backgroundColor]
  );
  useEffect(() => {
    applyThemeColors({ primary: themeColor, text: textColor, background: backgroundColor });
  }, [themeColor, textColor, backgroundColor]);
  const [races, setRaces] = useState([emptyRace(), emptyRace(), emptyRace()]);
  const [classes, setClasses] = useState([emptyClass(), emptyClass(), emptyClass(), emptyClass()]);
  const [admin, setAdmin] = useState({ username: '', email: '', password: '', password2: '' });
  const [emailCfg, setEmailCfg] = useState({
    frontendUrl: typeof window !== 'undefined' ? window.location.origin : '',
    emailUser: '', emailPass: '', smtpHost: '', smtpPort: '587', emailFrom: '',
  });

  const post = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Wystąpił nieoczekiwany błąd.');
    }
    return data;
  };

  const next = () => { setError(''); setInfo(''); setStep(s => s + 1); };
  const back = () => { setError(''); setInfo(''); setStep(s => s - 1); };

  const handleDbSubmit = async () => {
    setError(''); setBusy(true);
    try {
      const data = await post('/api/install/database', db);
      setInfo(data.message);
      setTimeout(next, 600);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGameNameSubmit = async () => {
    setError(''); setBusy(true);
    try {
      await post('/api/install/game-info', { gameName, themeColor, textColor, backgroundColor });
      next();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRacesSubmit = async () => {
    setError(''); setBusy(true);
    try {
      await post('/api/install/races', { races });
      next();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleClassesSubmit = async () => {
    setError(''); setBusy(true);
    try {
      await post('/api/install/classes', { classes });
      next();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubmit = async () => {
    setError('');
    if (admin.password !== admin.password2) {
      setError('Hasła nie są identyczne.');
      return;
    }
    setBusy(true);
    try {
      await post('/api/install/admin', admin);
      next();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setError(''); setBusy(true);
    try {
      const data = await post('/api/install/finish', emailCfg);
      setInfo(data.message);
      next();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateRace = (idx, field, value) => {
    setRaces(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const updateClass = (idx, field, value) => {
    setClasses(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const inputSx = { mb: 2 };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(ellipse at center, ${appColors.bgSurface} 0%, ${appColors.bgDeep} 100%)`,
        p: 2,
      }}>
        <Paper sx={{ maxWidth: 800, width: '100%', p: 4, maxHeight: '92vh', overflowY: 'auto' }}>
          <Typography variant="h4" sx={{ mb: 1, textAlign: 'center', fontWeight: 'bold' }}>
            Kreator instalacyjny
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: appColors.textLight, opacity: 0.8 }}>
            Skonfiguruj bazę danych, nazwę gry, rasy, klasy i konto administratora - bez ręcznej edycji plików.
          </Typography>

          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4, flexWrap: 'wrap' }}>
            {STEPS.map(label => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {info && !error && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

          {/* KROK 0: BAZA DANYCH */}
          {step === 0 && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Podaj dane dostępowe do bazy MySQL (te same, które dostałeś od hostingu, np. OVH).
                Jeśli baza o podanej nazwie nie istnieje, zostanie utworzona automatycznie.
              </Typography>
              <TextField fullWidth label="Host" value={db.host} onChange={e => setDb({ ...db, host: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="Port" value={db.port} onChange={e => setDb({ ...db, port: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="Użytkownik MySQL" value={db.user} onChange={e => setDb({ ...db, user: e.target.value })} sx={inputSx} />
              <TextField fullWidth type="password" label="Hasło MySQL" value={db.password} onChange={e => setDb({ ...db, password: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="Nazwa bazy danych" value={db.database} onChange={e => setDb({ ...db, database: e.target.value })} sx={inputSx} />
              <Button variant="contained" disabled={busy || !db.host || !db.user || !db.database} onClick={handleDbSubmit}>
                {busy ? <CircularProgress size={20} /> : 'Połącz i utwórz strukturę'}
              </Button>
            </Box>
          )}

          {/* KROK 1: NAZWA GRY I KOLORY */}
          {step === 1 && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Jak nazywa się Twoja gra? Ta nazwa pojawi się na stronie głównej, w tytule karty i w e-mailach.
              </Typography>
              <TextField fullWidth label="Nazwa gry" value={gameName} onChange={e => setGameName(e.target.value)} sx={inputSx} autoFocus />

              <Typography sx={{ mb: 2 }}>
                Wybierz kolory interfejsu - reszta odcieni (jaśniejszy/ciemniejszy) jest z nich
                wyliczana automatycznie. Cały ten kreator zmienia się na żywo, więc zobaczysz
                efekt zanim cokolwiek zapiszesz - to samo zobaczy gracz na ekranie logowania i w grze.
              </Typography>

              <ColorPickerRow
                label="Kolor akcentu (przyciski, ramki, podświetlenia)"
                value={themeColor}
                onChange={setThemeColor}
                presets={PRIMARY_COLOR_PRESETS}
              />
              <ColorPickerRow
                label="Kolor tekstu"
                value={textColor}
                onChange={setTextColor}
                presets={TEXT_COLOR_PRESETS}
              />
              <ColorPickerRow
                label="Kolor tła"
                value={backgroundColor}
                onChange={setBackgroundColor}
                presets={BACKGROUND_COLOR_PRESETS}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={back}>Wstecz</Button>
                <Button variant="contained" disabled={busy || !gameName.trim()} onClick={handleGameNameSubmit}>
                  {busy ? <CircularProgress size={20} /> : 'Dalej'}
                </Button>
              </Box>
            </Box>
          )}

          {/* KROK 2: RASY */}
          {step === 2 && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Zdefiniuj rasy postaci (dowolna liczba, minimum jedna). Statystyki startowe i mnożniki
                możesz zostawić domyślne - zaawansowana konfiguracja jest opcjonalna.
              </Typography>
              {races.map((race, idx) => (
                <Accordion key={idx} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography sx={{ flex: 1 }}>{race.name || `Rasa ${idx + 1}`}</Typography>
                      {races.length > 1 && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRaces(prev => prev.filter((_, i) => i !== idx)); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField fullWidth label="Nazwa rasy" value={race.name} onChange={e => updateRace(idx, 'name', e.target.value)} sx={inputSx} />
                    <TextField fullWidth multiline rows={3} label="Opis" value={race.description} onChange={e => updateRace(idx, 'description', e.target.value)} sx={inputSx} />
                    <TextField fullWidth label="Cechy (oddzielone przecinkiem)" value={race.traits} onChange={e => updateRace(idx, 'traits', e.target.value)} sx={inputSx} placeholder="np. Silna, Odporna, Nieufna" />
                    <TextField label="Kolor (HEX)" value={race.color} onChange={e => updateRace(idx, 'color', e.target.value)} sx={inputSx} />
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Statystyki startowe</Typography>
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      {['strength', 'dexterity', 'speed', 'intelligence', 'willpower', 'endurance'].map(stat => (
                        <Grid item xs={4} key={stat}>
                          <TextField
                            fullWidth size="small" type="number" label={stat}
                            value={race[`base_${stat}`]}
                            onChange={e => updateRace(idx, `base_${stat}`, Number(e.target.value))}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                      Mnożniki AP (specjalność rasy - suma ok. 6.0 dla zbalansowania)
                    </Typography>
                    <Grid container spacing={1}>
                      {['strength', 'dexterity', 'speed', 'intelligence', 'willpower', 'endurance'].map(stat => (
                        <Grid item xs={4} key={stat}>
                          <TextField
                            fullWidth size="small" type="number" label={stat}
                            inputProps={{ step: 0.1 }}
                            value={race[`mult_${stat}`]}
                            onChange={e => updateRace(idx, `mult_${stat}`, Number(e.target.value))}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    <Typography variant="caption" sx={{ display: 'block', mt: 2, mb: 1 }}>
                      Modyfikator walki wg pory doby (%) - np. wilkołaki +20 w nocy, wampiry -15 w dzień, ludzie 0/0
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth size="small" type="number" label="Dzień (%)"
                          value={race.combat_day_percent ?? 0}
                          onChange={e => updateRace(idx, 'combat_day_percent', Number(e.target.value))}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth size="small" type="number" label="Noc (%)"
                          value={race.combat_night_percent ?? 0}
                          onChange={e => updateRace(idx, 'combat_night_percent', Number(e.target.value))}
                        />
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
              <Button startIcon={<AddIcon />} onClick={() => setRaces(prev => [...prev, emptyRace()])} sx={{ mb: 2 }}>
                Dodaj rasę
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={back}>Wstecz</Button>
                <Button variant="contained" disabled={busy || races.some(r => !r.name.trim())} onClick={handleRacesSubmit}>
                  {busy ? <CircularProgress size={20} /> : 'Dalej'}
                </Button>
              </Box>
            </Box>
          )}

          {/* KROK 3: KLASY */}
          {step === 3 && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Zdefiniuj klasy postaci (dowolna liczba, minimum jedna) - wybierane przez gracza po stworzeniu postaci.
              </Typography>
              {classes.map((cls, idx) => (
                <Accordion key={idx} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography sx={{ flex: 1 }}>{cls.name || `Klasa ${idx + 1}`}</Typography>
                      {classes.length > 1 && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setClasses(prev => prev.filter((_, i) => i !== idx)); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField fullWidth label="Nazwa klasy" value={cls.name} onChange={e => updateClass(idx, 'name', e.target.value)} sx={inputSx} />
                    <TextField fullWidth multiline rows={3} label="Opis" value={cls.description} onChange={e => updateClass(idx, 'description', e.target.value)} sx={inputSx} />
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Mnożniki AP (mnożą się z mnożnikiem rasy)</Typography>
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      {['strength', 'dexterity', 'speed', 'intelligence', 'willpower', 'endurance'].map(stat => (
                        <Grid item xs={4} key={stat}>
                          <TextField
                            fullWidth size="small" type="number" label={stat}
                            inputProps={{ step: 0.1 }}
                            value={cls[`mult_${stat}`]}
                            onChange={e => updateClass(idx, `mult_${stat}`, Number(e.target.value))}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Bonusy gameplayowe (%)</Typography>
                    <Grid container spacing={1}>
                      {['attack_percent', 'defense_percent', 'flee_percent', 'catch_percent', 'pvp_theft_percent', 'craft_quality_percent', 'craft_stamina_reduction_percent', 'heal_cost_reduction_percent'].map(field => (
                        <Grid item xs={6} sm={4} key={field}>
                          <TextField
                            fullWidth size="small" type="number" label={field.replace(/_percent$/, '')}
                            value={cls[`bonus_${field}`]}
                            onChange={e => updateClass(idx, `bonus_${field}`, Number(e.target.value))}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              ))}
              <Button startIcon={<AddIcon />} onClick={() => setClasses(prev => [...prev, emptyClass()])} sx={{ mb: 2 }}>
                Dodaj klasę
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={back}>Wstecz</Button>
                <Button variant="contained" disabled={busy || classes.some(c => !c.name.trim())} onClick={handleClassesSubmit}>
                  {busy ? <CircularProgress size={20} /> : 'Dalej'}
                </Button>
              </Box>
            </Box>
          )}

          {/* KROK 4: ADMINISTRATOR */}
          {step === 4 && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Utwórz swoje konto administratora - będziesz mieć pełny dostęp do panelu admina.
              </Typography>
              <TextField fullWidth label="Nazwa użytkownika" value={admin.username} onChange={e => setAdmin({ ...admin, username: e.target.value })} sx={inputSx} />
              <TextField fullWidth type="email" label="E-mail" value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} sx={inputSx} />
              <TextField fullWidth type="password" label="Hasło (min. 8 znaków)" value={admin.password} onChange={e => setAdmin({ ...admin, password: e.target.value })} sx={inputSx} />
              <TextField fullWidth type="password" label="Powtórz hasło" value={admin.password2} onChange={e => setAdmin({ ...admin, password2: e.target.value })} sx={inputSx} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={back}>Wstecz</Button>
                <Button variant="contained" disabled={busy || !admin.username || !admin.email || !admin.password} onClick={handleAdminSubmit}>
                  {busy ? <CircularProgress size={20} /> : 'Dalej'}
                </Button>
              </Box>
            </Box>
          )}

          {/* KROK 5: E-MAIL (opcjonalnie) */}
          {step === 5 && (
            <Box>
              <Typography sx={{ mb: 2 }}>
                Dane SMTP są potrzebne do wysyłki maili aktywacyjnych i resetu hasła. Możesz to pominąć
                i uzupełnić później ręcznie w pliku <code>.env</code> na serwerze.
              </Typography>
              <TextField fullWidth label="Adres strony (FRONTEND_URL)" value={emailCfg.frontendUrl} onChange={e => setEmailCfg({ ...emailCfg, frontendUrl: e.target.value })} sx={inputSx} placeholder="https://twojagra.pl" />
              <TextField fullWidth label="EMAIL_USER" value={emailCfg.emailUser} onChange={e => setEmailCfg({ ...emailCfg, emailUser: e.target.value })} sx={inputSx} />
              <TextField fullWidth type="password" label="EMAIL_PASS" value={emailCfg.emailPass} onChange={e => setEmailCfg({ ...emailCfg, emailPass: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="SMTP_HOST" value={emailCfg.smtpHost} onChange={e => setEmailCfg({ ...emailCfg, smtpHost: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="SMTP_PORT" value={emailCfg.smtpPort} onChange={e => setEmailCfg({ ...emailCfg, smtpPort: e.target.value })} sx={inputSx} />
              <TextField fullWidth label="Adres nadawcy (EMAIL_FROM)" value={emailCfg.emailFrom} onChange={e => setEmailCfg({ ...emailCfg, emailFrom: e.target.value })} sx={inputSx} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={back}>Wstecz</Button>
                <Button variant="contained" disabled={busy} onClick={handleFinish}>
                  {busy ? <CircularProgress size={20} /> : 'Zakończ instalację'}
                </Button>
              </Box>
            </Box>
          )}

          {/* KROK 6: GOTOWE */}
          {step === 6 && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ mb: 2 }}>Instalacja zakończona!</Typography>
              <Typography sx={{ mb: 3 }}>
                Uruchom ponownie aplikację (restart procesu Node w panelu hostingu, np. OVH), żeby wczytała
                nowo zapisane dane (<code>.env</code>). Po restarcie odśwież tę stronę - zobaczysz ekran logowania.
              </Typography>
              <Button variant="contained" onClick={() => window.location.reload()}>
                Odśwież stronę
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default Installer;
