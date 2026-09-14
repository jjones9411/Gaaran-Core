// ================================================================
// RaceDivider - ozdobna linia rozdzielająca w kolorze RASY.
//
// Dwa warianty grafiki (w /ui/dividers): 'top' (z symbolem na środku) i
// 'bottom' (sama linia, bez symbolu). Kolor/wariant wg rasy - domyślnie rasy
// biezacej postaci (useRaceColor), albo jawnie przez prop `frame`
// (np. w Cmentarzu: linia w kolorze rasy KAŻDEJ martwej postaci osobno).
//
// - BOTTOM: sama nitka, rozciągana na całą szerokość (100% 100%). Brak symbolu,
//   więc rozciąganie w poziomie jest niewidoczne.
// - TOP: ma symbol na środku, więc NIE wolno go rozciągać w pionie. Używamy
//   aspect-ratio (proporcje grafiki), więc wysokość sama skaluje się do szerokości
//   i symbol zostaje okrągły przy każdej szerokości kontenera.
// ================================================================
import { Box } from '@mui/material';
import useRaceColor from './useRaceColor';

const FRAMES = new Set(['human', 'wolf', 'vampire']);
// Proporcje grafik TOP (szerokość / wysokość) - żeby zachować okrągły symbol.
const TOP_AR = { human: '1080 / 87', wolf: '1124 / 82', vampire: '1148 / 94' };

export default function RaceDivider({ variant = 'bottom', frame, height, sx }) {
  const race = useRaceColor();
  const f = FRAMES.has(frame) ? frame : (race.frame || 'human');
  const v = variant === 'top' ? 'top' : 'bottom';

  const common = {
    width: '100%',
    flexShrink: 0,
    pointerEvents: 'none',
    backgroundImage: `url(/ui/dividers/${v}-${f}.png)`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  };

  if (v === 'top') {
    // aspect-ratio zamiast stałej wysokości -> brak rozciągania w pionie, symbol okrągły.
    return (
      <Box aria-hidden sx={{ ...common, aspectRatio: TOP_AR[f], backgroundSize: 'contain', ...sx }} />
    );
  }
  // BOTTOM: cienka linia rozciągnięta na całą szerokość.
  return (
    <Box aria-hidden sx={{ ...common, height: height != null ? height : 22, backgroundSize: '100% 100%', ...sx }} />
  );
}
