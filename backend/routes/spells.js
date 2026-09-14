// ================================
// routes/spells.js
// Zarządzanie zaklęciami
// ================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage, imageFileFilter, handleUploadErrors } = require('../utils/uploadStorage');

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// MULTER CONFIG
// Storage (katalog uploads/ + nazwa pliku) i allowlista formatów są wspólne
// dla całego backendu - patrz utils/uploadStorage.js.

const upload = multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// MIDDLEWARE - admin/mistrz_gry
function checkSpellPermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    const userRole = results[0]?.role || 'mieszkaniec';
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  });
}

// GET: Lista zaklęć
router.get('/spells', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM spells ORDER BY created_at DESC LIMIT 50'
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania zaklęć:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie zaklęcia
router.post('/spells', checkSpellPermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.promise().query(
      'INSERT INTO spells (title, description, image_path, created_at) VALUES (?, ?, ?, NOW())',
      [title, description, image]
    );
    if (!result.insertId) {
      return res.status(500).json({ error: 'Nie udało się dodać zaklęcia' });
    }
    const [newSpell] = await pool.promise().query('SELECT * FROM spells WHERE id = ?', [result.insertId]);
    res.status(201).json(newSpell[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania zaklęcia:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja zaklęcia
router.put('/spells/:id', checkSpellPermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    let query = 'UPDATE spells SET title = ?, description = ?';
    const params = [title, description];
    if (image) {
      query += ', image_path = ?';
      params.push(image);
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);
    
    const [updateResult] = await pool.promise().query(query, params);
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Zaklęcie nie znalezione' });
    }
    const [updatedSpell] = await pool.promise().query('SELECT * FROM spells WHERE id = ?', [req.params.id]);
    res.status(200).json(updatedSpell[0]);
  } catch (error) {
    console.error('❌ Błąd edycji zaklęcia:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie zaklęcia
router.delete('/spells/:id', checkSpellPermissions, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM spells WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Zaklęcie nie znalezione' });
    }
    res.status(200).json({ message: 'Zaklęcie usunięte' });
  } catch (error) {
    console.error('❌ Błąd usuwania zaklęcia:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) jako JSON, nie HTML -
// front czyta z odpowiedzi `message`.
router.use(handleUploadErrors);

module.exports = { router, initialize };