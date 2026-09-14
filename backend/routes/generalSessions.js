const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const pool = require('../config/database');
const { sanitizeDiceRolls, parseDiceRolls } = require('../utils/diceRolls');
const { chatMessageLimiter } = require('../middleware/rateLimiter');

// GET /generalSessions - Lista aktywnych sesji ogólnych
// GET /generalSessions - Lista aktywnych sesji ogólnych
router.get('/generalSessions', verifyToken, (req, res) => {
  const userId = req.user.id;
  const characterId = req.query.characterId;
  
  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }
  
  const checkCharacterQuery = `SELECT id FROM characters WHERE id = ? AND user_id = ?`;
  
  pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err || charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }
    
    // UPROSZCZONE QUERY:
    const sessionsQuery = `
      SELECT
        gs.id,
        gs.title,
        gs.is_adult_only,
        gs.created_at,
        gs.closed,
        gs.created_by,
        gs.created_at AS last_activity,
        IF(gsp.character_id IS NULL, 0, 1) AS is_participant,
        gss.seen_at AS participant_seen_at
      FROM general_sessions gs
      LEFT JOIN general_session_participants gsp ON gs.id = gsp.session_id AND gsp.character_id = ?
      LEFT JOIN general_session_seen gss ON gs.id = gss.session_id AND gss.character_id = ?
      WHERE gs.closed = 0
      ORDER BY gs.created_at DESC
    `;
    
    pool.query(sessionsQuery, [characterId, characterId], (err, sessions) => {
      if (err) {
        console.error('❌ Błąd pobierania sesji:', err);
        return res.status(500).json({ error: 'Błąd serwera' });
      }
      
      // Jeśli są sesje, pobierz dla każdej ostatnią wiadomość
      if (sessions.length === 0) {
        return res.json({ sessions: [] });
      }
      
      const sessionIds = sessions.map(s => s.id);
      
      const lastMessagesQuery = `
        SELECT 
          m.session_id,
          m.created_at,
          m.user_id,
          COALESCE(u.user, 'Bezimienny') AS author_name,
          m.character_id,
          m.character_name,
          m.character_type,
          CASE 
            WHEN m.character_type = 'narrator' THEN c.name
            ELSE NULL
          END AS narrator_character_name
        FROM general_session_messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN characters c ON m.character_id = c.id
        WHERE m.session_id IN (?)
        AND m.created_at = (
          SELECT MAX(created_at) 
          FROM general_session_messages 
          WHERE session_id = m.session_id
        )
      `;
      
      pool.query(lastMessagesQuery, [sessionIds], (err, messages) => {
        if (err) {
          console.error('❌ Błąd pobierania ostatnich wiadomości:', err);
          // Zwróć sesje bez ostatnich wiadomości
          return res.json({ sessions });
        }
        
        // Połącz dane sesji z ostatnimi wiadomościami
        const messagesMap = {};
        messages.forEach(msg => {
          messagesMap[msg.session_id] = msg;
        });
        
        const enrichedSessions = sessions.map(session => {
          const lastMsg = messagesMap[session.id];
          
          return {
            ...session,
            last_activity: lastMsg ? lastMsg.created_at : session.created_at,
            last_author: lastMsg ? lastMsg.author_name : null,
            last_author_id: lastMsg ? lastMsg.user_id : null,
            last_character_id: lastMsg ? lastMsg.character_id : null,
            last_character_name: lastMsg ? lastMsg.character_name : null,
            last_character_type: lastMsg ? lastMsg.character_type : null,
            narrator_character_name: lastMsg ? lastMsg.narrator_character_name : null
          };
        });
        
        // Posortuj po last_activity
        enrichedSessions.sort((a, b) => {
          const dateA = new Date(a.last_activity);
          const dateB = new Date(b.last_activity);
          return dateB - dateA; // Od najnowszych
        });
        
        res.json({ sessions: enrichedSessions });
      });
    });
  });
});

// GET /generalSessions/archive - Archiwum zamkniętych sesji
router.get('/generalSessions/archive', verifyToken, (req, res) => {
  const userId = req.user.id;
  const characterId = req.query.characterId;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  const checkCharacterQuery = `SELECT id FROM characters WHERE id = ? AND user_id = ?`;
  
  pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    const archiveQuery = `
      SELECT DISTINCT
        gs.id,
        gs.title,
        gs.is_adult_only,
        gs.closed,
        gs.created_by,
        u.user as created_by_name,
        GREATEST(gs.created_at, COALESCE(latest.last_activity, gs.created_at)) AS last_activity,
        COALESCE(latest.last_author, 'Brak wiadomości') AS last_author,
        IF(gsp.character_id IS NULL, 0, 1) AS is_participant,
        gss.seen_at
      FROM general_sessions gs
      JOIN users u ON gs.created_by = u.id
      LEFT JOIN general_session_participants gsp ON gs.id = gsp.session_id AND gsp.character_id = ?
      LEFT JOIN general_session_seen gss ON gs.id = gss.session_id AND gss.character_id = ?
      LEFT JOIN (
        SELECT
          m.session_id,
          GREATEST(m.created_at, IFNULL(m.edited_at, m.created_at)) AS last_activity,
          COALESCE(u.user, 'Bezimienny') AS last_author
        FROM general_session_messages m
        JOIN (
          SELECT session_id, MAX(GREATEST(created_at, IFNULL(edited_at, created_at))) AS max_date
          FROM general_session_messages
          GROUP BY session_id
        ) mx ON m.session_id = mx.session_id
           AND GREATEST(m.created_at, IFNULL(m.edited_at, m.created_at)) = mx.max_date
        LEFT JOIN users u ON m.user_id = u.id
      ) AS latest ON gs.id = latest.session_id
      WHERE gs.closed = 1
      ORDER BY last_activity DESC
    `;
    
    pool.query(archiveQuery, [characterId, characterId], (err, rows) => {
      if (err) {
        console.error('❌ Błąd pobierania archiwum:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ sessions: rows });
    });
  });
});

