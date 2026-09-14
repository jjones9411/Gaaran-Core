// ================================
// routes/logs.js
// System logów dla postaci
// ================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database'); // ZMIANA: Bezpośredni import pool
const { resolveCharacterId } = require('../utils/activeCharacter');

function initialize(dependencies) {
  // Funkcja pozostaje dla kompatybilności wstecznej
  // ale pool jest już zaimportowany bezpośrednio
}

// ================================
// GET /api/home/logs/unread
// Sprawdza czy są nowe logi dla postaci
// ================================
router.get('/home/logs/unread', (req, res) => {
  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(req, (err, characterId) => {
      if (err) {
        console.error('❌ Błąd pobierania aktywnej postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.json({ hasUnread: false });
      }

      // Pobierz ostatnio widziany log_id dla tej postaci
      pool.query(
        'SELECT last_seen_log_id FROM character_logs_seen WHERE character_id = ?',
        [characterId],
        (seenErr, seenResults) => {
          if (seenErr) {
            console.error('❌ Błąd pobierania last_seen_log_id:', seenErr);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          const lastSeenLogId = seenResults.length > 0 ? seenResults[0].last_seen_log_id : 0;

          // Sprawdź czy są nowe logi (logi z id większym niż last_seen_log_id)
          pool.query(
            'SELECT COUNT(*) as count FROM character_logs WHERE character_id = ? AND id > ?',
            [characterId, lastSeenLogId || 0],
            (countErr, countResults) => {
              if (countErr) {
                console.error('❌ Błąd sprawdzania nowych logów:', countErr);
                return res.status(500).json({ message: 'Błąd serwera' });
              }

              const hasUnread = countResults[0].count > 0;
              res.json({ hasUnread });
            }
          );
        }
      );
    }
  );
});

// ================================
// POST /api/home/logs/mark-seen
// Oznacza logi jako przeczytane
// ================================
router.post('/home/logs/mark-seen', (req, res) => {
  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(req, (err, characterId) => {
      if (err) {
        console.error('❌ Błąd pobierania aktywnej postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterId) {
        return res.status(404).json({ message: 'Nie znaleziono postaci' });
      }

      // Pobierz ID najnowszego logu dla tej postaci
      pool.query(
        'SELECT MAX(id) as max_id FROM character_logs WHERE character_id = ?',
        [characterId],
        (maxErr, maxResults) => {
          if (maxErr) {
            console.error('❌ Błąd pobierania max log_id:', maxErr);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          const maxLogId = maxResults[0].max_id;

          if (!maxLogId) {
            // Brak logów, nic do oznaczenia
            return res.json({ success: true, message: 'Brak logów do oznaczenia' });
          }

          // Wstaw lub zaktualizuj rekord w character_logs_seen
          pool.query(
            `INSERT INTO character_logs_seen (character_id, last_seen_log_id, seen_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE last_seen_log_id = ?, seen_at = NOW()`,
            [characterId, maxLogId, maxLogId],
            (insertErr) => {
              if (insertErr) {
                console.error('❌ Błąd zapisywania seen log:', insertErr);
                return res.status(500).json({ message: 'Błąd serwera' });
              }

              console.log(`✅ Oznaczono logi jako przeczytane dla postaci ${characterId}, ostatni log ID: ${maxLogId}`);
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// ================================
// GET /api/home/logs
// Pobiera logi dla AKTYWNEJ postaci użytkownika
// ================================
router.get('/home/logs', (req, res) => {
  const userId = req.user.id;

  // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
  resolveCharacterId(req, (err, characterId) => {
      if (err) {
        console.error('❌ Błąd pobierania aktywnej postaci użytkownika:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      // Jeśli nie ma wskazanej ani aktywnej postaci, spróbuj pobrać pierwszą dostępną
      if (!characterId) {
        pool.query(
          'SELECT id FROM characters WHERE user_id = ? AND (is_deleted IS NULL OR is_deleted = 0) LIMIT 1',
          [userId],
          (err2, fallbackChars) => {
            if (err2) {
              console.error('❌ Błąd pobierania postaci użytkownika:', err2);
              return res.status(500).json({ message: 'Błąd serwera' });
            }

            if (fallbackChars.length === 0) {
              return res.json({ logs: [] });
            }

            fetchLogsForCharacter(fallbackChars[0].id, res);
          }
        );
      } else {
        fetchLogsForCharacter(characterId, res);
      }
  });
});

// Funkcja pomocnicza do pobierania logów dla konkretnej postaci
function fetchLogsForCharacter(characterId, res) {
  pool.query(
    `SELECT
      cl.id,
      cl.character_id,
      cl.log_type,
      cl.message,
      cl.related_id,
      cl.created_at,
      c.name as character_name
    FROM character_logs cl
    JOIN characters c ON cl.character_id = c.id
    WHERE cl.character_id = ?
    ORDER BY cl.created_at DESC
    LIMIT 100`,
    [characterId],
    (err, logs) => {
      if (err) {
        console.error('❌ Błąd pobierania logów:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      res.json({
        logs: logs.map(log => ({
          id: log.id,
          character_id: log.character_id,
          character_name: log.character_name,
          type: log.log_type,
          message: log.message,
          related_id: log.related_id,
          created_at: log.created_at
        }))
      });
    }
  );
}

// ================================
// FUNKCJA POMOCNICZA - Dodaj log
// ================================
function addLog(characterId, logType, message, relatedId = null) {
  // ZMIANA: Sprawdzenie czy pool istnieje
  if (!pool) {
    console.error('❌ [LOGS] Pool nie jest dostępny!');
    return;
  }

  // ZMIANA: Walidacja danych wejściowych
  if (!characterId) {
    console.error('❌ [LOGS] Brak characterId!');
    return;
  }

  if (!logType || !message) {
    console.error('❌ [LOGS] Brak logType lub message!');
    return;
  }

  console.log(`✅ [LOGS] Dodawanie logu: ${logType} dla postaci ${characterId}`);

  pool.query(
    'INSERT INTO character_logs (character_id, log_type, message, related_id) VALUES (?, ?, ?, ?)',
    [characterId, logType, message, relatedId],
    (err, result) => {
      if (err) {
        console.error('❌ [LOGS] Błąd dodawania logu:', err);
        console.error('❌ [LOGS] Character ID:', characterId);
        console.error('❌ [LOGS] Log Type:', logType);
        console.error('❌ [LOGS] Message:', message);
      } else {
        console.log(`✅ [LOGS] Log zapisany pomyślnie (ID: ${result.insertId})`);
      }
    }
  );
}

// ================================
// FUNKCJE POMOCNICZE - Szczegółowe logi
// ================================

function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
}

function addAchievementLog(characterId, achievement) {
  const startDate = achievement.start_date ? formatDate(achievement.start_date) : 'nieznana data';
  const endDate = achievement.end_date ? formatDate(achievement.end_date) : null;
  
  let message = `Otrzymano pozytywną konsekwencję: "${achievement.title}"`;
  
  if (achievement.description) {
    message += ` - ${achievement.description}`;
  }
  
  if (endDate) {
    message += `. Konsekwencja CZASOWA (obowiązuje od ${startDate} do ${endDate})`;
  } else {
    message += `. Konsekwencja STAŁA (obowiązuje od ${startDate})`;
  }
  
  addLog(characterId, 'achievement_added', message, achievement.id);
}

function addProblemLog(characterId, problem) {
  const startDate = problem.start_date ? formatDate(problem.start_date) : 'nieznana data';
  const endDate = problem.end_date ? formatDate(problem.end_date) : null;
  
  let message = `Otrzymano negatywną konsekwencję: "${problem.title}"`;
  
  if (problem.description) {
    message += ` - ${problem.description}`;
  }
  
  if (endDate) {
    message += `. Konsekwencja CZASOWA (obowiązuje od ${startDate} do ${endDate})`;
  } else {
    message += `. Konsekwencja STAŁA (obowiązuje od ${startDate})`;
  }
  
  addLog(characterId, 'problem_added', message, problem.id);
}

// Przedmioty fabularne (zakładka "Przedmioty" w profilu) nadaje i zabiera
// wyłącznie administracja, a gracz nie dostaje o tym osobnego powiadomienia -
// kartoteka jest jedynym miejscem, gdzie widzi, że coś mu przybyło lub ubyło.
function addStoryItemGrantedLog(characterId, item) {
  const quantity = Number(item.quantity) > 1 ? ` (x${item.quantity})` : '';
  let message = `🎁 Otrzymano przedmiot fabularny: "${item.name}"${quantity}`;

  if (item.source) {
    message += ` - pochodzenie: ${item.source}`;
  }

  addLog(characterId, 'story_item_granted', message, item.id);
}

function addStoryItemRemovedLog(characterId, item) {
  const quantity = Number(item.quantity) > 1 ? ` (x${item.quantity})` : '';
  const message = `📦 Zabrano przedmiot fabularny: "${item.name}"${quantity}`;
  addLog(characterId, 'story_item_removed', message, item.id || null);
}

function addAchievementExpiredLog(characterId, achievement) {
  const endDate = achievement.end_date ? formatDate(achievement.end_date) : 'nieznana data';
  const message = `Pozytywna konsekwencja wygasła: "${achievement.title}". Data wygaśnięcia: ${endDate}`;
  addLog(characterId, 'achievement_expired', message, achievement.id);
}

function addProblemExpiredLog(characterId, problem) {
  const endDate = problem.end_date ? formatDate(problem.end_date) : 'nieznana data';
  const message = `Negatywna konsekwencja wygasła: "${problem.title}". Data wygaśnięcia: ${endDate}`;
  addLog(characterId, 'problem_expired', message, problem.id);
}

// ================================
// FUNKCJE LOGÓW ZGŁOSZEŃ SESJI
// ================================

function addReportAcceptedLog(characterId, sessionName, sessionType, sessionId) {
  console.log(`📝 [REPORT LOG] Accepted - Character ${characterId} session ${sessionName} (ID: ${sessionId})`);
  const message = `✅ Zgłoszenie sesji "${sessionName}" (ID: ${sessionId}, ${sessionType === 'private' ? 'prywatna' : 'ogólna'}) zostało zaakceptowane przez admina.`;
  addLog(characterId, 'report_accepted', message, sessionId);
}

function addReportRejectedLog(characterId, sessionName, sessionType, adminComment, sessionId) {
  console.log(`📝 [REPORT LOG] Rejected - Character ${characterId} session ${sessionName} (ID: ${sessionId})`);
  const message = `❌ Zgłoszenie sesji "${sessionName}" (ID: ${sessionId}, ${sessionType === 'private' ? 'prywatna' : 'ogólna'}) zostało odrzucone przez admina. Powód: "${adminComment}"`;
  addLog(characterId, 'report_rejected', message, sessionId);
}

module.exports = {
  router,
  initialize,
  addLog,
  addAchievementLog,
  addProblemLog,
  addStoryItemGrantedLog,
  addStoryItemRemovedLog,
  addAchievementExpiredLog,
  addProblemExpiredLog,
  addReportAcceptedLog,
  addReportRejectedLog
};