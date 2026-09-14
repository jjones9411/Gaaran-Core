// ================================
// routes/admin.js
// Panel administracyjny
// ================================

const express = require('express');
const router = express.Router();
const { addLog } = require('./logs');
const { checkAdmin, checkGameMasterOrAdmin, verifyToken } = require('../middleware/auth');
const { resolveCharacterId } = require('../utils/activeCharacter');
const { getGameName } = require('./gameInfo');
const nodemailer = require('nodemailer');

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}


// ================================
// PANEL ADMINA - HOME
// ================================

router.get('/home/adminpanel', checkAdmin, (req, res) => {
  res.status(200).json({ message: 'Witaj w panelu admina!' });
});

// ================================
// BUG LOGS
// ================================

router.get('/admin/buglogs', checkAdmin, (req, res) => {
  // Opcjonalny filtr: ?type=backend|frontend|other, ?status=open|resolved...
  const conditions = [];
  const params = [];
  if (req.query.type) {
    conditions.push('bl.bug_type = ?');
    params.push(req.query.type);
  }
  if (req.query.status) {
    conditions.push('bl.status = ?');
    params.push(req.query.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  pool.query(
    `SELECT bl.*, u.user AS reporter_name
     FROM bug_logs bl
     LEFT JOIN users u ON bl.reported_by = u.id
     ${where}
     ORDER BY bl.created_at DESC
     LIMIT 200`,
    params,
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania logów:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      res.status(200).json({ logs: results });
    }
  );
});

// PUT - Zmiana statusu zgłoszenia (open/in_progress/resolved/closed/wontfix)
router.put('/admin/buglogs/:id/status', checkAdmin, (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes } = req.body;
  const validStatuses = ['open', 'in_progress', 'resolved', 'closed', 'wontfix'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Nieprawidłowy status' });
  }

  const isDone = status === 'resolved' || status === 'closed' || status === 'wontfix';
  pool.query(
    `UPDATE bug_logs
     SET status = ?, resolution_notes = ?, assigned_to = ?,
         resolved_at = ${isDone ? 'NOW()' : 'NULL'}
     WHERE id = ?`,
    [status, resolution_notes || null, req.user.id, id],
    (err, result) => {
      if (err) {
        console.error('❌ Błąd aktualizacji statusu buga:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      if (!result.affectedRows) {
        return res.status(404).json({ message: 'Zgłoszenie nie znalezione' });
      }
      res.status(200).json({ message: 'Status zaktualizowany' });
    }
  );
});

// DELETE - Usuń pojedyncze zgłoszenie
router.delete('/admin/buglogs/:id', checkAdmin, (req, res) => {
  pool.query('DELETE FROM bug_logs WHERE id = ?', [req.params.id], (err, result) => {
    if (err) {
      console.error('❌ Błąd usuwania buga:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Zgłoszenie nie znalezione' });
    }
    res.status(200).json({ message: 'Zgłoszenie usunięte' });
  });
});

// POST - Wyczyść logi (wszystkie lub tylko zamknięte/rozwiązane)
router.post('/admin/buglogs/clear', checkAdmin, (req, res) => {
  const onlyResolved = req.body && req.body.onlyResolved;
  const query = onlyResolved
    ? "DELETE FROM bug_logs WHERE status IN ('resolved', 'closed', 'wontfix')"
    : 'DELETE FROM bug_logs';
  pool.query(query, (err, result) => {
    if (err) {
      console.error('❌ Błąd czyszczenia logów:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    res.status(200).json({ message: 'Logi wyczyszczone', deleted: result.affectedRows });
  });
});

// POST - Zgłoszenie błędu przez gracza (dostępne dla każdego zalogowanego)
router.post('/bug-report', (req, res) => {
  const { description, title, url } = req.body;

  if (!description || !String(description).trim()) {
    return res.status(400).json({ message: 'Opis błędu jest wymagany' });
  }

  const safeTitle = (title && String(title).trim())
    ? String(title).trim().slice(0, 255)
    : `Zgłoszenie gracza: ${String(description).trim().slice(0, 80)}`;

  pool.query(
    `INSERT INTO bug_logs
      (title, description, error_message, severity, status, bug_type, url, browser_info, reported_by)
     VALUES (?, ?, ?, 'medium', 'open', 'other', ?, ?, ?)`,
    [
      safeTitle,
      String(description).trim().slice(0, 5000),
      'Zgłoszenie gracza',
      (url || '').slice(0, 500) || null,
      (req.headers['user-agent'] || '').slice(0, 1000) || null,
      req.user ? req.user.id : null,
    ],
    (err) => {
      if (err) {
        console.error('❌ Błąd zapisu zgłoszenia gracza:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      res.status(201).json({ message: 'Dziękujemy! Zgłoszenie zostało wysłane.' });
    }
  );
});

// ================================
// ZMIANA NICKU POSTACI (characters.name)
// ================================

router.get('/admin/getNickname', checkGameMasterOrAdmin, (req, res) => {
  const { characterId } = req.query;

  if (!characterId) {
    return res.status(400).json({ message: 'ID postaci jest wymagane' });
  }

  pool.query('SELECT name FROM characters WHERE id = ?', [characterId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania nicku:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (!results.length) {
      return res.status(404).json({ message: 'Postać nie znaleziona' });
    }

    res.status(200).json({
      nickname: results[0].name,
      message: 'Nick pobrany pomyślnie'
    });
  });
});

router.post('/admin/changeNickname', checkGameMasterOrAdmin, (req, res) => {
  const { characterId, newNickname } = req.body;
  const adminId = req.user.id;

  if (!characterId || !newNickname || !newNickname.trim()) {
    return res.status(400).json({ message: 'ID postaci i nowy nick są wymagane' });
  }

  const trimmedNickname = newNickname.trim();

  // Sprawdź czy nick nie jest już zajęty
  pool.query('SELECT id FROM characters WHERE name = ? AND id != ?', [trimmedNickname, characterId], (err, existingResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania nicku:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (existingResults.length > 0) {
      return res.status(400).json({ message: 'Ten nick jest już zajęty przez inną postać' });
    }

    // Pobierz dane postaci przed zmianą
    pool.query('SELECT name, user_id FROM characters WHERE id = ?', [characterId], (err, characterResults) => {
      if (err) {
        console.error('❌ Błąd sprawdzania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!characterResults.length) {
        return res.status(404).json({ message: 'Postać nie znaleziona' });
      }

      const oldNickname = characterResults[0].name;
      const ownerId = characterResults[0].user_id;

      // Zaktualizuj nick
      pool.query('UPDATE characters SET name = ? WHERE id = ?', [trimmedNickname, characterId], (err, updateResults) => {
        if (err) {
          console.error('❌ Błąd aktualizacji nicku:', err);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        if (updateResults.affectedRows === 0) {
          return res.status(404).json({ message: 'Nie udało się zaktualizować nicku' });
        }

        // Logowanie akcji admina
        const logQuery = `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at) VALUES (?, 'CHARACTER_NICKNAME_CHANGE', ?, ?, NOW())`;
        const logDetails = `Zmiana nicku postaci (ID: ${characterId}) z "${oldNickname}" na "${trimmedNickname}"`;
        
        pool.query(logQuery, [adminId, ownerId, logDetails], (logErr) => {
          if (logErr) console.error('❌ Błąd zapisywania logu:', logErr);
        });

        res.status(200).json({
          message: `Nick postaci zmieniony z "${oldNickname}" na "${trimmedNickname}"`,
          oldNickname: oldNickname,
          newNickname: trimmedNickname
        });
      });
    });
  });
});

// ================================
// ZARZĄDZANIE ROLAMI UŻYTKOWNIKÓW
// ================================

// Dostępne role w systemie
// `zasluzony` jest ODZNACZENIEM, nie awansem: nie daje żadnych uprawnień.
// Wszystkie kontrole dostępu w backendzie są allowlistami ('admin' /
// 'mistrz_gry' / 'karczmarz'), więc ta rola z definicji nigdzie nie przechodzi.
// Uwaga: gdziekolwiek testuje się rolę POZYTYWNIE przeciwko 'mieszkaniec'
// (blokada gry dla mieszkańców w App.js), 'zasluzony' musi być traktowany
// identycznie - inaczej odznaczenie po cichu zdejmowałoby blokadę.
const AVAILABLE_ROLES = ['mieszkaniec', 'zasluzony', 'karczmarz', 'mistrz_gry', 'admin'];

// GET: Pobierz aktualną rolę użytkownika po character_id
router.get('/admin/get-role', checkAdmin, (req, res) => {
  const { characterId } = req.query;

  if (!characterId) {
    return res.status(400).json({ message: 'ID postaci jest wymagane' });
  }

  // Znajdź postać i jej właściciela
  pool.query(
    `SELECT c.id, c.name, c.user_id, u.user AS owner_name, u.role
     FROM characters c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = ?`,
    [characterId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania danych:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!results.length) {
        return res.status(404).json({ message: 'Postać nie znaleziona' });
      }

      const data = results[0];
      res.status(200).json({
        characterId: data.id,
        characterName: data.name,
        userId: data.user_id,
        ownerName: data.owner_name,
        currentRole: data.role,
        availableRoles: AVAILABLE_ROLES,
        message: 'Dane pobrane pomyślnie'
      });
    }
  );
});

// POST: Zmień rolę użytkownika (przez character_id)
router.post('/admin/change-role', checkAdmin, (req, res) => {
  const { characterId, newRole } = req.body;
  const adminId = req.user.id;

  if (!characterId || !newRole) {
    return res.status(400).json({ message: 'ID postaci i nowa rola są wymagane' });
  }

  if (!AVAILABLE_ROLES.includes(newRole)) {
    return res.status(400).json({
      message: `Nieprawidłowa rola. Dostępne role: ${AVAILABLE_ROLES.join(', ')}`
    });
  }

  // Znajdź właściciela postaci
  pool.query(
    `SELECT c.id, c.name, c.user_id, u.user AS owner_name, u.role AS old_role
     FROM characters c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = ?`,
    [characterId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (!results.length) {
        return res.status(404).json({ message: 'Postać nie znaleziona' });
      }

      const data = results[0];
      const userId = data.user_id;
      const oldRole = data.old_role;

      if (oldRole === newRole) {
        return res.status(400).json({ message: 'Użytkownik ma już tę rolę' });
      }

      // Zaktualizuj rolę użytkownika
      pool.query(
        'UPDATE users SET role = ? WHERE id = ?',
        [newRole, userId],
        (err, updateResult) => {
          if (err) {
            console.error('❌ Błąd aktualizacji roli:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Nie udało się zaktualizować roli' });
          }

          // Logowanie akcji admina
          const logQuery = `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at) VALUES (?, 'USER_ROLE_CHANGE', ?, ?, NOW())`;
          const logDetails = `Zmiana roli użytkownika "${data.owner_name}" (ID: ${userId}) przez postać "${data.name}" (ID: ${characterId}) z "${oldRole}" na "${newRole}"`;

          pool.query(logQuery, [adminId, userId, logDetails], (logErr) => {
            if (logErr) console.error('❌ Błąd zapisywania logu:', logErr);
          });

          res.status(200).json({
            message: `Rola użytkownika "${data.owner_name}" zmieniona z "${oldRole}" na "${newRole}"`,
            characterId: characterId,
            characterName: data.name,
            userId: userId,
            ownerName: data.owner_name,
            oldRole: oldRole,
            newRole: newRole
          });
        }
      );
    }
  );
});

// ================================
// KOMUNIKATY DLA MIESZKAŃCÓW
// ================================

router.get('/admin/resident-messages', checkAdmin, (req, res) => {
  pool.query(
    'SELECT id, title, content, active, created_at, updated_at, created_by FROM resident_messages ORDER BY created_at DESC',
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania komunikatów:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }
      res.json({ success: true, messages: results });
    }
  );
});

router.post('/admin/resident-messages', checkAdmin, (req, res) => {
  const { title, content } = req.body;
  const adminId = req.user.id;
  
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Tytuł i treść są wymagane' });
  }

  pool.query('UPDATE resident_messages SET active = 0', (err1) => {
    if (err1) {
      console.error('❌ Błąd dezaktywacji starych komunikatów:', err1);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }

    pool.query(
      'INSERT INTO resident_messages (title, content, active, created_by) VALUES (?, ?, 1, ?)',
      [title, content, adminId],
      (err2, result) => {
        if (err2) {
          console.error('❌ Błąd dodawania komunikatu:', err2);
          return res.status(500).json({ success: false, message: 'Błąd serwera' });
        }
        res.status(201).json({
          success: true,
          message: 'Komunikat dodany i aktywowany',
          messageId: result.insertId
        });
      }
    );
  });
});

router.put('/admin/resident-messages/:messageId', checkAdmin, (req, res) => {
  const { messageId } = req.params;
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Tytuł i treść są wymagane' });
  }

  pool.query('SELECT id FROM resident_messages WHERE id = ?', [messageId], (err1, results) => {
    if (err1) {
      console.error('❌ Błąd sprawdzania komunikatu:', err1);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Komunikat nie znaleziony' });
    }

    pool.query(
      'UPDATE resident_messages SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, content, messageId],
      (err2) => {
        if (err2) {
          console.error('❌ Błąd aktualizacji komunikatu:', err2);
          return res.status(500).json({ success: false, message: 'Błąd serwera' });
        }
        res.json({ success: true, message: 'Komunikat zaktualizowany' });
      }
    );
  });
});

