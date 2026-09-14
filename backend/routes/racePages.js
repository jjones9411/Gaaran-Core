// ================================
// routes/racePages.js
// Wpisy lore/CMS przypisane do konkretnej rasy - zastępuje dawne osobne
// tabele/routery werewolves.js, vampires.js, mag.js (po jednym na sztywno
// zakodowaną frakcję). Jedna tabela `race_pages` z kolumną race_key działa
// dla dowolnej liczby ras zdefiniowanej w kreatorze instalacyjnym.
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

function checkRacePagePermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    const userRole = results[0]?.role || 'mieszkaniec';
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  });
}

// GET: Lista wpisów dla danej rasy
router.get('/race-pages/:raceKey', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM race_pages WHERE race_key = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.raceKey]
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania wpisów rasy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodanie wpisu dla danej rasy
router.post('/race-pages/:raceKey', require('../middleware/auth').verifyToken, checkRacePagePermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await pool.promise().query(
      'INSERT INTO race_pages (race_key, title, description, image, created_at) VALUES (?, ?, ?, ?, NOW())',
      [req.params.raceKey, title, description, image]
    );
    const [newRow] = await pool.promise().query('SELECT * FROM race_pages WHERE id = ?', [result.insertId]);
    res.status(201).json(newRow[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania wpisu rasy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja wpisu
router.put('/race-pages/:id', require('../middleware/auth').verifyToken, checkRacePagePermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Tytuł i opis są wymagane' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    let query = 'UPDATE race_pages SET title = ?, description = ?';
    const params = [title, description];
    if (image) {
      query += ', image = ?';
      params.push(image);
    }
    query += ' WHERE id = ?';
    params.push(req.params.id);

    const [updateResult] = await pool.promise().query(query, params);
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Wpis nie znaleziony' });
    }
    const [updatedRow] = await pool.promise().query('SELECT * FROM race_pages WHERE id = ?', [req.params.id]);
    res.status(200).json(updatedRow[0]);
  } catch (error) {
    console.error('❌ Błąd edycji wpisu rasy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie wpisu
router.delete('/race-pages/:id', require('../middleware/auth').verifyToken, checkRacePagePermissions, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM race_pages WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Wpis nie znaleziony' });
    }
    res.status(200).json({ message: 'Wpis usunięty' });
  } catch (error) {
    console.error('❌ Błąd usuwania wpisu rasy:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) jako JSON, nie HTML -
// front czyta z odpowiedzi `message`.
router.use(handleUploadErrors);

module.exports = { router, initialize };
