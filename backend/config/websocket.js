// ================================
// config/websocket.js
// WebSocket Server dla Karczmy
// ================================

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { resolveChatCharacterData } = require('../utils/tavernCharacterData');
const { checkRoomAccess } = require('../utils/tavernRoomAccess');

// Tablica aktywnych połączeń WebSocket
const activeConnections = new Map(); // WebSocket -> { userId, username, roomId }

// ================================
// RATE LIMITING WIADOMOŚCI WS (brak middleware express-rate-limit dla WebSocketów)
// ================================
const WS_RATE_LIMIT_WINDOW_MS = 10 * 1000;
const WS_RATE_LIMIT_MAX = 15;
const wsMessageRateLimits = new Map(); // userId -> { count, windowStart }

function isRateLimited(userId) {
  const now = Date.now();
  const entry = wsMessageRateLimits.get(userId);

  if (!entry || now - entry.windowStart > WS_RATE_LIMIT_WINDOW_MS) {
    wsMessageRateLimits.set(userId, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > WS_RATE_LIMIT_MAX;
}

// Usuń stare wpisy, żeby mapa nie rosła w nieskończoność dla rozłączonych użytkowników
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of wsMessageRateLimits) {
    if (now - entry.windowStart > WS_RATE_LIMIT_WINDOW_MS) {
      wsMessageRateLimits.delete(userId);
    }
  }
}, 60 * 60 * 1000);

// ================================
// LIMITY POŁĄCZEŃ I ROZMIARU RAMEK
// ================================
// Serwer WS nie miał ŻADNEGO z tych limitów, a stoi na tym samym porcie co API:
//   * `ws` domyślnie przyjmuje ramki do 100 MB - jeden klient mógł wysłać
//     kilka takich naraz i wyczerpać pamięć procesu (JSON.parse na 100 MB
//     blokuje przy okazji pętlę zdarzeń, czyli kładzie CAŁE API, nie tylko czat);
//   * liczba połączeń na konto była nieograniczona - skrypt otwierający tysiąc
//     gniazd zjadał deskryptory i przy każdym z nich dwa zapytania do bazy
//     (SELECT users + sprawdzenie dostępu do pokoju);
//   * brak ping/pong sprawiał, że zerwane połączenia (padnięty Wi-Fi, uśpiony
//     telefon) zostawały w `activeConnections` na zawsze i dostawały każdy
//     broadcast.
const WS_MAX_PAYLOAD_BYTES = 64 * 1024;      // ramka WS - do czatu z zapasem
const WS_MAX_MESSAGE_LENGTH = 5000;          // pojedyncza wypowiedź w karczmie
const WS_MAX_CONNECTIONS_PER_USER = 5;       // gracz + kilka kart przeglądarki
const WS_HEARTBEAT_INTERVAL_MS = 30 * 1000;

function countUserConnections(userId) {
  let count = 0;
  for (const data of activeConnections.values()) {
    if (data.userId === userId) count += 1;
  }
  return count;
}

/**
 * Konfiguracja WebSocket Server
 * @param {http.Server} server - HTTP server instance
 * @param {mysql.Pool} pool - MySQL connection pool
 * @returns {Object} - { wss, activeConnections, broadcastActiveUsersUpdate }
 */
