// ================================
// routes/sessionJournal.js - CODZIENNIK POSTACI
//
// Jedna lista wszystkich sesji (prywatnych i ogólnych), w których gra dana
// postać, z odpowiedzią na dwa pytania: „czy muszę odpisać?" i „jak stoi
// narracja?".
//
// ODPIS - status liczony z wiadomości, NIE z tabel `*_seen`, i ZALEŻNY OD TEGO,
// CZYM w danej sesji odpowiadam (patrz TRYB UDZIAŁU niżej):
//   * `replied`      (zielone) - zrobiłem wszystko, co w tej sesji na mnie:
//                     grający ma wysłany odpis postacią, MG - narrację,
//                     a „gram i MG" - jedno i drugie,
//   * `partial`      (żółte) - tylko „gram i MG": jedna połowa jest, drugiej
//                     nie ma (np. odpisałem postacią, ale narracji jeszcze nie
//                     poprowadziłem),
//   * `reply_needed` (czerwone) - nie zrobiłem nic po tym, jak odezwał się ktoś
//                     inny (albo sesja ruszyła bez mojego udziału),
//   * `waiting`      (szare) - w sesji nie ma jeszcze żadnego wpisu.
//
// KTÓRY WPIS JEST MÓJ: wpis moją postacią ALBO post narratora z mojego konta.
// Posty narratora w sesjach OGÓLNYCH idą do bazy z `character_id = NULL`
// (`generalSessions.js`, pisać nimi może tylko właściciel sesji), a w prywatnych
// z `character_id` postaci właściciela - więc „moje" rozstrzygamy po
// `user_id`, nie po postaci. Po `character_id` własna narracja w sesji ogólnej
// nigdy nie liczyła się jako moja i MG dostawał czerwone na swoich sesjach.
//
// Dzięki temu samo OTWARCIE sesji (które kasuje „nieprzeczytane") nie gasi
// czerwonego - dopiero wysłanie odpisu przestawia wpis na zielony. Flagę
// „nieprzeczytane" (`unread`) zwracamy osobno, bo to inna informacja:
// czerwone mówi „masz ruch", nieprzeczytane mówi „nie widziałeś treści".
//
// NARRACJA - posty narratora są w bazie oznaczone (`character_type='narrator'`),
// więc „kiedy była ostatnia narracja i czyja" wyliczamy, a nie każemy klikać.
// Oddajemy surowe znaczniki czasu: czy narracja poszła „dziś", rozstrzyga front
// w strefie czasowej gracza. Do tego jeden ręczny znacznik `narration_todo`
// („kolejna narracja jest na mnie"), który gaśnie sam, gdy postać wyśle post
// narratora po jego zaznaczeniu - ta sama mechanika co czerwone/zielone.
//
// ROLA W SESJI - domyślnie wykrywana (właściciel sesji = MG, ktoś kto pisał
// postem narratora = narrator), z ręcznym nadpisaniem w `session_role`.
//
// TRYB UDZIAŁU (`participation`) - decyduje, CO w tej sesji jest „moim ruchem",
// więc i o kolorze statusu. Odpowiedź na „czym ja w tej sesji piszę":
// `player` (tylko postacią), `mixed` (i postacią, i z trybu narratora), `gm`
// (wyłącznie z trybu narratora). Front trzyma na tym trzy zakładki - TYLKO GRAM
// / GRAM I MG / MG - więc lista przestaje mieszać granie z prowadzeniem.
// Szczegóły przy `resolveParticipation`.
//
// GDZIE CO SIEDZI: notatka do sesji PRYWATNEJ zostaje w
// `private_session_participant_notes`, bo tę samą notatkę pokazuje widok sesji
// („Twoja notatka"). Reszta - notatka do sesji ogólnej, rola, znacznik narracji
// - to `character_session_journal` (migracja: database/add-session-journal.sql).
// ================================

const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const pool = require('../config/database');
const { resolveCharacterIdAsync } = require('../utils/activeCharacter');

const db = pool.promise();

const JOURNAL_TABLE = 'character_session_journal';
const MIGRATION_HINT = 'Ta funkcja wymaga migracji bazy: uruchom database/add-session-journal.sql';
const SESSION_ROLES = ['auto', 'player', 'narrator', 'gm'];
const NOTE_MAX_LENGTH = 5000;

// Konfiguracja obu rodzajów sesji w jednym miejscu - reszta pliku jest wspólna.
const SESSION_TYPES = {
  private: {
    sessionsTable: 'private_sessions',
    messagesTable: 'private_session_messages',
    participantsTable: 'private_session_participants',
    seenTable: 'private_session_seen',
    // notatka współdzielona z widokiem sesji prywatnej
    ownNotesTable: 'private_session_participant_notes',
    // sesje prywatne mają właściciela w `owner_id`, ogólne w `created_by`
    ownerColumn: 'owner_id',
    extraColumns: '',
    path: '/home/privateSessions'
  },
  general: {
    sessionsTable: 'general_sessions',
    messagesTable: 'general_session_messages',
    participantsTable: 'general_session_participants',
    seenTable: 'general_session_seen',
    ownNotesTable: null, // notatka do sesji ogólnej mieszka w codzienniku
    ownerColumn: 'created_by',
    extraColumns: ', s.is_adult_only',
    path: '/home/generalSessions'
  }
};

