// ================================================================
// useRaceColor - zestaw kolorow akcentu bazujacy na RASIE biezacej postaci.
//
// Podstrony /city (i inne ekrany gry) powinny brac akcent z koloru rasy gracza,
// a nie z surowego motywu - dzieki temu kazda rasa ma spojny, czytelny akcent,
// a nie "za kolorowe" tla. Zwracany `accent` jest rozjasniany do minimalnego
// kontrastu WCAG na ciemnym tle gry (patrz getRaceColorSet w theme.js), wiec
// nadaje sie zarowno na tekst, jak i na obwodki/tla z ciemnym contrastText.
//
// Zwraca: { key, hex, accent, soft, light, border, contrastText, loading }
// - hex        : surowy kolor rasy (do teł/obwódek/poświaty)
// - accent     : czytelny na ciemnym tle wariant (do TEKSTU/etykiet)
// - contrastText: ciemny tekst na wypełnieniu `accent`
// ================================================================
import { useState, useEffect } from 'react';
import { getRaceColorSet } from './theme';
import { getCurrentCharacter } from './AuthContext';

// Prosty cache na poziomie modulu - lista ras zmienia sie rzadko, a hook
// bywa uzywany na wielu podstronach naraz. Unikamy wielu rownoleglych fetchy.
let cachedRaces = null;
let racesPromise = null;

function fetchRacesOnce() {
  if (cachedRaces) return Promise.resolve(cachedRaces);
  if (racesPromise) return racesPromise;
  racesPromise = fetch('/api/races?includeInactive=1')
    .then((res) => res.json())
    .then((data) => {
      cachedRaces = Array.isArray(data) ? data : [];
      return cachedRaces;
    })
    .catch(() => {
      racesPromise = null;
      return [];
    });
  return racesPromise;
}

export default function useRaceColor(explicitRaceKey = null) {
  const [races, setRaces] = useState(cachedRaces || []);
  const [loading, setLoading] = useState(!cachedRaces);

  useEffect(() => {
    let alive = true;
    if (cachedRaces) {
      setRaces(cachedRaces);
      setLoading(false);
      return () => { alive = false; };
    }
    fetchRacesOnce().then((list) => {
      if (!alive) return;
      setRaces(list);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Klucz rasy: jawnie podany albo z tokena biezacej postaci (faction = klucz rasy).
  let raceKey = explicitRaceKey;
  if (!raceKey) {
    const current = getCurrentCharacter();
    raceKey = current?.characterFaction || current?.characterRace || null;
  }

  const race = races.find((r) => r.key === raceKey);

  // Wariant ramki (grafiki w /ui/frames) wg rasy - rozpoznajemy po nazwie/kluczu.
  const nm = `${race?.name || ''} ${raceKey || ''}`.toLowerCase();
  let frame = 'human';
  if (/wampir|vampire|vamp/.test(nm)) frame = 'vampire';
  else if (/wilko|wilk|wolf|lykan|lycan/.test(nm)) frame = 'wolf';
  else frame = 'human';

  // Kolor akcentu bierzemy z KOLORU RASY ustawionego w panelu (baza), a gdy go brak
  // - z domyślnego koloru danej rasy (te same wartości co w kreatorze). Dzięki temu
  // motyw (primary.*), hovery i obwódki pasują do koloru rasy zamiast pomarańczu.
  // Przygaszone kolory bazowe (Główny) dla trójki kanonicznej - używane też jako
  // fallback zanim lista ras się załaduje. Rasy kanoniczne i tak biorą pełną,
  // kuratorowaną paletę z getRaceColorSet (po nazwie/kluczu).
  const HEX6 = /^#[0-9a-fA-F]{6}$/;
  const FRAME_ACCENT_HEX = { human: '#63571D', wolf: '#1c321a', vampire: '#999999' };
  const raceHex = HEX6.test(race?.color || '') ? race.color : FRAME_ACCENT_HEX[frame];
  // Bez rasy (ekrany przed grą: login/rejestracja/reset) używamy kanonicznej
  // palety wg `frame` (domyślnie 'human'), zamiast wpadać w wyliczaną paletę z
  // DB-pomarańczu - dzięki temu auth jest spójnie w kolorach człowieka.
  const colorSet = getRaceColorSet(raceHex, { name: race?.name || frame, key: raceKey || frame });

  return {
    key: raceKey,
    frame,
    hex: colorSet.primary,
    accent: colorSet.accent,
    strong: colorSet.strong,
    frameGlow: colorSet.frameGlow || colorSet.strong,
    hover: colorSet.hover,
    soft: colorSet.soft,
    light: colorSet.light,
    border: colorSet.border,
    contrastText: colorSet.contrastText,
    loading,
  };
}
