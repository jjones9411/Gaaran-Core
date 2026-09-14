import { useState, useEffect } from 'react';
import { Avatar, Tooltip, useMediaQuery, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const AvatarComponent = () => {
  const [avatarUrl, setAvatarUrl] = useState('');
  const [userName, setUserName] = useState('');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate(); // Hook do nawigacji
  const { user } = useAuth();
  // Trasa i endpoint profilu przyjmują ID POSTACI, a nie użytkownika. Wcześniej
  // szło tu localStorage 'userId', które od przeniesienia danych do JWT nie jest
  // już zapisywane (zawsze null) - avatar zawsze pokazywał "Nieznany użytkownik",
  // a kliknięcie w niego nic nie robiło.
  const characterId = user?.characterId;

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('token');

      if (!token || !characterId) {
        setAvatarUrl('/default-avatar.png');
        setUserName('Nieznany użytkownik');
        return;
      }

      try {
        const response = await fetch(`/api/home/profile/${characterId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const profileData = await response.json();

        if (response.ok) {
          setAvatarUrl(`/api${profileData.profileData.avatar}`);
          setUserName(profileData.profileData.userName);
        } else {
          setAvatarUrl('/default-avatar.png');
          setUserName('Nieznany użytkownik');
        }
      } catch {
        setAvatarUrl('/default-avatar.png');
        setUserName('Nieznany użytkownik');
      }
    };

    fetchUserProfile();
    // characterId pochodzi z kontekstu i na pierwszym renderze bywa jeszcze null,
    // więc efekt musi się powtórzyć po załadowaniu tokena.
  }, [characterId]);

  // Funkcja obsługująca kliknięcie na avatar, przekierowująca na profil
  const handleAvatarClick = () => {
    if (characterId) {
      navigate(`/home/profile/${characterId}`);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#191919',
        borderRadius: '50%',
        padding: '4px',
        border: '3px solid #8c4a2f',
        width: isMobile ? 74 : 106, // Avatar + padding + border
        height: isMobile ? 74 : 106,
      }}
    >
      <Tooltip title={userName}>
        <Avatar
          src={avatarUrl || '/default-avatar.png'}
          alt={userName}
          sx={{
            width: isMobile ? 70 : 150,
            height: isMobile ? 70 : 150,
            cursor: 'pointer',
          }}
          onClick={handleAvatarClick} // Dodanie obsługi kliknięcia
        />
      </Tooltip>
    </Box>
  );
};

export default AvatarComponent;
