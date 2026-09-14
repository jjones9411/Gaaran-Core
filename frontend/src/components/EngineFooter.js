// ================================
// EngineFooter
// Dyskretna, informacyjna stopka silnika na samym dole ekranu
// (lobby oraz wszystkie podstrony /home/*). Nie blokuje klików
// (pointerEvents: none) i nie wchodzi w układ paneli.
// ================================

import { Box } from '@mui/material';
import { appColors } from './theme';

export default function EngineFooter() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 5,
        py: 0.35,
        fontFamily: '"Cinzel", serif',
        fontSize: '0.6rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: appColors.steelLight,
        opacity: 0.4,
        textShadow: '0 1px 3px rgba(0,0,0,0.95)',
      }}
    >
      Gaaran Engine 2.0
    </Box>
  );
}