router.patch('/admin/resident-messages/:messageId/toggle', checkAdmin, (req, res) => {
  const { messageId } = req.params;
  
  pool.query('SELECT id, active, title FROM resident_messages WHERE id = ?', [messageId], (err1, results) => {
    if (err1) {
      console.error('❌ Błąd pobierania komunikatu:', err1);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Komunikat nie znaleziony' });
    }

    const currentActive = results[0].active;
    const newActive = currentActive ? 0 : 1;
    
    if (newActive === 1) {
      pool.query('UPDATE resident_messages SET active = 0', (err2) => {
        if (err2) {
          console.error('❌ Błąd dezaktywacji innych komunikatów:', err2);
          return res.status(500).json({ success: false, message: 'Błąd serwera' });
        }

        pool.query(
          'UPDATE resident_messages SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [messageId],
          (err3) => {
            if (err3) {
              console.error('❌ Błąd aktywacji komunikatu:', err3);
              return res.status(500).json({ success: false, message: 'Błąd serwera' });
            }
            res.json({ success: true, message: 'Komunikat aktywowany' });
          }
        );
      });
    } else {
      pool.query(
        'UPDATE resident_messages SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [messageId],
        (err2) => {
          if (err2) {
            console.error('❌ Błąd dezaktywacji komunikatu:', err2);
            return res.status(500).json({ success: false, message: 'Błąd serwera' });
          }
          res.json({ success: true, message: 'Komunikat dezaktywowany' });
        }
      );
    }
  });
});

router.delete('/admin/resident-messages/:messageId', checkAdmin, (req, res) => {
  const { messageId } = req.params;
  
  pool.query('SELECT id, title FROM resident_messages WHERE id = ?', [messageId], (err1, results) => {
    if (err1) {
      console.error('❌ Błąd sprawdzania komunikatu:', err1);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Komunikat nie znaleziony' });
    }

    pool.query('DELETE FROM resident_messages WHERE id = ?', [messageId], (err2) => {
      if (err2) {
        console.error('❌ Błąd usuwania komunikatu:', err2);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }
      res.json({ success: true, message: 'Komunikat usunięty' });
    });
  });
});

// W admin.js - usuń middleware autoryzacji z tego endpointa
router.get('/admin/check-resident-message', (req, res) => { // ❌ Usuń checkAdmin
  pool.query(
    'SELECT id, title, content, created_at, updated_at FROM resident_messages WHERE active = 1 ORDER BY updated_at DESC LIMIT 1',
    (err, results) => {
      if (err) {
        console.error('❌ Błąd sprawdzania aktywnego komunikatu:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera', hasMessage: false });
      }
      
      if (results.length === 0) {
        return res.json({ success: true, hasMessage: false, message: 'Brak aktywnego komunikatu' });
      }
      
      const activeMessage = results[0];
      res.json({
        success: true,
        hasMessage: true,
        title: activeMessage.title,
        content: activeMessage.content,
        createdAt: activeMessage.created_at,
        updatedAt: activeMessage.updated_at,
        message: 'Znaleziono aktywny komunikat'
      });
    }
  );
});

router.get('/admin/resident-messages/status', checkAdmin, (req, res) => {
  pool.query('SELECT COUNT(*) as total, SUM(active) as active FROM resident_messages', (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania statusu komunikatów:', err);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    
    const stats = results[0];
    res.json({
      success: true,
      totalMessages: stats.total,
      activeMessages: stats.active,
      hasActiveMessage: stats.active > 0
    });
  });
});

router.post('/admin/resident-messages/deactivate-all', checkAdmin, (req, res) => {
  pool.query('UPDATE resident_messages SET active = 0, updated_at = CURRENT_TIMESTAMP', (err, result) => {
    if (err) {
      console.error('❌ Błąd dezaktywacji wszystkich komunikatów:', err);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }
    
    res.json({
      success: true,
      message: `Dezaktywowano wszystkie komunikaty (${result.affectedRows} komunikatów)`,
      deactivatedCount: result.affectedRows
    });
  });
});

// ================================
// WIADOMOŚCI GLOBALNE (do wszystkich characters)
// ================================

router.post('/admin/sendGlobalMessage', checkAdmin, (req, res) => {
  const { title, content, target_factions } = req.body;
  const adminId = req.user.id;

  if (!title || !content) {
    return res.status(400).json({ message: 'Tytuł i treść są wymagane' });
  }

  // Nadawcą jest postać, KTÓRĄ ADMIN GRA (id z tokena) - patrz utils/activeCharacter.js.
  resolveCharacterId(req, (err, adminCharacterId) => {
    if (err) {
      console.error('❌ Błąd pobierania postaci admina:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (!adminCharacterId) {
      return res.status(404).json({ message: 'Admin nie ma aktywnej postaci' });
    }

    // Konwertuj array rasy na string oddzielony przecinkami (lub NULL jeśli puste/brak)
    const targetFactionsStr = (target_factions && target_factions.length > 0)
      ? target_factions.join(',')
      : null;

    // Dodaj wiadomość globalną
    pool.query(
      'INSERT INTO global_messages (title, content, created_by_character_id, created_at, is_active, target_factions) VALUES (?, ?, ?, NOW(), TRUE, ?)',
      [title, content, adminCharacterId, targetFactionsStr],
      (err, results) => {
        if (err) {
          console.error('❌ Błąd dodawania wiadomości globalnej:', err);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        const messageTarget = targetFactionsStr
          ? `do rasy: ${targetFactionsStr}`
          : 'do wszystkich graczy';

        res.status(201).json({
          message: `Wiadomość została wysłana ${messageTarget}`,
          messageId: results.insertId
        });
      }
    );
  });
});

router.get('/global-notifications/unread', (req, res) => {
  try {
    const userId = req.user.id;

    // Pobierz aktywną postać użytkownika wraz z rasą
    pool.query('SELECT id, faction FROM characters WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId], (err, charResults) => {
      if (err) {
        console.error('❌ Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd bazy danych', error: err.message });
      }

      if (charResults.length === 0) {
        return res.json({ messages: [] });
      }

      const characterId = charResults[0].id;
      const characterFaction = charResults[0].faction;

      // Pobierz nieprzeczytane wiadomości globalne
      // Filtruj: target_factions IS NULL (do wszystkich) LUB zawiera rasę gracza
      pool.query(`
        SELECT gm.id, gm.title, gm.content, gm.created_at
        FROM global_messages gm
        LEFT JOIN character_read_messages crm ON gm.id = crm.message_id AND crm.character_id = ?
        WHERE gm.is_active = TRUE
          AND crm.message_id IS NULL
          AND (gm.target_factions IS NULL OR FIND_IN_SET(?, gm.target_factions) > 0)
        ORDER BY gm.created_at ASC
      `, [characterId, characterFaction], (err, results) => {
        if (err) {
          console.error('❌ Błąd pobierania wiadomości:', err);
          return res.status(500).json({ message: 'Błąd bazy danych', error: err.message });
        }

        res.json({ messages: results });
      });
    });

  } catch (error) {
    console.error('❌ Błąd pobierania wiadomości:', error);
    res.status(500).json({ message: 'Błąd serwera', error: error.message });
  }
});

