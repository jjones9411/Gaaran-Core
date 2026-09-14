import { useState, useEffect, useRef } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import axios from 'axios';
import { decodeJwtPayload } from './AuthContext';
import {
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Collapse,
  Box,
  Modal,
  useTheme,
  Tooltip,
  Stack,
  Popover,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { PanelPage, PanelHeader, panelAddButtonSx, panelRowSx } from './PanelUI';
import { useIsWideScreen } from './useResponsive';

import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { EditorContent, useEditor, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';

import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const quillStyle = {
  color: 'inherit',
  '& *:not([style*="color"])': {
    color: 'inherit',
  },
  '& p, & div, & span': { 
    margin: '0 0 16px 0', 
    lineHeight: '1.6',
  },
  textAlign: 'justify',
  '& h1, & h2': {
    margin: '24px 0 16px 0',
    fontWeight: 'bold',
  },
  '& h1': { fontSize: '2em' },
  '& h2': { fontSize: '1.5em' },
  '& ol, & ul': {
    paddingLeft: '32px',
    marginBottom: '16px',
  },
  '& li': {
    marginBottom: '8px',
  },
  '& strong': { fontWeight: 'bold' },
  '& em': { fontStyle: 'italic' },
  '& u': { textDecoration: 'underline' },
  '& .align-center': { textAlign: 'center' },
  '& .align-right': { textAlign: 'right' },
  '& .align-left': { textAlign: 'left' },
  '& .align-justify': { textAlign: 'justify' },
  '& img': {
    maxWidth: 300,
    height: 'auto',
    display: 'block',
    margin: '8px 0',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    '&:hover': {
      transform: 'scale(1.02)',
      boxShadow: '0 4px 20px rgba(212, 175, 55, 0.3)',
    }
  },
  // Dodanie stylów dla wyrównania obrazów
  '& .image-left': {
    display: 'block',
    marginLeft: '0',
    marginRight: 'auto',
  },
  '& .image-center': {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  '& .image-right': {
    display: 'block',
    marginLeft: 'auto',
    marginRight: '0',
  },
};

const StarColorExtension = Extension.create({
  name: 'starColor',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const decorations = [];
            const regex = /\*([^*]+)\*/g;
            const { doc } = state;
            doc.descendants((node, pos) => {
              if (!node.isText) return;
              const text = node.text;
              let match;
              while ((match = regex.exec(text)) !== null) {
                const start = pos + match.index;
                const end = start + match[0].length;
                const deco = Decoration.inline(start, end, {
                  style: 'color: #333 !important;',
                });
                decorations.push(deco);
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// Rozszerzona konfiguracja Image z obsługą wyrównania
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
      class: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
      align: {
        default: 'left',
        renderHTML: attributes => {
          const alignClass = `image-${attributes.align}`;
          return { class: alignClass };
        },
      },
    };
  },
  
  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign: (align) => ({ commands }) => {
        return commands.updateAttributes('image', { align });
      },
    };
  },
});

const colors = [
  '#0f0f0f', // prawie czarny
  '#f0f0f0', // prawie biały
  '#a0522d', // siodłowy brąz
  '#8b0000', // ciemny czerwony
  '#556b2f', // oliwkowy
  '#483d8b', // ciemny łupek niebieski
  '#6b7280', // ciemny złoty
  '#2f4f4f', // ciemny łupek szary
  '#800080', // purpurowy
  '#cd853f'  // peru
];

const ToolbarButton = ({ onClick, active, children, label }) => (
  <Tooltip title={label} arrow>
    <Button
      size="small"
      variant={active ? 'contained' : 'outlined'}
      onClick={onClick}
      sx={{ minWidth: 36, minHeight: 36, p: 0, mx: 0.3 }}
    >
      {children}
    </Button>
  </Tooltip>
);

// Funkcja do konwersji pliku na base64
const NPC = () => {
  const [npcs, setNpcs] = useState([]);
  const [expandedNpc, setExpandedNpc] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', id: null });
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState('mieszkaniec');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState(null);

  // Stany dla dialogu dodawania obrazka
  const [imageDialog, setImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageWidth, setImageWidth] = useState(300);
  const [imagePreview, setImagePreview] = useState('');
  const [imageAlign, setImageAlign] = useState('left');

  // Stany dla lightbox-a (powiększenie obrazka)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');

  // Dialogi potwierdzenia i alertów
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Potwierdź',
    confirmColor: 'primary'
  });

  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: '',
    message: ''
  });

  const theme = useTheme();
  const isLargeScreen = useIsWideScreen(); // szerokość, nie wysokość okna
  const fileInputRef = useRef(null);

  // Popovers for colors
  const [anchorTextColor, setAnchorTextColor] = useState(null);
  const [anchorBgColor, setAnchorBgColor] = useState(null);

