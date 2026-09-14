# Przegląd kodu — lista problemów (Gaaran Engine)

Data: 2026-07-10. Audyt backendu i frontendu pod kątem błędów, niespójności i luk bezpieczeństwa,
oraz spójności wizualnej. Legenda: 🔴 krytyczne / 🟠 istotne / 🟡 drobne / 🎨 wizualne.

## Bezpieczeństwo — backend

### 🔴 B1. Path traversal / kasowanie dowolnego pliku — `routes/uploads.js`
`DELETE /description-images/:filename` składa ścieżkę przez
`path.join(__dirname, '..', 'uploads', filename)` bez sanityzacji `filename`.
Zalogowany użytkownik może wysłać `filename` z `../` i skasować dowolny plik na serwerze
(np. `../.env`, `../.installed`, avatary innych graczy).
**Fix:** `path.basename(filename)` + walidacja, że wynik zostaje w katalogu `uploads`.

### 🟠 B2. Bypass autoryzacji przez `String.includes()` — `server.js`
Middleware autoryzacji i „więzienia” zwalnia ścieżkę przez
`publicPaths.some(path => req.path.includes(path))`. `includes()` dopasowuje podłańcuch
w DOWOLNYM miejscu ścieżki, więc każda trasa zawierająca np. `/races`, `/login`, `/install`
omija globalny `verifyToken`. Dziś ratują to per‑route `verifyToken`, ale to kruche —
dodanie nowej trasy z taką frazą po cichu ją odsłoni.
**Fix:** dopasowanie prefiksowe (`req.path === p || req.path.startsWith(p + '/')`).

### 🟡 B3. Upload SVG → stored XSS — `routes/uploads.js`
`fileFilter` akceptuje wszystko co `image/*` (w tym `image/svg+xml`). Pliki z `uploads/`
są serwowane statycznie z tej samej domeny; SVG może zawierać `<script>`, więc otwarcie
URL‑a avatara wykonuje skrypt w origin aplikacji.
**Fix:** allowlista rozszerzeń/mimetype (png/jpg/jpeg/gif/webp), bez svg.

### 🟡 B4. Martwy warunek `is_deleted` — `middleware/auth.js`
`verifyToken` sprawdza `user.is_deleted`, ale `SELECT` pobiera tylko `id, user, role, blocked_until`,
a kolumna `is_deleted` nie istnieje w schemacie `users`. Warunek jest zawsze `undefined` → nigdy nie działa.
Nie powoduje szkody (fail‑open na nieistniejącej funkcji), ale wprowadza w błąd.
**Fix:** usunąć martwy warunek lub dodać realną kolumnę + do zapytania.

### 🟡 B5. Enumeracja kont — `routes/passwordReset.js`, `routes/auth.js`
`/forgot-password` zwraca „Nie znaleziono użytkownika” (400) dla nieistniejącego e‑maila,
a `/login` rozróżnia „Nie znaleziono użytkownika” vs „Niepoprawne hasło”. Pozwala to zbadać,
które e‑maile/konta istnieją. `/forgot-password` nie ma też rate‑limitu.
**Fix (opcjonalnie):** jednolity komunikat + rate limit. Dla gry to niski priorytet — udokumentowane.

## Frontend / spójność

### 🟡 F1. Token w `localStorage` (185 miejsc)
JWT trzymany w `localStorage` jest dostępny dla JS → przy XSS wyciek tokenu. Sanityzacja HTML
jest już na miejscu (`sanitizeHtml` przy wszystkich `dangerouslySetInnerHTML`), co mocno ogranicza
ryzyko. Zmiana na httpOnly cookie to duży refaktor — udokumentowane, nie ruszam teraz.

### ✅ F2. `dangerouslySetInnerHTML`
Sprawdzone — wszystkie użycia przechodzą przez `sanitizeHtml` (DOMPurify + hook na `rel=noopener`).
Bez zmian.

## Wizualne 🎨

### 🎨 W1. „Blok czerni po środku” na podstronach aktywności
Podstrony miejskie (`Rest`, `Work`, `Explore`, `Hospital`, `Training`, `Shop`, `Craft`,
`BlackMarket`, `Arena`, `Headquarters`) używają `Container maxWidth="md"` z własnym
`bgcolor: theme.palette.background.default`. Efekt: wyśrodkowany ciemny prostokąt na tle
aplikacji zamiast układu od krawędzi do krawędzi. Najbardziej widoczne w `/home/rest`.
**Fix:** edge‑to‑edge (pełna szerokość, tło z theme/rasy, treść w wewnętrznym `maxWidth`),
akcenty z `useRaceColor` zamiast surowych `primary`/`success`/`error`.

### 🎨 W2. Kolory rasowe zamiast krzyczących akcentów
Podstrony `/city/*` mają brać akcent z koloru rasy gracza (`useRaceColor`), stonowany,
zamiast jaskrawych `success.main`/`error.main`/`info.main`. Ujednolicić nagłówki, przyciski
„◄ MIASTO”, paski postępu i karty.