router.post('/global-notifications/mark-read/:messageId', (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user.id;
    
    pool.query('SELECT id FROM characters WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId], (err, charResults) => {
      if (err) {
        console.error('❌ Błąd pobierania postaci:', err);
        return res.status(500).json({ message: 'Błąd bazy danych', error: err.message });
      }
      
      if (charResults.length === 0) {
        return res.status(404).json({ message: 'Brak aktywnej postaci' });
      }
      
      const characterId = charResults[0].id;
      
      pool.query(
        'INSERT IGNORE INTO character_read_messages (character_id, message_id, read_at) VALUES (?, ?, NOW())',
        [characterId, messageId],
        (err, results) => {
          if (err) {
            console.error('❌ Błąd oznaczania wiadomości:', err);
            return res.status(500).json({ message: 'Błąd bazy danych', error: err.message });
          }
          
          res.json({ message: 'Oznaczono jako przeczytane' });
        }
      );
    });

  } catch (error) {
    console.error('❌ Błąd oznaczania wiadomości:', error);
    res.status(500).json({ message: 'Błąd serwera', error: error.message });
  }
});

router.get('/admin/global-messages', checkAdmin, (req, res) => {
  pool.query(
    `SELECT gm.*, c.name as created_by_character_name,
      (SELECT COUNT(*) FROM character_read_messages WHERE message_id = gm.id) as read_count
     FROM global_messages gm
     LEFT JOIN characters c ON gm.created_by_character_id = c.id
     ORDER BY gm.created_at DESC
     LIMIT 100`,
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania listy wiadomości globalnych:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      res.json({ messages: results });
    }
  );
});

router.put('/admin/global-messages/:messageId/toggle', checkAdmin, (req, res) => {
  const { messageId } = req.params;
  
  pool.query('SELECT is_active FROM global_messages WHERE id = ?', [messageId], (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania wiadomości:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Wiadomość nie znaleziona' });
    }
    
    const newStatus = !results[0].is_active;
    
    pool.query('UPDATE global_messages SET is_active = ? WHERE id = ?', [newStatus, messageId], (err2) => {
      if (err2) {
        console.error('❌ Błąd aktualizacji statusu wiadomości:', err2);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      res.json({ 
        message: newStatus ? 'Wiadomość aktywowana' : 'Wiadomość dezaktywowana',
        is_active: newStatus
      });
    });
  });
});

router.delete('/admin/global-messages/:messageId', checkAdmin, (req, res) => {
  const { messageId } = req.params;
  
  pool.query('DELETE FROM character_read_messages WHERE message_id = ?', [messageId], (err1) => {
    if (err1) {
      console.error('❌ Błąd usuwania powiązanych rekordów:', err1);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    pool.query('DELETE FROM global_messages WHERE id = ?', [messageId], (err2, result) => {
      if (err2) {
        console.error('❌ Błąd usuwania wiadomości globalnej:', err2);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Wiadomość nie znaleziona' });
      }
      
      res.json({ message: 'Wiadomość globalna usunięta' });
    });
  });
});

// ================================
// BLOKOWANIE UŻYTKOWNIKÓW (users)
// ================================

function addDaysToDate(year, month, day, daysToAdd) {
  let totalDays = (year * 360) + ((month - 1) * 30) + day;
  totalDays += daysToAdd;

  const newYear = Math.floor(totalDays / 360);
  const remainderAfterYears = totalDays % 360;
  const newMonth = Math.floor(remainderAfterYears / 30) + 1;
  const newDay = (remainderAfterYears % 30);
  
  const finalDay = newDay === 0 ? 30 : newDay;
  let finalMonth = newMonth;
  let finalYear = newYear;
  
  if (newDay === 0) {
    finalMonth = newMonth - 1;
    if (finalMonth === 0) {
      finalMonth = 12;
      finalYear = newYear - 1;
    }
  }

  return { newYear: finalYear, newMonth: finalMonth, newDay: finalDay };
}

router.post('/admin/blockUser', checkGameMasterOrAdmin, (req, res) => {
  const { userId, days } = req.body;

  if (!userId || !days) {
    return res.status(400).json({ message: 'Wymagane: userId i days' });
  }

  const daysInt = parseInt(days);
  if (isNaN(daysInt) || daysInt <= 0) {
    return res.status(400).json({ message: 'Liczba dni musi być liczbą dodatnią' });
  }

  // Najpierw pobierz dane użytkownika
  pool.query('SELECT id, user FROM users WHERE id = ?', [userId], (errUser, userResults) => {
    if (errUser) {
      console.error('❌ Błąd sprawdzania użytkownika:', errUser);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ message: `Nie znaleziono użytkownika ID=${userId}` });
    }

    const username = userResults[0].user;

    // Zablokuj użytkownika używając REALNEGO czasu (TIMESTAMP)
    const blockQ = `
      UPDATE users
      SET blocked_until = DATE_ADD(NOW(), INTERVAL ? DAY)
      WHERE id = ?
    `;

    pool.query(blockQ, [daysInt, userId], (err2, result2) => {
      if (err2) {
        console.error('❌ Błąd blokowania użytkownika:', err2);
        return res.status(500).json({ message: 'Błąd serwera przy blokowaniu' });
      }

      if (result2.affectedRows === 0) {
        return res.status(404).json({ message: `Nie znaleziono użytkownika ID=${userId}` });
      }

      // Pobierz faktyczną datę zakończenia bana
      pool.query('SELECT blocked_until FROM users WHERE id = ?', [userId], (err3, blockedResults) => {
        if (err3) {
          console.error('❌ Błąd pobierania daty bana:', err3);
          // Mimo błędu ban został nałożony, więc zwróć podstawową wiadomość
          return res.json({
            success: true,
            message: `✅ Zablokowano użytkownika "${username}" na ${daysInt} dni (realny czas kalendarzowy)`,
            userId,
            username,
            daysBlocked: daysInt
          });
        }

        const blockedUntil = blockedResults[0]?.blocked_until;
        const blockedUntilFormatted = blockedUntil
          ? new Date(blockedUntil).toLocaleString('pl-PL', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Błąd pobierania daty';

        res.json({
          success: true,
          message: `✅ Zablokowano użytkownika "${username}" do ${blockedUntilFormatted} (${daysInt} dni w realnym czasie)`,
          userId,
          username,
          blockedUntil: blockedUntilFormatted,
          blockedUntilISO: blockedUntil,
          daysBlocked: daysInt
        });
      });
    });
  });
});

router.post('/admin/unblockUser', checkGameMasterOrAdmin, (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'Wymagane: userId' });
  }

  // Najpierw pobierz dane użytkownika
  pool.query('SELECT id, user FROM users WHERE id = ?', [userId], (errUser, userResults) => {
    if (errUser) {
      console.error('❌ Błąd sprawdzania użytkownika:', errUser);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ message: `Nie znaleziono użytkownika ID=${userId}` });
    }

    const username = userResults[0].user;

    const unblockQ = `
      UPDATE users
      SET blocked_until = NULL
      WHERE id = ?
    `;

    pool.query(unblockQ, [userId], (err, result) => {
      if (err) {
        console.error('❌ Błąd odblokowania użytkownika:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: `Nie znaleziono użytkownika ID=${userId}` });
      }

      res.json({
        success: true,
        message: `✅ Odblokowano użytkownika "${username}"`,
        userId: parseInt(userId),
        username
      });
    });
  });
});

// Endpoint do sprawdzania statusu blokady użytkownika
// Dostępny dla właściciela konta (sprawdzenie własnej blokady) oraz adminów
router.get('/admin/checkUserBlock/:userId', (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && String(req.user.id) !== String(userId)) {
    return res.status(403).json({ message: 'Brak uprawnień do sprawdzenia statusu tego użytkownika' });
  }

  const checkQ = `
    SELECT user, blocked_until
    FROM users
    WHERE id = ?
  `;

  pool.query(checkQ, [userId], (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania statusu blokady:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    const user = results[0];
    const { user: username, blocked_until } = user;

    if (!blocked_until) {
      return res.json({
        username,
        blocked: false,
        message: 'Użytkownik nie jest zablokowany'
      });
    }

    const now = new Date();
    const blockedUntilDate = new Date(blocked_until);
    const isBlocked = now < blockedUntilDate;
    const timeLeft = blockedUntilDate - now;
    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));

    const blockedUntilFormatted = blockedUntilDate.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    res.json({
      username,
      blocked: isBlocked,
      blockedUntil: blockedUntilFormatted,
      blockedUntilISO: blocked_until,
      daysLeft: isBlocked ? Math.max(0, daysLeft) : 0,
      message: isBlocked
        ? `Zablokowany do ${blockedUntilFormatted} (jeszcze ${daysLeft} dni)`
        : 'Blokada wygasła'
    });
  });
});

// ================================
// USUWANIE UŻYTKOWNIKA (users + characters)
// ================================

