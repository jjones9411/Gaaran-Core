// ================================
// routes/npcAccount.js
// Tryb NPC - wejście administratora na wspólne subkonto postaci NPC
// i powrót na własne konto, bez wylogowywania się z gry.
//
// Przepływ:
//   1. Admin w lobby klika "NPC"          -> POST /api/npc-account/enter
//      dostaje token subkonta NPC (z zapamiętanym `npcOwnerId`) i widzi
//      lobby z postaciami NPC - każda ma własne sesje i wiadomości.
//   2. Admin klika "Wróć na swoje konto"  -> POST /api/npc-account/exit
//      dostaje z powrotem token SWOJEGO konta wraz z aktywną postacią.
//
// Uprawnienia: wejść może wyłącznie konto z rolą `admin` (rola czytana z bazy
// przez verifyToken, nie z payloadu tokena). Wrócić może tylko token trybu NPC,
// i tylko na to konto, które w tryb NPC weszło - i tylko jeśli nadal jest adminem.
//
// Ścieżki: front woła `/api/npc-account/*`, ale serwer deweloperski przepisuje
// `^/api` na puste (frontend/rsbuild.config.mjs), więc do backendu trafia
// `/npc-account/*`. Rejestrujemy OBA warianty, żeby trasa działała niezależnie
// od tego, czy pośrednik obcina prefiks (dev) czy nie (część konfiguracji prod).
// ================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { ensureNpcAccount, NpcAccountUnavailable } = require('../utils/npcAccount');

// Token konta + jego aktywnej postaci. Ten sam kształt payloadu co w
// /api/login i /api/selectCharacter, rozszerzony o znaczniki trybu NPC.
function signAccountToken(account, character, npcClaims = {}) {
  return jwt.sign(
    {
      id: account.id,
      email: account.email,
      username: account.user,
      role: account.role,
      characterId: character ? character.id : null,
      characterName: character ? character.name : null,
      characterAvatar: character ? character.avatar : null,
      characterRace: character ? character.race : null,
      characterGender: character ? character.gender : null,
      characterFaction: character ? character.faction : null,
      ...npcClaims
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function fetchActiveCharacter(userId) {
  const [rows] = await pool.promise().query(
    `SELECT id, name, avatar, race, gender, faction
     FROM characters
     WHERE user_id = ? AND is_active = 1 AND (is_deleted IS NULL OR is_deleted = 0)
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// GET /api/npc-account/status - czy przeglądam grę jako NPC i czyim tokenem
router.get(['/npc-account/status', '/api/npc-account/status'], verifyToken, (req, res) => {
  res.json({
    npcMode: Boolean(req.user.npcAccount),
    isNpcAccount: Boolean(req.user.isNpcAccount),
    ownerId: req.user.npcOwnerId || null,
    ownerName: req.user.npcOwnerName || null,
    // Przycisk "NPC" w lobby pokazujemy tylko prawdziwemu adminowi.
    canEnter: req.user.role === 'admin' && !req.user.isNpcAccount
  });
});

// POST /api/npc-account/enter - przejdź na subkonto NPC (tylko admin)
router.post(['/npc-account/enter', '/api/npc-account/enter'], verifyToken, async (req, res) => {
  if (req.user.isNpcAccount) {
    return res.status(400).json({ message: 'Jesteś już na subkoncie NPC.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Tryb NPC jest dostępny tylko dla administracji.' });
  }

  try {
    const npcAccount = await ensureNpcAccount(pool);

    // Wchodzimy do lobby NPC bez wybranej postaci - admin sam wskazuje,
    // którym NPC-em chce grać (i wtedy /api/selectCharacter wystawia token z tą
    // postacią). Świadomie NIE zerujemy tu `is_active` postaci NPC: subkonto jest
    // wspólne, więc zdjęłoby to postać innemu adminowi, który akurat nią gra.
    const token = signAccountToken(npcAccount, null, {
      npcAccount: true,
      npcOwnerId: req.user.id,
      npcOwnerName: req.user.user || null
    });

    console.log(`🎭 Admin "${req.user.user}" (ID: ${req.user.id}) wszedł w tryb NPC`);

    res.json({
      message: 'Tryb NPC włączony.',
      token,
      npcMode: true,
      account: { id: npcAccount.id, name: npcAccount.user }
    });
  } catch (err) {
    if (err instanceof NpcAccountUnavailable) {
      return res.status(503).json({ message: err.message });
    }
    console.error('❌ Błąd wejścia w tryb NPC:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// POST /api/npc-account/exit - wróć na swoje konto administratora
router.post(['/npc-account/exit', '/api/npc-account/exit'], verifyToken, async (req, res) => {
  if (!req.user.npcAccount || !req.user.npcOwnerId) {
    return res.status(400).json({ message: 'Nie jesteś w trybie NPC.' });
  }

  try {
    const [owners] = await pool.promise().query(
      'SELECT id, user, email, role FROM users WHERE id = ?',
      [req.user.npcOwnerId]
    );

    if (!owners.length) {
      return res.status(404).json({ message: 'Konto administratora nie istnieje. Zaloguj się ponownie.' });
    }

    const owner = owners[0];

    // Rolę sprawdzamy PONOWNIE przy wyjściu - gdyby admin stracił uprawnienia
    // w trakcie sesji NPC, nie wracamy go na konto z podniesionymi prawami.
    if (owner.role !== 'admin') {
      return res.status(403).json({ message: 'To konto nie ma już uprawnień administratora. Zaloguj się ponownie.' });
    }

    const character = await fetchActiveCharacter(owner.id);
    const token = signAccountToken(owner, character);

    console.log(`🎭 Admin "${owner.user}" (ID: ${owner.id}) wyszedł z trybu NPC`);

    res.json({
      message: 'Powrót na własne konto.',
      token,
      npcMode: false,
      character: character || null
    });
  } catch (err) {
    console.error('❌ Błąd wyjścia z trybu NPC:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

module.exports = router;
