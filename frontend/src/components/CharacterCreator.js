import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  Box,
  Button,
  TextField,
  Typography,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
  Alert,
  Stack,
  CircularProgress,
  Container,
  Grid,
  IconButton
} from '@mui/material';
import {
  NavigateNext,
  NavigateBefore,
  CheckCircle,
  ArrowBack
} from '@mui/icons-material';
import { appColors } from './theme';

// Paleta kolorów
const COLORS = {
  primary: appColors.bgSurface,
  secondary: appColors.steelLighter,
  background: appColors.bgDeep,
  backgroundDark: appColors.bgBlack,
  rust: appColors.rust,
  rustLight: appColors.rustLight,
  rustDark: appColors.rustDark,
  // Te dwa odcienie są w tym pliku używane WYŁĄCZNIE na tekst (etykiety, eyebrow,
  // podpowiedzi) - podbite o jeden stopień jaśniej, bo na ciemnym tle były słabo
  // czytelne. Kolory ramek/teł mają własne pola (border/glassRust/accent).
  steel: appColors.steelLight,
  steelLight: appColors.steelLighter,
  accent: appColors.borderSteel,
  glassRust: appColors.glassRust,
  border: appColors.rustBorder,
  green: appColors.statusSuccess,
  blue: appColors.statusInfo,
  orange: appColors.statusWarning,
  gray: appColors.statusNeutral
};

// Tekst wprowadzający na kroku potwierdzenia. Silnik nie zna żadnego świata -
// ten opis wpisuje administracja w panelu (game_config.creator_race_intro),
// a poniższy tekst jest tylko zastępnikiem na czystej instalacji.
const originText = 'Za chwilę dołączysz do świata gry i napiszesz pierwszą stronę historii swojej postaci. Sprawdź dane raz jeszcze - imię i rasa zostają na stałe, a opis możesz rozwijać w trakcie gry.';

// Wypełnienie paneli - płaski, ciemny kamień (bez grafik).
const stoneBg = {
  backgroundColor: '#151515',
};

const framedPanel = {
  ...stoneBg,
  position: 'relative',
  border: `1px solid ${COLORS.border}`,
  borderTop: `3px solid ${COLORS.border}`,
  borderRadius: 0,
  boxShadow: '0 10px 40px rgba(0,0,0,0.72)',
};

const plainPanel = {
  ...stoneBg,
  position: 'relative',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 0,
  boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
};

// Wspólny styl pól tekstowych (monospace, rdzawe akcenty, ostre rogi).
const fieldSx = {
  mb: 3,
  '& .MuiOutlinedInput-root': {
    background: 'rgba(0,0,0,0.55)',
    
    fontSize: '1.05rem',
    borderRadius: 0,
    '& fieldset': { borderColor: COLORS.border },
    '&:hover fieldset': { borderColor: COLORS.rust },
    '&.Mui-focused fieldset': { borderColor: COLORS.rust },
  },
  '& .MuiOutlinedInput-input': { color: COLORS.secondary, },
  '& .MuiInputLabel-root': { color: COLORS.steelLight,  letterSpacing: '0.08em' },
  '& .MuiInputLabel-root.Mui-focused': { color: COLORS.rust },
};

// Nagłówek sekcji w stylu gry: eyebrow + tytuł ze znacznikiem ">".
const SectionTitle = ({ eyebrow, title }) => (
  <Box sx={{ textAlign: 'center', mb: 4 }}>
    {eyebrow && (
      <Typography sx={{
        color: COLORS.steel,
        
        fontSize: '0.62rem',
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        mb: 0.5,
      }}>
        {eyebrow}
      </Typography>
    )}
    <Typography variant="h4" sx={{
      color: COLORS.rust,
      
      fontWeight: 'bold',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 1.2,
      fontSize: { xs: '1.35rem', md: '1.7rem' },
    }}>
      <Box component="span" sx={{ color: COLORS.rust, opacity: 0.55 }}>{'>'}</Box>
      {title}
    </Typography>
  </Box>
);

function CharacterCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [checkingCharacter, setCheckingCharacter] = useState(true);
  const [hasCharacter, setHasCharacter] = useState(null);
  const [checkError, setCheckError] = useState(null);

  const [characterName, setCharacterName] = useState('');
  const [gender, setGender] = useState('');
  const [faction, setFaction] = useState('');
  const [previewFaction, setPreviewFaction] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [races, setRaces] = useState([]);
  const [racesLoading, setRacesLoading] = useState(true);
  const [characterClass, setCharacterClass] = useState('');
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [raceIntro, setRaceIntro] = useState('');

  // Rasy pochodzą z bazy (dowolna liczba, zdefiniowana w kreatorze instalacyjnym)
  useEffect(() => {
    fetch('/api/races')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err))
      .finally(() => setRacesLoading(false));
  }, []);

  // Klasy - tak samo jak rasy: dowolna liczba, definiuje je administracja.
  // Wybór klasy jest OPCJONALNY i jednorazowy (backend nie pozwala jej zmienić).
  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania klas:', err))
      .finally(() => setClassesLoading(false));
  }, []);

  // Tekst wprowadzający o rasach (ustawiany przez admina w panelu ras)
  useEffect(() => {
    fetch('/api/game-info')
      .then(res => res.json())
      .then(data => setRaceIntro(data?.creatorRaceIntro || ''))
      .catch(() => {});
  }, []);

  const getRace = (key) => races.find(r => r.key === key);
  const getClass = (key) => classes.find(c => c.key === key);

  useEffect(() => {
    const checkCharacter = async () => {
      const token = localStorage.getItem('token');

      if (!token || !user) {
        navigate('/login');
        return;
      }

      try {
        setCheckingCharacter(true);
        setCheckError(null);

        const response = await fetch('/api/characters', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Unauthorized');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const characterCount = Array.isArray(data?.characters) ? data.characters.length : 0;

        if (characterCount >= 4) {
          setCheckError('Osiągnięto limit postaci!');
        } else {
          setCheckingCharacter(false);
        }

      } catch (error) {
        console.error('Błąd sprawdzania postaci:', error);
        setCheckError('Nie udało się sprawdzić stanu postaci');
        if (error.message === 'Unauthorized') {
          localStorage.clear();
          navigate('/login');
        }
      } finally {
        setCheckingCharacter(false);
      }
    };

    checkCharacter();
  }, [navigate, user]);

  const handleSubmit = async () => {
    if (!characterName?.trim() || !gender || !faction) {
      alert('Uzupełnij wszystkie pola!');
      return;
    }

    if (characterName.trim().length < 3 || characterName.trim().length > 30) {
      alert('Imię postaci musi mieć od 3 do 30 znaków');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/createCharacter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: characterName.trim(),
          gender,
          race: faction,
          faction: faction,
          characterClass: characterClass || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Nieoczekiwana odpowiedź serwera');
      }

      const data = await response.json();

      // Zapisz NOWY token z nową aktywną postacią - bez tego system dalej
      // trzymał poprzednią postać (trzeba było się przelogować). Czyścimy też
      // nieaktualne klucze postaci z localStorage, żeby nie były fallbackiem.
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      ['selectedCharacterId', 'selectedCharacter', 'activeCharacterId', 'activeCharacterName',
       'activeCharacterData', 'characterId'].forEach(k => localStorage.removeItem(k));

      alert('Postać została utworzona!');
      window.location.href = '/home';
    } catch (error) {
      console.error('Błąd przy tworzeniu postaci:', error);
      alert(error.message || 'Nie udało się utworzyć postaci.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = ['Dane Podstawowe', 'Rasa', 'Klasa', 'Potwierdzenie'];

  const handleNext = () => {
    if (activeStep < steps.length - 1) setActiveStep(activeStep + 1);
  };

  const handlePrev = () => {
    if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  const handleBackToLobby = () => {
    navigate('/lobby');
  };

  if (checkingCharacter) {
    return (
      <Box sx={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        ...stoneBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Box sx={{ ...framedPanel, p: 6, textAlign: 'center', maxWidth: 420 }}>
          <CircularProgress sx={{ color: COLORS.rust, mb: 3 }} />
          <Typography variant="h5" sx={{  color: COLORS.rust, fontWeight: 'bold', letterSpacing: '0.1em', mb: 2, textTransform: 'uppercase' }}>
            Wczytywanie kronik...
          </Typography>
          <Typography sx={{  color: COLORS.steelLight, opacity: 0.85 }}>
            Otwieranie ksiąg...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (checkError) {
    return (
      <Box sx={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        ...stoneBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Box sx={{ ...framedPanel, p: 6, textAlign: 'center', maxWidth: 440 }}>
          <Typography variant="h5" sx={{  color: COLORS.rustDark, mb: 3, fontWeight: 'bold', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Zły omen
          </Typography>
          <Typography sx={{ mb: 4,  color: COLORS.secondary }}>
            {checkError}
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              onClick={handleBackToLobby}
              sx={{
                borderColor: COLORS.rust, color: COLORS.rust, 
                fontWeight: 'bold', borderRadius: 0, letterSpacing: '0.08em',
                '&:hover': { borderColor: COLORS.rustLight, background: COLORS.glassRust }
              }}
            >
              Powrót do Lobby
            </Button>
            <Button
              variant="contained"
              onClick={() => window.location.reload()}
              sx={{
                background: COLORS.rust, color: COLORS.background, 
                fontWeight: 'bold', borderRadius: 0, letterSpacing: '0.08em',
                '&:hover': { background: COLORS.rustLight }
              }}
            >
              Spróbuj Ponownie
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  if (hasCharacter) {
    return null;
  }


  const genderButtonSx = (selected) => ({
    py: 2,
    fontSize: '0.95rem',
    
    fontWeight: 'bold',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    borderRadius: 0,
    background: selected ? COLORS.rust : 'transparent',
    color: selected ? COLORS.background : COLORS.steelLight,
    border: `1px solid ${selected ? COLORS.rust : COLORS.border}`,
    boxShadow: selected ? `0 0 16px ${COLORS.rust}55` : 'none',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: selected ? COLORS.rustLight : COLORS.glassRust,
      borderColor: COLORS.rust,
      color: selected ? COLORS.background : COLORS.rustLight,
    }
  });

  const renderBasicInfoStep = () => (
    <Fade in={activeStep === 0} timeout={500}>
      <Box sx={{ ...framedPanel, mb: 4, p: { xs: 3, md: 6 } }}>
        <SectionTitle eyebrow="// Krok I" title="Dane Postaci" />

        <Box sx={{ maxWidth: 500, mx: 'auto', position: 'relative', zIndex: 3 }}>
          <TextField
            label="Imię i nazwisko"
            variant="outlined"
            fullWidth
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            sx={{ ...fieldSx, mb: 4 }}
          />

          <Typography sx={{
            mb: 2, color: COLORS.steel, textAlign: 'center', 
            fontWeight: 'bold', letterSpacing: '0.2em', fontSize: '0.72rem', textTransform: 'uppercase'
          }}>
            Płeć
          </Typography>

          <Grid container spacing={2} justifyContent="center">
            <Grid item xs={6}>
              <Button fullWidth onClick={() => setGender('Kobieta')} sx={genderButtonSx(gender === 'Kobieta')}>
                Kobieta
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button fullWidth onClick={() => setGender('Mężczyzna')} sx={genderButtonSx(gender === 'Mężczyzna')}>
                Mężczyzna
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Fade>
  );

  const renderFactionStep = () => (
    <Fade in={activeStep === 1} timeout={500}>
      <Box sx={{ ...framedPanel, mb: 4, p: { xs: 3, md: 6 } }}>
        <SectionTitle eyebrow="// Krok II" title="Wybór Rasy" />

        {raceIntro && raceIntro.trim() !== '' && (
          <Typography sx={{
            color: COLORS.secondary, textAlign: 'center', maxWidth: 800, mx: 'auto', mb: 5,
            lineHeight: 1.8,  fontSize: '0.92rem', whiteSpace: 'pre-wrap',
          }}>
            {raceIntro}
          </Typography>
        )}

        {racesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: COLORS.rust }} />
          </Box>
        ) : races.length === 0 ? (
          <Alert severity="warning" sx={{ maxWidth: 600, mx: 'auto', borderRadius: 0 }}>
            Brak zdefiniowanych ras. Skontaktuj się z administratorem.
          </Alert>
        ) : (
          <Grid container spacing={3} sx={{ mb: 4, maxWidth: 900, mx: 'auto', position: 'relative', zIndex: 3 }}>
            {races.map((race) => {
              const isSelected = faction === race.key;
              const traits = (race.traits || '').split(',').map(t => t.trim()).filter(Boolean);
              const color = race.color || COLORS.rust;

              return (
                <Grid item xs={12} md={races.length <= 4 ? Math.floor(12 / races.length) || 12 : 4} key={race.key}>
                  <Box
                    onClick={() => {
                      setPreviewFaction(race.key);
                      setFaction(race.key);
                    }}
                    sx={{
                      height: 300,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      background: isSelected ? `${color}1f` : 'rgba(0,0,0,0.6)',
                      border: `1px solid ${isSelected ? color : COLORS.border}`,
                      borderRadius: 0,
                      p: 3,
                      pt: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      transition: 'all 0.28s ease',
                      boxShadow: isSelected ? `0 0 26px ${color}55, inset 0 0 24px ${color}18` : '0 4px 16px rgba(0,0,0,0.5)',
                      // Górny pasek akcentu w kolorze rasy
                      '&::before': {
                        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: color,
                        opacity: isSelected ? 1 : 0.55,
                        boxShadow: isSelected ? `0 0 12px ${color}` : 'none',
                      },
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        borderColor: color,
                        background: `${color}17`,
                        boxShadow: `0 12px 34px rgba(0,0,0,0.6), 0 0 24px ${color}55`,
                        '&::before': { opacity: 1 },
                      }
                    }}
                  >
                    <Typography variant="h5" sx={{
                       fontWeight: 'bold',
                      color: isSelected ? color : COLORS.secondary,
                      mb: 2.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                      textShadow: isSelected ? `0 0 12px ${color}88` : 'none',
                    }}>
                      {race.name}
                    </Typography>
                    <Stack spacing={0.8} sx={{ alignItems: 'center' }}>
                      {traits.map((trait, tIdx) => (
                        <Typography key={tIdx} sx={{
                          color: isSelected ? COLORS.secondary : COLORS.steelLight,
                           opacity: 0.9, fontSize: '0.82rem', letterSpacing: '0.04em',
                        }}>
                          <Box component="span" sx={{ color, mr: 0.7 }}>◆</Box>{trait}
                        </Typography>
                      ))}
                    </Stack>
                    {isSelected && (
                      <Typography sx={{
                        mt: 'auto', pt: 2, color,  fontSize: '0.68rem',
                        letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 'bold',
                      }}>
                        ✓ Wybrano
                      </Typography>
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}

        {previewFaction && getRace(previewFaction) && (
          <Slide direction="up" in={Boolean(previewFaction)} timeout={500}>
            <Box sx={{
              ...plainPanel,
              background: 'rgba(0,0,0,0.72)',
              border: `1px solid ${getRace(previewFaction).color || COLORS.rust}`,
              boxShadow: `0 0 20px ${(getRace(previewFaction).color || COLORS.rust)}33`,
              maxWidth: 800, mx: 'auto', p: 4, position: 'relative', zIndex: 3,
            }}>
              <Typography variant="h5" sx={{
                mb: 2.5, color: getRace(previewFaction).color || COLORS.rust, fontWeight: 'bold',
                 textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                {getRace(previewFaction).name}
              </Typography>
              <Typography sx={{
                color: COLORS.secondary, textAlign: 'justify', lineHeight: 1.8,  fontSize: '0.95rem',
              }}>
                {getRace(previewFaction).description}
              </Typography>
            </Box>
          </Slide>
        )}
      </Box>
    </Fade>
  );

  const summaryField = (label, value, valueColor) => (
    <Grid item xs={12} sm={6}>
      <Typography sx={{
        color: COLORS.steel, fontWeight: 'bold', 
        fontSize: '0.68rem', letterSpacing: '0.16em', textTransform: 'uppercase', mb: 0.3,
      }}>
        {label}
      </Typography>
      <Typography sx={{ color: valueColor || COLORS.secondary,  fontSize: '1.1rem', fontWeight: valueColor ? 'bold' : 'normal' }}>
        {value}
      </Typography>
    </Grid>
  );

  // KROK III: klasa postaci. Tak samo fabularna jak rasa - nie daje żadnych
  // bonusów, jest rolą, którą postać pełni w świecie. Można ją pominąć.
  const renderClassStep = () => (
    <Fade in={activeStep === 2} timeout={500}>
      <Box sx={{ ...framedPanel, mb: 4, p: { xs: 3, md: 6 } }}>
        <SectionTitle eyebrow="// Krok III" title="Wybór Klasy" />

        <Typography sx={{
          color: COLORS.secondary, textAlign: 'center', maxWidth: 800, mx: 'auto', mb: 5,
          lineHeight: 1.8, fontSize: '0.92rem',
        }}>
          Klasa to rola, w jakiej postać funkcjonuje w świecie - nie daje żadnych
          premii ani wartości liczbowych. Wybierasz ją raz; możesz też ten krok pominąć.
        </Typography>

        {classesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: COLORS.rust }} />
          </Box>
        ) : classes.length === 0 ? (
          <Alert severity="info" sx={{ maxWidth: 600, mx: 'auto', borderRadius: 0 }}>
            Administracja nie zdefiniowała jeszcze żadnych klas - przejdź dalej.
          </Alert>
        ) : (
          <Grid container spacing={3} sx={{ maxWidth: 900, mx: 'auto' }}>
            {classes.map((cls) => {
              const isSelected = characterClass === cls.key;
              return (
                <Grid item xs={12} md={classes.length <= 4 ? Math.floor(12 / classes.length) || 12 : 4} key={cls.key}>
                  <Box
                    onClick={() => setCharacterClass(isSelected ? '' : cls.key)}
                    sx={{
                      minHeight: 200,
                      height: '100%',
                      cursor: 'pointer',
                      position: 'relative',
                      background: isSelected ? `${COLORS.rust}1f` : 'rgba(0,0,0,0.6)',
                      border: `1px solid ${isSelected ? COLORS.rust : COLORS.border}`,
                      borderRadius: 0,
                      p: 3,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      transition: 'all 0.28s ease',
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        borderColor: COLORS.rust,
                      },
                    }}
                  >
                    <Typography variant="h5" sx={{
                      fontWeight: 'bold',
                      color: isSelected ? COLORS.rust : COLORS.secondary,
                      mb: 2, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      {cls.name}
                    </Typography>
                    {cls.description && (
                      <Typography sx={{ color: COLORS.steelLight, fontSize: '0.85rem', lineHeight: 1.7 }}>
                        {cls.description}
                      </Typography>
                    )}
                    {isSelected && (
                      <Typography sx={{
                        mt: 'auto', pt: 2, color: COLORS.rust, fontSize: '0.68rem',
                        letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 'bold',
                      }}>
                        ✓ Wybrano
                      </Typography>
                    )}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    </Fade>
  );

  const renderSummaryStep = () => (
    <Fade in={activeStep === 3} timeout={500}>
      <Box sx={{ ...framedPanel, mb: 4, p: { xs: 3, md: 6 } }}>
        <SectionTitle eyebrow="// Krok IV" title="Potwierdzenie" />

        <Box sx={{ maxWidth: 600, mx: 'auto', position: 'relative', zIndex: 3 }}>
          <Box sx={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.rust}`, p: 3.5, mb: 4 }}>
            <Typography sx={{ color: COLORS.secondary, textAlign: 'justify', lineHeight: 1.7,  fontSize: '0.95rem', fontStyle: 'italic' }}>
              {originText}
            </Typography>
          </Box>

          <Box sx={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${COLORS.rust}66`, p: 3.5 }}>
            <Typography sx={{
               fontWeight: 'bold', mb: 2.5, color: COLORS.rust,
              letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: '0.95rem',
              borderBottom: `1px solid ${COLORS.border}`, pb: 1,
            }}>
              Twój profil
            </Typography>
            <Grid container spacing={2.5}>
              {summaryField('Imię', characterName || 'Nie podano')}
              {summaryField('Płeć', gender || 'Nie wybrano')}
              {summaryField(
                'Rasa',
                faction && getRace(faction) ? getRace(faction).name : 'Nie wybrano',
                faction && getRace(faction) ? getRace(faction).color : undefined
              )}
              {summaryField(
                'Klasa',
                characterClass && getClass(characterClass) ? getClass(characterClass).name : 'Bez klasy'
              )}
            </Grid>
          </Box>
        </Box>
      </Box>
    </Fade>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: return renderBasicInfoStep();
      case 1: return renderFactionStep();
      case 2: return renderClassStep();
      case 3: return renderSummaryStep();
      default: return null;
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return characterName?.trim() && gender;
      case 1: return Boolean(faction);
      // Klasa jest opcjonalna - można ją pominąć i grać bez niej.
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      py: 4,
      // Ta sama grafika zniszczonego świata co login/lobby - spójny mroczny
      // klimat low-fantasy (płynne przejście lobby -> kreator). Kamienna tekstura
      // zostaje wewnątrz paneli (framedPanel), nie jako tło całej strony.
      backgroundColor: COLORS.backgroundDark,
      backgroundImage: 'var(--game-bg-image)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      // Ciemna zasłona + winieta + ciepła poświata rdzy u góry (jak w lobby).
      '&::before': {
        content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: `
          radial-gradient(ellipse at 50% 0%, ${COLORS.rust}22 0%, transparent 45%),
          radial-gradient(ellipse at center, rgba(10,8,7,0.72) 0%, rgba(6,5,4,0.90) 70%, rgba(3,2,2,0.97) 100%)
        `,
      },
      '&::after': {
        content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        boxShadow: 'inset 0 0 220px 60px rgba(0,0,0,0.85)',
      },
    }}>
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 3 }}>
        {/* Header z przyciskiem powrotu */}
        <Box sx={{ position: 'relative', textAlign: 'center', mb: 5 }}>
          <IconButton
            onClick={handleBackToLobby}
            aria-label="Powrót do lobby"
            sx={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              color: COLORS.rust, border: `1px solid ${COLORS.border}`, borderRadius: 0,
              '&:hover': { background: COLORS.glassRust, borderColor: COLORS.rust }
            }}
          >
            <ArrowBack />
          </IconButton>

          <Typography variant="h2" sx={{
            mb: 1.5, color: COLORS.rust, fontWeight: 'bold', 
            textTransform: 'uppercase', fontSize: { xs: '1.8rem', md: '2.5rem' }, letterSpacing: '0.14em',
            textShadow: `0 0 24px ${COLORS.rust}44`,
          }}>
            Kreator Postaci
          </Typography>
          <Typography sx={{ color: COLORS.steelLight,  letterSpacing: '0.08em', opacity: 0.85 }}>
            Napisz pierwszą stronę historii swojej postaci
          </Typography>
        </Box>

        {/* Stepper (własny, w klimacie gry) */}
        <Box sx={{ ...plainPanel, mb: 4, px: { xs: 2, md: 4 }, py: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            {steps.map((label, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              const c = active || done ? COLORS.rust : COLORS.accent;
              return (
                <Box key={label} sx={{ display: 'flex', alignItems: 'flex-start', flex: i < steps.length - 1 ? 1 : '0 0 auto', minWidth: 0 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0, width: isMobile ? 84 : 120 }}>
                    <Box sx={{
                      width: 34, height: 34,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${c}`,
                      background: done ? COLORS.rust : 'rgba(0,0,0,0.4)',
                      color: done ? COLORS.background : c,
                       fontWeight: 'bold', fontSize: '0.9rem',
                      transform: 'rotate(45deg)',
                      boxShadow: active ? `0 0 14px ${COLORS.rust}77` : 'none',
                      transition: 'all 0.25s ease',
                    }}>
                      <Box component="span" sx={{ transform: 'rotate(-45deg)' }}>{done ? '✓' : i + 1}</Box>
                    </Box>
                    <Typography sx={{
                       fontSize: '0.66rem', letterSpacing: '0.12em',
                      textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.3,
                      color: active ? COLORS.rust : done ? COLORS.rustLight : COLORS.steelLight,
                      fontWeight: active ? 'bold' : 'normal',
                    }}>
                      {label}
                    </Typography>
                  </Box>
                  {i < steps.length - 1 && (
                    <Box sx={{ flex: 1, height: 2, mt: '17px', mx: 0.5, background: done ? COLORS.rust : COLORS.accent, transition: 'background 0.25s ease' }} />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        <Box sx={{ ...plainPanel, p: { xs: 2.5, md: 4 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button
              onClick={handlePrev}
              disabled={activeStep === 0}
              startIcon={<NavigateBefore />}
              variant="outlined"
              sx={{
                borderColor: COLORS.rust, color: COLORS.rust, 
                fontWeight: 'bold', borderRadius: 0, letterSpacing: '0.08em', textTransform: 'uppercase',
                '&:hover': { borderColor: COLORS.rustLight, background: COLORS.glassRust },
                '&:disabled': { borderColor: COLORS.accent, color: COLORS.accent }
              }}
            >
              Wstecz
            </Button>

            <Typography sx={{ color: COLORS.steelLight,  fontWeight: 'bold', letterSpacing: '0.15em' }}>
              {activeStep + 1} / {steps.length}
            </Typography>

            {activeStep < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                endIcon={<NavigateNext />}
                variant="contained"
                sx={{
                  background: canProceed() ? COLORS.rust : COLORS.accent,
                  color: canProceed() ? COLORS.background : COLORS.secondary,
                   fontWeight: 'bold', borderRadius: 0, letterSpacing: '0.08em', textTransform: 'uppercase',
                  boxShadow: canProceed() ? `0 0 16px ${COLORS.rust}44` : 'none',
                  '&:hover': { background: canProceed() ? COLORS.rustLight : COLORS.accent },
                  '&:disabled': { background: COLORS.accent, color: COLORS.secondary, opacity: 0.6 }
                }}
              >
                Dalej
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                endIcon={isSubmitting ? <CircularProgress size={20} sx={{ color: COLORS.background }} /> : <CheckCircle />}
                variant="contained"
                sx={{
                  background: COLORS.rust, color: COLORS.background, 
                  fontWeight: 'bold', fontSize: '1.05rem', px: 4, py: 1.4, borderRadius: 0,
                  letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: `0 0 18px ${COLORS.rust}55`,
                  '&:hover': { background: COLORS.rustLight },
                  '&:disabled': { background: COLORS.accent, color: COLORS.secondary, opacity: 0.6 }
                }}
              >
                {isSubmitting ? 'Tworzenie...' : 'Utwórz Postać'}
              </Button>
            )}
          </Stack>
        </Box>

      </Container>
    </Box>
  );
}

export default CharacterCreator;
