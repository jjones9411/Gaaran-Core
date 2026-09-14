// ================================================================
// uploadEditorImage.js
// Wspólne wgrywanie obrazków z dysku do edytorów (Tiptap/Quill).
//
// Dlaczego wspólne: wcześniej każdy edytor robił to po swojemu i praktycznie
// nigdzie nie działało tak, jak użytkownik się spodziewa:
//   * większość komponentów (bestiariusz, NPC, prawo, mechaniki, zasady,
//     notatki, tawerna, wiadomości, sesje...) wklejała plik jako `data:` URI
//     prosto w treść. W edytorze obrazek było widać, ale przy zapisie treść
//     szła do kolumny MySQL typu TEXT (limit 64 KB) - a base64 nawet małego
//     PNG-a jest większy. Efekt: zapis się wywalał albo treść wchodziła
//     obcięta i obrazek znikał po odświeżeniu.
//   * Profile.js wysyłał plik na `/api/home/upload-image`, czyli endpoint,
//     którego w backendzie w ogóle nie ma (404), a odpowiedź sprawdzał tylko
//     przez `if (response.ok)` bez gałęzi `else` - klik po prostu nic nie
//     robił, bez żadnego komunikatu.
//   * News.js wgrywał plik poprawnie, ale wstawiał ścieżkę `/uploads/...`
//     bez prefiksu `/api`, którym w całej apce chodzą pliki z backendu
//     (patrz avatary) - obrazek po zapisie leciał na 404.
//
// Tutaj jedna droga dla wszystkich: POST na /api/description-images
// (backend: routes/uploads.js) i zwrot gotowego URL-a `/api/uploads/...`,
// który idzie do treści zamiast base64.
// ================================================================

// Zgodne z allowlistą backendu (backend/utils/uploadStorage.js). SVG celowo
// pominięty - pliki z uploads/ lecą z tej samej domeny, a SVG umie <script>.
export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// Do atrybutu `accept` w <input type="file"> - żeby okno wyboru pliku od razu
// pokazywało tylko to, co backend przyjmie.
export const EDITOR_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp';

// Limit z backendu dla obrazków w treści (uploadDescriptionImage).
export const MAX_EDITOR_IMAGE_BYTES = 2 * 1024 * 1024;

// Zwraca komunikat błędu albo null, gdy plik jest w porządku.
export function validateEditorImage(file) {
  if (!file) return 'Nie wybrano pliku';

  if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
    return 'Dozwolone formaty obrazów: PNG, JPG, GIF, WEBP';
  }

  if (file.size > MAX_EDITOR_IMAGE_BYTES) {
    return 'Plik jest za duży (max 2 MB)';
  }

  return null;
}

// Ścieżki zapisane w bazie są w formie `/uploads/plik.png` (tak zwraca backend),
// ale front musi je wołać przez prefiks `/api`, bo pod tym adresem stoi backend.
// Część starszych tras zapisywała samą nazwę pliku (np. `image-123.png`) - takie
// wpisy też doklejamy do katalogu uploads, żeby stare rekordy dalej się pokazywały.
// Zewnętrzne URL-e (http://, https://, data:, //cdn...) zostawiamy bez zmian.
export function resolveUploadUrl(value) {
  if (!value) return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/api/')) return trimmed;
  if (trimmed.startsWith('/uploads/')) return `/api${trimmed}`;

  return `/api/uploads/${trimmed.replace(/^\/+/, '')}`;
}

// Wgrywa plik na serwer i zwraca URL do wstawienia w treść.
// Rzuca Error z komunikatem po polsku - wołający pokazuje go userowi.
export async function uploadEditorImage(file) {
  const validationError = validateEditorImage(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const token = localStorage.getItem('token');
  const body = new FormData();
  body.append('image', file);

  let response;
  try {
    response = await fetch('/api/description-images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
  } catch (error) {
    console.error('Błąd sieci przy wysyłaniu obrazka:', error);
    throw new Error('Brak połączenia z serwerem - obrazek nie został wysłany');
  }

  // Backend odpowiada JSON-em również na błędy (patrz handleUploadErrors),
  // ale gdyby po drodze wpadł HTML (np. z proxy), nie chcemy wywalić się na
  // parsowaniu - stąd catch.
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Nie udało się wysłać obrazka (HTTP ${response.status})`);
  }

  if (!data.imagePath) {
    throw new Error('Serwer nie zwrócił ścieżki do obrazka');
  }

  // Pliki z backendu chodzą przez prefiks /api - tak samo jak avatary.
  return `/api${data.imagePath}`;
}

export default uploadEditorImage;
