// ================================
// ToolbarOverflow.js
// Zwija RZADZIEJ używane przyciski paska narzędzi edytora do menu "..." na
// mobile, zostawiając na wierzchu tylko te najważniejsze.
//
// Po co: pasek narzędzi ma flexWrap="nowrap" + overflowX:'auto', czyli na
// telefonie po prostu scrolluje się w bok. Przy ~13 przyciskach po 36 px to
// blisko 480 px zawartości na ekranie szerokim na ~344 px - a rzeczy używane
// w sesji RP najczęściej (kostka, tryb narratora) siedziały na samym KOŃCU,
// poza ekranem. Zamiast łączyć cztery różne paski narzędzi w jeden komponent
// (każdy ekran ma inny zestaw przycisków), opakowujemy tu tylko tę część,
// która ma się chować.
//
// Na desktopie komponent jest przezroczysty - renderuje dzieci bez zmian.
// ================================

import { useState } from 'react';
import { Box, IconButton, Popover, Tooltip } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

export default function ToolbarOverflow({ isMobile, children, accentColor }) {
  const [anchorEl, setAnchorEl] = useState(null);

  if (!isMobile) return <>{children}</>;

  return (
    <>
      <Tooltip title="Więcej narzędzi" arrow>
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Więcej narzędzi"
          sx={{ minWidth: 36, minHeight: 36, borderRadius: 0, color: 'inherit', flexShrink: 0 }}
        >
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 0.5,
              borderRadius: 0,
              border: `1px solid ${accentColor}`,
              // Zmieszczenie kilkunastu przycisków w siatce zamiast jednego
              // długiego rzędu - inaczej menu samo wymagałoby przewijania.
              maxWidth: 'min(92vw, 320px)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
          {children}
        </Box>
      </Popover>
    </>
  );
}
