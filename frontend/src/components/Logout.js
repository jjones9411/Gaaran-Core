import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GENERAL_SESSIONS_SEEN_MAP_KEY = 'generalSessions_seenMap';
const PRIVATE_SESSIONS_SEEN_MAP_KEY = 'privateSessions_seenMap';
const MESSAGES_SEEN_MAP_KEY = 'messages_seenMap';

const Logout = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const performLogout = async () => {
      try {
        const token = localStorage.getItem('token');

        if (token) {
          // Wywołaj API logout (dezaktywacja postaci na backendzie)
          try {
            await fetch('/api/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
          } catch (apiError) {
            // Ignoruj błędy API - wylogowanie lokalne i tak się wykona
            console.warn('Błąd API logout (ignorowany):', apiError);
          }
        }

        // Wyczyść specyficzne klucze powiadomień
        localStorage.removeItem(GENERAL_SESSIONS_SEEN_MAP_KEY);
        localStorage.removeItem(PRIVATE_SESSIONS_SEEN_MAP_KEY);
        localStorage.removeItem(MESSAGES_SEEN_MAP_KEY);

        // Wyczyść resztę danych (token, dane użytkownika itp.)
        localStorage.clear();

        // Przekieruj na stronę logowania
        navigate('/login');
      } catch (err) {
        console.error('Błąd podczas wylogowania:', err);
        setError('Wystąpił błąd podczas wylogowania');

        // Mimo błędu, wyczyść localStorage i przekieruj
        localStorage.clear();
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    performLogout();
  }, [navigate]);

  return (
    <div style={{ textAlign: 'center', marginTop: '20%' }}>
      <h2>Wylogowano pomyślnie</h2>
      {error ? (
        <p style={{ color: 'orange' }}>{error}</p>
      ) : (
        <p>Za chwilę zostaniesz przekierowany na stronę logowania...</p>
      )}
    </div>
  );
};

export default Logout;
