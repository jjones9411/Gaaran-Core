# Gaaran Engine (Clean)

Czysty, generyczny szkielet silnika przeglądarkowego MMORPG (Node.js/Express + MySQL + React).
Powstał przez usunięcie z oryginalnego silnika Gaaran Engine 2.0 całego brandingu i fabuły (świat
postapokaliptyczny) i zastąpienie ich generycznym systemem ras/klas konfigurowanym przy pierwszym
uruchomieniu przez **kreator instalacyjny** (`/install`) — bez ręcznej edycji `.env`, bez
phpMyAdmin, bez pisania SQL-a.

## Stack techniczny

- **Backend**: Node.js + Express, MySQL (`mysql2`)
- **Frontend**: React (rsbuild) + MUI + styled-components

## Szybki start

```bash
# Backend
cd backend
npm install
npm start          # wystartuje NAWET bez skonfigurowanej bazy - patrz niżej

# Frontend
cd frontend
npm install
npm run dev
```

Nie trzeba ręcznie tworzyć `.env` ani importować `database/schema.sql` - robi to kreator
instalacyjny (patrz niżej). `.env` musi jedynie NIE istnieć albo być niekompletny, żeby kreator się
uruchomił (świeże `git clone` już to spełnia).

## Kreator instalacyjny (/install)

Przy pierwszym uruchomieniu aplikacja wykrywa brak pliku `backend/.installed` i automatycznie
pokazuje kreator zamiast normalnej gry, niezależnie od wpisanego adresu. Kroki:

1. **Baza danych** — podajesz host/port/użytkownika/hasło/nazwę bazy MySQL (te same dane co do
   phpMyAdmin na hostingu). Kreator sam: łączy się z serwerem, tworzy bazę jeśli nie istnieje
   (`CREATE DATABASE IF NOT EXISTS`), importuje pełną strukturę z `database/schema.sql`.
2. **Nazwa gry** — pojawi się w tytule strony, mailach, RSS.
3. **Rasy** — dowolna liczba, każda z nazwą/opisem/cechami/kolorem/statystykami startowymi/
   mnożnikami. Statystyki mają sensowne wartości domyślne, więc można je pominąć i tylko wpisać
   nazwy.
4. **Klasy** — analogicznie, dowolna liczba.
5. **Konto administratora** — Twój pierwszy login do panelu admina.
6. **SMTP (opcjonalnie)** — dane do wysyłki maili aktywacyjnych/resetu hasła; można pominąć i
   uzupełnić później ręcznie w `.env`.
7. Kreator zapisuje kompletny `backend/.env` (w tym losowo wygenerowany `JWT_SECRET`) i tworzy
   plik-znacznik `backend/.installed`, który **blokuje ponowne uruchomienie kreatora** (chroni przed
   przypadkowym nadpisaniem danych).

**Jedyny ręczny krok:** po zakończeniu kreatora zrestartuj proces Node (np. przyciskiem restart w
panelu hostingu OVH) — dopiero wtedy reszta aplikacji wczyta świeżo zapisany `.env`. To ograniczenie
Node.js (w przeciwieństwie do PHP, `.env` jest czytany raz przy starcie procesu), nie da się tego
uniknąć bez własnego menedżera procesów.

Jeśli chcesz pominąć kreator i skonfigurować wszystko ręcznie (np. do developmentu), nadal możesz:
skopiuj `backend/.env.example` do `.env`, zaimportuj `database/schema.sql` ręcznie, wstaw ręcznie
rekordy do tabel `races`/`classes`, i stwórz plik `backend/.installed` (pusty, dowolna treść)
żeby zablokować kreator.

## Co zostaje do Twojej decyzji (poza kreatorem)

Kreator ustawia nazwę gry, rasy, klasy i admina, ale kilka miejsc z treścią trzeba nadal wypełnić
ręcznie (grep po `\[` w kodzie i w `database/schema.sql` znajdzie wszystkie):

| Znacznik | Co to jest | Gdzie |
|---|---|---|
| `[OPIS_GRY]`, `[OPIS ŚWIATA GRY]` | Krótki opis/blurb świata | Register.js, publicFeed.js, `mechanics` (wiersz "Miejsce akcji") |
| `[ADRES_STRONY]` | Docelowy URL produkcyjny | Regulamin.js, publicFeed.js |
| `[LINK_DO_WIKI]` | Link do wiki/fandom gry | Sidebar.js, Register.js |
| `[LINK_DO_DISCORDA]` | Link zaproszenia na Discord | Login.js, Register.js |
| `[EMAIL_NADAWCY]` | Adres e-mail nadawcy mailingu | AdminPanel.js |
| `[SUROWIEC_1]` … `[SUROWIEC_57]` | Nazwy surowców/materiałów (Warsztat, Kuźnia, Chemia, eksploracja) | `backend/routes/craft.js`, `alchemy.js`, `explore.js` |
| `[PRZEDMIOT_1]` … `[PRZEDMIOT_19]` | Nazwy gotowych craftowanych/znalezionych przedmiotów oraz uzbrojenia (`equipment_archetypes`) | jw. + `database/schema.sql` |
| `[OPIS SUROWCA - wpisz tutaj]` | Opis fabularny surowca (Kuźnia) | `craft.js` (`FORGE_RECIPES`) |
| `[TYTUŁ NPC]`, `[OPIS NPC]` i podobne | Treść wpisów NPC/lokacji/technologii/zasad/karczm | `database/schema.sql` (tabele `npcs`, `race_pages`, `rules`, `technology`, `news`, `infos`, `infos2`, `tavern_rooms`) |
| Choroby pogodowe | Konkretne dolegliwości dla danego typu pogody | `weather_illness_types` (już wypełnione neutralnymi przykładami - przeziębienie, odmrożenia itd., możesz zostawić) |
| `[NAZWA_GRY]` w `<title>` i Open Graph | Statyczny tytuł karty przeglądarki oraz podgląd linku w komunikatorach | Wstawiany przy buildzie (`frontend/rsbuild.config.mjs` + `frontend/scripts/site-meta.mjs`) - patrz „Podgląd linku w komunikatorach" niżej |

## System ras i klas (dynamiczny, dowolna liczba)

Silnik był wcześniej osadzony w świecie postapokaliptycznym z trzema sztywno zakodowanymi
frakcjami. Teraz rasy i klasy to **dane w bazie** (tabele `races`, `classes`), tworzone przez
kreator instalacyjny w dowolnej liczbie:

- Backend: `backend/routes/races.js` i `classes.js` (API + CRUD admina), mnożniki/bonusy wczytywane
  do pamięci przy starcie serwera (`utils/raceStatMultipliers.js`, `classStatMultipliers.js`,
  `classBonuses.js`) - resztę kodu (arena, trening) to nie dotyczy, korzysta z tych samych funkcji
  co wcześniej.
- Frontend: `CharacterCreator.js`, `Sidebar.js`/`TopBar.js` (zakładka "Rasy" i jej podzakładki),
  `Profile.js` - wszystko pobiera listę ras/klas z `/api/races` i `/api/classes` zamiast mieć je na
  sztywno wpisane.
- Każda rasa ma własną stronę z treścią (dawniej osobne komponenty/tabele Werewolves/Vampires/Mag) -
  teraz jeden generyczny komponent `RaceHall.js` + jedna tabela `race_pages` (kolumna `race_key`)
  działająca dla dowolnej liczby ras, pod adresem `/home/:raceKey`.

## System pogody

Pogoda (`backend/routes/gameTime.js`) jest "zwykła" (słońce, deszcz, śnieg, mgła, burze, śnieżyca,
upał, burza piaskowa) — bez elementów promieniotwórczych/toksycznych. Wagi faworyzują normalną
pogodę (~80%) nad zjawiskami ekstremalnymi (~20%).

## Podgląd linku w komunikatorach (Messenger, Telegram, Discord, WhatsApp)

Gdy wrzucasz adres gry na czacie, komunikator pobiera **surowy HTML** strony i czyta
z niego tytuł oraz znaczniki Open Graph. **Nie uruchamia JavaScriptu**, więc nazwa
ustawiana w locie przez `App.js` (`document.title`) jest dla niego niewidoczna - stąd
podgląd z placeholderem `[NAZWA_GRY]`.

Dlatego nazwa gry trafia do `<head>` **na etapie budowania frontu**
(`frontend/scripts/site-meta.mjs`, wpinane w `frontend/rsbuild.config.mjs`). Kolejność
źródeł - pierwsze trafione wygrywa:

1. zmienna środowiskowa `GAME_NAME` przy buildzie (np. `GAME_NAME="Vargard" npm run build`),
2. działający backend - `GET /api/game-info` pod adresem z `FRONTEND_URL` (albo `GAME_INFO_URL`,
   gdy API stoi gdzie indziej); to źródło prawdy, czyli `game_config.game_name` z kreatora,
3. `GAME_NAME` zapisane w `frontend/.env.local`, `frontend/.env` lub `backend/.env`
   (kreator instalacyjny wpisuje je do `backend/.env`; `frontend/.env` przydaje się, gdy front
   budujesz na innej maszynie niż ta, na której leży backend),
