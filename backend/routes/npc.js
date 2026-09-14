// ================================
// routes/npc.js
// Zarządzanie NPC
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
// MIDDLEWARE - sprawdź uprawnienia (admin lub mistrz_gry)
// ================================

function checkNpcPermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    
    const userRole = results[0]?.role || 'mieszkaniec';
    if (userRole !== 'admin' && userRole !== 'mistrz_gry') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    
    next();
  });
}

// ================================
// NPC - CRUD
// ================================

// GET: Lista NPC
router.get('/npc', async (req, res) => {
  try {
    const [results] = await pool.promise().query(
      'SELECT * FROM npcs ORDER BY created_at DESC LIMIT 50'
    );
    res.status(200).json(results);
  } catch (error) {
    console.error('❌ Błąd pobierania NPC:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodawanie NPC (admin/mistrz_gry)
router.post('/npc', checkNpcPermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Imię i opis są wymagane' });
    }
    
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    const [result] = await pool.promise().query(
      'INSERT INTO npcs (title, description, image, created_at) VALUES (?, ?, ?, NOW())',
      [title, description, image]
    );
    
    if (!result.insertId) {
      return res.status(500).json({ error: 'Nie udało się dodać NPC' });
    }
    
    const [newNpc] = await pool.promise().query('SELECT * FROM npcs WHERE id = ?', [result.insertId]);
    res.status(201).json(newNpc[0]);
  } catch (error) {
    console.error('❌ Błąd dodawania NPC:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja NPC (admin/mistrz_gry)
router.put('/npc/:id', checkNpcPermissions, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Imię i opis są wymagane' });
    }
    
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    let query = 'UPDATE npcs SET title = ?, description = ?';
    const params = [title, description];
    
    if (image) {
      query += ', image = ?';
      params.push(image);
    }
    
    query += ' WHERE id = ?';
    params.push(req.params.id);
    
    const [updateResult] = await pool.promise().query(query, params);
    
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'NPC nie znaleziony' });
    }
    
    const [updatedNpc] = await pool.promise().query('SELECT * FROM npcs WHERE id = ?', [req.params.id]);
    res.status(200).json(updatedNpc[0]);
  } catch (error) {
    console.error('❌ Błąd edycji NPC:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE: Usuwanie NPC (admin/mistrz_gry)
router.delete('/npc/:id', checkNpcPermissions, async (req, res) => {
  try {
    const [result] = await pool.promise().query('DELETE FROM npcs WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'NPC nie znaleziony' });
    }
    
    res.status(200).json({ message: 'NPC usunięty' });
  } catch (error) {
    console.error('❌ Błąd usuwania NPC:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) jako JSON, nie HTML -
// front czyta z odpowiedzi `message`.
router.use(handleUploadErrors);

module.exports = { router, initialize };