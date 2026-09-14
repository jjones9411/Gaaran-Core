// backend/routes/reports.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { resolveCharacterId } = require('../utils/activeCharacter');
const logsModule = require('./logs');

// ============================================
// ENDPOINTY DLA GRACZA
// ============================================

// Pobierz sesje do których należy aktywna postać
router.get('/my-sessions', verifyToken, (req, res) => {
  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(400).json({ message: 'Brak aktywnej postaci' });
      }

      // Pobierz sesje prywatne (wykluczając już zgłoszone)
      pool.query(
        `SELECT ps.id, ps.title, 'private' as session_type
         FROM private_sessions ps
         INNER JOIN private_session_participants psp ON ps.id = psp.session_id
         WHERE psp.character_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM session_reports sr 
           WHERE sr.character_id = ? 
           AND sr.session_id = ps.id 
           AND sr.session_type = 'private'
         )`,
        [characterId, characterId],
        (err, privateSessions) => {
          if (err) {
            console.error('Błąd pobierania sesji prywatnych:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          // Pobierz sesje ogólne (wykluczając już zgłoszone)
          pool.query(
            `SELECT gs.id, gs.title, 'general' as session_type
             FROM general_sessions gs
             INNER JOIN general_session_participants gsp ON gs.id = gsp.session_id
             WHERE gsp.character_id = ?
             AND NOT EXISTS (
               SELECT 1 FROM session_reports sr 
               WHERE sr.character_id = ? 
               AND sr.session_id = gs.id 
               AND sr.session_type = 'general'
             )`,
            [characterId, characterId],
            (err, generalSessions) => {
              if (err) {
                console.error('Błąd pobierania sesji ogólnych:', err);
                return res.status(500).json({ message: 'Błąd serwera' });
              }

              const allSessions = [...privateSessions, ...generalSessions];
              res.json({ sessions: allSessions });
            }
          );
        }
      );
    }
  );
});