// Tabela codziennika przychodzi z migracją. Zanim ktoś ją odpali, lista ma
// działać dalej - tylko bez ról, znaczników narracji i notatek do sesji
// ogólnych. Pierwszy `ER_NO_SUCH_TABLE` zapala tę flagę i kolejne zapytania od
// razu lecą wariantem bez JOIN-a.
let journalTableMissing = false;

const isMissingTable = (err) => !!err && err.code === 'ER_NO_SUCH_TABLE';

// Postać, na którą patrzymy: `characterId` z zapytania (musi należeć do konta)
// albo - gdy go nie ma - postać, którą gracz aktualnie gra.
async function resolveViewedCharacter(req) {
  const userId = req.user.id;
  const requested = req.query.characterId || req.body?.characterId;

  if (requested) {
    const [rows] = await db.query(
      `SELECT id, name FROM characters
       WHERE id = ? AND user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
       LIMIT 1`,
      [requested, userId]
    );
    if (rows.length === 0) {
      return { error: { status: 403, body: { error: 'Postać nie należy do Ciebie' } } };
    }
    return { characterId: rows[0].id, characterName: rows[0].name };
  }

  const characterId = await resolveCharacterIdAsync(req);
  if (!characterId) {
    return { error: { status: 404, body: { error: 'Brak aktywnej postaci' } } };
  }
  return { characterId, characterName: null };
}

// „Wpis jest mój" = wpis moją postacią albo post narratora z mojego konta.
// Posty narratora w sesjach ogólnych nie mają `character_id` (patrz nagłówek),
// więc rozstrzyga tu `user_id`. Dwa parametry: postać, potem użytkownik.
const MINE_SQL = `((m.character_type <> 'narrator' AND m.character_id = ?)
        OR (m.character_type = 'narrator' AND m.user_id = ?))`;

function querySessions(type, cfg, characterId, userId, includeClosed, withJournal) {
  const params = [];
  // Kolejność parametrów musi iść za kolejnością znaków `?` w tekście zapytania:
  // najpierw podzapytania z listy SELECT, potem warunki JOIN-ów.
  params.push(characterId, userId); // my_last_post_at
  params.push(characterId, userId); // last_other_at
  params.push(characterId);         // my_player_posts
  params.push(characterId);         // my_last_player_post_at
  params.push(userId);              // my_narration_count
  params.push(userId);              // my_last_narration_at
  params.push(characterId); // JOIN uczestników
  params.push(characterId); // JOIN seen
  if (withJournal) params.push(characterId);
  if (cfg.ownNotesTable) params.push(characterId);

  const sql = `
    SELECT
      s.id,
      s.title,
      s.closed,
      s.created_at,
      s.start_date,
      s.location,
      s.\`${cfg.ownerColumn}\` AS owner_user_id
      ${cfg.extraColumns},
      seen.seen_at,
      ${withJournal
        ? `j.session_role, j.narration_todo, j.narration_todo_at, j.narration_due_at, j.note AS journal_note`
        : `'auto' AS session_role, 0 AS narration_todo, NULL AS narration_todo_at, NULL AS narration_due_at, NULL AS journal_note`},
      ${cfg.ownNotesTable ? 'own_notes.note AS own_note' : 'NULL AS own_note'},
      (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id) AS last_message_at,
      -- mój ostatni ruch DOWOLNEGO rodzaju (odpis postacią albo narracja)
      (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id AND ${MINE_SQL}) AS my_last_post_at,
      -- ostatni wpis KOGOŚ INNEGO - punkt odniesienia dla „co jeszcze na mnie":
      -- narrację i odpis liczymy względem niego, a nie względem końca listy,
      -- bo w trybie „gram i MG" ostatni wpis w sesji bywa moim własnym.
      (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id AND NOT ${MINE_SQL}) AS last_other_at,
      (SELECT COUNT(*) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id
          AND m.character_type <> 'narrator' AND m.character_id = ?) AS my_player_posts,
      (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id
          AND m.character_type <> 'narrator' AND m.character_id = ?) AS my_last_player_post_at,
      (SELECT COUNT(*) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id
          AND m.character_type = 'narrator' AND m.user_id = ?) AS my_narration_count,
      (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id
          AND m.character_type = 'narrator' AND m.user_id = ?) AS my_last_narration_at,
      (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id AND m.character_type = 'narrator') AS last_narration_at,
      (SELECT COUNT(*) FROM ${cfg.messagesTable} m
        WHERE m.session_id = s.id) AS messages_count,
      (SELECT COUNT(*) FROM ${cfg.participantsTable} p
        WHERE p.session_id = s.id) AS participants_count
    FROM ${cfg.sessionsTable} s
    JOIN ${cfg.participantsTable} part
      ON part.session_id = s.id AND part.character_id = ?
    LEFT JOIN ${cfg.seenTable} seen
      ON seen.session_id = s.id AND seen.character_id = ?
    ${withJournal ? `LEFT JOIN ${JOURNAL_TABLE} j
      ON j.session_id = s.id AND j.session_type = '${type}' AND j.character_id = ?` : ''}
    ${cfg.ownNotesTable ? `LEFT JOIN ${cfg.ownNotesTable} own_notes
      ON own_notes.session_id = s.id AND own_notes.character_id = ?` : ''}
    ${includeClosed ? '' : 'WHERE s.closed = 0'}
    ORDER BY s.created_at DESC
  `;

  return db.query(sql, params).then(([rows]) => rows);
}

