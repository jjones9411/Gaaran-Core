// ================================================================
// utils/uploadStorage.js
// Wspólna konfiguracja zapisu plików wgrywanych przez multer.
//
// Dlaczego wspólna:
//   1. Katalog `uploads/` jest w .gitignore, więc na świeżym klonie NIE
//      ISTNIEJE. Multer, gdy `destination` jest funkcją, sam katalogu NIE
//      tworzy - pierwszy upload kończył się wtedy błędem ENOENT (HTTP 500),
//      i to w każdej trasie zapisującej plik.
//   2. Ścieżka 'uploads/' była względna, czyli zależna od katalogu, z którego
//      wystartowano proces Node. Uruchomienie serwera spoza `backend/`
//      rozjeżdżało zapis pliku, serwowanie statyczne i kasowanie pliku
//      (to ostatnie liczone od `__dirname`). Tu liczymy wszystko od katalogu
//      backendu, więc CWD przestaje mieć znaczenie.
//   3. Błędy multera (za duży plik, zły format) leciały do domyślnego handlera
//      Expressa, który odsyła HTML-owy stack trace. Front robił na tym
//      `response.json()` i wywalał się z nic nie mówiącym błędem parsowania -
//      użytkownik widział "nic się nie dzieje". `handleUploadErrors` zamienia
//      to na czytelny JSON.
// ================================================================

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Tworzymy katalog już przy załadowaniu modułu (czyli przy starcie serwera),
// żeby pierwszy upload nie był tym, który odkrywa jego brak.
ensureUploadsDir();

// `namePrefix` pozwala trasom nazywać pliki po swojemu (np. `faction-...`);
// domyślnie prefiksem jest nazwa pola formularza, tak jak było wcześniej.
function createStorage(namePrefix) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Katalog mógł zostać skasowany w trakcie życia procesu (sprzątanie na
      // hostingu), więc upewniamy się przy każdym zapisie - mkdir z recursive
      // na istniejącym katalogu jest no-opem.
      try {
        ensureUploadsDir();
        cb(null, UPLOADS_DIR);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, (namePrefix || file.fieldname) + '-' + uniqueSuffix + ext);
    },
  });
}

const storage = createStorage();

// Allowlista bezpiecznych obrazów rastrowych. SVG jest CELOWO pominięty:
// pliki z uploads/ serwowane są statycznie z tej samej domeny co aplikacja,
// a SVG może zawierać <script>, więc otwarcie takiego "avatara" wykonałoby
// skrypt w origin aplikacji (stored XSS).
const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ALLOWED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype) || !ALLOWED_IMAGE_EXTS.includes(ext)) {
    return cb(new Error('Dozwolone formaty obrazów: PNG, JPG, GIF, WEBP'), false);
  }
  cb(null, true);
}

// Handler błędów multera - montowany ZA trasami danego routera.
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Plik jest za duży' });
    }
    return res.status(400).json({ message: `Błąd wysyłania pliku: ${err.message}` });
  }

  // Odrzucenie przez fileFilter - zwykły Error z komunikatem dla użytkownika.
  if (err && err.message && !err.status) {
    console.error('❌ Błąd uploadu:', err);
    return res.status(400).json({ message: err.message });
  }

  return next(err);
}

module.exports = {
  UPLOADS_DIR,
  ensureUploadsDir,
  createStorage,
  storage,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_IMAGE_EXTS,
  imageFileFilter,
  handleUploadErrors,
};
