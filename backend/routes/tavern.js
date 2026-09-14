// ================================
// routes/tavern.js
// REST API dla Karczmy
// ================================

const express = require('express');
const router = express.Router();
const { resolveChatCharacterData } = require('../utils/tavernCharacterData');
const { checkRoomAccess } = require('../utils/tavernRoomAccess');
const { sanitizeDiceRolls, parseDiceRolls } = require('../utils/diceRolls');
const { chatMessageLimiter } = require('../middleware/rateLimiter');
const { resolveCharacterId, resolveCharacterIdAsync } = require('../utils/activeCharacter');

// Middleware i pool będą przekazane z server.js
let pool;
let broadcastActiveUsersUpdate;
let wss;
let activeConnections;

/**
 * Inicjalizacja modułu z zależnościami
 */
function initialize(dependencies) {
  pool = dependencies.pool;
  broadcastActiveUsersUpdate = dependencies.broadcastActiveUsersUpdate;
  wss = dependencies.wss;
  activeConnections = dependencies.activeConnections;
}

// ================================
// POKOJE - ENDPOINTY
// ================================

/**
 * GET /tavern/rooms
 * Pobieranie dostępnych pokojów z liczbą aktywnych użytkowników
 * FILTROWANE na podstawie rasy aktywnej postaci
 */
