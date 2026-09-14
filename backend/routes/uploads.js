// ================================
// routes/uploads.js
// Upload avatarów i obrazków
// ================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const {
  UPLOADS_DIR,
  storage,
  imageFileFilter,
  handleUploadErrors,
} = require('../utils/uploadStorage');
const { checkAdmin } = require('../middleware/auth');

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// ================================
// MULTER CONFIGURATION
// ================================
// Storage (katalog + nazwa pliku) i allowlista formatów są wspólne dla całego
// backendu - patrz utils/uploadStorage.js. Tutaj zostają już tylko limity
// rozmiaru, bo różnią się per rodzaj pliku.

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 }, // 200KB dla avatarów
  fileFilter: imageFileFilter
});

// Osobna konfiguracja dla obrazków do opisu
const uploadDescriptionImage = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB dla obrazków w opisie
  fileFilter: imageFileFilter
});

// ================================
// AVATAR - POSTAĆ (characters)
// ================================
// Avatary trzymamy WYŁĄCZNIE na `characters.avatar` - stamtąd czytają je
// auth.js i profile.js. Nie ma czegoś takiego jak avatar użytkownika:
// wcześniej istniał tu endpoint POST /uploads pisujący do `users.avatar`,
// ale takiej kolumny nigdy nie było w bazie, więc zwracał 500 - i nic go
// nie wołało (front od zawsze strzela do /characters/:id/avatar poniżej).

// POST: Upload avatara postaci
router.post('/characters/:id/avatar', upload.single('avatar'), async (req, res) => {
  const characterId = req.params.id;
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Nie przesłano pliku' });
  }

  // Sprawdź czy postać należy do użytkownika
  const checkQuery = 'SELECT avatar FROM characters WHERE id = ? AND user_id = ?';
  
  pool.query(checkQuery, [characterId, userId], async (err, results) => {
    if (err) {
      console.error('❌ Błąd sprawdzania postaci:', err);
      
      // Usuń przesłany plik
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('❌ Błąd usuwania pliku:', unlinkError);
      }
      
      return res.status(500).json({ success: false, message: 'Błąd bazy danych' });
    }

    if (results.length === 0) {
      // Usuń przesłany plik - brak uprawnień
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('❌ Błąd usuwania pliku:', unlinkError);
      }
      
      return res.status(404).json({ success: false, message: 'Postać nie znaleziona lub brak uprawnień' });
    }

    const character = results[0];

    // Usuń stary avatar jeśli istnieje
    if (character.avatar) {
      try {
        const oldAvatarPath = path.join(__dirname, '..', character.avatar);
        await fs.unlink(oldAvatarPath);
      } catch (error) {
      }
    }

    const avatarPath = `/uploads/${req.file.filename}`;

    // Zaktualizuj avatar w bazie
    pool.query('UPDATE characters SET avatar = ? WHERE id = ?', [avatarPath, characterId], (updateErr) => {
      if (updateErr) {
        console.error('❌ Błąd aktualizacji avatara:', updateErr);
        
        // Usuń przesłany plik
        fs.unlink(req.file.path).catch(unlinkError => {
          console.error('❌ Błąd usuwania pliku:', unlinkError);
        });
        
        return res.status(500).json({ success: false, message: 'Błąd aktualizacji avatara' });
      }

      res.json({
        success: true,
        message: 'Avatar postaci zaktualizowany',
        avatarPath: avatarPath,
        avatar: avatarPath,
        character: { id: characterId, avatar: avatarPath }
      });
    });
  });
});

// DELETE: Usuwanie avatara postaci
router.delete('/characters/:id/avatar', async (req, res) => {
  const characterId = req.params.id;
  const userId = req.user.id;

  // Najpierw sprawdź rolę użytkownika
  pool.query('SELECT role FROM users WHERE id = ?', [userId], (roleErr, roleResults) => {
    if (roleErr) {
      console.error('❌ Błąd sprawdzania roli użytkownika:', roleErr);
      return res.status(500).json({ success: false, message: 'Błąd bazy danych' });
    }

    const isAdmin = roleResults[0] && roleResults[0].role === 'admin';

    // Jeśli admin - może usunąć każdy avatar, jeśli nie - sprawdź właściciela
    const checkQuery = isAdmin
      ? 'SELECT avatar FROM characters WHERE id = ?'
      : 'SELECT avatar FROM characters WHERE id = ? AND user_id = ?';

    const checkParams = isAdmin ? [characterId] : [characterId, userId];

    pool.query(checkQuery, checkParams, async (err, results) => {
      if (err) {
        console.error('❌ Błąd sprawdzania postaci:', err);
        return res.status(500).json({ success: false, message: 'Błąd bazy danych' });
      }

      if (results.length === 0) {
        return res.status(404).json({ success: false, message: 'Postać nie znaleziona lub brak uprawnień' });
      }

      const character = results[0];

      // Usuń plik avatara
      if (character.avatar) {
        try {
          const avatarPath = path.join(__dirname, '..', character.avatar);
          await fs.unlink(avatarPath);
        } catch (error) {
        }
      }

      // Usuń avatar z bazy
      pool.query('UPDATE characters SET avatar = NULL WHERE id = ?', [characterId], (updateErr) => {
        if (updateErr) {
          console.error('❌ Błąd usuwania avatara:', updateErr);
          return res.status(500).json({ success: false, message: 'Błąd usuwania avatara' });
        }

        res.json({
          success: true,
          message: 'Avatar postaci usunięty',
          character: { id: characterId, avatar: null }
        });
      });
    });
  });
});

