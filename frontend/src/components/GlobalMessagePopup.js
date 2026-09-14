import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';

const GlobalMessagePopup = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [open, setOpen] = useState(false);

  // Funkcja do pobierania nieprzeczytanych wiadomości
  const fetchUnreadMessages = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/global-notifications/unread', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const responseText = await response.text();
        
        try {
          const data = JSON.parse(responseText);

          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            setCurrentMessageIndex(0);
            setOpen(true);
          }
        } catch (parseError) {
          console.error('Błąd parsowania JSON:', parseError);
          console.error('Response text:', responseText);
        }
      } else {
        console.error('Błąd response:', await response.text());
      }
    } catch (error) {
      console.error('Błąd pobierania wiadomości globalnych:', error);
    }
  };

  // Funkcja do oznaczania wiadomości jako przeczytaną
  const markAsRead = async (messageId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/global-notifications/mark-read/${messageId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Błąd oznaczania jako przeczytane:', await response.text());
      }
    } catch (error) {
      console.error('Błąd oznaczania wiadomości jako przeczytaną:', error);
    }
  };

  // Obsługa zamknięcia obecnej wiadomości
  const handleClose = async () => {
    if (messages.length > 0) {
      const currentMessage = messages[currentMessageIndex];
      await markAsRead(currentMessage.id);

      // Jeśli są jeszcze wiadomości, pokaż następną
      if (currentMessageIndex + 1 < messages.length) {
        setCurrentMessageIndex(currentMessageIndex + 1);
      } else {
        // Jeśli to była ostatnia wiadomość, zamknij popup
        setOpen(false);
        setMessages([]);
        setCurrentMessageIndex(0);
      }
    }
  };

  // Obsługa zamknięcia wszystkich wiadomości
  const handleCloseAll = async () => {
    // Oznacz wszystkie pozostałe wiadomości jako przeczytane
    const remainingMessages = messages.slice(currentMessageIndex);
    for (const message of remainingMessages) {
      await markAsRead(message.id);
    }
    
    setOpen(false);
    setMessages([]);
    setCurrentMessageIndex(0);
  };

  // Pobierz wiadomości przy montowaniu komponentu
  useEffect(() => {
    fetchUnreadMessages();
  }, []);

  // Sprawdzaj co 30 sekund czy są nowe wiadomości
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnreadMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Sprawdzanie wiadomości przy zmianie tokenu (nowe logowanie)
  useEffect(() => {
    const handleStorageChange = () => {
      fetchUnreadMessages();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (!open || messages.length === 0) {
    return null;
  }

  const currentMessage = messages[currentMessageIndex];

  const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.3s ease-in-out',
  };

  const dialogStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `3px solid ${theme.palette.text.secondary}`,
    borderRadius: '0',
    maxWidth: '700px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: `
      0 0 30px rgba(113, 128, 150, 0.4),
      inset 0 0 50px rgba(0, 0, 0, 0.5)
    `,
    animation: 'slideIn 0.4s ease-out',
    position: 'relative',
  };

  const scanlineOverlay = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: `linear-gradient(90deg, transparent, ${theme.palette.text.secondary}, transparent)`,
    animation: 'scan 3s linear infinite',
    pointerEvents: 'none',
    zIndex: 1,
  };

  const headerStyle = {
    backgroundColor: 'rgba(113, 128, 150, 0.2)',
    borderBottom: `2px solid ${theme.palette.text.secondary}`,
    color: theme.palette.text.primary,
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    
    fontWeight: 'bold',
    fontSize: '1.2rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    textShadow: '0 0 10px rgba(113, 128, 150, 0.5)',
    position: 'relative',
    zIndex: 2,
  };

  const contentStyle = {
    padding: '24px',
    color: theme.palette.text.primary,
    maxHeight: '55vh',
    overflowY: 'auto',
    
    fontSize: '1rem',
    lineHeight: 1.8,
    position: 'relative',
    zIndex: 2,
    scrollbarWidth: 'thin',
    scrollbarColor: `${theme.palette.divider} ${theme.palette.background.paper}`,
  };

  const footerStyle = {
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    borderTop: `2px solid ${theme.palette.text.secondary}`,
    backgroundColor: 'rgba(113, 128, 150, 0.1)',
    position: 'relative',
    zIndex: 2,
  };

  const buttonStyle = {
    padding: '12px 24px',
    border: `2px solid ${theme.palette.divider}`,
    borderRadius: '0',
    cursor: 'pointer',
    fontWeight: 'bold',
    
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: theme.palette.text.secondary,
    color: theme.palette.background.default,
    border: `2px solid ${theme.palette.divider}`,
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: theme.palette.text.secondary,
    border: `2px solid ${theme.palette.text.secondary}`,
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideIn {
            from { 
              transform: translateY(-50px);
              opacity: 0;
            }
            to { 
              transform: translateY(0);
              opacity: 1;
            }
          }
          
          @keyframes scan {
            0% { top: 0; }
            100% { top: 100%; }
          }
        `}
      </style>
      
      <div style={modalStyle} onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div style={dialogStyle}>
          <div style={scanlineOverlay}></div>
          
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ 
                fontSize: '1.5rem',
                filter: 'drop-shadow(0 0 5px rgba(113, 128, 150, 0.5))'
              }}>📢</span>
              <span>{currentMessage.title}</span>
            </div>
            <span style={{ 
              fontSize: '0.75rem', 
              opacity: 0.7,
              backgroundColor: 'rgba(113, 128, 150, 0.2)',
              padding: '4px 12px',
              border: `1px solid ${theme.palette.divider}`,
            }}>
              [ {currentMessageIndex + 1} / {messages.length} ]
            </span>
          </div>

          <div style={contentStyle}>
            <div style={{ 
              whiteSpace: 'pre-wrap',
              marginBottom: '20px',
              backgroundColor: 'rgba(113, 128, 150, 0.05)',
              border: '1px solid rgba(113, 128, 150, 0.2)',
              padding: '16px',
              boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)',
            }}>
              {currentMessage.content}
            </div>
            
            <div style={{ 
              fontSize: '0.75rem',
              color: theme.palette.text.secondary,
              textAlign: 'right',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              TRANSMISJA: {new Date(currentMessage.created_at).toLocaleString('pl-PL')}
            </div>
          </div>

          <div style={footerStyle}>
            <div style={{
              fontSize: '0.7rem',
              color: theme.palette.text.secondary,
              letterSpacing: '0.1em',
              
            }}>
              {messages.length > 1 && `POZOSTAŁO: ${messages.length - currentMessageIndex - 1}`}
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {messages.length > 1 && currentMessageIndex < messages.length - 1 && (
                <button
                  onClick={handleCloseAll}
                  style={secondaryButtonStyle}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = 'rgba(113, 128, 150, 0.2)';
                    e.target.style.boxShadow = '0 0 15px rgba(113, 128, 150, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
                  }}
                >
                  ⏭ ZAMKNIJ WSZYSTKIE
                </button>
              )}
              
              <button
                onClick={handleClose}
                style={primaryButtonStyle}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = '#a0aec0';
                  e.target.style.boxShadow = '0 0 15px rgba(113, 128, 150, 0.5)';
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = theme.palette.text.secondary;
                  e.target.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
                }}
              >
                {currentMessageIndex + 1 < messages.length ? '▶ NASTĘPNA' : '✓ POTWIERDZAM'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GlobalMessagePopup;