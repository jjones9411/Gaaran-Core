import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import sanitizeHtml from './sanitizeHtml';
import SessionExportButton from './sessionExport';
import useGameName from './useGameName';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, IconButton, Alert, Stack, Tooltip, Popover, TextField, Chip, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Avatar, Link, Pagination } from '@mui/material';

import {
  Warning as LockIcon,
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
import { appColors, getRaceColorSet, readingSurfaceSx } from './theme';
import CharacterHoverCard from './CharacterHoverCard';
import NarratorAvatar, { NarratorMark } from './NarratorAvatar';
import { decodeJwtPayload, getCurrentCharacter } from './AuthContext';
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
import { cardOpenProps } from './cardClick';
import useResponsive from './useResponsive';


// Extensions dla editora
// Podgląd i konwersja *gwiazdek* siedzą we wspólnym module (./starText) -
// te same reguły obowiązują w Sesjach, Karczmie i Wiadomościach.

const LimitedImage = Image.extend({
  addAttributes() { return { ...this.parent?.(), style: { default: 'max-width:100%;height:auto;', parseHTML: element => element.getAttribute('style'), renderHTML: attributes => ({ style: `max-width:100%;height:auto;${attributes.style || ''}` }) } }; }
});

const colors = ['#0f0f0f', '#f0f0f0', '#a0522d', '#8b0000', '#556b2f', '#483d8b', '#6b7280', '#2f4f4f', '#800080', '#cd853f'];

// Utility functions
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

// Funkcje pomocnicze do renderowania
const renderUserNameWithProfile = (username, userId, navigate, additionalText = '', sx = {}) => {
  const handleProfileClick = (e) => { e.preventDefault(); e.stopPropagation(); navigate(`/home/profile/${userId}`); };
  return (
    <Link component="button" onClick={handleProfileClick} sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 'inherit', fontSize: 'inherit', border: 'none', background: 'none', padding: 0, cursor: 'pointer', '&:hover': { textDecoration: 'underline', color: 'text.secondary' }, ...sx }}>
      {username} (#{userId}){additionalText}
    </Link>
  );
};




// Resizable editor hook
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

// EditorToolbar Component
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
  // który trafi do wiadomości. Podgląd == zapis i nie da się oszukać.
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
              <Button
                onClick={onSend}
                disabled={!canSend}
                sx={{
                  bgcolor: 'transparent',
                  color: canSend ? theme.palette.primary.main : appColors.steel,
                  border: `2px solid ${canSend ? theme.palette.primary.main : appColors.borderSteel}`,
                  borderRadius: '2px',
                  
                  letterSpacing: '0.08em',
                  fontWeight: 'bold',
                  fontSize: isMobile ? '0.7rem' : '0.75rem',
                  minWidth: isMobile ? 36 : 'auto',
                  mr: 1,
                  px: isMobile ? 0.75 : 1.5,
                  py: 0.5,
                  '&:hover': {
                    bgcolor: `${theme.palette.primary.main}18`,
                    boxShadow: `0 0 10px ${theme.palette.primary.main}40`,
                  },
                  '&:disabled': {
                    color: appColors.textMuted,
                    borderColor: appColors.borderSteel,
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <SendIcon sx={{ fontSize: isMobile ? 12 : 13 }} />
                {!isMobile && <span style={{ marginLeft: 4 }}>WYŚLIJ</span>}
              </Button>
            </span>
          </Tooltip>
        )}

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa"><i>I</i></ToolbarButton>
        {/* Na mobile te narzędzia chowają się pod "..." - pasek był szerszy niż
            ekran, a kostka i tryb narratora lądowały poza nim. Na desktopie
            ToolbarOverflow renderuje je w miejscu, więc kolejność bez zmian. */}
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

<Dialog open={diceDialogOpen} onClose={() => setDiceDialogOpen(false)} PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `2px solid ${theme.palette.divider}`, borderRadius: 2 } }}>        <DialogTitle sx={{ color:theme.palette.text.secondary }}>
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

