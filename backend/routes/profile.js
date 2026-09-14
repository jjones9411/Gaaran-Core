// ================================
// routes/profile.js
// Endpointy profilu postaci + karty + taby + skille
// ================================

const express = require('express');
const router = express.Router();
const { addAchievementLog, addProblemLog, addStoryItemGrantedLog, addStoryItemRemovedLog } = require('./logs');
const { checkAdmin, checkGameMasterOrAdmin } = require('../middleware/auth');
const { withCharacterId } = require('../utils/activeCharacter');

let pool;

// ================================
// PROFILE CACHE
// ================================
// In-memory cache dla endpointu /home/profile/:id.
//
// ⚠️ CACHE TRZYMA WYŁĄCZNIE DANE "WOLNE": zakładki profilu i przynależność do
// klanu. Sam wiersz postaci czytany jest ZAWSZE na świeżo, przy każdym żądaniu -
// opis, status czy przydomek mają być widoczne od razu po zapisie.
//
// Wpis wygasa po CACHE_TTL, a `invalidateProfileCache(characterId)` kasuje go
// ręcznie po każdej zmianie zakładek albo składu klanu.
// ================================

const profileCache = new Map(); // { characterId: { tabs, clan, timestamp } }
const CACHE_TTL = 5000; // 5 sekund

// Cleanup cache co 1 minutę (usuwa stare wpisy)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of profileCache.entries()) {
    if (now - value.timestamp > 60000) { // Starsze niż 1 minuta
      profileCache.delete(key);
    }
  }
}, 60000);

// Wywoływane przez inne routery (klany, pożegnanie postaci) po zmianie danych,
// które SĄ w cache'u - czyli zakładek profilu i przynależności do klanu.
function invalidateProfileCache(characterId) {
  profileCache.delete(String(characterId));
}

function initialize(dependencies) {
  pool = dependencies.pool;
}

// ================================
// PROFILE - PODSTAWOWE
// ================================

// GET: Pobieranie danych aktywnej postaci zalogowanego użytkownika (bez ID - z tokenu)
router.get('/home/profile', (req, res) => {
  const loggedInUserId = req.user.id;

  // Najpierw sprawdź czy użytkownik jest zbanowany
  pool.query('SELECT blocked_until FROM users WHERE id = ?', [loggedInUserId], (err, userResults) => {
    if (err) {
      console.error('❌ Błąd pobierania użytkownika:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }

    const user = userResults[0];

    // Sprawdź czy zbanowany
    if (user.blocked_until) {
      const now = new Date();
      const blockedUntil = new Date(user.blocked_until);

      if (blockedUntil > now) {
        const diffMs = blockedUntil - now;
        const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        return res.status(403).json({
          blocked: true,
          message: 'Twoje konto jest zablokowane',
          blockedUntil: user.blocked_until,
          daysLeft,
          hoursLeft
        });
      }
    }

    // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
    withCharacterId(req, res, (characterId) => {
      return res.status(200).json({
        success: true,
        characterId
      });
    });
  });
});

// GET: Pobieranie danych postaci + taby
router.get('/home/profile/:id', (req, res) => {
  const characterIdFromURL = req.params.id;
  const loggedInUserId = req.user.id;

  const isNumericId = /^\d+$/.test(characterIdFromURL);
  if (!isNumericId) {
    return res.status(400).json({ message: 'ID postaci musi być liczbą' });
  }

  // Rola ZALOGOWANEGO użytkownika - `verifyToken` bierze ją świeżo z bazy przy
  // każdym requeście, więc nie ma po co pytać o nią drugi raz.
  const currentUserRole = req.user.role || 'mieszkaniec';

  // `currentUserRole` i `editable` zależą od tego, KTO pyta, więc nie mogą
  // pochodzić z cache (cache jest per-postać, nie per-użytkownik). Bez tego
  // np. ikona edycji roli fabularnej migałaby adminowi - albo nie - zależnie od
  // tego, kto ostatni (w ciągu 5s) odpytał ten profil.
  const withRequesterFields = (data) => ({
    ...data,
    editable: Boolean(
      data.profileData.user_id &&
      String(data.profileData.user_id) === String(loggedInUserId) &&
      !data.profileData.is_deleted
    ),
    profileData: { ...data.profileData, currentUserRole },
  });

  // ✅ KROK 1: Pobierz postać + właściciela - zawsze z bazy (cache trzyma tylko
  // zakładki i klan, patrz komentarz przy `profileCache`).
  pool.query(`
    SELECT
      c.*,
      u.user AS owner_name,
      u.id AS owner_id,
      u.role AS owner_role,
      (SELECT cc.age FROM character_cards cc WHERE cc.character_id = c.id AND cc.is_approved = 1 ORDER BY cc.id DESC LIMIT 1) AS card_age
    FROM characters c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `, [characterIdFromURL], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Postać nie znaleziona' });
    }
    
    const character = results[0];

    // `editable` (postać należy do pytającego i nie jest usunięta) liczy
    // withRequesterFields - patrz wyżej, nie może wjechać do cache.

    const profileData = {
      id: character.id,
      user_id: character.user_id,
      user: character.name || '',
      userName: character.name || '',
      nickname: character.name || '',
      race: character.race || 'Człowiek',
      gender: character.gender || '',
      age: character.card_age ?? null,
      avatar: character.avatar || '',
      description: character.description || '',
      achievements: character.achievements || '',
      status: character.status || '',
      youtube_music_url: character.youtube_music_url || '',
      youtube_playlist_index: character.youtube_playlist_index || 0,
      playerStatus: character.player_status || 'not_looking',
      // Rola fabularna - wpisywana z ręki przez administrację (patrz PUT
      // /home/profile/:id/narrative-role). Pusty string, gdy nie nadana albo
      // gdy migracja add-narrative-role.sql jeszcze nie poszła.
      narrativeRole: character.narrative_role || '',
      // Przydomek - jak wyżej, tyle że nadaje go administracja LUB mistrz gry
      // (patrz PUT /home/profile/:id/epithet).
      epithet: character.epithet || '',
      faction: character.faction || '',
      class: character.class || null,
      approved: Boolean(character.approved),
      isProfileApproved: Boolean(character.isProfileApproved),
      created_at: character.created_at,
      last_played: character.last_played,
      is_active: Boolean(character.is_active),
      informacje: character.informacje || '',
      informacja: character.informacja || '',
      // ✅ POLA DLA WŁAŚCICIELA
      owner_name: character.owner_name || null,
      owner_id: character.owner_id || null,
      owner_role: character.owner_role || null,
      is_deleted: Boolean(character.is_deleted),
      deleted_at: character.deleted_at || null,

      // ✅ NOWE - ROLA
      userRole: character.owner_role || 'mieszkaniec',      // Rola właściciela postaci
      currentUserRole: currentUserRole,                      // Rola zalogowanego użytkownika
    };
    
    const respondWith = (tabs, clan) => {
      profileData.clan = clan;
      return res.status(200).json(withRequesterFields({ profileData, tabs: tabs || [] }));
    };

    // ✅ KROK 2: taby + klan. Te dane zmieniają się rzadko, więc idą z cache'a.
    const cached = profileCache.get(characterIdFromURL);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return respondWith(cached.tabs, cached.clan);
    }

    pool.query('SELECT * FROM character_tabs WHERE character_id = ? ORDER BY tab_order ASC', [characterIdFromURL], (err, tabResults) => {
      if (err) {
        console.error('❌ Błąd pobierania tabów:', err);
        tabResults = [];
      }

      // Pobierz przynależność do klanu (rodzina) - jeśli tabele istnieją
      pool.query(
        `SELECT cm.clan_id AS id, cm.role, c.name
         FROM clan_members cm
         JOIN clans c ON c.id = cm.clan_id
         WHERE cm.character_id = ?`,
        [characterIdFromURL],
        (clanErr, clanResults) => {
          // Brak tabel klanów (przed migracją) lub inny błąd - nie blokuj profilu
          const clan = !clanErr && clanResults && clanResults.length > 0
            ? { id: clanResults[0].id, name: clanResults[0].name, role: clanResults[0].role }
            : null;

          const tabs = tabResults || [];

          // ✅ ZAPISZ DO CACHE - tylko taby i klan.
          profileCache.set(characterIdFromURL, {
            tabs,
            clan,
            timestamp: Date.now()
          });

          return respondWith(tabs, clan);
        }
      );
    });
  });
});

