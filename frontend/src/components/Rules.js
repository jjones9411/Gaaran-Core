import { useState, useEffect, useRef } from 'react';
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
  IconButton,
  useTheme,
  useMediaQuery,
  Tooltip,
  Stack,
  Popover,
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

// Extended Image configuration with alignment support
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

const htmlContentStyles = {
  '& p, & div, & span': { margin: '0 0 16px 0', lineHeight: '1.6' },
  textAlign: 'justify',
  '& .ql-align-center': { textAlign: 'center' },
  '& .ql-align-right': { textAlign: 'right' },
  '& .ql-align-left': { textAlign: 'left' },
  '& .ql-align-justify': { textAlign: 'justify' },
  '& .align-center': { textAlign: 'center' },
  '& .align-right': { textAlign: 'right' },
  '& .align-left': { textAlign: 'left' },
  '& .align-justify': { textAlign: 'justify' },
  '& strong': { fontWeight: 'bold' },
  '& em': { fontStyle: 'italic' },
  '& u': { textDecoration: 'underline' },
  '& ol, & ul': { paddingLeft: '32px', marginBottom: '16px' },
  '& li': { marginBottom: '8px' },
  '& h1, & h2': { margin: '24px 0 16px 0', fontWeight: 'bold' },
  '& h1': { fontSize: '2em' },
  '& h2': { fontSize: '1.5em' },
  '& img': { 
    maxWidth: 300, 
    height: 'auto', 
    display: 'block', 
    margin: '8px 0',
    color: 'inherit',
  },
  // Image alignment styles
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

// Function to convert file to base64
const Rules = () => {
  const [rules, setRules] = useState([]);
  const [expandedRule, setExpandedRule] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', id: null, image: null });
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState('mieszkaniec');
  const [openDialog, setOpenDialog] = useState(false);

  // States for image dialog
  const [imageDialog, setImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageWidth, setImageWidth] = useState(300);
  const [imagePreview, setImagePreview] = useState('');
  const [imageAlign, setImageAlign] = useState('left');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isLargeScreen = useIsWideScreen(); // szerokość, nie wysokość okna
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

    fetchRules();
  }, []);

  // ESC key handling for closing modals
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (openDialog || selectedRule) {
          handleCloseDialog();
        }
        if (imageDialog) {
          handleCloseImageDialog();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [openDialog, selectedRule, imageDialog]);

  const fetchRules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/rules', { headers: { Authorization: `Bearer ${token}` } });
      setRules(res.data);
    } catch (err) {
      console.error('Błąd pobierania zasad:', err);
    }
  };

  const toggleExpand = (id) => {
    if (isMobile) {
      setExpandedRule(expandedRule === id ? null : id);
    } else {
      const selected = rules.find((r) => r.id === id);
      setSelectedRule(selected);
      setOpenDialog(true);
    }
  };

  const startEditing = (rule) => {
    setFormData({ title: rule.title, description: rule.description, id: rule.id, image: null });
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

  // Image alignment functions
  const alignImage = (alignment) => {
    if (editor.isActive('image')) {
      editor.chain().focus().setImageAlign(alignment).run();
    } else {
      alert('Najpierw zaznacz obrazek, który chcesz wyrównać');
    }
  };

  // Handle file selection for image upload
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    // Format i rozmiar sprawdzamy tymi samymi regułami co backend.
    const validationError = file ? validateEditorImage(file) : 'Nie wybrano pliku';
    if (!validationError) {
      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
      
      setImageDialog(true);
    } else {
      alert(validationError);
    }
    
    // Reset input
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
      
      // Close dialog and clear state
      setImageDialog(false);
      setSelectedImage(null);
      setImagePreview('');
      setImageWidth(300);
      setImageAlign('left');
    } catch (error) {
      console.error('Błąd podczas dodawania obrazka:', error);
      alert(error.message || 'Wystąpił błąd podczas dodawania obrazka.');
    }
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, image: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!formData.title.trim() || !formData.description.trim()) {
      alert("Tytuł i opis nie mogą być puste!");
      return;
    }

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    if (formData.image) {
      data.append('image', formData.image);
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (formData.id) {
        await axios.put(`/api/rules/${formData.id}`, data, { headers });
        fetchRules();
      } else {
        const res = await axios.post('/api/rules', data, { headers });
        setRules((prev) => [...prev, res.data]);
      }

      setFormData({ title: '', description: '', id: null, image: null });
      setIsEditing(false);
      editor.commands.clearContent();
    } catch (err) {
      console.error('Błąd zapisu zasady:', err.response?.data || err.message);
      alert("Wystąpił błąd podczas zapisu. Sprawdź konsolę.");
    }
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem('token');
    if (!window.confirm('Czy na pewno chcesz usunąć tę zasadę?')) return;
    try {
      await axios.delete(`/api/rules/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Błąd usuwania zasady:', err.response?.data || err.message);
      alert("Wystąpił błąd podczas usuwania.");
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRule(null);
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
      <PanelHeader eyebrow="// PORADNIKI" title="Regulamin" theme={theme} />

      {userRole === 'admin' && !isEditing && (
        <Button sx={panelAddButtonSx(theme)} onClick={() => {
          setFormData({ title: '', description: '', id: null, image: null });
          setIsEditing(true);
        }}>
          Dodaj Zasadę
        </Button>
      )}

      {isEditing && userRole === 'admin' && (
        <Card sx={{ mb: 4, p: 2 }}>
          <form onSubmit={handleSubmit} encType="multipart/form-data">
            <TextField
              fullWidth
              label="Tytuł zasady"
              variant="outlined"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              sx={{ mb: 2 }}
            />

            {/* Enhanced Toolbar with image alignment buttons */}
            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" alignItems="center">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Pogrubienie"><FormatBoldIcon /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Kursywa"><FormatItalicIcon /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Podkreślenie"><FormatUnderlinedIcon /></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} label="Kolor tła"><FormatColorFillIcon /></ToolbarButton>

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

              {/* Separator */}
              <Box sx={{ width: '1px', height: '24px', bgcolor: 'grey.300', mx: 1 }} />

              <ToolbarButton onClick={addImage} label="Dodaj obrazek z URL">
                <InsertPhotoIcon />
              </ToolbarButton>
              <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Dodaj obrazek z komputera">
                <FileUploadIcon />
              </ToolbarButton>

              {/* Image alignment buttons */}
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

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={EDITOR_IMAGE_ACCEPT}
              onChange={handleFileSelect}
            />

            {/* Text color popup */}
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
                <Button onClick={() => { editor.chain().focus().unsetColor().run(); setAnchorTextColor(null); }} sx={{ ml: 1 }} variant="outlined">Resetuj</Button>
              </Stack>
            </Popover>

            {/* Background color popup */}
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
                <Button onClick={() => { editor.chain().focus().unsetHighlight().run(); setAnchorBgColor(null); }} sx={{ ml: 1 }} variant="outlined">Resetuj</Button>
              </Stack>
            </Popover>

            {/* Main rule image upload */}
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
                // Image alignment styles
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
              <Button type="submit" variant="contained" color="primary">Zapisz</Button>
              <Button variant="outlined" color="secondary" sx={{ ml: 2 }} onClick={() => setIsEditing(false)}>Anuluj</Button>
            </Box>
          </form>
        </Card>
      )}

      {/* Image configuration dialog */}
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

      {rules.map((rule) => (
        <Card key={rule.id} sx={panelRowSx(theme)}>
          <CardContent onClick={() => toggleExpand(rule.id)} sx={{ cursor: 'pointer' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {rule.title}
              </Typography>
              {userRole === 'admin' && (
                <Box onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(rule);
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
                      handleDelete(rule.id);
                    }}
                  >
                    Usuń
                  </Button>
                </Box>
              )}
            </Box>
          </CardContent>

          {isMobile ? (
            <Collapse in={expandedRule === rule.id} timeout="auto" unmountOnExit>
              <CardContent>
                {(rule.image_path || rule.image) && (
                  <Box
                    component="img"
                    src={resolveUploadUrl(rule.image_path || rule.image)}
                    alt={rule.title}
                    sx={{ width: '100%', maxHeight: 300, objectFit: 'cover', mb: 2 }}
                  />
                )}
                <Box sx={htmlContentStyles} dangerouslySetInnerHTML={{ __html: sanitizeHtml(rule.description) }} />
              </CardContent>
            </Collapse>
          ) : (
            <Modal
              open={openDialog && selectedRule?.id === rule.id}
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
    ...htmlContentStyles,
    color: theme.palette.text.primary, // DODAJ TO - wymusza ciemny kolor
    '& p, & div, & span, & li, & h1, & h2': {
      color: 'inherit',
    }
  }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button in top right corner */}
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

                {/* Rule image in modal */}
                {(selectedRule?.image_path || selectedRule?.image) && (
                  <Box
                    component="img"
                    src={resolveUploadUrl(selectedRule.image_path || selectedRule.image)}
                    alt={selectedRule.title}
                    sx={{ 
                      width: '100%', 
                      maxHeight: '300px', 
                      objectFit: 'cover', 
                      mb: 2,
                      pt: 2
                    }}
                  />
                )}
                
                {/* Modal content */}
                <Box 
                  sx={{ pt: selectedRule?.image ? 0 : 2 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedRule?.description) }} 
                />
              </Box>
            </Modal>
          )}
        </Card>
      ))}
    </PanelPage>
  );
};

export default Rules;