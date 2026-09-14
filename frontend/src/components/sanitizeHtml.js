import DOMPurify from 'dompurify';

// Wymuś rel="noopener noreferrer" na linkach target="_blank", żeby otwarta
// przez usera strona nie mogła przez window.opener przejąć zakładki z appką
// (reverse tabnabbing) - dotyczy linków wklejonych w treści przez innych graczy.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// Wspólna sanityzacja HTML przed dangerouslySetInnerHTML (opisy, wiadomości,
// ogłoszenia, treści redagowane przez adminów/graczy przez Tiptap/Quill) -
// zamyka lukę XSS, która wcześniej istniała w ~25 miejscach bez sanityzacji.
export default function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', { ADD_ATTR: ['target'] });
}