// GET: Sąsiedni profil (przyciski POPRZEDNIA / NASTĘPNA)
//
// Front szukał sąsiada sam: pobierał PEŁNY profil dla ID ±1, a jeśli dostał
// cokolwiek innego niż 200, próbował następnego - do 50 razy. Jedno kliknięcie
// potrafiło więc wysłać 50 żądań o najcięższy endpoint w grze i samo wpędzało
// gracza w globalny limit (a 429 wyglądało dla tej pętli jak "postać nie
// istnieje", więc leciała dalej i kopała jeszcze głębiej - to właśnie te ciągi
// /home/profile/45, /46, /47... w logach).
//
// Baza odpowiada na to jednym zapytaniem po kluczu głównym.
router.get('/home/profile/:id/neighbor', (req, res) => {
  const currentId = parseInt(req.params.id, 10);
  if (!Number.isInteger(currentId)) {
    return res.status(400).json({ message: 'ID postaci musi być liczbą' });
  }

  // Kierunek inny niż 'prev' traktujemy jako 'next' - front i tak wysyła tylko te dwa.
  const forward = req.query.direction !== 'prev';
  const sql = forward
    ? 'SELECT id FROM characters WHERE id > ? ORDER BY id ASC LIMIT 1'
    : 'SELECT id FROM characters WHERE id < ? ORDER BY id DESC LIMIT 1';

  pool.query(sql, [currentId], (err, rows) => {
    if (err) {
      console.error('❌ Błąd szukania sąsiedniego profilu:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Brak postaci w tym kierunku' });
    }
    res.status(200).json({ id: rows[0].id });
  });
});

// PUT: Edycja statusu
router.put('/home/profile/:id/status', (req, res) => {
  const loggedInUserId = req.user.id;
  const characterIdFromParams = req.params.id;
  const { status } = req.body;

  if (typeof status !== 'string' || status.length > 500) {
    return res.status(400).json({ message: 'Status nieprawidłowy (max 500 znaków)' });
  }

  pool.query('SELECT user_id FROM characters WHERE id = ?', [characterIdFromParams], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (results.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (String(results[0].user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });

    pool.query('UPDATE characters SET status = ? WHERE id = ?', [status, characterIdFromParams], (err) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      return res.status(200).json({ message: 'Status zaktualizowany' });
    });
  });
});

// PUT: Edycja roli fabularnej (TYLKO administracja - rola konta `admin`)
// Rola fabularna to opis funkcji postaci w świecie gry nadawany "z ręki";
// gracz - w odróżnieniu od statusu - nie może jej sobie ustawić.
router.put('/home/profile/:id/narrative-role', checkAdmin, (req, res) => {
  const characterIdFromParams = req.params.id;
  const { narrativeRole } = req.body;

  if (typeof narrativeRole !== 'string') {
    return res.status(400).json({ message: 'Rola fabularna nieprawidłowa' });
  }

  const trimmed = narrativeRole.trim();
  if (trimmed.length > 100) {
    return res.status(400).json({ message: 'Rola fabularna zbyt długa (max 100 znaków)' });
  }

  const valueToSave = trimmed === '' ? null : trimmed;

  pool.query('SELECT id FROM characters WHERE id = ?', [characterIdFromParams], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (results.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

    pool.query('UPDATE characters SET narrative_role = ? WHERE id = ?', [valueToSave, characterIdFromParams], (err) => {
      if (err) {
        // Brak kolumny = migracja database/add-narrative-role.sql jeszcze nie poszła.
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          return res.status(503).json({ message: 'Brak kolumny narrative_role - uruchom migrację database/add-narrative-role.sql' });
        }
        console.error('❌ Błąd zapisu roli fabularnej:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Profil ma cache 5s - bez tego admin po zapisie widziałby starą rolę.
      invalidateProfileCache(characterIdFromParams);

      return res.status(200).json({ message: 'Rola fabularna zaktualizowana', narrativeRole: trimmed });
    });
  });
});

// PUT: Edycja przydomka (administracja - rola konta `admin` lub `mistrz_gry`)
// Przydomek to przezwisko, pod którym postać jest znana w świecie gry; tak jak
// rola fabularna nadawany jest "z ręki" - gracz nie może go sobie ustawić.
router.put('/home/profile/:id/epithet', checkGameMasterOrAdmin, (req, res) => {
  const characterIdFromParams = req.params.id;
  const { epithet } = req.body;

  if (typeof epithet !== 'string') {
    return res.status(400).json({ message: 'Przydomek nieprawidłowy' });
  }

  const trimmed = epithet.trim();
  if (trimmed.length > 100) {
    return res.status(400).json({ message: 'Przydomek zbyt długi (max 100 znaków)' });
  }

  const valueToSave = trimmed === '' ? null : trimmed;

  pool.query('SELECT id FROM characters WHERE id = ?', [characterIdFromParams], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (results.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

    pool.query('UPDATE characters SET epithet = ? WHERE id = ?', [valueToSave, characterIdFromParams], (err) => {
      if (err) {
        // Brak kolumny = migracja database/add-epithet.sql jeszcze nie poszła.
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          return res.status(503).json({ message: 'Brak kolumny epithet - uruchom migrację database/add-epithet.sql' });
        }
        console.error('❌ Błąd zapisu przydomka:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Profil ma cache 5s - bez tego po zapisie widoczny byłby stary przydomek.
      invalidateProfileCache(characterIdFromParams);

      return res.status(200).json({ message: 'Przydomek zaktualizowany', epithet: trimmed });
    });
  });
});

// PUT: Edycja URL YouTube muzyki
router.put('/home/profile/:id/youtube-music', (req, res) => {
  const loggedInUserId = req.user.id;
  const characterIdFromParams = req.params.id;
  const { youtube_music_url } = req.body;

  // Walidacja URL (opcjonalnie może być pusty)
  if (youtube_music_url && typeof youtube_music_url !== 'string') {
    return res.status(400).json({ message: 'URL nieprawidłowy' });
  }

  if (youtube_music_url && youtube_music_url.length > 500) {
    return res.status(400).json({ message: 'URL zbyt długi (max 500 znaków)' });
  }

  // Sprawdź czy to link YouTube (obsługuje zarówno pojedyncze video jak i playlisty)
  if (youtube_music_url && youtube_music_url.trim() !== '') {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.+/;
    if (!youtubeRegex.test(youtube_music_url)) {
      return res.status(400).json({ message: 'To nie jest poprawny link YouTube' });
    }
  }

  pool.query('SELECT user_id FROM characters WHERE id = ?', [characterIdFromParams], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (results.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (String(results[0].user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });

    const urlToSave = youtube_music_url && youtube_music_url.trim() !== '' ? youtube_music_url.trim() : null;

    pool.query('UPDATE characters SET youtube_music_url = ? WHERE id = ?', [urlToSave, characterIdFromParams], (err) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      return res.status(200).json({ message: 'Link do muzyki zaktualizowany' });
    });
  });
});

// PUT: Zapisz indeks playlisty YouTube
router.put('/home/profile/:id/youtube-playlist-index', (req, res) => {
  const loggedInUserId = req.user.id;
  const characterIdFromParams = req.params.id;
  const { youtube_playlist_index } = req.body;

  // Walidacja indeksu (musi być liczbą >= 0)
  if (typeof youtube_playlist_index !== 'number' || youtube_playlist_index < 0) {
    return res.status(400).json({ message: 'Indeks playlisty musi być liczbą >= 0' });
  }

  pool.query('SELECT user_id FROM characters WHERE id = ?', [characterIdFromParams], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (results.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (String(results[0].user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });

    pool.query('UPDATE characters SET youtube_playlist_index = ? WHERE id = ?', [youtube_playlist_index, characterIdFromParams], (err) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      return res.status(200).json({ message: 'Indeks playlisty zaktualizowany' });
    });
  });
});

