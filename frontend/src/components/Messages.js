import React, { useState, useEffect, useRef, useCallback } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Box, Button, TextField, Typography, Stack, Tooltip, Popover, Chip, IconButton, Avatar, Link } from '@mui/material';
import { appColors, readingSurfaceSx } from './theme';
import CharacterHoverCard from './CharacterHoverCard';
import useRaceColor from './useRaceColor';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
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
import { getCurrentCharacter } from './AuthContext';
import useKeyboardViewport from './useKeyboardViewport';
import useResizableEditor from './useResizableEditor';
import useEditorCollapsed from './useEditorCollapsed';
import EditorResizeHandle from './EditorResizeHandle';
import EditorCollapsedBar from './EditorCollapsedBar';
import ToolbarOverflow from './ToolbarOverflow';
import { CHAT_EDITOR_MOBILE, CHAT_EDITOR_DESKTOP, CHAT_PROSEMIRROR_MIN } from './theme';
import { cardOpenProps } from './cardClick';
import useResponsive from './useResponsive';

// Podgląd i konwersja *gwiazdek* siedzą we wspólnym module (./starText) -
// te same reguły obowiązują w Wiadomościach, Karczmie i Sesjach.

const LimitedImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), style: { default: 'max-width:100%;height:auto;', parseHTML: element => element.getAttribute('style'), renderHTML: attributes => ({ style: `max-width:100%;height:auto;${attributes.style || ''}` }) } };
  }
});

const colors = ['#0f0f0f', '#f0f0f0', '#a0522d', '#8b0000', '#556b2f', '#483d8b', '#6b7280', '#2f4f4f', '#800080', '#cd853f'];

const ToolbarButton = ({ onClick, active, children, label }) => (
  <Tooltip title={label} arrow>
    <Button
      size="small"
      onClick={onClick}
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
        }
      }}
    >
      {children}
    </Button>
  </Tooltip>
);

