import { useEffect, useState } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { useLocation } from 'react-router-dom';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Logout as LogoutIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { getUserRole, isRegularPlayer } from './AuthContext';

const colors = {
    primary: '#8b0000',
    bgDark: '#0a0a0a',
    bgPaper: '#1a1a1a',
    textPrimary: '#e0e0e0',
    textSecondary: '#888888',
    secondary: '#2d2d2d',
    danger: '#dc2626',
};

const ProtectedRoute = ({ children }) => {
    const theme = useTheme();
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    const [residentMessage, setResidentMessage] = useState(null);
    const [banMessage, setBanMessage] = useState(null);
    const token = localStorage.getItem('token');
    const userRole = getUserRole();

    useEffect(() => {
        const checkUserStatus = async () => {
            // Sprawdź najpierw czy user nie jest zbanowany (dla wszystkich ról)
            try {
                const testResponse = await fetch('/api/home/profile', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });

                // Jeśli dostaliśmy 403, sprawdź czy to ban
                if (testResponse.status === 403) {
                    const data = await testResponse.json();
                    if (data.blocked) {
                        setBanMessage({
                            message: data.message,
                            blockedUntil: data.blockedUntil,
                            daysLeft: data.daysLeft,
                            hoursLeft: data.hoursLeft
                        });
                        setChecking(false);
                        return;
                    }
                }
            } catch (error) {
                console.error('❌ Błąd sprawdzania statusu użytkownika:', error);
            }

            // Sprawdź komunikaty dla mieszkańców (zasłużony też nim jest)
            if (isRegularPlayer(userRole)) {
                try {
                    const response = await fetch('/api/admin/check-resident-message', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.hasMessage) {
                            setResidentMessage({
                                title: data.title,
                                content: data.content,
                                createdAt: data.createdAt,
                                updatedAt: data.updatedAt
                            });
                        }
                    }
                } catch (error) {
                    console.error('❌ Błąd sprawdzania komunikatu:', error);
                }
            }

            setChecking(false);
        };

        checkUserStatus();
    }, [token, userRole, location.pathname]); // Sprawdź przy zmianie ścieżki

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    // Ładowanie
    if (checking) {
        return (
            <Box sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: colors.bgDark,
            }}>
                <Typography sx={{
                    color: colors.textPrimary,
                    fontSize: '2rem',
                    
                    letterSpacing: '0.05em',
                }}>
                    SPRAWDZANIE STATUSU...
                </Typography>
            </Box>
        );
    }

    // Jeśli użytkownik jest zbanowany
    if (banMessage) {
        return (
            <Box sx={{
                minHeight: '100vh',
                bgcolor: colors.bgDark,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
            }}>
                <Paper sx={{
                    maxWidth: '800px',
                    width: '100%',
                    bgcolor: colors.bgPaper,
                    border: `3px solid ${colors.danger}`,
                    borderRadius: '4px',
                    p: 5,
                    boxShadow: `0 0 40px ${colors.danger}80, inset 0 0 50px rgba(0, 0, 0, 0.5)`,
                }}>
                    <Typography variant="h2" sx={{
                        color: colors.danger,
                        
                        letterSpacing: '0.1em',
                        textAlign: 'center',
                        mb: 4,
                        textTransform: 'uppercase',
                        fontWeight: 'bold',
                    }}>
                        🚫 KONTO ZABLOKOWANE
                    </Typography>

                    <Box sx={{
                        bgcolor: 'rgba(220, 38, 38, 0.1)',
                        border: `1px solid ${colors.danger}`,
                        borderRadius: '4px',
                        p: 3,
                        mb: 4,
                        color: colors.textPrimary,
                        
                        fontSize: '1.1rem',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-line',
                    }}>
                        {banMessage.message}
                    </Box>

                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        mb: 3,
                        gap: 3,
                        color: colors.textSecondary,
                        fontSize: '1rem',
                        
                    }}>
                        <Typography variant="body1">
                            <strong>Zablokowano do:</strong> {banMessage.blockedUntil}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Pozostało:</strong> {banMessage.daysLeft} dni ({banMessage.hoursLeft}h)
                        </Typography>
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleLogout}
                        startIcon={<LogoutIcon />}
                        sx={{
                            bgcolor: colors.danger,
                            color: colors.textPrimary,
                            
                            fontWeight: 'bold',
                            letterSpacing: '0.1em',
                            py: 2,
                            fontSize: '1.1rem',
                            borderRadius: '0',
                            textTransform: 'uppercase',
                            border: `2px solid ${colors.primary}`,
                            '&:hover': {
                                bgcolor: '#b22222',
                                transform: 'translateY(-2px)',
                                boxShadow: `0 15px 40px ${colors.danger}60`,
                            },
                        }}
                    >
                        [ WYLOGUJ SIĘ ]
                    </Button>
                </Paper>
            </Box>
        );
    }

    // Jeśli jest aktywny komunikat dla mieszkańca
    if (residentMessage) {
        return (
            <Box sx={{
                minHeight: '100vh',
                bgcolor: colors.bgDark,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
            }}>
                <Paper sx={{
                    maxWidth: '800px',
                    width: '100%',
                    bgcolor: colors.bgPaper,
                    border: `2px solid ${colors.danger}`,
                    borderRadius: '4px',
                    p: 4,
                    boxShadow: `0 8px 32px ${colors.danger}60`,
                }}>
                    <Typography variant="h3" sx={{
                        color: colors.danger,
                        
                        letterSpacing: '0.05em',
                        textAlign: 'center',
                        mb: 3,
                        textTransform: 'uppercase',
                    }}>
                        ⚠️ KOMUNIKAT SYSTEMOWY
                    </Typography>

                    <Typography variant="h5" sx={{
                        color: colors.textPrimary,
                        
                        textAlign: 'center',
                        mb: 3,
                    }}>
                        {residentMessage.title}
                    </Typography>

                    <Box
                        sx={{
                            bgcolor: 'rgba(220, 38, 38, 0.1)',
                            border: `1px solid ${colors.danger}`,
                            borderRadius: '4px',
                            p: 3,
                            mb: 3,
                            color: colors.textPrimary,
                            
                            '& p': { mb: 2 },
                            '& h1, & h2, & h3': { color: colors.textPrimary, mb: 2 },
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(residentMessage.content) }}
                    />

                    <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        mb: 3,
                        color: colors.textSecondary,
                        fontSize: '0.85rem',
                        
                    }}>
                        <Typography variant="caption">
                            UTWORZONO: {new Date(residentMessage.createdAt).toLocaleString('pl-PL')}
                        </Typography>
                        {residentMessage.updatedAt && residentMessage.updatedAt !== residentMessage.createdAt && (
                            <Typography variant="caption">
                                AKTUALIZACJA: {new Date(residentMessage.updatedAt).toLocaleString('pl-PL')}
                            </Typography>
                        )}
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        onClick={handleLogout}
                        startIcon={<LogoutIcon />}
                        sx={{
                            bgcolor: colors.primary,
                            color: colors.textPrimary,
                            
                            fontWeight: 'bold',
                            letterSpacing: '0.05em',
                            py: 1.5,
                            borderRadius: '4px',
                            '&:hover': {
                                bgcolor: '#b22222',
                                boxShadow: `0 4px 20px ${colors.primary}80`,
                            },
                        }}
                    >
                        WYLOGUJ SIĘ
                    </Button>
                </Paper>
            </Box>
        );
    }

    // Wszystko OK - pokaż chronioną zawartość
    return children;
};

export default ProtectedRoute;