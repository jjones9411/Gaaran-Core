import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Wspólny, pełnoekranowy/blokujący spinner ładowania - zamiast każdy ekran gry
// robił to inaczej (CircularProgress / LinearProgress / goły tekst "Ładowanie...")
export function LoadingState({ label = 'Ładowanie...', size = 40, minHeight = 200 }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight,
        py: 4,
      }}
    >
      <CircularProgress size={size} />
      {label && (
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary,  textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}

// Wspólny komunikat "brak danych" (puste listy przedmiotów/potworów/wyników itd.)
export function EmptyState({ message = 'Brak danych', action }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
      <Alert severity="info" sx={{  borderRadius: 0, width: '100%' }}>
        {message}
      </Alert>
      {action}
    </Box>
  );
}
