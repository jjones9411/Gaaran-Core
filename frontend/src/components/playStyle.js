// Wspólne definicje stylu gry postaci (fabularnie / mechanicznie / oba).
// Jedno źródło prawdy - używane w Settings, OnlineList, Profile, sesjach.
// Wartości klucza muszą zgadzać się z backendem (onlineUsers.js walidacja
// i kolumna characters.play_style).

export const PLAY_STYLE_OPTIONS = {
  fabularnie: {
    label: 'Fabularnie',
    short: 'Fabularnie',
    color: '#9c6ade',
    description: 'Gram głównie fabularnie (RP), mechanika drugoplanowo',
  },
  mechanicznie: {
    label: 'Mechanicznie',
    short: 'Mechanicznie',
    color: '#c0562f',
    description: 'Gram głównie mechanicznie (walka, rozwój, ekonomia)',
  },
  oba: {
    label: 'Fabularnie i mechanicznie',
    short: 'Fabularnie i mechanicznie',
    color: '#8a6628',
    description: 'Łączę fabułę i mechanikę',
  },
};

export const getPlayStyle = (key) => PLAY_STYLE_OPTIONS[key] || PLAY_STYLE_OPTIONS.oba;

// Sam klucz po normalizacji - postacie sprzed migracji mają play_style = NULL,
// a getPlayStyle pokazuje im etykietę 'oba'. Kto decyduje na podstawie klucza
// (np. czy pokazać podgląd statystyk), musi robić DOKŁADNIE ten sam fallback,
// inaczej etykieta mówi jedno, a zachowanie robi drugie.
export const getPlayStyleKey = (key) => (PLAY_STYLE_OPTIONS[key] ? key : 'oba');
