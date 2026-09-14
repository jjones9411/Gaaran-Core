// ================================
// routes/news.js
// Wieści z komentarzami
// ================================

const express = require('express');
const router = express.Router();

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// MIDDLEWARE - mistrz gry lub admin (dla newsów)
async function checkGameMasterOrAdmin(req, res, next) {
  try {
    const [results] = await pool.promise().query(
      'SELECT role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!results[0] || (results[0].role !== 'admin' && results[0].role !== 'mistrz_gry')) {
      return res.status(403).json({ error: 'Brak uprawnień - wymagana rola mistrza gry lub admina' });
    }

    // Dodaj role do req.user
    req.user.role = results[0].role;
    next();
  } catch (error) {
    console.error('❌ Błąd sprawdzania uprawnień:', error);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}

// MIDDLEWARE - pobierz rolę użytkownika (dla komentarzy)
async function attachUserRole(req, res, next) {
  try {
    const [results] = await pool.promise().query(
      'SELECT role FROM users WHERE id = ?', 
      [req.user.id]
    );
    
    if (!results[0]) {
      return res.status(404).json({ error: 'Nie znaleziono użytkownika' });
    }
    
    req.user.role = results[0].role;
    next();
  } catch (error) {
    console.error('❌ Błąd pobierania roli:', error);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}

// ================================
// NEWS - CRUD
// ================================

// GET: Publiczne wieści bez autoryzacji (dla strony logowania)
router.get('/news/public', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      `SELECT id, title, content, created_at FROM news
       WHERE archived = FALSE
       AND (visible_to IS NULL OR visible_to = '[]')
       ORDER BY created_at DESC LIMIT 11`
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania publicznych wieści:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET: Lista wieści (niearchiwizowane) - z filtrowaniem po rasy
router.get('/news', attachUserRole, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userFaction = req.user.characterFaction;

    // Admin i mistrz gry widzą wszystko
    if (userRole === 'admin' || userRole === 'mistrz_gry') {
      const [results] = await pool.promise().query(
        'SELECT * FROM news WHERE archived = FALSE ORDER BY created_at DESC LIMIT 50'
      );
      return res.status(200).json(results);
    }

    // Mieszkaniec widzi:
    // - News gdzie visible_to IS NULL (dla wszystkich)
    // - News gdzie jego rasa jest w visible_to (JSON array)
    const [results] = await pool.promise().query(
      `SELECT * FROM news
       WHERE archived = FALSE
       AND (
         visible_to IS NULL
         OR visible_to = '[]'
         OR JSON_CONTAINS(visible_to, ?)
       )
       ORDER BY created_at DESC LIMIT 50`,
      [JSON.stringify(userFaction)]
    );

    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania wieści:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie wieści (mistrz gry lub admin)
router.post('/news', checkGameMasterOrAdmin, async (req, res) => {
  try {
    const { title, content, visible_to } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Tytuł i treść są wymagane' });
    }

    // visible_to może być: null (dla wszystkich), [] (dla wszystkich), lub ["RASA_2", "RASA_1"]
    const visibleToValue = visible_to && visible_to.length > 0 ? JSON.stringify(visible_to) : null;

    const [result] = await pool.promise().query(
      'INSERT INTO news (title, content, visible_to, created_at) VALUES (?, ?, ?, NOW())',
      [title, content, visibleToValue]
    );

    if (!result.insertId) {
      return res.status(500).json({ error: 'Nie udało się dodać wieści' });
    }

    const [newNews] = await pool.promise().query('SELECT * FROM news WHERE id = ?', [result.insertId]);
    res.status(201).json(newNews[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania wieści:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja wieści (mistrz gry lub admin)
router.put('/news/:id', checkGameMasterOrAdmin, async (req, res) => {
  try {
    const { title, content, visible_to } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Tytuł i treść są wymagane' });
    }

    // visible_to może być: null (dla wszystkich), [] (dla wszystkich), lub ["RASA_2", "RASA_1"]
    const visibleToValue = visible_to && visible_to.length > 0 ? JSON.stringify(visible_to) : null;

    const [updateResult] = await pool.promise().query(
      'UPDATE news SET title = ?, content = ?, visible_to = ? WHERE id = ?',
      [title, content, visibleToValue, req.params.id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wieści' });
    }

    const [updatedNews] = await pool.promise().query('SELECT * FROM news WHERE id = ?', [req.params.id]);
    res.status(200).json(updatedNews[0]);
  } catch (error) {
    console.error('❌ Błąd edycji wieści:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Archiwizacja wieści (mistrz gry lub admin)
router.post('/news/archive/:id', checkGameMasterOrAdmin, async (req, res) => {
  try {
    const [updateResult] = await pool.promise().query(
      'UPDATE news SET archived = TRUE WHERE id = ?',
      [req.params.id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wieści' });
    }

    res.status(200).json({ message: 'Wieść zarchiwizowana' });
  } catch (error) {
    console.error('❌ Błąd archiwizacji:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie wieści (mistrz gry lub admin)
router.delete('/news/:id', checkGameMasterOrAdmin, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM news WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wieści' });
    }

    res.status(200).json({ message: 'Wieść usunięta' });
  } catch (error) {
    console.error('❌ Błąd usuwania wieści:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ================================
// KOMENTARZE DO WIEŚCI
// ================================

// GET: Liczba komentarzy dla wszystkich wieści
router.get('/news/comments/count', async (req, res) => {
  try {
    const [results] = await pool.promise().query(`
      SELECT news_id, COUNT(*) as count 
      FROM news_comments 
      WHERE deleted_at IS NULL 
      GROUP BY news_id
    `);
    
    const counts = {};
    results.forEach(row => {
      counts[row.news_id] = parseInt(row.count);
    });
    
    res.status(200).json(counts);
  } catch (error) {
    console.error('❌ Błąd pobierania liczby komentarzy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET: Komentarze dla konkretnej wieści
router.get('/news/:newsId/comments', async (req, res) => {
  try {
    const { newsId } = req.params;

    const [newsCheck] = await pool.promise().query(
      'SELECT id FROM news WHERE id = ? AND archived = FALSE',
      [newsId]
    );

    if (newsCheck.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wieści' });
    }

    const [results] = await pool.promise().query(`
      SELECT
        nc.id,
        nc.content,
        nc.created_at,
        nc.character_id as author_id,
        c.name as author_name
      FROM news_comments nc
      JOIN characters c ON nc.character_id = c.id
      WHERE nc.news_id = ? AND nc.deleted_at IS NULL
      ORDER BY nc.created_at ASC
    `, [newsId]);

    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania komentarzy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie komentarza
router.post('/news/:newsId/comments', async (req, res) => {
  try {
    const { newsId } = req.params;
    const { content } = req.body;
    const characterId = req.user.characterId;

    if (!characterId) {
      return res.status(400).json({ error: 'Nie wybrano postaci' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Treść komentarza jest wymagana' });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({ error: 'Komentarz nie może być dłuższy niż 1000 znaków' });
    }

    // Sprawdź czy news istnieje
    const [newsCheck] = await pool.promise().query(
      'SELECT id FROM news WHERE id = ? AND archived = FALSE',
      [newsId]
    );

    if (newsCheck.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wieści' });
    }

    // Pobierz character i jego user_id
    const [characterCheck] = await pool.promise().query(
      'SELECT id, name, user_id FROM characters WHERE id = ?',
      [characterId]
    );

    if (characterCheck.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono postaci' });
    }

    const character = characterCheck[0];
    const userId = character.user_id; // <--- TO JEST KLUCZOWE!

    if (!userId) {
      return res.status(400).json({ error: 'Postać nie ma przypisanego użytkownika' });
    }

    // Dodaj komentarz Z user_id
    const [result] = await pool.promise().query(`
      INSERT INTO news_comments (news_id, character_id, user_id, content, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [newsId, characterId, userId, content.trim()]);

    if (!result.insertId) {
      return res.status(500).json({ error: 'Nie udało się dodać komentarza' });
    }

    // Pobierz nowy komentarz
    const [newComment] = await pool.promise().query(`
      SELECT
        nc.id,
        nc.content,
        nc.created_at,
        nc.character_id as author_id,
        c.name as author_name
      FROM news_comments nc
      JOIN characters c ON nc.character_id = c.id
      WHERE nc.id = ?
    `, [result.insertId]);

    res.status(201).json(newComment[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania komentarza:', error);
    
    // Dodaj bardziej szczegółowe logowanie błędów
    if (error.code === 'ER_NO_DEFAULT_FOR_FIELD') {
      console.error('Szczegóły błędu:', {
        sqlMessage: error.sqlMessage,
        sql: error.sql
      });
      return res.status(500).json({ 
        error: 'Błąd bazy danych',
        details: 'Brakuje wymaganego pola w tabeli komentarzy'
      });
    }
    
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie komentarza (soft delete)
router.delete('/news/:newsId/comments/:commentId', attachUserRole, async (req, res) => {
  try {
    const { newsId, commentId } = req.params;
    const characterId = req.user.characterId;
    const userRole = req.user.role;

    const [commentCheck] = await pool.promise().query(`
      SELECT nc.*, c.name as author_name
      FROM news_comments nc
      JOIN characters c ON nc.character_id = c.id
      WHERE nc.id = ? AND nc.news_id = ? AND nc.deleted_at IS NULL
    `, [commentId, newsId]);

    if (commentCheck.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono komentarza' });
    }

    const comment = commentCheck[0];

    if (userRole !== 'admin' && comment.character_id !== characterId) {
      return res.status(403).json({ error: 'Brak uprawnień do usunięcia tego komentarza' });
    }

    const [updateResult] = await pool.promise().query(`
      UPDATE news_comments
      SET deleted_at = NOW()
      WHERE id = ? AND news_id = ?
    `, [commentId, newsId]);

    if (updateResult.affectedRows === 0) {
      return res.status(500).json({ error: 'Nie udało się usunąć komentarza' });
    }

    res.status(200).json({
      message: 'Komentarz usunięty',
      deleted_by: userRole === 'admin' ? 'admin' : 'author'
    });
  } catch (error) {
    console.error('❌ Błąd usuwania komentarza:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja komentarza
router.put('/news/:newsId/comments/:commentId', attachUserRole, async (req, res) => {
  try {
    const { newsId, commentId } = req.params;
    const { content } = req.body;
    const characterId = req.user.characterId;
    const userRole = req.user.role;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Treść komentarza jest wymagana' });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({ error: 'Komentarz nie może być dłuższy niż 1000 znaków' });
    }

    const [commentCheck] = await pool.promise().query(`
      SELECT * FROM news_comments
      WHERE id = ? AND news_id = ? AND deleted_at IS NULL
    `, [commentId, newsId]);

    if (commentCheck.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono komentarza' });
    }

    const comment = commentCheck[0];

    if (userRole !== 'admin' && comment.character_id !== characterId) {
      return res.status(403).json({ error: 'Brak uprawnień do edycji tego komentarza' });
    }

    const commentAge = new Date() - new Date(comment.created_at);
    const fifteenMinutes = 15 * 60 * 1000;

    if (userRole !== 'admin' && commentAge > fifteenMinutes) {
      return res.status(403).json({ error: 'Można edytować komentarz tylko w ciągu 15 minut od publikacji' });
    }

    const [updateResult] = await pool.promise().query(`
      UPDATE news_comments
      SET content = ?, updated_at = NOW()
      WHERE id = ? AND news_id = ?
    `, [content.trim(), commentId, newsId]);

    if (updateResult.affectedRows === 0) {
      return res.status(500).json({ error: 'Nie udało się zaktualizować komentarza' });
    }

    const [updatedComment] = await pool.promise().query(`
      SELECT
        nc.id,
        nc.content,
        nc.created_at,
        nc.updated_at,
        nc.character_id as author_id,
        c.name as author_name
      FROM news_comments nc
      JOIN characters c ON nc.character_id = c.id
      WHERE nc.id = ?
    `, [commentId]);

    res.status(200).json(updatedComment[0]);
  } catch (error) {
    console.error('❌ Błąd edycji komentarza:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = { router, initialize };