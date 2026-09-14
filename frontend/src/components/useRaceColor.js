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

  // Kolor akcentu bierzemy z KOLORU RASY ustawionego w panelu administracyjnym
  // (races.color). Gdy rasy jeszcze nie znamy (ekrany przed grą) albo nie ma
  // ustawionego koloru, zostaje domyślny akcent motywu.
  const HEX6 = /^#[0-9a-fA-F]{6}$/;
  const DEFAULT_ACCENT_HEX = '#7a3b0f';
  const raceHex = HEX6.test(race?.color || '') ? race.color : DEFAULT_ACCENT_HEX;
  const colorSet = getRaceColorSet(raceHex);

  return {
    key: raceKey,
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
