import { Box } from '@mui/material';
import { appColors, NOISE_SVG_URL } from './theme';

// Statyczne tło ekranów logowania/rejestracji/resetu hasła.
// Ta sama grafika co na Home.js - spójność z resztą aplikacji, bez animowanego canvasu.
// Wartość jest KOMPLETNA (zawiera już `url(...)` albo `image-set(...)`), więc
// wstawiamy ją wprost w `background-image` - patrz `--game-bg-image` w theme.js.
const AUTH_BG_IMAGE = 'var(--game-bg-image)';

const AuthBackdrop = () => {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Box sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      {/* Zdjęcie tła - zniszczony, zarośnięty świat po Upadku */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: AUTH_BG_IMAGE,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: { xs: 'scroll', md: 'fixed' },
        filter: 'saturate(0.9) brightness(0.85) contrast(1.03)',
      }} />

      {/* Przyciemnienie dla czytelności formularza - lżejsze, żeby grafika
          w tle była widoczna (panele i tak mają własne, ciemne tło) */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, rgba(10,11,13,0.30) 0%, rgba(7,8,10,0.62) 65%, rgba(4,5,6,0.82) 100%)`,
      }} />

      {/* Winieta rdzy w rogach */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, rgba(122,59,15,0.12) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.5) 100%)`,
      }} />

      {/* Ziarno / szum - statyczny, bez animacji */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: NOISE_SVG_URL,
        opacity: 0.08,
        mixBlendMode: 'overlay',
      }} />

      {/* Pojedyncza, nieruchoma linia skanera - ślad "systemu", nie efekt */}
      {!prefersReducedMotion && (
        <Box sx={{
          position: 'absolute',
          top: '42%',
          left: 0,
          right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent 5%, ${appColors.rustLight}40 50%, transparent 95%)`,
        }} />
      )}
    </Box>
  );
};

export default AuthBackdrop;