// PATCH /generalSessions/:id/reopen - Przywróć sesję z archiwum
router.patch('/generalSessions/:id/reopen', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  
  const checkOwnerQuery = `SELECT created_by FROM general_sessions WHERE id = ?`;
  
  pool.query(checkOwnerQuery, [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ error: 'Sesja nie istnieje' });
    }
    if (results[0].created_by !== userId) {
      return res.status(403).json({ error: 'Tylko właściciel może przywrócić sesję' });
    }

    const query = `UPDATE general_sessions SET closed = 0 WHERE id = ?`;
    
    pool.query(query, [sessionId], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) {
        return res.status(403).json({ error: 'Błąd podczas przywracania sesji' });
      }
      res.json({ success: true });
    });
  });
});

// GET /generalSessions/:id - Szczegóły sesji
router.get('/generalSessions/:id', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const characterId = req.query.characterId;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  pool.query('SELECT id, name, user_id FROM characters WHERE id = ?', [characterId], (err, charResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania postaci:', err);
      return res.status(500).json({ error: 'Błąd postaci: ' + err.message });
    }
    
    if (charResults.length === 0) {
      return res.status(404).json({ error: 'Postać nie istnieje' });
    }

    if (charResults[0].user_id !== userId) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    pool.query('SELECT * FROM general_sessions WHERE id = ?', [sessionId], (err, sessionResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania sesji:', err);
        return res.status(500).json({ error: 'Błąd sesji: ' + err.message });
      }
      
      if (sessionResults.length === 0) {
        return res.status(404).json({ error: 'Sesja nie istnieje' });
      }

      const session = sessionResults[0];

      const messagesQuery = `
        SELECT
          m.id, m.message, m.created_at, m.edited_at, m.message_type, m.dice_rolls,
          u.id AS author_id, COALESCE(u.user, 'Bezimienny') AS author_name,
          m.character_type, m.character_id, m.character_name,
          CASE
            WHEN m.character_type = 'narrator' THEN c.name
            ELSE NULL
          END AS narrator_character_name,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.avatar
          END AS character_avatar
        FROM general_session_messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN characters c ON m.character_id = c.id
        WHERE m.session_id = ?
        ORDER BY m.created_at ASC
      `;
      
      pool.query(messagesQuery, [sessionId], (err, messages) => {
        if (err) {
          console.error('❌ Błąd pobierania wiadomości:', err);
          return res.status(500).json({ error: err.message });
        }

        // Rozpakuj JSON z rzutami. parseDiceRolls jest odporne na uszkodzony wpis -
        // surowy JSON.parse leciał tu w callbacku zapytania, więc jeden zły rekord
        // wywracał nie żądanie, tylko cały proces serwera.
        messages = messages.map(msg => ({
          ...msg,
          dice_rolls: parseDiceRolls(msg.dice_rolls)
        }));

        const participantsQuery = `
          SELECT
            c.id AS character_id,
            c.name AS character_name,
            c.avatar AS character_avatar,
            c.race,
            c.faction,
            r.color AS race_color,
            c.gender,
                c.user_id,
            u.user AS username
          FROM general_session_participants gsp
          JOIN characters c ON gsp.character_id = c.id
          JOIN users u ON c.user_id = u.id
          LEFT JOIN races r ON r.\`key\` = c.faction
          WHERE gsp.session_id = ?
          ORDER BY u.user, c.name
        `;
        
        pool.query(participantsQuery, [sessionId], (err, participants) => {
          if (err) {
            console.error('❌ Błąd pobierania uczestników:', err);
            return res.status(500).json({ error: err.message });
          }

const response = {
  session: {
    id: parseInt(sessionId),
    title: session.title || 'Sesja',
    is_adult_only: session.is_adult_only || 0,
    created_by: session.created_by,
    closed: session.closed || 0,
    created_at: session.created_at,
    last_activity: session.created_at,
    start_date: session.start_date || null,
    location: session.location || null,
    additional_info: session.additional_info || null,
    notes: session.notes || null
  },
  participants: participants,
  messages: messages
};
          
          return res.json(response);
        });
      });
    });
  });
});