router.get('/admin/user-deletion-preview/:userId', checkAdmin, (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ message: 'userId jest wymagane' });
  }

  // Pobierz informacje o użytkowniku i jego głównej postaci
  const userQuery = `
    SELECT u.id, u.user, u.email, u.role,
           c.name as character_name, c.race, c.gender
    FROM users u
    LEFT JOIN characters c ON u.id = c.user_id AND c.is_active = 1
    WHERE u.id = ?
    LIMIT 1
  `;
  
  pool.query(userQuery, [userId], (err, userResults) => {
    if (err) {
      console.error('❌ Błąd pobierania użytkownika:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (userResults.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }
    
    const user = userResults[0];
    
    // Policz wiadomości wysłane przez użytkownika.
    // Wiadomości prywatne są w `messages` i kluczowane POSTACIĄ, nie kontem.
    const sentCount = `
      SELECT COUNT(*) as count FROM messages
      WHERE sender_character_id IN (SELECT id FROM characters WHERE user_id = ?)
    `;
    const receivedCount = `
      SELECT COUNT(*) as count FROM messages
      WHERE receiver_character_id IN (SELECT id FROM characters WHERE user_id = ?)
    `;
    pool.query(sentCount, [userId], (err1, sentMsg) => {
      if (err1) console.error('❌ Błąd liczenia wysłanych wiadomości:', err1);

      // Policz wiadomości otrzymane
      pool.query(receivedCount, [userId], (err2, receivedMsg) => {
        if (err2) console.error('❌ Błąd liczenia otrzymanych wiadomości:', err2);

        // Policz prywatne sesje jako właściciel
        pool.query('SELECT COUNT(*) as count FROM private_sessions WHERE owner_id = ?', [userId], (err3, ownedSessions) => {
          if (err3) console.error('❌ Błąd liczenia sesji prywatnych:', err3);

          // Policz wiadomości w sesjach - sesje są rozbite na dwie tabele.
          pool.query(
            `SELECT
               (SELECT COUNT(*) FROM general_session_messages WHERE user_id = ?)
             + (SELECT COUNT(*) FROM private_session_messages WHERE user_id = ?) AS count`,
            [userId, userId],
            (err4, sessionMsg) => {
            if (err4) console.error('❌ Błąd liczenia wiadomości w sesjach:', err4);
            
            res.json({
              user: user.user,
              email: user.email,
              role: user.role,
              race: user.race || 'Brak',
              gender: user.gender || 'Brak',
              sentMessages: (sentMsg && sentMsg[0]) ? sentMsg[0].count : 0,
              receivedMessages: (receivedMsg && receivedMsg[0]) ? receivedMsg[0].count : 0,
              ownedPrivateSessions: (ownedSessions && ownedSessions[0]) ? ownedSessions[0].count : 0,
              sessionMessages: (sessionMsg && sessionMsg[0]) ? sessionMsg[0].count : 0
            });
          });
        });
      });
    });
  });
});

router.delete('/admin/deleteUser/:userId', checkAdmin, (req, res) => {
  const { userId } = req.params;
  const adminId = req.user.id;
  
  if (!userId) {
    return res.status(400).json({ message: 'userId jest wymagane' });
  }

  if (parseInt(userId) === adminId) {
    return res.status(400).json({ message: 'Nie możesz usunąć samego siebie!' });
  }

  // Sprawdź czy użytkownik istnieje
  pool.query('SELECT user FROM users WHERE id = ?', [userId], (err, userCheck) => {
    if (err) {
      console.error('❌ Błąd sprawdzania użytkownika:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (userCheck.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }
    
    const username = userCheck[0].user;

    // ✅ TRANSAKCJA: wszystkie kroki kasowania muszą się powieść razem, inaczej pełny rollback
    pool.getConnection((connErr, connection) => {
      if (connErr) {
        console.error('❌ Błąd połączenia:', connErr);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      connection.beginTransaction((txErr) => {
        if (txErr) {
          connection.release();
          console.error('❌ Błąd rozpoczęcia transakcji:', txErr);
          return res.status(500).json({ message: 'Błąd transakcji' });
        }

        const fail = (err, message) => {
          connection.rollback(() => {
            connection.release();
            console.error('❌ Błąd usuwania użytkownika:', err);
            res.status(500).json({ message });
          });
        };

        // KROK 1: Usuń wiadomości prywatne.
        // Wiadomości prywatne są w tabeli `messages` i kluczowane POSTACIĄ,
        // nie kontem - stąd podzapytanie po characters.user_id.
        connection.query(
          `DELETE FROM messages
           WHERE sender_character_id IN (SELECT id FROM characters WHERE user_id = ?)
              OR receiver_character_id IN (SELECT id FROM characters WHERE user_id = ?)`,
          [userId, userId],
          (err1) => {
          if (err1) return fail(err1, 'Błąd usuwania wiadomości prywatnych');

          // KROK 2: Usuń sesje prywatne gdzie był właścicielem
          connection.query('DELETE FROM private_sessions WHERE owner_id = ?', [userId], (err2) => {
            if (err2) return fail(err2, 'Błąd usuwania sesji prywatnych');

            // KROK 3: Zanonimizuj wiadomości w sesjach ("Bezimienny").
            // Historia sesji zostaje dla pozostałych uczestników; ginie tylko
            // powiązanie z kontem. Sesje są rozbite na dwie tabele.
            const anonGeneral = `UPDATE general_session_messages
              SET user_id = NULL, character_name = 'Bezimienny' WHERE user_id = ?`;
            const anonPrivate = `UPDATE private_session_messages
              SET user_id = NULL, character_name = 'Bezimienny' WHERE user_id = ?`;
            connection.query(anonGeneral, [userId], (err3a) => {
              if (err3a) return fail(err3a, 'Błąd zamiany wiadomości na Bezimienny');
              connection.query(anonPrivate, [userId], (err3b) => {
              if (err3b) return fail(err3b, 'Błąd zamiany wiadomości na Bezimienny');

              // KROK 4: Usuń zgłoszenia sesji
              connection.query('DELETE FROM player_reports WHERE character_id IN (SELECT id FROM characters WHERE user_id = ?)', [userId], (err4) => {
                if (err4) return fail(err4, 'Błąd usuwania zgłoszeń');

                // KROK 5: Usuń uczestnictwa w sesjach.
                // Uczestnictwa są kluczowane postacią, nie kontem.
                const partGeneral = `DELETE FROM general_session_participants
                  WHERE character_id IN (SELECT id FROM characters WHERE user_id = ?)`;
                const partPrivate = `DELETE FROM private_session_participants
                  WHERE character_id IN (SELECT id FROM characters WHERE user_id = ?)`;
                connection.query(partGeneral, [userId], (err5a) => {
                  if (err5a) return fail(err5a, 'Błąd usuwania uczestnictw');
                  connection.query(partPrivate, [userId], (err5) => {
                  if (err5) return fail(err5, 'Błąd usuwania uczestnictw');

                  // KROK 6: Usuń wszystkie postacie użytkownika
                  connection.query('DELETE FROM characters WHERE user_id = ?', [userId], (err6) => {
                    if (err6) return fail(err6, 'Błąd usuwania postaci użytkownika');

                    // KROK 7: Usuń użytkownika
                    connection.query('DELETE FROM users WHERE id = ?', [userId], (err7) => {
                      if (err7) return fail(err7, 'Błąd usuwania użytkownika');

                      connection.commit((commitErr) => {
                        if (commitErr) return fail(commitErr, 'Błąd finalizacji usuwania użytkownika');

                        connection.release();

                        // Logowanie akcji admina (poza transakcją, best-effort)
                        const logQuery = `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at) VALUES (?, 'USER_DELETE', ?, ?, NOW())`;
                        const logDetails = `Usunięto użytkownika ${username} (ID: ${userId}) wraz ze wszystkimi danymi`;

                        pool.query(logQuery, [adminId, userId, logDetails], (logErr) => {
                          if (logErr) console.error('❌ Błąd zapisywania logu:', logErr);
                        });

                        res.json({
                          message: `Użytkownik ${username} (ID: ${userId}) został całkowicie usunięty wraz ze wszystkimi danymi`
                        });
                      });   // commit
                    });     // err7  - DELETE users
                  });       // err6  - DELETE characters
                  });       // err5  - private_session_participants
                });         // err5a - general_session_participants
              });           // err4  - player_reports
              });           // err3b - private_session_messages
            });             // err3a - general_session_messages
          });               // err2  - private_sessions
        });                 // err1  - messages
      });                   // beginTransaction
    });                     // getConnection
  });                       // SELECT user FROM users
});

// ================================
// ZGŁOSZENIA SESJI - ADMIN
// ================================

router.post('/admin/reports', checkAdmin, (req, res) => {
  const { status } = req.query;
  
  let query = `
    SELECT 
      pr.id,
      pr.character_id,
      pr.character_name,
      pr.session_type,
      pr.session_id,
      pr.session_title,
      pr.what_happened,
      pr.world_consequences,
      pr.character_consequences,
      pr.reported_skills,
      pr.status,
      pr.admin_comment,
      pr.internal_comment,
      pr.created_at,
      pr.updated_at,
      c.user_id,
      u.user as username,
      reviewer.user as reviewed_by_name,
      pr.reviewed_at
    FROM player_reports pr
    JOIN characters c ON pr.character_id = c.id
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users reviewer ON pr.reviewed_by = reviewer.id
  `;
  
  const queryParams = [];
  
  if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
    query += ' WHERE pr.status = ?';
    queryParams.push(status);
  }
  
  query += ' ORDER BY pr.created_at DESC';
  
  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania zgłoszeń (admin):', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    res.json({ reports: results });
  });
});

