// ================================================================
// GWIAZDKI (*akcja*) - wspólna obsługa "formatowania gwiazdkowego" w postach RP.
//
// Zasada dla gracza jest jedna: co owiniesz w *gwiazdki*, wychodzi jako opis
// akcji (szary tekst), a same gwiazdki znikają z gotowego posta.
//
// Wcześniej każdy ekran RP (Sesje Ogólne, Sesje Prywatne, Karczma, Wiadomości)
// miał WŁASNĄ kopię tego kodu i wszystkie cztery miały te same dwie usterki:
//
//  1. WKLEJANIE Z NOTATNIKA GUBIŁO GWIAZDKI. Edytor (Tiptap) ma wbudowaną
//     regułę markdown: `*tekst*` to kursywa. Ekrany wyłączały ją tylko dla
//     PISANIA (`addInputRules`), ale nie dla WKLEJANIA (`addPasteRules`) -
//     więc post napisany w notatniku i wklejony do gry tracił gwiazdki jeszcze
//     zanim gra zdążyła je zobaczyć: zamieniały się w kursywę. Stąd
//     `disableMarkdownPasteRules` niżej, używane przy Italic w edytorach RP.
//
//  2. AKAPITY ROZWALAŁY HTML. Konwersja szła `String.replace` po surowym HTML-u,
//     więc opis rozciągnięty na dwa akapity (`*Wchodzi.` ... `Rozgląda się.*`)
//     dawał `<p><span>...</p><p>...</span></p>` - znacznik otwarty w jednym
//     akapicie, zamknięty w drugim. Przeglądarka/DOMPurify prostowały to po
//     swojemu i kolor gubił się w drugim akapicie. A wklejony z notatnika post
//     to prawie zawsze kilka akapitów.
//
// Tutaj obie rzeczy są rozwiązane raz, na wspólnym kodzie: dopasowanie liczymy
// na SAMYM TEKŚCIE (bez znaczników), a wynik wstawiamy per węzeł tekstowy, więc
// każdy akapit dostaje własny, poprawnie domknięty <span>.
// ================================================================

import { Extension } from '@tiptap/react';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// Kolor opisu akcji w gotowym poście (i w podglądzie w edytorze).
export const STAR_COLOR = '#6b7280';

// Ta sama reguła co dotąd: para gwiazdek z co najmniej jednym znakiem w środku
// i bez gwiazdki w środku. Trzymamy ją w jednym miejscu, żeby podgląd w
// edytorze i zapis do bazy nie mogły się rozjechać.
const STAR_PATTERN = /\*([^*]+)\*/g;