// POST /generalSessions/:id/seen - Oznacz jako przeczytane (prostsze rozwiązanie)
router.post('/generalSessions/:id/seen', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const { characterId } = req.body;
  
  console.log('📖 Marking session as read:', { sessionId, characterId, userId });

  const checkQuery = `SELECT c.* FROM characters c WHERE c.id = ? AND c.user_id = ?`;
  
  pool.query(checkQuery, [characterId, userId], (err, rows) => {
    if (err) {
      console.error('❌ Error checking character:', err);
      return res.status(500).json({ error: err.message });
    }
    if (rows.length === 0) {
      // Stan klienta (nieaktualne activeCharacterId), nie awaria backendu -
      // warn zamiast error, żeby nie zakładać wpisu w Bugtracku.
      console.warn(`⚠️  Odrzucone seen: postać ${characterId} nie należy do użytkownika ${userId} (sesja ${sessionId})`);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Wpis "seen" zakładamy tylko uczestnikowi sesji. Sesję ogólną może otworzyć
    // każdy, a nieprzeczytane liczone są wyłącznie dla uczestników - osierocony
    // wiersz był martwy, a przy późniejszym dodaniu tej postaci do sesji
    // pre-seedował jej seen_at (addMembers używa INSERT IGNORE, więc nie
    // nadpisywał go pustą wartością).
    // Pojedynczy upsert zamiast SELECT + INSERT/UPDATE - dwa równoległe
    // otwarcia sesji potrafiły trafić w unikalny klucz i zwrócić 500.
    const markSeenQuery = `
      INSERT INTO general_session_seen (session_id, character_id, seen_at)
      SELECT ?, ?, NOW() FROM DUAL
      WHERE EXISTS (
        SELECT 1 FROM general_session_participants
        WHERE session_id = ? AND character_id = ?
      )
      ON DUPLICATE KEY UPDATE seen_at = NOW()
    `;

    pool.query(markSeenQuery, [sessionId, characterId, sessionId, characterId], (err, result) => {
      if (err) {
        console.error('❌ Error marking seen record:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, marked: result.affectedRows > 0 });
    });
  });
});

// GET /generalSessions/:sessionId/messages - Pobierz wiadomości
router.get('/generalSessions/:sessionId/messages', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  
  const query = `
    SELECT
      gm.*,
      u.user AS username,
      gm.character_type,
      gm.character_id,
      gm.character_name,
      gm.message_type,
      CASE
        WHEN gm.character_type = 'narrator' THEN c.name
        ELSE NULL
      END AS narrator_character_name,
      CASE
        WHEN gm.character_type = 'narrator' THEN NULL
        ELSE c.avatar
      END AS character_avatar,
      CASE
        WHEN gm.character_type = 'narrator' THEN NULL
        ELSE c.race
      END AS character_race,
      CASE
        WHEN gm.character_type = 'narrator' THEN NULL
        ELSE c.gender
      END AS character_gender,
      CASE
        WHEN gm.character_type = 'narrator' THEN NULL
        ELSE c.faction
      END AS character_faction
    FROM general_session_messages gm
    JOIN users u ON gm.user_id = u.id
    LEFT JOIN characters c ON gm.character_id = c.id
    WHERE gm.session_id = ?
    ORDER BY gm.created_at ASC
  `;

  pool.query(query, [sessionId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania wiadomości:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    // Rozpakuj JSON z rzutami. parseDiceRolls jest odporne na uszkodzony wpis -
    // surowy JSON.parse leciał tu w callbacku zapytania, więc jeden zły rekord
    // wywracał nie żądanie, tylko cały proces serwera.
    const messages = results.map(msg => ({
      ...msg,
      dice_rolls: parseDiceRolls(msg.dice_rolls)
    }));

    res.json({ messages });
  });
});

// POST /generalSessions - Utwórz nową sesję
router.post('/generalSessions', verifyToken, (req, res) => {
  const { title, participantCharacterIds, startDate, location, additionalInfo, notes, isAdultOnly } = req.body;
  const ownerId = req.user.id;

  if (!title) {
    return res.status(400).json({ error: 'Tytuł jest wymagany' });
  }

  if (participantCharacterIds && participantCharacterIds.length > 0) {
    const placeholders = participantCharacterIds.map(() => '?').join(',');
    const checkCharactersQuery = `
      SELECT id, name, user_id FROM characters
      WHERE id IN (${placeholders})
    `;

    pool.query(checkCharactersQuery, participantCharacterIds, (err, characterResults) => {
      if (err) return res.status(500).json({ error: err.message });
      if (characterResults.length !== participantCharacterIds.length) {
        return res.status(400).json({ error: 'Niektóre postaci nie istnieją' });
      }

      createSessionWithCharacters();
    });
  } else {
    createSessionWithCharacters();
  }

  function createSessionWithCharacters() {
    const insertSessionQuery = `
      INSERT INTO general_sessions
      (title, is_adult_only, created_by, start_date, location, additional_info, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    pool.query(
      insertSessionQuery,
      [title, isAdultOnly ? 1 : 0, ownerId, startDate || null, location || null, additionalInfo || null, notes || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const sessionId = result.insertId;

        if (participantCharacterIds && participantCharacterIds.length > 0) {
          const participantValues = participantCharacterIds.map(charId => [sessionId, charId]);
          const insertParticipantsQuery = `
            INSERT INTO general_session_participants (session_id, character_id) VALUES ?
          `;
          
          pool.query(insertParticipantsQuery, [participantValues], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            const seenValues = participantCharacterIds.map(charId => [sessionId, charId, null]);
            const insertSeenQuery = `
              INSERT INTO general_session_seen (session_id, character_id, seen_at) VALUES ?
            `;
            
            pool.query(insertSeenQuery, [seenValues], (err) => {
              if (err) console.error('❌ Błąd tworzenia rekordów seen:', err);
              return res.json({ id: sessionId });
            });
          });
        } else {
          return res.json({ id: sessionId });
        }
      }
    );
  }
});

// POST /generalSessions/:id/messages - Wyślij wiadomość
router.post('/generalSessions/:id/messages', verifyToken, chatMessageLimiter, (req, res) => {
  const sessionId = req.params.id;
  const { message, isNarrator = false, diceRolls } = req.body;
  const userId = req.user.id;
  const characterId = req.body.characterId;

  const checkSessionClosedQuery = `SELECT closed FROM general_sessions WHERE id = ?`;

  pool.query(checkSessionClosedQuery, [sessionId], (err, sessionResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (sessionResults.length === 0) {
      return res.status(404).json({ error: 'Sesja nie istnieje' });
    }
    if (sessionResults[0].closed) {
      return res.status(403).json({ error: 'Sesja jest zamknięta - nie można dodawać wiadomości' });
    }

    const checkCharacterQuery = `SELECT id, name FROM characters WHERE id = ? AND user_id = ?`;

    pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err || charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    const character = charResults[0];

    if (isNarrator) {
      const checkOwnerQuery = `SELECT created_by FROM general_sessions WHERE id = ?`;
      pool.query(checkOwnerQuery, [sessionId], (err, ownerResults) => {
        if (err || ownerResults.length === 0) {
          return res.status(404).json({ error: 'Sesja nie istnieje' });
        }
        if (ownerResults[0].created_by !== userId) {
          return res.status(403).json({ error: 'Tylko właściciel może pisać jako narrator' });
        }
        insertNarratorMessage();
      });
    } else {
      const checkParticipantQuery = `
        SELECT * FROM general_session_participants 
        WHERE session_id = ? AND character_id = ?
      `;
      
      pool.query(checkParticipantQuery, [sessionId, characterId], (err, participantResults) => {
        if (err || participantResults.length === 0) {
          return res.status(403).json({ error: 'Postać nie ma dostępu do tej sesji' });
        }
        insertCharacterMessage(character);
      });
    }

    function insertNarratorMessage() {
      const insertQuery = `
        INSERT INTO general_session_messages
        (session_id, user_id, message, character_type, character_id, character_name, dice_rolls)
        VALUES (?, ?, ?, 'narrator', NULL, 'Narrator', ?)
      `;

      // Rzuty kością liczy serwer - nie ufamy wynikowi przysłanemu przez klienta
      const sanitizedDiceRolls = sanitizeDiceRolls(diceRolls, userId);
      const diceRollsJson = sanitizedDiceRolls ? JSON.stringify(sanitizedDiceRolls) : null;

      pool.query(insertQuery, [sessionId, userId, message, diceRollsJson], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const messageId = result.insertId;

        // Oznacz sesję jako przeczytaną dla character_id właściciela/narratora.
        // Narrator może pisać postacią, której nie ma wśród uczestników - dla niej
        // wpis "seen" byłby martwy (nieprzeczytane liczy się tylko uczestnikom).
        if (characterId) {
          const markSeenQuery = `
            INSERT INTO general_session_seen (session_id, character_id, seen_at)
            SELECT ?, ?, NOW() FROM DUAL
            WHERE EXISTS (
              SELECT 1 FROM general_session_participants
              WHERE session_id = ? AND character_id = ?
            )
            ON DUPLICATE KEY UPDATE seen_at = NOW()
          `;

          pool.query(markSeenQuery, [sessionId, characterId, sessionId, characterId], (err) => {
            if (err) console.error('❌ Błąd oznaczania seen:', err);
            returnNewMessage(messageId);
          });
        } else {
          returnNewMessage(messageId);
        }
      });
    }

    function insertCharacterMessage(character) {
      const insertQuery = `
        INSERT INTO general_session_messages
        (session_id, user_id, message, character_type, character_id, character_name, dice_rolls)
        VALUES (?, ?, ?, 'main', ?, ?, ?)
      `;

      // Rzuty kością liczy serwer - nie ufamy wynikowi przysłanemu przez klienta
      const sanitizedDiceRolls = sanitizeDiceRolls(diceRolls, userId);
      const diceRollsJson = sanitizedDiceRolls ? JSON.stringify(sanitizedDiceRolls) : null;

      pool.query(insertQuery, [sessionId, userId, message, character.id, character.name, diceRollsJson], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const messageId = result.insertId;

        // Oznacz sesję jako przeczytaną dla nadawcy
        const markSeenQuery = `
          INSERT INTO general_session_seen (session_id, character_id, seen_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE seen_at = NOW()
        `;

        pool.query(markSeenQuery, [sessionId, characterId], (err) => {
          if (err) console.error('❌ Błąd oznaczania seen:', err);
          returnNewMessage(messageId);
        });
      });
    }

    function returnNewMessage(messageId) {
      const selectQuery = `
        SELECT
          m.id, m.message, m.created_at, m.edited_at, m.dice_rolls,
          u.id AS author_id, COALESCE(u.user, 'Bezimienny') AS author_name,
          m.character_type, m.character_id, m.character_name,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.avatar
          END AS character_avatar
        FROM general_session_messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN characters c ON (m.character_type != 'narrator' AND m.character_id = c.id)
        WHERE m.id = ?
      `;

      pool.query(selectQuery, [messageId], (err, messageRows) => {
        if (err) return res.status(500).json({ error: err.message });
        const message = messageRows[0];
        // Rozpakuj JSON z rzutami (odporne na uszkodzony wpis - patrz parseDiceRolls).
        message.dice_rolls = parseDiceRolls(message.dice_rolls);
        res.json(message);
      });
    }
    });
  });
});

// PATCH /generalSessions/:sessionId/messages/:messageId - Edytuj wiadomość
router.patch('/generalSessions/:sessionId/messages/:messageId', verifyToken, (req, res) => {
  const { sessionId, messageId } = req.params;
  const { message } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Sprawdź czy wiadomość istnieje i pobierz jej szczegóły wraz ze statusem sesji
  const checkQuery = `
    SELECT m.*, gs.closed AS session_closed
    FROM general_session_messages m
    JOIN general_sessions gs ON gs.id = m.session_id
    WHERE m.id = ? AND m.session_id = ?
  `;

  pool.query(checkQuery, [messageId, sessionId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: 'Wiadomość nie istnieje' });

    const messageData = rows[0];

    if (messageData.session_closed) {
      return res.status(403).json({ error: 'Sesja jest zamknięta - nie można edytować wiadomości' });
    }

    // Sprawdź czy to nie jest post podsumowania sesji
    if (messageData.message_type === 'session_summary') {
      return res.status(403).json({ error: 'Nie można edytować podsumowania sesji' });
    }

    // Sprawdź uprawnienia: właściciel wiadomości LUB admin/mistrz_gry
    const isOwner = messageData.user_id === userId;
    const isAdminOrGameMaster = userRole === 'admin' || userRole === 'mistrz_gry';

    if (!isOwner && !isAdminOrGameMaster) {
      return res.status(403).json({ error: 'Brak uprawnień do edycji tej wiadomości' });
    }

    const updateQuery = `
      UPDATE general_session_messages SET message = ?, edited_at = NOW() WHERE id = ?
    `;

    pool.query(updateQuery, [message, messageId], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const selectQuery = `
        SELECT
          m.id, m.message, m.created_at, m.edited_at, m.dice_rolls,
          u.id AS author_id, COALESCE(u.user, 'Bezimienny') AS author_name,
          m.character_type, m.character_id, m.character_name,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.avatar
          END AS character_avatar
        FROM general_session_messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN characters c ON (m.character_type != 'narrator' AND m.character_id = c.id)
        WHERE m.id = ?
      `;

      pool.query(selectQuery, [messageId], (err, messageRows) => {
        if (err) return res.status(500).json({ error: err.message });
        const message = messageRows[0];
        // Rozpakuj JSON z rzutami (odporne na uszkodzony wpis - patrz parseDiceRolls).
        message.dice_rolls = parseDiceRolls(message.dice_rolls);
        res.json(message);
      });
    });
  });
});

// PATCH /generalSessions/:id/close - Zamknij sesję z podsumowaniem
router.patch('/generalSessions/:id/close', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const {
    characterId,
    description,
    world_consequences,
    character_consequences,
    advantages_disadvantages,
    participantConsequences // array: [{character_id, positive_consequences, negative_consequences, positive_level, negative_level}]
  } = req.body;

  // Poziom zalety/wady 1-5 (null = nie podano)
  const parseLevel = (raw) => {
    const lvl = parseInt(raw, 10);
    return Number.isInteger(lvl) && lvl >= 1 && lvl <= 5 ? lvl : null;
  };

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Opis podsumowania jest wymagany' });
  }

  const checkCharacterQuery = `SELECT id, name FROM characters WHERE id = ? AND user_id = ?`;

  pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    const checkAccessQuery = `
      SELECT gs.* FROM general_sessions gs
      WHERE gs.id = ? AND gs.created_by = ?
    `;

    pool.query(checkAccessQuery, [sessionId, userId], (err, accessResults) => {
      if (err) return res.status(500).json({ error: err.message });
      if (accessResults.length === 0) {
        return res.status(403).json({ error: 'Tylko właściciel może zamknąć sesję' });
      }

      // Bez tego ponowne zamknięcie tej samej sesji dokładało drugi post
      // podsumowania i duplikowało session_reports każdemu uczestnikowi.
      if (accessResults[0].closed) {
        return res.status(409).json({ error: 'Sesja jest już zamknięta' });
      }

      // Postacią zamykającą musi być ta, którą właściciel faktycznie gra w tej sesji.
      // Bez tego podsumowanie podpisywało się postacią aktualnie wybraną w HUD -
      // także taką, której w ogóle nie ma wśród uczestników tej sesji.
      const ownerCharactersInSessionQuery = `
        SELECT c.id, c.name
        FROM general_session_participants gsp
        JOIN characters c ON gsp.character_id = c.id
        WHERE gsp.session_id = ? AND c.user_id = ?
      `;

      pool.query(ownerCharactersInSessionQuery, [sessionId, userId], (err, ownerCharacters) => {
        if (err) return res.status(500).json({ error: err.message });

        const closingCharacter = ownerCharacters.find(c => c.id === parseInt(characterId, 10));

        if (ownerCharacters.length > 0 && !closingCharacter) {
          const names = ownerCharacters.map(c => c.name).join(', ');
          return res.status(403).json({
            error: `Sesję możesz zamknąć tylko postacią, którą w niej grasz (${names}). Przełącz aktywną postać.`
          });
        }

        // Właściciel bez własnej postaci wśród uczestników zamyka sesję jako czysty
        // narrator - podsumowanie nie jest wtedy podpisywane żadną postacią.
        const summaryCharacterId = closingCharacter ? closingCharacter.id : null;
        const summaryCharacterName = closingCharacter ? closingCharacter.name : 'Narrator';

        // Pobierz wszystkich uczestników sesji
        const getParticipantsQuery = `
          SELECT character_id FROM general_session_participants WHERE session_id = ?
        `;

        pool.query(getParticipantsQuery, [sessionId], (err, participants) => {
          if (err) return res.status(500).json({ error: err.message });

          // Buduj mapę per-player zalet/wad (jeśli przekazano)
          const consequencesMap = {};
          if (Array.isArray(participantConsequences)) {
            participantConsequences.forEach(pc => {
              consequencesMap[pc.character_id] = {
                positive: pc.positive_consequences || null,
                negative: pc.negative_consequences || null,
                positiveLevel: parseLevel(pc.positive_level),
                negativeLevel: parseLevel(pc.negative_level)
              };
            });
          }

          // Escapuj tekst przed wstrzyknięciem do HTML (pola to zwykły tekst z formularza,
          // nie HTML z edytora WYSIWYG - bez tego był to stored XSS wyświetlany
          // wszystkim uczestnikom przez dangerouslySetInnerHTML)
          const escapeHtml = (str) => String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

          // Stwórz specjalny post podsumowania
          const summaryMessage = `
<div style="border-left: 4px solid #ffa726; padding-left: 12px; margin: 8px 0;">
  <h3 style="color: #ffa726; margin: 0 0 8px 0;">📋 Podsumowanie Sesji</h3>
  <p><strong>Co się wydarzyło:</strong></p>
  <p>${escapeHtml(description)}</p>
  ${world_consequences ? `<p><strong>Konsekwencje dla świata:</strong></p><p>${escapeHtml(world_consequences)}</p>` : ''}
  ${character_consequences ? `<p><strong>Konsekwencje dla postaci:</strong></p><p>${escapeHtml(character_consequences)}</p>` : ''}
  ${advantages_disadvantages ? `<p><strong>Zgłoszone wady/zalety:</strong></p><p>${escapeHtml(advantages_disadvantages)}</p>` : ''}
</div>
          `.trim();

          const insertSummaryQuery = `
            INSERT INTO general_session_messages
            (session_id, user_id, message, message_type, character_type, character_id, character_name)
            VALUES (?, ?, ?, 'session_summary', 'narrator', ?, ?)
          `;

          pool.query(insertSummaryQuery, [sessionId, userId, summaryMessage, summaryCharacterId, summaryCharacterName], (err, summaryResult) => {
            if (err) return res.status(500).json({ error: err.message });

            // Stwórz raporty dla wszystkich uczestników
            if (participants.length > 0) {
              const reportValues = participants.map(p => {
                const pc = consequencesMap[p.character_id] || {};
                return [
                  p.character_id,
                  sessionId,
                  'general',
                  description,
                  world_consequences || null,
                  character_consequences || null,
                  advantages_disadvantages || null,
                  pc.positive || null,
                  pc.negative || null,
                  pc.positiveLevel || null,
                  pc.negativeLevel || null
                ];
              });

              const insertReportsQuery = `
                INSERT INTO session_reports
                (character_id, session_id, session_type, description, world_consequences,
                 character_consequences, advantages_disadvantages, positive_consequences, negative_consequences,
                 positive_level, negative_level)
                VALUES ?
              `;

              pool.query(insertReportsQuery, [reportValues], (err) => {
                if (err) {
                  console.error('❌ Błąd tworzenia raportów:', err);
                  // Kontynuuj mimo błędu raportów
                }

                // Zamknij sesję
                const closeQuery = `UPDATE general_sessions SET closed = 1 WHERE id = ?`;

                pool.query(closeQuery, [sessionId], (err, result) => {
                  if (err) return res.status(500).json({ error: err.message });
                  if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Sesja nie istnieje' });
                  }
                  res.json({ success: true });
                });
              });
            } else {
              // Brak uczestników - po prostu zamknij sesję
              const closeQuery = `UPDATE general_sessions SET closed = 1 WHERE id = ?`;

              pool.query(closeQuery, [sessionId], (err, result) => {
                if (err) return res.status(500).json({ error: err.message });
                if (result.affectedRows === 0) {
                  return res.status(404).json({ error: 'Sesja nie istnieje' });
                }
                res.json({ success: true });
              });
            }
          });
        });
      });
    });
  });
});

// POST /generalSessions/:sessionId/addMembers - Dodaj uczestników
router.post('/generalSessions/:sessionId/addMembers', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const { characterIds } = req.body;
  const requestingUserId = req.user.id;

  if (!Array.isArray(characterIds) || characterIds.length === 0) {
    return res.status(400).json({ message: 'Lista ID postaci jest wymagana' });
  }

  const checkOwnerQuery = 'SELECT created_by, closed FROM general_sessions WHERE id = ?';
  pool.query(checkOwnerQuery, [sessionId], (err, sessionResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania właściciela sesji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (sessionResults.length === 0) {
      return res.status(404).json({ message: 'Sesja nie istnieje' });
    }

    const session = sessionResults[0];
    
    if (session.created_by !== requestingUserId) {
      return res.status(403).json({ message: 'Tylko właściciel sesji może dodawać nowych członków' });
    }

    if (session.closed) {
      return res.status(403).json({ message: 'Nie można dodawać członków do zamkniętej sesji' });
    }

    const characterIdsPlaceholders = characterIds.map(() => '?').join(',');
    const checkCharactersQuery = `
      SELECT c.id, c.name, u.user as username
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE c.id IN (${characterIdsPlaceholders})
    `;
    
    pool.query(checkCharactersQuery, characterIds, (err, characterResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const existingCharacterIds = characterResults.map(char => char.id);
      const nonExistentCharacterIds = characterIds.filter(id => !existingCharacterIds.includes(parseInt(id)));
      
      if (nonExistentCharacterIds.length > 0) {
        return res.status(400).json({ 
          message: `Nie znaleziono postaci o ID: ${nonExistentCharacterIds.join(', ')}` 
        });
      }

      const checkParticipantsQuery = `
        SELECT character_id FROM general_session_participants 
        WHERE session_id = ? AND character_id IN (${characterIdsPlaceholders})
      `;
      
      pool.query(checkParticipantsQuery, [sessionId, ...characterIds], (err, participantResults) => {
        if (err) {
          console.error('❌ Błąd sprawdzania uczestników:', err);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        const alreadyParticipantIds = participantResults.map(p => p.character_id);
        const newCharacterIds = characterIds.filter(id => !alreadyParticipantIds.includes(parseInt(id)));

        if (newCharacterIds.length === 0) {
          return res.status(400).json({ 
            message: 'Wszystkie podane postaci już są uczestnikami tej sesji' 
          });
        }

        // INSERT IGNORE - session_id+character_id ma unikalny klucz; przy równoległym
        // addMembers z nakładającą się listą postaci nie chcemy wywalać całej partii błędem 500
        const values = newCharacterIds.map(characterId => [sessionId, characterId]);
        const addParticipantsQuery = 'INSERT IGNORE INTO general_session_participants (session_id, character_id) VALUES ?';

        pool.query(addParticipantsQuery, [values], (err) => {
          if (err) {
            console.error('❌ Błąd dodawania uczestników:', err);
            return res.status(500).json({ message: 'Błąd podczas dodawania uczestników' });
          }

          const seenValues = newCharacterIds.map(charId => [sessionId, charId, null]);
          const insertSeenQuery = `
            INSERT IGNORE INTO general_session_seen (session_id, character_id, seen_at) VALUES ?
          `;

          pool.query(insertSeenQuery, [seenValues], (err) => {
            if (err) console.error('❌ Błąd tworzenia rekordów seen:', err);
          });

          const getAddedCharactersQuery = `
            SELECT c.id, c.name, c.avatar, u.user as username 
            FROM characters c
            JOIN users u ON c.user_id = u.id 
            WHERE c.id IN (${newCharacterIds.map(() => '?').join(',')})
          `;
          
          pool.query(getAddedCharactersQuery, newCharacterIds, (err, addedCharacters) => {
            if (err) {
              console.error('❌ Błąd pobierania danych dodanych postaci:', err);
              return res.status(201).json({ 
                message: `Dodano ${newCharacterIds.length} nowych postaci do sesji`,
                addedCount: newCharacterIds.length,
                addedCharacterIds: newCharacterIds,
                skippedCount: alreadyParticipantIds.length
              });
            }

            res.status(201).json({
              message: `Dodano ${newCharacterIds.length} nowych postaci do sesji`,
              addedCount: newCharacterIds.length,
              addedCharacters: addedCharacters,
              skippedCount: alreadyParticipantIds.length,
              ...(alreadyParticipantIds.length > 0 && {
                skippedMessage: `${alreadyParticipantIds.length} postaci już było uczestnikami`
              })
            });
          });
        });
      });
    });
  });
});

// DELETE /generalSessions/:sessionId/members/:characterId - Usuń uczestnika
router.delete('/generalSessions/:sessionId/members/:characterId', verifyToken, (req, res) => {
  const { sessionId, characterId } = req.params;
  const requestingUserId = req.user.id;

  const checkOwnerQuery = 'SELECT created_by, closed FROM general_sessions WHERE id = ?';
  pool.query(checkOwnerQuery, [sessionId], (err, sessionResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania właściciela sesji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (sessionResults.length === 0) {
      return res.status(404).json({ message: 'Sesja nie istnieje' });
    }

    const session = sessionResults[0];
    
    if (session.created_by !== requestingUserId) {
      return res.status(403).json({ message: 'Tylko właściciel sesji może usuwać członków' });
    }

    const checkCharacterQuery = `
      SELECT c.id, c.name, c.user_id, u.user as username
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    
    pool.query(checkCharacterQuery, [characterId], (err, characterResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      if (characterResults.length === 0) {
        return res.status(404).json({ message: 'Postać nie istnieje' });
      }

      const removeParticipantQuery = 'DELETE FROM general_session_participants WHERE session_id = ? AND character_id = ?';
      pool.query(removeParticipantQuery, [sessionId, characterId], (err, result) => {
        if (err) {
          console.error('❌ Błąd usuwania uczestnika:', err);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Postać nie jest uczestnikiem tej sesji' });
        }

        const removeSeenQuery = 'DELETE FROM general_session_seen WHERE session_id = ? AND character_id = ?';
        pool.query(removeSeenQuery, [sessionId, characterId], (err) => {
          if (err) console.error('❌ Błąd usuwania rekordu seen:', err);
        });

        // Wpis Codziennika (notatka, rola, znacznik narracji) nie ma po co
        // zostawać po usuniętym uczestniku. Tabela bez FK na sesje ogólne
        // (MyISAM), więc sprzątamy ręcznie - tak samo jak seen. Brak tabeli
        // (przed migracją add-session-journal.sql) to nie błąd.
        const removeJournalQuery = `DELETE FROM character_session_journal
          WHERE session_type = 'general' AND session_id = ? AND character_id = ?`;
        pool.query(removeJournalQuery, [sessionId, characterId], (err) => {
          if (err && err.code !== 'ER_NO_SUCH_TABLE') {
            console.error('❌ Błąd usuwania wpisu codziennika:', err);
          }
        });

        res.json({ message: 'Postać została usunięta z sesji' });
      });
    });
  });
});

// GET /generalSessions/:sessionId/participantsCharacters - Postaci uczestników
router.get('/generalSessions/:sessionId/participantsCharacters', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const requestingUserId = req.user.id;

  const checkAccessQuery = `
    SELECT gs.* FROM general_sessions gs
    WHERE gs.id = ? AND (
      gs.created_by = ? 
      OR EXISTS (
        SELECT 1 FROM general_session_participants gsp
        JOIN characters c ON gsp.character_id = c.id
        WHERE gsp.session_id = ? AND c.user_id = ?
      )
    )
  `;
  
  pool.query(checkAccessQuery, [sessionId, requestingUserId, sessionId, requestingUserId], (err, accessRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (accessRows.length === 0) return res.status(403).json({ error: 'Access denied' });

    const query = `
      SELECT
        c.id as character_id,
        c.name as character_name,
        c.avatar as character_avatar,
        c.race,
        c.gender,
        c.user_id,
        u.user as username
      FROM general_session_participants gsp
      JOIN characters c ON gsp.character_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE gsp.session_id = ?
      ORDER BY u.user, c.name
    `;
    
    pool.query(query, [sessionId], (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania postaci uczestników:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const participantsCharacters = {};
      results.forEach(row => {
        if (!participantsCharacters[row.user_id]) {
          participantsCharacters[row.user_id] = {
            username: row.username,
            characters: []
          };
        }
        
        participantsCharacters[row.user_id].characters.push({
          id: row.character_id,
          name: row.character_name,
          avatar: row.character_avatar,
          race: row.race,
          gender: row.gender
        });
      });

      res.json(participantsCharacters);
    });
  });
});