4. `[NAZWA_GRY]` - czysty szablon, gdy nic z powyższych nie zadziała (build wypisuje wtedy ostrzeżenie).

Dodatkowe (opcjonalne) zmienne z tych samych plików `.env` lub ze środowiska builda:

| Zmienna | Do czego |
| --- | --- |
| `GAME_DESCRIPTION` | Opis pod tytułem w podglądzie linku (ta sama zmienna zasila RSS/`publicFeed.js`) |
| `GAME_URL` / `FRONTEND_URL` | Adres w `og:url` i baza dla adresu obrazka |
| `GAME_OG_IMAGE` | Obrazek podglądu; domyślnie `/favicon.png`. Warto podać lżejszy baner ~1200×630 px (favicon ma 1024×1024 i ~2 MB) |

**Ważne:** podgląd odświeża się dopiero po **przebudowaniu i wgraniu frontu** - sama
zmiana nazwy w bazie nie wystarczy. Komunikatory dodatkowo cache'ują podgląd danego
URL-a; po wgraniu nowej wersji wyczyść go debuggerem platformy (np.
`developers.facebook.com/tools/debug/` dla Messengera, `@WebpageBot` dla Telegrama).

## Baner do wymiany z innymi grami

Na ekranie logowania wisi sekcja „INNE PROJEKTY" z banerami gier, z którymi wymieniasz się
ruchem (`frontend/src/components/GameBannerSection.js`). Żeby wymiana działała w drugą stronę,
Twoja gra też potrzebuje **własnego banera** — grafiki o standardowym rozmiarze **180×72 px**
i gotowego kawałka HTML-a, który wklei sobie druga strona.

**Gotowe pliki** (wchodzą do builda, więc są od razu pod publicznym adresem):

| plik | rozmiar | do czego |
| --- | --- | --- |
| `frontend/public/banner/vargard-180x72.png` | 180×72 | podstawowy baner wymiany — ten adres dajesz innym |
| `frontend/public/banner/vargard-180x72@2x.png` | 360×144 | ta sama grafika w 2× (ekrany HiDPI, podgląd u siebie) |
| `frontend/public/banner/vargard-88x31.png` | 88×31 | klasyczny mini-guzik do stopek i toplist |

**Kod do wklejenia u partnera** (podmień `https://twoja-domena.pl` na swój adres):

```html
<a href="https://twoja-domena.pl" title="Vargard - tekstowe MMORPG" target="_blank" rel="noopener">
  <img src="https://twoja-domena.pl/banner/vargard-180x72.png" alt="Vargard - tekstowe MMORPG"
       width="180" height="72" style="border:0" />
</a>
```

Na forach (BBCode): `[url=https://twoja-domena.pl][img]https://twoja-domena.pl/banner/vargard-180x72.png[/img][/url]`

Tego samego kodu **nie musisz przepisywać ręcznie**: pod banerami na ekranie logowania jest
rozwijane „[ WYMIANA BANERÓW - WEŹ NASZ KOD ]" (`frontend/src/components/OurBanner.js`), które
generuje HTML i BBCode z prawdziwym adresem gry (`window.location.origin`) i pozwala je skopiować
jednym kliknięciem. Wystarczy podesłać komuś link do logowania.

### Przegenerowanie banera (inna nazwa gry, inne motto)

Baner nie jest rysowany ręcznie w GIMP-ie — składa go szablon HTML z tych samych elementów co gra
(emblemat z `public/favicon.png`, kadr z grafiki tła, font Cinzel, złoto `#D8D389`), a skrypt robi
z niego zrzut do PNG:

```bash
cd frontend
npm i -D playwright && npx playwright install chromium   # tylko raz, potem można usunąć
npm run banner                                            # domyślnie: VARGARD
npm run banner -- --name "NOWA NAZWA" --tagline "TEKSTOWE MMORPG" \
                  --motto "twoje motto" --slug nowa-nazwa
```

Szablon: `frontend/art-source/banner/banner.html`, skrypt: `frontend/scripts/make-banner.mjs`.
Zbyt długa nazwa nie wyjedzie poza ramkę — szablon sam zmniejsza stopień pisma, aż się zmieści.
Po zmianie `--slug` popraw stałą `BANNER_PATH` w `frontend/src/components/OurBanner.js`.

## Aktualizacje frontendu / cache przeglądarki

Po wgraniu nowej wersji frontu gracze ze starym plikiem w cache przeglądarki
mogą nie widzieć zmian. Rozwiązuje to wbudowany mechanizm:

- **BUILD_ID + `version.json`** — przy każdym `npm run build` rsbuild wstrzykuje
  unikalny `BUILD_ID` do bundla i zapisuje `dist/version.json` z tym samym ID
  (patrz `frontend/rsbuild.config.mjs`). Nazwy bundli JS/CSS i tak są hashowane,
  więc nowy build = nowe pliki.
- **`VersionChecker`** (`frontend/src/components/VersionChecker.js`, montowany w
  `App.js`) co 3 minuty (oraz przy powrocie do karty) pobiera `/version.json` z
  pominięciem cache i porównuje `buildId` z tym zaszytym w działającym bundlu.
  Gdy się różnią — pokazuje pasek **„Dostępna jest nowa wersja gry. → Odśwież"**.
  Nie przeładowuje automatycznie, żeby nie przerwać graczowi np. pisania posta.

**Zalecane nagłówki cache (hosting statyczny, np. OVH/Apache).** Żeby przeglądarka
zawsze widziała najnowszy `index.html` i `version.json` (a hashowane assety mogła
cache'ować), dopisz do `.htaccess` w katalogu z frontem (NIE nadpisuj istniejących
reguł, w szczególności ewentualnego przekierowania SPA — tylko dołóż poniższe):

```apache
<IfModule mod_headers.c>
  # index.html i version.json - zawsze świeże (wskazują aktualne bundle)
  <FilesMatch "^(index\.html|version\.json)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
  </FilesMatch>
</IfModule>
```

Jeśli front jest za nginx/innym serwerem, ustaw analogicznie `Cache-Control: no-cache`
dla `index.html` i `version.json`.

## Klany / rodziny graczy

Sieć powiązań postaci — sekcja "Rodzina" w profilu (`/home/profile/:id`).

- **Zakładanie:** klan tworzy administracja w panelu admina (sekcja "Klany / rodziny"),
  podając nazwę, opcjonalny opis i ID postaci, która zostaje **głową klanu**.
- **Rozbudowa:** głowa klanu oraz mianowani przez nią **oficerowie** zapraszają kolejne
  postacie (po nazwie) z poziomu popupu klanu na swoim profilu. Zaproszona postać musi
  **zaakceptować** zaproszenie (nikt nie trafia do rodziny bez zgody).
- **Wyświetlanie:** w profilu członka pojawia się pole `Klan: <nazwa>` z rolą; kliknięcie
  otwiera popup z listą członków i wyróżnioną głową klanu.
- **Zasady:** jedna postać należy najwyżej do jednego klanu. Członek może sam opuścić klan,
  głowa nie może (przekazanie roli / rozwiązanie klanu robi administracja).
- **Backend:** `backend/routes/clans.js`; **tabele:** `clans`, `clan_members`,
  `clan_invitations`.
- **Migracja istniejącej bazy:** uruchom `database/add-clans.sql` (świeże instalacje przez
  kreator dostają te tabele automatycznie z `database/schema.sql`).

## Rola fabularna postaci

Krótki opis funkcji postaci w świecie gry (np. "Wódz Watahy", "Kapłan Zapomnianych"),
nadawany **z ręki przez administrację** — inaczej niż status, który gracz wpisuje sobie sam.

- **Nadawanie:** sekcja "Postać" w profilu (`/home/profile/:id`), pole `Rola fabularna` —
  ikona ołówka widoczna **tylko dla konta z rolą `admin`** (na dowolnej postaci). Gracze
  widzą rolę wyłącznie do czytania, a gdy nie została nadana — pole w ogóle się nie pokazuje.
- **Wyświetlanie:** profil postaci oraz dymek postaci na liście online (razem ze statusem
  postaci, w tym samym bloku).
- **Backend:** `PUT /home/profile/:id/narrative-role` (za `checkAdmin`), max 100 znaków;
  pusty tekst = zdjęcie roli. Kolumna: `characters.narrative_role`.
- **Migracja istniejącej bazy:** uruchom `database/add-narrative-role.sql` (świeże instalacje
  przez kreator dostają kolumnę automatycznie z `database/schema.sql`). Do czasu migracji
  lista online i profil działają normalnie — rola jest po prostu pusta.

## Przydomek postaci

Przezwisko, pod którym postać jest znana w świecie gry (np. „Bez Twarzy", „Krwawy Rzeźnik").
Działa **na tej samej zasadzie co rola fabularna** — gracz nie wpisuje go sobie sam, dostaje
go **z ręki od administracji** — z jedną różnicą: przydomek nadaje **administrator LUB mistrz
gry**, podczas gdy rolę fabularną tylko `admin`.

- **Nadawanie:** sekcja „Postać" w profilu (`/home/profile/:id`), pole `Przydomek` tuż pod
  `Rolą fabularną` — ikona ołówka widoczna **tylko dla konta z rolą `admin` lub `mistrz_gry`**
  (na dowolnej postaci). Gracze widzą przydomek wyłącznie do czytania, a gdy nie został
  nadany — pole w ogóle się nie pokazuje.