router.post('/admin/reports/characters', checkAdmin, (req, res) => {
  const query = `
    SELECT 
      c.id as character_id,
      c.name as character_name,
      c.user_id,
      u.user as username,
      COUNT(pr.id) as total_reports,
      COUNT(CASE WHEN pr.status = 'pending' THEN 1 END) as pending_reports,
      COUNT(CASE WHEN pr.status = 'accepted' THEN 1 END) as accepted_reports,
      COUNT(CASE WHEN pr.status = 'rejected' THEN 1 END) as rejected_reports,
      MAX(pr.created_at) as last_report_date
    FROM characters c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN player_reports pr ON c.id = pr.character_id
    GROUP BY c.id, c.name, c.user_id, u.user
    HAVING total_reports > 0
    ORDER BY last_report_date DESC
  `;
  
  pool.query(query, (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania postaci z zgłoszeniami:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    res.json({ characters: results });
  });
});

router.post('/admin/reports/character/:characterId', checkAdmin, (req, res) => {
  const { characterId } = req.params;
  
  const query = `
    SELECT 
      pr.id,
      pr.character_id,
      pr.character_name,
      pr.session_type,
      pr.session_id,
      pr.session_title,
      pr.what_happened,
      pr.world_consequences,
      pr.character_consequences,
      pr.reported_skills,
      pr.status,
      pr.admin_comment,
      pr.internal_comment,
      pr.created_at,
      pr.updated_at,
      c.user_id,
      u.user as username,
      reviewer.user as reviewed_by_name,
      pr.reviewed_at
    FROM player_reports pr
    JOIN characters c ON pr.character_id = c.id
    JOIN users u ON c.user_id = u.id
    LEFT JOIN users reviewer ON pr.reviewed_by = reviewer.id
    WHERE pr.character_id = ?
    ORDER BY pr.created_at DESC
  `;
  
  pool.query(query, [characterId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania zgłoszeń postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    res.json({ reports: results });
  });
});

router.patch('/admin/reports/:reportId/status', checkAdmin, (req, res) => {
  const { reportId } = req.params;
  const { status, adminComment, internalComment } = req.body;
  const adminId = req.user.id;
  
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Nieprawidłowy status. Dozwolone: accepted, rejected' });
  }
  
  const updateQuery = `
    UPDATE player_reports 
    SET status = ?, 
        admin_comment = ?, 
        internal_comment = ?,
        reviewed_by = ?, 
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = ?
  `;
  
  pool.query(updateQuery, [status, adminComment || null, internalComment || null, adminId, reportId], (err, result) => {
    if (err) {
      console.error('❌ Błąd aktualizacji statusu zgłoszenia:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Zgłoszenie nie zostało znalezione' });
    }
    
    res.json({ 
      message: `Zgłoszenie zostało ${status === 'accepted' ? 'zaakceptowane' : 'odrzucone'}`,
      status: status
    });
  });
});

router.post('/reports/:reportId/resubmit', (req, res) => {
  const userId = req.user.id;
  const { reportId } = req.params;
  const { 
    whatHappened, 
    worldConsequences, 
    characterConsequences, 
    reportedSkills 
  } = req.body;
  
  if (!whatHappened) {
    return res.status(400).json({ message: 'Opis wydarzeń jest wymagany' });
  }
  
  const checkQuery = `
    SELECT pr.id, pr.status, pr.session_type, pr.session_id, pr.character_id
    FROM player_reports pr
    JOIN characters c ON pr.character_id = c.id
    WHERE pr.id = ? AND c.user_id = ? AND pr.status = 'rejected'
  `;
  
  pool.query(checkQuery, [reportId, userId], (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania zgłoszenia:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (results.length === 0) {
      return res.status(403).json({ 
        message: 'Nie można edytować tego zgłoszenia. Zgłoszenie musi być odrzucone i należeć do Twojej postaci.' 
      });
    }
    
    const updateQuery = `
      UPDATE player_reports 
      SET what_happened = ?,
          world_consequences = ?,
          character_consequences = ?,
          reported_skills = ?,
          status = 'pending',
          admin_comment = NULL,
          internal_comment = NULL,
          reviewed_by = NULL,
          reviewed_at = NULL,
          updated_at = NOW()
      WHERE id = ?
    `;
    
    pool.query(updateQuery, [
      whatHappened,
      worldConsequences || null,
      characterConsequences || null,
      reportedSkills || null,
      reportId
    ], (err, result) => {
      if (err) {
        console.error('❌ Błąd ponownego wysyłania zgłoszenia:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      res.json({ 
        message: 'Zgłoszenie zostało ponownie wysłane pomyślnie!',
        id: reportId
      });
    });
  });
});

// ============================================================================
// KARTY POSTACI - AKCEPTACJA (ADMIN)
// ============================================================================

// GET - Pobierz wszystkie karty oczekujące na akceptację
// Do kolejki akceptacji trafia karta niezatwierdzona ALBO taka, przy której
// czeka wada/zaleta WŁAŚCICIELA (np. gracz poprawił odrzuconą pozycję).
// Wpisy administracji i systemowe - konsekwencje z sesji, choroby, czasowe
// wady/zalety nadane przez MG - nie są zgłoszeniem gracza i nie mogą wracać
// zatwierdzonej KP do kolejki. Wcześniej wystarczyła jedna choroba, żeby karta
// znów wyskoczyła "do akceptacji" (kolumna is_approved ma DEFAULT 0, a wpisy
// systemowe jej nie ustawiały) - i to z pozycją, której panel nawet nie
// pokazywał, bo listuje tylko wpisy właściciela.
router.get('/admin/character-cards/pending', checkGameMasterOrAdmin, (req, res) => {
  const query = `
    SELECT
      cc.id,
      cc.character_id,
      cc.first_name,
      cc.last_name,
      cc.age,
      cc.height,
      cc.character_description,
      cc.visual_description,
      cc.additional_info,
      cc.is_approved,
      cc.rejection_reason,
      cc.was_rejected,
      (cc.is_approved = FALSE AND cc.rejection_reason IS NOT NULL) as isRejected,
      (cc.was_rejected = TRUE AND cc.rejection_reason IS NULL) as isResubmitted,
      cc.created_at,
      cc.updated_at,
      c.name as character_name,
      c.avatar as character_avatar,
      c.user_id,
      u.user as owner_name
    FROM character_cards cc
    JOIN characters c ON cc.character_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE cc.is_approved = FALSE
       OR EXISTS (
            SELECT 1 FROM character_achievements ca
            WHERE ca.character_id = cc.character_id AND ca.is_approved = 0
              AND (ca.created_by IS NULL OR ca.created_by = c.user_id)
          )
       OR EXISTS (
            SELECT 1 FROM character_problems cp
            WHERE cp.character_id = cc.character_id AND cp.is_approved = 0
              AND (cp.created_by IS NULL OR cp.created_by = c.user_id)
          )
    ORDER BY cc.updated_at DESC
  `;

  pool.query(query, (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania kart do akceptacji:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (results.length === 0) {
      return res.json({ cards: [] });
    }

    // Dołącz KOMPLET wad/zalet gracza do każdej karty (oczekujące, odrzucone i
    // już zatwierdzone), żeby admin widział całą postać w jednej kolejce - także
    // karty sprzed zmian, których wady/zalety zostały zaakceptowane migracją.
    // Konsekwencje dodane przez administrację (created_by = MG/admin ≠ właściciel)
    // pomijamy - nie są częścią akceptacji KP.
    const charIds = results.map(r => r.character_id);
    const ownerByChar = {};
    results.forEach(r => { ownerByChar[r.character_id] = r.user_id; });
    const isOwnerEntry = (e) => e.created_by === null || e.created_by === ownerByChar[e.character_id];

    pool.query(
      'SELECT * FROM character_achievements WHERE character_id IN (?) ORDER BY id ASC',
      [charIds],
      (e1, achs) => {
        if (e1) return res.status(500).json({ message: 'Błąd serwera' });
        pool.query(
          'SELECT * FROM character_problems WHERE character_id IN (?) ORDER BY id ASC',
          [charIds],
          (e2, probs) => {
            if (e2) return res.status(500).json({ message: 'Błąd serwera' });

            const aByChar = {};
            (achs || []).filter(isOwnerEntry).forEach(a => { (aByChar[a.character_id] = aByChar[a.character_id] || []).push(a); });
            const pByChar = {};
            (probs || []).filter(isOwnerEntry).forEach(p => { (pByChar[p.character_id] = pByChar[p.character_id] || []).push(p); });

            const cards = results.map(c => ({
              ...c,
              cardAchievements: aByChar[c.character_id] || [],
              cardProblems: pByChar[c.character_id] || [],
            }));

            res.json({ cards });
          }
        );
      }
    );
  });
});

