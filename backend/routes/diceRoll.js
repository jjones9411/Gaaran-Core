// ================================
// routes/diceRoll.js
// Endpoint losujący rzut kością PO STRONIE SERWERA i zwracający go z podpisem.
// Dzięki temu podgląd gracza (w chwili rzutu) i zapis w wiadomości to ta sama
// losowa wartość - a klient nie może jej podmienić (patrz utils/diceRolls.js).
// ================================

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { createRoll } = require('../utils/diceRolls');

function initialize() { /* brak zależności */ }

// POST /dice/roll { sides, modifier, description } -> { sides, roll, modifier, total, ts, sig, description }
router.post('/dice/roll', verifyToken, (req, res) => {
  try {
    const { sides, modifier, description } = req.body || {};
    const result = createRoll({
      sides,
      modifier,
      description,
      userId: req.user.id,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Błąd losowania kości:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = { router, initialize };
