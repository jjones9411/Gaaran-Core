// ================================
// utils/tavernRoomAccess.js
// Wspólna weryfikacja dostępu do pokoju Karczmy na podstawie rasy
// ================================

/**
 * Sprawdza czy użytkownik ma dostęp do danego pokoju karczmy (na podstawie rasy
 * jego aktywnej postaci). Używane spójnie przez wszystkie endpointy pokoju oraz WebSocket,
 * żeby ograniczenie frakcyjne nie dało się ominąć przez bezpośrednie wywołanie innego endpointu.
 *
 * @returns {Promise<{allowed: boolean, status?: number, error?: string, room?: object}>}
 */
function checkRoomAccess(pool, userId, roomId) {
  return new Promise((resolve, reject) => {
    const roomQuery = 'SELECT id, name, description, required_faction FROM tavern_rooms WHERE id = ? AND is_active = true';

    pool.query(roomQuery, [roomId], (err, roomResults) => {
      if (err) return reject(err);

      if (roomResults.length === 0) {
        return resolve({ allowed: false, status: 404, error: 'Pokój nie został znaleziony' });
      }

      const room = roomResults[0];

      if (!room.required_faction) {
        return resolve({ allowed: true, room });
      }

      const factionQuery = 'SELECT faction FROM characters WHERE user_id = ? AND is_active = 1 LIMIT 1';
      pool.query(factionQuery, [userId], (err2, charResults) => {
        if (err2) return reject(err2);

        const userFaction = charResults[0]?.faction || null;
        const requiredFactions = room.required_faction.split(',').map(f => f.trim());

        if (!userFaction || !requiredFactions.includes(userFaction)) {
          return resolve({
            allowed: false,
            status: 403,
            error: `Ten pokój jest dostępny tylko dla rasy: ${requiredFactions.join(', ')}`
          });
        }

        resolve({ allowed: true, room });
      });
    });
  });
}

module.exports = { checkRoomAccess };
