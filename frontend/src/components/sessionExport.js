// ================================
// Eksport sesji (prywatnej / ogólnej) do pliku
//
// Gracz z poziomu listy sesji może pobrać całą sesję jako:
//   - HTML  - samodzielny plik, otwiera się w każdej przeglądarce,
//   - DOC   - ten sam dokument z nagłówkiem Worda (Word / LibreOffice / Google Docs),
//   - PDF   - przez natywne okno druku przeglądarki ("Zapisz jako PDF").
//
// Prawdziwego generatora PDF-a celowo nie ma: wymagałby nowej zależności
// (jsPDF/puppeteer) + osadzania fontu z polskimi znakami, a okno druku daje
// ten sam efekt bez żadnego kilobajta w bundlu.
//
// Dokument NIE zawiera awatarów - jest czysto tekstowy (autor, czas, treść,
// rzuty kością), żeby dobrze wyglądał na papierze i w PDF-ie.
// ================================
import { useState } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, Snackbar, Alert, CircularProgress } from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Code as HtmlIcon,
  Article as DocIcon,
} from '@mui/icons-material';
import sanitizeHtml from './sanitizeHtml';
import { getCurrentCharacter } from './AuthContext';

// ---------- pomocnicze ----------

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const PL_MAP = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

// Nazwa pliku bez polskich znaków i spacji - żeby nie rozjechała się na
// Windowsie/hostingu przy przenoszeniu pliku.
function slugify(text, fallback = 'sesja') {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => PL_MAP[ch] || ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pl-PL', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Style wpisane w atrybuty style="" zamiast w <style> w nagłówku.
// Powód: dokument ma wyglądać tak samo WSZĘDZIE - w podglądzie pliku
// (część podglądów wycina <head> razem z arkuszem), w Wordzie (który i tak
// najlepiej rozumie style inline) i w przeglądarce. Arkusz w <head> został,
// ale odpowiada już tylko za druk (@page, @media print), a nie za wygląd.
const ST = {
  page: 'margin:0;padding:32px 16px 64px;background:#f4f1ea;',
  sheet: 'max-width:820px;margin:0 auto;background:#fffdf8;border:1px solid #ddd5c4;padding:40px 44px 48px;'
    + 'font-family:"EB Garamond",Garamond,Georgia,"Times New Roman",serif;font-size:17px;line-height:1.65;color:#241f19;',
  head: 'border-bottom:2px solid #8a7c2e;padding-bottom:18px;margin-bottom:24px;',
  kicker: 'font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#8a7c2e;margin:0 0 8px;',
  h1: 'font-size:32px;line-height:1.2;margin:0 0 16px;font-weight:700;color:#241f19;',
  metaTable: 'border-collapse:collapse;width:100%;font-size:15px;',
  // width:1% + nowrap = kolumna z etykietą kurczy się do treści, reszta idzie
  // na wartość (działa też w Wordzie, w przeciwieństwie do grida).
  metaKey: 'width:1%;text-align:left;vertical-align:top;padding:2px 16px 2px 0;color:#6b6255;text-transform:uppercase;'
    + 'letter-spacing:0.1em;font-size:11px;font-weight:600;white-space:nowrap;',
  metaValue: 'text-align:left;vertical-align:top;padding:2px 0;color:#241f19;',
  note: 'margin-top:16px;padding:10px 14px;border-left:3px solid #c9bd8f;background:#f7f3e6;font-size:15px;color:#3a332a;',
  noteLabel: 'display:block;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b6255;margin-bottom:4px;font-weight:600;',
  h2: 'font-size:14px;letter-spacing:0.18em;text-transform:uppercase;color:#6b6255;font-weight:700;'
    + 'margin:28px 0 10px;border-bottom:1px solid #e0d9c8;padding-bottom:6px;',
  cast: 'list-style:none;margin:0;padding:0;',
  castItem: 'padding:3px 0;font-size:15px;',
  castName: 'font-weight:700;',
  castPlayer: 'color:#6b6255;font-size:14px;',
  post: 'padding:14px 0 16px;border-bottom:1px solid #ece5d5;page-break-inside:avoid;break-inside:avoid;',
  postSummary: 'padding:14px 14px 16px;margin-top:14px;border-bottom:none;border-left:3px solid #b8912f;'
    + 'background:#fbf6e8;page-break-inside:avoid;break-inside:avoid;',
  badge: 'display:block;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a6a1f;font-weight:600;margin-bottom:2px;',
  author: 'font-weight:700;font-size:17px;color:#241f19;',
  authorNarrator: 'font-weight:700;font-size:17px;color:#8f2d2d;font-style:italic;',
  player: 'color:#6b6255;font-size:14px;',
  time: 'display:block;color:#877d6c;font-size:13px;font-style:italic;margin-top:1px;',
  body: 'margin-top:6px;overflow-wrap:break-word;word-wrap:break-word;',
  rolls: 'margin-top:8px;border:1px solid #ded3ae;background:#faf6ea;padding:8px 12px;font-size:14px;',
  rollsLabel: 'display:block;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a7c2e;font-weight:600;margin-bottom:4px;',
  rollsList: 'margin:0;padding-left:18px;',
  rollDesc: 'color:#6b6255;font-style:italic;',
  empty: 'color:#877d6c;font-style:italic;padding:20px 0;',
  foot: 'margin-top:32px;padding-top:14px;border-top:1px solid #e0d9c8;font-size:13px;color:#877d6c;text-align:center;',
};

// Treść wpisu pochodzi z edytora, więc jej elementy też muszą dostać style
// inline - inaczej cytaty/wyrównanie/obrazki rozjadą się tam, gdzie arkusz
// nie działa. Styl autora (kolory z edytora) dopisujemy PO domyślnym, żeby
// wygrywał.
const BODY_ELEMENT_STYLES = [
  ['p', 'margin:0 0 8px;'],
  ['img', 'max-width:100%;height:auto;'],
  ['blockquote', 'border-left:3px solid #c9bd8f;margin:8px 0;padding:2px 14px;font-style:italic;color:#554d40;'],
  ['ul,ol', 'margin:0 0 8px;padding-left:22px;'],
  ['h1,h2,h3,h4,h5,h6', 'margin:12px 0 6px;font-weight:700;line-height:1.3;'],
  ['a', 'color:#7a5c14;'],
  ['hr', 'border:none;border-top:1px solid #ddd5c4;margin:12px 0;'],
];

const ALIGN_CLASS_STYLE = {
  'align-right': 'text-align:right;',
  'align-center': 'text-align:center;',
  'align-left': 'text-align:left;',
  'align-justify': 'text-align:justify;',
};

function mergeInlineStyle(node, defaults) {
  const own = node.getAttribute('style') || '';
  node.setAttribute('style', `${defaults}${own}`);
}

// Treść wiadomości pochodzi z edytora (HTML) i może zawierać obrazki oraz
// linki względne (/uploads/...). W pliku otwieranym poza aplikacją takie
// ścieżki są martwe, więc zamieniamy je na absolutne. Sanityzacja (DOMPurify)
// leci pierwsza - dokładnie tak jak przy renderowaniu wiadomości w grze.
function prepareMessageHtml(rawHtml) {
  const clean = sanitizeHtml(rawHtml);
  try {
    const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
    const root = doc.body.firstChild;
    if (!root) return clean;

    root.querySelectorAll('img[src], a[href]').forEach((node) => {
      const attr = node.tagName === 'IMG' ? 'src' : 'href';
      const value = node.getAttribute(attr);
      if (value && !/^(https?:|data:|mailto:|#)/i.test(value)) {
        node.setAttribute(attr, new URL(value, window.location.origin).href);
      }
    });

    BODY_ELEMENT_STYLES.forEach(([selector, defaults]) => {
      root.querySelectorAll(selector).forEach((node) => mergeInlineStyle(node, defaults));
    });

    // Wyrównanie z edytora jedzie na klasach (.align-center itd.) - bez arkusza
    // nic by nie znaczyły, więc przepisujemy je na text-align.
    Object.entries(ALIGN_CLASS_STYLE).forEach(([className, style]) => {
      root.querySelectorAll(`.${className}`).forEach((node) => mergeInlineStyle(node, style));
    });

    return root.innerHTML;
  } catch (err) {
    console.error('Błąd normalizacji treści wiadomości do eksportu:', err);
    return clean;
  }
}

// characters.faction trzyma techniczny klucz rasy (RASA_3), a czytelną nazwę
// tabela races - dokładnie jak getRaceName w widoku sesji. Bez tej mapy w
// dokumencie lądował surowy klucz. Gdy rasy nie da się rozwiązać (np. została
// usunięta), lepiej nie pisać nic niż straszyć gracza "RASA_3".
const RACE_KEY_PATTERN = /^RASA_\d+$/i;

function resolveRaceName(participant, raceNames) {
  const byFaction = participant.faction && raceNames[participant.faction];
  if (byFaction) return byFaction;
  const byRace = participant.race && raceNames[participant.race];
  if (byRace) return byRace;
  if (participant.race && !RACE_KEY_PATTERN.test(participant.race)) return participant.race;
  return '';
}

// Autor wpisu tak, jak widzi go gracz w sesji: narrator / postać / sam user.
function describeAuthor(msg) {
  if (msg.character_type === 'narrator') {
    const behind = msg.narrator_character_name || msg.character_name;
    return { name: 'Narrator', player: behind ? `${behind}${msg.author_name ? `, gracz: ${msg.author_name}` : ''}` : (msg.author_name || ''), narrator: true };
  }
  if (msg.character_name) {
    return { name: msg.character_name, player: msg.author_name || '', narrator: false };
  }
  return { name: msg.author_name || 'Nieznany', player: '', narrator: false };
}

function renderDiceRolls(rolls) {
  if (!Array.isArray(rolls) || rolls.length === 0) return '';
  const items = rolls.map((roll) => {
    const sides = roll.sides ?? '?';
    const modifier = Number(roll.modifier) || 0;
    const modText = modifier ? ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` : '';
    const total = roll.total ?? ((Number(roll.roll) || 0) + modifier);
    const desc = roll.description ? ` <span style="${ST.rollDesc}">${esc(roll.description)}</span>` : '';
    return `<li>K${esc(sides)}: <strong>${esc(roll.roll)}</strong>${esc(modText)}${modifier ? ` = <strong>${esc(total)}</strong>` : ''}${desc}</li>`;
  }).join('');
  return `<div style="${ST.rolls}"><span style="${ST.rollsLabel}">Rzuty kością</span><ul style="${ST.rollsList}">${items}</ul></div>`;
}

// ---------- budowanie dokumentu ----------

// Arkusz odpowiada już tylko za rzeczy, których nie da się zapisać inline:
// druk i zawijanie długich słów. Cały wygląd siedzi w atrybutach style="",
// więc dokument nie rozsypie się tam, gdzie <head> zostanie odcięty.
const DOCUMENT_CSS = `
  @page { margin: 18mm 16mm; }
  @media print {
    body { background: #fff !important; padding: 0 !important; }
    .sheet { border: none !important; padding: 0 !important; max-width: none !important; }
  }
`;

/**
 * Składa kompletny, samodzielny dokument HTML z danymi sesji.
 * @param {'private'|'general'} type
 */
export function buildSessionDocument({ type, session = {}, participants = [], messages = [], gameName = '', raceNames = {} }) {
  const kindLabel = type === 'private' ? 'Sesja prywatna' : 'Sesja ogólna';
  const title = session.title || 'Sesja';
  const docTitle = `${title} — ${kindLabel}`;

  // Metadane w tabeli, a nie w gridzie/definition liście - tabelę rozumie
  // każdy silnik renderujący, łącznie z Wordem.
  const metaRows = [
    ['Rodzaj', kindLabel],
    ['Data rozpoczęcia', formatDateOnly(session.start_date)],
    ['Utworzono', formatDateTime(session.created_at)],
    ['Miejsce', session.location],
    ['Status', session.closed ? 'Zamknięta' : 'Aktywna'],
    ['Liczba wpisów', String(messages.length)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<tr><th style="${ST.metaKey}">${esc(label)}</th><td style="${ST.metaValue}">${esc(value)}</td></tr>`)
    .join('');

  const infoBlock = session.additional_info
    ? `<div style="${ST.note}"><strong style="${ST.noteLabel}">Informacje o sesji</strong>${esc(session.additional_info)}</div>`
    : '';

  const castBlock = participants.length
    ? `<h2 style="${ST.h2}">Uczestnicy</h2><ul style="${ST.cast}">${participants.map((p) => {
        const details = [resolveRaceName(p, raceNames), p.username ? `gracz: ${p.username}` : ''].filter(Boolean).join(' · ');
        return `<li style="${ST.castItem}"><span style="${ST.castName}">${esc(p.character_name)}</span>${details ? ` <span style="${ST.castPlayer}">(${esc(details)})</span>` : ''}</li>`;
      }).join('')}</ul>`
    : '';

  const postsBlock = messages.length
    ? messages.map((msg, index) => {
        const author = describeAuthor(msg);
        const edited = msg.edited_at ? ` <span style="${ST.player}">[edytowano]</span>` : '';
        const isSummary = msg.message_type === 'session_summary';
        const isLast = index === messages.length - 1;
        const postStyle = isSummary
          ? ST.postSummary
          : `${ST.post}${isLast ? 'border-bottom:none;' : ''}`;
        return `<article style="${postStyle}">
      <div style="margin-bottom:6px;">
        ${isSummary ? `<span style="${ST.badge}">Podsumowanie sesji</span>` : ''}
        <span style="${author.narrator ? ST.authorNarrator : ST.author}">${esc(author.name)}</span>${author.player ? ` <span style="${ST.player}">(${esc(author.player)})</span>` : ''}${edited}
        <time style="${ST.time}">${esc(formatDateTime(msg.created_at))}</time>
      </div>
      <div style="${ST.body}">${prepareMessageHtml(msg.message)}</div>
      ${renderDiceRolls(msg.dice_rolls)}
    </article>`;
      }).join('\n')
    : `<p style="${ST.empty}">Ta sesja nie zawiera jeszcze żadnych wpisów.</p>`;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body style="${ST.page}">
<div class="sheet" style="${ST.sheet}">
  <header style="${ST.head}">
    <div style="${ST.kicker}">${esc(gameName || 'Kronika')} — ${esc(kindLabel)}</div>
    <h1 style="${ST.h1}">${esc(title)}</h1>
    ${metaRows ? `<table style="${ST.metaTable}"><tbody>${metaRows}</tbody></table>` : ''}
    ${infoBlock}
  </header>
  ${castBlock}
  <h2 style="${ST.h2}">Przebieg sesji</h2>
  ${postsBlock}
  <footer style="${ST.foot}">Wyeksportowano ${esc(formatDateTime(new Date()))}${gameName ? ` — ${esc(gameName)}` : ''}</footer>
</div>
</body>
</html>`;
}

// ---------- zapis / druk ----------

function downloadFile(filename, mimeType, content) {
  const blob = new Blob([`${content}`], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Zwolnienie z opóźnieniem - Safari potrafi przerwać pobieranie, jeśli URL
  // zniknie w tym samym ticku co klik.
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Druk przez ukrytą ramkę: nie wymaga zgody na wyskakujące okienka
// (w przeciwieństwie do window.open), a użytkownik w oknie druku wybiera
// "Zapisz jako PDF".
function printDocument(html) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  const cleanup = () => {
    if (frame.parentNode) document.body.removeChild(frame);
  };

  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) { cleanup(); return; }
    // Chwila zwłoki na dociągnięcie obrazków z treści wpisów.
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.error('Błąd otwierania okna druku:', err);
      }
      setTimeout(cleanup, 60000);
    }, 350);
  };

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}

// ---------- pobranie danych ----------

async function fetchSessionData(type, sessionId, characterId) {
  const token = localStorage.getItem('token');
  const endpoint = type === 'private' ? 'privateSessions' : 'generalSessions';
  const response = await fetch(`/api/${endpoint}/${sessionId}?characterId=${characterId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    let message = 'Nie udało się pobrać sesji do eksportu.';
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // odpowiedź bez JSON-a - zostaje komunikat domyślny
    }
    throw new Error(message);
  }
  return response.json();
}

// Mapa klucz rasy -> nazwa wyświetlana. includeInactive=1, bo w archiwalnej
// sesji może siedzieć postać rasy już wyłączonej z gry. Błąd tego zapytania
// nie przerywa eksportu - dokument po prostu wyjdzie bez nazw ras.
async function fetchRaceNames() {
  try {
    const response = await fetch('/api/races?includeInactive=1');
    if (!response.ok) return {};
    const rows = await response.json();
    if (!Array.isArray(rows)) return {};
    return rows.reduce((map, race) => {
      if (race?.key && race?.name) map[race.key] = race.name;
      return map;
    }, {});
  } catch (err) {
    console.error('Błąd pobierania nazw ras do eksportu:', err);
    return {};
  }
}

/**
 * Pobiera sesję z API i zapisuje/drukuje ją w wybranym formacie.
 * @param {'html'|'doc'|'pdf'} format
 */
export async function exportSession({ type, sessionId, characterId, gameName, format }) {
  const [data, raceNames] = await Promise.all([
    fetchSessionData(type, sessionId, characterId),
    fetchRaceNames(),
  ]);
  const session = data.session || {};
  const html = buildSessionDocument({
    type,
    session,
    participants: data.participants || [],
    messages: data.messages || [],
    gameName,
    raceNames,
  });

  if (format === 'pdf') {
    printDocument(html);
    return;
  }

  const base = `sesja-${slugify(session.title)}-${sessionId}`;
  if (format === 'doc') {
    downloadFile(`${base}.doc`, 'application/msword', html);
  } else {
    downloadFile(`${base}.html`, 'text/html', html);
  }
}

// ---------- komponent przycisku ----------

const FORMATS = [
  { key: 'pdf', label: 'PDF (przez druk)', hint: 'Otwiera okno druku — wybierz „Zapisz jako PDF”', Icon: PdfIcon },
  { key: 'doc', label: 'Word (.doc)', hint: 'Otwiera się w Wordzie, LibreOffice i Google Docs', Icon: DocIcon },
  { key: 'html', label: 'HTML', hint: 'Samodzielny plik dla przeglądarki', Icon: HtmlIcon },
];

/**
 * Przycisk „EKSPORT” z wyborem formatu - do wstawienia przy sesji na liście.
 * characterId jest opcjonalny; domyślnie bierzemy aktywną postać.
 */
export default function SessionExportButton({
  type,
  sessionId,
  characterId,
  gameName = '',
  label = '[ EKSPORT ]',
  sx = {},
  disabled = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const openMenu = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = (event) => {
    if (event) event.stopPropagation();
    setAnchorEl(null);
  };

  const handleExport = async (event, format) => {
    event.stopPropagation();
    setAnchorEl(null);
    const activeCharacterId = characterId || getCurrentCharacter()?.id;
    if (!activeCharacterId) {
      setError('Brak aktywnej postaci - nie można wyeksportować sesji.');
      return;
    }
    setBusy(true);
    try {
      await exportSession({ type, sessionId, characterId: activeCharacterId, gameName, format });
    } catch (err) {
      console.error('Błąd eksportu sesji:', err);
      setError(err.message || 'Nie udało się wyeksportować sesji.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        onClick={openMenu}
        disabled={disabled || busy}
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
        sx={sx}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        onClick={(e) => e.stopPropagation()}
      >
        {FORMATS.map(({ key, label: formatLabel, hint, Icon }) => (
          <MenuItem key={key} onClick={(e) => handleExport(e, key)}>
            <ListItemIcon><Icon fontSize="small" /></ListItemIcon>
            <ListItemText primary={formatLabel} secondary={hint} />
          </MenuItem>
        ))}
      </Menu>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError('')}>{error}</Alert>
      </Snackbar>
    </>
  );
}