// Stwórz nowe zgłoszenie
router.post('/', verifyToken, (req, res) => {
  const {
    session_id,
    session_type,
    description,
    world_consequences,
    character_consequences,
    advantages_disadvantages
  } = req.body;

  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(400).json({ message: 'Brak aktywnej postaci' });
      }

      if (!session_id || !session_type || !description) {
        return res.status(400).json({ message: 'Brak wymaganych pól' });
      }

      // Sprawdź czy raport już istnieje
      pool.query(
        'SELECT id FROM session_reports WHERE character_id = ? AND session_id = ? AND session_type = ?',
        [characterId, session_id, session_type],
        (err, existingReports) => {
          if (err) {
            console.error('Błąd sprawdzania istniejącego raportu:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (existingReports.length > 0) {
            return res.status(400).json({
              message: 'Zgłoszenie do tej sesji już istnieje. Nie można utworzyć duplikatu.'
            });
          }

          // Weryfikacja czy postać należy do sesji
          const checkQuery = session_type === 'private'
            ? 'SELECT 1 FROM private_session_participants WHERE session_id = ? AND character_id = ?'
            : 'SELECT 1 FROM general_session_participants WHERE session_id = ? AND character_id = ?';

          pool.query(checkQuery, [session_id, characterId], (err, checkResults) => {
            if (err) {
              console.error('Błąd weryfikacji uczestnictwa:', err);
              return res.status(500).json({ message: 'Błąd serwera' });
            }

            if (checkResults.length === 0) {
              return res.status(403).json({ message: 'Nie należysz do tej sesji' });
            }

            // Wstaw zgłoszenie
            pool.query(
              `INSERT INTO session_reports
               (character_id, session_id, session_type, description, world_consequences,
                character_consequences, advantages_disadvantages)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                characterId,
                session_id,
                session_type,
                description,
                world_consequences || null,
                character_consequences || null,
                advantages_disadvantages || null
              ],
              (err, result) => {
                if (err) {
                  console.error('Błąd tworzenia zgłoszenia:', err);
                  return res.status(500).json({ message: 'Błąd serwera' });
                }

                // Pobierz nazwę sesji i nazwę postaci
                const sessionQuery = session_type === 'private'
                  ? 'SELECT title FROM private_sessions WHERE id = ?'
                  : 'SELECT title FROM general_sessions WHERE id = ?';

                pool.query(sessionQuery, [session_id], (errSession, sessionResults) => {
                  const sessionName = sessionResults && sessionResults.length > 0
                    ? sessionResults[0].title
                    : `Sesja ID: ${session_id}`;

                  pool.query('SELECT name FROM characters WHERE id = ?', [characterId], (errChar, charResults) => {
                    const characterName = charResults && charResults.length > 0
                      ? charResults[0].name
                      : 'Gracz';

                    // Pobierz wszystkich uczestników sesji (oprócz autora)
                    const participantsQuery = session_type === 'private'
                      ? 'SELECT character_id FROM private_session_participants WHERE session_id = ? AND character_id != ?'
                      : 'SELECT character_id FROM general_session_participants WHERE session_id = ? AND character_id != ?';

                    pool.query(participantsQuery, [session_id, characterId], (errPart, participants) => {
                      if (!errPart && participants && participants.length > 0 && logsModule && logsModule.addLog) {
                        // Wyślij powiadomienie do wszystkich uczestników
                        participants.forEach(participant => {
                          const message = `📝 ${characterName} przesłał raport dla sesji "${sessionName}" (${session_type === 'private' ? 'prywatna' : 'ogólna'})`;
                          logsModule.addLog(participant.character_id, 'report_submitted', message, session_id);
                        });
                      }

                      res.status(201).json({
                        message: 'Zgłoszenie zostało utworzone',
                        reportId: result.insertId
                      });
                    });
                  });
                });
              }
            );
          });
        }
      );
    }
  );
});

// Pobierz moje zgłoszenia (aktywnej postaci)
router.get('/my', verifyToken, (req, res) => {
  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(400).json({ message: 'Brak aktywnej postaci' });
      }

      pool.query(
        `SELECT 
          sr.id,
          sr.session_id,
          sr.session_type,
          sr.description,
          sr.world_consequences,
          sr.character_consequences,
          sr.advantages_disadvantages,
          sr.status,
          sr.admin_comment,
          sr.created_at,
          sr.reviewed_at,
          CASE 
            WHEN sr.session_type = 'private' THEN ps.title
            WHEN sr.session_type = 'general' THEN gs.title
          END as session_name
         FROM session_reports sr
         LEFT JOIN private_sessions ps ON sr.session_type = 'private' AND sr.session_id = ps.id
         LEFT JOIN general_sessions gs ON sr.session_type = 'general' AND sr.session_id = gs.id
         WHERE sr.character_id = ?
         ORDER BY sr.created_at DESC`,
        [characterId],
        (err, reports) => {
          if (err) {
            console.error('Błąd pobierania zgłoszeń:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          res.json({ reports });
        }
      );
    }
  );
});

// Pobierz szczegóły konkretnego zgłoszenia (własnego)
router.get('/:id', verifyToken, (req, res) => {
  const reportId = req.params.id;

  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(400).json({ message: 'Brak aktywnej postaci' });
      }

      pool.query(
        `SELECT 
          sr.*,
          CASE 
            WHEN sr.session_type = 'private' THEN ps.title
            WHEN sr.session_type = 'general' THEN gs.title
          END as session_name
         FROM session_reports sr
         LEFT JOIN private_sessions ps ON sr.session_type = 'private' AND sr.session_id = ps.id
         LEFT JOIN general_sessions gs ON sr.session_type = 'general' AND sr.session_id = gs.id
         WHERE sr.id = ? AND sr.character_id = ?`,
        [reportId, characterId],
        (err, reports) => {
          if (err) {
            console.error('Błąd pobierania zgłoszenia:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (reports.length === 0) {
            return res.status(404).json({ message: 'Zgłoszenie nie znalezione' });
          }

          res.json({ report: reports[0] });
        }
      );
    }
  );
});

// ============================================
// ENDPOINTY DLA ADMINA
// ============================================

// Pobierz wszystkie zgłoszenia pogrupowane po postaciach
router.get('/admin/all', verifyToken, (req, res) => {
  const userRole = req.user.role;

  if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }

  pool.query(
    `SELECT
      sr.id,
      sr.character_id,
      sr.session_id,
      sr.session_type,
      sr.description,
      sr.world_consequences,
      sr.character_consequences,
      sr.advantages_disadvantages,
      sr.positive_consequences,
      sr.negative_consequences,
      sr.positive_level,
      sr.negative_level,
      sr.status,
      sr.admin_comment,
      sr.created_at,
      sr.reviewed_at,
      sr.reviewed_by,
      c.name as character_name,
      c.faction,
      u.user as player_username,
      CASE
        WHEN sr.session_type = 'private' THEN ps.title
        WHEN sr.session_type = 'general' THEN gs.title
      END as session_name,
      reviewer.user as reviewer_username
     FROM session_reports sr
     INNER JOIN characters c ON sr.character_id = c.id
     INNER JOIN users u ON c.user_id = u.id
     LEFT JOIN private_sessions ps ON sr.session_type = 'private' AND sr.session_id = ps.id
     LEFT JOIN general_sessions gs ON sr.session_type = 'general' AND sr.session_id = gs.id
     LEFT JOIN users reviewer ON sr.reviewed_by = reviewer.id
     ORDER BY c.name ASC, sr.created_at DESC`,
    [],
    (err, reports) => {
      if (err) {
        console.error('Błąd pobierania zgłoszeń dla admina:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Grupuj po postaciach
      const groupedReports = reports.reduce((acc, report) => {
        const charKey = report.character_id;
        if (!acc[charKey]) {
          acc[charKey] = {
            character_id: report.character_id,
            character_name: report.character_name,
            faction: report.faction,
            player_username: report.player_username,
            reports: []
          };
        }
        acc[charKey].reports.push(report);
        return acc;
      }, {});

      res.json({ characters: Object.values(groupedReports) });
    }
  );
});

// Pobierz szczegóły zgłoszenia (admin)
router.get('/admin/:id', verifyToken, (req, res) => {
  const userRole = req.user.role;
  const reportId = req.params.id;

  if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }

  pool.query(
    `SELECT 
      sr.*,
      c.name as character_name,
      c.faction,
      u.user as player_username,
      CASE 
        WHEN sr.session_type = 'private' THEN ps.title
        WHEN sr.session_type = 'general' THEN gs.title
      END as session_name,
      reviewer.user as reviewer_username
     FROM session_reports sr
     INNER JOIN characters c ON sr.character_id = c.id
     INNER JOIN users u ON c.user_id = u.id
     LEFT JOIN private_sessions ps ON sr.session_type = 'private' AND sr.session_id = ps.id
     LEFT JOIN general_sessions gs ON sr.session_type = 'general' AND sr.session_id = gs.id
     LEFT JOIN users reviewer ON sr.reviewed_by = reviewer.id
     WHERE sr.id = ?`,
    [reportId],
    (err, reports) => {
      if (err) {
        console.error('Błąd pobierania zgłoszenia:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (reports.length === 0) {
        return res.status(404).json({ message: 'Zgłoszenie nie znalezione' });
      }

      res.json({ report: reports[0] });
    }
  );
});

// Zaakceptuj zgłoszenie
router.put('/admin/:id/accept', verifyToken, (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;
  const reportId = req.params.id;
  const { positive_consequences, negative_consequences, positive_level, negative_level } = req.body;

  if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }

  // Poziom zalety/wady 1-5 (null = nie podano)
  const parseLevel = (raw) => {
    const lvl = parseInt(raw, 10);
    return Number.isInteger(lvl) && lvl >= 1 && lvl <= 5 ? lvl : null;
  };

  // Najpierw pobierz informacje o zgłoszeniu
  pool.query(
    `SELECT sr.character_id, sr.session_type, sr.session_id,
            sr.positive_consequences, sr.negative_consequences,
            sr.positive_level, sr.negative_level,
            CASE
              WHEN sr.session_type = 'private' THEN ps.title
              WHEN sr.session_type = 'general' THEN gs.title
            END as session_name
     FROM session_reports sr
     LEFT JOIN private_sessions ps ON sr.session_type = 'private' AND sr.session_id = ps.id
     LEFT JOIN general_sessions gs ON sr.session_type = 'general' AND sr.session_id = gs.id
     WHERE sr.id = ?`,
    [reportId],
    (errGet, reportData) => {
      if (errGet || reportData.length === 0) {
        console.error('Błąd pobierania zgłoszenia:', errGet);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const report = reportData[0];
      // Użyj wartości z requesta jeśli podane, otherwise użyj zapisanych w raporcie
      const finalPositive = positive_consequences !== undefined ? positive_consequences : report.positive_consequences;
      const finalNegative = negative_consequences !== undefined ? negative_consequences : report.negative_consequences;
      const finalPositiveLevel = positive_level !== undefined ? parseLevel(positive_level) : parseLevel(report.positive_level);
      const finalNegativeLevel = negative_level !== undefined ? parseLevel(negative_level) : parseLevel(report.negative_level);

      pool.query(
        `UPDATE session_reports
         SET status = 'accepted', reviewed_by = ?, reviewed_at = NOW(),
             positive_consequences = ?, negative_consequences = ?,
             positive_level = ?, negative_level = ?
         WHERE id = ?`,
        [userId, finalPositive || null, finalNegative || null, finalPositiveLevel, finalNegativeLevel, reportId],
        (err, result) => {
          if (err) {
            console.error('Błąd akceptacji zgłoszenia:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          // Dodaj log o akceptacji
          if (logsModule && logsModule.addReportAcceptedLog) {
            logsModule.addReportAcceptedLog(report.character_id, report.session_name, report.session_type, report.session_id);
          }

          // Po akceptacji zalety/wady z podsumowania sesji trafiają do karty postaci gracza
          const today = new Date().toISOString().split('T')[0];

          const afterAchievements = () => {
            if (finalNegative && finalNegative.trim()) {
              pool.query(
                // is_approved = 1: konsekwencja z sesji jest decyzją administracji,
                // a nie wpisem gracza do zatwierdzenia. Bez tego wisiała na KP jako
                // "oczekuje na akceptację" (kolumna ma DEFAULT 0), nie pokazywała się
                // w kolejce akceptacji kart (panel bierze tylko wpisy właściciela)
                // i blokowała akceptację KP na zawsze.
                `INSERT INTO character_problems (character_id, title, description, level, created_by, start_date, is_approved)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
                [report.character_id, `Wada z sesji: ${report.session_name}`, finalNegative.trim(), finalNegativeLevel, userId, today],
                (err) => {
                  if (err) console.error('Błąd dodawania wady z raportu:', err);
                  res.json({ message: 'Zgłoszenie zaakceptowane' });
                }
              );
            } else {
              res.json({ message: 'Zgłoszenie zaakceptowane' });
            }
          };

          if (finalPositive && finalPositive.trim()) {
            pool.query(
              // is_approved = 1 - patrz komentarz przy wadzie z sesji wyżej
              `INSERT INTO character_achievements (character_id, title, description, level, created_by, start_date, is_approved)
               VALUES (?, ?, ?, ?, ?, ?, 1)`,
              [report.character_id, `Zaleta z sesji: ${report.session_name}`, finalPositive.trim(), finalPositiveLevel, userId, today],
              (err) => {
                if (err) console.error('Błąd dodawania zalety z raportu:', err);
                afterAchievements();
              }
            );
          } else {
            afterAchievements();
          }
        }
      );
    }
  );
});

