// Gaaran Engine 1.0 - please do not share or use without permission
// Author: Gaaran
// Date: 2025-02-20
// Version: 1.0
// Description: A simple engine for texting games
// License: MIT
// Copyright (c) 2025 Gaaran
// If you want to use it please contact me on Discord: cerber941
// or email: vangalloth@gmail.com
// Notatki postaci

import { useState, useEffect, useRef } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import ConfirmDialog from './ConfirmDialog';
import axios from 'axios';
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
  IconButton,
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
  '#0f0f0f', '#f0f0f0', '#a0522d', '#8b0000', '#556b2f',
  '#483d8b', '#6b7280', '#2f4f4f', '#800080', '#cd853f'
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

const CharacterNotes = () => {
  const [notes, setNotes] = useState([]);
  const [expandedNote, setExpandedNote] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', id: null });
  const [isEditing, setIsEditing] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState(null);

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

  const [anchorTextColor, setAnchorTextColor] = useState(null);

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
    content: formData.content,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, content: editor.getHTML() }));
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
    if (editor && formData.content !== editor.getHTML()) {
      editor.commands.setContent(formData.content || '');
    }
  }, [formData.content, editor]);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (openDialog) {
          handleCloseDialog();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [openDialog]);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/notes', { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const sortedNotes = res.data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.createdAt || 0);
        const dateB = new Date(b.created_at || b.createdAt || 0);
        return dateA - dateB;
      });
      
      setNotes(sortedNotes);
    } catch (error) {
      console.error('Błąd pobierania notatek:', error);
    }
  };

  const toggleExpand = (id) => {
    if (!isLargeScreen) {
      setExpandedNote(expandedNote === id ? null : id);
    } else {
      const selected = notes.find(n => n.id === id);
      setDialogContent(selected);
      setOpenDialog(true);
    }
  };

  const startEditing = (note) => {
    setFormData({ title: note.title, content: note.content, id: note.id });
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

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    // Format i rozmiar sprawdzamy tymi samymi regułami co backend.
    const validationError = file ? validateEditorImage(file) : 'Nie wybrano pliku';
    event.target.value = '';

    if (validationError) {
      setAlertDialog({
        open: true,
        title: 'Błąd',
        message: validationError
      });
      return;
    }

    try {
      // Plik ląduje na serwerze, a w treści zostaje ścieżka - base64 wysadzało
      // zapis, bo treść nie mieści się w kolumnie TEXT (64 KB).
      const imageUrl = await uploadEditorImage(file);
      editor.chain().focus().setImage({
        src: imageUrl,
        style: 'max-width:300px; height:auto;',
        align: 'left'
      }).run();
    } catch (error) {
      console.error('Błąd dodawania obrazka:', error);
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
    
    if (!formData.title.trim() || !formData.content.trim()) {
      setAlertDialog({
        open: true,
        title: 'Błąd',
        message: 'Tytuł i treść nie mogą być puste!'
      });
      return;
    }

    const headers = { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      if (formData.id) {
        await axios.put(`/api/notes/${formData.id}`, {
          title: formData.title,
          content: formData.content
        }, { headers });
      } else {
        await axios.post('/api/notes', {
          title: formData.title,
          content: formData.content
        }, { headers });
      }
      
      fetchNotes();
      setFormData({ title: '', content: '', id: null });
      setIsEditing(false);
      editor.commands.clearContent();
    } catch (error) {
      console.error('Błąd zapisu notatki:', error.response?.data || error.message);
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
      title: 'Usuwanie notatki',
      message: 'Czy na pewno chcesz usunąć tę notatkę?',
      confirmText: 'Usuń',
      confirmColor: 'error',
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, open: false });
        try {
          await axios.delete(`/api/notes/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setNotes(prev => prev.filter(n => n.id !== id));
        } catch (error) {
          console.error('Błąd usuwania notatki:', error.response?.data || error.message);
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

  if (!editor) return null;

  return (
    <PanelPage>
      <PanelHeader eyebrow="// MOJA POSTAĆ" title="Moje Notatki" theme={theme} />

      {!isEditing && (
        <Button
          sx={panelAddButtonSx(theme)}
          onClick={() => {
            setFormData({ title: '', content: '', id: null });
            setIsEditing(true);
          }}
        >
          Dodaj notatkę
        </Button>
      )}

      {isEditing && (
        <Card sx={{ mb: 4, p: 2 }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Tytuł notatki"
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

      {notes.map((note) => (
        <Card key={note.id} sx={panelRowSx(theme)}>
          <CardContent onClick={() => toggleExpand(note.id)} sx={{ cursor: 'pointer' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {note.title}
              </Typography>
              <Box onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(note);
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
                    handleDelete(note.id);
                  }}
                >
                  Usuń
                </Button>
              </Box>
            </Box>
          </CardContent>

          {isLargeScreen ? (
            <Modal
              open={openDialog && dialogContent?.id === note.id}
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

                <Box 
                  sx={{ pt: 2 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(dialogContent?.content) }} 
                />
              </Box>
            </Modal>
          ) : (
            <Collapse in={expandedNote === note.id} timeout="auto" unmountOnExit>
              <CardContent>
                <Box
                  sx={quillStyle}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
                />
              </CardContent>
            </Collapse>
          )}
        </Card>
      ))}

      {/* Dialog potwierdzenia */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
        confirmText={confirmDialog.confirmText}
        confirmColor={confirmDialog.confirmColor}
      />

      {/* Dialog alertu */}
      <ConfirmDialog
        open={alertDialog.open}
        title={alertDialog.title}
        message={alertDialog.message}
        onConfirm={() => setAlertDialog({ ...alertDialog, open: false })}
        onCancel={() => setAlertDialog({ ...alertDialog, open: false })}
        confirmText="OK"
        hideCancel
      />
    </PanelPage>
  );
};

export default CharacterNotes;