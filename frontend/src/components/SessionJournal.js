// Gaaran-Core - silnik gry fabularnej (bez mechaniki)
// Autor: Gaaran
// Licencja: MIT
// Kontakt: Discord cerber941, vangalloth@gmail.com

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import LockIcon from '@mui/icons-material/Lock';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import { appColors } from './theme';
import { getCurrentCharacter } from './AuthContext';
import { cardOpenProps } from './cardClick';

const REFRESH_INTERVAL_MS = 60000;

// Zapamiętana zakładka - gracz, który głównie prowadzi, nie chce przy każdym
// wejściu przeklikiwać się przez sesje, w których tylko gra.
const MODE_STORAGE_KEY = 'gaaran.journal.mode';

// Progi „jak długo to już wisi" - te same dla obu stron (czy to Ty nie
// odpisujesz, czy nikt nie odpisuje Tobie). Dzień to za mało, żeby bić na alarm;
// tydzień ciszy w sesji tekstowej to już martwy wątek.
const SILENCE_WARNING_DAYS = 3;
const SILENCE_DANGER_DAYS = 7;

const FILTERS = [
  { key: 'all', label: 'WSZYSTKIE' },
  { key: 'reply_needed', label: 'NA MNIE' },
  { key: 'partial', label: 'POŁOWICZNE' },
  // Wątki, w których od tygodnia nic się nie dzieje - bez względu na to, po
  // czyjej stronie jest ruch. Zwykle to one wymagają szturchnięcia, a nie te
  // z góry listy.
  { key: 'stale', label: `CISZA ${SILENCE_DANGER_DAYS}+ DNI` },
  { key: 'replied', label: 'ZROBIONE' },
  { key: 'private', label: 'PRYWATNE' },
  { key: 'general', label: 'OGÓLNE' },
];

// Rola w sesji. `auto` = wykryta przez serwer (właściciel sesji = MG, ktoś kto
// pisał postem narratora = narrator); reszta to ręczne nadpisanie gracza.
const ROLE_LABELS = { player: 'GRACZ', narrator: 'NARRATOR', gm: 'MISTRZ GRY' };
const ROLE_OPTIONS = [
  { value: 'auto', label: 'Wykryj automatycznie' },
  { value: 'player', label: 'Gracz' },
  { value: 'narrator', label: 'Narrator' },
  { value: 'gm', label: 'Mistrz Gry' },
];

// TRYB UDZIAŁU - zakładki. Kolory są celowo spoza rodziny statusów odpisu
// (czerwony/zielony/szary), żeby „czym tu piszę" nie mieszało się z „czy mam
// ruch": niebieski = tylko gram, oliwkowy = gram i prowadzę, złoty = tylko MG.
// Te trzy tokeny są stałe (`applyThemeColors` rusza tylko rodziny rust/tekst/tło),
// więc można je odczytać raz, przy imporcie.
const PARTICIPATION = {
  player: {
    label: 'TYLKO GRAM',
    chip: 'TYLKO GRAM',
    color: appColors.statusInfo,
    hint: 'Odpisujesz tu wyłącznie swoją postacią - ani jednego posta z trybu narratora.',
  },
  mixed: {
    label: 'GRAM I MG',
    chip: 'GRAM + MG',
    color: appColors.toxicLight,
    hint: 'Odpisujesz tu i swoją postacią, i z trybu narratora - grasz i prowadzisz naraz.',
  },
  gm: {
    label: 'MG',
    chip: 'MG',
    color: appColors.statusGold,
    hint: 'Odpisujesz tu wyłącznie z trybu narratora - tylko prowadzisz, nie grasz. '
      + 'Tu trafia też świeżo założona przez Ciebie sesja, w której nikt jeszcze nie pisał.',
  },
};

const MODES = [
  { key: 'all', label: 'WSZYSTKIE', hint: 'Wszystkie sesje postaci - granie i prowadzenie razem.' },
  { key: 'player', label: PARTICIPATION.player.label, hint: PARTICIPATION.player.hint },
  { key: 'mixed', label: PARTICIPATION.mixed.label, hint: PARTICIPATION.mixed.hint },
  { key: 'gm', label: PARTICIPATION.gm.label, hint: PARTICIPATION.gm.hint },
];

// Sesja bez `participation` (np. odpowiedź ze starszego backendu) leci do
// „tylko gram" - to najczęstszy przypadek, więc nie znika z listy.
const participationOf = (entry) => PARTICIPATION[entry.participation] ? entry.participation : 'player';

const modeColor = (key) => (key === 'all' ? appColors.steelLighter : PARTICIPATION[key].color);

