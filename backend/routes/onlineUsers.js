const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const pool = require('../config/database');
const { invalidateProfileCache } = require('./profile');

// Zapytanie listy online. Kolumny `narrative_role` (add-narrative-role.sql) i
// `epithet` (add-epithet.sql) są opcjonalne - baza bez tych migracji dostaje
// wariant awaryjny bez nich i lista online działa jak przed ich dodaniem.
const buildOnlineUsersQuery = ({ withNarrativeRole, withEpithet }) => `
    SELECT
      c.id,
      c.name,
      c.avatar,
      c.race,
      c.gender,
      c.faction,
      c.player_status,
      c.status,
      ${withNarrativeRole ? 'c.narrative_role,' : ''}
      ${withEpithet ? 'c.epithet,' : ''}
      u.last_seen,
      u.role
    FROM characters c
    INNER JOIN users u ON c.user_id = u.id
    WHERE u.last_seen >= NOW() - INTERVAL 2 MINUTE
      AND c.is_active = 1
      AND c.name IS NOT NULL
      AND c.name != 'Nowa Postać'
      AND c.race IS NOT NULL
      AND c.race != 'Brak'
      AND c.gender IS NOT NULL
      AND c.gender != 'Brak'
      AND u.force_logout_token IS NULL  -- ✅ DODANE - ukryj wylogowanych
    ORDER BY c.id ASC
`;

// Cache odpowiedzi listy online.
//
// Ta lista jest IDENTYCZNA dla wszystkich pytających - nie zależy ani od konta,
// ani od postaci - a jednocześnie jest jednym z najczęściej odpytywanych miejsc
// w grze: każdy gracz co 15 s, plus pasek boczny, plus trasa jest publiczna
// (bez tokena), więc może ją odpytywać dowolny skrypt z zewnątrz. Każde takie
// żądanie to JOIN characters × users. Kilka sekund pamięci zbija to do jednego
// zapytania na okno, niezależnie od liczby pytających.
//
// TTL jest krótszy niż okno "kto jest online" (2 minuty w zapytaniu), więc
// lista nadal zmienia się szybciej, niż gracz zdąży zauważyć.
const ONLINE_CACHE_TTL_MS = 5000;
let onlineCache = null; // { payload, timestamp }

// GET /online-users - Lista aktywnych postaci online (bez tokenu)
router.get('/online-users', (req, res) => {
  if (onlineCache && Date.now() - onlineCache.timestamp < ONLINE_CACHE_TTL_MS) {
    return res.status(200).json(onlineCache.payload);
  }

  const runQuery = (flags) => {
    pool.query(buildOnlineUsersQuery(flags), (err, results) => {
      if (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          // Brak migracji - odpadamy kolejnymi kolumnami, od najświeższej.
          if (flags.withEpithet) {
            return runQuery({ ...flags, withEpithet: false });
          }
          if (flags.withNarrativeRole) {
            return runQuery({ ...flags, withNarrativeRole: false });
          }
        }
        console.error('❌ Błąd pobierania online graczy:', err);
        return res.status(500).json({
          success: false,
          message: 'Błąd serwera',
          error: err.message,
        });
      }

      const usersWithStatus = results.map(character => ({
        id: character.id,
        user: character.name,
        race: character.race,
        gender: character.gender,
        faction: character.faction,
        avatar: character.avatar,
        status: character.player_status || 'not_looking',
        characterStatus: character.status || '',
        // Rola fabularna nadana przez administrację - dymek listy online
        // pokazuje ją razem ze statusem postaci.
        narrativeRole: character.narrative_role || '',
        // Przydomek nadany przez administrację (admin/MG) - dymek listy online
        // pokazuje go w tym samym bloku co rolę fabularną i status.
        epithet: character.epithet || '',
        lastSeen: character.last_seen,
        // Ranga konta - lista online rysuje z niej odznakę przy awatarze
        // (korona/księga/kufel/medal). Zwykły mieszkaniec nie dostaje odznaki.
        role: character.role || 'mieszkaniec'
      }));

      const payload = {
        success: true,
        data: usersWithStatus,
      };
      // Do cache trafia tylko odpowiedź UDANA - błędu nie ma sensu utrwalać.
      onlineCache = { payload, timestamp: Date.now() };

      return res.status(200).json(payload);
    });
  };

  runQuery({ withNarrativeRole: true, withEpithet: true });
});

// PUT /character/:characterId/player-status - Zmiana statusu gracza
router.put('/character/:characterId/player-status', verifyToken, (req, res) => {
  const loggedInUserId = req.user.id;
  const characterId = req.params.characterId;
  const { status } = req.body;

const validStatuses = ['looking', 'maybe', 'not_looking', 'now_not_looking'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Nieprawidłowy status' });
  }

  pool.query(
    'SELECT user_id FROM characters WHERE id = ?',
    [characterId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ message: 'Postać nie znaleziona' });
      }
      
      if (results[0].user_id !== loggedInUserId) {
        return res.status(403).json({ message: 'Brak uprawnień' });
      }

      pool.query(
        'UPDATE characters SET player_status = ? WHERE id = ?',
        [status, characterId],
        (err, updateResults) => {
          if (err) {
            console.error('❌ Błąd:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          return res.status(200).json({ message: 'Status zaktualizowany' });
        }
      );
    }
  );
});

// ================================
// NOWE ENDPOINTY - ULUBIENI
// ================================

// GET /favorites - Pobierz ulubione postacie
router.get('/favorites', verifyToken, (req, res) => {
  const userId = req.user.id;
  
  pool.query(
    'SELECT favorite_character_id FROM character_favorites WHERE user_id = ?',
    [userId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania ulubionych:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }
      
      const favorites = results.map(row => row.favorite_character_id);
      return res.status(200).json({ success: true, data: favorites });
    }
  );
});

// POST /favorites/:characterId - Dodaj do ulubionych
router.post('/favorites/:characterId', verifyToken, (req, res) => {
  const userId = req.user.id;
  const characterId = parseInt(req.params.characterId);
  
  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ success: false, message: 'Nieprawidłowe ID postaci' });
  }
  
  // Sprawdź czy postać istnieje
  pool.query(
    'SELECT id, name FROM characters WHERE id = ?',
    [characterId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ success: false, message: 'Postać nie znaleziona' });
      }
      
      const characterName = results[0].name;
      
      // Dodaj do ulubionych
      pool.query(
        'INSERT IGNORE INTO character_favorites (user_id, favorite_character_id) VALUES (?, ?)',
        [userId, characterId],
        (err) => {
          if (err) {
            console.error('❌ Błąd dodawania do ulubionych:', err);
            return res.status(500).json({ success: false, message: 'Błąd serwera' });
          }
          
          return res.status(200).json({ 
            success: true, 
            message: `Dodano ${characterName} do ulubionych` 
          });
        }
      );
    }
  );
});

// DELETE /favorites/:characterId - Usuń z ulubionych
router.delete('/favorites/:characterId', verifyToken, (req, res) => {
  const userId = req.user.id;
  const characterId = parseInt(req.params.characterId);
  
  if (!characterId || isNaN(characterId)) {
    return res.status(400).json({ success: false, message: 'Nieprawidłowe ID postaci' });
  }
  
  pool.query(
    'DELETE FROM character_favorites WHERE user_id = ? AND favorite_character_id = ?',
    [userId, characterId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd usuwania z ulubionych:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Usunięto z ulubionych' 
      });
    }
  );
});

module.exports = router;