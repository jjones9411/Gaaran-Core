// Gaaran-Core - strona rasy (generyczna, dowolna liczba ras)
// Zastępuje dawne osobne komponenty Werewolves.js/Vampires.js/Mag.js
// (po jednym na sztywno zakodowaną frakcję) - teraz jeden komponent
// parametryzowany kluczem rasy z URL (/home/:raceKey).

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sanitizeHtml from './sanitizeHtml';
import {
  uploadEditorImage,
  validateEditorImage,
  resolveUploadUrl,
  EDITOR_IMAGE_ACCEPT,
} from './uploadEditorImage';
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
  Stack,
  Tooltip,
  Popover,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Chip } from '@mui/material';
import { PanelPage, PanelHeader, panelAddButtonSx, panelRowSx } from './PanelUI';
import { getRaceColorSet } from './theme';

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
  },
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
                decorations.push(
                  Decoration.inline(start, end, { style: 'color: #333 !important;' })
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

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
  '#0f0f0f',
  '#f0f0f0',
  '#a0522d',
  '#8b0000',
  '#556b2f',
  '#483d8b',
  '#6b7280',
  '#2f4f4f',
  '#800080',
  '#cd853f'
];

const ToolbarButton = ({ onClick, active, children, label }) => (
  <Tooltip title={label} arrow>
    <Button
      size="small"
      variant={active ? 'contained' : 'outlined'}
      onClick={onClick}
      sx={{ minWidth: 36, minHeight: 36, p: 0, mx: 0.3 }}
      type="button"
    >
      {children}
    </Button>
  </Tooltip>
);

