// ================================
// routes/clans.js
// Klany / rodziny graczy - sieć powiązań postaci
//
// Model uprawnień:
//  * Klan zakłada administracja (admin / mistrz_gry) i wyznacza głowę klanu.
//  * Głowa klanu i mianowani przez nią oficerowie mogą zapraszać nowe postacie.
//  * Zaproszona postać musi zaakceptować zaproszenie (nikt nie trafia do
//    rodziny bez zgody).
//  * Postać należy najwyżej do jednego klanu (UNIQUE na clan_members.character_id).
// ================================

const express = require('express');
const router = express.Router();

let pool;
let invalidateProfileCache = null;

function initialize(dependencies) {
  pool = dependencies.pool;
  invalidateProfileCache = dependencies.invalidateProfileCache || null;
}

// Unieważnij cache profilu postaci (żeby zmiana klanu była widoczna od razu)
function invalidateChar(characterId) {
  if (typeof invalidateProfileCache === 'function' && characterId != null) {
    try { invalidateProfileCache(characterId); } catch (e) { /* nieistotne */ }
  }
}

const NAME_MAX = 100;
const DESC_MAX = 2000;

// ================================
// HELPERY
// ================================

// Rola użytkownika (konta)
async function getUserRole(userId) {
  const [rows] = await pool.promise().query('SELECT role FROM users WHERE id = ?', [userId]);
  return rows[0]?.role || 'mieszkaniec';
}

// Czy użytkownik jest administracją (admin / mistrz_gry)
async function isStaff(userId) {
  const role = await getUserRole(userId);
  return role === 'admin' || role === 'mistrz_gry';
}

// Zwraca postać (id, user_id, name) lub null
async function getCharacter(characterId) {
  const [rows] = await pool.promise().query(
    'SELECT id, user_id, name FROM characters WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
    [characterId]
  );
  return rows[0] || null;
}

// Członkostwo postaci: { clan_id, role, clan_name } lub null
async function getMembership(characterId) {
  const [rows] = await pool.promise().query(
    `SELECT cm.clan_id, cm.role, c.name AS clan_name
     FROM clan_members cm
     JOIN clans c ON c.id = cm.clan_id
     WHERE cm.character_id = ?`,
    [characterId]
  );
  return rows[0] || null;
}

// Middleware: tylko admin / mistrz_gry
function requireStaff(req, res, next) {
  isStaff(req.user.id)
    .then((ok) => {
      if (!ok) return res.status(403).json({ message: 'Brak uprawnień' });
      next();
    })
    .catch((err) => {
      console.error('❌ Błąd sprawdzania uprawnień klanu:', err);
      res.status(500).json({ message: 'Błąd serwera' });
    });
}

// ================================
// ODCZYT
// ================================

