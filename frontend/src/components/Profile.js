import { useState, useEffect, useRef } from 'react';
import sanitizeHtml from './sanitizeHtml';
import {
  uploadEditorImage,
  validateEditorImage,
  EDITOR_IMAGE_ACCEPT,
  ALLOWED_IMAGE_MIMES,
} from './uploadEditorImage';
import { normalizeYouTubeUrl, parseYouTubeUrl } from './youtubeUrl';
import ConfirmDialog from './ConfirmDialog';
import toast from 'react-hot-toast';
import GameToaster from './GameToaster';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useAuth, formatRoleForDisplay } from './AuthContext';
import {
  Box,
  Typography,
  Paper,
  Button,
  Tabs,
  Tab,
  useMediaQuery,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Stack,
  Popover,
  Slider,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Autocomplete,
} from '@mui/material';

import {
  Edit,
  Check as SaveIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Mail as MailIcon,
  Add as AddIcon,
  PhotoCamera,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  FormatColorText as FormatColorTextIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  FormatColorFill as FormatColorFillIcon,
  FormatQuote as FormatQuoteIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatListNumbered as FormatListNumberedIcon,
  InsertPhoto as InsertPhotoIcon,
  FileUpload as FileUploadIcon,
  Delete as DeleteIcon,
  ReportProblem as ProblemIcon,
  CheckCircle as ApprovedIcon,
  HourglassEmpty as PendingIcon,
  Info as InfoIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  MusicNote as MusicNoteIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon,
  Inventory2 as InventoryIcon,
} from '@mui/icons-material';

// TipTap imports
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { getPlayStyle } from './playStyle';
import useRaceColor from './useRaceColor';
import RaceDivider from './RaceDivider';
import { appColors, getRaceColorSet, frameTintFilter } from './theme';

// ==============================
// STAŁE
// ==============================
const genders = ['Kobieta', 'Mężczyzna'];
const editorColors = ['#0f0f0f', '#f0f0f0', '#a0522d', '#8b0000', '#556b2f', '#483d8b', '#6b7280', '#2f4f4f', '#800080', '#cd853f'];

// Pojedyncze pole danych: mała etykieta NAD wartością (styl karty postaci).
// Wartość (children) może być tekstem albo chipem/elementem.
const Field = ({ label, children }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, minWidth: 0 }}>
      <Typography component="span" sx={{
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: appColors.steelLighter,
        lineHeight: 1.2,
      }}>
        {label}
      </Typography>
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 24,
        minWidth: 0,
        color: theme.palette.text.primary,
        fontSize: '0.92rem',
        fontWeight: 600,
        '& > span': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
      }}>
        {children}
      </Box>
    </Box>
  );
};

// Sekcja z ozdobnym nagłówkiem (eyebrow + linia w kolorze akcentu). Grupuje
// pola w czytelny blok "czystego tekstu" - BEZ tła, ramki i cienia. Jedyną
// dekoracją (i zarazem rozdzielnikiem grup) jest linia przy tytule.
// accent = kolor linii/tytułu.
const InfoSection = ({ title, accent, children }) => {
  const theme = useTheme();
  const line = accent || theme.palette.primary.main;
  // Tytuł sekcji musi być CZYTELNY na ciemnym tle - surowy kolor rasy z bazy
  // (np. ciemna czerwień/coffee wampira) był za ciemny. Bierzemy jego czytelny
  // wariant (rozjaśniony do kontrastu WCAG), a `line` zostaje na dekoracyjnej linii.
  const titleColor = getRaceColorSet(line).accent;
  return (
    <Box sx={{
      position: 'relative',
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
      py: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <Typography component="span" sx={{
          fontSize: '0.64rem',
          fontWeight: 700,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: titleColor,
          whiteSpace: 'nowrap',
        }}>
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${line}99, transparent)` }} />
      </Box>
      {children}
    </Box>
  );
};

// Kolor napisu-etykiety czytelny w OBU motywach. Bez wypełnionego chipa napis
// leży wprost na tle, więc w ciemnym motywie surowy odcień (np. #9b2c2c) bywa
// za ciemny - rozjaśniamy go do kontrastu WCAG (ensureReadableOn w
// getRaceColorSet). W jasnym motywie bazowy odcień jest czytelny na pergaminie.
const readableTagColor = (theme, mainHex) =>
  theme.palette.mode === 'dark' ? getRaceColorSet(mainHex).accent : mainHex;

// Etykieta "plain text" zamiast wypełnionego chipa (ZAAKCEPTOWANA, ADMINISTRATOR,
// rola w klanie). Sam kolorowy, wyraźny napis - bez tła i ramki.
const PlainTag = ({ color, icon, children }) => (
  <Box component="span" sx={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.4,
    color,
    fontWeight: 700,
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '& .MuiSvgIcon-root': { fontSize: '0.95rem' },
  }}>
    {icon}
    {children}
  </Box>
);

const CHARACTER_LIMITS = {
  firstName: 50,
  lastName: 50,
  age: { min: 16, max: 80 },
  height: { min: 140, max: 220 },
  characterDescription: 500,
  visualDescription: 500,
  additionalInfo: 500
};

// ==============================
// FUNKCJE POMOCNICZE
// ==============================
const safeGet = (obj, path, defaultValue = '') => {
  try {
    if (!obj || typeof obj !== 'object') return defaultValue;
    
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result !== null && result !== undefined ? result : defaultValue;
  } catch (error) {
    console.warn('safeGet error:', error, 'path:', path);
    return defaultValue;
  }
};

const safeArray = (value, fallback = []) => {
  try {
    return Array.isArray(value) ? value : fallback;
  } catch (error) {
    console.warn('safeArray error:', error);
    return fallback;
  }
};


const isItemActive = (item) => {
  if (!item.end_date) return true;
  const end = new Date(item.end_date);
  if (Number.isNaN(end.getTime())) return true; // uszkodzona data != wpis do ukrycia
  return end > new Date();
};

// Czy wadę/zaletę w ogóle pokazujemy na karcie postaci.
//
// Filtr dat dotyczy TYLKO wpisów zatwierdzonych - to konsekwencje czasowe
// (choroby, skutki sesji), które po prostu wygasają i mają zniknąć z KP.
// Wpisy NIEZATWIERDZONE (oczekujące i odrzucone do poprawy) są częścią karty
// w trakcie akceptacji i muszą być widoczne zawsze: administracja widzi je w
// kolejce akceptacji KP (panel nie filtruje po datach), więc ukrywanie ich tu
// dawało dokładnie ten rozjazd - admin widział komplet wad/zalet, a na profilu
// część z nich (np. z omyłkowo wpisaną datą końcową) po prostu znikała i nie
// było jak ich poprawić ani usunąć.
const isEntryVisible = (item) => {
  if (!item) return false;
  if (!item.is_approved) return true;
  return isItemActive(item);
};

// Wpis pokazany mimo minionej daty końcowej - oznaczamy go wprost, żeby było
// jasne, dlaczego wisi na karcie.
const isEntryExpired = (item) => Boolean(item && item.end_date) && !isItemActive(item);

// Kolumny start_date/end_date to typ DATE. Formularz edycji trzyma wartość tak,
// jak przyszła z API ("2026-08-01T00:00:00.000Z"), a taki string wysłany z
// powrotem do MySQL-a jest dla kolumny DATE nieprawidłowy (potrafi wylądować
// jako 0000-00-00). Wysyłamy więc zawsze samo YYYY-MM-DD.
const toDateOnly = (value) => {
  if (!value) return null;
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

// Wada/zaleta z datą końcową wcześniejszą niż początkowa to zwykle literówka w
// polu daty - a taki wpis po zatwierdzeniu od razu wygasa i znika z karty.
// Lepiej nie pozwolić go zapisać, niż tłumaczyć potem, gdzie się podział.
const entryDatesError = (entry) => {
  const start = toDateOnly(entry?.start_date);
  const end = toDateOnly(entry?.end_date);
  if (start && end && end < start) {
    return 'Data końcowa nie może być wcześniejsza niż początkowa';
  }
  return null;
};

const formatDate = (dateString) => {
  if (!dateString) return 'Brak daty';
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL');
};

// Etykieta roli w klanie
const clanRoleLabel = (role) => {
  switch (role) {
    case 'head': return 'Głowa klanu';
    case 'officer': return 'Oficer';
    default: return 'Członek';
  }
};

// ==============================
// KOMPONENTY POMOCNICZE
// ==============================
const ToolbarButton = ({ onClick, active, label, children, disabled }) => {
  const theme = useTheme();
  
  return (
    <Tooltip title={label}>
      <IconButton
        onClick={onClick}
        disabled={disabled}
        size="small"
        sx={{
          color: active ? theme.palette.primary.main : theme.palette.text.secondary,
          backgroundColor: active ? `${theme.palette.primary.main}20` : 'transparent',
          border: `1px solid ${active ? theme.palette.primary.main : theme.palette.divider}`,
          borderRadius: 0,
          padding: '6px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: `${theme.palette.primary.main}20`,
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 8px ${theme.palette.primary.main}50`,
          },
          '&:disabled': {
            color: theme.palette.text.secondary,
            borderColor: theme.palette.divider
          }
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );
};
function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width:600px)');
  const race = useRaceColor(); // kolor/ramka wg rasy granej postaci (przyciski nawigacji)

  // Grafiki przycisków przeskoku między profilami (normal + hover) wg rasy.
  // Nakładamy tekst na pustą grafikę; hover przełącza tło na wariant podświetlony.
  const navBtnFrame = race.frame || 'human';
  const navBtnSx = {
    position: 'relative',
    isolation: 'isolate',
    width: { xs: 150, sm: 190 },
    height: { xs: 46, sm: 58 },
    minWidth: 0,
    p: 0,
    border: 'none',
    borderRadius: 0,
    background: 'transparent',
    color: race.accent,

    fontWeight: 'bold',
    fontSize: { xs: '0.8rem', sm: '0.95rem' },
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textShadow: '1px 1px 3px rgba(0,0,0,0.9)',
    lineHeight: 1,
    flexShrink: 0,
    transition: 'transform 0.15s ease',
    // Ramka przycisku (PNG) na ::before z tintem rasowym - filtr NIE dotyka tekstu.
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: -1,
      background: `url(/ui/buttons/nav-${navBtnFrame}-normal.png) center/100% 100% no-repeat`,
      filter: frameTintFilter(navBtnFrame),
    },
    '&:hover::before': {
      background: `url(/ui/buttons/nav-${navBtnFrame}-hover.png) center/100% 100% no-repeat`,
      filter: frameTintFilter(navBtnFrame),
    },
    '&:hover': {
      color: race.accent,
      transform: 'translateY(-2px)',
    },
  };
  const isTablet = useMediaQuery('(max-width:1400px)');
  const fileInputRef = useRef(null);
  
  const [ownerName, setOwnerName] = useState(null);
  const [isDeleted, setIsDeleted] = useState(false);
  
  // STANY
  const [characterData, setCharacterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Usuń',
    confirmColor: 'error',
  });

  // ===== KRADZIEŻ KIESZONKOWA =====
  // `theftStatus` przychodzi z GET /theft/:id/status i mówi tylko, CZY próba jest
  // możliwa (+ powód odmowy). Świadomie bez procentowej szansy - cel ocenia się
  // po statystykach widocznych w jego profilu, a nie po gotowej liczbie.
  const [theftStatus, setTheftStatus] = useState(null);
  const [theftBusy, setTheftBusy] = useState(false);
  const [theftResult, setTheftResult] = useState(null);

  const [ownerCharactersDialog, setOwnerCharactersDialog] = useState(false);
  const [ownerCharacters, setOwnerCharacters] = useState([]);
  const [loadingOwnerCharacters, setLoadingOwnerCharacters] = useState(false);

  // ===== KLAN / RODZINA =====
  const [clanDialogOpen, setClanDialogOpen] = useState(false);
  const [clanData, setClanData] = useState(null); // { clan, members }
  const [loadingClan, setLoadingClan] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [clanActionBusy, setClanActionBusy] = useState(false);
  const [invitationsDialogOpen, setInvitationsDialogOpen] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  const [activeContentTab, setActiveContentTab] = useState('karta-postaci');
  const [customTabs, setCustomTabs] = useState([]);

  // Przedmioty fabularne - spis rzeczy, które postać wygrała w fabule.
  // Dopisuje i kasuje je WYŁĄCZNIE administracja (admin / mistrz gry),
  // właściciel postaci ma je tylko do czytania.
  const [storyItems, setStoryItems] = useState([]);
  const [loadingStoryItems, setLoadingStoryItems] = useState(false);
  // Migracja database/add-story-items.sql jeszcze nie poszła - zakładka ma
  // wtedy powiedzieć administracji, co uruchomić, zamiast udawać pusty spis.
  const [storyItemsMigrationRequired, setStoryItemsMigrationRequired] = useState(false);
  const [showAddStoryItemDialog, setShowAddStoryItemDialog] = useState(false);
  const [newStoryItem, setNewStoryItem] = useState({ name: '', description: '', quantity: 1, source: '' });
  const [editingStoryItem, setEditingStoryItem] = useState(null);
  const [storyItemToDelete, setStoryItemToDelete] = useState(null);
  const [savingStoryItem, setSavingStoryItem] = useState(false);


  const [editingStatus, setEditingStatus] = useState(false);
  const [statusInput, setStatusInput] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [anchorHighlightColor, setAnchorHighlightColor] = useState(null);

  // Rola fabularna - nadawana z ręki przez administrację (rola konta `admin`),
  // gracz jej nie edytuje (inaczej niż status postaci).
  const [editingNarrativeRole, setEditingNarrativeRole] = useState(false);
  const [narrativeRoleInput, setNarrativeRoleInput] = useState('');
  const [savingNarrativeRole, setSavingNarrativeRole] = useState(false);
  const [narrativeRoleError, setNarrativeRoleError] = useState('');

  // Przydomek - działa tak samo jak rola fabularna (gracz go sobie nie wpisuje),
  // tyle że nadaje go administrator LUB mistrz gry.
  const [editingEpithet, setEditingEpithet] = useState(false);
  const [epithetInput, setEpithetInput] = useState('');
  const [savingEpithet, setSavingEpithet] = useState(false);
  const [epithetError, setEpithetError] = useState('');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteAvatarDialogOpen, setDeleteAvatarDialogOpen] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);

  const [races, setRaces] = useState([]);
  // Rasy pochodzą z bazy (dowolna liczba, zdefiniowana w kreatorze instalacyjnym)
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);
  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || 'Brak';
  const getRaceColor = (key) => races.find(r => r.key === key)?.color || null;

  // Klasy postaci (do wyświetlenia nazwy klasy, którą gramy) - jak rasy, z bazy.
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    fetch('/api/classes?includeInactive=1')
      .then(res => res.json())
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania klas:', err));
  }, []);
  const getClassName = (key) => classes.find(c => c.key === key)?.name || key || null;

  // Podpowiedzi wad/zalet z bazy - pobieramy tylko dla administracji (admin/MG),
  // żeby przy dodawaniu z panelu można było wybrać gotową, już istniejącą pozycję.
  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/home/profile/character-card/suggestions', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => (res.ok ? res.json() : { achievements: [], problems: [] }))
      .then(data => setEntrySuggestions({
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        problems: Array.isArray(data.problems) ? data.problems : []
      }))
      .catch(err => console.error('Błąd pobierania podpowiedzi wad/zalet:', err));
  }, [userRole]);

  // NOWE - Popup z powodem odrzucenia
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  // Token konkretnego odrzucenia (reviewed_at) - dzięki niemu KOLEJNE odrzucenie
  // (nowy reviewed_at) znów pokazuje komunikat, nawet jeśli poprzednie było już
  // potwierdzone. Wcześniej flaga była zwykłym 'true' i drugie odrzucenie ginęło.
  const [rejectionToken, setRejectionToken] = useState('');
  
  // Karta postaci
  const [characterCardData, setCharacterCardData] = useState({
    firstName: '',
    lastName: '',
    age: null,
    height: null,
    characterDescription: '',
    visualDescription: '',
    additionalInfo: '',
    isApproved: false,
    achievements: [],
    problems: []
  });
  
  const [editingCharacterCard, setEditingCharacterCard] = useState(false);
  const [savingCharacterCard, setSavingCharacterCard] = useState(false);
  
  // Popup dla GRACZA z odrzuconymi wadami/zaletami (co poprawić)
  const [entryRejectionDialogOpen, setEntryRejectionDialogOpen] = useState(false);
  const [rejectedEntries, setRejectedEntries] = useState([]); // [{ kind, title, reason }]

  // Odrzucanie wady/zalety z komentarzem (admin/MG w profilu)
  const [entryRejectDialogOpen, setEntryRejectDialogOpen] = useState(false);
  const [entryRejectTarget, setEntryRejectTarget] = useState(null); // { type, id, kind, title }
  const [entryRejectReason, setEntryRejectReason] = useState('');

  // Zdobycze i problemy
  const [showAddAchievementDialog, setShowAddAchievementDialog] = useState(false);
  const [showAddProblemDialog, setShowAddProblemDialog] = useState(false);
  // Zasada balansu zalet i wad - dawniej wielki blok tekstu wciśnięty w tryb
  // edycji karty. Teraz siedzi pod ikonką informacji obok nagłówków "Zalety" i
  // "Wady", i tylko dopóki karta nie jest zaakceptowana (patrz
  // canShowEntriesRuleInfo) - po akceptacji nie ma już czego balansować.
  const [showEntriesRuleDialog, setShowEntriesRuleDialog] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [editingProblem, setEditingProblem] = useState(null);
  const [newAchievement, setNewAchievement] = useState({
    title: '',
    description: '',
    level: '',
    start_date: null,
    end_date: null
  });
  const [newProblem, setNewProblem] = useState({
    title: '',
    description: '',
    level: '',
    start_date: null,
    end_date: null
  });
  // Podpowiedzi wad/zalet z bazy (tylko admin/MG) - gotowe pozycje do ponownego
  // użycia przy dodawaniu z panelu. { achievements: [...], problems: [...] }
  const [entrySuggestions, setEntrySuggestions] = useState({ achievements: [], problems: [] });

  const [anchorTextColor, setAnchorTextColor] = useState(null);
  const [imageDialog, setImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageWidth, setImageWidth] = useState(300);
  const [imagePreview, setImagePreview] = useState('');
  const [imageAlign, setImageAlign] = useState('left');
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [showAddTabDialog, setShowAddTabDialog] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [editingTab, setEditingTab] = useState(null);
  const [savingTab, setSavingTab] = useState(false);
  const [tabToDelete, setTabToDelete] = useState(null);

  // YouTube muzyka
  const [youtubeMusicUrl, setYoutubeMusicUrl] = useState('');
  const [editingYoutubeUrl, setEditingYoutubeUrl] = useState(false);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [savingYoutubeUrl, setSavingYoutubeUrl] = useState(false);
  const youtubePlayerRef = useRef(null);
  const [youtubeMusicTitle, setYoutubeMusicTitle] = useState('');
  const [youtubePlayerReady, setYoutubePlayerReady] = useState(false);
  const [youtubeVolume, setYoutubeVolume] = useState(50);
  const [youtubeIsMuted, setYoutubeIsMuted] = useState(true);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [youtubeIsPlaylist, setYoutubeIsPlaylist] = useState(false);
  const [youtubePlaylistIndex, setYoutubePlaylistIndex] = useState(0);
  const savePlaylistIndexTimeoutRef = useRef(null);

  // STYLE QUILL
// Na górze pliku zmień quillStyle:
const quillStyle = {
  
  fontSize: '1rem',
  lineHeight: '1.8',
  color: theme.palette.text.primary,
  '& p': {
    margin: '0.5em 0',
    color: theme.palette.text.primary,
  },
  '& h1, & h2, & h3': {
    color: theme.palette.primary.main,
    
    marginTop: '1em',
    marginBottom: '0.5em',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 'bold',
  },
  '& ul, & ol': {
    paddingLeft: '1.5em',
    color: theme.palette.text.primary
  },
  '& blockquote': {
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    paddingLeft: '1em',
    fontStyle: 'italic',
    color: theme.palette.text.secondary
  },
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: 0,
    margin: '1em 0',
    border: `2px solid ${theme.palette.divider}`,
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'underline',
    '&:hover': {
      color: theme.palette.primary.light,
    }
  }
};

// Pola formularzy przedmiotów fabularnych - ten sam wygląd co w dialogach
// zalet/wad, wyciągnięty do stałej, bo powtarza się w czterech polach razy
// dwa dialogi (dodawanie i edycja).
const storyItemFieldStyle = {
  '& .MuiOutlinedInput-root': {
    color: theme.palette.text.primary,
    borderRadius: 0,
    '& fieldset': { borderColor: theme.palette.divider },
    '&:hover fieldset': { borderColor: theme.palette.primary.main },
    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
  },
  '& .MuiInputLabel-root': {
    color: theme.palette.primary.main,
    '&.Mui-focused': { color: theme.palette.primary.mainLight }
  }
};

