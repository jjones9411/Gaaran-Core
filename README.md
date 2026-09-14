# Gaaran-Core

Czysty szkielet silnika przeglądarkowej gry **fabularnej** (RP): Node.js + Express + MySQL
po stronie serwera, React (rsbuild) + MUI po stronie przeglądarki.

To jest podstawa do budowania własnej gry, a nie gotowa gra. Nie ma tu żadnego świata,
żadnej grafiki i żadnej mechaniki - wszystko, co widzi gracz, wpisuje administracja
w kreatorze instalacyjnym i w panelu administracyjnym.

## Czego tu nie ma - świadomie

Silnik nie liczy niczego. Nie ma:

- punktów życia, staminy, doświadczenia, poziomów ani prestiżu,
- statystyk postaci, mnożników i bonusów (rasa i klasa to same etykiety),
- walki, areny, PvP, potworów i bestiariusza,
- złota, ekwipunku, rzemiosła, alchemii, sklepów, rynku i banku,
- pracy, eksploracji, zbieractwa, upraw, gotowania i treningu,
- miasta, więzienia, szpitala, pogody i chorób.

Dzięki temu nie ma też pytań o balans: wynik zdarzenia ustalają gracze i mistrz gry
w tekście, a baza tylko ten tekst przechowuje.

Nie ma również żadnych plików graficznych - ani jednego. Wygląd niosą kolory (kolor
rasy ustawiany w panelu), typografia i obwódki CSS.

## Co jest w środku

**Konta i postacie**
- rejestracja z mailem aktywacyjnym, logowanie (JWT), reset hasła,
- role kont: `mieszkaniec`, `mistrz_gry`, `admin`,
- kilka postaci na konto (lobby z przełączaniem), awatar, opis, status, motyw muzyczny,
- karta postaci (KP) zatwierdzana przez administrację, zalety i wady z opisem i datami,
- przedmioty fabularne (relikwie, listy, klucze) wpisywane przez administrację,
- kartoteka postaci - kronika decyzji administracyjnych,
- prywatne zakładki na profilu i prywatny notatnik gracza.

**Gra fabularna**
- sesje ogólne (otwarte) i prywatne (zamknięte): uczestnicy, posty, głos narratora,
  edytor tekstu, rzuty kośćmi dopinane do posta,
- codziennik postaci - co czeka na odpis, co na narrację, z terminami,
- podsumowania sesji składane przez graczy i rozpatrywane przez administrację;
  po akceptacji zaleta lub wada ląduje na karcie postaci,
- karczma: pokoje czatu na żywo (WebSocket), z możliwością ograniczenia wejścia do wybranych ras,
- wiadomości prywatne między postaciami,
- wieści (ogłoszenia ze świata) z komentarzami, komunikaty dla mieszkańców, ogłoszenia globalne.

**Świat i lore (CMS)**
- rasy i klasy - dowolna liczba, definiowane przy instalacji i edytowalne w panelu,
- strony ras, kulty, zaklęcia, NPC, regulamin i strony informacyjne,
- klany/rody z zaproszeniami i rolami (głowa, oficer, członek),
- cmentarz: postać, której historia się domyka, zostaje tu z epitafium.

**Administracja**
- panel: role, blokady kont, wymuszone wylogowanie, usuwanie kont z podglądem skutków,
- kolejka kart postaci do akceptacji, zgłoszenia graczy, logi administracyjne,
- zarządzanie pokojami karczmy i klanami, masowa wysyłka maili,
- Bugtrack - błędy backendu łapane automatycznie i zgłoszenia graczy.

## Wymagania

- Node.js 18+
- MySQL 5.7+ / MariaDB 10.4+

## Szybki start

```bash
# Backend
cd backend
npm install
npm start          # startuje NAWET bez skonfigurowanej bazy - patrz kreator niżej

# Frontend (drugi terminal)
cd frontend
npm install
npm run dev
```

Nie trzeba ręcznie tworzyć `backend/.env` ani importować schematu bazy - robi to kreator
instalacyjny. Warunek: `backend/.env` ma nie istnieć (świeży `git clone` to spełnia).

## Kreator instalacyjny (`/install`)

Przy pierwszym uruchomieniu aplikacja widzi, że gry jeszcze nie ma, i zamiast niej pokazuje
kreator - niezależnie od wpisanego adresu. Kroki:

1. **Baza danych** - host, port, użytkownik, hasło, nazwa bazy. Kreator łączy się z serwerem,
   zakłada bazę, jeśli jej nie ma, i importuje `database/schema.sql`.
2. **Nazwa gry i kolory** - nazwa trafia do tytułu strony, maili i podglądów linków;
   kolory (akcent, tekst, tło) ustawiają motyw całego interfejsu.
3. **Rasy** - dowolna liczba. Każda ma nazwę, opis, cechy (tekst) i kolor. Nic poza tym:
   rasa nie daje żadnych premii.
4. **Klasy** - jak wyżej: nazwa i opis roli w świecie.
5. **Konto administratora** - pierwszy login do panelu.
6. **SMTP** (opcjonalnie) - do maili aktywacyjnych i resetu hasła; można uzupełnić później
   w `backend/.env`.

Na koniec kreator zapisuje kompletny `backend/.env` (z losowym `JWT_SECRET`) i zakłada plik
`backend/.installed`, który blokuje ponowne uruchomienie kreatora.

**Jedyny ręczny krok:** po zakończeniu kreatora zrestartuj proces Node - `.env` jest czytany
raz, przy starcie procesu.

Konfiguracja ręczna (np. do developmentu): skopiuj `backend/.env.example` do `backend/.env`,
zaimportuj `database/schema.sql`, dopisz rasy i klasy do tabel `races` / `classes` i utwórz
pusty plik `backend/.installed`.

## Baza danych

Cały schemat to jeden plik: `database/schema.sql` - 54 tabele w ośmiu sekcjach (konta, świat,
postacie, sesje, karczma, wiadomości, klany, administracja). Klucze główne, indeksy i klucze
obce stoją wprost w `CREATE TABLE`, a kolejność sekcji odpowiada zależnościom, więc plik
wykonuje się od góry do dołu bez wyłączania sprawdzania kluczy:

```bash
mysql -u uzytkownik -p nazwa_bazy < database/schema.sql
```

Nie ma osobnych migracji - przy zmianie schematu dopisujesz ją w tym pliku i (na działającej
grze) wykonujesz ręcznie odpowiedni `ALTER TABLE`.

## Struktura repozytorium

```
backend/
  server.js         # konfiguracja Expressa, CORS, limity, montowanie tras
  config/           # pula MySQL, WebSocket
  middleware/       # autoryzacja (JWT), limity żądań
  routes/           # po jednym pliku na moduł gry
  utils/            # wspólne funkcje (rzuty kośćmi, uploady, logi błędów)
database/
  schema.sql        # kompletny schemat bazy
frontend/
  src/App.js        # routing i motyw
  src/components/   # ekrany gry i wspólne elementy interfejsu
```

## Rozbudowa

Silnik jest pomyślany jako punkt wyjścia. Najczęstsze kierunki:

- **nowy dział lore** - skopiuj wzorzec `routes/cults.js` (CMS: tytuł, opis, obraz) razem
  z jego ekranem i dopisz tabelę w `schema.sql`,
- **nowe pole postaci** - kolumna w `characters`, odczyt w `routes/profile.js`, widok w `Profile.js`,
- **własna mechanika** - jeśli naprawdę jej chcesz, dokładasz ją jako osobny moduł; rdzeń
  niczego nie liczy i nie będzie Ci w tym przeszkadzał.

## Licencja

MIT.