const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    CustomImage.configure({
      inline: false,
      allowBase64: true,
    }),
    StarColorExtension,
  ].filter((ext, index, self) => 
    self.findIndex(e => e.name === ext.name) === index
  ),
  content: formData.description,
  editable: isEditing,
  onUpdate: ({ editor }) => {
    setFormData((prev) => ({ ...prev, description: editor.getHTML() }));
  },
}, [isEditing]);

useEffect(() => {
  if (isEditing && editor && editor.view) {
    // Dodaj małe opóźnienie, aby edytor zdążył się zamontować
    const timer = setTimeout(() => {
      try {
        editor.commands.focus();
      } catch {
        // Ustawienie kursora w edytorze potrafi rzucic, gdy widok zdazyl
        // sie odmontowac zanim odpalil setTimeout. To bez znaczenia dla
        // gracza - nie zasmiecamy mu konsoli.
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }
}, [isEditing, editor]);

  useEffect(() => {
    if (editor && formData.description !== editor.getHTML()) {
      editor.commands.setContent(formData.description || '');
    }
  }, [formData.description, editor]);

  useEffect(() => {
    // Pobierz role z tokena JWT
    const token = localStorage.getItem('token');

    if (token) {
      const payload = decodeJwtPayload(token);
      const role = payload?.role || 'mieszkaniec';
      setUserRole(role);
    } else {
      setUserRole('mieszkaniec');
    }

    fetchNpcs();
  }, []);

  // Funkcja do obsługi kliknięcia w obrazek
  const handleImageClick = (imageSrc) => {
    setLightboxImage(imageSrc);
    setLightboxOpen(true);
  };

  // Funkcja do dodawania event listenerów dla obrazków w wyświetlanych NPC
  useEffect(() => {
    const addImageClickListeners = () => {
      const images = document.querySelectorAll('.npc-content img');
      images.forEach(img => {
        img.style.cursor = 'pointer';
        img.onclick = () => handleImageClick(img.src);
      });
    };

    // Dodaj listenery po renderze
    const timer = setTimeout(addImageClickListeners, 100);
    return () => clearTimeout(timer);
  }, [npcs]);

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setLightboxImage('');
  };

  const fetchNpcs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/npc', { headers: { Authorization: `Bearer ${token}` } });
      
      const sortedNpcs = res.data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0);
        const dateB = new Date(b.created_at || b.createdAt || 0);
        return dateA - dateB;
      });
      
      setNpcs(sortedNpcs);
    } catch (err) {
      console.error('Błąd pobierania NPC:', err);
    }
  };

  const toggleExpand = (id) => {
    if (!isLargeScreen) {
      setExpandedNpc(expandedNpc === id ? null : id);
    } else {
      const selectedNpc = npcs.find((n) => n.id === id);
      setDialogContent(selectedNpc);
      setOpenDialog(true);
    }
  };

  const startEditing = (npc) => {
    setFormData({ title: npc.title, description: npc.description, id: npc.id });
    setIsEditing(true);
  };

  const addImage = () => {
    const url = window.prompt('Wklej URL obrazka');
    if (url) {
      editor.chain().focus().setImage({ 
        src: url, 
        style: 'max-width:300px; height:auto;',
        align: 'left'
      }).run();
    }
  };

  // Funkcje do wyrównywania obrazów
  const alignImage = (alignment) => {
    if (editor.isActive('image')) {
      editor.chain().focus().setImageAlign(alignment).run();
    } else {
      setAlertDialog({
        open: true,
        title: 'Uwaga',
        message: 'Najpierw zaznacz obrazek, który chcesz wyrównać'
      });
    }
  };

  // Obsługa dodawania obrazka z komputera
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    // Format i rozmiar sprawdzamy tymi samymi regułami co backend.
    const validationError = file ? validateEditorImage(file) : 'Nie wybrano pliku';
    if (!validationError) {
      setSelectedImage(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);

      setImageDialog(true);
    } else {
      setAlertDialog({
        open: true,
        title: 'Błąd',
        message: validationError
      });
    }

    event.target.value = '';
  };

  const insertImageFromFile = async () => {
    if (!selectedImage) return;

    try {
      // Plik ląduje na serwerze, a w treści zostaje ścieżka - base64 wysadzało
      // zapis, bo treść nie mieści się w kolumnie TEXT (64 KB).
      const imageUrl = await uploadEditorImage(selectedImage);

      editor.chain().focus().setImage({
        src: imageUrl,
        style: `max-width:${imageWidth}px; height:auto;`,
        align: imageAlign
      }).run();

      setImageDialog(false);
      setSelectedImage(null);
      setImagePreview('');
      setImageWidth(300);
      setImageAlign('left');
    } catch (error) {
      console.error('Błąd podczas dodawania obrazka:', error);
      setAlertDialog({
        open: true,
        title: 'Błąd',
        message: error.message || 'Wystąpił błąd podczas dodawania obrazka.'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!formData.title.trim() || !formData.description.trim()) {
      setAlertDialog({
        open: true,
        title: 'Błąd',
        message: 'Tytuł i opis nie mogą być puste!'
      });
      return;
    }

    const data = { title: formData.title, description: formData.description };
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      if (formData.id) {
        await axios.put(`/api/npc/${formData.id}`, data, { headers });
        fetchNpcs();
      } else {
        const res = await axios.post('/api/npc', data, { headers });
        fetchNpcs();
      }

      setIsEditing(false);
      setFormData({ title: '', description: '', id: null });
      editor.commands.clearContent();
    } catch (err) {
      console.error('Błąd zapisu NPC:', err.response?.data || err.message);
      setAlertDialog({
        open: true,
        title: 'Błąd',
        message: 'Wystąpił błąd podczas zapisu. Sprawdź konsolę.'
      });
    }
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token');
    setConfirmDialog({
      open: true,
      title: 'Usuwanie NPC',
      message: 'Czy na pewno chcesz usunąć tego NPC?',
      confirmText: 'Usuń',
      confirmColor: 'error',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, open: false });
        try {
          await axios.delete(`/api/npc/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          setNpcs(npcs.filter((n) => n.id !== id));
        } catch (err) {
          console.error('Błąd usuwania NPC:', err.response?.data || err.message);
          setAlertDialog({
            open: true,
            title: 'Błąd',
            message: 'Wystąpił błąd podczas usuwania.'
          });
        }
      }
    });
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setDialogContent(null);
  };

  const handleCloseImageDialog = () => {
    setImageDialog(false);
    setSelectedImage(null);
    setImagePreview('');
    setImageWidth(300);
    setImageAlign('left');
  };

  if (!editor) return null;

  return (
    <PanelPage>
      <PanelHeader eyebrow="// PORADNIKI" title="NPC" theme={theme} />

      {userRole === 'admin' && !isEditing && (
        <Button sx={panelAddButtonSx(theme)} onClick={() => {
          setFormData({ title: '', description: '', id: null });
          setIsEditing(true);
        }}>Dodaj NPC</Button>
      )}

      {isEditing && userRole === 'admin' && (
        <Card sx={{ mb: 4, p: 2 }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Imię NPC"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              sx={{ mb: 2 }}
            />

            {/* Toolbar identyczny jak w Bestiary */}
            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" alignItems="center">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie"><FormatBoldIcon /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa"><FormatItalicIcon /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie"><FormatUnderlinedIcon /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} label="Kolor tła"><FormatColorFillIcon /></ToolbarButton>

              <ToolbarButton
                onClick={(e) => setAnchorTextColor(e.currentTarget)}
                active={false}
                label="Kolor tekstu"
              >
                <FormatColorTextIcon sx={{ color: theme.palette.text.secondary }} />
              </ToolbarButton>

              <ToolbarButton onClick={() => editor.chain().focus().unsetColor().run()} active={!editor.isActive('textStyle')} label="Usuń kolor tekstu">
                <FormatColorTextIcon />
              </ToolbarButton>

              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} label="Do lewej">
                <FormatAlignLeftIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} label="Wyśrodkuj">
                <FormatAlignCenterIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} label="Do prawej">
                <FormatAlignRightIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} label="Wyjustuj">
                <FormatAlignJustifyIcon />
              </ToolbarButton>

              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Lista punktowana">
                <FormatListBulletedIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Lista numerowana">
                <FormatListNumberedIcon />
              </ToolbarButton>
              
              {/* Separator */}
              <Box sx={{ width: '1px', height: '24px', bgcolor: 'grey.300', mx: 1 }} />
              
              <ToolbarButton onClick={addImage} label="Dodaj obrazek z URL">
                <InsertPhotoIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Dodaj obrazek z komputera">
                <FileUploadIcon />
              </ToolbarButton>
              
              {/* Przyciski wyrównania obrazów */}
              <ToolbarButton 
                onClick={() => alignImage('left')} 
                active={editor.isActive('image', { align: 'left' })} 
                label="Wyrównaj obrazek do lewej"
              >
                <FormatAlignLeftIcon sx={{ color: theme.palette.error.text }} />
              </ToolbarButton>
              <ToolbarButton 
                onClick={() => alignImage('center')} 
                active={editor.isActive('image', { align: 'center' })} 
                label="Wyśrodkuj obrazek"
              >
                <FormatAlignCenterIcon sx={{ color: theme.palette.error.text }} />
              </ToolbarButton>
              <ToolbarButton 
                onClick={() => alignImage('right')} 
                active={editor.isActive('image', { align: 'right' })} 
                label="Wyrównaj obrazek do prawej"
              >
                <FormatAlignRightIcon sx={{ color: theme.palette.error.text }} />
              </ToolbarButton>
            </Stack>

            {/* Ukryty input dla plików */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={EDITOR_IMAGE_ACCEPT}
              onChange={handleFileSelect}
            />

            {/* Popup Kolor tekstu */}
            <Popover
              open={Boolean(anchorTextColor)}
              anchorEl={anchorTextColor}
              onClose={() => setAnchorTextColor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Stack direction="row" spacing={1} sx={{ p: 1 }}>
                {colors.map((color) => (
                  <Button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setAnchorTextColor(null);
                    }}
                    sx={{
                      bgcolor: color,
                      border: `1px solid ${theme.palette.divider}`,
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      p: 0,
                      '&:hover': { opacity: 0.8 },
                      boxShadow: editor.isActive('textStyle', { color }) ? '0 0 5px 2px gold' : 'none',
                    }}
                  />
                ))}
                <Button
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setAnchorTextColor(null);
                  }}
                  sx={{ ml: 1 }}
                  variant="outlined"
                >
                  Resetuj
                </Button>
              </Stack>
            </Popover>

            {/* Popup Kolor tła */}
            <Popover
              open={Boolean(anchorBgColor)}
              anchorEl={anchorBgColor}
              onClose={() => setAnchorBgColor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Stack direction="row" spacing={1} sx={{ p: 1 }}>
                {colors.map((color) => (
                  <Button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setHighlight({ color }).run();
                      setAnchorBgColor(null);
                    }}
                    sx={{
                      bgcolor: color,
                      border: `1px solid ${theme.palette.divider}`,
                      width: 24,
                      height: 24,
                      minWidth: 24,
                      p: 0,
                      '&:hover': { opacity: 0.8 },
                      boxShadow: editor.isActive('highlight', { color }) ? '0 0 5px 2px gold' : 'none',
                    }}
                  />
                ))}
                <Button
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setAnchorBgColor(null);
                  }}
                  sx={{ ml: 1 }}
                  variant="outlined"
                >
                  Resetuj
                </Button>
              </Stack>
            </Popover>

            <Box
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                bgcolor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                minHeight: 200,
                marginBottom: '16px',
                px: 2,
                py: 1,
                overflowWrap: 'break-word',
                '& .ProseMirror': {
                  outline: 'none',
                  minHeight: '180px',
                  color: theme.palette.text.primary,
                  caretColor: theme.palette.primary.main,
                },
                '& img': {
                  maxWidth: 300,
                  height: 'auto',
                  display: 'block',
                  margin: '8px 0',
                },
                // Dodanie stylów dla wyrównania obrazów
                '& .image-left': {
                  display: 'block',
                  marginLeft: '0',
                  marginRight: 'auto',
                },
                '& .image-center': {
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                },
                '& .image-right': {
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: '0',
                },
              }}
            >
              <EditorContent editor={editor} />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" color="primary">
                Zapisz
              </Button>
              <Button variant="outlined" color="secondary" sx={{ ml: 2 }} onClick={() => setIsEditing(false)}>
                Anuluj
              </Button>
            </Box>
          </form>
        </Card>
      )}

      {/* Dialog do konfiguracji obrazka */}
      <Dialog open={imageDialog} onClose={handleCloseImageDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Konfiguracja obrazka</DialogTitle>
        <DialogContent>
          {imagePreview && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <img 
                src={imagePreview} 
                alt="Podgląd" 
                style={{ 
                  maxWidth: `${imageWidth}px`, 
                  height: 'auto',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '4px',
                  marginLeft: imageAlign === 'left' ? '0' : imageAlign === 'center' ? 'auto' : 'auto',
                  marginRight: imageAlign === 'right' ? '0' : imageAlign === 'center' ? 'auto' : 'auto',
                  display: 'block'
                }} 
              />
            </Box>
          )}
          
          <Typography gutterBottom>
            Szerokość obrazka: {imageWidth}px
          </Typography>
          <Slider
            value={imageWidth}
            onChange={(e, newValue) => setImageWidth(newValue)}
            min={100}
            max={800}
            step={10}
            valueLabelDisplay="auto"
            sx={{ mb: 3 }}
          />
          
          <Typography gutterBottom>
            Wyrównanie obrazka:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button 
              variant={imageAlign === 'left' ? 'contained' : 'outlined'}
              onClick={() => setImageAlign('left')}
              startIcon={<FormatAlignLeftIcon />}
            >
              Lewo
            </Button>
            <Button 
              variant={imageAlign === 'center' ? 'contained' : 'outlined'}
              onClick={() => setImageAlign('center')}
              startIcon={<FormatAlignCenterIcon />}
            >
              Środek
            </Button>
            <Button 
              variant={imageAlign === 'right' ? 'contained' : 'outlined'}
              onClick={() => setImageAlign('right')}
              startIcon={<FormatAlignRightIcon />}
            >
              Prawo
            </Button>
          </Stack>
          
          <Typography variant="body2" color="text.secondary">
            Możesz dostosować szerokość i wyrównanie obrazka przed dodaniem go do tekstu.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImageDialog}>Anuluj</Button>
          <Button onClick={insertImageFromFile} variant="contained">
            Dodaj obrazek
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox dla powiększenia obrazków */}
      <Dialog 
        open={lightboxOpen} 
        onClose={handleCloseLightbox}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            boxShadow: 'none',
            maxWidth: '95vw',
            maxHeight: '95vh',
            margin: 'auto',
          }
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <IconButton
            onClick={handleCloseLightbox}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              },
              zIndex: 1,
            }}
          >
            <CloseIcon />
          </IconButton>
          {lightboxImage && (
            <img 
              src={lightboxImage} 
              alt="Powiększony obraz" 
              style={{ 
                maxWidth: '100%',
                maxHeight: '95vh',
                objectFit: 'contain',
                cursor: 'pointer'
              }}
              onClick={handleCloseLightbox}
            />
          )}
        </DialogContent>
      </Dialog>

      {npcs.map((npc) => (
        <Card key={npc.id} sx={panelRowSx(theme)}>
          <CardContent onClick={() => toggleExpand(npc.id)} sx={{ cursor: 'pointer' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {npc.title}
              </Typography>
              {userRole === 'admin' && (
                <Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(npc);
                    }}
                    sx={{ mr: 1 }}
                  >
                    Edytuj
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(npc.id);
                    }}
                  >
                    Usuń
                  </Button>
                </Box>
              )}
            </Box>
          </CardContent>

          {isLargeScreen ? (
            <Modal
              open={openDialog && dialogContent?.id === npc.id}
              onClose={handleCloseDialog}
              BackdropProps={{ 
                style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
              }}
            >
<Box
  sx={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: { xs: '90%', sm: 600 },
    maxHeight: '90vh',
    bgcolor: 'background.paper',
    borderRadius: 2,
    boxShadow: 24,
    overflowY: 'auto',
    p: 3,
    ...quillStyle,
    color: theme.palette.text.primary,
    '& *': { color: 'inherit' }  // dziedziczenie zamiast !important -
            // nie kasuje kolorow/zakreslen nadanych w edytorze (styl inline)
  }}
                onClick={(e) => e.stopPropagation()}
              >
                <IconButton
                  onClick={handleCloseDialog}
                  sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: 'grey.500',
                  }}
                >
                  <CloseIcon />
                </IconButton>
                
                <Box 
                  className="npc-content"
                  sx={{ pt: 2 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(dialogContent?.description) }} 
                />
              </Box>
            </Modal>
          ) : (
            <Collapse in={expandedNpc === npc.id} timeout="auto" unmountOnExit>
              <CardContent>
                <Box 
                  className="npc-content"
                  sx={quillStyle} 
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(npc.description) }} 
                />
              </CardContent>
            </Collapse>
          )}
        </Card>
      ))}

      {/* Dialog potwierdzenia */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          color: theme.palette.text.primary,
          fontWeight: 'bold',
          borderBottom: `2px solid ${theme.palette.divider}`
        }}>
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1" sx={{
            color: theme.palette.text.primary,
            fontSize: '1.1rem'
          }}>
            {confirmDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}
            variant="outlined"
            color="inherit"
          >
            Anuluj
          </Button>
          <Button
            onClick={confirmDialog.onConfirm}
            variant="contained"
            color={confirmDialog.confirmColor}
            autoFocus
          >
            {confirmDialog.confirmText}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog alertu */}
      <Dialog
        open={alertDialog.open}
        onClose={() => setAlertDialog({ ...alertDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          color: theme.palette.text.primary,
          fontWeight: 'bold',
          borderBottom: `2px solid ${theme.palette.divider}`
        }}>
          {alertDialog.title}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body1" sx={{
            color: theme.palette.text.primary,
            fontSize: '1.1rem'
          }}>
            {alertDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setAlertDialog({ ...alertDialog, open: false })}
            variant="contained"
            color="primary"
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </PanelPage>
  );
};

export default NPC;