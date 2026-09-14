const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const pool = require('../config/database');

// Zapytanie listy postaci. Trzy kolumny są opcjonalne, bo mogą jeszcze nie
// istnieć w bazie, która nie dostała migracji (`narrative_role` -
// add-narrative-role.sql, `epithet` - add-epithet.sql, `last_login` -
// add-last-login.sql). Zamiast wywracać całą listę, zapytanie degraduje się do
// wariantu bez nich (ten sam wzorzec co w routes/onlineUsers.js).
//
// Kolumny WRAŻLIWE (`last_ip`, `last_seen`, `last_login`) wchodzą do zapytania
// wyłącznie dla konta z rolą `admin`. Wcześniej `last_ip` jechało do KAŻDEGO
// gracza i tylko front go nie rysował - czyli adres był o jeden podgląd
// odpowiedzi sieciowej od dowolnego zalogowanego.
const buildPlayersQuery = ({ isAdmin, withNarrativeRole, withEpithet, withLastLogin, hasFactionFilter }) => `
    SELECT
      c.id,
      c.name AS character_name,
      c.faction,
      c.gender,
      c.created_at,
      c.user_id,
      ${withNarrativeRole ? 'c.narrative_role,' : ''}
      ${withEpithet ? 'c.epithet,' : ''}
      u.user AS owner_name,
      u.role AS account_role
      ${isAdmin ? ', u.last_ip, u.last_seen' : ''}
      ${isAdmin && withLastLogin ? ', u.last_login' : ''}
    FROM characters c
    LEFT JOIN users u ON c.user_id = u.id
    ${hasFactionFilter ? 'WHERE c.faction = ?' : ''}
    ORDER BY c.id ASC
  `;

// GET /players - Lista postaci (z opcjonalnym filtrem po rasie)
router.get('/players', verifyToken, (req, res) => {
  const userId = req.user.id; // To jest potrzebne do oznaczenia własnych postaci
  const isAdmin = req.user.role === 'admin';
  const factionFilter = req.query.faction || '';
  const params = factionFilter ? [factionFilter] : [];

  const runQuery = (flags) => {
    const query = buildPlayersQuery({
      isAdmin,
      hasFactionFilter: Boolean(factionFilter),
      ...flags,
    });

    pool.query(query, params, (err, rows) => {
      if (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          // Brak migracji - spróbuj bez kolumn opcjonalnych, zaczynając od
          // najświeższej.
          if (flags.withEpithet) {
            return runQuery({ ...flags, withEpithet: false });
          }
          if (flags.withLastLogin) {
            return runQuery({ ...flags, withLastLogin: false });
          }
          if (flags.withNarrativeRole) {
            return runQuery({ ...flags, withNarrativeRole: false });
          }
        }
        console.error('❌ Błąd pobierania postaci:', err);
        return res.status(500).json({ error: err.message });
      }

      const players = rows.map((row) => ({
        id: row.id,
        character_name: row.character_name,
        faction: row.faction,
        gender: row.gender,
        created_at: row.created_at,
        user_id: row.user_id,
        owner_name: row.owner_name,
        // Rola fabularna nadana przez administrację (profil postaci) - tutaj
        // tylko do odczytu, tak samo jak na liście online.
        narrative_role: row.narrative_role || null,
        // Przydomek nadany przez administrację (admin/MG) - kartoteka pokazuje
        // go pod nazwą postaci, też tylko do odczytu.
        epithet: row.epithet || null,
        // Ranga konta: mieszkaniec / zasluzony / karczmarz / mistrz_gry / admin.
        account_role: row.account_role || 'mieszkaniec',
        ...(isAdmin
          ? {
              last_ip: row.last_ip || null,
              last_seen: row.last_seen || null,
              last_login: row.last_login || null,
            }
          : {}),
      }));

      res.setHeader('Content-Type', 'application/json');
      return res.json({
        players,
        currentUserId: userId, // Opcjonalnie - możesz to też zwrócić
        isAdmin,
        // Czy baza ma już kolumnę `users.last_login`. Gdy nie - front pokazuje
        // przy dacie, że to ostatnia AKTYWNOŚĆ (last_seen), a nie logowanie.
        lastLoginTracked: isAdmin ? Boolean(flags.withLastLogin) : false,
      });
    });
  };

  runQuery({ withNarrativeRole: true, withEpithet: true, withLastLogin: true });
});

module.exports = router;