// FUNKCJE UPRAWNIEŃ
  
  // Sprawdzamy czy to nasza postać (po ID postaci z AuthContext)
  const isMyCharacter = () => {
    return user?.characterId && characterData && String(characterData.id) === String(user.characterId) && !isDeleted;
  };
  
  // Gracz może edytować kartę gdy nie jest zatwierdzona.
  // Administracja (admin/MG) może pobrać i poprawić kartę DOWOLNEJ postaci,
  // niezależnie od statusu akceptacji (edycja admina nie cofa jej do kolejki).
  const canEditCharacterCard = () => {
    if (userRole === 'admin' || userRole === 'mistrz_gry') return true;
    if (!isMyCharacter()) return false;
    return !characterCardData.isApproved;
  };

  // Czy karta postaci w ogóle istnieje (jest co poprawiać). Pusty stan
  // "Brak karty postaci" pokazuje się dokładnie wtedy, gdy to jest false.
  const hasCharacterCard = () => Boolean(characterCardData.isApproved || characterCardData.firstName);

  // Kartę postaci OD ZERA wypełnia WYŁĄCZNIE właściciel postaci. Administracja
  // poprawia już istniejącą kartę (canEditCharacterCard) oraz dodaje/edytuje
  // wady i zalety, ale nie pisze karty za gracza - stąd osobne uprawnienie na
  // pusty stan "Brak karty postaci". Wcześniej stał tam canEditCharacterCard(),
  // więc admin/MG widział na CUDZEJ postaci przycisk "Wypełnij kartę postaci".
  const canCreateCharacterCard = () => isMyCharacter() && !characterCardData.isApproved;

  const isPrivilegedUser = () => userRole === 'admin' || userRole === 'mistrz_gry';

  // Właściciel wpisuje wady/zalety tylko przy tworzeniu KP. Po jej akceptacji
  // nie może już nic dodawać ani zmieniać - dalej robi to wyłącznie administracja.
  const canOwnerEditEntries = () => isMyCharacter() && !characterCardData.isApproved;

  // Kto może DODAĆ nową wadę/zaletę: admin/MG zawsze; właściciel tylko przed akceptacją KP
  const canAddEntries = () => isPrivilegedUser() || canOwnerEditEntries();

  // Zasada balansu zalet i wad przydaje się tylko przy PIERWSZYM wypełnianiu
  // karty - wtedy gracz (albo administracja poprawiająca jeszcze niezaakceptowaną
  // kartę) rozdaje startowe wpisy. Po akceptacji KP ikonka informacji znika,
  // bo dalej wady i zalety nadaje już wyłącznie administracja z sesji.
  const canShowEntriesRuleInfo = () => !characterCardData.isApproved && canAddEntries();

  // Ikonka informacji przy nagłówkach "Zalety" / "Wady" - otwiera zasadę balansu
  // startowych wpisów. Znika razem z akceptacją karty (canShowEntriesRuleInfo).
  const renderEntriesRuleInfoButton = (color) => {
    if (!canShowEntriesRuleInfo()) return null;

    return (
      <Tooltip title="Zasada balansu zalet i wad przy tworzeniu karty">
        <IconButton
          size="small"
          onClick={() => setShowEntriesRuleDialog(true)}
          sx={{
            color,
            p: 0.25,
            '&:hover': { backgroundColor: `${color}20` }
          }}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  // Czy wpis (wada/zaleta) należy do właściciela: startowe wpisy gracza mają
  // created_by = jego users.id; wpisy sprzed migracji mają created_by = null.
  // Konsekwencje dodane przez administrację mają created_by = id admina/MG.
  // UWAGA: id użytkownika bierzemy z tokena (useAuth), nie z localStorage.
  // localStorage 'userId' nie jest już nigdzie zapisywane (Login.js) od czasu
  // przeniesienia danych do JWT, więc getItem zwracał zawsze null i porównanie
  // wypadało fałszywie - właściciel nie dostawał przycisku edycji przy ŻADNYM
  // swoim wpisie, także po odrzuceniu go przez administrację.
  const isOwnEntry = (entry) => {
    if (entry?.created_by == null) return true;
    return user?.id != null && String(entry.created_by) === String(user.id);
  };

  // Czy zalogowany może edytować/usuwać konkretny wpis: admin/MG zawsze;
  // właściciel może edytować własne (lub sprzed migracji) wpisy, dopóki KP nie
  // jest zaakceptowana — także te już zatwierdzone. Edycja cofa taki wpis do
  // ponownej akceptacji, dzięki czemu tylko ZMIENIONE wady/zalety wracają do
  // kolejki razem z KP. Wpisów administracji gracz nie rusza.
  const canEditEntry = (entry) => isPrivilegedUser() || (canOwnerEditEntries() && isOwnEntry(entry));

  // Każdy może zobaczyć zalety/wady
  const canViewAchievementsProblems = () => true;

  // Właściciel może edytować profil
  
  // Można wysłać wiadomość do innej postaci
  const canSendMessage = () => {
    return user?.characterId && characterData && String(characterData.id) !== String(user.characterId) && safeGet(characterData, 'name') && !isDeleted;
  };
  
  // Właściciel może zmienić avatar
  const canChangeAvatar = () => isMyCharacter();
  
  // Admin może zatwierdzać postacie
  const canApproveCharacters = () => userRole === 'admin' || userRole === 'mistrz_gry';
  
  // Właściciel może edytować status
  const canEditStatus = () => isMyCharacter();

  // Rolę fabularną nadaje TYLKO administracja (rola konta `admin`) - także
  // na cudzych postaciach; właściciel postaci nie może jej sobie ustawić.
  const canEditNarrativeRole = () => userRole === 'admin';

  // Przydomek nadaje administrator LUB mistrz gry (rola fabularna - tylko admin).
  const canEditEpithet = () => isPrivilegedUser();

  // Właściciel może edytować taby
  const canEditTabs = () => isMyCharacter();

  // Przedmioty fabularne dopisuje i zabiera WYŁĄCZNIE administracja (admin/MG) -
  // także na własnej postaci. Gracz ma spis tylko do czytania, żeby nikt nie
  // wpisał sobie sam artefaktu, którego nie wygrał w fabule.
  const canManageStoryItems = () => isPrivilegedUser() && !isDeleted;

  const handleSendMessage = () => {
    // Jak wyżej: id z tokena, nie z nieistniejącego localStorage 'userId'
    // (przez to zabezpieczenie "nie wysyłaj wiadomości do siebie" nigdy nie działało).
    const currentUserId = user?.id;

    if (!characterData || !characterData.id || !characterData.name) {
      console.error('Brak danych postaci');
      return;
    }

    if (String(currentUserId) === String(characterData.user_id)) {
      console.error('Nie możesz wysłać wiadomości do siebie');
      return;
    }

    navigate('/home/messages/new', {
      state: {
        recipientCharacterId: characterData.id,
        recipientName: characterData.name
      }
    });
  };

  // TIPTAP EDITOR
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; border-radius: 0;'
        }
      })
    ],
    content: '',
    editorProps: {
      attributes: {
        style: 'outline: none; min-height: 300px; padding: 1rem;'
      }
    }
  });

  // ZMIENIONE - Ładowanie karty + sprawdzanie odrzucenia
  const loadCurrentCharacterCard = async () => {
    if (!characterData || !characterData.id) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`/api/home/profile/character-card/${characterData.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.card) {
          setCharacterCardData({
            firstName: safeGet(data.card, 'first_name', ''),
            lastName: safeGet(data.card, 'last_name', ''),
            age: safeGet(data.card, 'age', null),
            height: safeGet(data.card, 'height', null),
            characterDescription: safeGet(data.card, 'character_description', ''),
            visualDescription: safeGet(data.card, 'visual_description', ''),
            additionalInfo: safeGet(data.card, 'additional_info', ''),
            isApproved: Boolean(safeGet(data.card, 'is_approved', false)),
            achievements: safeArray(data.card.achievements, []),
            problems: safeArray(data.card.problems, [])
          });
          
          // NOWE - Sprawdź czy karta została odrzucona
          const isRejected = safeGet(data.card, 'isRejected', false);
          const reason = safeGet(data.card, 'rejectionReason', '');
          
          // Tylko właściciel odrzuconej karty - canEditCharacterCard() jest
          // prawdziwe dla całej administracji, więc admin/MG dostawał popup
          // z odrzuceniem cudzej postaci przy każdym wejściu na jej profil.
          if (isRejected && reason && isMyCharacter()) {
            // Token = reviewed_at tego odrzucenia. Każde nowe odrzucenie ma inny
            // (na re-submit ustawiany na NULL), więc kolejne odrzucenie znów się pokaże.
            const token = String(safeGet(data.card, 'reviewed_at', '') || reason);
            const storageKey = `rejection_acknowledged_${characterData.id}`;
            const acknowledged = sessionStorage.getItem(storageKey);

            if (acknowledged !== token) {
              setRejectionReason(reason);
              setRejectionToken(token);
              setRejectionDialogOpen(true);
            }
          }

          // NOWE - Popup z odrzuconymi wadami/zaletami (co poprawić).
          // Pokazujemy właścicielowi, gdy jakaś jego wada/zaleta została odrzucona
          // - ten sam warunek co wyżej, inaczej administracja dostawała popup
          // o cudzych wadach/zaletach.
          if (isMyCharacter()) {
            const rejected = [
              ...safeArray(data.card.achievements, [])
                .filter(a => a.was_rejected)
                .map(a => ({ kind: 'Zaleta', title: a.title, reason: a.rejection_reason || '' })),
              ...safeArray(data.card.problems, [])
                .filter(p => p.was_rejected)
                .map(p => ({ kind: 'Wada', title: p.title, reason: p.rejection_reason || '' }))
            ];

            if (rejected.length > 0) {
              // Token = lista id+updated_at odrzuconych wpisów; zmiana (poprawka)
              // resetuje potwierdzenie, więc po kolejnym odrzuceniu popup wraca.
              const entriesToken = [
                ...safeArray(data.card.achievements, []).filter(a => a.was_rejected).map(a => `a${a.id}:${a.updated_at || ''}`),
                ...safeArray(data.card.problems, []).filter(p => p.was_rejected).map(p => `p${p.id}:${p.updated_at || ''}`)
              ].join('|');
              const entriesKey = `entry_rejection_acknowledged_${characterData.id}`;
              if (sessionStorage.getItem(entriesKey) !== entriesToken) {
                setRejectedEntries(rejected);
                setEntryRejectionDialogOpen(true);
                sessionStorage.setItem(entriesKey, entriesToken);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Błąd ładowania karty postaci:', error);
    }
  };
  


// W useEffect gdzie ładujesz kartę, dodaj:
useEffect(() => {
  if (activeContentTab === 'karta-postaci' && !loading && !notFound && characterData && characterData.id) {
    loadCurrentCharacterCard();
  }
}, [activeContentTab, characterData, loading, notFound]);

  const fetchOwnerCharacters = async (userId) => {
    try {
      setLoadingOwnerCharacters(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/users/${userId}/characters`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOwnerCharacters(data.characters || []);
        setOwnerCharactersDialog(true);
      }
    } catch (error) {
      console.error('Błąd pobierania postaci gracza:', error);
    } finally {
      setLoadingOwnerCharacters(false);
    }
  };

  // ===== KRADZIEŻ KIESZONKOWA - akcje =====

  // Czy w ogóle pokazywać przycisk. Kradzież to zabawa mechaniczna, więc znika
  // dla postaci grających wyłącznie fabularnie - po obu stronach. Ostateczną
  // decyzję i tak podejmuje serwer (routes/theft.js), tu chodzi o to, żeby
  // przycisk nie kusił tam, gdzie nie ma czego szukać.
  const canAttemptTheft = () => {
    if (!user?.characterId || !characterData || isDeleted) return false;
    if (String(characterData.id) === String(user.characterId)) return false;
    const targetStyle = safeGet(characterData, 'playStyle', 'oba');
    return targetStyle !== 'fabularnie';
  };

  const isTargetImprisoned = () => Boolean(safeGet(characterData, 'jailedUntil', null));

  useEffect(() => {
    if (!canAttemptTheft()) {
      setTheftStatus(null);
      return;
    }
    let alive = true;
    const token = localStorage.getItem('token');
    fetch(`/api/theft/${characterData.id}/status?characterId=${user.characterId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setTheftStatus(d); })
      .catch(() => { if (alive) setTheftStatus(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterData?.id, characterData?.playStyle, user?.characterId, isDeleted]);

  const refreshTheftStatus = async (token) => {
    try {
      const r = await fetch(`/api/theft/${characterData.id}/status?characterId=${user.characterId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (r.ok) setTheftStatus(await r.json());
    } catch {
      // Sam status to tylko podpowiedź w dymku - jak nie dojdzie, przycisk
      // zostanie zablokowany i tak przez serwer przy próbie.
    }
  };

  const handleTheft = async () => {
    if (theftBusy) return;
    setTheftBusy(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/theft', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: user.characterId, targetId: characterData.id }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || data.message || 'Próba się nie powiodła');
        return;
      }

      setTheftResult(data);

      // Po skoku stan obu stron się zmienił (złoto, stamina, ewentualna krata),
      // więc odświeżamy profil. Status kradzieży też - żeby dymek pokazał realną
      // godzinę kolejnej próby z dobowego limitu, a nie zgadywany tekst.
      const refreshed = await fetch(`/api/home/profile/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (refreshed.ok) {
        const fresh = await refreshed.json();
        setCharacterData((prev) => (prev ? { ...prev, ...fresh.profileData } : prev));
      }
      await refreshTheftStatus(token);
    } catch (e) {
      console.error('Błąd próby kradzieży:', e);
      toast.error('Błąd połączenia przy próbie kradzieży');
    } finally {
      setTheftBusy(false);
    }
  };

  // ===== KLAN / RODZINA - akcje =====

  // Odśwież tylko pole "clan" w danych postaci (po dołączeniu / opuszczeniu klanu)
  const refreshClanMembership = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        const clan = safeGet(data.profileData, 'clan', null);
        setCharacterData((prev) => (prev ? { ...prev, clan } : prev));
      }
    } catch (e) {
      console.error('Błąd odświeżania klanu:', e);
    }
  };

  const fetchClanDetails = async (targetClanId) => {
    if (!targetClanId) return;
    try {
      setLoadingClan(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clans/${targetClanId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setClanData(await response.json());
      } else {
        toast.error('Nie udało się pobrać danych klanu');
      }
    } catch (e) {
      console.error('Błąd pobierania klanu:', e);
    } finally {
      setLoadingClan(false);
    }
  };

  const openClanDialog = () => {
    const cId = safeGet(characterData, 'clan.id', null);
    if (!cId) return;
    setClanDialogOpen(true);
    fetchClanDetails(cId);
  };

  const handleInviteToClan = async () => {
    const cId = safeGet(characterData, 'clan.id', null);
    if (!cId || !inviteName.trim()) return;
    try {
      setClanActionBusy(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clans/${cId}/invitations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorCharacterId: id, characterName: inviteName.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data.message || 'Zaproszono postać');
        setInviteName('');
      } else {
        toast.error(data.message || 'Nie udało się zaprosić');
      }
    } catch {
      toast.error('Błąd sieci');
    } finally {
      setClanActionBusy(false);
    }
  };

  const handleRemoveMember = async (memberCharacterId) => {
    const cId = safeGet(characterData, 'clan.id', null);
    if (!cId) return;
    try {
      setClanActionBusy(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clans/${cId}/members/${memberCharacterId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorCharacterId: id }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data.message || 'Wykonano');
        const isSelf = String(memberCharacterId) === String(id);
        if (isSelf) {
          setClanDialogOpen(false);
          refreshClanMembership();
        } else {
          fetchClanDetails(cId);
        }
      } else {
        toast.error(data.message || 'Nie udało się');
      }
    } catch {
      toast.error('Błąd sieci');
    } finally {
      setClanActionBusy(false);
    }
  };

  const handleSetMemberRole = async (memberCharacterId, role) => {
    const cId = safeGet(characterData, 'clan.id', null);
    if (!cId) return;
    try {
      setClanActionBusy(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clans/${cId}/members/${memberCharacterId}/role`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorCharacterId: id, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data.message || 'Zmieniono rolę');
        fetchClanDetails(cId);
      } else {
        toast.error(data.message || 'Nie udało się');
      }
    } catch {
      toast.error('Błąd sieci');
    } finally {
      setClanActionBusy(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clans/character/${id}/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setInvitations(safeArray(await response.json(), []));
      }
    } catch (e) {
      console.error('Błąd pobierania zaproszeń:', e);
    } finally {
      setLoadingInvitations(false);
    }
  };

  const handleInvitationResponse = async (invId, action) => {
    try {
      setClanActionBusy(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/clans/invitations/${invId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data.message || 'Wykonano');
        fetchInvitations();
        if (action === 'accept') {
          setInvitationsDialogOpen(false);
          refreshClanMembership();
        }
      } else {
        toast.error(data.message || 'Nie udało się');
      }
    } catch {
      toast.error('Błąd sieci');
    } finally {
      setClanActionBusy(false);
    }
  };

  // Moja rola w klanie aktualnie otwartym w popupie (tylko na własnym profilu)
  const clanMyRole = (
    canEdit &&
    safeGet(characterData, 'clan.id', null) &&
    clanData &&
    String(safeGet(characterData, 'clan.id', '')) === String(safeGet(clanData, 'clan.id', ''))
  ) ? safeGet(characterData, 'clan.role', null) : null;
  const clanIAmManager = clanMyRole === 'head' || clanMyRole === 'officer';

  const fetchCustomTabs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/tabs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomTabs(safeArray(data.tabs, []));
      }
    } catch (error) {
      console.error('Błąd pobierania tabów:', error);
    }
  };

  const fetchStoryItems = async () => {
    if (!id) return;

    try {
      setLoadingStoryItems(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/story-items`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStoryItems(safeArray(data.items, []));
        setStoryItemsMigrationRequired(Boolean(data.migrationRequired));
      }
    } catch (error) {
      console.error('Błąd pobierania przedmiotów fabularnych:', error);
    } finally {
      setLoadingStoryItems(false);
    }
  };

  const handleAddStoryItem = async () => {
    if (!newStoryItem.name.trim()) {
      toast.error('Podaj nazwę przedmiotu');
      return;
    }

    try {
      setSavingStoryItem(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/story-items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newStoryItem)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setShowAddStoryItemDialog(false);
        setNewStoryItem({ name: '', description: '', quantity: 1, source: '' });
        toast.success('Przedmiot dodany');
        fetchStoryItems();
      } else {
        toast.error(data.message || 'Błąd dodawania przedmiotu');
      }
    } catch (error) {
      console.error('Błąd dodawania przedmiotu fabularnego:', error);
      toast.error('Błąd dodawania przedmiotu');
    } finally {
      setSavingStoryItem(false);
    }
  };

  const handleUpdateStoryItem = async () => {
    if (!editingStoryItem) return;
    if (!String(editingStoryItem.name || '').trim()) {
      toast.error('Podaj nazwę przedmiotu');
      return;
    }

    try {
      setSavingStoryItem(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/story-items/${editingStoryItem.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingStoryItem.name,
          description: editingStoryItem.description || '',
          quantity: editingStoryItem.quantity,
          source: editingStoryItem.source || ''
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setEditingStoryItem(null);
        toast.success('Przedmiot zaktualizowany');
        fetchStoryItems();
      } else {
        toast.error(data.message || 'Błąd aktualizacji przedmiotu');
      }
    } catch (error) {
      console.error('Błąd aktualizacji przedmiotu fabularnego:', error);
      toast.error('Błąd aktualizacji przedmiotu');
    } finally {
      setSavingStoryItem(false);
    }
  };

  const handleDeleteStoryItem = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/story-items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setStoryItemToDelete(null);
        toast.success('Przedmiot zabrany');
        fetchStoryItems();
      } else {
        toast.error(data.message || 'Błąd usuwania przedmiotu');
      }
    } catch (error) {
      console.error('Błąd usuwania przedmiotu fabularnego:', error);
      toast.error('Błąd usuwania przedmiotu');
    }
  };

  // Sąsiedni profil liczy BAZA, jednym zapytaniem po kluczu głównym.
  //
  // Wcześniej szukał go tu `while`: pobierał pełny profil dla ID ±1 i przy
  // każdej odpowiedzi innej niż 200 próbował kolejnego ID - do 50 razy. Jedno
  // kliknięcie "NASTĘPNA" wysyłało więc nawet 50 żądań o najcięższy endpoint
  // w grze. Gorzej: 429 z globalnego limitera pętla czytała jako "tej postaci
  // nie ma" i leciała dalej, sama się nakręcając - stąd ciągi
  // /home/profile/45, /46, /47... w logach serwera.
  const goToProfile = async (direction) => {
    const currentId = parseInt(id, 10);
    if (isNaN(currentId)) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(
        `/api/home/profile/${currentId}/neighbor?direction=${direction < 0 ? 'prev' : 'next'}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 404 = koniec listy w tę stronę. Cokolwiek innego (429, 5xx) to błąd,
      // a nie odpowiedź - w obu przypadkach po prostu zostajemy na miejscu.
      if (!response.ok) return;

      const data = await response.json();
      if (data?.id) navigate(`/home/profile/${data.id}`);
    } catch (error) {
      console.error('Błąd szukania sąsiedniego profilu:', error);
    }
  };


  const handleSaveStatus = async () => {
    try {
      setSavingStatus(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/home/profile/${id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: statusInput })
      });

      if (response.ok) {
        setCharacterData({ ...characterData, status: statusInput });
        setEditingStatus(false);
      }
    } catch (error) {
      console.error('Błąd zapisywania statusu:', error);
    } finally {
      setSavingStatus(false);
    }
  };

  // Zapis roli fabularnej - endpoint po stronie backendu jest za `checkAdmin`,
  // więc dla nie-admina po prostu nie ma UI, a próba zapisu wróci 403.
  const handleSaveNarrativeRole = async () => {
    try {
      setSavingNarrativeRole(true);
      setNarrativeRoleError('');
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/home/profile/${id}/narrative-role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ narrativeRole: narrativeRoleInput })
      });

      if (response.ok) {
        const saved = narrativeRoleInput.trim();
        setCharacterData({ ...characterData, narrativeRole: saved });
        setNarrativeRoleInput(saved);
        setEditingNarrativeRole(false);
      } else {
        const data = await response.json().catch(() => ({}));
        setNarrativeRoleError(data.message || 'Nie udało się zapisać roli fabularnej');
      }
    } catch (error) {
      console.error('Błąd zapisywania roli fabularnej:', error);
      setNarrativeRoleError('Nie udało się zapisać roli fabularnej');
    } finally {
      setSavingNarrativeRole(false);
    }
  };

  // Zapis przydomka - endpoint jest za `checkGameMasterOrAdmin`, więc dla
  // zwykłego gracza nie ma UI, a próba zapisu wróci 403.
  const handleSaveEpithet = async () => {
    try {
      setSavingEpithet(true);
      setEpithetError('');
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/home/profile/${id}/epithet`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ epithet: epithetInput })
      });

      if (response.ok) {
        const saved = epithetInput.trim();
        setCharacterData({ ...characterData, epithet: saved });
        setEpithetInput(saved);
        setEditingEpithet(false);
      } else {
        const data = await response.json().catch(() => ({}));
        setEpithetError(data.message || 'Nie udało się zapisać przydomka');
      }
    } catch (error) {
      console.error('Błąd zapisywania przydomka:', error);
      setEpithetError('Nie udało się zapisać przydomka');
    } finally {
      setSavingEpithet(false);
    }
  };

  const handleSaveYoutubeUrl = async () => {
    try {
      setSavingYoutubeUrl(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/home/profile/${id}/youtube-music`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ youtube_music_url: youtubeUrlInput })
      });

      if (response.ok) {
        setYoutubeMusicUrl(youtubeUrlInput);
        setCharacterData({ ...characterData, youtube_music_url: youtubeUrlInput });
        setEditingYoutubeUrl(false);
        toast.success('Link do muzyki zaktualizowany!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Błąd zapisywania linku');
      }
    } catch (error) {
      console.error('Błąd zapisywania linku YouTube:', error);
      toast.error('Błąd zapisywania linku');
    } finally {
      setSavingYoutubeUrl(false);
    }
  };

  // YouTube Player - funkcje kontroli
  const handleYoutubePlayPause = () => {
    if (!youtubePlayerRef.current || !youtubePlayerReady) return;

    try {
      if (youtubePlaying) {
        youtubePlayerRef.current.pauseVideo();
        setYoutubePlaying(false);
      } else {
        // Automatycznie odcisz i ustaw głośność przy odtwarzaniu
        if (youtubeIsMuted) {
          youtubePlayerRef.current.unMute();
          setYoutubeIsMuted(false);
          // Jeśli volume jest na 0, ustaw na rozsądną wartość
          if (youtubeVolume === 0) {
            const defaultVolume = 50;
            youtubePlayerRef.current.setVolume(defaultVolume);
            setYoutubeVolume(defaultVolume);
          }
        }
        youtubePlayerRef.current.playVideo();
        setYoutubePlaying(true);
      }
    } catch (e) {
      console.error('Błąd play/pause:', e);
    }
  };

  const handleYoutubeVolumeChange = (event, newValue) => {
    if (!youtubePlayerRef.current || !youtubePlayerReady) return;

    try {
      setYoutubeVolume(newValue);
      youtubePlayerRef.current.setVolume(newValue);
      if (newValue > 0 && youtubeIsMuted) {
        youtubePlayerRef.current.unMute();
        setYoutubeIsMuted(false);
      }
    } catch (e) {
      console.error('Błąd zmiany głośności:', e);
    }
  };

  const handleYoutubeMuteToggle = () => {
    if (!youtubePlayerRef.current || !youtubePlayerReady) return;

    try {
      if (youtubeIsMuted) {
        youtubePlayerRef.current.unMute();
        setYoutubeIsMuted(false);
      } else {
        youtubePlayerRef.current.mute();
        setYoutubeIsMuted(true);
      }
    } catch (e) {
      console.error('Błąd mute/unmute:', e);
    }
  };

  const handleYoutubeNextTrack = () => {
    if (!youtubePlayerRef.current || !youtubePlayerReady || !youtubeIsPlaylist) return;

    try {
      youtubePlayerRef.current.nextVideo();
    } catch (e) {
      console.error('Błąd przejścia do następnego utworu:', e);
    }
  };

  const handleYoutubePreviousTrack = () => {
    if (!youtubePlayerRef.current || !youtubePlayerReady || !youtubeIsPlaylist) return;

    try {
      youtubePlayerRef.current.previousVideo();
    } catch (e) {
      console.error('Błąd przejścia do poprzedniego utworu:', e);
    }
  };

  // Zapisz indeks playlisty do backendu (z debounce)
  const savePlaylistIndexToBackend = (index) => {
    // Tylko jeśli to mój profil (canEdit)
    if (!canEdit) return;

    // Anuluj poprzednie wywołanie
    if (savePlaylistIndexTimeoutRef.current) {
      clearTimeout(savePlaylistIndexTimeoutRef.current);
    }

    // Ustaw nowe wywołanie z opóźnieniem 2 sekundy
    savePlaylistIndexTimeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        await fetch(`/api/home/profile/${id}/youtube-playlist-index`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ youtube_playlist_index: index })
        });
      } catch (error) {
        console.error('Błąd zapisywania indeksu playlisty:', error);
      }
    }, 2000);
  };

  const handleSaveCharacterCard = async () => {
    if (!characterCardData.firstName.trim()) {
      toast.error('Imię jest wymagane');
      return;
    }
    
    if (characterCardData.age && characterCardData.age < 1) {
      toast.error('Podaj prawidłowy wiek postaci');
      return;
    }
    
    if (characterCardData.height && (characterCardData.height < CHARACTER_LIMITS.height.min || characterCardData.height > CHARACTER_LIMITS.height.max)) {
      toast.error(`Wzrost musi być między ${CHARACTER_LIMITS.height.min} a ${CHARACTER_LIMITS.height.max} cm`);
      return;
    }

    try {
      setSavingCharacterCard(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/home/profile/character-card/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: characterCardData.firstName,
          last_name: characterCardData.lastName,
          age: characterCardData.age,
          height: characterCardData.height,
          character_description: characterCardData.characterDescription,
          visual_description: characterCardData.visualDescription,
          additional_info: characterCardData.additionalInfo
        })
      });

      if (response.ok) {
        // Edycja admina/MG nie cofa karty do kolejki; edycja gracza tak.
        setCharacterCardData({
          ...characterCardData,
          isApproved: isPrivilegedUser() ? characterCardData.isApproved : false
        });
        setEditingCharacterCard(false);
        toast.success(isPrivilegedUser() ? 'Karta postaci zaktualizowana' : 'Karta postaci wysłana do zatwierdzenia przez administrację');
        loadCurrentCharacterCard();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Błąd zapisywania karty postaci');
      }
    } catch (error) {
      console.error('Błąd zapisywania karty postaci:', error);
      toast.error('Błąd zapisywania karty postaci');
    } finally {
      setSavingCharacterCard(false);
    }
  };

const handleAvatarUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = EDITOR_IMAGE_ACCEPT;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Backend przyjmuje tylko PNG/JPG/GIF/WEBP - bez tej kontroli user dostawał
    // dopiero błąd z serwera (albo, przy pliku spoza filtra, nic).
    if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
      toast.error('Dozwolone formaty obrazów: PNG, JPG, GIF, WEBP');
      return;
    }

    if (file.size > 200 * 1024) {  // limit avatara z backendu
      toast.error('Plik za duży (max 200KB)');
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/characters/${id}/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setCharacterData({ ...characterData, avatar: data.avatarPath || data.avatar });
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Błąd uploadu avatara');
      }
    } catch (error) {
      console.error('Błąd uploadu avatara:', error);
      toast.error('Błąd uploadu avatara');
    } finally {
      setUploadingAvatar(false);
    }
  };
  input.click();
};

const handleDeleteAvatar = async () => {
  try {
    setDeletingAvatar(true);
    setDeleteAvatarDialogOpen(false);

    const token = localStorage.getItem('token');
    const response = await fetch(`/api/characters/${id}/avatar`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      setCharacterData({ ...characterData, avatar: null });
      toast.success('Avatar usunięty pomyślnie');
    } else {
      const errorData = await response.json();
      toast.error(errorData.message || 'Błąd usuwania avatara');
    }
  } catch (error) {
    console.error('Błąd usuwania avatara:', error);
    toast.error('Błąd usuwania avatara');
  } finally {
    setDeletingAvatar(false);
  }
};

  const handleAddTab = async () => {
    if (!newTabName.trim()) {
      toast.error('Podaj nazwę zakładki');
      return;
    }
    if (customTabs.length >= 3) {
      toast.error('Max 3 zakładki');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/tabs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tab_name: newTabName.trim(), tab_content: '' })
      });

      if (response.ok) {
        setNewTabName('');
        setShowAddTabDialog(false);
        fetchCustomTabs();
      }
    } catch (error) {
      console.error('Błąd dodawania zakładki:', error);
    }
  };

  const handleEditTab = (tab) => {
    setEditingTab(tab);
    if (editor) {
      editor.commands.setContent(tab.tab_content || '');
    }
  };

  const handleSaveTab = async () => {
    if (!editingTab || !editor) return;

    try {
      setSavingTab(true);
      const token = localStorage.getItem('token');
      const content = editor.getHTML();

      const response = await fetch(`/api/home/profile/${id}/tabs/${editingTab.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tab_name: editingTab.tab_name, tab_content: content })
      });

      if (response.ok) {
        setEditingTab(null);
        fetchCustomTabs();
      }
    } catch (error) {
      console.error('Błąd zapisywania zakładki:', error);
    } finally {
      setSavingTab(false);
    }
  };

  const handleDeleteTab = async (tabId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/${id}/tabs/${tabId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setTabToDelete(null);
        fetchCustomTabs();
        if (activeContentTab === `tab-${tabId}`) {
          setActiveContentTab('karta-postaci');
        }
      }
    } catch (error) {
      console.error('Błąd usuwania zakładki:', error);
    }
  };

  const handleAddAchievement = async () => {
    if (!newAchievement.title.trim()) {
      toast.error('Podaj tytuł zalety');
      return;
    }

    const datesError = entryDatesError(newAchievement);
    if (datesError) {
      toast.error(datesError);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/achievements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newAchievement,
          start_date: toDateOnly(newAchievement.start_date),
          end_date: toDateOnly(newAchievement.end_date)
        })
      });

      if (response.ok) {
        setShowAddAchievementDialog(false);
        setNewAchievement({ title: '', description: '', level: '', start_date: null, end_date: null });
        loadCurrentCharacterCard();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message || 'Błąd dodawania zalety');
      }
    } catch (error) {
      console.error('Błąd dodawania zalety:', error);
    }
  };

  const handleUpdateAchievement = async (achievementId, updates) => {
    const datesError = entryDatesError(updates);
    if (datesError) {
      toast.error(datesError);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/achievements/${achievementId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updates,
          start_date: toDateOnly(updates.start_date),
          end_date: toDateOnly(updates.end_date)
        })
      });

      if (response.ok) {
        setEditingAchievement(null);
        loadCurrentCharacterCard();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message || 'Błąd aktualizacji zalety');
      }
    } catch (error) {
      console.error('Błąd aktualizacji zalety:', error);
    }
  };

  const handleDeleteAchievement = async (achievementId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/achievements/${achievementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Bez zamknięcia dialogu edycji zostawał on otwarty na już usuniętym
        // wpisie - wyglądało to, jakby "usuń" nic nie zrobiło.
        setEditingAchievement(null);
        toast.success('Zaleta usunięta');
        loadCurrentCharacterCard();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message || 'Błąd usuwania zalety');
      }
    } catch (error) {
      console.error('Błąd usuwania zdobyczy:', error);
      toast.error('Błąd sieci podczas usuwania zalety');
    }
  };

  // Admin/MG: zatwierdzenie pojedynczej wady/zalety (type: 'achievements' | 'problems')
  const handleApproveEntry = async (type, entryId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/${type}/${entryId}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data.message || 'Zaakceptowano');
        loadCurrentCharacterCard();
      } else {
        toast.error(data.message || 'Nie udało się zaakceptować');
      }
    } catch {
      toast.error('Błąd sieci');
    }
  };

  // Admin/MG: otwarcie okna odrzucenia wady/zalety z komentarzem
  const openEntryRejectDialog = (type, entry) => {
    setEntryRejectTarget({
      type,
      id: entry.id,
      kind: type === 'problems' ? 'Wada' : 'Zaleta',
      title: entry.title
    });
    setEntryRejectReason('');
    setEntryRejectDialogOpen(true);
  };

  // Admin/MG: odrzucenie wady/zalety - wpis zostaje z komentarzem, wraca do gracza
  const handleEntryRejectConfirm = async () => {
    if (!entryRejectTarget) return;
    if (!entryRejectReason.trim()) {
      toast.error('Podaj powód odrzucenia');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const { type, id: entryId } = entryRejectTarget;
      const response = await fetch(`/api/home/profile/character-card/${id}/${type}/${entryId}/reject`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_reason: entryRejectReason.trim() })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success(data.message || 'Odrzucono');
        setEntryRejectDialogOpen(false);
        setEntryRejectTarget(null);
        setEntryRejectReason('');
        loadCurrentCharacterCard();
      } else {
        toast.error(data.message || 'Nie udało się odrzucić');
      }
    } catch {
      toast.error('Błąd sieci');
    }
  };

  const handleAddProblem = async () => {
    if (!newProblem.title.trim()) {
      toast.error('Podaj tytuł wady');
      return;
    }

    const datesError = entryDatesError(newProblem);
    if (datesError) {
      toast.error(datesError);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/problems`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newProblem,
          start_date: toDateOnly(newProblem.start_date),
          end_date: toDateOnly(newProblem.end_date)
        })
      });

      if (response.ok) {
        setShowAddProblemDialog(false);
        setNewProblem({ title: '', description: '', level: '', start_date: null, end_date: null });
        loadCurrentCharacterCard();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message || 'Błąd dodawania wady');
      }
    } catch (error) {
      console.error('Błąd dodawania wady:', error);
    }
  };

  const handleUpdateProblem = async (problemId, updates) => {
    const datesError = entryDatesError(updates);
    if (datesError) {
      toast.error(datesError);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/problems/${problemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updates,
          start_date: toDateOnly(updates.start_date),
          end_date: toDateOnly(updates.end_date)
        })
      });

      if (response.ok) {
        setEditingProblem(null);
        loadCurrentCharacterCard();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message || 'Błąd aktualizacji wady');
      }
    } catch (error) {
      console.error('Błąd aktualizacji wady:', error);
    }
  };

  const handleDeleteProblem = async (problemId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home/profile/character-card/${id}/problems/${problemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Jak przy zalecie - dialog edycji musi się zamknąć po usunięciu wpisu.
        setEditingProblem(null);
        toast.success('Wada usunięta');
        loadCurrentCharacterCard();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.message || 'Błąd usuwania wady');
      }
    } catch (error) {
      console.error('Błąd usuwania problemu:', error);
      toast.error('Błąd sieci podczas usuwania wady');
    }
  };

  const addImage = () => {
    const url = window.prompt('Podaj URL obrazka:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

const handleFileSelect = (event) => {
  const file = event.target.files[0];

  // Reset inputa od razu - inaczej wybranie tego samego pliku drugi raz
  // (np. po błędzie) nie odpala już zdarzenia change.
  event.target.value = '';

  if (!file) return;

  // Format i rozmiar sprawdzamy tymi samymi regułami co backend.
  const validationError = validateEditorImage(file);
  if (validationError) {
    toast.error(validationError);
    return;
  }

  setSelectedImage(file);
  const reader = new FileReader();
  reader.onload = (e) => {
    setImagePreview(e.target.result);
    setImageDialog(true);
  };
  reader.readAsDataURL(file);
};

  const handleCloseImageDialog = () => {
    setImageDialog(false);
    setSelectedImage(null);
    setImagePreview('');
    setImageWidth(300);
    setImageAlign('left');
  };

  const insertImageFromFile = async () => {
    if (!selectedImage || !editor) return;

    try {
      setUploadingImage(true);

      const imageUrl = await uploadEditorImage(selectedImage);

      editor.chain().focus().setImage({
        src: imageUrl,
        style: `width: ${imageWidth}px; display: block; margin: 1em ${imageAlign === 'center' ? 'auto' : imageAlign === 'right' ? '0 0 0 auto' : '0'};`
      }).run();

      handleCloseImageDialog();
    } catch (error) {
      console.error('Błąd uploadu obrazka:', error);
      toast.error(error.message || 'Błąd wysyłania obrazka');
    } finally {
      setUploadingImage(false);
    }
  };

  // NOWE - Handler do potwierdzenia przeczytania powodu odrzucenia
  const handleAcknowledgeRejection = () => {
    const storageKey = `rejection_acknowledged_${characterData.id}`;
    // Zapisz token TEGO odrzucenia - kolejne (inny reviewed_at) znów się pokaże.
    sessionStorage.setItem(storageKey, rejectionToken || 'true');
    setRejectionDialogOpen(false);
  };

  // USEEFFECTS
useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setNotFound(false);

    fetch(`/api/home/profile/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          setCharacterData(null);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.profileData) {
          const safeCharacterData = {
            name: safeGet(data.profileData, 'user', '') || safeGet(data.profileData, 'name', ''),
            race: safeGet(data.profileData, 'race', ''),
            gender: safeGet(data.profileData, 'gender', ''),
            age: safeGet(data.profileData, 'age', null),
            faction: safeGet(data.profileData, 'faction', ''),
            class: safeGet(data.profileData, 'class', ''),
            avatar: safeGet(data.profileData, 'avatar', ''),
            status: safeGet(data.profileData, 'status', ''),
            narrativeRole: safeGet(data.profileData, 'narrativeRole', ''),
            epithet: safeGet(data.profileData, 'epithet', ''),
            playStyle: safeGet(data.profileData, 'playStyle', 'oba'),
            youtube_music_url: safeGet(data.profileData, 'youtube_music_url', ''),
            approved: Boolean(safeGet(data.profileData, 'approved', false)),
            user_id: safeGet(data.profileData, 'user_id', null),  // KLUCZOWE
            id: safeGet(data.profileData, 'id', id),
            role: safeGet(data.profileData, 'userRole', 'mieszkaniec'),
            isProfileApproved: Boolean(safeGet(data.profileData, 'isProfileApproved', false)),
            clan: safeGet(data.profileData, 'clan', null),
          };

          setCharacterData(safeCharacterData);
          setStatusInput(safeCharacterData.status);
          setNarrativeRoleInput(safeCharacterData.narrativeRole || '');
          setEpithetInput(safeCharacterData.epithet || '');
          setYoutubeMusicUrl(safeCharacterData.youtube_music_url || '');
          setYoutubeUrlInput(safeCharacterData.youtube_music_url || '');
          setYoutubePlaylistIndex(safeCharacterData.youtube_playlist_index || 0);
          setCanEdit(Boolean(data.editable));
          
          // ZMIENIONE - userRole to rola ZALOGOWANEGO użytkownika
          setUserRole(safeGet(data.profileData, 'currentUserRole', null));
          
          setOwnerName(safeGet(data.profileData, 'owner_name', null));
          setIsDeleted(Boolean(safeGet(data.profileData, 'is_deleted', false)));

          fetchCustomTabs();
          fetchStoryItems();
        }
      })
      .catch((err) => {
        console.error('Error loading character:', err);
        setError(err.message || 'Błąd ładowania danych postaci');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, navigate]);

  useEffect(() => {
    if (activeContentTab === 'karta-postaci' && !loading && !notFound && characterData && characterData.id) {
      loadCurrentCharacterCard();
    }
  }, [activeContentTab, characterData, loading, notFound]);

  useEffect(() => {
    setActiveContentTab('karta-postaci');
    setEditingStatus(false);
    setEditingNarrativeRole(false);
    setNarrativeRoleError('');
    setEditingEpithet(false);
    setEpithetError('');
    setEditingCharacterCard(false);
    // Bez czyszczenia spis poprzedniej postaci mignąłby na profilu następnej,
    // zanim fetchStoryItems zdąży odpowiedzieć.
    setStoryItems([]);
    setStoryItemsMigrationRequired(false);
    setShowAddStoryItemDialog(false);
    setEditingStoryItem(null);
    setStoryItemToDelete(null);
  }, [id]);

  // Pobierz oczekujące zaproszenia do klanu, gdy to moja własna postać
  useEffect(() => {
    if (canEdit && id) {
      fetchInvitations();
    } else {
      setInvitations([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, id]);

  useEffect(() => {
    if (characterData) {
      setStatusInput(safeGet(characterData, 'status', ''));
      // Pole edycji roli fabularnej trzymamy w zgodzie z danymi, ale NIE
      // zamykamy tu edytora - inaczej zapis statusu (też ustawia characterData)
      // wyrzucałby admina z wpisywania roli.
      if (!editingNarrativeRole) {
        setNarrativeRoleInput(safeGet(characterData, 'narrativeRole', ''));
      }
      if (!editingEpithet) {
        setEpithetInput(safeGet(characterData, 'epithet', ''));
      }
    }
    setEditingStatus(false);
  }, [characterData]);

  // YouTube IFrame API - załaduj skrypt
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // YouTube Player - inicjalizacja gdy URL się zmieni
  useEffect(() => {
    if (!youtubeMusicUrl || !id) return;

    const normalizedUrl = normalizeYouTubeUrl(youtubeMusicUrl);
    const parsedUrl = parseYouTubeUrl(normalizedUrl);
    if (!parsedUrl) return;

    // Ustaw stan czy to playlista
    setYoutubeIsPlaylist(parsedUrl.type === 'playlist');

    // Odczytaj preferencje z localStorage dla tego profilu
    const storageKey = `youtube_player_${id}`;
    const savedPrefs = localStorage.getItem(storageKey);
    let prefs = { volume: 50, muted: true, playing: false, playlistIndex: 0 };

    if (savedPrefs) {
      try {
        prefs = JSON.parse(savedPrefs);
      } catch (e) {
        console.error('Błąd parsowania preferencji YouTube:', e);
      }
    }

    setYoutubeVolume(prefs.volume || 50);
    setYoutubeIsMuted(prefs.muted !== false);
    setYoutubePlaying(prefs.playing === true);

    // Użyj indeksu z localStorage jeśli nie ma go jeszcze z backendu
    const savedPlaylistIndex = prefs.playlistIndex || 0;
    if (savedPlaylistIndex > 0 && youtubePlaylistIndex === 0) {
      setYoutubePlaylistIndex(savedPlaylistIndex);
    }

    // Inicjalizacja playera
    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        // Usuń stary player jeśli istnieje
        if (youtubePlayerRef.current) {
          try {
            youtubePlayerRef.current.destroy();
          } catch (e) {
            console.error('Błąd niszczenia playera:', e);
          }
        }

        // Konfiguracja w zależności od typu (video vs playlist)
        const playerConfig = {
          height: '0',
          width: '0',
          playerVars: {
            autoplay: prefs.playing ? 1 : 0,
            controls: 0,
            loop: 1
          },
          events: {
            onReady: (event) => {
              setYoutubePlayerReady(true);
              event.target.setVolume(prefs.volume || 50);
              if (prefs.muted !== false) {
                event.target.mute();
              } else {
                event.target.unMute();
              }

              // Jeśli to playlista i jest zapisany indeks > 0, ustaw go
              const playlistIndexToUse = prefs.playlistIndex || 0;
              if (parsedUrl.type === 'playlist' && playlistIndexToUse > 0) {
                try {
                  event.target.playVideoAt(playlistIndexToUse);
                } catch (e) {
                  console.error('Błąd ustawiania indeksu playlisty:', e);
                }
              }

              // Pobierz tytuł
              try {
                const iframe = event.target.getIframe();
                if (iframe && iframe.contentWindow) {
                  const title = event.target.getVideoData().title;
                  setYoutubeMusicTitle(title || (parsedUrl.type === 'playlist' ? 'Playlista' : 'Muzyka profilu'));
                }
              } catch {
                setYoutubeMusicTitle(parsedUrl.type === 'playlist' ? 'Playlista' : 'Muzyka profilu');
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setYoutubePlaying(true);
                // Aktualizuj tytuł przy każdej zmianie utworu
                try {
                  const title = event.target.getVideoData().title;
                  if (title) {
                    setYoutubeMusicTitle(title);
                  }
                } catch (e) {
                  console.error('Błąd pobierania tytułu:', e);
                }

                // Jeśli to playlista, sprawdź i zapisz aktualny indeks
                if (parsedUrl.type === 'playlist') {
                  try {
                    const currentIndex = event.target.getPlaylistIndex();
                    if (currentIndex !== null && currentIndex !== undefined && currentIndex >= 0) {
                      setYoutubePlaylistIndex(currentIndex);
                      savePlaylistIndexToBackend(currentIndex);
                    }
                  } catch (e) {
                    console.error('Błąd pobierania indeksu playlisty:', e);
                  }
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setYoutubePlaying(false);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                // Zapętlenie - uruchom ponownie odtwarzanie
                try {
                  event.target.playVideo();
                } catch (e) {
                  console.error('Błąd przy wznowieniu odtwarzania:', e);
                }
              }
            }
          }
        };

        // Ustaw odpowiednie parametry w zależności od typu
        if (parsedUrl.type === 'playlist') {
          // Dla playlist
          playerConfig.playerVars.listType = 'playlist';
          playerConfig.playerVars.list = parsedUrl.id;
        } else {
          // Dla pojedynczego video
          playerConfig.videoId = parsedUrl.id;
          playerConfig.playerVars.playlist = parsedUrl.id; // Potrzebne dla loop
        }

        youtubePlayerRef.current = new window.YT.Player(`youtube-player-${id}`, playerConfig);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          console.error('Błąd niszczenia playera przy unmount:', e);
        }
      }
    };
  }, [youtubeMusicUrl, id]);

  // Zapisz preferencje do localStorage
  useEffect(() => {
    if (!id) return;

    const storageKey = `youtube_player_${id}`;
    const prefs = {
      volume: youtubeVolume,
      muted: youtubeIsMuted,
      playing: youtubePlaying,
      playlistIndex: youtubePlaylistIndex
    };

    localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [youtubeVolume, youtubeIsMuted, youtubePlaying, youtubePlaylistIndex, id]);

  // LOADING
  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
      }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} size={60} />
      </Box>
    );
  }

  // NOT FOUND
  if (notFound || !characterData) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ color: theme.palette.primary.light, mb: 2 }}>
          ❌ NIE ZNALEZIONO POSTACI (ID: {id})
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
          <Button variant="outlined" onClick={() => goToProfile(-1)}>POPRZEDNIA</Button>
          <Button variant="outlined" onClick={() => goToProfile(1)}>NASTĘPNA</Button>
        </Box>
      </Paper>
    );
  }

  // ==============================
// GŁÓWNY RENDER
// ==============================
return (
<Paper sx={{
  display: 'flex',
  flexDirection: 'column',
  p: 3,
  color: theme.palette.text.primary,
  width: '100%',
  // Przezroczyste tło + brak ramki - kamienna tekstura i ozdobna ramka rasowa
  // z panelu głównego (Home) prześwitują przez stronę profilu.
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 0,
  boxShadow: 'none'
}}>

{/* NAWIGACJA MIĘDZY PROFILAMI + IMIĘ */}
<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
  <Button disableRipple sx={navBtnSx} onClick={() => goToProfile(-1)}>
    Poprzednia
  </Button>

  {/* IMIĘ POSTACI - ozdobne linie rasowe: górna z symbolem (top), dolna bez (bottom) */}
  <Box sx={{ flexGrow: 1, textAlign: 'center', px: 2 }}>
    <RaceDivider variant="top" frame={navBtnFrame} />
    <Typography sx={{
      
      color: theme.palette.primary.main,
      fontWeight: 'bold',
      fontSize: isMobile ? '1.3rem' : '1.6rem',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      py: 0.5,
    }}>
      {safeGet(characterData, 'name', 'NIEZNANA POSTAĆ')}
    </Typography>
    <RaceDivider variant="bottom" frame={navBtnFrame} />
  </Box>

  <Button disableRipple sx={navBtnSx} onClick={() => goToProfile(1)}>
    Następna
  </Button>
</Box>

{/* OSTRZEŻENIE - KARTA OCZEKUJE */}
{!characterCardData.isApproved && characterCardData.firstName && (
  <Box sx={{ 
    mb: 3, 
    p: 2, 
    backgroundColor: `${theme.palette.error.main}15`,  // ZMNIEJSZONE
    border: `2px solid ${theme.palette.error.main}`, 
    borderRadius: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 2
  }}>
    <PendingIcon sx={{ color: theme.palette.error.text, fontSize: '2rem' }} />
    <Typography sx={{ 
      color: theme.palette.error.text, 
      fontWeight: 'bold', 
      fontSize: '1.1rem',
      
      textTransform: 'uppercase'
    }}>
      ⏳ KARTA POSTACI OCZEKUJE NA AKCEPTACJĘ
    </Typography>
  </Box>
)}

{/* OSTRZEŻENIE O USUNIĘTEJ POSTACI */}
{isDeleted && (
  <Box sx={{ 
    mb: 3, 
    p: 2, 
    backgroundColor: `${theme.palette.error.main}15`,  // ZMNIEJSZONE
    border: `2px solid ${theme.palette.error.main}`, 
    borderRadius: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 2
  }}>
    <Typography sx={{ 
      color: theme.palette.error.text, 
      fontWeight: 'bold', 
      fontSize: '1.1rem',
      
      textTransform: 'uppercase'
    }}>
      💀 TA POSTAĆ JEST MARTWA
    </Typography>
    {ownerName && (
      <Typography sx={{ 
        color: theme.palette.text.primary, 
        fontSize: '0.9rem',
        fontStyle: 'italic'
      }}>
        Była własnością: <strong style={{ color: theme.palette.primary.main }}>{ownerName}</strong>
      </Typography>
    )}
  </Box>
)}

{/* STATUS BAR - czysty tekst na tle panelu (bez czarnego prostokąta, ramki
    i cienia). Od reszty oddziela go tylko cienka linia u dołu. */}
<Box sx={{ width: '100%', mb: 3, px: 0, py: 1.25, borderRadius: 0, border: 'none', borderBottom: `1px solid ${theme.palette.divider}`, backgroundColor: 'transparent', display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative', boxShadow: 'none', flexDirection: isMobile ? 'column' : 'row' }}>
  {!editingStatus ? (
    <>
      {/* Status: BEZ pogrubienia - pogrubiona kursywa na kamiennym tle była
          nieczytelna. Zwykła grubość (400) czyta się dużo lepiej. */}
      <Typography sx={{
        color: theme.palette.text.primary,
        fontWeight: 400,
        fontSize: isMobile ? '0.95rem' : '1rem',
        flexGrow: 1,
        fontStyle: 'italic',
        textAlign: 'center'
      }}>
        {safeGet(characterData, 'status', '') || (<span style={{ color: theme.palette.error.text }}>Brak statusu</span>)}
      </Typography>
      {canEditStatus() && (
        <Tooltip title="Edytuj status">
          <IconButton onClick={() => setEditingStatus(true)} size="small" sx={{ color: theme.palette.primary.main, backgroundColor: `${theme.palette.primary.main}20`, border: `1px solid ${theme.palette.divider}`, '&:hover': { backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, borderColor: theme.palette.primary.dark, transform: 'scale(1.1)' }, borderRadius: '50%', width: 28, height: 28 }}>
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </>
  ) : (
    <>
      <TextField value={statusInput} onChange={(e) => setStatusInput(e.target.value)} variant="standard" size="small" fullWidth disabled={savingStatus} sx={{ '& .MuiInput-root': { color: theme.palette.text.primary, '&:before': { borderBottomColor: theme.palette.divider }, '&:hover:before': { borderBottomColor: theme.palette.primary.main }, '&:after': { borderBottomColor: theme.palette.primary.mainLight } }, input: { color: theme.palette.text.primary, fontWeight: 400, fontSize: isMobile ? '0.95rem' : '1rem' } }} placeholder="Ustaw status postaci..." autoFocus inputProps={{ maxLength: 500 }} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStatus(); if (e.key === 'Escape') { setEditingStatus(false); setStatusInput(safeGet(characterData, 'status', '')); } }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton onClick={handleSaveStatus} disabled={savingStatus} size="small" sx={{ color: theme.palette.primary.main, backgroundColor: `${theme.palette.primary.main}20`, border: `1px solid ${theme.palette.divider}`, width: 28, height: 28, '&:hover': { backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, borderColor: theme.palette.primary.dark } }}>
          <SaveIcon fontSize="small" />
        </IconButton>
        <IconButton onClick={() => { setEditingStatus(false); setStatusInput(safeGet(characterData, 'status', '')); }} size="small" sx={{ color: theme.palette.error.text, backgroundColor: `${theme.palette.error.main}20`, border: `1px solid ${theme.palette.error.main}`, width: 28, height: 28, '&:hover': { backgroundColor: `${theme.palette.error.main}40` } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </>
  )}
</Box>
{/* MAIN CHARACTER DISPLAY */}
<Box sx={{ display: 'flex', flexDirection: (isMobile || isTablet) ? 'column' : 'row', gap: 2, mb: 4 }}>

  {/* AVATAR */}
  <Box sx={{
    flex: (isMobile || isTablet) ? 'none' : '1 1 0',
    // Kadr avatara ZAWSZE w proporcji portretu (4/5) - i na wąskim, i na szerokim
    // ekranie. Wcześniej desktop miał sztywne height: 550px, więc po poszerzeniu
    // głównego boxa (Ustawienia -> Szerokość głównego okna) kolumna rosła w bok,
    // wysokość stała w miejscu i `cover` spłaszczał portret do poziomego paska.
    // Teraz wysokość idzie za szerokością, a limit (68vh) pilnuje, żeby avatar nie
    // urósł ponad ekran - przy tym limicie ograniczamy też szerokość, żeby zamiast
    // spłaszczenia po prostu przestał rosnąć.
    width: (isMobile || isTablet) ? 'min(100%, 420px)' : 'auto',
    alignSelf: (isMobile || isTablet) ? 'center' : 'flex-start',
    minWidth: 0,
    aspectRatio: '4 / 5',
    ...(isMobile || isTablet
      ? { maxHeight: '80vh' }
      : { maxHeight: '72vh', maxWidth: 'calc(72vh * 4 / 5)' }),
    borderRadius: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.palette.background.default,
    position: 'relative'
  }}>
    {safeGet(characterData, 'avatar', '') ? (
      <img
        src={`/api${characterData.avatar}`}
        alt="Avatar"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // Ramka jest portretowa (4/5) w obu wariantach, więc `cover` docina już
          // tylko nadmiar. Desktop kadruje od góry (twarz zwykle w górnej części),
          // poniżej 1400px kadr wyśrodkowany.
          objectPosition: (isMobile || isTablet) ? 'center' : 'center top'
        }}
      />
    ) : (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <PersonIcon sx={{ fontSize: '4rem', color: theme.palette.error.text, mb: 2 }} />
        <Typography sx={{
          textAlign: 'center',
          color: theme.palette.error.text,
          fontSize: '1.2rem',
          fontStyle: 'italic',
          }}>
          Brak avatara
        </Typography>
      </Box>
    )}

    {/* KRATY - postać odsiadująca wyrok (characters.jailed_until). Rysowane
        gradientem na wierzchu avatara, bez dokładania grafik do repo. */}
    {isTargetImprisoned() && (
      <>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `
              linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
              repeating-linear-gradient(
                90deg,
                rgba(12,12,12,0.92) 0px,
                rgba(12,12,12,0.92) 10px,
                transparent 10px,
                transparent 46px
              )
            `,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            py: 1,
            textAlign: 'center',
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderTop: `2px solid ${theme.palette.error.main}`,
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{
            color: theme.palette.error.text,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontSize: '0.85rem',
          }}>
            Za kratami
          </Typography>
          <Typography sx={{ color: theme.palette.common.white, fontSize: '0.72rem' }}>
            do {new Date(safeGet(characterData, 'jailedUntil', null)).toLocaleString('pl-PL', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            })}
          </Typography>
        </Box>
      </>
    )}

{canChangeAvatar() && (
  <Box sx={{ position: 'absolute', bottom: 16, right: 16 }}>
    <Tooltip title="Max 200KB" placement="top">
      <IconButton
        onClick={handleAvatarUpload}
        disabled={uploadingAvatar}
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          width: 32,
          height: 32,
          borderRadius: 0,
          border: `2px solid ${theme.palette.primary.dark}`,
          boxShadow: `0 4px 12px ${theme.palette.primary.main}40`,
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
            transform: 'scale(1.1)',
            boxShadow: `0 6px 20px ${theme.palette.primary.main}60`
          },
          '&:disabled': {
            backgroundColor: theme.palette.action.disabledBackground,
            color: theme.palette.action.disabled,
            borderColor: theme.palette.divider
          }
        }}
      >
        <PhotoCamera sx={{ fontSize: '16px' }} />
      </IconButton>
    </Tooltip>
  </Box>
)}

{/* PRZYCISK USUŃ AVATAR - DLA ADMINA LUB WŁAŚCICIELA */}
{(userRole === 'admin' || isMyCharacter()) && safeGet(characterData, 'avatar', '') && (
  <Box sx={{ position: 'absolute', top: 16, left: 16 }}>
    <Tooltip title="Usuń avatar" placement="top">
      <IconButton
        onClick={() => setDeleteAvatarDialogOpen(true)}
        disabled={deletingAvatar}
        sx={{
          backgroundColor: theme.palette.error.main,
          color: theme.palette.common.white,
          width: 32,
          height: 32,
          borderRadius: 0,
          border: `2px solid ${theme.palette.error.dark}`,
          boxShadow: `0 4px 12px ${theme.palette.error.main}40`,
          '&:hover': {
            backgroundColor: theme.palette.error.dark,
            transform: 'scale(1.1)',
            boxShadow: `0 6px 16px ${theme.palette.error.main}60`
          },
          '&:disabled': {
            backgroundColor: theme.palette.action.disabledBackground,
            color: theme.palette.action.disabled,
            borderColor: theme.palette.divider
          }
        }}
      >
        <CloseIcon sx={{ fontSize: '14px' }} />
      </IconButton>
    </Tooltip>
  </Box>
)}
  </Box>

  {/* CHARACTER INFO - KOMPAKTOWY BOX */}
  <Box sx={{
    flex: (isMobile || isTablet) ? 'none' : '1 1 0',
    width: (isMobile || isTablet) ? '100%' : 'auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5
  }}>
    {/* DANE: GRACZ (meta) + POSTAĆ (świat gry) - dwie grupy */}
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

      {/* GRUPA 1: GRACZ */}
      <InfoSection title="Gracz">
        {!isDeleted && ownerName && (
          <Typography
            onClick={() => fetchOwnerCharacters(characterData.user_id)}
            sx={{
              color: theme.palette.primary.main,
              fontWeight: 'bold',
              fontSize: '1.05rem',
              cursor: 'pointer',
              display: 'inline-block',
              mb: 1.25,
              '&:hover': { color: theme.palette.primary.light, textShadow: `0 0 8px ${theme.palette.primary.main}66` },
            }}
          >
            {ownerName}
          </Typography>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 1.5, rowGap: 1.25 }}>
          <Field label="ID"><span>#{id}</span></Field>
          <Field label="Styl gry">
            <Box component="span" sx={{ color: getPlayStyle(safeGet(characterData, 'playStyle', 'oba')).color, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getPlayStyle(safeGet(characterData, 'playStyle', 'oba')).short}
            </Box>
          </Field>
          <Field label="Karta postaci">
            <PlainTag
              color={readableTagColor(theme, characterCardData.isApproved ? theme.palette.success.main : theme.palette.error.main)}
              icon={characterCardData.isApproved ? <ApprovedIcon /> : <PendingIcon />}
            >
              {characterCardData.isApproved ? 'Zaakceptowana' : 'Niezaakceptowana'}
            </PlainTag>
          </Field>
          {safeGet(characterData, 'role', '') && (
            <Field label="Rola">
              <PlainTag color={readableTagColor(theme, characterData.role === 'admin' ? theme.palette.error.main : theme.palette.info.main)}>
                {formatRoleForDisplay(characterData.role)}
              </PlainTag>
            </Field>
          )}
        </Box>
      </InfoSection>

      {/* GRUPA 2: POSTAĆ */}
      <InfoSection
        title="Postać"
        accent={getRaceColor(safeGet(characterData, 'faction', ''))}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 1.5, rowGap: 1.25 }}>
          <Field label="Rasa"><span>{getRaceName(safeGet(characterData, 'faction', ''))}</span></Field>
          <Field label="Płeć"><span>{safeGet(characterData, 'gender', '') || '—'}</span></Field>
          <Field label="Wiek"><span>{safeGet(characterData, 'age', null) ? `${characterData.age} lat` : '—'}</span></Field>
          <Field label="Klasa"><span>{getClassName(safeGet(characterData, 'class', '')) || '—'}</span></Field>

          {/* ROLA FABULARNA - wpisywana z ręki przez administrację (rola konta
              `admin`). Zwykły gracz widzi ją tylko wtedy, gdy została nadana;
              admin widzi pole zawsze, żeby móc ją nadać. Stoi w zwykłej kolumnie
              siatki - obok przydomka, żeby sekcja czytała się jak tabelka
              (rasa/płeć, wiek/klasa, rola/przydomek). Na czas EDYCJI pole
              rozpycha się na cały wiersz, bo w połowie szerokości nie zmieściłby
              się input z przyciskami zapisu i anulowania. */}
          {(safeGet(characterData, 'narrativeRole', '') || canEditNarrativeRole()) && (
            <Box sx={{ ...(editingNarrativeRole ? { gridColumn: '1 / -1' } : {}), minWidth: 0 }}>
              <Field label="Rola fabularna">
                {!editingNarrativeRole ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexWrap: 'wrap' }}>
                    {safeGet(characterData, 'narrativeRole', '') ? (
                      <Box component="span" sx={{
                        color: readableTagColor(theme, theme.palette.warning.main),
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        letterSpacing: '0.04em',
                        wordBreak: 'break-word',
                      }}>
                        {characterData.narrativeRole}
                      </Box>
                    ) : (
                      <Box component="span" sx={{
                        color: theme.palette.text.secondary,
                        fontWeight: 400,
                        fontStyle: 'italic',
                        fontSize: '0.85rem',
                      }}>
                        Nie nadana
                      </Box>
                    )}
                    {canEditNarrativeRole() && (
                      <Tooltip title="Rola fabularna - edycja tylko dla administracji">
                        <IconButton
                          onClick={() => { setEditingNarrativeRole(true); setNarrativeRoleError(''); }}
                          size="small"
                          sx={{
                            color: theme.palette.primary.main,
                            backgroundColor: `${theme.palette.primary.main}20`,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            '&:hover': {
                              backgroundColor: theme.palette.primary.main,
                              color: theme.palette.background.default,
                              borderColor: theme.palette.primary.dark,
                            },
                          }}
                        >
                          <Edit sx={{ fontSize: '0.85rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <TextField
                        value={narrativeRoleInput}
                        onChange={(e) => setNarrativeRoleInput(e.target.value)}
                        variant="standard"
                        size="small"
                        fullWidth
                        disabled={savingNarrativeRole}
                        autoFocus
                        placeholder="np. Wódz Watahy, Kapłan Zapomnianych..."
                        inputProps={{ maxLength: 100 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNarrativeRole();
                          if (e.key === 'Escape') {
                            setEditingNarrativeRole(false);
                            setNarrativeRoleError('');
                            setNarrativeRoleInput(safeGet(characterData, 'narrativeRole', ''));
                          }
                        }}
                        sx={{
                          '& .MuiInput-root': {
                            color: theme.palette.text.primary,
                            '&:before': { borderBottomColor: theme.palette.divider },
                            '&:hover:before': { borderBottomColor: theme.palette.primary.main },
                            '&:after': { borderBottomColor: theme.palette.primary.mainLight },
                          },
                          input: { color: theme.palette.text.primary, fontWeight: 400, fontSize: '0.92rem' },
                        }}
                      />
                      <IconButton
                        onClick={handleSaveNarrativeRole}
                        disabled={savingNarrativeRole}
                        size="small"
                        sx={{
                          color: theme.palette.primary.main,
                          backgroundColor: `${theme.palette.primary.main}20`,
                          border: `1px solid ${theme.palette.divider}`,
                          width: 24,
                          height: 24,
                          '&:hover': {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.background.default,
                            borderColor: theme.palette.primary.dark,
                          },
                        }}
                      >
                        <SaveIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setEditingNarrativeRole(false);
                          setNarrativeRoleError('');
                          setNarrativeRoleInput(safeGet(characterData, 'narrativeRole', ''));
                        }}
                        size="small"
                        sx={{
                          color: theme.palette.error.text,
                          backgroundColor: `${theme.palette.error.main}20`,
                          border: `1px solid ${theme.palette.error.main}`,
                          width: 24,
                          height: 24,
                          '&:hover': { backgroundColor: `${theme.palette.error.main}40` },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                    </Box>
                    {narrativeRoleError && (
                      <Typography sx={{ color: theme.palette.error.text, fontSize: '0.72rem', fontWeight: 400 }}>
                        {narrativeRoleError}
                      </Typography>
                    )}
                  </Box>
                )}
              </Field>
            </Box>
          )}

          {/* PRZYDOMEK - stoi OBOK roli fabularnej (druga kolumna tego samego
              wiersza) i działa na tej samej zasadzie: gracz go sobie nie
              wpisuje, nadaje go z ręki administracja - tu jednak zarówno
              `admin`, jak i `mistrz_gry`. Zwykły gracz widzi przydomek tylko
              wtedy, gdy został nadany. Edycja - jak przy roli - na cały wiersz. */}
          {(safeGet(characterData, 'epithet', '') || canEditEpithet()) && (
            <Box sx={{ ...(editingEpithet ? { gridColumn: '1 / -1' } : {}), minWidth: 0 }}>
              <Field label="Przydomek">
                {!editingEpithet ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexWrap: 'wrap' }}>
                    {safeGet(characterData, 'epithet', '') ? (
                      <Box component="span" sx={{
                        color: readableTagColor(theme, theme.palette.info.main),
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        fontStyle: 'italic',
                        letterSpacing: '0.04em',
                        wordBreak: 'break-word',
                      }}>
                        „{characterData.epithet}"
                      </Box>
                    ) : (
                      <Box component="span" sx={{
                        color: theme.palette.text.secondary,
                        fontWeight: 400,
                        fontStyle: 'italic',
                        fontSize: '0.85rem',
                      }}>
                        Nie nadany
                      </Box>
                    )}
                    {canEditEpithet() && (
                      <Tooltip title="Przydomek - edycja tylko dla administracji (admin / mistrz gry)">
                        <IconButton
                          onClick={() => { setEditingEpithet(true); setEpithetError(''); }}
                          size="small"
                          sx={{
                            color: theme.palette.primary.main,
                            backgroundColor: `${theme.palette.primary.main}20`,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            '&:hover': {
                              backgroundColor: theme.palette.primary.main,
                              color: theme.palette.background.default,
                              borderColor: theme.palette.primary.dark,
                            },
                          }}
                        >
                          <Edit sx={{ fontSize: '0.85rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%', minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <TextField
                        value={epithetInput}
                        onChange={(e) => setEpithetInput(e.target.value)}
                        variant="standard"
                        size="small"
                        fullWidth
                        disabled={savingEpithet}
                        autoFocus
                        placeholder="np. Bez Twarzy, Krwawy Rzeźnik..."
                        inputProps={{ maxLength: 100 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEpithet();
                          if (e.key === 'Escape') {
                            setEditingEpithet(false);
                            setEpithetError('');
                            setEpithetInput(safeGet(characterData, 'epithet', ''));
                          }
                        }}
                        sx={{
                          '& .MuiInput-root': {
                            color: theme.palette.text.primary,
                            '&:before': { borderBottomColor: theme.palette.divider },
                            '&:hover:before': { borderBottomColor: theme.palette.primary.main },
                            '&:after': { borderBottomColor: theme.palette.primary.mainLight },
                          },
                          input: { color: theme.palette.text.primary, fontWeight: 400, fontSize: '0.92rem' },
                        }}
                      />
                      <IconButton
                        onClick={handleSaveEpithet}
                        disabled={savingEpithet}
                        size="small"
                        sx={{
                          color: theme.palette.primary.main,
                          backgroundColor: `${theme.palette.primary.main}20`,
                          border: `1px solid ${theme.palette.divider}`,
                          width: 24,
                          height: 24,
                          '&:hover': {
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.background.default,
                            borderColor: theme.palette.primary.dark,
                          },
                        }}
                      >
                        <SaveIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setEditingEpithet(false);
                          setEpithetError('');
                          setEpithetInput(safeGet(characterData, 'epithet', ''));
                        }}
                        size="small"
                        sx={{
                          color: theme.palette.error.text,
                          backgroundColor: `${theme.palette.error.main}20`,
                          border: `1px solid ${theme.palette.error.main}`,
                          width: 24,
                          height: 24,
                          '&:hover': { backgroundColor: `${theme.palette.error.main}40` },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                    </Box>
                    {epithetError && (
                      <Typography sx={{ color: theme.palette.error.text, fontSize: '0.72rem', fontWeight: 400 }}>
                        {epithetError}
                      </Typography>
                    )}
                  </Box>
                )}
              </Field>
            </Box>
          )}
        </Box>
      </InfoSection>

      {/* GRUPA 3: RODZINA / KLAN */}
      <InfoSection title="Rodzina">
        {safeGet(characterData, 'clan', null) ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Field label="Klan">
              <Box
                component="span"
                onClick={openClanDialog}
                sx={{
                  color: theme.palette.primary.main,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  '&:hover': { color: theme.palette.primary.light, textShadow: `0 0 8px ${theme.palette.primary.main}66` },
                }}
              >
                {safeGet(characterData, 'clan.name', '')}
              </Box>
            </Field>
            <Box>
              <PlainTag color={readableTagColor(theme, safeGet(characterData, 'clan.role', '') === 'head' ? theme.palette.warning.main : theme.palette.info.main)}>
                {clanRoleLabel(safeGet(characterData, 'clan.role', 'member'))}
              </PlainTag>
            </Box>
          </Box>
        ) : (
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.85rem', fontStyle: 'italic' }}>
            {canEdit ? 'Nie należysz do żadnego klanu.' : 'Brak przynależności do klanu.'}
          </Typography>
        )}

        {canEdit && invitations.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => { setInvitationsDialogOpen(true); fetchInvitations(); }}
            sx={{ mt: 1.25, borderRadius: 0, textTransform: 'none', fontSize: '0.72rem' }}
          >
            📨 Zaproszenia do klanu ({invitations.length})
          </Button>
        )}
      </InfoSection>

    </Box>

    {/* YOUTUBE MUZYKA - ukryty player */}
    <div id={`youtube-player-${id}`} style={{ display: 'none' }}></div>

    {/* BOX 4: YOUTUBE MUSIC */}
    {(youtubeMusicUrl || canEdit) && (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 1,
        backgroundColor: theme.palette.background.paper,
        borderRadius: 0,
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Edycja URL (tylko właściciel) - kompaktowa */}
        {canEdit && (
          <Box sx={{ display: 'flex', gap: 0.5, mb: editingYoutubeUrl ? 0.5 : 0 }}>
            {editingYoutubeUrl ? (
              <>
                <TextField
                  fullWidth
                  size="small"
                  value={youtubeUrlInput}
                  onChange={(e) => setYoutubeUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      
                      fontSize: '0.7rem',
                      height: '28px'
                    },
                    '& .MuiOutlinedInput-input': {
                      padding: '4px 8px'
                    }
                  }}
                />
                <IconButton
                  size="small"
                  onClick={handleSaveYoutubeUrl}
                  disabled={savingYoutubeUrl}
                  sx={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.common.white,
                    '&:hover': { backgroundColor: theme.palette.primary.dark }
                  }}
                >
                  <SaveIcon sx={{ fontSize: '14px' }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditingYoutubeUrl(false);
                    setYoutubeUrlInput(youtubeMusicUrl);
                  }}
                  sx={{ width: '28px', height: '28px' }}
                >
                  <CloseIcon sx={{ fontSize: '14px' }} />
                </IconButton>
              </>
            ) : (
              <IconButton
                size="small"
                onClick={() => setEditingYoutubeUrl(true)}
                sx={{
                  width: '28px',
                  height: '28px',
                  color: theme.palette.primary.main
                }}
              >
                <Edit sx={{ fontSize: '14px' }} />
              </IconButton>
            )}
          </Box>
        )}

        {/* Tytuł piosenki ze scrollowaniem - animacja billboard */}
        {youtubeMusicUrl && youtubeMusicTitle && (
          <Box sx={{
            width: '100%',
            overflow: 'hidden',
            backgroundColor: theme.palette.background.default,
            borderRadius: 0,
            padding: '10px 12px',
            mb: 0.5,
            position: 'relative',
            minHeight: '40px'
          }}>
            <Box
              className="scrolling-title"
              sx={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                animation: youtubeMusicTitle.length > 40 ? 'scroll-left 20s linear infinite' : 'none',
                '@keyframes scroll-left': {
                  '0%': {
                    transform: 'translateX(0%)'
                  },
                  '100%': {
                    transform: 'translateX(-50%)'
                  }
                }
              }}
            >
              <Typography
                component="span"
                sx={{
                  
                  fontSize: '0.85rem',
                  color: theme.palette.primary.main,
                  fontWeight: 'bold',
                  display: 'inline-block',
                  pr: youtubeMusicTitle.length > 40 ? 4 : 0
                }}
              >
                <MusicNoteIcon sx={{ fontSize: '0.85rem', mr: 0.5, verticalAlign: 'middle' }} />
                {youtubeMusicTitle}
                {/* Duplikacja tytułu dla seamless loop */}
                {youtubeMusicTitle.length > 40 && ` • ${youtubeMusicTitle}`}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Odtwarzacz w jednej linii */}
        {youtubeMusicUrl && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Play/Pause - małe */}
            <IconButton
              onClick={handleYoutubePlayPause}
              disabled={!youtubePlayerReady}
              size="small"
              sx={{
                width: '32px',
                height: '32px',
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.common.white,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark
                },
                '&:disabled': {
                  backgroundColor: theme.palette.divider,
                  color: theme.palette.text.disabled
                }
              }}
            >
              {youtubePlaying ? <PauseIcon sx={{ fontSize: '16px' }} /> : <PlayIcon sx={{ fontSize: '16px' }} />}
            </IconButton>

            {/* Previous Track - tylko dla playlist */}
            {youtubeIsPlaylist && (
              <IconButton
                onClick={handleYoutubePreviousTrack}
                disabled={!youtubePlayerReady}
                size="small"
                sx={{
                  width: '28px',
                  height: '28px',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.primary.main
                  },
                  '&:disabled': {
                    color: theme.palette.text.disabled
                  }
                }}
              >
                <SkipPreviousIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            )}

            {/* Next Track - tylko dla playlist */}
            {youtubeIsPlaylist && (
              <IconButton
                onClick={handleYoutubeNextTrack}
                disabled={!youtubePlayerReady}
                size="small"
                sx={{
                  width: '28px',
                  height: '28px',
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.primary.main
                  },
                  '&:disabled': {
                    color: theme.palette.text.disabled
                  }
                }}
              >
                <SkipNextIcon sx={{ fontSize: '16px' }} />
              </IconButton>
            )}

            {/* Volume Slider - kompaktowy */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Slider
                value={youtubeVolume}
                onChange={handleYoutubeVolumeChange}
                disabled={!youtubePlayerReady}
                min={0}
                max={100}
                sx={{
                  color: theme.palette.primary.main,
                  height: 4,
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12
                  },
                  '& .MuiSlider-rail': {
                    opacity: 0.3
                  }
                }}
              />
              <Typography sx={{
                
                fontSize: '0.65rem',
                minWidth: '28px',
                color: theme.palette.text.secondary
              }}>
                {youtubeVolume}%
              </Typography>
            </Box>

            {/* Mute/Unmute - małe */}
            <IconButton
              onClick={handleYoutubeMuteToggle}
              disabled={!youtubePlayerReady}
              size="small"
              sx={{
                width: '28px',
                height: '28px',
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.primary.main
                },
                '&:disabled': {
                  color: theme.palette.text.disabled
                }
              }}
            >
              {youtubeIsMuted ? <VolumeOffIcon sx={{ fontSize: '16px' }} /> : <VolumeUpIcon sx={{ fontSize: '16px' }} />}
            </IconButton>
          </Box>
        )}
      </Box>
    )}

    {/* MESSAGE BUTTON */}
    {canSendMessage() && (
      <Button
        variant="contained"
        startIcon={<MailIcon />}
        onClick={handleSendMessage}
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.background.default,
          fontWeight: 'bold',
          px: 2,
          py: 0.75,
          borderRadius: 0,
          fontSize: '0.85rem',
          alignSelf: 'flex-start',
          border: `2px solid ${theme.palette.primary.dark}`,
          boxShadow: `0 4px 12px ${theme.palette.primary.main}20`,
          
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          '&:hover': {
            backgroundColor: theme.palette.primary.mainLight,
            borderColor: theme.palette.primary.dark,
            transform: 'translateY(-2px)',
            boxShadow: `0 6px 16px ${theme.palette.primary.main}20`
          },
          transition: 'all 0.3s ease'
        }}
      >
        Wyślij wiadomość
      </Button>
    )}

    {/* OKRADNIJ - kradzież kieszonkowa. Przycisk zostaje widoczny także wtedy,
        gdy próba jest niemożliwa: wyszarzony, z powodem w dymku, żeby gracz
        wiedział DLACZEGO nie może (chata, cooldown, styl gry, cela). */}
    {canAttemptTheft() && (
      <Tooltip
        title={
          theftStatus?.available
            ? `Jedna próba na dobę. Koszt ${theftStatus.staminaCost} staminy. `
              + `Udany skok to 10% sakiewki, wpadka — ${theftStatus.jailHours}h w celi.`
            : (theftStatus?.reason || 'Sprawdzanie...')
        }
        placement="top"
      >
        {/* span, bo Tooltip nie pokazuje dymka nad disabled buttonem */}
        <span style={{ alignSelf: 'flex-start' }}>
          <Button
            variant="outlined"
            disabled={!theftStatus?.available || theftBusy}
            onClick={handleTheft}
            sx={{
              px: 2,
              py: 0.75,
              borderRadius: 0,
              fontSize: '0.85rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: theme.palette.warning.main,
              borderColor: `${theme.palette.warning.main}88`,
              borderWidth: 2,
              '&:hover': {
                borderColor: theme.palette.warning.main,
                backgroundColor: `${theme.palette.warning.main}14`,
                borderWidth: 2,
              },
              '&:disabled': {
                color: theme.palette.text.disabled,
                borderColor: theme.palette.divider,
                borderWidth: 2,
              },
            }}
          >
            {theftBusy ? 'Podchodzisz...' : 'Okradnij'}
          </Button>
        </span>
      </Tooltip>
    )}
  </Box>
</Box>

{/* WYNIK KRADZIEŻY */}
<Dialog
  open={Boolean(theftResult)}
  onClose={() => setTheftResult(null)}
  maxWidth="xs"
  fullWidth
  PaperProps={{ sx: { borderRadius: 0, border: `2px solid ${race.hex}` } }}
>
  <DialogTitle sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: race.accent }}>
    {theftResult?.success ? 'Czysta robota' : theftResult?.caught ? 'Wpadka' : 'Nie wyszło'}
  </DialogTitle>
  <DialogContent>
    <Typography sx={{ color: theme.palette.text.primary, mb: 1 }}>
      {theftResult?.message}
    </Typography>
    {theftResult?.success && (
      <Typography sx={{ color: theme.palette.success.text, fontWeight: 'bold' }}>
        +{new Intl.NumberFormat('pl-PL').format(theftResult.goldStolen)} złota
      </Typography>
    )}
    {theftResult?.caught && (
      <Typography sx={{ color: theme.palette.error.text, fontWeight: 'bold' }}>
        Wolność do odwołania. Zza krat nie zadziałasz mechanicznie i nie odzyskasz HP ani staminy —
        chyba że ktoś wpłaci za Ciebie kaucję.
      </Typography>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setTheftResult(null)} sx={{ borderRadius: 0, color: race.accent }}>
      Zamknij
    </Button>
  </DialogActions>
</Dialog>
{/* CHARACTER CONTENT TABS */}
<Tabs 
  value={activeContentTab} 
  onChange={(e, newVal) => {
    // Nie pozwól na zmianę taba na "add-tab"
    if (newVal !== 'add-tab') {
      setActiveContentTab(newVal);
    }
  }} 
  sx={{ 
    mb: 2, 
    borderBottom: `2px solid ${theme.palette.divider}`,
    '& .MuiTabs-indicator': {
      backgroundColor: race.hex,
      height: 3
    },
    '& .MuiTab-root': {
      color: race.accent,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      border: `2px solid ${race.hex}`,
      fontWeight: 'bold',
      minWidth: isMobile ? 'auto' : 100,
      minHeight: 36,
      paddingX: isMobile ? 1 : 1.5,
      paddingY: 0.5,
      mx: 0.5,
      borderRadius: 0,
      textTransform: 'uppercase',
      fontSize: '0.8rem',
      transition: 'all 0.3s ease',
      // Aktywna: WYPEŁNIENIE głównym kolorem rasy + jasny tekst (dobra widoczność).
      '&.Mui-selected': {
        color: race.accent,
        backgroundColor: race.deep,
        borderColor: race.hex
      },
      // Hover: odwrotnie - jaśniejszy kolor rasy jako tło + ciemny tekst.
      '&:hover': {
        backgroundColor: race.accent,
        color: '#171010',
        borderColor: race.strong
      },
      '& .MuiSvgIcon-root': {
        fontSize: '1rem',
        color: 'inherit'
      }
    }
  }}
  variant={isMobile ? 'scrollable' : 'standard'} 
  scrollButtons="auto"
>
  
  {/* KARTA POSTACI ZAWSZE PIERWSZA */}
  <Tab label="KARTA POSTACI" value="karta-postaci" />

  {/* PRZEDMIOTY FABULARNE - zaraz obok karty postaci, na każdej postaci.
      Licznik w etykiecie, żeby było widać z marszu, czy jest co oglądać. */}
  <Tab
    label={storyItems.length > 0 ? `PRZEDMIOTY (${storyItems.length})` : 'PRZEDMIOTY'}
    value="przedmioty"
  />

 {/* CUSTOMOWE TABY */}
  {customTabs.map((tab) => (
    <Tab
      key={tab.id}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <span>{tab.tab_name.toUpperCase()}</span>
          {canEditTabs() && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setTabToDelete(tab);
              }}
              sx={{
                ml: 0.5,
                p: 0.3,
                color: theme.palette.error.text,
                '&:hover': {
                  color: theme.palette.primary.main,
                  backgroundColor: `${theme.palette.primary.main}20`
                }
              }}
            >
              <DeleteIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          )}
        </Box>
      }
      value={`tab-${tab.id}`}
    />
  ))}

  {/* PRZYCISK DODAJ ZAKŁADKĘ */}
  {canEditTabs() && customTabs.length < 3 && (
    <IconButton
      onClick={(e) => {
        e.stopPropagation();
        setShowAddTabDialog(true);
      }}
      sx={{
        border: `2px dashed ${race.hex}`,
        color: race.accent,
        mx: 1,
        borderRadius: 0,
        backgroundColor: 'transparent',
        minWidth: 100,
        minHeight: 36,
        display: 'flex',
        gap: 0.5,
        px: 1.5,

        fontWeight: 'bold',
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        '&:hover': {
          backgroundColor: race.accent,
          color: '#171010',
          borderStyle: 'solid',
          borderColor: race.strong
        }
      }}
    >
      <AddIcon sx={{ fontSize: '1rem' }} />
      <span>DODAJ</span>
    </IconButton>
  )}
</Tabs>

{/* CHARACTER CONTENT (Karta Postaci + własne zakładki) - bez czarnego tła,
    ramki i cienia. Treść leży wprost na kamiennej teksturze panelu głównego,
    a poszczególne bloki rozdzielają nagłówki z linią. */}
<Box sx={{ p: 0, pt: 1, border: 'none', borderRadius: 0, backgroundColor: 'transparent', boxShadow: 'none' }}>
  
  {/* CUSTOMOWE TABY */}
  {customTabs.map((tab) => (
    activeContentTab === `tab-${tab.id}` && (
      <Box key={tab.id}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: `2px solid ${theme.palette.divider}` }}>
          <Typography variant="h4" sx={{  color: theme.palette.primary.mainLight, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            {tab.tab_name}
          </Typography>
          {canEditTabs() && (
            <Button startIcon={<Edit />} onClick={() => handleEditTab(tab)} variant="outlined" sx={{ color: theme.palette.primary.main, borderColor: theme.palette.primary.main, '&:hover': { backgroundColor: `${theme.palette.primary.main}20`, borderColor: theme.palette.primary.mainLight } }}>
              Edytuj
            </Button>
          )}
        </Box>

        <Box sx={{ ...quillStyle, p: 2, backgroundColor: `${theme.palette.primary.main}15`, borderRadius: 0, border: `1px solid ${theme.palette.divider}`, minHeight: '200px' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(tab.tab_content || `<p style="color: ${theme.palette.text.secondary}; font-style: italic;">Brak treści</p>`) }}
        />
      </Box>
    )
  ))}
  
  {/* ZAKŁADKA PRZEDMIOTY FABULARNE */}
  {activeContentTab === 'przedmioty' && (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: `2px solid ${theme.palette.divider}`, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', letterSpacing: '0.06em' }}>
            Przedmioty
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic', mt: 0.5 }}>
            Spis rzeczy zdobytych w fabule. Wpisuje je i zabiera wyłącznie administracja.
          </Typography>
        </Box>

        {canManageStoryItems() && (
          <Button
            startIcon={<AddIcon />}
            onClick={() => setShowAddStoryItemDialog(true)}
            variant="outlined"
            sx={{
              color: theme.palette.primary.main,
              borderColor: theme.palette.primary.main,
              borderRadius: 0,
              '&:hover': { backgroundColor: `${theme.palette.primary.main}20`, borderColor: theme.palette.primary.mainLight }
            }}
          >
            Dodaj przedmiot
          </Button>
        )}
      </Box>

      {storyItemsMigrationRequired && isPrivilegedUser() && (
        <Box sx={{ p: 2, mb: 2, border: `1px solid ${theme.palette.warning.main}`, backgroundColor: `${theme.palette.warning.main}15` }}>
          <Typography variant="body2" sx={{ color: theme.palette.warning.main }}>
            Baza nie ma jeszcze tabeli przedmiotów fabularnych — uruchom migrację
            {' '}<strong>database/add-story-items.sql</strong>.
          </Typography>
        </Box>
      )}

      {loadingStoryItems ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: race.accent }} />
        </Box>
      ) : storyItems.length === 0 ? (
        <Box sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, backgroundColor: `${theme.palette.primary.main}10` }}>
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
            {isMyCharacter()
              ? 'Nie masz jeszcze żadnych przedmiotów fabularnych. Dostaniesz je od Mistrza Gry za to, co odegrasz.'
              : 'Ta postać nie ma jeszcze żadnych przedmiotów fabularnych.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {storyItems.map((item) => (
            <Box
              key={item.id}
              sx={{
                p: 2,
                border: `1px solid ${theme.palette.divider}`,
                borderLeft: `4px solid ${race.hex}`,
                backgroundColor: `${theme.palette.primary.main}10`
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold' }}>
                    {item.name}
                  </Typography>
                  {Number(item.quantity) > 1 && (
                    <Chip
                      label={`x${item.quantity}`}
                      size="small"
                      sx={{ borderRadius: 0, backgroundColor: race.deep, color: race.accent, fontWeight: 'bold' }}
                    />
                  )}
                </Box>

                {canManageStoryItems() && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title="Edytuj przedmiot">
                      <IconButton
                        size="small"
                        onClick={() => setEditingStoryItem({ ...item })}
                        sx={{ color: theme.palette.primary.main }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Zabierz przedmiot">
                      <IconButton
                        size="small"
                        onClick={() => setStoryItemToDelete(item)}
                        sx={{ color: theme.palette.error.text }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>

              {item.description && (
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, mt: 1, whiteSpace: 'pre-wrap' }}>
                  {item.description}
                </Typography>
              )}

              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1.5 }}>
                {item.source ? `Pochodzenie: ${item.source} • ` : ''}
                Wpisane: {formatDate(item.created_at)}
                {item.granted_by_name ? ` przez ${item.granted_by_name}` : ''}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )}

  {/* ZAKŁADKA KARTA POSTACI */}
  {activeContentTab === 'karta-postaci' && (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, pb: 2, borderBottom: `2px solid ${theme.palette.divider}` }}>
        <Typography variant="h4" sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', letterSpacing: '0.06em' }}>
          Karta Postaci
        </Typography>
        
        {/* "Edytuj" = poprawianie ISTNIEJĄCEJ karty. Bez tego warunku admin/MG
            dostawał ten przycisk także na postaci BEZ karty i mógł wypełnić ją
            za gracza - kartę od zera pisze wyłącznie właściciel. */}
        {canEditCharacterCard() && hasCharacterCard() && !editingCharacterCard && (
          <Button
            startIcon={<Edit />}
            onClick={() => setEditingCharacterCard(true)}
            variant="outlined"
            sx={{ 
              color: theme.palette.primary.main, 
              borderColor: theme.palette.primary.main, 
              '&:hover': { 
                backgroundColor: `${theme.palette.primary.main}20`, 
                borderColor: theme.palette.primary.mainLight 
              } 
            }}
          >
            Edytuj
          </Button>
        )}
      </Box>

      {/* TRYB EDYCJI */}
      {editingCharacterCard ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Zasada balansu zalet i wad NIE stoi już tutaj wielkim blokiem tekstu -
              siedzi pod ikonką informacji obok nagłówków "Zalety" i "Wady"
              (renderEntriesRuleInfoButton), czyli dokładnie tam, gdzie gracz te
              wpisy dodaje. Po akceptacji karty ikonka znika. */}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Imię *"
                value={characterCardData.firstName}
                onChange={(e) => setCharacterCardData({ ...characterCardData, firstName: e.target.value })}
                inputProps={{ maxLength: CHARACTER_LIMITS.firstName }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText={`${characterCardData.firstName.length}/${CHARACTER_LIMITS.firstName}`}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nazwisko"
                value={characterCardData.lastName}
                onChange={(e) => setCharacterCardData({ ...characterCardData, lastName: e.target.value })}
                inputProps={{ maxLength: CHARACTER_LIMITS.lastName }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText={`${characterCardData.lastName.length}/${CHARACTER_LIMITS.lastName}`}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Wiek"
                value={characterCardData.age || ''}
                onChange={(e) => setCharacterCardData({ ...characterCardData, age: parseInt(e.target.value) || null })}
                InputProps={{
                  inputProps: {
                    min: 1
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText="Wiek postaci (lata)"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Wzrost (cm)"
                value={characterCardData.height || ''}
                onChange={(e) => setCharacterCardData({ ...characterCardData, height: parseInt(e.target.value) || null })}
                InputProps={{
                  inputProps: { 
                    min: CHARACTER_LIMITS.height.min, 
                    max: CHARACTER_LIMITS.height.max 
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText={`${CHARACTER_LIMITS.height.min}-${CHARACTER_LIMITS.height.max} cm`}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Krótki opis charakteru"
                value={characterCardData.characterDescription}
                onChange={(e) => setCharacterCardData({ ...characterCardData, characterDescription: e.target.value })}
                inputProps={{ maxLength: CHARACTER_LIMITS.characterDescription }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText={`${characterCardData.characterDescription.length}/${CHARACTER_LIMITS.characterDescription}`}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Krótki opis wizualny"
                value={characterCardData.visualDescription}
                onChange={(e) => setCharacterCardData({ ...characterCardData, visualDescription: e.target.value })}
                inputProps={{ maxLength: CHARACTER_LIMITS.visualDescription }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText={`${characterCardData.visualDescription.length}/${CHARACTER_LIMITS.visualDescription}`}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Dodatkowe informacje / Ciekawostki"
                value={characterCardData.additionalInfo}
                onChange={(e) => setCharacterCardData({ ...characterCardData, additionalInfo: e.target.value })}
                inputProps={{ maxLength: CHARACTER_LIMITS.additionalInfo }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.primary.main },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.error.text,
                    '&.Mui-focused': { color: theme.palette.primary.main }
                  }
                }}
                helperText={`${characterCardData.additionalInfo.length}/${CHARACTER_LIMITS.additionalInfo}`}
              />
            </Grid>
          </Grid>

          {/* PRZYCISKI AKCJI */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setEditingCharacterCard(false);
                loadCurrentCharacterCard();
              }}
              variant="outlined"
              sx={{ 
                color: theme.palette.error.text, 
                borderColor: theme.palette.error.main,
                '&:hover': {
                  backgroundColor: `${theme.palette.error.main}20`,
                  borderColor: theme.palette.error.main
                }
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSaveCharacterCard}
              disabled={savingCharacterCard}
              variant="contained"
              startIcon={<SaveIcon />}
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.background.default,
                '&:hover': {
                  backgroundColor: theme.palette.primary.mainLight
                },
                '&:disabled': {
                  backgroundColor: theme.palette.error.main,
                  color: theme.palette.text.secondary
                }
              }}
            >
              {savingCharacterCard ? 'Zapisywanie...' : 'Zapisz i wyślij do zatwierdzenia'}
            </Button>
          </Box>
        </Box>
        ) : (
        /* TRYB WYŚWIETLANIA */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* PODSTAWOWE INFORMACJE */}
          {characterCardData.isApproved && (characterCardData.firstName || characterCardData.lastName) && (
            <Box sx={{ 
              p: 3, 
              backgroundColor: `${theme.palette.primary.main}15`,  // ZMNIEJSZONE
              borderRadius: 0, 
              border: `2px solid ${theme.palette.divider}` 
            }}>
              <Grid container spacing={2}>
                {(characterCardData.firstName || characterCardData.lastName) && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                        Imię i nazwisko:
                      </Typography>
                      <Typography sx={{ color: theme.palette.text.primary, fontSize: '1.1rem' }}>
                        {[characterCardData.firstName, characterCardData.lastName].filter(Boolean).join(' ')}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                
                {characterCardData.age && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                        Wiek:
                      </Typography>
                      <Typography sx={{ color: theme.palette.text.primary }}>
                        {characterCardData.age} lat
                      </Typography>
                    </Box>
                  </Grid>
                )}
                
                {characterCardData.height && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                        Wzrost:
                      </Typography>
                      <Typography sx={{ color: theme.palette.text.primary }}>
                        {characterCardData.height} cm
                      </Typography>
                    </Box>
                  </Grid>
                )}
                
                {characterCardData.characterDescription && (
                  <Grid item xs={12}>
                    <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
                      Charakter:
                    </Typography>
                    <Typography sx={{ color: theme.palette.text.primary, fontStyle: 'italic' }}>
                      {characterCardData.characterDescription}
                    </Typography>
                  </Grid>
                )}
                
                {characterCardData.visualDescription && (
                  <Grid item xs={12}>
                    <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
                      Wygląd:
                    </Typography>
                    <Typography sx={{ color: theme.palette.text.primary, fontStyle: 'italic' }}>
                      {characterCardData.visualDescription}
                    </Typography>
                  </Grid>
                )}
                
                {characterCardData.additionalInfo && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
                          Dodatkowe informacje:
                        </Typography>
                        <Typography sx={{ color: theme.palette.text.primary, fontStyle: 'italic' }}>
                          {characterCardData.additionalInfo}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}

          {/* BRAK KARTY POSTACI */}
          {!characterCardData.isApproved && !characterCardData.firstName && (
            <Box sx={{
              p: 4,
              textAlign: 'center',
              backgroundColor: appColors.bgSurface,
              borderRadius: 0,
              border: `1px dashed ${theme.palette.primary.main}66`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
            }}>
              <Typography sx={{ color: appColors.steelLighter, fontSize: '1.05rem', letterSpacing: '0.05em', mb: 2.5 }}>
                Brak karty postaci
              </Typography>
              {canCreateCharacterCard() && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setEditingCharacterCard(true)}
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.background.default,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.mainLight
                    }
                  }}
                >
                  Wypełnij kartę postaci
                </Button>
              )}
            </Box>
          )}

          {/* ZALETY POSTACI */}
          {canViewAchievementsProblems() && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.25, borderBottom: `2px solid ${theme.palette.primary.main}40` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="h5" sx={{
                    color: theme.palette.primary.main,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}>
                    Zalety
                  </Typography>
                  {renderEntriesRuleInfoButton(theme.palette.primary.main)}
                </Box>

                {canAddEntries() && (
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setShowAddAchievementDialog(true)}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: theme.palette.text.primary,
                      backgroundColor: theme.palette.background.default,
                      borderColor: theme.palette.divider,
                      borderRadius: 0,
                      
                      '&:hover': {
                        backgroundColor: theme.palette.primary.main,
                        borderColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText
                      }
                    }}
                  >
                    Dodaj
                  </Button>
                )}
              </Box>

              {characterCardData.achievements.filter(a => isEntryVisible(a)).length === 0 ? (
                <Typography sx={{
                  color: appColors.steelLighter,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  py: 2,
                  opacity: 0.85,
                  }}>
                  Brak aktywnych zalet
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {characterCardData.achievements
                    .filter(achievement => isEntryVisible(achievement))
                    .map((achievement) => (
                      <Box
                        key={achievement.id}
                        sx={{
                          p: 2,
                          // To samo tło co blok z danymi Karty Postaci wyżej -
                          // zalety/wady mają być jej wizualnym ciągiem dalszym,
                          // a nie czarnymi kaflami odcinającymi się od reszty.
                          backgroundColor: `${theme.palette.primary.main}15`,
                          borderRadius: 0,
                          border: `2px solid ${theme.palette.primary.main}`,
                          borderLeft: `4px solid ${theme.palette.primary.main}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            borderColor: theme.palette.primary.main
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{
                              color: theme.palette.primary.main,
                              fontWeight: 'bold',
                              fontSize: '1.1rem',

                              textTransform: 'uppercase'
                            }}>
                              {achievement.title}
                            </Typography>
                            {achievement.was_rejected ? (
                              <Chip label="Odrzucona — popraw i wyślij ponownie" size="small" sx={{ mt: 0.5, height: 20, borderRadius: 0, fontSize: '0.62rem', fontWeight: 'bold', backgroundColor: theme.palette.error.main, color: theme.palette.getContrastText(theme.palette.error.main) }} />
                            ) : !achievement.is_approved && (
                              <Chip label="Oczekuje na akceptację" size="small" sx={{ mt: 0.5, height: 20, borderRadius: 0, fontSize: '0.62rem', fontWeight: 'bold', backgroundColor: theme.palette.warning.main, color: theme.palette.getContrastText(theme.palette.warning.main) }} />
                            )}
                            {isEntryExpired(achievement) && (
                              <Chip label={`Data końcowa minęła (${formatDate(achievement.end_date)})`} size="small" sx={{ mt: 0.5, ml: 0.5, height: 20, borderRadius: 0, fontSize: '0.62rem', fontWeight: 'bold', backgroundColor: theme.palette.divider, color: theme.palette.text.primary }} />
                            )}
                            {Boolean(achievement.was_rejected) && achievement.rejection_reason && (
                              <Box sx={{ mt: 1, p: 1, backgroundColor: `${theme.palette.error.main}18`, border: `1px solid ${theme.palette.error.main}`, borderRadius: 0 }}>
                                <Typography sx={{ color: theme.palette.error.text, fontSize: '0.78rem', fontWeight: 'bold' }}>Co poprawić:</Typography>
                                <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.8rem' }}>{achievement.rejection_reason}</Typography>
                              </Box>
                            )}
                            {achievement.description && (
                              <Typography sx={{ 
                                color: theme.palette.text.primary, 
                                fontSize: '0.9rem', 
                                mt: 1, 
                                fontStyle: 'italic',
                                }}>
                                {achievement.description}
                              </Typography>
                            )}
                            <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                              {achievement.level && (
                                <Typography sx={{
                                  color: theme.palette.primary.main,
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  }}>
                                  Poziom {achievement.level}/5
                                </Typography>
                              )}
                              {achievement.start_date && (
                                <Typography sx={{ 
                                  color: theme.palette.text.secondary, 
                                  fontSize: '0.8rem',
                                  }}>
                                  Od: {formatDate(achievement.start_date)}
                                </Typography>
                              )}
                              {achievement.end_date && (
                                <Typography sx={{ 
                                  color: theme.palette.text.secondary, 
                                  fontSize: '0.8rem',
                                  }}>
                                  Do: {formatDate(achievement.end_date)}
                                </Typography>
                              )}
                              {!achievement.end_date && (
                                <Typography sx={{ 
                                  color: theme.palette.primary.main, 
                                  fontSize: '0.8rem',
                                  }}>
                                  Stałe
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {isPrivilegedUser() && !achievement.is_approved && !achievement.was_rejected && (
                              <>
                                <Tooltip title="Zatwierdź zaletę">
                                  <IconButton size="small" onClick={() => handleApproveEntry('achievements', achievement.id)} sx={{ color: theme.palette.success.text, p: 0.5 }}>
                                    <ApprovedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Odrzuć z komentarzem">
                                  <IconButton size="small" onClick={() => openEntryRejectDialog('achievements', achievement)} sx={{ color: theme.palette.error.text, p: 0.5 }}>
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {canEditEntry(achievement) && (
                              <IconButton
                                size="small"
                                onClick={() => setEditingAchievement(achievement)}
                                sx={{
                                  color: theme.palette.primary.main,
                                  p: 0.5,
                                  '&:hover': {
                                    backgroundColor: theme.palette.divider
                                  }
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                </Box>
              )}
            </Box>
          )}

          {/* WADY POSTACI */}
          {canViewAchievementsProblems() && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.25, borderBottom: `2px solid ${theme.palette.error.main}40` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="h5" sx={{
                    color: theme.palette.error.text,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}>
                    Wady
                  </Typography>
                  {renderEntriesRuleInfoButton(theme.palette.error.main)}
                </Box>

                {canAddEntries() && (
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setShowAddProblemDialog(true)}
                    variant="outlined"
                    size="small"
                    sx={{
                      color: theme.palette.text.primary,
                      backgroundColor: theme.palette.background.default,
                      borderColor: theme.palette.divider,
                      borderRadius: 0,
                      
                      '&:hover': {
                        backgroundColor: theme.palette.error.main,
                        borderColor: theme.palette.error.main,
                        color: theme.palette.primary.contrastText
                      }
                    }}
                  >
                    Dodaj
                  </Button>
                )}
              </Box>

              {characterCardData.problems.filter(p => isEntryVisible(p)).length === 0 ? (
                <Typography sx={{
                  color: appColors.steelLighter,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  py: 2,
                  opacity: 0.85,
                  }}>
                  Brak aktywnych wad
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {characterCardData.problems
                    .filter(problem => isEntryVisible(problem))
                    .map((problem) => (
                      <Box
                        key={problem.id}
                        sx={{
                          p: 2,
                          // Jak przy zaletach: tło takie samo jak blok danych
                          // Karty Postaci; wadę odróżnia czerwona obwódka, nie tło.
                          backgroundColor: `${theme.palette.primary.main}15`,
                          borderRadius: 0,
                          border: `2px solid ${theme.palette.error.main}`,
                          borderLeft: `4px solid ${theme.palette.error.main}`,
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            borderColor: theme.palette.error.main
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ 
                              color: theme.palette.error.text, 
                              fontWeight: 'bold', 
                              fontSize: '1.1rem',
                              
                              textTransform: 'uppercase'
                            }}>
                              {problem.title}
                            </Typography>
                            {problem.was_rejected ? (
                              <Chip label="Odrzucona — popraw i wyślij ponownie" size="small" sx={{ mt: 0.5, height: 20, borderRadius: 0, fontSize: '0.62rem', fontWeight: 'bold', backgroundColor: theme.palette.error.main, color: theme.palette.getContrastText(theme.palette.error.main) }} />
                            ) : !problem.is_approved && (
                              <Chip label="Oczekuje na akceptację" size="small" sx={{ mt: 0.5, height: 20, borderRadius: 0, fontSize: '0.62rem', fontWeight: 'bold', backgroundColor: theme.palette.warning.main, color: theme.palette.getContrastText(theme.palette.warning.main) }} />
                            )}
                            {isEntryExpired(problem) && (
                              <Chip label={`Data końcowa minęła (${formatDate(problem.end_date)})`} size="small" sx={{ mt: 0.5, ml: 0.5, height: 20, borderRadius: 0, fontSize: '0.62rem', fontWeight: 'bold', backgroundColor: theme.palette.divider, color: theme.palette.text.primary }} />
                            )}
                            {Boolean(problem.was_rejected) && problem.rejection_reason && (
                              <Box sx={{ mt: 1, p: 1, backgroundColor: `${theme.palette.error.main}18`, border: `1px solid ${theme.palette.error.main}`, borderRadius: 0 }}>
                                <Typography sx={{ color: theme.palette.error.text, fontSize: '0.78rem', fontWeight: 'bold' }}>Co poprawić:</Typography>
                                <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.8rem' }}>{problem.rejection_reason}</Typography>
                              </Box>
                            )}
                            {problem.description && (
                              <Typography sx={{ 
                                color: theme.palette.text.primary, 
                                fontSize: '0.9rem', 
                                mt: 1, 
                                fontStyle: 'italic',
                                }}>
                                {problem.description}
                              </Typography>
                            )}
                            <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                              {problem.level && (
                                <Typography sx={{
                                  color: theme.palette.error.text,
                                  fontSize: '0.8rem',
                                  fontWeight: 'bold',
                                  }}>
                                  Poziom {problem.level}/5
                                </Typography>
                              )}
                              {problem.start_date && (
                                <Typography sx={{ 
                                  color: theme.palette.text.secondary, 
                                  fontSize: '0.8rem',
                                  }}>
                                  Od: {formatDate(problem.start_date)}
                                </Typography>
                              )}
                              {problem.end_date && (
                                <Typography sx={{ 
                                  color: theme.palette.text.secondary, 
                                  fontSize: '0.8rem',
                                  }}>
                                  Do: {formatDate(problem.end_date)}
                                </Typography>
                              )}
                              {!problem.end_date && (
                                <Typography sx={{ 
                                  color: theme.palette.error.text, 
                                  fontSize: '0.8rem',
                                  }}>
                                  Stałe
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            {isPrivilegedUser() && !problem.is_approved && !problem.was_rejected && (
                              <>
                                <Tooltip title="Zatwierdź wadę">
                                  <IconButton size="small" onClick={() => handleApproveEntry('problems', problem.id)} sx={{ color: theme.palette.success.text, p: 0.5 }}>
                                    <ApprovedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Odrzuć z komentarzem">
                                  <IconButton size="small" onClick={() => openEntryRejectDialog('problems', problem)} sx={{ color: theme.palette.error.text, p: 0.5 }}>
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {canEditEntry(problem) && (
                              <IconButton
                                size="small"
                                onClick={() => setEditingProblem(problem)}
                                sx={{
                                  color: theme.palette.error.text,
                                  p: 0.5,
                                  '&:hover': {
                                    backgroundColor: theme.palette.divider
                                  }
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                </Box>
              )}
            </Box>
          )}

        </Box>
      )}
    </Box>
  )}

</Box>
{/* ========== DIALOGI ========== */}

{/* DIALOG POWODU ODRZUCENIA */}
<Dialog 
  open={rejectionDialogOpen} 
  onClose={() => {}} 
  maxWidth="sm" 
  fullWidth
  PaperProps={{ 
    sx: { 
      backgroundColor: theme.palette.background.default, 
      border: `3px solid ${theme.palette.error.main}`, 
      borderRadius: 0,
      boxShadow: `0 8px 32px ${theme.palette.error.main}40`
    } 
  }}
>
  <DialogTitle sx={{ 
    color: theme.palette.error.text, 
     
    fontWeight: 'bold',
    borderBottom: `2px solid ${theme.palette.divider}`,
    pb: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 1
  }}>
    <ProblemIcon sx={{ fontSize: '2rem' }} />
    Karta postaci odrzucona
  </DialogTitle>
  <DialogContent sx={{ pt: 3 }}>
    <Typography sx={{ 
      color: theme.palette.text.primary, 
      mb: 2,
      fontSize: '1rem',
      lineHeight: 1.6
    }}>
      Twoja karta postaci została odrzucona przez administrację. Musisz wprowadzić poprawki i wysłać ją ponownie do zatwierdzenia.
    </Typography>
    
    <Box sx={{ 
      p: 2, 
      backgroundColor: `${theme.palette.primary.main}15`,  // ZMNIEJSZONE
      borderRadius: 0,
      border: `2px solid ${theme.palette.divider}`,
      mb: 2
    }}>
      <Typography sx={{ 
        color: theme.palette.error.text, 
        fontWeight: 'bold',
        mb: 1,
        fontSize: '0.9rem',
        textTransform: 'uppercase'
      }}>
        Powód odrzucenia:
      </Typography>
      <Typography sx={{ 
        color: theme.palette.text.primary,
        fontStyle: 'italic',
        fontSize: '1rem',
        lineHeight: 1.6
      }}>
        {rejectionReason}
      </Typography>
    </Box>

    <Typography sx={{ 
      color: theme.palette.primary.main, 
      fontSize: '0.9rem',
      fontStyle: 'italic'
    }}>
      Możesz teraz edytować kartę postaci i ponownie ją wysłać.
    </Typography>
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
    <Button 
      onClick={handleAcknowledgeRejection}
      variant="contained"
      fullWidth
      sx={{ 
        backgroundColor: theme.palette.primary.main, 
        color: theme.palette.background.default,
        fontWeight: 'bold',
        py: 1.5,
        '&:hover': {
          backgroundColor: theme.palette.primary.mainLight
        }
      }}
    >
      Rozumiem, przeczytałem
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG DLA GRACZA - ODRZUCONE WADY/ZALETY (co poprawić) */}
<Dialog
  open={entryRejectionDialogOpen}
  onClose={() => {}}
  maxWidth="sm"
  fullWidth
  PaperProps={{
    sx: {
      backgroundColor: theme.palette.background.default,
      border: `3px solid ${theme.palette.error.main}`,
      borderRadius: 0,
      boxShadow: `0 8px 32px ${theme.palette.error.main}40`
    }
  }}
>
  <DialogTitle sx={{
    color: theme.palette.error.text,
    fontWeight: 'bold',
    borderBottom: `2px solid ${theme.palette.divider}`,
    pb: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 1
  }}>
    <ProblemIcon sx={{ fontSize: '2rem' }} />
    Wady/zalety do poprawy
  </DialogTitle>
  <DialogContent sx={{ pt: 3 }}>
    <Typography sx={{ color: theme.palette.text.primary, mb: 2, fontSize: '1rem', lineHeight: 1.6 }}>
      Administracja odrzuciła poniższe pozycje. Popraw je (przycisk edycji przy każdej
      wadzie/zalecie) i wyślij ponownie do zatwierdzenia — nie znikają, dopóki ich nie poprawisz.
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rejectedEntries.map((entry, idx) => (
        <Box key={idx} sx={{ p: 1.5, backgroundColor: `${theme.palette.error.main}15`, border: `2px solid ${theme.palette.error.main}`, borderRadius: 0 }}>
          <Typography sx={{ color: theme.palette.error.text, fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
            {entry.kind}: {entry.title}
          </Typography>
          {entry.reason && (
            <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.9rem', mt: 0.5 }}>
              {entry.reason}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
    <Button
      onClick={() => setEntryRejectionDialogOpen(false)}
      variant="contained"
      fullWidth
      sx={{
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.background.default,
        fontWeight: 'bold',
        py: 1.5,
        '&:hover': { backgroundColor: theme.palette.primary.mainLight }
      }}
    >
      Rozumiem, poprawię
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG DLA ADMINA/MG - ODRZUĆ WADĘ/ZALETĘ Z KOMENTARZEM */}
<Dialog
  open={entryRejectDialogOpen}
  onClose={() => setEntryRejectDialogOpen(false)}
  maxWidth="sm"
  fullWidth
  PaperProps={{
    sx: {
      backgroundColor: theme.palette.background.default,
      border: `2px solid ${theme.palette.divider}`,
      borderRadius: 0
    }
  }}
>
  <DialogTitle sx={{ color: theme.palette.error.text, fontWeight: 'bold' }}>
    Odrzuć: {entryRejectTarget?.kind} „{entryRejectTarget?.title}”
  </DialogTitle>
  <DialogContent sx={{ pt: 2 }}>
    <Typography sx={{ color: theme.palette.text.primary, mb: 2 }}>
      Napisz graczowi, co ma poprawić. Wpis nie zniknie — gracz zobaczy komentarz i będzie
      mógł go poprawić oraz wysłać ponownie.
    </Typography>
    <TextField
      autoFocus
      multiline
      rows={4}
      fullWidth
      label="Powód odrzucenia / co poprawić"
      value={entryRejectReason}
      onChange={(e) => setEntryRejectReason(e.target.value)}
      disabled={false}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setEntryRejectDialogOpen(false)} sx={{ color: theme.palette.text.secondary }}>
      Anuluj
    </Button>
    <Button
      onClick={handleEntryRejectConfirm}
      disabled={!entryRejectReason.trim()}
      variant="contained"
      sx={{
        backgroundColor: theme.palette.error.main,
        color: theme.palette.text.primary,
        '&:hover': { backgroundColor: `${theme.palette.error.main}90` }
      }}
    >
      Odrzuć pozycję
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG POTWIERDZENIA USUNIĘCIA AVATARA */}
<Dialog
  open={deleteAvatarDialogOpen}
  onClose={() => setDeleteAvatarDialogOpen(false)}
  maxWidth="sm"
  fullWidth
  PaperProps={{
    sx: {
      backgroundColor: theme.palette.background.default,
      border: `3px solid ${theme.palette.error.main}`,
      borderRadius: 0,
      boxShadow: `0 8px 32px ${theme.palette.error.main}40`
    }
  }}
>
  <DialogTitle sx={{
    color: theme.palette.error.text,
    
    fontWeight: 'bold',
    borderBottom: `2px solid ${theme.palette.divider}`,
    pb: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 1
  }}>
    <DeleteIcon sx={{ fontSize: '2rem' }} />
    Usunąć avatar użytkownika?
  </DialogTitle>
  <DialogContent sx={{ pt: 3 }}>
    <Typography sx={{
      color: theme.palette.text.primary,
      mb: 2,
      fontSize: '1rem',
      lineHeight: 1.6
    }}>
      Czy na pewno chcesz usunąć avatar tego użytkownika?
    </Typography>
    <Typography sx={{
      color: theme.palette.error.text,
      fontSize: '0.9rem',
      fontStyle: 'italic',
      fontWeight: 'bold'
    }}>
      Tej operacji nie można cofnąć!
    </Typography>
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, gap: 1 }}>
    <Button
      onClick={() => setDeleteAvatarDialogOpen(false)}
      variant="outlined"
      sx={{
        borderColor: theme.palette.divider,
        color: theme.palette.text.primary,
        fontWeight: 'bold',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          backgroundColor: `${theme.palette.primary.main}10`
        }
      }}
    >
      Anuluj
    </Button>
    <Button
      onClick={handleDeleteAvatar}
      variant="contained"
      disabled={deletingAvatar}
      sx={{
        backgroundColor: theme.palette.error.main,
        color: theme.palette.background.default,
        fontWeight: 'bold',
        '&:hover': {
          backgroundColor: theme.palette.error.dark
        },
        '&:disabled': {
          backgroundColor: theme.palette.action.disabledBackground,
          color: theme.palette.action.disabled
        }
      }}
    >
      {deletingAvatar ? 'Usuwanie...' : 'Usuń avatar'}
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - KLAN / RODZINA */}
<Dialog
  open={clanDialogOpen}
  onClose={() => setClanDialogOpen(false)}
  maxWidth="sm"
  fullWidth
  PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}
>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
    🏰 {safeGet(clanData, 'clan.name', 'Klan')}
  </DialogTitle>
  <DialogContent sx={{ pt: 3 }}>
    {loadingClan ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
    ) : clanData ? (
      <>
        {safeGet(clanData, 'clan.description', '') && (
          <Typography sx={{ mb: 2, color: theme.palette.text.secondary, fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
            {clanData.clan.description}
          </Typography>
        )}

        {/* Zaproszenie nowej postaci (głowa / oficer) */}
        {clanIAmManager && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Nazwa postaci do zaproszenia"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInviteToClan(); }}
              InputProps={{ sx: { borderRadius: 0 } }}
            />
            <Button
              variant="contained"
              onClick={handleInviteToClan}
              disabled={clanActionBusy || !inviteName.trim()}
              sx={{ borderRadius: 0, textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Zaproś
            </Button>
          </Box>
        )}

        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: appColors.steelLighter, mb: 1 }}>
          Członkowie ({safeArray(safeGet(clanData, 'members', [])).length})
        </Typography>
        <List dense sx={{ py: 0 }}>
          {safeArray(safeGet(clanData, 'members', [])).map((m) => {
            const isMe = String(m.character_id) === String(id);
            const canRemove = clanIAmManager && (
              (clanMyRole === 'head' && m.role !== 'head') ||
              (clanMyRole === 'officer' && m.role === 'member')
            );
            const canPromote = clanMyRole === 'head' && m.role === 'member' && clanIAmManager;
            const canDemote = clanMyRole === 'head' && m.role === 'officer' && clanIAmManager;
            return (
              <ListItem
                key={m.character_id}
                sx={{
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  px: 1,
                  backgroundColor: m.role === 'head' ? `${theme.palette.warning.main}14` : 'transparent',
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {canPromote && (
                      <Tooltip title="Mianuj oficerem">
                        <Button size="small" onClick={() => handleSetMemberRole(m.character_id, 'officer')} disabled={clanActionBusy} sx={{ minWidth: 0, borderRadius: 0, fontSize: '0.6rem' }}>▲ oficer</Button>
                      </Tooltip>
                    )}
                    {canDemote && (
                      <Tooltip title="Zdegraduj do członka">
                        <Button size="small" onClick={() => handleSetMemberRole(m.character_id, 'member')} disabled={clanActionBusy} sx={{ minWidth: 0, borderRadius: 0, fontSize: '0.6rem' }}>▼ członek</Button>
                      </Tooltip>
                    )}
                    {isMe && clanMyRole !== 'head' && canEdit && (
                      <Tooltip title="Opuść klan">
                        <Button size="small" color="error" onClick={() => handleRemoveMember(m.character_id)} disabled={clanActionBusy} sx={{ minWidth: 0, borderRadius: 0, fontSize: '0.6rem' }}>Opuść</Button>
                      </Tooltip>
                    )}
                    {!isMe && canRemove && (
                      <Tooltip title="Usuń z klanu">
                        <IconButton size="small" color="error" onClick={() => handleRemoveMember(m.character_id)} disabled={clanActionBusy}><CloseIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </Box>
                }
              >
                <Avatar src={m.avatar || undefined} sx={{ width: 30, height: 30, mr: 1.25 }}>
                  {(m.character_name || '?').charAt(0).toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={
                    <Box
                      component="span"
                      onClick={() => { setClanDialogOpen(false); navigate(`/home/profile/${m.character_id}`); }}
                      sx={{ cursor: 'pointer', fontWeight: 600, color: theme.palette.text.primary, '&:hover': { color: theme.palette.primary.main } }}
                    >
                      {m.character_name || `#${m.character_id}`}
                    </Box>
                  }
                  secondary={
                    <Box component="span" sx={{ fontSize: '0.68rem', color: m.role === 'head' ? theme.palette.warning.main : theme.palette.text.secondary, fontWeight: m.role === 'head' ? 700 : 400 }}>
                      {clanRoleLabel(m.role)}{m.level ? ` · poziom ${m.level}` : ''}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </>
    ) : (
      <Typography sx={{ color: theme.palette.text.secondary }}>Brak danych klanu.</Typography>
    )}
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
    <Button onClick={() => setClanDialogOpen(false)} sx={{ borderRadius: 0 }}>Zamknij</Button>
  </DialogActions>
</Dialog>

{/* DIALOG - ZAPROSZENIA DO KLANU */}
<Dialog
  open={invitationsDialogOpen}
  onClose={() => setInvitationsDialogOpen(false)}
  maxWidth="sm"
  fullWidth
  PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}
>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', borderBottom: `1px solid ${theme.palette.divider}`, pb: 2 }}>
    📨 Zaproszenia do klanu
  </DialogTitle>
  <DialogContent sx={{ pt: 3 }}>
    {loadingInvitations ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
    ) : invitations.length === 0 ? (
      <Typography sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>Brak oczekujących zaproszeń.</Typography>
    ) : (
      <List dense sx={{ py: 0 }}>
        {invitations.map((inv) => (
          <ListItem key={inv.id} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: 1, flexWrap: 'wrap' }}>
            <ListItemText
              primary={<Box component="span" sx={{ fontWeight: 700 }}>{inv.clan_name}</Box>}
              secondary={<Box component="span" sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary }}>Zaprosił: {inv.invited_by_name || '—'}</Box>}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" color="success" onClick={() => handleInvitationResponse(inv.id, 'accept')} disabled={clanActionBusy} sx={{ borderRadius: 0, textTransform: 'none' }}>Przyjmij</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => handleInvitationResponse(inv.id, 'decline')} disabled={clanActionBusy} sx={{ borderRadius: 0, textTransform: 'none' }}>Odrzuć</Button>
            </Box>
          </ListItem>
        ))}
      </List>
    )}
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
    <Button onClick={() => setInvitationsDialogOpen(false)} sx={{ borderRadius: 0 }}>Zamknij</Button>
  </DialogActions>
</Dialog>

{/* DIALOG - POSTACIE GRACZA */}
<Dialog
  open={ownerCharactersDialog}
  onClose={() => setOwnerCharactersDialog(false)}
  maxWidth="md" 
  fullWidth
  PaperProps={{ 
    sx: { 
      backgroundColor: theme.palette.background.default, 
      border: `2px solid ${theme.palette.divider}`, 
      borderRadius: 0 
    } 
  }}
>
  <DialogTitle sx={{ 
    color: theme.palette.primary.mainLight, 
     
    fontWeight: 'bold',
    borderBottom: `1px solid ${theme.palette.divider}`,
    pb: 2
  }}>
    Postacie gracza: {ownerName}
  </DialogTitle>
  <DialogContent sx={{ pt: 3 }}>
    {loadingOwnerCharacters ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
      </Box>
    ) : ownerCharacters.length === 0 ? (
      <Typography sx={{ color: theme.palette.text.primary, textAlign: 'center', py: 4 }}>
        Brak postaci
      </Typography>
    ) : (
      <Grid container spacing={2}>
        {ownerCharacters.map((char) => (
          <Grid item xs={12} sm={6} md={4} key={char.id}>
            <Card
              onClick={() => {
                setOwnerCharactersDialog(false);
                navigate(`/home/profile/${char.id}`);
              }}
              sx={{
                backgroundColor: `${theme.palette.primary.main}15`,  // ZMNIEJSZONE
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 8px 24px ${theme.palette.primary.main}20`
                }
              }}
            >
              <Box sx={{ 
                position: 'relative',
                paddingTop: '100%',
                overflow: 'hidden',
                borderRadius: 0
              }}>
                {char.avatar ? (
                  <img
                    src={`/api${char.avatar}`}
                    alt={char.name}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.palette.background.default
                  }}>
                    <PersonIcon sx={{ fontSize: '4rem', color: theme.palette.error.text }} />
                  </Box>
                )}
              </Box>
              <CardContent sx={{ p: 2 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: theme.palette.primary.mainLight, 
                    fontWeight: 'bold',
                    
                    fontSize: '1.1rem',
                    mb: 0.5,
                    textAlign: 'center'
                  }}
                >
                  {char.name}
                </Typography>
                <Typography 
                  sx={{ 
                    color: theme.palette.text.primary, 
                    fontSize: '0.85rem',
                    textAlign: 'center'
                  }}
                >
                  #{char.id}
                </Typography>
                {char.faction && (
                  <Typography 
                    sx={{ 
                      color: theme.palette.primary.main, 
                      fontSize: '0.8rem',
                      textAlign: 'center',
                      mt: 0.5,
                      fontStyle: 'italic'
                    }}
                  >
                    {getRaceName(char.faction)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    )}
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
    <Button 
      onClick={() => setOwnerCharactersDialog(false)} 
      sx={{ 
        color: theme.palette.primary.main,
        '&:hover': {
          backgroundColor: `${theme.palette.primary.main}20`
        }
      }}
    >
      Zamknij
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - DODAJ ZAKŁADKĘ */}
<Dialog open={showAddTabDialog} onClose={() => setShowAddTabDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Dodaj nową zakładkę
  </DialogTitle>
  <DialogContent>
    <TextField
      autoFocus
      margin="dense"
      label="Nazwa zakładki"
      fullWidth
      value={newTabName}
      onChange={(e) => setNewTabName(e.target.value)}
      sx={{
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 50 }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setShowAddTabDialog(false)} sx={{ color: theme.palette.error.text }}>
      Anuluj
    </Button>
    <Button onClick={handleAddTab} variant="contained" sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight } }}>
      Dodaj
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - EDYTUJ ZAKŁADKĘ */}
<Dialog open={Boolean(editingTab)} onClose={() => setEditingTab(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0, maxHeight: '90vh' } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold', borderBottom: `1px solid ${theme.palette.divider}` }}>
    Edytuj zakładkę: {editingTab?.tab_name}
  </DialogTitle>
  <DialogContent sx={{ mt: 2 }}>
    {editor && (
      <Box sx={{ mb: 2, p: 1, backgroundColor: `${theme.palette.primary.main}15`, borderRadius: 0, border: `1px solid ${theme.palette.divider}`, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie">
          <FormatBoldIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa">
          <FormatItalicIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie">
          <FormatUnderlinedIcon />
        </ToolbarButton>

        <Box sx={{ width: '1px', height: '32px', backgroundColor: theme.palette.divider, mx: 0.5 }} />

        <ToolbarButton onClick={(e) => setAnchorTextColor(e.currentTarget)} label="Kolor tekstu">
          <FormatColorTextIcon />
        </ToolbarButton>
        <ToolbarButton onClick={(e) => setAnchorHighlightColor(e.currentTarget)} label="Kolor tła">
          <FormatColorFillIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => { editor.chain().focus().unsetColor().run(); editor.chain().focus().unsetHighlight().run(); }} active={!editor.isActive('textStyle') && !editor.isActive('highlight')} label="Usuń kolory">
          <span style={{ color: theme.palette.primary.contrastText }}>X</span>
        </ToolbarButton>

        <Box sx={{ width: '1px', height: '32px', backgroundColor: theme.palette.divider, mx: 0.5 }} />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} label="Wyrównaj do lewej">
          <FormatAlignLeftIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} label="Wyrównaj do środka">
          <FormatAlignCenterIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} label="Wyrównaj do prawej">
          <FormatAlignRightIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} label="Justuj">
          <FormatAlignJustifyIcon />
        </ToolbarButton>

        <Box sx={{ width: '1px', height: '32px', backgroundColor: theme.palette.divider, mx: 0.5 }} />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Lista punktowana">
          <FormatListBulletedIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Lista numerowana">
          <FormatListNumberedIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Cytat">
          <FormatQuoteIcon />
        </ToolbarButton>

        <Box sx={{ width: '1px', height: '32px', backgroundColor: theme.palette.divider, mx: 0.5 }} />

        <ToolbarButton onClick={addImage} label="Wstaw obrazek (URL)">
          <InsertPhotoIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Upload obrazka">
          <FileUploadIcon />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept={EDITOR_IMAGE_ACCEPT} style={{ display: 'none' }} onChange={handleFileSelect} />
      </Box>
    )}

    <Box sx={{ ...quillStyle, backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0, minHeight: '400px', maxHeight: '500px', overflow: 'auto' }}>
      <EditorContent editor={editor} />
    </Box>

    <Popover open={Boolean(anchorTextColor)} anchorEl={anchorTextColor} onClose={() => setAnchorTextColor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `1px solid ${theme.palette.divider}`, p: 1 } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          {editorColors.map((color) => (
            <Box key={color} onClick={() => { editor?.chain().focus().setColor(color).run(); setAnchorTextColor(null); }} sx={{ width: 32, height: 32, backgroundColor: color, border: `2px solid ${theme.palette.divider}`, borderRadius: 0, cursor: 'pointer', '&:hover': { transform: 'scale(1.1)', borderColor: theme.palette.primary.main } }} />
          ))}
        </Box>
        <Button onClick={() => { editor?.chain().focus().unsetColor().run(); setAnchorTextColor(null); }} variant="outlined" size="small">Reset</Button>
      </Box>
    </Popover>

    <Popover open={Boolean(anchorHighlightColor)} anchorEl={anchorHighlightColor} onClose={() => setAnchorHighlightColor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `1px solid ${theme.palette.divider}`, p: 1 } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
          {editorColors.map((color) => (
            <Box key={color} onClick={() => { editor?.chain().focus().toggleHighlight({ color }).run(); setAnchorHighlightColor(null); }} sx={{ width: 32, height: 32, backgroundColor: color, border: `2px solid ${theme.palette.divider}`, borderRadius: 0, cursor: 'pointer', '&:hover': { transform: 'scale(1.1)', borderColor: theme.palette.primary.main } }} />
          ))}
        </Box>
        <Button onClick={() => { editor?.chain().focus().unsetHighlight().run(); setAnchorHighlightColor(null); }} variant="outlined" size="small">Reset</Button>
      </Box>
    </Popover>
  </DialogContent>
  <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
    <Button onClick={() => setEditingTab(null)} sx={{ color: theme.palette.error.text }}>
      Anuluj
    </Button>
    <Button onClick={handleSaveTab} disabled={savingTab} variant="contained" sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight }, '&:disabled': { backgroundColor: theme.palette.error.main, color: theme.palette.text.secondary } }}>
      {savingTab ? 'Zapisywanie...' : 'Zapisz'}
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - USUŃ ZAKŁADKĘ */}
<Dialog open={Boolean(tabToDelete)} onClose={() => setTabToDelete(null)} PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Usuń zakładkę
  </DialogTitle>
  <DialogContent>
    <Typography sx={{ color: theme.palette.text.primary }}>
      Czy na pewno chcesz usunąć zakładkę "{tabToDelete?.tab_name}"?
    </Typography>
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setTabToDelete(null)} sx={{ color: theme.palette.error.text }}>
      Anuluj
    </Button>
    <Button onClick={() => handleDeleteTab(tabToDelete.id)} variant="contained" sx={{ backgroundColor: theme.palette.error.main, color: theme.palette.text.primary, '&:hover': { backgroundColor: `${theme.palette.error.main}90` } }}>
      Usuń
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - DODAJ PRZEDMIOT FABULARNY (tylko administracja) */}
<Dialog open={showAddStoryItemDialog} onClose={() => setShowAddStoryItemDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
    <InventoryIcon />
    Dodaj przedmiot fabularny
  </DialogTitle>
  <DialogContent>
    <TextField
      autoFocus
      margin="dense"
      label="Nazwa przedmiotu"
      fullWidth
      value={newStoryItem.name}
      onChange={(e) => setNewStoryItem({ ...newStoryItem, name: e.target.value })}
      sx={storyItemFieldStyle}
      inputProps={{ maxLength: 150 }}
    />

    <TextField
      margin="dense"
      label="Opis / historia (opcjonalnie)"
      fullWidth
      multiline
      rows={4}
      value={newStoryItem.description}
      onChange={(e) => setNewStoryItem({ ...newStoryItem, description: e.target.value })}
      sx={{ mt: 2, ...storyItemFieldStyle }}
      inputProps={{ maxLength: 2000 }}
    />

    <TextField
      margin="dense"
      label="Ilość"
      type="number"
      fullWidth
      value={newStoryItem.quantity}
      onChange={(e) => setNewStoryItem({ ...newStoryItem, quantity: e.target.value })}
      sx={{ mt: 2, ...storyItemFieldStyle }}
      inputProps={{ min: 1, max: 9999 }}
    />

    <TextField
      margin="dense"
      label="Pochodzenie (sesja, wydarzenie, NPC) - opcjonalnie"
      fullWidth
      value={newStoryItem.source}
      onChange={(e) => setNewStoryItem({ ...newStoryItem, source: e.target.value })}
      sx={{ mt: 2, ...storyItemFieldStyle }}
      inputProps={{ maxLength: 150 }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button
      onClick={() => {
        setShowAddStoryItemDialog(false);
        setNewStoryItem({ name: '', description: '', quantity: 1, source: '' });
      }}
      sx={{ color: theme.palette.error.text }}
    >
      Anuluj
    </Button>
    <Button
      onClick={handleAddStoryItem}
      disabled={savingStoryItem}
      variant="contained"
      sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight } }}
    >
      {savingStoryItem ? 'Zapisywanie...' : 'Dodaj'}
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - EDYTUJ PRZEDMIOT FABULARNY (tylko administracja) */}
<Dialog open={Boolean(editingStoryItem)} onClose={() => setEditingStoryItem(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
    <InventoryIcon />
    Edytuj przedmiot fabularny
  </DialogTitle>
  <DialogContent>
    <TextField
      autoFocus
      margin="dense"
      label="Nazwa przedmiotu"
      fullWidth
      value={editingStoryItem?.name || ''}
      onChange={(e) => setEditingStoryItem({ ...editingStoryItem, name: e.target.value })}
      sx={storyItemFieldStyle}
      inputProps={{ maxLength: 150 }}
    />

    <TextField
      margin="dense"
      label="Opis / historia (opcjonalnie)"
      fullWidth
      multiline
      rows={4}
      value={editingStoryItem?.description || ''}
      onChange={(e) => setEditingStoryItem({ ...editingStoryItem, description: e.target.value })}
      sx={{ mt: 2, ...storyItemFieldStyle }}
      inputProps={{ maxLength: 2000 }}
    />

    <TextField
      margin="dense"
      label="Ilość"
      type="number"
      fullWidth
      value={editingStoryItem?.quantity ?? 1}
      onChange={(e) => setEditingStoryItem({ ...editingStoryItem, quantity: e.target.value })}
      sx={{ mt: 2, ...storyItemFieldStyle }}
      inputProps={{ min: 1, max: 9999 }}
    />

    <TextField
      margin="dense"
      label="Pochodzenie (sesja, wydarzenie, NPC) - opcjonalnie"
      fullWidth
      value={editingStoryItem?.source || ''}
      onChange={(e) => setEditingStoryItem({ ...editingStoryItem, source: e.target.value })}
      sx={{ mt: 2, ...storyItemFieldStyle }}
      inputProps={{ maxLength: 150 }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setEditingStoryItem(null)} sx={{ color: theme.palette.error.text }}>
      Anuluj
    </Button>
    <Button
      onClick={handleUpdateStoryItem}
      disabled={savingStoryItem}
      variant="contained"
      sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight } }}
    >
      {savingStoryItem ? 'Zapisywanie...' : 'Zapisz'}
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - ZABIERZ PRZEDMIOT FABULARNY (tylko administracja) */}
<Dialog open={Boolean(storyItemToDelete)} onClose={() => setStoryItemToDelete(null)} PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold' }}>
    Zabierz przedmiot
  </DialogTitle>
  <DialogContent>
    <Typography sx={{ color: theme.palette.text.primary }}>
      Czy na pewno zabrać postaci przedmiot "{storyItemToDelete?.name}"? Trafi to do kartoteki postaci.
    </Typography>
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={() => setStoryItemToDelete(null)} sx={{ color: theme.palette.primary.main }}>
      Anuluj
    </Button>
    <Button
      onClick={() => handleDeleteStoryItem(storyItemToDelete.id)}
      variant="contained"
      sx={{ backgroundColor: theme.palette.error.main, color: theme.palette.text.primary, '&:hover': { backgroundColor: `${theme.palette.error.main}90` } }}
    >
      Zabierz
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - ZASADA BALANSU ZALET I WAD (ikonka informacji obok nagłówków
    "Zalety" i "Wady", tylko dopóki karta nie jest zaakceptowana) */}
<Dialog open={showEntriesRuleDialog} onClose={() => setShowEntriesRuleDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
    <InfoIcon />
    Zalety i wady postaci
  </DialogTitle>
  <DialogContent>
    <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.9rem' }}>
      Po zapisaniu karty dodaj zalety i wady swojej postaci (sekcje poniżej karty).
      Każda zaleta i wada ma poziom od 1/5 do 5/5. Przy tworzeniu karty obowiązuje zasada balansu — wybierz jeden z układów:
    </Typography>
    <Typography component="ul" sx={{ color: theme.palette.text.primary, fontSize: '0.9rem', mt: 1, mb: 0, pl: 3 }}>
      <li><b>3 zalety na poziomie 2/5</b> + <b>1 wada na poziomie 1/5</b></li>
      <li><b>2 zalety na poziomie 3/5</b> + <b>1 wada na poziomie 2/5</b></li>
    </Typography>
    <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.8rem', mt: 1 }}>
      Wyższe poziomy zalet i wad (do 5/5) mogą nadać tylko Mistrzowie Gry — m.in. jako konsekwencje z podsumowań sesji.
    </Typography>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setShowEntriesRuleDialog(false)} sx={{ color: theme.palette.primary.main }}>
      Rozumiem
    </Button>
  </DialogActions>
</Dialog>
{/* DIALOG - DODAJ ZDOBYCZ */}
<Dialog open={showAddAchievementDialog} onClose={() => setShowAddAchievementDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Dodaj zaletę
  </DialogTitle>
  <DialogContent>
    {isPrivilegedUser() && entrySuggestions.achievements.length > 0 && (
      <Autocomplete
        options={entrySuggestions.achievements}
        getOptionLabel={(o) => (o?.title ? `${o.title}${o.level ? ` (${o.level}/5)` : ''}` : '')}
        onChange={(e, val) => {
          if (val) setNewAchievement({
            ...newAchievement,
            title: val.title || '',
            description: val.description || '',
            level: val.level ?? newAchievement.level
          });
        }}
        renderInput={(params) => (
          <TextField {...params} margin="dense" label="Wybierz gotową z bazy (opcjonalnie)"
            helperText="Możesz wybrać istniejącą zaletę lub wpisać własną poniżej"
            sx={{ '& .MuiInputLabel-root': { color: theme.palette.primary.main } }} />
        )}
        sx={{ mb: 1 }}
      />
    )}
    <TextField
      autoFocus
      margin="dense"
      label="Tytuł zalety"
      fullWidth
      value={newAchievement.title}
      onChange={(e) => setNewAchievement({ ...newAchievement, title: e.target.value })}
      sx={{
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 100 }}
    />

    <TextField
      margin="dense"
      label="Opis (opcjonalnie)"
      fullWidth
      multiline
      rows={3}
      value={newAchievement.description}
      onChange={(e) => setNewAchievement({ ...newAchievement, description: e.target.value })}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 500 }}
    />

    <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
      <InputLabel>Poziom (1-5)</InputLabel>
      <Select
        label="Poziom (1-5)"
        value={newAchievement.level ?? ''}
        onChange={(e) => setNewAchievement({ ...newAchievement, level: e.target.value })}
      >
        <MenuItem value="">Brak</MenuItem>
        {[1, 2, 3, 4, 5].map((lvl) => (
          <MenuItem key={lvl} value={lvl}>{lvl}/5</MenuItem>
        ))}
      </Select>
    </FormControl>


    <TextField
      margin="dense"
      label="Data początkowa (opcjonalnie)"
      type="date"
      fullWidth
      value={newAchievement.start_date || ''}
      onChange={(e) => setNewAchievement({ ...newAchievement, start_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />

    <TextField
      margin="dense"
      label="Data końcowa (opcjonalnie - brak = stałe)"
      type="date"
      fullWidth
      value={newAchievement.end_date || ''}
      onChange={(e) => setNewAchievement({ ...newAchievement, end_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button
      onClick={() => {
        setShowAddAchievementDialog(false);
        setNewAchievement({ title: '', description: '', level: '', start_date: null, end_date: null });
      }}
      sx={{ color: theme.palette.error.text }}
    >
      Anuluj
    </Button>
    <Button onClick={handleAddAchievement} variant="contained" sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight } }}>
      Dodaj
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - EDYTUJ ZALETĘ */}
<Dialog open={Boolean(editingAchievement)} onClose={() => setEditingAchievement(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Edytuj zaletę
  </DialogTitle>
  <DialogContent>
    <TextField
      autoFocus
      margin="dense"
      label="Tytuł zdobyczy"
      fullWidth
      value={editingAchievement?.title || ''}
      onChange={(e) => setEditingAchievement({ ...editingAchievement, title: e.target.value })}
      sx={{
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 100 }}
    />

    <TextField
      margin="dense"
      label="Opis (opcjonalnie)"
      fullWidth
      multiline
      rows={3}
      value={editingAchievement?.description || ''}
      onChange={(e) => setEditingAchievement({ ...editingAchievement, description: e.target.value })}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 500 }}
    />

    <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
      <InputLabel>Poziom (1-5)</InputLabel>
      <Select
        label="Poziom (1-5)"
        value={editingAchievement?.level ?? ''}
        onChange={(e) => setEditingAchievement({ ...editingAchievement, level: e.target.value })}
      >
        <MenuItem value="">Brak</MenuItem>
        {[1, 2, 3, 4, 5].map((lvl) => (
          <MenuItem key={lvl} value={lvl}>{lvl}/5</MenuItem>
        ))}
      </Select>
    </FormControl>


    <TextField
      margin="dense"
      label="Data początkowa (opcjonalnie)"
      type="date"
      fullWidth
      value={editingAchievement?.start_date ? editingAchievement.start_date.split('T')[0] : ''}
      onChange={(e) => setEditingAchievement({ ...editingAchievement, start_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />

    <TextField
      margin="dense"
      label="Data końcowa (opcjonalnie - brak = stałe)"
      type="date"
      fullWidth
      value={editingAchievement?.end_date ? editingAchievement.end_date.split('T')[0] : ''}
      onChange={(e) => setEditingAchievement({ ...editingAchievement, end_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
    <Button
      onClick={() => setConfirmDialog({
        open: true,
        title: 'Usuń zdobycz',
        message: 'Usunąć zdobycz?',
        confirmText: 'Usuń',
        confirmColor: 'error',
        onConfirm: () => {
          handleDeleteAchievement(editingAchievement.id);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      })}
      startIcon={<DeleteIcon />}
      sx={{
        color: theme.palette.error.text,
        '&:hover': {
          color: theme.palette.error.text,
          backgroundColor: `${theme.palette.error.main}20`
        }
      }}
    >
      Usuń
    </Button>
    <Box>
      <Button onClick={() => setEditingAchievement(null)} sx={{ color: theme.palette.error.text, mr: 1 }}>
        Anuluj
      </Button>
      <Button
        onClick={() => handleUpdateAchievement(editingAchievement.id, {
          title: editingAchievement.title,
          description: editingAchievement.description,
          level: editingAchievement.level,
          start_date: editingAchievement.start_date,
          end_date: editingAchievement.end_date
        })}
        variant="contained"
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.background.default,
          '&:hover': { backgroundColor: theme.palette.primary.mainLight }
        }}
      >
        Zapisz
      </Button>
    </Box>
  </DialogActions>
</Dialog>

{/* DIALOG - DODAJ WADĘ */}
<Dialog open={showAddProblemDialog} onClose={() => setShowAddProblemDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Dodaj wadę
  </DialogTitle>
  <DialogContent>
    {isPrivilegedUser() && entrySuggestions.problems.length > 0 && (
      <Autocomplete
        options={entrySuggestions.problems}
        getOptionLabel={(o) => (o?.title ? `${o.title}${o.level ? ` (${o.level}/5)` : ''}` : '')}
        onChange={(e, val) => {
          if (val) setNewProblem({
            ...newProblem,
            title: val.title || '',
            description: val.description || '',
            level: val.level ?? newProblem.level
          });
        }}
        renderInput={(params) => (
          <TextField {...params} margin="dense" label="Wybierz gotową z bazy (opcjonalnie)"
            helperText="Możesz wybrać istniejącą wadę lub wpisać własną poniżej"
            sx={{ '& .MuiInputLabel-root': { color: theme.palette.primary.main } }} />
        )}
        sx={{ mb: 1 }}
      />
    )}
    <TextField
      autoFocus
      margin="dense"
      label="Tytuł wady"
      fullWidth
      value={newProblem.title}
      onChange={(e) => setNewProblem({ ...newProblem, title: e.target.value })}
      sx={{
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 100 }}
    />

    <TextField
      margin="dense"
      label="Opis (opcjonalnie)"
      fullWidth
      multiline
      rows={3}
      value={newProblem.description}
      onChange={(e) => setNewProblem({ ...newProblem, description: e.target.value })}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 500 }}
    />

    <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
      <InputLabel>Poziom (1-5)</InputLabel>
      <Select
        label="Poziom (1-5)"
        value={newProblem.level ?? ''}
        onChange={(e) => setNewProblem({ ...newProblem, level: e.target.value })}
      >
        <MenuItem value="">Brak</MenuItem>
        {[1, 2, 3, 4, 5].map((lvl) => (
          <MenuItem key={lvl} value={lvl}>{lvl}/5</MenuItem>
        ))}
      </Select>
    </FormControl>


    <TextField
      margin="dense"
      label="Data początkowa (opcjonalnie)"
      type="date"
      fullWidth
      value={newProblem.start_date || ''}
      onChange={(e) => setNewProblem({ ...newProblem, start_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />

    <TextField
      margin="dense"
      label="Data końcowa (opcjonalnie - brak = stałe)"
      type="date"
      fullWidth
      value={newProblem.end_date || ''}
      onChange={(e) => setNewProblem({ ...newProblem, end_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button
      onClick={() => {
        setShowAddProblemDialog(false);
        setNewProblem({ title: '', description: '', level: '', start_date: null, end_date: null });
      }}
      sx={{ color: theme.palette.error.text }}
    >
      Anuluj
    </Button>
    <Button onClick={handleAddProblem} variant="contained" sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight } }}>
      Dodaj
    </Button>
  </DialogActions>
</Dialog>

{/* DIALOG - EDYTUJ WADĘ */}
<Dialog open={Boolean(editingProblem)} onClose={() => setEditingProblem(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Edytuj wadę
  </DialogTitle>
  <DialogContent>
    <TextField
      autoFocus
      margin="dense"
      label="Tytuł wady"
      fullWidth
      value={editingProblem?.title || ''}
      onChange={(e) => setEditingProblem({ ...editingProblem, title: e.target.value })}
      sx={{
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 100 }}
    />

    <TextField
      margin="dense"
      label="Opis (opcjonalnie)"
      fullWidth
      multiline
      rows={3}
      value={editingProblem?.description || ''}
      onChange={(e) => setEditingProblem({ ...editingProblem, description: e.target.value })}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
      inputProps={{ maxLength: 500 }}
    />

    <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
      <InputLabel>Poziom (1-5)</InputLabel>
      <Select
        label="Poziom (1-5)"
        value={editingProblem?.level ?? ''}
        onChange={(e) => setEditingProblem({ ...editingProblem, level: e.target.value })}
      >
        <MenuItem value="">Brak</MenuItem>
        {[1, 2, 3, 4, 5].map((lvl) => (
          <MenuItem key={lvl} value={lvl}>{lvl}/5</MenuItem>
        ))}
      </Select>
    </FormControl>


    <TextField
      margin="dense"
      label="Data początkowa (opcjonalnie)"
      type="date"
      fullWidth
      value={editingProblem?.start_date ? editingProblem.start_date.split('T')[0] : ''}
      onChange={(e) => setEditingProblem({ ...editingProblem, start_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />

    <TextField
      margin="dense"
      label="Data końcowa (opcjonalnie - brak = stałe)"
      type="date"
      fullWidth
      value={editingProblem?.end_date ? editingProblem.end_date.split('T')[0] : ''}
      onChange={(e) => setEditingProblem({ ...editingProblem, end_date: e.target.value || null })}
      InputLabelProps={{ shrink: true }}
      sx={{
        mt: 2,
        '& .MuiOutlinedInput-root': {
          color: theme.palette.text.primary,
          '& fieldset': { borderColor: theme.palette.divider },
          '&:hover fieldset': { borderColor: theme.palette.primary.main },
          '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
        },
        '& .MuiInputLabel-root': {
          color: theme.palette.error.text,
          '&.Mui-focused': { color: theme.palette.primary.main }
        }
      }}
    />
  </DialogContent>
  <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
    <Button
      onClick={() => setConfirmDialog({
        open: true,
        title: 'Usuń problem',
        message: 'Usunąć problem?',
        confirmText: 'Usuń',
        confirmColor: 'error',
        onConfirm: () => {
          handleDeleteProblem(editingProblem.id);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      })}
      startIcon={<DeleteIcon />}
      sx={{
        color: theme.palette.error.text,
        '&:hover': {
          color: theme.palette.error.text,
          backgroundColor: `${theme.palette.error.main}20`
        }
      }}
    >
      Usuń
    </Button>
    <Box>
      <Button onClick={() => setEditingProblem(null)} sx={{ color: theme.palette.error.text, mr: 1 }}>
        Anuluj
      </Button>
      <Button
        onClick={() => handleUpdateProblem(editingProblem.id, {
          title: editingProblem.title,
          description: editingProblem.description,
          level: editingProblem.level,
          start_date: editingProblem.start_date,
          end_date: editingProblem.end_date
        })}
        variant="contained"
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.background.default,
          '&:hover': { backgroundColor: theme.palette.primary.mainLight }
        }}
      >
        Zapisz
      </Button>
    </Box>
  </DialogActions>
</Dialog>

{/* DIALOG - UPLOAD OBRAZKA */}
<Dialog open={imageDialog} onClose={handleCloseImageDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.default, border: `2px solid ${theme.palette.divider}`, borderRadius: 0 } }}>
  <DialogTitle sx={{ color: theme.palette.primary.mainLight,  fontWeight: 'bold' }}>
    Dodaj obrazek
  </DialogTitle>
  <DialogContent>
    {imagePreview && (
      <Box sx={{ mb: 2, textAlign: 'center' }}>
        <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: 0, border: `2px solid ${theme.palette.divider}` }} />
      </Box>
    )}

    <Box sx={{ mb: 2 }}>
      <Typography sx={{ color: theme.palette.primary.main, mb: 1 }}>
        Szerokość: {imageWidth}px
      </Typography>
      <Slider value={imageWidth} onChange={(e, value) => setImageWidth(value)} min={100} max={800} sx={{ color: theme.palette.primary.main, '& .MuiSlider-thumb': { backgroundColor: theme.palette.primary.main }, '& .MuiSlider-track': { backgroundColor: theme.palette.primary.main }, '& .MuiSlider-rail': { backgroundColor: theme.palette.divider } }} />
    </Box>

    <FormControl fullWidth sx={{ '& .MuiOutlinedInput-root': { color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.primary.main }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main } }, '& .MuiInputLabel-root': { color: theme.palette.error.text, '&.Mui-focused': { color: theme.palette.primary.main } } }}>
      <InputLabel>Wyrównanie</InputLabel>
      <Select value={imageAlign} onChange={(e) => setImageAlign(e.target.value)} label="Wyrównanie">
        <MenuItem value="left">Do lewej</MenuItem>
        <MenuItem value="center">Do środka</MenuItem>
        <MenuItem value="right">Do prawej</MenuItem>
      </Select>
    </FormControl>
  </DialogContent>
  <DialogActions sx={{ p: 2 }}>
    <Button onClick={handleCloseImageDialog} sx={{ color: theme.palette.error.text }}>
      Anuluj
    </Button>
    <Button onClick={insertImageFromFile} disabled={uploadingImage} variant="contained" sx={{ backgroundColor: theme.palette.primary.main, color: theme.palette.background.default, '&:hover': { backgroundColor: theme.palette.primary.mainLight }, '&:disabled': { backgroundColor: theme.palette.error.main, color: theme.palette.text.secondary } }}>
      {uploadingImage ? 'Uploading...' : 'Wstaw'}
    </Button>
  </DialogActions>
</Dialog>

<ConfirmDialog
  open={confirmDialog.open}
  title={confirmDialog.title}
  message={confirmDialog.message}
  onConfirm={confirmDialog.onConfirm}
  onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
  confirmText={confirmDialog.confirmText}
  confirmColor={confirmDialog.confirmColor}
/>
<GameToaster />

</Paper>
);
}

export default Profile;