// ================================
// routes/gameInfo.js
// Nazwa gry i kolor motywu ustawiane w kreatorze instalacyjnym
// (game_config.game_name / theme_primary_color) - jedno źródło prawdy
// zamiast hardkodowania w kodzie frontendu/backendu.
// ================================

const express = require('express');
const router = express.Router();

const DEFAULT_THEME_COLOR = '#7a3b0f';
const DEFAULT_TEXT_COLOR = '#cbd5e0';
const DEFAULT_BACKGROUND_COLOR = '#0a0a0a';

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// Sprawdzenie uprawnień admina (ten sam wzorzec co w races.js/classes.js)
function checkAdminPermissions(req, res, next) {
  pool.query('SELECT role FROM users WHERE id = ?', [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Błąd serwera' });
    if ((results[0]?.role || 'mieszkaniec') !== 'admin') {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  });
}

// GET /game-info - publiczne, używane przez frontend (tytuły, nagłówki, kolory) i backend (maile, RSS)
router.get('/game-info', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      'SELECT game_name, theme_primary_color, theme_text_color, theme_background_color, creator_race_intro FROM game_config WHERE id = 1'
    );
    res.json({
      gameName: rows[0]?.game_name || null,
      themeColor: rows[0]?.theme_primary_color || DEFAULT_THEME_COLOR,
      textColor: rows[0]?.theme_text_color || DEFAULT_TEXT_COLOR,
      backgroundColor: rows[0]?.theme_background_color || DEFAULT_BACKGROUND_COLOR,
      creatorRaceIntro: rows[0]?.creator_race_intro || '',
    });
  } catch (error) {
    console.error('❌ Błąd pobierania nazwy gry:', error);
    res.json({
      gameName: null,
      themeColor: DEFAULT_THEME_COLOR,
      textColor: DEFAULT_TEXT_COLOR,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
      creatorRaceIntro: '',
    });
  }
});

// PUT /game-info/creator-race-intro - admin ustawia tekst wprowadzający o rasach,
// widoczny w pierwszym kreatorze postaci (krok wyboru rasy).
router.put('/game-info/creator-race-intro', require('../middleware/auth').verifyToken, checkAdminPermissions, async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    await pool.promise().query(
      'UPDATE game_config SET creator_race_intro = ? WHERE id = 1',
      [text]
    );
    res.json({ success: true, creatorRaceIntro: text });
  } catch (error) {
    console.error('❌ Błąd zapisu tekstu o rasach:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Funkcja pomocnicza do użycia WEWNĄTRZ backendu (maile, RSS) - bez rundtripu HTTP
async function getGameName(dbPool) {
  try {
    const [rows] = await dbPool.promise().query('SELECT game_name FROM game_config WHERE id = 1');
    return rows[0]?.game_name || '[NAZWA_GRY]';
  } catch (error) {
    return '[NAZWA_GRY]';
  }
}

module.exports = { router, initialize, getGameName };