// PUT - Zaakceptuj kartę postaci
router.put('/admin/character-cards/:cardId/approve', checkGameMasterOrAdmin, (req, res) => {
  const { cardId } = req.params;
  const { approved } = req.body;
  const adminId = req.user.id;
  
  if (typeof approved !== 'boolean') {
    return res.status(400).json({ message: 'approved musi być boolean' });
  }
  
  // Sprawdź czy karta istnieje
  pool.query('SELECT cc.id, cc.character_id, cc.rejection_reason, c.name as character_name, c.user_id FROM character_cards cc JOIN characters c ON cc.character_id = c.id WHERE cc.id = ?', [cardId], (err, cardResults) => {
    if (err) {
      console.error('❌ Błąd pobierania karty:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (cardResults.length === 0) {
      return res.status(404).json({ message: 'Karta postaci nie znaleziona' });
    }

    const card = cardResults[0];

    if (card.rejection_reason) {
      return res.status(409).json({ message: 'Karta oczekuje na poprawę przez gracza - nie można jej zaakceptować, dopóki nie zostanie ponownie wysłana' });
    }

    // Całej KP nie akceptujemy, dopóki każda wada/zaleta nie jest zatwierdzona.
    // Wcześniej akceptacja karty hurtowo zatwierdzała WSZYSTKIE wpisy gracza -
    // także te przed chwilą odrzucone - więc odrzucenie pozycji nic nie dawało
    // i gracz nigdy nie musiał jej poprawić. Kolejność jest teraz taka:
    // gracz wysyła KP -> admin odrzuca wadę/zaletę -> gracz ją poprawia (co
    // wraca ją do kolejki) -> admin zatwierdza pozycje -> dopiero wtedy KP.
    // Liczymy TYLKO wpisy właściciela (created_by = gracz albo NULL sprzed
    // migracji) - dokładnie te, które panel pokazuje przy karcie. Wpisy
    // administracji/systemu nie są częścią KP, a że wcześniej wpadały tu jako
    // niezatwierdzone (DEFAULT 0), potrafiły zablokować akceptację karty czymś,
    // czego admin w ogóle nie widział na liście.
    const pendingEntriesQuery = `
      SELECT title, was_rejected FROM character_achievements
      WHERE character_id = ? AND is_approved = 0 AND (created_by IS NULL OR created_by = ?)
      UNION ALL
      SELECT title, was_rejected FROM character_problems
      WHERE character_id = ? AND is_approved = 0 AND (created_by IS NULL OR created_by = ?)
    `;

    pool.query(pendingEntriesQuery, [card.character_id, card.user_id, card.character_id, card.user_id], (pendErr, pendingRows) => {
      if (pendErr) {
        console.error('❌ Błąd sprawdzania wad/zalet:', pendErr);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (pendingRows.length > 0) {
        const nazwa = (row) => row.title || 'bez tytułu';
        const odrzucone = pendingRows.filter(row => row.was_rejected).map(nazwa);
        const oczekujace = pendingRows.filter(row => !row.was_rejected).map(nazwa);

        const czesci = [];
        if (odrzucone.length > 0) czesci.push(`odrzucone, czekają na poprawkę gracza: ${odrzucone.join(', ')}`);
        if (oczekujace.length > 0) czesci.push(`niezatwierdzone: ${oczekujace.join(', ')}`);

        return res.status(409).json({
          message: `Nie można zaakceptować KP, dopóki wszystkie wady/zalety nie są zatwierdzone (${czesci.join('; ')}).`
        });
      }

      // Zaakceptuj kartę (wyczyść powód odrzucenia i flagę odrzucenia, ustaw reviewed_by i reviewed_at)
      pool.query(
        'UPDATE character_cards SET is_approved = TRUE, rejection_reason = NULL, was_rejected = FALSE, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?',
        [adminId, cardId],
        (err, updateResult) => {
          if (err) {
            console.error('❌ Błąd akceptacji karty:', err);
            return res.status(500).json({ message: 'Błąd serwera' });
          }

          if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Nie udało się zaakceptować karty' });
          }

          // Logowanie akcji admina
          const logQuery = `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at) VALUES (?, 'CHARACTER_CARD_APPROVE', ?, ?, NOW())`;
          const logDetails = `Zaakceptowano kartę postaci "${card.character_name}" (ID: ${card.character_id})`;

          pool.query(logQuery, [adminId, card.user_id, logDetails], (logErr) => {
            if (logErr) console.error('❌ Błąd zapisywania logu:', logErr);
          });

          // ✅ DODAJ LOG
          addLog(
            card.character_id,
            'card_approved',
            'Twoja karta postaci została zaakceptowana przez administrację! Możesz teraz swobodnie grać.',
            cardId
          );

          console.log(`✅ Admin ID:${adminId} zaakceptował kartę postaci character_id=${card.character_id}`);

          res.json({
            message: `Karta postaci "${card.character_name}" została zaakceptowana`,
            success: true
          });
        }
      );
    });
  });
});

// PUT - Odrzuć kartę postaci z powodem
router.put('/admin/character-cards/:cardId/reject', checkGameMasterOrAdmin, (req, res) => {
  const { cardId } = req.params;
  const { rejection_reason } = req.body;
  const adminId = req.user.id;
  
  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json({ message: 'Powód odrzucenia jest wymagany' });
  }
  
  // Sprawdź czy karta istnieje
  pool.query('SELECT cc.id, cc.character_id, cc.rejection_reason, c.name as character_name, c.user_id FROM character_cards cc JOIN characters c ON cc.character_id = c.id WHERE cc.id = ?', [cardId], (err, cardResults) => {
    if (err) {
      console.error('❌ Błąd pobierania karty:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }

    if (cardResults.length === 0) {
      return res.status(404).json({ message: 'Karta postaci nie znaleziona' });
    }

    const card = cardResults[0];

    if (card.rejection_reason) {
      return res.status(409).json({ message: 'Karta jest już odrzucona i oczekuje na poprawę przez gracza' });
    }

    // Odrzuć kartę (zostaw is_approved = FALSE, dodaj powód, ustaw flagę was_rejected, reviewed_by i reviewed_at)
    pool.query(
      'UPDATE character_cards SET is_approved = FALSE, rejection_reason = ?, was_rejected = TRUE, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?',
      [rejection_reason.trim(), adminId, cardId],
      (err, updateResult) => {
        if (err) {
          console.error('❌ Błąd odrzucenia karty:', err);
          return res.status(500).json({ message: 'Błąd serwera' });
        }

        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ message: 'Nie udało się odrzucić karty' });
        }

        // Logowanie akcji admina
        const logQuery = `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at) VALUES (?, 'CHARACTER_CARD_REJECT', ?, ?, NOW())`;
        const logDetails = `Odrzucono kartę postaci "${card.character_name}" (ID: ${card.character_id}). Powód: ${rejection_reason.trim()}`;

        pool.query(logQuery, [adminId, card.user_id, logDetails], (logErr) => {
          if (logErr) console.error('❌ Błąd zapisywania logu:', logErr);
        });

        // ✅ DODAJ LOG
        addLog(
          card.character_id,
          'card_rejected',
          `Twoja karta postaci została odrzucona. Powód: ${rejection_reason.trim()}`,
          cardId
        );

        console.log(`✅ Admin ID:${adminId} odrzucił kartę postaci character_id=${card.character_id}, powód: ${rejection_reason.trim()}`);

        res.json({
          message: `Karta postaci "${card.character_name}" została odrzucona`,
          success: true
        });
      }
    );
  });
});

