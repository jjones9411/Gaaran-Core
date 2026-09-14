const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // ✅ DODAJ IMPORT
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { invalidateProfileCache } = require('./profile');
const { getMaxCharacters } = require('../utils/characterSlots');
const { npcTokenClaims } = require('../utils/npcAccount');

// POST /api/createCharacter
//
// ⚠️ LIMIT SLOTÓW JEST EGZEKWOWANY TRANSAKCYJNIE.
// Wcześniej trasa robiła `SELECT COUNT(*)`, a dopiero potem - w osobnym
// zapytaniu, po kilku innych round-tripach do bazy - `INSERT`. To jest
// podręcznikowy wyścig (TOCTOU): wystarczyło wysłać kilkanaście żądań
// „utwórz postać" RÓWNOLEGLE, żeby wszystkie odczytały count = 0, wszystkie
// uznały, że limit 4 nie jest przekroczony, i wszystkie wstawiły postać.
// Konto kończyło z dowolną liczbą postaci - a to jest cały fundament
// balansu gry (4 sloty = 4 pule staminy, 4 dzienne limity pracy...).
//
// Naprawa: cała operacja idzie w JEDNEJ transakcji, otwartej blokadą wiersza
// konta (`SELECT ... FROM users WHERE id = ? FOR UPDATE`). Drugie równoległe
// żądanie tego samego konta czeka na commit pierwszego, więc liczy postacie
// JUŻ PO wstawieniu poprzedniej. Blokujemy wiersz `users`, a nie `characters`,
// bo blokada musi istnieć również wtedy, gdy postaci jeszcze nie ma (nie da
// się zablokować wiersza, którego nie ma - a właśnie od zera zaczyna atak).
router.post('/createCharacter', verifyToken, async (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'Oczekiwano Content-Type: application/json' });
  }

  const { name, gender, race, faction, description } = req.body;
  const userId = req.user.id;

  // ---- Walidacja wejścia (przed otwarciem transakcji - nie ma czego wycofywać) ----
  if (!name || !gender || !faction) {
    return res.status(400).json({ message: 'Imię, płeć i rasa są wymagane.' });
  }

  if (typeof name !== 'string' || typeof gender !== 'string' || typeof faction !== 'string') {
    return res.status(400).json({ message: 'Nieprawidłowe dane postaci.' });
  }

  const allowedGenders = ['Kobieta', 'Mężczyzna'];
  if (!allowedGenders.includes(gender)) {
    return res.status(400).json({ message: 'Nieprawidłowa płeć. Dostępne: Kobieta, Mężczyzna.' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 255) {
    return res.status(400).json({ message: 'Imię musi mieć od 2 do 255 znaków.' });
  }

  // Walidacja nazwy postaci
  const nameRegex = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻа-яА-ЯёЁ\s\-']+$/;
  if (!nameRegex.test(trimmedName)) {
    return res.status(400).json({ message: 'Imię może zawierać tylko litery (łacińskie i cyrylicę), spacje, myślniki i apostrofy.' });
  }

  // Opis trafia wprost do kolumny TEXT i do karty postaci - bez limitu
  // pojedyncze żądanie mogło zapisać megabajty na postać.
  const safeDescription = typeof description === 'string' ? description.slice(0, 20000) : '';

  // Wiek nie jest już zbierany przy tworzeniu postaci - ustala się go w
  // karcie postaci (KP) i pokazuje na profilu po jej zaakceptowaniu.

  const connection = await pool.promise().getConnection();

  try {
    await connection.beginTransaction();

    // Blokada wiersza konta - serializuje równoległe tworzenie postaci na tym
    // koncie. Bez niej limit slotów jest tylko sugestią.
    const [userRows] = await connection.query(
      'SELECT id FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ message: 'Użytkownik nie istnieje.' });
    }

    // Sprawdź ile postaci już ma użytkownik (już pod blokadą).
    // Uwaga: liczymy RÓWNIEŻ postacie pożegnane (is_deleted = 1). Slot zajęty
    // przez postać, która trafiła na cmentarz, nie wraca - świadomie, żeby
    // zamknięcie historii postaci coś znaczyło.
    const [countRows] = await connection.query(
      'SELECT COUNT(*) AS characterCount FROM characters WHERE user_id = ?',
      [userId]
    );
    const characterCount = countRows[0].characterCount;

    // Rola pochodzi z bazy (verifyToken czyta users.role i odrzuca token ze starą
    // rolą), więc nie da się dobrać slotów podmieniając payload tokena.
    const MAX_CHARACTERS = getMaxCharacters(req.user.role, req.user.isNpcAccount);
    if (characterCount >= MAX_CHARACTERS) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        message: `Możesz mieć maksymalnie ${MAX_CHARACTERS} postaci.`
      });
    }

    // Sprawdź czy nazwa nie jest zajęta. Dwa RÓŻNE konta wciąż mogą trafić
    // w to samo okno (blokada jest per konto), dlatego twardą gwarancją jest
    // unikalny indeks na `characters.name` - patrz
    // database/add-character-name-unique.sql i obsługa ER_DUP_ENTRY niżej.
    const [existing] = await connection.query(
      'SELECT id FROM characters WHERE name = ?',
      [trimmedName]
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Postać o takiej nazwie już istnieje.' });
    }

    // Rasa - dane z tabeli `races`, dowolna liczba, zdefiniowana w kreatorze
    // instalacyjnym. Rasa jest wyłącznie fabularna: nie daje żadnych bonusów.
    const [raceRows] = await connection.query(
      'SELECT id FROM races WHERE `key` = ? AND is_active = 1',
      [faction]
    );

    if (raceRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nieznana rasa.' });
    }

    // Inicjalizuj kartę postaci
    const initialCharacterCard = {
      name: trimmedName,
      race: faction,
      gender: gender,
      faction: faction,
      skills: [],
      flaws: [],
      backstory: safeDescription,
      createdAt: new Date().toISOString()
    };

    // Postać NPC nie przechodzi akceptacji administracji - tworzy ją sama
    // administracja z poziomu subkonta NPC, więc jest zatwierdzona od razu.
    const autoApproved = req.user.isNpcAccount ? 1 : 0;

    // Dezaktywuj wszystkie inne postacie
    await connection.query('UPDATE characters SET is_active = 0 WHERE user_id = ?', [userId]);

    const [insertResult] = await connection.query(
      `INSERT INTO characters (
        user_id, name, gender, race, faction, description,
        informacje, approved, is_active, last_played,
        status, avatar, player_status, isProfileApproved, informacja
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        userId,
        trimmedName,
        gender,
        faction,
        faction,
        safeDescription,
        JSON.stringify(initialCharacterCard),
        autoApproved, // approved (NPC: od razu zatwierdzona)
        1, // is_active = true
        '', // status
        '', // avatar
        'not_looking', // player_status
        autoApproved, // isProfileApproved (NPC: od razu zatwierdzona)
        '' // informacja
      ]
    );

    await connection.commit();
    connection.release();

    const characterId = insertResult.insertId;

    // ✅ WYGENERUJ NOWY TOKEN z nową postacią
    const newToken = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role,
        characterId: characterId,
        characterName: trimmedName,
        characterAvatar: '',
        characterRace: faction,
        characterGender: gender,
        characterFaction: faction,
        ...npcTokenClaims(req.user)
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: autoApproved
        ? 'Postać NPC została stworzona.'
        : 'Postać została stworzona pomyślnie! Oczekuje na akceptację administratora.',
      token: newToken, // ✅ NOWY TOKEN
      character: {
        id: characterId,
        name: trimmedName,
        race: faction,
        gender: gender,
        faction: faction,
        approved: Boolean(autoApproved),
        isActive: true,
        userId: userId
      }
    });

  } catch (err) {
    try { await connection.rollback(); } catch (e) { /* połączenie mogło już paść */ }
    connection.release();

    // Kolizja nazwy złapana przez unikalny indeks (dwa konta naraz) - to nie
    // jest błąd serwera, tylko zajęte imię.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Postać o takiej nazwie już istnieje.' });
    }

    console.error('Błąd przy tworzeniu postaci:', err);
    res.status(500).json({ message: 'Błąd serwera podczas tworzenia postaci.' });
  }
});

// ============================================
// POST /api/character/choose-class
// Wybór klasy postaci - JEDNORAZOWY, niezależny od rasy. Dostępne klasy
// pochodzą z tabeli `classes` (dowolna liczba, zdefiniowana w kreatorze
// instalacyjnym). Wybierany w StatsCard po stworzeniu postaci.
// ============================================

router.post('/character/choose-class', verifyToken, (req, res) => {
  const userId = req.user.id;
  const { characterId, characterClass } = req.body;

  if (!characterId || !characterClass) {
    return res.status(400).json({ message: 'Brak wymaganych danych (characterId, characterClass)' });
  }

  pool.query(
    'SELECT id, class FROM characters WHERE id = ? AND user_id = ?',
    [characterId, userId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (results.length === 0) {
        return res.status(403).json({ message: 'To nie Twoja postać!' });
      }

      if (results[0].class) {
        return res.status(400).json({ message: `Klasa została już wybrana (${results[0].class}) i nie można jej zmienić.` });
      }

      pool.query(
        'SELECT `key`, name FROM classes WHERE `key` = ? AND is_active = 1',
        [characterClass],
        (errClass, classRows) => {
          if (errClass) {
            console.error('❌ Błąd pobierania klasy:', errClass);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (classRows.length === 0) {
            return res.status(400).json({ message: 'Nieprawidłowa klasa.' });
          }

          const className = classRows[0].name;

      // ⚠️ Warunek "class IS NULL" w WHERE zabezpiecza przed równoległym
      // podwójnym wyborem klasy (dwa żądania naraz) - tylko pierwsze przejdzie.
      pool.query(
        'UPDATE characters SET class = ? WHERE id = ? AND class IS NULL',
        [characterClass, characterId],
        (errUpdate, updateResult) => {
          if (errUpdate) {
            console.error('❌ Błąd zapisywania klasy:', errUpdate);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (!updateResult.affectedRows) {
            return res.status(400).json({ message: 'Klasa została już wybrana i nie można jej zmienić.' });
          }

          invalidateProfileCache(characterId);

          res.json({
            success: true,
            message: `Wybrano klasę: ${className}!`,
            characterClass
          });
        }
      );
        }
      );
    }
  );
});

// GET /api/characters - ✅ ZOPTYMALIZOWANY
router.get('/characters', verifyToken, (req, res) => {
  // ✅ UŻYJ req.user zamiast zapytania SQL
  const userId = req.user.id;
  // verifyToken ustawia req.user.user (nazwa konta z bazy); req.user.username nie
  // jest tam kopiowane, więc dotąd `player` był undefined i front pokazywał "Gracz".
  const playerName = req.user.user || req.user.username || 'Gracz';

  // LEFT JOIN classes: character.class trzyma KLUCZ klasy, dołączamy jej nazwę
  // (class_name), żeby lobby mogło pokazać klasę obok rasy bez dodatkowego fetcha.
  pool.query(`
    SELECT c.id, c.name, c.race, c.gender, c.faction, c.description, c.approved, c.is_active,
           c.created_at, c.last_played, c.avatar, c.status, c.player_status,
           c.class AS class_key, cl.name AS class_name
    FROM characters c
    LEFT JOIN classes cl ON cl.\`key\` = c.class
    WHERE c.user_id = ? AND (c.is_deleted IS NULL OR c.is_deleted = 0)
    ORDER BY c.is_active DESC, c.last_played DESC, c.created_at DESC
  `, [userId], (err, characters) => {
    if (err) {
      console.error('Błąd przy pobieraniu postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera.' });
    }

    res.json({
      player: playerName,
      // Ile slotów ma to konto - lobby rysuje na tej podstawie karuzelę
      // (admin ma ich więcej niż zwykły gracz).
      maxCharacters: getMaxCharacters(req.user.role, req.user.isNpcAccount),
      // Lobby rysuje inny nagłówek dla wspólnego subkonta NPC administracji.
      isNpcAccount: Boolean(req.user.isNpcAccount),
      characters: characters.map(char => ({
        id: char.id,
        name: char.name,
        race: char.race,
        gender: char.gender,
        faction: char.faction,
        classKey: char.class_key || null,
        className: char.class_name || null,
        description: char.description,
        approved: Boolean(char.approved),
        isActive: Boolean(char.is_active),
        createdAt: char.created_at,
        lastPlayed: char.last_played,
        avatar: char.avatar,
        status: char.status,
        player_status: char.player_status || 'not_looking'
      }))
    });
  });
});

