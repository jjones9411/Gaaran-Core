// ================================
// routes/classes.js
// Klasy postaci - wybierane raz po stworzeniu postaci, niezależnie od rasy.
// Dowolna liczba, definiowana w kreatorze instalacyjnym (routes/install.js).
// ================================

const express = require('express');
const router = express.Router();

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

function checkAdminPermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    const userRole = results[0]?.role || 'mieszkaniec';
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  });
}

// Klasa jest wyłącznie FABULARNA: klucz, nazwa, opis, ikona i kolejność na
// liście. Nie daje żadnych bonusów - to etykieta roli w fabule.
const CLASS_COLUMNS = `\`key\`, name, description, icon, sort_order`;

// GET: Lista klas (publiczne - używane przy wyborze klasy w StatsCard)
// Domyślnie tylko aktywne (do wyboru). ?includeInactive=1 zwraca też dezaktywowane
// klasy - potrzebne do rozwiązania nazwy klasy istniejącej postaci, której klasę
// admin mógł później dezaktywować (inaczej postać na zawsze pokazywałaby surowy klucz).
router.get('/classes', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const [rows] = await pool.promise().query(
      `SELECT id, ${CLASS_COLUMNS}, is_active FROM classes ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY sort_order, id`
    );
    res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('❌ Błąd pobierania klas:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodanie nowej klasy (admin)
router.post('/classes', require('../middleware/auth').verifyToken, checkAdminPermissions, async (req, res) => {
  try {
    const b = req.body;
    if (!b.key || !b.name) {
      return res.status(400).json({ error: 'Klucz i nazwa są wymagane' });
    }
    const [result] = await pool.promise().query(
      `INSERT INTO classes (${CLASS_COLUMNS}) VALUES (?, ?, ?, ?, ?)`,
      [b.key, b.name, b.description || null, b.icon || null, b.sort_order ?? 0]
    );
    const [newRows] = await pool.promise().query('SELECT * FROM classes WHERE id = ?', [result.insertId]);
    res.status(201).json(newRows[0] || {});
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Klasa o takim kluczu już istnieje' });
    }
    console.error('❌ Błąd dodawania klasy:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja klasy (admin)
router.put('/classes/:id', require('../middleware/auth').verifyToken, checkAdminPermissions, async (req, res) => {
  try {
    const b = req.body;
    const [updateInfo] = await pool.promise().query(
      `UPDATE classes SET name = ?, description = ?, icon = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [b.name, b.description || null, b.icon || null,
        b.sort_order ?? 0, b.is_active ?? 1, req.params.id]
    );
    if (updateInfo.affectedRows === 0) {
      return res.status(404).json({ error: 'Klasa nie znaleziona' });
    }
    const [rows] = await pool.promise().query('SELECT * FROM classes WHERE id = ?', [req.params.id]);
    res.status(200).json(rows[0] || {});
  } catch (err) {
    console.error('❌ Błąd edycji klasy:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = { router, initialize };