// GET - Sprawdź status karty postaci dla gracza (czy jest odrzucona)
router.get('/character-cards/:characterId/status', (req, res) => {
  const { characterId } = req.params;
  const userId = req.user.id;
  
  // Sprawdź czy użytkownik jest właścicielem postaci
  pool.query('SELECT user_id FROM characters WHERE id = ?', [characterId], (err, charResults) => {
    if (err) {
      console.error('❌ Błąd sprawdzania postaci:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    
    if (charResults.length === 0) {
      return res.status(404).json({ message: 'Postać nie znaleziona' });
    }
    
    if (charResults[0].user_id !== userId) {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }
    
    // Pobierz kartę postaci
    pool.query('SELECT is_approved, rejection_reason FROM character_cards WHERE character_id = ?', [characterId], (err, cardResults) => {
      if (err) {
        console.error('❌ Błąd pobierania karty:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }
      
      if (cardResults.length === 0) {
        return res.json({ 
          hasCard: false,
          isApproved: false,
          isRejected: false,
          rejectionReason: null
        });
      }
      
      const card = cardResults[0];
      
      res.json({ 
        hasCard: true,
        isApproved: card.is_approved,
        isRejected: !card.is_approved && card.rejection_reason !== null,
        rejectionReason: card.rejection_reason
      });
    });
  });
});

// ================================
// FORCE LOGOUT UŻYTKOWNIKA (CAŁE KONTO)
// ================================

router.post('/admin/force-logout/:userId', checkGameMasterOrAdmin, (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;

  // Sprawdź czy użytkownik istnieje
  pool.query('SELECT id, user FROM users WHERE id = ?', [userId], (err1, userResults) => {
    if (err1) {
      console.error('❌ Błąd sprawdzania użytkownika:', err1);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony' });
    }

    const username = userResults[0].user;

    // Generuj unikalny token wymuszającego wylogowania
    const crypto = require('crypto');
    const logoutToken = crypto.randomBytes(32).toString('hex');
    
    pool.query(
      'UPDATE users SET force_logout_token = ?, force_logout_reason = ?, force_logout_at = NOW(), last_seen = DATE_SUB(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',  // ✅ DODANE - wyzeruj last_seen
      [logoutToken, reason || 'Wylogowano przez administratora', userId],
      (err2, result) => {
        if (err2) {
          console.error('❌ Błąd wymuszenia wylogowania:', err2);
          return res.status(500).json({ success: false, message: 'Błąd serwera' });
        }

        if (result.affectedRows === 0) {
          return res.status(500).json({ success: false, message: 'Nie udało się wymusić wylogowania' });
        }

        // Logowanie akcji admina
        pool.query(
          `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at)
           VALUES (?, 'FORCE_LOGOUT', ?, ?, NOW())`,
          [
            adminId,
            userId,
            `Wymuszono wylogowanie użytkownika: ${username}. Powód: ${reason || 'Brak powodu'}`
          ],
          (logErr) => {
            if (logErr) console.error('❌ Błąd logowania akcji:', logErr);
          }
        );

        console.log(`✅ Admin ID:${adminId} wymusił wylogowanie użytkownika ID:${userId} (${username})`);

        res.json({ 
          success: true, 
          message: `Użytkownik ${username} został wylogowany`,  // ✅ ZMIENIONE - bez "przy następnym żądaniu"
          logoutToken,
          username
        });
      }
    );
  });
});

// Endpoint do sprawdzania czy użytkownik powinien być wylogowany
router.get('/auth/check-logout-status', verifyToken, (req, res) => {
  const userId = req.user.id;

  pool.query(
    'SELECT force_logout_token, force_logout_reason FROM users WHERE id = ?',
    [userId],
    (err, results) => {
      if (err) {
        console.error('❌ Błąd sprawdzania statusu wylogowania:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }

      if (results.length === 0) {
        return res.json({ shouldLogout: false });
      }

      const { force_logout_token, force_logout_reason } = results[0];

      // Jeśli istnieje token force_logout, użytkownik powinien zostać wylogowany
      if (force_logout_token) {
        return res.json({ 
          shouldLogout: true, 
          reason: force_logout_reason || 'Zostałeś wylogowany przez administratora'
        });
      }

      res.json({ shouldLogout: false });
    }
  );
});

// Endpoint do clearowania force logout po wylogowaniu
router.post('/auth/clear-logout-token', verifyToken, (req, res) => {
  const userId = req.user.id;

  pool.query(
    'UPDATE users SET force_logout_token = NULL, force_logout_reason = NULL, force_logout_at = NULL WHERE id = ?',
    [userId],
    (err) => {
      if (err) {
        console.error('❌ Błąd czyszczenia tokenu wylogowania:', err);
        return res.status(500).json({ success: false });
      }
      
      console.log(`✅ Wyczyszczono token force logout dla użytkownika ID:${userId}`);
      res.json({ success: true });
    }
  );
});

// Lista użytkowników z informacją o force logout (dla admina)
router.get('/admin/users-logout-status', checkGameMasterOrAdmin, (req, res) => {
  pool.query(
    `SELECT 
      id, 
      user as username,  
      email, 
      role,
      force_logout_token IS NOT NULL as is_forced_logout,
      force_logout_reason,
      force_logout_at
    FROM users 
    ORDER BY force_logout_at DESC, user ASC`,  // ✅ POPRAWIONE
    (err, results) => {
      if (err) {
        console.error('❌ Błąd pobierania statusów użytkowników:', err);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }
      
      res.json({ 
        success: true, 
        users: results 
      });
    }
  );
});

// Anuluj force logout (przywróć dostęp)
router.delete('/admin/force-logout/:userId', checkGameMasterOrAdmin, (req, res) => {
  const { userId } = req.params;
  const adminId = req.user.id;

  pool.query('SELECT user FROM users WHERE id = ?', [userId], (err1, userResults) => {  // ✅ POPRAWIONE
    if (err1) {
      console.error('❌ Błąd sprawdzania użytkownika:', err1);
      return res.status(500).json({ success: false, message: 'Błąd serwera' });
    }

    if (userResults.length === 0) {
      return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony' });
    }

    const username = userResults[0].user;  // ✅ POPRAWIONE

    pool.query(
      'UPDATE users SET force_logout_token = NULL, force_logout_reason = NULL, force_logout_at = NULL WHERE id = ?',
      [userId],
      (err2, result) => {
        if (err2) {
          console.error('❌ Błąd anulowania force logout:', err2);
          return res.status(500).json({ success: false, message: 'Błąd serwera' });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Użytkownik nie miał aktywnego force logout' });
        }

        // Logowanie akcji admina
        pool.query(
          `INSERT INTO admin_logs (admin_id, action, target_user_id, details, created_at)
           VALUES (?, 'CANCEL_FORCE_LOGOUT', ?, ?, NOW())`,
          [
            adminId,
            userId,
            `Anulowano force logout użytkownika: ${username}`
          ],
          (logErr) => {
            if (logErr) console.error('❌ Błąd logowania akcji:', logErr);
          }
        );

        console.log(`✅ Admin ID:${adminId} anulował force logout użytkownika ID:${userId} (${username})`);

        res.json({ 
          success: true, 
          message: `Anulowano force logout dla użytkownika ${username}`,
          username
        });
      }
    );
  });
});

// Endpoint do pobierania informacji o graczu (po ID postaci lub user ID)
router.get('/admin/user-info-for-logout/:identifier', checkGameMasterOrAdmin, (req, res) => {
  const { identifier } = req.params;

  // Najpierw sprawdź czy to ID z users czy characters
  pool.query(
    'SELECT id, user, email, role FROM users WHERE id = ?',
    [identifier],
    (err1, userResults) => {
      if (err1) {
        console.error('❌ Błąd sprawdzania users:', err1);
        return res.status(500).json({ success: false, message: 'Błąd serwera' });
      }

      if (userResults.length > 0) {
        // To jest user ID - pobierz dane
        const user = userResults[0];
        
        // Pobierz wszystkie postacie gracza
        pool.query(
          'SELECT id, name, race, faction FROM characters WHERE user_id = ?',
          [user.id],
          (err2, charResults) => {
            if (err2) {
              console.error('❌ Błąd pobierania postaci:', err2);
              return res.status(500).json({ success: false, message: 'Błąd serwera' });
            }

            return res.json({
              success: true,
              userId: user.id,
              username: user.user,
              email: user.email,
              role: user.role,
              characters: charResults
            });
          }
        );
      } else {
        // Nie znaleziono w users, sprawdź czy to ID postaci
        pool.query(
          `SELECT 
            c.user_id,
            u.user as username,  
            u.email,
            u.role
          FROM characters c
          JOIN users u ON c.user_id = u.id
          WHERE c.id = ?`,
          [identifier],
          (err3, charResults) => {
            if (err3) {
              console.error('❌ Błąd sprawdzania characters:', err3);
              return res.status(500).json({ success: false, message: 'Błąd serwera' });
            }

            if (charResults.length === 0) {
              return res.status(404).json({ 
                success: false, 
                message: 'Nie znaleziono gracza ani postaci o podanym ID' 
              });
            }

            const userData = charResults[0];
            
            // Pobierz wszystkie postacie tego gracza
            pool.query(
              'SELECT id, name, race, faction FROM characters WHERE user_id = ?',
              [userData.user_id],
              (err4, allChars) => {
                if (err4) {
                  console.error('❌ Błąd pobierania postaci:', err4);
                  return res.status(500).json({ success: false, message: 'Błąd serwera' });
                }

                return res.json({
                  success: true,
                  userId: userData.user_id,
                  username: userData.username,
                  email: userData.email,
                  role: userData.role,
                  characters: allChars
                });
              }
            );
          }
        );
      }
    }
  );
});

// ================================
// ZARZĄDZANIE POKOJAMI TAWERNY
// ================================

// Pobierz wszystkie pokoje tawerny z ich statusami
router.get('/admin/tavern-rooms', checkAdmin, (req, res) => {
  const query = `
    SELECT
      tr.id,
      tr.name,
      tr.description,
      tr.is_active,
      tr.required_faction,
      COUNT(DISTINCT tau.user_id) as active_users_count
    FROM tavern_rooms tr
    LEFT JOIN tavern_active_users tau ON tr.id = tau.room_id
    GROUP BY tr.id, tr.name, tr.description, tr.is_active, tr.required_faction
    ORDER BY tr.id ASC
  `;

  pool.query(query, (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania pokoi tawerny:', err);
      return res.status(500).json({
        success: false,
        message: 'Błąd serwera podczas pobierania pokoi'
      });
    }

    res.status(200).json({
      success: true,
      rooms: results
    });
  });
});

// Toggle is_active dla pokoju (blokowanie/odblokowanie)
router.patch('/admin/tavern-rooms/:roomId/toggle', checkAdmin, (req, res) => {
  const { roomId } = req.params;
  const adminId = req.user.id;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'ID pokoju jest wymagane'
    });
  }

  // Najpierw pobierz obecny status pokoju
  pool.query('SELECT id, name, is_active FROM tavern_rooms WHERE id = ?', [roomId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania pokoju:', err);
      return res.status(500).json({
        success: false,
        message: 'Błąd serwera'
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: 'Pokój nie znaleziony'
      });
    }

    const room = results[0];
    const newStatus = !room.is_active;

    // Zaktualizuj status pokoju
    pool.query(
      'UPDATE tavern_rooms SET is_active = ? WHERE id = ?',
      [newStatus, roomId],
      (err2) => {
        if (err2) {
          console.error('❌ Błąd aktualizacji statusu pokoju:', err2);
          return res.status(500).json({
            success: false,
            message: 'Błąd podczas aktualizacji statusu pokoju'
          });
        }

        // Dodaj log admina
        const adminLogQuery = `
          INSERT INTO admin_logs
          (admin_id, action, target_user_id, details, created_at)
          VALUES (?, 'TAVERN_ROOM_TOGGLE', NULL, ?, NOW())
        `;
        const logDetails = `${newStatus ? 'Aktywowano' : 'Zablokowano'} pokój tawerny "${room.name}" (ID: ${roomId})`;

        pool.query(adminLogQuery, [adminId, logDetails], (logErr) => {
          if (logErr) console.error('❌ Błąd zapisywania logu admina:', logErr);
        });

        console.log(`✅ Admin ID:${adminId} ${newStatus ? 'aktywował' : 'zablokował'} pokój "${room.name}" (ID: ${roomId})`);

        res.json({
          success: true,
          message: `Pokój "${room.name}" został ${newStatus ? 'aktywowany' : 'zablokowany'}`,
          room: {
            id: roomId,
            name: room.name,
            is_active: newStatus
          }
        });
      }
    );
  });
});

// Edycja nazwy, opisu i rasy pokoju
router.put('/admin/tavern-rooms/:roomId', checkAdmin, (req, res) => {
  const { roomId } = req.params;
  const { name, description, required_faction } = req.body;
  const adminId = req.user.id;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'ID pokoju jest wymagane'
    });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nazwa pokoju nie może być pusta'
    });
  }

  // Sprawdź czy pokój istnieje
  pool.query('SELECT id, name FROM tavern_rooms WHERE id = ?', [roomId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania pokoju:', err);
      return res.status(500).json({
        success: false,
        message: 'Błąd serwera'
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: 'Pokój nie znaleziony'
      });
    }

    const oldRoomName = results[0].name;

    // Aktualizuj pokój (teraz z required_faction)
    pool.query(
      'UPDATE tavern_rooms SET name = ?, description = ?, required_faction = ? WHERE id = ?',
      [name.trim(), description || '', required_faction || null, roomId],
      (err2) => {
        if (err2) {
          console.error('❌ Błąd aktualizacji pokoju:', err2);
          return res.status(500).json({
            success: false,
            message: 'Błąd podczas aktualizacji pokoju'
          });
        }

        // Dodaj log admina
        const adminLogQuery = `
          INSERT INTO admin_logs
          (admin_id, action, target_user_id, details, created_at)
          VALUES (?, 'TAVERN_ROOM_EDIT', NULL, ?, NOW())
        `;
        const logDetails = `Edytowano pokój tawerny "${oldRoomName}" -> "${name.trim()}" (ID: ${roomId})`;

        pool.query(adminLogQuery, [adminId, logDetails], (logErr) => {
          if (logErr) console.error('❌ Błąd zapisywania logu admina:', logErr);
        });

        console.log(`✅ Admin ID:${adminId} edytował pokój "${oldRoomName}" -> "${name.trim()}" (ID: ${roomId})`);

        res.json({
          success: true,
          message: `Pokój "${name.trim()}" został zaktualizowany pomyślnie`,
          room: {
            id: roomId,
            name: name.trim(),
            description: description || '',
            required_faction: required_faction || null
          }
        });
      }
    );
  });
});