// GET /api/characters/:id
//
// ⚠️ Trasa zwracała CAŁY wiersz postaci (`SELECT *`) każdemu zalogowanemu -
// razem z polami, które są prywatną sprawą gracza (notatki administracji,
// znaczniki akceptacji). Wystarczyła pętla po `id` od 1 w górę, żeby zebrać
// wszystko o wszystkich.
//
// Trasa musi zostać otwarta, bo front używa jej do wyszukiwania postaci PO ID
// przy zapraszaniu do sesji i wiadomości - ale do tego potrzebuje wyłącznie
// imienia i awatara. Właściciel dostaje pełny wiersz jak dotąd, obcy - kartę
// wizytówkę.
const PUBLIC_CHARACTER_FIELDS = [
  'id', 'name', 'avatar', 'race', 'faction', 'gender', 'epithet', 'narrative_role'
];

router.get('/characters/:id', verifyToken, (req, res) => {
  const characterId = parseInt(req.params.id, 10);

  if (!Number.isFinite(characterId)) {
    return res.status(400).json({ error: 'Nieprawidłowe ID postaci' });
  }

  pool.query(
    'SELECT * FROM characters WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)',
    [characterId],
    (err, results) => {
      if (err) {
        console.error('Błąd pobierania postaci:', err);
        return res.status(500).json({ error: 'Błąd serwera' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Postać nie znaleziona' });
      }

      const character = results[0];

      // Własna postać - pełne dane (tak jak dotąd, front tego używa w HUD-zie).
      if (character.user_id === req.user.id) {
        return res.json({ character });
      }

      // Cudza postać - tylko dane publiczne.
      const publicCharacter = {};
      for (const field of PUBLIC_CHARACTER_FIELDS) {
        if (field in character) publicCharacter[field] = character[field];
      }
      res.json({ character: publicCharacter });
    }
  );
});

// POST /api/selectCharacter - ✅ ZWRACA NOWY TOKEN
router.post('/selectCharacter', verifyToken, (req, res) => {
  const { characterId } = req.body;

  if (!characterId) {
    return res.status(400).json({ message: 'ID postaci jest wymagane.' });
  }

  // ✅ UŻYJ req.user.id zamiast szukania po email
  const userId = req.user.id;

  // Pobierz pełne dane postaci (wraz z player_status)
  pool.query(`
    SELECT id, name, avatar, race, gender, faction, approved, player_status
    FROM characters
    WHERE id = ? AND user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
  `, [characterId, userId], (err, charResults) => {
    if (err) {
      return res.status(500).json({ message: 'Błąd serwera.' });
    }

    if (charResults.length === 0) {
      return res.status(404).json({ message: 'Postać nie znaleziona lub została usunięta.' });
    }

    const character = charResults[0];

    // Dezaktywuj wszystkie postacie gracza
    pool.query('UPDATE characters SET is_active = 0 WHERE user_id = ?', [userId], (err) => {
      if (err) {
        return res.status(500).json({ message: 'Błąd serwera.' });
      }

      // Aktywuj wybraną postać
      pool.query('UPDATE characters SET is_active = 1, last_played = NOW() WHERE id = ?',
        [characterId], (err) => {
        if (err) {
          return res.status(500).json({ message: 'Błąd serwera.' });
        }

        console.log(`✅ Postać ID=${characterId} aktywowana`);

        // ✅ POBIERZ AKTUALNĄ ROLĘ Z BAZY przed utworzeniem tokena
        pool.query('SELECT role FROM users WHERE id = ?', [userId], (err, userResults) => {
          if (err) {
            return res.status(500).json({ message: 'Błąd serwera.' });
          }

          const userRole = userResults[0]?.role || 'mieszkaniec';

          // ✅ WYGENERUJ NOWY TOKEN z danymi wybranej postaci i AKTUALNĄ ROLĄ z bazy
          const newToken = jwt.sign(
            {
              id: req.user.id,
              email: req.user.email,
              username: req.user.username,
              role: userRole,  // ✅ ROLA Z BAZY, NIE Z TOKENA
              characterId: character.id,
              characterName: character.name,
              characterAvatar: character.avatar,
              characterRace: character.race,
              characterGender: character.gender,
              characterFaction: character.faction,
              // Wybór postaci nie może gubić trybu NPC - inaczej admin, który
              // wcielił się w NPC-a, nie miałby jak wrócić na swoje konto.
              ...npcTokenClaims(req.user)
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );

          res.json({
            message: `Postać "${character.name}" została wybrana jako aktywna.`,
            token: newToken, // ✅ NOWY TOKEN!
            character: {
              id: character.id,
              name: character.name,
              avatar: character.avatar,
              race: character.race,
              gender: character.gender,
              faction: character.faction,
              approved: character.approved,
              player_status: character.player_status || 'not_looking' // ✅ DODANO player_status
            },
            // ✅ BACKWARD COMPATIBILITY (dla starszego kodu)
            characterName: character.name,
            characterId: character.id,
            approved: character.approved
          });
        });
      });
    });
  });
});

// GET /api/checkCharacter - ✅ ZOPTYMALIZOWANY
router.get('/checkCharacter', verifyToken, (req, res) => {
  // ✅ UŻYJ req.user.id zamiast szukania po email
  const userId = req.user.id;
  
  pool.query(`
    SELECT name, gender, race, faction 
    FROM characters 
    WHERE user_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
  `, [userId], (err, results) => {
    if (err) {
      console.error('Błąd sprawdzania postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (results.length === 0) {
      return res.status(200).json({ hasCharacter: false });
    }

    const character = results[0];
    const hasCharacter = Boolean(character.name && character.gender && character.race);

    return res.status(200).json({ 
      hasCharacter,
      ...(hasCharacter && {
        characterData: {
          name: character.name,
          gender: character.gender,
          race: character.race,
          faction: character.faction || null
        }
      })
    });
  });
});

module.exports = router;