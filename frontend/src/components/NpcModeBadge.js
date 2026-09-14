// ================================
// NpcModeBadge.js
// Stała plakietka trybu NPC widoczna w całej grze, gdy admin gra postacią ze
// wspólnego subkonta NPC. Dwie funkcje:
//   * przypomina, CZYIM kontem się pisze (żeby nie wysłać wiadomości "jako NPC"
//     w przekonaniu, że pisze się swoją postacią - i odwrotnie),
//   * daje wyjście na własne konto z dowolnego miejsca, bez wracania do lobby.
//
// Pozycja fixed, żeby jeden komponent obsłużył wszystkie warianty powłoki gry
// (desktop/mobile) bez ruszania ich layoutów.
// ================================

import { useState } from 'react';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import {
  TheaterComedy as TheaterComedyIcon,
  KeyboardReturn as KeyboardReturnIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { isNpcMode } from './AuthContext';
import { exitNpcMode, applySwitchedToken } from './npcMode';

function NpcModeBadge() {
  const theme = useTheme();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isNpcMode()) return null;

  const handleExit = async () => {
    setLeaving(true);
    setError(null);
    try {
      const token = await exitNpcMode();
      applySwitchedToken(token);
    } catch (err) {
      setError(err.message);
      setLeaving(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 8,
        left: 8,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.5,
        borderRadius: '2px',
        border: `1px solid ${theme.palette.warning.main}`,
        bgcolor: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <TheaterComedyIcon sx={{ color: theme.palette.warning.main, fontSize: 18 }} />
      <Typography
        sx={{
          color: theme.palette.warning.main,
          fontSize: '0.7rem',
          fontWeight: 'bold',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        Tryb NPC
      </Typography>
      <Tooltip title={error || 'Wróć na swoje konto administratora'} arrow>
        <span>
          <Button
            size="small"
            onClick={handleExit}
            disabled={leaving}
            startIcon={<KeyboardReturnIcon sx={{ fontSize: 16 }} />}
            sx={{
              minWidth: 0,
              px: 1,
              fontSize: '0.7rem',
              color: theme.palette.warning.main,
              '&:hover': { bgcolor: `${theme.palette.warning.main}22` },
            }}
          >
            {leaving ? '...' : 'Wyjdź'}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}

export default NpcModeBadge;