// POST: Edycja opisu aktywnej postaci
router.post('/home/profile/edit', (req, res) => {
  const { description } = req.body;

  withCharacterId(req, res, (activeCharacterId) => {
    pool.query('UPDATE characters SET description = ? WHERE id = ?', [description || '', activeCharacterId], (err) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      res.status(200).json({ message: 'Opis zaktualizowany' });
    });
  });
});

// POST: Zatwierdzanie postaci (admin)
router.post('/home/profile/:characterId/approval', (req, res) => {
  const { characterId } = req.params;
  const { approved } = req.body;
  const loggedInUserId = req.user.id;

  pool.query('SELECT role FROM users WHERE id = ?', [loggedInUserId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (!results[0] || (results[0].role !== 'admin' && results[0].role !== 'mistrz_gry')) return res.status(403).json({ message: 'Brak uprawnień' });
    if (typeof approved !== 'boolean') return res.status(400).json({ message: 'approved musi być boolean' });

    pool.query('SELECT id, name FROM characters WHERE id = ?', [characterId], (err, charResults) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (charResults.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

      const characterName = charResults[0].name;

      pool.query('UPDATE characters SET approved = ? WHERE id = ?', [approved, characterId], (err, updateResult) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        if (updateResult.affectedRows === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

        res.json({ success: true, message: `Postać "${characterName}" ${approved ? 'zaakceptowana' : 'odrzucona'}` });
      });
    });
  });
});


// ================================
// TABY
// ================================

// GET: Pobieranie wszystkich tabów
router.get('/home/profile/:characterId/tabs', (req, res) => {
  const { characterId } = req.params;
  
  pool.query('SELECT id FROM characters WHERE id = ?', [characterId], (err, characterResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (characterResults.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    
    pool.query('SELECT * FROM character_tabs WHERE character_id = ? ORDER BY tab_order ASC', [characterId], (err, tabResults) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      res.json({ success: true, tabs: tabResults });
    });
  });
});

// POST: Dodawanie tabu (max 3)
router.post('/home/profile/:characterId/tabs', (req, res) => {
  const { characterId } = req.params;
  const { tab_name, tab_content } = req.body;
  const loggedInUserId = req.user.id;
  
  if (!tab_name || !tab_name.trim()) return res.status(400).json({ message: 'Nazwa tabu wymagana' });
  if (tab_name.length > 100) return res.status(400).json({ message: 'Nazwa tabu max 100 znaków' });
  
  pool.query('SELECT user_id FROM characters WHERE id = ?', [characterId], (err, characterResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (characterResults.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (String(characterResults[0].user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });
    
    pool.query('SELECT COUNT(*) as count FROM character_tabs WHERE character_id = ? AND user_id = ?', [characterId, loggedInUserId], (err, countResults) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (countResults[0].count >= 3) return res.status(400).json({ message: 'Maksymalnie 3 taby' });
      
      pool.query('SELECT MAX(tab_order) as max_order FROM character_tabs WHERE character_id = ?', [characterId], (err, orderResults) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        
        const nextOrder = (orderResults[0].max_order || 0) + 1;
        
        pool.query('INSERT INTO character_tabs (character_id, user_id, tab_name, tab_content, tab_order) VALUES (?, ?, ?, ?, ?)',
          [characterId, loggedInUserId, tab_name.trim(), tab_content || '', nextOrder], (err, insertResults) => {
          if (err) return res.status(500).json({ message: 'Błąd serwera' });
          
          res.json({ 
            success: true, 
            message: 'Tab dodany',
            tab: { id: insertResults.insertId, character_id: characterId, user_id: loggedInUserId, tab_name: tab_name.trim(), tab_content: tab_content || '', tab_order: nextOrder }
          });
        });
      });
    });
  });
});

// PUT: Edycja tabu
router.put('/home/profile/:characterId/tabs/:tabId', (req, res) => {
  const { characterId, tabId } = req.params;
  const { tab_name, tab_content } = req.body;
  const loggedInUserId = req.user.id;
  
  if (!tab_name || !tab_name.trim()) return res.status(400).json({ message: 'Nazwa tabu wymagana' });
  if (tab_name.length > 100) return res.status(400).json({ message: 'Nazwa tabu max 100 znaków' });
  
  pool.query('SELECT user_id, character_id FROM character_tabs WHERE id = ?', [tabId], (err, tabResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (tabResults.length === 0) return res.status(404).json({ message: 'Tab nie znaleziony' });
    if (String(tabResults[0].user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });
    if (String(tabResults[0].character_id) !== String(characterId)) return res.status(400).json({ message: 'Nieprawidłowy ID postaci' });
    
    pool.query('UPDATE character_tabs SET tab_name = ?, tab_content = ? WHERE id = ?', [tab_name.trim(), tab_content || '', tabId], (err) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      res.json({ success: true, message: 'Tab zaktualizowany' });
    });
  });
});

// DELETE: Usuwanie tabu
router.delete('/home/profile/:characterId/tabs/:tabId', (req, res) => {
  const { characterId, tabId } = req.params;
  const loggedInUserId = req.user.id;
  
  pool.query('SELECT user_id, character_id FROM character_tabs WHERE id = ?', [tabId], (err, tabResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (tabResults.length === 0) return res.status(404).json({ message: 'Tab nie znaleziony' });
    if (String(tabResults[0].user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });
    if (String(tabResults[0].character_id) !== String(characterId)) return res.status(400).json({ message: 'Nieprawidłowy ID postaci' });
    
    pool.query('DELETE FROM character_tabs WHERE id = ?', [tabId], (err) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      res.json({ success: true, message: 'Tab usunięty' });
    });
  });
});

// ================================
// INFORMACJA PROFILU (users)
// ================================

// GET: Pobieranie informacji profilu użytkownika (właściciel lub admin)
router.get('/home/profile/informacja/:id', (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;
  const userRole = req.user.role || req.user.userRole;
  
  // Sprawdź uprawnienia: admin lub właściciel
  if (userRole !== 'admin' && String(currentUserId) !== String(id)) {
    return res.status(403).json({ message: 'Brak uprawnień do tej informacji' });
  }

  pool.query('SELECT informacja FROM users WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania informacji profilu:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }
    res.status(200).json({ informacja: results[0].informacja || '' });
  });
});

// ================================
// UDOSTĘPNIANIE KARTY
// ================================

// POST: Udostępnianie karty postaci
router.post('/home/profile/:characterId/share', (req, res) => {
  const { characterId } = req.params;
  const { targetCharacterId } = req.body;
  const loggedInUserId = req.user.id;
  
  if (!targetCharacterId) return res.status(400).json({ message: 'ID odbiorcy wymagane' });
  
  pool.query('SELECT c.*, u.username FROM characters c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [characterId], (err, characterResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (characterResults.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    
    const character = characterResults[0];
    if (String(character.user_id) !== String(loggedInUserId)) return res.status(403).json({ message: 'Brak uprawnień' });
    
    pool.query('SELECT c.id, c.name, u.username FROM characters c JOIN users u ON c.user_id = u.id WHERE c.id = ?', [targetCharacterId], (err, targetResults) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (targetResults.length === 0) return res.status(404).json({ message: 'Odbiorca nie znaleziony' });
      
      const targetCharacter = targetResults[0];
      
      let characterCard = { skills: [], flaws: [] };
      if (character.informacje) {
        try { characterCard = JSON.parse(character.informacje); } catch {}
      }
      
      const messageContent = {
        type: 'character_card',
        characterId: character.id,
        characterName: character.name,
        senderUsername: character.username,
        cardData: {
          name: character.name,
          race: character.race,
          gender: character.gender,
          avatar: character.avatar,
          skills: characterCard.skills || [],
          flaws: characterCard.flaws || []
        }
      };
      
      pool.query('INSERT INTO messages (sender_character_id, receiver_character_id, subject, content, created_at) VALUES (?, ?, ?, ?, NOW())',
        [characterId, targetCharacterId, `Karta postaci: ${character.name}`, JSON.stringify(messageContent)], (err) => {
        if (err) return res.status(500).json({ message: 'Błąd wysyłania' });
        res.json({ success: true, message: `Karta wysłana do ${targetCharacter.name}` });
      });
    });
  });
});