function PrivateSessions() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const race = useRaceColor(); // ramka/tinta/hover wg rasy (po NAZWIE rasy, pewniejsze)
  const raceFrame = race.frame || 'human';
  const gameName = useGameName(''); // nagłówek eksportowanego dokumentu sesji
  // Trzyma aktualny sessionId, żeby fetchSessionData mógł odrzucić spóźnioną
  // odpowiedź z poprzedniej sesji po szybkim przełączeniu (wyścig zapytań)
  const latestSessionIdRef = useRef(sessionId);
  useEffect(() => {
    latestSessionIdRef.current = sessionId;
  }, [sessionId]);

  // Zmień funkcję renderCharacterWithTooltip:
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

  // Stan główny
  const [sessions, setSessions] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [unreadSessionIds, setUnreadSessionIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [messagesPerPage] = useState(20);

  // Archiwum
  const [archivedSessions, setArchivedSessions] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [errorArchive, setErrorArchive] = useState('');
  const [reopenDialog, setReopenDialog] = useState({ open: false, session: null });
  const [reopening, setReopening] = useState(false);

  // Tworzenie sesji
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [errorCreate, setErrorCreate] = useState('');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState([]);
  const [inputCharacterId, setInputCharacterId] = useState('');
  const [characterIdError, setCharacterIdError] = useState('');
  const [addingCharacter, setAddingCharacter] = useState(false);
  const [charactersCache, setCharactersCache] = useState({});

  // Zarządzanie uczestnikami
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [newMemberIds, setNewMemberIds] = useState([]);
  const [newMemberInput, setNewMemberInput] = useState('');
  const [newMemberError, setNewMemberError] = useState('');
  const [addingNewMembers, setAddingNewMembers] = useState(false);
  const [showRemoveMembers, setShowRemoveMembers] = useState(false);
  const [removingMembers, setRemovingMembers] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);

  // State dla character card popup
  const [showCharacterCardPopup, setShowCharacterCardPopup] = useState(false);
  const [selectedCharacterForCard, setSelectedCharacterForCard] = useState(null);

  // State dla podglądu statystyk uczestnika (tylko postacie grające mechanicznie)
  const [showCharacterStatsPopup, setShowCharacterStatsPopup] = useState(false);
  const [selectedCharacterForStats, setSelectedCharacterForStats] = useState(null);

  // State dla podglądu przedmiotów fabularnych uczestnika (spis z profilu)
  const [showCharacterStoryItemsPopup, setShowCharacterStoryItemsPopup] = useState(false);
  const [selectedCharacterForStoryItems, setSelectedCharacterForStoryItems] = useState(null);

  // Sesja
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [errorConv, setErrorConv] = useState('');
  const [closeError, setCloseError] = useState('');

  // Wiadomości
  const [newMessage, setNewMessage] = useState('');
  const [editMsgId, setEditMsgId] = useState(null);
  const [editMsgValue, setEditMsgValue] = useState('');

  // UI
  // Widoczny obszar okna + wykrycie klawiatury - wspólny hook (patrz
  // useKeyboardViewport.js), zamiast lokalnej kopii tego samego kodu.
  // Pełny obiekt zostaje pod ręką dla keyboardSafeDialogProps (potrzebuje też offsetTop).
  const keyboardViewport = useKeyboardViewport();
  const { viewportHeight, keyboardVisible } = keyboardViewport;
  const [isNarratorMode, setIsNarratorMode] = useState(false);
  const [pendingDiceRolls, setPendingDiceRolls] = useState([]);

  // State dla dice popup
  const [dicePopupOpen, setDicePopupOpen] = useState(false);
  const [selectedDiceRolls, setSelectedDiceRolls] = useState(null);

  // State dla pending dice rolls preview popup
  const [pendingDicePopupOpen, setPendingDicePopupOpen] = useState(false);

  // Edytory - anchory dla kolorów
  const [newMsgAnchorTextColor, setNewMsgAnchorTextColor] = useState(null);
  const [newMsgAnchorBgColor, setNewMsgAnchorBgColor] = useState(null);
  const [editMsgAnchorTextColor, setEditMsgAnchorTextColor] = useState(null);
  const [editMsgAnchorBgColor, setEditMsgAnchorBgColor] = useState(null);
  const [firstMsgAnchorTextColor, setFirstMsgAnchorTextColor] = useState(null);
  const [firstMsgAnchorBgColor, setFirstMsgAnchorBgColor] = useState(null);

  // Nowe stany dla informacji o sesji
  const [startDate, setStartDate] = useState('');
  const [location_info, setLocationInfo] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [showSessionInfoDialog, setShowSessionInfoDialog] = useState(false);
  const [editingSessionInfo, setEditingSessionInfo] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAdditionalInfo, setEditAdditionalInfo] = useState('');
  const [savingSessionInfo, setSavingSessionInfo] = useState(false);
  const [sessionInfoError, setSessionInfoError] = useState('');

  // Dialog "Twoja notatka" - własna, prywatna notatka do sesji (każdy uczestnik ma swoją)
  const [showOwnerNotesDialog, setShowOwnerNotesDialog] = useState(false);
  const [myNoteDraft, setMyNoteDraft] = useState('');
  const [savingMyNote, setSavingMyNote] = useState(false);
  const [ownerNotesError, setOwnerNotesError] = useState('');

  const messagesEndRef = useRef(null);
  const editorContainerRef = useRef(null);  // Edytor odpowiedzi w istniejącej sesji
  const firstMsgEditorContainerRef = useRef(null);  // Edytor przy tworzeniu nowej sesji

  // Stałe
  const token = localStorage.getItem('token');

  // Pobierz userId z tokena JWT
  const userId = useMemo(() => {
    if (token) {
      const payload = decodeJwtPayload(token);
      return payload?.id || null;
    }
    return null;
  }, [token]);

  const { isSmall: isMobile } = useResponsive(); // wspólny próg z powłoką (1050px)

  const isCreatingSession = location.pathname.includes('/home/privateSessions/new');
  const isArchiveView = location.pathname.includes('/home/privateSessions/archive');
  const isViewingSession = sessionId && !isNaN(sessionId);

  // viewportHeight z hooka to realny WIDOCZNY obszar, więc przy otwartej
  // klawiaturze jest już pomniejszony - bez rozgałęziania jak wcześniej.
  const containerHeight = viewportHeight || window.innerHeight;

  // Dolna granica edytora na mobile jest świadomie wysoka: wcześniej 30 px
  // sprawiało, że pole pisania przy klawiaturze schodziło do dwóch linijek.
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

  // Hook zwraca wysokość już przyciętą do min/max; uchwyt przeciągania jest
  // podpięty niżej (wcześniej resizeHandleProps nie trafiał nigdzie).
  const { editorHeight, isResizing, resizeHandleProps } = useResizableEditor(editorLimits);

  // Zwinięcie edytora jest ZAPAMIĘTYWANE (osobno dla mobile i desktopu), więc
  // wybór gracza przeżywa przejście na inną sesję - wcześniej komponent montował
  // się od nowa i edytor znów się rozwijał. Domyślnie: mobile zwinięty,
  // desktop rozwinięty.
  const [isEditorCollapsed, setIsEditorCollapsed] = useEditorCollapsed(isMobile);

  const proseMirrorMin = isMobile
    ? (keyboardVisible ? CHAT_PROSEMIRROR_MIN.mobileWithKeyboard : CHAT_PROSEMIRROR_MIN.mobile)
    : CHAT_PROSEMIRROR_MIN.desktop;

  // Na telefonie z klawiaturą chowamy pasek nagłówka sesji - to ~2 linie treści.
  const hideChromeForKeyboard = isMobile && keyboardVisible;

  const totalPages = Math.ceil(messages.length / messagesPerPage);
  const indexOfLastMessage = currentPage * messagesPerPage;
  const indexOfFirstMessage = indexOfLastMessage - messagesPerPage;
  const currentMessages = messages.slice(indexOfFirstMessage, indexOfLastMessage);

  const handleDiceRoll = (rollObj) => {
    setPendingDiceRolls(prev => [...prev, rollObj]);
  };

  // Load pending dice rolls from localStorage
  useEffect(() => {
    if (sessionId) {
      const storageKey = `privateSessions_pendingDiceRolls_${sessionId}`;
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
      const storageKey = `privateSessions_pendingDiceRolls_${sessionId}`;
      if (pendingDiceRolls.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(pendingDiceRolls));
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [pendingDiceRolls, sessionId]);

  // Funkcja do zapisywania informacji o sesji
  const handleSaveSessionInfo = async () => {
    try {
      setSavingSessionInfo(true);
      setSessionInfoError('');

      const response = await fetch(`/api/privateSessions/${sessionId}/info`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: editStartDate || null,
          location: editLocation || null,
          additionalInfo: editAdditionalInfo || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd podczas zapisywania informacji');
      }

      // Odśwież dane sesji
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
    setEditingSessionInfo(false);
    setSessionInfoError('');
    setShowSessionInfoDialog(true);
  };

  const openOwnerNotesDialog = () => {
    setOwnerNotesError('');
    setMyNoteDraft(session?.my_note || '');
    setShowOwnerNotesDialog(true);
  };

  const handleSaveMyNote = async () => {
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) {
      setOwnerNotesError('Musisz mieć aktywną postać, żeby zapisać notatkę.');
      return;
    }

    try {
      setSavingMyNote(true);
      setOwnerNotesError('');

      const response = await fetch(`/api/privateSessions/${sessionId}/myNote`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ characterId: currentCharacter.id, note: myNoteDraft || null })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Błąd podczas zapisywania notatki');
      }

      await fetchSessionData();
      setShowOwnerNotesDialog(false);
    } catch (error) {
      console.error('Error saving my note:', error);
      setOwnerNotesError(error.message || 'Wystąpił błąd podczas zapisywania');
    } finally {
      setSavingMyNote(false);
    }
  };

  // Funkcje do zarządzania postaciami
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
    
    if (participants.some(p => p.character_id === Number(id))) { setNewMemberError('Ta postać już jest uczestnikiem sesji'); return; }
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
      
      const response = await fetch(`/api/privateSessions/${sessionId}/addMembers`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ characterIds: newMemberIds }) 
      });
      
      if (response.ok) {
        await fetchSessionData();
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
      
      const response = await fetch(`/api/privateSessions/${sessionId}/members/${characterId}`, { 
        method: 'DELETE', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (response.ok) {
        await fetchSessionData(); 
        setShowRemoveMembers(false);
      } else {
        const errorData = await response.json();
        setRemoveError(errorData.message || 'Błąd podczas usuwania członka');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      setRemoveError('Wystąpił błąd podczas usuwania członka');
    } finally { setRemovingMembers(false); }
  };

  const fetchSessions = async () => {
    try {
      setLoadingList(true);
      const currentCharacter = getCurrentCharacter();
      
      if (!currentCharacter) {
        console.error('Brak aktywnej postaci');
        setSessions([]);
        return;
      }

      const response = await fetch(`/api/privateSessions?characterId=${currentCharacter.id}`, { 
        method: 'GET', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const data = await response.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch { 
      setSessions([]); 
    } finally { 
      setLoadingList(false); 
    }
  };

  const fetchArchivedSessions = async () => {
    try {
      setLoadingArchive(true); 
      setErrorArchive('');
      const currentCharacter = getCurrentCharacter();
      
      if (!currentCharacter) {
        setErrorArchive('Brak aktywnej postaci');
        return;
      }

      const response = await fetch(`/api/privateSessions/archive?characterId=${currentCharacter.id}`, { 
        method: 'GET', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Błąd podczas pobierania archiwum sesji');
      setArchivedSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) {
      console.error('Error fetching archived sessions:', error);
      setErrorArchive(error.message || 'Wystąpił błąd podczas ładowania archiwum sesji');
      setArchivedSessions([]);
    } finally { 
      setLoadingArchive(false); 
    }
  };

  const fetchSessionData = async () => {
    // Zapamiętaj, dla której sesji jest to zapytanie - jeśli w międzyczasie
    // użytkownik przełączy się na inną sesję, odrzucamy spóźnioną odpowiedź
    const requestedSessionId = sessionId;
    try {
      setLoadingConv(true);
      const currentCharacter = getCurrentCharacter();

      if (!currentCharacter) {
        setErrorConv('Brak aktywnej postaci');
        return;
      }

      const response = await fetch(`/api/privateSessions/${requestedSessionId}?characterId=${currentCharacter.id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();

      if (requestedSessionId !== latestSessionIdRef.current) {
        return;
      }

      if (!response.ok) {
        setErrorConv(data.error || 'Błąd podczas ładowania sesji');
      } else {
        setSession(data.session);
        setParticipants(data.participants || []);
        setMessages(data.messages || []);
        if (!isArchiveView) await fetchSessions();
        // Oznacz sesję jako przeczytaną zaraz po wejściu
        if (data.session && !isArchiveView) await markSessionAsRead(data.session);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      if (requestedSessionId === latestSessionIdRef.current) setErrorConv(error.message);
    } finally {
      if (requestedSessionId === latestSessionIdRef.current) setLoadingConv(false);
    }
  };

  const markSessionAsRead = async (sessionData) => {
    const currentCharacter = getCurrentCharacter();
    if (!sessionData?.id || !currentCharacter?.id) return;
    try {
      const response = await fetch(`/api/privateSessions/${sessionData.id}/seen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ characterId: currentCharacter.id, seenAt: sessionData.last_activity })
      });
      if (response.ok) {
        // marked=false: postać nie jest uczestnikiem tej sesji (np. właściciel
        // sesji narratorskiej) - nic nie zostało oznaczone, więc nie ma po co
        // przeładowywać listy ani ruszać powiadomień w Sidebarze.
        const data = await response.json().catch(() => ({}));
        if (data.marked === false) return;
        await fetchSessions();
        // Powiadom Sidebar o aktualizacji powiadomień
        window.dispatchEvent(new CustomEvent('privateSessionsUpdated'));
      }
    } catch (e) {
      console.error('❌ Błąd oznaczania sesji jako przeczytanej:', e);
    }
  };

  const handleReopenSession = async (sessionId) => {
    try {
      setReopening(true);
      const response = await fetch(`/api/privateSessions/${sessionId}/reopen`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Błąd podczas przywracania sesji'); }
      setArchivedSessions(prev => prev.filter(s => s.id !== sessionId));
      setReopenDialog({ open: false, session: null }); setErrorArchive('');
    } catch (error) {
      console.error('Error reopening session:', error);
      setErrorArchive(error.message || 'Wystąpił błąd podczas przywracania sesji');
    } finally { setReopening(false); }
  };

  const openReopenDialog = (session) => setReopenDialog({ open: true, session });
  const closeReopenDialog = () => setReopenDialog({ open: false, session: null });

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
        additionalInfo: additionalInfo || null
      };
      
      if (currentCharacter) {
        const allIds = [currentCharacter.id, ...selectedCharacterIds];
        requestBody.participantCharacterIds = [...new Set(allIds)];
      } else {
        requestBody.participantCharacterIds = [...new Set(selectedCharacterIds)];
      }

      const response = await fetch('/api/privateSessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
          const msgResponse = await fetch(`/api/privateSessions/${data.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              message: hasFirstMessageText ? processStarText(firstMessage) : '',
              characterId: isNarratorMode ? null : currentCharacter?.id,
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

      if (firstMessageFailed) {
        // Sesja powstała, ale pierwsza wiadomość nie wysłała się - nie czyścimy
        // jej treści ani rzutów, żeby użytkownik mógł je wysłać ponownie w nowej
        // sesji (rzuty kasowały się tu wcześniej bezwarunkowo, więc przepadały).
        setErrorCreate('Sesja została utworzona, ale nie udało się wysłać pierwszej wiadomości. Spróbuj wysłać ją ponownie w sesji.');
      } else {
        setFirstMessage('');
        setErrorCreate('');
        setPendingDiceRolls([]);
        if (firstMsgEditor) firstMsgEditor.commands.clearContent();
      }

      navigate(`/home/privateSessions/${data.id}`);
      await fetchSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      setErrorCreate('Wystąpił błąd przy tworzeniu sesji.');
    }
  };

  const sendMessage = async () => {
    // Sam rzut kostką (bez tekstu) to pełnoprawna wiadomość - patrz editorContent.js.
    const hasText = !isEditorContentEmpty(newMessage);
    if (!hasText && pendingDiceRolls.length === 0) return;
    if (session && session.closed) return;

    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter && !isNarratorMode) { alert('Brak aktywnej postaci i tryb narratora wyłączony!'); return; }
    
    try {
      const response = await fetch(`/api/privateSessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: hasText ? processStarText(newMessage) : '',
          characterId: isNarratorMode ? null : currentCharacter?.id,
          isNarrator: isNarratorMode,
          diceRolls: pendingDiceRolls.length > 0 ? pendingDiceRolls : undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data]); setNewMessage(''); setIsNarratorMode(false); setPendingDiceRolls([]);
        if (newMsgEditor) newMsgEditor.commands.clearContent();
        if (!isArchiveView) await fetchSessions();

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: keyboardVisible ? 'end' : 'nearest' });
        }, keyboardVisible ? 300 : 100);
      } else {
        const errorData = await response.json();
        console.error('Błąd wysyłania wiadomości:', errorData);
        alert(`Błąd wysyłania wiadomości: ${errorData.error || 'Nieznany błąd'}`);
      }
    } catch (error) { 
      console.error('Error sending message:', error);
      alert('Wystąpił błąd sieci podczas wysyłania wiadomości.');
    }
  };

  const startEditMessage = (msg) => {
    setEditMsgId(msg.id); setEditMsgValue(msg.message);
    if (editMsgEditor) editMsgEditor.commands.setContent(msg.message);
    setTimeout(() => {
      const editElement = document.querySelector(`[data-message-id="${msg.id}"]`);
      if (editElement) editElement.scrollIntoView({ behavior: 'smooth', block: keyboardVisible ? 'start' : 'center' });
    }, keyboardVisible ? 200 : 100);
  };

  const saveEditMessage = async (msg) => {
    try {
      const response = await fetch(`/api/privateSessions/${sessionId}/messages/${msg.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: editMsgValue })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, message: data.message, edited_at: data.edited_at } : m));
        setEditMsgId(null); setEditMsgValue('');
        if (editMsgEditor) editMsgEditor.commands.clearContent();
        if (!isArchiveView) await fetchSessions();

        setTimeout(() => {
          const updatedElement = document.querySelector(`[data-message-id="${msg.id}"]`);
          if (updatedElement) updatedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      } else { alert('Błąd podczas edycji wiadomości!'); }
    } catch (e) {
      console.error('Error editing message:', e);
      alert('Błąd podczas edycji wiadomości!');
    }
  };

  const cancelEditMessage = () => {
    setEditMsgId(null); setEditMsgValue('');
    if (editMsgEditor) editMsgEditor.commands.clearContent();
  };

  const closeSession = async () => {
    setCloseError('');
    const currentCharacter = getCurrentCharacter();
    
    if (!currentCharacter) {
      setCloseError('Brak aktywnej postaci');
      return;
    }

    try {
      const response = await fetch(`/api/privateSessions/${sessionId}/close`, { 
        method: 'PATCH', 
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ characterId: currentCharacter.id })
      });
      
      if (response.ok) {
        await fetchSessionData();
        if (!isArchiveView) await fetchSessions();
      } else {
        const data = await response.json();
        setCloseError(data.error || 'Błąd podczas zamykania sesji.');
      }
    } catch { 
      setCloseError('Błąd sieci podczas zamykania sesji.'); 
    }
  };

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

  const newMsgEditor = useEditor({ extensions, content: newMessage, editable: !(session?.closed), onUpdate: ({ editor }) => setNewMessage(editor.getHTML()) }, [session]);
  const editMsgEditor = useEditor({ extensions, content: editMsgValue, onUpdate: ({ editor }) => setEditMsgValue(editor.getHTML()) }, [editMsgId]);
  const firstMsgEditor = useEditor({ extensions, content: firstMessage, onUpdate: ({ editor }) => setFirstMessage(editor.getHTML()) });

  // Rozwinięcie edytora z paska "Napisz wiadomość..." od razu ustawia kursor.
  const expandEditorAndFocus = useCallback(() => {
    setIsEditorCollapsed(false);
    setTimeout(() => { newMsgEditor?.commands?.focus(); }, 60);
  }, [newMsgEditor]);

  useEffect(() => {
    if (isArchiveView) fetchArchivedSessions(); else fetchSessions();
    if (isViewingSession) fetchSessionData();
  }, [sessionId, isCreatingSession, isArchiveView]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, keyboardVisible ? 200 : (isResizing ? 100 : 0));
    return () => clearTimeout(timer);
  }, [messages, editorHeight, isResizing, keyboardVisible, viewportHeight]);

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

  useEffect(() => {
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) {
      setUnreadSessionIds([]);
      return;
    }
    
    const unreadIds = sessions.filter(s => {
      if (!s.is_participant) return false;
      if (!s.seen_at) return true;
      const lastActivity = new Date(s.last_activity || 0).getTime();
      const seenAt = new Date(s.seen_at).getTime();
      return lastActivity > seenAt;
    }).map(s => s.id);
    
    setUnreadSessionIds(unreadIds);
  }, [sessions]);

  useEffect(() => {
    if (messages.length > 0 && totalPages > 0) { setCurrentPage(totalPages); }
  }, [messages.length, totalPages]);

  useEffect(() => {
    // Stan widocznego obszaru należy teraz do wspólnego hooka - zostaje samo
    // czyszczenie stylów body.
    const handleComponentCleanup = () => {
      document.body.style.overflow = ''; document.body.style.overflowY = ''; document.body.style.height = '';
      document.body.style.position = ''; document.body.style.width = '';
    };
    return handleComponentCleanup;
  }, []);

  // DIALOGI
  const renderSessionInfoDialog = () => {
    if (!showSessionInfoDialog || !session) return null;

    const isOwner = session.owner_id === userId;
    const hasAnyInfo = session.start_date || session.location || session.additional_info || session.my_note;

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
                  <Typography sx={{ color: theme.palette.text.secondary }}>
                    {formatDateOnly(session.start_date)}
                  </Typography>
                </Box>
              )}

              {session.location && (
                <Box>
                  <Typography variant="caption" sx={{ color:theme.palette.text.secondary, fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Lokalizacja:
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary }}>
                    {session.location}
                  </Typography>
                </Box>
              )}

              {session.additional_info && (
                <Box>
                  <Typography variant="caption" sx={{ color:theme.palette.text.secondary, fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Dodatkowe informacje:
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary, whiteSpace: 'pre-wrap' }}>
                    {session.additional_info}
                  </Typography>
                </Box>
              )}

              {session.my_note && (
                <Box>
                  <Typography variant="caption" sx={{ color:theme.palette.text.secondary, fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                    Twoja notatka:
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary, whiteSpace: 'pre-wrap' }}>
                    {session.my_note}
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
          Twoja notatka
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Twoja prywatna notatka do tej sesji - widoczna tylko dla Ciebie.
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={8}
              maxRows={15}
              label="Notatka"
              value={myNoteDraft}
              onChange={(e) => setMyNoteDraft(e.target.value)}
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
            disabled={savingMyNote}
          >
            Anuluj
          </Button>
          <Button
            onClick={handleSaveMyNote}
            variant="contained"
            disabled={savingMyNote}
            sx={{
              backgroundColor: theme.palette.secondary.main,
              '&:hover': { backgroundColor: theme.palette.primary.dark }
            }}
          >
            {savingMyNote ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderParticipantsDialog = () => {
    if (!showParticipantsDialog || !session) return null;

    const isOwner = session.owner_id === userId;

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
            Uczestnicy sesji ({participants.length})
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
          {participants.length === 0 ? (
            <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 3 }}>
              Brak uczestników w sesji
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {participants.map((participant) => (
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
                          color: theme.palette.text.secondary,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        {participant.character_name}
                        {participant.user_id === session.owner_id && (
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
      <Dialog open={showAddMembers} onClose={() => setShowAddMembers(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ color:theme.palette.text.secondary }}>
          <PersonAddIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Dodaj uczestników do sesji
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
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
    const removableParticipants = participants.filter(p => p.user_id !== session?.owner_id);

    return (
      <Dialog open={showRemoveMembers} onClose={() => setShowRemoveMembers(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ color:theme.palette.text.secondary }}>
          <PersonRemoveIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Usuń uczestników z sesji
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
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
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold' }}>
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
                <Typography variant="h6" sx={{ color: theme.palette.warning.light, fontWeight: 'bold' }}>
                  🎲 {roll.roll}{(Number(roll.modifier)||0) ? ` ${(Number(roll.modifier)||0) > 0 ? '+' : '−'}${Math.abs(Number(roll.modifier)||0)} = ${roll.total != null ? roll.total : (Number(roll.roll)+(Number(roll.modifier)||0))}` : ''}
                </Typography>
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

  const renderReopenDialog = () => (
    <Dialog open={reopenDialog.open} onClose={closeReopenDialog} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` } }}>
      <DialogTitle sx={{ color:theme.palette.text.secondary }}><LockOpenIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Przywróć sesję</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: theme.palette.text.secondary }}>Czy na pewno chcesz przywrócić sesję "<strong>{reopenDialog.session?.title}</strong>" do stanu aktywnego? Uczestnicy będą mogli ponownie dodawać wiadomości.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeReopenDialog} sx={{ color: theme.palette.text.secondary }} disabled={reopening}>Anuluj</Button>
        <Button onClick={() => handleReopenSession(reopenDialog.session?.id)} variant="contained" startIcon={<RestoreIcon />} disabled={reopening} sx={{ backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>
          {reopening ? 'Przywracanie...' : 'Przywróć sesję'}
        </Button>
      </DialogActions>
    </Dialog>
  );
// ARCHIVE VIEW
  if (isArchiveView) {
    return (
      <Box sx={{ flex: 1, width: '100%', px: 0, py: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        <Box sx={{
          px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: `1px solid ${appColors.borderSteel}`,
          bgcolor: `${appColors.bgDeep}cc`,
        }}>
          <IconButton size="small" onClick={() => navigate('/home/privateSessions')} sx={{
            color: appColors.steelLight,
            bgcolor: 'transparent',
            border: `1px solid ${appColors.borderSteel}`,
            borderRadius: '2px',
            '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel },
          }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography sx={{ color: appColors.textMuted, fontSize: '0.6rem', letterSpacing: '0.2em', }}>
              // BAZA DANYCH — ZAMKNIĘTE
            </Typography>
            <Typography variant="h4" sx={{
              color: appColors.textLight,
              
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: { xs: '1.2rem', sm: '1.6rem' },
            }}>
              Archiwum Sesji
            </Typography>
          </Box>
        </Box>

        {errorArchive && <Alert severity="error" sx={{ mb: 2, mx: 2 }}>{errorArchive}</Alert>}

        <Box sx={{
          p: 1.5, mb: 2, mx: 2, mt: 1.5,
          bgcolor: `${appColors.dangerBorder}10`,
          border: `1px solid ${appColors.dangerBorder}`,
          borderLeft: `3px solid ${appColors.dangerText}`,
          borderRadius: '2px',
        }}>
          <Typography variant="body2" sx={{ color: appColors.dangerText, mb: 0.5,  fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.08em' }}>
            <LockIcon sx={{ fontSize: 13, verticalAlign: 'middle', mr: 0.75 }} />
            ARCHIWUM SESJI ZAMKNIĘTYCH
          </Typography>
          <Typography variant="body2" sx={{ color: appColors.steelLight,  fontSize: '0.78rem' }}>
            Tutaj znajdziesz wszystkie zamknięte sesje prywatne. Właściciele mogą przywrócić je do stanu aktywnego.
          </Typography>
        </Box>
        
        {loadingArchive ? (
          <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 4, px: 2 }}>Ładowanie archiwum sesji...</Typography>
        ) : archivedSessions.length > 0 ? (
          <Box sx={{ flex: 1, overflow: 'auto', px: 2 }}>
            {archivedSessions.map((sess) => (
              <Box key={sess.id} {...cardOpenProps(() => navigate(`/home/privateSessions/${sess.id}`))} sx={{
                p: 2, mb: 1.5,
                border: `1px solid ${appColors.dangerBorder}`,
                borderLeft: `3px solid ${appColors.dangerText}`,
                borderRadius: '2px',
                bgcolor: `${appColors.dangerBorder}08`,
                position: 'relative',
                width: '100%',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                '&:hover': {
                  transform: 'translateX(3px)',
                  boxShadow: `0 0 16px ${appColors.dangerBorder}40`,
                  bgcolor: `${appColors.dangerBorder}14`,
                },
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <LockIcon sx={{ fontSize: 14, color: appColors.dangerText }} />
                  <Typography sx={{
                    color: appColors.textMuted,
                    textDecoration: 'line-through',
                    fontWeight: 600,
                    flex: 1,
                    
                    letterSpacing: '0.04em',
                    fontSize: '0.95rem',
                  }}>
                    {sess.title}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button onClick={() => navigate(`/home/privateSessions/${sess.id}`)} sx={{
                    color: appColors.steelLight,
                    border: `1px solid ${appColors.steel}`,
                    borderRadius: '2px',
                    bgcolor: 'transparent',
                    
                    letterSpacing: '0.08em',
                    fontSize: '0.78rem',
                    px: 2, py: 0.5,
                    '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steelLighter, color: appColors.textLight },
                  }}>
                    [ PRZEGLĄDAJ ]
                  </Button>
                  <SessionExportButton
                    type="private"
                    sessionId={sess.id}
                    gameName={gameName}
                    sx={{
                      color: appColors.steelLight,
                      border: `1px solid ${appColors.steel}`,
                      borderRadius: '2px',
                      bgcolor: 'transparent',
                      letterSpacing: '0.08em',
                      fontSize: '0.78rem',
                      px: 2, py: 0.5,
                      '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steelLighter, color: appColors.textLight },
                    }}
                  />
                  {sess.owner_id === userId && (
                    <Tooltip title="Przywróć sesję do stanu aktywnego">
                      <Button startIcon={<RestoreIcon />} onClick={() => openReopenDialog(sess)} sx={{
                        color: theme.palette.success.text,
                        border: `1px solid ${theme.palette.success.dark}`,
                        borderRadius: '2px',
                        bgcolor: 'transparent',
                        
                        letterSpacing: '0.08em',
                        fontSize: '0.78rem',
                        px: 2, py: 0.5,
                        '&:hover': { bgcolor: 'rgba(78,169,78,0.12)', borderColor: theme.palette.success.main },
                      }}>
                        [ PRZYWRÓĆ ]
                      </Button>
                    </Tooltip>
                  )}
                </Box>

                {sess.owner_id === userId && (
                  <Box sx={{ position: 'absolute', top: 8, right: 8, px: 1, py: 0.25, border: `1px solid ${theme.palette.primary.main}60`, borderRadius: '2px', bgcolor: `${theme.palette.primary.main}18` }}>
                    <Typography sx={{ color: theme.palette.primary.main, fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '0.15em', }}>
                      WŁAŚCICIEL
                    </Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <LockIcon sx={{ fontSize: 48, color: appColors.dangerBorder, mb: 2, opacity: 0.6 }} />
            <Typography sx={{ color: appColors.textMuted, fontSize: '0.7rem', letterSpacing: '0.2em', mb: 1, }}>
              // BRAK REKORDÓW
            </Typography>
            <Typography variant="h6" sx={{ color: appColors.steelLight, mb: 1,  letterSpacing: '0.08em' }}>
              ARCHIWUM PUSTE
            </Typography>
            <Typography variant="body2" sx={{ color: appColors.textMuted, }}>
              Nie masz jeszcze żadnych zamkniętych sesji prywatnych.
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // CREATE SESSION VIEW
  if (isCreatingSession) {
    const currentCharacter = getCurrentCharacter();

    return (
      <Box sx={{ height: isMobile ? '100%' : `${containerHeight}px`, minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%', px: 0, py: 0, overflow: 'hidden' }}>
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

        <Box sx={{
          px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: `1px solid ${appColors.borderSteel}`,
          bgcolor: `${appColors.bgDeep}cc`,
        }}>
          <IconButton size="small" onClick={() => navigate('/home/privateSessions')} sx={{
            color: appColors.steelLight,
            bgcolor: 'transparent',
            border: `1px solid ${appColors.borderSteel}`,
            borderRadius: '2px',
            '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel },
          }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography sx={{ color: appColors.textMuted, fontSize: '0.6rem', letterSpacing: '0.2em', }}>
              // INICJUJ PROTOKÓŁ
            </Typography>
            <Typography variant="h5" sx={{
              color: appColors.textLight,
              
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '1.1rem',
            }}>
              Nowa sesja prywatna
            </Typography>
          </Box>
        </Box>

        <Box sx={{ px: 2, py: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <TextField label="Tytuł sesji" fullWidth value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} sx={{ mb: 2, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor:theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color:theme.palette.text.secondary } }} />

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


          <Box sx={{
            mb: 2,
            border: `1px solid ${appColors.borderSteel}`,
            borderRadius: '2px',
            p: 1.5,
            pt: 2,
            position: 'relative',
            '&::before': {
              content: '"UCZESTNICY"',
              position: 'absolute',
              top: -9,
              left: 10,
              bgcolor: theme.palette.background.default,
              color: appColors.textMuted,
              fontSize: '0.6rem',
              letterSpacing: '0.2em',
              px: 0.75,
              
            },
          }}>
            <Typography variant="body2" sx={{ color: appColors.steelLight, mb: 1,  fontSize: '0.8rem' }}>Dodaj uczestników po ID postaci (opcjonalnie):</Typography>
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

  // SESSION VIEW
  if (isViewingSession && session) {
    const currentCharacter = getCurrentCharacter();
    
    return (
      <>
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

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: 'rgba(13, 15, 14, 0.3)', width: '100%', maxWidth: '100%', px: 0, mx: 0, overflow: 'hidden' }}>
          {closeError && <Alert severity="error" sx={{ px: 2, mt: 1, mb: 0.5, mx: { xs: 1, sm: 0 } }}>{closeError}</Alert>}

          {!!session.closed && (
            <Alert severity="warning" sx={{ mx: { xs: 1, sm: 2 }, mt: 1, mb: 0 }}>
              <LockIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Ta sesja została zamknięta – nie można już dodawać wiadomości.
            </Alert>
          )}

          <Box sx={{
            px: { xs: 1, sm: 2 },
            py: 1,
            // Na telefonie z klawiaturą pasek znika - te ~50 px to przy widocznym
            // obszarze ~380 px około dwóch dodatkowych linii czytanej treści.
            display: hideChromeForKeyboard ? 'none' : 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
            borderBottom: `1px solid ${appColors.borderSteel}`,
            bgcolor: `${appColors.bgDeep}cc`,
            backdropFilter: 'blur(4px)',
          }}>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
              <Tooltip title="Powrót do listy sesji">
                <IconButton size="small" onClick={() => navigate('/home/privateSessions')} sx={{
                  color: appColors.steelLight,
                  bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`,
                  borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Pokaż uczestników sesji">
                <IconButton size="small" onClick={() => setShowParticipantsDialog(true)} sx={{
                  color: appColors.steelLight,
                  bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`,
                  borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <GroupIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Twoja notatka">
                <IconButton size="small" onClick={openOwnerNotesDialog} sx={{
                  color: appColors.steelLight,
                  bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`,
                  borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <DescriptionIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Informacje o sesji">
                <IconButton size="small" onClick={openSessionInfoDialog} sx={{
                  color: appColors.steelLight,
                  bgcolor: 'transparent',
                  border: `1px solid ${appColors.borderSteel}`,
                  borderRadius: '2px',
                  '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
                }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Session title in center */}
            <Typography sx={{
              flex: 1,
              textAlign: 'center',
              color: appColors.textPrimary,
              
              fontSize: { xs: '0.8rem', sm: '0.95rem' },
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              px: 1,
            }}>
              {session.title}
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {session.owner_id === userId && !session.closed && (
                <Tooltip title="Zamknij sesję (tylko właściciel)">
                  <IconButton size="small" onClick={closeSession} sx={{
                    color: appColors.dangerText,
                    bgcolor: 'transparent',
                    border: `1px solid ${appColors.dangerBorder}`,
                    borderRadius: '2px',
                    '&:hover': { bgcolor: `${appColors.dangerBorder}30`, borderColor: appColors.dangerText },
                  }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Czytanie bierze CAŁE miejsce po edytorze (flex:1). Dawna proporcja
              7:2 i tak nie działała - przebijały ją minimalne wysokości edytora. */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: isMobile ? 1 : 2, py: 1, width: '100%', minHeight: 0, ...(isMobile && { pb: 1 }), ...(hideChromeForKeyboard && { px: 0.5, py: 0.5, pb: 0.5 }) }}>
            {currentMessages.map((msg, index) => (
              <Box
                key={msg.id || index}
                data-message-id={msg.id}
                sx={{
                  // Odstępy między postami: na telefonie ciasne, na desktopie
                  // lekko ścieśnione względem dawnych 1.5 - sam ozdobnik z
                  // marginesami kosztował 38 px na każdy post.
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
                }}>
                  {/* Avatar / narrator - duży, po lewej; dłuższy tekst wchodzi pod niego (float) */}
                  {/* Na telefonie avatar 120 px zabierał ponad jedną trzecią
                      wiersza; 72 px daje ~35% więcej tekstu w linii. */}
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
                  {msg.author_id === userId && (
                    <IconButton size="small" onClick={() => startEditMessage(msg)} sx={{ float: 'right', color: theme.palette.text.secondary, p: 0.5 }}>
                      <EditNoteTwoToneIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Typography variant="body2" component="div" sx={{
  fontWeight: 'bold',
  color: msg.character_type === 'narrator' ? theme.palette.error.main : theme.palette.primary.main,
  display: 'block',
  fontSize: { xs: '1rem', sm: '1.4rem' },
  lineHeight: { xs: 1.3, sm: 1.5 }
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
  ) : msg.character_name ? (
    // USUNIĘTO " - {gracz}" - teraz tylko imię postaci
    renderCharacterWithTooltip(
      msg.character_name,
      msg.character_id,
      msg.author_name,
      msg.author_id,
      msg.character_avatar,
      msg.character_race,
      msg.character_gender,
      msg.character_faction
    )
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
                        <Button variant="contained" size="small" onClick={() => saveEditMessage(msg)} sx={{ backgroundColor: theme.palette.secondary.main, mr: 1 }}>Zapisz</Button>
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

          {!(session.closed) && (
            <Box sx={{
              borderTop: `2px solid ${theme.palette.primary.main}60`,
              px: 0,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              // Konkretna wysokość zamiast proporcji - na mobile regulowana
              // uchwytem, bo dawne flex 1/2/3 i tak przegrywało z min-heightami.
              flex: '0 0 auto',
              height: isEditorCollapsed ? 'auto' : `${editorHeight}px`,
              position: 'relative',
              bgcolor: `${appColors.bgDeep}88`,
              pt: isEditorCollapsed ? 0 : 0.5,
            }}>

              {isEditorCollapsed ? (
                <EditorCollapsedBar
                  onExpand={expandEditorAndFocus}
                  accentColor={theme.palette.primary.main}
                />
              ) : (
                <>
                  {/* Uchwyt zmiany wysokości + zwijanie w jednym wierszu. Wcześniej
                      resizeHandleProps nie był podpięty nigdzie, a przycisk
                      zwijania był ukryty akurat na mobile. */}
                  <EditorResizeHandle
                    resizeHandleProps={resizeHandleProps}
                    isResizing={isResizing}
                    onCollapse={() => setIsEditorCollapsed(true)}
                    accentColor={theme.palette.primary.main}
                    compact={isMobile}
                  />
                  <Box ref={editorContainerRef} sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, flex: 1, width: '100%', minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', '& .ProseMirror': { outline: 'none', color: theme.palette.text.primary, caretColor: theme.palette.primary.main, width: '100%', px: 1, backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important', '&:focus': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' }, '&:focus-visible': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' } }, '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' } }}>
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
                      <Typography variant="h6" sx={{ color: theme.palette.warning.light, fontWeight: 'bold' }}>
                        🎲 {roll.roll}{(Number(roll.modifier)||0) ? ` ${(Number(roll.modifier)||0) > 0 ? '+' : '−'}${Math.abs(Number(roll.modifier)||0)} = ${roll.total != null ? roll.total : (Number(roll.roll)+(Number(roll.modifier)||0))}` : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        (K{roll.sides})
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem', fontStyle: 'italic', display: 'block', mt: 1 }}>
                  Widzisz wyniki swoich rzutów przed wysłaniem wiadomości
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

  // MAIN LIST VIEW
  return (
    <Box sx={{ flex: 1, width: '100%', px: 0, py: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          Sesje Prywatne
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
          onClick={() => navigate('/home/privateSessions/new')}
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
          [ + NOWA SESJA ]
        </Button>
        <Button
          onClick={() => navigate('/home/privateSessions/archive')}
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
        {loadingList ? (
          <Typography sx={{color: theme.palette.text.secondary, textAlign: 'center', py: 4 }}>
            Ładowanie...
          </Typography>
        ) : sessions.length > 0 ? (
          sessions.map((s) => {
            const isUnread = !!(s.is_participant && unreadSessionIds.includes(s.id));
            return (
<Box
  key={s.id}
  // Klik w dowolne miejsce karty otwiera sesję (przyciski działają jak dotąd).
  {...cardOpenProps(() => navigate(`/home/privateSessions/${s.id}`))}
  sx={{
    p: 1.5,
    mb: 1.5,
    // Ozdobna ramka rasowa (border-image) wokół sesji - rogi ostre, boki się skalują.
    borderStyle: 'solid',
    borderWidth: '18px 22px',
    borderImage: `url(/ui/session/${raceFrame}.png) 56 62 stretch`,
    // Bez czarnego tła - tylko subtelna tinta w kolorze rasy; hover mocniejszy.
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
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
    {isUnread && (
      <Tooltip title="Nowa wiadomość w tej sesji!">
        <Box sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          bgcolor: `${appColors.dangerText}20`,
          border: `1px solid ${appColors.dangerText}`,
          borderRadius: '2px',
          mr: 0.5,
        }}>
          <Box sx={{
            width: 6, height: 6,
            borderRadius: '50%',
            bgcolor: appColors.dangerText,
            boxShadow: `0 0 6px ${appColors.dangerText}`,
            animation: 'unreadPulse 1.5s ease-in-out infinite',
          }} />
          <Typography sx={{ color: appColors.dangerText, fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.1em', }}>
            NOWA
          </Typography>
        </Box>
      </Tooltip>
    )}
    <Typography
      sx={{
        color: s.closed ? appColors.steel : appColors.textLight,
        textDecoration: s.closed ? 'line-through' : 'none',
        fontWeight: 700,
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        
        letterSpacing: '0.05em',
        fontSize: '1.3rem',
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
      }}
    >
      {s.title}
    </Typography>
    {s.closed ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, border: `1px solid ${appColors.dangerBorder}`, borderRadius: '2px', bgcolor: `${appColors.dangerBorder}18` }}>
        <LockIcon sx={{ fontSize: 12, color: appColors.dangerText }} />
        <Typography sx={{ color: appColors.dangerText, fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.1em', }}>
          ZAMKNIĘTA
        </Typography>
      </Box>
    ) : (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: theme.palette.success.main, boxShadow: `0 0 6px ${theme.palette.success.main}`, animation: 'activeDot 2s ease-in-out infinite' }} />
        <Typography sx={{ color: theme.palette.success.text, fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.12em', }}>
          AKTYWNA
        </Typography>
      </Box>
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

  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
    <Button
      onClick={() => navigate(`/home/privateSessions/${s.id}`)}
      sx={{
        color: race.accent,
        border: `1px solid ${race.border}`,
        borderRadius: '2px',
        bgcolor: 'transparent',
        
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        fontSize: '0.92rem',
        px: 2,
        py: 0.5,
        '&:hover': {
          bgcolor: `${race.hex}2e`,
          borderColor: race.hex,
          color: race.accent,
        },
      }}
    >
      [ OTWÓRZ ]
    </Button>
    <SessionExportButton
      type="private"
      sessionId={s.id}
      gameName={gameName}
      sx={{
        color: appColors.steelLight,
        border: `1px solid ${appColors.steel}`,
        borderRadius: '2px',
        bgcolor: 'transparent',
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        fontSize: '0.82rem',
        px: 2,
        py: 0.5,
        '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steelLighter, color: appColors.textLight },
      }}
    />
  </Box>

  {s.owner_id === userId && (
    <Box sx={{
      position: 'absolute',
      top: 8,
      right: 8,
      px: 1,
      py: 0.25,
      border: `1px solid ${theme.palette.primary.main}60`,
      borderRadius: '2px',
      bgcolor: `${theme.palette.primary.main}18`,
    }}>
      <Typography sx={{
        color: theme.palette.primary.main,
        fontSize: '0.6rem',
        fontWeight: 'bold',
        letterSpacing: '0.15em',
        
      }}>
        WŁAŚCICIEL
      </Typography>
    </Box>
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
              Nie masz jeszcze żadnych sesji prywatnych.
            </Typography>
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
                    <Typography variant="h6" sx={{ color: theme.palette.warning.light, fontWeight: 'bold' }}>
                      🎲 {roll.roll}{(Number(roll.modifier)||0) ? ` ${(Number(roll.modifier)||0) > 0 ? '+' : '−'}${Math.abs(Number(roll.modifier)||0)} = ${roll.total != null ? roll.total : (Number(roll.roll)+(Number(roll.modifier)||0))}` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      (K{roll.sides})
                    </Typography>
                  </Box>
                </Box>
              ))}
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.75rem', fontStyle: 'italic', display: 'block', mt: 1 }}>
                Widzisz wyniki swoich rzutów przed wysłaniem wiadomości
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
    </Box>
  );
}

export default PrivateSessions;
