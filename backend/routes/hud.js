// ================================
// routes/hud.js
// Liczniki paska postaci (nieprzeczytane sesje, wiadomości, karczma) w JEDNYM
// żądaniu.
//
// Dlaczego to powstało: front pytał o te cztery liczby osobno, co 10 sekund, i
// to w najdroższy możliwy sposób - pobierał PEŁNE listy (wszystkie sesje ogólne
// z ostatnimi wiadomościami, wszystkie sesje prywatne, wszystkie konwersacje) i
// dopiero w przeglądarce liczył, ile z nich jest nieprzeczytanych. Cztery
// żądania na gracza co 10 s, każde z kilkoma zapytaniami i pełnym transferem
// list, tylko po to, żeby wyświetlić cztery cyfry przy ikonkach.
//
// Tutaj liczy je baza, jednym zapytaniem na licznik, i wszystko wraca w jednej
// odpowiedzi: cztery żądania stają się jednym, a listy w ogóle nie opuszczają
// serwera. Kryteria "nieprzeczytane" są przepisane 1:1 z filtrów, które robił
// front - patrz komentarze przy zapytaniach.
// ================================

const express = require('express');
const router = express.Router();

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// Postać musi należeć do pytającego - dokładnie ten sam warunek, który miały
// rozbite endpointy (/generalSessions, /privateSessions, /conversations).
async function characterBelongsToUser(db, characterId, userId) {
  const [rows] = await db.query(
    'SELECT id FROM characters WHERE id = ? AND user_id = ?',
    [characterId, userId]
  );
  return rows.length > 0;
}

// Nieprzeczytane sesje ogólne: otwarta sesja, w której postać jest uczestnikiem,
// a od ostatniego zajrzenia pojawiła się nowa aktywność (brak wpisu "widziane"
// też liczy się jako nieprzeczytane).
const GENERAL_UNREAD_SQL = `
  SELECT COUNT(*) AS cnt
  FROM general_sessions gs
  JOIN general_session_participants gsp
    ON gsp.session_id = gs.id AND gsp.character_id = ?
  LEFT JOIN general_session_seen gss
    ON gss.session_id = gs.id AND gss.character_id = ?
  WHERE gs.closed = 0
    AND (
      gss.seen_at IS NULL
      OR COALESCE(
           (SELECT MAX(m.created_at) FROM general_session_messages m WHERE m.session_id = gs.id),
           gs.created_at
         ) > gss.seen_at
    )
`;

// Nieprzeczytane sesje prywatne. Uczestnictwo liczy się przez tabelę
// uczestników - sesje, w których gracz jest tylko właścicielem/narratorem bez
// swojej postaci, nie były liczone i tu też nie są.
const PRIVATE_UNREAD_SQL = `
  SELECT COUNT(*) AS cnt
  FROM private_sessions ps
  JOIN private_session_participants psp
    ON psp.session_id = ps.id AND psp.character_id = ?
  LEFT JOIN private_session_seen pss
    ON pss.session_id = ps.id AND pss.character_id = ?
  WHERE ps.closed = 0
    AND (
      pss.seen_at IS NULL
      OR GREATEST(
           ps.created_at,
           IFNULL((SELECT MAX(created_at) FROM private_session_messages WHERE session_id = ps.id), ps.created_at)
         ) > pss.seen_at
    )
`;

// Nieprzeczytane wiadomości prywatne - konwersacje, których postać nie skasowała
// po swojej stronie i w których od ostatniego zajrzenia coś przyszło.
const MESSAGES_UNREAD_SQL = `
  SELECT COUNT(*) AS cnt
  FROM conversations c
  LEFT JOIN conversation_seen cs
    ON cs.conversation_id = c.id AND cs.character_id = ?
  WHERE (
      (c.character1_id = ? AND c.deleted_by_character1 = 0)
      OR (c.character2_id = ? AND c.deleted_by_character2 = 0)
    )
    AND (
      cs.seen_at IS NULL
      OR GREATEST(
           c.created_at,
           IFNULL((SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id), '1970-01-01')
         ) > cs.seen_at
    )
`;

// Karczma: sygnalizujemy tylko wtedy, gdy postać SIEDZI w jakimś pokoju, a w tym
// pokoju pojawiły się wiadomości nowsze niż ostatnio przez nią widziana.
async function tavernHasUnread(db, userId, characterId) {
  const [rooms] = await db.query(
    'SELECT room_id FROM tavern_active_users WHERE user_id = ?',
    [userId]
  );
  if (rooms.length === 0) return { hasUnread: false, roomId: null };

  const roomId = rooms[0].room_id;
  const [seen] = await db.query(
    'SELECT last_seen_message_id FROM tavern_seen_messages WHERE character_id = ? AND room_id = ?',
    [characterId, roomId]
  );
  const lastSeenMessageId = seen.length > 0 ? seen[0].last_seen_message_id || 0 : 0;

  const [newer] = await db.query(
    'SELECT 1 FROM tavern_messages WHERE room_id = ? AND id > ? LIMIT 1',
    [roomId, lastSeenMessageId]
  );
  return { hasUnread: newer.length > 0, roomId };
}

// GET /hud/unread?characterId=123
router.get('/hud/unread', async (req, res) => {
  const userId = req.user.id;
  const characterId = Number(req.query.characterId);

  if (!Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ message: 'Nieprawidłowe ID postaci' });
  }

  const db = pool.promise();

  try {
    if (!(await characterBelongsToUser(db, characterId, userId))) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

    const [general, priv, messages, tavern] = await Promise.all([
      db.query(GENERAL_UNREAD_SQL, [characterId, characterId]),
      db.query(PRIVATE_UNREAD_SQL, [characterId, characterId]),
      db.query(MESSAGES_UNREAD_SQL, [characterId, characterId, characterId]),
      tavernHasUnread(db, userId, characterId),
    ]);

    res.status(200).json({
      generalSessions: general[0][0].cnt,
      privateSessions: priv[0][0].cnt,
      messages: messages[0][0].cnt,
      tavernUnread: tavern.hasUnread,
      tavernRoomId: tavern.roomId,
    });
  } catch (err) {
    console.error('❌ Błąd pobierania liczników HUD:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// GET /hud/character?characterId=123
//
// Dane postaci dla paska u góry ekranu (imię, awatar, rasa, przydomek).
// Osobny, wąski endpoint zamiast pełnego profilu - TopBar odpytuje go regularnie,
// a profil jest najcięższym zapytaniem w grze.
router.get('/hud/character', async (req, res) => {
  const userId = req.user.id;
  const characterId = Number(req.query.characterId);

  if (!Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ message: 'Nieprawidłowe ID postaci' });
  }

  try {
    const [rows] = await pool.promise().query(
      `SELECT id, name, avatar, race, faction, epithet, narrative_role
       FROM characters
       WHERE id = ? AND user_id = ?`,
      [characterId, userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

    const c = rows[0];

    res.status(200).json({
      id: c.id,
      nickname: c.name || '',
      avatar: c.avatar || '',
      race: c.race || '',
      faction: c.faction || '',
      epithet: c.epithet || '',
      narrativeRole: c.narrative_role || '',
    });
  } catch (err) {
    console.error('❌ Błąd pobierania paska postaci:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

module.exports = { router, initialize };
