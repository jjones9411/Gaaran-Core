const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const pool = require('../config/database');
const { sanitizeDiceRolls, parseDiceRolls } = require('../utils/diceRolls');
const { chatMessageLimiter } = require('../middleware/rateLimiter');

// GET /privateSessions - Lista aktywnych sesji dla postaci
router.get('/privateSessions', verifyToken, (req, res) => {
  const userId = req.user.id;
  const characterId = req.query.characterId;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  const checkCharacterQuery = `
    SELECT id, name, user_id FROM characters 
    WHERE id = ? AND user_id = ?
  `;
  
  pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania postaci:', err);
      return res.status(500).json({ error: 'Błąd serwera: ' + err.message });
    }
    
    if (charResults.length === 0) {
      pool.query('SELECT id, user_id FROM characters WHERE id = ?', [characterId], (err2, allChars) => {
        if (err2) {
          console.error('❌ Błąd sprawdzania istnienia postaci:', err2);
          return res.status(500).json({ error: 'Błąd bazy danych' });
        }
        
        if (allChars.length === 0) {
          return res.status(404).json({ error: 'Postać nie istnieje' });
        } else {
          return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
        }
      });
      return;
    }

    // UPROSZCZONE QUERY - bez cache problems
    // LEFT JOIN + owner_id fallback: sesje czysto narratorskie (właściciel bez
    // własnej postaci wśród uczestników) też muszą być widoczne na liście właściciela
    const sessionsQuery = `
      SELECT
        ps.id,
        ps.title,
        ps.created_at,
        ps.closed,
        ps.owner_id,
        GREATEST(
          ps.created_at,
          IFNULL((SELECT MAX(created_at) FROM private_session_messages WHERE session_id = ps.id), ps.created_at)
        ) AS last_activity,
        CASE WHEN psp.character_id IS NOT NULL THEN 1 ELSE 0 END AS is_participant,
        pss.seen_at
      FROM private_sessions ps
      LEFT JOIN private_session_participants psp
        ON ps.id = psp.session_id AND psp.character_id = ?
      LEFT JOIN private_session_seen pss
        ON ps.id = pss.session_id AND pss.character_id = ?
      WHERE (psp.character_id IS NOT NULL OR ps.owner_id = ?)
        AND ps.closed = 0
      ORDER BY ps.created_at DESC
    `;

    pool.query(sessionsQuery, [characterId, characterId, userId], (err, sessions) => {
      if (err) {
        console.error('❌ Błąd pobierania sesji:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      if (sessions.length === 0) {
        return res.json({ sessions: [] });
      }
      
      const sessionIds = sessions.map(s => s.id);
      
      // Pobierz ostatnie wiadomości dla każdej sesji
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
        FROM private_session_messages m
        LEFT JOIN users u ON m.user_id = u.id
        LEFT JOIN characters c ON m.character_id = c.id
        WHERE m.session_id IN (?)
        AND m.created_at = (
          SELECT MAX(created_at) 
          FROM private_session_messages 
          WHERE session_id = m.session_id
        )
      `;
      
      pool.query(lastMessagesQuery, [sessionIds], (err, messages) => {
        if (err) {
          console.error('❌ Błąd pobierania ostatnich wiadomości:', err);
          return res.json({ sessions });
        }
        
        const messagesMap = {};
        messages.forEach(msg => {
          messagesMap[msg.session_id] = msg;
        });
        
        const enrichedSessions = sessions.map(session => {
          const lastMsg = messagesMap[session.id];

          return {
            ...session,
            // last_activity już jest obliczony w query, nie nadpisujemy go
            last_author: lastMsg ? lastMsg.author_name : null,
            last_author_id: lastMsg ? lastMsg.user_id : null,
            last_character_id: lastMsg ? lastMsg.character_id : null,
            last_character_name: lastMsg ? lastMsg.character_name : null,
            last_character_type: lastMsg ? lastMsg.character_type : null,
            narrator_character_name: lastMsg ? lastMsg.narrator_character_name : null
          };
        });
        
        enrichedSessions.sort((a, b) => {
          const dateA = new Date(a.last_activity);
          const dateB = new Date(b.last_activity);
          return dateB - dateA;
        });
        
        res.json({ sessions: enrichedSessions });
      });
    });
  });
});

// GET /privateSessions/archive - Archiwum zamkniętych sesji
router.get('/privateSessions/archive', verifyToken, (req, res) => {
  const userId = req.user.id;
  const characterId = req.query.characterId;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  const checkCharacterQuery = `
    SELECT id FROM characters WHERE id = ? AND user_id = ?
  `;
  
  pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    const archiveQuery = `
      SELECT DISTINCT
        ps.id,
        ps.title,
        ps.closed,
        ps.owner_id,
        ps.created_at AS last_activity,
        pss.seen_at,
        CASE WHEN psp.character_id IS NOT NULL THEN 1 ELSE 0 END AS is_participant
      FROM private_sessions ps
      LEFT JOIN private_session_participants psp
        ON ps.id = psp.session_id AND psp.character_id = ?
      LEFT JOIN private_session_seen pss
        ON ps.id = pss.session_id AND pss.character_id = ?
      WHERE ps.closed = 1 AND (psp.character_id IS NOT NULL OR ps.owner_id = ?)
      ORDER BY ps.created_at DESC
    `;

    pool.query(archiveQuery, [characterId, characterId, userId], (err, rows) => {
      if (err) {
        console.error('❌ Błąd pobierania archiwum:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ sessions: rows });
    });
  });
});

// PATCH /privateSessions/:id/reopen - Przywróć sesję z archiwum
router.patch('/privateSessions/:id/reopen', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  
  const query = `UPDATE private_sessions SET closed = 0 WHERE id = ? AND owner_id = ?`;
  
  pool.query(query, [sessionId, userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Brak uprawnień lub sesja nie istnieje.' });
    }
    res.json({ success: true });
  });
});

// GET /privateSessions/:id - Szczegóły sesji z wiadomościami i uczestnikami
router.get('/privateSessions/:id', verifyToken, (req, res) => {
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

    pool.query('SELECT * FROM private_sessions WHERE id = ?', [sessionId], (err, sessionResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania sesji:', err);
        return res.status(500).json({ error: 'Błąd sesji: ' + err.message });
      }
      
      if (sessionResults.length === 0) {
        return res.status(404).json({ error: 'Sesja nie istnieje' });
      }

      const session = sessionResults[0];
      const isOwner = session.owner_id === userId;

      if (isOwner) {
        return returnBasicData(session);
      }

      pool.query(
        'SELECT * FROM private_session_participants WHERE session_id = ? AND character_id = ?', 
        [sessionId, characterId], 
        (err, participantResults) => {
          if (err) {
            console.error('❌ Błąd sprawdzania uczestnictwa:', err);
            return res.status(500).json({ error: 'Błąd uczestnictwa: ' + err.message });
          }
          
          if (participantResults.length === 0) {
            return res.status(403).json({ error: 'Brak dostępu do sesji' });
          }

          return returnBasicData(session);
        }
      );
    });
  });

function returnBasicData(session) {
  const messagesQuery = `
    SELECT
      m.id, m.message, m.created_at, m.edited_at, m.dice_rolls,
      u.id AS author_id, COALESCE(u.user, 'Bezimienny') AS author_name,
      m.character_type, m.character_id, m.character_name,
      CASE
        WHEN m.character_type = 'narrator' THEN c.name
        ELSE NULL
      END AS narrator_character_name,
      CASE
        WHEN m.character_type = 'narrator' THEN NULL
        ELSE c.avatar
      END AS character_avatar,
      CASE
        WHEN m.character_type = 'narrator' THEN NULL
        ELSE c.race
      END AS character_race,
      CASE
        WHEN m.character_type = 'narrator' THEN NULL
        ELSE c.gender
      END AS character_gender,
      CASE
        WHEN m.character_type = 'narrator' THEN NULL
        ELSE c.faction
      END AS character_faction
    FROM private_session_messages m
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
      FROM private_session_participants psp
      JOIN characters c ON psp.character_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN races r ON r.\`key\` = c.faction
      WHERE psp.session_id = ?
      ORDER BY u.user, c.name
    `;
    
    pool.query(participantsQuery, [sessionId], (err, participants) => {
      if (err) {
        console.error('❌ Błąd pobierania uczestników:', err);
        return res.status(500).json({ error: err.message });
      }

      // Notatka właściciela widoczna wyłącznie dla postaci, dla której została napisana
      const myNoteQuery = `
        SELECT note FROM private_session_participant_notes
        WHERE session_id = ? AND character_id = ?
      `;

      pool.query(myNoteQuery, [sessionId, characterId], (err, noteRows) => {
        if (err) {
          console.error('❌ Błąd pobierania notatki uczestnika:', err);
          return res.status(500).json({ error: err.message });
        }

        const response = {
          session: {
            id: parseInt(sessionId),
            title: session.title || 'Sesja',
            owner_id: session.owner_id,
            closed: session.closed || 0,
            created_at: session.created_at,
            last_activity: session.created_at,
            start_date: session.start_date || null,
            location: session.location || null,
            additional_info: session.additional_info || null,
            my_note: noteRows.length > 0 ? noteRows[0].note : null
          },
          participants: participants,
          messages: messages
        };

        return res.json(response);
      });
    });
  });
}
});