// Ostatni wpis każdej sesji - po MAX(id), nie po MAX(created_at): dwa wpisy
// w tej samej sekundzie dawały wcześniej dwa wiersze dla jednej sesji.
// `narratorOnly` szuka tego samego wśród postów narratora (ostatnia narracja).
async function fetchLastMessages(cfg, sessionIds, { narratorOnly = false } = {}) {
  const narratorFilter = narratorOnly ? "AND character_type = 'narrator'" : '';
  const [rows] = await db.query(
    `SELECT
       m.session_id,
       m.created_at,
       m.user_id,
       COALESCE(u.user, 'Bezimienny') AS author_name,
       m.character_id,
       m.character_name,
       m.character_type,
       CASE WHEN m.character_type = 'narrator' THEN c.name ELSE NULL END AS narrator_character_name
     FROM ${cfg.messagesTable} m
     LEFT JOIN users u ON u.id = m.user_id
     LEFT JOIN characters c ON c.id = m.character_id
     WHERE m.id IN (
       SELECT MAX(id) FROM ${cfg.messagesTable}
       WHERE session_id IN (?) ${narratorFilter}
       GROUP BY session_id
     )`,
    [sessionIds]
  );

  const bySession = {};
  rows.forEach((row) => { bySession[row.session_id] = row; });
  return bySession;
}

// Kiedy każdy uczestnik sesji pisał w niej ostatni raz - jedno zapytanie na
// rodzaj sesji, nie jedno na sesję. Stąd bierze się odpowiedź na pytanie „NA
// KOGO właściwie czekam", którego sam „ostatni wpis" nie daje: w sesji na pięć
// osób ostatni wpis jest jeden, a milczących może być czterech.
//
// LEFT JOIN po (session_id, character_id) chodzi po indeksie dokładanym przez
// database/add-session-journal.sql - bez niego to pełny skan tabeli wpisów.
// `last_post_at` = NULL znaczy „ta postać nie napisała tu jeszcze ani słowa".
//
// Postacie usunięte wypadają: martwa postać nic już nie odpisze, więc wisiałaby
// na liście „czekasz na" do końca świata (i dałoby się ją szturchnąć).
async function fetchParticipantActivity(cfg, sessionIds) {
  const [rows] = await db.query(
    `SELECT
       p.session_id,
       p.character_id,
       c.name AS character_name,
       c.user_id AS owner_user_id,
       MAX(m.created_at) AS last_post_at
     FROM ${cfg.participantsTable} p
     JOIN characters c ON c.id = p.character_id
     LEFT JOIN ${cfg.messagesTable} m
       ON m.session_id = p.session_id AND m.character_id = p.character_id
     WHERE p.session_id IN (?)
       AND (c.is_deleted IS NULL OR c.is_deleted = 0)
     GROUP BY p.session_id, p.character_id, c.name, c.user_id`,
    [sessionIds]
  );

  const bySession = {};
  rows.forEach((row) => {
    if (!bySession[row.session_id]) bySession[row.session_id] = [];
    bySession[row.session_id].push(row);
  });
  return bySession;
}

// Ilu uczestników pokazujemy na karcie zanim zwiniemy resztę do „+N".
const WAITING_FOR_LIMIT = 5;

// „Na kogo czekam" = uczestnicy, którzy NIE odezwali się po moim ostatnim
// wpisie (albo nie odezwali się w tej sesji ani razu), najdłużej milczący
// pierwszy. Postacie z mojego konta odpadają - czekanie na własną drugą postać
// nie jest informacją.
//
// Gdy sam jeszcze nic nie napisałem, lista jest pusta: ruch jest wtedy po mojej
// stronie i wskazywanie palcem na innych byłoby myleniem tropu.
function resolveWaitingFor(participants, { characterId, userId, myLastAt, sessionCreatedAt }) {
  if (myLastAt === null) return { list: [], count: 0 };

  const pending = participants
    .filter((p) => Number(p.character_id) !== Number(characterId))
    .filter((p) => Number(p.owner_user_id) !== Number(userId))
    .map((p) => ({
      character_id: p.character_id,
      character_name: p.character_name,
      last_post_at: p.last_post_at,
      // Od kiedy milczy: od swojego ostatniego wpisu, a jak nigdy nie pisał -
      // od założenia sesji.
      silent_since: p.last_post_at || sessionCreatedAt,
      never_posted: !p.last_post_at
    }))
    .filter((p) => p.never_posted || new Date(p.last_post_at).getTime() < myLastAt)
    .sort((a, b) => new Date(a.silent_since).getTime() - new Date(b.silent_since).getTime());

  return { list: pending.slice(0, WAITING_FOR_LIMIT), count: pending.length };
}