function setupWebSocket(server, pool) {
  const wss = new WebSocket.Server({ server, maxPayload: WS_MAX_PAYLOAD_BYTES });

  // Heartbeat: co 30 s pingujemy wszystkie gniazda i zamykamy te, które nie
  // odpowiedziały na poprzedni ping. Bez tego mapa połączeń rośnie o każde
  // zerwane (nie zamknięte) połączenie i broadcast leci w próżnię.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        activeConnections.delete(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, WS_HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  wss.on('close', () => clearInterval(heartbeat));


  // ================================
  // WEBSOCKET CONNECTION HANDLER
  // ================================
  wss.on('connection', (ws, req) => {
    // Znacznik dla heartbeatu - odnawiany odpowiedzią klienta na ping.
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Sprawdź token
    if (!ws.protocol) {
      ws.close();
      return;
    }

    // Pobierz roomId z URL
    const url = new URL(req.url, 'http://localhost');
    const roomId = parseInt(url.searchParams.get('room')) || 1;

    // Weryfikacja JWT
    jwt.verify(ws.protocol, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        ws.close();
        return;
      }

      const userId = decoded.id;

      // Limit gniazd na konto - zanim dotkniemy bazy. Bez tego jeden skrypt
      // otwierał dowolnie wiele połączeń, a każde kosztowało dwa zapytania.
      if (countUserConnections(userId) >= WS_MAX_CONNECTIONS_PER_USER) {
        console.warn(`⚠️ WS: przekroczony limit połączeń dla konta ${userId}`);
        ws.close();
        return;
      }

      // Pobierz nazwę użytkownika z bazy
      const query = 'SELECT user FROM users WHERE id = ?';
      pool.query(query, [userId], (err, results) => {
        if (err) {
          console.error('❌ Błąd pobierania username:', err);
          ws.close();
          return;
        }

        if (results.length === 0) {
          ws.close();
          return;
        }

        const username = results[0].user;

        // Zweryfikuj, że użytkownik ma dostęp do pokoju (rasa) zanim dopuścimy połączenie
        checkRoomAccess(pool, userId, roomId).then(({ allowed }) => {
          if (!allowed) {
            ws.close();
            return;
          }

          // Zapisz połączenie WebSocket
          activeConnections.set(ws, { userId, username, roomId });

          // ================================
          // OBSŁUGA WIADOMOŚCI
          // ================================
          ws.on('message', async (data) => {
            try {
              const { message, isNarrator, currentCharacter } = JSON.parse(data);

              if (!message || typeof message !== 'string' || !message.trim()) {
                return;
              }

              // Długość wypowiedzi nie była w ogóle sprawdzana - jedna ramka
              // mieszcząca się w limicie transportu wciąż mogła wsadzić do bazy
              // i rozesłać wszystkim w pokoju dziesiątki kilobajtów tekstu.
              if (message.length > WS_MAX_MESSAGE_LENGTH) {
                return;
              }

              const userData = activeConnections.get(ws);
              if (!userData) {
                return;
              }

              const { userId, username, roomId: userRoomId } = userData;

              if (isRateLimited(userId)) {
                return;
              }

              // Ustal dane postaci - resolveChatCharacterData weryfikuje, że
              // currentCharacter faktycznie należy do tego użytkownika (nie ufamy klientowi)
              const characterData = await resolveChatCharacterData(pool, userId, username, isNarrator, currentCharacter);

              // Zapisz wiadomość do bazy
              const insertQuery = `
                INSERT INTO tavern_messages
                (user_id, username, message, character_type, character_id, character_name, room_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `;

              pool.query(insertQuery, [
                userId,
                username,
                message,
                characterData.character_type,
                characterData.character_id,
                characterData.character_name,
                userRoomId
              ], (err, result) => {
                if (err) {
                  console.error('❌ Błąd zapisu wiadomości:', err);
                  return;
                }

                const messageData = {
                  id: result.insertId,
                  user_id: userId,
                  username: username,
                  message: message,
                  character_type: characterData.character_type,
                  character_id: characterData.character_id,
                  character_name: characterData.character_name,
                  character_avatar: characterData.character_avatar,
                  character_race: characterData.character_race,
                  character_gender: characterData.character_gender,
                  character_faction: characterData.character_faction,
                  room_id: userRoomId,
                  created_at: new Date().toISOString()
                };

                // Broadcast tylko do tego samego pokoju
                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    const clientData = activeConnections.get(client);
                    if (clientData && clientData.roomId === userRoomId) {
                      client.send(JSON.stringify(messageData));
                    }
                  }
                });
              });
            } catch (error) {
              console.error('❌ Błąd parsowania wiadomości:', error);
            }
          });

          // ================================
          // ZAMKNIĘCIE POŁĄCZENIA
          // ================================
          ws.on('close', () => {
            activeConnections.delete(ws);
          });
        }).catch(err => {
          console.error('❌ Błąd weryfikacji dostępu do pokoju karczmy:', err);
          ws.close();
        });
      });
    });
  });

  // ================================
  // CLEANUP FUNCTIONS
  // ================================

  /**
   * Usuwa nieaktywnych użytkowników (ostatnia aktywność > 60 minut)
   */
  function cleanupInactiveUsers() {
    const query = `DELETE FROM tavern_active_users WHERE last_activity < DATE_SUB(NOW(), INTERVAL 60 MINUTE)`;
    
    pool.query(query, (err, result) => {
      if (err) {
        console.error('❌ Błąd cleanup nieaktywnych użytkowników:', err);
        return;
      }
      
      if (result.affectedRows > 0) {
        broadcastActiveUsersUpdate();
      }
    });
  }

  /**
   * Usuwa wiadomości starsze niż 48 godzin
   */
  function deleteOldMessages() {
    const query = 'DELETE FROM tavern_messages WHERE created_at < NOW() - INTERVAL 48 HOUR';
    
    pool.query(query, (err, result) => {
      if (err) {
        console.error('❌ Błąd usuwania starych wiadomości:', err);
        return;
      }
      
      if (result.affectedRows > 0) {
      }
    });
  }

  /**
   * Broadcast aktualizacji listy aktywnych użytkowników
   */
  function broadcastActiveUsersUpdate() {
    const query = `
      SELECT 
        u.id, u.user as username, tau.room_id
      FROM tavern_active_users tau 
      JOIN users u ON tau.user_id = u.id 
      ORDER BY tau.entered_at DESC
    `;
    
    pool.query(query, (err, results) => {
      if (err) {
        console.error('❌ Błąd w broadcastActiveUsersUpdate:', err);
        return;
      }
      
      const users = results.map(row => ({
        id: row.id,
        username: row.username,
        room_id: row.room_id
      }));
      
      const message = JSON.stringify({
        type: 'active_users_update',
        users
      });
      
      activeConnections.forEach((userData, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });
  }

  // ================================
  // AUTO-CLEANUP INTERVALS
  // ================================
  setInterval(cleanupInactiveUsers, 60 * 60 * 1000); // Co godzinę
  setInterval(deleteOldMessages, 48 * 60 * 60 * 1000); // Co 48 godzin
  
  // Uruchom cleanup przy starcie
  deleteOldMessages();


  // Eksportuj funkcje i obiekty
  return {
    wss,
    activeConnections,
    broadcastActiveUsersUpdate
  };
}

module.exports = { setupWebSocket };