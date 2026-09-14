import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import sanitizeHtml from './sanitizeHtml';
import SessionExportButton from './sessionExport';
import useGameName from './useGameName';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { appColors } from './theme';
import { Box, Typography, Button, IconButton, Alert, Stack, Tooltip, Popover, TextField, Chip, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Avatar, Link, Pagination, FormControlLabel, Checkbox, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

import {
  Warning as LockIcon,
  Warning,
  Settings as LockOpenIcon,
  Close as CloseIcon,
  Edit as EditNoteTwoToneIcon,
  NavigateBefore as ArrowBackIcon,
  PlayArrow as RestoreIcon,
  NavigateNext as SendIcon,
  Add as PersonAddIcon,
  Delete as PersonRemoveIcon,
  Casino as CasinoIcon,
  Group as GroupIcon,
  Info as InfoIcon,
  Edit as EditIcon,
  AccountBox as AccountBoxIcon,
  BarChart as StatsIcon,
  Inventory2 as InventoryIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Italic from '@tiptap/extension-italic';
import { StarColorExtension, processStarText, disableMarkdownPasteRules } from './starText';
import { useTheme } from '@mui/material/styles';
import { decodeJwtPayload, getUserRole, getCurrentCharacter } from './AuthContext';
import useRaceColor from './useRaceColor';
import useKeyboardViewport, { keyboardSafeDialogProps } from './useKeyboardViewport';
import parseDiceRolls from './diceRolls';
import isEditorContentEmpty from './editorContent';
import useResizableEditor from './useResizableEditor';
import useEditorCollapsed from './useEditorCollapsed';
import EditorResizeHandle from './EditorResizeHandle';
import EditorCollapsedBar from './EditorCollapsedBar';
import ToolbarOverflow from './ToolbarOverflow';
import { CHAT_EDITOR_MOBILE, CHAT_EDITOR_DESKTOP, CHAT_PROSEMIRROR_MIN } from './theme';

// Wariant grafiki dividera (rozdzielacz postów) wg rasy biezacej postaci.
import CharacterCardPopup from './CharacterCardPopup';
import CharacterStatsPopup, { hasMechanicalStats } from './CharacterStatsPopup';
import CharacterStoryItemsPopup from './CharacterStoryItemsPopup';
import { getPlayStyle } from './playStyle';
import { getRaceColorSet, readingSurfaceSx } from './theme';
import CharacterHoverCard from './CharacterHoverCard';
import NarratorAvatar, { NarratorMark } from './NarratorAvatar';
import { cardOpenProps } from './cardClick';
import useResponsive from './useResponsive';

// Podgląd i konwersja *gwiazdek* siedzą we wspólnym module (./starText) -
// te same reguły obowiązują w Sesjach, Karczmie i Wiadomościach.

const LimitedImage = Image.extend({
  addAttributes() { return { ...this.parent?.(), style: { default: 'max-width:100%;height:auto;', parseHTML: element => element.getAttribute('style'), renderHTML: attributes => ({ style: `max-width:100%;height:auto;${attributes.style || ''}` }) } }; }
});

const colors = ['#0f0f0f', '#f0f0f0', '#a0522d', '#8b0000', '#556b2f', '#483d8b', '#6b7280', '#2f4f4f', '#800080', '#cd853f'];

function formatDate(dateString) { if (!dateString) return ''; const date = new Date(dateString); return date.toLocaleString('pl-PL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

function formatDateOnly(dateString) { 
  if (!dateString) return ''; 
  const date = new Date(dateString); 
  return date.toLocaleString('pl-PL', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }); 
}

const getCharacterAvatar = (character) => { if (!character) return null; if (character.avatar || character.character_avatar) return `/api${character.avatar || character.character_avatar}`; return null; };


const renderUserNameWithProfile = (username, userId, navigate, additionalText = '', sx = {}) => {
  const handleProfileClick = (e) => { e.preventDefault(); e.stopPropagation(); navigate(`/home/profile/${userId}`); };
  return (
    <Link component="button" onClick={handleProfileClick} sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 'inherit', fontSize: 'inherit', border: 'none', background: 'none', padding: 0, cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'text.secondary' }, ...sx }}>
      {username} (#{userId}){additionalText}
    </Link>
  );
};

const ToolbarButton = ({ onClick, active, children, label, disabled = false }) => (
  <Tooltip title={label} arrow>
    <span>
      <Button
        size="small"
        onClick={onClick}
        disabled={disabled}
        sx={{
          minWidth: 36,
          minHeight: 36,
          p: 0,
          mx: 0,
          borderRadius: 0,
          border: 'none',
          backgroundColor: active ? 'rgba(90, 90, 90, 0.3)' : 'transparent',
          color: 'inherit',
          '&:hover': {
            backgroundColor: 'rgba(90, 90, 90, 0.5)',
            border: 'none'
          },
          '&:disabled': {
            opacity: 0.3
          }
        }}
      >
        {children}
      </Button>
    </span>
  </Tooltip>
);

const EditorToolbar = ({ editor, anchorTextColor, setAnchorTextColor, anchorBgColor, setAnchorBgColor, isMobile, editorId, onSend, canSend = false, onDiceRoll, isNarratorMode, setIsNarratorMode, isEditMode = false }) => {
  const theme = useTheme();
  const uniqueId = editorId || `editor-${Math.random().toString(36).substr(2, 9)}`;
  const [anchorAlign, setAnchorAlign] = React.useState(null);
  const [anchorImage, setAnchorImage] = React.useState(null);
  const [diceDialogOpen, setDiceDialogOpen] = React.useState(false);
  const [diceDescription, setDiceDescription] = React.useState('');
  const [diceSides, setDiceSides] = React.useState(20);
  const [diceModifier, setDiceModifier] = React.useState(0);
  const [diceRolling, setDiceRolling] = React.useState(false);
  // `return null` MUSI stac PO hookach: gdy `editor` zmieni sie z null na
  // instancje (TipTap tworzy ja asynchronicznie), React zobaczy najpierw 0
  // hookow, a potem kilka - i wywala "Rendered more hooks than during the
  // previous render". Kolejnosc hookow musi byc identyczna w kazdym renderze.
  if (!editor) return null;

  const handleImageUrl = () => {
    const url = window.prompt('URL obrazka');
    if (url) editor.chain().focus().setImage({ src: url }).run();
    setAnchorImage(null);
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = EDITOR_IMAGE_ACCEPT;
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Format i rozmiar sprawdzamy tymi samymi regułami co backend.
      const validationError = validateEditorImage(file);
      if (validationError) {
        alert(validationError);
        return;
      }

      try {
        // Plik ląduje na serwerze, a w treści zostaje ścieżka - wklejany
        // wcześniej base64 wysadzał zapis, bo treść nie mieści się w kolumnie
        // TEXT (64 KB), więc obrazek znikał albo wiadomość nie szła w ogóle.
        const imageUrl = await uploadEditorImage(file);
        editor.chain().focus().setImage({ src: imageUrl }).run();
      } catch (error) {
        console.error('Błąd dodawania obrazka:', error);
        alert(error.message || 'Wystąpił błąd podczas dodawania obrazka.');
      }
    };
    input.click();
    setAnchorImage(null);
  };

  // Rzut liczy SERWER (/api/dice/roll) i zwraca podpisany wynik - ten sam,
  // który trafi do wiadomości. Dzięki temu podgląd == zapis i nie da się oszukać.
  const handleDiceRoll = async () => {
    if (diceRolling) return;
    setDiceRolling(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/dice/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sides: diceSides, modifier: diceModifier, description: diceDescription })
      });
      if (!res.ok) throw new Error('roll failed');
      const rollObj = await res.json();
      if (onDiceRoll) onDiceRoll(rollObj);
    } catch (e) {
      console.error('Błąd rzutu kością:', e);
      // Fallback: wyślij samą konfigurację - serwer i tak wylosuje przy wysyłce.
      if (onDiceRoll) onDiceRoll({ sides: diceSides, modifier: diceModifier, description: diceDescription });
    } finally {
      setDiceRolling(false);
      setDiceDescription('');
      setDiceModifier(0);
      setDiceDialogOpen(false);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={0.2} mb={0} flexWrap="nowrap" alignItems="center" sx={{ userSelect: 'none', overflowX: 'auto', width: '100%', '&::-webkit-scrollbar': { height: '4px' }, '&::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.1)' }, '&::-webkit-scrollbar-thumb': { background: theme.palette.secondary.main, borderRadius: '2px' } }}>

        {/* Przycisk wysyłania - PO LEWEJ */}
        {onSend && (
          <Tooltip title="Wyślij wiadomość" arrow>
            <span>
              <Button variant="contained" onClick={onSend} disabled={!canSend} sx={{ backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark }, '&:disabled': { backgroundColor: 'rgba(154, 119, 40, 0.3)', color: 'rgba(255, 255, 255, 0.3)' }, minWidth: isMobile ? 36 : 44, mr: 1, px: isMobile ? 0.5 : 1 }}>
                <SendIcon sx={{ fontSize: isMobile ? 12 : 14 }} />{!isMobile && <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>Wyślij</span>}
              </Button>
            </span>
          </Tooltip>
        )}

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa"><i>I</i></ToolbarButton>

        {/* Na mobile te narzędzia chowają się pod "..." - inaczej pasek jest
            szerszy niż ekran i kostka z trybem narratora (używane najczęściej)
            lądują poza nim. Na desktopie ToolbarOverflow renderuje je w miejscu,
            więc kolejność przycisków zostaje bez zmian. */}
        <ToolbarOverflow isMobile={isMobile} accentColor={theme.palette.divider}>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie"><u>U</u></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorBgColor(e.currentTarget)} active={false} label="Kolor tła"><span style={{ backgroundColor:theme.palette.text.secondary, padding: '0 4px' }}>A</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorTextColor(e.currentTarget)} active={false} label="Kolor tekstu"><span style={{ color:theme.palette.text.secondary }}>A</span></ToolbarButton>
          <ToolbarButton onClick={() => { editor.chain().focus().unsetColor().run(); editor.chain().focus().unsetHighlight().run(); }} active={!editor.isActive('textStyle') && !editor.isActive('highlight')} label="Usuń kolory"><span style={{ color: theme.palette.text.primary }}>X</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorAlign(e.currentTarget)} active={false} label="Wyrównanie tekstu">
            <span style={{ fontSize: '16px' }}>≡</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Lista">•</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Cytat"><span style={{ fontSize: '18px', lineHeight: 1 }}>❝</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorImage(e.currentTarget)} active={false} label="Obrazek">🖼</ToolbarButton>
        </ToolbarOverflow>

        {onDiceRoll && !isEditMode && (
          <ToolbarButton onClick={() => setDiceDialogOpen(true)} label={`Rzut kostką K${diceSides}`}>
            <CasinoIcon sx={{ fontSize: 18 }} />
          </ToolbarButton>
        )}

        {setIsNarratorMode && !isEditMode && (
          <ToolbarButton
            onClick={() => setIsNarratorMode(!isNarratorMode)}
            active={isNarratorMode}
            label={isNarratorMode ? "Wyłącz tryb narratora" : "Włącz tryb narratora"}
          >
            <NarratorMark sx={{ fontSize: 18 }} />
          </ToolbarButton>
        )}
      </Stack>

      <Dialog open={diceDialogOpen} onClose={() => setDiceDialogOpen(false)} PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `2px solid ${theme.palette.divider}`, borderRadius: 2 } }}>
        <DialogTitle sx={{ color:theme.palette.text.secondary }}>
          <CasinoIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Rzut kostką K{diceSides}
        </DialogTitle>
        <DialogContent>
          <TextField fullWidth type="number" label="Liczba ścianek kostki" value={diceSides} onChange={(e) => setDiceSides(Math.max(1, parseInt(e.target.value) || 1))} inputProps={{ min: 1 }} sx={{ mt: 2, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary } }} />
          <TextField fullWidth type="number" label="Modyfikator MG (opcjonalnie)" value={diceModifier} onChange={(e) => setDiceModifier(parseInt(e.target.value) || 0)} helperText="Kości oficjalne: K20 od -5 do +5, K100 od -15 do +15. Inne kości - dowolność MG." sx={{ mt: 2, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }, '& .MuiFormHelperText-root': { color: theme.palette.text.secondary } }} />
          <TextField fullWidth label="Opis rzutu (opcjonalnie)" value={diceDescription} onChange={(e) => setDiceDescription(e.target.value)} placeholder="np. Rzut na percepcję" sx={{ mt: 2, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiceDialogOpen(false)} sx={{ color: theme.palette.text.secondary }}>Anuluj</Button>
          <Button onClick={handleDiceRoll} disabled={diceRolling} variant="contained" startIcon={<CasinoIcon />} sx={{ backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>
            {diceRolling ? 'Losowanie...' : 'Rzuć kostką'}
          </Button>
        </DialogActions>
      </Dialog>

      <Popover open={Boolean(anchorAlign)} anchorEl={anchorAlign} onClose={() => setAnchorAlign(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
          <Tooltip title="Do lewej" arrow>
            <Button onClick={() => { editor.chain().focus().setTextAlign('left').run(); setAnchorAlign(null); }} sx={{ minWidth: 36, height: 36, p: 0, border: `1px solid ${theme.palette.divider}`, bgcolor: editor.isActive({ textAlign: 'left' }) ? theme.palette.secondary.main : 'transparent' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '16px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '18px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title="Wyśrodkuj" arrow>
            <Button onClick={() => { editor.chain().focus().setTextAlign('center').run(); setAnchorAlign(null); }} sx={{ minWidth: 36, height: 36, p: 0, border: `1px solid ${theme.palette.divider}`, bgcolor: editor.isActive({ textAlign: 'center' }) ? theme.palette.secondary.main : 'transparent' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '14px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '18px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title="Do prawej" arrow>
            <Button onClick={() => { editor.chain().focus().setTextAlign('right').run(); setAnchorAlign(null); }} sx={{ minWidth: 36, height: 36, p: 0, border: `1px solid ${theme.palette.divider}`, bgcolor: editor.isActive({ textAlign: 'right' }) ? theme.palette.secondary.main : 'transparent' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '16px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '18px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title="Wyjustuj" arrow>
            <Button onClick={() => { editor.chain().focus().setTextAlign('justify').run(); setAnchorAlign(null); }} sx={{ minWidth: 36, height: 36, p: 0, border: `1px solid ${theme.palette.divider}`, bgcolor: editor.isActive({ textAlign: 'justify' }) ? theme.palette.secondary.main : 'transparent' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
        </Stack>
      </Popover>

      <Popover open={Boolean(anchorTextColor)} anchorEl={anchorTextColor} onClose={() => setAnchorTextColor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ p: 1, maxWidth: 220 }}>
          {colors.map(color => <Button key={`text-${color}-${uniqueId}`} onClick={() => { editor.chain().focus().setColor(color).run(); setAnchorTextColor(null); }} sx={{ bgcolor: color, border: `1px solid ${theme.palette.divider}`, width: 28, height: 28, minWidth: 28, p: 0 }} />)}
          <Button onClick={() => { editor.chain().focus().unsetColor().run(); setAnchorTextColor(null); }} variant="outlined">Reset</Button>
        </Stack>
      </Popover>
      <Popover open={Boolean(anchorBgColor)} anchorEl={anchorBgColor} onClose={() => setAnchorBgColor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ p: 1, maxWidth: 220 }}>
          {colors.map(color => <Button key={`bg-${color}-${uniqueId}`} onClick={() => { editor.chain().focus().setHighlight({ color }).run(); setAnchorBgColor(null); }} sx={{ bgcolor: color, border: `1px solid ${theme.palette.divider}`, width: 28, height: 28, minWidth: 28, p: 0 }} />)}
          <Button onClick={() => { editor.chain().focus().unsetHighlight().run(); setAnchorBgColor(null); }} variant="outlined">Reset</Button>
        </Stack>
      </Popover>

      {/* Popover obrazka */}
      <Popover open={Boolean(anchorImage)} anchorEl={anchorImage} onClose={() => setAnchorImage(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Stack direction="column" spacing={1} sx={{ p: 1 }}>
          <Button onClick={handleImageUrl} variant="outlined" sx={{ justifyContent: 'flex-start' }}>📎 URL obrazka</Button>
          <Button onClick={handleImageUpload} variant="outlined" sx={{ justifyContent: 'flex-start' }}>📁 Upload z urządzenia</Button>
        </Stack>
      </Popover>
    </>
  );
};

function GeneralSessions() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const race = useRaceColor(); // ramka/tinta/hover wg rasy
  const raceFrame = race.frame || 'human';
  const gameName = useGameName(''); // nagłówek eksportowanego dokumentu sesji
  // Stan główny
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [errorCreate, setErrorCreate] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [session, setSession] = useState(null);
  const [editMsgId, setEditMsgId] = useState(null);
  const [editMsgValue, setEditMsgValue] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [unreadSessionIds, setUnreadSessionIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [messagesPerPage] = useState(20);
  const [archivedSessions, setArchivedSessions] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [errorArchive, setErrorArchive] = useState('');
  const [reopenDialog, setReopenDialog] = useState({ open: false, session: null });
  const [reopening, setReopening] = useState(false);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState([]);
  const [inputCharacterId, setInputCharacterId] = useState('');
  const [characterIdError, setCharacterIdError] = useState('');
  const [addingCharacter, setAddingCharacter] = useState(false);
  const [charactersCache, setCharactersCache] = useState({});
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [newMemberIds, setNewMemberIds] = useState([]);
  const [newMemberInput, setNewMemberInput] = useState('');
  const [newMemberError, setNewMemberError] = useState('');
  const [addingNewMembers, setAddingNewMembers] = useState(false);
  const [sessionParticipants, setSessionParticipants] = useState([]);
  const [showRemoveMembers, setShowRemoveMembers] = useState(false);
  const [removingMembers, setRemovingMembers] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [newMsgAnchorTextColor, setNewMsgAnchorTextColor] = useState(null);
  const [newMsgAnchorBgColor, setNewMsgAnchorBgColor] = useState(null);
  const [editMsgAnchorTextColor, setEditMsgAnchorTextColor] = useState(null);
  const [editMsgAnchorBgColor, setEditMsgAnchorBgColor] = useState(null);
  const [firstMsgAnchorTextColor, setFirstMsgAnchorTextColor] = useState(null);
  const [firstMsgAnchorBgColor, setFirstMsgAnchorBgColor] = useState(null);
  const [isNarratorMode, setIsNarratorMode] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);
  const [checkingParticipation, setCheckingParticipation] = useState(false);
  // Widoczny obszar okna + wykrycie klawiatury - wspólny hook (patrz
  // useKeyboardViewport.js). Wcześniej ten sam kod stał tutaj lokalnie, w
  // każdym z czterech ekranów czatu i dodatkowo w Home.js.
  // Pełny obiekt zostaje pod ręką dla keyboardSafeDialogProps (potrzebuje też offsetTop).
  const keyboardViewport = useKeyboardViewport();
  const { viewportHeight, keyboardVisible } = keyboardViewport;
  const [pendingDiceRolls, setPendingDiceRolls] = useState([]);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);

  // State dla dice popup
  const [dicePopupOpen, setDicePopupOpen] = useState(false);
  const [selectedDiceRolls, setSelectedDiceRolls] = useState(null);

  // State dla pending dice rolls preview popup
  const [pendingDicePopupOpen, setPendingDicePopupOpen] = useState(false);

  // State dla character card popup
  const [showCharacterCardPopup, setShowCharacterCardPopup] = useState(false);
  const [selectedCharacterForCard, setSelectedCharacterForCard] = useState(null);

  // State dla podglądu statystyk uczestnika (tylko postacie grające mechanicznie)
  const [showCharacterStatsPopup, setShowCharacterStatsPopup] = useState(false);
  const [selectedCharacterForStats, setSelectedCharacterForStats] = useState(null);

  // State dla podglądu przedmiotów fabularnych uczestnika (spis z profilu)
  const [showCharacterStoryItemsPopup, setShowCharacterStoryItemsPopup] = useState(false);
  const [selectedCharacterForStoryItems, setSelectedCharacterForStoryItems] = useState(null);

  // State dla +18 warning popup
  const [showAdultWarning, setShowAdultWarning] = useState(false);

  // Nowe stany dla informacji o sesji
  const [startDate, setStartDate] = useState('');
  const [location_info, setLocationInfo] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isAdultOnly, setIsAdultOnly] = useState(false);
  const [showSessionInfoDialog, setShowSessionInfoDialog] = useState(false);
  const [editingSessionInfo, setEditingSessionInfo] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAdditionalInfo, setEditAdditionalInfo] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingSessionInfo, setSavingSessionInfo] = useState(false);
  const [sessionInfoError, setSessionInfoError] = useState('');

  // Owner notes dialog states
  const [showOwnerNotesDialog, setShowOwnerNotesDialog] = useState(false);
  const [ownerNotesValue, setOwnerNotesValue] = useState('');
  const [savingOwnerNotes, setSavingOwnerNotes] = useState(false);
  const [ownerNotesError, setOwnerNotesError] = useState('');

  // Close session summary dialog states
  const [showCloseSummaryDialog, setShowCloseSummaryDialog] = useState(false);
  const [closeSummaryData, setCloseSummaryData] = useState({
    description: '',
    world_consequences: '',
    character_consequences: '',
    advantages_disadvantages: ''
  });
  const [participantConsequences, setParticipantConsequences] = useState({});

  const messagesEndRef = useRef(null);
  const editorContainerRef = useRef(null);  // Edytor odpowiedzi w istniejącej sesji
  const firstMsgEditorContainerRef = useRef(null);  // Edytor przy tworzeniu nowej sesji
  const token = localStorage.getItem('token');

  // Pobierz userId z tokena JWT
  const userId = useMemo(() => {
    if (token) {
      const payload = decodeJwtPayload(token);
      return payload?.id || null;
    }
    return null;
  }, [token]);

  // Pobierz rolę użytkownika
  const userRole = getUserRole(token);

  const { isSmall: isMobile } = useResponsive(); // wspólny próg z powłoką (1050px)
  const isCreatingSession = location.pathname.includes('/home/generalSessions/new');
  const isArchiveView = location.pathname.includes('/home/generalSessions/archive');
  const isViewingSession = sessionId && !isNaN(sessionId);

  const totalPages = Math.ceil(messages.length / messagesPerPage);
  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const currentMessages = messages.slice(indexOfFirstMessage, indexOfLastMessage);

  // Wysokość odniesienia dla całego widoku. viewportHeight z hooka to realny
  // WIDOCZNY obszar (visualViewport), więc przy otwartej klawiaturze jest już
  // pomniejszony - nie trzeba tego rozgałęziać jak wcześniej.
  const containerHeight = viewportHeight || window.innerHeight;

  // Rozmiary edytora. Na mobile dolna granica jest świadomie WYSOKA (wcześniej
  // 30 px, przez co pole pisania schodziło do dwóch linijek przy otwartej
  // klawiaturze - to była jedna z głównych skarg graczy).
  const editorLimits = isMobile
    ? {
        minHeight: keyboardVisible
          ? CHAT_EDITOR_MOBILE.minWithKeyboard
          : CHAT_EDITOR_MOBILE.minWithoutKeyboard,
        baseHeight: keyboardVisible
          ? CHAT_EDITOR_MOBILE.baseWithKeyboard
          : CHAT_EDITOR_MOBILE.baseWithoutKeyboard,
        maxHeight: containerHeight * (keyboardVisible
          ? CHAT_EDITOR_MOBILE.maxRatioWithKeyboard
          : CHAT_EDITOR_MOBILE.maxRatio),
      }
    : {
        minHeight: CHAT_EDITOR_DESKTOP.min,
        baseHeight: CHAT_EDITOR_DESKTOP.base,
        maxHeight: containerHeight * CHAT_EDITOR_DESKTOP.maxRatio,
      };

  // Hook zwraca wysokość JUŻ przyciętą do min/max, więc nie ma tu drugiego
  // clampowania. Uchwyt do przeciągania jest podpięty niżej (EditorResizeHandle) -
  // wcześniej resizeHandleProps nie trafiał na żaden element i regulacja
  // wysokości w ogóle nie działała.
  const { editorHeight, isResizing, resizeHandleProps } = useResizableEditor(editorLimits);

  // Minimalna wysokość samego pola pisania - decyduje ile linii widać podczas
  // pisania (na telefonie z klawiaturą to wcześniej były 44 px = dwie linijki).
  // Zwinięcie edytora jest ZAPAMIĘTYWANE (osobno dla mobile i desktopu), więc
  // wybór gracza przeżywa przejście na inną sesję - wcześniej komponent montował
  // się od nowa i edytor znów się rozwijał. Domyślnie: mobile zwinięty,
  // desktop rozwinięty.
  const [isEditorCollapsed, setIsEditorCollapsed] = useEditorCollapsed(isMobile);

  const proseMirrorMin = isMobile
    ? (keyboardVisible ? CHAT_PROSEMIRROR_MIN.mobileWithKeyboard : CHAT_PROSEMIRROR_MIN.mobile)
    : CHAT_PROSEMIRROR_MIN.desktop;

  // Na telefonie chowamy pasek nagłówka sesji, gdy gracz pisze - te ~50 px to
  // przy otwartej klawiaturze jakieś dwie dodatkowe linie czytanej treści.
  const hideChromeForKeyboard = isMobile && keyboardVisible;

  // DODAJ FUNKCJĘ renderCharacterWithTooltip TUTAJ (wewnątrz komponentu)
  // Lista ras do mapowania klucza (np. "RASA_3") na czytelną nazwę w tooltipie
  const [races, setRaces] = useState([]);
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);
  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';

  const renderCharacterWithTooltip = (characterName, characterId, authorName, authorId, avatar, race, gender, faction) => {
    if (!characterName || !characterId) return null;

    return (
      <Tooltip
        arrow
        enterDelay={300}
        placement="top"
        componentsProps={{
          tooltip: {
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `2px solid ${theme.palette.divider}`,
              borderRadius: '0',
              backdropFilter: 'blur(20px)',
              p: 0,
              color: theme.palette.text.primary
            }
          },
          arrow: {
            sx: {
              color: theme.palette.text.secondary
            }
          }
        }}
        title={
          <CharacterHoverCard
            avatar={avatar}
            name={characterName}
            id={characterId}
            raceName={getRaceName(faction)}
            gender={gender}
          />
        }
      >
        <Link
          component="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(`/home/profile/${characterId}`);
          }}
          sx={{
            color: theme.palette.primary.main,
            textDecoration: 'none',
            fontWeight: 'inherit',
            fontSize: 'inherit',
            border: 'none',
            background: 'none',
            padding: 0,
            cursor: 'pointer',
            '&:hover': {
              textDecoration: 'underline',
              color: theme.palette.primary.light
            }
          }}
        >
          {characterName}
        </Link>
      </Tooltip>
    );
  };
  
  // Auto-scroll edytorów do widoku gdy użytkownik kliknie w nie na mobile
  useEffect(() => {
    if (!isMobile) return;

    const handleEditorFocus = (containerRef) => () => {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 500); // Opóźnienie na wyświetlenie klawiatury
    };

    // Obsługa edytora odpowiedzi (newMsgEditor)
    const newMsgProseMirror = editorContainerRef.current?.querySelector('.ProseMirror');
    const newMsgHandler = handleEditorFocus(editorContainerRef);
    if (newMsgProseMirror) {
      newMsgProseMirror.addEventListener('focus', newMsgHandler);
    }

    // Obsługa edytora tworzenia nowej sesji (firstMsgEditor)
    const firstMsgProseMirror = firstMsgEditorContainerRef.current?.querySelector('.ProseMirror');
    const firstMsgHandler = handleEditorFocus(firstMsgEditorContainerRef);
    if (firstMsgProseMirror) {
      firstMsgProseMirror.addEventListener('focus', firstMsgHandler);
    }

    return () => {
      if (newMsgProseMirror) {
        newMsgProseMirror.removeEventListener('focus', newMsgHandler);
      }
      if (firstMsgProseMirror) {
        firstMsgProseMirror.removeEventListener('focus', firstMsgHandler);
      }
    };
  }, [isMobile, isCreatingSession, isViewingSession]);

  const extensions = [
    StarterKit.configure({ underline: false, bulletList: false, orderedList: false, italic: false }),
    BulletList.extend({ addInputRules() { return []; } }),
    OrderedList.extend({ addInputRules() { return []; } }),
    Italic.extend(disableMarkdownPasteRules),
    Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    LimitedImage.configure({ inline: false, allowBase64: true }),
    StarColorExtension
  ];

  const newMsgEditor = useEditor({ extensions, content: newMessage, editable: !(session?.closed) && isParticipant, onUpdate: ({ editor }) => setNewMessage(editor.getHTML()) }, [session, isParticipant]);
  const editMsgEditor = useEditor({ extensions, content: editMsgValue, onUpdate: ({ editor }) => setEditMsgValue(editor.getHTML()) }, [editMsgId]);
  const firstMsgEditor = useEditor({ extensions, content: firstMessage, onUpdate: ({ editor }) => setFirstMessage(editor.getHTML()) });

  const handleDiceRoll = (rollObj) => {
    setPendingDiceRolls(prev => [...prev, rollObj]);
  };

  // Rozwinięcie edytora z paska "Napisz wiadomość..." ma od razu ustawić kursor
  // w polu - inaczej gracz musiałby dotknąć dwa razy.
  const expandEditorAndFocus = useCallback(() => {
    setIsEditorCollapsed(false);
    setTimeout(() => { newMsgEditor?.commands?.focus(); }, 60);
  }, [newMsgEditor]);

  // Load pending dice rolls from localStorage
  useEffect(() => {
    if (sessionId) {
      const storageKey = `generalSessions_pendingDiceRolls_${sessionId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setPendingDiceRolls(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse pending dice rolls:', e);
        }
      }
    }
  }, [sessionId]);

  // Save pending dice rolls to localStorage
  useEffect(() => {
    if (sessionId) {
      const storageKey = `generalSessions_pendingDiceRolls_${sessionId}`;
      if (pendingDiceRolls.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(pendingDiceRolls));
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [pendingDiceRolls, sessionId]);

  useEffect(() => {
    if (isArchiveView) { fetchArchivedSessions(); } else { fetchSessions(); }
    if (isViewingSession) { fetchSessionData(); fetchMessages(); checkSessionParticipation(); fetchSessionParticipants(); }
  }, [sessionId, isCreatingSession, isArchiveView]);

  useEffect(() => {
    const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, keyboardVisible ? 200 : 100);
    return () => clearTimeout(timer);
  }, [messages, editorHeight, keyboardVisible, viewportHeight]);

  useEffect(() => {
    if (messages.length > 0 && totalPages > 0) { setCurrentPage(totalPages); }
  }, [messages.length, totalPages]);

  useEffect(() => {
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) {
      setUnreadSessionIds([]);
      return;
    }
    
    const unreadIds = sessions.filter(s => {
      if (!s.is_participant) return false;
      
      if (!s.participant_seen_at) return true;
      
      const lastActivity = new Date(s.last_activity || 0).getTime();
      const seenAt = new Date(s.participant_seen_at).getTime();
      
      return lastActivity > seenAt;
    }).map(s => s.id);
    
    setUnreadSessionIds(unreadIds);
  }, [sessions]);

  useEffect(() => {
    // Stan widocznego obszaru należy teraz do wspólnego hooka (odmontowanie
    // komponentu samo go sprząta), więc zostaje tylko czyszczenie stylów body.
    const handleComponentCleanup = () => { document.body.style.overflow = ''; document.body.style.overflowY = ''; document.body.style.height = ''; document.body.style.position = ''; document.body.style.width = ''; };
    return handleComponentCleanup;
  }, []);

  // Funkcja sprawdzająca czy użytkownik może widzieć wyniki rzutów przed wysłaniem
  const canViewDiceResults = () => {
    if (!session) return false;
    // Właściciel sesji, admin lub mistrz_gry mogą widzieć wyniki
    return session.created_by === userId || userRole === 'admin' || userRole === 'mistrz_gry';
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter) { setSessions([]); return; }

      const response = await fetch(`/api/generalSessions?characterId=${currentCharacter.id}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch { setSessions([]); } finally { setLoading(false); }
  };

  const fetchArchivedSessions = async () => {
    try {
      setLoadingArchive(true); setErrorArchive('');
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter) { setErrorArchive('Brak aktywnej postaci'); return; }

      const response = await fetch(`/api/generalSessions/archive?characterId=${currentCharacter.id}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd podczas pobierania archiwum sesji');
      setArchivedSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) {
      console.error('Error fetching archived sessions:', error);
      setErrorArchive(error.message || 'Wystąpił błąd podczas ładowania archiwum sesji');
      setArchivedSessions([]);
    } finally { setLoadingArchive(false); }
  };

  const fetchSessionData = async () => {
    try {
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter) { setSession(null); return; }

      const response = await fetch(`/api/generalSessions/${sessionId}?characterId=${currentCharacter.id}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      setSession(data.error ? null : data.session);
      setSessionParticipants(data.participants || []);
      if (!data.error && !isArchiveView) await markSessionAsRead(data.session);
    } catch { setSession(null); }
  };

  const markSessionAsRead = async (sessionData) => {
    const currentCharacter = getCurrentCharacter();
    if (!sessionData?.id || !currentCharacter?.id) return;
    
    try {
      const response = await fetch(`/api/generalSessions/${sessionData.id}/seen`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        }, 
        body: JSON.stringify({ 
          characterId: currentCharacter.id
        }) 
      });

      if (response.ok) {
        await fetchSessions();
        // Powiadom Sidebar o aktualizacji powiadomień
        window.dispatchEvent(new CustomEvent('generalSessionsUpdated'));
      }
    } catch (e) {
      console.error('❌ Error marking session as read:', e);
    }
  };

  const fetchMessages = async () => {
    try {
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter) {
        setMessages([]);
        return;
      }

      const response = await fetch(`/api/generalSessions/${sessionId}/messages?characterId=${currentCharacter.id}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await response.json();
      setMessages(data.messages || []);
    } catch { 
      setMessages([]); 
    }
  };

  const checkSessionParticipation = async () => {
    if (!sessionId) return false;
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) { setIsParticipant(false); return false; }
    
    try {
      setCheckingParticipation(true);
      const response = await fetch(`/api/generalSessions/${sessionId}?characterId=${currentCharacter.id}`, { headers: { Authorization: `Bearer ${token}` } });
      
      if (response.ok) {
        const data = await response.json();
        const isCharacterParticipant = data.participants?.some(participant => participant.character_id === currentCharacter.id) || false;
        setIsParticipant(isCharacterParticipant);
        return isCharacterParticipant;
      }
      return false;
    } catch (error) {
      console.error('Error checking session participation:', error);
      setIsParticipant(false);
      return false;
    } finally { setCheckingParticipation(false); }
  };

  const fetchSessionParticipants = async () => {
    if (!sessionId) return;
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) return;
    
    try {
      const response = await fetch(`/api/generalSessions/${sessionId}?characterId=${currentCharacter.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setSessionParticipants(data.participants || []);
      }
    } catch (error) { console.error('Error fetching session participants:', error); }
  };

  const fetchCharacterById = async (characterId) => {
    try {
      const response = await fetch(`/api/characters/${characterId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      return data.character || null;
    } catch { return null; }
  };

  const handleAddCharacterId = async () => {
    const id = inputCharacterId.trim();
    if (!id || isNaN(id)) { setCharacterIdError('Podaj prawidłowe ID postaci'); return; }
    
    setAddingCharacter(true);
    const character = await fetchCharacterById(id);
    setAddingCharacter(false);
    
    if (!character) { setCharacterIdError('Nie znaleziono postaci o takim ID'); return; }
    if (selectedCharacterIds.includes(parseInt(id))) { setCharacterIdError('Ta postać już jest na liście'); return; }
    
    setSelectedCharacterIds([...selectedCharacterIds, parseInt(id)]);
    setCharactersCache(prev => ({ ...prev, [id]: character }));
    setCharacterIdError(''); setInputCharacterId('');
  };

  const handleRemoveCharacterId = (characterId) => {
    setSelectedCharacterIds(selectedCharacterIds.filter(id => id !== characterId));
    setCharactersCache(prev => { const newCache = { ...prev }; delete newCache[characterId]; return newCache; });
  };

  const handleAddNewMemberId = async () => {
    const id = newMemberInput.trim();
    if (!id || isNaN(id)) { setNewMemberError('Podaj prawidłowe ID postaci'); return; }
    
    if (sessionParticipants.some(p => p.character_id === Number(id))) { setNewMemberError('Ta postać już jest uczestnikiem sesji'); return; }
    if (newMemberIds.includes(Number(id))) { setNewMemberError('Ta postać już jest na liście do dodania'); return; }
    
    const character = await fetchCharacterById(id);
    if (!character) { setNewMemberError('Nie znaleziono postaci o takim ID'); return; }
    
    setNewMemberIds([...newMemberIds, Number(id)]);
    setCharactersCache(prev => ({ ...prev, [id]: character }));
    setNewMemberError(''); setNewMemberInput('');
  };

  const handleRemoveNewMemberId = (id) => { setNewMemberIds(newMemberIds.filter(cid => cid !== id)); };

  const addMembersToSession = async () => {
    if (newMemberIds.length === 0) return;
    
    try {
      setAddingNewMembers(true); setNewMemberError('');
      
      const response = await fetch(`/api/generalSessions/${sessionId}/addMembers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ characterIds: newMemberIds }) });
      
      if (response.ok) {
        await fetchSessionParticipants();
        setNewMemberIds([]); setShowAddMembers(false); setNewMemberInput('');
        setCharactersCache({});
      } else {
        const errorData = await response.json();
        setNewMemberError(errorData.message || 'Błąd podczas dodawania członków');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      setNewMemberError('Wystąpił błąd podczas dodawania członków');
    } finally { setAddingNewMembers(false); }
  };

  const removeMemberFromSession = async (characterId) => {
    if (!characterId) return;
    
    try {
      setRemovingMembers(true); setRemoveError('');
      
      const response = await fetch(`/api/generalSessions/${sessionId}/members/${characterId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      
      if (response.ok) {
        await fetchSessionParticipants(); setShowRemoveMembers(false);
      } else {
        const errorData = await response.json();
        setRemoveError(errorData.message || 'Błąd podczas usuwania członka');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      setRemoveError('Wystąpił błąd podczas usuwania członka');
    } finally { setRemovingMembers(false); }
  };
  const sendMessage = async () => {
    // Sam rzut kostką (bez tekstu) to pełnoprawna wiadomość - patrz editorContent.js.
    const hasText = !isEditorContentEmpty(newMessage);
    if (!hasText && pendingDiceRolls.length === 0) return;
    if (session && session.closed) return;

    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter && !isNarratorMode) { alert('Brak aktywnej postaci i tryb narratora wyłączony!'); return; }
    
    if (!isParticipant && !isNarratorMode) { alert('Nie masz uprawnień do pisania w tej sesji. Tylko zaproszeni uczestnicy mogą dodawać wiadomości.'); return; }
    
    try {
      const response = await fetch(`/api/generalSessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: hasText ? processStarText(newMessage) : '',
          characterId: currentCharacter?.id,
          isNarrator: isNarratorMode,
          diceRolls: pendingDiceRolls.length > 0 ? pendingDiceRolls : undefined
        })
      });
      
      if (response.ok) {
        await fetchMessages();
        setNewMessage(''); setIsNarratorMode(false); setPendingDiceRolls([]);
        if (newMsgEditor) { newMsgEditor.commands.clearContent(); }
        if (!isArchiveView) { await fetchSessions(); }

        setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, keyboardVisible ? 300 : 100);
      } else {
        const errorData = await response.json();
        if (response.status === 403) {
          alert('Nie masz uprawnień do pisania w tej sesji.');
          await checkSessionParticipation();
        } else { alert(errorData.message || 'Błąd podczas wysyłania wiadomości'); }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Wystąpił błąd podczas wysyłania wiadomości');
    }
  };

  const startEditMessage = (msg) => {
    setEditMsgId(msg.id); setEditMsgValue(msg.message);
    if (editMsgEditor) editMsgEditor.commands.setContent(msg.message);
    
    setTimeout(() => {
      const editElement = document.querySelector(`[data-message-id="${msg.id}"]`);
      if (editElement) { editElement.scrollIntoView({ behavior: 'smooth', block: keyboardVisible ? 'start' : 'center' }); }
    }, keyboardVisible ? 200 : 100);
  };

  const saveEditMessage = async (msg) => {
    try {
      const response = await fetch(`/api/generalSessions/${sessionId}/messages/${msg.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: editMsgValue }) });
      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, message: data.message, edited_at: data.edited_at } : m));
        setEditMsgId(null); setEditMsgValue('');
        if (editMsgEditor) { editMsgEditor.commands.clearContent(); }
        if (!isArchiveView) { await fetchSessions(); }

        setTimeout(() => {
          const updatedElement = document.querySelector(`[data-message-id="${msg.id}"]`);
          if (updatedElement) { updatedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        }, 100);
      } else { alert('Błąd podczas edycji wiadomości!'); }
    } catch (e) {
      console.error('Error editing message:', e);
      alert('Błąd podczas edycji wiadomości!');
    }
  };

  const cancelEditMessage = () => { setEditMsgId(null); setEditMsgValue(''); if (editMsgEditor) { editMsgEditor.commands.clearContent(); } };

  const handleReopenSession = async (sessionId) => {
    try {
      setReopening(true);
      const response = await fetch(`/api/generalSessions/${sessionId}/reopen`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd podczas przywracania sesji');
      }
      
      setArchivedSessions(prev => prev.filter(s => s.id !== sessionId));
      setReopenDialog({ open: false, session: null }); setErrorArchive('');
      
    } catch (error) {
      console.error('Error reopening session:', error);
      setErrorArchive(error.message || 'Wystąpił błąd podczas przywracania sesji');
    } finally { setReopening(false); }
  };

  const openReopenDialog = (session) => { setReopenDialog({ open: true, session }); };
  const closeReopenDialog = () => { setReopenDialog({ open: false, session: null }); };

  const handleSaveSessionInfo = async () => {
    try {
      setSavingSessionInfo(true);
      setSessionInfoError('');

      const response = await fetch(`/api/generalSessions/${sessionId}/info`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: editStartDate || null,
          location: editLocation || null,
          additionalInfo: editAdditionalInfo || null,
          notes: editNotes || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd podczas zapisywania informacji');
      }

      await fetchSessionData();
      setEditingSessionInfo(false);
      setSessionInfoError('');
    } catch (error) {
      console.error('Error saving session info:', error);
      setSessionInfoError(error.message || 'Wystąpił błąd podczas zapisywania');
    } finally {
      setSavingSessionInfo(false);
    }
  };

  const openSessionInfoDialog = () => {
    setEditStartDate(session?.start_date || '');
    setEditLocation(session?.location || '');
    setEditAdditionalInfo(session?.additional_info || '');
    setEditNotes(session?.notes || '');
    setEditingSessionInfo(false);
    setSessionInfoError('');
    setShowSessionInfoDialog(true);
  };

  const openOwnerNotesDialog = () => {
    setOwnerNotesValue(session?.notes || '');
    setOwnerNotesError('');
    setShowOwnerNotesDialog(true);
  };

  const handleSaveOwnerNotes = async () => {
    try {
      setSavingOwnerNotes(true);
      setOwnerNotesError('');

      const response = await fetch(`/api/generalSessions/${sessionId}/info`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          notes: ownerNotesValue || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd podczas zapisywania notatek');
      }

      await fetchSessionData();
      setShowOwnerNotesDialog(false);
      setOwnerNotesError('');
    } catch (error) {
      console.error('Error saving owner notes:', error);
      setOwnerNotesError(error.message || 'Wystąpił błąd podczas zapisywania');
    } finally {
      setSavingOwnerNotes(false);
    }
  };

  const createSession = async () => {
    if (!newSessionTitle.trim()) { alert('Podaj tytuł sesji!'); return; }
    
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter && !isNarratorMode) { alert('Musisz być zalogowany na postać lub włączyć tryb narratora!'); return; }

    setErrorCreate('');
    
    try {
      const requestBody = {
        title: newSessionTitle,
        startDate: startDate || null,
        location: location_info || null,
        additionalInfo: additionalInfo || null,
        isAdultOnly: isAdultOnly
      };
      
      if (currentCharacter) {
        const allIds = [currentCharacter.id, ...selectedCharacterIds];
        requestBody.participantCharacterIds = [...new Set(allIds)];
      } else { 
        requestBody.participantCharacterIds = [...new Set(selectedCharacterIds)]; 
      }

      const response = await fetch('/api/generalSessions', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        }, 
        body: JSON.stringify(requestBody) 
      });
      
      const data = await response.json();
      if (!response.ok) { setErrorCreate(data.error || 'Błąd podczas tworzenia sesji.'); return; }
      
      let firstMessageFailed = false;
      // Sam rzut kostką bez tekstu też jest wiadomością - wcześniej warunek na
      // `firstMessage.trim()` po cichu wyrzucał zaplanowany rzut do kosza
      // (i przepuszczał puste `<p></p>` jako "treść").
      const hasFirstMessageText = !isEditorContentEmpty(firstMessage);
      if (hasFirstMessageText || pendingDiceRolls.length > 0) {
        try {
          const msgResponse = await fetch(`/api/generalSessions/${data.id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              // Backend wymaga character_id należącego do usera także w trybie
              // narratora (to samo co zwykłe wysyłanie wiadomości) - inaczej
              // pierwsza wiadomość zwracała 403 i "opis" nie trafiał do sesji.
              characterId: currentCharacter?.id,
              message: hasFirstMessageText ? processStarText(firstMessage) : '',
              isNarrator: isNarratorMode,
              diceRolls: pendingDiceRolls.length > 0 ? pendingDiceRolls : undefined
            })
          });
          if (!msgResponse.ok) firstMessageFailed = true;
        } catch (msgError) {
          console.error('❌ Błąd wysyłania pierwszej wiadomości:', msgError);
          firstMessageFailed = true;
        }
      }

      setNewSessionTitle('');
      setSelectedCharacterIds([]);
      setInputCharacterId('');
      setCharacterIdError('');
      setIsNarratorMode(false);
      setStartDate('');
      setLocationInfo('');
      setAdditionalInfo('');
      setIsAdultOnly(false);

      if (firstMessageFailed) {
        // Sesja powstała, ale pierwsza wiadomość nie wysłała się - nie czyścimy
        // jej treści ani rzutów, żeby użytkownik mógł je wysłać ponownie w nowej sesji.
        setErrorCreate('Sesja została utworzona, ale nie udało się wysłać pierwszej wiadomości. Spróbuj wysłać ją ponownie w sesji.');
      } else {
        setFirstMessage('');
        setErrorCreate('');
        setPendingDiceRolls([]);
        if (firstMsgEditor) firstMsgEditor.commands.clearContent();
      }

      navigate(`/home/generalSessions/${data.id}`);
      await fetchSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      setErrorCreate('Wystąpił błąd przy tworzeniu sesji.');
    }
  };

  const handleSessionClick = (session) => {
    navigate(`/home/generalSessions/${session.id}`);
  };

  const handleAdultInfoClick = (e) => {
    e.stopPropagation(); // Zapobiega kliknięciu w całą sesję
    setShowAdultWarning(true);
  };

  const handleCloseAdultWarning = () => {
    setShowAdultWarning(false);
  };

  const closeSession = async () => {
    // Otwórz dialog podsumowania zamiast od razu zamykać sesję
    setCloseSummaryData({
      description: '',
      world_consequences: '',
      character_consequences: '',
      advantages_disadvantages: ''
    });
    setParticipantConsequences({});
    setSessionParticipants([]);
    setCloseError('');

    const currentCharacter = getCurrentCharacter();

    // Pobierz uczestników sesji
    let participants = [];
    try {
      if (currentCharacter && sessionId) {
        const resp = await fetch(`/api/generalSessions/${sessionId}/participants?characterId=${currentCharacter.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          participants = data.participants || [];
          setSessionParticipants(participants);
        }
      }
    } catch (e) {
      console.error('Błąd pobierania uczestników:', e);
    }

    // Sesję zamyka się postacią, którą właściciel w niej gra - inaczej podsumowanie
    // podpisałoby się postacią akurat aktywną w HUD. Backend i tak to waliduje,
    // tutaj tylko nie zmuszamy do wypełnienia całego formularza na darmo.
    const ownerCharacters = participants.filter(p => p.user_id === userId);
    if (ownerCharacters.length > 0 && !ownerCharacters.some(p => p.character_id === currentCharacter?.id)) {
      const names = ownerCharacters.map(p => p.character_name).join(', ');
      setCloseError(`Sesję możesz zamknąć tylko postacią, którą w niej grasz (${names}). Przełącz aktywną postać.`);
      return;
    }

    setShowCloseSummaryDialog(true);
  };

  const handleSubmitCloseSummary = async () => {
    if (!closeSummaryData.description.trim()) {
      setCloseError('Opis podsumowania jest wymagany');
      return;
    }

    setClosing(true);
    setCloseError('');
    const currentCharacter = getCurrentCharacter();

    if (!currentCharacter) {
      setCloseError('Brak aktywnej postaci');
      setClosing(false);
      return;
    }

    try {
      // Buduj listę per-player konsekwencji
      const participantConsequencesArray = sessionParticipants.map(p => ({
        character_id: p.character_id,
        positive_consequences: (participantConsequences[p.character_id] || {}).positive || '',
        negative_consequences: (participantConsequences[p.character_id] || {}).negative || '',
        positive_level: (participantConsequences[p.character_id] || {}).positiveLevel || '',
        negative_level: (participantConsequences[p.character_id] || {}).negativeLevel || ''
      }));

      const response = await fetch(`/api/generalSessions/${sessionId}/close`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          characterId: currentCharacter.id,
          description: closeSummaryData.description,
          world_consequences: closeSummaryData.world_consequences,
          character_consequences: closeSummaryData.character_consequences,
          advantages_disadvantages: closeSummaryData.advantages_disadvantages,
          participantConsequences: participantConsequencesArray
        })
      });

      if (response.ok) {
        setShowCloseSummaryDialog(false);
        await fetchSessionData();
        await fetchMessages();
        if (!isArchiveView) {
          await fetchSessions();
        }
      } else {
        const data = await response.json();
        setCloseError(data.error || 'Błąd podczas zamykania sesji.');
      }
    } catch {
      setCloseError('Błąd sieci podczas zamykania sesji.');
    }
    setClosing(false);
  };

  const renderAdultWarningDialog = () => {
    return (
      <Dialog
        open={showAdultWarning}
        onClose={handleCloseAdultWarning}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `3px solid ${theme.palette.error.main}`,
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{
          color: theme.palette.error.text,
          borderBottom: `2px solid ${theme.palette.error.main}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 'bold',
          fontSize: '1.3rem'
        }}>
          <Warning sx={{ fontSize: '2rem' }} />
          Informacja: Sesja +18
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Ta sesja zawiera treści tylko dla dorosłych (+18)
            </Typography>
          </Alert>

          <Typography variant="body2" sx={{ mb: 2 }}>
            W tej sesji mogą pojawić się następujące treści:
          </Typography>

          <Box component="ul" sx={{ pl: 3, mb: 2 }}>
            <li><Typography variant="body2">🔪 Sceny przemocy i krwi</Typography></li>
            <li><Typography variant="body2">💀 Zabójstwa i brutalne sceny</Typography></li>
            <li><Typography variant="body2">💊 Narkotyki i używki</Typography></li>
            <li><Typography variant="body2">🔞 Treści seksualne</Typography></li>
            <li><Typography variant="body2">⚠️ Inne treści dla dojrzałych odbiorców</Typography></li>
          </Box>

          <Alert severity="warning">
            <Typography variant="body2">
              Sesja przeznaczona dla osób pełnoletnich (18+).
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={handleCloseAdultWarning}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.error.main,
              '&:hover': {
                backgroundColor: theme.palette.error.dark
              }
            }}
          >
            Rozumiem
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderSessionInfoDialog = () => {
    if (!showSessionInfoDialog || !session) return null;

    const isOwner = session.created_by === userId;
    const hasAnyInfo = session.start_date || session.location || session.additional_info;

    return (
      <Dialog 
        open={showSessionInfoDialog} 
        onClose={() => {
          setShowSessionInfoDialog(false);
          setEditingSessionInfo(false);
          setSessionInfoError('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ 
          sx: { 
            backgroundColor: theme.palette.background.paper, 
            color: theme.palette.text.primary, 
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 2
          } 
        }}
      >
        <DialogTitle sx={{ 
          color:theme.palette.text.secondary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoIcon />
            Informacje o sesji
          </Box>
          
          {isOwner && !editingSessionInfo && (
            <Tooltip title="Edytuj informacje">
              <IconButton
                size="small"
                onClick={() => setEditingSessionInfo(true)}
                sx={{
                  color:theme.palette.text.secondary,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' }
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>
        
        <DialogContent sx={{ pt: 3, overflowY: 'visible' }}>
          {!hasAnyInfo && !editingSessionInfo ? (
            <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 3 }}>
              Brak dodatkowych informacji o sesji
            </Typography>
          ) : editingSessionInfo ? (
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Data startu sesji"
                type="datetime-local"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.divider },
                    '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
                  },
                  '& .MuiInputBase-input': { color: theme.palette.text.primary },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
                }}
              />

              <TextField
                fullWidth
                label="Lokalizacja"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="np. Warszawa, Bar u Jurka"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.divider },
                    '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
                  },
                  '& .MuiInputBase-input': { color: theme.palette.text.primary },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                maxRows={10}
                label="Dodatkowe informacje"
                value={editAdditionalInfo}
                onChange={(e) => setEditAdditionalInfo(e.target.value)}
                placeholder="Dodatkowe notatki o sesji..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.divider },
                    '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
                  },
                  '& .MuiInputBase-input': { color: theme.palette.text.primary },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                maxRows={10}
                label="Notatki właściciela sesji"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Twoje notatki do tej sesji (widoczne tylko dla Ciebie)..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.divider },
                    '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
                  },
                  '& .MuiInputBase-input': { color: theme.palette.text.primary },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
                }}
              />

              {sessionInfoError && (
                <Alert severity="error">{sessionInfoError}</Alert>
              )}
            </Stack>
          ) : (
            <Stack spacing={2}>
              {session.start_date && (
                <Box>
                  <Typography variant="caption" sx={{ color:theme.palette.text.secondary, fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Data startu:
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary }}>
                    {formatDateOnly(session.start_date)}
                  </Typography>
                </Box>
              )}

              {session.location && (
                <Box>
                  <Typography variant="caption" sx={{ color:theme.palette.text.secondary, fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Lokalizacja:
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary }}>
                    {session.location}
                  </Typography>
                </Box>
              )}

              {session.additional_info && (
                <Box>
                  <Typography variant="caption" sx={{ color:theme.palette.text.secondary, fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Dodatkowe informacje:
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary, whiteSpace: 'pre-wrap' }}>
                    {session.additional_info}
                  </Typography>
                </Box>
              )}

            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          {editingSessionInfo ? (
            <>
              <Button 
                onClick={() => {
                  setEditingSessionInfo(false);
                  setSessionInfoError('');
                }}
                sx={{ color: theme.palette.text.secondary }}
                disabled={savingSessionInfo}
              >
                Anuluj
              </Button>
              <Button 
                onClick={handleSaveSessionInfo}
                variant="contained"
                disabled={savingSessionInfo}
                sx={{
                  backgroundColor: theme.palette.secondary.main,
                  '&:hover': { backgroundColor: theme.palette.primary.dark }
                }}
              >
                {savingSessionInfo ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setShowSessionInfoDialog(false)}
              sx={{ color: theme.palette.text.secondary }}
            >
              Zamknij
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  const renderOwnerNotesDialog = () => {
    if (!showOwnerNotesDialog || !session) return null;

    return (
      <Dialog
        open={showOwnerNotesDialog}
        onClose={() => {
          setShowOwnerNotesDialog(false);
          setOwnerNotesError('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{
          color:theme.palette.text.secondary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <DescriptionIcon />
          Notatki właściciela sesji
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Te notatki są widoczne tylko dla Ciebie jako właściciela sesji.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={8}
              maxRows={15}
              label="Notatki"
              value={ownerNotesValue}
              onChange={(e) => setOwnerNotesValue(e.target.value)}
              placeholder="Twoje prywatne notatki do tej sesji..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.divider },
                  '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
                },
                '& .MuiInputBase-input': { color: theme.palette.text.primary },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
              }}
            />

            {ownerNotesError && (
              <Alert severity="error">{ownerNotesError}</Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => {
              setShowOwnerNotesDialog(false);
              setOwnerNotesError('');
            }}
            sx={{ color: theme.palette.text.secondary }}
            disabled={savingOwnerNotes}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSaveOwnerNotes}
            variant="contained"
            disabled={savingOwnerNotes}
            sx={{
              backgroundColor: theme.palette.secondary.main,
              '&:hover': { backgroundColor: theme.palette.primary.dark }
            }}
          >
            {savingOwnerNotes ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderCloseSummaryDialog = () => {
    if (!showCloseSummaryDialog) return null;

    return (
      <Dialog
        open={showCloseSummaryDialog}
        onClose={() => {
          if (!closing) {
            setShowCloseSummaryDialog(false);
            setCloseError('');
          }
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{
          color: theme.palette.text.secondary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontWeight: 'bold'
        }}>
          📋 Podsumowanie Sesji
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <Alert severity="info" sx={{ mb: 1 }}>
              Wypełnij podsumowanie sesji. Zostanie ono automatycznie wysłane jako raport dla wszystkich uczestników.
            </Alert>

            <TextField
              fullWidth
              multiline
              rows={4}
              maxRows={10}
              label="Co się wydarzyło? *"
              value={closeSummaryData.description}
              onChange={(e) => setCloseSummaryData({ ...closeSummaryData, description: e.target.value })}
              required
              placeholder="Opisz co wydarzyło się podczas sesji..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.divider },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.text.secondary }
                },
                '& .MuiInputBase-input': { color: theme.palette.text.primary },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.secondary }
              }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              maxRows={8}
              label="Konsekwencje dla świata (opcjonalne)"
              value={closeSummaryData.world_consequences}
              onChange={(e) => setCloseSummaryData({ ...closeSummaryData, world_consequences: e.target.value })}
              placeholder="Jakie zmiany nastąpiły w świecie gry..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.divider },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.text.secondary }
                },
                '& .MuiInputBase-input': { color: theme.palette.text.primary },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.secondary }
              }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              maxRows={8}
              label="Konsekwencje dla postaci (opcjonalne)"
              value={closeSummaryData.character_consequences}
              onChange={(e) => setCloseSummaryData({ ...closeSummaryData, character_consequences: e.target.value })}
              placeholder="Jakie zmiany dotyczą postaci graczy..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.divider },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.text.secondary }
                },
                '& .MuiInputBase-input': { color: theme.palette.text.primary },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.secondary }
              }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              maxRows={8}
              label="Zgłoszone wady/zalety (opcjonalne)"
              value={closeSummaryData.advantages_disadvantages}
              onChange={(e) => setCloseSummaryData({ ...closeSummaryData, advantages_disadvantages: e.target.value })}
              placeholder="Wady lub zalety postaci do rozpatrzenia..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.divider },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.text.secondary }
                },
                '& .MuiInputBase-input': { color: theme.palette.text.primary },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.secondary }
              }}
            />

            {/* Sekcja per-player konsekwencji */}
            {sessionParticipants.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold', mb: 1 }}>
                  👥 Zalety i wady dla graczy (poziom 1-5)
                </Typography>
                <Stack spacing={2}>
                  {sessionParticipants.map((participant) => (
                    <Box
                      key={participant.character_id}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        p: 2,
                        backgroundColor: 'rgba(0,0,0,0.1)'
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary, mb: 1.5 }}>
                        {participant.character_name}
                        <Typography component="span" variant="caption" sx={{ color: theme.palette.text.secondary, ml: 1 }}>
                          ({participant.username})
                        </Typography>
                      </Typography>
                      <Stack spacing={1.5}>
                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="Zaleta"
                          value={(participantConsequences[participant.character_id] || {}).positive || ''}
                          onChange={(e) => setParticipantConsequences(prev => ({
                            ...prev,
                            [participant.character_id]: {
                              ...(prev[participant.character_id] || {}),
                              positive: e.target.value
                            }
                          }))}
                          placeholder="Co dobrego spotkało tę postać..."
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: theme.palette.background.paper,
                              color: theme.palette.text.primary,
                              '& fieldset': { borderColor: theme.palette.success.main },
                              '&:hover fieldset': { borderColor: theme.palette.success.main },
                              '&.Mui-focused fieldset': { borderColor: theme.palette.success.main }
                            },
                            '& .MuiInputBase-input': { color: theme.palette.text.primary },
                            '& .MuiInputLabel-root': { color: theme.palette.success.text },
                            '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.success.text }
                          }}
                        />
                        <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
                          <InputLabel>Poziom (1-5)</InputLabel>
                          <Select
                            label="Poziom (1-5)"
                            value={(participantConsequences[participant.character_id] || {}).positiveLevel || ''}
                            onChange={(e) => setParticipantConsequences(prev => ({
                              ...prev,
                              [participant.character_id]: {
                                ...(prev[participant.character_id] || {}),
                                positiveLevel: e.target.value
                              }
                            }))}
                          >
                            <MenuItem value="">Brak</MenuItem>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <MenuItem key={lvl} value={lvl}>{lvl}/5</MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        <TextField
                          fullWidth
                          multiline
                          rows={2}
                          label="Wada"
                          value={(participantConsequences[participant.character_id] || {}).negative || ''}
                          onChange={(e) => setParticipantConsequences(prev => ({
                            ...prev,
                            [participant.character_id]: {
                              ...(prev[participant.character_id] || {}),
                              negative: e.target.value
                            }
                          }))}
                          placeholder="Co złego spotkało tę postać..."
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: theme.palette.background.paper,
                              color: theme.palette.text.primary,
                              '& fieldset': { borderColor: theme.palette.error.main },
                              '&:hover fieldset': { borderColor: theme.palette.error.main },
                              '&.Mui-focused fieldset': { borderColor: theme.palette.error.main }
                            },
                            '& .MuiInputBase-input': { color: theme.palette.text.primary },
                            '& .MuiInputLabel-root': { color: theme.palette.error.text },
                            '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.error.text }
                          }}
                        />
                        <FormControl fullWidth size="small" margin="dense" sx={{ mt: 1 }}>
                          <InputLabel>Poziom (1-5)</InputLabel>
                          <Select
                            label="Poziom (1-5)"
                            value={(participantConsequences[participant.character_id] || {}).negativeLevel || ''}
                            onChange={(e) => setParticipantConsequences(prev => ({
                              ...prev,
                              [participant.character_id]: {
                                ...(prev[participant.character_id] || {}),
                                negativeLevel: e.target.value
                              }
                            }))}
                          >
                            <MenuItem value="">Brak</MenuItem>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <MenuItem key={lvl} value={lvl}>{lvl}/5</MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {closeError && (
              <Alert severity="error">{closeError}</Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ pt: 2 }}>
          <Button
            onClick={() => {
              setShowCloseSummaryDialog(false);
              setCloseError('');
            }}
            sx={{ color: theme.palette.text.secondary }}
            disabled={closing}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSubmitCloseSummary}
            variant="contained"
            disabled={closing || !closeSummaryData.description.trim()}
            sx={{
              backgroundColor: theme.palette.secondary.main,
              '&:hover': { backgroundColor: theme.palette.primary.dark }
            }}
          >
            {closing ? 'Zamykanie...' : 'Zamknij sesję'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderDiceRollsDialog = () => (
    <Dialog
      open={dicePopupOpen}
      onClose={() => {
        setDicePopupOpen(false);
        setSelectedDiceRolls(null);
      }}
      maxWidth="sm"
      fullWidth
      {...keyboardSafeDialogProps(keyboardViewport, {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        border: `2px solid ${theme.palette.divider}`,
        borderRadius: 2
      })}
    >
      <DialogTitle sx={{
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <CasinoIcon sx={{ color: theme.palette.warning.light }} />
        Rzuty kostką
      </DialogTitle>
      <DialogContent sx={{ mt: 2, overflowY: 'auto' }}>
        {selectedDiceRolls && selectedDiceRolls.length > 0 ? (
          selectedDiceRolls.map((roll, index) => (
            <Box
              key={index}
              sx={{
                mb: 1.5,
                p: 1.5,
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderLeft: `4px solid ${theme.palette.divider}`,
                borderRadius: 1
              }}
            >
              {roll.description && (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold', mb: 0.5 }}>
                  {roll.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {(() => {
                  const mod = Number(roll.modifier) || 0;
                  const total = roll.total != null ? roll.total : (Number(roll.roll) + mod);
                  return (
                    <Typography variant="h6" sx={{ color: theme.palette.warning.light, fontWeight: 'bold' }}>
                      🎲 {roll.roll}{mod ? ` ${mod > 0 ? '+' : '−'}${Math.abs(mod)} = ${total}` : ''}
                    </Typography>
                  );
                })()}
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  (K{roll.sides})
                </Typography>
              </Box>
            </Box>
          ))
        ) : (
          <Typography sx={{ color: theme.palette.text.secondary }}>Brak rzutów</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={() => {
            setDicePopupOpen(false);
            setSelectedDiceRolls(null);
          }}
          sx={{ color: theme.palette.text.primary }}
        >
          Zamknij
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderParticipantsDialog = () => {
    if (!showParticipantsDialog || !session) return null;

    const isOwner = session.created_by === userId;

    return (
      <>
      <Dialog
        open={showParticipantsDialog}
        onClose={() => setShowParticipantsDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ 
          color:theme.palette.text.secondary,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon />
            Uczestnicy sesji ({sessionParticipants.length})
          </Box>
          
          {isOwner && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Dodaj uczestnika">
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowParticipantsDialog(false);
                    setShowAddMembers(true);
                  }}
                  sx={{
                    color: theme.palette.success.text,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' }
                  }}
                >
                  <PersonAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Usuń uczestnika">
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowParticipantsDialog(false);
                    setShowRemoveMembers(true);
                  }}
                  sx={{
                    color: theme.palette.error.text,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' }
                  }}
                >
                  <PersonRemoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </DialogTitle>
        
        <DialogContent sx={{ pt: 2 }}>
          {sessionParticipants.length === 0 ? (
            <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 3 }}>
              Brak uczestników w sesji
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {sessionParticipants.map((participant) => (
                <Box
                  key={participant.character_id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    border: `1px solid ${theme.palette.divider}`,
                    borderLeft: `4px solid ${getRaceColorSet(participant.race_color).primary}`,
                    borderRadius: 2,
                    backgroundColor: 'rgba(13, 15, 14, 0.3)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(13, 15, 14, 0.5)',
                      borderColor:theme.palette.text.secondary
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <Avatar
                      src={getCharacterAvatar(participant)}
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor:theme.palette.text.secondary,
                        border: `2px solid ${getRaceColorSet(participant.race_color).primary}`
                      }}
                    >
                      {!getCharacterAvatar(participant) && participant.character_name 
                        ? participant.character_name[0]?.toUpperCase() 
                        : 'C'}
                    </Avatar>
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          color: theme.palette.text.primary,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        {participant.character_name}
                        {participant.user_id === session.created_by && (
                          <Chip
                            label="WŁAŚCICIEL"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              backgroundColor: 'rgba(212, 175, 55, 0.3)',
                              color:theme.palette.text.secondary,
                              fontWeight: 'bold'
                            }}
                          />
                        )}
                      </Typography>
                      <Typography variant="caption" sx={{ color:theme.palette.text.secondary }}>
                        ID: {participant.character_id}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
                        Gracz: {participant.username} (#{participant.user_id})
                      </Typography>
                      <Chip
                        label={getPlayStyle(participant.play_style).short}
                        size="small"
                        sx={{
                          mt: 0.5,
                          height: 18,
                          fontSize: '0.6rem',
                          fontWeight: 'bold',
                          borderRadius: 0,
                          backgroundColor: `${getPlayStyle(participant.play_style).color}22`,
                          color: getPlayStyle(participant.play_style).color,
                          border: `1px solid ${getPlayStyle(participant.play_style).color}66`
                        }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      {/* Podgląd statystyk - tylko dla postaci grających mechanicznie
                          albo mechanicznie i fabularnie. Mistrz gry musi widzieć poziom
                          i statystyki, żeby wiedzieć, co postać realnie potrafi. */}
                      {hasMechanicalStats(participant.play_style) && (
                        <Tooltip title="Statystyki postaci">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedCharacterForStats({
                                id: participant.character_id,
                                name: participant.character_name,
                                avatar: getCharacterAvatar(participant)
                              });
                              setShowCharacterStatsPopup(true);
                            }}
                            sx={{
                              color: theme.palette.primary.main,
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              '&:hover': {
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                color: theme.palette.primary.light
                              }
                            }}
                          >
                            <StatsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* Przycisk KP - Karta Postaci */}
                      <Tooltip title="Karta Postaci">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedCharacterForCard({
                              id: participant.character_id,
                              name: participant.character_name,
                              avatar: getCharacterAvatar(participant)
                            });
                            setShowCharacterCardPopup(true);
                          }}
                          sx={{
                            color: theme.palette.primary.main,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            '&:hover': {
                              backgroundColor: 'rgba(0,0,0,0.8)',
                              color: theme.palette.primary.light
                            }
                          }}
                        >
                          <AccountBoxIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      {/* Podgląd przedmiotów fabularnych - ten sam spis, co
                          zakładka "Przedmioty" w profilu. W trakcie gry MG musi
                          go mieć pod ręką, zamiast wychodzić z sesji na profil. */}
                      <Tooltip title="Przedmioty postaci">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedCharacterForStoryItems({
                              id: participant.character_id,
                              name: participant.character_name,
                              avatar: getCharacterAvatar(participant)
                            });
                            setShowCharacterStoryItemsPopup(true);
                          }}
                          sx={{
                            color: theme.palette.primary.main,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            '&:hover': {
                              backgroundColor: 'rgba(0,0,0,0.8)',
                              color: theme.palette.primary.light
                            }
                          }}
                        >
                          <InventoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}

          {removeError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {removeError}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setShowParticipantsDialog(false)}
            sx={{ color: theme.palette.text.secondary }}
          >
            Zamknij
          </Button>
        </DialogActions>
      </Dialog>

      {/* Podgląd statystyk uczestnika - montowany razem z panelem uczestników,
          bo tylko z niego jest otwierany (leży nad nim jako druga warstwa). */}
      {selectedCharacterForStats && (
        <CharacterStatsPopup
          open={showCharacterStatsPopup}
          onClose={() => {
            setShowCharacterStatsPopup(false);
            setSelectedCharacterForStats(null);
          }}
          characterId={selectedCharacterForStats.id}
          characterName={selectedCharacterForStats.name}
          characterAvatar={selectedCharacterForStats.avatar}
        />
      )}

      {/* Podgląd przedmiotów fabularnych uczestnika - jak wyżej, druga warstwa
          nad panelem uczestników. */}
      {selectedCharacterForStoryItems && (
        <CharacterStoryItemsPopup
          open={showCharacterStoryItemsPopup}
          onClose={() => {
            setShowCharacterStoryItemsPopup(false);
            setSelectedCharacterForStoryItems(null);
          }}
          characterId={selectedCharacterForStoryItems.id}
          characterName={selectedCharacterForStoryItems.name}
          characterAvatar={selectedCharacterForStoryItems.avatar}
        />
      )}
      </>
    );
  };

  const renderAddMembersDialog = () => {
    if (!showAddMembers) return null;

    return (
      <Dialog open={showAddMembers} onClose={() => setShowAddMembers(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `2px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ color:theme.palette.text.secondary }}>
          <PersonAddIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Dodaj uczestników do sesji
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 2 }}>
            Wprowadź ID postaci, które chcesz dodać do sesji:
          </Typography>
          
          <Stack direction={isMobile ? "column" : "row"} spacing={1} alignItems={isMobile ? "stretch" : "flex-start"} sx={{ mb: 2 }}>
            <TextField size="small" label="ID postaci" value={newMemberInput} onChange={e => setNewMemberInput(e.target.value.replace(/\D+/g, ''))} onKeyDown={e => e.key === 'Enter' && handleAddNewMemberId()} sx={{ flex: 1, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary } }} disabled={addingNewMembers} autoComplete="off" />
            <Button onClick={handleAddNewMemberId} variant="contained" disabled={addingNewMembers || !newMemberInput.trim()} sx={{ minWidth: isMobile ? '100%' : 90, backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>
              Dodaj
            </Button>
          </Stack>

          {newMemberError && <Typography color="error" sx={{ fontSize: 13, mb: 1 }}>{newMemberError}</Typography>}

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ minHeight: 60 }}>
            {newMemberIds.map(cid => {
              const character = charactersCache[cid];
              return (
                <Chip key={cid} avatar={<Avatar src={getCharacterAvatar(character)} sx={{ width: 24, height: 24 }}>{!getCharacterAvatar(character) && character?.name && character.name[0]?.toUpperCase()}</Avatar>} label={`${character?.name || `ID:${cid}`} (#${cid})`} onDelete={() => handleRemoveNewMemberId(cid)} sx={{ bgcolor: 'rgba(13, 15, 14, 0.3)', color:theme.palette.text.secondary, mb: 0.5, '& .MuiChip-deleteIcon': { color:theme.palette.text.secondary } }} />
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMembers(false)} sx={{ color: theme.palette.text.secondary }} disabled={addingNewMembers}>Anuluj</Button>
          <Button onClick={addMembersToSession} variant="contained" startIcon={<PersonAddIcon />} disabled={addingNewMembers || newMemberIds.length === 0} sx={{ backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>
            {addingNewMembers ? 'Dodawanie...' : `Dodaj (${newMemberIds.length})`}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderRemoveMembersDialog = () => {
    if (!showRemoveMembers) return null;
    const removableParticipants = sessionParticipants.filter(p => p.user_id !== session?.created_by);

    return (
      <Dialog open={showRemoveMembers} onClose={() => setShowRemoveMembers(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `2px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ color:theme.palette.text.secondary }}>
          <PersonRemoveIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Usuń uczestników z sesji
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 2 }}>
            Wybierz postaci, które chcesz usunąć z sesji:
          </Typography>
          
          {removeError && <Typography color="error" sx={{ fontSize: 13, mb: 2 }}>{removeError}</Typography>}

          {removableParticipants.length === 0 ? (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 2 }}>
              Brak postaci do usunięcia (poza właścicielem sesji).
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {removableParticipants.map(participant => (
                <Box key={participant.character_id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, backgroundColor: 'rgba(13, 15, 14, 0.3)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={getCharacterAvatar(participant)} sx={{ width: 40, height: 40, bgcolor:theme.palette.text.secondary }}>
                      {!getCharacterAvatar(participant) && participant.character_name ? participant.character_name[0]?.toUpperCase() : 'C'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                        {participant.character_name} (#{participant.character_id})
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        Gracz: {participant.username} (#{participant.user_id})
                      </Typography>
                    </Box>
                  </Box>
                  <Button variant="outlined" size="small" startIcon={<PersonRemoveIcon />} onClick={() => removeMemberFromSession(participant.character_id)} disabled={removingMembers} sx={{ color: theme.palette.error.text, borderColor: theme.palette.error.main, '&:hover': { borderColor: theme.palette.error.dark, backgroundColor: 'rgba(204, 0, 68, 0.1)' } }}>
                    Usuń
                  </Button>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRemoveMembers(false)} sx={{ color: theme.palette.text.secondary }} disabled={removingMembers}>Zamknij</Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderReopenDialog = () => (
    <Dialog open={reopenDialog.open} onClose={closeReopenDialog} PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `2px solid ${theme.palette.divider}` } }}>
      <DialogTitle sx={{ color:theme.palette.text.secondary }}>
        <LockOpenIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Przywróć sesję
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: theme.palette.text.primary }}>
          Czy na pewno chcesz przywrócić sesję "<strong>{reopenDialog.session?.title}</strong>" do stanu aktywnego? Uczestnicy będą mogli ponownie dodawać wiadomości.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeReopenDialog} sx={{ color: theme.palette.text.secondary }} disabled={reopening}>Anuluj</Button>
        <Button onClick={() => handleReopenSession(reopenDialog.session?.id)} variant="contained" startIcon={<RestoreIcon />} disabled={reopening} sx={{ backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>
          {reopening ? 'Przywracanie...' : 'Przywróć sesję'}
        </Button>
      </DialogActions>
    </Dialog>
  );
  if (isViewingSession && session) {
    const currentCharacter = getCurrentCharacter();

    return (
      <>
        {renderAdultWarningDialog()}
        {renderAddMembersDialog()}
        {renderRemoveMembersDialog()}
        {renderParticipantsDialog()}
        {renderSessionInfoDialog()}
        {renderOwnerNotesDialog()}
        {renderCloseSummaryDialog()}

        {/* Character Card Popup */}
        {selectedCharacterForCard && (
          <CharacterCardPopup
            open={showCharacterCardPopup}
            onClose={() => {
              setShowCharacterCardPopup(false);
              setSelectedCharacterForCard(null);
            }}
            characterId={selectedCharacterForCard.id}
            characterName={selectedCharacterForCard.name}
            characterAvatar={selectedCharacterForCard.avatar}
          />
        )}

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: 'rgba(13, 15, 14, 0.3)', width: '100%', maxWidth: '100%', px: 0, mx: 0, overflow: 'hidden' }}>
          {closeError && <Alert severity="error" sx={{ px: 2, mt: 1, mb: 0.5, mx: { xs: 1, sm: 0 } }}>{closeError}</Alert>}

          {!!session.closed && (
            <Alert severity="warning" sx={{ mx: { xs: 1, sm: 2 }, mt: 1, mb: 0 }}>
              <LockIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Ta sesja została zamknięta – nie można już dodawać wiadomości.
            </Alert>
          )}

          {!isParticipant && !checkingParticipation && (
            <Alert severity="warning" sx={{ mx: 1, mt: 1, flexShrink: 0 }}>
              <LockIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Nie jesteś uczestnikiem tej sesji. Możesz przeglądać wiadomości, ale nie możesz pisać.
            </Alert>
          )}

          {/* Pasek nagłówka sesji. Na telefonie z otwartą klawiaturą znika w
              całości - te ~50 px to przy widocznym obszarze ~380 px około dwóch
              dodatkowych linii czytanej treści. Wszystko, co tu jest (powrót,
              uczestnicy, notatki, info), zostaje dostępne po schowaniu klawiatury. */}
          <Box sx={{
            display: hideChromeForKeyboard ? 'none' : 'flex',
            px: { xs: 1, sm: 2 }, py: 1,
            justifyContent: 'space-between', alignItems: 'center', gap: 1,
            flexShrink: 0,
            borderBottom: `1px solid ${appColors.borderSteel}`,
            bgcolor: `${appColors.bgDeep}cc`,
            backdropFilter: 'blur(4px)',
          }}>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
              <Tooltip title="Powrót do listy sesji">
                <IconButton size="small" onClick={() => navigate('/home/generalSessions')} sx={{
                  color: appColors.steelLight, bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`, borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Pokaż uczestników sesji">
                <IconButton size="small" onClick={() => setShowParticipantsDialog(true)} sx={{
                  color: appColors.steelLight, bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`, borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <GroupIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {session?.created_by === userId && (
                <Tooltip title="Notatki właściciela sesji">
                  <IconButton size="small" onClick={openOwnerNotesDialog} sx={{
                    color: appColors.steelLight, bgcolor: 'transparent',
                    border: `1px solid ${appColors.borderSteel}`, borderRadius: '2px',
                    '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                  }}>
                    <DescriptionIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Informacje o sesji">
                <IconButton size="small" onClick={openSessionInfoDialog} sx={{
                  color: appColors.steelLight, bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`, borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Tytuł sesji na środku */}
            <Typography sx={{
              flex: 1, textAlign: 'center',
              color: appColors.textPrimary,
              
              fontSize: { xs: '0.8rem', sm: '0.95rem' },
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              px: 1,
            }}>
              {session.title}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {session.created_by === userId && !session.closed && (
                <Tooltip title="Zamknij sesję (tylko właściciel)">
                  <IconButton 
                    size="small" 
                    onClick={closeSession}
                    disabled={closing}
                    sx={{
                      color: appColors.dangerText,
                      bgcolor: 'transparent',
                      border: `1px solid ${appColors.dangerBorder}`,
                      borderRadius: '2px',
                      '&:hover': { bgcolor: `${appColors.dangerBorder}30`, borderColor: appColors.dangerText },
                      '&:disabled': { color: `${appColors.dangerText}50`, borderColor: `${appColors.dangerBorder}40` }
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Obszar czytania bierze CAŁE miejsce, które zostanie po edytorze
              (flex:1), zamiast dawnej proporcji 7:2. Tamta i tak nie działała -
              minimalne wysokości edytora ją przebijały, więc realny podział był
              nieprzewidywalny. Teraz to edytor ma konkretną wysokość (regulowaną
              uchwytem), a czytanie dostaje resztę. */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: isMobile ? 1 : 2, py: 1, width: '100%', minHeight: 0, ...(isMobile && { pb: 1 }), ...(hideChromeForKeyboard && { px: 0.5, py: 0.5, pb: 0.5 }) }}>
            {currentMessages.map((msg, index) => (
              <Box
                key={msg.id || index}
                data-message-id={msg.id}
                sx={{
                  // Odstępy między postami są na telefonie wyraźnie mniejsze:
                  // sam ozdobnik + marginesy kosztowały ~38 px na KAŻDY post,
                  // co przy krótkich wpisach zjadało więcej miejsca niż treść.
                  mb: { xs: 0.75, sm: 1.15 },
                  px: 0,
                  width: '100%',
                  '&::after': {
                    content: '""',
                    display: 'block',
                    height: { xs: '10px', sm: '18px' },
                    mt: { xs: 0.5, sm: 0.75 },
                    backgroundImage: `url(/ui/dividers/bottom-${raceFrame}.png)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    backgroundSize: '100% 100%',
                  },
                }}
              >
                {/* Panel postu - tło na całym polu między przedziałkami (razem z avatarem) */}
                <Box sx={{
                  ...readingSurfaceSx(theme),
                  display: 'flow-root',
                  position: 'relative',
                  ...(msg.character_type === 'narrator' && { borderLeft: { xs: 'none', sm: `3px solid ${theme.palette.error.main}` } }),
                  ...(msg.message_type === 'session_summary' && { borderLeft: { xs: 'none', sm: `3px solid ${theme.palette.warning.main}` }, backgroundColor: 'rgba(255, 167, 38, 0.06)' }),
                }}>
                  {/* Avatar / narrator - duży, po lewej; dłuższy tekst wchodzi pod niego (float) */}
                  {/* Avatar jest opływany tekstem (float). Na telefonie 120 px
                      szerokości zabierało ponad jedną trzecią wiersza, przez co
                      w kolumnie obok mieściło się kilkanaście znaków na linię.
                      72 px daje realnie ~35% więcej tekstu w linii i skraca
                      strefę wąskiego zawijania ze 150 do 90 px wysokości. */}
                  <Box sx={{ float: 'left', mr: { xs: 0.75, sm: 1.5 }, mb: 0.5 }}>
                    {msg.character_type === 'narrator' ? (
                      <NarratorAvatar
                        width={{ xs: 72, sm: 150 }}
                        height={{ xs: 90, sm: 190 }}
                        sx={{ boxShadow: `0 0 8px ${theme.palette.error.main}30` }}
                      />
                    ) : (
                      <Avatar src={getCharacterAvatar(msg)} variant="square" sx={{
                        width: { xs: 72, sm: 150 },
                        height: { xs: 90, sm: 190 },
                        bgcolor: appColors.bgSurface,
                        border: `2px solid ${theme.palette.primary.main}60`,
                        boxShadow: `0 0 8px ${theme.palette.primary.main}30`,
                        borderRadius: '2px',
                        '& .MuiAvatar-img': { objectFit: 'cover', objectPosition: '50% 0%' },
                      }}>
                        {(!getCharacterAvatar(msg) && msg.character_name) ? msg.character_name.charAt(0)?.toUpperCase() : 'C'}
                      </Avatar>
                    )}
                  </Box>
                  {(msg.author_id === userId || userRole === 'admin' || userRole === 'mistrz_gry') && msg.message_type !== 'session_summary' && (
                    <IconButton size="small" onClick={() => startEditMessage(msg)} sx={{ float: 'right', color: theme.palette.text.secondary, p: 0.5 }}>
                      <EditNoteTwoToneIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Typography variant="body2" component="div" sx={{
                    fontWeight: 'bold',
                    color: msg.message_type === 'session_summary' ? theme.palette.warning.main : (msg.character_type === 'narrator' ? theme.palette.error.main : theme.palette.primary.main),
                    display: 'block',
                    // Nagłówek postu (nick + data) na telefonie schodzi z 1.15rem
                    // do 1rem i dostaje ciaśniejszą interlinię - przy bazie 120%
                    // to nadal ~19 px, a oszczędza kilka pikseli na każdym poście.
                    fontSize: { xs: '1rem', sm: '1.4rem' },
                    lineHeight: { xs: 1.3, sm: 1.5 },
                  }}>
                    {msg.character_type === 'narrator' && <NarratorMark fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />}
                    {msg.character_type === 'narrator' ? (
                      <Tooltip arrow enterDelay={300} placement="top" title={
                        <Box sx={{ 
                          p: 1, 
                          textAlign: 'center',
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          border: `2px solid ${theme.palette.divider}`,
                          borderRadius: 1
                        }}>
                          <Typography sx={{ 
                            fontWeight: 'bold', 
                            mb: 0.5, 
                            fontSize: 13,
                            color: theme.palette.error.text 
                          }}>
                            Narrator
                          </Typography>
                          <Typography sx={{ 
                            fontSize: 11, 
                            color: theme.palette.text.secondary 
                          }}>
                            Postać: {msg.narrator_character_name || msg.character_name || 'Nieznana'}
                          </Typography>
                          {msg.character_id && (
                            <Typography sx={{ 
                              fontSize: 10, 
                              color: theme.palette.text.secondary,
                              mt: 0.5 
                            }}>
                              ID postaci: {msg.character_id}
                            </Typography>
                          )}
                        </Box>
                      }>
                        <span style={{ cursor: 'default' }}>Narrator</span>
                      </Tooltip>
                    ) : msg.character_name && msg.character_id ? (
                      renderCharacterWithTooltip(msg.character_name, msg.character_id, msg.author_name, msg.author_id, msg.character_avatar, msg.character_race, msg.character_gender, msg.character_faction)
                    ) : (
                      renderUserNameWithProfile(msg.author_name || 'Nieznany', msg.author_id, navigate)
                    )}
                    <span style={{
                      fontWeight: 400,
                      color: appColors.textMuted,
                      fontSize: '0.85rem',
                      marginLeft: 8,
                      fontStyle: 'italic',
                      letterSpacing: '0.03em',
                    }}>
                      {formatDate(msg.created_at)}
                      {msg.edited_at && (
                        <span style={{ color: appColors.borderSteel, marginLeft: 4 }}>
                          [edytowano]
                        </span>
                      )}
                    </span>
                  </Typography>
                <Box sx={{ width: '100%', mt: 0.5 }}>
                  {editMsgId === msg.id && editMsgEditor ? (
                    <>
                      <Box sx={{ px: 1 }}>
                        <EditorToolbar editor={editMsgEditor} anchorTextColor={editMsgAnchorTextColor} setAnchorTextColor={setEditMsgAnchorTextColor} anchorBgColor={editMsgAnchorBgColor} setAnchorBgColor={setEditMsgAnchorBgColor} isMobile={isMobile} editorId="edit-message-editor" isEditMode={true} />
                      </Box>
                      <Box sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, minHeight: 150, pt: 0.5, px: 2, pb: 2, position: 'relative', cursor: 'text', '& .ProseMirror': { outline: 'none', minHeight: '120px', color: theme.palette.text.primary, caretColor: theme.palette.primary.main, px: 1.5, py: 0.5, backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important', '&:focus': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' }, '&:focus-visible': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' } }, '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' } }} onClick={() => editMsgEditor?.commands?.focus()}>
                        <EditorContent editor={editMsgEditor} />
                      </Box>
                      <Box sx={{ px: 1 }}>
                        <Button variant="contained" size="small" onClick={() => saveEditMessage(msg)} sx={{ backgroundColor:theme.palette.secondary.main, mr: 1 }}>Zapisz</Button>
                        <Button variant="outlined" size="small" onClick={cancelEditMessage} sx={{ borderColor:theme.palette.text.secondary, color:theme.palette.text.secondary }}>Anuluj</Button>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box component="div" sx={{ mt: 0.5, color: 'inherit', overflowWrap: 'break-word', wordBreak: 'break-word', '& .align-right': { textAlign: 'right' }, '& .align-center': { textAlign: 'center' }, '& .align-left': { textAlign: 'left' }, '& .align-justify': { textAlign: 'justify' }, '& blockquote': { borderLeft: `3px solid ${theme.palette.secondary.main}`, margin: '8px 0', padding: '2px 12px', fontStyle: 'italic', color: theme.palette.text.secondary } }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.message) }} />

                      {/* Ikona kostki jeśli są rzuty */}
                      {parseDiceRolls(msg.dice_rolls).length > 0 && (
                        <Box
                          onClick={() => {
                            setSelectedDiceRolls(parseDiceRolls(msg.dice_rolls));
                            setDicePopupOpen(true);
                          }}
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mt: 1,
                            px: 1,
                            py: 0.5,
                            backgroundColor: 'rgba(212, 175, 55, 0.15)',
                            border: '1px solid rgba(212, 175, 55, 0.4)',
                            borderRadius: 1,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              backgroundColor: 'rgba(212, 175, 55, 0.25)',
                              borderColor: 'rgba(212, 175, 55, 0.6)',
                            }
                          }}
                        >
                          <CasinoIcon sx={{ fontSize: 20, color: theme.palette.warning.light }} />
                        </Box>
                      )}
                    </>
                  )}
                </Box>
                </Box>
              </Box>
            ))}

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 1 }}>
                <Pagination count={totalPages} page={currentPage} onChange={(event, value) => setCurrentPage(value)} color="primary" sx={{ '& .MuiPaginationItem-root': { color:theme.palette.text.secondary, borderColor: theme.palette.divider, '&:hover': { backgroundColor: 'rgba(122, 74, 50, 0.1)' }, '&.Mui-selected': { backgroundColor: theme.palette.secondary.main, color: theme.palette.text.primary, '&:hover': { backgroundColor: theme.palette.primary.dark } } } }} />
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

{!(session.closed) && isParticipant && (
  <Box sx={{
    borderTop: `2px solid ${theme.palette.divider}`,
    px: 0,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    // Edytor NIE rozpycha się już proporcją (dawne flex 1/2/3, które i tak
    // przegrywało z min-heightami). Ma konkretną wysokość - na mobile z hooka
    // regulacji (gracz ustawia ją uchwytem), na desktopie jak dotąd.
    flex: '0 0 auto',
    height: isEditorCollapsed ? 'auto' : `${editorHeight}px`,
    position: 'relative',
    pt: isEditorCollapsed ? 0 : 0.5,
  }}>

              {isEditorCollapsed ? (
                <EditorCollapsedBar
                  onExpand={expandEditorAndFocus}
                  accentColor={theme.palette.primary.main}
                />
              ) : (
                <>
                  {/* Uchwyt zmiany wysokości + zwijanie w jednym wierszu.
                      Wcześniej resizeHandleProps z hooka nie był podpięty do
                      żadnego elementu, więc regulacji wysokości nie dało się
                      użyć, a przycisk zwijania był ukryty akurat na mobile. */}
                  <EditorResizeHandle
                    resizeHandleProps={resizeHandleProps}
                    isResizing={isResizing}
                    onCollapse={() => setIsEditorCollapsed(true)}
                    accentColor={theme.palette.primary.main}
                    compact={isMobile}
                  />
                  {/* Wysokość bierze się z rodzica (ustawiona wyżej z hooka),
                      więc tutaj wystarczy flex:1 - bez osobnego height/maxHeight
                      tylko dla desktopu, jak było wcześniej. */}
                  <Box ref={editorContainerRef} sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, flex: 1, width: '100%', overflow: 'hidden', minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', '& .ProseMirror': { outline: 'none', color: theme.palette.text.primary, caretColor: theme.palette.primary.main, width: '100%', px: 1, backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important', '&:focus': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' }, '&:focus-visible': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' } }, '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' } }}>
                    {/* Sticky Toolbar - zawsze widoczny na górze */}
                    <Box sx={{ flexShrink: 0, position: 'sticky', top: 0, zIndex: 10, bgcolor: theme.palette.background.paper, pt: isMobile ? 0.25 : 0.5, px: 1, borderBottom: '1px solid rgba(90, 90, 90, 0.3)', mb: isMobile ? 0.25 : 0.5 }}>
                      <EditorToolbar editor={newMsgEditor} anchorTextColor={newMsgAnchorTextColor} setAnchorTextColor={setNewMsgAnchorTextColor} anchorBgColor={newMsgAnchorBgColor} setAnchorBgColor={setNewMsgAnchorBgColor} isMobile={isMobile} isNarratorMode={isNarratorMode} setIsNarratorMode={setIsNarratorMode} editorId="new-message-editor" isEditMode={false} onSend={sendMessage} canSend={(!isEditorContentEmpty(newMessage) || pendingDiceRolls.length > 0) && (getCurrentCharacter() || isNarratorMode)} onDiceRoll={handleDiceRoll} />

                      {pendingDiceRolls.length > 0 && (
                        <Tooltip title="Kliknij aby zobaczyć zaplanowane rzuty">
                          <Box
                            onClick={() => setPendingDicePopupOpen(true)}
                            sx={{
                              mt: 1,
                              mb: 1,
                              p: 1,
                              backgroundColor: 'rgba(212, 175, 55, 0.1)',
                              borderRadius: 1,
                              border: `1px solid ${theme.palette.divider}`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                                transform: 'scale(1.02)'
                              }
                            }}
                          >
                            <CasinoIcon sx={{ fontSize: 20, color: theme.palette.warning.light }} />
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold' }}>
                              Zaplanowane rzuty kostką ({pendingDiceRolls.length})
                            </Typography>
                          </Box>
                        </Tooltip>
                      )}
                    </Box>

                    {/* Editor Content - scrollowalny */}
                    {/* Pole pisania. Dawne pb:4 (32 px) na mobile było większe
                        niż połowa samego pola przy otwartej klawiaturze - stąd
                        wrażenie "mikroskopijnego edytora". Minimalna wysokość
                        idzie teraz ze wspólnych stałych (patrz theme.js). */}
                    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: isMobile ? 1 : 2, pt: 0.5, pb: isMobile ? 0.75 : 1, cursor: 'text', '& .ProseMirror': { px: isMobile ? 0.75 : 1.5, py: 0.5, minHeight: `${proseMirrorMin}px` } }} onClick={() => newMsgEditor?.commands?.focus()}>
                      <EditorContent editor={newMsgEditor} />
                    </Box>
                  </Box>

                  {isNarratorMode && (
                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, mt: isMobile ? 0.25 : 1, p: isMobile ? 0.5 : 1, backgroundColor: 'rgba(204, 0, 68, 0.1)', borderRadius: 1, border: '1px solid rgba(204, 0, 68, 0.3)' }}>
                      <NarratorMark sx={{ mr: 1, color: theme.palette.error.text, fontSize: isMobile ? 16 : undefined }} />
                      <Typography variant="body2" sx={{ color: theme.palette.error.text, fontWeight: 'bold', fontSize: { xs: '0.7rem', sm: '0.875rem' }, lineHeight: 1.3 }}>
                        {isMobile ? 'Tryb narratora aktywny' : 'Tryb narratora aktywny – wiadomość zostanie wysłana jako "Narrator"'}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </Box>

        {/* Pending Dice Rolls Preview Popup */}
        <Dialog
          open={pendingDicePopupOpen}
          onClose={() => setPendingDicePopupOpen(false)}
          maxWidth="sm"
          fullWidth
          {...keyboardSafeDialogProps(keyboardViewport, {
            backgroundColor: theme.palette.background.paper,
            backgroundImage: 'none',
            border: `2px solid ${theme.palette.divider}`,
            borderRadius: 2
          })}
        >
          <DialogTitle sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <CasinoIcon sx={{ color: theme.palette.warning.light }} />
            Zaplanowane rzuty kostką ({pendingDiceRolls.length})
          </DialogTitle>
          <DialogContent sx={{ mt: 2, overflowY: 'auto' }}>
            {pendingDiceRolls.length > 0 ? (
              <>
                {pendingDiceRolls.map((roll, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 1.5,
                      p: 1.5,
                      backgroundColor: 'rgba(212, 175, 55, 0.1)',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                      borderLeft: `4px solid ${theme.palette.warning.light}`,
                      borderRadius: 1
                    }}
                  >
                    {roll.description && (
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold', mb: 0.5 }}>
                        {roll.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {canViewDiceResults() ? (
                        <>
                          {(() => {
                            const mod = Number(roll.modifier) || 0;
                            const total = roll.total != null ? roll.total : (Number(roll.roll) + mod);
                            return (
                              <Typography variant="h6" sx={{ color: theme.palette.warning.light, fontWeight: 'bold' }}>
                                🎲 {roll.roll}{mod ? ` ${mod > 0 ? '+' : '−'}${Math.abs(mod)} = ${total}` : ''}
                              </Typography>
                            );
                          })()}
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            (K{roll.sides})
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                          🎲 K{roll.sides} - wynik ukryty
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem', fontStyle: 'italic', display: 'block', mt: 1 }}>
                  {canViewDiceResults()
                    ? 'Jako uprawniony użytkownik widzisz wyniki przed wysłaniem wiadomości'
                    : 'Wyniki rzutów będą widoczne dla wszystkich po wysłaniu wiadomości'
                  }
                </Typography>
              </>
            ) : (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Brak zaplanowanych rzutów
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, p: 2 }}>
            <Button
              onClick={() => setPendingDicePopupOpen(false)}
              sx={{ color: theme.palette.text.primary }}
            >
              Zamknij
            </Button>
          </DialogActions>
        </Dialog>

        {renderDiceRollsDialog()}
      </>
    );
  }

  if (isArchiveView) {
    return (
      <Box sx={{ flex: 1, width: '100%', px: 0, py: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderAdultWarningDialog()}
        {renderAddMembersDialog()}
        {renderRemoveMembersDialog()}
        {renderReopenDialog()}
        {renderParticipantsDialog()}
        {renderSessionInfoDialog()}
        {renderOwnerNotesDialog()}

        {/* Character Card Popup */}
        {selectedCharacterForCard && (
          <CharacterCardPopup
            open={showCharacterCardPopup}
            onClose={() => {
              setShowCharacterCardPopup(false);
              setSelectedCharacterForCard(null);
            }}
            characterId={selectedCharacterForCard.id}
            characterName={selectedCharacterForCard.name}
            characterAvatar={selectedCharacterForCard.avatar}
          />
        )}

        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => navigate('/home/generalSessions')} sx={{ color:theme.palette.text.secondary, backgroundColor: 'rgba(0,0,0,0.6)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h4" sx={{ color:theme.palette.text.secondary, flex: 1,  letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: { xs: '1.3rem', sm: '1.6rem' } }}>
            Archiwum Sesji Ogólnych
          </Typography>
        </Box>

        {errorArchive && <Alert severity="error" sx={{ mb: 2, mx: 2 }}>{errorArchive}</Alert>}

        <Box sx={{ p: 2, mb: 3, mx: 2, backgroundColor: 'rgba(212, 175, 55, 0.1)', border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color:theme.palette.text.secondary, mb: 1 }}>
            <LockIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
            <strong>Archiwum sesji zamkniętych</strong>
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
            Tutaj znajdziesz wszystkie zamknięte sesje ogólne. Możesz je nadal przeglądać, a właściciele mogą przywrócić je do stanu aktywnego.
          </Typography>
        </Box>
        
        {loadingArchive ? (
          <Typography sx={{ color: theme.palette.text.primary, textAlign: 'center', py: 4, px: 2 }}>
            Ładowanie archiwum sesji...
          </Typography>
        ) : archivedSessions.length > 0 ? (
          <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
            {archivedSessions.map((sess) => (
              <Box key={sess.id} {...cardOpenProps(() => handleSessionClick(sess))} sx={{ p: 2, mb: 2, border: `1px solid ${theme.palette.primary.dark}`, borderLeft: `4px solid ${theme.palette.primary.main}`, borderRadius: '4px', backgroundColor: `${theme.palette.primary.main}14`, position: 'relative', width: '100%', cursor: 'pointer', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 8px 16px ${theme.palette.primary.main}4d`, borderLeftColor: theme.palette.primary.light, backgroundColor: `${theme.palette.primary.main}22` } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LockIcon fontSize="small" sx={{ color: theme.palette.error.text }} />
                  {sess.is_adult_only === 1 && (
                    <Chip
                      label="+18"
                      size="small"
                      onClick={handleAdultInfoClick}
                      sx={{
                        backgroundColor: theme.palette.error.main,
                        color: theme.palette.common.white,
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        height: '20px',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: theme.palette.error.dark
                        }
                      }}
                    />
                  )}
                  <Typography variant="h6" sx={{ color: theme.palette.error.text, textDecoration: 'line-through', fontWeight: 'bold', flex: 1 }}>{sess.title}</Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleSessionClick(sess)}
                    sx={{
                      color: theme.palette.text.primary,
                      borderColor: theme.palette.primary.dark,
                      '&:hover': {
                        borderColor: theme.palette.primary.dark,
                        backgroundColor: 'rgba(139, 87, 41, 0.1)'
                      }
                    }}
                  >
                    Przeglądaj sesję
                  </Button>

                  <SessionExportButton
                    type="general"
                    sessionId={sess.id}
                    gameName={gameName}
                    sx={{
                      color: appColors.steelLight,
                      border: `1px solid ${appColors.steel}`,
                      borderRadius: '2px',
                      fontSize: '0.82rem',
                      letterSpacing: '0.06em',
                      '&:hover': { borderColor: appColors.steelLighter, backgroundColor: `${appColors.steel}22`, color: appColors.textLight },
                    }}
                  />

                  {sess.created_by === userId && (
                    <Tooltip title="Przywróć sesję do stanu aktywnego">
                      <Button 
                        variant="contained" 
                        startIcon={<RestoreIcon />} 
                        onClick={() => openReopenDialog(sess)} 
                        sx={{ 
                          backgroundColor: theme.palette.secondary.main, 
                          color:theme.palette.text.secondary, 
                          '&:hover': { backgroundColor: theme.palette.primary.dark }
                        }}
                      >
                        Przywróć
                      </Button>
                    </Tooltip>
                  )}
                </Box>

                {sess.created_by === userId && (
                  <Typography variant="caption" sx={{ position: 'absolute', top: 8, right: 8, color:theme.palette.text.secondary, backgroundColor: 'rgba(212, 175, 55, 0.2)', px: 1, py: 0.5, borderRadius: 1, fontSize: '0.7rem' }}>WŁAŚCICIEL</Typography>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <LockIcon sx={{ fontSize: 60, color: theme.palette.primary.dark, mb: 2 }} />
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 1 }}>Archiwum jest puste</Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Nie masz jeszcze żadnych zamkniętych sesji ogólnych.</Typography>
          </Box>
        )}
      </Box>
    );
  }

  if (isCreatingSession) {
    const currentCharacter = getCurrentCharacter();
    
    return (
      <Box sx={{ height: isMobile ? '100%' : `${containerHeight}px`, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', px: 0, py: 0, overflow: 'hidden' }}>
        {renderAdultWarningDialog()}
        {renderAddMembersDialog()}
        {renderRemoveMembersDialog()}
        {renderParticipantsDialog()}
        {renderSessionInfoDialog()}
        {renderOwnerNotesDialog()}

        {/* Character Card Popup */}
        {selectedCharacterForCard && (
          <CharacterCardPopup
            open={showCharacterCardPopup}
            onClose={() => {
              setShowCharacterCardPopup(false);
              setSelectedCharacterForCard(null);
            }}
            characterId={selectedCharacterForCard.id}
            characterName={selectedCharacterForCard.name}
            characterAvatar={selectedCharacterForCard.avatar}
          />
        )}

        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => navigate('/home/generalSessions')} sx={{ color:theme.palette.text.secondary, backgroundColor: 'rgba(0,0,0,0.6)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h5" sx={{ color:theme.palette.text.secondary, flex: 1 }}>
            Nowa sesja ogólna
          </Typography>
        </Box>

        <Box sx={{ px: 2, py: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <TextField
            label="Tytuł sesji"
            fullWidth
            value={newSessionTitle}
            onChange={(e) => setNewSessionTitle(e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.divider },
                '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
              },
              '& .MuiInputBase-input': { color: theme.palette.text.primary },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
            }}
          />

          <Box sx={{ mb: 2, p: 2, border: `2px solid ${isAdultOnly ? theme.palette.error.main : theme.palette.secondary.main}`, borderRadius: 2, backgroundColor: isAdultOnly ? 'rgba(211, 47, 47, 0.1)' : 'rgba(13, 15, 14, 0.3)' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={isAdultOnly}
                  onChange={(e) => setIsAdultOnly(e.target.checked)}
                  sx={{
                    color: theme.palette.error.text,
                    '&.Mui-checked': {
                      color: theme.palette.error.text,
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ color: theme.palette.error.text, fontWeight: 'bold' }}>
                    +18 Sesja tylko dla dorosłych
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    Zaznacz, jeśli w sesji mogą pojawić się sceny przemocy, krwi, seksu, narkotyków lub inne treści dla dorosłych
                  </Typography>
                </Box>
              }
            />
          </Box>

          <TextField
            fullWidth
            label="Data startu sesji (opcjonalnie)"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.divider },
                '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
              },
              '& .MuiInputBase-input': { color: theme.palette.text.primary },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
            }}
          />

          <TextField
            fullWidth
            label="Lokalizacja (opcjonalnie)"
            value={location_info}
            onChange={(e) => setLocationInfo(e.target.value)}
            placeholder="np. Warszawa, Bar u Jurka"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.divider },
                '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
              },
              '& .MuiInputBase-input': { color: theme.palette.text.primary },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
            }}
          />

          <TextField
            fullWidth
            multiline
            rows={2}
            maxRows={6}
            label="Dodatkowe informacje (opcjonalnie)"
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Dodatkowe notatki o sesji..."
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.divider },
                '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary }
              },
              '& .MuiInputBase-input': { color: theme.palette.text.primary },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary }
            }}
          />
          
          {!currentCharacter && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2"><strong>Uwaga:</strong> Nie masz aktywnej postaci. Możesz tworzyć sesję tylko w trybie narratora lub wrócić do lobby i wybrać postać.</Typography>
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color:theme.palette.text.secondary, mb: 1 }}>Dodaj inne postaci jako uczestników (opcjonalnie):</Typography>
            <Stack direction={isMobile ? "column" : "row"} spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
              <TextField size="small" label="ID postaci" value={inputCharacterId} onChange={e => setInputCharacterId(e.target.value.replace(/\D+/g, ''))} onKeyDown={e => e.key === 'Enter' && handleAddCharacterId()} sx={{ minWidth: isMobile ? '100%' : 170, flex: 1, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary } }} disabled={addingCharacter} autoComplete="off" />
              <Button onClick={handleAddCharacterId} variant="contained" disabled={addingCharacter || !inputCharacterId.trim()} sx={{ minWidth: isMobile ? '100%' : 90, backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>Dodaj</Button>
            </Stack>
            
            {characterIdError && <Typography color="error" sx={{ fontSize: 13, mb: 1 }}>{characterIdError}</Typography>}
            
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ minHeight: 30 }}>
              {selectedCharacterIds.map(charId => {
                const character = charactersCache[charId];
                return (
                  <Chip key={charId} avatar={<Avatar src={getCharacterAvatar(character)} sx={{ width: 24, height: 24 }}>{!getCharacterAvatar(character) && character?.name?.[0]?.toUpperCase()}</Avatar>} label={`${character?.name || `ID:${charId}`} (#${charId})`} onDelete={() => handleRemoveCharacterId(charId)} sx={{ bgcolor: 'rgba(13, 15, 14, 0.3)', color:theme.palette.text.secondary, mb: 0.5, '& .MuiChip-deleteIcon': { color:theme.palette.text.secondary } }} />
                );
              })}
            </Stack>
          </Box>

          <Box ref={firstMsgEditorContainerRef} sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, flex: 1, minHeight: isMobile ? 120 : 180, maxHeight: 'none', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', '& .ProseMirror': { outline: 'none', color: theme.palette.text.primary, caretColor: theme.palette.primary.main, width: '100%', px: 1, backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important', '&:focus': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' }, '&:focus-visible': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' } }, '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' } }}>
            {/* Sticky Toolbar - zawsze widoczny na górze */}
            <Box sx={{ flexShrink: 0, position: 'sticky', top: 0, zIndex: 10, bgcolor: theme.palette.background.paper, pt: 1, px: 1, borderBottom: '1px solid rgba(90, 90, 90, 0.3)', mb: 1 }}>
              <EditorToolbar editor={firstMsgEditor} anchorTextColor={firstMsgAnchorTextColor} setAnchorTextColor={setFirstMsgAnchorTextColor} anchorBgColor={firstMsgAnchorBgColor} setAnchorBgColor={setFirstMsgAnchorBgColor} isMobile={isMobile} isNarratorMode={isNarratorMode} setIsNarratorMode={setIsNarratorMode} editorId="first-message-editor" isEditMode={false} onSend={createSession} canSend={!!newSessionTitle.trim() && (currentCharacter || isNarratorMode)} onDiceRoll={handleDiceRoll} />

              {pendingDiceRolls.length > 0 && (
                <Tooltip title="Kliknij aby zobaczyć zaplanowane rzuty">
                  <Box
                    onClick={() => setPendingDicePopupOpen(true)}
                    sx={{
                      mt: 1,
                      mb: 1,
                      p: 1,
                      backgroundColor: 'rgba(212, 175, 55, 0.1)',
                      borderRadius: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: 'rgba(212, 175, 55, 0.2)',
                        transform: 'scale(1.02)'
                      }
                    }}
                  >
                    <CasinoIcon sx={{ fontSize: 20, color: theme.palette.warning.light }} />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold' }}>
                      Zaplanowane rzuty kostką ({pendingDiceRolls.length})
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>

            {/* Editor Content - scrollowalny */}
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: isMobile ? 1 : 2, pt: 0.5, pb: isMobile ? 0.75 : 1, cursor: 'text', '& .ProseMirror': { px: isMobile ? 0.75 : 1.5, py: 0.5, minHeight: `${proseMirrorMin}px` } }} onClick={() => firstMsgEditor?.commands?.focus()}>
              <EditorContent editor={firstMsgEditor} />
            </Box>
          </Box>
          
          {isNarratorMode && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, p: 1, backgroundColor: 'rgba(204, 0, 68, 0.1)', borderRadius: 1, border: '1px solid rgba(204, 0, 68, 0.3)' }}>
              <NarratorMark sx={{ mr: 1, color: theme.palette.error.text }} />
              <Typography variant="body2" sx={{ color: theme.palette.error.text, fontWeight: 'bold' }}>Tryb narratora aktywny – pierwsza wiadomość zostanie wysłana jako "Narrator"</Typography>
            </Box>
          )}
          
          {errorCreate && <Typography color="error" sx={{ mb: 2 }}>{errorCreate}</Typography>}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, width: '100%', px: 0, py: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {renderAdultWarningDialog()}
      {renderAddMembersDialog()}
      {renderRemoveMembersDialog()}
      {renderReopenDialog()}
      {renderParticipantsDialog()}
      {renderSessionInfoDialog()}
      {renderOwnerNotesDialog()}
      {renderCloseSummaryDialog()}

      {/* Character Card Popup */}
      {selectedCharacterForCard && (
        <CharacterCardPopup
          open={showCharacterCardPopup}
          onClose={() => {
            setShowCharacterCardPopup(false);
            setSelectedCharacterForCard(null);
          }}
          characterId={selectedCharacterForCard.id}
          characterName={selectedCharacterForCard.name}
          characterAvatar={selectedCharacterForCard.avatar}
        />
      )}

      <Box sx={{ px: 2, pt: 2, mb: 1 }}>
        <Typography sx={{
          color: appColors.textMuted,
          fontSize: '0.65rem',
          letterSpacing: '0.22em',
          
          mb: 0.25,
        }}>
          // SYSTEM KOMUNIKACJI
        </Typography>
        <Typography variant="h4" sx={{
          color: appColors.textLight,
          fontSize: { xs: '1.35rem', sm: '2.125rem' },
          letterSpacing: { xs: '0.02em', sm: '0.06em' },
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          minWidth: 0,
          gap: { xs: 0.75, sm: 1.5 },
        }}>
          <Box component="span" sx={{ color: theme.palette.primary.main, opacity: 0.7 }}>{'>'}</Box>
          Sesje Ogólne
          {unreadSessionIds.length > 0 && (
            <Tooltip title="Nowe wiadomości w Twoich sesjach!">
              <Box sx={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: appColors.dangerText,
                boxShadow: `0 0 8px ${appColors.dangerText}`,
                animation: 'unreadPulse 1.5s ease-in-out infinite',
              }} />
            </Tooltip>
          )}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 2, flexWrap: 'wrap' }}>
        <Button
          onClick={() => navigate('/home/generalSessions/new')}
          sx={{
            color: appColors.textLight,
            border: `2px solid ${theme.palette.primary.main}`,
            borderRadius: '2px',
            bgcolor: 'transparent',
            
            letterSpacing: '0.1em',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            px: 2.5,
            py: 0.75,
            boxShadow: `0 0 8px ${theme.palette.primary.main}30`,
            '&:hover': {
              bgcolor: `${theme.palette.primary.main}18`,
              boxShadow: `0 0 16px ${theme.palette.primary.main}50`,
            },
          }}
        >
          [ + NOWA SESJA OGÓLNA ]
        </Button>
        <Button
          onClick={() => navigate('/home/generalSessions/archive')}
          sx={{
            color: appColors.steelLight,
            border: `2px solid ${appColors.steel}`,
            borderRadius: '2px',
            bgcolor: 'transparent',
            
            letterSpacing: '0.1em',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            px: 2.5,
            py: 0.75,
            '&:hover': {
              bgcolor: `${appColors.steel}22`,
              borderColor: appColors.steelLighter,
              color: appColors.textLight,
            },
          }}
        >
          [ ARCHIWUM ]
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
        {loading ? (
          <Typography sx={{ color: theme.palette.text.primary, textAlign: 'center', py: 4 }}>
            Ładowanie...
          </Typography>
        ) : sessions.length > 0 ? (
          sessions.map((s) => {
            const isUnread = !!(s.is_participant && unreadSessionIds.includes(s.id));
            return (
              <Box
                key={s.id}
                // Klik w dowolne miejsce karty otwiera sesję (przyciski działają jak dotąd).
                {...cardOpenProps(() => handleSessionClick(s))}
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  // Ozdobna ramka rasowa (border-image) wokół sesji.
                  borderStyle: 'solid',
                  borderWidth: '18px 22px',
                  borderImage: `url(/ui/session/${raceFrame}.png) 56 62 stretch`,
                  backgroundColor: `${race.hex}12`,
                  backgroundClip: 'padding-box',
                  position: 'relative',
                  width: '100%',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: `${race.hex}2e`,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {isUnread && (
                    <>
                      <Tooltip title="Nowa wiadomość w tej sesji!">
                        <Box sx={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: theme.palette.error.main, boxShadow: `0 0 6px ${theme.palette.error.main}`, mr: 0.5 }} />
                      </Tooltip>
                      <Typography variant="caption" sx={{ color: theme.palette.error.text, fontWeight: 'bold', mr: 1 }}>nowa wiadomość</Typography>
                    </>
                  )}
                  {s.is_adult_only === 1 && (
                    <Chip
                      label="+18"
                      size="small"
                      onClick={handleAdultInfoClick}
                      sx={{
                        backgroundColor: theme.palette.error.main,
                        color: theme.palette.common.white,
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        height: '20px',
                        mr: 0.5,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: theme.palette.error.dark
                        }
                      }}
                    />
                  )}
                  <Typography
                    variant="h6"
                    sx={{
                      color: s.closed ? appColors.dangerText : appColors.textLight,
                      
                      fontSize: { xs: '1.1rem', sm: '1.3rem' },
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      textDecoration: s.closed ? 'line-through' : 'none',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.title}
                  </Typography>
                  {s.closed ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LockIcon fontSize="small" sx={{ color: theme.palette.error.text }} />
                      <Typography variant="caption" sx={{ color: theme.palette.error.text, fontWeight: 'bold' }}>zamknięta</Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: theme.palette.success.text, fontWeight: 'bold' }}>aktywna</Typography>
                  )}
                </Box>
                
<Typography variant="body2" sx={{ color: theme.palette.text.primary, mb: 1, fontSize: '0.95rem' }}>
    Ostatnia aktywność: {formatDate(s.last_activity)}
    {s.last_author && (
      <>
        {' przez '}
        {s.last_character_type === 'narrator' ? (
          <Link 
            component="button" 
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              if (s.last_character_id) { 
                navigate(`/home/profile/${s.last_character_id}`); 
              } 
            }} 
            sx={{ 
              color: theme.palette.error.text, 
              fontWeight: 'bold', 
              textDecoration: 'none', 
              border: 'none', 
              background: 'none', 
              padding: 0, 
              cursor: 'pointer', 
              fontSize: 'inherit', 
              '&:hover': { textDecoration: 'underline' } 
            }}
          >
            {s.narrator_character_name || s.last_character_name || 'Nieznany'}
          </Link>
        ) : s.last_character_name && s.last_character_id ? (
          <Link 
            component="button" 
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              navigate(`/home/profile/${s.last_character_id}`); 
            }} 
            sx={{ 
              color: theme.palette.primary.main,
              fontWeight: 'bold', 
              textDecoration: 'none', 
              border: 'none', 
              background: 'none', 
              padding: 0, 
              cursor: 'pointer', 
              fontSize: 'inherit', 
              '&:hover': { textDecoration: 'underline' } 
            }}
          >
            {s.last_character_name} (ID: {s.last_character_id})
          </Link>
        ) : (
          <strong style={{ color: theme.palette.primary.main }}>
            {s.last_author || 'Nieznany'}
          </strong>
        )}
      </>
    )}
  </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleSessionClick(s)}
                    sx={{
                      color: race.accent,
                      fontWeight: 'bold',
                      fontSize: '0.92rem',
                      letterSpacing: '0.06em',
                      borderColor: race.border,
                      '&:hover': {
                        borderColor: race.hex,
                        backgroundColor: `${race.hex}2e`,
                        color: race.accent,
                      }
                    }}
                  >
                    Otwórz sesję
                  </Button>
                  <SessionExportButton
                    type="general"
                    sessionId={s.id}
                    gameName={gameName}
                    sx={{
                      color: appColors.steelLight,
                      border: `1px solid ${appColors.steel}`,
                      borderRadius: '2px',
                      fontWeight: 'bold',
                      fontSize: '0.82rem',
                      letterSpacing: '0.06em',
                      '&:hover': { borderColor: appColors.steelLighter, backgroundColor: `${appColors.steel}22`, color: appColors.textLight },
                    }}
                  />
                </Box>

                {s.created_by === userId && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute', 
                      top: 8, 
                      right: 8, 
                      color: theme.palette.primary.main,
                      backgroundColor: theme.palette.mode === 'dark'
                        ? 'rgba(212, 175, 55, 0.2)'
                        : 'rgba(212, 175, 55, 0.15)',
                      px: 1, 
                      py: 0.5, 
                      borderRadius: 1, 
                      fontSize: '0.7rem', 
                      fontWeight: 'bold',
                      border: `1px solid ${theme.palette.primary.main}`
                    }}
                  >
                    WŁAŚCICIEL
                  </Typography>
                )}
              </Box>
            );
          })
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <Typography sx={{ color: appColors.textMuted, fontSize: '0.7rem', letterSpacing: '0.2em', mb: 1, }}>
              // BRAK DANYCH
            </Typography>
            <Typography variant="h6" sx={{ color: appColors.steelLight, mb: 1,  letterSpacing: '0.08em' }}>BRAK SESJI</Typography>
            <Typography variant="body2" sx={{ color: appColors.textMuted, }}>
              Nie masz jeszcze żadnych sesji ogólnych. Sesje ogólne są widoczne dla wszystkich graczy.
            </Typography>
          </Box>
        )}
      </Box>

      {renderDiceRollsDialog()}
    </Box>
  );
}

export default GeneralSessions;