// Wyrzuć wszystkich graczy z pokoju (opcjonalnie)
router.post('/admin/tavern-rooms/:roomId/kick-all', checkAdmin, (req, res) => {
  const { roomId } = req.params;
  const adminId = req.user.id;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'ID pokoju jest wymagane'
    });
  }

  // Sprawdź czy pokój istnieje i pobierz nazwę
  pool.query('SELECT id, name FROM tavern_rooms WHERE id = ?', [roomId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania pokoju:', err);
      return res.status(500).json({
        success: false,
        message: 'Błąd serwera'
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: 'Pokój nie znaleziony'
      });
    }

    const roomName = results[0].name;

    // Usuń wszystkich użytkowników z pokoju
    pool.query('DELETE FROM tavern_active_users WHERE room_id = ?', [roomId], (err2, deleteResults) => {
      if (err2) {
        console.error('❌ Błąd usuwania użytkowników z pokoju:', err2);
        return res.status(500).json({
          success: false,
          message: 'Błąd podczas usuwania użytkowników z pokoju'
        });
      }

      const kickedCount = deleteResults.affectedRows;

      // Dodaj log admina
      const adminLogQuery = `
        INSERT INTO admin_logs
        (admin_id, action, target_user_id, details, created_at)
        VALUES (?, 'TAVERN_ROOM_KICK_ALL', NULL, ?, NOW())
      `;
      const logDetails = `Wyrzucono wszystkich graczy (${kickedCount}) z pokoju "${roomName}" (ID: ${roomId})`;

      pool.query(adminLogQuery, [adminId, logDetails], (logErr) => {
        if (logErr) console.error('❌ Błąd zapisywania logu admina:', logErr);
      });

      console.log(`✅ Admin ID:${adminId} wyrzucił ${kickedCount} graczy z pokoju "${roomName}" (ID: ${roomId})`);

      res.json({
        success: true,
        message: `Wyrzucono ${kickedCount} graczy z pokoju "${roomName}"`,
        kickedCount
      });
    });
  });
});

// Dodaj nowy pokój do tawerny
router.post('/admin/tavern-rooms', checkAdmin, (req, res) => {
  const { name, description, required_faction } = req.body;
  const adminId = req.user.id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Nazwa pokoju jest wymagana'
    });
  }

  // Sprawdź czy pokój o takiej nazwie już istnieje
  pool.query('SELECT id FROM tavern_rooms WHERE name = ?', [name.trim()], (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania pokoju:', err);
      return res.status(500).json({
        success: false,
        message: 'Błąd serwera'
      });
    }

    if (results.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Pokój o takiej nazwie już istnieje'
      });
    }

    // Dodaj nowy pokój
    pool.query(
      'INSERT INTO tavern_rooms (name, description, required_faction, is_active) VALUES (?, ?, ?, ?)',
      [name.trim(), description || '', required_faction || null, true],
      (err2, insertResult) => {
        if (err2) {
          console.error('❌ Błąd dodawania pokoju:', err2);
          return res.status(500).json({
            success: false,
            message: 'Błąd podczas dodawania pokoju'
          });
        }

        const newRoomId = insertResult.insertId;

        // Dodaj log admina
        const adminLogQuery = `
          INSERT INTO admin_logs
          (admin_id, action, target_user_id, details, created_at)
          VALUES (?, 'TAVERN_ROOM_CREATE', NULL, ?, NOW())
        `;
        const logDetails = `Utworzono nowy pokój tawerny "${name.trim()}" (ID: ${newRoomId})`;

        pool.query(adminLogQuery, [adminId, logDetails], (logErr) => {
          if (logErr) console.error('❌ Błąd zapisywania logu admina:', logErr);
        });

        console.log(`✅ Admin ID:${adminId} utworzył pokój "${name.trim()}" (ID: ${newRoomId})`);

        res.json({
          success: true,
          message: `Pokój "${name.trim()}" został utworzony pomyślnie`,
          room: {
            id: newRoomId,
            name: name.trim(),
            description: description || '',
            required_faction: required_faction || null,
            is_active: true
          }
        });
      }
    );
  });
});

// Usuń pokój z tawerny
router.delete('/admin/tavern-rooms/:roomId', checkAdmin, (req, res) => {
  const { roomId } = req.params;
  const adminId = req.user.id;

  if (!roomId) {
    return res.status(400).json({
      success: false,
      message: 'ID pokoju jest wymagane'
    });
  }

  // Sprawdź czy pokój istnieje i pobierz nazwę
  pool.query('SELECT id, name FROM tavern_rooms WHERE id = ?', [roomId], (err, results) => {
    if (err) {
      console.error('❌ Błąd pobierania pokoju:', err);
      return res.status(500).json({
        success: false,
        message: 'Błąd serwera'
      });
    }

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: 'Pokój nie znaleziony'
      });
    }

    const roomName = results[0].name;

    // Najpierw usuń wszystkich użytkowników z pokoju
    pool.query('DELETE FROM tavern_active_users WHERE room_id = ?', [roomId], (err2) => {
      if (err2) {
        console.error('❌ Błąd usuwania użytkowników z pokoju:', err2);
        return res.status(500).json({
          success: false,
          message: 'Błąd podczas usuwania użytkowników z pokoju'
        });
      }

      // Usuń wiadomości z pokoju
      pool.query('DELETE FROM tavern_messages WHERE room_id = ?', [roomId], (err3) => {
        if (err3) {
          console.error('❌ Błąd usuwania wiadomości z pokoju:', err3);
          return res.status(500).json({
            success: false,
            message: 'Błąd podczas usuwania wiadomości z pokoju'
          });
        }

        // Usuń pokój
        pool.query('DELETE FROM tavern_rooms WHERE id = ?', [roomId], (err4) => {
          if (err4) {
            console.error('❌ Błąd usuwania pokoju:', err4);
            return res.status(500).json({
              success: false,
              message: 'Błąd podczas usuwania pokoju'
            });
          }

          // Dodaj log admina
          const adminLogQuery = `
            INSERT INTO admin_logs
            (admin_id, action, target_user_id, details, created_at)
            VALUES (?, 'TAVERN_ROOM_DELETE', NULL, ?, NOW())
          `;
          const logDetails = `Usunięto pokój tawerny "${roomName}" (ID: ${roomId})`;

          pool.query(adminLogQuery, [adminId, logDetails], (logErr) => {
            if (logErr) console.error('❌ Błąd zapisywania logu admina:', logErr);
          });

          console.log(`✅ Admin ID:${adminId} usunął pokój "${roomName}" (ID: ${roomId})`);

          res.json({
            success: true,
            message: `Pokój "${roomName}" został usunięty pomyślnie`
          });
        });
      });
    });
  });
});

// POST /admin/send-mass-email - Wyślij email do wszystkich graczy
router.post('/admin/send-mass-email', verifyToken, checkAdmin, async (req, res) => {
  const { subject, body } = req.body;

  if (!subject || !subject.trim()) {
    return res.status(400).json({ message: 'Temat wiadomości jest wymagany.' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ message: 'Treść wiadomości jest wymagana.' });
  }

  pool.query(
    `SELECT id, user, email FROM users WHERE email IS NOT NULL AND email != '' AND (blocked_until IS NULL OR blocked_until < NOW())`,
    [],
    async (err, users) => {
      if (err) {
        console.error('Błąd pobierania użytkowników:', err);
        return res.status(500).json({ message: 'Błąd serwera' });
      }

      if (users.length === 0) {
        return res.json({ sent: 0, failed: 0, total: 0 });
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.SMTP_HOST || !process.env.SMTP_PORT) {
        console.error('Brak konfiguracji SMTP w pliku .env!');
        return res.status(500).json({ message: 'Błąd serwera - konfiguracja SMTP' });
      }

      const transporter = createSmtpTransporter();
      const gameName = await getGameName(pool);
      let sent = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await new Promise((resolve, reject) => {
            transporter.sendMail({
              from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
              to: user.email,
              subject: subject.trim(),
              html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a1a2e; padding: 20px; text-align: center; border-bottom: 3px solid #ffa726;">
                  <h1 style="color: #ffa726; margin: 0;">${gameName}</h1>
                </div>
                <div style="padding: 24px; background: #16213e; color: #e0e0e0;">
                  ${body}
                </div>
                <div style="padding: 12px; background: #0f3460; text-align: center; font-size: 12px; color: #aaa;">
                  Ta wiadomość została wysłana do gracza ${user.user} serwisu ${gameName}
                </div>
              </div>`,
            }, (err) => (err ? reject(err) : resolve()));
          });
          sent++;
        } catch (emailErr) {
          console.error(`Błąd wysyłania emaila do ${user.email}:`, emailErr);
          failed++;
        }
      }

      console.log(`📧 Mass email: wysłano ${sent}/${users.length}, błędy: ${failed}`);
      res.json({ sent, failed, total: users.length });
    }
  );
});

module.exports = { router, initialize };