// ================================
// POBIERANIE POSTACI GRACZA
// ================================

// GET: Pobieranie wszystkich postaci danego użytkownika
router.get('/users/:userId/characters', (req, res) => {
  const { userId } = req.params;
  const loggedInUserId = req.user.id;
  const userRole = req.user.role || req.user.userRole;

  // Sprawdź czy użytkownik istnieje
  pool.query('SELECT id, user FROM users WHERE id = ?', [userId], (err, userResults) => {
    if (err) {
      console.error('❌ Błąd pobierania użytkownika:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (userResults.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }

    // Pobierz wszystkie postacie tego użytkownika (tylko te nieusunięte)
    pool.query(`
      SELECT 
        id,
        name,
        avatar,
        faction,
        race,
        approved,
        is_deleted,
        created_at
      FROM characters 
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
    `, [userId], (err, characterResults) => {
      if (err) {
        console.error('❌ Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Zwróć listę postaci
      res.json({ 
        success: true, 
        userName: userResults[0].user,
        characters: characterResults || []
      });
    });
  });
});

// ============================================================================
// ENDPOINTY DLA KART POSTACI (NOWA WERSJA)
// ============================================================================

// GET - Podpowiedzi wad/zalet z bazy (tylko admin/MG).
// Zwraca UNIKALNE, już istniejące w grze wady/zalety (tytuł + opis + poziom),
// żeby administracja mogła szybko dodać gotową pozycję z panelu zamiast wpisywać
// wszystko od zera. Bierzemy tylko zatwierdzone wpisy jako "słownik" gry.
// UWAGA: musi być ZAREJESTROWANA PRZED trasą /:characterId, inaczej Express
// potraktuje "suggestions" jako characterId.
router.get('/home/profile/character-card/suggestions', (req, res) => {
  const loggedInUserId = req.user.id;
  pool.query('SELECT role FROM users WHERE id = ?', [loggedInUserId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    const role = results[0]?.role;
    if (role !== 'admin' && role !== 'mistrz_gry') {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    // Grupujemy po tytule (case-insensitive), bierzemy przykładowy opis/poziom.
    const buildQuery = (table) => `
      SELECT title,
             MAX(description) AS description,
             MAX(level) AS level,
             COUNT(*) AS usage_count
      FROM ${table}
      WHERE is_approved = 1 AND title IS NOT NULL AND TRIM(title) <> ''
      GROUP BY LOWER(TRIM(title))
      ORDER BY usage_count DESC, title ASC
      LIMIT 200`;

    pool.query(buildQuery('character_achievements'), (e1, achRows) => {
      if (e1) return res.status(500).json({ message: 'Błąd serwera' });
      pool.query(buildQuery('character_problems'), (e2, probRows) => {
        if (e2) return res.status(500).json({ message: 'Błąd serwera' });
        res.json({
          achievements: achRows || [],
          problems: probRows || []
        });
      });
    });
  });
});

// GET - Pobierz kartę postaci
router.get('/home/profile/character-card/:characterId', (req, res) => {
  const { characterId } = req.params;

  // Pobierz podstawowe dane karty
  pool.query('SELECT * FROM character_cards WHERE character_id = ?', [characterId], (err, cards) => {
    if (err) {
      console.error('Błąd pobierania karty postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (cards.length === 0) {
      return res.json({ card: null });
    }

    const card = cards[0];

    // Pobierz dane postaci (rasa, płeć, właściciel)
    pool.query('SELECT faction, race, gender, user_id FROM characters WHERE id = ?', [characterId], (err, characters) => {
      if (err) {
        console.error('Błąd pobierania danych postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const characterData = characters.length > 0 ? characters[0] : {};

      // Pobierz zdobycze
      pool.query('SELECT * FROM character_achievements WHERE character_id = ? ORDER BY start_date DESC', [characterId], (err, achievements) => {
        if (err) {
          console.error('Błąd pobierania zdobyczy:', err);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        // Pobierz problemy
        pool.query('SELECT * FROM character_problems WHERE character_id = ? ORDER BY start_date DESC', [characterId], (err, problems) => {
          if (err) {
            console.error('Błąd pobierania problemów:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          // Niezaakceptowane wady/zalety widzą tylko właściciel i administracja.
          // Dla pozostałych ukrywamy je, żeby nie liczyły się jako "oficjalne".
          pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (errRole, roleRows) => {
            const role = errRole ? null : roleRows?.[0]?.role;
            const privileged = role === 'admin' || role === 'mistrz_gry';
            const isOwner = characterData.user_id && characterData.user_id === req.user.id;
            const canSeePending = privileged || isOwner;

            const visibleAchievements = canSeePending ? (achievements || []) : (achievements || []).filter(a => a.is_approved);
            const visibleProblems = canSeePending ? (problems || []) : (problems || []).filter(p => p.is_approved);

            // Powód odrzucenia to informacja zwrotna administracji dla właściciela
            // karty, a nie dla każdego, kto ogląda profil. Wcześniej treść
            // odrzucenia (wraz z reviewed_by/reviewed_at) szła w JSON do wszystkich
            // odwiedzających - wystarczyło zajrzeć w odpowiedź endpointu.
            const canSeeRejection = privileged || isOwner;

            const cardPayload = { ...card };
            if (!canSeeRejection) {
              delete cardPayload.rejection_reason;
              delete cardPayload.was_rejected;
              delete cardPayload.reviewed_by;
              delete cardPayload.reviewed_at;
            }

            res.json({
              card: {
                ...cardPayload,
                faction: characterData.faction || '',
                race: characterData.race || '',
                gender: characterData.gender || '',
                achievements: visibleAchievements,
                problems: visibleProblems,
                // ✅ DODAJ INFO O ODRZUCENIU
                isRejected: canSeeRejection && !card.is_approved && card.rejection_reason !== null,
                rejectionReason: canSeeRejection ? card.rejection_reason : null
              }
            });
          });
        });
      });
    });
  });
});

// PUT - Aktualizuj kartę postaci (gracz - własną; admin/MG - dowolną)
router.put('/home/profile/character-card/:characterId', (req, res) => {
  const { characterId } = req.params;
  const userId = req.user.id;
  const {
    first_name,
    last_name,
    age,
    height,
    character_description,
    visual_description,
    additional_info
  } = req.body;

  // Rola zalogowanego: admin/MG może edytować kartę DOWOLNEJ postaci
  // (pobranie i poprawa KP z panelu), gracz tylko swoją.
  pool.query('SELECT role FROM users WHERE id = ?', [userId], (roleErr, roleRows) => {
    if (roleErr) return res.status(500).json({ message: 'Błąd serwera' });
    const role = roleRows[0]?.role;
    const privileged = role === 'admin' || role === 'mistrz_gry';

  // Sprawdź czy użytkownik jest właścicielem postaci
  pool.query('SELECT user_id FROM characters WHERE id = ?', [characterId], (err, characters) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (characters.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (!privileged && characters[0].user_id !== userId) return res.status(403).json({ message: 'Brak uprawnień' });

    // Walidacja
    if (!first_name || first_name.trim().length === 0) {
      return res.status(400).json({ message: 'Imię jest wymagane' });
    }

    if (age && age < 1) {
      return res.status(400).json({ message: 'Podaj prawidłowy wiek postaci' });
    }

    if (height && (height < 140 || height > 220)) {
      return res.status(400).json({ message: 'Wzrost musi być między 140 a 220 cm' });
    }

    // Sprawdź czy karta już istnieje
    pool.query('SELECT id FROM character_cards WHERE character_id = ?', [characterId], (err, existingCards) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });

      if (existingCards.length > 0) {
        // Edycja przez administrację NIE cofa karty do kolejki - zostawiamy
        // dotychczasowy status akceptacji, tylko czyścimy ewentualne odrzucenie.
        // Edycja przez gracza resetuje kartę do ponownej akceptacji.
        const setClause = privileged
          ? `first_name = ?, last_name = ?, age = ?, height = ?,
               character_description = ?, visual_description = ?, additional_info = ?,
               rejection_reason = NULL, was_rejected = FALSE, updated_at = NOW()`
          : `first_name = ?, last_name = ?, age = ?, height = ?,
               character_description = ?, visual_description = ?, additional_info = ?,
               is_approved = FALSE, rejection_reason = NULL, was_rejected = FALSE,
               reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()`;
        pool.query(
          `UPDATE character_cards SET ${setClause} WHERE character_id = ?`,
          [
            first_name.trim(),
            last_name ? last_name.trim() : null,
            age || null,
            height || null,
            character_description ? character_description.trim() : null,
            visual_description ? visual_description.trim() : null,
            additional_info ? additional_info.trim() : null,
            characterId
          ],
          (err) => {
            if (err) {
              console.error('❌ Błąd aktualizacji karty postaci:', err);
              return res.status(500).json({ message: 'Błąd serwera' });
            }
            console.log(`✅ Karta postaci zaktualizowana dla character_id=${characterId}${privileged ? ' (edycja administracji, status akceptacji bez zmian)' : ', is_approved=FALSE (pending review)'}`);
            res.json({ message: privileged ? 'Karta postaci zaktualizowana przez administrację' : 'Karta postaci zapisana pomyślnie i wysłana do ponownej akceptacji' });
          }
        );
      } else {
        // Utwórz nową kartę
        pool.query(
          `INSERT INTO character_cards 
           (character_id, first_name, last_name, age, height, character_description, visual_description, additional_info, is_approved)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
          [
            characterId,
            first_name.trim(),
            last_name ? last_name.trim() : null,
            age || null,
            height || null,
            character_description ? character_description.trim() : null,
            visual_description ? visual_description.trim() : null,
            additional_info ? additional_info.trim() : null
          ],
          (err) => {
            if (err) return res.status(500).json({ message: 'Błąd serwera' });
            res.json({ message: 'Karta postaci zapisana pomyślnie' });
          }
        );
      }
    });
  });
  });
});

// PUT - Zatwierdź kartę postaci (tylko admin)
router.put('/home/profile/character-card/:characterId/approve', (req, res) => {
  const { characterId } = req.params;
  const { approved } = req.body;
  const loggedInUserId = req.user.id;

  // Sprawdź czy to admin
  pool.query('SELECT role FROM users WHERE id = ?', [loggedInUserId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (!results[0] || (results[0].role !== 'admin' && results[0].role !== 'mistrz_gry')) return res.status(403).json({ message: 'Brak uprawnień' });

    const doUpdateApproval = () => {
      pool.query('UPDATE character_cards SET is_approved = ? WHERE character_id = ?', [approved, characterId], (err) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        res.json({ message: 'Status zatwierdzenia zaktualizowany' });
      });
    };

    // Cofnięcie akceptacji zawsze wolno; zaakceptować KP można dopiero, gdy
    // wszystkie wady/zalety są zatwierdzone (ta sama zasada co w panelu admina,
    // inaczej ten endpoint byłby obejściem blokady).
    if (!approved) return doUpdateApproval();

    // Blokują tylko wpisy WŁAŚCICIELA (created_by = gracz lub NULL sprzed
    // migracji) - te same, które administracja widzi przy karcie w kolejce
    // akceptacji. Wpisy administracji/systemu (konsekwencje z sesji, choroby)
    // nie są częścią KP i nie mogą jej blokować.
    const pendingEntriesQuery = `
      SELECT COUNT(*) AS cnt FROM (
        SELECT ca.id FROM character_achievements ca
        JOIN characters c ON c.id = ca.character_id
        WHERE ca.character_id = ? AND ca.is_approved = 0
          AND (ca.created_by IS NULL OR ca.created_by = c.user_id)
        UNION ALL
        SELECT cp.id FROM character_problems cp
        JOIN characters c ON c.id = cp.character_id
        WHERE cp.character_id = ? AND cp.is_approved = 0
          AND (cp.created_by IS NULL OR cp.created_by = c.user_id)
      ) AS pending
    `;

    pool.query(pendingEntriesQuery, [characterId, characterId], (errPending, pendingRows) => {
      if (errPending) return res.status(500).json({ message: 'Błąd serwera' });
      if (Number(pendingRows[0].cnt) > 0) {
        return res.status(409).json({
          message: 'Nie można zaakceptować KP, dopóki wszystkie wady/zalety nie są zatwierdzone'
        });
      }
      doUpdateApproval();
    });
  });
});

// ============================================================================
// ENDPOINTY DLA ZALET I WAD (dawne "konsekwencje pozytywne/negatywne")
// character_achievements = ZALETY, character_problems = WADY, poziomy 1-5.
//
// Admin/mistrz gry: dodaje/edytuje bez ograniczeń (np. konsekwencje z sesji).
// Właściciel postaci: może dodawać zalety/wady przy tworzeniu karty postaci,
// ale tylko w ramach zasady balansu (3 zalety 2/5 + wada 1/5 LUB 2 zalety 3/5
// + wada 2/5) i może edytować/usuwać wyłącznie wpisy, które sam stworzył.
// ============================================================================

const ZALETY_MAX_COUNT = 3;      // maks. liczba zalet gracza
const ZALETY_MAX_LEVEL = 3;      // pojedyncza zaleta gracza maks. 3/5
const ZALETY_MAX_LEVEL_SUM = 6;  // suma poziomów zalet gracza (3x2 lub 2x3)
const WADY_MAX_COUNT = 1;        // gracz wpisuje dokładnie jedną wadę

// start_date/end_date to kolumny DATE. Klient potrafi przysłać pełny ISO
// ("2026-08-01T00:00:00.000Z" - tak dane wracają z API i tak wracały w edycji),
// a taki string dla kolumny DATE jest nieprawidłowy i w trybie nie-strict
// zapisuje się jako 0000-00-00. Wtedy wpis ma "datę końcową" z przeszłości i
// znika z karty postaci. Przycinamy więc wszystko do YYYY-MM-DD, a śmieci
// zamieniamy na NULL.
function parseDateOnly(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const str = String(raw).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return match[1];
}

function parseLevel(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const lvl = parseInt(raw, 10);
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > 5) return undefined; // undefined = błąd walidacji
  return lvl;
}

// Ustala uprawnienia: zwraca { privileged, isOwner, cardApproved } albo odpowiada błędem.
// cardApproved = czy karta postaci jest już zaakceptowana (wtedy gracz nie może
// nic dodawać/zmieniać w wadach/zaletach - robi to tylko administracja).
function resolveCardEntryAccess(characterId, loggedInUserId, res, callback) {
  pool.query('SELECT role FROM users WHERE id = ?', [loggedInUserId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    const role = results[0]?.role;
    const privileged = role === 'admin' || role === 'mistrz_gry';

    pool.query('SELECT user_id FROM characters WHERE id = ?', [characterId], (err2, chars) => {
      if (err2) return res.status(500).json({ message: 'Błąd serwera' });
      if (chars.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

      const isOwner = chars[0].user_id === loggedInUserId;
      if (!privileged && !isOwner) {
        return res.status(403).json({ message: 'Brak uprawnień' });
      }

      pool.query('SELECT is_approved FROM character_cards WHERE character_id = ?', [characterId], (err3, cardRows) => {
        if (err3) return res.status(500).json({ message: 'Błąd serwera' });
        const cardApproved = cardRows.length > 0 ? Boolean(cardRows[0].is_approved) : false;
        callback({ privileged, isOwner, cardApproved });
      });
    });
  });
}

// Wspólny komunikat blokady dla właściciela po zaakceptowaniu KP
const CARD_LOCKED_MSG = 'Karta postaci została zaakceptowana — kolejne wady/zalety dodaje już tylko administracja.';

// Czy dany wpis (wada/zaleta) należy do właściciela postaci i może być przez
// niego edytowany/usuwany podczas (ponownego) wysyłania KP. Wpisy startowe
// gracza mają created_by = jego users.id; wpisy sprzed migracji mają
// created_by = NULL (też traktujemy jak wpisy gracza). Konsekwencje dodane
// przez administrację mają created_by = id admina/MG (≠ właściciel) i są dla
// gracza nieedytowalne.
function isOwnerEntry(row, loggedInUserId) {
  return row.created_by === null || row.created_by === loggedInUserId;
}

// POST - Dodaj zaletę
router.post('/home/profile/character-card/:characterId/achievements', (req, res) => {
  const { characterId } = req.params;
  const { title, description, start_date, end_date } = req.body;
  const loggedInUserId = req.user.id;

  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged, cardApproved }) => {
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Tytuł jest wymagany' });
    }

    const level = parseLevel(req.body.level);
    if (level === undefined) {
      return res.status(400).json({ message: 'Poziom musi być liczbą od 1 do 5' });
    }

    // Wpisy administracji są od razu zaakceptowane; wpisy gracza czekają na akceptację.
    const approved = privileged ? 1 : 0;

    const doInsert = () => {
      pool.query(
        `INSERT INTO character_achievements
         (character_id, title, description, level, created_by, is_approved, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          characterId,
          title.trim(),
          description ? description.trim() : null,
          level,
          loggedInUserId,
          approved,
          parseDateOnly(start_date),
          parseDateOnly(end_date)
        ],
        (err, result) => {
          if (err) return res.status(500).json({ message: 'Błąd serwera' });

          pool.query('SELECT * FROM character_achievements WHERE id = ?', [result.insertId], (err2, newAchievement) => {
            if (err2) return res.status(500).json({ message: 'Błąd serwera' });

            addAchievementLog(characterId, {
              id: result.insertId,
              title: title.trim(),
              description: description ? description.trim() : null,
              start_date: start_date,
              end_date: end_date
            });

            res.json({ achievement: newAchievement[0] });
          });
        }
      );
    };

    if (privileged) return doInsert();

    // Po zaakceptowaniu KP gracz nie dodaje już nic samodzielnie
    if (cardApproved) return res.status(403).json({ message: CARD_LOCKED_MSG });

    // Właściciel: wymuszamy zasadę balansu z tworzenia karty postaci
    if (!level || level > ZALETY_MAX_LEVEL) {
      return res.status(400).json({ message: `Zaleta musi mieć poziom od 1 do ${ZALETY_MAX_LEVEL}/5` });
    }

    pool.query(
      'SELECT COUNT(*) AS cnt, COALESCE(SUM(level), 0) AS lvl_sum FROM character_achievements WHERE character_id = ? AND created_by = ?',
      [characterId, loggedInUserId],
      (err, rows) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });

        const { cnt, lvl_sum } = rows[0];
        if (cnt >= ZALETY_MAX_COUNT) {
          return res.status(400).json({ message: `Możesz wpisać maksymalnie ${ZALETY_MAX_COUNT} zalety (3 na poziomie 2/5 lub 2 na poziomie 3/5)` });
        }
        if (Number(lvl_sum) + level > ZALETY_MAX_LEVEL_SUM) {
          return res.status(400).json({ message: `Suma poziomów zalet nie może przekroczyć ${ZALETY_MAX_LEVEL_SUM} (np. 3 zalety po 2/5 albo 2 zalety po 3/5)` });
        }
        doInsert();
      }
    );
  });
});

// PUT - Edytuj zaletę
router.put('/home/profile/character-card/:characterId/achievements/:achievementId', (req, res) => {
  const { characterId, achievementId } = req.params;
  const { title, description, start_date, end_date } = req.body;
  const loggedInUserId = req.user.id;

  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged, cardApproved }) => {
    // Tak samo jak przy dodawaniu - bez tego pusty tytuł zapisywał się jako
    // pusta zaleta, a brak pola w body wywalał się na title.trim().
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Tytuł jest wymagany' });
    }

    const level = parseLevel(req.body.level);
    if (level === undefined) {
      return res.status(400).json({ message: 'Poziom musi być liczbą od 1 do 5' });
    }
    if (!privileged && (!level || level > ZALETY_MAX_LEVEL)) {
      return res.status(400).json({ message: `Zaleta musi mieć poziom od 1 do ${ZALETY_MAX_LEVEL}/5` });
    }

    pool.query('SELECT created_by, level, is_approved FROM character_achievements WHERE id = ? AND character_id = ?', [achievementId, characterId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (rows.length === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
      if (!privileged) {
        // Po akceptacji KP gracz nie zmienia już nic
        if (cardApproved) return res.status(403).json({ message: CARD_LOCKED_MSG });
        // Właściciel może edytować własne (lub sprzed migracji) wpisy — także już
        // zaakceptowane. Edycja cofa je do ponownej akceptacji (patrz doUpdate),
        // dzięki czemu tylko ZMIENIONE wady/zalety wracają do kolejki razem z KP.
        if (!isOwnerEntry(rows[0], loggedInUserId)) {
          return res.status(403).json({ message: 'Brak uprawnień' });
        }
      }

      // Właściciel: edytowany wpis wraca do akceptacji (is_approved=0) i traci
      // status odrzucenia. Administracja: jej edycje są od razu zaakceptowane.
      const newApproved = privileged ? 1 : 0;

      const doUpdate = () => {
        pool.query(
          `UPDATE character_achievements
           SET title = ?, description = ?, level = ?, start_date = ?, end_date = ?,
               is_approved = ?, was_rejected = 0, rejection_reason = NULL, updated_at = NOW()
           WHERE id = ?`,
          [title.trim(), description ? description.trim() : null, level, parseDateOnly(start_date), parseDateOnly(end_date), newApproved, achievementId],
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Błąd serwera' });
            res.json({ message: 'Zaleta zaktualizowana' });
          }
        );
      };

      if (privileged) return doUpdate();

      pool.query(
        'SELECT COALESCE(SUM(level), 0) AS lvl_sum FROM character_achievements WHERE character_id = ? AND created_by = ? AND id != ?',
        [characterId, loggedInUserId, achievementId],
        (err2, sumRows) => {
          if (err2) return res.status(500).json({ message: 'Błąd serwera' });
          if (Number(sumRows[0].lvl_sum) + level > ZALETY_MAX_LEVEL_SUM) {
            return res.status(400).json({ message: `Suma poziomów zalet nie może przekroczyć ${ZALETY_MAX_LEVEL_SUM} (np. 3 zalety po 2/5 albo 2 zalety po 3/5)` });
          }
          doUpdate();
        }
      );
    });
  });
});

// DELETE - Usuń zaletę
router.delete('/home/profile/character-card/:characterId/achievements/:achievementId', (req, res) => {
  const { characterId, achievementId } = req.params;
  const loggedInUserId = req.user.id;

  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged, cardApproved }) => {
    pool.query('SELECT created_by, is_approved FROM character_achievements WHERE id = ? AND character_id = ?', [achievementId, characterId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (rows.length === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
      if (!privileged) {
        if (cardApproved) return res.status(403).json({ message: CARD_LOCKED_MSG });
        if (!isOwnerEntry(rows[0], loggedInUserId)) {
          return res.status(403).json({ message: 'Brak uprawnień' });
        }
      }

      pool.query('DELETE FROM character_achievements WHERE id = ?', [achievementId], (err2) => {
        if (err2) return res.status(500).json({ message: 'Błąd serwera' });
        res.json({ message: 'Zaleta usunięta' });
      });
    });
  });
});

// PUT - Zatwierdź zaletę (tylko admin/MG)
router.put('/home/profile/character-card/:characterId/achievements/:achievementId/approve', (req, res) => {
  const { characterId, achievementId } = req.params;
  const loggedInUserId = req.user.id;
  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged }) => {
    if (!privileged) return res.status(403).json({ message: 'Brak uprawnień' });
    pool.query('UPDATE character_achievements SET is_approved = 1, was_rejected = 0, rejection_reason = NULL WHERE id = ? AND character_id = ?', [achievementId, characterId], (err, result) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
      res.json({ message: 'Zaleta zaakceptowana' });
    });
  });
});

