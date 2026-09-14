// ================================
// routes/lobby.js
// Koniec historii postaci: RESET (postać odchodzi ze sceny) i USUNIĘCIE.
//
// Oba działają tak samo mechanicznie - i to jest cała mechanika, jaka tu
// została: postać dostaje wpis na CMENTARZU (archiwum `dead_characters`)
// i znika z lobby (soft delete, `is_deleted = 1`).
//
// Dlaczego soft delete: do postaci przypięte są posty w sesjach, wiadomości
// i wpisy w kartotece. Twarde DELETE zabrałoby cudze wątki fabularne razem
// z nią, a cmentarz ma być pamięcią gry, nie luką w archiwum.
//
// Różnica między resetem a usunięciem jest wyłącznie fabularna i widać ją na
// cmentarzu (`deletion_type`): reset to postać, której historia się dopełniła,
// usunięcie to wycofanie postaci przez gracza.
// ================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { invalidateProfileCache } = require('./profile');
const { npcTokenClaims } = require('../utils/npcAccount');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Buduje świeży JWT dla użytkownika z danymi aktywnej postaci (lub bez postaci,
// gdy character = null). Ten sam kształt co token z /selectCharacter, żeby front
// po pożegnaniu aktywnej postaci nie trzymał nieaktualnych danych w tokenie.
function signUserToken(reqUser, role, character) {
  return jwt.sign(
    {
      id: reqUser.id,
      email: reqUser.email,
      username: reqUser.username,
      role: role || reqUser.role || 'mieszkaniec',
      characterId: character ? character.id : null,
      characterName: character ? character.name : null,
      characterAvatar: character ? character.avatar : null,
      characterRace: character ? character.race : null,
      characterGender: character ? character.gender : null,
      characterFaction: character ? character.faction : null,
      // Pożegnanie postaci na subkoncie NPC nie może wyrzucić admina z trybu
      // NPC - znaczniki wędrują do nowego tokena.
      ...npcTokenClaims(reqUser)
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Zapis do archiwum trzyma wyłącznie dane FABULARNE - tyle, żeby dało się
// przeczytać na cmentarzu, kim ta postać była.
function buildSnapshot(character) {
  return {
    name: character.name,
    race: character.race,
    faction: character.faction,
    gender: character.gender,
    avatar: character.avatar,
    description: character.description,
    epithet: character.epithet,
    narrative_role: character.narrative_role,
    // `informacje` to karta postaci (KP) w JSON-ie - zapisujemy ją jako tekst,
    // dokładnie w tej postaci, w jakiej stała w kolumnie.
    character_card: character.informacje,
    created_at: character.created_at
  };
}

// Wspólna droga dla resetu i usunięcia: sprawdź hasło, zarchiwizuj, wygaś postać.
//
// `deletionType` ('reset' | 'deleted') idzie wprost do archiwum i jest jedyną
// rzeczą, którą te dwie ścieżki się różnią.
function retireCharacter({ req, res, deletionType, defaultDeathReason }) {
  const { characterId, password, deathReason } = req.body;
  const userId = req.user.id;

  if (!characterId) {
    return res.status(400).json({ message: 'ID postaci jest wymagane' });
  }
  if (!password) {
    return res.status(400).json({ message: 'Hasło jest wymagane' });
  }

  const reason = typeof deathReason === 'string' && deathReason.trim()
    ? deathReason.trim().slice(0, 255)
    : defaultDeathReason;

  pool.query('SELECT password, role FROM users WHERE id = ?', [userId], (err, userResults) => {
    if (err) {
      console.error('❌ Błąd pobierania użytkownika:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!userResults.length) {
      return res.status(404).json({ message: 'Użytkownik nie istnieje' });
    }

    const { password: hashedPassword, role } = userResults[0];

    bcrypt.compare(password, hashedPassword, (err, isMatch) => {
      if (err) {
        console.error('❌ Błąd porównywania hasła:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (!isMatch) {
        return res.status(401).json({ message: 'Nieprawidłowe hasło' });
      }

      pool.query(
        `SELECT id, name, race, faction, gender, avatar, description, epithet,
                narrative_role, informacje, created_at, is_active
           FROM characters
          WHERE id = ? AND user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)`,
        [characterId, userId],
        (err, charResults) => {
          if (err) {
            console.error('❌ Błąd pobierania postaci:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }
          if (!charResults.length) {
            return res.status(404).json({ message: 'Postać nie znaleziona lub już pożegnana' });
          }

          const character = charResults[0];
          const wasActive = character.is_active === 1 || character.is_active === true;

          // Archiwum i wygaszenie postaci muszą pójść razem: postać bez wpisu
          // na cmentarzu znika bez śladu, a wpis bez wygaszenia zostawia
          // "martwą" postać w lobby.
          pool.getConnection((err, connection) => {
            if (err) {
              console.error('❌ Błąd połączenia:', err);
              return res.status(500).json({ message: 'Błąd serwera' });
            }

            const fail = (message, error) => {
              connection.rollback(() => {
                connection.release();
                if (error) console.error(`❌ ${message}:`, error);
                res.status(500).json({ message });
              });
            };

            connection.beginTransaction((err) => {
              if (err) {
                connection.release();
                return res.status(500).json({ message: 'Błąd transakcji' });
              }

              connection.query(
                `INSERT INTO dead_characters
                   (original_character_id, user_id, original_name, gender, faction,
                    character_snapshot, deletion_type, death_reason, deleted_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  characterId,
                  userId,
                  character.name,
                  character.gender,
                  character.faction,
                  JSON.stringify(buildSnapshot(character)),
                  deletionType,
                  reason,
                  userId
                ],
                (err) => {
                  if (err) return fail('Błąd archiwizacji postaci', err);

                  connection.query(
                    `UPDATE characters
                        SET is_deleted = 1,
                            is_active = 0,
                            deleted_at = NOW()
                      WHERE id = ? AND user_id = ?`,
                    [characterId, userId],
                    (err, result) => {
                      if (err) return fail('Błąd wygaszania postaci', err);
                      if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                          connection.release();
                          res.status(404).json({ message: 'Postać nie została pożegnana' });
                        });
                      }

                      connection.commit((err) => {
                        if (err) return fail('Błąd finalizacji', err);

                        connection.release();
                        invalidateProfileCache(characterId);

                        res.json({
                          message: deletionType === 'reset'
                            ? `Historia postaci "${character.name}" dobiegła końca. Postać spoczęła na cmentarzu.`
                            : `Postać "${character.name}" została usunięta i trafiła na cmentarz.`,
                          characterName: character.name,
                          deletionType,
                          deathReason: reason,
                          activeCharacterDeleted: wasActive,
                          // Token wskazywałby pożegnaną postać - front ma przejść
                          // w stan "brak aktywnej postaci" bez przelogowania.
                          token: wasActive ? signUserToken(req.user, role, null) : undefined
                        });
                      });
                    }
                  );
                }
              );
            });
          });
        }
      );
    });
  });
}

// ================================
// POST /lobby/reset - fabularne zamknięcie historii postaci (→ cmentarz)
// ================================
router.post('/lobby/reset', verifyToken, (req, res) => {
  retireCharacter({
    req,
    res,
    deletionType: 'reset',
    defaultDeathReason: 'Historia postaci dobiegła końca'
  });
});

// ================================
// POST /lobby/delete - usunięcie postaci przez gracza (→ cmentarz)
// ================================
router.post('/lobby/delete', verifyToken, (req, res) => {
  retireCharacter({
    req,
    res,
    deletionType: 'deleted',
    defaultDeathReason: 'Usunięta przez gracza'
  });
});

// ================================
// GET /lobby/dead - pożegnane postacie tego konta
// ================================
router.get('/lobby/dead', verifyToken, (req, res) => {
  pool.query(
    `SELECT id, original_character_id, original_name, character_snapshot,
            deletion_type, death_reason, deleted_at
       FROM dead_characters
      WHERE user_id = ?
      ORDER BY deleted_at DESC`,
    [req.user.id],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania pożegnanych postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      res.json({
        deadCharacters: results.map((row) => ({
          id: row.id,
          originalId: row.original_character_id,
          name: row.original_name,
          snapshot: parseSnapshot(row.character_snapshot),
          deletionType: row.deletion_type,
          deathReason: row.death_reason,
          deletedAt: row.deleted_at
        }))
      });
    }
  );
});

// Snapshot jest zapisywany przez tę samą trasę, ale wpisy z czasem mogą mieć
// różny kształt - uszkodzony JSON nie ma prawa wywrócić całego cmentarza.
function parseSnapshot(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// ================================
// GET /dead-characters - CMENTARZ
// Admin widzi wszystkie wpisy, gracz tylko swoje.
// ================================
router.get('/dead-characters', verifyToken, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const params = isAdmin ? [] : [req.user.id];

  pool.query(
    `SELECT dc.id, dc.original_character_id, dc.original_name, dc.gender, dc.faction,
            dc.deletion_type, dc.death_reason, dc.deleted_at, u.user AS player_name
       FROM dead_characters dc
       LEFT JOIN users u ON dc.user_id = u.id
      ${isAdmin ? '' : 'WHERE dc.user_id = ?'}
      ORDER BY dc.deleted_at DESC`,
    params,
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania cmentarza:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      res.json({
        characters: results.map((row) => ({
          id: row.id,
          originalId: row.original_character_id,
          name: row.original_name,
          gender: row.gender,
          faction: row.faction,
          deletionType: row.deletion_type,
          deathReason: row.death_reason || 'Brak informacji',
          deletedAt: row.deleted_at,
          playerName: row.player_name
        }))
      });
    }
  );
});

// ================================
// PATCH /dead-characters/:id/death-reason - epitafium (tylko admin)
// ================================
router.patch('/dead-characters/:id/death-reason', verifyToken, (req, res) => {
  const entryId = parseInt(req.params.id, 10);
  const { deathReason } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Brak uprawnień. Tylko administrator może edytować przyczynę śmierci.' });
  }
  if (Number.isNaN(entryId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID wpisu' });
  }
  if (!deathReason || !deathReason.trim()) {
    return res.status(400).json({ message: 'Przyczyna śmierci nie może być pusta' });
  }

  pool.query(
    'UPDATE dead_characters SET death_reason = ? WHERE id = ?',
    [deathReason.trim().slice(0, 255), entryId],
    (err, result) => {
      if (err) {
        console.error('❌ Błąd aktualizacji przyczyny śmierci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Wpis nie znaleziony w archiwum' });
      }

      res.json({
        message: 'Przyczyna śmierci została zaktualizowana',
        deathReason: deathReason.trim()
      });
    }
  );
});

module.exports = router;