### 🎨 W3. Strony auth (`/login`, `/register`, `/resetpassword`, `/newpassword`, `/activate`)
Dopasować do klimatu gry (wspólne tło `appBackgroundSx`, paleta `appColors`, font Cinzel na
nagłówkach). Ujednolicić między sobą.

---

## Status realizacji (2026-07-10)

- ✅ **B1** path traversal w uploads — naprawione (`path.basename` + walidacja katalogu)
- ✅ **B2** bypass autoryzacji `.includes()` — naprawione (dopasowanie prefiksowe)
- ✅ **B3** upload SVG → XSS — naprawione (allowlista PNG/JPG/GIF/WEBP)
- 📝 **B4/B5/F1** udokumentowane (niski priorytet / duży refaktor) — bez zmian
- ✅ **W1/W2** `/city/*` — wspólny `CityPageLayout` (edge-to-edge, kolory rasy):
  Rest, Work, Explore, Training, Headquarters, Arena, Hospital, Craft przeniesione;
  Shop, BlackMarket zachowały układ tabel z akcentami rasy
- ✅ **W3** strony auth — ActivateAccount i NewPassword dopasowane fontem/tłem do
  Login/Register/ResetPassword (już spójnych)
- ✅ `/home/*` (pozostałe strony treści) — przejrzane: używają theme spójnie,
  bez krzyczących kolorów ani wyśrodkowanych „bloków czerni”; bez zmian potrzebnych

Wszystkie zmiany zbudowane (`rsbuild build`, EXIT=0) i wypchnięte na branch.

---

## Wgrywanie obrazków z dysku (2026-07-29)

Zgłoszenie: „dodawanie zdjęć z komputera nie działa prawie nigdzie” (m.in. własne
zakładki w profilu). Audyt wykazał trzy niezależne przyczyny.

### 🔴 U1. Profil wołał nieistniejący endpoint
`Profile.js` wysyłał plik na `POST /api/home/upload-image` — takiej trasy nie ma
w backendzie (404). Odpowiedź sprawdzana była tylko przez `if (response.ok)`, bez
gałęzi `else`, więc klik nie robił nic i nie pokazywał błędu.
**Fix:** wspólny helper `uploadEditorImage` → istniejące `POST /api/description-images`
+ komunikat błędu.

### 🔴 U2. Reszta edytorów wklejała base64 zamiast wgrywać plik
Bestiariusz, NPC, prawo, narkotyki, mechaniki, zasady, poradnik alchemii, hall ras,
technologie, wieści, notatki postaci, tawerna, wiadomości i sesje wstawiały plik jako
`data:` URI prosto w treść. W edytorze obrazek było widać, ale treść trafiała do kolumny
`TEXT` (limit 64 KB), a base64 nawet małego PNG-a jest większy — zapis się wywalał albo
treść wchodziła obcięta i obrazek znikał po odświeżeniu.
**Fix:** wszystkie edytory wgrywają plik na serwer i wstawiają ścieżkę.

### 🟠 U3. Ścieżki do plików bez prefiksu `/api`
Pliki z backendu chodzą przez `/api` (tak jak avatary), ale `News.js` wstawiał
`/uploads/...` (obrazki i wideo), `CityHub` renderował tło rasy z surowej ścieżki,
`mechanics.js` zapisywał samą nazwę pliku, a `Rules.js` czytał `rule.image` zamiast
kolumny `image_path` (zawsze `undefined`). Wgrany plik się zapisywał, ale nie wyświetlał.
**Fix:** `resolveUploadUrl()` na froncie (ogarnia też stare rekordy z samą nazwą pliku)
i ujednolicony format ścieżki w backendzie.

### 🟠 U4. Katalog `uploads/` i błędy multera
`uploads/` jest w `.gitignore`, więc na świeżym klonie nie istnieje; multer z
`destination` jako funkcją sam go nie tworzy (ENOENT → 500). Ścieżka była też względna
wobec CWD procesu. Błędy multera (za duży plik, zły format) leciały jako HTML-owy błąd
Expressa, na którym front wywalał się przy `response.json()`.
**Fix:** `backend/utils/uploadStorage.js` — absolutna ścieżka liczona od katalogu
backendu, `mkdir` przy starcie i przy każdym zapisie, wspólna allowlista PNG/JPG/GIF/WEBP
oraz `handleUploadErrors` zwracający JSON. Podpięte we wszystkich trasach z multerem.

---

## Audyt pętli produkcyjnej: craft, rynek, huta/warsztat, palenisko, eksploracja, wydobycie (2026-07-31)

Zgłoszenie: „w niektórych miejscach — w palenisku albo w craftcie — pojawiają się rzeczy,
których nigdzie nie można znaleźć do produkcji”.

Metoda: zestawienie KAŻDEGO surowca z katalogu `backend/utils/marketPricing.js` (55 pozycji)
z kompletną listą miejsc, które go **tworzą** i które go **zużywają**. Źródła surowców to
wszystkie miejsca z `INSERT INTO character_resources`: `/gather` (Wydobycie), `/explore`
(Eksploracja), `/farming` (Uprawa), `/refine` (Huta i Warsztat), `utils/monsterLoot.js`
(trofea z areny), `/market` (Rynek NPC), `/bazaar` (handel gracz–gracz) oraz
`POST /craft/salvage` (złomowanie).

