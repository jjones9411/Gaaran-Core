// ================================================================
// RaceDivider - linia rozdzielająca w kolorze RASY.
//
// Czysty CSS, bez grafik: cienka linia, która wygasza się ku brzegom, w kolorze
// rasy bieżącej postaci (useRaceColor) albo rasy podanej jawnie przez `raceKey`
// (np. na cmentarzu - linia w kolorze rasy każdej pożegnanej postaci osobno).
//
// Wariant 'top' dokłada rombik na środku (nagłówek sekcji), 'bottom' to sama
// nitka zamykająca blok.
// ================================================================
import { Box } from '@mui/material';
import useRaceColor from './useRaceColor';

export default function RaceDivider({ variant = 'bottom', raceKey = null, height, sx }) {
  const race = useRaceColor(raceKey);
  const color = race.accent;

  const line = {
    height: 1,
    width: '100%',
    background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
    opacity: 0.55,
  };

  if (variant === 'top') {
    return (
      <Box
        aria-hidden
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          flexShrink: 0,
          pointerEvents: 'none',
          py: height != null ? 0 : 1,
          ...sx,
        }}
      >
        <Box sx={line} />
        <Box
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            transform: 'rotate(45deg)',
            border: `1px solid ${color}`,
            opacity: 0.8,
          }}
        />
        <Box sx={line} />
      </Box>
    );
  }

  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        flexShrink: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        height: height != null ? height : 12,
        ...sx,
      }}
    >
      <Box sx={line} />
    </Box>
  );
}