// Rola w sesji: ręczne ustawienie wygrywa, inaczej wnioskujemy z danych sesji.
function resolveRole(storedRole, { isOwner, myNarrationCount }) {
  if (storedRole && storedRole !== 'auto' && SESSION_ROLES.includes(storedRole)) {
    return { role: storedRole, source: 'manual' };
  }
  if (isOwner) return { role: 'gm', source: 'auto' };
  if (myNarrationCount > 0) return { role: 'narrator', source: 'auto' };
  return { role: 'player', source: 'auto' };
}

// TRYB UDZIAŁU - czym postać pisze w tej sesji. To on dzieli codziennik na trzy
// zakładki, bo „gdzie tylko gram" i „gdzie muszę jeszcze prowadzić" to dwa
// różne rodzaje roboty i mieszanie ich na jednej liście robiło z niej ścianę:
//   * `player` (TYLKO GRAM) - same wpisy postacią,
//   * `mixed`  (GRAM I MG)  - odpisy i postacią, i z trybu narratora,
//   * `gm`     (MG)         - odpisy wyłącznie z trybu narratora.
//
// Liczymy z wiadomości, bo to fakt, a nie deklaracja. Rola wchodzi do gry w
// dwóch miejscach, gdzie same wpisy nie wystarczą:
//   * postać jeszcze nic nie napisała - wtedy zostaje deklaracja, a dla sesji
//     ZAŁOŻONEJ przez gracza jest nią wykryte `gm`: świeżo założona sesja
//     prowadzącego trafia od razu do MG, a nie do grania;
//   * gracz RĘCZNIE ustawił sobie narratora/MG, a pisze zwykłymi postami -
//     narrację da się prowadzić bez trybu narratora, więc to `mixed`. Roli
//     wykrytej automatycznie tu nie honorujemy: `gm` bierze się z samego
//     posiadania sesji i sam z siebie nie mówi, że ktoś w niej prowadzi.
// STATUS - co w tej sesji jest jeszcze na mnie. Wszystko mierzone względem
// `otherAt`, czyli ostatniego wpisu KOGOŚ INNEGO: liczy się to, co zrobiłem po
// tym, jak ktoś się odezwał. Sam „ostatni wpis w sesji jest mój" nie wystarcza,
// bo w trybie `mixed` ostatnim wpisem bywa moja własna połowa roboty.
//
//   * `gm`     - odpisuję wyłącznie narracją, więc to ona gasi czerwone. Ten
//                sam post narratora u pozostałych graczy jest cudzym wpisem,
//                czyli zapala im „nie odpisałeś" - i o to chodzi;
//   * `mixed`  - dwie połowy (odpis postacią + narracja). Jedna zrobiona to
//                jeszcze nie koniec, ale też nie zaległość od zera -> `partial`;
//   * `player` - jak było: liczy się mój odpis postacią.
function resolveStatus({ hasMessages, participation, otherAt, myPlayerAt, myNarrationAt }) {
  if (!hasMessages) return { status: 'waiting', repliedAsPlayer: false, narrated: false };

  const after = (at) => at !== null && (otherAt === null || at > otherAt);
  const repliedAsPlayer = after(myPlayerAt);
  const narrated = after(myNarrationAt);

  if (participation === 'gm') {
    return { status: narrated ? 'replied' : 'reply_needed', repliedAsPlayer, narrated };
  }
  if (participation === 'mixed') {
    const status = (repliedAsPlayer && narrated)
      ? 'replied'
      : ((repliedAsPlayer || narrated) ? 'partial' : 'reply_needed');
    return { status, repliedAsPlayer, narrated };
  }
  return { status: repliedAsPlayer ? 'replied' : 'reply_needed', repliedAsPlayer, narrated };
}

function resolveParticipation({ myPlayerPosts, myNarrationCount, role, roleSource }) {
  const narrating = role === 'narrator' || role === 'gm';

  if (myNarrationCount > 0) return myPlayerPosts > 0 ? 'mixed' : 'gm';
  if (myPlayerPosts > 0) return (roleSource === 'manual' && narrating) ? 'mixed' : 'player';
  return narrating ? 'gm' : 'player';
}

