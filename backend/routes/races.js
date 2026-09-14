// ================================
// routes/races.js
// Rasy postaci - dawniej "frakcje". Dowolna liczba, definiowana w kreatorze
// instalacyjnym (routes/install.js) i edytowalna później przez admina.
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

// Rasa jest wyłącznie FABULARNA: klucz, nazwa, opis, kolor na liście postaci,
// ikona i lista cech (tekst). Żadnych wartości liczbowych - nic tu nie liczy.
const RACE_COLUMNS = `\`key\`, name, description, color, icon, traits, sort_order`;

function raceValuesFromBody(b) {
  return [
    b.key, b.name, b.description || null, b.color || null, b.icon || null,
    Array.isArray(b.traits) ? b.traits.join(',') : (b.traits || null),
    b.sort_order ?? 0,
  ];
}

// GET: Lista ras (publiczne - używane w CharacterCreator, Sidebar, profilach)
// Domyślnie tylko aktywne (do wyboru przy tworzeniu postaci). ?includeInactive=1
// zwraca też dezaktywowane rasy - potrzebne wszędzie tam, gdzie trzeba rozwiązać
// nazwę/kolor rasy istniejącej postaci, której rasa admin mógł później dezaktywować
// (inaczej taka postać na zawsze pokazywałaby surowy klucz zamiast nazwy).
router.get('/races', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const [rows] = await pool.promise().query(
      `SELECT id, ${RACE_COLUMNS}, is_active FROM races ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY sort_order, id`
    );
    res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error('❌ Błąd pobierania ras:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET: Jedna rasa po kluczu (np. RASA_1) - używane przez stronę rasy (RaceHall)
router.get('/races/:key', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      `SELECT id, ${RACE_COLUMNS} FROM races WHERE \`key\` = ?`,
      [req.params.key]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Rasa nie znaleziona' });
    }
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('❌ Błąd pobierania rasy:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST: Dodanie nowej rasy (admin)
router.post('/races', require('../middleware/auth').verifyToken, checkAdminPermissions, async (req, res) => {
  try {
    const b = req.body;
    if (!b.key || !b.name) {
      return res.status(400).json({ error: 'Klucz i nazwa są wymagane' });
    }
    const [result] = await pool.promise().query(
      `INSERT INTO races (${RACE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      raceValuesFromBody(b)
    );
    const [newRows] = await pool.promise().query('SELECT * FROM races WHERE id = ?', [result.insertId]);
    res.status(201).json(newRows[0] || {});
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Rasa o takim kluczu już istnieje' });
    }
    console.error('❌ Błąd dodawania rasy:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT: Edycja rasy (admin)
router.put('/races/:id', require('../middleware/auth').verifyToken, checkAdminPermissions, async (req, res) => {
  try {
    const b = req.body;
    const [updateInfo] = await pool.promise().query(
      `UPDATE races SET name = ?, description = ?, color = ?, icon = ?, traits = ?,
       sort_order = ?, is_active = ?
       WHERE id = ?`,
      [b.name, b.description || null, b.color || null, b.icon || null,
        Array.isArray(b.traits) ? b.traits.join(',') : (b.traits || null),
        b.sort_order ?? 0, b.is_active ?? 1, req.params.id]
    );
    if (updateInfo.affectedRows === 0) {
      return res.status(404).json({ error: 'Rasa nie znaleziona' });
    }
    const [rows] = await pool.promise().query('SELECT * FROM races WHERE id = ?', [req.params.id]);
    res.status(200).json(rows[0] || {});
  } catch (err) {
    console.error('❌ Błąd edycji rasy:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = { router, initialize, RACE_COLUMNS };
