// ================================
// editorContent.js
// Czy edytor (tiptap) jest PUSTY z punktu widzenia człowieka.
//
// Bramki wysyłki sprawdzały `html.trim()`, a tiptap po skasowaniu tekstu nie
// zwraca pustego stringa tylko `<p></p>`. Efekt był taki, że o możliwości
// wysłania decydowało to, czy ktoś wcześniej cokolwiek napisał:
//  - edytor nietknięty  -> stan '' -> przycisk WYŚLIJ martwy, więc samego rzutu
//    kostką nie dawało się wysłać;
//  - coś napisane i skasowane -> '<p></p>' -> wysyłka przechodziła i w bazie
//    lądowała "pusta" wiadomość z jednym akapitem.
//
// Uwaga: obrazek/tabela to treść, mimo że nie ma w nich ani jednej litery -
// dlatego najpierw sprawdzamy osadzone elementy, a dopiero potem tekst.
// ================================

const EMBED_TAG = /<(img|iframe|video|audio|hr|table)\b/i;

/**
 * @param {string|null|undefined} html - zawartość edytora (editor.getHTML())
 * @returns {boolean} true, gdy nie ma ani tekstu, ani osadzonej treści
 */
export default function isEditorContentEmpty(html) {
  if (!html) return true;

  const trimmed = html.trim();
  if (!trimmed) return true;
  if (EMBED_TAG.test(trimmed)) return false;

  return trimmed
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim() === '';
}