// ================================
// OBRAZKI DO OPISU (EDYTOR)
// ================================

// POST: Upload obrazka do edytora opisu
router.post('/description-images', uploadDescriptionImage.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Nie przesłano pliku' });
  }

  const imagePath = '/uploads/' + req.file.filename;
  
  res.status(200).json({
    message: 'Obrazek przesłany',
    imagePath: imagePath,
    filename: req.file.filename
  });
});

// ================================
// WIDEO DO NEWSA (EDYTOR)
// ================================

const uploadNewsVideo = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB dla wideo
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Dozwolone formaty: MP4, WebM, OGG, MOV'), false);
    }
    cb(null, true);
  },
});

// POST: Upload wideo do edytora newsów
//
// Rola admina jest tu wymagana z powodu ROZMIARU, nie treści: 50 MB na plik
// przy limicie 30 uploadów / 10 min (server.js) to 1,5 GB na konto co dziesięć
// minut, a nic tych plików nie kasuje - zapchany dysk zatrzymuje zapisy MySQL,
// czyli kładzie grę. Wcześniej trasa nie sprawdzała roli w ogóle, więc stał za
// nią KAŻDY zalogowany gracz, choć jedynym miejscem w grze, które ją woła, jest
// edytor newsów.
//
// UWAGA: newsy pisze też mistrz gry (routes/news.js: checkGameMasterOrAdmin),
// więc MG straci możliwość wstawiania wideo do własnego newsa. Jeśli ma je
// zachować, jedyna zmiana to `checkAdmin` -> `checkGameMasterOrAdmin` tutaj.
router.post('/news-videos', checkAdmin, uploadNewsVideo.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Nie przesłano pliku wideo' });
  }

  const videoPath = '/uploads/' + req.file.filename;

  res.status(200).json({
    message: 'Wideo przesłane',
    videoPath: videoPath,
    filename: req.file.filename,
  });
});

// DELETE: Usuwanie obrazka z edytora - TYLKO ADMIN
//
// Trasa kasuje plik po samej nazwie i nie ma jak sprawdzić, CZYJ to plik -
// katalog uploads/ jest wspólny dla awatarów, obrazków w opisach i plików
// newsów, a nigdzie nie zapisujemy, kto co wgrał. Do tego nazwy awatarów są
// jawne: GET /online-users działa bez tokena i podaje ścieżkę awatara każdej
// postaci online. Zwykły gracz mógł więc wyczytać awatary całej gry i skasować
// je jednym skryptem (limit uploadów obejmuje tylko POST, więc DELETE hamował
// wyłącznie limit globalny).
//
// Żaden ekran gry tej trasy nie woła - edytor opisów tylko wgrywa pliki
// (POST /description-images). Zamknięcie jej dla graczy nie zabiera więc
// niczego poza możliwością kasowania cudzych rzeczy. Kosztem jest to, że
// obrazek usunięty z opisu zostaje na dysku jako sierota - sprzątanie jest
// dziś i tak ręczne, dla żadnego typu plików nie ma automatu.
router.delete('/description-images/:filename', checkAdmin, async (req, res) => {
  // path.basename usuwa wszelkie segmenty katalogów (../, ścieżki absolutne),
  // dzięki czemu operacja nigdy nie wyjdzie poza katalog uploads/ (path traversal).
  const filename = path.basename(req.params.filename || '');

  if (!filename || filename === '.' || filename === '..') {
    return res.status(400).json({ message: 'Nieprawidłowa nazwa pliku' });
  }

  const filePath = path.join(UPLOADS_DIR, filename);

  // Dodatkowe zabezpieczenie: wynikowa ścieżka musi zostać wewnątrz uploads/.
  if (path.relative(UPLOADS_DIR, filePath).startsWith('..')) {
    return res.status(400).json({ message: 'Nieprawidłowa nazwa pliku' });
  }

  try {
    // Sprawdź czy plik istnieje
    await fs.access(filePath);
    
    // Usuń plik
    await fs.unlink(filePath);
    res.status(200).json({ message: 'Obrazek usunięty' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: 'Plik nie znaleziony' });
    }
    console.error('❌ Błąd usuwania pliku:', error);
    res.status(500).json({ message: 'Błąd usuwania pliku' });
  }
});

// Błędy multera (za duży plik, niedozwolony format) muszą wrócić jako JSON -
// front czyta z odpowiedzi `message`. Bez tego leciał domyślny HTML-owy błąd
// Expressa i użytkownik nie dostawał żadnej informacji.
router.use(handleUploadErrors);

module.exports = { router, initialize };