// Zakresy [start, end) dopasowań w płaskim tekście. `end` wskazuje ZA zamykającą
// gwiazdkę, tak jak w wyniku regexa.
function findStarRanges(text) {
  const ranges = [];
  const regex = new RegExp(STAR_PATTERN.source, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

// =====================================================================
// ZAPIS: *tekst* -> <span style="color: #6b7280;">tekst</span>
//
// Wejściem jest HTML z edytora, więc gwiazdek NIE szukamy w nim wprost - inaczej
// dopasowanie potrafi przeskoczyć przez `</p><p>` i wypluć nieprawidłowy HTML
// (usterka 2 z nagłówka pliku). Zamiast tego:
//   1. parsujemy HTML,
//   2. sklejamy sam tekst ze wszystkich węzłów tekstowych po kolei,
//   3. dopasowania liczymy na tej sklejce,
//   4. wynik wstawiamy z powrotem węzeł po węźle.
// Dzięki punktowi 4 opis rozciągnięty na kilka akapitów dostaje w KAŻDYM z nich
// osobny, domknięty <span> - HTML zostaje poprawny, a kolor nie ucieka.
// =====================================================================
export function processStarText(html) {
  if (!html || html.indexOf('*') === -1) return html;
  // Bezpiecznik dla środowisk bez DOM (testy/SSR) - lepiej stara, niedoskonała
  // konwersja niż wyjątek przy wysyłce posta.
  if (typeof document === 'undefined') {
    return html.replace(STAR_PATTERN, `<span style="color: ${STAR_COLOR};">$1</span>`);
  }

  const root = document.createElement('div');
  root.innerHTML = html;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode()) !== null) textNodes.push(node);
  if (textNodes.length === 0) return html;

  // Płaski tekst + gdzie w nim zaczyna się każdy węzeł.
  let flat = '';
  const starts = [];
  for (const textNode of textNodes) {
    starts.push(flat.length);
    flat += textNode.nodeValue;
  }

  const ranges = findStarRanges(flat);
  if (ranges.length === 0) return html;

  // Klasyfikacja każdego znaku: 0 - zwykły, 1 - w środku opisu, 2 - gwiazdka
  // do usunięcia.
  const OUTSIDE = 0, INSIDE = 1, DROP = 2;
  const marks = new Uint8Array(flat.length);
  for (const { start, end } of ranges) {
    marks[start] = DROP;
    marks[end - 1] = DROP;
    for (let i = start + 1; i < end - 1; i++) marks[i] = INSIDE;
  }

  textNodes.forEach((textNode, index) => {
    const offset = starts[index];
    const text = textNode.nodeValue;
    if (!text) return;

    // Węzeł bez ani jednego znaku objętego dopasowaniem zostawiamy w spokoju -
    // nie ruszamy DOM-u tam, gdzie nic się nie zmienia.
    let touched = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[offset + i] !== OUTSIDE) { touched = true; break; }
    }
    if (!touched) return;

    const fragment = document.createDocumentFragment();
    let buffer = '';
    let bufferKind = OUTSIDE;

    const flush = () => {
      if (!buffer) return;
      if (bufferKind === INSIDE) {
        const span = document.createElement('span');
        span.setAttribute('style', `color: ${STAR_COLOR};`);
        span.appendChild(document.createTextNode(buffer));
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(buffer));
      }
      buffer = '';
    };

    for (let i = 0; i < text.length; i++) {
      const kind = marks[offset + i];
      if (kind === DROP) { flush(); continue; }   // sama gwiazdka - wypada
      if (kind !== bufferKind) { flush(); bufferKind = kind; }
      buffer += text[i];
    }
    flush();

    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return root.innerHTML;
}

// =====================================================================
// PODGLĄD W EDYTORZE: koloruje *tekst* razem z gwiazdkami, żeby gracz widział,
// co dokładnie pójdzie jako opis akcji.
//
// Dopasowanie liczymy tak samo jak przy zapisie - na sklejonym tekście całego
// dokumentu - więc opis rozciągnięty na kilka akapitów podświetla się w całości,
// a nie tylko do końca pierwszego. Dekoracje wystawiamy już per węzeł tekstowy,
// bo tylko takie zakresy są prawidłowe dla ProseMirror.
// =====================================================================
export function createStarColorExtension(color = STAR_COLOR) {
  return Extension.create({
    name: 'starColor',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations: (state) => {
              const nodes = [];
              let flat = '';
              state.doc.descendants((node, pos) => {
                if (!node.isText || !node.text) return;
                nodes.push({ pos, start: flat.length, length: node.text.length });
                flat += node.text;
              });
              if (flat.indexOf('*') === -1) return DecorationSet.empty;

              const decorations = [];
              for (const { start, end } of findStarRanges(flat)) {
                for (const n of nodes) {
                  const from = Math.max(start, n.start);
                  const to = Math.min(end, n.start + n.length);
                  if (from >= to) continue;
                  decorations.push(Decoration.inline(
                    n.pos + (from - n.start),
                    n.pos + (to - n.start),
                    { style: `color: ${color};` }
                  ));
                }
              }
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}

// Gotowe rozszerzenie dla ekranów RP - wszystkie używają tego samego koloru.
export const StarColorExtension = createStarColorExtension();

// Wyłącza markdownowe reguły WKLEJANIA danego znacznika (Tiptap zamienia
// wklejone `*tekst*` na kursywę, a `_tekst_` też). Ekrany RP wyłączały dotąd
// tylko `addInputRules`, czyli reguły PISANIA - dlatego post napisany w
// notatniku i wklejony do gry gubił gwiazdki, choć ten sam post wpisany ręcznie
// działał. Używane jako `Italic.extend(disableMarkdownPasteRules)`.
export const disableMarkdownPasteRules = {
  addInputRules() { return []; },
  addPasteRules() { return []; },
};