async function fetchEntries(type, characterId, userId, includeClosed) {
  const cfg = SESSION_TYPES[type];
  const withJournal = !journalTableMissing;

  let sessions;
  try {
    sessions = await querySessions(type, cfg, characterId, userId, includeClosed, withJournal);
  } catch (err) {
    if (withJournal && isMissingTable(err)) {
      console.warn(`⚠️ Brak tabeli ${JOURNAL_TABLE} - codziennik bez ról i znaczników narracji. Odpal database/add-session-journal.sql`);
      journalTableMissing = true;
      sessions = await querySessions(type, cfg, characterId, userId, includeClosed, false);
    } else {
      throw err;
    }
  }

  if (sessions.length === 0) return { entries: [], doneTodoKeys: [] };

  const sessionIds = sessions.map((s) => s.id);
  const [lastBySession, lastNarrationBySession, participantsBySession] = await Promise.all([
    fetchLastMessages(cfg, sessionIds),
    fetchLastMessages(cfg, sessionIds, { narratorOnly: true }),
    fetchParticipantActivity(cfg, sessionIds)
  ]);

  const doneTodoKeys = [];

  const entries = sessions.map((s) => {
    const last = lastBySession[s.id] || null;
    const lastNarration = lastNarrationBySession[s.id] || null;

    const lastAt = s.last_message_at ? new Date(s.last_message_at).getTime() : null;
    const myLastAt = s.my_last_post_at ? new Date(s.my_last_post_at).getTime() : null;
    const seenAt = s.seen_at ? new Date(s.seen_at).getTime() : null;

    const isOwner = Number(s.owner_user_id) === Number(userId);
    const myNarrationCount = Number(s.my_narration_count) || 0;
    const myPlayerPosts = Number(s.my_player_posts) || 0;
    const { role, source } = resolveRole(s.session_role, { isOwner, myNarrationCount });
    const participation = resolveParticipation({
      myPlayerPosts, myNarrationCount, role, roleSource: source
    });

    const toTime = (value) => (value ? new Date(value).getTime() : null);
    const { status, repliedAsPlayer, narrated: narratedAfterOthers } = resolveStatus({
      hasMessages: lastAt !== null,
      participation,
      otherAt: toTime(s.last_other_at),
      myPlayerAt: toTime(s.my_last_player_post_at),
      myNarrationAt: toTime(s.my_last_narration_at)
    });

    const waitingFor = resolveWaitingFor(participantsBySession[s.id] || [], {
      characterId,
      userId,
      myLastAt,
      sessionCreatedAt: s.created_at
    });

    // Znacznik „kolejna narracja na mnie" gaśnie sam, gdy po jego zaznaczeniu
    // poszedł mój post narratora.
    const todoSetAt = s.narration_todo_at ? new Date(s.narration_todo_at).getTime() : null;
    const myLastNarrationAt = s.my_last_narration_at ? new Date(s.my_last_narration_at).getTime() : null;
    let narrationTodo = !!Number(s.narration_todo);
    let narrationJustDone = false;
    if (narrationTodo && myLastNarrationAt !== null && (todoSetAt === null || myLastNarrationAt > todoSetAt)) {
      narrationTodo = false;
      narrationJustDone = true;
      doneTodoKeys.push(s.id);
    }

    return {
      key: `${type}-${s.id}`,
      session_type: type,
      session_id: s.id,
      url: `${cfg.path}/${s.id}`,
      title: s.title,
      closed: !!s.closed,
      is_adult_only: type === 'general' ? !!s.is_adult_only : false,
      is_owner: isOwner,
      created_at: s.created_at,
      start_date: s.start_date,
      location: s.location,
      participants_count: Number(s.participants_count) || 0,
      messages_count: Number(s.messages_count) || 0,
      my_posts_count: myPlayerPosts + myNarrationCount,
      my_player_posts: myPlayerPosts,
      last_message_at: s.last_message_at,
      last_other_at: s.last_other_at,
      my_last_post_at: s.my_last_post_at,
      my_last_player_post_at: s.my_last_player_post_at,
      last_author: last ? last.author_name : null,
      last_author_id: last ? last.user_id : null,
      last_character_id: last ? last.character_id : null,
      last_character_name: last ? last.character_name : null,
      last_character_type: last ? last.character_type : null,
      narrator_character_name: last ? last.narrator_character_name : null,
      // Post narratora w sesji ogólnej nie ma `character_id`, więc „mój"
      // rozstrzyga tam autor wpisu.
      last_is_mine: !!(last && (
        Number(last.character_id) === Number(characterId)
        || (last.character_type === 'narrator' && Number(last.user_id) === Number(userId))
      )),
      // Kto z uczestników nie odezwał się po moim wpisie (najdłużej milczący
      // pierwszy) - front pokazuje to przy zielonym statusie i stąd bierze
      // adresata „szturchnięcia".
      waiting_for: waitingFor.list,
      waiting_for_count: waitingFor.count,
      status,
      // Które połowy „mojej roboty" są odrobione po ostatnim cudzym wpisie -
      // front pisze z tego, czego przy żółtym brakuje.
      my_reply_done: repliedAsPlayer,
      my_narration_done: narratedAfterOthers,
      unread: !!(lastAt && (seenAt === null || seenAt < lastAt)),
      seen_at: s.seen_at,
      note: (cfg.ownNotesTable ? s.own_note : s.journal_note) || null,

      // --- narracja ---
      // Front rozstrzyga „czy dziś" w strefie czasowej gracza, my dajemy fakty.
      last_narration_at: s.last_narration_at,
      last_narration_by: lastNarration
        ? (lastNarration.narrator_character_name || lastNarration.character_name || lastNarration.author_name)
        : null,
      last_narration_character_id: lastNarration ? lastNarration.character_id : null,
      last_narration_is_mine: !!(lastNarration && Number(lastNarration.user_id) === Number(userId)),
      my_last_narration_at: s.my_last_narration_at,
      my_narration_count: myNarrationCount,
      narration_todo: narrationTodo,
      narration_todo_at: s.narration_todo_at,
      narration_due_at: s.narration_due_at,
      narration_just_done: narrationJustDone,

      // --- rola ---
      session_role: s.session_role || 'auto',
      role: role,
      role_source: source,
      // Zakładka codziennika: 'player' (tylko gram) / 'mixed' (gram i MG) / 'gm'.
      participation
    };
  });

  return { entries, doneTodoKeys };
}

