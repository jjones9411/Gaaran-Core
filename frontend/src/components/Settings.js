// frontend/src/views/Settings.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography,
  Select, MenuItem, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import { decodeJwtPayload } from './AuthContext';
import useRaceColor from './useRaceColor';
import {
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  FONT_SCALE_DEFAULT,
  getStoredFontScale,
  clampFontScale,
  applyAndCacheFontScale,
  loadFontScaleFromServer,
  saveFontScaleToServer,
} from './fontScale';
import {
  CONTENT_WIDTH_OPTIONS,
  CONTENT_WIDTH_DEFAULT,
  getStoredContentWidth,
  clampContentWidth,
  applyAndCacheContentWidth,
  loadContentWidthFromServer,
  saveContentWidthToServer,
} from './contentWidth';

const API_URL = '/api';

// Sekcja ustawień: nagłówek "kapitalikami" + cienka linia w kolorze rasy.
// Ta sama konwencja co InfoSection w profilu i nagłówki wieści - zamiast
// pudełek z ikonką grupuje treść samą typografią i linią.
const SettingsSection = ({ title, accent, children, sx }) => (
  <Box sx={{ mb: 4, ...sx }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Typography
        component="span"
        sx={{
          fontFamily: '"Cinzel", serif',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: accent,
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${accent}99, transparent)` }} />
    </Box>
    {children}
  </Box>
);

// Krótki opis pod kontrolką - zwykły tekst, nie `variant="caption"`, bo caption
// w tym motywie jest WERSALIKAMI i długie akapity wyglądały jak krzyk.
const SectionHint = ({ children, italic = false }) => (
  <Typography
    variant="body2"
    sx={{ color: 'text.secondary', fontStyle: italic ? 'italic' : 'normal', mt: 1, lineHeight: 1.5 }}
  >
    {children}
  </Typography>
);

// Definicje statusów. Kolor niesie kropka przy opcji - bez emoji, żeby lista
// wyglądała jak reszta gry (Cinzel + stonowany akcent), a nie jak czat.
const STATUS_OPTIONS = {
  looking: {
    label: 'Szukam sesji',
    color: '#4caf50',
    description: 'Jestem otwarty na nowe sesje',
  },
  maybe: {
    label: 'Może coś wyjątkowego',
    color: '#ff9800',
    description: 'Niekoniecznie, ale coś wyjątkowego wezmę',
  },
  not_looking: {
    label: 'Nie szukam sesji',
    color: '#f44336',
    description: 'Obecnie nie szukam sesji',
  },
  now_not_looking: {
    label: 'Przerwa od fabuły',
    color: '#2196f3',
    description: 'Aktualnie robię przerwę od fabularnych sesji',
  },
};

function Settings() {
  const navigate = useNavigate();
  // Akcent z koloru rasy postaci - tak jak na podstronach miasta i w profilu,
  // zamiast surowego primary z motywu.
  const race = useRaceColor();
  const raceHex = race.hex;
  const raceAccent = race.accent;

  const [characterData, setCharacterData] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [playerStatus, setPlayerStatus] = useState('not_looking');

  // Osobista skala czcionki głównego boxa (per konto). Startowa wartość z cache
  // (localStorage), potem dosynchronizowana z serwerem w useEffect poniżej.
  const [fontScale, setFontScale] = useState(getStoredFontScale());

  // Osobista szerokość głównego boxa (per konto) - jak wyżej: cache na start,
  // serwer dosynchronizowuje w useEffect.
  const [contentWidth, setContentWidth] = useState(getStoredContentWidth());

  // Zgłaszanie błędów przez gracza
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugFeedback, setBugFeedback] = useState(null); // { type, text }

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    // Pobierz dane z JWT tokena
    const payload = decodeJwtPayload(token);
    if (!payload) {
      console.error('Error decoding token');
      navigate('/login');
      return;
    }

    const userId = payload.id;
    const characterId = payload.characterId;
    const role = payload.role || 'mieszkaniec';
    const characterName = payload.characterName;
    const characterAvatar = payload.characterAvatar;

    // Ustaw rolę z tokena
    setUserRole(role);

    // Sprawdź czy gracz ma wybraną postać
    if (!characterId) {
      navigate('/lobby');
      return;
    }

    // POBIERZ AKTUALNY STATUS Z API zamiast polegać tylko na localStorage
    const fetchCharacterStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/home/stats`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Utwórz kompletny obiekt postaci z aktualnych danych
          const charData = {
            id: data.id || characterId,
            name: data.name || characterName || 'Postać',
            avatar: data.avatar || characterAvatar || null,
            player_status: data.player_status || 'not_looking'
          };

          setCharacterData(charData);

          // Ustaw aktualny status z bazy danych
          const currentStatus = data.player_status || 'not_looking';
          if (STATUS_OPTIONS[currentStatus]) {
            setPlayerStatus(currentStatus);
          } else {
            setPlayerStatus('not_looking');
          }

          // Zaktualizuj localStorage z aktualnymi danymi
          localStorage.setItem('selectedCharacter', JSON.stringify(charData));
        } else {
          // Jeśli API nie odpowiada, użyj danych z tokena jako fallback
          console.warn('Nie udało się pobrać statusu z API, używam danych z tokena');
          const basicCharData = {
            id: characterId,
            name: characterName || 'Postać',
            avatar: characterAvatar || null,
            player_status: 'not_looking'
          };
          setCharacterData(basicCharData);
          setPlayerStatus('not_looking');
        }
      } catch (error) {
        console.error('Error fetching character status:', error);
        // Fallback do danych z tokena
        const basicCharData = {
          id: characterId,
          name: characterName || 'Postać',
          avatar: characterAvatar || null,
          player_status: 'not_looking'
        };
        setCharacterData(basicCharData);
        setPlayerStatus('not_looking');
      }
    };

    fetchCharacterStatus();

    // Dosynchronizuj skalę czcionki ze źródła prawdy (serwer, per konto), żeby
    // suwak pokazywał realną wartość konta również po zalogowaniu na nowym urządzeniu.
    loadFontScaleFromServer(token).then((serverScale) => {
      if (serverScale != null) setFontScale(serverScale);
    });

    // To samo dla szerokości głównego boxa.
    loadContentWidthFromServer(token).then((serverWidth) => {
      if (serverWidth != null) setContentWidth(serverWidth);
    });
  }, [navigate]);

  // Zmiana skali czcionki: zastosuj natychmiast (+ cache), zaktualizuj widok
  // i zapisz na koncie. delta w krokach (+1 / -1).
  const changeFontScale = (deltaSteps) => {
    const next = clampFontScale(fontScale + deltaSteps * FONT_SCALE_STEP);
    if (next === fontScale) return;
    setFontScale(next);
    applyAndCacheFontScale(next);
    const token = localStorage.getItem('token');
    saveFontScaleToServer(next, token);
  };

  // Zmiana szerokości głównego boxa: zastosuj natychmiast (zmienna CSS + cache)
  // i zapisz na koncie. Efekt widać od razu, bez przeładowania strony.
  const handleContentWidthChange = (value) => {
    const next = clampContentWidth(value);
    if (next === contentWidth) return;
    setContentWidth(next);
    applyAndCacheContentWidth(next);
    const token = localStorage.getItem('token');
    saveContentWidthToServer(next, token);
  };

  const resetFontScale = () => {
    if (fontScale === FONT_SCALE_DEFAULT) return;
    setFontScale(FONT_SCALE_DEFAULT);
    applyAndCacheFontScale(FONT_SCALE_DEFAULT);
    const token = localStorage.getItem('token');
    saveFontScaleToServer(FONT_SCALE_DEFAULT, token);
  };

  const handleStatusChange = async (newStatus) => {
    const token = localStorage.getItem('token');

    // Użyj characterId z characterData (które pochodzi z JWT tokena)
    if (!characterData?.id) {
      alert('Brak danych postaci');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/character/${characterData.id}/player-status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Błąd aktualizacji');
      
      setPlayerStatus(newStatus);
      const updatedCharacter = { ...characterData, player_status: newStatus };
      setCharacterData(updatedCharacter);
      
      localStorage.setItem('selectedCharacter', JSON.stringify(updatedCharacter));
      
      alert('Status został zaktualizowany!');
    } catch (error) {
      console.error('Błąd aktualizacji statusu:', error);
      alert('Nie udało się zaktualizować statusu.');
    }
  };

  const handleBugSubmit = async () => {
    if (!bugDescription.trim()) {
      setBugFeedback({ type: 'error', text: 'Opisz proszę błąd.' });
      return;
    }

    setBugSubmitting(true);
    setBugFeedback(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/bug-report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: bugDescription.trim(),
          url: window.location.href,
        }),
      });

      if (!response.ok) throw new Error('Błąd wysyłania');

      setBugFeedback({ type: 'success', text: 'Dziękujemy! Zgłoszenie zostało wysłane.' });
      setBugDescription('');
      setTimeout(() => {
        setBugDialogOpen(false);
        setBugFeedback(null);
      }, 1500);
    } catch (error) {
      console.error('Błąd wysyłania zgłoszenia:', error);
      setBugFeedback({ type: 'error', text: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.' });
    } finally {
      setBugSubmitting(false);
    }
  };

  if (!characterData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Ładowanie ustawień...</Typography>
      </Box>
    );
  }

  const isStaff = userRole === 'admin' || userRole === 'mistrz_gry';

  // Wspólny wygląd list rozwijanych - bez pływających etykiet ("Wybierz status",
  // "Wybierz styl gry"), bo nazwa sekcji mówi to samo o linijkę wyżej.
  const selectSx = {
    borderRadius: 0,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: `${raceHex}66` },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: raceAccent },
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 860, mx: 'auto', px: { xs: 1.5, sm: 2 }, pt: 1, pb: 5 }}>
      {/* NAGŁÓWEK */}
      <Box sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 1.5,
        flexWrap: 'wrap',
        pb: 1.5,
        mb: 4,
        borderBottom: `2px solid ${raceHex}`,
      }}>
        <Typography variant="h4" sx={{ color: raceAccent, lineHeight: 1 }}>
          Ustawienia
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{
          fontFamily: '"Cinzel", serif',
          fontSize: '0.72rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}>
          {characterData.name || 'Bez nazwy'}
        </Typography>
      </Box>

      {/* === STATUS GRACZA === */}
      <SettingsSection title="Status gracza" accent={raceAccent}>
        <FormControl fullWidth>
          <Select
            value={playerStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            sx={selectSx}
          >
            {Object.entries(STATUS_OPTIONS).map(([key, status]) => (
              <MenuItem key={key} value={key}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: status.color, flexShrink: 0 }} />
                  {status.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <SectionHint italic>{STATUS_OPTIONS[playerStatus]?.description}</SectionHint>
      </SettingsSection>

      {/* === ROZMIAR CZCIONKI === */}
      <SettingsSection title="Rozmiar czcionki" accent={raceAccent}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, lineHeight: 1.5 }}>
          Wielkość tekstu w głównym oknie gry. Zapisuje się na koncie.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => changeFontScale(-1)}
            disabled={fontScale <= FONT_SCALE_MIN}
            aria-label="Zmniejsz czcionkę"
            sx={{ minWidth: 56, borderRadius: 0, borderColor: `${raceHex}66`, color: raceAccent }}
          >
            A−
          </Button>

          <Box sx={{
            flex: 1,
            textAlign: 'center',
            py: 1,
            border: `1px solid ${raceHex}44`,
          }}>
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2, color: raceAccent }}>
              {fontScale}%
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              {fontScale === FONT_SCALE_DEFAULT ? 'wartość domyślna' : 'domyślnie 100%'}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            onClick={() => changeFontScale(1)}
            disabled={fontScale >= FONT_SCALE_MAX}
            aria-label="Zwiększ czcionkę"
            sx={{ minWidth: 56, borderRadius: 0, borderColor: `${raceHex}66`, color: raceAccent, fontSize: '1.15rem' }}
          >
            A+
          </Button>
        </Box>

        <Button
          variant="text"
          size="small"
          onClick={resetFontScale}
          disabled={fontScale === FONT_SCALE_DEFAULT}
          sx={{ mt: 1, px: 0, color: 'text.secondary', '&:hover': { background: 'none', color: raceAccent } }}
        >
          Przywróć domyślny
        </Button>
      </SettingsSection>

      {/* === SZEROKOŚĆ GŁÓWNEGO OKNA === */}
      <SettingsSection title="Szerokość okna" accent={raceAccent}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5, lineHeight: 1.5 }}>
          Poszerza okno gry razem z listą online. Przydatne przy długich sesjach.
        </Typography>

        <FormControl fullWidth>
          <Select
            value={contentWidth}
            onChange={(e) => handleContentWidthChange(e.target.value)}
            sx={selectSx}
          >
            {CONTENT_WIDTH_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <SectionHint>
          {CONTENT_WIDTH_OPTIONS.find((o) => o.value === contentWidth)?.hint}
          {contentWidth !== CONTENT_WIDTH_DEFAULT && ' Na wąskim ekranie bez zmian.'}
        </SectionHint>
      </SettingsSection>

      {/* === ZGŁOSZENIA === */}
      <SettingsSection title="Zgłoszenia" accent={raceAccent}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/home/settings/reports')}
            sx={{ borderRadius: 0, borderColor: `${raceHex}66`, color: raceAccent, '&:hover': { borderColor: raceAccent } }}
          >
            Zgłoszenia sesji
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              setBugFeedback(null);
              setBugDialogOpen(true);
            }}
            sx={{ borderRadius: 0 }}
          >
            Zgłoś błąd
          </Button>
        </Box>
      </SettingsSection>

      {/* === NARZĘDZIA PROWADZĄCEGO === */}
      {isStaff && (
        <SettingsSection title="Prowadzenie gry" accent={raceAccent} sx={{ mb: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/home/settings/admin-reports')}
              sx={{ borderRadius: 0, borderColor: `${raceHex}66`, color: raceAccent, '&:hover': { borderColor: raceAccent } }}
            >
              Podsumowania graczy
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/home/settings/character-cards-approval')}
              sx={{ borderRadius: 0, borderColor: `${raceHex}66`, color: raceAccent, '&:hover': { borderColor: raceAccent } }}
            >
              Karty postaci
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/home/adminpanel')}
              sx={{ borderRadius: 0, gridColumn: { xs: 'auto', sm: '1 / -1' } }}
            >
              Panel admina
            </Button>
          </Box>
        </SettingsSection>
      )}

      {/* === DIALOG ZGŁASZANIA BŁĘDU === */}
      <Dialog open={bugDialogOpen} onClose={() => setBugDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Zgłoś błąd</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Opisz co robiłeś, czego się spodziewałeś i co poszło nie tak.
          </Typography>
          {bugFeedback && (
            <Alert severity={bugFeedback.type} sx={{ mb: 2 }}>
              {bugFeedback.text}
            </Alert>
          )}
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            label="Opis błędu"
            value={bugDescription}
            onChange={(e) => setBugDescription(e.target.value)}
            disabled={bugSubmitting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBugDialogOpen(false)} disabled={bugSubmitting}>
            Anuluj
          </Button>
          <Button variant="contained" onClick={handleBugSubmit} disabled={bugSubmitting}>
            {bugSubmitting ? 'Wysyłanie...' : 'Wyślij'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Settings;
