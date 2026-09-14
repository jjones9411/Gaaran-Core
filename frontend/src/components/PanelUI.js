import { Box, Typography } from '@mui/material';
import { appColors } from './theme';

// Wspólny "szkielet" wizualny dla stron-encyklopedii (Bestiariusz, Prawo, Mechanika,
// Technologie, Używki, NPC, strony rasy, ...), żeby wyglądały tak samo jak reszta
// gry (np. Sesje Prywatne) zamiast domyślnego, wyśrodkowanego układu MUI Container/Card.

export const PanelPage = ({ children, sx = {} }) => (
  <Box sx={{ width: '100%', px: { xs: 2, sm: 3 }, py: 3, ...sx }}>
    {children}
  </Box>
);

export const PanelHeader = ({ eyebrow, title, theme, action }) => (
  <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
    <Box>
      {eyebrow && (
        <Typography sx={{
          color: appColors.textMuted,
          fontSize: '0.65rem',
          letterSpacing: '0.22em',
          
          mb: 0.25,
        }}>
          {eyebrow}
        </Typography>
      )}
      <Typography variant="h4" sx={{
        color: appColors.textLight,
        
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}>
        <Box component="span" sx={{ color: theme.palette.primary.main, opacity: 0.7 }}>{'>'}</Box>
        {title}
      </Typography>
    </Box>
    {action}
  </Box>
);

export const panelAddButtonSx = (theme) => ({
  color: appColors.textLight,
  border: `2px solid ${theme.palette.primary.main}`,
  borderRadius: 0,
  bgcolor: 'transparent',
  
  letterSpacing: '0.1em',
  fontSize: '0.85rem',
  fontWeight: 'bold',
  px: 2.5,
  py: 0.75,
  mb: 3,
  boxShadow: `0 0 8px ${theme.palette.primary.main}30`,
  '&:hover': {
    bgcolor: `${theme.palette.primary.main}18`,
    boxShadow: `0 0 16px ${theme.palette.primary.main}50`,
  },
});

export const panelRowSx = (theme, extra = {}) => ({
  mb: 1.5,
  cursor: 'pointer',
  border: `1px solid ${appColors.borderSteel}`,
  borderLeft: `3px solid ${theme.palette.primary.main}`,
  borderRadius: 0,
  backgroundColor: appColors.bgDeep,
  backgroundImage: 'none',
  boxShadow: 'none',
  transition: 'all 0.25s ease',
  '&:hover': {
    boxShadow: `0 0 16px ${theme.palette.primary.main}30`,
    backgroundColor: appColors.bgSurface,
  },
  ...extra,
});

// ===========================================================================
// SEKCJE PANELU (panel admina i podobne ekrany "narzędziowe")
// ===========================================================================
// Jeden wygląd dla wszystkich sekcji zamiast osobnego koloru MUI na każdą
// (info/success/warning/secondary...), bo tęcza domyślnych barw MUI nie trzyma
// stonowanej palety gry. Kolor niesie tu JEDNĄ informację: czy sekcja jest
// groźna. Zwykłe = akcent rasy, `danger` = czerwień.

// Czerwień czytelna jako TEKST na ciemnym tle. appColors.dangerText (#9b2c2c)
// ma na #151515 kontrast 2.4 - nadaje się na obwódki i wypełnienia, ale nie na
// litery. Ten odcień ma 5.65 i wciąż jest przygaszony, nie neonowy.
export const dangerTextReadable = '#d97070';

export const panelSectionSx = (theme, { danger = false } = {}) => ({
  mb: 3,
  p: { xs: 2, sm: 2.5 },
  border: `1px solid ${danger ? appColors.dangerBorder : appColors.borderSteel}`,
  borderLeft: `3px solid ${danger ? appColors.dangerText : theme.palette.primary.main}`,
  borderRadius: 0,
  backgroundColor: appColors.bgDeep,
  // Strefa groźna dostaje dodatkowo delikatne, krwiste przemycie - widać ją
  // na pierwszy rzut oka przy skrolowaniu, bez krzyczenia kolorem.
  backgroundImage: danger
    ? `linear-gradient(135deg, ${appColors.dangerDark}55 0%, ${appColors.bgDeep} 60%)`
    : 'none',
  boxShadow: danger ? `inset 0 0 24px ${appColors.dangerDark}40` : 'none',
});

// Nagłówek sekcji: nadkreślenie (eyebrow) + znacznik ">" + tytuł kapitalikami,
// czyli ten sam rytm co PanelHeader na stronach-encyklopediach.
export const PanelSectionHeading = ({ icon, eyebrow, title, theme, danger = false, action }) => {
  const accent = danger ? dangerTextReadable : theme.palette.primary.main;
  return (
    <Box sx={{
      mb: 2,
      pb: 1.25,
      borderBottom: `1px solid ${danger ? appColors.dangerBorder : appColors.borderSteel}`,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 1.5,
    }}>
      <Box>
        {eyebrow && (
          <Typography sx={{
            color: danger ? dangerTextReadable : appColors.steel,
            fontSize: '0.65rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            mb: 0.25,
          }}>
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h5" sx={{
          color: danger ? dangerTextReadable : appColors.textLight,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}>
          <Box component="span" sx={{ color: accent, opacity: 0.7 }}>{'>'}</Box>
          {icon && (
            <Box component="span" sx={{
              display: 'flex',
              // Globalny styl nadaje .MuiSvgIcon-root stalowy kolor - tu chcemy
              // ikonę w kolorze sekcji, więc nadpisujemy jawnie.
              '& .MuiSvgIcon-root': { color: accent, fontSize: '1.3rem' },
            }}>
              {icon}
            </Box>
          )}
          {title}
        </Typography>
      </Box>
      {action}
    </Box>
  );
};

// Zwinięty wiersz (Accordion) wewnątrz sekcji - spójny z panelRowSx.
export const panelAccordionSx = (theme, { danger = false } = {}) => ({
  mb: 1.5,
  border: `1px solid ${danger ? appColors.dangerBorder : appColors.borderSteel}`,
  borderLeft: `3px solid ${danger ? appColors.dangerText : theme.palette.primary.main}`,
  borderRadius: '0 !important',
  backgroundColor: appColors.bgSurface,
  backgroundImage: 'none',
  boxShadow: 'none',
  transition: 'all 0.25s ease',
  '&:before': { display: 'none' },
  '&.Mui-expanded': { margin: '0 0 12px 0' },
  '&:hover': {
    boxShadow: `0 0 16px ${danger ? `${appColors.dangerText}40` : `${theme.palette.primary.main}30`}`,
  },
  '& .MuiAccordionSummary-root': { minHeight: 52 },
  '& .MuiAccordionSummary-expandIconWrapper .MuiSvgIcon-root': {
    color: danger ? dangerTextReadable : theme.palette.primary.main,
  },
});