- **Wyświetlanie:** profil postaci, dymek postaci na liście online (kursywą w cudzysłowie tuż
  pod nazwą postaci) oraz kartoteka `/home/players` — tam jako podpis pod nazwą, żeby czytało
  się razem z imieniem; szukajka kartoteki obejmuje też przydomek.
- **Backend:** `PUT /home/profile/:id/epithet` (za `checkGameMasterOrAdmin`), max 100 znaków;
  pusty tekst = zdjęcie przydomka. Kolumna: `characters.epithet`.
- **Migracja istniejącej bazy:** uruchom `database/add-epithet.sql` (świeże instalacje przez
  kreator dostają kolumnę automatycznie z `database/schema.sql`). Do czasu migracji lista
  online, kartoteka i profil działają normalnie — przydomek jest po prostu pusty, a zapis
  zwraca czytelny komunikat o brakującej migracji.

## Przedmioty fabularne (zakładka „Przedmioty" w profilu)

Spis rzeczy, które postać **wygrała w fabule** — relikwie, listy, klucze, trofea. Zakładka
stoi w profilu (`/home/profile/:id`) **zaraz obok „Karty postaci"**, przed zakładkami
własnymi gracza, i jest na każdej postaci (także cudzej — spis jest jawny jak reszta profilu).

- **To nie jest ekwipunek.** Przedmioty fabularne nie dają statystyk, nie wchodzą do walki
  ani do rzemiosła — nie mają nic wspólnego z `equipment` / `crafted_items`. To wyłącznie
  zapis tego, co postać ma „w fikcji".
- **Dopisuje i zabiera WYŁĄCZNIE administracja** (rola konta `admin` lub `mistrz_gry`) —
  także na własnej postaci. Właściciel postaci widzi spis tylko do czytania; nie ma
  przycisku dodawania, a endpointy zapisu odrzucą go po stronie serwera
  (`checkGameMasterOrAdmin`), nie tylko w interfejsie. O to w tym chodzi: spis ma być
  wiarygodny, więc nikt nie dopisze sobie sam artefaktu, którego nie odegrał.
- **Wpis to:** nazwa (max 150 znaków), opis/historia (max 2000), ilość (1–9999) oraz
  pochodzenie — skąd rzecz jest, np. nazwa sesji czy NPC (max 150). Pod wpisem widać, kto
  z administracji go dodał i kiedy.
- **Ślad w kartotece.** Gracz nie dostaje osobnego powiadomienia o zmianie w profilu, więc
  nadanie i zabranie przedmiotu ląduje w logach postaci (`character_logs`, typy
  `story_item_granted` / `story_item_removed`) — inaczej rzeczy pojawiałyby się i znikały
  „znikąd".
- **Podgląd w sesjach (wszystko pod ręką w trakcie gry).** W panelu uczestników sesji —
  ogólnych i prywatnych — obok przycisków „Karta Postaci" i „Statystyki postaci" stoi trzeci:
  **„Przedmioty postaci"**. Otwiera ten sam spis w okienku (`CharacterStoryItemsPopup`), więc
  MG prowadzący scenę nie musi wychodzić z sesji na profil, żeby sprawdzić, co postać przy
  sobie ma. Podgląd jest **wyłącznie do czytania** — dopisywanie i zabieranie zostaje w
  profilu, żeby operacja miała jedno miejsce i jeden ślad w kartotece.
- **Backend:** `backend/routes/profile.js` — `GET /home/profile/:characterId/story-items`
  (każdy zalogowany), oraz `POST` / `PUT /:itemId` / `DELETE /:itemId` za
  `checkGameMasterOrAdmin`. Tabela: `character_story_items`.
- **Migracja istniejącej bazy:** uruchom `database/add-story-items.sql` (świeże instalacje
  przez kreator dostają tabelę automatycznie z `database/schema.sql`). Do czasu migracji nic
  się nie psuje — odczyt zwraca pustą listę, a administracja widzi w zakładce komunikat,
  którą migrację odpalić (zapis odpowiada wtedy `503` z tą samą informacją).

## Codziennik postaci (`/home/journal`)

Dziennik sesji dla gracza: **jedna lista wszystkich sesji — prywatnych i ogólnych — w których
gra dana postać**, odpowiadająca na dwa pytania: *gdzie muszę odpisać?* i *jak stoi narracja?*.
Wcześniej trzeba to było składać z dwóch osobnych list (Sesje Prywatne + Sesje Ogólne), a licznik
przy nich mówił tylko o „nieprzeczytanych", które gasną od samego zajrzenia do sesji.

- **Kolory statusu liczone z samych wiadomości** (a nie z tabel `*_seen`) i **zależne od tego,
  czym w danej sesji odpowiadasz** (patrz zakładki niżej — grający ma odpisać postacią, MG
  poprowadzić narrację, „gram i MG" jedno i drugie):
  - 🟢 `replied` — **zrobiłeś wszystko, co w tej sesji na Tobie**;
  - 🟡 `partial` — tylko `GRAM I MG`: **jedna połowa jest, druga wisi** (np. odpisałeś postacią,
    ale narracji jeszcze nie poprowadziłeś);
  - 🔴 `reply_needed` — **nic od Ciebie po tym, jak odezwał się ktoś inny** (albo sesja ruszyła
    bez Twojego udziału) — z podaniem, **kto** pisał ostatni i **kiedy** („2 dni temu" + pełna
    data w dymku);
  - ⚪ `waiting` — w sesji nie ma jeszcze żadnego wpisu.
- **Wszystko liczone względem ostatniego wpisu KOGOŚ INNEGO** (`last_other_at`), a nie względem
  końca listy: w trybie „gram i MG" ostatnim wpisem bywa Twoja własna połowa roboty, więc samo
  „ostatni wpis jest mój" nie znaczy jeszcze, że zrobiłeś wszystko.
- **Zajrzenie do sesji NIE gasi czerwonego** — dopiero wysłany odpis przestawia wpis z powrotem
  na zielony wraz z datą Twojego wpisu. To celowa różnica wobec „nieprzeczytanych": czerwone
  mówi *masz ruch*, a osobna plakietka `NIEPRZECZYTANE` — *nie widziałeś jeszcze treści*.
- **Wpis narratora liczy się jako Twój, gdy to Ty go wysłałeś** — i to po `user_id`, nie po
  postaci. Posty narratora w sesjach **ogólnych** trafiają do bazy z `character_id = NULL`
  (`generalSessions.js`; pisać nimi może wyłącznie właściciel sesji), a w **prywatnych** —
  z `character_id` postaci właściciela. Dopóki codziennik szukał ich po `character_id`, własna
  narracja w sesji ogólnej **nigdy** nie liczyła się jako Twoja i MG dostawał czerwone „NARRACJA
  → TWÓJ ODPIS" na swoich własnych sesjach, tuż po tym, jak sam je poprowadził.

### Trzy zakładki: `TYLKO GRAM` / `GRAM I MG` / `MG`

Jedna lista mieszała dwa różne rodzaje roboty: przy graniu pytanie brzmi *gdzie mam odpisać*,
przy prowadzeniu *gdzie mam napisać scenę*. Sesje dzielą się teraz na **trzy zakładki**
(+ `WSZYSTKIE`), po tym, **czym postać w danej sesji odpisuje**:

- 🔵 **`TYLKO GRAM`** — same odpisy własną postacią, ani jednego z trybu narratora;
- 🟢 **`GRAM I MG`** — odpisy i własną postacią, **i** z trybu narratora (grasz i prowadzisz naraz);
- 🟡 **`MG`** — odpisy **wyłącznie** z trybu narratora (typowo: sesja założona przez Twoją postać,
  w której tylko prowadzisz). Trafia tu też świeżo założona przez Ciebie sesja, w której nikt
  jeszcze nie pisał.

- **To stan faktyczny, nie deklaracja.** Tryb udziału (`participation`: `player` / `mixed` / `gm`)
  liczy backend z samych wiadomości postaci — posty narratora mają `character_id` prowadzącego,
  więc „ile pisałem sobą" to `my_posts_count` minus `my_narration_count`. Rola wchodzi do gry
  tylko tam, gdzie wpisy nie wystarczą: gdy postać **nie napisała jeszcze ani słowa** (wykryte
  `MISTRZ GRY`, czyli własna sesja, ląduje w `MG`, reszta w `TYLKO GRAM`) oraz gdy gracz
  **ręcznie** ustawił sobie narratora/MG, a pisze zwykłymi postami — narrację da się prowadzić
  bez trybu narratora, więc taka sesja idzie do `GRAM I MG`. Roli **wykrytej automatycznie** się
  w tym drugim przypadku nie honoruje: `MISTRZ GRY` bierze się z samego posiadania sesji i sam
  z siebie nie mówi, że ktoś w niej prowadzi — własna sesja, w której odpisujesz tylko postacią,
  zostaje w `TYLKO GRAM`.
- **Kafelki i filtry liczą się w obrębie zakładki** — `DO ODPISANIA: 7` nad listą trzech sesji
  mówiłoby o czymś, czego na ekranie nie ma. Ostatni kafelek zmienia się wtedy w `W TEJ ZAKŁADCE`.
  Na samych zakładkach stoi liczba sesji, więc widać, gdzie w ogóle jest co oglądać.
- **Wybrana zakładka zostaje** (`localStorage`) — gracz, który głównie prowadzi, nie przeklikuje
  się przy każdym wejściu przez sesje, w których tylko gra.
- **Na karcie**, w widoku `WSZYSTKIE`, stoi plakietka trybu (`TYLKO GRAM` / `GRAM + MG` / `MG`)
  w miejscu, w którym była rola — w zawężonej zakładce ta sama plakietka na każdej karcie byłaby
  już szumem. Kolory są celowo spoza rodziny statusów odpisu, żeby „czym tu odpisuję" nie
  mieszało się z „czy mam ruch". Zamiast roli `MISTRZ GRY` (która przy zakładce `MG` znaczyłaby
  na karcie dwie różne rzeczy naraz) jest plakietka `TWOJA SESJA` — kto sesję **założył** to
  jedyne, czego sam tryb odpisywania nie niesie.

