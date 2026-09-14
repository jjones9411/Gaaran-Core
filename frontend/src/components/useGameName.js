// Nazwa gry ustawiana w kreatorze instalacyjnym (game_config.game_name) -
// pobierana raz z /api/game-info, z rozsądnym fallbackiem gdy jeszcze
// nieustawiona.
import { useState, useEffect } from 'react';

export default function useGameName(fallback = '[NAZWA_GRY]') {
  const [gameName, setGameName] = useState(fallback);

  useEffect(() => {
    fetch('/api/game-info')
      .then(res => res.json())
      .then(data => {
        if (data.gameName) setGameName(data.gameName);
      })
      .catch(err => console.error('Błąd pobierania nazwy gry:', err));
  }, []);

  return gameName;
}