// POST /privateSessions/:id/seen - Oznacz jako przeczytane
// Wpis "seen" zakładamy WYŁĄCZNIE uczestnikowi sesji, ale brak uczestnictwa nie
// jest błędem - sesję otwiera też właściciel bez własnej postaci wśród
// uczestników (sesja czysto narratorska, patrz fallback po owner_id na liście
// sesji) oraz gracz, który przełączył aktywną postać na inną niż zapisana w tej
// sesji. Nieprzeczytane liczone są tylko uczestnikom (front bramkuje po
// is_participant), więc dla nich oznaczanie jest po prostu ciche no-op.
// Wcześniej leciało tu 403 + console.error, co przy każdym wejściu na taką
// sesję zakładało wpis w Bugtracku. Ten sam wzorzec co w generalSessions.
router.post('/privateSessions/:id/seen', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const { characterId } = req.body;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  // Jedyny twardy warunek: postać musi należeć do zalogowanego użytkownika.
  const checkQuery = `SELECT id FROM characters WHERE id = ? AND user_id = ?`;

  pool.query(checkQuery, [characterId, userId], (err, rows) => {
    if (err) {
      console.error('❌ Błąd sprawdzania postaci przy oznaczaniu seen:', err);
      return res.status(500).json({ error: err.message });
    }

    if (rows.length === 0) {
      // Zwykle nieaktualne activeCharacterId w localStorage - to stan klienta,
      // nie awaria backendu, więc warn (bugLogger łapie tylko console.error).
      console.warn(`⚠️  Odrzucone seen: postać ${characterId} nie należy do użytkownika ${userId} (sesja ${sessionId})`);
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    // Upsert wykona się tylko wtedy, gdy postać faktycznie jest uczestnikiem -
    // inaczej INSERT ... SELECT nie zwróci żadnego wiersza (affectedRows = 0).
    const markAsSeenQuery = `
      INSERT INTO private_session_seen (session_id, character_id, seen_at)
      SELECT ?, ?, NOW() FROM DUAL
      WHERE EXISTS (
        SELECT 1 FROM private_session_participants
        WHERE session_id = ? AND character_id = ?
      )
      ON DUPLICATE KEY UPDATE seen_at = NOW()
    `;

    pool.query(markAsSeenQuery, [sessionId, characterId, sessionId, characterId], (err, result) => {
      if (err) {
        console.error('❌ Błąd oznaczania jako seen:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, marked: result.affectedRows > 0 });
    });
  });
});

// GET /privateSessions/:sessionId/participantsCharacters - Postaci uczestników
router.get('/privateSessions/:sessionId/participantsCharacters', verifyToken, (req, res) => {
  const { sessionId } = req.params;
  const requestingUserId = req.user.id;

  const checkAccessQuery = `
    SELECT ps.* FROM private_sessions ps
    WHERE ps.id = ? AND (
      ps.owner_id = ? 
      OR EXISTS (
        SELECT 1 FROM private_session_participants psp
        JOIN characters c ON psp.character_id = c.id
        WHERE psp.session_id = ? AND c.user_id = ?
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
      FROM private_session_participants psp
      JOIN characters c ON psp.character_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE psp.session_id = ?
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

// POST /privateSessions - Utwórz nową sesję
router.post('/privateSessions', verifyToken, (req, res) => {
  const { title, participantCharacterIds, startDate, location, additionalInfo } = req.body;
  const ownerId = req.user.id;

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
      INSERT INTO private_sessions (title, owner_id, start_date, location, additional_info)
      VALUES (?, ?, ?, ?, ?)
    `;

    pool.query(
      insertSessionQuery,
      [title, ownerId, startDate || null, location || null, additionalInfo || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const sessionId = result.insertId;

        if (participantCharacterIds && participantCharacterIds.length > 0) {
          const participantValues = participantCharacterIds.map(charId => [sessionId, charId]);
          const insertParticipantsQuery = `
            INSERT INTO private_session_participants (session_id, character_id)
            VALUES ?
          `;
          
          pool.query(insertParticipantsQuery, [participantValues], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            const seenValues = participantCharacterIds.map(charId => [sessionId, charId, null]);
            const insertSeenQuery = `
              INSERT INTO private_session_seen (session_id, character_id, seen_at)
              VALUES ?
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

// POST /privateSessions/:id/messages - Wyślij wiadomość
router.post('/privateSessions/:id/messages', verifyToken, chatMessageLimiter, (req, res) => {
  const sessionId = req.params.id;
  const { message, characterId, isNarrator = false, diceRolls } = req.body;
  const userId = req.user.id;

  if (isNarrator) {
    const checkOwnerQuery = `SELECT * FROM private_sessions WHERE id = ? AND owner_id = ?`;
    pool.query(checkOwnerQuery, [sessionId, userId], (err, ownerRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (ownerRows.length === 0) {
        return res.status(403).json({ error: 'Tylko właściciel może pisać jako narrator' });
      }
      
      // ZMIANA: Narrator musi mieć przypisane character_id
      const getOwnerCharacterQuery = `
        SELECT c.id, c.name FROM characters c
        JOIN private_session_participants psp ON c.id = psp.character_id
        WHERE psp.session_id = ? AND c.user_id = ?
        LIMIT 1
      `;
      
      pool.query(getOwnerCharacterQuery, [sessionId, userId], (err, charRows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (charRows.length === 0) {
          return res.status(403).json({ error: 'Właściciel musi mieć postać w sesji aby pisać jako narrator' });
        }
        
        const character = charRows[0];
        insertNarratorMessage(character);
      });
    });
  } else {
    const checkQuery = `
      SELECT c.* FROM characters c
      JOIN private_session_participants psp ON c.id = psp.character_id
      WHERE psp.session_id = ? AND c.id = ? AND c.user_id = ?
    `;
    
    pool.query(checkQuery, [sessionId, characterId, userId], (err, characterRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (characterRows.length === 0) {
        return res.status(403).json({ error: 'Postać nie ma dostępu do tej sesji' });
      }
      
      const character = characterRows[0];
      insertCharacterMessage(character);
    });
  }

  function insertNarratorMessage(character) {
    const insertMessageQuery = `
      INSERT INTO private_session_messages
      (session_id, user_id, message, character_type, character_id, character_name, dice_rolls)
      VALUES (?, ?, ?, 'narrator', ?, ?, ?)
    `;

    // Rzuty kością liczy serwer - nie ufamy wynikowi przysłanemu przez klienta
    const sanitizedDiceRolls = sanitizeDiceRolls(diceRolls, userId);
    const diceRollsJson = sanitizedDiceRolls ? JSON.stringify(sanitizedDiceRolls) : null;

    pool.query(insertMessageQuery, [sessionId, userId, message, character.id, character.name, diceRollsJson], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const messageId = result.insertId;

      // Wpisy narratora też muszą oznaczyć wiadomość jako nieprzeczytaną dla pozostałych
      // uczestników - wcześniej tylko insertCharacterMessage to robił
      const resetSeenQuery = `
        UPDATE private_session_seen
        SET seen_at = NULL
        WHERE session_id = ? AND character_id != ?
      `;

      pool.query(resetSeenQuery, [sessionId, character.id], (err) => {
        if (err) console.error('❌ Błąd resetowania seen:', err);

        const markSeenQuery = `
          INSERT INTO private_session_seen (session_id, character_id, seen_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE seen_at = NOW()
        `;

        pool.query(markSeenQuery, [sessionId, character.id], (err) => {
          if (err) console.error('❌ Błąd oznaczania seen:', err);
          returnNewMessage(messageId);
        });
      });
    });
  }

  function insertCharacterMessage(character) {
    const insertMessageQuery = `
      INSERT INTO private_session_messages
      (session_id, user_id, message, character_type, character_id, character_name, dice_rolls)
      VALUES (?, ?, ?, 'main', ?, ?, ?)
    `;

    // Rzuty kością liczy serwer - nie ufamy wynikowi przysłanemu przez klienta
    const sanitizedDiceRolls = sanitizeDiceRolls(diceRolls, userId);
    const diceRollsJson = sanitizedDiceRolls ? JSON.stringify(sanitizedDiceRolls) : null;

    pool.query(insertMessageQuery, [
      sessionId,
      userId,
      message,
      character.id,
      character.name,
      diceRollsJson
    ], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const messageId = result.insertId;
      
      const resetSeenQuery = `
        UPDATE private_session_seen 
        SET seen_at = NULL 
        WHERE session_id = ? AND character_id != ?
      `;
      
      pool.query(resetSeenQuery, [sessionId, characterId], (err) => {
        if (err) console.error('❌ Błąd resetowania seen:', err);
        
        const markSeenQuery = `
          INSERT INTO private_session_seen (session_id, character_id, seen_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE seen_at = NOW()
        `;
        
        pool.query(markSeenQuery, [sessionId, characterId], (err) => {
          if (err) console.error('❌ Błąd oznaczania seen:', err);
          returnNewMessage(messageId);
        });
      });
    });
  }

  function returnNewMessage(messageId) {
    // DODANE narrator_character_name
    const selectMessageQuery = `
      SELECT
        m.id, m.message, m.created_at, m.edited_at, m.dice_rolls,
        u.ID AS author_id, COALESCE(u.user, 'Bezimienny') AS author_name,
        m.character_type, m.character_id, m.character_name,
        CASE
          WHEN m.character_type = 'narrator' THEN c.name
          ELSE NULL
        END AS narrator_character_name,
        CASE
          WHEN m.character_type = 'narrator' THEN NULL
          ELSE c.avatar
        END AS character_avatar,
        CASE
          WHEN m.character_type = 'narrator' THEN NULL
          ELSE c.race
        END AS character_race,
        CASE
          WHEN m.character_type = 'narrator' THEN NULL
          ELSE c.gender
        END AS character_gender,
        CASE
          WHEN m.character_type = 'narrator' THEN NULL
          ELSE c.faction
        END AS character_faction
      FROM private_session_messages m
      LEFT JOIN users u ON m.user_id = u.ID
      LEFT JOIN characters c ON m.character_id = c.id
      WHERE m.id = ?
    `;
    
    pool.query(selectMessageQuery, [messageId], (err, messageRows) => {
      if (err) return res.status(500).json({ error: err.message });
      const message = messageRows[0];
      // Rozpakuj JSON z rzutami (odporne na uszkodzony wpis - patrz parseDiceRolls).
      message.dice_rolls = parseDiceRolls(message.dice_rolls);
      res.json(message);
    });
  }
});

// PATCH /privateSessions/:sessionId/messages/:messageId - Edytuj wiadomość
router.patch('/privateSessions/:sessionId/messages/:messageId', verifyToken, (req, res) => {
  const { sessionId, messageId } = req.params;
  const { message } = req.body;
  const userId = req.user.id;

  const checkQuery = `
    SELECT * FROM private_session_messages WHERE id = ? AND session_id = ? AND user_id = ?
  `;
  
  pool.query(checkQuery, [messageId, sessionId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(403).json({ error: 'Brak uprawnień do edycji tej wiadomości' });

    const updateQuery = `
      UPDATE private_session_messages SET message = ?, edited_at = NOW() WHERE id = ?
    `;
    
    pool.query(updateQuery, [message, messageId], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // DODANE narrator_character_name
      const selectQuery = `
        SELECT
          m.id, m.message, m.created_at, m.edited_at, m.dice_rolls,
          u.ID AS author_id, COALESCE(u.user, 'Bezimienny') AS author_name,
          m.character_type, m.character_id, m.character_name,
          CASE
            WHEN m.character_type = 'narrator' THEN c.name
            ELSE NULL
          END AS narrator_character_name,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.avatar
          END AS character_avatar,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.race
          END AS character_race,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.gender
          END AS character_gender,
          CASE
            WHEN m.character_type = 'narrator' THEN NULL
            ELSE c.faction
          END AS character_faction
        FROM private_session_messages m
        LEFT JOIN users u ON m.user_id = u.ID
        LEFT JOIN characters c ON m.character_id = c.id
        WHERE m.id = ?
      `;

      pool.query(selectQuery, [messageId], (err, messageRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const message = messageRows[0];
        // Rozpakuj JSON z rzutami (odporne na uszkodzony wpis - patrz parseDiceRolls).
        message.dice_rolls = parseDiceRolls(message.dice_rolls);

        const originalMessage = rows[0];
        if (originalMessage.character_id) {
          const resetSeenQuery = `
            UPDATE private_session_seen
            SET seen_at = NULL
            WHERE session_id = ? AND character_id != ?
          `;

          pool.query(resetSeenQuery, [sessionId, originalMessage.character_id], (err) => {
            if (err) console.error('❌ Błąd resetowania seen po edycji:', err);
            res.json(message);
          });
        } else {
          res.json(message);
        }
      });
    });
  });
});

// PATCH /privateSessions/:id/close - Zamknij sesję
router.patch('/privateSessions/:id/close', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const characterId = req.body.characterId;
  
  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  const checkCharacterQuery = `
    SELECT id FROM characters WHERE id = ? AND user_id = ?
  `;
  
  pool.query(checkCharacterQuery, [characterId, userId], (err, charResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (charResults.length === 0) {
      return res.status(403).json({ error: 'Postać nie należy do Ciebie' });
    }

    const checkAccessQuery = `
      SELECT ps.* FROM private_sessions ps
      WHERE ps.id = ? AND (
        ps.owner_id = ? 
        OR EXISTS (
          SELECT 1 FROM private_session_participants psp
          WHERE psp.session_id = ? AND psp.character_id = ?
        )
      )
    `;
    
    pool.query(checkAccessQuery, [sessionId, userId, sessionId, characterId], (err, accessResults) => {
      if (err) return res.status(500).json({ error: err.message });
      if (accessResults.length === 0) {
        return res.status(403).json({ error: 'Brak uprawnień do zamknięcia sesji' });
      }

      const closeQuery = `UPDATE private_sessions SET closed = 1 WHERE id = ?`;
      
      pool.query(closeQuery, [sessionId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Sesja nie istnieje' });
        }
        res.json({ success: true });
      });
    });
  });
});
// POST /privateSessions/:id/addMembers - Dodaj uczestników do sesji (tylko właściciel)
router.post('/privateSessions/:id/addMembers', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const { characterIds } = req.body;

  if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
    return res.status(400).json({ error: 'Brak ID postaci do dodania' });
  }

  // Sprawdź czy użytkownik jest właścicielem sesji
  const checkOwnerQuery = `
    SELECT * FROM private_sessions WHERE id = ? AND owner_id = ?
  `;
  
  pool.query(checkOwnerQuery, [sessionId, userId], (err, sessionResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania właściciela:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (sessionResults.length === 0) {
      return res.status(403).json({ error: 'Tylko właściciel może dodawać uczestników' });
    }

    // Sprawdź czy postaci istnieją
    const placeholders = characterIds.map(() => '?').join(',');
    const checkCharactersQuery = `
      SELECT id, name FROM characters
      WHERE id IN (${placeholders})
    `;

    pool.query(checkCharactersQuery, characterIds, (err, characterResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania postaci:', err);
        return res.status(500).json({ error: err.message });
      }

      if (characterResults.length !== characterIds.length) {
        return res.status(400).json({ error: 'Niektóre postaci nie istnieją' });
      }

      // Sprawdź które postaci już są uczestnikami
      const checkExistingQuery = `
        SELECT character_id FROM private_session_participants 
        WHERE session_id = ? AND character_id IN (${placeholders})
      `;
      
      pool.query(checkExistingQuery, [sessionId, ...characterIds], (err, existingResults) => {
        if (err) {
          console.error('❌ Błąd sprawdzania istniejących uczestników:', err);
          return res.status(500).json({ error: err.message });
        }

        const existingIds = existingResults.map(row => row.character_id);
        const newCharacterIds = characterIds.filter(id => !existingIds.includes(id));

        if (newCharacterIds.length === 0) {
          return res.status(400).json({ error: 'Wszystkie postaci już są uczestnikami sesji' });
        }

        // Dodaj nowych uczestników. INSERT IGNORE - session_id+character_id ma unikalny
        // klucz; przy równoległym addMembers z nakładającą się listą postaci nie chcemy
        // wywalać całej partii błędem 500
        const participantValues = newCharacterIds.map(charId => [sessionId, charId]);
        const insertParticipantsQuery = `
          INSERT IGNORE INTO private_session_participants (session_id, character_id)
          VALUES ?
        `;

        pool.query(insertParticipantsQuery, [participantValues], (err) => {
          if (err) {
            console.error('❌ Błąd dodawania uczestników:', err);
            return res.status(500).json({ error: err.message });
          }

          // Dodaj rekordy seen dla nowych uczestników
          const seenValues = newCharacterIds.map(charId => [sessionId, charId, null]);
          const insertSeenQuery = `
            INSERT IGNORE INTO private_session_seen (session_id, character_id, seen_at)
            VALUES ?
          `;
          
          pool.query(insertSeenQuery, [seenValues], (err) => {
            if (err) console.error('❌ Błąd tworzenia rekordów seen:', err);
            
            res.json({ 
              success: true, 
              addedCount: newCharacterIds.length,
              message: `Dodano ${newCharacterIds.length} uczestników do sesji` 
            });
          });
        });
      });
    });
  });
});

// DELETE /privateSessions/:id/members/:characterId - Usuń uczestnika z sesji (tylko właściciel)
router.delete('/privateSessions/:id/members/:characterId', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const characterId = req.params.characterId;
  const userId = req.user.id;

  // Sprawdź czy użytkownik jest właścicielem sesji
  const checkOwnerQuery = `
    SELECT owner_id FROM private_sessions WHERE id = ?
  `;
  
  pool.query(checkOwnerQuery, [sessionId], (err, sessionResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania sesji:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (sessionResults.length === 0) {
      return res.status(404).json({ error: 'Sesja nie istnieje' });
    }

    const session = sessionResults[0];
    
    if (session.owner_id !== userId) {
      return res.status(403).json({ error: 'Tylko właściciel może usuwać uczestników' });
    }

    // Sprawdź czy postać do usunięcia nie jest właścicielem
    const checkCharacterOwnerQuery = `
      SELECT user_id FROM characters WHERE id = ?
    `;
    
    pool.query(checkCharacterOwnerQuery, [characterId], (err, characterResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania postaci:', err);
        return res.status(500).json({ error: err.message });
      }
      
      if (characterResults.length === 0) {
        return res.status(404).json({ error: 'Postać nie istnieje' });
      }

      if (characterResults[0].user_id === session.owner_id) {
        return res.status(403).json({ error: 'Nie można usunąć postaci właściciela sesji' });
      }

      // Usuń uczestnika
      const deleteParticipantQuery = `
        DELETE FROM private_session_participants 
        WHERE session_id = ? AND character_id = ?
      `;
      
      pool.query(deleteParticipantQuery, [sessionId, characterId], (err, result) => {
        if (err) {
          console.error('❌ Błąd usuwania uczestnika:', err);
          return res.status(500).json({ error: err.message });
        }
        
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Postać nie jest uczestnikiem tej sesji' });
        }

        // Usuń rekord seen dla usuniętego uczestnika
        const deleteSeenQuery = `
          DELETE FROM private_session_seen
          WHERE session_id = ? AND character_id = ?
        `;

        pool.query(deleteSeenQuery, [sessionId, characterId], (err) => {
          if (err) console.error('❌ Błąd usuwania rekordu seen:', err);

          // Usuń notatkę właściciela dla usuniętego uczestnika
          const deleteNoteQuery = `
            DELETE FROM private_session_participant_notes
            WHERE session_id = ? AND character_id = ?
          `;

          pool.query(deleteNoteQuery, [sessionId, characterId], (err) => {
            if (err) console.error('❌ Błąd usuwania notatki uczestnika:', err);

            // Wpis Codziennika (rola, znacznik narracji) tej postaci w tej sesji.
            // Brak tabeli (przed migracją add-session-journal.sql) to nie błąd.
            const deleteJournalQuery = `
              DELETE FROM character_session_journal
              WHERE session_type = 'private' AND session_id = ? AND character_id = ?
            `;

            pool.query(deleteJournalQuery, [sessionId, characterId], (err) => {
              if (err && err.code !== 'ER_NO_SUCH_TABLE') {
                console.error('❌ Błąd usuwania wpisu codziennika:', err);
              }

              res.json({
                success: true,
                message: 'Uczestnik został usunięty z sesji'
              });
            });
          });
        });
      });
    });
  });
});

// PATCH /privateSessions/:id/info - Edytuj informacje o sesji
router.patch('/privateSessions/:id/info', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const { startDate, location, additionalInfo } = req.body;

  // Sprawdź czy użytkownik jest właścicielem sesji
  const checkOwnerQuery = `SELECT * FROM private_sessions WHERE id = ?`;

  pool.query(checkOwnerQuery, [sessionId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ error: 'Sesja nie istnieje' });
    }
    if (results[0].owner_id !== userId) {
      return res.status(403).json({ error: 'Tylko właściciel może edytować informacje o sesji' });
    }

    // Partial update - pola nieprzesłane w body zachowują dotychczasową wartość
    const current = results[0];
    const newStartDate = startDate !== undefined ? (startDate || null) : current.start_date;
    const newLocation = location !== undefined ? (location || null) : current.location;
    const newAdditionalInfo = additionalInfo !== undefined ? (additionalInfo || null) : current.additional_info;

    const updateQuery = `
      UPDATE private_sessions
      SET start_date = ?, location = ?, additional_info = ?
      WHERE id = ?
    `;

    pool.query(
      updateQuery,
      [newStartDate, newLocation, newAdditionalInfo, sessionId],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Błąd podczas aktualizacji sesji' });
        }

        res.json({
          success: true,
          start_date: newStartDate,
          location: newLocation,
          additional_info: newAdditionalInfo
        });
      }
    );
  });
});

// PATCH /privateSessions/:id/myNote - Zapisz własną, prywatną notatkę do tej sesji
// (każdy uczestnik pisze i widzi wyłącznie notatkę przypisaną do swojej postaci)
router.patch('/privateSessions/:id/myNote', verifyToken, (req, res) => {
  const sessionId = req.params.id;
  const userId = req.user.id;
  const { characterId, note } = req.body;

  if (!characterId) {
    return res.status(400).json({ error: 'Brak ID postaci' });
  }

  // Postać musi należeć do użytkownika i być uczestnikiem tej sesji
  const checkQuery = `
    SELECT c.id
    FROM characters c
    JOIN private_session_participants psp ON c.id = psp.character_id
    WHERE c.id = ? AND c.user_id = ? AND psp.session_id = ?
  `;

  pool.query(checkQuery, [characterId, userId, sessionId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) {
      return res.status(403).json({ error: 'Postać nie jest uczestnikiem tej sesji' });
    }

    const upsertQuery = `
      INSERT INTO private_session_participant_notes (session_id, character_id, note)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE note = VALUES(note)
    `;

    pool.query(upsertQuery, [sessionId, characterId, note || null], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, note: note || null });
    });
  });
});

module.exports = router;