const RaceHall = () => {
  const { raceKey } = useParams();
  const navigate = useNavigate();

  const [race, setRace] = useState(null);
  const [raceLoading, setRaceLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', id: null, image: null });
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState('mieszkaniec');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState(null);
  const [imageDialog, setImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageWidth, setImageWidth] = useState(300);
  const [imagePreview, setImagePreview] = useState('');
  const [imageAlign, setImageAlign] = useState('left');

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
  const isMobile = useMediaQuery('(max-width: 600px)');
  const fileInputRef = useRef(null);

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
    ],
    content: formData.description,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, description: editor.getHTML() }));
    },
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && editor && editor.view) {
      const timer = setTimeout(() => {
        if (editor.isDestroyed) return;
        editor.commands.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (editor && formData.description !== editor.getHTML()) {
      editor.commands.setContent(formData.description || '');
    }
  }, [formData.description, editor]);

  // Wczytaj rasę (nazwa do nagłówka, walidacja że klucz z URL istnieje)
  useEffect(() => {
    setRaceLoading(true);
    fetch(`/api/races/${raceKey}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(data => setRace(data))
      .catch(() => {
        // Nieznany klucz rasy w URL - wróć na stronę główną zamiast pustego widoku
        navigate('/home');
      })
      .finally(() => setRaceLoading(false));
  }, [raceKey, navigate]);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (token) {
      const payload = decodeJwtPayload(token);
      const role = payload?.role || 'mieszkaniec';
      setUserRole(role);
    } else {
      setUserRole('mieszkaniec');
    }

    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceKey]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (openDialog) {
          handleCloseDialog();
        }
        if (imageDialog) {
          handleCloseImageDialog();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [openDialog, imageDialog]);

  const fetchEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/race-pages/${raceKey}`, { headers: { Authorization: `Bearer ${token}` } });

      const sorted = res.data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0);
        const dateB = new Date(b.created_at || b.createdAt || 0);
        return dateA - dateB;
      });

      setEntries(sorted);
    } catch (error) {
      console.error('Błąd pobierania wpisów rasy:', error);
    }
  };

  const toggleExpand = (id) => {
    if (isMobile) {
      setExpandedEntry(expandedEntry === id ? null : id);
    } else {
      const selected = entries.find(w => w.id === id);
      setDialogContent(selected);
      setOpenDialog(true);
    }
  };

  const startEditing = (entry) => {
    setFormData({ title: entry.title, description: entry.description, id: entry.id, image: null });
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

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, image: e.target.files[0] }));
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

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    if (formData.image) data.append('image', formData.image);

    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (formData.id) {
        await axios.put(`/api/race-pages/${formData.id}`, data, { headers });
      } else {
        await axios.post(`/api/race-pages/${raceKey}`, data, { headers });
      }
      fetchEntries();
      setFormData({ title: '', description: '', id: null, image: null });
      setIsEditing(false);
      editor.commands.clearContent();
    } catch (error) {
      console.error('Błąd zapisu wpisu rasy:', error.response?.data || error.message);
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
      title: 'Usuwanie wpisu',
      message: 'Czy na pewno chcesz usunąć ten wpis?',
      confirmText: 'Usuń',
      confirmColor: 'error',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, open: false });
        try {
          await axios.delete(`/api/race-pages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          setEntries(prev => prev.filter(w => w.id !== id));
        } catch (error) {
          console.error('Błąd usuwania wpisu rasy:', error.response?.data || error.message);
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

  if (raceLoading || !editor) return null;

  return (
    <PanelPage>
      <PanelHeader eyebrow="// RASA" title={race?.name || raceKey} theme={theme} />

      {/* Blok wprowadzający oparty o dane rasy z tabeli races (opis/cechy/kolor
          ustawiane przez admina w kreatorze) - osobne od wpisów CMS (race-pages) niżej */}
      {(race?.description || race?.traits) && (() => {
        const rc = getRaceColorSet(race?.color, { name: race?.name, key: race?.key });
        return (
        <Card sx={{
          mb: 4,
          p: 2.5,
          borderLeft: `6px solid ${rc.primary}`,
          backgroundColor: rc.light,
        }}>
          {race?.description && (
            <Typography sx={{ color: theme.palette.text.primary, mb: race?.traits ? 1.5 : 0, lineHeight: 1.6 }}>
              {race.description}
            </Typography>
          )}
          {race?.traits && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {String(race.traits).split(',').map((t) => t.trim()).filter(Boolean).map((trait) => (
                <Chip
                  key={trait}
                  label={trait}
                  size="small"
                  sx={{
                    borderRadius: 0,

                    backgroundColor: rc.light,
                    color: rc.accent,
                    border: `1px solid ${rc.border}`,
                  }}
                />
              ))}
            </Stack>
          )}
        </Card>
        );
      })()}

      {userRole === 'admin' && !isEditing && (
        <Button
          sx={panelAddButtonSx(theme)}
          onClick={() => {
            setFormData({ title: '', description: '', id: null, image: null });
            setIsEditing(true);
          }}
        >
          Dodaj informacje
        </Button>
      )}

      {isEditing && userRole === 'admin' && (
        <Card sx={{ mb: 4, p: 2 }}>
          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <TextField
              fullWidth
              label="Tytuł wpisu"
              variant="outlined"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              sx={{ mb: 2 }}
            />

            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" alignItems="center">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie">
                <FormatBoldIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa">
                <FormatItalicIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie">
                <FormatUnderlinedIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} label="Kolor tła">
                <FormatColorFillIcon />
              </ToolbarButton>

              <ToolbarButton onClick={(e) => setAnchorTextColor(e.currentTarget)} active={false} label="Kolor tekstu">
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

              <Box sx={{ width: '1px', height: '24px', bgcolor: 'grey.300', mx: 1 }} />

              <ToolbarButton onClick={addImage} label="Dodaj obrazek z URL">
                <InsertPhotoIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Dodaj obrazek z komputera">
                <FileUploadIcon />
              </ToolbarButton>

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

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={EDITOR_IMAGE_ACCEPT}
              onChange={handleFileSelect}
            />

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
                <Button onClick={() => { editor.chain().focus().unsetColor().run(); setAnchorTextColor(null); }} sx={{ ml: 1 }} variant="outlined">
                  Resetuj
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
                <Button onClick={() => { editor.chain().focus().unsetHighlight().run(); setAnchorBgColor(null); }} sx={{ ml: 1 }} variant="outlined">
                  Resetuj
                </Button>
              </Stack>
            </Popover>

            <Box sx={{ mb: 2 }}>
              <input
                accept={EDITOR_IMAGE_ACCEPT}
                type="file"
                onChange={handleFileChange}
                style={{ display: 'block', margin: '8px 0' }}
              />
              {formData.image && <Typography variant="body2">Wybrano: {formData.image.name}</Typography>}
            </Box>

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

      <Dialog
        open={imageDialog}
        onClose={handleCloseImageDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={false}
      >
        <DialogTitle>
          Konfiguracja obrazka
          <IconButton
            onClick={handleCloseImageDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'grey.500',
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
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

      {entries.map((entry) => (
        <Card key={entry.id} sx={panelRowSx(theme)}>
          <CardContent onClick={() => toggleExpand(entry.id)} sx={{ cursor: 'pointer' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {entry.title}
              </Typography>
              {userRole === 'admin' && (
                <Box onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(entry);
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
                      handleDelete(entry.id);
                    }}
                  >
                    Usuń
                  </Button>
                </Box>
              )}
            </Box>
          </CardContent>

          {!isMobile ? (
            <Modal
              open={openDialog && dialogContent?.id === entry.id}
              onClose={handleCloseDialog}
              closeAfterTransition
              BackdropProps={{
                style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
                onClick: handleCloseDialog
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
                    zIndex: 1,
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    }
                  }}
                >
                  <CloseIcon />
                </IconButton>

                {dialogContent?.image && (
                  <Box
                    component="img"
                    src={resolveUploadUrl(dialogContent.image)}
                    alt={dialogContent.title}
                    sx={{
                      width: '100%',
                      maxHeight: '300px',
                      objectFit: 'cover',
                      mb: 2,
                      pt: 2
                    }}
                  />
                )}

                <Box
                  sx={{ pt: dialogContent?.image ? 0 : 2 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(dialogContent?.description) }}
                />
              </Box>
            </Modal>
          ) : (
            <Collapse in={expandedEntry === entry.id} timeout="auto" unmountOnExit>
              <CardContent>
                {entry.image && (
                  <Box
                    component="img"
                    src={resolveUploadUrl(entry.image)}
                    alt={entry.title}
                    sx={{ width: '100%', maxHeight: '300px', objectFit: 'cover', mb: 2 }}
                  />
                )}
                <Box
                  sx={quillStyle}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.description) }}
                />
              </CardContent>
            </Collapse>
          )}
        </Card>
      ))}
    </PanelPage>
  );
};

export default RaceHall;