// GET /generalSessions/:sessionId/participants - Pobierz uczestników sesji (uproszczona wersja)
router.get('/generalSessions/:sessionId/participants', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const characterId = req.query.characterId;
  const requestingUserId = req.user.id;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  // Sprawdź czy postać należy do użytkownika
  const checkCharacterQuery = `SELECT id FROM characters WHERE id = ? AND user_id = ?`;
  
  pool.query(checkCharacterQuery, [characterId, requestingUserId], (err, charResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    // Sprawdź dostęp do sesji
    const checkAccessQuery = `
      SELECT gs.* FROM general_sessions gs
      WHERE gs.id = ? AND (
        gs.created_by = ? 
        OR EXISTS (
          SELECT 1 FROM general_session_participants gsp
          WHERE gsp.session_id = ? AND gsp.character_id = ?
        )
      )
    `;
    
    pool.query(checkAccessQuery, [sessionId, requestingUserId, sessionId, characterId], (err, accessRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (accessRows.length === 0) return res.status(403).json({ error: 'Access denied' });

      // Pobierz uczestników
      const query = `
        SELECT
          c.id as character_id,
          c.name as character_name,
          c.avatar as character_avatar,
          c.race,
          c.gender,
          c.user_id,
          u.user as username
        FROM general_session_participants gsp
        JOIN characters c ON gsp.character_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE gsp.session_id = ?
        ORDER BY u.user, c.name
      `;
      
      pool.query(query, [sessionId], (err, results) => {
        if (err) {
          console.error('❌ Błąd pobierania uczestników:', err);
          return res.status(500).json({ error: 'Błąd serwera' });
        }

        res.json({ participants: results });
      });
    });
  });
});

