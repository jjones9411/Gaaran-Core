// ================================
// routes/infos.js
// System wieści (infos + infos2)
// ================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage, imageFileFilter, handleUploadErrors } = require('../utils/uploadStorage');

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// ================================
// MULTER CONFIG
// ================================

// Storage (katalog uploads/ + nazwa pliku) i allowlista formatów są wspólne
// dla całego backendu - patrz utils/uploadStorage.js.

const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ================================
// MIDDLEWARE - sprawdź admina
// ================================

function checkAdmin(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: 'Błąd serwera' });
    if (!results[0] || results[0].role !== 'admin') {
      return res.status(403).json({ message: 'Brak uprawnień administratora' });
    }
    next();
  });
}

// ================================
// INFOS (tabela infos)
// ================================

// GET: Pobieranie wieści (publiczny - wymaga tylko tokena)
router.get('/infos', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM infos ORDER BY created_at DESC LIMIT 50'
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania infos:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie wieści
router.post('/infos', checkAdmin, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Tytuł i treść są wymagane' });
    }

    const [result] = await pool.promise().query(
      'INSERT INTO infos (title, content, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [title, content]
    );

    const [newInfo] = await pool.promise().query('SELECT * FROM infos WHERE id = ?', [result.insertId]);
    res.status(201).json(newInfo[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania infos:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja wieści
router.put('/infos/:id', checkAdmin, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Tytuł i treść są wymagane' });
    }

    const [updateResult] = await pool.promise().query(
      'UPDATE infos SET title = ?, content = ?, updated_at = NOW() WHERE id = ?',
      [title, content, req.params.id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Wieść nie znaleziona' });
    }

    const [updatedInfo] = await pool.promise().query('SELECT * FROM infos WHERE id = ?', [req.params.id]);
    res.status(200).json(updatedInfo[0]);
  } catch (error) {
    console.error('❌ Błąd edycji infos:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie wieści
router.delete('/infos/:id', checkAdmin, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM infos WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Wieść nie znaleziona' });
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Błąd usuwania infos:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ================================
// INFOS2 (tabela infos2 z obrazkami)
// ================================

// GET: Pobieranie wieści z infos2
router.get('/infos2', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM infos2 ORDER BY created_at DESC LIMIT 50'
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania infos2:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie wieści do infos2 (z obrazkiem)
router.post('/infos2', checkAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !content) {
      return res.status(400).json({ error: 'Tytuł i treść są wymagane' });
    }

    const [result] = await pool.promise().query(
      'INSERT INTO infos2 (title, content, image_path, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [title, content, imagePath]
    );

    const [newRow] = await pool.promise().query('SELECT * FROM infos2 WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania infos2:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja wieści w infos2 (z opcjonalnym nowym obrazkiem)
router.put('/infos2/:id', checkAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !content) {
      return res.status(400).json({ error: 'Tytuł i treść są wymagane' });
    }

    const fields = ['title = ?', 'content = ?', 'updated_at = NOW()'];
    const values = [title, content];

    if (imagePath) {
      fields.push('image_path = ?');
      values.push(imagePath);
    }

    values.push(req.params.id);

    const [result] = await pool.promise().query(
      `UPDATE infos2 SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Wieść nie znaleziona' });
    }

    const [updated] = await pool.promise().query('SELECT * FROM infos2 WHERE id = ?', [req.params.id]);
    res.status(200).json(updated[0]);
  } catch (error) {
    console.error('❌ Błąd edycji infos2:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie wieści z infos2
router.delete('/infos2/:id', checkAdmin, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM infos2 WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Wieść nie znaleziona' });
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Błąd usuwania infos2:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) jako JSON, nie HTML -
// front czyta z odpowiedzi `message`.
router.use(handleUploadErrors);

module.exports = { router, initialize };