### Układ karty: pasek ruchu, zegar zwłoki, wiersz narracji

Kolory były, ale ginęły: status, rodzaj sesji, rola, stan narracji, znacznik i „nieprzeczytane"
szły jednym rzędem drobnych plakietek, więc najważniejsza informacja — *czy to na mnie* — nie
rzucała się w oczy. Karta ma teraz stałą kolejność: **pasek ruchu → tytuł → plakietki → odpisy →
narracja → przyciski**.

- **Pasek ruchu** (nad tytułem, własne tło i obwódka w kolorze statusu) mówi jednym hasłem, co
  jest na Tobie — **innym w każdej zakładce**: w `TYLKO GRAM` 🔴 `TWÓJ ODPIS` /
  🔴 `NARRACJA → TWÓJ ODPIS` / 🟢 `ODPISANE`; w `MG` 🔴 `TWOJA NARRACJA` / 🟢 `NARRACJA POSZŁA`;
  w `GRAM I MG` 🔴 `TWÓJ ODPIS + NARRACJA` / 🟡 `ZOSTAŁA NARRACJA` / 🟡 `ZOSTAŁ TWÓJ ODPIS` /
  🟢 `ODPISANE I POPROWADZONE`; wszędzie ⚪ `BEZ WPISÓW`. Czerwona kropka pulsuje, a dymek
  dopowiada zdaniem, co się stało („Odpisałeś swoją postacią, ale narracji jeszcze nie
  poprowadziłeś").
- **Narracja jest wliczona w to samo pytanie.** Post narratora to normalny wpis w sesji: gdy
  wysłał go ktoś inny, a ruch jest po Twojej stronie — świeci na czerwono; gdy wysłałeś go Ty
  i to wszystko, co w tej sesji na Tobie (zakładka `MG`) — świeci na zielono, a pozostałym
  graczom ten sam post zapala czerwone „nie odpisałeś".
- **Zegar zwłoki (⏳)** — obok hasła stoi, **ile to już wisi**, z tą samą skalą po obu stronach:
  przy czerwonym „czeka na Ciebie: 2 dni", przy zielonym „cisza po Twoim wpisie: 5 dni", przy
  sesji bez wpisów „sesja stoi: 12 dni" (licząc od jej założenia). Do 3 dni jest szary, od 3 dni pomarańczowy, od 7 dni
  czerwony i pogrubiony — martwy wątek widać bez czytania.
- **Wiersz narracji** to jedna linia pod odpisami (`Narracja: kto — jak dawno`), której **kolor
  słowa „Narracja"** niesie stan: zielony — poszła dzisiaj, pomarańczowy — starsza, szary — nie
  było jeszcze żadnej. W sesji, w której tylko grasz i nikt jeszcze nie narrował, tej linii
  w ogóle nie ma.
- **Karta odchudzona.** Zeszły z niej: przycisk `[ DO NARRACJI ]`, plakietki `NARRACJA ZROBIONA`
  i `NARRACJA WYSŁANA`, osobny pasek narracji z kropką oraz wiersz „Twój ostatni odpis"
  (dokleił się jako `· Twój: 2 dni temu` do wiersza z ostatnim wpisem). Ręczny znacznik
  „kolejna narracja na mnie" przestawia się teraz **w popupie notatki** — stan narracji niesie
  już sam pasek ruchu. `NIEPRZECZYTANE` zmieniło kolor na niebieski, bo żółty należy teraz do
  statusu `partial`.
- **Cztery kafelki zamiast sześciu:** `NA MNIE` / `POŁOWICZNE` / `ZROBIONE` / `NAJDŁUŻEJ CZEKA`
  (wiek najstarszej zaległości, z tytułem sesji w dymku — zwykle to ta jedna sesja, którą się
  przegapiło). „Ile sesji łącznie" i „w ilu prowadzisz" mówią już same zakładki. Nad listą stoi
  legenda kolorów i zegara.

### Na kogo czekasz i szturchnięcie

W sesji na pięć osób „ostatni wpis" jest jeden, a milczących może być czterech — sam status
zielony mówi tylko *nie na Tobie*, nie mówi *na kim*.

- **Wiersz `Czekasz na:`** (widoczny **tylko przy zielonym**, bo przy czerwonym ruch jest po
  Twojej stronie i wytykanie innych myliłoby tropy) wymienia uczestników, którzy **nie odezwali
  się po Twoim ostatnim wpisie**, **najdłużej milczący pierwszy**, każdy z czasem ciszy
  („Milczek (12 dni ciszy)", „Nowy (jeszcze nie pisał)") i tą samą skalą kolorów co zegar zwłoki.
  Powyżej pięciu osób reszta zwija się do `+N`.
- **Postacie z Twojego konta odpadają** z tej listy — czekanie na własną drugą postać nie jest
  informacją. Odpada też każdy, kto odpisał po Tobie.
- **Przycisk `[ SZTURCHNIJ ]`** otwiera popup z **gotową treścią** („Czekam na Twój odpis w sesji
  «tytuł» — Twój ostatni wpis padł 12 dni temu") i adresatem ustawionym na osobę milczącą
  najdłużej; adresata i treść można zmienić przed wysłaniem. Zmiana adresata podmienia treść
  tylko wtedy, gdy nie była ruszana — inaczej przełączenie osoby kasowałoby napisaną wiadomość.
- **To zwykła wiadomość prywatna** (`POST /api/conversations`, ten sam endpoint co skrzynka), więc
  ląduje w normalnym wątku obu stron i można w nim po prostu odpisać. Żadnego osobnego kanału
  powiadomień.
- **Koszt:** jedno dodatkowe zapytanie **na rodzaj sesji** (nie na sesję) — kiedy każdy uczestnik
  pisał ostatni raz. Chodzi po indeksie `(session_id, character_id)` dokładanym przez migrację
  codziennika.

### Narracja i rola w sesji

Druga oś codziennika — dla prowadzących. Posty narratora są w bazie oznaczone
(`character_type = 'narrator'`), więc „kiedy była ostatnia narracja i czyja" **wyliczamy**,
zamiast kazać to klikać.

- **Rola w sesji** (`GRACZ` / `NARRATOR` / `MISTRZ GRY`, ustawiana w popupie notatki): domyślnie
  **wykrywana** — właściciel sesji = MG, ktoś kto pisał postem narratora = narrator — z **ręcznym
  nadpisaniem** (`session_role`), gdy prowadzisz scenę „z boku". Karmi zakładki tam, gdzie same
  wpisy nie wystarczą (patrz wyżej); z karty zeszła — mówi ją już plakietka trybu udziału,
  a ustawia się ją w popupie notatki.
- **Stan narracji** (widoczny dla wszystkich uczestników, nie tylko MG):
  🟢 `NARRACJA DNIA` (narracja poszła dzisiaj), 🟠 `BRAK NARRACJI DZIŚ` (ostatnia jest starsza),
  ⚪ `BRAK NARRACJI` (jeszcze żadnej). Pod tytułem stoi „Ostatnia narracja: *kto* — *kiedy*".
  **Czy „dziś" rozstrzyga front**, w strefie czasowej gracza — backend oddaje same znaczniki
  czasu, bo dzień na serwerze i dzień u gracza to nie zawsze ten sam dzień.
- **Znacznik „kolejna narracja jest na mnie"** (checkbox w popupie notatki, z opcjonalnym
  **terminem** — przycisk na karcie zniknął, bo stan narracji niesie już pasek ruchu): zapala plakietkę `DO NARRACJI`, przesuwa sesję na samą
  górę listy i koloruje krawędź karty. **Gaśnie sam**, gdy postać wyśle w tej sesji post
  narratora po zaznaczeniu znacznika — dokładnie ta sama mechanika co czerwone/zielone przy
  odpisach. Gdy narrację piszesz zwykłym postem, zdejmujesz znacznik ręcznie w tym samym
  popupie. Po terminie plakietka robi się czerwona.
- **Gaszenie znacznika dzieje się przy odczycie listy**, jednym `UPDATE`-em, a nie przy wysyłce
  posta — gorąca ścieżka pisania wiadomości nie dostaje ani jednego zapytania więcej.

### Reszta codziennika

- **Notatka do sesji** (przycisk `[ NOTATKA ]` → popup): prywatna, widziana wyłącznie przez tę
  postać. Dla sesji **prywatnych** to **ta sama notatka**, którą widać w widoku sesji („Twoja
  notatka") — nie ma dwóch osobnych miejsc na to samo. Dla sesji **ogólnych** notatka mieszka
  w tabeli codziennika. Sesja z notatką ma ikonę ✎ z jej treścią w dymku.
- **Filtry i podsumowanie:** kafelki `NA MNIE / POŁOWICZNE / ZROBIONE / NAJDŁUŻEJ CZEKA`
  (liczone dla **wybranej zakładki**) oraz filtry
  `WSZYSTKIE / NA MNIE / POŁOWICZNE / CISZA 7+ DNI / ZROBIONE / PRYWATNE / OGÓLNE`
  i przełącznik `Z ZAMKNIĘTYMI` (domyślnie zamknięte sesje są
  schowane). `CISZA 7+ DNI` wyławia wątki, w których od tygodnia nic się nie dzieje — bez
  względu na to, po czyjej stronie jest ruch. Lista sortuje
  się sama: zaległa narracja → zaległy odpis → połowiczne → sesja bez wpisów → zrobione.
  **W obrębie grupy
  kierunek zależy od tego, czyj jest ruch:** zaległości idą **od najstarszej** (sesja, której nie
  odpisujesz od dziewięciu dni, jest pilniejsza niż ta sprzed godziny — przy sortowaniu po
  świeżości lądowała na samym dole czerwonych, czyli tam, gdzie się jej nie widzi), a reszta —
  sesje bez wpisów i odpisane — od najświeższej, bo tam nic nie wisi.
- **Licznik w menu:** pozycja **Codziennik** w dziale KOMUNIKACJA (TopBar, Sidebar oraz menu
  mobilne i pasek trybu karczmy) nosi badge z sumą **zaległych odpisów + zaległych narracji**.
  Odpytywany co 30 s lekkim endpointem `GET /api/sessionJournal/summary` (same liczby, bez
  budowania listy). Zwinięte menu mobilne dolicza do swojego licznika **wyłącznie zaległe
  narracje** — zaległe odpisy siedzą już w licznikach sesji, więc liczyłyby się podwójnie,
  a narracja nie ma żadnego innego sygnału poza codziennikiem. Sama lista odświeża się w tle
  co 60 s — z pominięciem schowanej karty i otwartego popupu, żeby odświeżenie nie podmieniło
  tekstu pod palcami.
- **Backend:** `backend/routes/sessionJournal.js` — `GET /sessionJournal`
  (`?characterId=`, `?includeClosed=1`), `GET /sessionJournal/summary`,
  `PATCH /sessionJournal/:type/:sessionId/note`,
  `PATCH /sessionJournal/:type/:sessionId/flags` (rola, znacznik narracji, termin).
  Statusy czyta z istniejących tabel sesji (`private_*`/`general_session_*`), więc nie duplikuje
  stanu; własne dane gracza: `private_session_participant_notes` (notatka do sesji prywatnej)
  i **nowa** `character_session_journal` (notatka do sesji ogólnej, rola, znacznik narracji).
- **Migracja istniejącej bazy:** uruchom `database/add-session-journal.sql` (świeże instalacje
  przez kreator dostają tabelę automatycznie z `database/schema.sql`). Migracja dokłada też
  indeksy `(session_id, character_id)` i `(session_id, character_type)` na obu tabelach
  wiadomości — bez nich „kiedy ta postać pisała ostatnio" i „kiedy była ostatnia narracja"
  skanują całą tabelę wpisów dla każdej sesji z listy.
- **Bez migracji nic się nie psuje:** pierwszy `ER_NO_SUCH_TABLE` przestawia trasę na wariant
  bez tabeli codziennika (lista, statusy odpisów i stan narracji działają normalnie; ról,
  znaczników i notatek do sesji ogólnych nie ma), na górze strony wisi informacja, którą
  migrację odpalić, a zapis odpowiada `503` z tą samą informacją.

## Lista postaci (`/home/players`)

Kartoteka wszystkich postaci w grze — jedno miejsce, w którym widać, **kim postać jest w
fikcji** i **kim jej właściciel jest w grze**. Strona chodziła wcześniej na domyślnym,
wyśrodkowanym `Container`/`Paper` MUI; teraz używa tego samego szkieletu co
strony-encyklopedie (`PanelUI`: kanciaste ramki, kapitaliki, akcent rasy na lewej krawędzi
wiersza), więc nie odstaje wizualnie od reszty gry.

- **Dwie role obok siebie, w innej typografii** (żeby nikt nie wziął jednej za drugą):
  - `Rola fabularna` — `characters.narrative_role`, kursywa w cudzysłowie, kolor rasy. Nadaje
    ją administracja w profilu postaci (patrz sekcja wyżej); brak roli = myślnik.
  - `Ranga konta` — `users.role` (mieszkaniec / zasłużony / karczmarz / mistrz gry /
    administrator) z **tą samą insygnią co przy awatarze na liście online** (`RoleBadge`:
    korona/księga/kufel/medal). Zwykły mieszkaniec odznaki nie dostaje.
- **Szukajka i sortowanie:** filtr po nazwie postaci / koncie / roli oraz sortowanie po ID,
  nazwie, rasie, poziomie (a dla admina — po ostatnim logowaniu).
- **Widok admina** (przycisk „Widok admina", tylko dla roli `admin`): kolumna
  `Logowanie` z czasem względnym („2 godz. temu", „9 dni temu", „nigdy") i datą,
  pokolorowanym progami doba/tydzień/miesiąc/dłużej, pasek podsumowania (ile kont logowało
  się w dobie/tygodniu, ile milczy 30 dni+) oraz IP i data założenia postaci pod jej nazwą.
- **Dane wrażliwe idą tylko do admina.** Wcześniej `GET /players` wysyłało `last_ip` **każdemu**
  zalogowanemu (ukrywał je dopiero front) — teraz kolumny `last_ip`/`last_seen`/`last_login`
  w ogóle nie wchodzą do zapytania, gdy pyta nie-admin.
- **Backend:** `backend/routes/players.js`.

### Ostatnie logowanie (`users.last_login`)

`last_seen` jest nadpisywane przy **każdym** żądaniu z tokenem (`middleware/auth.js`), więc nie
da się z niego odczytać, kiedy gracz faktycznie się zalogował. Osobna kolumna `users.last_login`
jest ustawiana **wyłącznie** w `POST /login`.

- **Migracja istniejącej bazy:** uruchom `database/add-last-login.sql` (świeże instalacje przez
  kreator dostają kolumnę automatycznie z `database/schema.sql`). Migracja wypełnia kolumnę
  startowo wartością `last_seen`, więc lista nie jest pusta od pierwszego dnia.
- **Bez migracji nic się nie psuje:** zapytanie listy degraduje się do wariantu bez tej kolumny
  (ten sam wzorzec co przy `narrative_role`), nagłówek kolumny zmienia się na „Aktywność", a
  podsumowanie mówi wprost, że pokazana jest ostatnia aktywność konta, nie logowanie.

## Subkonto NPC (tryb NPC dla administracji)

Administracja prowadzi postacie NPC bez zakładania i przelogowywania dodatkowych kont. W lobby
konto z rolą `admin` widzi przycisk **NPC**, który przenosi je na **jedno wspólne subkonto NPC** —
z osobnym lobby, osobną karuzelą postaci i przyciskiem powrotu na własne konto.

**Jak to działa**

- Subkonto NPC to zwykły rekord w `users` ze znacznikiem `is_npc_account = 1`. Backend zakłada je
  sam przy pierwszym wejściu w tryb NPC (`backend/utils/npcAccount.js`) — nic nie trzeba wpisywać
  ręcznie. Hasło tego konta jest celowo nieużywalne: przez formularz logowania **nie da się** na nie
  wejść, wyłącznie przyciskiem z lobby.
- Postacie NPC to zwykłe rekordy w `characters` z `user_id` tego subkonta, więc **każda ma własne
  sesje, wiadomości, profil, ekwipunek i statystyki** — bez dublowania mechanik. Tworzy się je tak
  samo jak postać gracza (kreator postaci), tyle że nie czekają na akceptację (`approved = 1` od
  razu). Limit slotów: 50 (`utils/characterSlots.js`).
- Rola subkonta to `mistrz_gry`, nie `admin` — w trybie NPC nie ma się dostępu do panelu admina,
  żeby nie robić zmian administracyjnych „z konta NPC". Wejść może wyłącznie konto z rolą `admin`
  (rola czytana z bazy, nie z payloadu tokena).
- Przełączenie kont to podmiana tokena: `POST /api/npc-account/enter` i `POST /api/npc-account/exit`
  (`backend/routes/npcAccount.js`). Token trybu NPC pamięta, które konto admina weszło
  (`npcOwnerId`), i znacznik ten wędruje do każdego kolejnego tokena (wybór postaci, tworzenie,
  reset, odświeżenie) — inaczej admin utknąłby na subkoncie bez drogi powrotnej.
- Powrót jest dostępny z lobby (przycisk **Wróć na swoje konto**) i z dowolnego miejsca w grze —
  plakietka „TRYB NPC" w lewym dolnym rogu (`frontend/src/components/NpcModeBadge.js`), która
  jednocześnie przypomina, że pisze się jako NPC, a nie własną postacią.

**Migracja istniejącej bazy:** uruchom `database/add-npc-subaccount.sql` (świeże instalacje przez
kreator dostają kolumnę z `database/schema.sql`). Bez migracji reszta gry działa normalnie —
wejście w tryb NPC zwraca wtedy czytelny komunikat, że trzeba ją uruchomić.

### Kilku adminów naraz — „którą postacią gram"

Subkonto jest wspólne, więc pytanie „która postać jest moja" nie ma sensownej odpowiedzi na
poziomie KONTA: `characters.is_active` jest jedno, a adminów w trybie NPC może być kilku.
Odpowiedź nosi token (`characterId` jest per zalogowana sesja), dlatego endpointy działające na
„mojej postaci" pytają o nią przez `backend/utils/activeCharacter.js`:

- `resolveCharacterId(req, cb)` / `resolveCharacterIdAsync(req)` / `withCharacterId(req, res, cb)` —
  bierze `characterId` z tokena, **weryfikuje własność w bazie** (nie na słowo tokena), a na
  `is_active` schodzi tylko awaryjnie: dla starych tokenów sprzed wyboru postaci i dla tokenów
  wskazujących postać usuniętą lub z innego konta.
- Przepięte na helper: profil i HUD (`profile.js`, `stats.js`), ekwipunek, karczma (`tavern.js`),
  notatki postaci, kartoteka (`logs.js`), zgłoszenia (`reports.js`), reset postaci (`lobby.js`),
  prestiż i wiadomość globalna admina.
- Sesje i wiadomości nigdy nie miały tego problemu — biorą `characterId` z żądania i sprawdzają
  własność przez `user_id`.

**Co nadal jest per konto, nie per postać:**

- **Lista online** (`onlineUsers.js`) pokazuje jedną postać na konto (tę z `is_active`), więc z
  subkonta NPC widoczny będzie tylko ostatnio wybrany NPC. Rozwiązanie wymaga śledzenia aktywności
  per postać (nowa kolumna w `characters`), czyli migracji.
- **Obecność w karczmie** (`tavern_active_users`) jest kluczowana po `user_id`, więc dwóch adminów
  w trybie NPC dzieli jedno „miejsce" w pokoju. To też wymaga migracji tabeli na `character_id`.

Poza tymi dwoma miejscami kilku adminów może prowadzić różne NPC-e równolegle bez wchodzenia
sobie w drogę.

## Reset postaci: limit 1 na 7 dni

Reset z lobby (`RESETUJ POSTAĆ`) zostawia postaci **to samo ID**, ale wymienia ją na nową osobę:
poziom 1, statystyki bazowe rasy, wyczyszczony dorobek (ekwipunek, surowce, dom, bank, oferty)
i **złoto startowe 5000 z** — tyle samo, co dostaje świeżo utworzona postać.

**Dlaczego jest limit.** Bez niego reset jest nieograniczonym źródłem złota: wystarczy wyprowadzić
majątek na inną swoją postać (bazar), zresetować, wziąć kolejne 5000 i powtarzać. Slotów to nie
hamuje — usunięcie postaci slot zużywa (skasowane postacie dalej liczą się do limitu 4), ale reset
**nie**, bo działa na tym samym wierszu.

- **Zasada:** jeden reset na **7 dni** na **dane ID postaci** (nie na konto) — każdy slot ma własny
  licznik. Postać nigdy nieresetowana może być zresetowana od razu.
- **Kiedy leci licznik:** znacznik `characters.last_reset_at` ustawia dopiero **potwierdzenie**
  (`/lobby/reset/confirm`). Przygotowanie podglądu (`/lobby/reset/initiate`) niczego nie zużywa,
  więc anulowany reset nie blokuje tygodnia.
- **Gdzie sprawdzane:** w obu krokach resetu (podgląd może zostać przygotowany wcześniej, np.
  w drugiej karcie przeglądarki, a liczy się moment zatwierdzenia) oraz **w samym `UPDATE`** —
  warunek cooldownu siedzi w jego `WHERE`, więc dwa równoległe potwierdzenia nie przepchną dwóch
  resetów. Odmowa to `429` z terminem kolejnego resetu.
- **Lobby:** przycisk resetu jest wygaszony do końca cooldownu, a dymek podaje datę i godzinę,
  od której reset znów będzie dostępny (`GET /api/characters` zwraca `resetAvailableAt`).
- **Balans w jednym pliku:** okno cooldownu i komunikaty siedzą w `backend/utils/characterReset.js`.
- **Backend:** `backend/routes/lobby.js`, `backend/routes/characters.js`,
  `backend/utils/characterReset.js`; **front:** `frontend/src/components/CharacterLobby.js`.
- **Migracja istniejącej bazy:** uruchom `database/add-character-reset-cooldown.sql` (świeże
  instalacje przez kreator dostają kolumnę automatycznie z `database/schema.sql`). Migracja **nie**
  wypełnia kolumny wstecz, więc pierwszy reset po jej uruchomieniu jest dostępny od razu.
- **Bez migracji:** lobby działa normalnie (lista postaci degraduje się do zapytania bez tej
  kolumny, ten sam wzorzec co przy `narrative_role`), ale **sam reset jest zablokowany** z
  komunikatem o brakującej migracji — inaczej działałby bez limitu, czyli dokładnie tak, jak
  wyglądała dziura.

## Bank: skarbiec, kredyt i windykacja

Lokacja miejska `/home/bank` (kafelek **Bank** w sekcji CENTRUM). Dwie warstwy jednej relacji
z bankiem — jedna chroni złoto, druga potrafi odebrać wszystko.

- **Skarbiec:** złoto odłożone w banku jest **nietykalne dla kradzieży kieszonkowej** (złodziej
  sięga do `characters.gold`, nie do salda). Za ochronę bank bierze opłatę depozytową 1% (min.
  10 z) — to gold sink i powód, żeby nie trzymać tam wszystkiego. Wypłata darmowa.
- **Kredyt:** jedna czynna umowa na postać, terminy 3 / 7 / 14 dni z odsetkami 10 / 20 / 35%.
  Odsetki są **ustalane przy podpisaniu** i zapisane w wierszu, więc późniejsze strojenie stawek
  nie rusza zawartych umów. Kapitał wypłacany jest do sakiewki.
- **Zdolność kredytowa:** `600 z × poziom + połowa majątku widocznego dla banku` (sakiewka +
  skarbiec + surowce w cenach bazowych), z sufitem 50 000 z. Progi wejścia: poziom **3+**,
  postać istniejąca co najmniej **3 dni**, brak czynnego kredytu i brak wpisu w rejestrze
  dłużników. Postać "na jeden kredyt" nie ma więc po co powstawać.
- **Windykacja** (`cron/bankCollections.js`, co godzinę o :10): po terminie bank dolicza 10%
  kary i sam sięga **najpierw do skarbca, potem do sakiewki**. Jeśli to pokryje dług — sprawa
  się kończy, bez celi.
- **Niewypłacalność:** gdy nie pokryje — **konfiskata miejska** (ekwipunek, zapasy i towar
  wystawiony na sprzedaż przepadają bezpowrotnie, surowce trafiają do puli rynku centralnego
  jako podaż zbijająca ceny), **odsiadka 12–72 h** skalowana rozmiarem długu i **wpis w
  rejestrze dłużników** blokujący kredyt na 14 dni. Resztę długu miasto umarza — postać wychodzi
  bez zobowiązania, ale i bez dobytku.
- **Odsiadka a bank:** zza krat wolno wyłącznie **spłacać** (`/bank/repay`, także ze skarbca) —
  wpłaty, wypłaty i nowe umowy są zamknięte. Inaczej cela byłaby pułapką prowadzącą prosto do
  niewypłacalności.
- **Balans w jednym pliku:** wszystkie progi, stawki i kary siedzą w `backend/utils/bank.js`,
  a strona banku pobiera je z `GET /api/bank` — UI nie powtarza ich na sztywno.
- **Backend:** `backend/routes/bank.js`, `backend/utils/bank.js`,
  `backend/cron/bankCollections.js`; **tabele:** `bank_accounts`, `bank_transactions`,
  `bank_loans`, `bank_debt_records`.
- **Migracja istniejącej bazy:** uruchom `database/add-bank-credit.sql` (świeże instalacje przez
  kreator dostają tabele automatycznie z `database/schema.sql`).

## Roboty w celi

Odsiadkę (`characters.jailed_until` — za nieudaną kradzież albo za niewypłacalność) można
częściowo **odpracować staminą**: 20 staminy = 1 godzina wyroku mniej, ale w sumie najwyżej
**połowa wyroku**. Reszty nie kupi nic poza kaucją wpłaconą przez innego gracza.

- **Gdzie:** panel "Twoja odsiadka" na `/home/prison`; `POST /prison/labor`.
- **Drugi, naturalny limit:** w celi nie ma regeneracji, więc siedzący pracuje tym, co miał przy
  sobie w chwili zamknięcia — realnie odpracuje kilka godzin, a nie cały dozwolony limit.
- **Kolumny:** `characters.jail_sentence_hours` (pierwotna długość wyroku — baza limitu połowy)
  i `characters.jail_labor_hours`; historia w tabeli `jail_labor_log`.
- **Migracja istniejącej bazy:** ta sama — `database/add-bank-credit.sql`.

## Rzemiosło: trzy wyniki próby (kowalstwo i alchemia)

Obie profesje rozliczają pojedynczą próbę tak samo — najpierw **czy w ogóle się udało**, potem
**jak dobrze** — ale ryzyko skalują inaczej, bo inaczej się je zdobywa.

| | Kowalstwo (`craft.js`) | Alchemia (`alchemy.js`) |
|---|---|---|
| Rzut na porażkę | 5–80% (szansa powodzenia 20–95%), zależna od poziomu i statystyk | `max(0, 25 − wprawa/2)%`, **znika przy wprawie 50** |
| Co decyduje o jakości | wyłącznie wprawa w kowalstwie | wyłącznie wprawa w chemii |
| Przy porażce | nie powstaje ani `crafted_items`, ani wpis w `character_inventory` | nic nie trafia do `character_consumables` |
| Koszt porażki | surowce + stamina | surowce + stamina |
| Wprawa rośnie | z każdej próby, spalona uczy najmniej | jw. |

- **Dlaczego ryzyko alchemii maleje do zera:** żółtodziób ma mieć powód, żeby nabijać wprawę, a
  mistrz nie ma marnować składników na loterię. Przy wprawie 0 przepada co czwarta próba, przy 25
  co ósma, od 50 w górę żadna. Kowalstwo nigdy nie dochodzi do pewniaka, bo tam o powodzeniu
  decydują poziom i statystyki, a nie sama praktyka przy kowadle.
- **Trzy wyniki warzenia, nie dwa:** pełna mikstura, słabsza (sikacz — trafia do EQ, bo to najgorsza
  z mikstur, które faktycznie wyszły, a nie porażka) albo spalony kocioł. Okno wyniku pokazuje je
  jako osobne kafelki: *Zwarzonych / W tym słabych / Spalonych*.
- **Widoczność:** ryzyko spalenia wchodzi do `GET /alchemy/recipes` (`failChance`, `failFreeSkill`)
  i jest pokazywane w oknie warzenia **zanim** gracz kliknie „Warz".
- **Kolumna w tabeli mikstur to „Jakość / ryzyko", nie „Szansa”:** procent „szansy na wynik od
  Zwykłej w górę” przy zerowej wprawie pokazywał twarde `0%` i czytał się jak „nic nie zwarzysz”,
  choć mikstura wychodzi zawsze, gdy kocioł nie przepadnie — po prostu słaba. Teraz w komórce są
  **widełki realnie osiągalnych progów** (`Słaba` → `Słaba–Dobra` → `Zwykła–Unikatowa`) i pod nimi
  ryzyko spalenia, o ile jeszcze istnieje. Tabela półproduktów zostaje przy zwykłej „Szansie”, bo
  tam procent znaczy dokładnie to, co mówi.
- **Strojenie balansu:** `BREW_FAIL_BASE_PERCENT` i `BREW_FAIL_SKILL_DIVISOR` w `routes/alchemy.js`.
- **Bez migracji** — sama logika, żadnych zmian w bazie.

### „Zrobiłam, a nie mam" — czytelność wyniku i ślad w kartotece

Zgłoszenie gracza: warzenie powiedziało, że się udało, a w ekwipunku nic nie przybyło. Dwie rzeczy
sprawiały, że takiego zgłoszenia nie dało się ani wyjaśnić, ani obalić:

- **`POST /refine` zwracał `success: true` nawet wtedy, gdy przepadły WSZYSTKIE próby.** Cztery
  półprodukty alchemiczne (Alkohol, Destylowany alkohol, Wyciąg z roślin, Baza do maści) mają realne
  ryzyko porażki, a przy zerowym wyniku UI i tak malowało **zielony** komunikat „udało się" z
  dopiskiem `+0×`. Teraz `success` znaczy „coś z tego wyszło”, a `Craft.js` (zakładka Alchemia) i
  `Refine.js` (Huta i Warsztat) pokazują przy zerze komunikat błędu: *nic nie wyszło, surowce i
  stamina przepadły*. `POST /cook` dostał ten sam sens `success` (frontend Paleniska rozróżniał to
  już wcześniej).
- **Warzenie nie zostawiało żadnego śladu.** Rafinacja, gotowanie, bazar i bank piszą do
  `character_logs`, alchemia jako jedyna nie pisała nic. `POST /alchemy/brew` dopisuje teraz wpis
  `alchemy` po KAŻDEJ partii — ile prób, ile zwarzonych, ile spalonych kotłów i dokładnie jakie
  `consumable_type_id` poszły do ekwipunku. Po tym wpisie widać wprost, czy mikstura powstała.

Dodatkowo zapis mikstury do `character_consumables` sprawdza teraz `affectedRows`: gdyby upsert
kiedykolwiek nie ruszył wiersza, warzenie leci wyjątkiem i cała transakcja się cofa (gracz
zostaje ze składnikami), zamiast po cichu zjeść miksturę i zameldować sukces.

## Notatnik alchemika, dymki po prawej, gwiazdki z notatnika

Trzy zgłoszenia z gry, wszystkie o to samo: interfejs kazał szukać tego, co powinno być pod ręką.

### Znane receptury w jednym miejscu (`Craft.js`, zakładka Alchemia)

Zakładka wypisywała **cały katalog** mikstur i eliksirów w dwóch tabelach, a poznane receptury
leżały w nich wymieszane z nieznanymi — jedyną różnicą było przygaszenie (`opacity: 0.65`)
wierszy, których gracz jeszcze nie zna. Świeży alchemik zna dwie pozycje z kilkunastu, więc żeby
cokolwiek zwarzyć, musiał przewinąć obie tabele i wypatrzeć te dwa niewygaszone wiersze.

Teraz na górze zakładki stoi sekcja **„Znane receptury"** — poznane mikstury i eliksiry razem, w
jednej tabeli, z licznikiem *ile z nich da się zwarzyć teraz* i z gotowymi do warzenia na samej
górze. Katalogi niżej („Mikstury — do poznania", „Eliksiry — … do poznania") pokazują już wyłącznie
receptury **nieznane**, więc żadna pozycja nie wisi w dwóch miejscach naraz. Wiersz obu rodzin
renderuje jeden wspólny `potionRow` / `elixirRow`, żeby notatnik i katalog nie mogły się rozjechać.
Półprodukty zostają osobno — nie wymagają nauki, więc nie są „znaną recepturą”, tylko czymś, co
alchemik może wytwarzać od pierwszego dnia.

### Dymki powiadomień: `GameToaster`

Każdy ekran montował własny `<Toaster position="top-center">` (13 kopii). Dymek wychodził więc na
środek górnej krawędzi — dokładnie tam, gdzie stoi przycisk, którym się go wywołało — a przy
wydobyciu, warzeniu czy rafinacji klika się ten sam przycisk kilkanaście razy z rzędu. Na telefonie
szeroki dymek zasłaniał przycisk na całe swoje życie (3,5–5 s).

`frontend/src/components/GameToaster.js` jest teraz jedynym miejscem, które ustala zachowanie dymków:

- pozycja **`top-right`** — obok kolumny treści, nie na niej,
- **`pointerEvents: 'none'`** — nawet gdy dymek trafi na przycisk, kolejne kliknięcie przechodzi
  przez niego. Nic na tym nie tracimy: `react-hot-toast` i tak nie zamyka dymka po kliknięciu,
- na telefonie (`useResponsive().isSmall`) mniejsza czcionka, ciaśniejsze marginesy,
  `maxWidth: 62vw` i skrócony czas życia (`TOAST_DURATION_MOBILE` = 1,8 s zamiast 3,5–5 s),
- na telefonie dymki schodzą **pod** przyklejony pasek postaci (`Sidebar`, `position: fixed`),
  z zapasem na notch (`env(safe-area-inset-top)`), zamiast lądować na nim.

Ekrany wołają `<GameToaster style={toastStyle.style} duration={…} />` i nie ustawiają już pozycji
same — inaczej po kilku miesiącach znowu byłoby 13 różnych ustawień.

### Gwiazdki `*akcja*` wklejone z notatnika (`starText.js`)

Cztery ekrany RP (Sesje Ogólne, Sesje Prywatne, Karczma, Wiadomości) miały **własne kopie** obsługi
gwiazdek i wszystkie cztery dzieliły dwie usterki:

1. **Wklejanie gubiło gwiazdki.** Tiptap ma wbudowaną regułę markdown „`*tekst*` to kursywa”.
   Ekrany wyłączały ją tylko dla **pisania** (`addInputRules`), ale `@tiptap/extension-italic`
   deklaruje osobno **`addPasteRules`** — więc post napisany w notatniku i wklejony do gry tracił
   gwiazdki jeszcze zanim gra zdążyła je zobaczyć: zamieniały się w `<em>`. Ten sam post wpisany
   ręcznie w edytorze działał, co czyniło zgłoszenie trudnym do powtórzenia.
   **Fix:** `Italic.extend(disableMarkdownPasteRules)` — wyłącza obie rodziny reguł naraz.
2. **Akapity rozwalały HTML.** Konwersja `*tekst*` → `<span>` szła `String.replace` po surowym
   HTML-u, więc opis rozciągnięty na dwa akapity (`*Wchodzi.` … `Rozgląda się.*`) dawał
   `<p><span>…</p><p>…</span></p>` — znacznik otwarty w jednym akapicie, zamknięty w drugim.
   Przeglądarka i DOMPurify prostowały to po swojemu i kolor gubił się poza pierwszym akapitem.
   A wklejony z notatnika post to prawie zawsze kilka akapitów.
   **Fix:** dopasowanie liczone na **samym tekście** (bez znaczników), wynik wstawiany per węzeł
   tekstowy — każdy akapit dostaje własny, domknięty `<span>`.

Ta sama reguła obsługuje teraz podgląd w edytorze, więc podświetlenie w trakcie pisania obejmuje
cały opis, a nie tylko jego pierwszy akapit. Panele redakcyjne (poradniki, bestiariusz, zasady…)
mają własne, czysto dekoracyjne kolorowanie gwiazdek i zostały bez zmian — tam gwiazdki zapisują
się dosłownie i nic ich nie zjada.

## Bazar: kategorie towarów zamiast jednego worka

Zgłoszenie: „na bazarze można wystawić broń i zbroje, ale mikstury alchemiczne nie mają swojej
osobnej kategorii; półprodukty do kowalstwa i do alchemii też powinny mieć osobno, tak jak rośliny,
rudy i tak dalej”. Pod spodem były trzy różne braki.

### 1. Surowce leżały na jednej płaskiej liście

`Rynek` (`ResourceMarket.js`) od zawsze dzielił towary na sekcje, bo katalog surowców
(`utils/marketPricing.js`) ma pole `category`. `Bazar` (handel gracz–gracz) tego **nie używał**:
oferty szły jedną tabelą posortowaną po dacie, a rozwijane pole „Surowiec" wypisywało wszystkie
51 pozycji jednym ciągiem — Sosna, Kamień, Stal, Illani, Wyciąg z roślin, Jedwab.

Teraz Bazar dzieli oferty na te same sekcje co Rynek (plus pasek filtrów z licznikami), a oba
rozwijane pola formularza grupują surowce nagłówkami. Nazwy i kolejność sekcji przeniesione do
wspólnego `frontend/src/components/resourceCategories.js`, żeby Rynek i Bazar nie mogły się
rozjechać. Dwie kategorie dostały przy okazji nazwy mówiące, czym naprawdę są:

| `category` | Etykieta | Co tam jest |
|---|---|---|
| `metal` | Metale — półprodukty kowalskie | wytopy z Huty: Miedź, Brąz, Mosiądz, Żelazo, Stal |
| `alchemy` | Półprodukty alchemiczne | Wyciąg z roślin, Destylowany alkohol, Baza do maści |
| `herb` | Zioła i rośliny | Illani, Illanias, Nutari, Dynallca |
| `ore` | Kamień i rudy | Kamień, Węgiel, rudy miedzi/cynku/cyny/żelaza |

Backend (`GET /bazaar`) dokłada do każdej oferty `resourceCategory` z `RESOURCE_MAP`.

### 2. Mikstury nie miały własnej kategorii — bo `category` ich nie rozróżnia

Na zakładce „Przedmioty" wszystkie wyroby konsumpcyjne siedziały pod **jednym** filtrem
o nazwie „Przedmioty": mikstury, eliksiry, pieczenie, rosoły i apteczki ze sklepu razem.

Nie dało się tego rozdzielić samą kolumną `consumable_types.category`, bo mikstura lecznicza
z kotła alchemika i pieczeń z paleniska mają identyczne `category = 'medkit'` — obie po prostu
leczą HP. Rozróżnia je dopiero `item_source`, który jest w bazie od początku, ale nie był
zwracany przez `GET /shop/market-consumables`:

| `item_source` | Grupa na Bazarze | Ile pozycji w seedach |
|---|---|---|
| `craft` | **Mikstury i eliksiry** | 40 (napary, miksy, mikstury lecznicze, eliksiry) |
| `cook`, `refine` | Jedzenie i napoje | 17 (potrawy z paleniska + wyroby Warsztatu) |

Alchemia jest jedynym źródłem z `item_source = 'craft'`, więc warunek jest jednoznaczny. Podział
siedzi w `frontend/src/components/consumableCategories.js`, wspólnie dla filtrów rynku i dla
formularza wystawiania. Filtr „Wszystko" (pokazywał wyłącznie broń i pancerz) nazywa się teraz
zgodnie z prawdą: **„Broń i pancerz"**.

To są **dwa jedyne źródła wyrobów w grze**. Apteczki I–V oraz energetyki (kawa, napój
energetyczny) zostały usunięte z gry migracją `database/economy-crafting.sql` — leczenie
i regeneracja idą dziś wyłącznie z alchemii i z jedzenia — więc filtr „Apteczki i inne" pokazywał
twarde `(0)`, którego niczym nie dało się zapełnić. Grupa awaryjna została w kodzie pod nazwą
„Pozostałe" (żeby wyrób dodany w przyszłości nie zniknął po cichu z rynku), ale jej przycisk
renderuje się **tylko wtedy, gdy naprawdę coś w niej leży**.

### 2b. Zakładka „Materiały" nie mogła nigdy nic pokazać — usunięta

Wewnątrz zakładki przedmiotów siedziały jeszcze dwie własne pod-zakładki: `RYNEK` i `MATERIAŁY`.
Ta druga, opisana jako „materiały budowlane", pokazywała `consumable_types` z kategorią
`material` — czyli bandaże, medykamenty i puste apteczki (pozostałości po starym silniku; nazwa
„budowlane" nie miała z nimi nic wspólnego). **Wszystkie cztery mają `non_tradeable = 1`**, a
`POST /shop/list-consumable` jest jedyną trasą wstawiającą cokolwiek do `market_consumables`
i takie typy odrzuca — zakładka była więc pusta z definicji, nie z braku ofert.

Została usunięta razem z całym paskiem pod-zakładek (po usunięciu drugiej pozycji został on
jednym samotnym „RYNEK" nad rynkiem, dublującym zakładki Bazaru). Prawdziwe materiały i surowce
handluje się na zakładce „Surowce i barter".

### 3. Miksturę dało się kupić na Bazarze, ale nie dało się jej tam wystawić

Bazar miał formularz „Wystaw broń / pancerz" (`POST /shop/list-item`), a mikstury i potrawy dało
się wystawić **wyłącznie z Ekwipunku** — mimo że kupuje się je w tym samym miejscu co broń.
Endpoint (`POST /shop/list-consumable`) istniał, brakowało tylko formularza. Bazar dostał więc
drugi formularz: lista pogrupowana tak samo jak filtry, ilość ograniczona stanem plecaka, cena
**za sztukę** (mikstury leżą stackami) i podgląd sumy. Pozycje `non_tradeable` nie trafiają do
listy w ogóle, zamiast dawać błąd po kliknięciu.

Oba formularze siedzą teraz w **jednym panelu, w dwóch kolumnach obok siebie** („Wystaw na
sprzedaż"), rozdzielonych pionową kreską. Wcześniej były to dwie osobne ramki pełnej szerokości
jedna pod drugą — każda z własnym nagłówkiem, trzema wąskimi polami i pustym pasem po prawej —
zjadały pół ekranu nad rynkiem, a etykiety pól i tak się ucinały („CENA (…", „CENA/S…"). Pole
wyboru przedmiotu rozciąga się teraz na dostępną szerokość, a na wąskim ekranie kolumny składają
się z powrotem jedna pod drugą.

Wiersze rynku dostały też ikonę wg grupy — kolba przy miksturze, sztućce przy potrawie. Wcześniej
wszystko konsumpcyjne miało tę samą torbę medyczną, więc rosół wyglądał na liście identycznie jak
eliksir.

**Bez migracji** — wszystkie potrzebne kolumny (`category`, `item_source`) już są w bazie.

## Znane ograniczenia (wymagają ręcznej pracy graficznej/artystycznej)

- Grafiki w `frontend/public/` (tła, ikony, tileset) są neutralne, ale nie zostały przeprojektowane
  pod konkretny styl graficzny — możesz je podmienić na własne.
- `ExplorationWaitingScreen.js` rysuje na canvasie animowaną scenę eksploracji (tło, sylwetki
  budynków/ruin) — mechanicznie działa, ale wygląd wart jest przeprojektowania pod Twój setting.

## Kolorystyka

Cała paleta kolorów jest scentralizowana w `frontend/src/components/theme.js` (`appColors`,
`createAppTheme`) — to jedyne miejsce, które trzeba zmienić, żeby przekolorować całą aplikację.