const EditorToolbar = ({ editor, anchorTextColor, setAnchorTextColor, anchorBgColor, setAnchorBgColor, isMobile, editorId, onSend, canSend = false }) => {
  const theme = useTheme();
  const uniqueId = editorId || `editor-${Math.random().toString(36).substr(2, 9)}`;
  const [anchorAlign, setAnchorAlign] = React.useState(null);
  const [anchorImage, setAnchorImage] = React.useState(null);
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

  return (
    <>
      <Stack direction="row" spacing={0.2} mb={0} flexWrap="nowrap" alignItems="center" sx={{ userSelect: 'none', overflowX: 'auto', width: '100%', '&::-webkit-scrollbar': { height: '4px' }, '&::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.1)' }, '&::-webkit-scrollbar-thumb': { background: theme.palette.secondary.main, borderRadius: '2px' } }}>

        {/* Przycisk wysyłania - PO LEWEJ */}
        {onSend && (
          <Tooltip title="Wyślij wiadomość" arrow>
            <span>
              <Button variant="contained" onClick={onSend} disabled={!canSend} sx={{ backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark }, '&:disabled': { backgroundColor: 'rgba(154, 119, 40, 0.3)', color: 'rgba(255, 255, 255, 0.3)' }, minWidth: 44, minHeight: 44, mr: 1, px: isMobile ? 1 : 1 }}>
                <SendIcon sx={{ fontSize: isMobile ? 16 : 14 }} />{!isMobile && <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>Wyślij</span>}
              </Button>
            </span>
          </Tooltip>
        )}

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie"><b>B</b></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa"><i>I</i></ToolbarButton>
        {/* Na mobile rzadziej używane narzędzia chowają się pod "..." - pasek
            był szerszy niż ekran telefonu. Na desktopie bez zmian. */}
        <ToolbarOverflow isMobile={isMobile} accentColor={theme.palette.divider}>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie"><u>U</u></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorBgColor(e.currentTarget)} active={editor.isActive('highlight')} label="Kolor tła"><span style={{ backgroundColor: theme.palette.text.secondary, padding: '0 4px' }}>A</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorTextColor(e.currentTarget)} active={false} label="Kolor tekstu"><span style={{ color: theme.palette.text.secondary }}>A</span></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().unsetColor().run()} active={!editor.isActive('textStyle')} label="Usuń kolor"><span style={{ color: theme.palette.text.primary }}>X</span></ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorAlign(e.currentTarget)} active={false} label="Wyrównanie tekstu">
            <span style={{ fontSize: '16px' }}>≡</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Lista">•</ToolbarButton>
          <ToolbarButton onClick={(e) => setAnchorImage(e.currentTarget)} active={false} label="Obrazek">🖼</ToolbarButton>
        </ToolbarOverflow>
      </Stack>

      {/* Popover wyrównania */}
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
        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
          {colors.map(color => <Button key={`text-${color}-${uniqueId}`} onClick={() => { editor.chain().focus().setColor(color).run(); setAnchorTextColor(null); }} sx={{ bgcolor: color, border: `1px solid ${theme.palette.divider}`, width: 24, height: 24, minWidth: 24, p: 0 }} />)}
          <Button onClick={() => { editor.chain().focus().unsetColor().run(); setAnchorTextColor(null); }} variant="outlined">Reset</Button>
        </Stack>
      </Popover>
      <Popover open={Boolean(anchorBgColor)} anchorEl={anchorBgColor} onClose={() => setAnchorBgColor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Stack direction="row" spacing={1} sx={{ p: 1 }}>
          {colors.map(color => <Button key={`bg-${color}-${uniqueId}`} onClick={() => { editor.chain().focus().setHighlight({ color }).run(); setAnchorBgColor(null); }} sx={{ bgcolor: color, border: `1px solid ${theme.palette.divider}`, width: 24, height: 24, minWidth: 24, p: 0 }} />)}
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

const getCharacterAvatar = (character) => {
  if (!character) return null;
  if (character.avatar) return `/api${character.avatar}`;
  return null;
};

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('pl-PL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const race = useRaceColor(); // ramka/tinta/hover/divider wg rasy

  // Widoczny obszar okna + wykrycie klawiatury - wspólny hook.
  const { viewportHeight, keyboardVisible } = useKeyboardViewport();
  const [conversations, setConversations] = useState([]);
  const [unreadConversationIds, setUnreadConversationIds] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversationDetails, setConversationDetails] = useState(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState([]);
  const [inputCharacterId, setInputCharacterId] = useState('');
  const [characterIdError, setCharacterIdError] = useState('');
  const [addingCharacter, setAddingCharacter] = useState(false);
  const [charactersCache, setCharactersCache] = useState({});
  const [races, setRaces] = useState([]);
  const [anchorTextColor, setAnchorTextColor] = useState(null);
  const [anchorBgColor, setAnchorBgColor] = useState(null);
  
  // NOWE STANY dla śledzenia zawartości edytorów
  const [editorHasContent, setEditorHasContent] = useState(false);
  const [createEditorHasContent, setCreateEditorHasContent] = useState(false);

  const messagesEndRef = useRef(null);
  const editorContainerRef = useRef(null);  // Edytor odpowiedzi w istniejącej konwersacji
  const createEditorContainerRef = useRef(null);  // Edytor przy tworzeniu nowej konwersacji
  const token = localStorage.getItem('token');
  const { isSmall: isMobile } = useResponsive(); // wspólny próg z powłoką (1050px)

  const isCreatingConversation = location.pathname.includes('/home/messages/new');
  const isViewingConversation = conversationId && !isNaN(conversationId);

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

  // Hook zwraca wysokość już przyciętą do min/max; uchwyt przeciągania podpięty
  // niżej (wcześniej resizeHandleProps nie trafiał na żaden element).
  const { editorHeight, isResizing, resizeHandleProps } = useResizableEditor(editorLimits);

  // Zwinięcie edytora jest ZAPAMIĘTYWANE (osobno dla mobile i desktopu), więc
  // wybór gracza przeżywa przejście na inną sesję - wcześniej komponent montował
  // się od nowa i edytor znów się rozwijał. Domyślnie: mobile zwinięty,
  // desktop rozwinięty.
  const [isEditorCollapsed, setIsEditorCollapsed] = useEditorCollapsed(isMobile);

  const proseMirrorMin = isMobile
    ? (keyboardVisible ? CHAT_PROSEMIRROR_MIN.mobileWithKeyboard : CHAT_PROSEMIRROR_MIN.mobile)
    : CHAT_PROSEMIRROR_MIN.desktop;

  // Na telefonie z klawiaturą chowamy nagłówek konwersacji.
  const hideChromeForKeyboard = isMobile && keyboardVisible;

  const extensions = [
    StarterKit.configure({
      bulletList: false,
      orderedList: false,
      italic: false
    }),
    BulletList.extend({
      addInputRules() {
        return [];
      }
    }),
    OrderedList.extend({
      addInputRules() {
        return [];
      }
    }),
    Italic.extend(disableMarkdownPasteRules),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    LimitedImage.configure({ inline: false, allowBase64: true }),
    StarColorExtension
  ];
  
  // POPRAWKA: Edytory z onUpdate do śledzenia zawartości
  const editor = useEditor({ 
    extensions, 
    content: '', 
    autofocus: false, 
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const hasContent = html && html.trim() !== '' && html.trim() !== '<p></p>' && html.trim() !== '<p><br></p>';
      setEditorHasContent(hasContent);
    }
  });
  
  const createEditor = useEditor({ 
    extensions, 
    content: '', 
    autofocus: false,
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const hasContent = html && html.trim() !== '' && html.trim() !== '<p></p>' && html.trim() !== '<p><br></p>';
      setCreateEditorHasContent(hasContent);
    }
  });

  // Pobierz listę ras (do mapowania klucza rasy na czytelną nazwę w tooltipie postaci)
  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';

  // Funkcja renderCharacterWithTooltip wewnątrz komponentu
  const renderCharacterWithTooltip = (characterName, characterId, authorName, authorId, avatar, faction, gender) => {
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

  // Rozwinięcie edytora z paska "Napisz wiadomość..." od razu ustawia kursor.
  const expandEditorAndFocus = useCallback(() => {
    setIsEditorCollapsed(false);
    setTimeout(() => { editor?.commands?.focus(); }, 60);
  }, [editor]);

  useEffect(() => {
    const timer = setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, keyboardVisible ? 200 : 100);
    return () => clearTimeout(timer);
  }, [messages, keyboardVisible, viewportHeight]);

  useEffect(() => {
    // Stan widocznego obszaru należy teraz do wspólnego hooka - zostaje samo
    // czyszczenie stylów body.
    const handleComponentCleanup = () => {
      document.body.style.overflow = '';
      document.body.style.overflowY = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
    return handleComponentCleanup;
  }, []);

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

    // Obsługa edytora odpowiedzi (editor)
    const editorProseMirror = editorContainerRef.current?.querySelector('.ProseMirror');
    const editorHandler = handleEditorFocus(editorContainerRef);
    if (editorProseMirror) {
      editorProseMirror.addEventListener('focus', editorHandler);
    }

    // Obsługa edytora tworzenia nowej konwersacji (createEditor)
    const createEditorProseMirror = createEditorContainerRef.current?.querySelector('.ProseMirror');
    const createEditorHandler = handleEditorFocus(createEditorContainerRef);
    if (createEditorProseMirror) {
      createEditorProseMirror.addEventListener('focus', createEditorHandler);
    }

    return () => {
      if (editorProseMirror) {
        editorProseMirror.removeEventListener('focus', editorHandler);
      }
      if (createEditorProseMirror) {
        createEditorProseMirror.removeEventListener('focus', createEditorHandler);
      }
    };
  }, [isMobile, isCreatingConversation, isViewingConversation]);

  useEffect(() => {
    fetchConversations();
    if (isViewingConversation) {
      fetchConversationData();
      // Wyczyść editor przy wejściu do konwersacji
      if (editor) {
        editor.commands.clearContent();
        setEditorHasContent(false);
      }
    }
  }, [conversationId, isCreatingConversation]);

  // Auto-dodaj odbiorcę z profilu
  useEffect(() => {
    if (isCreatingConversation && location.state?.recipientCharacterId) {
      const recipientId = Number(location.state.recipientCharacterId);
      if (recipientId && !selectedCharacterIds.includes(recipientId)) {
        fetchCharacterById(recipientId).then(() => {
          setSelectedCharacterIds([recipientId]);
        });
      }
    }
  }, [isCreatingConversation, location.state]);

  useEffect(() => {
    if (!Array.isArray(conversations)) { setUnreadConversationIds([]); return; }
    const unreadIds = conversations.filter(c => c && c.is_participant).filter(c => {
      if (!c.last_activity) return false;
      const lastActivity = new Date(c.last_activity || 0).getTime();
      const seenAt = c.seen_at ? new Date(c.seen_at).getTime() : 0;
      return !c.seen_at || lastActivity > seenAt;
    }).map(c => c.id);
    setUnreadConversationIds(unreadIds);
  }, [conversations]);

  const fetchCharacterById = async (id) => {
    if (!id) return null;
    if (charactersCache[id]) return charactersCache[id];
    try {
      setAddingCharacter(true);
      const res = await fetch(`/api/characters/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (!data || !data.character) throw new Error('Invalid character data');
      setCharactersCache(prev => ({ ...prev, [id]: data.character }));
      return data.character;
    } catch (error) {
      console.error('Error fetching character:', error);
      return null;
    } finally { setAddingCharacter(false); }
  };

  const handleAddCharacterId = async () => {
    const id = inputCharacterId.trim();
    if (!id || isNaN(id)) { setCharacterIdError('Podaj prawidłowe ID postaci'); return; }
    if (!Array.isArray(selectedCharacterIds)) setSelectedCharacterIds([]);
    if (selectedCharacterIds.includes(Number(id))) { setCharacterIdError('Ta postać już jest na liście'); return; }
    const character = await fetchCharacterById(id);
    if (!character) { setCharacterIdError('Nie znaleziono postaci o takim ID'); return; }
    setSelectedCharacterIds([...selectedCharacterIds, Number(id)]);
    setCharacterIdError('');
    setInputCharacterId('');
  };

  const handleRemoveCharacterId = (characterId) => {
    setSelectedCharacterIds(selectedCharacterIds.filter(id => id !== characterId));
    setCharactersCache(prev => { const newCache = { ...prev }; delete newCache[characterId]; return newCache; });
  };

  const fetchConversations = async () => {
    try {
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter) { 
        setConversations([]); 
        return; 
      }
      const response = await fetch(`/api/conversations/character/${currentCharacter.id}`, { 
        method: 'GET', 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) { 
      console.error('Error fetching conversations:', error);
      setConversations([]); 
    }
  };

  const fetchConversationData = async () => {
    try {
      const currentCharacter = getCurrentCharacter();
      if (!currentCharacter) { 
        console.error('Brak aktywnej postaci'); 
        return; 
      }
      
      const [detailsRes, messagesRes] = await Promise.all([
        fetch(`/api/conversations/${conversationId}?characterId=${currentCharacter.id}`, { 
          method: 'GET', 
          headers: { Authorization: `Bearer ${token}` } 
        }),
        fetch(`/api/conversations/${conversationId}/messages?characterId=${currentCharacter.id}`, { 
          method: 'GET', 
          headers: { Authorization: `Bearer ${token}` } 
        })
      ]);
      
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        setConversationDetails(details);
        
        // Oznacz jako przeczytaną zaraz po wejściu
        await markConversationAsRead({ id: conversationId, last_activity: details.last_activity });
      }
      
      if (messagesRes.ok) {
        const msgs = await messagesRes.json();
        setMessages(Array.isArray(msgs) ? msgs : []);
        // fetchConversations() jest już wywoływane w markConversationAsRead()
      }
    } catch (error) {
      console.error('Error fetching conversation data:', error);
      setMessages([]);
      setConversationDetails(null);
    }
  };

  const markConversationAsRead = async (conversationData) => {
    const currentCharacter = getCurrentCharacter();
    if (!conversationData?.id || !currentCharacter?.id) return;

    try {
      const response = await fetch(`/api/conversations/${conversationData.id}/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          characterId: currentCharacter.id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error marking as read:', response.status, errorText);
        return;
      }

      await fetchConversations();

      // Powiadom Sidebar o aktualizacji powiadomień
      window.dispatchEvent(new CustomEvent('conversationsUpdated'));
    } catch (e) {
      console.error('Error marking conversation as read:', e);
    }
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę konwersację?')) return;
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) { alert('Brak aktywnej postaci'); return; }
    try {
      const response = await fetch(`/api/conversations/${convId}/delete?characterId=${currentCharacter.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (response.ok) { await fetchConversations(); alert('Konwersacja usunięta'); } else { const errorData = await response.json(); alert(`Błąd: ${errorData.message || 'Nieznany błąd'}`); }
    } catch (error) { console.error('Error deleting conversation:', error); alert('Błąd podczas usuwania konwersacji'); }
  };

  const isEditorContentEmpty = (html) => !html || ['', '<p></p>', '<p><br></p>'].includes(html.trim());

  const handleSendMessage = async () => {
    if (!editor) return;
    const raw = editor.getHTML();
    if (isEditorContentEmpty(raw)) return;

    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) { alert('Brak aktywnej postaci!'); return; }
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: processStarText(raw),
          sender_character_id: currentCharacter.id
        })
      });
      
      if (response.ok) {
        const msg = await response.json();
        setMessages(prev => Array.isArray(prev) ? [...prev, msg] : [msg]);
        if (editor) {
          editor.commands.clearContent();
          setEditorHasContent(false);
        }
        await fetchConversations();
      }
    } catch (error) { 
      console.error('Error sending message:', error); 
    }
  };

  const handleCreateConversation = async () => {
    if (!createEditor || isEditorContentEmpty(createEditor.getHTML())) { alert('Treść wiadomości jest wymagana'); return; }
    if (!Array.isArray(selectedCharacterIds) || selectedCharacterIds.length === 0) { alert('Dodaj przynajmniej jednego odbiorcę'); return; }
    const htmlContent = createEditor.getHTML();
    const currentCharacter = getCurrentCharacter();
    if (!currentCharacter) { alert('Brak aktywnej postaci! Wybierz postać w Lobby.'); return; }
    const receiverCharacterId = selectedCharacterIds[0];
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sender_character_id: currentCharacter.id,
          receiver_character_id: receiverCharacterId,
          content: processStarText(htmlContent)
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (createEditor) {
          createEditor.commands.clearContent();
          setCreateEditorHasContent(false);
        }
        setSelectedCharacterIds([]);
        setInputCharacterId('');
        setCharacterIdError('');
        navigate(`/home/messages/${data.conversationId}`);
        if (!data.existing) alert('Wiadomość wysłana!');
      } else {
        const errorData = await response.json();
        alert(`Błąd: ${errorData.message || 'Nieznany błąd'}`);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Błąd podczas tworzenia konwersacji');
    }
  };
  // === RENDER ===
  if (isCreatingConversation) {
    const currentCharacter = getCurrentCharacter();

    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', px: 0, py: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ...(keyboardVisible && isMobile && { px: 1, py: 0.5 }) }}>
          <IconButton size="small" onClick={() => navigate('/home/messages')} sx={{ color: theme.palette.text.secondary, backgroundColor: 'rgba(0,0,0,0.6)', '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' } }}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography variant="h5" sx={{ color: theme.palette.text.secondary, flex: 1, fontSize: { xs: '1.25rem', sm: '1.5rem' }, ...(keyboardVisible && isMobile && { fontSize: '1.1rem' }) }}>Nowa wiadomość</Typography>
        </Box>

        <Box sx={{ px: 2, py: 1, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0, ...(hideChromeForKeyboard && { px: 1, py: 0.5 }) }}>
          {!currentCharacter && (
            <Box sx={{ mb: 2, p: 1, backgroundColor: 'rgba(204, 0, 68, 0.1)', border: `1px solid ${theme.palette.error.main}`, borderRadius: 1, ...(keyboardVisible && isMobile && { mb: 1, p: 0.5 }) }}>
              <Typography variant="body2" sx={{ color: theme.palette.error.text }}><strong>Uwaga:</strong> Nie masz aktywnej postaci. Wybierz postać w Lobby.</Typography>
            </Box>
          )}

          <Box sx={{ mb: 2, ...(keyboardVisible && isMobile && { mb: 1 }) }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' }, ...(keyboardVisible && isMobile && { mb: 0.5, fontSize: '0.8rem' }) }}>Dodaj odbiorców po ID postaci:</Typography>
            <Stack direction={isMobile ? "column" : "row"} spacing={1} alignItems="flex-start" sx={{ mb: 1, ...(keyboardVisible && isMobile && { mb: 0.5 }) }}>
              <TextField size="small" label="ID postaci" value={inputCharacterId} onChange={e => setInputCharacterId(e.target.value.replace(/\D+/g, ''))} onKeyDown={e => e.key === 'Enter' && handleAddCharacterId()} sx={{ minWidth: isMobile ? '100%' : 170, flex: 1, '& .MuiOutlinedInput-root': { backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, '& fieldset': { borderColor: theme.palette.divider }, '&:hover fieldset': { borderColor: theme.palette.divider }, '&.Mui-focused fieldset': { borderColor: theme.palette.text.secondary } }, '& .MuiInputBase-input': { color: theme.palette.text.primary }, '& .MuiInputLabel-root': { color: theme.palette.text.secondary }, '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.secondary } }} disabled={addingCharacter} autoComplete="off" />
              <Button onClick={handleAddCharacterId} variant="contained" disabled={addingCharacter || !inputCharacterId.trim()} sx={{ minWidth: isMobile ? '100%' : 90, backgroundColor: theme.palette.secondary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}>Dodaj</Button>
            </Stack>
            {characterIdError && <Typography color="error" sx={{ fontSize: 13, mb: 1 }}>{characterIdError}</Typography>}
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ minHeight: 30 }}>
              {Array.isArray(selectedCharacterIds) && selectedCharacterIds.map(charId => {
                const character = charactersCache[charId];
                return (
                  <Chip key={charId} avatar={<Avatar src={getCharacterAvatar(character)} sx={{ width: 24, height: 24 }}>{!getCharacterAvatar(character) && character?.name?.[0]?.toUpperCase()}</Avatar>} label={`${character?.name || `ID:${charId}`} (#${charId})`} onDelete={() => handleRemoveCharacterId(charId)} sx={{ bgcolor: 'rgba(13, 15, 14, 0.3)', color: theme.palette.text.secondary, mb: 0.5, '& .MuiChip-deleteIcon': { color: theme.palette.text.secondary } }} />
                );
              })}
            </Stack>
          </Box>
        </Box>

        {/* Na tym ekranie edytor jest celem, więc nie ma zwijania - ale
            wysokość jest taka sama i regulowana tym samym uchwytem. */}
        <Box sx={{ borderTop: `2px solid ${theme.palette.divider}`, px: 0, display: 'flex', flexDirection: 'column', width: '100%', flex: '0 0 auto', height: `${editorHeight}px`, position: 'relative', pt: 0.5 }}>
          <EditorResizeHandle
            resizeHandleProps={resizeHandleProps}
            isResizing={isResizing}
            accentColor={theme.palette.primary.main}
            compact={isMobile}
          />


          <Box sx={{ flexShrink: 0, px: 1, pb: isMobile ? 0.25 : 0.5 }}>
            <EditorToolbar
              editor={createEditor}
              anchorTextColor={anchorTextColor}
              setAnchorTextColor={setAnchorTextColor}
              anchorBgColor={anchorBgColor}
              setAnchorBgColor={setAnchorBgColor}
              isMobile={isMobile}
              editorId="create-message-editor"
              onSend={handleCreateConversation}
              canSend={createEditorHasContent && !!currentCharacter && selectedCharacterIds.length > 0}
            />
          </Box>

          <Box ref={createEditorContainerRef} sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, flex: 1, px: isMobile ? 1 : 2, pt: 0.5, pb: isMobile ? 0.75 : 1, overflow: 'auto', minHeight: 0, position: 'relative', cursor: 'text', '& .ProseMirror': { outline: 'none', minHeight: `${proseMirrorMin}px`, color: theme.palette.text.primary, caretColor: theme.palette.primary.main, width: '100%', px: isMobile ? 0.75 : 1.5, py: 0.5, backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important', '&:focus': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' }, '&:focus-visible': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' } }, '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' } }} onClick={() => createEditor?.commands?.focus()}>
            <EditorContent editor={createEditor} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (isViewingConversation) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: appColors.bgDeep, width: '100%', overflow: 'hidden' }}>
        {/* Nagłówek rozmowy. Na telefonie z klawiaturą znika w całości - te
            ~50 px to przy widocznym obszarze ~380 px około dwóch linii treści. */}
        {conversationDetails && (
          <Box sx={{
            px: { xs: 1, sm: 2 }, py: 1,
            display: hideChromeForKeyboard ? 'none' : 'flex',
            justifyContent: 'space-between', alignItems: 'center', gap: 1,
            flexShrink: 0,
            borderBottom: `1px solid ${appColors.borderSteel}`,
            bgcolor: `${appColors.bgDeep}cc`,
            backdropFilter: 'blur(4px)',
          }}>
            <IconButton size="small" onClick={() => navigate('/home/messages')} sx={{
              color: appColors.steelLight,
              bgcolor: 'transparent',
              border: `1px solid ${appColors.borderSteel}`,
              borderRadius: '2px',
              '&:hover': { bgcolor: `${appColors.steel}22`, borderColor: appColors.steel, color: appColors.textLight },
            }}><ArrowBackIcon fontSize="small" /></IconButton>
            <Typography sx={{
              color: appColors.textPrimary,
              
              fontSize: { xs: '0.8rem', sm: '0.95rem' },
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              flex: 1, textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', px: 1,
              ...(keyboardVisible && isMobile && { fontSize: '0.75rem' })
            }}>
              Rozmowa z {conversationDetails.other_character_id ? (
                renderCharacterWithTooltip(
                  conversationDetails.other_character_name,
                  conversationDetails.other_character_id,
                  conversationDetails.other_user_name,
                  conversationDetails.other_user_id,
                  conversationDetails.other_character_avatar,
                  conversationDetails.other_character_faction,
                  conversationDetails.other_character_gender
                )
              ) : conversationDetails.other_character_name}
            </Typography>
          </Box>
        )}

        {/* Czytanie bierze CAŁE miejsce po edytorze (flex:1). Dawna proporcja
            7:2 i tak nie działała - przebijały ją minimalne wysokości edytora. */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: isMobile ? 1 : 2, py: 1, width: '100%', minHeight: 0, ...(isMobile && { pb: 1 }), ...(hideChromeForKeyboard && { px: 0.5, py: 0.5, pb: 0.5 }) }}>
          {Array.isArray(messages) && messages.map((msg) => (
            <Box key={msg.id} sx={{
              // Ciaśniejsze odstępy między wiadomościami na telefonie - sam
              // ozdobnik z marginesami kosztował ~38 px na każdą wiadomość.
              mb: { xs: 0.75, sm: 1.15 },
              px: 0,
              width: '100%',
              '&::after': {
                content: '""',
                display: 'block',
                height: { xs: '10px', sm: '18px' },
                mt: { xs: 0.5, sm: 0.75 },
                background: `linear-gradient(90deg, transparent, ${race.border}, transparent)`,
              },
            }}>
              {/* Panel postu - tło na całym polu między przedziałkami (razem z avatarem) */}
              <Box sx={{ ...readingSurfaceSx(theme), display: 'flow-root', position: 'relative' }}>
                <Avatar src={getCharacterAvatar({ avatar: msg.sender_avatar })} variant="square" sx={{
                  float: 'left',
                  // 120 px avatara zabierało na telefonie ponad jedną trzecią
                  // wiersza; 72 px daje ~35% więcej tekstu w linii.
                  width: { xs: 72, sm: 150 },
                  height: { xs: 90, sm: 190 },
                  mr: { xs: 0.75, sm: 1.5 },
                  mb: 0.5,
                  bgcolor: appColors.bgSurface,
                  border: `2px solid ${theme.palette.primary.main}60`,
                  boxShadow: `0 0 8px ${theme.palette.primary.main}30`,
                  borderRadius: '2px',
                  '& .MuiAvatar-img': { objectFit: 'cover', objectPosition: '50% 0%' },
                }}>{!msg.sender_avatar && msg.sender_name?.[0]?.toUpperCase()}</Avatar>
                <Typography variant="body2" component="div" sx={{
                  fontWeight: 'bold',
                  color: theme.palette.primary.main,
                  display: 'block',
                  fontSize: { xs: '1rem', sm: '1.4rem' },
                  lineHeight: { xs: 1.3, sm: 1.5 }
                }}>
                  {msg.sender_character_id ? (
                    renderCharacterWithTooltip(
                      msg.sender_name,
                      msg.sender_character_id,
                      msg.sender_user_name,
                      msg.sender_user_id,
                      msg.sender_avatar,
                      msg.sender_faction,
                      msg.sender_gender
                    )
                  ) : msg.sender_name}
                  <span style={{
                    fontWeight: 400,
                    color: appColors.textMuted,
                    fontSize: '0.85rem',
                    marginLeft: 8,
                    fontStyle: 'italic',
                    letterSpacing: '0.03em',
                  }}>
                    {formatDate(msg.created_at)}
                  </span>
                </Typography>
                <Box component="div" sx={{ mt: 0.5, color: 'inherit', overflowWrap: 'break-word', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }} />
              </Box>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Edytor ma konkretną wysokość (na mobile regulowaną uchwytem),
            zamiast proporcji przegrywającej z min-heightami. */}
        <Box sx={{ borderTop: `2px solid ${theme.palette.divider}`, px: 0, display: 'flex', flexDirection: 'column', width: '100%', flex: '0 0 auto', height: isEditorCollapsed ? 'auto' : `${editorHeight}px`, position: 'relative', pt: isEditorCollapsed ? 0 : 0.5 }}>

          {isEditorCollapsed ? (
            <EditorCollapsedBar
              onExpand={expandEditorAndFocus}
              accentColor={theme.palette.primary.main}
            />
          ) : (
            <>
              <EditorResizeHandle
                resizeHandleProps={resizeHandleProps}
                isResizing={isResizing}
                onCollapse={() => setIsEditorCollapsed(true)}
                accentColor={theme.palette.primary.main}
                compact={isMobile}
              />

              <Box sx={{ flexShrink: 0, px: 1, pb: isMobile ? 0.25 : 0.5 }}>
                <EditorToolbar
                  editor={editor}
                  anchorTextColor={anchorTextColor}
                  setAnchorTextColor={setAnchorTextColor}
                  anchorBgColor={anchorBgColor}
                  setAnchorBgColor={setAnchorBgColor}
                  isMobile={isMobile}
                  editorId="conversation-editor"
                  onSend={handleSendMessage}
                  canSend={editorHasContent}
                />
              </Box>

              <Box ref={editorContainerRef} sx={{ bgcolor: theme.palette.background.paper, color: theme.palette.text.primary, flex: 1, px: isMobile ? 1 : 2, pt: 0.5, pb: isMobile ? 0.75 : 1, width: '100%', overflow: 'auto', minHeight: 0, position: 'relative', cursor: 'text', '& .ProseMirror': { outline: 'none', minHeight: `${proseMirrorMin}px`, color: theme.palette.text.primary, caretColor: theme.palette.primary.main, width: '100%', px: isMobile ? 0.75 : 1.5, py: 0.5, backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important', '&:focus': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' }, '&:focus-visible': { outline: 'none', backgroundColor: 'transparent !important', backgroundImage: 'none !important', boxShadow: 'none !important' } }, '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '8px 0' } }} onClick={() => editor?.commands?.focus()}>
                <EditorContent editor={editor} />
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // LIST MODE
  return (
    <Box sx={{ flex: 1, width: '100%', px: 0, py: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 2, pt: 2, mb: 1, ...(keyboardVisible && isMobile && { px: 1, pt: 1 }) }}>
        <Typography sx={{
          color: appColors.textMuted,
          
          fontSize: '0.65rem',
          letterSpacing: '0.22em',
          mb: 0.25,
        }}>// SYSTEM KOMUNIKACJI</Typography>
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
          ...(keyboardVisible && isMobile && { fontSize: '1.1rem' })
        }}>
          <Box component="span" sx={{ color: theme.palette.primary.main, opacity: 0.7 }}>{'>'}</Box>
          Wiadomości
          {Array.isArray(unreadConversationIds) && unreadConversationIds.length > 0 && (
            <Tooltip title="Nowe wiadomości w Twoich konwersacjach!">
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, px: 2, flexWrap: 'wrap', ...(keyboardVisible && isMobile && { mb: 1, px: 1, gap: 1 }) }}>
        <Button
          onClick={() => navigate('/home/messages/new')}
          sx={{
            color: appColors.textLight,
            border: `2px solid ${theme.palette.primary.main}`,
            borderRadius: '2px',
            bgcolor: 'transparent',
            
            letterSpacing: '0.1em',
            fontSize: { xs: '0.8rem', sm: '0.85rem' },
            fontWeight: 'bold',
            px: 2.5,
            py: 0.75,
            boxShadow: `0 0 8px ${theme.palette.primary.main}30`,
            '&:hover': {
              bgcolor: `${theme.palette.primary.main}18`,
              boxShadow: `0 0 16px ${theme.palette.primary.main}50`,
            },
          }}
        >[ + NOWA WIADOMOŚĆ ]</Button>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 0, ...(keyboardVisible && isMobile && { paddingBottom: '20px' }) }}>
        {Array.isArray(conversations) && conversations.length > 0 ? (
          conversations.map((conv) => {
            if (!conv || !conv.id) return null;
            const isUnread = !!(conv.is_participant && Array.isArray(unreadConversationIds) && unreadConversationIds.includes(conv.id));
            return (
              <Box
                key={conv.id}
                // Klik w dowolne miejsce karty otwiera konwersację (przyciski działają jak dotąd).
                {...cardOpenProps(() => navigate(`/home/messages/${conv.id}`))}
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  // Obwódka w kolorze rasy - bez grafik.
                  border: `1px solid ${race.border}`,
                  borderTop: `3px solid ${race.accent}`,
                  backgroundColor: `${race.hex}12`,
                  backgroundClip: 'padding-box',
                  position: 'relative',
                  width: '100%',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: `${race.hex}2e`,
                  },
                  ...(keyboardVisible && isMobile && { p: 1, mb: 1 })
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {isUnread && (
                    <>
                      <Tooltip title="Nowa wiadomość w tej konwersacji!">
                        <Box sx={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: theme.palette.error.main, boxShadow: `0 0 6px ${theme.palette.error.main}`, mr: 0.5, ...(keyboardVisible && isMobile && { width: 12, height: 12 }) }} />
                      </Tooltip>
                      <Typography variant="caption" sx={{ color: theme.palette.error.text, fontWeight: 'bold', mr: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' }, ...(keyboardVisible && isMobile && { fontSize: '0.65rem' }) }}>nowa wiadomość</Typography>
                    </>
                  )}
                  <Avatar
                    src={getCharacterAvatar({ avatar: conv.avatar })}
                    sx={{
                      width: 36,
                      height: 36,
                      mr: 1,
                      border: `2px solid ${appColors.borderSteel}`,
                      boxShadow: `0 0 8px ${theme.palette.primary.main}40`,
                    }}
                  >
                    {!conv.avatar && conv.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Typography
                    variant="h6"
                    sx={{
                      color: appColors.textLight,
                      
                      fontSize: { xs: '1.1rem', sm: '1.3rem' },
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: { xs: 'normal', sm: 'nowrap' },
                      ...(keyboardVisible && isMobile && { fontSize: '0.85rem' })
                    }}
                  >
                    {conv.character_id ? (
                      renderCharacterWithTooltip(
                        conv.name,
                        conv.character_id,
                        conv.user_name,
                        conv.user_id,
                        conv.avatar,
                        conv.faction,
                        conv.gender
                      )
                    ) : (conv.name || 'Bez nazwy')}
                  </Typography>
                </Box>
                
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.text.secondary,
                    mb: 1, 
                    fontSize: { xs: '0.8rem', sm: '0.875rem' }, 
                    ...(keyboardVisible && isMobile && { mb: 0.5, fontSize: '0.75rem' }) 
                  }}
                >
                  Ostatnia aktywność: {formatDate(conv.last_activity)}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', '& > *': { minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' } } }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate(`/home/messages/${conv.id}`)}
                    sx={{
                      color: appColors.steelLight,
                      borderColor: appColors.borderSteel,
                      borderRadius: '2px',
                      
                      letterSpacing: '0.05em',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: `${appColors.steel}22`,
                        color: appColors.textLight,
                      },
                      fontSize: { xs: '0.75rem', sm: '0.8rem' },
                      ...(keyboardVisible && isMobile && { fontSize: '0.7rem', py: 0.5 })
                    }}
                  >
                    Otwórz konwersację
                  </Button>
                  <Button 
                    variant="outlined" 
                    onClick={() => handleDeleteConversation(conv.id)} 
                    startIcon={<DeleteIcon />} 
                    sx={{ 
                      color: theme.palette.error.text, 
                      borderColor: theme.palette.error.main, 
                      '&:hover': { 
                        borderColor: theme.palette.error.dark, 
                        backgroundColor: 'rgba(255, 107, 107, 0.1)' 
                      }, 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' }, 
                      ...(keyboardVisible && isMobile && { fontSize: '0.7rem', py: 0.5 }) 
                    }}
                  >
                    Usuń
                  </Button>
                </Box>
              </Box>
            );
          })
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, px: 2, ...(keyboardVisible && isMobile && { py: 4, px: 1 }) }}>
            <Typography sx={{ color: appColors.textMuted, fontSize: '0.7rem', letterSpacing: '0.2em', mb: 1, }}>
              // BRAK DANYCH
            </Typography>
            <Typography variant="h6" sx={{ color: appColors.steelLight, mb: 1,  letterSpacing: '0.08em' }}>
              BRAK KONWERSACJI
            </Typography>
            <Typography variant="body2" sx={{ color: appColors.textMuted, }}>
              Nie masz jeszcze żadnych konwersacji.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default Messages;