// Odrzuć zgłoszenie z komentarzem
router.put('/admin/:id/reject', verifyToken, (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;
  const reportId = req.params.id;
  const { admin_comment } = req.body;

  if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }

  if (!admin_comment) {
    return res.status(400).json({ message: 'Komentarz jest wymagany przy odrzuceniu' });
  }

  // Najpierw pobierz informacje o zgłoszeniu
  pool.query(
    `SELECT sr.character_id, sr.session_type, sr.session_id,
            CASE
              WHEN sr.session_type = 'private' THEN ps.title
              WHEN sr.session_type = 'general' THEN gs.title
            END as session_name
     FROM session_reports sr
     LEFT JOIN private_sessions ps ON sr.session_type = 'private' AND sr.session_id = ps.id
     LEFT JOIN general_sessions gs ON sr.session_type = 'general' AND sr.session_id = gs.id
     WHERE sr.id = ?`,
    [reportId],
    (errGet, reportData) => {
      if (errGet || reportData.length === 0) {
        console.error('Błąd pobierania zgłoszenia:', errGet);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      const report = reportData[0];

      pool.query(
        `UPDATE session_reports
         SET status = 'rejected', admin_comment = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [admin_comment, userId, reportId],
        (err, result) => {
          if (err) {
            console.error('Błąd odrzucenia zgłoszenia:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          // Dodaj log o odrzuceniu
          if (logsModule && logsModule.addReportRejectedLog) {
            logsModule.addReportRejectedLog(report.character_id, report.session_name, report.session_type, admin_comment, report.session_id);
          }

          res.json({ message: 'Zgłoszenie odrzucone' });
        }
      );
    }
  );
});

// Dodaj/edytuj komentarz admina
router.put('/admin/:id/comment', verifyToken, (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;
  const reportId = req.params.id;
  const { admin_comment } = req.body;

  if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
    return res.status(403).json({ message: 'Brak uprawnień' });
  }

  pool.query(
    `UPDATE session_reports 
     SET admin_comment = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [admin_comment || null, userId, reportId],
    (err, result) => {
      if (err) {
        console.error('Błąd aktualizacji komentarza:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      res.json({ message: 'Komentarz został zaktualizowany' });
    }
  );
});

// Endpoint do edycji zgłoszenia
router.put('/:reportId', verifyToken, (req, res) => {
  const { reportId } = req.params;
  const {
    description,
    world_consequences,
    character_consequences,
    advantages_disadvantages
  } = req.body;

  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(
    req,
    (err, characterId) => {
      if (err) {
        console.error('Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(400).json({ message: 'Brak aktywnej postaci' });
      }

      // Sprawdź czy zgłoszenie należy do postaci i ma status 'rejected'
      pool.query(
        'SELECT * FROM session_reports WHERE id = ? AND character_id = ?',
        [reportId, characterId],
        (err, reports) => {
          if (err) {
            console.error('Błąd pobierania zgłoszenia:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (reports.length === 0) {
            return res.status(404).json({ message: 'Zgłoszenie nie znalezione' });
          }

          if (reports[0].status !== 'rejected') {
            return res.status(403).json({ message: 'Można edytować tylko odrzucone zgłoszenia' });
          }

          // Aktualizuj zgłoszenie i zmień status z powrotem na 'pending'
          pool.query(
            `UPDATE session_reports 
             SET description = ?, 
                 world_consequences = ?, 
                 character_consequences = ?, 
                 advantages_disadvantages = ?,
                 status = 'pending',
                 admin_comment = NULL,
                 reviewed_at = NULL,
                 reviewed_by = NULL
             WHERE id = ?`,
            [description, world_consequences, character_consequences, advantages_disadvantages, reportId],
            (err, result) => {
              if (err) {
                console.error('Błąd aktualizacji zgłoszenia:', err);
                return res.status(500).json({ message: 'Błąd serwera' });
              }

              res.json({ message: 'Zgłoszenie zaktualizowane i wysłane ponownie' });
            }
          );
        }
      );
    }
  );
});

module.exports = router;