// PUT - Odrzuć zaletę z komentarzem (tylko admin/MG)
// Wpis NIE znika: zostaje z powodem odrzucenia (rejection_reason) i flagą
// was_rejected, żeby gracz mógł go poprawić i wysłać ponownie do akceptacji.
router.put('/home/profile/character-card/:characterId/achievements/:achievementId/reject', (req, res) => {
  const { characterId, achievementId } = req.params;
  const { rejection_reason } = req.body;
  const loggedInUserId = req.user.id;
  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged }) => {
    if (!privileged) return res.status(403).json({ message: 'Brak uprawnień' });
    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ message: 'Powód odrzucenia jest wymagany' });
    }
    pool.query(
      'UPDATE character_achievements SET is_approved = 0, was_rejected = 1, rejection_reason = ? WHERE id = ? AND character_id = ?',
      [rejection_reason.trim(), achievementId, characterId],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
        res.json({ message: 'Zaleta odrzucona' });
      }
    );
  });
});

// ============================================================================
// ENDPOINTY DLA WAD (dawne "problemy")
// ============================================================================

// POST - Dodaj wadę
router.post('/home/profile/character-card/:characterId/problems', (req, res) => {
  const { characterId } = req.params;
  const { title, description, start_date, end_date } = req.body;
  const loggedInUserId = req.user.id;

  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged, cardApproved }) => {
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Tytuł jest wymagany' });
    }

    const level = parseLevel(req.body.level);
    if (level === undefined) {
      return res.status(400).json({ message: 'Poziom musi być liczbą od 1 do 5' });
    }

    const approved = privileged ? 1 : 0;

    const doInsert = () => {
      pool.query(
        `INSERT INTO character_problems
         (character_id, title, description, level, created_by, is_approved, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          characterId,
          title.trim(),
          description ? description.trim() : null,
          level,
          loggedInUserId,
          approved,
          parseDateOnly(start_date),
          parseDateOnly(end_date)
        ],
        (err, result) => {
          if (err) return res.status(500).json({ message: 'Błąd serwera' });

          pool.query('SELECT * FROM character_problems WHERE id = ?', [result.insertId], (err2, newProblem) => {
            if (err2) return res.status(500).json({ message: 'Błąd serwera' });

            addProblemLog(characterId, {
              id: result.insertId,
              title: title.trim(),
              description: description ? description.trim() : null,
              start_date: start_date,
              end_date: end_date
            });

            res.json({ problem: newProblem[0] });
          });
        }
      );
    };

    if (privileged) return doInsert();

    // Po zaakceptowaniu KP gracz nie dodaje już nic samodzielnie
    if (cardApproved) return res.status(403).json({ message: CARD_LOCKED_MSG });

    // Właściciel: dokładnie jedna wada, poziom zależny od układu zalet
    // (1/5 przy 3 zaletach po 2/5, 2/5 przy 2 zaletach po 3/5)
    if (!level) {
      return res.status(400).json({ message: 'Wada musi mieć poziom (1/5 przy 3 zaletach, 2/5 przy 2 mocniejszych zaletach)' });
    }

    pool.query(
      'SELECT COUNT(*) AS wady_cnt FROM character_problems WHERE character_id = ? AND created_by = ?',
      [characterId, loggedInUserId],
      (err, wadyRows) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        if (wadyRows[0].wady_cnt >= WADY_MAX_COUNT) {
          return res.status(400).json({ message: 'Przy tworzeniu karty postaci wpisujesz jedną wadę' });
        }

        pool.query(
          'SELECT COUNT(*) AS cnt FROM character_achievements WHERE character_id = ? AND created_by = ?',
          [characterId, loggedInUserId],
          (err2, zaletyRows) => {
            if (err2) return res.status(500).json({ message: 'Błąd serwera' });

            const maxWadaLevel = zaletyRows[0].cnt >= ZALETY_MAX_COUNT ? 1 : 2;
            if (level > maxWadaLevel) {
              return res.status(400).json({
                message: `Wada może mieć maksymalnie poziom ${maxWadaLevel}/5 przy Twoim układzie zalet (1/5 przy 3 zaletach, 2/5 przy 2 zaletach)`
              });
            }
            doInsert();
          }
        );
      }
    );
  });
});

// PUT - Edytuj wadę
router.put('/home/profile/character-card/:characterId/problems/:problemId', (req, res) => {
  const { characterId, problemId } = req.params;
  const { title, description, start_date, end_date } = req.body;
  const loggedInUserId = req.user.id;

  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged, cardApproved }) => {
    // Jak przy zalecie - pusty/brakujący tytuł nie może przejść do UPDATE.
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Tytuł jest wymagany' });
    }

    const level = parseLevel(req.body.level);
    if (level === undefined) {
      return res.status(400).json({ message: 'Poziom musi być liczbą od 1 do 5' });
    }

    pool.query('SELECT created_by, is_approved FROM character_problems WHERE id = ? AND character_id = ?', [problemId, characterId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (rows.length === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
      if (!privileged) {
        if (cardApproved) return res.status(403).json({ message: CARD_LOCKED_MSG });
        // Właściciel może edytować własne (lub sprzed migracji) wpisy — także już
        // zaakceptowane. Edycja cofa je do ponownej akceptacji (patrz doUpdate).
        if (!isOwnerEntry(rows[0], loggedInUserId)) {
          return res.status(403).json({ message: 'Brak uprawnień' });
        }
      }

      // Właściciel: edytowana wada wraca do akceptacji i traci status odrzucenia.
      // Administracja: jej edycje są od razu zaakceptowane.
      const newApproved = privileged ? 1 : 0;

      const doUpdate = () => {
        pool.query(
          `UPDATE character_problems
           SET title = ?, description = ?, level = ?, start_date = ?, end_date = ?,
               is_approved = ?, was_rejected = 0, rejection_reason = NULL, updated_at = NOW()
           WHERE id = ?`,
          [title.trim(), description ? description.trim() : null, level, parseDateOnly(start_date), parseDateOnly(end_date), newApproved, problemId],
          (err2) => {
            if (err2) return res.status(500).json({ message: 'Błąd serwera' });
            res.json({ message: 'Wada zaktualizowana' });
          }
        );
      };

      if (privileged) return doUpdate();

      if (!level) {
        return res.status(400).json({ message: 'Wada musi mieć poziom' });
      }

      pool.query(
        'SELECT COUNT(*) AS cnt FROM character_achievements WHERE character_id = ? AND created_by = ?',
        [characterId, loggedInUserId],
        (err2, zaletyRows) => {
          if (err2) return res.status(500).json({ message: 'Błąd serwera' });
          const maxWadaLevel = zaletyRows[0].cnt >= ZALETY_MAX_COUNT ? 1 : 2;
          if (level > maxWadaLevel) {
            return res.status(400).json({
              message: `Wada może mieć maksymalnie poziom ${maxWadaLevel}/5 przy Twoim układzie zalet`
            });
          }
          doUpdate();
        }
      );
    });
  });
});

// DELETE - Usuń wadę
router.delete('/home/profile/character-card/:characterId/problems/:problemId', (req, res) => {
  const { characterId, problemId } = req.params;
  const loggedInUserId = req.user.id;

  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged, cardApproved }) => {
    pool.query('SELECT created_by, is_approved FROM character_problems WHERE id = ? AND character_id = ?', [problemId, characterId], (err, rows) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (rows.length === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
      if (!privileged) {
        if (cardApproved) return res.status(403).json({ message: CARD_LOCKED_MSG });
        if (!isOwnerEntry(rows[0], loggedInUserId)) {
          return res.status(403).json({ message: 'Brak uprawnień' });
        }
      }

      pool.query('DELETE FROM character_problems WHERE id = ?', [problemId], (err2) => {
        if (err2) return res.status(500).json({ message: 'Błąd serwera' });
        res.json({ message: 'Wada usunięta' });
      });
    });
  });
});

// PUT - Zatwierdź wadę (tylko admin/MG)
router.put('/home/profile/character-card/:characterId/problems/:problemId/approve', (req, res) => {
  const { characterId, problemId } = req.params;
  const loggedInUserId = req.user.id;
  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged }) => {
    if (!privileged) return res.status(403).json({ message: 'Brak uprawnień' });
    pool.query('UPDATE character_problems SET is_approved = 1, was_rejected = 0, rejection_reason = NULL WHERE id = ? AND character_id = ?', [problemId, characterId], (err, result) => {
      if (err) return res.status(500).json({ message: 'Błąd serwera' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
      res.json({ message: 'Wada zaakceptowana' });
    });
  });
});

// PUT - Odrzuć wadę z komentarzem (tylko admin/MG). Wpis zostaje z powodem
// odrzucenia, żeby gracz mógł go poprawić i wysłać ponownie do akceptacji.
router.put('/home/profile/character-card/:characterId/problems/:problemId/reject', (req, res) => {
  const { characterId, problemId } = req.params;
  const { rejection_reason } = req.body;
  const loggedInUserId = req.user.id;
  resolveCardEntryAccess(characterId, loggedInUserId, res, ({ privileged }) => {
    if (!privileged) return res.status(403).json({ message: 'Brak uprawnień' });
    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ message: 'Powód odrzucenia jest wymagany' });
    }
    pool.query(
      'UPDATE character_problems SET is_approved = 0, was_rejected = 1, rejection_reason = ? WHERE id = ? AND character_id = ?',
      [rejection_reason.trim(), problemId, characterId],
      (err, result) => {
        if (err) return res.status(500).json({ message: 'Błąd serwera' });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Wpis nie znaleziony' });
        res.json({ message: 'Wada odrzucona' });
      }
    );
  });
});



// ================================
// PRZEDMIOTY FABULARNE (zakładka "Przedmioty" w profilu)
// ================================
// Spis rzeczy, które postać zdobyła w fabule (relikwie, listy, trofea). Nie
// mają żadnej mechaniki - nie wchodzą do ekwipunku ani do walki. Wpisuje,
// poprawia i kasuje je WYŁĄCZNIE administracja (`admin` / `mistrz_gry`);
// właściciel postaci ma je tylko do czytania, żeby spis pozostał wiarygodny.

// Migracja database/add-story-items.sql mogła jeszcze nie pójść - wtedy
// odczyt ma udawać pustą listę (profil działa normalnie), a zapis powiedzieć
// wprost, co uruchomić. Bez tego cała zakładka wywalałaby 500.
const isMissingStoryItemsTable = (err) => err && err.code === 'ER_NO_SUCH_TABLE';

const STORY_ITEMS_MIGRATION_MESSAGE =
  'Brak tabeli character_story_items - uruchom migrację database/add-story-items.sql';

// Wspólna walidacja pól przedmiotu. Zwraca { error } albo gotowe wartości.
function parseStoryItemPayload(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'Nazwa przedmiotu jest wymagana' };
  if (name.length > 150) return { error: 'Nazwa przedmiotu max 150 znaków' };

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length > 2000) return { error: 'Opis przedmiotu max 2000 znaków' };

  const source = typeof body.source === 'string' ? body.source.trim() : '';
  if (source.length > 150) return { error: 'Pochodzenie przedmiotu max 150 znaków' };

  // Ilość: domyślnie 1. Pusty string z formularza traktujemy jak brak wartości.
  const rawQuantity = body.quantity === '' || body.quantity == null ? 1 : Number(body.quantity);
  if (!Number.isInteger(rawQuantity) || rawQuantity < 1 || rawQuantity > 9999) {
    return { error: 'Ilość musi być liczbą całkowitą z zakresu 1-9999' };
  }

  return {
    name,
    description: description || null,
    source: source || null,
    quantity: rawQuantity
  };
}

// GET: Lista przedmiotów fabularnych postaci (widoczna dla każdego zalogowanego,
// tak jak reszta profilu)
router.get('/home/profile/:characterId/story-items', (req, res) => {
  const { characterId } = req.params;

  pool.query('SELECT id FROM characters WHERE id = ?', [characterId], (err, characterResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (characterResults.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

    pool.query(
      `SELECT si.id, si.character_id, si.name, si.description, si.quantity, si.source,
              si.granted_by, si.created_at, si.updated_at,
              u.user AS granted_by_name
       FROM character_story_items si
       LEFT JOIN users u ON u.id = si.granted_by
       WHERE si.character_id = ?
       ORDER BY si.created_at DESC, si.id DESC`,
      [characterId],
      (itemsErr, itemResults) => {
        if (itemsErr) {
          if (isMissingStoryItemsTable(itemsErr)) {
            return res.json({ success: true, items: [], migrationRequired: true });
          }
          console.error('❌ Błąd pobierania przedmiotów fabularnych:', itemsErr);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        res.json({ success: true, items: itemResults || [] });
      }
    );
  });
});

// POST: Dodanie przedmiotu (tylko administracja)
router.post('/home/profile/:characterId/story-items', checkGameMasterOrAdmin, (req, res) => {
  const { characterId } = req.params;
  const loggedInUserId = req.user.id;

  const payload = parseStoryItemPayload(req.body || {});
  if (payload.error) return res.status(400).json({ message: payload.error });

  pool.query('SELECT id FROM characters WHERE id = ?', [characterId], (err, characterResults) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (characterResults.length === 0) return res.status(404).json({ message: 'Postać nie znaleziona' });

    pool.query(
      'INSERT INTO character_story_items (character_id, name, description, quantity, source, granted_by) VALUES (?, ?, ?, ?, ?, ?)',
      [characterId, payload.name, payload.description, payload.quantity, payload.source, loggedInUserId],
      (insertErr, insertResult) => {
        if (insertErr) {
          if (isMissingStoryItemsTable(insertErr)) {
            return res.status(503).json({ message: STORY_ITEMS_MIGRATION_MESSAGE });
          }
          console.error('❌ Błąd dodawania przedmiotu fabularnego:', insertErr);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        // Gracz nie dostaje powiadomienia o zmianie w profilu, więc bez wpisu
        // w kartotece przedmiot pojawiałby się "znikąd".
        addStoryItemGrantedLog(characterId, {
          id: insertResult.insertId,
          name: payload.name,
          quantity: payload.quantity,
          source: payload.source
        });

        res.json({
          success: true,
          message: 'Przedmiot dodany',
          item: {
            id: insertResult.insertId,
            character_id: Number(characterId),
            name: payload.name,
            description: payload.description,
            quantity: payload.quantity,
            source: payload.source,
            granted_by: loggedInUserId
          }
        });
      }
    );
  });
});

// PUT: Edycja przedmiotu (tylko administracja)
router.put('/home/profile/:characterId/story-items/:itemId', checkGameMasterOrAdmin, (req, res) => {
  const { characterId, itemId } = req.params;

  const payload = parseStoryItemPayload(req.body || {});
  if (payload.error) return res.status(400).json({ message: payload.error });

  pool.query(
    'UPDATE character_story_items SET name = ?, description = ?, quantity = ?, source = ? WHERE id = ? AND character_id = ?',
    [payload.name, payload.description, payload.quantity, payload.source, itemId, characterId],
    (err, result) => {
      if (err) {
        if (isMissingStoryItemsTable(err)) {
          return res.status(503).json({ message: STORY_ITEMS_MIGRATION_MESSAGE });
        }
        console.error('❌ Błąd edycji przedmiotu fabularnego:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Przedmiot nie znaleziony' });

      res.json({ success: true, message: 'Przedmiot zaktualizowany' });
    }
  );
});

// DELETE: Zabranie przedmiotu (tylko administracja)
router.delete('/home/profile/:characterId/story-items/:itemId', checkGameMasterOrAdmin, (req, res) => {
  const { characterId, itemId } = req.params;

  // Nazwa jest potrzebna do logu - po DELETE nie ma już czego czytać.
  pool.query(
    'SELECT name, quantity FROM character_story_items WHERE id = ? AND character_id = ?',
    [itemId, characterId],
    (err, itemResults) => {
      if (err) {
        if (isMissingStoryItemsTable(err)) {
          return res.status(503).json({ message: STORY_ITEMS_MIGRATION_MESSAGE });
        }
        console.error('❌ Błąd pobierania przedmiotu fabularnego:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (itemResults.length === 0) return res.status(404).json({ message: 'Przedmiot nie znaleziony' });

      const removedItem = itemResults[0];

      pool.query('DELETE FROM character_story_items WHERE id = ? AND character_id = ?', [itemId, characterId], (delErr) => {
        if (delErr) {
          console.error('❌ Błąd usuwania przedmiotu fabularnego:', delErr);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        addStoryItemRemovedLog(characterId, { ...removedItem, id: Number(itemId) });

        res.json({ success: true, message: 'Przedmiot usunięty' });
      });
    }
  );
});

module.exports = { router, initialize, invalidateProfileCache };