// GET: Lista klanów (dla panelu admina) - z liczbą członków i nazwą głowy
router.get('/clans', async (req, res) => {
  try {
    const [rows] = await pool.promise().query(
      `SELECT c.id, c.name, c.description, c.head_character_id,
              h.name AS head_name,
              (SELECT COUNT(*) FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count
       FROM clans c
       LEFT JOIN characters h ON h.id = c.head_character_id
       ORDER BY c.name ASC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Błąd pobierania klanów:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// GET: Szczegóły klanu + lista członków (do popupu na profilu)
router.get('/clans/:id', async (req, res) => {
  const clanId = req.params.id;
  if (!/^\d+$/.test(clanId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID klanu' });
  }
  try {
    const [clanRows] = await pool.promise().query(
      'SELECT id, name, description, head_character_id, created_at FROM clans WHERE id = ?',
      [clanId]
    );
    if (clanRows.length === 0) {
      return res.status(404).json({ message: 'Klan nie znaleziony' });
    }

    const [members] = await pool.promise().query(
      `SELECT cm.character_id, cm.role, cm.joined_at,
              ch.name AS character_name, ch.avatar, ch.faction
       FROM clan_members cm
       JOIN characters ch ON ch.id = cm.character_id
       WHERE cm.clan_id = ?
       ORDER BY FIELD(cm.role, 'head', 'officer', 'member'), ch.name ASC`,
      [clanId]
    );

    res.status(200).json({ clan: clanRows[0], members });
  } catch (err) {
    console.error('❌ Błąd pobierania klanu:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// GET: Oczekujące zaproszenia dla danej (własnej) postaci
router.get('/clans/character/:characterId/invitations', async (req, res) => {
  const characterId = req.params.characterId;
  if (!/^\d+$/.test(characterId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID postaci' });
  }
  try {
    const character = await getCharacter(characterId);
    if (!character) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (String(character.user_id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Brak uprawnień' });
    }

    const [rows] = await pool.promise().query(
      `SELECT i.id, i.clan_id, i.created_at,
              c.name AS clan_name,
              inv.name AS invited_by_name
       FROM clan_invitations i
       JOIN clans c ON c.id = i.clan_id
       LEFT JOIN characters inv ON inv.id = i.invited_by
       WHERE i.character_id = ? AND i.status = 'pending'
       ORDER BY i.created_at DESC`,
      [characterId]
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('❌ Błąd pobierania zaproszeń:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// ================================
// ADMIN / MG - CRUD KLANU
// ================================

// POST: Utwórz klan i wyznacz głowę
router.post('/clans', requireStaff, async (req, res) => {
  const { name, description, headCharacterId } = req.body;

  if (typeof name !== 'string' || !name.trim() || name.length > NAME_MAX) {
    return res.status(400).json({ message: `Nazwa klanu jest wymagana (max ${NAME_MAX} znaków)` });
  }
  if (description && (typeof description !== 'string' || description.length > DESC_MAX)) {
    return res.status(400).json({ message: `Opis za długi (max ${DESC_MAX} znaków)` });
  }
  if (!/^\d+$/.test(String(headCharacterId || ''))) {
    return res.status(400).json({ message: 'Wskaż postać, która będzie głową klanu' });
  }

  const conn = await pool.promise().getConnection();
  try {
    const head = await getCharacter(headCharacterId);
    if (!head) {
      conn.release();
      return res.status(404).json({ message: 'Postać wskazana na głowę klanu nie istnieje' });
    }
    const existingMembership = await getMembership(headCharacterId);
    if (existingMembership) {
      conn.release();
      return res.status(409).json({ message: `Ta postać już należy do klanu "${existingMembership.clan_name}"` });
    }

    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO clans (name, description, head_character_id, created_by) VALUES (?, ?, ?, ?)',
      [name.trim(), description || null, headCharacterId, req.user.id]
    );
    const clanId = result.insertId;
    await conn.query(
      "INSERT INTO clan_members (clan_id, character_id, role) VALUES (?, ?, 'head')",
      [clanId, headCharacterId]
    );
    await conn.commit();
    conn.release();
    invalidateChar(headCharacterId);
    res.status(201).json({ message: 'Klan utworzony', clanId });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Klan o tej nazwie już istnieje (lub postać już jest w klanie)' });
    }
    console.error('❌ Błąd tworzenia klanu:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// PUT: Edycja klanu (nazwa/opis/głowa). Nowa głowa musi już być członkiem klanu.
router.put('/clans/:id', requireStaff, async (req, res) => {
  const clanId = req.params.id;
  const { name, description, headCharacterId } = req.body;
  if (!/^\d+$/.test(clanId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID klanu' });
  }

  try {
    const [clanRows] = await pool.promise().query('SELECT * FROM clans WHERE id = ?', [clanId]);
    if (clanRows.length === 0) return res.status(404).json({ message: 'Klan nie znaleziony' });
    const clan = clanRows[0];

    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > NAME_MAX)) {
      return res.status(400).json({ message: `Nieprawidłowa nazwa (max ${NAME_MAX} znaków)` });
    }
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > DESC_MAX)) {
      return res.status(400).json({ message: `Opis za długi (max ${DESC_MAX} znaków)` });
    }

    // Zmiana głowy klanu
    if (headCharacterId !== undefined && String(headCharacterId) !== String(clan.head_character_id)) {
      const membership = await getMembership(headCharacterId);
      if (!membership || String(membership.clan_id) !== String(clanId)) {
        return res.status(400).json({ message: 'Nowa głowa klanu musi być już członkiem tego klanu' });
      }
      const conn = await pool.promise().getConnection();
      try {
        await conn.beginTransaction();
        // stara głowa -> oficer
        await conn.query(
          "UPDATE clan_members SET role = 'officer' WHERE clan_id = ? AND character_id = ?",
          [clanId, clan.head_character_id]
        );
        // nowa głowa -> head
        await conn.query(
          "UPDATE clan_members SET role = 'head' WHERE clan_id = ? AND character_id = ?",
          [clanId, headCharacterId]
        );
        await conn.query('UPDATE clans SET head_character_id = ? WHERE id = ?', [headCharacterId, clanId]);
        await conn.commit();
        conn.release();
        invalidateChar(clan.head_character_id);
        invalidateChar(headCharacterId);
      } catch (e) {
        await conn.rollback().catch(() => {});
        conn.release();
        throw e;
      }
    }

    // Nazwa / opis
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description || null); }
    if (fields.length > 0) {
      values.push(clanId);
      await pool.promise().query(`UPDATE clans SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    res.status(200).json({ message: 'Klan zaktualizowany' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Klan o tej nazwie już istnieje' });
    }
    console.error('❌ Błąd edycji klanu:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// DELETE: Usuń klan (kasuje członków i zaproszenia - ON DELETE CASCADE)
router.delete('/clans/:id', requireStaff, async (req, res) => {
  const clanId = req.params.id;
  if (!/^\d+$/.test(clanId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID klanu' });
  }
  try {
    const [members] = await pool.promise().query('SELECT character_id FROM clan_members WHERE clan_id = ?', [clanId]);
    const [result] = await pool.promise().query('DELETE FROM clans WHERE id = ?', [clanId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Klan nie znaleziony' });
    members.forEach((m) => invalidateChar(m.character_id));
    res.status(200).json({ message: 'Klan usunięty' });
  } catch (err) {
    console.error('❌ Błąd usuwania klanu:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// ================================
// ZARZĄDZANIE SKŁADEM (głowa / oficer)
// ================================

// Zweryfikuj, że actorCharacterId należy do zalogowanego użytkownika ORAZ jest
// głową/oficerem wskazanego klanu. Zwraca { ok, status, message, actorRole }.
async function verifyManager(userId, clanId, actorCharacterId) {
  if (!/^\d+$/.test(String(actorCharacterId || ''))) {
    return { ok: false, status: 400, message: 'Brak postaci działającej (actorCharacterId)' };
  }
  const actor = await getCharacter(actorCharacterId);
  if (!actor) return { ok: false, status: 404, message: 'Postać nie znaleziona' };
  if (String(actor.user_id) !== String(userId)) {
    return { ok: false, status: 403, message: 'To nie jest Twoja postać' };
  }
  const membership = await getMembership(actorCharacterId);
  if (!membership || String(membership.clan_id) !== String(clanId)) {
    return { ok: false, status: 403, message: 'Ta postać nie należy do tego klanu' };
  }
  if (membership.role !== 'head' && membership.role !== 'officer') {
    return { ok: false, status: 403, message: 'Tylko głowa klanu lub oficer może to zrobić' };
  }
  return { ok: true, actorRole: membership.role };
}

// POST: Zaproś postać do klanu (głowa / oficer)
router.post('/clans/:id/invitations', async (req, res) => {
  const clanId = req.params.id;
  const { actorCharacterId, characterId, characterName } = req.body;
  if (!/^\d+$/.test(clanId)) return res.status(400).json({ message: 'Nieprawidłowe ID klanu' });

  try {
    const auth = await verifyManager(req.user.id, clanId, actorCharacterId);
    if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

    // Znajdź zapraszaną postać po ID lub nazwie
    let target = null;
    if (characterId && /^\d+$/.test(String(characterId))) {
      target = await getCharacter(characterId);
    } else if (typeof characterName === 'string' && characterName.trim()) {
      const [rows] = await pool.promise().query(
        'SELECT id, user_id, name FROM characters WHERE name = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1',
        [characterName.trim()]
      );
      target = rows[0] || null;
    }
    if (!target) return res.status(404).json({ message: 'Nie znaleziono postaci o podanej nazwie/ID' });

    if (String(target.id) === String(actorCharacterId)) {
      return res.status(400).json({ message: 'Nie możesz zaprosić samego siebie' });
    }

    const targetMembership = await getMembership(target.id);
    if (targetMembership) {
      if (String(targetMembership.clan_id) === String(clanId)) {
        return res.status(409).json({ message: 'Ta postać już należy do tego klanu' });
      }
      return res.status(409).json({ message: 'Ta postać należy już do innego klanu' });
    }

    // Brak duplikatu oczekującego zaproszenia do tego klanu
    const [dupes] = await pool.promise().query(
      "SELECT id FROM clan_invitations WHERE clan_id = ? AND character_id = ? AND status = 'pending'",
      [clanId, target.id]
    );
    if (dupes.length > 0) {
      return res.status(409).json({ message: 'Ta postać ma już oczekujące zaproszenie do klanu' });
    }

    await pool.promise().query(
      'INSERT INTO clan_invitations (clan_id, character_id, invited_by) VALUES (?, ?, ?)',
      [clanId, target.id, actorCharacterId]
    );
    res.status(201).json({ message: `Zaproszono postać "${target.name}"` });
  } catch (err) {
    console.error('❌ Błąd zapraszania do klanu:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// POST: Akceptuj zaproszenie (odbiorca)
router.post('/clans/invitations/:invId/accept', async (req, res) => {
  const invId = req.params.invId;
  if (!/^\d+$/.test(invId)) return res.status(400).json({ message: 'Nieprawidłowe ID zaproszenia' });

  const conn = await pool.promise().getConnection();
  try {
    const [rows] = await conn.query(
      "SELECT * FROM clan_invitations WHERE id = ? AND status = 'pending'",
      [invId]
    );
    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Zaproszenie nie istnieje lub zostało już rozpatrzone' });
    }
    const inv = rows[0];

    const character = await getCharacter(inv.character_id);
    if (!character || String(character.user_id) !== String(req.user.id)) {
      conn.release();
      return res.status(403).json({ message: 'To zaproszenie nie należy do Twojej postaci' });
    }

    const membership = await getMembership(inv.character_id);
    if (membership) {
      conn.release();
      return res.status(409).json({ message: 'Ta postać należy już do klanu' });
    }

    await conn.beginTransaction();
    await conn.query(
      "INSERT INTO clan_members (clan_id, character_id, role) VALUES (?, ?, 'member')",
      [inv.clan_id, inv.character_id]
    );
    await conn.query(
      "UPDATE clan_invitations SET status = 'accepted', responded_at = NOW() WHERE id = ?",
      [invId]
    );
    // Pozostałe oczekujące zaproszenia dla tej postaci -> odrzuć (jest już w klanie)
    await conn.query(
      "UPDATE clan_invitations SET status = 'declined', responded_at = NOW() WHERE character_id = ? AND status = 'pending'",
      [inv.character_id]
    );
    await conn.commit();
    conn.release();
    invalidateChar(inv.character_id);
    res.status(200).json({ message: 'Dołączono do klanu' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ta postać należy już do klanu' });
    }
    console.error('❌ Błąd akceptacji zaproszenia:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// POST: Odrzuć zaproszenie (odbiorca)
router.post('/clans/invitations/:invId/decline', async (req, res) => {
  const invId = req.params.invId;
  if (!/^\d+$/.test(invId)) return res.status(400).json({ message: 'Nieprawidłowe ID zaproszenia' });
  try {
    const [rows] = await pool.promise().query(
      "SELECT * FROM clan_invitations WHERE id = ? AND status = 'pending'",
      [invId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Zaproszenie nie istnieje lub zostało już rozpatrzone' });
    const inv = rows[0];

    const character = await getCharacter(inv.character_id);
    if (!character || String(character.user_id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'To zaproszenie nie należy do Twojej postaci' });
    }

    await pool.promise().query(
      "UPDATE clan_invitations SET status = 'declined', responded_at = NOW() WHERE id = ?",
      [invId]
    );
    res.status(200).json({ message: 'Zaproszenie odrzucone' });
  } catch (err) {
    console.error('❌ Błąd odrzucania zaproszenia:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// PUT: Zmień rolę członka (mianuj oficera / zdegraduj) - tylko głowa
router.put('/clans/:id/members/:characterId/role', async (req, res) => {
  const clanId = req.params.id;
  const targetCharacterId = req.params.characterId;
  const { actorCharacterId, role } = req.body;
  if (!/^\d+$/.test(clanId) || !/^\d+$/.test(targetCharacterId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID' });
  }
  if (role !== 'officer' && role !== 'member') {
    return res.status(400).json({ message: "Rola musi być 'officer' lub 'member'" });
  }

  try {
    const auth = await verifyManager(req.user.id, clanId, actorCharacterId);
    if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
    if (auth.actorRole !== 'head') {
      return res.status(403).json({ message: 'Tylko głowa klanu może zmieniać role członków' });
    }

    const targetMembership = await getMembership(targetCharacterId);
    if (!targetMembership || String(targetMembership.clan_id) !== String(clanId)) {
      return res.status(404).json({ message: 'Ta postać nie należy do tego klanu' });
    }
    if (targetMembership.role === 'head') {
      return res.status(400).json({ message: 'Nie można zmienić roli głowy klanu' });
    }

    await pool.promise().query(
      'UPDATE clan_members SET role = ? WHERE clan_id = ? AND character_id = ?',
      [role, clanId, targetCharacterId]
    );
    invalidateChar(targetCharacterId);
    res.status(200).json({ message: role === 'officer' ? 'Mianowano oficerem' : 'Zdegradowano do członka' });
  } catch (err) {
    console.error('❌ Błąd zmiany roli członka:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// DELETE: Usuń członka lub opuść klan
//  - actorCharacterId == :characterId  => opuszczenie klanu (nie dotyczy głowy)
//  - głowa: może usunąć każdego oprócz siebie
//  - oficer: może usunąć tylko zwykłego członka
router.delete('/clans/:id/members/:characterId', async (req, res) => {
  const clanId = req.params.id;
  const targetCharacterId = req.params.characterId;
  const actorCharacterId = req.body.actorCharacterId || req.query.actorCharacterId;
  if (!/^\d+$/.test(clanId) || !/^\d+$/.test(targetCharacterId)) {
    return res.status(400).json({ message: 'Nieprawidłowe ID' });
  }

  try {
    // Postać działająca musi być własnością użytkownika i należeć do klanu
    if (!/^\d+$/.test(String(actorCharacterId || ''))) {
      return res.status(400).json({ message: 'Brak postaci działającej (actorCharacterId)' });
    }
    const actor = await getCharacter(actorCharacterId);
    if (!actor) return res.status(404).json({ message: 'Postać nie znaleziona' });
    if (String(actor.user_id) !== String(req.user.id)) {
      return res.status(403).json({ message: 'To nie jest Twoja postać' });
    }
    const actorMembership = await getMembership(actorCharacterId);
    if (!actorMembership || String(actorMembership.clan_id) !== String(clanId)) {
      return res.status(403).json({ message: 'Ta postać nie należy do tego klanu' });
    }

    const targetMembership = await getMembership(targetCharacterId);
    if (!targetMembership || String(targetMembership.clan_id) !== String(clanId)) {
      return res.status(404).json({ message: 'Wskazana postać nie należy do tego klanu' });
    }

    const isSelf = String(actorCharacterId) === String(targetCharacterId);

    if (isSelf) {
      // Opuszczenie klanu
      if (actorMembership.role === 'head') {
        return res.status(400).json({ message: 'Głowa klanu nie może opuścić klanu - poproś administrację o przekazanie roli lub rozwiązanie klanu' });
      }
    } else {
      // Usuwanie kogoś innego - wymaga uprawnień
      if (actorMembership.role !== 'head' && actorMembership.role !== 'officer') {
        return res.status(403).json({ message: 'Tylko głowa klanu lub oficer może usuwać członków' });
      }
      if (targetMembership.role === 'head') {
        return res.status(400).json({ message: 'Nie można usunąć głowy klanu' });
      }
      if (actorMembership.role === 'officer' && targetMembership.role === 'officer') {
        return res.status(403).json({ message: 'Oficer nie może usunąć innego oficera' });
      }
    }

    await pool.promise().query(
      'DELETE FROM clan_members WHERE clan_id = ? AND character_id = ?',
      [clanId, targetCharacterId]
    );
    invalidateChar(targetCharacterId);
    res.status(200).json({ message: isSelf ? 'Opuściłeś klan' : 'Usunięto członka z klanu' });
  } catch (err) {
    console.error('❌ Błąd usuwania członka klanu:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

module.exports = { router, initialize, getMembership };
