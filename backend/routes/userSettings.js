// ================================
// routes/userSettings.js
// Preferencje UI per KONTO uzytkownika (nie per postac):
//  - skala czcionki glownego boxa (ui_font_scale),
//  - szerokosc glownego boxa (ui_content_width).
// ================================

const express = require('express');
const router = express.Router();

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// Skala czcionki to procent BAZY (html font-size = 120%), krok 10, zakres 70..160.
// 100 = bez zmian. Trzymamy te same widelki po stronie serwera, zeby zadne
// wywolanie API nie zapisalo wartosci rozjezdzajacej layout.
const FONT_SCALE_MIN = 70;
const FONT_SCALE_MAX = 160;
const FONT_SCALE_DEFAULT = 100;

function normalizeFontScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Zaokraglij do najblizszej wielokrotnosci 10, potem przytnij do zakresu.
  const stepped = Math.round(n / 10) * 10;
  return Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, stepped));
}

// GET: aktualna skala czcionki zalogowanego uzytkownika
router.get('/user/font-scale', (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Brak autoryzacji' });

  pool.query('SELECT ui_font_scale FROM users WHERE id = ?', [userId], (err, rows) => {
    if (err) {
      console.error('❌ Błąd pobierania ui_font_scale:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }
    const fontScale = normalizeFontScale(rows[0].ui_font_scale) ?? FONT_SCALE_DEFAULT;
    return res.json({ fontScale });
  });
});

// PUT: zapis skali czcionki dla zalogowanego uzytkownika
router.put('/user/font-scale', (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Brak autoryzacji' });

  const fontScale = normalizeFontScale(req.body && req.body.fontScale);
  if (fontScale === null) {
    return res.status(400).json({ message: 'Nieprawidłowa wartość skali czcionki' });
  }

  pool.query('UPDATE users SET ui_font_scale = ? WHERE id = ?', [fontScale, userId], (err) => {
    if (err) {
      console.error('❌ Błąd zapisu ui_font_scale:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    return res.json({ fontScale });
  });
});

// Szerokosc glownego boxa (main box + lista online) w px. Zamknieta lista
// wartosci - te same co w froncie (components/contentWidth.js), zeby zadne
// wywolanie API nie zapisalo szerokosci rozjezdzajacej layout. 1400 = domyslna,
// czyli rowno z TopBarem (ktory NIE zmienia szerokosci).
const CONTENT_WIDTH_VALUES = [1400, 1600, 1800, 2000];
const CONTENT_WIDTH_DEFAULT = 1400;

function normalizeContentWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Sprowadz do najblizszej dozwolonej wartosci.
  return CONTENT_WIDTH_VALUES.reduce(
    (best, candidate) => (Math.abs(candidate - n) < Math.abs(best - n) ? candidate : best),
    CONTENT_WIDTH_DEFAULT
  );
}

// Brak kolumny = migracja add-user-content-width.sql jeszcze nie poszla.
// Nie wywalamy wtedy requestu - gracz po prostu dostaje/zostaje przy domyslnej
// szerokosci, dokladnie tak jak przed dodaniem tej opcji.
function isMissingColumn(err) {
  return err && (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_SUCH_TABLE');
}

// GET: aktualna szerokosc glownego boxa zalogowanego uzytkownika
router.get('/user/content-width', (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Brak autoryzacji' });

  pool.query('SELECT ui_content_width FROM users WHERE id = ?', [userId], (err, rows) => {
    if (err) {
      if (isMissingColumn(err)) return res.json({ contentWidth: CONTENT_WIDTH_DEFAULT });
      console.error('❌ Błąd pobierania ui_content_width:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }
    const contentWidth = normalizeContentWidth(rows[0].ui_content_width) ?? CONTENT_WIDTH_DEFAULT;
    return res.json({ contentWidth });
  });
});

// PUT: zapis szerokosci glownego boxa dla zalogowanego uzytkownika
router.put('/user/content-width', (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Brak autoryzacji' });

  const contentWidth = normalizeContentWidth(req.body && req.body.contentWidth);
  if (contentWidth === null) {
    return res.status(400).json({ message: 'Nieprawidłowa szerokość głównego okna' });
  }

  pool.query('UPDATE users SET ui_content_width = ? WHERE id = ?', [contentWidth, userId], (err) => {
    if (err) {
      if (isMissingColumn(err)) {
        return res.status(503).json({
          message: 'Opcja szerokości okna nie jest jeszcze dostępna - brakuje migracji bazy danych.',
        });
      }
      console.error('❌ Błąd zapisu ui_content_width:', err);
      return res.status(500).json({ message: 'Błąd serwera' });
    }
    return res.json({ contentWidth });
  });
});

module.exports = { router, initialize };