// Wygaszenie znaczników narracji, które postać już wykonała. Robimy to jednym
// UPDATE-em po odczycie (a nie przy wysyłce posta), żeby nie dokładać zapytań
// do gorącej ścieżki pisania wiadomości.
async function clearDoneTodos(type, characterId, sessionIds) {
  if (!sessionIds.length || journalTableMissing) return;
  try {
    await db.query(
      `UPDATE ${JOURNAL_TABLE}
       SET narration_todo = 0, narration_todo_at = NULL
       WHERE character_id = ? AND session_type = ? AND session_id IN (?)`,
      [characterId, type, sessionIds]
    );
  } catch (err) {
    if (isMissingTable(err)) journalTableMissing = true;
    else console.error('❌ Błąd gaszenia znacznika narracji:', err);
  }
}

// GET /sessionJournal - pełna lista sesji postaci (codziennik)
//   ?characterId=  postać inna niż aktualnie grana (musi należeć do konta)
//   ?includeClosed=1  dołącz sesje zamknięte (domyślnie tylko aktywne)
router.get('/sessionJournal', verifyToken, async (req, res) => {
  try {
    const viewed = await resolveViewedCharacter(req);
    if (viewed.error) return res.status(viewed.error.status).json(viewed.error.body);

    const includeClosed = req.query.includeClosed === '1' || req.query.includeClosed === 'true';
    const characterId = viewed.characterId;

    const [privateResult, generalResult] = await Promise.all([
      fetchEntries('private', characterId, req.user.id, includeClosed),
      fetchEntries('general', characterId, req.user.id, includeClosed)
    ]);

    await Promise.all([
      clearDoneTodos('private', characterId, privateResult.doneTodoKeys),
      clearDoneTodos('general', characterId, generalResult.doneTodoKeys)
    ]);

    const entries = [...privateResult.entries, ...generalResult.entries];

    // Najpierw to, co czeka na ruch gracza (zaległa narracja przed zaległym
    // odpisem - narracja blokuje całą sesję). Lista czyta się od góry jako „co
    // mam dziś do zrobienia".
    const rank = (entry) => {
      if (entry.narration_todo) return 0;
      if (entry.status === 'reply_needed') return 1;
      if (entry.status === 'partial') return 2;
      if (entry.status === 'waiting') return 3;
      return 4;
    };

    // W obrębie grupy kolejność zależy od tego, czyj jest ruch:
    //   * zaległości (narracja, odpis) - NAJSTARSZE PIERWSZE. Sesja, której nie
    //     odpisuję od dziewięciu dni, jest pilniejsza niż ta sprzed godziny, a
    //     przy sortowaniu po świeżości lądowała na samym dole czerwonych, czyli
    //     dokładnie tam, gdzie się jej nie widzi;
    //   * reszta (sesje bez wpisów, odpisane) - najświeższe pierwsze, bo tu nic
    //     nie wisi i liczy się „co się ostatnio działo".
    const oldestFirst = (entry) => rank(entry) <= 2;
    entries.sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const aTime = new Date(a.last_message_at || a.created_at).getTime();
      const bTime = new Date(b.last_message_at || b.created_at).getTime();
      return oldestFirst(a) ? aTime - bTime : bTime - aTime;
    });

    res.json({
      characterId,
      journalReady: !journalTableMissing,
      migrationHint: journalTableMissing ? MIGRATION_HINT : null,
      entries,
      summary: {
        total: entries.length,
        replyNeeded: entries.filter((e) => e.status === 'reply_needed' && !e.closed).length,
        partial: entries.filter((e) => e.status === 'partial' && !e.closed).length,
        replied: entries.filter((e) => e.status === 'replied').length,
        waiting: entries.filter((e) => e.status === 'waiting').length,
        unread: entries.filter((e) => e.unread).length,
        narrationTodo: entries.filter((e) => e.narration_todo && !e.closed).length,
        narrating: entries.filter((e) => e.role !== 'player' && !e.closed).length
      }
    });
  } catch (err) {
    console.error('❌ Błąd pobierania codziennika:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /sessionJournal/summary - sam licznik zaległości (badge w menu).
// Osobny, lekki endpoint: HUD odpytuje go co kilkadziesiąt sekund, więc nie
// chcemy przy tym budować całej listy z ostatnimi wpisami i notatkami.
router.get('/sessionJournal/summary', verifyToken, async (req, res) => {
  try {
    const viewed = await resolveViewedCharacter(req);
    if (viewed.error) return res.status(viewed.error.status).json(viewed.error.body);

    const characterId = viewed.characterId;
    const userId = req.user.id;

    // Badge liczy tylko CZERWONE (nic ode mnie po cudzym wpisie) - żółtego
    // „brakuje drugiej połowy" tu nie ma, bo wymagałoby powtórzenia całej
    // logiki trybu udziału w zapytaniu, a to endpoint odpytywany co 30 s.
    // „Mój wpis" ma tu tę samą definicję co na liście: postać albo narrator
    // z mojego konta.
    const countReplies = (cfg) => db.query(
      `SELECT COUNT(*) AS cnt
       FROM ${cfg.sessionsTable} s
       JOIN ${cfg.participantsTable} part
         ON part.session_id = s.id AND part.character_id = ?
       WHERE s.closed = 0
         AND EXISTS (SELECT 1 FROM ${cfg.messagesTable} m WHERE m.session_id = s.id)
         AND IFNULL(
               (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
                 WHERE m.session_id = s.id AND ${MINE_SQL}),
               '1000-01-01'
             ) < (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
                   WHERE m.session_id = s.id)`,
      [characterId, characterId, userId]
    ).then(([rows]) => rows[0]);

    // Zaległe narracje: znacznik zapalony i BEZ mojego posta narratora po jego
    // zaznaczeniu (czyli dokładnie to samo, co gasi znacznik przy liście).
    const countNarrationTodos = (type) => {
      const cfg = SESSION_TYPES[type];
      return db.query(
        `SELECT COUNT(*) AS cnt
         FROM ${JOURNAL_TABLE} j
         JOIN ${cfg.sessionsTable} s ON s.id = j.session_id AND s.closed = 0
         JOIN ${cfg.participantsTable} part
           ON part.session_id = s.id AND part.character_id = j.character_id
         WHERE j.character_id = ? AND j.session_type = ? AND j.narration_todo = 1
           AND IFNULL(
                 (SELECT MAX(m.created_at) FROM ${cfg.messagesTable} m
                   WHERE m.session_id = s.id AND m.character_type = 'narrator'
                     AND m.user_id = ?),
                 '1000-01-01'
               ) <= IFNULL(j.narration_todo_at, '1000-01-01')`,
        [characterId, type, userId]
      ).then(([rows]) => rows[0]);
    };

    const [privateReplies, generalReplies] = await Promise.all([
      countReplies(SESSION_TYPES.private),
      countReplies(SESSION_TYPES.general)
    ]);

    let narrationTodo = 0;
    if (!journalTableMissing) {
      try {
        const [privateTodos, generalTodos] = await Promise.all([
          countNarrationTodos('private'),
          countNarrationTodos('general')
        ]);
        narrationTodo = Number(privateTodos.cnt) + Number(generalTodos.cnt);
      } catch (err) {
        if (isMissingTable(err)) journalTableMissing = true;
        else throw err;
      }
    }

    const replyNeeded = Number(privateReplies.cnt) + Number(generalReplies.cnt);
    res.json({ characterId, replyNeeded, narrationTodo, todo: replyNeeded + narrationTodo });
  } catch (err) {
    console.error('❌ Błąd licznika codziennika:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Wspólna bramka dla zapisów: rodzaj sesji musi być znany, a postać musi być
// uczestnikiem tej sesji.
async function guardEntry(req, res) {
  const type = req.params.type;
  const cfg = SESSION_TYPES[type];
  if (!cfg) {
    res.status(400).json({ error: 'Nieznany rodzaj sesji' });
    return null;
  }

  const viewed = await resolveViewedCharacter(req);
  if (viewed.error) {
    res.status(viewed.error.status).json(viewed.error.body);
    return null;
  }

  const [participant] = await db.query(
    `SELECT 1 FROM ${cfg.participantsTable}
     WHERE session_id = ? AND character_id = ? LIMIT 1`,
    [req.params.sessionId, viewed.characterId]
  );
  if (participant.length === 0) {
    res.status(403).json({ error: 'Postać nie jest uczestnikiem tej sesji' });
    return null;
  }

  return { type, cfg, characterId: viewed.characterId, sessionId: req.params.sessionId };
}

// PATCH /sessionJournal/:type/:sessionId/note - notatka postaci do sesji
router.patch('/sessionJournal/:type/:sessionId/note', verifyToken, async (req, res) => {
  try {
    const ctx = await guardEntry(req, res);
    if (!ctx) return;

    // Kolumna `note` to TEXT (65 535 bajtów) - ucinamy z zapasem na wielobajtowe
    // znaki, żeby zbyt długa notatka nie kończyła się błędem bazy.
    const note = typeof req.body.note === 'string' && req.body.note.trim() !== ''
      ? req.body.note.slice(0, NOTE_MAX_LENGTH)
      : null;

    if (ctx.cfg.ownNotesTable) {
      // Sesja prywatna: ta sama notatka, którą pokazuje widok sesji.
      await db.query(
        `INSERT INTO ${ctx.cfg.ownNotesTable} (session_id, character_id, note)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE note = VALUES(note)`,
        [ctx.sessionId, ctx.characterId, note]
      );
    } else {
      await db.query(
        `INSERT INTO ${JOURNAL_TABLE} (character_id, session_type, session_id, note)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE note = VALUES(note)`,
        [ctx.characterId, ctx.type, ctx.sessionId, note]
      );
      journalTableMissing = false;
    }

    res.json({ success: true, note });
  } catch (err) {
    if (isMissingTable(err)) {
      journalTableMissing = true;
      console.warn(`⚠️ Brak tabeli ${JOURNAL_TABLE} - notatka nie została zapisana.`);
      return res.status(503).json({ error: MIGRATION_HINT });
    }
    console.error('❌ Błąd zapisu notatki w codzienniku:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PATCH /sessionJournal/:type/:sessionId/flags - rola w sesji i znacznik narracji
//   { sessionRole?: 'auto'|'player'|'narrator'|'gm',
//     narrationTodo?: boolean,
//     narrationDueAt?: 'YYYY-MM-DD' | null }
// Pola nieprzesłane zachowują dotychczasową wartość (partial update).
router.patch('/sessionJournal/:type/:sessionId/flags', verifyToken, async (req, res) => {
  try {
    const ctx = await guardEntry(req, res);
    if (!ctx) return;

    const { sessionRole, narrationTodo, narrationDueAt } = req.body;

    if (sessionRole !== undefined && !SESSION_ROLES.includes(sessionRole)) {
      return res.status(400).json({ error: 'Nieznana rola w sesji' });
    }

    let dueAt;
    if (narrationDueAt !== undefined) {
      if (!narrationDueAt) {
        dueAt = null;
      } else {
        const parsed = new Date(narrationDueAt);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'Nieprawidłowy termin narracji' });
        }
        dueAt = parsed;
      }
    }

    const [existing] = await db.query(
      `SELECT session_role, narration_todo, narration_todo_at, narration_due_at
       FROM ${JOURNAL_TABLE}
       WHERE character_id = ? AND session_type = ? AND session_id = ?
       LIMIT 1`,
      [ctx.characterId, ctx.type, ctx.sessionId]
    );
    const current = existing[0] || {
      session_role: 'auto', narration_todo: 0, narration_todo_at: null, narration_due_at: null
    };

    const nextRole = sessionRole !== undefined ? sessionRole : (current.session_role || 'auto');
    const wasTodo = !!Number(current.narration_todo);
    const nextTodo = narrationTodo !== undefined ? !!narrationTodo : wasTodo;
    // `narration_todo_at` to punkt odniesienia dla auto-gaszenia: liczy się
    // narracja wysłana PO zaznaczeniu, więc znacznik podniesiony na nowo
    // dostaje świeży czas.
    const nextTodoAt = nextTodo
      ? (wasTodo && current.narration_todo_at ? current.narration_todo_at : new Date())
      : null;
    const nextDueAt = narrationDueAt !== undefined
      ? dueAt
      : (nextTodo ? current.narration_due_at : null);

    await db.query(
      `INSERT INTO ${JOURNAL_TABLE}
         (character_id, session_type, session_id, session_role, narration_todo, narration_todo_at, narration_due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         session_role = VALUES(session_role),
         narration_todo = VALUES(narration_todo),
         narration_todo_at = VALUES(narration_todo_at),
         narration_due_at = VALUES(narration_due_at)`,
      [ctx.characterId, ctx.type, ctx.sessionId, nextRole, nextTodo ? 1 : 0, nextTodoAt, nextDueAt]
    );
    journalTableMissing = false;

    res.json({
      success: true,
      session_role: nextRole,
      narration_todo: nextTodo,
      narration_todo_at: nextTodoAt,
      narration_due_at: nextDueAt
    });
  } catch (err) {
    if (isMissingTable(err)) {
      journalTableMissing = true;
      console.warn(`⚠️ Brak tabeli ${JOURNAL_TABLE} - znacznik nie został zapisany.`);
      return res.status(503).json({ error: MIGRATION_HINT });
    }
    console.error('❌ Błąd zapisu znacznika w codzienniku:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
