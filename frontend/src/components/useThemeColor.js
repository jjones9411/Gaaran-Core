// Kolory motywu (akcent, tekst, tło) ustawiane w kreatorze instalacyjnym
// (game_config.theme_primary_color / theme_text_color / theme_background_color)
// - pobierane raz z /api/game-info. Woła applyThemeColors() od razu po
// otrzymaniu odpowiedzi, żeby appColors (uzywany bezposrednio przez wiele
// ekranow spoza MUI theme) zaktualizowal sie zanim te ekrany wyrenderuja
// sie z nowymi kolorami.
import { useState, useEffect } from 'react';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
} from './theme';

export default function useThemeColors() {
  const [colors, setColors] = useState({
    primaryColor: DEFAULT_PRIMARY_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
  });

  useEffect(() => {
    fetch('/api/game-info')
      .then(res => res.json())
      .then(data => {
        setColors({
          primaryColor: data.themeColor || DEFAULT_PRIMARY_COLOR,
          textColor: data.textColor || DEFAULT_TEXT_COLOR,
          backgroundColor: data.backgroundColor || DEFAULT_BACKGROUND_COLOR,
        });
        // Uwaga: applyThemeColors() woła teraz ColorModeProvider z akcentem rasy
        // (albo fallbackiem z kreatora), zeby nie nadpisywac koloru rasy.
      })
      .catch(err => console.error('Błąd pobierania kolorów motywu:', err));
  }, []);

  return colors;
}