### 🔴 P1. MLEKO — receptury bez żadnego źródła produkcji  ✅ NAPRAWIONE

`milk` był wymagany przez **trzy receptury**:

| Receptura | Miejsce | Koszt |
|---|---|---|
| Wyrób sera (`make_cheese`) | Warsztat `/home/refine` | 2× mleko + 1× sól |
| Podpłomyki (`cook_flatbread`) | Palenisko `/home/cook` | 2× zboże + 1× mleko |
| Owsianka (`cook_porridge`) | Palenisko `/home/cook` | 2× zboże + 2× mleko + 1× owoce |

…a **nie powstawało nigdzie**: nie ma go w żadnej tabeli dropów `/gather`, w puli
`/explore`, w `SEED_TO_HERB` uprawy, w recepturach `/refine` ani w tabelach łupów
z potworów. Jedynym sposobem zdobycia był zakup na Rynku ze **startowego magazynu
4000 sztuk, którego nic nie uzupełnia** (`market_state` rośnie tylko wtedy, gdy
gracze sprzedają dany surowiec do gry — a mleka nikt sprzedać nie mógł, bo nikt go
nie miał). Po wykupieniu zapasu te trzy receptury stawały się na stałe niewykonalne,
mimo że dalej widniały w UI Paleniska i Warsztatu z opisem składników.

**Fix:** mleko leci teraz z lokacji **Pola** w Wydobyciu (`routes/gather.js`,
chance 0.35, 2–5 szt.) — z tego samego obejścia gospodarstwa, co wełna.

### 🔴 P2. `database/schema.sql` nie zawierał gospodarki  ✅ NAPRAWIONE

Kreator instalacji (`routes/install.js`) importuje **wyłącznie** `database/schema.sql`.
Plik nie miał ani jednej tabeli gospodarczej:

- `resource_types`, `market_state`, `character_resources`, `resource_listings`
  (z `database/economy-rework.sql`),
- `character_gardens`, `character_plantings` (z `database/economy-farming.sql`),
- kategorii `'buff'` w enumie `consumable_types.category` i kolumny `consumed_on_use`
  (z `database/economy-alchemy.sql`),
- **78 wierszy `consumable_types`** będących wyjściami rzemiosła: jadalne z Warsztatu
  (`food_*`), potrawy z Paleniska (`dish_*`, w tym bigos i pemmikan), zepsuta potrawa
  oraz wszystkie mikstury Alchemii w pięciu progach jakości (`napar_*`, `miks_*`,
  `mikstura_lecznicza_*`).

Za to `consumable_types` wciąż wiózł apteczki `medkit_1..5`, `energy_drink` i `coffee`,
usunięte z gry migracją `economy-crafting.sql`.

Skutkiem na świeżej instalacji było dokładnie to, co opisuje zgłoszenie: Palenisko,
Warsztat, Kuźnia i Alchemia pokazują pełne listy receptur, ale każda próba kończy się
błędem — brak tabeli `character_resources` (`ER_NO_SUCH_TABLE`) albo złamany klucz obcy
`character_consumables_ibfk_2` przy zapisie gotowego produktu.

**Fix:** cała warstwa gospodarcza dopisana do `schema.sql` (sekcja „GOSPODARKA VARGARDU”
na końcu pliku, po sekcji `Constraints` — tak jak klany i więzienie). Seed
`resource_types` zweryfikowany 1:1 ze stałą `RESOURCES` w `marketPricing.js` (55/55
pozycji, zgodne ceny, magazyny i `barter_only`), komplet 78 typów konsumpcyjnych
zweryfikowany z `craftingRecipes.js` i `CHEMISTRY_RECIPES`. Istniejące bazy migruje się
jak dotąd, plikami z `database/` — kolejność jest wypisana w komentarzu nowej sekcji.

### 🟠 P3. Luksusy spoza wyspy — dostępne wyłącznie ze skończonego magazynu Rynku  ✅ ROZSTRZYGNIĘTE

`market_state.stock` nie jest odnawiany — nie ma crona uzupełniającego zapasy. Dla
towarów, których gracz nie potrafi wyprodukować, zapas startowy jest całą pulą, jaka
kiedykolwiek istnieje w grze.

⚠️ **Korekta pierwotnej diagnozy:** napisałem tu wcześniej, że luksusy „nie są składnikiem
żadnej receptury, więc nie blokują niczego”. To prawda tylko połowicznie — mają odbiór,
tylko nie w rzemiośle: **skarbiec klanu** (`POST /faction/treasury/deposit`) przyjmuje
wyłącznie towary kategorii `luxury` i przelicza je na **prestiż rasy**
(`utils/raceBonuses.js`). Luksus to więc nie ozdobnik, tylko waluta prestiżu.

