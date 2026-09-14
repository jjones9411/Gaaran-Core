// ================================
// EditorResizeHandle.js
// Pasek nad edytorem wiadomości: uchwyt do przeciągania wysokości + przycisk
// zwijania. Świadomie łączymy jedno z drugim w JEDNYM wierszu - wcześniej sam
// przycisk zwijania zajmował osobny rząd z marginesem, a uchwytu nie było
// wcale, więc ta wersja daje więcej możliwości przy mniejszej zajętości pionu.
//
// touchAction: 'none' jest tu konieczne: bez tego przeglądarka traktuje ruch
// palcem po uchwycie jako przewijanie strony i przeciąganie nie działa (albo
// walczy ze scrollem).
// ================================

import { Box, IconButton, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function EditorResizeHandle({
  resizeHandleProps,
  isResizing = false,
  onCollapse = null,
  accentColor,
  compact = false,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
        height: compact ? 20 : 24,
        px: 1,
      }}
    >
      {/* Strefa chwytu - rozciągnięta na całą szerokość paska, żeby trafienie
          palcem nie wymagało celowania w sam wizualny "grip". */}
      <Box
        {...resizeHandleProps}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Zmień wysokość edytora"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'ns-resize',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 4,
            borderRadius: 2,
            backgroundColor: accentColor,
            opacity: isResizing ? 0.95 : 0.45,
            transition: 'opacity 0.15s ease',
          }}
        />
      </Box>

      {onCollapse && (
        <Tooltip title="Zwiń edytor">
          <IconButton
            size="small"
            onClick={onCollapse}
            aria-label="Zwiń edytor"
            sx={{
              position: 'absolute',
              right: 4,
              p: 0.25,
              color: accentColor,
              // Nad strefą chwytu, inaczej przeciąganie przechwyciłoby klik.
              zIndex: 1,
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
