// TAVERN FRONTEND - LOBBY-BASED SYSTEM WITH CHARACTER DISPLAY & DICE ROLLS
// CZĘŚĆ 1/6: Imports, Extensions, Helper Functions

import React, { useEffect, useState, useRef, useCallback } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  Tooltip,
  Popover,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  TextField,
  Chip,
  Pagination,
  Avatar,
  Link,
} from '@mui/material';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Italic from '@tiptap/extension-italic';
import { StarColorExtension, processStarText, disableMarkdownPasteRules } from './starText';
import { useTheme } from '@mui/material/styles';
import useKeyboardViewport, { keyboardSafeDialogProps } from './useKeyboardViewport';
import parseDiceRolls from './diceRolls';
import isEditorContentEmpty from './editorContent';
import useResizableEditor from './useResizableEditor';
import useEditorCollapsed from './useEditorCollapsed';
import EditorResizeHandle from './EditorResizeHandle';
import EditorCollapsedBar from './EditorCollapsedBar';
import ToolbarOverflow from './ToolbarOverflow';
import { CHAT_EDITOR_MOBILE, CHAT_EDITOR_DESKTOP, CHAT_PROSEMIRROR_MIN } from './theme';
import { appColors, readingSurfaceSx } from './theme';
import CharacterHoverCard from './CharacterHoverCard';
import NarratorAvatar, { NarratorMark } from './NarratorAvatar';
import SendIcon from '@mui/icons-material/Send';
import { Person, Close, Room, Casino as CasinoIcon, People as PeopleIcon, RemoveCircle as KickIcon, Edit as EditNoteTwoToneIcon } from '@mui/icons-material';
import { decodeJwtPayload, getUserRole, getCurrentCharacter } from './AuthContext';

// Wariant grafiki dividera (rozdzielacz postów) wg rasy biezacej postaci.
const currentDividerFrame = () => {
  const cc = getCurrentCharacter();
  const s = `${cc?.characterFaction || ''} ${cc?.characterRace || ''}`.toLowerCase();
  if (/wampir|vampire|vamp/.test(s)) return 'vampire';
  if (/wilko|wilk|wolf|lykan|lycan/.test(s)) return 'wolf';
  return 'human';
};
import CharacterCardPopup from './CharacterCardPopup';
import useResponsive from './useResponsive';

// TipTap Extensions
// Podgląd i konwersja *gwiazdek* siedzą we wspólnym module (./starText) - te
// same reguły obowiązują w Karczmie, Sesjach i Wiadomościach.

const LimitedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'max-width:100%;height:auto;',
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          return {
            style: `max-width:100%;height:auto;${attributes.style || ''}`
          };
        }
      }
    };
  }
});

// Paleta kolorow tekstu RP (do wyboru przez gracza w edytorze) - z zalozenia
// wielobarwna, wiec NIE podlega motywowi/rasie (to zestaw opcji, nie akcent UI).
const colors = [
  '#0f0f0f', '#f0f0f0', '#a0522d', '#8b0000', '#556b2f',
  '#483d8b', '#6b7280', '#2f4f4f', '#800080', '#cd853f'
];

// LOBBY-BASED Helper Functions
const getCharacterAvatar = (character) => {
  if (!character) return null; 
  if (character.avatar || character.character_avatar) return `/api${character.avatar || character.character_avatar}`; 
  return null; 
};



// POPRAWIONA FUNKCJA: Renderowanie postaci z tooltipem (bez username w linku)
const renderCharacterWithTooltip = (characterName, characterId, authorName, authorId, avatar, navigate, theme, race, gender, faction, getRaceName) => {
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
          raceName={getRaceName ? getRaceName(faction) : (faction || '-')}
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
          color: 'inherit',
          textDecoration: 'none',
          fontWeight: 'inherit',
          fontSize: 'inherit',
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          '&:hover': {
            textDecoration: 'underline',
            color: theme.palette.text.secondary
          }
        }}
      >
        {characterName}
      </Link>
    </Tooltip>
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

// CZĘŚĆ 2/6: Hooks i Viewport Management

