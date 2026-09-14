import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

/**
 * Safely decodes a JWT token and returns the payload
 * @param {string} token - JWT token string
 * @returns {object|null} Decoded payload or null if invalid
 */
export const decodeJwtPayload = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }
    return jwtDecode(token);
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
};

/**
 * Gets user role from JWT token
 * @param {string} token - JWT token string (optional, reads from localStorage if not provided)
 * @returns {string} User role or 'mieszkaniec' as default
 */
export const getUserRole = (token = null) => {
  try {
    const jwt = token || localStorage.getItem('token');
    const payload = decodeJwtPayload(jwt);
    return payload?.role || 'mieszkaniec';
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'mieszkaniec';
  }
};

/**
 * Gets the currently active character (id/name/avatar) from JWT token,
 * falling back to localStorage for older sessions/data shapes.
 * Single source of truth - was previously copy-pasted in ~10 components.
 * @returns {{id: number, name: string, avatar: string|null}|null}
 */
export const getCurrentCharacter = () => {
  try {
    // Najpierw sprawdź JWT token (najbezpieczniejsze źródło)
    const token = localStorage.getItem('token');
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && payload.characterId) {
        return {
          id: payload.characterId,
          name: payload.characterName || 'Postać',
          avatar: payload.characterAvatar || null,
          characterFaction: payload.characterFaction || null,
          characterRace: payload.characterRace || null
        };
      }
    }

    // Fallback - selectedCharacterId (nowy system)
    const selectedCharacterId = localStorage.getItem('selectedCharacterId');
    if (selectedCharacterId) {
      return { id: parseInt(selectedCharacterId), name: 'Postać', avatar: null };
    }

    // Fallback - activeCharacterData (starszy system)
    const activeData = localStorage.getItem('activeCharacterData');
    if (activeData) {
      const data = JSON.parse(activeData);
      return { id: data.id, name: data.name, avatar: data.avatar };
    }
  } catch (e) {
    console.error('Error getting current character:', e);
  }

  // Fallback - pojedyncze pola z localStorage
  const activeCharacterId = localStorage.getItem('activeCharacterId');
  const activeCharacterName = localStorage.getItem('activeCharacterName');

  if (activeCharacterId) {
    return { id: parseInt(activeCharacterId), name: activeCharacterName || 'Postać', avatar: null };
  }
  return null;
};

/**
 * Formats role name for display (replaces underscores with spaces and capitalizes)
 * @param {string} role - Raw role string from database
 * @returns {string} Formatted role name for display
 */
export const formatRoleForDisplay = (role) => {
  const roleFormatMap = {
    'mieszkaniec': 'Mieszkaniec',
    'zasluzony': 'Zasłużony',
    'karczmarz': 'Karczmarz',
    'mistrz_gry': 'Mistrz Gry',
    'admin': 'Administrator'
  };
  return roleFormatMap[role] || role;
};

/**
 * Role ZWYKŁEGO GRACZA - bez żadnych uprawnień w grze.
 *
 * `zasluzony` to wyłącznie odznaczenie za wkład w tworzenie gry: zmienia
 * podpis rangi i daje medal przy awatarze, ale w kwestii dostępu jest
 * dokładnie tym samym co `mieszkaniec`. Kontrole uprawnień są allowlistami
 * ('admin'/'mistrz_gry'/'karczmarz'), więc ta rola nigdzie nie przechodzi -
 * ALE tam, gdzie rolę testuje się POZYTYWNIE przeciwko 'mieszkaniec'
 * (blokada gry dla mieszkańców), trzeba użyć tego helpera. Inaczej nadanie
 * medalu po cichu zdjęłoby graczowi blokadę, czyli dałoby przywilej.
 */
export const PLAYER_ROLES = ['mieszkaniec', 'zasluzony'];

export const isRegularPlayer = (role) => PLAYER_ROLES.includes(role);

/**
 * Czy bieżący token to token trybu NPC (admin gra ze wspólnego subkonta NPC).
 * Czytane z tokena, bo komponenty poza AuthProviderem też o to pytają.
 * @param {string} [token]
 * @returns {boolean}
 */
export const isNpcMode = (token = null) => {
  const payload = decodeJwtPayload(token || localStorage.getItem('token'));
  return Boolean(payload?.npcAccount);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // ❌ USUŃ: const navigate = useNavigate();

  const loadUserFromToken = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const decoded = decodeJwtPayload(token);
      if (!decoded) {
        console.warn('⚠️ Nie można zdekodować tokena');
        logout();
        return;
      }

      // Sprawdź wygaśnięcie
      if (decoded.exp * 1000 < Date.now()) {
        console.warn('⚠️ Token wygasł');
        logout();
        return;
      }

      // Wszystkie dane z tokena
      setUser({
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role,
        characterId: decoded.characterId || null,
        characterName: decoded.characterName || null,
        characterAvatar: decoded.characterAvatar || null,
        characterRace: decoded.characterRace || null,
        characterGender: decoded.characterGender || null,
        characterFaction: decoded.characterFaction || null,
        characterLevel: decoded.characterLevel || 1,
        // Tryb NPC: admin gra ze wspólnego subkonta postaci NPC. `npcOwnerName`
        // to nazwa konta admina, na które wraca przyciskiem powrotu.
        npcMode: Boolean(decoded.npcAccount),
        npcOwnerId: decoded.npcOwnerId || null,
        npcOwnerName: decoded.npcOwnerName || null
      });

      setLoading(false);
    } catch (error) {
      console.error('❌ Błąd ładowania tokena:', error);
      logout();
    }
  };

  useEffect(() => {
    loadUserFromToken();

    // Sprawdzaj token co 5 minut
    const interval = setInterval(() => {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded = decodeJwtPayload(token);
        if (decoded) {
          const timeLeft = decoded.exp * 1000 - Date.now();

          // Jeśli zostało mniej niż 10 minut, odśwież token
          if (timeLeft < 10 * 60 * 1000 && timeLeft > 0) {
            refreshToken();
          } else if (timeLeft <= 0) {
            logout();
          }
        } else {
          logout();
        }
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    loadUserFromToken();
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    window.location.href = '/login'; // ZMIENIONE z navigate('/login')
  };

  const updateCharacter = (token) => {
    // Po zmianie postaci frontend dostaje nowy token
    localStorage.setItem('token', token);
    loadUserFromToken();
  };

  const refreshToken = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        login(data.token);
      } else {
        logout();
      }
    } catch (error) {
      console.error('❌ Błąd odświeżania tokena:', error);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateCharacter, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};