router.get('/rooms', async (req, res) => {
  const userId = req.user.id;
  
  try {
    // Rasa GRANEJ postaci - id z tokena, patrz utils/activeCharacter.js.
    const playedCharacterId = await resolveCharacterIdAsync(req);
    const characterQuery = `
      SELECT faction
      FROM characters
      WHERE id = ?
      LIMIT 1
    `;

    const characterResult = await new Promise((resolve, reject) => {
      pool.query(characterQuery, [playedCharacterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    const userFaction = characterResult?.faction || null;
    console.log(`👤 User ${userId} faction:`, userFaction);
    
    // Pobierz wszystkie pokoje
    const roomsQuery = `
      SELECT 
        r.*,
        COUNT(tau.user_id) as active_users_count
      FROM tavern_rooms r
      LEFT JOIN tavern_active_users tau ON r.id = tau.room_id
      WHERE r.is_active = true
      GROUP BY r.id
      ORDER BY r.id ASC
    `;
    
    const allRooms = await new Promise((resolve, reject) => {
      pool.query(roomsQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    // Filtruj pokoje na podstawie rasy
    const accessibleRooms = allRooms.filter(room => {
      // Jeśli pokój nie ma wymagań rasy - dostępny dla wszystkich
      if (!room.required_faction) {
        console.log(`✅ Pokój "${room.name}" - dostępny dla wszystkich`);
        return true;
      }
      
      // Jeśli użytkownik nie ma postaci lub rasy - brak dostępu
      if (!userFaction) {
        console.log(`❌ Pokój "${room.name}" - brak rasy użytkownika`);
        return false;
      }
      
      // Sprawdź czy rasa użytkownika jest w wymaganych
      const requiredFactions = room.required_faction.split(',').map(f => f.trim());
      const hasAccess = requiredFactions.includes(userFaction);
      
      console.log(`${hasAccess ? '✅' : '❌'} Pokój "${room.name}" - wymagane: [${requiredFactions.join(', ')}], user: ${userFaction}`);
      return hasAccess;
    });
    
    console.log(`📊 Zwracam ${accessibleRooms.length}/${allRooms.length} pokoi dla użytkownika ${userId}`);
    
    res.json({ rooms: accessibleRooms });
    
  } catch (error) {
    console.error('❌ Błąd pobierania pokojów:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * GET /tavern/status
 * Sprawdza czy użytkownik jest w karczmie i w jakim pokoju
 * Zwraca także listę uczestników pokoju
 */
router.get('/status', async (req, res) => {
  const userId = req.user.id;

  try {
    const query = `
      SELECT
        tau.*,
        r.name as room_name,
        r.description as room_description
      FROM tavern_active_users tau
      LEFT JOIN tavern_rooms r ON tau.room_id = r.id
      WHERE tau.user_id = ?
    `;

    const results = await new Promise((resolve, reject) => {
      pool.query(query, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (results.length === 0) {
      return res.json({ isInTavern: false });
    }

    const userStatus = results[0];
    const roomId = userStatus.room_id;

    // Pobierz uczestników tego pokoju
    const participantsQuery = `
      SELECT
        c.id as character_id,
        c.name as character_name,
        c.avatar,
        c.race,
        c.gender,
        c.faction,
        u.id as user_id,
        u.user as username,
        tau.entered_at,
        'player' as character_type
      FROM tavern_active_users tau
      JOIN users u ON tau.user_id = u.id
      LEFT JOIN characters c
        ON (tau.character_id IS NOT NULL AND c.id = tau.character_id)
        OR (tau.character_id IS NULL AND c.user_id = u.id AND c.is_active = 1)
      WHERE tau.room_id = ?
      ORDER BY tau.entered_at DESC
    `;

    const participants = await new Promise((resolve, reject) => {
      pool.query(participantsQuery, [roomId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const mappedParticipants = participants.map(p => ({
      id: p.character_id || p.user_id,
      character_id: p.character_id,
      character_name: p.character_name || p.username,
      name: p.character_name || p.username,
      username: p.username,
      avatar: p.avatar,
      race: p.race || 'Nieznana',
      gender: p.gender || 'Nieznana',
      faction: p.faction || 'Nieznana',
      character_type: p.character_type,
      entered_at: p.entered_at
    }));

    res.json({
      isInTavern: true,
      room: {
        id: userStatus.room_id,
        name: userStatus.room_name,
        description: userStatus.room_description,
        participants: mappedParticipants
      }
    });

  } catch (error) {
    console.error('❌ Błąd sprawdzania statusu karczmy:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * POST /tavern/rooms/:roomId/enter
 * Wejście do konkretnego pokoju - z weryfikacją rasy
 */
router.post('/rooms/:roomId/enter', async (req, res) => {
  const userId = req.user.id;
  const roomId = parseInt(req.params.roomId);
  
  if (!roomId || isNaN(roomId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pokoju' });
  }
  
  try {
    // Rasa GRANEJ postaci - id z tokena, patrz utils/activeCharacter.js.
    const playedCharacterId = await resolveCharacterIdAsync(req);
    const characterQuery = `
      SELECT faction
      FROM characters
      WHERE id = ?
      LIMIT 1
    `;

    const characterResult = await new Promise((resolve, reject) => {
      pool.query(characterQuery, [playedCharacterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    const userFaction = characterResult?.faction || null;
    
    // Sprawdź czy pokój istnieje i pobierz wymagania
    const checkRoomQuery = `
      SELECT id, name, description, required_faction 
      FROM tavern_rooms 
      WHERE id = ? AND is_active = true
    `;
    
    const roomResults = await new Promise((resolve, reject) => {
      pool.query(checkRoomQuery, [roomId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (roomResults.length === 0) {
      return res.status(404).json({ error: 'Pokój nie został znaleziony' });
    }
    
    const room = roomResults[0];
    
    // Weryfikuj dostęp do pokoju
    if (room.required_faction) {
      if (!userFaction) {
        return res.status(403).json({ error: 'Brak aktywnej postaci lub rasy' });
      }
      
      const requiredFactions = room.required_faction.split(',').map(f => f.trim());
      if (!requiredFactions.includes(userFaction)) {
        return res.status(403).json({ 
          error: `Ten pokój jest dostępny tylko dla rasy: ${requiredFactions.join(', ')}` 
        });
      }
    }
    
    // Sprawdź czy użytkownik jest w karczmie
    const checkUserQuery = 'SELECT * FROM tavern_active_users WHERE user_id = ?';
    
    const userResults = await new Promise((resolve, reject) => {
      pool.query(checkUserQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
    
    if (userResults.length === 0) {
      return res.status(400).json({ error: 'Musisz najpierw wejść do karczmy' });
    }
    
    // Zaktualizuj pokój użytkownika (i graną postać - mogła się zmienić od wejścia)
    const updateRoomQuery = `
      UPDATE tavern_active_users
      SET room_id = ?, character_id = ?, last_activity = NOW()
      WHERE user_id = ?
    `;

    await new Promise((resolve, reject) => {
      pool.query(updateRoomQuery, [roomId, playedCharacterId, userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Zsynchronizuj aktywne połączenie(a) WebSocket tego użytkownika z nowym pokojem -
    // inaczej WS nadal nadawałby/odbierał wiadomości starego pokoju do czasu reconnectu
    activeConnections.forEach((clientData) => {
      if (clientData.userId === userId) {
        clientData.roomId = roomId;
      }
    });

    broadcastActiveUsersUpdate();
    
    res.json({
      message: `Wszedłeś do pokoju: ${room.name}`,
      room: {
        id: room.id,
        name: room.name,
        description: room.description
      }
    });
    
  } catch (error) {
    console.error('❌ Błąd zmiany pokoju:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * GET /tavern/rooms/:roomId/messages
 * Pobieranie wiadomości z pokoju (z paginacją)
 */
router.get('/rooms/:roomId/messages', async (req, res) => {
  const userId = req.user.id;
  const roomId = parseInt(req.params.roomId);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const offset = (page - 1) * limit;

  if (!roomId || isNaN(roomId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pokoju' });
  }

  let access;
  try {
    access = await checkRoomAccess(pool, userId, roomId);
  } catch (err) {
    console.error('❌ Błąd sprawdzania pokoju:', err);
    return res.status(500).json({ error: 'Błąd serwera' });
  }

  if (!access.allowed) {
    return res.status(access.status || 403).json({ error: access.error });
  }

  // Pobierz wiadomości (ostatnie 24h) z pełnymi danymi postaci poprzez JOIN
  const messagesQuery = `
    SELECT
      tm.id, tm.user_id, tm.username, tm.message, tm.created_at, tm.dice_rolls,
      tm.character_type, tm.character_id, tm.character_name,
      c.avatar as character_avatar,
      c.race as character_race,
      c.gender as character_gender,
      c.faction as character_faction
    FROM tavern_messages tm
    LEFT JOIN characters c ON tm.character_id = c.id AND tm.character_type != 'narrator'
    WHERE tm.room_id = ? AND tm.created_at >= NOW() - INTERVAL 24 HOUR
    ORDER BY tm.created_at DESC
    LIMIT ? OFFSET ?
  `;

  // Policz wiadomości dla paginacji
  const countQuery = `
    SELECT COUNT(*) as total
    FROM tavern_messages
    WHERE room_id = ? AND created_at >= NOW() - INTERVAL 24 HOUR
  `;

  pool.query(countQuery, [roomId], (err2, countResults) => {
    if (err2) {
      console.error('❌ Błąd liczenia wiadomości:', err2);
      return res.status(500).json({ error: 'Błąd serwera' });
    }

    const total = countResults[0].total;
    const totalPages = Math.ceil(total / limit);

    pool.query(messagesQuery, [roomId, limit, offset], (err3, messageResults) => {
      if (err3) {
        console.error('❌ Błąd pobierania wiadomości:', err3);
        return res.status(500).json({ error: 'Błąd serwera' });
      }

      // Odwróć kolejność (najstarsze na górze) i rozpakuj JSON z rzutami -
      // z bazy przychodzi longtext, front oczekuje tablicy (patrz parseDiceRolls).
      const messages = messageResults.reverse().map(msg => ({
        ...msg,
        dice_rolls: parseDiceRolls(msg.dice_rolls)
      }));

      res.json({
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    });
  });
});

/**
 * GET /tavern/rooms/:roomId/participants
 * Lista aktywnych uczestników w pokoju
 */
router.get('/rooms/:roomId/participants', async (req, res) => {
  const userId = req.user.id;
  const roomId = parseInt(req.params.roomId);

  if (!roomId || isNaN(roomId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID pokoju' });
  }

  let access;
  try {
    access = await checkRoomAccess(pool, userId, roomId);
  } catch (err) {
    console.error('❌ Błąd sprawdzania pokoju:', err);
    return res.status(500).json({ error: 'Błąd serwera' });
  }

  if (!access.allowed) {
    return res.status(access.status || 403).json({ error: access.error });
  }

  const query = `
    SELECT
      u.id, u.user, u.avatar, u.race, u.gender,
      tau.entered_at
    FROM tavern_active_users tau
    JOIN users u ON tau.user_id = u.id
    WHERE tau.room_id = ?
    ORDER BY tau.entered_at DESC
  `;

  pool.query(query, [roomId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania uczestników pokoju:', err);
      return res.status(500).json({ error: 'Błąd serwera' });
    }

    const participants = results.map(row => ({
      id: row.id,
      user: row.user,
      avatar: row.avatar,
      race: row.race,
      gender: row.gender,
      entered_at: row.entered_at
    }));

    res.json({ participants });
  });
});

/**
 * GET /tavern/rooms-with-participants
 * Pobieranie wszystkich pokoi wraz z listami uczestników
 * Używane dla widoku "przed wejściem" - pokazuje kto w którym pokoju siedzi
 */
router.get('/rooms-with-participants', async (req, res) => {
  const userId = req.user.id;

  try {
    // Rasa GRANEJ postaci - id z tokena, patrz utils/activeCharacter.js.
    const playedCharacterId = await resolveCharacterIdAsync(req);
    const characterQuery = `
      SELECT faction
      FROM characters
      WHERE id = ?
      LIMIT 1
    `;

    const characterResult = await new Promise((resolve, reject) => {
      pool.query(characterQuery, [playedCharacterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    const userFaction = characterResult?.faction || null;

    // Pobierz wszystkie aktywne pokoje
    const roomsQuery = `
      SELECT
        r.id,
        r.name,
        r.description,
        r.required_faction
      FROM tavern_rooms r
      WHERE r.is_active = true
      ORDER BY r.id ASC
    `;

    const allRooms = await new Promise((resolve, reject) => {
      pool.query(roomsQuery, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    // Filtruj pokoje na podstawie rasy (ten sam logic co w /rooms)
    const accessibleRooms = allRooms.filter(room => {
      if (!room.required_faction) {
        return true;
      }

      if (!userFaction) {
        return false;
      }

      const requiredFactions = room.required_faction.split(',').map(f => f.trim());
      return requiredFactions.includes(userFaction);
    });

    // Dla każdego dostępnego pokoju pobierz uczestników
    const roomsWithParticipants = await Promise.all(
      accessibleRooms.map(async (room) => {
        const participantsQuery = `
          SELECT
            c.id as character_id,
            c.name as character_name,
            c.avatar,
            c.race,
            c.gender,
            c.faction,
            u.id as user_id,
            u.user as username,
            tau.entered_at,
            'player' as character_type
          FROM tavern_active_users tau
          JOIN users u ON tau.user_id = u.id
          LEFT JOIN characters c
            ON (tau.character_id IS NOT NULL AND c.id = tau.character_id)
            OR (tau.character_id IS NULL AND c.user_id = u.id AND c.is_active = 1)
          WHERE tau.room_id = ?
          ORDER BY tau.entered_at DESC
        `;

        const participants = await new Promise((resolve, reject) => {
          pool.query(participantsQuery, [room.id], (err, results) => {
            if (err) reject(err);
            else resolve(results);
          });
        });

        const mappedParticipants = participants.map(p => ({
          id: p.character_id || p.user_id,
          character_id: p.character_id,
          character_name: p.character_name || p.username,
          name: p.character_name || p.username,
          username: p.username,
          avatar: p.avatar,
          race: p.race || 'Nieznana',
          gender: p.gender || 'Nieznana',
          faction: p.faction || 'Nieznana',
          character_type: p.character_type,
          entered_at: p.entered_at
        }));

        return {
          id: room.id,
          name: room.name,
          description: room.description,
          participants: mappedParticipants,
          participantCount: mappedParticipants.length
        };
      })
    );

    console.log(`📊 Zwracam ${roomsWithParticipants.length} pokoi z uczestnikami dla użytkownika ${userId}`);

    res.json({ rooms: roomsWithParticipants });

  } catch (error) {
    console.error('❌ Błąd pobierania pokoi z uczestnikami:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

// ================================
// WEJŚCIE/WYJŚCIE Z KARCZMY
// ================================

/**
 * POST /tavern/enter
 * Wejście do karczmy (domyślnie pokój 1)
 */
router.post('/enter', async (req, res) => {
  const userId = req.user.id;
  const { roomId = 1 } = req.body;
  
  try {
    // Pobierz username
    const getUserQuery = 'SELECT user as username FROM users WHERE id = ?';
    const userResult = await new Promise((resolve, reject) => {
      pool.query(getUserQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });
    
    if (!userResult) {
      return res.status(404).json({ message: 'Użytkownik nie istnieje' });
    }

    // Postać, którą gracz siada w karczmie - id z tokena, patrz utils/activeCharacter.js.
    // Zapisujemy je w wierszu, bo na wspólnym subkoncie NPC samo `user_id` nie
    // rozróżnia, który admin i którym NPC-em siedzi w pokoju.
    const playedCharacterId = await resolveCharacterIdAsync(req);

    // Dodaj do aktywnych
    const insertActiveQuery = `
      INSERT INTO tavern_active_users (user_id, username, character_id, room_id, last_activity)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
      username = VALUES(username),
      character_id = VALUES(character_id),
      room_id = VALUES(room_id),
      last_activity = NOW(),
      entered_at = CURRENT_TIMESTAMP
    `;

    await new Promise((resolve, reject) => {
      pool.query(insertActiveQuery, [userId, userResult.username, playedCharacterId, roomId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    broadcastActiveUsersUpdate();

    // Nazwa pokoju prosto z bazy - to administracja ją ustala, silnik nie zna
    // żadnej nazwy z góry.
    const roomRow = await new Promise((resolve) => {
      pool.query('SELECT name FROM tavern_rooms WHERE id = ?', [roomId], (err, rows) => {
        resolve(!err && rows && rows[0] ? rows[0] : null);
      });
    });

    res.json({
      message: 'Wszedłeś do karczmy',
      room: { id: roomId, name: roomRow ? roomRow.name : null }
    });
  } catch (error) {
    console.error('❌ Błąd w /tavern/enter:', error);
    res.status(500).json({ message: 'Błąd serwera: ' + error.message });
  }
});

/**
 * POST /tavern/leave
 * Wyjście z karczmy
 */
router.post('/leave', (req, res) => {
  const userId = req.user.id;
  
  const query = 'DELETE FROM tavern_active_users WHERE user_id = ?';
  pool.query(query, [userId], (err) => {
    if (err) {
      console.error('❌ Błąd usuwania z aktywnych użytkowników:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    broadcastActiveUsersUpdate();
    
    res.json({ message: 'Wyszedłeś z karczmy' });
  });
});

/**
 * GET /tavern/activeParticipants
 * Lista wszystkich aktywnych uczestników (wszystkie pokoje)
 */
router.get('/activeParticipants', (req, res) => {
  const query = `
    SELECT 
      c.id, 
      c.name, 
      c.race, 
      c.gender,
      c.avatar,
      'player' as character_type
    FROM tavern_active_users tau 
    JOIN users u ON tau.user_id = u.id
    JOIN characters c
      ON (tau.character_id IS NOT NULL AND c.id = tau.character_id)
      OR (tau.character_id IS NULL AND c.user_id = u.id AND c.is_active = 1)
    ORDER BY tau.entered_at DESC
  `;
  
  pool.query(query, (err, results) => {
    if (err) {
      console.error('❌ Błąd SQL w activeParticipants:', err);
      return res.status(500).json({ error: 'Błąd SQL: ' + err.message });
    }
    
    const participants = results.map(row => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      race: row.race || '-',
      gender: row.gender || '-',
      character_type: row.character_type
    }));
    
    res.json({ 
      participants,
      characters: {}
    });
  });
});

// ================================
// WIADOMOŚCI
// ================================

/**
 * POST /tavern/messages
 * Wysyłanie wiadomości do karczmy
 */

router.post('/messages', chatMessageLimiter, async (req, res) => {
  const userId = req.user.id;
  const { message, isNarrator, roomId = 1, currentCharacter, diceRolls } = req.body;

  // Wiadomość może być pusta, jeśli niesie rzut kostką - "rzucam i nic nie mówię"
  // to normalna akcja przy stole. Odrzucamy dopiero, gdy nie ma ANI tekstu,
  // ANI rzutu (wcześniej `if (!message)` blokowało sam rzut 400-tką, a front
  // kasował wtedy dopisaną już optymistycznie wiadomość - wyglądało to jak
  // zniknięcie rzutu w powietrzu).
  const hasMessageText = typeof message === 'string' && message.trim() !== '';
  const hasDiceRolls = Array.isArray(diceRolls) && diceRolls.length > 0;

  if (!hasMessageText && !hasDiceRolls) {
    return res.status(400).json({ message: 'Wiadomość musi mieć treść albo rzut kostką' });
  }

  const messageToStore = hasMessageText ? message : '';

  try {
    // Zweryfikuj dostęp do pokoju (rasa) - te same reguły co przy wejściu do pokoju
    const access = await checkRoomAccess(pool, userId, roomId);
    if (!access.allowed) {
      return res.status(access.status || 403).json({ message: access.error });
    }

    // Update last_activity
    const updateQuery = `UPDATE tavern_active_users SET last_activity = NOW() WHERE user_id = ?`;
    pool.query(updateQuery, [userId], (err) => {
      if (err) console.error('⚠️ Błąd update activity:', err);
    });

    // Pobierz nazwę użytkownika
    const userQuery = 'SELECT user FROM users WHERE id = ?';
    const userResult = await new Promise((resolve, reject) => {
      pool.query(userQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (!userResult) {
      return res.status(404).json({ message: 'Użytkownik nie istnieje' });
    }

    const username = userResult.user;

    // Ustal dane postaci - resolveChatCharacterData weryfikuje, że currentCharacter
    // faktycznie należy do tego użytkownika (nie ufamy klientowi)
    const characterData = await resolveChatCharacterData(pool, userId, username, isNarrator, currentCharacter);

    // Zapisz wiadomość do bazy
    const insertQuery = `
      INSERT INTO tavern_messages
      (user_id, username, message, character_type, character_id, character_name, room_id, dice_rolls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Rzuty kością liczy serwer - nie ufamy wynikowi przysłanemu przez klienta.
    // userId jest tu obowiązkowe: bez niego podpis rzutu z /dice/roll się nie
    // weryfikuje i serwer losuje PONOWNIE, więc gracz dostawał w wiadomości inny
    // wynik niż ten z podglądu "Zaplanowane rzuty kostką" (sesje przekazują je
    // od początku - karczma nie).
    const sanitizedDiceRolls = sanitizeDiceRolls(diceRolls, userId);
    const diceRollsJson = sanitizedDiceRolls ? JSON.stringify(sanitizedDiceRolls) : null;

    pool.query(insertQuery, [
      userId,
      username,
      messageToStore,
      characterData.character_type,
      characterData.character_id,
      characterData.character_name,
      roomId,
      diceRollsJson
    ], (err2, result) => {
      if (err2) {
        console.error('❌ Błąd zapisu wiadomości:', err2);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const savedMessage = {
        id: result.insertId,
        user_id: userId,
        username: username,
        message: messageToStore,
        character_type: characterData.character_type,
        character_id: characterData.character_id,
        character_name: characterData.character_name,
        character_avatar: characterData.character_avatar,
        character_race: characterData.character_race,
        character_gender: characterData.character_gender,
        character_faction: characterData.character_faction,
        room_id: roomId,
        created_at: new Date().toISOString(),
        dice_rolls: sanitizedDiceRolls
      };

      // Wyślij przez WebSocket do uczestników pokoju
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          const clientData = activeConnections.get(client);
          if (clientData && clientData.roomId === roomId) {
            client.send(JSON.stringify(savedMessage));
          }
        }
      });

      return res.status(201).json({
        message: 'Wiadomość dodana pomyślnie',
        data: savedMessage
      });
    });
  } catch (error) {
    console.error('❌ Błąd obsługi wiadomości:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

/**
 * PATCH /tavern/messages/:messageId
 * Edycja wiadomości w tavern
 * Dostępne dla: admin, mistrz_gry, karczmarz
 */
router.patch('/messages/:messageId', async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const messageId = parseInt(req.params.messageId);
  const { message } = req.body;

  if (!messageId || isNaN(messageId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID wiadomości' });
  }

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Treść wiadomości jest wymagana' });
  }

  try {
    // Pobierz wiadomość
    const getMessageQuery = 'SELECT * FROM tavern_messages WHERE id = ?';
    const messageResult = await new Promise((resolve, reject) => {
      pool.query(getMessageQuery, [messageId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (!messageResult) {
      return res.status(404).json({ error: 'Wiadomość nie istnieje' });
    }

    // Sprawdź uprawnienia: tylko admin/mistrz_gry/karczmarz
    const canEdit = ['admin', 'mistrz_gry', 'karczmarz'].includes(userRole);

    if (!canEdit) {
      return res.status(403).json({ error: 'Brak uprawnień do edycji wiadomości' });
    }

    // Zaktualizuj wiadomość
    const updateQuery = 'UPDATE tavern_messages SET message = ?, edited_at = NOW() WHERE id = ?';
    await new Promise((resolve, reject) => {
      pool.query(updateQuery, [message.trim(), messageId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Pobierz zaktualizowaną wiadomość. Tu też rozpakowujemy rzuty - inaczej
    // edycja wiadomości podmieniałaby na froncie gotową tablicę z powrotem na
    // string z bazy i klik w kostkę znowu wywalałby widok.
    const updatedRow = await new Promise((resolve, reject) => {
      pool.query(getMessageQuery, [messageId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    const updatedMessage = {
      ...updatedRow,
      dice_rolls: parseDiceRolls(updatedRow.dice_rolls)
    };

    // Wyślij notyfikację przez WebSocket do wszystkich w pokoju
    const roomId = messageResult.room_id;
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        const clientData = activeConnections.get(client);
        if (clientData && clientData.roomId === roomId) {
          client.send(JSON.stringify({
            type: 'message_edited',
            message: updatedMessage
          }));
        }
      }
    });

    console.log(`✏️ Wiadomość ID ${messageId} została edytowana przez userId: ${userId} (rola: ${userRole})`);
    res.json({
      success: true,
      message: 'Wiadomość została zaktualizowana',
      data: updatedMessage
    });

  } catch (error) {
    console.error('❌ Błąd edycji wiadomości:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * GET /api/tavern/participants?characterId=X
 * Pobierz uczestników pokoju dla danej postaci
 */
router.get('/participants', (req, res) => {
  const characterId = parseInt(req.query.characterId);
  
  console.log('🔍 Pobieranie uczestników dla characterId:', characterId);
  
  if (!characterId || isNaN(characterId)) {
    console.log('❌ Nieprawidłowe characterId');
    return res.status(400).json({ error: 'Nieprawidłowe ID postaci' });
  }
  
  // Najpierw znajdź user_id dla tej postaci
  // Bez warunku `is_active`: na koncie współdzielonym (subkonto NPC) aktywna
  // może być postać innego admina, a to zapytanie tylko mapuje postać na konto.
  const getUserQuery = `
    SELECT user_id
    FROM characters
    WHERE id = ?
    LIMIT 1
  `;
  
  pool.query(getUserQuery, [characterId], (err, userResults) => {
    if (err) {
      console.error('❌ Błąd pobierania user_id:', err.message);
      return res.status(500).json({ error: 'Błąd serwera: ' + err.message });
    }
    
    console.log('📝 userResults:', userResults);
    
    if (userResults.length === 0) {
      console.log('⚠️ Nie znaleziono aktywnej postaci dla characterId:', characterId);
      return res.json({ participants: [] });
    }
    
    const userId = userResults[0].user_id;
    console.log('✅ Znaleziono userId:', userId);
    
    // Teraz znajdź pokój tego użytkownika
    const getRoomQuery = `
      SELECT room_id
      FROM tavern_active_users
      WHERE user_id = ?
      LIMIT 1
    `;
    
    pool.query(getRoomQuery, [userId], (err2, roomResults) => {
      if (err2) {
        console.error('❌ Błąd pobierania room_id:', err2.message);
        return res.status(500).json({ error: 'Błąd serwera: ' + err2.message });
      }
      
      console.log('📝 roomResults:', roomResults);
      
      if (roomResults.length === 0) {
        console.log('⚠️ Użytkownik nie jest w karczmie, userId:', userId);
        return res.json({ participants: [] });
      }
      
      const roomId = roomResults[0].room_id;
      console.log(`✅ Znaleziono pokój ${roomId} dla postaci ${characterId} (userId: ${userId})`);
      
      // Pobierz wszystkich uczestników z tego pokoju
      const participantsQuery = `
        SELECT
          c.id as character_id,
          c.name as character_name,
          c.avatar,
          c.race,
          c.gender,
          c.faction,
          u.id as user_id,
          u.user as username,
          tau.entered_at,
          'player' as character_type
        FROM tavern_active_users tau
        JOIN users u ON tau.user_id = u.id
        LEFT JOIN characters c
          ON (tau.character_id IS NOT NULL AND c.id = tau.character_id)
          OR (tau.character_id IS NULL AND c.user_id = u.id AND c.is_active = 1)
        WHERE tau.room_id = ?
        ORDER BY tau.entered_at DESC
      `;
      
      pool.query(participantsQuery, [roomId], (err3, participants) => {
        if (err3) {
          console.error('❌ Błąd pobierania uczestników pokoju:', err3.message);
          return res.status(500).json({ error: 'Błąd serwera: ' + err3.message });
        }
        
        console.log(`📊 Znaleziono ${participants.length} uczestników w pokoju ${roomId}:`, participants);
        
        const mappedParticipants = participants.map(p => ({
          id: p.character_id || p.user_id,
          character_id: p.character_id,
          character_name: p.character_name || p.username,
          name: p.character_name || p.username,
          username: p.username,
          avatar: p.avatar,
          race: p.race || 'Nieznana',
          gender: p.gender || 'Nieznana',
          faction: p.faction || 'Nieznana',
          character_type: p.character_type,
          entered_at: p.entered_at
        }));
        
        console.log('✅ Zwracam uczestników:', mappedParticipants);
        
        res.json({ participants: mappedParticipants });
      });
    });
  });
});

// ================================
// GET /tavern/unread
// Sprawdza czy są nowe wiadomości w tavern dla postaci
// ================================
router.get('/unread', (req, res) => {
  const userId = req.user.id;

  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('❌ Błąd pobierania aktywnej postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.json({ hasUnread: false });
      }

// Sprawdź czy user jest w tavern
      pool.query(
        'SELECT room_id FROM tavern_active_users WHERE user_id = ?',
        [userId],
        (roomErr, roomResults) => {
          if (roomErr) {
            console.error('❌ Błąd sprawdzania tavern_active_users:', roomErr);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (roomResults.length === 0) {
            // Postać nie jest w tavern
            return res.json({ hasUnread: false });
          }

          const roomId = roomResults[0].room_id;

          // Pobierz ostatnio widziany message_id dla tej postaci w tym pokoju
          pool.query(
            'SELECT last_seen_message_id FROM tavern_seen_messages WHERE character_id = ? AND room_id = ?',
            [characterId, roomId],
            (seenErr, seenResults) => {
              if (seenErr) {
                console.error('❌ Błąd pobierania last_seen_message_id:', seenErr);
                return res.status(500).json({ message: 'Błąd serwera' });
              }

              const lastSeenMessageId = seenResults.length > 0 ? seenResults[0].last_seen_message_id : 0;

              // Sprawdź czy są nowe wiadomości (wiadomości z id większym niż last_seen_message_id)
              pool.query(
                'SELECT COUNT(*) as count FROM tavern_messages WHERE room_id = ? AND id > ?',
                [roomId, lastSeenMessageId || 0],
                (countErr, countResults) => {
                  if (countErr) {
                    console.error('❌ Błąd sprawdzania nowych wiadomości tavern:', countErr);
                    return res.status(500).json({ message: 'Błąd serwera' });
                  }

                  const hasUnread = countResults[0].count > 0;
                  res.json({ hasUnread, roomId });
                }
              );
            }
          );
        }
      );
    }
  );
});

// ================================
// POST /tavern/mark-seen
// Oznacza wiadomości tavern jako przeczytane
// ================================
router.post('/mark-seen', (req, res) => {
  const userId = req.user.id;

  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('❌ Błąd pobierania aktywnej postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(404).json({ message: 'Nie znaleziono postaci' });
      }

      // Sprawdź czy postać jest w tavern
      pool.query(
        'SELECT room_id FROM tavern_active_users WHERE user_id = ?',
        [userId],
        (roomErr, roomResults) => {
          if (roomErr) {
            console.error('❌ Błąd sprawdzania tavern_active_users:', roomErr);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (roomResults.length === 0) {
            return res.json({ success: true, message: 'Postać nie jest w tavern' });
          }

          const roomId = roomResults[0].room_id;

          // Pobierz ID najnowszej wiadomości w tym pokoju
          pool.query(
            'SELECT MAX(id) as max_id FROM tavern_messages WHERE room_id = ?',
            [roomId],
            (maxErr, maxResults) => {
              if (maxErr) {
                console.error('❌ Błąd pobierania max message_id:', maxErr);
                return res.status(500).json({ message: 'Błąd serwera' });
              }

              const maxMessageId = maxResults[0].max_id;

              if (!maxMessageId) {
                // Brak wiadomości, nic do oznaczenia
                return res.json({ success: true, message: 'Brak wiadomości do oznaczenia' });
              }

              // Wstaw lub zaktualizuj rekord w tavern_seen_messages
              pool.query(
                `INSERT INTO tavern_seen_messages (character_id, room_id, last_seen_message_id, seen_at)
                 VALUES (?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE last_seen_message_id = ?, seen_at = NOW()`,
                [characterId, roomId, maxMessageId, maxMessageId],
                (insertErr) => {
                  if (insertErr) {
                    console.error('❌ Błąd zapisywania seen message:', insertErr);
                    return res.status(500).json({ message: 'Błąd serwera' });
                  }

                  console.log(`✅ Oznaczono wiadomości tavern jako przeczytane dla postaci ${characterId} w pokoju ${roomId}, ostatnia wiadomość ID: ${maxMessageId}`);
                  res.json({ success: true });
                }
              );
            }
          );
        }
      );
    }
  );
});

// ================================
// KICK/BAN SYSTEM
// ================================

/**
 * Helper: Check if user can kick (admin, mistrz_gry, karczmarz)
 */
const canKickUsers = (role) => {
  return ['admin', 'mistrz_gry', 'karczmarz'].includes(role);
};

/**
 * POST /tavern/kick-user
 * Wyrzucanie gracza z karczmy z czasową blokadą
 * Dostępne dla: admin, mistrz_gry, karczmarz
 */
router.post('/kick-user', async (req, res) => {
  const kickerUserId = req.user.id;
  const kickerRole = req.user.role;
  const { characterId, reason, banDurationMinutes } = req.body;

  // Sprawdź uprawnienia
  if (!canKickUsers(kickerRole)) {
    return res.status(403).json({
      error: 'Brak uprawnień do wyrzucania graczy z karczmy'
    });
  }

  // Walidacja danych wejściowych
  if (!characterId || !reason || !banDurationMinutes) {
    return res.status(400).json({
      error: 'Brakuje wymaganych danych: characterId, reason, banDurationMinutes'
    });
  }

  if (banDurationMinutes < 1 || banDurationMinutes > 10080) { // max 7 dni
    return res.status(400).json({
      error: 'Czas blokady musi być między 1 minutą a 7 dniami (10080 minut)'
    });
  }

  try {
    // Pobierz dane postaci i użytkownika do wyrzucenia
    const characterQuery = `
      SELECT c.id, c.name, c.user_id, u.user as username, u.role as user_role
      FROM characters c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;

    const characterResult = await new Promise((resolve, reject) => {
      pool.query(characterQuery, [characterId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (!characterResult) {
      return res.status(404).json({ error: 'Nie znaleziono postaci' });
    }

    const targetUserId = characterResult.user_id;
    const characterName = characterResult.name;
    const targetRole = characterResult.user_role;

    // Nie można wyrzucić siebie samego
    if (targetUserId === kickerUserId) {
      return res.status(400).json({ error: 'Nie możesz wyrzucić siebie z karczmy' });
    }

    // Hierarchia uprawnień - nie można wyrzucić osoby z wyższą lub równą rolą
    // `zasluzony` jest na poziomie mieszkańca - to odznaczenie, nie awans.
    // Jawny wpis, a nie poleganie na tym, że undefined >= n daje false.
    const roleHierarchy = { 'mieszkaniec': 0, 'zasluzony': 0, 'karczmarz': 1, 'mistrz_gry': 2, 'admin': 3 };
    if (roleHierarchy[targetRole] >= roleHierarchy[kickerRole]) {
      return res.status(403).json({
        error: 'Nie możesz wyrzucić użytkownika z taką samą lub wyższą rolą'
      });
    }

    // Oblicz czas wygaśnięcia bana
    const banExpiresAt = new Date(Date.now() + banDurationMinutes * 60 * 1000);

    // Dodaj ban do bazy danych
    const insertBanQuery = `
      INSERT INTO tavern_bans (user_id, banned_by_user_id, kicked_character_id, kicked_character_name, reason, ban_expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await new Promise((resolve, reject) => {
      pool.query(insertBanQuery, [targetUserId, kickerUserId, characterId, characterName, reason, banExpiresAt], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Zapisz log wyrzucenia
    const insertLogQuery = `
      INSERT INTO tavern_kick_log (user_id, kicked_by_user_id, kicked_character_id, kicked_character_name, reason, ban_duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await new Promise((resolve, reject) => {
      pool.query(insertLogQuery, [targetUserId, kickerUserId, characterId, characterName, reason, banDurationMinutes], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Usuń użytkownika z aktywnych w karczmie
    const removeFromTavernQuery = `
      DELETE FROM tavern_active_users WHERE user_id = ?
    `;

    await new Promise((resolve, reject) => {
      pool.query(removeFromTavernQuery, [targetUserId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Broadcast aktualizacji aktywnych użytkowników
    if (broadcastActiveUsersUpdate) {
      broadcastActiveUsersUpdate();
    }

    console.log(`🚫 Użytkownik ${characterName} (userId: ${targetUserId}) został wyrzucony z karczmy przez userId: ${kickerUserId}. Blokada do: ${banExpiresAt}`);

    res.json({
      success: true,
      message: `Gracz ${characterName} został wyrzucony z karczmy`,
      banExpiresAt: banExpiresAt.toISOString()
    });

  } catch (error) {
    console.error('❌ Błąd wyrzucania gracza z karczmy:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * GET /tavern/check-ban
 * Sprawdza czy użytkownik ma aktywny ban
 */
router.get('/check-ban', async (req, res) => {
  const userId = req.user.id;

  try {
    const banQuery = `
      SELECT id, reason, ban_expires_at, kicked_character_name
      FROM tavern_bans
      WHERE user_id = ?
        AND is_active = TRUE
        AND ban_expires_at > NOW()
      ORDER BY ban_expires_at DESC
      LIMIT 1
    `;

    const banResult = await new Promise((resolve, reject) => {
      pool.query(banQuery, [userId], (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);
      });
    });

    if (banResult) {
      res.json({
        isBanned: true,
        reason: banResult.reason,
        expiresAt: banResult.ban_expires_at,
        kickedCharacter: banResult.kicked_character_name
      });
    } else {
      res.json({ isBanned: false });
    }

  } catch (error) {
    console.error('❌ Błąd sprawdzania bana:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * GET /tavern/kick-history/:userId
 * Historia wyrzuceń dla danego użytkownika (tylko admin)
 */
router.get('/kick-history/:userId', async (req, res) => {
  const requestingRole = req.user.role;
  const targetUserId = req.params.userId;

  if (requestingRole !== 'admin') {
    return res.status(403).json({ error: 'Tylko admin może przeglądać historię wyrzuceń' });
  }

  try {
    const historyQuery = `
      SELECT
        tkl.*,
        u.user as kicked_by_username
      FROM tavern_kick_log tkl
      JOIN users u ON tkl.kicked_by_user_id = u.id
      WHERE tkl.user_id = ?
      ORDER BY tkl.created_at DESC
      LIMIT 50
    `;

    const history = await new Promise((resolve, reject) => {
      pool.query(historyQuery, [targetUserId], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({ history });

  } catch (error) {
    console.error('❌ Błąd pobierania historii wyrzuceń:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

/**
 * DELETE /tavern/remove-ban/:banId
 * Usunięcie bana (tylko admin)
 */
router.delete('/remove-ban/:banId', async (req, res) => {
  const requestingRole = req.user.role;
  const banId = req.params.banId;

  if (requestingRole !== 'admin') {
    return res.status(403).json({ error: 'Tylko admin może usuwać bany' });
  }

  try {
    const updateQuery = `
      UPDATE tavern_bans
      SET is_active = FALSE
      WHERE id = ?
    `;

    await new Promise((resolve, reject) => {
      pool.query(updateQuery, [banId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    console.log(`✅ Ban ID ${banId} został usunięty przez admina`);
    res.json({ success: true, message: 'Ban został usunięty' });

  } catch (error) {
    console.error('❌ Błąd usuwania bana:', error);
    res.status(500).json({ error: 'Błąd serwera: ' + error.message });
  }
});

module.exports = { router, initialize };