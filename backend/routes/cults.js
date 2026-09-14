// ================================
// routes/cults.js
// Zarządzanie kultami
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
function checkCultPermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    const userRole = results[0]?.role || 'mieszkaniec';
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  });
}

// GET: Lista kultów
router.get('/cults', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM cults ORDER BY created_at DESC LIMIT 50'
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania kultów:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie kultu
router.post('/cults', checkCultPermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.promise().query(
      'INSERT INTO cults (title, description, image, created_at) VALUES (?, ?, ?, NOW())',
      [title, description, image]
    );
    if (!result.insertId) {
      return res.status(500).json({ error: 'Nie udało się dodać kultu' });
    }
    const [newCult] = await pool.promise().query('SELECT * FROM cults WHERE id = ?', [result.insertId]);
    res.status(201).json(newCult[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania kultu:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja kultu
router.put('/cults/:id', checkCultPermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    let query = 'UPDATE cults SET title = ?, description = ?';
    const params = [title, description];
    if (image) {
      query += ', image = ?';
      params.push(image);
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);

    const [updateResult] = await pool.promise().query(query, params);
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Kult nie znaleziony' });
    }
    const [updatedCult] = await pool.promise().query('SELECT * FROM cults WHERE id = ?', [req.params.id]);
    res.status(200).json(updatedCult[0]);
  } catch (error) {
    console.error('❌ Błąd edycji kultu:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie kultu
router.delete('/cults/:id', checkCultPermissions, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM cults WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kult nie znaleziony' });
    }
    res.status(200).json({ message: 'Kult usunięty' });
  } catch (error) {
    console.error('❌ Błąd usuwania kultu:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) jako JSON, nie HTML -
// front czyta z odpowiedzi `message`.
router.use(handleUploadErrors);

module.exports = { router, initialize };