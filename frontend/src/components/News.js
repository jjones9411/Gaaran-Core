import React, { useState, useEffect, useRef } from 'react';
import sanitizeHtml from './sanitizeHtml';
import { uploadEditorImage, validateEditorImage, EDITOR_IMAGE_ACCEPT } from './uploadEditorImage';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Tooltip,
  Popover,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from './AuthContext';
import { getRaceColorSet, appColors } from './theme';
import { EditorContent, useEditor, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import LinkExtension from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Node, mergeAttributes } from '@tiptap/core';

import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { useTheme } from '@mui/material/styles';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import LinkIcon from '@mui/icons-material/Link';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import VideocamIcon from '@mui/icons-material/Videocam';

const quillStyle = {
  color: 'inherit',
  // Normalizujemy kolor tylko dla elementów BEZ własnego koloru w stylu inline,
  // żeby nie nadpisywać kolorów tekstu ustawionych świadomie w edytorze.
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
              if (!text) return;
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

// Custom TipTap node for embedded video (YouTube iframe or HTML5 video)
const VideoNode = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      embedType: { default: 'video' }, // 'video' or 'iframe'
      width: { default: '100%' },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-video-embed]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    if (HTMLAttributes.embedType === 'iframe') {
      return ['div', mergeAttributes({ 'data-video-embed': true, style: 'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:8px 0;' }),
        ['iframe', {
          src: HTMLAttributes.src,
          style: 'position:absolute;top:0;left:0;width:100%;height:100%;',
          frameborder: '0',
          allowfullscreen: true,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        }],
      ];
    }
    return ['div', mergeAttributes({ 'data-video-embed': true, style: 'margin:8px 0;' }),
      ['video', {
        src: HTMLAttributes.src,
        controls: true,
        style: 'max-width:100%;height:auto;display:block;',
      }],
    ];
  },

  addCommands() {
    return {
      insertVideoEmbed: (attrs) => ({ commands }) => {
        return commands.insertContent({ type: this.name, attrs });
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
    >
      {children}
    </Button>
  </Tooltip>
);

// Etykieta widoczności wieści (rasy) - sam napis, bez wypełnienia i ramki,
// tak jak tagi w profilu.
const visibilityTagSx = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const CommentsSection = React.memo(({
  newsId,
  comments,
  expandedComments,
  newComment,
  loadingComments,
  commentsCount,
  onToggleComments,
  onAddComment,
  onDeleteComment,
  onCommentChange
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const newsComments = comments[newsId] || [];
  const isExpanded = expandedComments[newsId] || false;
  const isLoading = loadingComments[newsId] || false;
  const commentText = newComment[newsId] || '';
  const count = commentsCount[newsId] || 0;

  return (
    <Box sx={{ mt: 1, pt: 1 }}>
      <Button
        onClick={() => onToggleComments(newsId)}
        disableRipple
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textTransform: 'none',
          color: 'text.secondary',
          // Bez wypełnienia i ramki - przełącznik jest zwykłym napisem
          // w tej samej konwencji co reszta wieści.
          bgcolor: 'transparent',
          border: 'none',
          borderRadius: 0,
          px: 0,
          py: 0.5,
          mb: isExpanded ? 1.5 : 0,
          '&:hover': {
            bgcolor: 'transparent',
            color: 'primary.main',
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">
            💬 Komentarze ({count})
          </Typography>
        </Box>
        <Typography variant="body2">
          {isExpanded ? '▲ Zwiń' : '▼ Rozwiń'}
        </Typography>
      </Button>

      {isExpanded && (
        <Box sx={{ pl: 1 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="Napisz komentarz..."
              value={commentText}
              onChange={(e) => onCommentChange(newsId, e.target.value)}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  fontSize: '0.9rem'
                }
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => onAddComment(newsId)}
              disabled={!commentText.trim()}
              sx={{ fontSize: '0.8rem' }}
            >
              Dodaj komentarz
            </Button>
          </Box>

          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Ładowanie komentarzy...
              </Typography>
            </Box>
          ) : newsComments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Brak komentarzy. Dodaj pierwszy!
              </Typography>
            </Box>
          ) : (
            <Stack spacing={0}>
              {newsComments.map((comment) => {
                if (!comment || !comment.id) return null;

                const currentCharacterId = user?.characterId;
                const commentAuthorId = parseInt(comment.author_id);
                const canDelete = user?.role === 'admin' || currentCharacterId === commentAuthorId;

                return (
                  <Box
                    key={comment.id}
                    sx={{
                      py: 1.5,
                      // Komentarze rozdziela cienka linia zamiast osobnych kart.
                      borderTop: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                      '&:first-of-type': { borderTop: 'none', pt: 0 },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 'bold',
                            color: appColors.statusGold,
                            cursor: 'pointer',
                            textDecoration: 'none',
                            '&:hover': {
                              color: appColors.statusWarning,
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={() => navigate(`/home/profile/${comment.author_id}`)}
                        >
                          👤 {comment.author_name || 'Nieznany'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          📅 {comment.created_at ? new Date(comment.created_at).toLocaleString('pl-PL') : 'Brak daty'}
                        </Typography>
                      </Box>
                      {canDelete && (
                        <IconButton
                          size="small"
                          onClick={() => onDeleteComment(newsId, comment.id)}
                          sx={{ color: appColors.statusNeutral, '&:hover': { color: appColors.statusDanger } }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                      {comment.content || ''}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
});

const News = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ title: '', content: '', id: null });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFactions, setSelectedFactions] = useState([]);
  const [races, setRaces] = useState([]);

  // Dostępne rasy - w pełni dynamiczne (tabela races, dowolna liczba, edytowalne przez admina)
  useEffect(() => {
    fetch('/api/races')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';
  const getRaceColor = (key) => {
    const r = races.find(rr => rr.key === key);
    return getRaceColorSet(r?.color, { name: r?.name, key });
  };

  const [comments, setComments] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [commentsCount, setCommentsCount] = useState({});

  const [imageDialog, setImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageWidth, setImageWidth] = useState(300);
  const [imagePreview, setImagePreview] = useState('');
  const [imageAlign, setImageAlign] = useState('left');

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');

  const fileInputRef = useRef(null);
  const videoFileInputRef = useRef(null);

  const [videoDialog, setVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoUploadProgress, setVideoUploadProgress] = useState(false);

  const [anchorTextColor, setAnchorTextColor] = useState(null);
  const [anchorBgColor, setAnchorBgColor] = useState(null);

  // 🔧 POPRAWKA: Usunięto isEditing z zależności useEditor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension,
      CustomImage.configure({
        inline: false,
        allowBase64: true,
      }),
      StarColorExtension,
      VideoNode,
    ],
    content: formData.content,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      setFormData((prev) => ({ ...prev, content: editor.getHTML() }));
    },
  });

  // 🔧 POPRAWKA: Dodano useEffect do aktualizacji editable
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  const handleCommentChange = React.useCallback((newsId, value) => {
    setNewComment(prev => ({
      ...prev,
      [newsId]: value
    }));
  }, []);

  const fetchComments = React.useCallback(async (newsId) => {
    if (!newsId) return;
    
    try {
      setLoadingComments(prev => ({ ...prev, [newsId]: true }));
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('Brak tokenu - nie można pobrać komentarzy');
        return;
      }

      const response = await axios.get(`/api/news/${newsId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && Array.isArray(response.data)) {
        setComments(prev => ({ 
          ...prev, 
          [newsId]: response.data 
        }));
        setCommentsCount(prev => ({
          ...prev,
          [newsId]: response.data.length
        }));
      }
    } catch (error) {
      console.error('Błąd pobierania komentarzy:', error);
      setComments(prev => ({ 
        ...prev, 
        [newsId]: [] 
      }));
    } finally {
      setLoadingComments(prev => ({ ...prev, [newsId]: false }));
    }
  }, []);

  const fetchCommentsCount = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !Array.isArray(news) || news.length === 0) return;

      const response = await axios.get('/api/news/comments/count', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && typeof response.data === 'object') {
        setCommentsCount(response.data);
      }
    } catch (error) {
      console.error('Błąd pobierania liczby komentarzy:', error);
    }
  }, [news]);

  const handleAddComment = React.useCallback(async (newsId) => {
    if (!newsId || !newComment[newsId]?.trim()) {
      alert('Komentarz nie może być pusty!');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Brak autoryzacji!');
        return;
      }

      const response = await axios.post(`/api/news/${newsId}/comments`, {
        content: newComment[newsId].trim()
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data) {
        setNewComment(prev => ({ 
          ...prev, 
          [newsId]: '' 
        }));

        if (expandedComments[newsId]) {
          await fetchComments(newsId);
        } else {
          setCommentsCount(prev => ({
            ...prev,
            [newsId]: (prev[newsId] || 0) + 1
          }));
        }
      }
    } catch (error) {
      console.error('Błąd dodawania komentarza:', error);
      if (error.response) {
        alert(`Błąd: ${error.response.data?.error || error.response.statusText}`);
      } else {
        alert('Wystąpił błąd podczas dodawania komentarza');
      }
    }
  }, [newComment, expandedComments, fetchComments]);

  const handleDeleteComment = React.useCallback(async (newsId, commentId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten komentarz?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Brak autoryzacji!');
        return;
      }

      await axios.delete(`/api/news/${newsId}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchComments(newsId);
      
      setCommentsCount(prev => ({
        ...prev,
        [newsId]: Math.max((prev[newsId] || 1) - 1, 0)
      }));

    } catch (error) {
      console.error('Błąd usuwania komentarza:', error);
      if (error.response) {
        alert(`Błąd: ${error.response.data?.error || error.response.statusText}`);
      } else {
        alert('Wystąpił błąd podczas usuwania komentarza');
      }
    }
  }, [fetchComments]);

  const handleToggleComments = React.useCallback(async (newsId) => {
    const isExpanded = expandedComments[newsId];
    
    setExpandedComments(prev => ({
      ...prev,
      [newsId]: !isExpanded
    }));

    if (!isExpanded && !comments[newsId]) {
      await fetchComments(newsId);
    }
  }, [expandedComments, comments, fetchComments]);

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
    if (editor && formData.content !== editor.getHTML()) {
      editor.commands.setContent(formData.content || '');
    }
  }, [formData.content, editor]);

useEffect(() => {
  const initializeData = async () => {
    await fetchNews();
  };
  
  initializeData();
}, []); // Usunięto setuser?.role

  useEffect(() => {
    if (news && Array.isArray(news) && news.length > 0) {
      fetchCommentsCount();
    }
  }, [news, fetchCommentsCount]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.warn('Brak tokenu - nie można pobrać wieści');
        setNews([]);
        return;
      }

      const res = await axios.get('/api/news', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data && Array.isArray(res.data)) {
        setNews(res.data);
      } else if (res.data === null || res.data === undefined) {
        console.warn('Serwer zwrócił null/undefined - ustawiam pustą tablicę');
        setNews([]);
      } else {
        console.warn('Nieprawidłowy format danych z serwera:', res.data);
        setNews([]);
      }
    } catch (err) {
      console.error('Błąd pobierania wieści:', err);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (imageSrc) => {
    setLightboxImage(imageSrc);
    setLightboxOpen(true);
  };

  useEffect(() => {
    if (!news || !Array.isArray(news) || news.length === 0) return;

    const addImageClickListeners = () => {
      const images = document.querySelectorAll('.news-content img');
      images.forEach(img => {
        img.style.cursor = 'pointer';
        img.onclick = () => handleImageClick(img.src);
      });
    };

    const timer = setTimeout(addImageClickListeners, 100);
    return () => clearTimeout(timer);
  }, [news]);

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setLightboxImage('');
  };

  const startEditing = (newsItem) => {
    if (!newsItem) return;

    setFormData({
      title: newsItem.title || '',
      content: newsItem.content || '',
      id: newsItem.id || null
    });

    // Ustaw wybrane rasy przy edycji
    if (newsItem.visible_to) {
      try {
        const factions = typeof newsItem.visible_to === 'string'
          ? JSON.parse(newsItem.visible_to)
          : newsItem.visible_to;
        setSelectedFactions(Array.isArray(factions) ? factions : []);
      } catch {
        setSelectedFactions([]);
      }
    } else {
      setSelectedFactions([]);
    }

    setIsEditing(true);
  };

  const handleFactionChange = (faction) => {
    setSelectedFactions(prev => {
      if (prev.includes(faction)) {
        return prev.filter(f => f !== faction);
      } else {
        return [...prev, faction];
      }
    });
  };

  const addImage = () => {
    const url = window.prompt('Wklej URL obrazka');
    if (url && editor) {
      editor.chain().focus().setImage({ 
        src: url, 
        style: 'max-width:300px; height:auto;',
        align: 'left'
      }).run();
    }
  };

  const alignImage = (alignment) => {
    if (editor && editor.isActive('image')) {
      editor.chain().focus().setImageAlign(alignment).run();
    } else {
      alert('Najpierw zaznacz obrazek, który chcesz wyrównać');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
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
      alert(validationError);
    }
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const insertImageFromFile = async () => {
    if (!selectedImage || !editor) return;

    try {
      // Helper zwraca ścieżkę z prefiksem /api - wcześniej wstawiane było samo
      // /uploads/..., czyli adres na froncie, który po zapisie leciał na 404.
      const imageUrl = await uploadEditorImage(selectedImage);

      editor.chain().focus().setImage({
        src: imageUrl,
        style: `max-width:${imageWidth}px; height:auto;`,
        align: imageAlign,
      }).run();
    } catch (error) {
      // Bez fallbacku na base64: treść newsa idzie do kolumny TEXT (64 KB),
      // więc data: URI i tak wysadzało zapis - lepiej powiedzieć, co poszło nie tak.
      console.error('Błąd uploadu obrazka:', error);
      alert(error.message || 'Wystąpił błąd podczas dodawania obrazka.');
      return;
    }

    setImageDialog(false);
    setSelectedImage(null);
    setImagePreview('');
    setImageWidth(300);
    setImageAlign('left');
  };

  const handleCloseImageDialog = () => {
    setImageDialog(false);
    setSelectedImage(null);
    setImagePreview('');
    setImageWidth(300);
    setImageAlign('left');
  };

  // Wstawianie wideo przez URL (YouTube lub bezpośredni link)
  const insertVideo = () => {
    if (!editor || !videoUrl.trim()) return;

    const url = videoUrl.trim();
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);

    if (ytMatch) {
      editor.commands.insertVideoEmbed({
        src: `https://www.youtube.com/embed/${ytMatch[1]}`,
        embedType: 'iframe',
      });
    } else if (vimeoMatch) {
      editor.commands.insertVideoEmbed({
        src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
        embedType: 'iframe',
      });
    } else {
      // Bezpośredni plik wideo
      editor.commands.insertVideoEmbed({ src: url, embedType: 'video' });
    }

    setVideoDialog(false);
    setVideoUrl('');
  };

  // Upload pliku wideo z dysku
  const handleVideoFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    if (!allowedTypes.includes(file.type)) {
      alert('Obsługiwane formaty wideo: MP4, WebM, OGG');
      if (event.target) event.target.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Plik wideo nie może być większy niż 50MB');
      if (event.target) event.target.value = '';
      return;
    }

    try {
      setVideoUploadProgress(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/news-videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload wideo nie powiódł się');

      const data = await response.json();
      if (editor) {
        // Pliki z backendu chodzą przez prefiks /api - tak samo jak avatary.
        editor.commands.insertVideoEmbed({ src: `/api${data.videoPath}`, embedType: 'video' });
      }
    } catch (error) {
      console.error('Błąd uploadu wideo:', error);
      alert('Błąd podczas przesyłania wideo: ' + error.message);
    } finally {
      setVideoUploadProgress(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Tytuł i treść nie mogą być puste!");
      return;
    }

    if (!token) {
      alert("Brak autoryzacji!");
      return;
    }

    // Dodaj visible_to do danych (pusta tablica = dla wszystkich)
    const data = {
      title: formData.title,
      content: formData.content,
      visible_to: selectedFactions
    };
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
      if (formData.id) {
        await axios.put(`/api/news/${formData.id}`, data, { headers });
      } else {
        await axios.post('/api/news', data, { headers });
      }

      await fetchNews();
      setIsEditing(false);
      setFormData({ title: '', content: '', id: null });
      setSelectedFactions([]);

      if (editor) {
        editor.commands.clearContent();
      }
    } catch (err) {
      console.error('Błąd zapisu wieści:', err.response?.data || err.message);
      alert("Wystąpił błąd podczas zapisu. Sprawdź konsolę.");
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Czy na pewno chcesz zarchiwizować tę wieść?')) return;
    if (!id) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert("Brak autoryzacji!");
        return;
      }

      await axios.post(`/api/news/archive/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNews();
    } catch (err) {
      console.error('Błąd archiwizacji:', err);
      alert('Wystąpił błąd podczas archiwizacji');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography>Ładowanie wieści...</Typography>
      </Box>
    );
  }

  if (!Array.isArray(news)) {
    console.error('News nie jest tablicą:', news);
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography color="error">Błąd ładowania wieści. Odśwież stronę.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', color: 'text.primary', p: { xs: 1, sm: 2 } }}>

      {/* Nagłówek sekcji */}
      <Box sx={{
        width: '100%',
        maxWidth: '1200px',
        mb: 3,
        pb: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: (t) => `2px solid ${t.palette.primary.main}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 4, height: 28, bgcolor: 'primary.main', flexShrink: 0 }} />
          <Typography sx={{
            
            fontWeight: 700,
            fontSize: { xs: '1.2rem', sm: '1.5rem' },
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'primary.main',
            lineHeight: 1,
          }}>
            // WIEŚCI
          </Typography>
        </Box>

        {(user?.role === 'admin' || user?.role === 'mistrz_gry') && !isEditing && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            sx={{ borderRadius: 0,  textTransform: 'uppercase', letterSpacing: '0.08em' }}
            onClick={() => {
              setFormData({ title: '', content: '', id: null });
              setSelectedFactions([]);
              setIsEditing(true);
            }}
          >
            + Nowa Wieść
          </Button>
        )}
      </Box>

      {isEditing && (user?.role === 'admin' || user?.role === 'mistrz_gry') && editor && (
        <Box sx={{
          mb: 4,
          pt: 2,
          pb: 2,
          width: '100%',
          maxWidth: '1200px',
          // Formularz też bez czarnej karty - oddziela go linia u góry,
          // tak jak nagłówki wieści niżej.
          backgroundColor: 'transparent',
          border: 'none',
          borderTop: (t) => `2px solid ${t.palette.primary.main}`,
          boxShadow: 'none',
        }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Tytuł wieści"
              variant="outlined"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              sx={{ mb: 2 }}
            />

            {/* Wybór widoczności dla rasy */}
            <Box sx={{
              mb: 2,
              p: 2,
              border: '1px solid rgba(156, 163, 175, 0.3)',
              borderRadius: 1,
              bgcolor: 'rgba(0, 0, 0, 0.2)'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
                Widoczność wieści:
              </Typography>
              <FormGroup row>
                {races.map((race) => (
                  <FormControlLabel
                    key={race.key}
                    control={
                      <Checkbox
                        checked={selectedFactions.includes(race.key)}
                        onChange={() => handleFactionChange(race.key)}
                        sx={{
                          color: theme.palette.text.secondary,
                          '&.Mui-checked': {
                            color: getRaceColor(race.key).primary
                          }
                        }}
                      />
                    }
                    label={race.name}
                    sx={{ color: theme.palette.text.secondary }}
                  />
                ))}
              </FormGroup>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 1, display: 'block' }}>
                {selectedFactions.length === 0
                  ? '📢 Widoczna dla WSZYSTKICH rasy'
                  : `🔒 Widoczna tylko dla: ${selectedFactions.map(getRaceName).join(', ')}`}
              </Typography>
            </Box>

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
              <ToolbarButton onClick={(e) => setAnchorBgColor(e.currentTarget)} active={editor.isActive('highlight')} label="Kolor tła">
                <FormatColorFillIcon />
              </ToolbarButton>

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
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} label="Cytat">
                <FormatQuoteIcon />
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

              <ToolbarButton
                onClick={() => {
                  const url = window.prompt('Wklej URL linku');
                  if (url && editor) editor.chain().focus().setLink({ href: url }).run();
                }}
                label="Dodaj link"
              >
                <LinkIcon />
              </ToolbarButton>

              <Box sx={{ width: '1px', height: '24px', bgcolor: 'grey.300', mx: 1 }} />

              <ToolbarButton onClick={() => setVideoDialog(true)} label="Wstaw wideo (URL/YouTube)">
                <VideoCallIcon />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => videoFileInputRef.current?.click()}
                label={videoUploadProgress ? 'Przesyłanie...' : 'Wgraj wideo z dysku (MP4/WebM)'}
                active={videoUploadProgress}
              >
                <VideocamIcon />
              </ToolbarButton>
            </Stack>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept={EDITOR_IMAGE_ACCEPT}
              onChange={handleFileSelect}
            />
            <input
              type="file"
              ref={videoFileInputRef}
              style={{ display: 'none' }}
              accept="video/mp4,video/webm,video/ogg"
              onChange={handleVideoFileSelect}
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
                      if (editor) {
                        editor.chain().focus().setColor(color).run();
                      }
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
                      boxShadow: editor && editor.isActive('textStyle', { color }) ? '0 0 5px 2px gold' : 'none',
                    }}
                  />
                ))}
                <Button
                  onClick={() => {
                    if (editor) {
                      editor.chain().focus().unsetColor().run();
                    }
                    setAnchorTextColor(null);
                  }}
                  sx={{ ml: 1 }}
                  variant="outlined"
                >
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
                      if (editor) {
                        editor.chain().focus().setHighlight({ color }).run();
                      }
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
                      boxShadow: editor && editor.isActive('highlight', { color }) ? '0 0 5px 2px gold' : 'none',
                    }}
                  />
                ))}
                <Button
                  onClick={() => {
                    if (editor) {
                      editor.chain().focus().unsetHighlight().run();
                    }
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
        </Box>
      )}

      <Dialog open={imageDialog} onClose={handleCloseImageDialog} maxWidth="sm" fullWidth>
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

      {/* Dialog: wstaw wideo przez URL */}
      <Dialog open={videoDialog} onClose={() => { setVideoDialog(false); setVideoUrl(''); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Wstaw wideo
          <IconButton onClick={() => { setVideoDialog(false); setVideoUrl(''); }} sx={{ position: 'absolute', right: 8, top: 8, color: 'grey.500' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Wklej link do YouTube, Vimeo lub bezpośredni URL do pliku wideo (MP4/WebM).
          </Typography>
          <TextField
            fullWidth
            label="URL wideo"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=... lub https://example.com/video.mp4"
            onKeyDown={(e) => e.key === 'Enter' && insertVideo()}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setVideoDialog(false); setVideoUrl(''); }}>Anuluj</Button>
          <Button onClick={insertVideo} variant="contained" disabled={!videoUrl.trim()}>
            Wstaw wideo
          </Button>
        </DialogActions>
      </Dialog>

      {news.length === 0 ? (
        <Box sx={{
          textAlign: 'center',
          p: 6,
          width: '100%',
          maxWidth: '1200px',
          border: (t) => `1px dashed ${t.palette.divider}`,
        }}>
          <Typography variant="h6" color="text.secondary" sx={{  textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            // Brak wieści do wyświetlenia
          </Typography>
        </Box>
      ) : (
        news.map((newsItem) => {
          if (!newsItem || !newsItem.id) {
            console.warn('Nieprawidłowy element wieści:', newsItem);
            return null;
          }

          let factions = [];
          if (newsItem.visible_to) {
            try {
              factions = typeof newsItem.visible_to === 'string'
                ? JSON.parse(newsItem.visible_to)
                : newsItem.visible_to;
            } catch { factions = []; }
          }

          return (
            <Box
              key={newsItem.id}
              sx={{
                mb: 4,
                width: '100%',
                maxWidth: '1200px',
                // Bez własnego tła, ramki i cienia - wieść leży wprost na tle
                // strony, a grupują ją same linie (jak sekcje w profilu).
                backgroundColor: 'transparent',
                border: 'none',
                boxShadow: 'none',
              }}
            >
              {/* Nagłówek: /// TYTUŁ ——— [data]. Linia jest jedyną dekoracją
                  i zarazem rozdzielnikiem kolejnych wieści. */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1.5,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
              }}>
                <Typography sx={{
                  color: 'primary.main',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  opacity: 0.75,
                  userSelect: 'none',
                  flexShrink: 0,
                }}>
                  ///
                </Typography>
                <Typography variant="h5" sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontSize: { xs: '0.95rem', sm: '1.15rem' },
                  lineHeight: 1.3,
                  minWidth: 0,
                }}>
                  {newsItem.title || 'Bez tytułu'}
                </Typography>
                <Box sx={{
                  flex: 1,
                  minWidth: 24,
                  height: '1px',
                  background: (t) => `linear-gradient(to right, ${t.palette.primary.main}99, transparent)`,
                }} />
                <Typography variant="caption" sx={{
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  flexShrink: 0,
                  opacity: 0.75,
                }}>
                  [{newsItem.created_at ? new Date(newsItem.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}]
                </Typography>
              </Box>

              {/* Treść */}
              <Box sx={{ pb: 1.5 }}>
                <Box
                  className="news-content"
                  sx={{
                    ...quillStyle,
                    '& img': {
                      ...quillStyle['& img'],
                      cursor: 'pointer',
                      borderRadius: 0,
                      border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(var(--race-accent-rgb, 122,59,15),0.3)' : 'rgba(var(--race-accent-rgb, 122,59,15),0.2)'}`,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.02)',
                        boxShadow: (t) => t.palette.mode === 'dark'
                          ? '0 4px 20px rgba(var(--race-accent-rgb, 122,59,15),0.4)'
                          : '0 4px 16px rgba(var(--race-accent-rgb, 122,59,15),0.25)',
                      },
                    },
                    '& video': {
                      maxWidth: '100%',
                      height: 'auto',
                      display: 'block',
                      margin: '12px 0',
                      border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(var(--race-accent-rgb, 122,59,15),0.3)' : 'rgba(var(--race-accent-rgb, 122,59,15),0.2)'}`,
                    },
                    '& iframe': {
                      maxWidth: '100%',
                      border: 'none',
                    },
                    '& blockquote': {
                      borderLeft: (t) => `3px solid ${t.palette.primary.main}`,
                      pl: 2,
                      ml: 0,
                      color: 'text.secondary',
                      fontStyle: 'italic',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(newsItem.content || '') }}
                />
              </Box>

              {/* Stopka: rasy + przyciski admina + komentarze */}
              <Box sx={{
                pb: 1,
                borderTop: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                pt: 1.5,
              }}>
                {/* Widoczność dla rasy (admin/GM) */}
                {(user?.role === 'admin' || user?.role === 'mistrz_gry') && (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
                    {/* Etykiety "plain text" zamiast wypełnionych chipów -
                        sam napis na tle strony, jak tagi w profilu. */}
                    {factions.length === 0 ? (
                      <Typography component="span" sx={{ ...visibilityTagSx, color: 'text.secondary' }}>
                        Wszystkie rasy
                      </Typography>
                    ) : (
                      factions.map(faction => (
                        <Typography
                          key={faction}
                          component="span"
                          sx={{ ...visibilityTagSx, color: getRaceColor(faction).accent }}
                        >
                          {getRaceName(faction)}
                        </Typography>
                      ))
                    )}
                  </Box>
                )}

                {/* Przyciski edycji */}
                {(user?.role === 'admin' || user?.role === 'mistrz_gry') && (
                  <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="contained" size="small" onClick={() => startEditing(newsItem)} sx={{ borderRadius: 0,  fontSize: '0.7rem', py: 0.4 }}>
                      Edytuj
                    </Button>
                    <Button variant="outlined" size="small" color="error" onClick={() => handleArchive(newsItem.id)} sx={{ borderRadius: 0,  fontSize: '0.7rem', py: 0.4 }}>
                      Archiwizuj
                    </Button>
                  </Box>
                )}

                <CommentsSection
                  newsId={newsItem.id}
                  comments={comments}
                  expandedComments={expandedComments}
                  newComment={newComment}
                  loadingComments={loadingComments}
                  commentsCount={commentsCount}
                  onToggleComments={handleToggleComments}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onCommentChange={handleCommentChange}
                />
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
};

// Nazwa do React DevTools - bez tego komponenty owiniete w React.memo
// pokazuja sie jako "Anonymous" i nie da sie ich znalezc w drzewie.
CommentsSection.displayName = 'CommentsSection';

export default News;