**Decyzja:** luksusy wypadają z handlu rynkowego **w obie strony** — flaga `gm_only`
w `marketPricing.js`. Gracz nie kliknie ani „kup", ani „sprzedaj"; na liście Rynku mają
plakietkę „nie na sprzedaż", a obie kolumny cen mówią „poza handlem". Ceny bazowe zostają
podniesione 10× (jedwab 12 000 … obca księga 60 000), ale są teraz **wyceną, nie ceną
zakupu** — służą prestiżowi w skarbcu klanu i wycenie konfiskaty w banku.

Do świata wchodzą wyłącznie **przesyłką MG** (`POST /admin/resource-grant`, sekcja
„Przesyłka do Postaci" w panelu admina) — statkiem kupieckim, jako łup, jako zapłata od
NPC-a, z uzasadnieniem fabularnym trafiającym do dziennika postaci. Dalej krążą już
między graczami barterem na Bazarze. Kanał MG jest dwuetapowy: podgląd rozwija podane ID
(postaci **albo** gracza) w konkretne imię postaci i konto właściciela, a wysyłka wymaga
potwierdzenia zwróconego ID konta — z samego „42" nie widać, czyja to postać, a pomyłka
o jedną cyfrę oznacza wsypanie najdroższych rzeczy w grze obcemu graczowi.

Zakazany reagent (czarny rynek, `950` złota) zostaje bez zmian — dalej nie wchodzi
do niczego i nie ma źródła produkcji. Zostawiam do osobnej decyzji.

### 🟠 P4. `Stary relikt` i `Pradawny tom` — pozycje nie do zdobycia w żaden sposób  ✅ NAPRAWIONE

Oba mają `barter_only: true`, czyli Rynek odmawia ich kupna i sprzedaży, a jednocześnie
nie było w kodzie ani jednego miejsca, które by je komukolwiek przyznawało. Widniały
na liście Rynku jako pozycje bez ceny, których nie sposób zdobyć.

**Fix:** wypadają teraz z **eksploracji**, z nikłą szansą (`routes/explore.js`, wagi 0,06
i 0,03 przy sumie puli ~92 — mniej więcej jedno znalezisko na 1 500 i na 3 000 udanych
rzutów). Zostają `barter_only`, więc rynek dalej nie postawi im ceny w złocie i jedyną
drogą dalej jest barter na Bazarze. Mają własny komunikat w dzienniku wyprawy, żeby
znalezisko raz na wiele wypraw nie przeleciało jako zwykły surowiec.

### 🟡 P5. Wytwory bez zastosowania (ślepe gałęzie produkcji)  ✅ DOMKNIĘTE

⚠️ **Korekta pierwotnej diagnozy:** wpisałem tu adamantium, mithril i meteoryt jako
surowce „tylko na sprzedaż”. Szukałem odbiorców po kodzie, a ich jedyny odbiorca siedzi
w **danych**: tabela `faction_building_materials` (z `database/economy-headquarters.sql`)
wymagała ich na **3. poziom każdej budowli klanowej**. Rozbudowa siedziby wisiała więc
na dropie o szansie 1–2% z kopalni.

Stan po zmianach:

| Surowiec | Skąd | Do czego — po zmianie |
|---|---|---|
| Brąz | Huta: miedź + ruda cyny + węgiel | **okucia broni** od 41. poziomu (1 szt., od 71. — 2) + **3. poziom Młyna i Kuźni klanu** |
| Mosiądz | Huta: miedź + ruda cynku + węgiel | **okucia pancerza** od 41. poziomu (1 szt., od 71. — 2) + **3. poziom Paleniska, Chaty Uzdrowiciela i Gospody** |
| Destylowany alkohol | Warsztat: 2× alkohol | **wzmocnienie warzenia** w Alchemii (patrz niżej) |
| Kryształ, Adamantium, Mithril, Meteoryt | — | **usunięte z gry** |

**Okucia z metali kolorowych** (`routes/craft.js`): stal trzyma ostrze i płytę, ale jelec,
głowica, klamry i sprzączki idą z brązu i mosiądzu. Dzięki temu sprzęt z górnej półki
wymaga pełnej huty, a nie samej stali — i ruda cyny oraz cynku przestaje być ciekawostką.

**Wzmocnienie destylatem** (`routes/alchemy.js`): alchemik z wprawą **≥ 50** może dosypać
do warzenia 1 destylat na próbę i losuje wtedy jakość tak, jakby miał **+20 wprawy** —
czyli tym samym mechanizmem, którym bonus klasowy działa przy kowadle. Niżej niż 50 gra
na to nie pozwala (destylat by się zmarnował). Destylat schodzi po jednym za KAŻDĄ próbę,
także spaloną. W oknie warzenia jest przełącznik pokazujący, ile destylatu zejdzie i o ile
rośnie szansa na pełny sukces.

**Usunięcie rzadkich minerałów** (`database/economy-resource-cleanup.sql`) nie zabiera nic
za darmo: gracze i klany dostają zwrot w złocie po cenie bazowej (sakwy, depozyty ofert
na Bazarze, magazyny klanowe), oferty barterowe żądające skasowanego surowca są zwracane
w naturze i usuwane, a koszty 3. poziomu budowli klanowych zostają podmienione na brąz
i mosiądz — bez tego żadna siedziba nie dałaby się już rozbudować, bo
`faction_building_materials` nie ma klucza obcego do `resource_types`.

### 🟡 P6. Dalsza drift schematu poza gospodarką — do sprawdzenia

Przy okazji wyszło, że `database/schema.sql` nie ma kolumny
`faction_statistics.gold_balance`, którą dokłada `database/fix-schema-drift.sql`, a której
kod wymaga (`cron/buildingMaintenance.js`, `POST /faction/gold/deposit`). Dopisałem ją,
bo migracja usuwania minerałów zwraca do niej wartość skasowanych zapasów klanu — ale
`fix-schema-drift.sql` naprawia więcej rzeczy i **nie sprawdzałem, czy reszta z nich
trafiła do `schema.sql`**. Warto przejść ten plik pozycja po pozycji osobnym audytem.

### ✅ Sprawdzone i bez zastrzeżeń

- **Kuźnia** (`craftMaterialCost`): metal (żelazo/stal) + drewno wg poziomu broni
  (sosna → leszczyna → wiąz → cis) albo skóry + wyściółka (lniana koszula do lvl 20,
  wyżej przeszywanica), a od 41. poziomu okucia z brązu (broń) lub mosiądzu (pancerz).
  Wszystkie składniki mają źródła: drewno z lasu (`/gather`, `/explore`), skóry z Łowów,
  areny i eksploracji, metale z Huty i ze złomowania, wyściółka z Krawiectwa.
- **Alchemia**: wszystkie 12 receptur (napary, miksy, mikstury lecznicze) mają komplet
  składników do zdobycia — bazy (alkohol, wyciąg, baza do maści) z Warsztatu,
  zioła z lasu/pól/uprawy, krew bestii z Łowów, areny i eksploracji.
- **Palenisko**: po naprawie P1 wszystkie 13 receptur są wykonalne.
- **Huta i Warsztat**: wszystkie 15 receptur wykonalnych; `illanias` i `dynallca`
  nie mają własnego węzła w Wydobyciu, ale są osiągalne przez eksplorację oraz
  uprawę z nasion (nasiona illanias lecą z Lasu, nasiona dynallca z Pól).
- **Uprawa**: koszt grządki (sosna, leszczyna, kamień) i wszystkie cztery nasiona
  mają źródła w Wydobyciu i eksploracji.

---

# Audyt przedpremierowy backendu (2026-08-05)

Zakres zamówiony przed startem gry (10 sierpnia): błędy, odporność na DDoS
oraz „myczki" graczy — omijanie limitu 4 postaci na konto, szybsze lvlowanie,
szybsze uczenie się.

Legenda: 🔴 krytyczne / 🟠 istotne / 🟡 drobne.

## Wyścigi w mechanice (duplikacja nagród i omijanie limitów)

Wspólny mianownik wszystkich pozycji poniżej: trasa czyta stan postaci jednym
zapytaniem, liczy wynik w pamięci, a zapisuje go osobnym zapytaniem — bez
blokady wiersza. Między odczytem a zapisem mieści się kilkanaście innych
żądań tego samego gracza. To NIE wymaga żadnego narzędzia poza `Promise.all`
w konsoli przeglądarki.

### 🔴 R1. Limit 4 postaci na konto do obejścia — `routes/characters.js`  ✅ NAPRAWIONE
`POST /createCharacter` robiło `SELECT COUNT(*)`, potem cztery inne zapytania,
a dopiero na końcu `INSERT`. Kilkanaście równoległych żądań odczytywało count = 0
i każde wstawiało postać. Konto kończyło z dowolną liczbą postaci — czyli z
wielokrotnością puli staminy, dziennych limitów pracy i slotów na łupy.
**Fix:** cała operacja w jednej transakcji otwartej `SELECT ... FROM users
WHERE id = ? FOR UPDATE`. Blokujemy wiersz KONTA, nie postaci — postaci przy
pierwszym żądaniu jeszcze nie ma, a atak zaczyna się właśnie od zera.
Dodatkowo `characterCreateLimiter` (10/godz.) i `database/add-character-name-unique.sql`
na kolizje imion między RÓŻNYMI kontami.

### 🔴 R2. Duplikacja łupów i punktów AP w eksploracji — `routes/explore.js`  ✅ NAPRAWIONE
Najpoważniejszy z całej listy. `POST /explore` zapisywało staminę, złoto i exp
wartościami BEZWZGLĘDNYMI (`current_stamina = ?`), ale łupy zapisem WZGLĘDNYM
(`quantity = quantity + ...`, `available_points = available_points + ?`,
INSERT-y do ekwipunku). Przy N żądaniach naraz koszt liczył się RAZ (wszystkie
zapisywały tę samą wartość staminy), a surowce, przedmioty i AP dokładały się
N RAZY. Dwadzieścia równoległych fetchy = dwadzieścia wypraw łupów i AP za
jedną pulę staminy. To jest jednocześnie „szybsze lvlowanie" (AP), „szybsze
uczenie się" (surowce na craft) i inflacja gospodarki (relikty).
**Fix:** cała wyprawa w transakcji z `FOR UPDATE` na wierszu postaci
+ walidacja `staminaToSpend` (liczba całkowita, sufit 1000/żądanie — bez tego
postać z wysokim maksem staminy budowała w pamięci setki tysięcy wpisów logu).

### 🔴 R3. Wielokrotne wydanie tych samych AP — `routes/arena.js`  ✅ NAPRAWIONE
`POST /character/increase-stat` sprawdzało `available_points` SELECT-em, a
odejmowało zapisem względnym bez warunku w `WHERE`. Równoległe żądania: każde
widziało te same 10 AP, każde dokładało pełny przyrost statystyki, `available_points`
schodziło na wartość ujemną (kolumna jest `int` ze znakiem). Dziesięciokrotność
statystyk za jedną pulę punktów.
**Fix:** `WHERE id = ? AND available_points >= ?` + kontrola `affectedRows`.
Wariant zbiorczy `/character/increase-stats` był już poprawny (transakcja + `FOR UPDATE`).

### 🟠 R4. Odtwarzanie wydanego złota — `routes/training.js`, `routes/rest.js`  ✅ NAPRAWIONE
Trening zapisywał `gold = ?` i `current_stamina = ?` wartościami policzonymi
z odczytu sprzed kilku zapytań. Taki zapis kasuje wszystko, co działo się w
międzyczasie na tym wierszu — a wystarczą do tego DWIE KARTY przeglądarki:
odczytaj stan przy 10 000 złota, w drugiej karcie wydaj 9 000 w sklepie, pozwól
treningowi się dokończyć i wiersz wraca do 10 000 minus koszt treningu.
To samo w `/rest/contribute-stamina` (stamina).
**Fix:** zapisy względne z warunkiem `WHERE ... AND current_stamina >= ? AND gold >= ?`
i kontrolą `affectedRows` — ten sam wzorzec, który był już w `/work` i `/gather`.

### 🔴 R5. Darmowe walki na arenie — `routes/arena.js`  ✅ NAPRAWIONE
Najkrótsza droga do „szybszego lvlowania" w całej grze, a wymagała dopisania
JEDNEGO pola do żądania. `POST /arena/fight` przyjmowało z ciała żądania flagę
`fromExploration` i — gdy była ustawiona — POMIJAŁO pobranie staminy
(„stamina zeszła już w eksploracji"). Flagę wysyła klient i nic jej nie
weryfikowało.

Zmierzone na wgranej bazie produkcyjnej, ta sama postać, ten sam potwór:

| | stamina | exp |
|---|---|---|
| 10 walk **bez** flagi | 113 → 103 | +40 |
| 10 walk **z** flagą | 113 → **113** | +40 |

Identyczne nagrody (exp, złoto, trofea), zerowy koszt, bez limitu.
**Fix:** uprawnienie do darmowej walki żyje po stronie serwera. Eksploracja,
która faktycznie natknie się na potwora, zapisuje oczekujące spotkanie
(`explore_encounters`, migracja `database/add-explore-encounters.sql`), a arena
je KONSUMUJE — jednorazowo i tylko dla tego samego potwora. Udana ucieczka
(`/arena/flee`) też zamyka spotkanie, żeby nie zostawiać „biletu na potem".
Gdy wpisu nie ma, flaga jest ignorowana i walka kosztuje staminę jak każda inna
(świadomie nie odrzucamy żądania — gracz w najgorszym razie płaci normalną cenę
zamiast dostać błąd, którego nie rozumie; próba trafia do logu serwera).

### 🟠 R6. Wyścig w pojedynczej walce — `routes/arena.js`  ✅ NAPRAWIONE
Ta sama trasa czytała postać, symulowała walkę i zapisywała wynik trzema
osobnymi zapytaniami bez blokady. Zmierzone: **20 równoległych walk pobrało
3 staminy** (113 → 110) i zapisało `total_fights = 3` — czyli 20 walk w cenie
3, z trofeami przyznanymi za wszystkie (łupy szły zapisem względnym).
**Fix:** transakcja z `FOR UPDATE`, liczniki walk zapisem względnym, trofea
i zużycie ekwipunku w tym samym commicie. Po poprawce: 20 walk = 20 staminy,
`total_fights = 20`.

### 🔴 R7. Duplikacja przedmiotów na rynku — `routes/shop.js`  ✅ NAPRAWIONE
`POST /shop/list-consumable` sprawdzało stan plecaka SELECT-em, a odejmowało
osobnym `UPDATE ... quantity = quantity - ?` bez warunku i bez transakcji.
Zmierzone: **10 sztuk w plecaku → 20 sztuk wystawionych na rynku**. Kolumna
`quantity` jest `int` ze znakiem, więc schodziła też poniżej zera. Sprzedaż
duplikatów to prosta droga do nieskończonego złota.
**Fix:** transakcja z `FOR UPDATE` na wierszu zapasu + odjęcie warunkowe
(`WHERE quantity >= ?` i kontrola `affectedRows`). Strona KUPUJĄCA była już
zabezpieczona atomowo — brakowało drugiej połowy.
Przy okazji `POST /shop/unlist-consumable`: kasowało ofertę po samym `id`, nie
patrząc na `affectedRows`, i dopisywało towar do plecaka zapisem względnym —
dwa żądania w tym samym oknie oddawały zawartość oferty dwa razy. Okno było
wąskie (nie udało się go trafić 20 żądaniami), ale poprawka kosztuje jedną
linię: `DELETE ... AND seller_id = ?` + sprawdzenie `affectedRows`.

## Odporność na DDoS i przeciążenie

### 🔴 D1. Brak jakiegokolwiek globalnego rate limitu  ✅ NAPRAWIONE
Limity istniały dokładnie trzy (arena multi-fight, ponowna aktywacja, czat).
Reszta API była otwarta na oścież, a KAŻDE żądanie za autoryzacją kosztowało
**trzy zapytania do bazy**, zanim dotarło do swojej trasy: `SELECT` użytkownika
w `verifyToken`, `UPDATE users SET last_seen`, i drugi, identyczny `SELECT` w
`checkJail`. Przy puli 10 połączeń wystarczyła pętla `fetch` z jednej maszyny.
**Fix:** `globalLimiter` (300 żądań/min na KONTO, z odwrotem na IP) zamontowany
PRZED parserem ciała i przed autoryzacją — odrzucone żądanie nie dotyka bazy.

### 🔴 D2. `/login` i `/register` bez limitu, z bcryptem  ✅ NAPRAWIONE
Obie trasy są publiczne i liczą bcrypta z kosztem 10 (~100 ms CPU na żądanie).
Node ma jeden wątek: kilkaset żądań na minutę zagładza pętlę zdarzeń i staje
CAŁA gra, nie tylko logowanie. Ta sama dziura to brute force hasła, a przy
rejestracji dodatkowo wysyłka maila na dowolny adres bez ograniczeń (wypalenie
limitu SMTP i domena na czarnych listach).
**Fix:** `authLimiter` (20 nieudanych prób/15 min/IP), `registerLimiter`
(5/godz./IP), `passwordResetLimiter` (5/godz./IP, liczy RÓWNIEŻ udane — przy
resecie hasła bronią jest właśnie żądanie udane: zasypanie skrzynki gracza).

### 🟠 D3. Trzy zapytania do bazy na każde żądanie  ✅ NAPRAWIONE
`checkJail` odpytywał `users.blocked_until` — dokładnie tę samą kolumnę, którą
chwilę wcześniej odczytał `verifyToken`. Zapis `last_seen` szedł przy KAŻDYM
żądaniu, biorąc blokadę wiersza `users` (front odpytuje HUD, karczmę i listę
online, więc to kilka zapisów na sekundę na gracza).
**Fix:** `checkJail` czyta wartość podaną przez `verifyToken` (zero zapytań),
`last_seen` zapisywany najwyżej raz na minutę na konto i bez `await`.
Efekt: 3 zapytania na żądanie → 1.

### 🟠 D4. Limit ciała żądania 50 MB  ✅ NAPRAWIONE
`express.json({ limit: '50mb' })` przy braku rate limitu = kilkanaście
równoległych żądań i proces wychodzi na OOM. Nic tego nie potrzebowało: pliki
idą multipartem przez multera, z własnymi limitami (200 kB / 2 MB / 50 MB).
**Fix:** 2 MB (`JSON_BODY_LIMIT`). Usunięty też zbędny drugi parser
(`bodyParser.json` po `express.json` — martwy przebieg na każdym żądaniu).

### 🟠 D5. WebSocket bez żadnych limitów  ✅ NAPRAWIONE
Serwer WS stoi na tym samym porcie co API i nie miał: limitu rozmiaru ramki
(`ws` domyślnie przyjmuje **100 MB** — `JSON.parse` na tym blokuje pętlę
zdarzeń, czyli kładzie całe API), limitu połączeń na konto (skrypt otwierający
tysiąc gniazd, każde po dwa zapytania do bazy), limitu długości wypowiedzi,
ani ping/ponga (zerwane połączenia zostawały w mapie na zawsze i dostawały
każdy broadcast).
**Fix:** `maxPayload` 64 kB, 5 połączeń na konto, 5000 znaków na wiadomość,
heartbeat co 30 s.

### 🟡 D6. Pula MySQL: 10 połączeń, kolejka bez granic  ✅ NAPRAWIONE
`queueLimit: 0` przy zalewie żądań rósł w nieskończoność — pamięć w górę,
a gracze dostawali odpowiedzi po minutach zamiast błędu.
**Fix:** pula 25 (`DB_CONNECTION_LIMIT`), kolejka 200 (`DB_QUEUE_LIMIT`),
keepalive na zerwane połączenia.

### 🟡 D7. Podwójna rejestracja routera admina  ✅ NAPRAWIONE
`app.use('/', adminModule.router)` występowało w `server.js` DWA RAZY. Express
przechodził przez 3.5 tys. linii tras admina po raz drugi przy każdym żądaniu,
które nie trafiło wcześniej. Czysta strata na każdym 404.

## Wycieki danych

### 🟠 L1. `GET /characters/:id` — pełny wiersz dowolnej postaci  ✅ NAPRAWIONE
Trasa zwracała `SELECT *` po samym `id`, bez sprawdzenia właściciela: złoto,
exp, statystyki, aktualne HP i stamina, postęp budowy, data końca odsiadki.
Pętla po `id` od 1 w górę = kompletny wywiad gospodarczy serwera (kogo okraść,
kto stoi na 5 HP przed PvP, kto siedzi w celi).
**Fix:** właściciel dostaje pełny wiersz jak dotąd, obcy — imię, awatar, rasę,
poziom. Front używa tej trasy do zapraszania po ID i potrzebuje wyłącznie imienia
i awatara, więc nic się nie psuje.

### 🟡 L2. `GET /home/stats/user?userId=` — staty bojowe dowolnego gracza  ✅ NAPRAWIONE
Zwiad przed PvP i przed kradzieżą. Front nigdzie tego nie woła.
**Fix:** dostęp tylko do własnego konta i dla administracji.

## Do przemyślenia (nie zmieniałem — to decyzje projektowe, nie błędy)

- **Skasowana postać zajmuje slot na zawsze.** `COUNT(*)` przy tworzeniu liczy
  również postacie z `is_deleted = 1`, a lobby (`GET /characters`) już ich nie
  pokazuje. Gracz po śmierci postaci widzi „3/4", ale czwartej nie utworzy.
  Zostawiłem tak jak było — limit jest przez to SUROWSZY, nigdy luźniejszy,
  a odwrotne zachowanie otwiera reroll bez końca. Do decyzji, czy to jest
  zamierzone; jeśli tak, warto to pokazać w lobby.
- **Enumeracja kont** (`/login` rozróżnia „nie ma użytkownika" od „złe hasło") —
  opisana już jako B5. Po dołożeniu rate limitu to ryzyko mocno spadło.
- **`characters.is_busy`** — kolumna istnieje z komentarzem o blokowaniu
  równoczesnych akcji, ale nie używa jej ŻADEN kod. Albo ożywić (patrz R5),
  albo skasować, żeby nie sugerowała ochrony, której nie ma.

## Weryfikacja na wgranej bazie produkcyjnej

Audyt został powtórzony na kopii bazy `vargard1` (107 tabel, 43 konta,
55 postaci) postawionej na MariaDB, z prawdziwym backendem. Każda poprawka
została zmierzona PRZED i PO — poniżej wyniki, wszystkie z 20 żądaniami
wysłanymi równolegle (limity rate-limitera podniesione na czas testu do
absurdu, żeby sprawdzać SAMĄ ochronę na poziomie bazy, a nie limiter):

| Test | Przed | Po |
|---|---|---|
| Limit 4 postaci (20 równoległych żądań) | **9 postaci** | 4 |
| Eksploracja za 20 staminy (20 równoległych) | **9 wypraw, 139 surowców** | 1 wyprawa, 24 surowce |
| Wydanie 10 AP (20 równoległych) | **AP = −10, siła 4 → 24** | AP = 0, siła 4 → 14 |
| Arena: podrobione `fromExploration` | **0 staminy za walkę** | pełny koszt staminy |
| Arena: 20 równoległych walk | **3 staminy, `total_fights` = 3** | 20 staminy, `total_fights` = 20 |
| Rynek: wystawienie 10 sztuk (20 równoległych) | **20 sztuk na rynku** | 10 sztuk, bilans się zgadza |

Sprawdzony też przepływ LEGALNY, żeby poprawki niczego nie zepsuły:
eksploracja → spotkanie potwora → walka za darmo (stamina 50 → 50) →
próba powtórzenia tej samej walki już płatna (50 → 49). Do tego przegląd
regresyjny: arena, eksploracja, trening, praca, wydobycie, rozdanie AP,
szpital, lobby, HUD, listy — wszystko odpowiada 200.

## Czego NIE udało się sprawdzić

Testy szły z JEDNEGO konta i jednej postaci. Nie sprawdzałem scenariuszy
wieloosobowych: PvP dwóch graczy naraz, handel między kontami, gospodarka
klanowa (`/headquarters`, `/factionEconomy`), bank i kredyty. Te trasy MAJĄ
transakcje i blokady wierszy (przejrzane statycznie), ale nie zmierzyłem ich
pod równoległym obciążeniem.

Nie testowałem też odporności na DDoS pod realnym ruchem — sprawdzone jest
tylko to, że limitery działają i że serwer wstaje z nową konfiguracją.
Dobranie progów (`RATE_LIMIT_*` w `.env`) warto zrobić po premierze, na
podstawie tego, jak faktycznie zachowują się gracze.