// Puste zakładki mówią, CZEGO nie ma - „brak sesji" przy trzech zakładkach
// zostawiałoby gracza z pytaniem, w której z nich właściwie stoi.
const EMPTY_MODE_TEXT = {
  all: '// TWOJA POSTAĆ NIE GRA JESZCZE W ŻADNEJ SESJI //',
  player: '// BRAK SESJI, W KTÓRYCH ODPISUJESZ TYLKO POSTACIĄ //',
  mixed: '// BRAK SESJI, W KTÓRYCH GRASZ I PROWADZISZ NARAZ //',
  gm: '// BRAK SESJI, W KTÓRYCH ODPISUJESZ TYLKO Z TRYBU NARRATORA //',
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

// Stan narracji liczony w strefie czasowej GRACZA - backend daje same znaczniki
// czasu, bo „dziś" na serwerze i „dziś" u gracza to nie zawsze ten sam dzień.
function narrationState(entry) {
  if (!entry.last_narration_at) {
    return { key: 'none', label: 'BRAK NARRACJI', color: appColors.statusNeutral,
      hint: 'W tej sesji nie było jeszcze żadnego posta narratora.' };
  }
  const at = new Date(entry.last_narration_at);
  if (sameDay(at, new Date())) {
    return { key: 'today', label: 'NARRACJA DNIA', color: appColors.statusSuccess,
      hint: 'Narracja poszła dzisiaj.' };
  }
  return { key: 'stale', label: 'BRAK NARRACJI DZIŚ', color: appColors.statusWarning,
    hint: 'Ostatnia narracja jest starsza niż dzisiejszy dzień.' };
}

// Termin narracji: dziś / spóźniony / za ile dni.
function dueState(value) {
  if (!value) return null;
  const due = new Date(value);
  const now = new Date();
  if (sameDay(due, now)) return { label: 'termin: dziś', overdue: false };
  if (due.getTime() < now.getTime()) return { label: `termin minął (${formatDateOnly(due)})`, overdue: true };
  return { label: `termin: ${formatDateOnly(due)}`, overdue: false };
}

function formatDateOnly(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

// <input type="date"> chce YYYY-MM-DD w czasie lokalnym (toISOString zjadłby
// dzień przy ujemnym offsecie).
function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// „rok / 2 lata / 5 lat" - bez tego wychodziło „1 lat temu".
function yearsWord(n) {
  if (n === 1) return 'rok';
  const last = n % 10;
  const last2 = n % 100;
  if (last >= 2 && last <= 4 && !(last2 >= 12 && last2 <= 14)) return 'lata';
  return 'lat';
}

// „2 dni temu" czyta się szybciej niż data - przy 20 sesjach to różnica
// między skanowaniem listy a czytaniem jej.
function formatRelative(value) {
  if (!value) return null;
  const diffMs = Date.now() - new Date(value).getTime();
  if (diffMs < 0) return 'za chwilę';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'wczoraj';
  if (days < 31) return `${days} dni temu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mies. temu`;
  const years = Math.floor(months / 12);
  return `${years} ${yearsWord(years)} temu`;
}

// To samo co `formatRelative`, ale jako DŁUGOŚĆ, nie moment („2 dni" zamiast
// „2 dni temu") - pasek ruchu mówi „czeka na Ciebie: 2 dni", a nie „wczoraj".
function formatAge(value) {
  if (!value) return null;
  const diffMs = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 dzień';
  if (days < 31) return `${days} dni`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mies.`;
  const years = Math.floor(months / 12);
  return `${years} ${yearsWord(years)}`;
}

function ageInDays(value) {
  if (!value) return 0;
  return Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 86400000);
}

// KTO MA RUCH - jedna odpowiedź na całą kartę, licząca to, co w TEJ sesji jest
// moją robotą (patrz zakładki): grający ma odpisać postacią, MG - poprowadzić
// narrację, „gram i MG" - jedno i drugie. Stąd żółty stan pośredni: jedna
// połowa zrobiona, druga wisi.
//
// Wszystko mierzone względem ostatniego wpisu KOGOŚ INNEGO (`last_other_at`),
// bo w trybie „gram i MG" ostatni wpis w sesji bywa moim własnym - i sam
// „ostatni wpis jest mój" nie znaczy jeszcze, że zrobiłem wszystko.
function moveState(entry) {
  const mode = participationOf(entry);
  const lastWho = (entry.last_character_type === 'narrator'
    ? (entry.narrator_character_name || entry.last_character_name)
    : entry.last_character_name) || entry.last_author || 'Ktoś';

  if (entry.status === 'waiting' || !entry.messages_count) {
    return {
      key: 'waiting',
      label: 'BEZ WPISÓW',
      color: appColors.statusNeutral,
      pulse: false,
      // Cisza w pustej sesji liczy się od jej założenia - inaczej „nikt nie
      // ruszył tej sesji od miesiąca" nie miałoby skąd wyjść.
      since: entry.created_at,
      silenceLabel: 'sesja stoi',
      silenceHint: 'Tyle czasu w tej sesji nie padł ani jeden wpis.',
      detail: 'Sesja jeszcze nie ruszyła - nikt nic nie napisał.',
    };
  }

  // Zaległość liczy się od cudzego wpisu, nie od końca listy.
  const owedSince = entry.last_other_at || entry.last_message_at;

  if (entry.status === 'reply_needed') {
    const narrated = entry.last_character_type === 'narrator';
    const label = mode === 'gm'
      ? 'TWOJA NARRACJA'
      : (mode === 'mixed'
        ? 'TWÓJ ODPIS + NARRACJA'
        : (narrated ? 'NARRACJA → TWÓJ ODPIS' : 'TWÓJ ODPIS'));
    const detail = mode === 'gm'
      ? `${lastWho} czeka na Twoją narrację - w tej sesji odpisujesz wyłącznie z trybu narratora.`
      : (mode === 'mixed'
        ? `Po wpisie (${lastWho}) jest na Tobie i odpis postacią, i narracja.`
        : (narrated
          ? `Narracja poszła (${lastWho}) - teraz ruch jest Twój.`
          : `${lastWho} odpisał(a) po Tobie - czeka na Twój wpis.`));
    return {
      key: 'reply_needed',
      label,
      color: appColors.statusDanger,
      pulse: true,
      since: owedSince,
      silenceLabel: mode === 'gm' ? 'czeka na Twoją narrację' : 'czeka na Ciebie',
      silenceHint: 'Tyle czasu ostatni cudzy wpis czeka na Twój ruch.',
      detail,
    };
  }

  // ŻÓŁTE - tylko „gram i MG": połowa roboty jest, połowa wisi.
  if (entry.status === 'partial') {
    const missingNarration = !entry.my_narration_done;
    return {
      key: 'partial',
      label: missingNarration ? 'ZOSTAŁA NARRACJA' : 'ZOSTAŁ TWÓJ ODPIS',
      color: appColors.statusWarning,
      pulse: false,
      since: owedSince,
      silenceLabel: 'czeka na Ciebie',
      silenceHint: 'Tyle czasu wisi druga połowa Twojego ruchu w tej sesji.',
      detail: missingNarration
        ? 'Odpisałeś swoją postacią, ale narracji jeszcze nie poprowadziłeś.'
        : 'Narracja poszła, ale nie odpisałeś jeszcze swoją postacią.',
    };
  }

  return {
    key: 'replied',
    label: mode === 'gm'
      ? 'NARRACJA POSZŁA'
      : (mode === 'mixed' ? 'ODPISANE I POPROWADZONE' : 'ODPISANE'),
    color: appColors.statusSuccess,
    pulse: false,
    since: entry.my_last_post_at || entry.last_message_at,
    silenceLabel: 'cisza po Twoim wpisie',
    silenceHint: 'Tyle czasu nikt nie odpisał po Twoim ostatnim wpisie.',
    detail: mode === 'gm'
      ? 'Twoja narracja jest ostatnia - ruch jest po stronie graczy.'
      : (mode === 'mixed'
        ? 'Odpisałeś postacią i poprowadziłeś narrację - ruch po drugiej stronie.'
        : 'Twój wpis jest ostatni - ruch jest po drugiej stronie.'),
  };
}

// „Ile to już wisi" - ta sama skala dla obu stron. Świeże zostaje szare (nie ma
// o czym krzyczeć), stare robi się pomarańczowe, a martwe - czerwone.
function silenceState(move) {
  if (!move.since) return null;
  const days = ageInDays(move.since);
  const color = days >= SILENCE_DANGER_DAYS
    ? appColors.statusDanger
    : (days >= SILENCE_WARNING_DAYS ? appColors.statusWarning : appColors.steelLight);
  return {
    days,
    color,
    text: `${move.silenceLabel}: ${formatAge(move.since)}`,
    hint: `${move.silenceHint} (od ${formatDateTime(move.since)})`,
    alarming: days >= SILENCE_WARNING_DAYS,
  };
}

// Treść szturchnięcia gotowa do wysłania - gracz ma poprawić, a nie pisać od
// zera. Bez podania sesji i „od kiedy" taka wiadomość jest bezużyteczna.
function defaultNudgeText(entry, target) {
  const where = `sesji „${entry.title}"`;
  if (target.never_posted) {
    return `Hej! Czekamy na Twój pierwszy wpis w ${where}. Dasz radę zajrzeć?`;
  }
  return `Hej! Czekam na Twój odpis w ${where} - Twój ostatni wpis padł ${formatRelative(target.last_post_at)}. Dasz radę zajrzeć?`;
}

// Podpis uczestnika na liście „czekasz na": imię + jak długo milczy.
function waitingLabel(person) {
  return person.never_posted
    ? `${person.character_name} (jeszcze nie pisał)`
    : `${person.character_name} (${formatAge(person.last_post_at)} ciszy)`;
}

function SessionJournal() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery('(max-width:600px)');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [migrationHint, setMigrationHint] = useState('');
  // Zakładka (czym w sesji piszę) i filtr (co się w niej dzieje) to dwie różne
  // osie - filtr działa w obrębie zakładki, nie zamiast niej.
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      return MODES.some((m) => m.key === saved) ? saved : 'all';
    } catch {
      return 'all';
    }
  });
  const [filter, setFilter] = useState('all');
  const [includeClosed, setIncludeClosed] = useState(false);

  // Popup wpisu: notatka + rola + znacznik narracji
  const [noteEntry, setNoteEntry] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState('auto');
  const [todoDraft, setTodoDraft] = useState(false);
  const [dueDraft, setDueDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Popup „szturchnięcia": wiadomość prywatna do osoby, na którą czekamy.
  const [nudgeEntry, setNudgeEntry] = useState(null);
  const [nudgeTarget, setNudgeTarget] = useState('');
  const [nudgeText, setNudgeText] = useState('');
  const [sendingNudge, setSendingNudge] = useState(false);
  const [nudgeError, setNudgeError] = useState('');
  const [notice, setNotice] = useState('');

  const token = localStorage.getItem('token');
  const character = getCurrentCharacter();
  const characterId = character?.id || null;

  const fetchJournal = useCallback(async ({ silent = false } = {}) => {
    if (!token || !characterId) {
      setLoading(false);
      setError('Brak wybranej postaci - wejdź do gry postacią, żeby zobaczyć jej codziennik.');
      return;
    }
    if (!silent) setLoading(true);
    try {
      const response = await fetch(
        `/api/sessionJournal?characterId=${characterId}&includeClosed=${includeClosed ? 1 : 0}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Nie udało się pobrać codziennika');
        return;
      }
      const data = await response.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setMigrationHint(data.migrationHint || '');
      setError('');
    } catch (err) {
      console.error('Błąd pobierania codziennika:', err);
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  }, [token, characterId, includeClosed]);

  useEffect(() => { fetchJournal(); }, [fetchJournal]);

  // Tryb prywatny przeglądarki potrafi rzucić na samym `setItem` - wybór
  // zakładki nie jest wart wywracania widoku.
  useEffect(() => {
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch { /* brak pamięci - trudno */ }
  }, [mode]);

  // Odświeżanie w tle - nowy odpis w sesji ma zapalić czerwone bez F5.
  // Nie odpytujemy schowanej karty ani otwartego popupu notatki (żeby
  // odświeżenie nie podmieniło pod palcami tego, co gracz właśnie pisze).
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden || noteEntry || nudgeEntry) return;
      fetchJournal({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchJournal, noteEntry, nudgeEntry]);

  // Potwierdzenie wysłanego szturchnięcia gaśnie samo - to komunikat na chwilę,
  // nie stan strony.
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);

  // Ile sesji siedzi w każdej zakładce - liczby na samych zakładkach, żeby
  // było widać, gdzie jest co oglądać, zanim się kliknie.
  const modeCounts = useMemo(() => entries.reduce((acc, entry) => {
    acc.all += 1;
    acc[participationOf(entry)] += 1;
    return acc;
  }, { all: 0, player: 0, mixed: 0, gm: 0 }), [entries]);

  // Zawartość wybranej zakładki - podstawa i dla kafelków, i dla listy.
  const modeEntries = useMemo(
    () => (mode === 'all' ? entries : entries.filter((entry) => participationOf(entry) === mode)),
    [entries, mode]
  );

  // Kafelki liczymy z tego, co jest w zakładce (a nie z podsumowania całości
  // liczonego przez serwer) - inaczej „DO ODPISANIA: 7" nad listą trzech sesji
  // mówiłoby o czymś, czego na ekranie nie ma. Że idą z `entries`, mają też tę
  // zaletę, że przełącznik „do narracji" na karcie od razu zmienia licznik.
  const stats = useMemo(() => ({
    total: modeEntries.length,
    replyNeeded: modeEntries.filter((e) => e.status === 'reply_needed' && !e.closed).length,
    partial: modeEntries.filter((e) => e.status === 'partial' && !e.closed).length,
    replied: modeEntries.filter((e) => e.status === 'replied').length,
  }), [modeEntries]);

  const visibleEntries = useMemo(() => modeEntries.filter((entry) => {
    if (filter === 'all') return true;
    if (filter === 'private' || filter === 'general') return entry.session_type === filter;
    if (filter === 'partial') return entry.status === 'partial';
    if (filter === 'stale') {
      const since = moveState(entry).since;
      return !!since && ageInDays(since) >= SILENCE_DANGER_DAYS;
    }
    return entry.status === filter;
  }), [modeEntries, filter]);

  // Najstarsza zaległość gracza - „gdzieś tam wisi 9 dni" trzeba widzieć bez
  // przewijania listy, bo to zwykle ta jedna sesja, którą się przegapiło.
  const oldestPending = useMemo(() => {
    const pending = modeEntries
      .filter((e) => (e.status === 'reply_needed' || e.status === 'partial') && !e.closed)
      .map((e) => ({ entry: e, since: e.last_other_at || e.last_message_at }))
      .filter((p) => !!p.since);
    if (pending.length === 0) return null;
    return pending.reduce((oldest, p) => (
      new Date(p.since).getTime() < new Date(oldest.since).getTime() ? p : oldest
    ));
  }, [modeEntries]);

  const openNoteDialog = (entry) => {
    setNoteEntry(entry);
    setNoteDraft(entry.note || '');
    setRoleDraft(entry.session_role || 'auto');
    setTodoDraft(!!entry.narration_todo);
    setDueDraft(toDateInputValue(entry.narration_due_at));
    setNoteError('');
  };

  const closeNoteDialog = () => {
    setNoteEntry(null);
    setNoteDraft('');
    setNoteError('');
  };

  // Szturchnięcie: wiadomość prywatna do uczestnika, na którego czekamy.
  // Domyślnym adresatem jest ten, kto milczy najdłużej - backend oddaje listę
  // już posortowaną.
  const openNudgeDialog = (entry) => {
    const target = (entry.waiting_for || [])[0];
    if (!target) return;
    setNudgeEntry(entry);
    setNudgeTarget(String(target.character_id));
    setNudgeText(defaultNudgeText(entry, target));
    setNudgeError('');
  };

  const closeNudgeDialog = () => {
    setNudgeEntry(null);
    setNudgeTarget('');
    setNudgeText('');
    setNudgeError('');
  };

  // Zmiana adresata podmienia treść tylko wtedy, gdy gracz jeszcze jej nie
  // ruszał - inaczej przełączenie osoby kasowałoby napisaną wiadomość.
  const changeNudgeTarget = (value) => {
    const list = nudgeEntry?.waiting_for || [];
    const previous = list.find((p) => String(p.character_id) === nudgeTarget);
    const next = list.find((p) => String(p.character_id) === value);
    setNudgeTarget(value);
    if (next && (!previous || nudgeText === defaultNudgeText(nudgeEntry, previous))) {
      setNudgeText(defaultNudgeText(nudgeEntry, next));
    }
  };

  const sendNudge = async () => {
    if (!nudgeEntry || !nudgeTarget || !nudgeText.trim()) return;
    setSendingNudge(true);
    setNudgeError('');
    try {
      // Ten sam endpoint co zwykła wiadomość prywatna - tworzy konwersację albo
      // dopisuje się do istniejącej, więc szturchnięcie ląduje w normalnej
      // skrzynce obu stron, a nie w osobnym kanale powiadomień.
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sender_character_id: characterId,
          receiver_character_id: Number(nudgeTarget),
          content: nudgeText.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNudgeError(data.message || data.error || 'Nie udało się wysłać wiadomości');
        return;
      }
      const targetName = (nudgeEntry.waiting_for || [])
        .find((p) => String(p.character_id) === nudgeTarget)?.character_name || 'uczestnika';
      setNotice(`Szturchnięcie poszło do: ${targetName}.`);
      closeNudgeDialog();
    } catch (err) {
      console.error('Błąd wysyłania szturchnięcia:', err);
      setNudgeError('Błąd połączenia z serwerem');
    } finally {
      setSendingNudge(false);
    }
  };

  // Zapis znaczników (rola / „do narracji" / termin). Używany i z popupu,
  // i z przycisku na karcie, więc trzyma jedną ścieżkę błędów.
  const saveFlags = useCallback(async (entry, changes) => {
    const response = await fetch(
      `/api/sessionJournal/${entry.session_type}/${entry.session_id}/flags`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ characterId, ...changes }),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Nie udało się zapisać zmiany');

    setEntries((prev) => prev.map((e) => (e.key === entry.key ? {
      ...e,
      session_role: data.session_role,
      // rola wyliczona: przy `auto` zostawiamy to, co policzył serwer przy
      // ostatnim pobraniu listy - odświeżenie w tle i tak ją zweryfikuje
      role: data.session_role === 'auto' ? e.role : data.session_role,
      role_source: data.session_role === 'auto' ? 'auto' : 'manual',
      narration_todo: !!data.narration_todo,
      narration_todo_at: data.narration_todo_at,
      narration_due_at: data.narration_due_at,
      narration_just_done: false,
    } : e)));

    return data;
  }, [token, characterId]);

  const saveNote = async () => {
    if (!noteEntry) return;
    setSavingNote(true);
    setNoteError('');
    try {
      const roleChanged = roleDraft !== (noteEntry.session_role || 'auto');
      const todoChanged = todoDraft !== !!noteEntry.narration_todo;
      const dueChanged = dueDraft !== toDateInputValue(noteEntry.narration_due_at);

      if (roleChanged || todoChanged || dueChanged) {
        await saveFlags(noteEntry, {
          sessionRole: roleDraft,
          narrationTodo: todoDraft,
          narrationDueAt: dueDraft || null,
        });
      }

      if (noteDraft !== (noteEntry.note || '')) {
        const response = await fetch(
          `/api/sessionJournal/${noteEntry.session_type}/${noteEntry.session_id}/note`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ characterId, note: noteDraft }),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNoteError(data.error || 'Nie udało się zapisać notatki');
          return;
        }
        setEntries((prev) => prev.map((e) => (
          e.key === noteEntry.key ? { ...e, note: data.note ?? null } : e
        )));
      }

      closeNoteDialog();
    } catch (err) {
      console.error('Błąd zapisu wpisu codziennika:', err);
      setNoteError(err.message || 'Błąd połączenia z serwerem');
    } finally {
      setSavingNote(false);
    }
  };

  const filterButtonSx = (active) => ({
    color: active ? appColors.textLight : appColors.steelLight,
    border: `2px solid ${active ? theme.palette.primary.main : appColors.borderSteel}`,
    borderRadius: '2px',
    bgcolor: active ? `${theme.palette.primary.main}18` : 'transparent',
    letterSpacing: '0.1em',
    fontSize: '0.72rem',
    fontWeight: 'bold',
    px: 1.5,
    py: 0.5,
    '&:hover': {
      bgcolor: `${theme.palette.primary.main}18`,
      borderColor: theme.palette.primary.main,
      color: appColors.textLight,
    },
  });

  // Zakładka wygląda inaczej niż filtr celowo: filtr to wąski przycisk w rzędzie,
  // zakładka - szeroka płytka z liczbą i podkreśleniem. Inaczej dwa rzędy
  // przycisków pod sobą czytałyby się jak jeden długi filtr.
  const modeTabSx = (active, color) => ({
    flex: { xs: '1 1 45%', sm: '0 0 auto' },
    justifyContent: 'flex-start',
    color: active ? color : appColors.steelLight,
    border: `1px solid ${active ? color : appColors.borderSteel}`,
    borderBottom: `3px solid ${active ? color : 'transparent'}`,
    borderRadius: '2px',
    bgcolor: active ? `${color}18` : 'transparent',
    letterSpacing: '0.1em',
    fontSize: '0.74rem',
    fontWeight: 'bold',
    px: 1.5,
    py: 0.6,
    '&:hover': {
      bgcolor: `${color}14`,
      borderColor: color,
      color: appColors.textLight,
    },
  });

  const renderSummaryTile = (label, value, color, hint = '') => {
    const tile = (
      <Box sx={{
        px: 1.5,
        py: 0.75,
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '2px',
        bgcolor: `${color}12`,
        minWidth: 96,
      }}>
        <Typography sx={{ color, fontSize: '1.1rem', fontWeight: 'bold', lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Typography sx={{ color: appColors.steelLight, fontSize: '0.6rem', letterSpacing: '0.14em' }}>
          {label}
        </Typography>
      </Box>
    );
    return hint ? <Tooltip title={hint}>{tile}</Tooltip> : tile;
  };

  // Plakietka: jednolity chip na pasku statusu karty.
  const renderChip = (label, color, { hint = '', filled = false } = {}) => {
    const chip = (
      <Typography sx={{
        color,
        fontSize: '0.6rem',
        fontWeight: 'bold',
        letterSpacing: '0.12em',
        border: `1px solid ${color}`,
        bgcolor: filled ? `${color}22` : 'transparent',
        borderRadius: '2px',
        px: 0.75,
        py: 0.1,
      }}>
        {label}
      </Typography>
    );
    return hint ? <Tooltip title={hint}>{chip}</Tooltip> : chip;
  };

  const renderEntry = (entry) => {
    const move = moveState(entry);
    const silence = silenceState(move);
    const lastCharacter = entry.last_character_type === 'narrator'
      ? (entry.narrator_character_name || entry.last_character_name)
      : entry.last_character_name;
    const narration = narrationState(entry);
    const due = dueState(entry.narration_due_at);
    // Krawędź karty w kolorze paska ruchu - jeden kolor na kartę, żeby lista
    // czytała się po lewej krawędzi bez czytania treści.
    const accentColor = move.color;
    const participation = PARTICIPATION[participationOf(entry)];
    // Lista „na kogo czekam" ma sens dopiero, gdy odpisałem i piłka jest po
    // drugiej stronie. Backend liczy ją zawsze, front pokazuje przy zielonym.
    const waitingFor = move.key === 'replied' ? (entry.waiting_for || []) : [];

    return (
      <Box
        key={entry.key}
        {...cardOpenProps(() => navigate(entry.url))}
        sx={{
          p: 1.5,
          mb: 1.25,
          border: `1px solid ${appColors.borderSteel}`,
          borderLeft: `4px solid ${accentColor}`,
          borderRadius: '2px',
          bgcolor: `${accentColor}0a`,
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            bgcolor: `${accentColor}1a`,
            boxShadow: `0 0 12px ${accentColor}35`,
          },
        }}
      >
        {/* PASEK RUCHU - najważniejsze zdanie karty: czy to na mnie i od kiedy.
            Stoi nad tytułem i ma własne tło, żeby dało się przelecieć listę
            wzrokiem po lewej krawędzi, nie czytając jej. */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          border: `1px solid ${move.color}66`,
          borderLeft: `3px solid ${move.color}`,
          borderRadius: '2px',
          bgcolor: `${move.color}14`,
          px: 1,
          py: 0.5,
          mb: 0.75,
        }}>
          <Tooltip title={move.detail}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: move.color,
                boxShadow: `0 0 8px ${move.color}`,
                animation: move.pulse ? 'unreadPulse 1.5s ease-in-out infinite' : 'none',
              }} />
              <Typography sx={{
                color: move.color,
                fontSize: '0.72rem',
                fontWeight: 'bold',
                letterSpacing: '0.12em',
              }}>
                {move.label}
              </Typography>
            </Box>
          </Tooltip>

          {/* ILE TO WISI - po jednej stronie „nie odpisujesz od", po drugiej
              „nikt nie odpisuje". Ta sama skala, więc jedno spojrzenie
              wystarczy, żeby zobaczyć, który wątek umiera. */}
          {silence && (
            <Tooltip title={silence.hint}>
              <Typography sx={{
                color: silence.color,
                fontSize: '0.68rem',
                fontWeight: silence.alarming ? 'bold' : 400,
                letterSpacing: '0.04em',
              }}>
                ⏳ {silence.text}
              </Typography>
            </Tooltip>
          )}
        </Box>

        <Typography sx={{
          color: entry.closed ? appColors.steel : appColors.textLight,
          fontWeight: 700,
          fontSize: isMobile ? '1.05rem' : '1.2rem',
          letterSpacing: '0.03em',
          mb: 0.5,
        }}>
          {entry.title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography sx={{
            color: appColors.steelLight,
            fontSize: '0.6rem',
            letterSpacing: '0.14em',
            border: `1px solid ${appColors.borderSteel}`,
            borderRadius: '2px',
            px: 0.75,
            py: 0.1,
          }}>
            {entry.session_type === 'private' ? 'PRYWATNA' : 'OGÓLNA'}
          </Typography>

          {/* CZYM TU PISZĘ - ta sama informacja, na której stoją zakładki, więc
              tylko w widoku „WSZYSTKIE": w zawężonej zakładce ta sama plakietka
              na każdej karcie jest już samym szumem. Wcześniej stała tu rola
              (GRACZ/NARRATOR/MG), która mówiła to samo słabiej - bo brała się
              z deklaracji, nie z wpisów. */}
          {mode === 'all' && renderChip(participation.chip, participation.color, {
            hint: participation.hint,
            filled: true,
          })}

          {/* Kto tę sesję ZAŁOŻYŁ - to jedyne, czego tryb odpisywania nie niesie.
              Stała tu wcześniej rola „MISTRZ GRY", ale przy zakładce „MG"
              znaczyłaby na karcie dwie różne rzeczy naraz. */}
          {entry.is_owner && renderChip('TWOJA SESJA', theme.palette.primary.main, {
            hint: 'Tę sesję założyła Twoja postać.',
            filled: true,
          })}

          {/* Ręczny znacznik „kolejna narracja na mnie" - już bez własnego
              przycisku na karcie (przestawia się go w notatce sesji), bo stan
              narracji niesie teraz sam pasek ruchu. */}
          {entry.narration_todo && renderChip(
            due ? `DO NARRACJI — ${due.label}` : 'DO NARRACJI',
            due?.overdue ? appColors.statusDanger : appColors.statusWarning,
            { hint: 'Zaznaczyłeś, że kolejna narracja jest na Tobie. Zgaśnie sama po Twoim poście narratora.', filled: true }
          )}

          {entry.unread && renderChip('NIEPRZECZYTANE', appColors.statusInfo, {
            hint: 'Są w tej sesji wpisy, których jeszcze nie widziałeś',
          })}

          {entry.closed && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
              <LockIcon sx={{ fontSize: 12, color: appColors.textMuted }} />
              <Typography sx={{ color: appColors.textMuted, fontSize: '0.6rem', letterSpacing: '0.12em' }}>
                ZAMKNIĘTA
              </Typography>
            </Box>
          )}

          {entry.note && (
            <Tooltip title={entry.note}>
              <EditNoteIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
            </Tooltip>
          )}
        </Box>

        {/* DWA WIERSZE ZAMIAST TRZECH PLUS BLOKU NARRACJI - kto pisał ostatni
            i kiedy Ty, a niżej stan narracji jednym zdaniem. Wcześniej te same
            fakty zajmowały cztery wiersze i osobny pasek z kropką. */}
        <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.85rem' }}>
          {entry.messages_count === 0 ? (
            'Brak wpisów w sesji.'
          ) : (
            <>
              Ostatni odpis:{' '}
              <Box component="span" sx={{
                color: entry.last_is_mine ? appColors.statusSuccess : theme.palette.primary.main,
                fontWeight: 'bold',
              }}>
                {lastCharacter || entry.last_author || 'Nieznany'}
                {entry.last_is_mine ? ' (Ty)' : ''}
                {entry.last_character_type === 'narrator' ? ' — narrator' : ''}
              </Box>
              {' — '}
              <Tooltip title={formatDateTime(entry.last_message_at) || ''}>
                <Box component="span">{formatRelative(entry.last_message_at)}</Box>
              </Tooltip>
              <Box component="span" sx={{ color: appColors.steelLight }}>
                {entry.my_last_post_at ? (
                  <>
                    {' · Twój: '}
                    <Tooltip title={formatDateTime(entry.my_last_post_at) || ''}>
                      <Box component="span">{formatRelative(entry.my_last_post_at)}</Box>
                    </Tooltip>
                  </>
                ) : ' · jeszcze tu nie pisałeś'}
              </Box>
            </>
          )}
        </Typography>

        {/* Stan narracji jako kolor tego jednego wiersza (zielony = poszła
            dziś, pomarańczowy = starsza), zamiast osobnego chipa z kropką.
            W sesji, w której tylko gram i nikt jeszcze nie narrował, ten wiersz
            nie niesie nic - więc go nie ma. */}
        {(entry.last_narration_at || participationOf(entry) !== 'player') && (
        <Typography sx={{ color: appColors.steelLight, fontSize: '0.78rem', mt: 0.25 }}>
          <Tooltip title={narration.hint}>
            <Box component="span" sx={{ color: narration.color, fontWeight: 'bold' }}>
              Narracja
            </Box>
          </Tooltip>
          {entry.last_narration_at ? (
            <>
              {': '}
              <Box component="span" sx={{
                color: entry.last_narration_is_mine ? appColors.statusSuccess : theme.palette.primary.main,
                fontWeight: 'bold',
              }}>
                {entry.last_narration_by || 'Narrator'}{entry.last_narration_is_mine ? ' (Ty)' : ''}
              </Box>
              {' — '}
              <Tooltip title={formatDateTime(entry.last_narration_at) || ''}>
                <Box component="span">{formatRelative(entry.last_narration_at)}</Box>
              </Tooltip>
            </>
          ) : ': nikt jeszcze nie poprowadził tej sceny'}
        </Typography>
        )}

        {/* NA KOGO CZEKAMY - tylko przy zielonym, bo przy czerwonym ruch jest po
            Twojej stronie i wytykanie innych myliłoby tropy. W sesji na pięć
            osób „ostatni wpis" nie mówi, kto właściwie milczy - a to zwykle
            jedna konkretna osoba. Najdłużej milczący idzie pierwszy. */}
        {waitingFor.length > 0 && (
          <Typography sx={{ color: appColors.steelLight, fontSize: '0.78rem', mt: 0.25 }}>
            Czekasz na:{' '}
            {waitingFor.map((person, index) => (
              <Box component="span" key={person.character_id}>
                {index > 0 && ', '}
                <Tooltip title={person.never_posted
                  ? 'Ta postać nie napisała w tej sesji jeszcze ani słowa.'
                  : `Ostatni wpis: ${formatDateTime(person.last_post_at)}`}>
                  <Box component="span" sx={{
                    color: ageInDays(person.silent_since) >= SILENCE_DANGER_DAYS
                      ? appColors.statusDanger
                      : (ageInDays(person.silent_since) >= SILENCE_WARNING_DAYS
                        ? appColors.statusWarning
                        : theme.palette.primary.main),
                    fontWeight: 'bold',
                  }}>
                    {waitingLabel(person)}
                  </Box>
                </Tooltip>
              </Box>
            ))}
            {entry.waiting_for_count > waitingFor.length
              && ` +${entry.waiting_for_count - waitingFor.length}`}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          <Button
            onClick={() => navigate(entry.url)}
            sx={{
              color: theme.palette.primary.main,
              border: `1px solid ${theme.palette.primary.main}80`,
              borderRadius: '2px',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              px: 1.5,
              py: 0.3,
              '&:hover': { bgcolor: `${theme.palette.primary.main}18` },
            }}
          >
            [ OTWÓRZ SESJĘ ]
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); openNoteDialog(entry); }}
            sx={{
              color: appColors.steelLight,
              border: `1px solid ${appColors.borderSteel}`,
              borderRadius: '2px',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              px: 1.5,
              py: 0.3,
              '&:hover': { bgcolor: `${appColors.steel}22`, color: appColors.textLight },
            }}
          >
            [ {entry.note ? 'NOTATKA ✎' : 'NOTATKA'} ]
          </Button>
          {waitingFor.length > 0 && (
            <Tooltip title={`Wyślij wiadomość prywatną do osoby, na którą czekasz (domyślnie: ${waitingFor[0].character_name}).`}>
              <Button
                onClick={(e) => { e.stopPropagation(); openNudgeDialog(entry); }}
                sx={{
                  color: theme.palette.primary.main,
                  border: `1px solid ${theme.palette.primary.main}80`,
                  borderRadius: '2px',
                  fontSize: '0.7rem',
                  letterSpacing: '0.1em',
                  px: 1.5,
                  py: 0.3,
                  '&:hover': { bgcolor: `${theme.palette.primary.main}18` },
                }}
              >
                [ SZTURCHNIJ ]
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pb: 2 }}>
      <Box sx={{ px: 2, pt: 2, mb: 1 }}>
        <Typography sx={{ color: appColors.textMuted, fontSize: '0.65rem', letterSpacing: '0.22em', mb: 0.25 }}>
          // SYSTEM KOMUNIKACJI
        </Typography>
        <Typography variant="h4" sx={{
          color: appColors.textLight,
          fontSize: { xs: '1.35rem', sm: '2.125rem' },
          letterSpacing: { xs: '0.02em', sm: '0.06em' },
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.75, sm: 1.5 },
          flexWrap: 'wrap',
        }}>
          <Box component="span" sx={{ color: theme.palette.primary.main, opacity: 0.7 }}>{'>'}</Box>
          Codziennik
        </Typography>
        <Typography sx={{ color: appColors.steelLight, fontSize: '0.8rem', mt: 0.5 }}>
          Sesje {character?.name ? <strong>{character.name}</strong> : 'Twojej postaci'}: gdzie czeka Twój odpis
          i jak stoi narracja. Zakładki dzielą je po tym, czym w nich odpisujesz — samą postacią,
          postacią i trybem narratora, czy wyłącznie trybem narratora.
        </Typography>
        {/* Legenda - trzy kolory i zegar tłumaczą całą listę, więc lepiej je
            napisać raz na górze niż powtarzać w dymkach przy każdej karcie. */}
        <Typography sx={{ color: appColors.textMuted, fontSize: '0.72rem', mt: 0.5 }}>
          <Box component="span" sx={{ color: appColors.statusDanger, fontWeight: 'bold' }}>● czerwony</Box>
          {' — ruch po Twojej stronie · '}
          <Box component="span" sx={{ color: appColors.statusWarning, fontWeight: 'bold' }}>● żółty</Box>
          {' — zrobiłeś połowę (odpis albo narrację), druga wisi · '}
          <Box component="span" sx={{ color: appColors.statusSuccess, fontWeight: 'bold' }}>● zielony</Box>
          {' — zrobione, czekasz na innych · '}
          <Box component="span" sx={{ color: appColors.statusNeutral, fontWeight: 'bold' }}>● szary</Box>
          {' — sesja bez wpisów · ⏳ — ile to już wisi.'}
        </Typography>
      </Box>

      {migrationHint && (
        <Box sx={{
          mx: 2,
          mb: 1.5,
          p: 1.25,
          border: `1px solid ${appColors.statusWarning}`,
          borderLeft: `3px solid ${appColors.statusWarning}`,
          bgcolor: `${appColors.statusWarning}12`,
        }}>
          <Typography sx={{ color: appColors.statusWarning, fontSize: '0.78rem' }}>
            ⚠️ {migrationHint} — do tego czasu działa sama lista sesji i statusy odpisów, bez ról,
            znaczników narracji i notatek do sesji ogólnych.
          </Typography>
        </Box>
      )}

      {notice && (
        <Box sx={{
          mx: 2,
          mb: 1.5,
          p: 1.25,
          border: `1px solid ${appColors.statusSuccess}`,
          borderLeft: `3px solid ${appColors.statusSuccess}`,
          bgcolor: `${appColors.statusSuccess}12`,
        }}>
          <Typography sx={{ color: appColors.statusSuccess, fontSize: '0.78rem' }}>
            ✓ {notice}
          </Typography>
        </Box>
      )}

      {/* ZAKŁADKI - pierwszy podział listy: czym w tych sesjach piszę. Stoją nad
          kafelkami, bo kafelki i filtry liczą się już W OBRĘBIE zakładki. */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 2, mb: 1.5 }}>
        {MODES.map((m) => (
          <Tooltip key={m.key} title={m.hint}>
            <Button onClick={() => setMode(m.key)} sx={modeTabSx(mode === m.key, modeColor(m.key))}>
              {m.label}
              <Box component="span" sx={{
                ml: 0.75,
                color: mode === m.key ? modeColor(m.key) : appColors.steel,
                fontWeight: 'bold',
              }}>
                {modeCounts[m.key]}
              </Box>
            </Button>
          </Tooltip>
        ))}
      </Box>

      {/* Cztery kafelki, nie sześć: „ile sesji łącznie" i „w ilu prowadzisz"
          mówią już zakładki, a znacznik narracji zszedł do popupu notatki. */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 2, mb: 1.5 }}>
        {renderSummaryTile('NA MNIE', stats.replyNeeded, appColors.statusDanger,
          'Sesje, w których nie zrobiłeś jeszcze nic po tym, jak odezwał się ktoś inny.')}
        {renderSummaryTile('POŁOWICZNE', stats.partial, appColors.statusWarning,
          'Sesje „gram i MG", w których zrobiłeś jedną połowę - odpis albo narrację.')}
        {renderSummaryTile('ZROBIONE', stats.replied, appColors.statusSuccess,
          'Sesje, w których zrobiłeś wszystko, co na Tobie - ruch po drugiej stronie.')}
        {renderSummaryTile(
          'NAJDŁUŻEJ CZEKA',
          oldestPending ? formatAge(oldestPending.since) : '—',
          oldestPending && ageInDays(oldestPending.since) >= SILENCE_WARNING_DAYS
            ? appColors.statusDanger
            : appColors.steelLight,
          oldestPending
            ? `Najstarsza zaległość: „${oldestPending.entry.title}" (${formatDateTime(oldestPending.since)}).`
            : 'Nic na Ciebie nie czeka.'
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 2, mb: 2 }}>
        {FILTERS.map((f) => (
          <Button key={f.key} onClick={() => setFilter(f.key)} sx={filterButtonSx(filter === f.key)}>
            {f.label}
          </Button>
        ))}
        <Button
          onClick={() => setIncludeClosed((prev) => !prev)}
          sx={filterButtonSx(includeClosed)}
        >
          {includeClosed ? 'Z ZAMKNIĘTYMI ✓' : 'Z ZAMKNIĘTYMI'}
        </Button>
      </Box>

      <Box sx={{ px: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: theme.palette.primary.main }} size={48} />
          </Box>
        ) : error ? (
          <Box sx={{
            p: 2,
            border: `1px solid ${appColors.dangerBorder}`,
            borderLeft: `3px solid ${appColors.dangerText}`,
            bgcolor: `${appColors.dangerBorder}10`,
          }}>
            <Typography sx={{ color: appColors.dangerText, fontSize: '0.85rem' }}>⚠️ {error}</Typography>
          </Box>
        ) : visibleEntries.length === 0 ? (
          <Box sx={{
            p: 4,
            textAlign: 'center',
            border: `2px dashed ${theme.palette.divider}`,
          }}>
            <Typography sx={{
              color: theme.palette.text.secondary,
              fontStyle: 'italic',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              {/* Postać bez ani jednej sesji dostaje komunikat o tym, a nie
                  o pustej zakładce - „nie grasz nigdzie" i „nie grasz TAK"
                  to dwie różne wiadomości. */}
              {entries.length === 0
                ? EMPTY_MODE_TEXT.all
                : (modeEntries.length === 0
                  ? EMPTY_MODE_TEXT[mode]
                  : '// BRAK SESJI W TYM FILTRZE //')}
            </Typography>
          </Box>
        ) : (
          visibleEntries.map(renderEntry)
        )}
      </Box>

      <Dialog open={!!noteEntry} onClose={closeNoteDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '1rem' }}>
          Wpis codziennika — {noteEntry?.title}
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            size="small"
            label="Twoja rola w tej sesji"
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value)}
            sx={{ mt: 1, mb: 1.5 }}
            helperText={roleDraft === 'auto' && noteEntry
              ? `Wykryta rola: ${ROLE_LABELS[noteEntry.role]?.toLowerCase() || 'gracz'}`
              : 'Ręcznie ustawiona rola nadpisuje wykrywanie.'}
          >
            {ROLE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            control={<Checkbox checked={todoDraft} onChange={(e) => setTodoDraft(e.target.checked)} />}
            label="Kolejna narracja jest na mnie"
          />
          <Typography sx={{ color: appColors.steelLight, fontSize: '0.72rem', mb: 1 }}>
            Znacznik gaśnie sam, gdy wyślesz w tej sesji post narratora. Jeśli narrację piszesz
            zwykłym postem — zdejmij go ręcznie.
          </Typography>

          <TextField
            type="date"
            fullWidth
            size="small"
            label="Termin narracji (opcjonalnie)"
            value={dueDraft}
            onChange={(e) => setDueDraft(e.target.value)}
            disabled={!todoDraft}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />

          <Typography sx={{ color: appColors.steelLight, fontSize: '0.75rem', mb: 1 }}>
            Notatka jest prywatna: widzi ją wyłącznie ta postać.
            {noteEntry?.session_type === 'private' && ' Dla sesji prywatnych to ta sama notatka, którą widzisz w widoku sesji.'}
          </Typography>
          <TextField
            multiline
            minRows={5}
            fullWidth
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Wątki, obietnice, terminy, pomysły na narrację i odpis..."
            inputProps={{ maxLength: 5000 }}
          />
          {noteError && (
            <Typography sx={{ color: appColors.dangerText, fontSize: '0.8rem', mt: 1 }}>
              ⚠️ {noteError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeNoteDialog} disabled={savingNote} sx={{ color: appColors.steelLight }}>
            Anuluj
          </Button>
          <Button onClick={saveNote} disabled={savingNote} sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
            {savingNote ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SZTURCHNIĘCIE - zwykła wiadomość prywatna, tylko z gotową treścią i
          adresatem wybranym za gracza. Wysyłka bez podglądu byłaby proszeniem
          się o wypadek, więc treść zawsze idzie przez to okno. */}
      <Dialog open={!!nudgeEntry} onClose={closeNudgeDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '1rem' }}>
          Szturchnięcie — {nudgeEntry?.title}
        </DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            size="small"
            label="Do kogo"
            value={nudgeTarget}
            onChange={(e) => changeNudgeTarget(e.target.value)}
            sx={{ mt: 1, mb: 1.5 }}
            helperText={nudgeEntry && nudgeEntry.waiting_for_count > (nudgeEntry.waiting_for || []).length
              ? `Pokazani są uczestnicy milczący najdłużej (${(nudgeEntry.waiting_for || []).length} z ${nudgeEntry.waiting_for_count}).`
              : 'Domyślnie osoba, która milczy najdłużej.'}
          >
            {(nudgeEntry?.waiting_for || []).map((person) => (
              <MenuItem key={person.character_id} value={String(person.character_id)}>
                {waitingLabel(person)}
              </MenuItem>
            ))}
          </TextField>

          <Typography sx={{ color: appColors.steelLight, fontSize: '0.75rem', mb: 1 }}>
            Wiadomość poleci jako zwykła wiadomość prywatna od Twojej postaci — trafi do skrzynki
            obu stron, więc możecie dogadać się w tym samym wątku.
          </Typography>
          <TextField
            multiline
            minRows={4}
            fullWidth
            value={nudgeText}
            onChange={(e) => setNudgeText(e.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          {nudgeError && (
            <Typography sx={{ color: appColors.dangerText, fontSize: '0.8rem', mt: 1 }}>
              ⚠️ {nudgeError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeNudgeDialog} disabled={sendingNudge} sx={{ color: appColors.steelLight }}>
            Anuluj
          </Button>
          <Button
            onClick={sendNudge}
            disabled={sendingNudge || !nudgeText.trim() || !nudgeTarget}
            sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}
          >
            {sendingNudge ? 'Wysyłanie...' : 'Wyślij'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SessionJournal;
