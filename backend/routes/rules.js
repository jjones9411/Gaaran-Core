// ================================
// routes/rules.js
// Zarządzanie zasadami
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
function checkRulePermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    const userRole = results[0]?.role || 'mieszkaniec';
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  });
}

// GET: Lista zasad
router.get('/rules', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      'SELECT * FROM rules ORDER BY created_at DESC LIMIT 50'
    );
    res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('❌ Błąd pobierania zasad:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie zasady
router.post('/rules', checkRulePermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.promise().query(
      'INSERT INTO rules (title, description, image_path, created_at) VALUES (?, ?, ?, NOW())',
      [title, description, imagePath]
    );
    if (!result.insertId) {
      return res.status(500).json({ error: 'Nie udało się dodać zasady' });
    }
    const [newRows] = await pool.promise().query('SELECT * FROM rules WHERE id = ?', [result.insertId]);
    res.status(201).json(newRows[0] || {});
  } catch (err) {
    console.error('❌ Błąd dodawania zasady:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja zasady
router.put('/rules/:id', checkRulePermissions, upload.single('image'), async (req, res) => {
  try {
    const id = req.params.id;
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    let query = 'UPDATE rules SET title = ?, description = ?';
    const params = [title, description];
    if (imagePath) {
      query += ', image_path = ?';
      params.push(imagePath);
    }
    query += ' WHERE id = ?';
    params.push(id);

    const [updateInfo] = await pool.promise().query(query, params);
    if (updateInfo.affectedRows === 0) {
      return res.status(404).json({ error: 'Zasada nie znaleziona' });
    }
    const [rows] = await pool.promise().query('SELECT * FROM rules WHERE id = ?', [id]);
    res.status(200).json(rows[0] || {});
  } catch (err) {
    console.error('❌ Błąd edycji zasady:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie zasady
router.delete('/rules/:id', checkRulePermissions, async (req, res) => {
  try {
    const id = req.params.id;
    const [delInfo] = await pool.promise().query('DELETE FROM rules WHERE id = ?', [id]);
    if (delInfo.affectedRows === 0) {
      return res.status(404).json({ error: 'Zasada nie znaleziona' });
    }
    res.status(200).json({ message: 'Zasada usunięta' });
  } catch (err) {
    console.error('❌ Błąd usuwania zasady:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) jako JSON, nie HTML -
// front czyta z odpowiedzi `message`.
router.use(handleUploadErrors);

module.exports = { router, initialize };