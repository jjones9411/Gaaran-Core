// ================================
// utils/tavernCharacterData.js
// Ustala dane postaci dla wiadomości w Karczmie, zawsze weryfikując
// że wskazana postać faktycznie należy do zalogowanego użytkownika.
// ================================

const EMPTY_CHAR_FIELDS = {
  character_avatar: null,
  character_race: null,
  character_gender: null,
  character_faction: null
};

/**
 * @returns {Promise<{character_type: string, character_id: number|null, character_name: string,
 *   character_avatar: string|null, character_race: string|null, character_gender: string|null, character_faction: string|null}>}
 */
function resolveChatCharacterData(pool, userId, username, isNarrator, currentCharacter) {
  if (isNarrator) {
    return Promise.resolve({
      character_type: 'narrator',
      character_id: null,
      character_name: 'Narrator',
      ...EMPTY_CHAR_FIELDS
    });
  }

  const fallback = () => ({
    character_type: 'main',
    character_id: userId,
    character_name: username,
    ...EMPTY_CHAR_FIELDS
  });

  if (!currentCharacter || !currentCharacter.id) {
    return Promise.resolve(fallback());
  }

  // Weryfikacja własności postaci - klient nie może podać cudzego character_id
  const query = 'SELECT id, name, avatar, race, gender, faction FROM characters WHERE id = ? AND user_id = ?';

  return new Promise((resolve) => {
    pool.query(query, [currentCharacter.id, userId], (err, results) => {
      if (err || results.length === 0) {
        resolve(fallback());
        return;
      }

      const char = results[0];
      resolve({
        character_type: 'main',
        character_id: char.id,
        character_name: char.name || username,
        character_avatar: char.avatar || null,
        character_race: char.race || null,
        character_gender: char.gender || null,
        character_faction: char.faction || null
      });
    });
  });
}

module.exports = { resolveChatCharacterData };
