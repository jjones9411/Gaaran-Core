import { useState, useEffect } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  TextField,
  Paper,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  MenuItem,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Article as ArticleIcon,
  Logout as LogoutIcon,
  Message as MessageIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Delete as DeleteIcon,
  BugReport as BugReportIcon,
  PersonOff as PersonOffIcon,
  Category as CategoryIcon,
  Security as SecurityIcon,
  MeetingRoom as MeetingRoomIcon,
  People as PeopleIcon,
  Add as AddIcon,
  Pets as PetsIcon,
  Inventory as InventoryIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTheme } from '@mui/material/styles';
import { appColors } from './theme';
import {
  PanelPage,
  PanelHeader,
  PanelSectionHeading,
  panelSectionSx,
  panelAccordionSx,
  dangerTextReadable,
} from './PanelUI';
import { getUserRole, formatRoleForDisplay } from './AuthContext';
import WeatherIllnessAdminPanel from './WeatherIllnessAdminPanel';
import MonsterAdminPanel from './MonsterAdminPanel';
import ItemAdminPanel from './ItemAdminPanel';
import RaceAdminPanel from './RaceAdminPanel';
import ClassAdminPanel from './ClassAdminPanel';

const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ list: 'ordered' }, ],
    ['link', 'image'],
    ['clean'],
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet',
  'link', 'image'
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const userRole = getUserRole();
  // Admin widzi cały panel; mistrz gry tylko wybrane sekcje (moderacja + klany).
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
      alert('Brak uprawnień do dostępu do panelu');
      navigate('/');
    }
  }, [navigate, userRole]);

  const [activeSection, setActiveSection] = useState(null);
  const [currentView, setCurrentView] = useState('main'); // 'main', 'monsters', 'items'
  const [races, setRaces] = useState([]);

  // Pobierz listę ras (do mapowania klucza rasy na czytelną nazwę)
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';

  const [residentMessages, setResidentMessages] = useState([]);
  const [newResidentMessageTitle, setNewResidentMessageTitle] = useState('');
  const [newResidentMessageContent, setNewResidentMessageContent] = useState('');
  const [editResidentMessageId, setEditResidentMessageId] = useState('');
  const [editResidentMessageTitle, setEditResidentMessageTitle] = useState('');
  const [editResidentMessageContent, setEditResidentMessageContent] = useState('');
  const [residentMessagesLoading, setResidentMessagesLoading] = useState(false);

  const [gameYear, setGameYear] = useState('');
  const [gameMonth, setGameMonth] = useState('');
  const [gameDay, setGameDay] = useState('');
  const [gameHour, setGameHour] = useState('');
  
  const [blockUserId, setBlockUserId] = useState('');
  const [blockDays, setBlockDays] = useState('');
  const [blockUserData, setBlockUserData] = useState(null);
  const [blockUserLoading, setBlockUserLoading] = useState(false);

  const [globalMessageTitle, setGlobalMessageTitle] = useState('');
  const [globalMessageContent, setGlobalMessageContent] = useState('');
  const [globalMessageFactions, setGlobalMessageFactions] = useState([]);

  const [changeNickCharacterId, setChangeNickCharacterId] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [currentNickname, setCurrentNickname] = useState('');

  // === PRZESYŁKA MG: towary luksusowe i z czarnego rynku ===
  // Te towary nie mają w grze żadnego źródła produkcji ani nie da się ich kupić
  // na Rynku - to jedyny kanał, którym trafiają do świata. Stąd potwierdzanie ID:
  // podgląd musi poprzedzić wysyłkę, a `grantLookup.confirmUserId` jedzie do
  // serwera jako dowód, że MG rozwinął ID w konkretne imię i konto
  // (backend/routes/adminResources.js). Podgląd przyjmuje ID postaci ALBO gracza.
  const [grantCharacterId, setGrantCharacterId] = useState('');
  // Gdy w podglądzie padło ID GRACZA, MG musi jeszcze wskazać, która postać.
  const [grantTargetCharacter, setGrantTargetCharacter] = useState(null);
  const [grantLookup, setGrantLookup] = useState(null);
  const [grantLookupLoading, setGrantLookupLoading] = useState(false);
  const [grantCatalog, setGrantCatalog] = useState([]);
  const [grantMaxQuantity, setGrantMaxQuantity] = useState(1000);
  const [grantResourceId, setGrantResourceId] = useState('');
  const [grantQuantity, setGrantQuantity] = useState(1);
  const [grantReason, setGrantReason] = useState('');
  const [grantSending, setGrantSending] = useState(false);

  // Katalog towarów, które wolno wysłać przesyłką MG (luksusy + czarny rynek).
  // Lista żyje w backend/utils/marketPricing.js, więc pobieramy ją z serwera
  // zamiast dublować na froncie.
  useEffect(() => {
    fetch('/api/admin/resource-grant/catalog', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        setGrantCatalog(Array.isArray(data.resources) ? data.resources : []);
        if (data.maxQuantity) setGrantMaxQuantity(data.maxQuantity);
      })
      .catch(err => console.error('Błąd pobierania katalogu przesyłek MG:', err));
  }, []);

  const [deleteUserId, setDeleteUserId] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  // Zarządzanie rolami
  const [roleCharacterId, setRoleCharacterId] = useState('');
  const [roleUserData, setRoleUserData] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);

  // Zarządzanie pokojami tawerny
  const [tavernRooms, setTavernRooms] = useState([]);
  const [tavernRoomsLoading, setTavernRoomsLoading] = useState(false);
  const [editRoomId, setEditRoomId] = useState('');
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomDescription, setEditRoomDescription] = useState('');
  const [editRoomFactions, setEditRoomFactions] = useState([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [newRoomFactions, setNewRoomFactions] = useState([]);

  const token = localStorage.getItem('token');

  // Zarządzanie klanami / rodzinami
  const [clans, setClans] = useState([]);
  const [clansLoading, setClansLoading] = useState(false);
  const [newClanName, setNewClanName] = useState('');
  const [newClanDescription, setNewClanDescription] = useState('');
  const [newClanHeadId, setNewClanHeadId] = useState('');
  const [clanCreating, setClanCreating] = useState(false);

  const fetchClans = async () => {
    try {
      setClansLoading(true);
      const res = await fetch('/api/clans', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setClans(await res.json());
    } catch (e) {
      console.error('Błąd pobierania klanów:', e);
    } finally {
      setClansLoading(false);
    }
  };

  const handleCreateClan = async () => {
    if (!newClanName.trim() || !newClanHeadId) {
      alert('Podaj nazwę klanu i ID postaci, która będzie głową klanu');
      return;
    }
    try {
      setClanCreating(true);
      const res = await fetch('/api/clans', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClanName.trim(),
          description: newClanDescription.trim() || null,
          headCharacterId: Number(newClanHeadId),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.message || 'Klan utworzony');
        setNewClanName('');
        setNewClanDescription('');
        setNewClanHeadId('');
        fetchClans();
      } else {
        alert(data.message || 'Nie udało się utworzyć klanu');
      }
    } catch {
      alert('Błąd sieci');
    } finally {
      setClanCreating(false);
    }
  };

  const handleDeleteClan = async (clanId, clanName) => {
    if (!window.confirm(`Usunąć klan "${clanName}"? Usunie to też wszystkich członków i oczekujące zaproszenia.`)) return;
    try {
      const res = await fetch(`/api/clans/${clanId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.message || 'Klan usunięty');
        fetchClans();
      } else {
        alert(data.message || 'Nie udało się usunąć klanu');
      }
    } catch {
      alert('Błąd sieci');
    }
  };

  // Mass email
  const [massEmailSubject, setMassEmailSubject] = useState('');
  const [massEmailBody, setMassEmailBody] = useState('');
  const [massEmailSending, setMassEmailSending] = useState(false);
  const [massEmailResult, setMassEmailResult] = useState(null);

  const handleSendMassEmail = async () => {
    if (!massEmailSubject.trim() || !massEmailBody.trim()) {
      alert('Temat i treść są wymagane.');
      return;
    }
    if (!window.confirm(`Czy na pewno chcesz wysłać email do WSZYSTKICH graczy?\n\nTemat: ${massEmailSubject}`)) return;

    setMassEmailSending(true);
    setMassEmailResult(null);
    try {
      const response = await fetch('/api/admin/send-mass-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: massEmailSubject, body: massEmailBody })
      });
      const data = await response.json();
      if (response.ok) {
        setMassEmailResult({ type: 'success', sent: data.sent, failed: data.failed, total: data.total });
        setMassEmailSubject('');
        setMassEmailBody('');
      } else {
        setMassEmailResult({ type: 'error', message: data.message });
      }
    } catch {
      setMassEmailResult({ type: 'error', message: 'Błąd sieci.' });
    } finally {
      setMassEmailSending(false);
    }
  };

  // Na górze komponentu, dodaj nowe state:
const [forceLogoutUserId, setForceLogoutUserId] = useState('');
const [forceLogoutReason, setForceLogoutReason] = useState('');
const [forceLogoutUserData, setForceLogoutUserData] = useState(null);
const [forceLogoutLoading, setForceLogoutLoading] = useState(false);

// Dodaj funkcje obsługi:
const handleFetchUserForLogout = async () => {
  if (!forceLogoutUserId) {
    alert('Podaj ID postaci lub gracza');
    return;
  }
  
  setForceLogoutLoading(true);
  try {
    const response = await fetch(`/api/admin/user-info-for-logout/${forceLogoutUserId}`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: Błąd pobierania danych`);
    }
    
    const data = await response.json();
    setForceLogoutUserData(data);
  } catch (error) {
    console.error('Błąd pobierania danych gracza:', error);
    alert(`Błąd: ${error.message}`);
    setForceLogoutUserData(null);
  } finally {
    setForceLogoutLoading(false);
  }
};

const handleForceLogout = async () => {
  if (!forceLogoutUserData) {
    alert('Najpierw pobierz dane gracza');
    return;
  }

  if (!window.confirm(`Czy na pewno chcesz wymusić wylogowanie gracza "${forceLogoutUserData.username}"? Użytkownik zostanie natychmiast wylogowany.`)) {
    return;
  }

  setForceLogoutLoading(true);
  try {
    // POPRAWIONE - używamy userId z danych gracza, nie z inputu
    const response = await fetch(`/api/admin/force-logout/${forceLogoutUserData.userId}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ 
        reason: forceLogoutReason || 'Wylogowano przez administratora' 
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: Błąd wymuszania wylogowania`);
    }
    
    const data = await response.json();
    alert(data.message || 'Gracz zostanie wylogowany przy następnym żądaniu');
    
    // Wyczyść formularz
    setForceLogoutUserId('');
    setForceLogoutReason('');
    setForceLogoutUserData(null);
  } catch (error) {
    console.error('Błąd wymuszania wylogowania:', error);
    alert(`Błąd: ${error.message}`);
  } finally {
    setForceLogoutLoading(false);
  }
};


  const handleFetchResidentMessages = async () => {
    setResidentMessagesLoading(true);
    try {
      const response = await fetch('/api/admin/resident-messages', {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd pobierania komunikatów`);
      }
      
      const data = await response.json();
      setResidentMessages(data.messages || []);
    } catch (error) {
      console.error('Błąd pobierania komunikatów:', error);
      alert(`Błąd pobierania komunikatów: ${error.message}`);
      setResidentMessages([]);
    } finally {
      setResidentMessagesLoading(false);
    }
  };

  const handleAddResidentMessage = async (e) => {
    e.preventDefault();
    if (!newResidentMessageTitle.trim() || !newResidentMessageContent.trim()) {
      alert('Tytuł i treść komunikatu nie mogą być puste');
      return;
    }

    try {
      const response = await fetch('/api/admin/resident-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newResidentMessageTitle,
          content: newResidentMessageContent,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas dodawania komunikatu');
      }
      
      const data = await response.json();
      alert(data.message || 'Komunikat został dodany pomyślnie');
      
      setNewResidentMessageTitle('');
      setNewResidentMessageContent('');
      handleFetchResidentMessages();
      
    } catch (error) {
      console.error('Błąd podczas dodawania komunikatu:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleEditResidentMessage = async (e) => {
    e.preventDefault();
    if (!editResidentMessageId || !editResidentMessageTitle.trim() || !editResidentMessageContent.trim()) {
      alert('ID, tytuł i treść komunikatu nie mogą być puste');
      return;
    }

    try {
      const response = await fetch(`/api/admin/resident-messages/${editResidentMessageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editResidentMessageTitle,
          content: editResidentMessageContent,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas edycji komunikatu');
      }
      
      const data = await response.json();
      alert(data.message || 'Komunikat został zaktualizowany pomyślnie');
      
      setEditResidentMessageId('');
      setEditResidentMessageTitle('');
      setEditResidentMessageContent('');
      handleFetchResidentMessages();
      
    } catch (error) {
      console.error('Błąd podczas edycji komunikatu:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleToggleResidentMessage = async (messageId, currentActiveStatus) => {
    if (!currentActiveStatus && !window.confirm('Czy na pewno chcesz aktywować ten komunikat? Wszyscy mieszkańcy zobaczą go zamiast gry, dopóki nie zostanie dezaktywowany.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/resident-messages/${messageId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas zmiany statusu komunikatu');
      }
      
      const data = await response.json();
      alert(data.message || `Komunikat został ${currentActiveStatus ? 'dezaktywowany' : 'aktywowany'}`);
      
      handleFetchResidentMessages();
      
    } catch (error) {
      console.error('Błąd podczas zmiany statusu komunikatu:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleDeleteResidentMessage = async (messageId, messageTitle) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć komunikat "${messageTitle}"? Ta operacja jest nieodwracalna.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/resident-messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas usuwania komunikatu');
      }
      
      const data = await response.json();
      alert(data.message || 'Komunikat został usunięty pomyślnie');
      
      handleFetchResidentMessages();
      
    } catch (error) {
      console.error('Błąd podczas usuwania komunikatu:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleLoadResidentMessageForEdit = (message) => {
    setEditResidentMessageId(message.id);
    setEditResidentMessageTitle(message.title);
    setEditResidentMessageContent(message.content);
  };

  const handleFetchCurrentNickname = async () => {
    if (!changeNickCharacterId) {
      alert('Podaj ID postaci');
      return;
    }
    try {
      const response = await fetch(`/api/admin/getNickname?characterId=${changeNickCharacterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Błąd pobierania nicku');
      }
      const data = await response.json();
      setCurrentNickname(data.nickname || '');
    } catch (error) {
      alert(error.message);
      setCurrentNickname('');
    }
  };

  const handleChangeNickname = async (e) => {
    e.preventDefault();
    if (!changeNickCharacterId || !newNickname.trim()) {
      alert('Podaj ID postaci i nowy nick');
      return;
    }
    try {
      const response = await fetch('/api/admin/changeNickname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          characterId: changeNickCharacterId, 
          newNickname: newNickname.trim() 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Błąd zmiany nicku');
      }
      
      const data = await response.json();
      alert(data.message);
      setChangeNickCharacterId('');
      setNewNickname('');
      setCurrentNickname('');
    } catch (error) {
      alert(error.message);
    }
  };

  // === PRZESYŁKA MG ===
  // Krok 1: rozwiń ID w konkretnego odbiorcę. Przyjmuje ID postaci ALBO ID gracza -
  // w drugim przypadku serwer zwraca listę postaci i MG wskazuje, do której wysyła.
  // Bez tego kroku wysyłka jest zablokowana: z samego "42" nie widać, czyja to
  // postać, a pomyłka o cyfrę oznacza wsypanie luksusów obcemu graczowi.
  const handleGrantLookup = async () => {
    if (!grantCharacterId) {
      alert('Podaj ID postaci lub ID gracza');
      return;
    }
    setGrantLookupLoading(true);
    try {
      const response = await fetch(`/api/admin/resource-grant/lookup/${grantCharacterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd podglądu odbiorcy');
      setGrantLookup(data);
      // ID postaci = odbiorca gotowy. ID gracza = trzeba jeszcze wybrać postać.
      setGrantTargetCharacter(data.matchedBy === 'character' ? data.character : null);
    } catch (error) {
      alert(error.message);
      setGrantLookup(null);
      setGrantTargetCharacter(null);
    } finally {
      setGrantLookupLoading(false);
    }
  };

  // Krok 2: wyślij. `confirmUserId` z podglądu jest twardą bramką po stronie
  // serwera - jeśli postać należy do innego konta niż to z podglądu, przesyłka
  // się zatrzyma i podgląd odświeży się sam.
  const handleGrantSend = async () => {
    if (!grantLookup || !grantTargetCharacter || !grantResourceId) {
      alert('Najpierw sprawdź ID, wybierz postać i towar');
      return;
    }
    setGrantSending(true);
    try {
      const response = await fetch('/api/admin/resource-grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          characterId: grantTargetCharacter.id,
          resourceId: grantResourceId,
          quantity: Number(grantQuantity),
          reason: grantReason.trim(),
          confirmUserId: grantLookup.confirmUserId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.idMismatch) {
          alert(`${data.error}\n\nKonto z podglądu: #${data.providedUserId}\nKonto teraz: #${data.expectedUserId}`);
          await handleGrantLookup();
          return;
        }
        throw new Error(data.error || 'Błąd wysyłki');
      }
      alert(data.message);
      setGrantQuantity(1);
      setGrantReason('');
      await handleGrantLookup(); // odśwież stan posiadania odbiorcy
    } catch (error) {
      alert(error.message);
    } finally {
      setGrantSending(false);
    }
  };

  const handleFetchUserForBlock = async () => {
    if (!blockUserId) {
      alert('Podaj ID postaci lub gracza');
      return;
    }

    setBlockUserLoading(true);
    try {
      const response = await fetch(`/api/admin/user-info-for-logout/${blockUserId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd pobierania danych`);
      }

      const data = await response.json();
      setBlockUserData(data);
    } catch (error) {
      console.error('Błąd pobierania danych gracza:', error);
      alert(`Błąd: ${error.message}`);
      setBlockUserData(null);
    } finally {
      setBlockUserLoading(false);
    }
  };

  const handleBlockUser = async (e) => {
    e.preventDefault();

    if (!blockUserData) {
      alert('Najpierw pobierz dane gracza');
      return;
    }

    if (!blockDays || blockDays <= 0) {
      alert('Podaj poprawną liczbę dni blokady');
      return;
    }

    if (!window.confirm(`Czy na pewno chcesz zablokować gracza "${blockUserData.username}" na ${blockDays} dni?`)) {
      return;
    }

    setBlockUserLoading(true);
    try {
      const response = await fetch('/api/admin/blockUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: blockUserData.userId, days: blockDays }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Błąd banowania gracza');
      }

      const data = await response.json();
      alert(data.message);
      setBlockUserId('');
      setBlockDays('');
      setBlockUserData(null);
    } catch (error) {
      console.error('Błąd banowania gracza:', error);
      alert(error.message);
    } finally {
      setBlockUserLoading(false);
    }
  };

  const handleSendGlobalMessage = async (e) => {
    e.preventDefault();
    if (!globalMessageTitle.trim() || !globalMessageContent.trim()) {
      alert('Tytuł i treść wiadomości nie mogą być puste');
      return;
    }

    try {
      const response = await fetch('/api/admin/sendGlobalMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: globalMessageTitle,
          content: globalMessageContent,
          target_factions: globalMessageFactions.length > 0 ? globalMessageFactions : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Wystąpił błąd podczas wysyłania wiadomości');
      }

      const data = await response.json();
      alert(data.message);
      setGlobalMessageTitle('');
      setGlobalMessageContent('');
      setGlobalMessageFactions([]);
    } catch (error) {
      console.error('Błąd podczas wysyłania wiadomości globalnej:', error);
      alert(error.message);
    }
  };

  const handleFetchUserForDeletion = async () => {
    if (!deleteUserId) {
      alert('Podaj ID gracza');
      return;
    }
    
    setDeleteUserLoading(true);
    try {
      const response = await fetch(`/api/admin/user-deletion-preview/${deleteUserId}`, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd pobierania danych gracza`);
      }
      
      const data = await response.json();
      setUserToDelete(data);
    } catch (error) {
      console.error('Błąd pobierania danych gracza:', error);
      alert(`Błąd: ${error.message}`);
      setUserToDelete(null);
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!window.confirm('⚠️ OSTATNIE OSTRZEŻENIE! Czy NA PEWNO chcesz CAŁKOWICIE I NIEODWRACALNIE usunąć tego gracza wraz z WSZYSTKIMI jego danymi? Ta operacja NIE MOŻE być cofnięta!')) {
      return;
    }

    setDeleteUserLoading(true);
    try {
      const response = await fetch(`/api/admin/deleteUser/${deleteUserId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd usuwania gracza`);
      }
      
      const data = await response.json();
      alert(data.message || 'Gracz został usunięty pomyślnie');
      
      setDeleteUserId('');
      setUserToDelete(null);
    } catch (error) {
      console.error('Błąd usuwania gracza:', error);
      alert(`Błąd: ${error.message}`);
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // ========== ZARZĄDZANIE ROLAMI ==========
  const handleFetchRoleData = async () => {
    if (!roleCharacterId) {
      alert('Podaj ID postaci');
      return;
    }

    setRoleLoading(true);
    try {
      const response = await fetch(`/api/admin/get-role?characterId=${roleCharacterId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd pobierania danych`);
      }

      const data = await response.json();
      setRoleUserData(data);
      setSelectedRole(data.currentRole);
    } catch (error) {
      console.error('Błąd pobierania danych roli:', error);
      alert(`Błąd: ${error.message}`);
      setRoleUserData(null);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!roleUserData || !selectedRole) {
      alert('Najpierw pobierz dane postaci i wybierz nową rolę');
      return;
    }

    if (selectedRole === roleUserData.currentRole) {
      alert('Wybrana rola jest taka sama jak obecna');
      return;
    }

    if (!window.confirm(`Czy na pewno chcesz zmienić rolę użytkownika "${roleUserData.ownerName}" z "${roleUserData.currentRole}" na "${selectedRole}"?`)) {
      return;
    }

    setRoleLoading(true);
    try {
      const response = await fetch('/api/admin/change-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          characterId: roleCharacterId,
          newRole: selectedRole
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd zmiany roli`);
      }

      const data = await response.json();
      alert(data.message || 'Rola została zmieniona pomyślnie');

      // Odśwież dane
      setRoleUserData({
        ...roleUserData,
        currentRole: selectedRole
      });
    } catch (error) {
      console.error('Błąd zmiany roli:', error);
      alert(`Błąd: ${error.message}`);
    } finally {
      setRoleLoading(false);
    }
  };

  // ========== ZARZĄDZANIE POKOJAMI TAWERNY ==========
  const handleFetchTavernRooms = async () => {
    setTavernRoomsLoading(true);
    try {
      const response = await fetch('/api/admin/tavern-rooms', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd pobierania pokoi`);
      }

      const data = await response.json();
      setTavernRooms(data.rooms || []);
    } catch (error) {
      console.error('Błąd pobierania pokoi tawerny:', error);
      alert(`Błąd: ${error.message}`);
      setTavernRooms([]);
    } finally {
      setTavernRoomsLoading(false);
    }
  };

  const handleToggleTavernRoom = async (roomId, roomName, currentStatus) => {
    const action = currentStatus ? 'zablokować' : 'aktywować';
    if (!window.confirm(`Czy na pewno chcesz ${action} pokój "${roomName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tavern-rooms/${roomId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Błąd zmiany statusu pokoju`);
      }

      const data = await response.json();
      alert(data.message || 'Status pokoju został zmieniony');

      // Odśwież listę pokoi
      handleFetchTavernRooms();
    } catch (error) {
      console.error('Błąd zmiany statusu pokoju:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleLoadRoomForEdit = (room) => {
    setEditRoomId(room.id);
    setEditRoomName(room.name);
    setEditRoomDescription(room.description || '');
    // Konwertuj string rasy na tablicę
    const factions = room.required_faction ? room.required_faction.split(',').map(f => f.trim()) : [];
    setEditRoomFactions(factions);
  };

  const handleEditTavernRoom = async (e) => {
    e.preventDefault();
    if (!editRoomId || !editRoomName.trim()) {
      alert('ID pokoju i nazwa nie mogą być puste');
      return;
    }

    try {
      // Konwertuj tablicę rasy na string oddzielony przecinkami
      const requiredFaction = editRoomFactions.length > 0 ? editRoomFactions.join(',') : null;

      const response = await fetch(`/api/admin/tavern-rooms/${editRoomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editRoomName.trim(),
          description: editRoomDescription,
          required_faction: requiredFaction
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas edycji pokoju');
      }

      const data = await response.json();
      alert(data.message || 'Pokój został zaktualizowany pomyślnie');

      // Wyczyść formularz
      setEditRoomId('');
      setEditRoomName('');
      setEditRoomDescription('');
      setEditRoomFactions([]);

      // Odśwież listę pokoi
      handleFetchTavernRooms();
    } catch (error) {
      console.error('Błąd podczas edycji pokoju:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleKickAllFromRoom = async (roomId, roomName) => {
    if (!window.confirm(`Czy na pewno chcesz wyrzucić wszystkich graczy z pokoju "${roomName}"? Gracze będą musieli wejść ponownie do tawerny.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tavern-rooms/${roomId}/kick-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas wyrzucania graczy');
      }

      const data = await response.json();
      alert(data.message || 'Gracze zostali wyrzuceni z pokoju');

      // Odśwież listę pokoi
      handleFetchTavernRooms();
    } catch (error) {
      console.error('Błąd podczas wyrzucania graczy:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleAddTavernRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      alert('Nazwa pokoju nie może być pusta');
      return;
    }

    try {
      // Konwertuj tablicę rasy na string oddzielony przecinkami
      const requiredFaction = newRoomFactions.length > 0 ? newRoomFactions.join(',') : null;

      const response = await fetch('/api/admin/tavern-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDescription,
          required_faction: requiredFaction
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas dodawania pokoju');
      }

      const data = await response.json();
      alert(data.message || 'Pokój został dodany pomyślnie');

      // Wyczyść formularz
      setNewRoomName('');
      setNewRoomDescription('');
      setNewRoomFactions([]);

      // Odśwież listę pokoi
      handleFetchTavernRooms();
    } catch (error) {
      console.error('Błąd podczas dodawania pokoju:', error);
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleDeleteTavernRoom = async (roomId, roomName) => {
    if (!window.confirm(`Czy na pewno chcesz USUNĄĆ pokój "${roomName}"? Ta operacja jest nieodwracalna i usunie również wszystkie wiadomości z tego pokoju.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tavern-rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Wystąpił błąd podczas usuwania pokoju');
      }

      const data = await response.json();
      alert(data.message || 'Pokój został usunięty pomyślnie');

      // Odśwież listę pokoi
      handleFetchTavernRooms();
    } catch (error) {
      console.error('Błąd podczas usuwania pokoju:', error);
      alert(`Błąd: ${error.message}`);
    }
  };


  // Conditional rendering for different views
  if (currentView === 'monsters') {
    return <MonsterAdminPanel onBack={() => setCurrentView('main')} />;
  }

  if (currentView === 'items') {
    return <ItemAdminPanel onBack={() => setCurrentView('main')} />;
  }

  if (currentView === 'races') {
    return <RaceAdminPanel onBack={() => setCurrentView('main')} />;
  }

  if (currentView === 'classes') {
    return <ClassAdminPanel onBack={() => setCurrentView('main')} />;
  }

  return (
    <PanelPage>
      {/* Nagłówek strony - ten sam rytm co pozostałe ekrany (PanelHeader) */}
      <PanelHeader
        eyebrow="Narzędzia zarządcy"
        title="Panel Administracyjny"
        theme={theme}
      />

      {isAdmin && (
      <Box sx={{
        display: 'flex',
        gap: 1.5,
        flexWrap: 'wrap',
        mb: 3,
        pb: 2.5,
        borderBottom: `1px solid ${appColors.borderSteel}`,
      }}>
        {/* Jednolite przyciski nawigacji do podpanelów. Wcześniej każdy miał inny
            kolor MUI (error/info/success/warning) - rozpoznawalność niosą ikony
            i podpisy, kolor nie musi się różnić przy każdym z nich. */}
        {[
          { label: 'Bugtrack', icon: <BugReportIcon />, to: '/home/adminpanel/bugtrack' },
          { label: 'Potwory', icon: <PetsIcon />, view: 'monsters' },
          { label: 'Przedmioty', icon: <InventoryIcon />, view: 'items' },
          { label: 'Rasy', icon: <PetsIcon />, view: 'races' },
          { label: 'Klasy', icon: <CategoryIcon />, view: 'classes' },
        ].map(({ label, icon, to, view }) => (
          <Button
            key={label}
            variant="outlined"
            startIcon={icon}
            {...(to ? { component: Link, to } : { onClick: () => setCurrentView(view) })}
            sx={{
              color: appColors.textLight,
              border: `1px solid ${appColors.borderSteel}`,
              borderLeft: `3px solid ${theme.palette.primary.main}`,
              borderRadius: '2px',
              bgcolor: appColors.bgDeep,
              fontSize: '0.8rem',
              '& .MuiSvgIcon-root': { color: theme.palette.primary.main },
              '&:hover': {
                bgcolor: appColors.bgSurface,
                borderColor: appColors.borderSteel,
                borderLeftColor: theme.palette.primary.main,
                boxShadow: `0 0 14px ${theme.palette.primary.main}30`,
              },
            }}
          >
            {label}
          </Button>
        ))}
      </Box>
      )}

      {/* Sekcja: Email do wszystkich graczy (tylko admin) */}
      {isAdmin && (
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Komunikacja"
          title="Wyślij Email do Wszystkich Graczy"
          icon={<EmailIcon />}
        />

        <Alert severity="warning" sx={{ mb: 2 }}>
          Wiadomość zostanie wysłana na adresy email ze wszystkich kont graczy (niezablokowanych). Nadawcą będzie <strong>[EMAIL_NADAWCY]</strong>.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 700 }}>
          <TextField
            label="Temat wiadomości"
            value={massEmailSubject}
            onChange={(e) => setMassEmailSubject(e.target.value)}
            fullWidth
            disabled={massEmailSending}
          />
          <TextField
            label="Treść wiadomości (HTML jest obsługiwany)"
            value={massEmailBody}
            onChange={(e) => setMassEmailBody(e.target.value)}
            fullWidth
            multiline
            rows={8}
            disabled={massEmailSending}
            placeholder={'Witajcie Mieszkańcy [NAZWA_GRY]!\n\n<b>Ważna informacja:</b> ...'}
          />

          {massEmailResult && massEmailResult.type === 'success' && (
            <Alert severity="success">
              ✅ Wysłano pomyślnie <strong>{massEmailResult.sent}</strong> z <strong>{massEmailResult.total}</strong> emaili.
              {massEmailResult.failed > 0 && ` Błędy: ${massEmailResult.failed}.`}
            </Alert>
          )}
          {massEmailResult && massEmailResult.type === 'error' && (
            <Alert severity="error">{massEmailResult.message}</Alert>
          )}

          <Button
            variant="contained"
            color="primary"
            startIcon={<EmailIcon />}
            onClick={handleSendMassEmail}
            disabled={massEmailSending || !massEmailSubject.trim() || !massEmailBody.trim()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {massEmailSending ? 'Wysyłanie...' : 'Wyślij do wszystkich graczy'}
          </Button>
        </Box>
      </Paper>
      )}

      {/* Sekcja: Zarządzanie Grą dla Mieszkańców (tylko admin) */}
      {isAdmin && (
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Dostęp do gry"
          title="Zarządzanie Grą dla Mieszkańców"
          icon={<CategoryIcon />}
        />

        <Accordion
          expanded={activeSection === 'residentMessages'}
          onChange={() => {
            const newState = activeSection === 'residentMessages' ? null : 'residentMessages';
            setActiveSection(newState);
            if (newState === 'residentMessages') {
              handleFetchResidentMessages();
            }
          }}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MessageIcon color="error" />
              <Typography variant="h6">Komunikaty dla Mieszkańców - Blokowanie Gry</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
        <Box sx={{ mt: 2, mb: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Jak to działa:
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • <strong>Aktywny komunikat:</strong> Mieszkańcy widzą komunikat zamiast gry
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • <strong>Brak aktywnego komunikatu:</strong> Mieszkańcy mają normalny dostęp do gry
            </Typography>
            <Typography variant="body2">
              • <strong>Administratorzy:</strong> Zawsze widzą pełną grę niezależnie od komunikatów
            </Typography>
          </Alert>

          <Card sx={{ mb: 4, borderLeft: theme => `4px solid ${theme.palette.success.main}` }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: 'success.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArticleIcon color="success" />
                Dodaj Nowy Komunikat
              </Typography>
            <TextField
              fullWidth
              label="Tytuł komunikatu"
              value={newResidentMessageTitle}
              onChange={(e) => setNewResidentMessageTitle(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="np. Przerwa techniczna, Aktualizacja serwera..."
            />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Treść komunikatu (HTML):
              </Typography>
              <ReactQuill
                theme="snow"
                value={newResidentMessageContent}
                onChange={setNewResidentMessageContent}
                modules={quillModules}
                formats={quillFormats}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  minHeight: '150px'
                }}
                placeholder="Wpisz treść komunikatu który będzie widoczny dla mieszkańców..."
              />
            </Box>
            <Button
              variant="contained"
              color="success"
              onClick={handleAddResidentMessage}
              disabled={!newResidentMessageTitle.trim() || !newResidentMessageContent.trim()}
              fullWidth
            >
              Dodaj Komunikat
            </Button>
            </CardContent>
          </Card>

          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: 'info.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <ArticleIcon color="info" />
                Istniejące Komunikaty
              </Typography>
              <Button
                variant="outlined"
                color="info"
                onClick={handleFetchResidentMessages}
                disabled={residentMessagesLoading}
              >
                {residentMessagesLoading ? 'Ładowanie...' : 'Odśwież'}
              </Button>
            </Box>

            {residentMessagesLoading ? (
              <Alert severity="info">Ładowanie komunikatów...</Alert>
            ) : residentMessages.length === 0 ? (
              <Alert severity="info">Brak komunikatów</Alert>
            ) : (
              residentMessages.map((message) => (
                <Card
                  key={message.id}
                  sx={{
                    mb: 2,
                    borderLeft: theme => message.active
                      ? `4px solid ${theme.palette.success.main}`
                      : `4px solid ${theme.palette.divider}`,
                    backgroundColor: theme => message.active
                      ? `${theme.palette.success.main}10`
                      : 'background.paper'
                  }}
                >
                  <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Chip
                          label={message.active ? 'AKTYWNY' : 'NIEAKTYWNY'}
                          color={message.active ? 'success' : 'default'}
                          size="small"
                        />
                        <Typography variant="h6" sx={{ color: 'text.primary' }}>
                          {message.title}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        ID: {message.id} | Utworzony: {new Date(message.created_at).toLocaleString('pl-PL')}
                        {message.updated_at !== message.created_at && (
                          <> | Zmodyfikowany: {new Date(message.updated_at).toLocaleString('pl-PL')}</>
                        )}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                      <Tooltip title="Edytuj">
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => handleLoadResidentMessageForEdit(message)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="contained"
                        color={message.active ? 'error' : 'success'}
                        onClick={() => handleToggleResidentMessage(message.id, message.active)}
                      >
                        {message.active ? 'Dezaktywuj' : 'Aktywuj'}
                      </Button>
                      <Tooltip title="Usuń">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteResidentMessage(message.id, message.title)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      color: 'text.primary',
                      fontSize: '0.9rem',
                      '& p': { margin: '8px 0' },
                      '& h1, & h2, & h3': { color: 'text.secondary', margin: '12px 0 8px 0' }
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content) }}
                  />
                  </CardContent>
                </Card>
              ))
            )}
          </Box>

          {editResidentMessageId && (
            <Card sx={{ mb: 4, borderLeft: theme => `4px solid ${theme.palette.warning.main}` }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: 'warning.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EditIcon color="warning" />
                  Edytuj Komunikat (ID: {editResidentMessageId})
                </Typography>
              <TextField
                fullWidth
                label="Tytuł komunikatu"
                value={editResidentMessageTitle}
                onChange={(e) => setEditResidentMessageTitle(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                  Treść komunikatu (HTML):
                </Typography>
                <ReactQuill
                  theme="snow"
                  value={editResidentMessageContent}
                  onChange={setEditResidentMessageContent}
                  modules={quillModules}
                  formats={quillFormats}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    minHeight: '150px'
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={handleEditResidentMessage}
                  disabled={!editResidentMessageTitle.trim() || !editResidentMessageContent.trim()}
                  fullWidth
                >
                  Zapisz Zmiany
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => {
                    setEditResidentMessageId('');
                    setEditResidentMessageTitle('');
                    setEditResidentMessageContent('');
                  }}
                  fullWidth
                >
                  Anuluj
                </Button>
              </Box>
              </CardContent>
            </Card>
          )}
        </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
      )}

      {/* Sekcja: Wymuszanie Wylogowania (admin + mistrz gry) */}
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Sesje graczy"
          title="Wymuszanie Wylogowania"
          icon={<LogoutIcon />}
        />

        <Accordion
          expanded={activeSection === 'forceLogout'}
          onChange={() => setActiveSection(activeSection === 'forceLogout' ? null : 'forceLogout')}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonOffIcon color="warning" />
              <Typography variant="h6">Wymuś Wylogowanie Gracza</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
  <Box sx={{ mt: 2 }}>
    <Alert severity="warning" sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        Jak to działa:
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        • Podaj ID postaci lub ID gracza z tabeli users
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        • System znajdzie gracza i wyloguje CAŁE KONTO (wszystkie postacie)
      </Typography>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        • Gracz zostanie wylogowany w ciągu max 30 sekund
      </Typography>
      <Typography variant="body2">
        • Na stronie logowania zobaczy powód wylogowania
      </Typography>
    </Alert>

    <TextField
      fullWidth
      label="ID Postaci lub ID Gracza"
      type="number"
      value={forceLogoutUserId}
      onChange={(e) => setForceLogoutUserId(e.target.value)}
      sx={{ mb: 2 }}
      placeholder="Wpisz ID postaci (z characters) lub ID gracza (z users)"
    />
    
    <Button 
      variant="contained" 
      color="info"
      onClick={handleFetchUserForLogout}
      disabled={!forceLogoutUserId || forceLogoutLoading}
      sx={{ mb: 2, mr: 2 }}
    >
      {forceLogoutLoading ? '⏳ Ładowanie...' : '🔍 Znajdź Gracza'}
    </Button>

    {forceLogoutUserData && (
      <Card sx={{ mb: 3, borderLeft: theme => `4px solid ${theme.palette.info.main}` }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: 'info.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonOffIcon color="info" />
            Znaleziono gracza:
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              Username: <strong style={{ color: 'inherit' }}>{forceLogoutUserData.username}</strong>
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              User ID: {forceLogoutUserData.userId}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              Email: {forceLogoutUserData.email}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              Rola: {formatRoleForDisplay(forceLogoutUserData.role)}
            </Typography>
          </Box>
        
        {forceLogoutUserData.characters && forceLogoutUserData.characters.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ color: 'warning.main', mb: 1, fontWeight: 'bold' }}>
              Postacie gracza ({forceLogoutUserData.characters.length}):
            </Typography>
            {forceLogoutUserData.characters.map((char, index) => (
              <Chip
                key={index}
                label={`${char.name} (${getRaceName(char.faction)})`}
                size="small"
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </>
        )}

        <Divider sx={{ my: 2 }} />
        
        <TextField
          fullWidth
          label="Powód wylogowania (opcjonalny)"
          multiline
          rows={3}
          value={forceLogoutReason}
          onChange={(e) => setForceLogoutReason(e.target.value)}
          sx={{ mb: 2, mt: 2 }}
          placeholder="np. Naruszenie regulaminu, Podejrzana aktywność..."
        />
        
        <Button
          variant="contained"
          color="warning"
          onClick={handleForceLogout}
          disabled={forceLogoutLoading}
          fullWidth
          startIcon={<LogoutIcon />}
        >
          {forceLogoutLoading ? 'Wylogowywanie...' : 'WYMUŚ WYLOGOWANIE'}
        </Button>
        </CardContent>
      </Card>
    )}
    
    {!forceLogoutUserData && forceLogoutUserId && (
      <Alert severity="info">
        Kliknij "Znajdź Gracza" aby zobaczyć szczegóły przed wylogowaniem
      </Alert>
    )}
  </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Sekcja: Wiadomości i Komunikacja (tylko admin) */}
      {isAdmin && (
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Komunikacja"
          title="Wiadomości i Komunikacja"
          icon={<MessageIcon />}
        />

        <Accordion
          expanded={activeSection === 'globalMessage'}
          onChange={() => setActiveSection(activeSection === 'globalMessage' ? null : 'globalMessage')}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MessageIcon color="info" />
              <Typography variant="h6">Wyślij Wiadomość do Wszystkich</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Tytuł wiadomości"
            value={globalMessageTitle}
            onChange={(e) => setGlobalMessageTitle(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="np. Ważne ogłoszenie, Przerwa techniczna..."
          />
          <TextField
            fullWidth
            label="Treść wiadomości"
            multiline
            rows={4}
            value={globalMessageContent}
            onChange={(e) => setGlobalMessageContent(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Treść wiadomości która wyświetli się wszystkim graczom jako popup..."
          />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Wybierz rasy (opcjonalne - jeśli nic nie zaznaczysz, wiadomość trafi do wszystkich):
          </Typography>
          <FormGroup sx={{ mb: 2 }}>
            {races.map((r) => r.key).map((faction) => (
              <FormControlLabel
                key={faction}
                control={
                  <Checkbox
                    checked={globalMessageFactions.includes(faction)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setGlobalMessageFactions([...globalMessageFactions, faction]);
                      } else {
                        setGlobalMessageFactions(globalMessageFactions.filter(f => f !== faction));
                      }
                    }}
                  />
                }
                label={getRaceName(faction)}
              />
            ))}
          </FormGroup>
          <Button
            variant="contained"
            color="warning"
            onClick={handleSendGlobalMessage}
            sx={{ mr: 1 }}
          >
            📤 Wyślij Wiadomość
          </Button>
          <Alert severity="info" sx={{ mt: 2 }}>
            {globalMessageFactions.length > 0
              ? `Wiadomość zostanie wysłana tylko do rasy: ${globalMessageFactions.join(', ')}`
              : 'Wiadomość zostanie wysłana do wszystkich graczy'}
          </Alert>
        </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
      )}

      {/* Sekcja: Zarządzanie Postaciami - zmiana nicku (admin + mistrz gry) */}
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Postacie"
          title="Zarządzanie Postaciami"
          icon={<EditIcon />}
        />

        <Accordion
          expanded={activeSection === 'changeNickname'}
          onChange={() => setActiveSection(activeSection === 'changeNickname' ? null : 'changeNickname')}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon color="success" />
              <Typography variant="h6">Zmień Nick Postaci</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="ID Postaci"
            type="number"
            value={changeNickCharacterId}
            onChange={(e) => setChangeNickCharacterId(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Podaj ID głównej postaci"
          />
          <Button 
            variant="contained" 
            color="info"
            onClick={handleFetchCurrentNickname}
            disabled={!changeNickCharacterId}
            sx={{ mb: 2 }}
          >
            📥 Pobierz Obecny Nick
          </Button>
          
          {currentNickname && (
            <Typography variant="h6" sx={{ color: theme.palette.success.light, mb: 2 }}>
              🎭 Obecny nick: {currentNickname}
            </Typography>
          )}
          
          <TextField
            fullWidth
            label="Nowy nick"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Wpisz nowy nick dla postaci"
          />
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleChangeNickname}
            disabled={!changeNickCharacterId || !newNickname.trim()}
          >
            💾 Zmień Nick
          </Button>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Zmiana nicku będzie widoczna we wszystkich miejscach w grze
          </Alert>
        </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Sekcja: Przesyłka MG - towary luksusowe i z czarnego rynku.
          Te towary nie mają w grze źródła produkcji ani nie da się ich kupić na
          Rynku (gm_only w utils/marketPricing.js), więc to jedyny kanał, którym
          trafiają do świata - do fabularnego rozegrania przez MG. */}
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Fabuła"
          title="Przesyłka do Postaci"
          icon={<InventoryIcon />}
        />

        <Accordion
          expanded={activeSection === 'resourceGrant'}
          onChange={() => setActiveSection(activeSection === 'resourceGrant' ? null : 'resourceGrant')}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon color="warning" />
              <Typography variant="h6">Wyślij Towar Luksusowy / z Czarnego Rynku</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Jak to działa:
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Jedwab, herbata, wino, relikty i reszta towarów zamorskich <b>nie mają w grze
                  źródła produkcji</b> — nie da się ich zdobyć zbieractwem ani kupić na Rynku
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • To jedyny kanał, którym trafiają do świata — do rozegrania fabularnie
                  (statek kupiecki, łup, zapłata od NPC-a)
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Podaj <b>ID postaci lub ID gracza</b> i sprawdź — zobaczysz imię postaci
                  i konto właściciela, zanim cokolwiek wyślesz
                </Typography>
                <Typography variant="body2">
                  • Powód trafia do <b>dziennika postaci</b>, więc gracz przeczyta go w grze
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="ID Postaci lub ID Gracza"
                  type="number"
                  value={grantCharacterId}
                  onChange={(e) => { setGrantCharacterId(e.target.value); setGrantLookup(null); setGrantTargetCharacter(null); }}
                  placeholder="np. 42"
                  sx={{ minWidth: 240 }}
                />
                <Button
                  variant="contained"
                  color="info"
                  onClick={handleGrantLookup}
                  disabled={!grantCharacterId || grantLookupLoading}
                  sx={{ mt: 1 }}
                >
                  {grantLookupLoading ? 'Sprawdzam...' : '🔎 Sprawdź ID'}
                </Button>
              </Box>

              {grantLookup && (
                <>
                  <Alert severity={grantTargetCharacter ? 'success' : 'info'} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Konto: <b>{grantLookup.owner.username}</b> (ID gracza #{grantLookup.owner.userId}),
                      rola: {formatRoleForDisplay(grantLookup.owner.role)}
                    </Typography>
                    {grantTargetCharacter && (
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                        Odbiorca: {grantTargetCharacter.name} (ID postaci #{grantTargetCharacter.id})
                        {grantTargetCharacter.level ? `, poziom ${grantTargetCharacter.level}` : ''}
                        {grantTargetCharacter.race ? `, ${getRaceName(grantTargetCharacter.race)}` : ''}
                      </Typography>
                    )}
                  </Alert>

                  {/* Podano ID GRACZA - trzeba jeszcze wskazać, do której postaci. */}
                  {grantLookup.matchedBy === 'user' && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        To jest ID gracza — wybierz postać, która ma dostać przesyłkę:
                      </Typography>
                      {grantLookup.characters.length === 0 ? (
                        <Alert severity="warning">To konto nie ma żadnej postaci.</Alert>
                      ) : (
                        <TextField
                          select
                          fullWidth
                          label="Postać odbiorcy"
                          value={grantTargetCharacter?.id || ''}
                          onChange={(e) => {
                            const picked = grantLookup.characters.find(c => String(c.id) === String(e.target.value));
                            setGrantTargetCharacter(picked || null);
                          }}
                        >
                          {grantLookup.characters.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              {c.name} (#{c.id}) — poziom {c.level}{c.race ? `, ${getRaceName(c.race)}` : ''}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    </Box>
                  )}

                  {grantLookup.owned?.length > 0 && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        Ta postać już ma: {grantLookup.owned.map(o => `${o.quantity}× ${o.name}`).join(', ')}
                      </Typography>
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <TextField
                      select
                      label="Towar"
                      value={grantResourceId}
                      onChange={(e) => setGrantResourceId(e.target.value)}
                      sx={{ minWidth: 280 }}
                    >
                      {grantCatalog.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.name} — {r.origin === 'luxury' ? 'luksus' : 'czarny rynek'} (wycena {Number(r.basePrice).toLocaleString()} z)
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Ilość"
                      type="number"
                      value={grantQuantity}
                      onChange={(e) => setGrantQuantity(Math.max(1, Math.min(grantMaxQuantity, parseInt(e.target.value, 10) || 1)))}
                      inputProps={{ min: 1, max: grantMaxQuantity }}
                      sx={{ width: 140 }}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="Powód / uzasadnienie fabularne"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    placeholder="np. Zapłata od kupca z Zatoki za odzyskany ładunek"
                    multiline
                    rows={2}
                    sx={{ mb: 2 }}
                    helperText="Gracz zobaczy to w dzienniku postaci — napisz tak, żeby dało się to rozegrać"
                  />

                  <Button
                    variant="contained"
                    color="warning"
                    onClick={handleGrantSend}
                    disabled={grantSending || !grantTargetCharacter || !grantResourceId || grantReason.trim().length < 3}
                  >
                    {grantSending
                      ? 'Wysyłam...'
                      : grantTargetCharacter
                        ? `📦 Wyślij do: ${grantTargetCharacter.name} (#${grantTargetCharacter.id})`
                        : '📦 Wyślij przesyłkę'}
                  </Button>

                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Wysyłka jest wiązana z kontem z powyższego podglądu. Jeśli postać należy do
                    innego gracza, niż pokazał podgląd, przesyłka zostanie wstrzymana, a podgląd
                    odświeży się sam. Każda przesyłka trafia do rejestru admina (kto, komu, co,
                    ile i dlaczego).
                  </Alert>
                </>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Sekcja: Blokowanie i Moderacja */}
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Moderacja"
          title="Blokowanie i Moderacja"
          icon={<BlockIcon />}
        />

        <Accordion
          expanded={activeSection === 'blockUser'}
          onChange={() => setActiveSection(activeSection === 'blockUser' ? null : 'blockUser')}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BlockIcon color="secondary" />
              <Typography variant="h6">Zablokuj Gracza</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
        <Box sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Jak to działa:
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Podaj ID postaci lub ID gracza z tabeli users
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • System znajdzie gracza i pokaże jego dane
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Gracz zostanie zablokowany na podaną liczbę dni (realny czas, nie czas z gry!)
            </Typography>
            <Typography variant="body2">
              • Zablokowany gracz nie będzie mógł się zalogować do czasu zakończenia bana
            </Typography>
          </Alert>

          <TextField
            fullWidth
            label="ID Postaci lub ID Gracza"
            type="number"
            value={blockUserId}
            onChange={(e) => setBlockUserId(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Wpisz ID postaci (z characters) lub ID gracza (z users)"
          />

          <Button
            variant="contained"
            color="info"
            onClick={handleFetchUserForBlock}
            disabled={!blockUserId || blockUserLoading}
            sx={{ mb: 2, mr: 2 }}
          >
            {blockUserLoading ? '⏳ Ładowanie...' : '🔍 Znajdź Gracza'}
          </Button>

          {blockUserData && (
            <Card sx={{ mb: 3, borderLeft: theme => `4px solid ${theme.palette.warning.main}` }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: 'warning.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BlockIcon color="warning" />
                  Znaleziono gracza:
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Username: <strong style={{ color: 'inherit' }}>{blockUserData.username}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    User ID: {blockUserData.userId}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Email: {blockUserData.email}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Rola: {formatRoleForDisplay(blockUserData.role)}
                  </Typography>
                </Box>

              {blockUserData.characters && blockUserData.characters.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ color: 'info.main', mb: 1, fontWeight: 'bold' }}>
                    Postacie gracza ({blockUserData.characters.length}):
                  </Typography>
                  {blockUserData.characters.map((char, index) => (
                    <Chip
                      key={index}
                      label={`${char.name} (${getRaceName(char.faction)})`}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </>
              )}

              <Divider sx={{ my: 2 }} />

              <TextField
                fullWidth
                label="Liczba dni blokady (realny czas)"
                type="number"
                value={blockDays}
                onChange={(e) => setBlockDays(e.target.value)}
                sx={{ mb: 2, mt: 2 }}
                placeholder="np. 7, 14, 30..."
                helperText="To są dni w realnym czasie (kalendarzowe), nie dni w grze!"
              />

              <Button
                variant="contained"
                color="secondary"
                onClick={handleBlockUser}
                disabled={blockUserLoading || !blockDays}
                fullWidth
                startIcon={<BlockIcon />}
              >
                {blockUserLoading ? 'Blokowanie...' : `ZABLOKUJ NA ${blockDays || '...'} DNI`}
              </Button>
              </CardContent>
            </Card>
          )}

          {!blockUserData && blockUserId && (
            <Alert severity="info">
              Kliknij "Znajdź Gracza" aby zobaczyć szczegóły przed zablokowaniem
            </Alert>
          )}
        </Box>
          </AccordionDetails>
        </Accordion>

        {/* ZARZĄDZANIE ROLAMI (tylko admin) */}
        {isAdmin && (
        <Accordion
          expanded={activeSection === 'changeRole'}
          onChange={() => setActiveSection(activeSection === 'changeRole' ? null : 'changeRole')}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon color="secondary" />
              <Typography variant="h6">Zarządzanie Rolami</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Dostępne role:
                </Typography>
                <Typography variant="body2">
                  • <strong>mieszkaniec</strong> - podstawowa rola bez specjalnych uprawnień
                </Typography>
                <Typography variant="body2">
                  • <strong>karczmarz</strong> - zarządzanie karczmą, pozwala na wyrzucenie graczy
                </Typography>
                <Typography variant="body2">
                  • <strong>mistrz_gry</strong> - może dodawać newsy i konsekwencje (zdobycze/problemy)
                </Typography>
                <Typography variant="body2">
                  • <strong>admin</strong> - pełny dostęp do panelu administracyjnego
                </Typography>
              </Alert>

              <TextField
                fullWidth
                label="ID Postaci"
                type="number"
                value={roleCharacterId}
                onChange={(e) => setRoleCharacterId(e.target.value)}
                sx={{ mb: 2 }}
                placeholder="Podaj ID postaci (character_id)"
              />

              <Button
                variant="contained"
                color="info"
                onClick={handleFetchRoleData}
                disabled={!roleCharacterId || roleLoading}
                sx={{ mb: 2 }}
              >
                {roleLoading ? '⏳ Ładowanie...' : '📥 Pobierz dane użytkownika'}
              </Button>

              {roleUserData && (
                <Card sx={{ mb: 3, borderLeft: theme => `4px solid ${theme.palette.secondary.main}` }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: 'secondary.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SecurityIcon color="secondary" />
                      Dane użytkownika
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        <strong>Postać:</strong> {roleUserData.characterName} (ID: {roleUserData.characterId})
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        <strong>Właściciel:</strong> {roleUserData.ownerName} (User ID: {roleUserData.userId})
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        <strong>Obecna rola:</strong> <Chip label={roleUserData.currentRole} size="small" color="primary" />
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Wybierz nową rolę:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      {roleUserData.availableRoles && roleUserData.availableRoles.map((role) => (
                        <Chip
                          key={role}
                          // Nazwa czytelna dla człowieka - surowe wartości z bazy
                          // wyglądają jak "mistrz_gry" / "zasluzony".
                          label={formatRoleForDisplay(role)}
                          onClick={() => setSelectedRole(role)}
                          variant={selectedRole === role ? 'filled' : 'outlined'}
                          sx={{
                            cursor: 'pointer',
                            // Wybrana rola wyróżniona akcentem rasy, nie zielenią
                            // MUI - spójnie z resztą przestylowanego panelu.
                            ...(selectedRole === role
                              ? {
                                  bgcolor: `${theme.palette.primary.main}30`,
                                  borderColor: theme.palette.primary.main,
                                  color: appColors.textLight,
                                }
                              : {}),
                          }}
                        />
                      ))}
                    </Box>

                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={handleChangeRole}
                      disabled={roleLoading || selectedRole === roleUserData.currentRole}
                      fullWidth
                      startIcon={<SecurityIcon />}
                    >
                      {roleLoading ? 'Zmienianie...' : `Zmień rolę na "${selectedRole}"`}
                    </Button>

                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Po zmianie roli użytkownik musi się przelogować, aby zmiany weszły w życie.
                    </Alert>
                  </CardContent>
                </Card>
              )}

              {!roleUserData && roleCharacterId && (
                <Alert severity="info">
                  Kliknij "Pobierz dane użytkownika" aby zobaczyć szczegóły
                </Alert>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
        )}
      </Paper>

      {/* Sekcja chorób pogodowych + Tawerna (tylko admin) */}
      {isAdmin && (
      <>
      <WeatherIllnessAdminPanel />

      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Tawerna"
          title="Zarządzanie Pokojami Tawerny"
          icon={<MeetingRoomIcon />}
        />

        <Accordion
          expanded={activeSection === 'tavernRooms'}
          onChange={() => {
            const newState = activeSection === 'tavernRooms' ? null : 'tavernRooms';
            setActiveSection(newState);
            if (newState === 'tavernRooms') {
              handleFetchTavernRooms();
            }
          }}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MeetingRoomIcon color="warning" />
              <Typography variant="h6">Pokoje Tawerny - Blokowanie i Edycja</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Jak to działa:
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • <strong>Dodawanie pokoju:</strong> Utwórz nowy pokój z opcjonalnym ograniczeniem do wybranych rasy
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • <strong>Blokowanie pokoju:</strong> Gracze nie widzą zablokowanego pokoju na liście
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • <strong>Edycja opisu i rasy:</strong> Możesz zmienić nazwę, opis i dostępność dla rasy
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • <strong>Wyrzucanie graczy:</strong> Usuwa wszystkich z pokoju (np. po zniszczeniu w fabule)
                </Typography>
                <Typography variant="body2">
                  • <strong>Usuwanie pokoju:</strong> CAŁKOWICIE usuwa pokój wraz z wiadomościami (nieodwracalne!)
                </Typography>
              </Alert>

              {/* Formularz dodawania nowego pokoju */}
              <Card sx={{ mb: 4, borderLeft: theme => `4px solid ${theme.palette.success.main}` }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: 'success.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon color="success" />
                    Dodaj Nowy Pokój Tawerny
                  </Typography>
                  <TextField
                    fullWidth
                    label="Nazwa pokoju"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="np. Sala Banquetowa, Pokój VIP..."
                  />
                  <TextField
                    fullWidth
                    label="Opis pokoju"
                    multiline
                    rows={3}
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder="np. Elegancka sala dla wybranych gości..."
                  />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Dostępność dla rasy (opcjonalne - jeśli nic nie zaznaczysz, pokój będzie dostępny dla wszystkich):
                  </Typography>
                  <FormGroup sx={{ mb: 2 }}>
                    {races.map((r) => r.key).map((faction) => (
                      <FormControlLabel
                        key={faction}
                        control={
                          <Checkbox
                            checked={newRoomFactions.includes(faction)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewRoomFactions([...newRoomFactions, faction]);
                              } else {
                                setNewRoomFactions(newRoomFactions.filter(f => f !== faction));
                              }
                            }}
                          />
                        }
                        label={getRaceName(faction)}
                      />
                    ))}
                  </FormGroup>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleAddTavernRoom}
                    disabled={!newRoomName.trim()}
                    fullWidth
                    startIcon={<AddIcon />}
                  >
                    Dodaj Pokój
                  </Button>
                </CardContent>
              </Card>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: 'info.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MeetingRoomIcon color="info" />
                  Lista Pokoi Tawerny
                </Typography>
                <Button
                  variant="outlined"
                  color="info"
                  onClick={handleFetchTavernRooms}
                  disabled={tavernRoomsLoading}
                >
                  {tavernRoomsLoading ? 'Ładowanie...' : 'Odśwież'}
                </Button>
              </Box>

              {tavernRoomsLoading ? (
                <Alert severity="info">Ładowanie pokoi...</Alert>
              ) : tavernRooms.length === 0 ? (
                <Alert severity="warning">Brak pokoi w tawernie</Alert>
              ) : (
                tavernRooms.map((room) => (
                  <Card
                    key={room.id}
                    sx={{
                      mb: 2,
                      borderLeft: theme => room.is_active
                        ? `4px solid ${theme.palette.success.main}`
                        : `4px solid ${theme.palette.error.main}`,
                      backgroundColor: theme => room.is_active
                        ? 'background.paper'
                        : `${theme.palette.error.main}10`
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip
                              label={room.is_active ? 'AKTYWNY' : 'ZABLOKOWANY'}
                              color={room.is_active ? 'success' : 'error'}
                              size="small"
                            />
                            <Typography variant="h6" sx={{ color: 'text.primary' }}>
                              {room.name}
                            </Typography>
                            <Chip
                              icon={<PeopleIcon />}
                              label={`${room.active_users_count} graczy`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                            ID: {room.id}
                            {room.required_faction && (
                              <> | Wymagane rasy: {room.required_faction}</>
                            )}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.primary', fontStyle: 'italic' }}>
                            {room.description || 'Brak opisu'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
                          <Tooltip title="Edytuj pokój">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => handleLoadRoomForEdit(room)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Button
                            size="small"
                            variant="contained"
                            color={room.is_active ? 'error' : 'success'}
                            onClick={() => handleToggleTavernRoom(room.id, room.name, room.is_active)}
                          >
                            {room.is_active ? 'Zablokuj' : 'Aktywuj'}
                          </Button>
                          {room.active_users_count > 0 && (
                            <Tooltip title="Wyrzuć wszystkich graczy z pokoju">
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => handleKickAllFromRoom(room.id, room.name)}
                              >
                                Wyrzuć ({room.active_users_count})
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip title="Usuń pokój CAŁKOWICIE">
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleDeleteTavernRoom(room.id, room.name)}
                              startIcon={<DeleteIcon />}
                            >
                              Usuń
                            </Button>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))
              )}

              {editRoomId && (
                <Card sx={{ mt: 3, borderLeft: theme => `4px solid ${theme.palette.warning.main}` }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ color: 'warning.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EditIcon color="warning" />
                      Edytuj Pokój (ID: {editRoomId})
                    </Typography>
                    <TextField
                      fullWidth
                      label="Nazwa pokoju"
                      value={editRoomName}
                      onChange={(e) => setEditRoomName(e.target.value)}
                      sx={{ mb: 2 }}
                      placeholder="np. Główna sala, Pokój prywatny..."
                    />
                    <TextField
                      fullWidth
                      label="Opis pokoju"
                      multiline
                      rows={3}
                      value={editRoomDescription}
                      onChange={(e) => setEditRoomDescription(e.target.value)}
                      sx={{ mb: 2 }}
                      placeholder="np. Pokój tymczasowo niedostępny - remont po zniszczeniach"
                    />
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Dostępność dla rasy (opcjonalne - jeśli nic nie zaznaczysz, pokój będzie dostępny dla wszystkich):
                    </Typography>
                    <FormGroup sx={{ mb: 2 }}>
                      {races.map((r) => r.key).map((faction) => (
                        <FormControlLabel
                          key={faction}
                          control={
                            <Checkbox
                              checked={editRoomFactions.includes(faction)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditRoomFactions([...editRoomFactions, faction]);
                                } else {
                                  setEditRoomFactions(editRoomFactions.filter(f => f !== faction));
                                }
                              }}
                            />
                          }
                          label={getRaceName(faction)}
                        />
                      ))}
                    </FormGroup>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        color="warning"
                        onClick={handleEditTavernRoom}
                        disabled={!editRoomName.trim()}
                        fullWidth
                      >
                        Zapisz Zmiany
                      </Button>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => {
                          setEditRoomId('');
                          setEditRoomName('');
                          setEditRoomDescription('');
                          setEditRoomFactions([]);
                        }}
                        fullWidth
                      >
                        Anuluj
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
      </>
      )}

      {/* Sekcja: Klany / Rodziny (admin + mistrz gry) */}
      <Paper elevation={0} sx={panelSectionSx(theme)}>
        <PanelSectionHeading
          theme={theme}
          eyebrow="Społeczność"
          title="Klany / Rodziny"
          icon={<PeopleIcon />}
        />
        <Accordion
          expanded={activeSection === 'clans'}
          onChange={() => {
            const opening = activeSection !== 'clans';
            setActiveSection(opening ? 'clans' : null);
            if (opening) fetchClans();
          }}
          sx={panelAccordionSx(theme)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="primary" />
              <Typography variant="h6">KLANY / RODZINY</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Klan zakłada administracja i wyznacza głowę klanu (po ID postaci). Głowa oraz mianowani przez nią oficerowie
                mogą zapraszać kolejne postacie z poziomu swojego profilu. Zaproszona postać musi zaakceptować zaproszenie.
              </Alert>

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Nowy klan</Typography>
              <TextField
                fullWidth
                label="Nazwa klanu"
                value={newClanName}
                onChange={(e) => setNewClanName(e.target.value)}
                sx={{ mb: 2 }}
                inputProps={{ maxLength: 100 }}
              />
              <TextField
                fullWidth
                label="Opis (opcjonalnie)"
                value={newClanDescription}
                onChange={(e) => setNewClanDescription(e.target.value)}
                multiline
                minRows={2}
                sx={{ mb: 2 }}
                inputProps={{ maxLength: 2000 }}
              />
              <TextField
                fullWidth
                label="ID postaci — głowa klanu"
                type="number"
                value={newClanHeadId}
                onChange={(e) => setNewClanHeadId(e.target.value)}
                sx={{ mb: 2 }}
                placeholder="np. 42"
              />
              <Button
                variant="contained"
                onClick={handleCreateClan}
                disabled={clanCreating}
                startIcon={<AddIcon />}
                sx={{ mb: 3 }}
              >
                {clanCreating ? 'Tworzenie...' : 'Utwórz klan'}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Istniejące klany</Typography>
              {clansLoading ? (
                <Typography>Ładowanie...</Typography>
              ) : clans.length === 0 ? (
                <Typography sx={{ color: 'text.secondary' }}>Brak klanów.</Typography>
              ) : (
                clans.map((clan) => (
                  <Card key={clan.id} sx={{ mb: 1.5 }}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{clan.name}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Głowa: {clan.head_name || `#${clan.head_character_id}`} · Członków: {clan.member_count}
                        </Typography>
                        {clan.description && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {clan.description}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteClan(clan.id, clan.name)}
                      >
                        Usuń
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Sekcja: Strefa Niebezpieczna (tylko admin) */}
      {isAdmin && (
      <Paper
        elevation={0}
        sx={{
          ...panelSectionSx(theme, { danger: true }),
          // Grubszy pas po lewej niż w zwykłych sekcjach - strefa ma się
          // odróżniać także wtedy, gdy kolory są przygaszone.
          borderLeftWidth: '5px',
          // Ukośne pasy ostrzegawcze na górnej krawędzi - czytelny, "taśmowy"
          // sygnał, nadal w brudnej czerwieni gry, nie w neonie.
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            backgroundImage: `repeating-linear-gradient(45deg, ${appColors.dangerText} 0 8px, transparent 8px 16px)`,
            opacity: 0.85,
          },
        }}
      >
        <PanelSectionHeading
          theme={theme}
          danger
          eyebrow="Operacje nieodwracalne"
          title="Strefa niebezpieczna"
          icon={<SecurityIcon />}
        />

        <Typography variant="body2" sx={{ color: appColors.textPrimary, mb: 2.5 }}>
          Operacje w tej sekcji są <strong>nieodwracalne</strong> i trwale wpływają na dane graczy.
          Nie ma po nich kosza ani cofnięcia - upewnij się, że działasz na właściwym koncie.
        </Typography>

        <Accordion
          expanded={activeSection === 'deleteUser'}
          onChange={() => setActiveSection(activeSection === 'deleteUser' ? null : 'deleteUser')}
          sx={panelAccordionSx(theme, { danger: true })}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <DeleteIcon sx={{ color: `${dangerTextReadable} !important` }} />
              <Typography variant="h6" sx={{ color: dangerTextReadable, letterSpacing: '0.05em' }}>
                Usuń gracza (nieodwracalne)
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
        <Box sx={{ mt: 2 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              UWAGA - OPERACJA NIEODWRACALNA:
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Konto gracza zostanie całkowicie usunięte
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • WSZYSTKIE postacie gracza (główna + poboczne) zostaną usunięte
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Zgłoszenia sesji zostaną usunięte
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Uczestnictwa w sesjach zostaną usunięte
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Prywatne wiadomości gracza będą usunięte
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              • Sesje prywatne gdzie gracz był właścicielem zostaną usunięte
            </Typography>
            <Typography variant="body2">
              • W pozostałych sesjach gracz będzie zastąpiony przez "Bezimienny"
            </Typography>
          </Alert>

          <TextField
            fullWidth
            label="ID Gracza do usunięcia"
            type="number"
            value={deleteUserId}
            onChange={(e) => setDeleteUserId(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="UWAGA: Wpisz ID gracza którego chcesz CAŁKOWICIE usunąć"
          />
          
          <Button 
            variant="contained" 
            color="info"
            onClick={handleFetchUserForDeletion}
            disabled={!deleteUserId || deleteUserLoading}
            sx={{ mb: 2, mr: 2 }}
          >
            {deleteUserLoading ? '⏳ Ładowanie...' : '📋 Podgląd co zostanie usunięte'}
          </Button>

          {userToDelete && (
            <Card sx={{ mb: 3, borderLeft: theme => `4px solid ${theme.palette.info.main}` }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: 'info.main', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DeleteIcon color="info" />
                  Podgląd usuwania gracza: {userToDelete.user} (ID: {deleteUserId})
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Email: {userToDelete.email}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Rasa/Płeć: {getRaceName(userToDelete.race)} / {userToDelete.gender}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Rola: {formatRoleForDisplay(userToDelete.role)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" sx={{ color: 'error.main', mb: 1, fontWeight: 'bold' }}>
                  Zostanie usunięte całkowicie:
                </Typography>
                <Box sx={{ ml: 2, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 0.5 }}>
                    • Konto gracza
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 0.5 }}>
                    • {userToDelete.sentMessages} wysłanych wiadomości prywatnych
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 0.5 }}>
                    • {userToDelete.receivedMessages} otrzymanych wiadomości prywatnych
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary', mb: 0.5 }}>
                    • {userToDelete.ownedPrivateSessions} sesji prywatnych (jako właściciel)
                  </Typography>
                </Box>

                <Typography variant="subtitle2" sx={{ color: 'warning.main', mb: 1, fontWeight: 'bold' }}>
                  Zostanie zamienione na "Bezimienny":
                </Typography>
                <Box sx={{ ml: 2, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    • {userToDelete.sessionMessages} wiadomości w sesjach (treść pozostanie)
                  </Typography>
                </Box>
              
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteUser}
                disabled={deleteUserLoading}
                fullWidth
                startIcon={<DeleteIcon />}
                sx={{ mt: 2 }}
              >
                {deleteUserLoading ? 'Usuwanie...' : 'USUŃ GRACZA DEFINITYWNIE'}
              </Button>
              </CardContent>
            </Card>
          )}

          {!userToDelete && deleteUserId && (
            <Alert severity="info">
              Kliknij "Podgląd co zostanie usunięte" aby zobaczyć szczegóły przed usunięciem
            </Alert>
          )}
        </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
      )}
    </PanelPage>
  );
};

export default AdminPanel;