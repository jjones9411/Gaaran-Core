// ================================
// EditorCollapsedBar.js
// Zwinięty edytor na mobile: jeden pasek "Napisz wiadomość...", który po
// dotknięciu rozwija edytor i od razu ustawia w nim kursor.
//
// Po co: na telefonie rozwinięty edytor zajmował na stałe ~200 px dołu ekranu
// (pasek narzędzi + minimalna wysokość pola), nawet gdy gracz tylko CZYTAŁ
// sesję. Przy widocznym obszarze ~700 px zostawało to około połowy ekranu na
// treść. Zwinięcie oddaje ten pas z powrotem tekstowi, a koszt to jedno
// dodatkowe dotknięcie w momencie, gdy gracz faktycznie chce pisać.
// ================================

import { Box } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';

export default function EditorCollapsedBar({ onExpand, accentColor, label = 'Napisz wiadomość...' }) {
  return (
    <Box
      onClick={onExpand}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand();
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        // 44 px = minimalny sensowny cel dotykowy.
        minHeight: 44,
        px: 1.5,
        cursor: 'pointer',
        flexShrink: 0,
        color: accentColor,
        fontSize: '0.85rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        opacity: 0.85,
        WebkitTapHighlightColor: 'transparent',
        '&:active': { opacity: 1 },
      }}
    >
      <EditNoteIcon fontSize="small" />
      {label}
    </Box>
  );
}
