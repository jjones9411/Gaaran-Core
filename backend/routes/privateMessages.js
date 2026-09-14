const express = require('express');
const router = express.Router();

// Import middleware i database z odpowiednich lokalizacji
// Te ścieżki będą relatywne do /backend/routes/
const { verifyToken } = require('../middleware/auth');
const pool = require('../config/database');
const { chatMessageLimiter } = require('../middleware/rateLimiter');

// ============================================
// FUNKCJE POMOCNICZE
// ============================================

/**
 * Sprawdza, czy dana postać należy do zalogowanego użytkownika.
 * Zapobiega IDOR - bez tego dowolny zalogowany user mógłby czytać/wysyłać/kasować
 * wiadomości "jako" cudza postać, podając tylko jej ID.
 */
function characterBelongsToUser(characterId, userId, callback) {
  pool.query(
    'SELECT id FROM characters WHERE id = ? AND user_id = ?',
    [characterId, userId],
    (err, rows) => {
      if (err) return callback(err, false);
      callback(null, rows.length > 0);
    }
  );
}

/**
 * Tworzy nową konwersację między dwiema postaciami
 */
function createNewConversation(sender_character_id, receiver_character_id, content, res) {
  const queryCreate = `
    INSERT INTO conversations (character1_id, character2_id, created_at, deleted_by_character1, deleted_by_character2)
    VALUES (?, ?, NOW(), 0, 0)
  `;

  pool.query(queryCreate, [sender_character_id, receiver_character_id], (errCreate, resultCreate) => {
    if (errCreate) {
      console.error('❌ Błąd tworzenia konwersacji:', errCreate);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    const conversation_id = resultCreate.insertId;

    addMessageToConversation(conversation_id, sender_character_id, receiver_character_id, content, res, true);
  });
}

/**
 * Dodaje wiadomość do istniejącej konwersacji
 */
function addMessageToConversation(conversation_id, sender_character_id, receiver_character_id, content, res, isNew = false) {
  const queryMsg = `
    INSERT INTO messages (sender_character_id, receiver_character_id, subject, content, created_at, conversation_id)
    VALUES (?, ?, '', ?, NOW(), ?)
  `;

  pool.query(queryMsg, [sender_character_id, receiver_character_id, content, conversation_id], (errMsg) => {
    if (errMsg) {
      console.error('❌ Błąd wstawiania wiadomości:', errMsg);
      return res.status(500).json({ message: 'Błąd serwera' });
    }


    // Zarządzaj statusem seen
    if (isNew) {
      // Dla nowej konwersacji: nadawca widział, odbiorca nie
const seenValues = [
  [conversation_id, sender_character_id, new Date().toISOString().slice(0, 19).replace('T', ' ')],
  [conversation_id, receiver_character_id, null]
];
      
      const insertSeenQuery = `INSERT INTO conversation_seen (conversation_id, character_id, seen_at) VALUES ?`;
      
      pool.query(insertSeenQuery, [seenValues], (errSeen) => {
        if (errSeen) {
          console.error('❌ Błąd tworzenia rekordów seen:', errSeen);
        }
      });
    } else {
      // Dla istniejącej: nadawca widział (NOW), odbiorca nie widział (NULL)
      const updateSenderSeenQuery = `
        INSERT INTO conversation_seen (conversation_id, character_id, seen_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE seen_at = NOW()
      `;
      const updateReceiverSeenQuery = `
        INSERT INTO conversation_seen (conversation_id, character_id, seen_at)
        VALUES (?, ?, NULL)
        ON DUPLICATE KEY UPDATE seen_at = NULL
      `;
      
      pool.query(updateSenderSeenQuery, [conversation_id, sender_character_id]);
      pool.query(updateReceiverSeenQuery, [conversation_id, receiver_character_id]);
    }
    
    return res.status(201).json({
      message: isNew ? 'Konwersacja utworzona' : 'Konwersacja przywrócona',
      conversationId: conversation_id,
      existing: !isNew
    });
  });
}

// ============================================
// ENDPOINTY
// ============================================

/**
 * POST /conversations
 * Tworzy nową konwersację wraz z pierwszą wiadomością
 * Jeśli konwersacja istnieje - przywraca ją lub informuje o jej istnieniu
 */
router.post('/conversations', verifyToken, chatMessageLimiter, (req, res) => {
  const { receiver_character_id, content } = req.body;
  const sender_character_id = req.body.sender_character_id;

  if (!sender_character_id || !receiver_character_id || !content) {
    return res.status(400).json({ message: 'ID nadawcy, odbiorcy i treść wiadomości są wymagane' });
  }

  characterBelongsToUser(sender_character_id, req.user.id, (errOwn, isOwner) => {
    if (errOwn) {
      console.error('❌ Błąd weryfikacji właściciela postaci:', errOwn);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!isOwner) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

  // Sprawdź czy odbiorca istnieje - inaczej wiadomość "wysyła się" (201), ale znika
  // bez śladu z obu skrzynek, bo listy konwersacji łączą się przez INNER JOIN na characters
  pool.query('SELECT id FROM characters WHERE id = ?', [receiver_character_id], (errRecv, recvRows) => {
    if (errRecv) {
      console.error('❌ Błąd weryfikacji odbiorcy:', errRecv);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (recvRows.length === 0) {
      return res.status(404).json({ message: 'Postać odbiorcy nie istnieje' });
    }

  // Sprawdź czy jest już konwersacja między tymi postaciami
  const queryFind = `
    SELECT id, deleted_by_character1, deleted_by_character2, character1_id, character2_id
    FROM conversations
    WHERE ((character1_id = ? AND character2_id = ?) OR (character1_id = ? AND character2_id = ?))
    LIMIT 1
  `;
  
  pool.query(queryFind, [sender_character_id, receiver_character_id, receiver_character_id, sender_character_id], (errFind, rows) => {
    if (errFind) {
      console.error('❌ Błąd sprawdzania konwersacji:', errFind);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (rows.length > 0) {
      const existingConv = rows[0];
      const conversationId = existingConv.id;
      
      // Sprawdź czy konwersacja została usunięta przez nadawcę
      const senderDeletedFlag = existingConv.character1_id === sender_character_id ? 
        existingConv.deleted_by_character1 : existingConv.deleted_by_character2;
      
      if (senderDeletedFlag === 1) {
        // Przywróć konwersację
        const restoreQuery = existingConv.character1_id === sender_character_id ? 
          'UPDATE conversations SET deleted_by_character1 = 0 WHERE id = ?' :
          'UPDATE conversations SET deleted_by_character2 = 0 WHERE id = ?';
        
        pool.query(restoreQuery, [conversationId], (errRestore) => {
          if (errRestore) {
            console.error('❌ Błąd przywracania konwersacji:', errRestore);
            return res.status(500).json({ message: 'Błąd serwera' });
          }


          // Dodaj nową wiadomość
          addMessageToConversation(conversationId, sender_character_id, receiver_character_id, content, res, false);
        });
      } else {
        // Konwersacja już istnieje i jest aktywna - dodaj wiadomość
        addMessageToConversation(conversationId, sender_character_id, receiver_character_id, content, res, false);
      }
    } else {
      // Utwórz nową konwersację
      createNewConversation(sender_character_id, receiver_character_id, content, res);
    }
  });
  });
  });
});

/**
 * GET /conversations/character/:characterId
 * Pobiera listę konwersacji dla danej postaci z informacją o przeczytaniu
 */
router.get('/conversations/character/:characterId', verifyToken, (req, res) => {
  const characterId = Number(req.params.characterId);

  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID postaci' });
  }

  characterBelongsToUser(characterId, req.user.id, (errOwn, isOwner) => {
    if (errOwn) {
      console.error('❌ Błąd weryfikacji właściciela postaci:', errOwn);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!isOwner) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

  const query = `
    SELECT
      c.id,
      CASE
        WHEN c.character1_id = ? THEN c2.name
        ELSE c1.name
      END AS other_character_name,
      CASE
        WHEN c.character1_id = ? THEN c2.avatar
        ELSE c1.avatar
      END AS other_character_avatar,
      CASE
        WHEN c.character1_id = ? THEN c2.faction
        ELSE c1.faction
      END AS other_character_faction,
      CASE
        WHEN c.character1_id = ? THEN c2.gender
        ELSE c1.gender
      END AS other_character_gender,
      CASE
        WHEN c.character1_id = ? THEN c2.id
        ELSE c1.id
      END AS other_character_id,
      CASE
        WHEN c.character1_id = ? THEN u2.id
        ELSE u1.id
      END AS other_user_id,
      CASE
        WHEN c.character1_id = ? THEN u2.user
        ELSE u1.user
      END AS other_user_name,
      GREATEST(
        c.created_at,
        IFNULL((SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id), '1970-01-01')
      ) AS last_activity,
      cs.seen_at,
      1 AS is_participant

    FROM conversations c
    JOIN characters c1 ON c.character1_id = c1.id
    JOIN characters c2 ON c.character2_id = c2.id
    JOIN users u1 ON c1.user_id = u1.id
    JOIN users u2 ON c2.user_id = u2.id
    LEFT JOIN conversation_seen cs ON c.id = cs.conversation_id AND cs.character_id = ?
    WHERE ((c.character1_id = ? AND c.deleted_by_character1 = 0)
       OR (c.character2_id = ? AND c.deleted_by_character2 = 0))
    ORDER BY last_activity DESC
  `;

  pool.query(query, [characterId, characterId, characterId, characterId, characterId, characterId, characterId, characterId, characterId, characterId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania konwersacji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    const output = results.map(r => ({
      id: r.id,
      name: r.other_character_name,
      avatar: r.other_character_avatar,
      faction: r.other_character_faction,
      gender: r.other_character_gender,
      character_id: r.other_character_id,
      user_id: r.other_user_id,
      user_name: r.other_user_name,
      last_activity: r.last_activity,
      seen_at: r.seen_at,
      is_participant: r.is_participant
    }));

    res.status(200).json(output);
  });
  });
});

/**
 * GET /conversations/:conversationId
 * Pobiera szczegóły jednej konwersacji i oznacza ją jako przeczytaną
 */
router.get('/conversations/:conversationId', verifyToken, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const characterId = Number(req.query.characterId);

  if (!conversationId || isNaN(conversationId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID konwersacji' });
  }

  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ message: 'Brak ID postaci' });
  }

  characterBelongsToUser(characterId, req.user.id, (errOwn, isOwner) => {
    if (errOwn) {
      console.error('❌ Błąd weryfikacji właściciela postaci:', errOwn);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!isOwner) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

  const query = `
    SELECT
      c.id,
      CASE
        WHEN c.character1_id = ? THEN c.character2_id
        ELSE c.character1_id
      END AS other_character_id,
      CASE
        WHEN c.character1_id = ? THEN c2.name
        ELSE c1.name
      END AS other_character_name,
      CASE
        WHEN c.character1_id = ? THEN c2.faction
        ELSE c1.faction
      END AS other_character_faction,
      CASE
        WHEN c.character1_id = ? THEN c2.gender
        ELSE c1.gender
      END AS other_character_gender,
      CASE
        WHEN c.character1_id = ? THEN c2.avatar
        ELSE c1.avatar
      END AS other_character_avatar,
      CASE
        WHEN c.character1_id = ? THEN u2.id
        ELSE u1.id
      END AS other_user_id,
      CASE
        WHEN c.character1_id = ? THEN u2.user
        ELSE u1.user
      END AS other_user_name,
      GREATEST(
        c.created_at,
        IFNULL((SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id), c.created_at)
      ) AS last_activity
    FROM conversations c
    JOIN characters c1 ON c.character1_id = c1.id
    JOIN characters c2 ON c.character2_id = c2.id
    JOIN users u1 ON c1.user_id = u1.id
    JOIN users u2 ON c2.user_id = u2.id
    WHERE c.id = ? AND (c.character1_id = ? OR c.character2_id = ?)
  `;

  pool.query(query, [characterId, characterId, characterId, characterId, characterId, characterId, characterId, conversationId, characterId, characterId], (err, rows) => {
    if (err) {
      console.error('❌ Błąd pobierania szczegółów konwersacji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (!rows.length) {
      return res.status(403).json({ message: 'Brak dostępu do tej konwersacji' });
    }

    const conversation = rows[0];

    // Sprawdź czy postać istnieje i czy jej użytkownik istnieje przed oznaczeniem jako przeczytane
    const checkCharacterQuery = `
      SELECT c.id, c.user_id, u.id as user_exists
      FROM characters c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;

    pool.query(checkCharacterQuery, [characterId], (errChar, charRows) => {
      if (errChar || charRows.length === 0 || !charRows[0].user_exists) {
        // Jeśli postać lub użytkownik nie istnieje, po prostu zwróć konwersację bez oznaczania jako przeczytane
        console.error('❌ Cannot mark as seen - character or user missing:', { characterId, error: errChar });
        return res.status(200).json(conversation);
      }

      // Oznacz konwersację jako przeczytaną - używamy NOW() zamiast timestampu
      const markAsSeenQuery = `
        INSERT INTO conversation_seen (conversation_id, character_id, seen_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE seen_at = NOW()
      `;

      pool.query(markAsSeenQuery, [conversationId, characterId], (errSeen) => {
        if (errSeen) {
          console.error('❌ Błąd oznaczania jako przeczytane:', errSeen);
        }

        res.status(200).json(conversation);
      });
    });
  });
  });
});

/**
 * GET /conversations/:conversationId/messages
 * Pobiera wszystkie wiadomości w danej konwersacji
 */
router.get('/conversations/:conversationId/messages', verifyToken, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const characterId = Number(req.query.characterId);

  if (!conversationId || isNaN(conversationId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID konwersacji' });
  }

  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ message: 'Brak ID postaci' });
  }

  characterBelongsToUser(characterId, req.user.id, (errOwn, isOwner) => {
    if (errOwn) {
      console.error('❌ Błąd weryfikacji właściciela postaci:', errOwn);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!isOwner) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

  // Sprawdź czy postać ma dostęp do konwersacji
  const queryCheck = `
    SELECT 1
    FROM conversations
    WHERE id = ? AND (character1_id = ? OR character2_id = ?)
  `;

  pool.query(queryCheck, [conversationId, characterId, characterId], (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania konwersacji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (!results.length) {
      return res.status(403).json({ message: 'Brak dostępu do tej konwersacji' });
    }

    // Pobierz wiadomości
    const queryMsgs = `
      SELECT
        m.id,
        m.sender_character_id,
        m.receiver_character_id,
        m.content,
        m.created_at,
        c.name AS sender_name,
        c.avatar AS sender_avatar,
        c.faction AS sender_faction,
        c.gender AS sender_gender,
        u.id AS sender_user_id,
        u.user AS sender_user_name
      FROM messages m
      JOIN characters c ON m.sender_character_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `;
    
    pool.query(queryMsgs, [conversationId], (err2, msgs) => {
      if (err2) {
        console.error('❌ Błąd pobierania wiadomości:', err2);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      res.status(200).json(msgs);
    });
  });
  });
});

/**
 * POST /messages
 * Wysyła nową wiadomość w istniejącej konwersacji
 * Resetuje status "seen" dla odbiorcy
 */
router.post('/messages', verifyToken, chatMessageLimiter, (req, res) => {
  const { conversation_id, content, sender_character_id } = req.body;

  if (!conversation_id || !content || !sender_character_id) {
    return res.status(400).json({ message: 'conversation_id, content i sender_character_id są wymagane' });
  }

  characterBelongsToUser(sender_character_id, req.user.id, (errOwn, isOwner) => {
    if (errOwn) {
      console.error('❌ Błąd weryfikacji właściciela postaci:', errOwn);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!isOwner) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

  // Pobierz informacje o konwersacji
  const queryConv = `SELECT character1_id, character2_id FROM conversations WHERE id = ?`;

  pool.query(queryConv, [conversation_id], (err, convResults) => {
    if (err) {
      console.error('❌ Błąd pobierania konwersacji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (!convResults.length) {
      return res.status(404).json({ message: 'Konwersacja nie znaleziona' });
    }

    const conv = convResults[0];
    let receiver_character_id;
    
    // Określ odbiorcę
    if (conv.character1_id === sender_character_id) {
      receiver_character_id = conv.character2_id;
    } else if (conv.character2_id === sender_character_id) {
      receiver_character_id = conv.character1_id;
    } else {
      return res.status(403).json({ message: 'Brak uprawnień do tej konwersacji' });
    }

    // Wstaw wiadomość
    const queryInsert = `
      INSERT INTO messages (sender_character_id, receiver_character_id, subject, content, created_at, conversation_id)
      VALUES (?, ?, '', ?, NOW(), ?)
    `;
    
    pool.query(queryInsert, [sender_character_id, receiver_character_id, content, conversation_id], (err2, result2) => {
      if (err2) {
        console.error('❌ Błąd wysyłania wiadomości:', err2);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      const messageId = result2.insertId;

      // Resetuj status "seen" dla odbiorcy (ustaw na NULL = nieodczytane)
      const resetSeenQuery = `
        INSERT INTO conversation_seen (conversation_id, character_id, seen_at)
        VALUES (?, ?, NULL)
        ON DUPLICATE KEY UPDATE seen_at = NULL
      `;
      
      pool.query(resetSeenQuery, [conversation_id, receiver_character_id], (errReset) => {
        if (errReset) {
          console.error('❌ Błąd resetowania statusu seen:', errReset);
        }
        
        // Oznacz konwersację jako przeczytaną dla nadawcy
        const markSenderSeenQuery = `
          INSERT INTO conversation_seen (conversation_id, character_id, seen_at)
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE seen_at = NOW()
        `;
        
        pool.query(markSenderSeenQuery, [conversation_id, sender_character_id], (errSender) => {
          if (errSender) {
            console.error('❌ Błąd oznaczania nadawcy jako seen:', errSender);
          }
          
          // Pobierz nowo utworzoną wiadomość
          const queryGetMsg = `
            SELECT m.id, m.sender_character_id, m.receiver_character_id, m.content, m.created_at,
                   c.name AS sender_name, c.avatar AS sender_avatar
            FROM messages m
            JOIN characters c ON m.sender_character_id = c.id
            WHERE m.id = ?
          `;
          
          pool.query(queryGetMsg, [messageId], (err3, msgResults) => {
            if (err3) {
              console.error('❌ Błąd pobierania nowej wiadomości:', err3);
              return res.status(500).json({ message: 'Błąd serwera' });
            }
            
            res.status(201).json(msgResults[0]);
          });
        });
      });
    });
  });
  });
});

/**
 * POST /conversations/:id/seen
 * Oznacza konwersację jako przeczytaną przez daną postać
 */
router.post('/conversations/:id/seen', verifyToken, (req, res) => {
  const conversationId = req.params.id;
  const { characterId } = req.body;

  if (!characterId) {
    return res.status(400).json({ error: 'characterId is required' });
  }

  // Sprawdź czy postać istnieje i czy jej użytkownik istnieje
  const checkCharacterQuery = `
    SELECT c.id, c.user_id, u.id as user_exists
    FROM characters c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `;

  pool.query(checkCharacterQuery, [characterId], (errChar, charRows) => {
    if (errChar) {
      console.error('❌ Error checking character:', errChar);
      return res.status(500).json({ error: errChar.message });
    }

    if (charRows.length === 0) {
      console.error('❌ Character not found:', characterId);
      return res.status(404).json({ error: 'Character not found' });
    }

    if (!charRows[0].user_exists) {
      console.error('❌ Character user not found:', { characterId, userId: charRows[0].user_id });
      return res.status(400).json({ error: 'Character user does not exist. Please contact administrator.' });
    }

    if (charRows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Ta postać nie należy do Ciebie' });
    }

    // Sprawdź czy postać jest uczestnikiem konwersacji
    const checkQuery = `
      SELECT 1 FROM conversations
      WHERE id = ? AND (character1_id = ? OR character2_id = ?)
    `;

    pool.query(checkQuery, [conversationId, characterId, characterId], (err, rows) => {
      if (err) {
        console.error('❌ Error checking conversation:', err);
        return res.status(500).json({ error: err.message });
      }

      if (rows.length === 0) {
        return res.status(403).json({ error: 'Access denied - not a participant' });
      }

      // Oznacz jako przeczytaną (upsert) - używamy NOW() zamiast timestampu z frontendu
      const markAsSeenQuery = `
        INSERT INTO conversation_seen (conversation_id, character_id, seen_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE seen_at = NOW()
      `;

      pool.query(markAsSeenQuery, [conversationId, characterId], (errMark) => {
        if (errMark) {
          console.error('❌ Error marking as seen:', errMark);
          return res.status(500).json({ error: errMark.message });
        }

        res.json({ success: true });
      });
    });
  });
});

/**
 * DELETE /conversations/:conversationId/delete
 * Usuwa konwersację z perspektywy jednej postaci (soft delete)
 */
router.delete('/conversations/:conversationId/delete', verifyToken, (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const characterId = Number(req.query.characterId);

  if (!conversationId || isNaN(conversationId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID konwersacji' });
  }

  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ message: 'Brak ID postaci' });
  }

  characterBelongsToUser(characterId, req.user.id, (errOwn, isOwner) => {
    if (errOwn) {
      console.error('❌ Błąd weryfikacji właściciela postaci:', errOwn);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!isOwner) {
      return res.status(403).json({ message: 'Ta postać nie należy do Ciebie' });
    }

  // Sprawdź czy postać jest uczestnikiem konwersacji
  const queryCheck = `
    SELECT character1_id, character2_id, deleted_by_character1, deleted_by_character2
    FROM conversations
    WHERE id = ? AND (character1_id = ? OR character2_id = ?)
  `;

  pool.query(queryCheck, [conversationId, characterId, characterId], (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania konwersacji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (!results.length) {
      return res.status(403).json({ message: 'Brak dostępu do tej konwersacji' });
    }

    const conversation = results[0];
    let updateQuery;
    let updateParams;

    // Określ która kolumna ma być zaktualizowana
    if (conversation.character1_id === characterId) {
      updateQuery = `UPDATE conversations SET deleted_by_character1 = 1 WHERE id = ?`;
      updateParams = [conversationId];
    } else if (conversation.character2_id === characterId) {
      updateQuery = `UPDATE conversations SET deleted_by_character2 = 1 WHERE id = ?`;
      updateParams = [conversationId];
    } else {
      return res.status(403).json({ message: 'Brak uprawnień do tej konwersacji' });
    }

    // Wykonaj aktualizację
    pool.query(updateQuery, updateParams, (errUpdate) => {
      if (errUpdate) {
        console.error('❌ Błąd usuwania konwersacji:', errUpdate);
        return res.status(500).json({ message: 'Błąd serwera podczas usuwania' });
      }

      // Usuń także rekord z conversation_seen dla tej postaci
      const deleteSeenQuery = `DELETE FROM conversation_seen WHERE conversation_id = ? AND character_id = ?`;
      
      pool.query(deleteSeenQuery, [conversationId, characterId], (errSeen) => {
        if (errSeen) {
          console.error('❌ Błąd usuwania rekordu seen:', errSeen);
        }

        res.status(200).json({
          message: 'Konwersacja została usunięta',
          success: true
        });
      });
    });
  });
  });
});

/**
 * GET /characters/:characterId
 * Pobiera informacje o postaci po ID (pomocnicze dla Messages - dodawanie odbiorców)
 */
router.get('/characters/:characterId', verifyToken, (req, res) => {
  const characterId = Number(req.params.characterId);

  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID postaci' });
  }

  const query = `
    SELECT 
      c.id,
      c.name,
      c.avatar,
      u.user AS owner_username
    FROM characters c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `;

  pool.query(query, [characterId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (!results.length) {
      return res.status(404).json({ message: 'Nie znaleziono postaci o takim ID' });
    }

    res.status(200).json({ character: results[0] });
  });
});

module.exports = router;