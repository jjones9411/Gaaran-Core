// Limit slotów postaci na konto.
// Zwykły gracz ma 4 sloty; administrator (rola 'admin') ma podniesiony limit,
// żeby móc trzymać postacie testowe/NPC bez zakładania dodatkowych kont.
// Wspólne subkonto NPC administracji (users.is_npc_account = 1) ma limit
// najwyższy - mieszkają na nim WSZYSTKIE postacie NPC świata.
// Jedno miejsce prawdy - używane i przy tworzeniu postaci (backend), i przy
// rysowaniu slotów w lobby (front dostaje maxCharacters z GET /api/characters).

const DEFAULT_MAX_CHARACTERS = 4;
const ADMIN_MAX_CHARACTERS = 10;
const NPC_ACCOUNT_MAX_CHARACTERS = 50;

/**
 * @param {string} role - rola konta z bazy (req.user.role)
 * @param {boolean} [isNpcAccount] - czy to wspólne subkonto NPC (req.user.isNpcAccount)
 * @returns {number} maksymalna liczba postaci dla tego konta
 */
function getMaxCharacters(role, isNpcAccount = false) {
  if (isNpcAccount) return NPC_ACCOUNT_MAX_CHARACTERS;
  return role === 'admin' ? ADMIN_MAX_CHARACTERS : DEFAULT_MAX_CHARACTERS;
}

module.exports = {
  DEFAULT_MAX_CHARACTERS,
  ADMIN_MAX_CHARACTERS,
  NPC_ACCOUNT_MAX_CHARACTERS,
  getMaxCharacters
};