const EditorToolbar = ({
  editor,
  isMobile,
  anchorTextColor, setAnchorTextColor,
  anchorBgColor, setAnchorBgColor,
  isNarratorMode, setIsNarratorMode,
  editorId,
  onSend,
  canSend = false,
  onLeaveTavern,
  currentRoom,
  showRoomSelector, setShowRoomSelector,
  isInTavern,
  onDiceRoll,
  isEditMode = false
}) => {
  const theme = useTheme();

  const uniqueId = editorId || `editor-${Math.random().toString(36).substr(2, 9)}`;

  const [anchorAlign, setAnchorAlign] = React.useState(null);
  const [anchorImage, setAnchorImage] = React.useState(null);
  const [diceDialogOpen, setDiceDialogOpen] = React.useState(false);
  const [diceDescription, setDiceDescription] = React.useState('');
  const [diceSides, setDiceSides] = React.useState(20);
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

  const handleDiceRoll = () => {
    const roll = Math.floor(Math.random() * diceSides) + 1;
    if (onDiceRoll) {
      onDiceRoll(roll, diceDescription, diceSides);
    }
    setDiceDescription('');
    setDiceDialogOpen(false);
  };

  return (
    <>
      <Stack direction="row" spacing={0.2} mb={0} flexWrap="nowrap" alignItems="center" sx={{
        userSelect: 'none', overflowX: 'auto', width: '100%',
        '&::-webkit-scrollbar': { height: '4px' },
        '&::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.1)' },
        '&::-webkit-scrollbar-thumb': { background: theme.palette.divider, borderRadius: '2px' }
      }}>

        {/* Przycisk wysyłania */}
        <Tooltip title={isNarratorMode ? 'Wyślij jako Narrator' : 'Wyślij wiadomość'} arrow>
          <Button
            variant="contained"
            onClick={onSend}
            disabled={!canSend}
            sx={{
              backgroundColor: isNarratorMode ? theme.palette.error.main : theme.palette.divider,
              color: theme.palette.text.primary,
              '&:hover': { backgroundColor: isNarratorMode ? theme.palette.error.main : theme.palette.primary.main },
              '&:disabled': {
                backgroundColor: 'rgba(154, 119, 40, 0.3)',
                color: 'rgba(255, 255, 255, 0.3)'
              },
              minWidth: isMobile ? 36 : 44,
              minHeight: 36,
              maxHeight: 36,
              mr: 1,
              px: isMobile ? 0.5 : 1,
              fontSize: isMobile ? '0.7rem' : '0.75rem',
              fontWeight: 'bold'
            }}
          >
            <SendIcon sx={{ fontSize: isMobile ? 12 : 14 }} />
            {!isMobile && (
              <span style={{ fontSize: '0.75rem' }}>
                {isNarratorMode ? 'Nar' : 'Wyślij'}
              </span>
            )}
          </Button>
        </Tooltip>

        {/* Wyjście z karczmy (tylko mobile, na desktopie jest w sidebarze) */}
        {onLeaveTavern && isMobile && (
          <Tooltip title="Wyjdź z karczmy" arrow>
            <IconButton
              onClick={onLeaveTavern}
              size="small"
              sx={{
                color: theme.palette.error.text,
                backgroundColor: 'rgba(204, 0, 68, 0.1)',
                '&:hover': { backgroundColor: 'rgba(204, 0, 68, 0.2)' },
                minWidth: 36,
                minHeight: 36,
                mx: 0.3,
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Formatting buttons */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa"><i>I</i></ToolbarButton>
        {/* Na mobile formatowanie chowa się pod "..." - w karczmie pasek jest
            najciaśniejszy, bo trzyma dodatkowo wyjście z karczmy i zmianę
            pokoju (na desktopie te dwie rzeczy są w sidebarze). Na desktopie
            ToolbarOverflow renderuje dzieci w miejscu, więc nic się nie zmienia. */}
        <ToolbarOverflow isMobile={isMobile} accentColor={theme.palette.divider}>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie"><u>U</u></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorBgColor(e.currentTarget)} active={false} label="Kolor tła"><span style={{ backgroundColor: theme.palette.text.secondary, padding: '0 4px' }}>A</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorTextColor(e.currentTarget)} active={false} label="Kolor tekstu"><span style={{ color: theme.palette.text.secondary }}>A</span></ToolbarButton>
          <ToolbarButton onClick={() => { editor.chain().focus().unsetColor().run(); editor.chain().focus().unsetHighlight().run(); }} active={!editor.isActive('textStyle') && !editor.isActive('highlight')} label="Usuń kolory"><span style={{ color: theme.palette.text.primary }}>X</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorAlign(e.currentTarget)} active={false} label="Wyrównanie tekstu">
            <span style={{ fontSize: '16px' }}>≡</span>
          </ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorImage(e.currentTarget)} active={false} label="Obrazek">🖼</ToolbarButton>
        </ToolbarOverflow>

        {/* Rzut kostką */}
        {onDiceRoll && !isEditMode && (
          <ToolbarButton onClick={() => setDiceDialogOpen(true)} label={`Rzut kostką K${diceSides}`}>
            <CasinoIcon sx={{ fontSize: 18 }} />
          </ToolbarButton>
        )}
        
        {/* Room selector - gdy w karczmie (tylko mobile, na desktopie jest w sidebarze) */}
        {isInTavern && setShowRoomSelector && isMobile && (
          <ToolbarButton
            onClick={() => setShowRoomSelector(true)}
            active={false}
            label={`Aktualny pokój: ${currentRoom?.name || 'Wybierz pokój'}`}
          >
            <Room />
          </ToolbarButton>
        )}
        
        {/* Narrator mode */}
        {setIsNarratorMode && !isEditMode && (
          <ToolbarButton 
            onClick={() => setIsNarratorMode(!isNarratorMode)} 
            active={isNarratorMode}
            label={isNarratorMode ? 'Wyłącz tryb narratora' : 'Tryb narratora'}
          >
            <NarratorMark />
          </ToolbarButton>
        )}
      </Stack>

      {/* Dialog rzutu kostką */}
      <Dialog open={diceDialogOpen} onClose={() => setDiceDialogOpen(false)} PaperProps={{ sx: { backgroundColor: 'rgba(18, 18, 18, 0.98)', color: theme.palette.text.primary, border: `1px solid ${theme.palette.text.secondary}` } }}>
        <DialogTitle sx={{ color: theme.palette.text.secondary }}>
          <CasinoIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Rzut kostką K{diceSides}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="number"
            label="Liczba ścianek kostki"
            value={diceSides}
            onChange={(e) => setDiceSides(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1 }}
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.default,
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
            label="Opis rzutu (opcjonalnie)"
            value={diceDescription}
            onChange={(e) => setDiceDescription(e.target.value)}
            placeholder="np. Rzut na percepcję"
            sx={{
              mt: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.default,
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiceDialogOpen(false)} sx={{ color: theme.palette.text.primary }}>Anuluj</Button>
          <Button 
            onClick={handleDiceRoll} 
            variant="contained" 
            startIcon={<CasinoIcon />} 
            sx={{ backgroundColor: theme.palette.divider, '&:hover': { backgroundColor: theme.palette.primary.main } }}
          >
            Rzuć kostką
          </Button>
        </DialogActions>
      </Dialog>

      {/* Popover wyrównania z grafiką */}
      <Popover 
        open={Boolean(anchorAlign)} 
        anchorEl={anchorAlign} 
        onClose={() => setAnchorAlign(null)} 
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} 
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
          <Tooltip title="Do lewej" arrow>
            <Button 
              onClick={() => { editor.chain().focus().setTextAlign('left').run(); setAnchorAlign(null); }} 
              sx={{ 
                minWidth: 36, 
                height: 36, 
                p: 0, 
                border: `1px solid ${theme.palette.divider}`, 
                bgcolor: editor.isActive({ textAlign: 'left' }) ? theme.palette.divider : 'transparent' 
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '16px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '18px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title="Wyśrodkuj" arrow>
            <Button 
              onClick={() => { editor.chain().focus().setTextAlign('center').run(); setAnchorAlign(null); }} 
              sx={{ 
                minWidth: 36, 
                height: 36, 
                p: 0, 
                border: `1px solid ${theme.palette.divider}`, 
                bgcolor: editor.isActive({ textAlign: 'center' }) ? theme.palette.divider : 'transparent' 
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '14px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '18px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title="Do prawej" arrow>
            <Button 
              onClick={() => { editor.chain().focus().setTextAlign('right').run(); setAnchorAlign(null); }} 
              sx={{ 
                minWidth: 36, 
                height: 36, 
                p: 0, 
                border: `1px solid ${theme.palette.divider}`, 
                bgcolor: editor.isActive({ textAlign: 'right' }) ? theme.palette.divider : 'transparent' 
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '16px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '18px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title="Wyjustuj" arrow>
            <Button 
              onClick={() => { editor.chain().focus().setTextAlign('justify').run(); setAnchorAlign(null); }} 
              sx={{ 
                minWidth: 36, 
                height: 36, 
                p: 0, 
                border: `1px solid ${theme.palette.divider}`, 
                bgcolor: editor.isActive({ textAlign: 'justify' }) ? theme.palette.divider : 'transparent' 
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '2px' }}>
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
                <Box sx={{ width: '20px', height: '2px', bgcolor: 'currentColor' }} />
              </Box>
            </Button>
          </Tooltip>
        </Stack>
      </Popover>

      {/* Color popovers */}
      <Popover 
        open={Boolean(anchorTextColor)} 
        anchorEl={anchorTextColor} 
        onClose={() => setAnchorTextColor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} 
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
          {colors.map(color => (
            <Button 
              key={`text-${color}-${uniqueId}`}
              onClick={() => { 
                editor.chain().focus().setColor(color).run(); 
                setAnchorTextColor(null); 
              }}
              sx={{
                bgcolor: color, border: `1px solid ${theme.palette.divider}`, width: 24, height: 24,
                minWidth: 24, p: 0, '&:hover': { opacity: 0.8 }
              }}
            />
          ))}
          <Button onClick={() => { editor.chain().focus().unsetColor().run(); setAnchorTextColor(null); }} variant="outlined">
            Reset
          </Button>
        </Stack>
      </Popover>

      <Popover 
        open={Boolean(anchorBgColor)} 
        anchorEl={anchorBgColor} 
        onClose={() => setAnchorBgColor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }} 
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
          {colors.map(color => (
            <Button 
              key={`bg-${color}-${uniqueId}`}
              onClick={() => { 
                editor.chain().focus().setHighlight({ color }).run(); 
                setAnchorBgColor(null); 
              }}
              sx={{
                bgcolor: color, border: `1px solid ${theme.palette.divider}`, width: 24, height: 24,
                minWidth: 24, p: 0, '&:hover': { opacity: 0.8 }
              }}
            />
          ))}
          <Button onClick={() => { editor.chain().focus().unsetHighlight().run(); setAnchorBgColor(null); }} variant="outlined">
            Reset
          </Button>
        </Stack>
      </Popover>

      {/* Popover obrazka */}
      <Popover
        open={Boolean(anchorImage)}
        anchorEl={anchorImage}
        onClose={() => setAnchorImage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Stack direction="column" spacing={1} sx={{ p: 1 }}>
          <Button onClick={handleImageUrl} variant="outlined" sx={{ justifyContent: 'flex-start' }}>📎 URL obrazka</Button>
          <Button onClick={handleImageUpload} variant="outlined" sx={{ justifyContent: 'flex-start' }}>📁 Upload z urządzenia</Button>
        </Stack>
      </Popover>
    </>
  );
};

// CZĘŚĆ 3/6: Main Tavern Component i State Management
// [Cała reszta kodu bez zmian - tylko zmiana w renderze headera pokoju]

const Tavern = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // PODSTAWOWE STANY
  const [messages, setMessages] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  // Lista ras do mapowania klucza (np. "RASA_3") na czytelną nazwę w tooltipie
  const [races, setRaces] = useState([]);
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);
  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';
  const [editingMessageContent, setEditingMessageContent] = useState('');
  const [isInTavern, setIsInTavern] = useState(false);
  const ws = useRef(null);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);
  const editorContainerRef = useRef(null);
  // Refy z aktualnym stanem - handlery WebSocketa (onclose/onmessage) tworzone są
  // raz przy połączeniu i inaczej widziałyby zamrożone wartości z tamtego renderu.
  const isInTavernRef = useRef(false);
  const currentRoomRef = useRef(null);
  const currentPageRef = useRef(1);
  const reconnectTimerRef = useRef(null);

  // Viewport i mobile handling - wspólny hook (patrz useKeyboardViewport.js).
  // Pełny obiekt zostaje pod ręką dla keyboardSafeDialogProps (potrzebuje też offsetTop).
  const keyboardViewport = useKeyboardViewport();
  const { viewportHeight, keyboardVisible } = keyboardViewport;
  const { isSmall: isMobile } = useResponsive(); // wspólny próg z powłoką (1050px)

  // POKOJE I INTERFEJS
  const [availableRooms, setAvailableRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [showEnterDialog, setShowEnterDialog] = useState(false);
  const [selectedRoomForEntry, setSelectedRoomForEntry] = useState(null);

  // Paginacja
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const messagesPerPage = 30;

  // Edytor states
  const [anchorTextColor, setAnchorTextColor] = useState(null);
  const [anchorBgColor, setAnchorBgColor] = useState(null);
  const [message, setMessage] = useState('');
  const [isNarratorMode, setIsNarratorMode] = useState(false);
  const [editMsgAnchorTextColor, setEditMsgAnchorTextColor] = useState(null);
  const [editMsgAnchorBgColor, setEditMsgAnchorBgColor] = useState(null);

  const [pendingDiceRolls, setPendingDiceRolls] = useState([]);
  const [dicePopupOpen, setDicePopupOpen] = useState(false);
  const [selectedDiceRolls, setSelectedDiceRolls] = useState(null);
  const [pendingDicePopupOpen, setPendingDicePopupOpen] = useState(false);

  // User data
  const token = localStorage.getItem('token');
  const payload = decodeJwtPayload(token);
  const userId = payload?.id;

  // Loading states
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);

  // Participants and Character Card
  const [participants, setParticipants] = useState([]);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState(false);
  const [showCharacterCardPopup, setShowCharacterCardPopup] = useState(false);
  const [selectedCharacterForCard, setSelectedCharacterForCard] = useState(null);

  // Kick/Ban system states
  const [showKickDialog, setShowKickDialog] = useState(false);
  const [kickTargetParticipant, setKickTargetParticipant] = useState(null);
  const [kickReason, setKickReason] = useState('');
  const [kickDuration, setKickDuration] = useState(30); // domyślnie 30 minut
  const [isKicking, setIsKicking] = useState(false);
  const userRole = getUserRole();

  // KALKULACJE WYSOKOŚCI
  // viewportHeight z hooka to realny WIDOCZNY obszar (przy klawiaturze już
  // pomniejszony), więc nie trzeba tego rozgałęziać jak wcześniej.
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

  // Zwinięcie edytora jest ZAPAMIĘTYWANE (osobno dla mobile i desktopu), więc
  // wybór gracza przeżywa przejście na inną sesję - wcześniej komponent montował
  // się od nowa i edytor znów się rozwijał. Domyślnie: mobile zwinięty,
  // desktop rozwinięty.
  const [isEditorCollapsed, setIsEditorCollapsed] = useEditorCollapsed(isMobile);

  const proseMirrorMin = isMobile
    ? (keyboardVisible ? CHAT_PROSEMIRROR_MIN.mobileWithKeyboard : CHAT_PROSEMIRROR_MIN.mobile)
    : CHAT_PROSEMIRROR_MIN.desktop;

  // Na telefonie z klawiaturą chowamy pasek z nazwą pokoju.
  const hideChromeForKeyboard = isMobile && keyboardVisible;

  // Hook zwraca wysokość już przyciętą do min/max; uchwyt przeciągania jest
  // podpięty niżej (wcześniej resizeHandleProps nie trafiał na żaden element,
  // więc regulacji wysokości edytora w ogóle nie dało się użyć).
  const { editorHeight, isResizing, resizeHandleProps } = useResizableEditor(editorLimits);

  const handleDiceRoll = (roll, description, sides) => {
    setPendingDiceRolls(prev => [...prev, { roll, description, sides }]);
  };

  // Load pending dice rolls from localStorage
  useEffect(() => {
    if (currentRoom?.id) {
      const storageKey = `tavern_pendingDiceRolls_${currentRoom.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setPendingDiceRolls(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse pending dice rolls:', e);
        }
      }
    }
  }, [currentRoom?.id]);

  // Save pending dice rolls to localStorage
  useEffect(() => {
    if (currentRoom?.id) {
      const storageKey = `tavern_pendingDiceRolls_${currentRoom.id}`;
      if (pendingDiceRolls.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(pendingDiceRolls));
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }, [pendingDiceRolls, currentRoom?.id]);

  // TipTap editor initialization
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, orderedList: false, italic: false }),
      BulletList.extend({ addInputRules() { return []; } }),
      OrderedList.extend({ addInputRules() { return []; } }),
    Italic.extend(disableMarkdownPasteRules),
      Underline, TextStyle, Color, Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LimitedImage.configure({ inline: false, allowBase64: true }),
      StarColorExtension
    ],
    content: message,
    editable: isInTavern,
    onUpdate: ({ editor }) => setMessage(editor.getHTML()),
  }, [isInTavern]);

  // Rozwinięcie edytora z paska "Napisz wiadomość..." od razu ustawia kursor -
  // inaczej gracz musiałby dotknąć dwa razy.
  const expandEditorAndFocus = useCallback(() => {
    setIsEditorCollapsed(false);
    setTimeout(() => { editor?.commands?.focus(); }, 60);
  }, [editor]);

  // TipTap editor for editing messages
  const editMsgEditor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, orderedList: false, italic: false }),
      BulletList.extend({ addInputRules() { return []; } }),
      OrderedList.extend({ addInputRules() { return []; } }),
    Italic.extend(disableMarkdownPasteRules),
      Underline, TextStyle, Color, Highlight,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LimitedImage.configure({ inline: false, allowBase64: true }),
      StarColorExtension
    ],
    content: editingMessageContent,
    onUpdate: ({ editor }) => setEditingMessageContent(editor.getHTML()),
  }, [editingMessageId]);

  useEffect(() => { isInTavernRef.current = isInTavern; }, [isInTavern]);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // Zamknięcie zamierzone: kod 1000 + odpięty onclose, żeby nie wystartował
  // automatyczny reconnect po wyjściu z karczmy albo zmianie pokoju.
  const closeSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close(1000);
      ws.current = null;
    }
  }, []);

  // Czy gracz "siedzi na dole" listy postów. Jeśli przewinął wyżej, żeby coś
  // doczytać, doładowanie nowego posta w tle nie ma mu skakać po ekranie.
  const isChatNearBottom = useCallback(() => {
    const el = chatWindowRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  // [Pozostałe useEffects - bez zmian]
  useEffect(() => {
    if (!isChatNearBottom()) return undefined;

    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }, keyboardVisible ? 200 : (isResizing ? 100 : 0));

    return () => clearTimeout(timer);
  }, [messages, editorHeight, isResizing, keyboardVisible, viewportHeight, isChatNearBottom]);

  useEffect(() => {
    const handleComponentCleanup = () => {
      closeSocket();
      document.body.style.overflow = '';
      document.body.style.overflowY = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
    return handleComponentCleanup;
  }, [closeSocket]);

  // Auto-scroll edytora do widoku gdy użytkownik kliknie w niego na mobile
  useEffect(() => {
    if (!isMobile || !editorContainerRef.current) return;

    const handleEditorFocus = () => {
      setTimeout(() => {
        if (editorContainerRef.current) {
          editorContainerRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 500); // Opóźnienie na wyświetlenie klawiatury
    };

    const proseMirror = editorContainerRef.current.querySelector('.ProseMirror');
    if (proseMirror) {
      proseMirror.addEventListener('focus', handleEditorFocus);
      return () => {
        proseMirror.removeEventListener('focus', handleEditorFocus);
      };
    }
  }, [isMobile, isInTavern]);

  const getPaginatedMessages = () => {
    const startIndex = (currentPage - 1) * messagesPerPage;
    const endIndex = startIndex + messagesPerPage;
    return allMessages.slice(startIndex, endIndex);
  };

  useEffect(() => {
    setMessages(getPaginatedMessages());
  }, [allMessages, currentPage]);

  useEffect(() => {
    const pages = Math.ceil(allMessages.length / messagesPerPage);
    setTotalPages(pages);
  }, [allMessages]);

  // Auto-markowanie wiadomości tavern jako przeczytane po 2 sekundach
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !isInTavern || !currentRoom) return;

    const markTavernAsSeen = async () => {
      try {
        await fetch('/api/tavern/mark-seen', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        // Powiadom Home.js o aktualizacji powiadomień
        window.dispatchEvent(new CustomEvent('tavernUpdated'));
      } catch (error) {
        console.error('Błąd oznaczania wiadomości tavern jako przeczytane:', error);
      }
    };

    const timer = setTimeout(markTavernAsSeen, 2000);
    return () => clearTimeout(timer);
  }, [isInTavern, currentRoom]);

  const handlePageChange = (event, page) => {
    setCurrentPage(page);
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = 0;
    }
  };

  const goToLastPage = () => {
    if (totalPages > 0) {
      setCurrentPage(totalPages);
      setTimeout(() => {
        if (chatWindowRef.current) {
          chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const cleanupDuplicateMessages = useCallback(() => {
    setAllMessages(prev => {
      const seen = new Set();
      const cleaned = prev.filter(msg => {
        if (msg.isTemp) {
          const hasRealVersion = prev.some(otherMsg => 
            !otherMsg.isTemp && 
            otherMsg.message === msg.message && 
            otherMsg.user_id === msg.user_id &&
            Math.abs(new Date(otherMsg.created_at).getTime() - new Date(msg.created_at).getTime()) < 10000
          );
          if (hasRealVersion) return false;
        }
        
        const key = `${msg.id}-${msg.message}-${msg.user_id}-${msg.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      return cleaned.length !== prev.length ? cleaned : prev;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(cleanupDuplicateMessages, 5000);
    return () => clearInterval(interval);
  }, [cleanupDuplicateMessages]);

  // Ciche dociąganie nowych postów w tle - dokłada wyłącznie te wiadomości,
  // których jeszcze nie ma na liście. WebSocket bywa zrywany (uśpiona karta,
  // sieć komórkowa, proxy) i wtedy nowe posty nie docierały aż do odświeżenia
  // strony. To nie przeładowuje widoku - rusza tylko okno z postami.
  const syncNewMessages = useCallback(async () => {
    const roomId = currentRoomRef.current?.id;
    if (!token || !roomId || !isInTavernRef.current) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      const response = await fetch(
        `/api/tavern/rooms/${roomId}/messages?page=1&limit=${messagesPerPage}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return;

      const data = await response.json();
      const fetched = data.messages || [];
      // Pokój mógł się zmienić w trakcie żądania - nie mieszaj wiadomości.
      if (!fetched.length || currentRoomRef.current?.id !== roomId) return;

      setAllMessages((prev) => {
        const knownIds = new Set(prev.filter((m) => !m.isTemp).map((m) => m.id));
        const missing = fetched.filter((m) => !knownIds.has(m.id));
        if (!missing.length) return prev;

        // Własny post wysłany optymistycznie (isTemp) zastępujemy wersją z bazy.
        const withoutTemps = prev.filter((m) => !m.isTemp || !missing.some(
          (f) => f.user_id === m.user_id && f.message === m.message
        ));

        const merged = [...withoutTemps, ...missing].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        // Przeskakujemy na ostatnią stronę tylko wtedy, gdy gracz i tak na niej
        // był - inaczej przeglądanie starszych postów byłoby przerywane.
        const prevPages = Math.max(1, Math.ceil(prev.length / messagesPerPage));
        const nextPages = Math.max(1, Math.ceil(merged.length / messagesPerPage));
        if (currentPageRef.current >= prevPages && nextPages !== prevPages) {
          setCurrentPage(nextPages);
        }

        return merged;
      });
    } catch {
      // cicha porażka - kolejna próba za chwilę
    }
  }, [token]);

  useEffect(() => {
    if (!isInTavern) return undefined;
    const interval = setInterval(syncNewMessages, 8000);
    return () => clearInterval(interval);
  }, [isInTavern, syncNewMessages]);

  // Powrót do karty / odzyskanie sieci: dociągnij posty i odbuduj WebSocket,
  // jeśli w międzyczasie padł.
  useEffect(() => {
    if (!isInTavern) return undefined;

    const resume = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      syncNewMessages();
      const socket = ws.current;
      if (!socket || socket.readyState === 2 || socket.readyState === 3) {
        connectWebSocket(currentRoomRef.current?.id);
      }
    };

    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);

    return () => {
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInTavern, syncNewMessages]);

  // [API Functions - bez zmian]
  const fetchAvailableRooms = async () => {
    try {
      const response = await fetch('/api/tavern/rooms', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Błąd pobierania pokojów:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter || !currentCharacter.id) {
        return;
      }

      const response = await fetch(`/api/tavern/participants?characterId=${currentCharacter.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || []);
      } else {
        console.error('Błąd pobierania uczestników:', response.status);
      }
    } catch (error) {
      console.error('Błąd pobierania uczestników:', error);
    }
  };

  // Helper: sprawdza czy użytkownik może wyrzucać graczy
  const canKickUsers = () => {
    return ['admin', 'mistrz_gry', 'karczmarz'].includes(userRole);
  };

  // Helper: sprawdza czy użytkownik może widzieć wyniki rzutów przed wysłaniem
  const canViewDiceResults = () => {
    return ['admin', 'mistrz_gry', 'karczmarz'].includes(userRole);
  };

  // Obsługa wyrzucania gracza z karczmy
  const handleKickUser = async () => {
    if (!kickTargetParticipant || !kickReason.trim() || kickDuration < 1) {
      setErrorMessage('Podaj przyczynę i czas blokady');
      return;
    }

    setIsKicking(true);
    try {
      const response = await fetch('/api/tavern/kick-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          characterId: kickTargetParticipant.character_id,
          reason: kickReason.trim(),
          banDurationMinutes: parseInt(kickDuration)
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Sukces - zamknij dialogi i odśwież uczestników
        setShowKickDialog(false);
        setKickTargetParticipant(null);
        setKickReason('');
        setKickDuration(30);
        fetchParticipants();
        setErrorMessage('');
      } else {
        setErrorMessage(data.error || 'Błąd wyrzucania gracza');
      }
    } catch (error) {
      console.error('Błąd wyrzucania gracza:', error);
      setErrorMessage('Błąd połączenia z serwerem');
    } finally {
      setIsKicking(false);
    }
  };

  // Otwórz dialog wyrzucania
  const openKickDialog = (participant) => {
    setKickTargetParticipant(participant);
    setKickReason('');
    setKickDuration(30);
    setShowKickDialog(true);
  };

  const checkTavernStatus = async () => {
    try {
      const savedStatus = localStorage.getItem('tavernStatus');
      
      if (savedStatus === 'true') {
        const response = await fetch('/api/tavern/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isInTavern) {
            setIsInTavern(true);
            
            const savedRoom = localStorage.getItem('currentRoom');
            if (savedRoom) {
              try {
                const roomData = JSON.parse(savedRoom);
                setCurrentRoom(roomData);
                
                setTimeout(async () => {
                  connectWebSocket(roomData.id);
                  
                  setTimeout(async () => {
                    await fetchMessages(1, roomData.id);
                    setTimeout(goToLastPage, 500);
                  }, 1000);
                }, 200);
                return;
              } catch (e) {
                console.error('Błąd parsowania zapisanego pokoju:', e);
                localStorage.removeItem('currentRoom');
              }
            }
            
            if (data.room && data.room.id) {
              setCurrentRoom(data.room);
              localStorage.setItem('currentRoom', JSON.stringify(data.room));
              
              setTimeout(async () => {
                connectWebSocket(data.room.id);
                setTimeout(async () => {
                  await fetchMessages(1, data.room.id);
                  setTimeout(goToLastPage, 500);
                }, 1000);
              }, 200);
            } else {
              await fetchAvailableRooms();
              setShowRoomSelector(true);
            }
          } else {
            localStorage.removeItem('tavernStatus');
            localStorage.removeItem('currentRoom');
            setIsInTavern(false);
            setCurrentRoom(null);
          }
        } else {
          console.error('Błąd odpowiedzi API:', response.status);
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('tavernStatus');
            localStorage.removeItem('currentRoom');
            setIsInTavern(false);
          }
        }
      }
    } catch (error) {
      console.error('Błąd sprawdzania statusu karczmy:', error);
      const savedStatus = localStorage.getItem('tavernStatus');
      const savedRoom = localStorage.getItem('currentRoom');
      
      if (savedStatus === 'true' && savedRoom) {
        try {
          const roomData = JSON.parse(savedRoom);
          setIsInTavern(true);
          setCurrentRoom(roomData);
          
          setTimeout(() => {
            connectWebSocket(roomData.id);
          }, 1000);
        } catch (e) {
          console.error('Błąd przywracania lokalnego stanu:', e);
        }
      }
    }
  };

  const fetchMessages = async (page = 1, roomId = null) => {
    try {
      if (!token) return;

      const roomParam = roomId || currentRoom?.id || 1;
      const response = await fetch(`/api/tavern/rooms/${roomParam}/messages?page=${page}&limit=${messagesPerPage}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        if (page === 1) {
          setAllMessages(data.messages || []);
          setCurrentPage(1);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      }
    } catch {
      // silent fail
    }
  };

  const enterTavern = async (roomId) => {
    try {
      // Sprawdź czy użytkownik ma aktywny ban
      const banCheckResponse = await fetch('/api/tavern/check-ban', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (banCheckResponse.ok) {
        const banData = await banCheckResponse.json();
        if (banData.isBanned) {
          const expiresAt = new Date(banData.expiresAt);
          const timeLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60));
          setErrorMessage(
            `Masz blokadę wejścia do karczmy!\n` +
            `Przyczyna: ${banData.reason}\n` +
            `Pozostały czas: ${timeLeft < 60 ? timeLeft + ' minut' : Math.ceil(timeLeft / 60) + ' godzin'}`
          );
          return;
        }
      }

      const response = await fetch('/api/tavern/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowEnterDialog(false);
        setSelectedRoomForEntry(null);
        
        localStorage.setItem('tavernStatus', 'true');
        setIsInTavern(true);
        
        if (roomId) {
          await enterRoom(roomId);
        }
      }
    } catch (error) {
      console.error('Błąd wejścia do karczmy:', error);
    }
  };

  const enterRoom = async (roomId) => {
    if (isLoadingRoom) return;
    
    setIsLoadingRoom(true);
    setErrorMessage('');
    
    try {
      const response = await fetch(`/api/tavern/rooms/${roomId}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Nie udało się wejść do pokoju');
        setIsLoadingRoom(false);
        return;
      }
      
      closeSocket();
      
      setMessages([]);
      setAllMessages([]);
      setCurrentPage(1);
      setTotalPages(1);
      setCurrentRoom(data.room);
      
      localStorage.setItem('currentRoom', JSON.stringify(data.room));
      setShowRoomSelector(false);
      
      setTimeout(async () => {
        connectWebSocket(roomId);
        setTimeout(async () => {
          await fetchMessages(1, roomId);
          setIsLoadingRoom(false);
        }, 500);
      }, 200);
      
    } catch (error) {
      console.error('Błąd wejścia do pokoju:', error);
      setErrorMessage('Wystąpił błąd połączenia. Spróbuj ponownie.');
      setIsLoadingRoom(false);
    }
  };

  const leaveTavern = async () => {
    try {
      const response = await fetch('/api/tavern/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      closeSocket();
      
      setIsInTavern(false);
      setCurrentRoom(null);
      setIsNarratorMode(false);
      setMessages([]);
      setAllMessages([]);
      setErrorMessage('');
      
      localStorage.removeItem('tavernStatus');
      localStorage.removeItem('currentRoom');

      if (!response.ok) {
        console.error('Błąd odpowiedzi serwera przy wyjściu:', response.status);
      }
      
    } catch (error) {
      console.error('Błąd wyjścia z karczmy:', error);
      closeSocket();
      setIsInTavern(false);
      setCurrentRoom(null);
      setIsNarratorMode(false);
      localStorage.removeItem('tavernStatus');
      localStorage.removeItem('currentRoom');
    }
  };

  // Podmienia treść jednej wiadomości na liście. Używane w dwóch miejscach:
  // po własnej edycji (odpowiedź PATCH) i po ramce 'message_edited' z
  // WebSocketa, żeby edycja admina była widoczna u wszystkich w pokoju bez
  // odświeżania strony.
  const applyMessageEdit = useCallback((messageId, newContent, editedAt) => {
    const patch = (list) => list.map((m) =>
      m.id === messageId
        ? { ...m, message: newContent ?? m.message, edited_at: editedAt ?? m.edited_at }
        : m
    );
    setAllMessages(patch);
    setMessages(patch);
  }, []);

  const connectWebSocket = (roomId = null) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (ws.current) {
      // 1000 = zamknięcie zamierzone, żeby onclose nie odpalił reconnectu.
      ws.current.onclose = null;
      ws.current.close(1000);
      ws.current = null;
    }

    const roomParam = roomId || currentRoom?.id || 1;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/?room=${roomParam}`;
    
    ws.current = new window.WebSocket(wsUrl, token);

    ws.current.onopen = () => {
    };
    
    ws.current.onmessage = (event) => {
  try {
    const payload = JSON.parse(event.data);

    // Ramka sterująca poznaje się po polu `type` - zwykła wypowiedź z karczmy
    // nigdy go nie ma. Wcześniej stała tu BIAŁA lista dwóch typów, więc każdy
    // kolejny typ (np. 'message_edited') przelatywał dalej i lądował na liście
    // postów jako wypowiedź: treścią był cały obiekt (renderowany jako
    // "[object Object]"), bez autora ("Nieznany użytkownik") i bez daty.
    if (payload.type) {
      if (payload.type === 'message_edited' && payload.message?.id) {
        applyMessageEdit(payload.message.id, payload.message.message, payload.message.edited_at);
      }
      return;
    }

    const newMessage = payload;

    const targetRoomId = Number(currentRoomRef.current?.id || roomParam);
    if (newMessage.room_id && Number(newMessage.room_id) !== targetRoomId) {
      return;
    }
    
    setAllMessages((prev) => {
      // 🔥 Znajdź i ZASTĄP tempMessage zamiast dodawać nową
      const tempIndex = prev.findIndex(msg => 
        msg.isTemp && 
        msg.user_id === newMessage.user_id &&
        msg.message === newMessage.message &&
        Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000
      );
      
      if (tempIndex !== -1) {
        // Podmień tempMessage, zachowując avatar
        const tempMsg = prev[tempIndex];
        const updatedMessage = {
          ...newMessage,
          character_avatar: tempMsg.character_avatar || newMessage.character_avatar, // Zachowaj avatar
          character_name: tempMsg.character_name || newMessage.character_name, // Zachowaj nazwę
        };
        
        const newMessages = [...prev];
        newMessages[tempIndex] = updatedMessage;
        return newMessages;
      }
      
      // Sprawdź duplikaty (bez tempMessage). Jeśli obie wiadomości mają już
      // prawdziwe id z bazy, porównujemy WYŁĄCZNIE po id - dwie różne, ale
      // identyczne treścią wiadomości (np. dwukrotne "tak" w odstępie 2s)
      // nie mogą się nawzajem skasować. Heurystyka tekst+user+czas służy
      // tylko do dopasowania wiadomości, która nie ma jeszcze id (temp).
      const isDuplicate = prev.some(msg => {
        if (msg.id && newMessage.id) {
          return msg.id === newMessage.id;
        }
        if (msg.message === newMessage.message &&
            msg.user_id === newMessage.user_id &&
            msg.character_name === newMessage.character_name) {
          const timeDiff = Math.abs(
            new Date(msg.created_at).getTime() -
            new Date(newMessage.created_at).getTime()
          );
          if (timeDiff < 3000) return true;
        }
        return false;
      });
      
      if (isDuplicate) {
        return prev;
      }
      
      const newMessages = [...prev, newMessage];
      const newTotalPages = Math.ceil(newMessages.length / messagesPerPage);
      setTotalPages(newTotalPages);
      setCurrentPage(newTotalPages);
      
      return newMessages;
    });
    
  } catch (error) {
    console.error('Błąd parsowania wiadomości WebSocket:', error);
  }
};
    
    ws.current.onclose = (event) => {
      // 1000/1001 = zamknięcie zamierzone (zmiana pokoju, wyjście, unmount).
      if (event.code === 1000 || event.code === 1001) return;
      if (reconnectTimerRef.current) return;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        // Czytamy z refów, nie z domknięcia - inaczej po pierwszym zerwaniu
        // połączenia warunek widziałby isInTavern=false z chwili logowania
        // i karczma zostawała bez WebSocketa aż do odświeżenia strony.
        if (isInTavernRef.current) {
          connectWebSocket(currentRoomRef.current?.id || roomParam);
        }
      }, 3000);
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  // Funkcje obsługi edycji wiadomości
  const startEditMessage = (msg) => {
    setEditingMessageId(msg.id);
    setEditingMessageContent(msg.message);
    if (editMsgEditor) {
      editMsgEditor.commands.setContent(msg.message);
    }

    setTimeout(() => {
      const editElement = document.querySelector(`[data-message-id="${msg.id}"]`);
      if (editElement) {
        editElement.scrollIntoView({ behavior: 'smooth', block: keyboardVisible ? 'start' : 'center' });
      }
    }, keyboardVisible ? 200 : 100);
  };

  const saveEditMessage = async (msg) => {
    try {
      const response = await fetch(`/api/tavern/messages/${msg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: processStarText(editingMessageContent) })
      });

      if (response.ok) {
        // Zaktualizowana wiadomość siedzi w `data.data` - `data.message` to
        // komunikat statusu ("Wiadomość została zaktualizowana"), który do tej
        // pory wjeżdżał edytującemu w treść posta zamiast nowego tekstu.
        const data = await response.json();
        const updated = data.data || {};
        applyMessageEdit(msg.id, updated.message, updated.edited_at);
        setEditingMessageId(null);
        setEditingMessageContent('');
        if (editMsgEditor) {
          editMsgEditor.commands.clearContent();
        }

        setTimeout(() => {
          const updatedElement = document.querySelector(`[data-message-id="${msg.id}"]`);
          if (updatedElement) {
            updatedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100);
      } else {
        alert('Błąd podczas edycji wiadomości!');
      }
    } catch (e) {
      console.error('Error editing message:', e);
      alert('Błąd podczas edycji wiadomości!');
    }
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageContent('');
    if (editMsgEditor) {
      editMsgEditor.commands.clearContent();
    }
  };

  const sendMessage = async () => {
  // Sam rzut kostką (bez tekstu) to pełnoprawna wiadomość - zawartość edytora
  // sprawdzamy semantycznie, bo tiptap po skasowaniu tekstu oddaje '<p></p>'.
  const hasText = !isEditorContentEmpty(message);

  if (!token || !currentRoom) return;
  if (!hasText && pendingDiceRolls.length === 0) return;

  const currentCharacter = getCurrentCharacter();
  const messageToSend = hasText ? processStarText(message.trim()) : '';
  const wasNarratorMode = isNarratorMode;

  // Pobierz aktualną postać
  let characterName = 'Nieznany użytkownik';
  let characterAvatar = null;
  
  if (!wasNarratorMode && currentCharacter?.id) {
    try {
      const response = await fetch(`/api/characters/${currentCharacter.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        characterName = data.character?.name || currentCharacter.name || 'Postać';
        characterAvatar = data.character?.avatar || currentCharacter.avatar;
      } else {
        characterName = currentCharacter.name || 'Postać';
        characterAvatar = currentCharacter.avatar;
      }
    } catch (error) {
      console.error('Error fetching character:', error);
      characterName = currentCharacter.name || 'Postać';
      characterAvatar = currentCharacter.avatar;
    }
  }

  // tempMessage - rzuty kostką jako osobne pole (nie w HTML)
  const tempMessage = {
    id: `temp-${Date.now()}`,
    message: messageToSend,
    user_id: userId,
    character_name: wasNarratorMode ? 'Narrator' : characterName,
    character_type: wasNarratorMode ? 'narrator' : 'player',
    character_id: wasNarratorMode ? null : currentCharacter?.id,
    character_avatar: wasNarratorMode ? null : characterAvatar,
    created_at: new Date().toISOString(),
    room_id: currentRoom.id,
    isTemp: true,
    dice_rolls: pendingDiceRolls.length > 0 ? [...pendingDiceRolls] : null
  };

  setAllMessages(prev => {
    const newMessages = [...prev, tempMessage];
    const newTotalPages = Math.ceil(newMessages.length / messagesPerPage);
    setTotalPages(newTotalPages);
    setCurrentPage(newTotalPages);
    return newMessages;
  });

  setMessage('');
  if (editor) {
    editor.commands.clearContent();
  }
  setIsNarratorMode(false);
  setPendingDiceRolls([]); // Wyczyść rzuty TUTAJ

  setTimeout(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, 100);

  try {
    // Wyślij do backendu (wiadomość + dice rolls osobno)
    const response = await fetch('/api/tavern/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: messageToSend,
        isNarrator: wasNarratorMode,
        roomId: currentRoom.id,
        currentCharacter,
        diceRolls: pendingDiceRolls.length > 0 ? pendingDiceRolls : undefined
      }),
    });

    if (!response.ok) {
      console.error('Błąd wysyłania wiadomości:', response.status);
      setAllMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      // Przywróć rzuty w przypadku błędu
      setPendingDiceRolls(pendingDiceRolls);
    }
  } catch (error) {
    console.error('Błąd sieci przy wysyłaniu wiadomości:', error);
    setAllMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    // Przywróć rzuty w przypadku błędu
    setPendingDiceRolls(pendingDiceRolls);
  }
};

  useEffect(() => {
    fetchAvailableRooms();
    checkTavernStatus();
    
    const tavernStatus = localStorage.getItem('tavernStatus');
    if (tavernStatus !== 'true') {
      fetchMessages(1, 1);
    }
  }, []);

  useEffect(() => {
    if (currentPage === totalPages && isChatNearBottom()) {
      setTimeout(() => {
        if (chatWindowRef.current) {
          chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, currentPage, totalPages, isChatNearBottom]);

  // Event listeners dla przycisków sidebar (desktop)
  useEffect(() => {
    const handleShowRoomSelector = () => {
      setShowRoomSelector(true);
    };

    const handleLeaveTavern = () => {
      leaveTavern();
    };

    const handleShowParticipants = () => {
      fetchParticipants();
      setShowParticipantsDialog(true);
    };

    window.addEventListener('tavernShowRoomSelector', handleShowRoomSelector);
    window.addEventListener('tavernLeaveTavern', handleLeaveTavern);
    window.addEventListener('tavernShowParticipants', handleShowParticipants);

    return () => {
      window.removeEventListener('tavernShowRoomSelector', handleShowRoomSelector);
      window.removeEventListener('tavernLeaveTavern', handleLeaveTavern);
      window.removeEventListener('tavernShowParticipants', handleShowParticipants);
    };
  }, []);

  // [Dialogi - bez zmian]
  const renderEnterDialog = () => (
    <Dialog 
      open={showEnterDialog} 
      onClose={() => {
        if (!isLoadingRoom) {
          setShowEnterDialog(false);
          setErrorMessage('');
        }
      }} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{ sx: { backgroundColor: 'rgba(18, 18, 18, 0.98)', color: theme.palette.text.primary, border: `1px solid ${theme.palette.text.secondary}` } }}
    >
      <DialogTitle sx={{ color: theme.palette.text.secondary, textAlign: 'center', fontSize: '1.5rem' }}>
        Wejdź do karczmy
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        
        {errorMessage && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              backgroundColor: 'rgba(204, 0, 68, 0.2)', 
              color: theme.palette.error.light,
              '& .MuiAlert-icon': { color: theme.palette.error.light }
            }}
            onClose={() => setErrorMessage('')}
          >
            {errorMessage}
          </Alert>
        )}
        
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Room /> Wybierz pokój:
        </Typography>

        {availableRooms.length === 0 && !isLoadingRoom && (
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2, 
              backgroundColor: 'rgba(255, 170, 0, 0.2)', 
              color: theme.palette.primary.main,
              '& .MuiAlert-icon': { color: theme.palette.primary.main }
            }}
          >
            Brak dostępnych pokoi. Upewnij się, że masz aktywną postać z przypisaną rasą.
          </Alert>
        )}
        
        <Stack spacing={2}>
          {availableRooms.map(room => (
            <Button 
              key={room.id} 
              variant="outlined" 
              onClick={() => setSelectedRoomForEntry(room)}
              disabled={isLoadingRoom}
              sx={{ 
                justifyContent: 'flex-start', 
                color: selectedRoomForEntry?.id === room.id ? theme.palette.text.secondary : theme.palette.primary.main, 
                borderColor: selectedRoomForEntry?.id === room.id ? theme.palette.text.secondary : theme.palette.primary.main,
                backgroundColor: selectedRoomForEntry?.id === room.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                p: 2, 
                '&:hover': { backgroundColor: 'rgba(255, 255, 170, 0.1)' },
                '&:disabled': { opacity: 0.5 }
              }}
            >
              <Room sx={{ mr: 1 }} />
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="subtitle1">{room.name}</Typography>
                {room.description && (
                  <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.8rem' }}>
                    {room.description}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {room.active_users_count || 0} osób online
                </Typography>
              </Box>
            </Button>
          ))}
        </Stack>
        
        {isLoadingRoom && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Wchodzę do karczmy...
            </Typography>
          </Box>
        )}
        
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button 
          onClick={() => {
            setShowEnterDialog(false);
            setErrorMessage('');
          }} 
          disabled={isLoadingRoom}
          sx={{ color: theme.palette.text.primary }}
        >
          Anuluj
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {selectedRoomForEntry && (
            <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontStyle: 'italic' }}>
              → {selectedRoomForEntry.name}
            </Typography>
          )}
          
          <Button 
            onClick={() => { 
              if (selectedRoomForEntry) { 
                enterTavern(selectedRoomForEntry.id); 
              } 
            }}
            variant="contained" 
            disabled={!selectedRoomForEntry || isLoadingRoom} 
            sx={{ 
              backgroundColor: theme.palette.divider, 
              '&:hover': { backgroundColor: theme.palette.primary.main },
              '&:disabled': { backgroundColor: 'rgba(154, 119, 40, 0.3)' },
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {isLoadingRoom ? 'Ładowanie...' : 'Wejdź do karczmy'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );

  const renderRoomSelector = () => (
    <Dialog 
      open={showRoomSelector} 
      onClose={() => {
        if (!isLoadingRoom) {
          setShowRoomSelector(false);
          setErrorMessage('');
        }
      }} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{ sx: { backgroundColor: 'rgba(18, 18, 18, 0.98)', color: theme.palette.text.primary, border: `1px solid ${theme.palette.text.secondary}` } }}
    >
      <DialogTitle sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
        Zmień pokój
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        
        {errorMessage && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              backgroundColor: 'rgba(204, 0, 68, 0.2)', 
              color: theme.palette.error.light,
              '& .MuiAlert-icon': { color: theme.palette.error.light }
            }}
            onClose={() => setErrorMessage('')}
          >
            {errorMessage}
          </Alert>
        )}

        {availableRooms.length === 0 && !isLoadingRoom && (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 2, 
              backgroundColor: 'rgba(34, 77, 63, 0.3)', 
              color: theme.palette.text.secondary 
            }}
          >
            Brak dostępnych pokoi dla Twojej rasy
          </Alert>
        )}
        
        <Stack spacing={2} sx={{ mt: 1 }}>
          {availableRooms.map(room => (
            <Button 
              key={room.id} 
              variant="outlined" 
              onClick={() => enterRoom(room.id)}
              disabled={isLoadingRoom}
              sx={{ 
                justifyContent: 'flex-start', 
                color: currentRoom?.id === room.id ? theme.palette.text.secondary : theme.palette.primary.main, 
                borderColor: currentRoom?.id === room.id ? theme.palette.text.secondary : theme.palette.primary.main,
                backgroundColor: currentRoom?.id === room.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                p: 2, 
                '&:hover': { backgroundColor: 'rgba(255, 255, 170, 0.1)' },
                '&:disabled': { 
                  opacity: 0.5,
                  cursor: 'not-allowed'
                },
                position: 'relative'
              }}
            >
              <Room sx={{ mr: 1 }} />
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="subtitle1">{room.name}</Typography>
                {room.description && (
                  <Typography variant="body2" sx={{ opacity: 0.7, fontSize: '0.8rem' }}>
                    {room.description}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {room.active_users_count || 0} osób online
                </Typography>
              </Box>
              {currentRoom?.id === room.id && (
                <Chip 
                  label="Aktualny" 
                  size="small" 
                  sx={{ 
                    ml: 1,
                    backgroundColor: theme.palette.text.secondary,
                    color: theme.palette.primary.contrastText,
                    fontWeight: 'bold'
                  }} 
                />
              )}
            </Button>
          ))}
        </Stack>
        
        {isLoadingRoom && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Ładowanie pokoju...
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={() => {
            setShowRoomSelector(false);
            setErrorMessage('');
          }} 
          disabled={isLoadingRoom}
          sx={{ color: theme.palette.text.primary }}
        >
          Anuluj
        </Button>
      </DialogActions>
    </Dialog>
  );

  const openEnterDialog = async () => {
    await fetchAvailableRooms();
    setShowEnterDialog(true);
  };

  const renderParticipantsDialog = () => (
    <Dialog
      open={showParticipantsDialog}
      onClose={() => setShowParticipantsDialog(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'rgba(18, 18, 18, 0.98)',
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.text.secondary}`
        }
      }}
    >
      <DialogTitle sx={{ color: theme.palette.text.secondary, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <PeopleIcon />
          <Typography variant="h6">Uczestnicy pokoju</Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        {participants.length === 0 ? (
          <Typography sx={{ color: theme.palette.text.secondary, textAlign: 'center', py: 2 }}>
            Brak uczestników w tym pokoju
          </Typography>
        ) : (
          <Stack spacing={2}>
            {participants.map((participant) => (
              <Box
                key={participant.character_id || participant.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  backgroundColor: 'rgba(34, 77, 63, 0.2)',
                  borderRadius: 1,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    src={participant.avatar ? `/api${participant.avatar}` : null}
                    sx={{
                      width: 48,
                      height: 48,
                      bgcolor: theme.palette.text.secondary,
                      border: `2px solid ${theme.palette.divider}`
                    }}
                  >
                    {participant.character_name ? participant.character_name[0]?.toUpperCase() : 'U'}
                  </Avatar>

                  <Box>
                    <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                      {participant.character_name || participant.username}
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
                      Gracz: {participant.username} (#{participant.user_id || participant.id})
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {/* Przycisk KP - Karta Postaci */}
                  {participant.character_id && (
                    <Tooltip title="Karta Postaci">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedCharacterForCard({
                            id: participant.character_id,
                            name: participant.character_name,
                            avatar: participant.avatar ? `/api${participant.avatar}` : null
                          });
                          setShowCharacterCardPopup(true);
                        }}
                        sx={{
                          color: theme.palette.primary.main,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          '&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.8)'
                          },
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          minWidth: 32,
                          height: 32
                        }}
                      >
                        KP
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Przycisk wyrzucenia - tylko dla admin, mistrz_gry, karczmarz */}
                  {canKickUsers() && participant.character_id && getCurrentCharacter()?.id !== participant.character_id && (
                    <Tooltip title="Wyrzuć z karczmy">
                      <IconButton
                        size="small"
                        onClick={() => openKickDialog(participant)}
                        sx={{
                          color: theme.palette.error.text,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          '&:hover': {
                            backgroundColor: 'rgba(139, 0, 0, 0.4)'
                          },
                          minWidth: 32,
                          height: 32
                        }}
                      >
                        <KickIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={() => setShowParticipantsDialog(false)}
          sx={{ color: theme.palette.text.primary }}
        >
          Zamknij
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Dialog wyrzucania gracza z karczmy
  const renderKickDialog = () => (
    <Dialog
      open={showKickDialog}
      onClose={() => !isKicking && setShowKickDialog(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'rgba(18, 18, 18, 0.98)',
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.error.dark}`
        }
      }}
    >
      <DialogTitle sx={{ color: theme.palette.error.light, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <KickIcon />
          <Typography variant="h6">Wyrzuć gracza z karczmy</Typography>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 3 }}>
        {kickTargetParticipant && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(139, 0, 0, 0.1)', borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
            <Typography sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
              Wyrzucasz: {kickTargetParticipant.character_name}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Gracz: {kickTargetParticipant.username}
            </Typography>
          </Box>
        )}

        <Typography variant="body2" sx={{ color: theme.palette.warning.main, mb: 2 }}>
          Wyrzucenie gracza zablokuje mu wejście do karczmy dla CAŁEGO konta (wszystkich postaci) na podany czas.
        </Typography>

        <TextField
          label="Przyczyna wyrzucenia"
          fullWidth
          multiline
          rows={3}
          maxRows={8}
          value={kickReason}
          onChange={(e) => setKickReason(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              color: theme.palette.text.primary,
              '& fieldset': { borderColor: theme.palette.divider },
              '&:hover fieldset': { borderColor: theme.palette.text.secondary },
              '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
            },
            '& .MuiInputLabel-root': { color: theme.palette.text.secondary }
          }}
          placeholder="Podaj przyczynę wyrzucenia..."
        />

        <TextField
          label="Czas blokady (minuty)"
          type="number"
          fullWidth
          value={kickDuration}
          onChange={(e) => setKickDuration(Math.max(1, Math.min(10080, parseInt(e.target.value) || 1)))}
          inputProps={{ min: 1, max: 10080 }}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              color: theme.palette.text.primary,
              '& fieldset': { borderColor: theme.palette.divider },
              '&:hover fieldset': { borderColor: theme.palette.text.secondary },
              '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
            },
            '& .MuiInputLabel-root': { color: theme.palette.text.secondary }
          }}
          helperText={`${kickDuration < 60 ? kickDuration + ' minut' : Math.round(kickDuration / 60) + ' godzin'} (max 7 dni)`}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip label="15 min" onClick={() => setKickDuration(15)} size="small" sx={{ cursor: 'pointer' }} />
          <Chip label="30 min" onClick={() => setKickDuration(30)} size="small" sx={{ cursor: 'pointer' }} />
          <Chip label="1h" onClick={() => setKickDuration(60)} size="small" sx={{ cursor: 'pointer' }} />
          <Chip label="6h" onClick={() => setKickDuration(360)} size="small" sx={{ cursor: 'pointer' }} />
          <Chip label="24h" onClick={() => setKickDuration(1440)} size="small" sx={{ cursor: 'pointer' }} />
          <Chip label="7 dni" onClick={() => setKickDuration(10080)} size="small" sx={{ cursor: 'pointer' }} />
        </Box>

        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={() => setShowKickDialog(false)}
          disabled={isKicking}
          sx={{ color: theme.palette.text.primary }}
        >
          Anuluj
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleKickUser}
          disabled={isKicking || !kickReason.trim()}
          sx={{ fontWeight: 'bold' }}
        >
          {isKicking ? 'Wyrzucanie...' : 'Wyrzuć z karczmy'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (!editor) return null;

  // CZĘŚĆ 6/6: Main Render z POPRAWKAMI

  return (
    <Box sx={{
      flex: 1,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'rgba(13, 15, 14, 0.3)',
      overflow: 'hidden',
      position: 'relative',
      px: 0,
      py: 0
    }}>
      
      {!isInTavern && (
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1000 }}>
          <Button variant="contained" size="small" onClick={openEnterDialog}
            sx={{ 
              backgroundColor: theme.palette.divider, 
              backdropFilter: 'blur(10px)', 
              fontWeight: 'bold', 
              '&:hover': { backgroundColor: theme.palette.primary.main }, 
              color: theme.palette.text.primary 
            }}>
            Wejdź do karczmy
          </Button>
        </Box>
      )}

      {/* POPRAWIONY HEADER - tylko nazwa pokoju, bez opisu + przycisk uczestników */}
      {isInTavern && currentRoom && (
        <Box sx={{
          // Na telefonie z klawiaturą pasek z nazwą pokoju znika - nazwa pokoju
          // jest w tym momencie mniej potrzebna niż dwie linie czytanej treści.
          display: hideChromeForKeyboard ? 'none' : 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 1,
          px: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: 'rgba(34, 77, 63, 0.2)',
          flexShrink: 0
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <Room sx={{ mr: 1, color: theme.palette.text.secondary }} />
            <Typography variant="body1" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold' }}>
              {currentRoom.name}
            </Typography>
          </Box>

          <Tooltip title="Lista uczestników" arrow>
            <IconButton
              size="small"
              onClick={() => {
                fetchParticipants();
                setShowParticipantsDialog(true);
              }}
              sx={{
                color: theme.palette.text.secondary,
                backgroundColor: 'rgba(0,0,0,0.4)',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.6)' },
              }}
            >
              <PeopleIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {isInTavern && totalPages > 1 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          py: 1, 
          borderBottom: `1px solid ${theme.palette.divider}`, 
          backgroundColor: 'rgba(34, 77, 63, 0.2)', 
          flexShrink: 0 
        }}>
          <Pagination 
            count={totalPages} 
            page={currentPage} 
            onChange={handlePageChange} 
            color="primary" 
            size={isMobile ? "small" : "medium"}
            sx={{ 
              '& .MuiPaginationItem-root': { 
                color: theme.palette.text.secondary, 
                borderColor: theme.palette.text.secondary, 
                '&.Mui-selected': { backgroundColor: theme.palette.divider, color: theme.palette.text.primary }, 
                '&:hover': { backgroundColor: 'rgba(154, 119, 40, 0.1)' } 
              } 
            }} 
          />
        </Box>
      )}

      {/* ZAKTUALIZOWANY OBSZAR WIADOMOŚCI - wyświetlanie character_name */}
      <Box ref={chatWindowRef} sx={{
        // Czytanie bierze CAŁE miejsce po edytorze. Dawna proporcja 7:2 i tak
        // nie działała - przebijały ją minimalne wysokości edytora.
        flex: 1,
        overflowY: 'auto',
        px: isMobile ? 1 : 2,
        py: 1,
        pt: isInTavern ? 1 : 8,
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        minHeight: 0,
        ...(isMobile && { pb: 1 }),
        ...(hideChromeForKeyboard && { px: 0.5, py: 0.5, pb: 0.5 })
      }}>
        
        {!isInTavern && (
          <Alert severity="info" sx={{ 
            mb: 2, 
            backgroundColor: 'rgba(34, 77, 63, 0.6)', 
            color: theme.palette.text.primary, 
            '& .MuiAlert-icon': { color: theme.palette.text.secondary },
            opacity: 0.8
          }}>
            Przeglądasz wiadomości z karczmy. Wejdź do karczmy, aby móc pisać.
          </Alert>
        )}
        
        {messages.length > 0 ? (
          messages.map((msg, index) => (
            <Box key={msg.id || index} data-message-id={msg.id} sx={{
              // Ciaśniejsze odstępy między postami na telefonie - sam ozdobnik
              // z marginesami kosztował ~38 px na każdy post.
              mb: { xs: 0.75, sm: 1.15 },
              px: 0,
              width: '100%',
              opacity: msg.isTemp ? 0.7 : 1,
              '&::after': {
                content: '""',
                display: 'block',
                height: { xs: '10px', sm: '18px' },
                mt: { xs: 0.5, sm: 0.75 },
                backgroundImage: `url(/ui/dividers/bottom-${currentDividerFrame()}.png)`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: '100% 100%',
              },
            }}>
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
                {(userRole === 'admin' || userRole === 'mistrz_gry' || userRole === 'karczmarz') && (
                  <IconButton size="small" onClick={() => startEditMessage(msg)} sx={{ float: 'right', color: theme.palette.text.secondary, p: 0.5 }}>
                    <EditNoteTwoToneIcon fontSize="small" />
                  </IconButton>
                )}
                <Typography variant="body2" component="div" sx={{
                  fontWeight: 'bold',
                  display: 'block',
                  flexWrap: 'wrap',
                  color: msg.character_type === 'narrator' ? theme.palette.error.main : theme.palette.primary.main,
                  fontSize: { xs: '1rem', sm: '1.4rem' },
                  lineHeight: { xs: 1.3, sm: 1.5 }
                }}>
                  {msg.character_type === 'narrator' && <NarratorMark fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />}

                  <Box sx={{ color: msg.character_type === 'narrator' ? theme.palette.error.main : theme.palette.primary.main }}>
                    {msg.character_type === 'narrator' ? (
                      <>{msg.character_name || 'Narrator'}</>
                    ) : msg.character_name && msg.character_id ? (
                      renderCharacterWithTooltip(
                        msg.character_name,
                        msg.character_id,
                        msg.username || 'Nieznany',
                        msg.user_id,
                        msg.character_avatar,
                        navigate,
                        theme,
                        msg.character_race,
                        msg.character_gender,
                        msg.character_faction,
                        getRaceName
                      )
                    ) : (
                      <>{msg.username || 'Nieznany użytkownik'}</>
                    )}
                  </Box>

                  <span style={{
                    fontWeight: 400,
                    color: appColors.textMuted,
                    fontSize: '0.85rem',
                    marginLeft: 8,
                    fontStyle: 'italic',
                    letterSpacing: '0.03em',
                  }}>
                    {msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}
                    {msg.edited_at && (
                      <span style={{ color: appColors.borderSteel, marginLeft: 4 }}>
                        [edytowano]
                      </span>
                    )}
                  </span>
                </Typography>
              <Box sx={{ width: '100%', mt: 0.5 }}>
                {editingMessageId === msg.id && editMsgEditor ? (
                  <>
                    <Box sx={{ px: 1 }}>
                      <EditorToolbar
                        editor={editMsgEditor}
                        anchorTextColor={editMsgAnchorTextColor}
                        setAnchorTextColor={setEditMsgAnchorTextColor}
                        anchorBgColor={editMsgAnchorBgColor}
                        setAnchorBgColor={setEditMsgAnchorBgColor}
                        isMobile={isMobile}
                        editorId="edit-message-editor"
                        isEditMode={true}
                      />
                    </Box>
                    <Box sx={{
                      borderTop: `1px solid ${theme.palette.divider}`,
                      bgcolor: theme.palette.background.paper,
                      color: theme.palette.text.primary,
                      minHeight: 150,
                      pt: 0.5,
                      px: 2,
                      pb: 2,
                      position: 'relative',
                      cursor: 'text',
                      '& .ProseMirror': {
                        outline: 'none',
                        minHeight: '120px',
                        color: theme.palette.text.primary,
                        caretColor: theme.palette.primary.main,
                        px: 1.5,
                        py: 0.5,
                        backgroundColor: 'transparent !important',
                        backgroundImage: 'none !important',
                        boxShadow: 'none !important',
                        '&:focus': {
                          outline: 'none',
                          backgroundColor: 'transparent !important',
                          backgroundImage: 'none !important',
                          boxShadow: 'none !important'
                        },
                        '&:focus-visible': {
                          outline: 'none',
                          backgroundColor: 'transparent !important',
                          backgroundImage: 'none !important',
                          boxShadow: 'none !important'
                        }
                      },
                      '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' }
                    }} onClick={() => editMsgEditor?.commands?.focus()}>
                      <EditorContent editor={editMsgEditor} />
                    </Box>
                    <Box sx={{ px: 1, mt: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => saveEditMessage(msg)}
                        sx={{ backgroundColor: theme.palette.secondary.main, mr: 1 }}
                      >
                        Zapisz
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={cancelEditMessage}
                        sx={{ borderColor: theme.palette.text.secondary, color: theme.palette.text.secondary }}
                      >
                        Anuluj
                      </Button>
                    </Box>
                  </>
                ) : (
                  <>
                    <Box component="div" sx={{
                      mt: 0.5,
                      color: 'inherit',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      '& .align-right': { textAlign: 'right' },
                      '& .align-center': { textAlign: 'center' },
                      '& .align-left': { textAlign: 'left' },
                      '& .align-justify': { textAlign: 'justify' },
                      // Odstępy akapitów NIE są tu nadpisywane - rządzi nimi
                      // readingSurfaceSx na kontenerze postu, wspólnie ze
                      // wszystkimi ekranami czatu i z edytorem. Wcześniej stało
                      // tu własne margin: '2px 0', przez co karczma miała inne
                      // odstępy niż sesje, a wynik zależał od kolejności reguł
                      // w arkuszu (obie mają tę samą specyficzność).
                    }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.message) }} />
                  </>
                )}
              </Box>

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
                  <CasinoIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                </Box>
              )}
              </Box>
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: theme.palette.text.primary, textAlign: 'center', mt: 4 }}>
            {isInTavern ? 
              (currentRoom ? `Pokój "${currentRoom.name}" jest pusty.` : 'Wybierz pokój.') : 
              'Karczma jest pusta lub ładuje wiadomości...'}
          </Typography>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* EDYTOR z pending dice rolls */}
      {isInTavern && currentRoom && (
        <Box sx={{
          borderTop: `2px solid ${theme.palette.divider}`,
          px: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          // Konkretna wysokość zamiast proporcji - na mobile regulowana uchwytem.
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
          {/* Uchwyt zmiany wysokości + zwijanie. Wcześniej resizeHandleProps nie
              był podpięty nigdzie, a zwijania na mobile w ogóle nie było. */}
          <EditorResizeHandle
            resizeHandleProps={resizeHandleProps}
            isResizing={isResizing}
            onCollapse={() => setIsEditorCollapsed(true)}
            accentColor={theme.palette.primary.main}
            compact={isMobile}
          />
          <Box ref={editorContainerRef} sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            flex: 1,
            width: '100%',
            overflow: 'hidden',
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            '& .ProseMirror': {
              outline: 'none',
              color: theme.palette.text.primary,
              caretColor: theme.palette.primary.main,
              width: '100%',
              px: 1,
              backgroundColor: 'transparent !important',
              backgroundImage: 'none !important',
              boxShadow: 'none !important',
              '&:focus': {
                outline: 'none',
                backgroundColor: 'transparent !important',
                backgroundImage: 'none !important',
                boxShadow: 'none !important'
              },
              '&:focus-visible': {
                outline: 'none',
                backgroundColor: 'transparent !important',
                backgroundImage: 'none !important',
                boxShadow: 'none !important'
              }
            },
            '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' }
          }}>
            {/* Sticky Toolbar - zawsze widoczny na górze */}
            <Box sx={{ flexShrink: 0, bgcolor: theme.palette.background.paper, pt: isMobile ? 0.25 : 0.5, px: 1, borderBottom: '1px solid rgba(90, 90, 90, 0.3)', mb: isMobile ? 0.25 : 0.5 }}>
              <EditorToolbar
                editor={editor}
                anchorTextColor={anchorTextColor}
                setAnchorTextColor={setAnchorTextColor}
                anchorBgColor={anchorBgColor}
                setAnchorBgColor={setAnchorBgColor}
                isMobile={isMobile}
                isNarratorMode={isNarratorMode}
                setIsNarratorMode={setIsNarratorMode}
                editorId="tavern-editor"
                onSend={sendMessage}
                canSend={!!currentRoom && (!isEditorContentEmpty(message) || pendingDiceRolls.length > 0)}
                onLeaveTavern={leaveTavern}
                currentRoom={currentRoom}
                showRoomSelector={showRoomSelector}
                setShowRoomSelector={setShowRoomSelector}
                isInTavern={isInTavern}
                onDiceRoll={handleDiceRoll}
                isEditMode={false}
              />

              {/* Wyświetlanie pending dice rolls */}
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
                      border: `1px solid ${theme.palette.text.secondary}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        backgroundColor: 'rgba(212, 175, 55, 0.2)',
                        transform: 'scale(1.02)'
                      },
                      ...(keyboardVisible && isMobile && { mb: 0.5, p: 0.5 })
                    }}
                  >
                    <CasinoIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
                    <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                      Zaplanowane rzuty kostką ({pendingDiceRolls.length})
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>

            {/* Editor Content - scrollowalny */}
            {/* Dawne pb:4 (32 px) na mobile było większe niż połowa samego pola
                przy otwartej klawiaturze - stąd wrażenie mikroskopijnego edytora. */}
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: isMobile ? 1 : 2, pt: 0.5, pb: isMobile ? 0.75 : 1, cursor: 'text', '& .ProseMirror': { px: isMobile ? 0.75 : 1.5, py: 0.5, minHeight: `${proseMirrorMin}px` } }} onClick={() => editor?.commands?.focus()}>
              <EditorContent editor={editor} />
            </Box>
          </Box>

          {isNarratorMode && (
            <Box sx={{
              display: 'flex', alignItems: 'center', flexShrink: 0,
              mt: isMobile ? 0.25 : 1, p: isMobile ? 0.5 : 1,
              backgroundColor: 'rgba(204, 0, 68, 0.1)', borderRadius: 1,
              border: '1px solid rgba(204, 0, 68, 0.3)',
            }}>
              <NarratorMark sx={{ mr: 1, color: theme.palette.error.text, fontSize: isMobile ? 16 : undefined }} />
              <Typography variant="body2" sx={{ 
                color: theme.palette.error.text, fontWeight: 'bold',
                fontSize: { xs: '0.7rem', sm: '0.875rem' }, lineHeight: 1.3,
              }}>
                {isMobile ? 'Tryb narratora aktywny' : 'Tryb narratora aktywny – wiadomość zostanie wysłana jako "Narrator"'}
              </Typography>
            </Box>
          )}
          </>
          )}
        </Box>
      )}

      {renderEnterDialog()}
      {renderRoomSelector()}
      {renderParticipantsDialog()}
      {renderKickDialog()}

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

      {/* Pending Dice Rolls Preview Popup */}
      <Dialog
        open={pendingDicePopupOpen}
        onClose={() => setPendingDicePopupOpen(false)}
        maxWidth="sm"
        fullWidth
        {...keyboardSafeDialogProps(keyboardViewport, {
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none',
          border: `2px solid ${theme.palette.text.secondary}`,
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
          <CasinoIcon sx={{ color: theme.palette.primary.main }} />
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
                    borderLeft: `4px solid ${theme.palette.warning.main}`,
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
                        <Typography variant="h6" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                          🎲 {roll.roll}
                        </Typography>
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
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setPendingDicePopupOpen(false)}
            sx={{ color: theme.palette.text.primary }}
          >
            Zamknij
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dice Rolls Popup */}
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
          border: `2px solid ${theme.palette.text.secondary}`,
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
          <CasinoIcon sx={{ color: theme.palette.primary.main }} />
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
                  borderLeft: `4px solid ${theme.palette.text.secondary}`,
                  borderRadius: 1
                }}
              >
                {roll.description && (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 'bold', mb: 0.5 }}>
                    {roll.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
                    🎲 {roll.roll}
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
    </Box>
  );
};

export default Tavern;