// PATCH /generalSessions/:id/info - Edytuj informacje o sesji
router.patch('/generalSessions/:id/info', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const { startDate, location, additionalInfo, notes } = req.body;

  // Sprawdź czy użytkownik jest właścicielem sesji
  const checkOwnerQuery = `SELECT * FROM general_sessions WHERE id = ?`;

  pool.query(checkOwnerQuery, [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ error: 'Sesja nie istnieje' });
    }
    if (results[0].created_by !== userId) {
      return res.status(403).json({ error: 'Tylko właściciel może edytować informacje o sesji' });
    }

    // Partial update - pola nieprzesłane w body zachowują dotychczasową wartość
    // (np. dialog "Notatki właściciela" wysyła tylko `notes`, nie może więc
    // czyścić start_date/location/additional_info)
    const current = results[0];
    const newStartDate = startDate !== undefined ? (startDate || null) : current.start_date;
    const newLocation = location !== undefined ? (location || null) : current.location;
    const newAdditionalInfo = additionalInfo !== undefined ? (additionalInfo || null) : current.additional_info;
    const newNotes = notes !== undefined ? (notes || null) : current.notes;

    const updateQuery = `
      UPDATE general_sessions
      SET start_date = ?, location = ?, additional_info = ?, notes = ?
      WHERE id = ?
    `;

    pool.query(
      updateQuery,
      [newStartDate, newLocation, newAdditionalInfo, newNotes, sessionId],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Błąd podczas aktualizacji sesji' });
        }

        res.json({
          success: true,
          start_date: newStartDate,
          location: newLocation,
          additional_info: newAdditionalInfo,
          notes: newNotes
        });
      }
    );
  });
});

module.exports = router;