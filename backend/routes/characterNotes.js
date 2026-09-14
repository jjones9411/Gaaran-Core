// ================================
// routes/characterNotes.js
// Notatki postaci
// ================================

const express = require('express');
const router = express.Router();

const { resolveCharacterIdAsync } = require('../utils/activeCharacter');

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// ================================
// CHARACTER NOTES ENDPOINTS
// ================================

// GET: Pobierz wszystkie notatki dla zalogowanej postaci
router.get('/notes', async (req, res) => {
  try {
    // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
    const characterId = await resolveCharacterIdAsync(req);

    if (!characterId) {
      return res.status(400).json({ message: 'Brak aktywnej postaci' });
    }

    const [notes] = await pool.promise().query(
      'SELECT * FROM character_notes WHERE character_id = ? ORDER BY created_at ASC',
      [characterId]
    );

    res.json(notes);
  } catch (error) {
    console.error('❌ Błąd pobierania notatek:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// POST: Dodaj nową notatkę
router.post('/notes', async (req, res) => {
  try {
    const { title, content } = req.body;

    // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
    const characterId = await resolveCharacterIdAsync(req);

    if (!characterId) {
      return res.status(400).json({ message: 'Brak aktywnej postaci' });
    }

    if (!title || !content) {
      return res.status(400).json({ message: 'Tytuł i treść są wymagane' });
    }

    const [result] = await pool.promise().query(
      'INSERT INTO character_notes (character_id, title, content) VALUES (?, ?, ?)',
      [characterId, title, content]
    );

    const [newNote] = await pool.promise().query(
      'SELECT * FROM character_notes WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newNote[0]);
  } catch (error) {
    console.error('❌ Błąd tworzenia notatki:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// PUT: Edytuj notatkę
router.put('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
    const characterId = await resolveCharacterIdAsync(req);

    if (!characterId) {
      return res.status(400).json({ message: 'Brak aktywnej postaci' });
    }

    if (!title || !content) {
      return res.status(400).json({ message: 'Tytuł i treść są wymagane' });
    }

    const [checkNote] = await pool.promise().query(
      'SELECT * FROM character_notes WHERE id = ? AND character_id = ?',
      [id, characterId]
    );

    if (checkNote.length === 0) {
      return res.status(403).json({ message: 'Nie masz dostępu do tej notatki' });
    }

    await pool.promise().query(
      'UPDATE character_notes SET title = ?, content = ? WHERE id = ?',
      [title, content, id]
    );

    const [updatedNote] = await pool.promise().query(
      'SELECT * FROM character_notes WHERE id = ?',
      [id]
    );

    res.json(updatedNote[0]);
  } catch (error) {
    console.error('❌ Błąd edycji notatki:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// DELETE: Usuń notatkę
router.delete('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Postać z TOKENA (z zapasem na `is_active`) - patrz utils/activeCharacter.js.
    const characterId = await resolveCharacterIdAsync(req);

    if (!characterId) {
      return res.status(400).json({ message: 'Brak aktywnej postaci' });
    }

    const [checkNote] = await pool.promise().query(
      'SELECT * FROM character_notes WHERE id = ? AND character_id = ?',
      [id, characterId]
    );

    if (checkNote.length === 0) {
      return res.status(403).json({ message: 'Nie masz dostępu do tej notatki' });
    }

    await pool.promise().query(
      'DELETE FROM character_notes WHERE id = ?',
      [id]
    );

    res.json({ message: 'Notatka usunięta pomyślnie' });
  } catch (error) {
    console.error('❌ Błąd usuwania notatki:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

module.exports = { router, initialize };