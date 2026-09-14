-- ============================================================================
--  GAARAN-CORE - schemat bazy danych
-- ============================================================================
--  Silnik gry fabularnej (RP) - bez mechaniki. Nie ma tu punktów życia,
--  doświadczenia, statystyk, złota ani ekwipunku: gra toczy się tekstem,
--  a baza przechowuje wyłącznie to, co gracze i administracja napisali.
--
--  Jak tego używać:
--    mysql -u root -p nazwa_bazy < database/schema.sql
--  albo przez kreator instalacyjny (/install), który zrobi to sam.
--
--  Konwencje przyjęte w całym pliku:
--    * InnoDB + utf8mb4 (polskie znaki i emoji w treściach),
--    * klucz główny `id` AUTO_INCREMENT, o ile tabela nie jest czystą relacją,
--    * klucze obce z ON DELETE CASCADE tam, gdzie dane nie mają sensu bez
--      rodzica (posty bez sesji), i ON DELETE SET NULL tam, gdzie wpis ma
--      przetrwać usunięcie autora (log administracyjny),
--    * kolumny czasu: `created_at` / `updated_at`,
--    * nazwy tabel w liczbie mnogiej, kolumny po angielsku, komentarze po polsku.
--
--  Kolejność sekcji odpowiada zależnościom (najpierw konta, potem reszta),
--  więc plik wykonuje się od góry do dołu bez wyłączania sprawdzania kluczy.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- ============================================================================
--  1. KONTA I KONFIGURACJA GRY
-- ============================================================================

-- Konto gracza. Postacie (tabela `characters`) wiszą na koncie - jedno konto
-- prowadzi kilka postaci, ale gra zawsze jedną (`characters.is_active`).
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user` varchar(255) DEFAULT NULL COMMENT 'Login / nazwa gracza pokazywana administracji',
  `email` varchar(191) NOT NULL,
  `password` varchar(255) NOT NULL COMMENT 'Hash bcrypt - nigdy hasło jawne',
  `role` varchar(20) NOT NULL DEFAULT 'mieszkaniec' COMMENT 'mieszkaniec | mistrz_gry | admin',
  `active` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Konto potwierdzone mailem aktywacyjnym',
  `is_npc_account` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Wspólne subkonto administracji do prowadzenia NPC (nie loguje się hasłem)',
  `admin_info` text DEFAULT NULL COMMENT 'Notatka administracji o koncie - niewidoczna dla gracza',

  -- Ustawienia interfejsu (Ustawienia → wygląd)
  `ui_font_scale` smallint(6) NOT NULL DEFAULT 100 COMMENT 'Skala czcionki w % (krok 10, zakres 70..160)',
  `ui_content_width` smallint(6) NOT NULL DEFAULT 1400 COMMENT 'Maks. szerokość głównej kolumny w px',

  -- Reset hasła
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_expires` datetime DEFAULT NULL,

  -- Blokada konta i wymuszone wylogowanie (moderacja)
  `blocked_until` timestamp NULL DEFAULT NULL COMMENT 'Do kiedy konto jest zablokowane (NULL = bez blokady)',
  `force_logout_token` varchar(255) DEFAULT NULL COMMENT 'Token wymuszonego wylogowania - unieważnia JWT wydane wcześniej',
  `force_logout_reason` text DEFAULT NULL,
  `force_logout_at` timestamp NULL DEFAULT NULL,

  -- Obecność
  `online` tinyint(1) NOT NULL DEFAULT 0,
  `last_seen` datetime DEFAULT NULL COMMENT 'Ostatnia aktywność (dowolne żądanie)',
  `last_login` datetime DEFAULT NULL COMMENT 'Ostatnie udane logowanie',
  `last_ip` varchar(45) DEFAULT NULL,

  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_online` (`online`, `last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Poczekalnia rejestracji: konto powstaje dopiero po kliknięciu w link z maila.
-- Dzięki temu w `users` nie ma martwych, niepotwierdzonych adresów.
CREATE TABLE `aktywacja` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(255) NOT NULL COMMENT 'Hash bcrypt, przepisywany do users po aktywacji',
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_aktywacja_token` (`token`),
  KEY `idx_aktywacja_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jeden wiersz (id = 1) z konfiguracją całej gry - nazwa, kolory motywu,
-- tekst powitalny w kreatorze postaci. Wypełnia go kreator instalacyjny.
CREATE TABLE `game_config` (
  `id` int(11) NOT NULL,
  `game_name` varchar(100) DEFAULT NULL COMMENT 'Nazwa gry - jedno źródło prawdy dla frontu i maili',
  `theme_primary_color` varchar(7) DEFAULT '#7a3b0f' COMMENT 'Kolor akcentu UI (HEX)',
  `theme_text_color` varchar(7) DEFAULT '#cbd5e0' COMMENT 'Kolor tekstu (HEX)',
  `theme_background_color` varchar(7) DEFAULT '#0a0a0a' COMMENT 'Kolor tła (HEX)',
  `creator_race_intro` text DEFAULT NULL COMMENT 'Tekst o rasach pokazywany w kreatorze postaci',
  `installed_at` timestamp NULL DEFAULT NULL COMMENT 'Kiedy kreator zakończył instalację (NULL = instalator wciąż aktywny)',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `game_config` (`id`) VALUES (1);


-- ============================================================================
--  2. ŚWIAT: RASY, KLASY, LORE
-- ============================================================================
--  Rasy i klasy są WYŁĄCZNIE FABULARNE - to etykiety z opisem, kolorem i ikoną.
--  Nic tu nie liczy: nie dają bonusów, nie zmieniają żadnych wartości.
--  Ich zawartość definiuje administracja (kreator instalacyjny + panel admina),
--  silnik nie zna z góry żadnej nazwy rasy ani klasy.
-- ============================================================================

CREATE TABLE `races` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL COMMENT 'Techniczny identyfikator (np. RASA_1) zapisywany w characters.faction',
  `name` varchar(100) NOT NULL COMMENT 'Nazwa wyświetlana graczom',
  `description` text DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL COMMENT 'Kolor HEX używany w UI (chipy, zakładki, imiona na listach)',
  `icon` varchar(50) DEFAULT NULL,
  `traits` varchar(500) DEFAULT NULL COMMENT 'Krótkie cechy rasy, oddzielone przecinkiem - opis, nie mechanika',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Nieaktywna rasa znika z kreatora, ale istniejące postacie zachowują nazwę',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_races_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(50) NOT NULL COMMENT 'Techniczny identyfikator (np. KLASA_1) zapisywany w characters.class',
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `icon` varchar(50) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_classes_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Strony lore przypisane do rasy (siedziba rasy / dział w encyklopedii).
-- `race_key` jest logicznym odnośnikiem do races.key - bez klucza obcego,
-- żeby skasowanie rasy nie zabrało tekstów, które ktoś napisał.
CREATE TABLE `race_pages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `race_key` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_race_pages_key` (`race_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trzy bliźniacze tabele CMS-owe dla haseł encyklopedii. Są osobne, bo każda
-- ma własną stronę i własne uprawnienia w panelu, a wspólna tabela z kolumną
-- "typ" kończy się filtrowaniem w każdym zapytaniu.
CREATE TABLE `cults` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `spells` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `image_path` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `npcs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT 'Imię / nazwa NPC',
  `description` longtext DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Regulamin i strony informacyjne (dwie zakładki o tej samej budowie).
CREATE TABLE `rules` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `image_path` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `infos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `infos2` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` longtext DEFAULT NULL,
  `image_path` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  3. POSTACIE
-- ============================================================================
--  Postać to karta w grze fabularnej: imię, rasa, klasa, opis i historia.
--  Nie ma tu ani jednej kolumny liczbowej opisującej "moc" postaci - bo w tym
--  silniku nic takiego nie istnieje.
-- ============================================================================

CREATE TABLE `characters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL COMMENT 'Właściciel postaci',

  -- Tożsamość
  `name` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `race` varchar(255) DEFAULT NULL COMMENT 'Nazwa rasy zapisana przy tworzeniu (kopia dla czytelności)',
  `faction` varchar(50) DEFAULT NULL COMMENT 'Logiczny odnośnik do races.key - to on decyduje o kolorze i stronie rasy',
  `class` varchar(50) DEFAULT NULL COMMENT 'Logiczny odnośnik do classes.key; NULL dopóki gracz nie wybierze klasy',
  `avatar` varchar(255) DEFAULT NULL COMMENT 'Ścieżka do pliku w backend/uploads',

  -- Treści pisane przez gracza
  `description` text DEFAULT NULL COMMENT 'Opis postaci widoczny na profilu',
  `informacje` text DEFAULT NULL COMMENT 'Karta postaci (KP) w formacie JSON - szkielet zakładany przy tworzeniu',
  `informacja` text DEFAULT NULL COMMENT 'Dodatkowa notatka gracza na profilu',
  `achievements` text DEFAULT NULL COMMENT 'Dowolny tekst "osiągnięć" wpisywany na profilu (spis fabularny, nie mechanika)',
  `status` varchar(500) DEFAULT NULL COMMENT 'Krótki status postaci ("w drodze na północ")',
  `youtube_music_url` varchar(500) DEFAULT NULL COMMENT 'Motyw muzyczny profilu',
  `youtube_playlist_index` int(11) NOT NULL DEFAULT 0,

  -- Nadawane przez administrację
  `narrative_role` varchar(100) DEFAULT NULL COMMENT 'Rola fabularna nadana przez administrację',
  `epithet` varchar(100) DEFAULT NULL COMMENT 'Przydomek nadany przez administrację / mistrza gry',

  -- Stan postaci w grze
  `player_status` enum('looking','maybe','not_looking','now_not_looking') NOT NULL DEFAULT 'not_looking'
      COMMENT 'Czy gracz szuka sesji - widoczne na liście online',
  `approved` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Postać dopuszczona do gry przez administrację',
  `isProfileApproved` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Profil (opis) zatwierdzony',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Którą postacią konto gra teraz - dokładnie jedna na konto',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Postać pożegnana - zostaje w bazie, bo wiszą na niej posty i wiadomości',
  `deleted_at` datetime DEFAULT NULL,

  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `last_played` datetime DEFAULT NULL,

  PRIMARY KEY (`id`),
  -- Imię jest unikalne w całej grze: to nim gracze wołają się w sesjach
  -- i po nim wyszukuje się postacie do zaproszeń.
  UNIQUE KEY `uq_characters_name` (`name`),
  KEY `idx_characters_user` (`user_id`, `is_deleted`),
  KEY `idx_characters_active` (`user_id`, `is_active`),
  KEY `idx_characters_faction` (`faction`),
  CONSTRAINT `fk_characters_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KARTA POSTACI (KP) - formularz składany przez gracza i zatwierdzany przez
-- administrację. Jedna postać może mieć kilka wersji karty (historia poprawek),
-- obowiązuje najnowsza zatwierdzona.
CREATE TABLE `character_cards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `height` int(11) DEFAULT NULL,
  `character_description` text DEFAULT NULL COMMENT 'Charakter, usposobienie',
  `visual_description` text DEFAULT NULL COMMENT 'Wygląd',
  `additional_info` text DEFAULT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT 0,
  `was_rejected` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Karta odrzucona i czeka na poprawę gracza',
  `rejection_reason` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL COMMENT 'users.id osoby, która rozpatrzyła kartę',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cards_character` (`character_id`, `is_approved`),
  CONSTRAINT `fk_cards_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ZALETY i WADY postaci. Dwie tabele o identycznej budowie, bo to dwie osobne
-- listy na karcie postaci i osobne kolejki akceptacji.
-- `level` to waga wpisu w fabule (1-5), a nie mnożnik czegokolwiek.
CREATE TABLE `character_achievements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `level` tinyint(1) DEFAULT NULL COMMENT 'Waga zalety 1-5 (opisowa)',
  `created_by` int(11) DEFAULT NULL COMMENT 'users.id autora wpisu',
  `is_approved` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Wpisy administracji są zatwierdzone od razu',
  `was_rejected` tinyint(1) NOT NULL DEFAULT 0,
  `rejection_reason` text DEFAULT NULL,
  `start_date` date DEFAULT NULL COMMENT 'Od kiedy obowiązuje',
  `end_date` date DEFAULT NULL COMMENT 'Do kiedy (NULL = na stałe)',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_achievements_character` (`character_id`, `is_approved`),
  CONSTRAINT `fk_achievements_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `character_problems` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `level` tinyint(1) DEFAULT NULL COMMENT 'Waga wady 1-5 (opisowa)',
  `created_by` int(11) DEFAULT NULL,
  `is_approved` tinyint(1) NOT NULL DEFAULT 0,
  `was_rejected` tinyint(1) NOT NULL DEFAULT 0,
  `rejection_reason` text DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_problems_character` (`character_id`, `is_approved`),
  CONSTRAINT `fk_problems_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRZEDMIOTY FABULARNE: relikwie, listy, klucze - rzeczy, które postać zdobyła
-- w fabule. Wpisuje je wyłącznie administracja, gracz je czyta. To nie jest
-- ekwipunek: przedmiot nie daje żadnego efektu, jest zapisem historii.
CREATE TABLE `character_story_items` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL COMMENT 'Opis / historia przedmiotu',
  `quantity` int(11) NOT NULL DEFAULT 1,
  `source` varchar(150) DEFAULT NULL COMMENT 'Skąd pochodzi (sesja, wydarzenie, NPC)',
  `granted_by` int(11) DEFAULT NULL COMMENT 'users.id osoby, która wpisała przedmiot',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_story_items_character` (`character_id`),
  CONSTRAINT `fk_story_items_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Własne zakładki na profilu postaci (dziennik, relacje, cokolwiek gracz chce).
CREATE TABLE `character_tabs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `tab_name` varchar(100) NOT NULL,
  `tab_content` text DEFAULT NULL,
  `tab_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tabs_character` (`character_id`, `tab_order`),
  CONSTRAINT `fk_tabs_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prywatny notatnik gracza przy postaci (widoczny tylko dla właściciela).
CREATE TABLE `character_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notes_character` (`character_id`),
  CONSTRAINT `fk_notes_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ulubione postacie gracza (skrót do cudzych profili).
CREATE TABLE `character_favorites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `favorite_character_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_favorite` (`user_id`, `favorite_character_id`),
  CONSTRAINT `fk_favorites_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_favorites_character` FOREIGN KEY (`favorite_character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KARTOTEKA postaci: kronika zdarzeń administracyjnych (przyznana zaleta,
-- zatwierdzona karta, przedmiot fabularny). Gracz widzi ją na profilu.
CREATE TABLE `character_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `log_type` varchar(50) NOT NULL COMMENT 'achievement_added, problem_added, story_item_granted, report_accepted...',
  `message` text NOT NULL,
  `related_id` int(11) DEFAULT NULL COMMENT 'ID wpisu, którego log dotyczy',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_logs_character` (`character_id`, `created_at`),
  CONSTRAINT `fk_logs_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dokąd postać doczytała kartotekę (kropka "nowe wpisy").
CREATE TABLE `character_logs_seen` (
  `character_id` int(11) NOT NULL,
  `last_seen_log_id` int(11) DEFAULT NULL,
  `seen_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`character_id`),
  CONSTRAINT `fk_logs_seen_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CMENTARZ. Postać nie znika z gry - jej historia się domyka i zostaje tutaj.
-- `character_snapshot` to JSON z danymi fabularnymi z chwili pożegnania
-- (imię, rasa, opis, karta postaci), żeby wpis był czytelny nawet po latach.
CREATE TABLE `dead_characters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_character_id` int(11) NOT NULL COMMENT 'characters.id - wiersz zostaje z is_deleted = 1',
  `user_id` int(11) NOT NULL,
  `original_name` varchar(100) NOT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `faction` varchar(100) DEFAULT NULL,
  `character_snapshot` longtext NOT NULL CHECK (json_valid(`character_snapshot`)),
  `deletion_type` enum('deleted','reset') NOT NULL DEFAULT 'deleted'
      COMMENT 'reset = historia postaci dobiegła końca, deleted = gracz wycofał postać',
  `death_reason` varchar(255) DEFAULT NULL COMMENT 'Epitafium - administracja może je poprawić',
  `deleted_by_user_id` int(11) NOT NULL,
  `deleted_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_dead_user` (`user_id`, `deleted_at`),
  KEY `idx_dead_original` (`original_character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  4. SESJE FABULARNE
-- ============================================================================
--  Dwa rodzaje sesji o tej samej budowie:
--    * OGÓLNE  - otwarte, każdy może dołączyć,
--    * PRYWATNE - zamknięte, prowadzący dobiera uczestników.
--  Rozdzielone na osobne tabele (a nie jedna z kolumną "typ"), bo mają różne
--  reguły dostępu i różne listy - wspólna tabela kończy się warunkiem `type = ?`
--  doklejanym do każdego zapytania i pomyłką w tym jednym, w którym się go zapomni.
-- ============================================================================

CREATE TABLE `general_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `created_by` int(11) NOT NULL COMMENT 'users.id prowadzącego',
  `start_date` datetime DEFAULT NULL COMMENT 'Kiedy sesja się zaczyna (fabularnie/umówiony termin)',
  `location` varchar(255) DEFAULT NULL COMMENT 'Miejsce akcji - tekst',
  `additional_info` text DEFAULT NULL,
  `notes` text DEFAULT NULL COMMENT 'Notatki prowadzącego',
  `is_adult_only` tinyint(1) NOT NULL DEFAULT 0,
  `closed` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Sesja zamknięta - można czytać, nie można pisać',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_general_sessions_open` (`closed`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `general_session_participants` (
  `session_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  PRIMARY KEY (`session_id`, `character_id`),
  KEY `idx_gsp_character` (`character_id`),
  CONSTRAINT `fk_gsp_session` FOREIGN KEY (`session_id`) REFERENCES `general_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gsp_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Post w sesji. `character_type = 'narrator'` to głos prowadzącego (opis świata),
-- `main` to wypowiedź postaci. `dice_rolls` trzyma rzuty kośćmi dopięte do posta -
-- to jedyna "losowość" w silniku i służy wyłącznie narracji.
CREATE TABLE `general_session_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Kto napisał (konto) - do moderacji',
  `character_id` int(11) DEFAULT NULL COMMENT 'Którą postacią (NULL dla narratora)',
  `character_name` varchar(255) DEFAULT NULL COMMENT 'Imię z chwili napisania - post ma zostać czytelny po zmianie imienia',
  `character_type` enum('main','narrator') NOT NULL DEFAULT 'main',
  `message` text NOT NULL,
  `message_type` varchar(50) NOT NULL DEFAULT 'normal',
  `dice_rolls` longtext DEFAULT NULL
      COMMENT 'JSON: [{"sides":20,"roll":17,"description":"..."}]'
      CHECK (json_valid(`dice_rolls`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `edited_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_gsm_session` (`session_id`, `created_at`),
  CONSTRAINT `fk_gsm_session` FOREIGN KEY (`session_id`) REFERENCES `general_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dokąd postać doczytała sesję (licznik nieprzeczytanych postów).
CREATE TABLE `general_session_seen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  `seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gss` (`session_id`, `character_id`),
  CONSTRAINT `fk_gss_session` FOREIGN KEY (`session_id`) REFERENCES `general_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gss_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `private_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `owner_id` int(11) NOT NULL COMMENT 'users.id właściciela sesji',
  `start_date` datetime DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `additional_info` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `closed` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_private_sessions_owner` (`owner_id`, `closed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `private_session_participants` (
  `session_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  PRIMARY KEY (`session_id`, `character_id`),
  KEY `idx_psp_character` (`character_id`),
  CONSTRAINT `fk_psp_session` FOREIGN KEY (`session_id`) REFERENCES `private_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_psp_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `private_session_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `character_id` int(11) DEFAULT NULL,
  `character_name` varchar(255) DEFAULT NULL,
  `character_type` enum('main','narrator') NOT NULL DEFAULT 'main',
  `message` text NOT NULL,
  `dice_rolls` longtext DEFAULT NULL CHECK (json_valid(`dice_rolls`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `edited_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_psm_session` (`session_id`, `created_at`),
  CONSTRAINT `fk_psm_session` FOREIGN KEY (`session_id`) REFERENCES `private_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `private_session_seen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  `seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pss` (`session_id`, `character_id`),
  CONSTRAINT `fk_pss_session` FOREIGN KEY (`session_id`) REFERENCES `private_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pss_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notatka prowadzącego o konkretnym uczestniku sesji prywatnej.
CREATE TABLE `private_session_participant_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pspn` (`session_id`, `character_id`),
  CONSTRAINT `fk_pspn_session` FOREIGN KEY (`session_id`) REFERENCES `private_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pspn_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CODZIENNIK: prywatne notatki gracza do sesji, w których bierze udział,
-- razem ze znacznikiem "mam do napisania narrację" i terminem.
CREATE TABLE `character_session_journal` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `session_type` enum('private','general') NOT NULL,
  `session_id` int(11) NOT NULL,
  `note` text DEFAULT NULL,
  `session_role` enum('auto','player','narrator','gm') NOT NULL DEFAULT 'auto'
      COMMENT 'auto = rola wyliczona z udziału w sesji',
  `narration_todo` tinyint(1) NOT NULL DEFAULT 0,
  `narration_todo_at` timestamp NULL DEFAULT NULL,
  `narration_due_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_journal_entry` (`character_id`, `session_type`, `session_id`),
  CONSTRAINT `fk_journal_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PODSUMOWANIE SESJI pisane przez gracza i rozpatrywane przez administrację.
-- Po akceptacji zalety/wady z podsumowania trafiają na kartę postaci.
CREATE TABLE `session_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `session_type` enum('private','general') NOT NULL,
  `session_id` int(11) NOT NULL,
  `description` text NOT NULL COMMENT 'Co się wydarzyło',
  `world_consequences` text DEFAULT NULL COMMENT 'Skutki dla świata',
  `character_consequences` text DEFAULT NULL COMMENT 'Skutki dla postaci',
  `advantages_disadvantages` text DEFAULT NULL,
  `positive_consequences` text DEFAULT NULL COMMENT 'Zaleta do dopisania na kartę postaci',
  `negative_consequences` text DEFAULT NULL COMMENT 'Wada do dopisania na kartę postaci',
  `positive_level` tinyint(1) DEFAULT NULL,
  `negative_level` tinyint(1) DEFAULT NULL,
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `admin_comment` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reports_status` (`status`, `created_at`),
  KEY `idx_reports_character` (`character_id`),
  CONSTRAINT `fk_session_reports_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Zgłoszenie gracza o przebiegu sesji kierowane do administracji (osobne od
-- podsumowania: to jest kanał "chcę, żebyście na to spojrzeli").
CREATE TABLE `player_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `character_id` int(11) DEFAULT NULL,
  `character_name` varchar(255) DEFAULT NULL,
  `session_type` enum('general','private') NOT NULL,
  `session_id` int(11) NOT NULL,
  `session_title` varchar(255) NOT NULL,
  `what_happened` text NOT NULL,
  `world_consequences` text DEFAULT NULL,
  `character_consequences` text DEFAULT NULL,
  `reported_skills` text DEFAULT NULL,
  `status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  `admin_comment` text DEFAULT NULL COMMENT 'Odpowiedź widoczna dla gracza',
  `internal_comment` text DEFAULT NULL COMMENT 'Notatka wewnętrzna administracji',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_player_reports_status` (`status`, `created_at`),
  CONSTRAINT `fk_player_reports_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  5. KARCZMA (CZAT NA ŻYWO)
-- ============================================================================
--  Pokoje czatu z historią wiadomości. Wejście do pokoju może być ograniczone
--  do wybranych ras (`required_faction`) - to jedyne "uprawnienie" w silniku
--  i ma charakter fabularny (siedziba rodu, świątynia kultu).
-- ============================================================================

CREATE TABLE `tavern_rooms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `required_faction` varchar(50) DEFAULT NULL
      COMMENT 'Klucze ras (races.key) po przecinku - NULL = pokój otwarty dla wszystkich',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jeden pokój startowy, żeby czat działał zaraz po instalacji.
-- Nazwę zmienia administracja w panelu; kolejne pokoje dodaje tamże.
INSERT INTO `tavern_rooms` (`id`, `name`, `description`) VALUES
  (1, 'Pokój główny', 'Miejsce spotkań - nazwę i opis zmienisz w panelu administracyjnym.');

CREATE TABLE `tavern_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `room_id` int(11) NOT NULL DEFAULT 1,
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL COMMENT 'Login autora z chwili napisania',
  `character_id` int(11) DEFAULT NULL,
  `character_name` varchar(255) DEFAULT NULL,
  `character_type` enum('main','narrator') NOT NULL DEFAULT 'main',
  `message` text NOT NULL,
  `dice_rolls` longtext DEFAULT NULL CHECK (json_valid(`dice_rolls`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tavern_messages_room` (`room_id`, `created_at`),
  CONSTRAINT `fk_tavern_messages_room` FOREIGN KEY (`room_id`) REFERENCES `tavern_rooms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kto jest w pokoju teraz. Wpis kasuje wyjście z karczmy albo brak aktywności.
CREATE TABLE `tavern_active_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `character_id` int(11) DEFAULT NULL COMMENT 'Postać, którą gracz wszedł do karczmy',
  `room_id` int(11) NOT NULL DEFAULT 1,
  `entered_at` timestamp NULL DEFAULT current_timestamp(),
  `last_activity` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tavern_user` (`user_id`),
  KEY `idx_tavern_active_room` (`room_id`),
  CONSTRAINT `fk_tavern_active_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dokąd postać doczytała dany pokój.
CREATE TABLE `tavern_seen_messages` (
  `character_id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `last_seen_message_id` int(11) DEFAULT NULL,
  `seen_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`character_id`, `room_id`),
  KEY `idx_tavern_seen_room` (`room_id`),
  CONSTRAINT `fk_tavern_seen_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wyrzucenie z karczmy: `tavern_kick_log` to historia, `tavern_bans` to
-- obowiązująca blokada wejścia (z terminem końca).
CREATE TABLE `tavern_bans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `banned_by_user_id` int(11) NOT NULL,
  `kicked_character_id` int(11) DEFAULT NULL,
  `kicked_character_name` varchar(255) DEFAULT NULL,
  `reason` text NOT NULL,
  `ban_expires_at` datetime NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tavern_bans_user` (`user_id`, `is_active`, `ban_expires_at`),
  CONSTRAINT `fk_tavern_bans_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tavern_kick_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `kicked_by_user_id` int(11) NOT NULL,
  `kicked_character_id` int(11) DEFAULT NULL,
  `kicked_character_name` varchar(255) DEFAULT NULL,
  `reason` text NOT NULL,
  `ban_duration_minutes` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tavern_kick_user` (`user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  6. WIADOMOŚCI I OGŁOSZENIA
-- ============================================================================
--  Wiadomości prywatne prowadzą POSTACIE, nie konta - w grze pisze do siebie
--  Eldra i Marek, a nie login1 i login2.
-- ============================================================================

-- Rozmowa dwóch postaci. Kolumny `low_character_id` / `high_character_id` są
-- wyliczane automatycznie (mniejsze/większe id) - dzięki temu para (A,B) i (B,A)
-- to ta sama rozmowa i wystarczy jeden indeks, żeby ją znaleźć.
CREATE TABLE `conversations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character1_id` int(11) NOT NULL,
  `character2_id` int(11) NOT NULL,
  `deleted_by_character1` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Ukryta u jednej strony - druga nadal ją widzi',
  `deleted_by_character2` tinyint(1) NOT NULL DEFAULT 0,
  `low_character_id` int(11) GENERATED ALWAYS AS (least(`character1_id`, `character2_id`)) VIRTUAL,
  `high_character_id` int(11) GENERATED ALWAYS AS (greatest(`character1_id`, `character2_id`)) VIRTUAL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_conversation_pair` (`low_character_id`, `high_character_id`),
  KEY `idx_conversation_char1` (`character1_id`),
  KEY `idx_conversation_char2` (`character2_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` int(11) DEFAULT NULL,
  `sender_character_id` int(11) NOT NULL,
  `receiver_character_id` int(11) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation` (`conversation_id`, `created_at`),
  KEY `idx_messages_receiver` (`receiver_character_id`, `created_at`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `conversation_seen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `conversation_id` int(11) NOT NULL,
  `character_id` int(11) NOT NULL,
  `seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_seen` (`conversation_id`, `character_id`),
  CONSTRAINT `fk_conv_seen_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_conv_seen_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OGŁOSZENIE administracji wyświetlane jako wyskakujące okno. `target_factions`
-- pozwala skierować je tylko do wybranych ras.
CREATE TABLE `global_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `created_by` int(11) DEFAULT NULL COMMENT 'users.id autora',
  `created_by_character_id` int(11) DEFAULT NULL COMMENT 'Postać, w której imieniu poszło ogłoszenie',
  `target_factions` varchar(255) DEFAULT NULL COMMENT 'Klucze ras po przecinku (NULL = wszyscy)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_global_messages_active` (`is_active`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kto już przeczytał które ogłoszenie (żeby nie wyskakiwało drugi raz).
CREATE TABLE `character_read_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `character_id` int(11) NOT NULL,
  `message_id` int(11) NOT NULL,
  `read_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_read_message` (`character_id`, `message_id`),
  CONSTRAINT `fk_read_messages_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_read_messages_message` FOREIGN KEY (`message_id`) REFERENCES `global_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Komunikat na pasku dla wszystkich mieszkańców (przerwa techniczna, nabór).
CREATE TABLE `resident_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL COMMENT 'Treść w HTML (sanitizowana przy wyświetlaniu)',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_resident_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WIEŚCI: ogłoszenia ze świata gry, z komentarzami graczy.
CREATE TABLE `news` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `visible_to` longtext DEFAULT NULL
      COMMENT 'JSON z kluczami ras, które widzą wpis (NULL = wszyscy)'
      CHECK (json_valid(`visible_to`)),
  `archived` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_news_archived` (`archived`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `news_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `news_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `character_id` int(11) DEFAULT NULL COMMENT 'Postać, którą gracz komentował',
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Komentarz skasowany - zostaje w bazie dla moderacji',
  PRIMARY KEY (`id`),
  KEY `idx_news_comments_news` (`news_id`, `created_at`),
  CONSTRAINT `fk_news_comments_news` FOREIGN KEY (`news_id`) REFERENCES `news` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  7. KLANY (RODY, RODZINY)
-- ============================================================================
--  Klan tworzy administracja i wyznacza głowę; głowa i oficerowie zapraszają,
--  a zaproszona postać musi zaproszenie przyjąć. Postać należy najwyżej do
--  jednego klanu - pilnuje tego UNIQUE na `clan_members.character_id`.
-- ============================================================================

CREATE TABLE `clans` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `head_character_id` int(11) NOT NULL COMMENT 'characters.id głowy klanu',
  `created_by` int(11) DEFAULT NULL COMMENT 'users.id administratora, który założył klan',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clan_name` (`name`),
  KEY `idx_clan_head` (`head_character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clan_members` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `clan_id` int(10) UNSIGNED NOT NULL,
  `character_id` int(11) NOT NULL,
  `role` enum('head','officer','member') NOT NULL DEFAULT 'member',
  `joined_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_character` (`character_id`),
  KEY `idx_member_clan` (`clan_id`),
  CONSTRAINT `fk_clan_member_clan` FOREIGN KEY (`clan_id`) REFERENCES `clans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clan_member_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clan_invitations` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `clan_id` int(10) UNSIGNED NOT NULL,
  `character_id` int(11) NOT NULL COMMENT 'Zapraszana postać',
  `invited_by` int(11) NOT NULL COMMENT 'characters.id zapraszającego',
  `status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `responded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invitation_clan` (`clan_id`),
  KEY `idx_invitation_character` (`character_id`, `status`),
  CONSTRAINT `fk_clan_invitation_clan` FOREIGN KEY (`clan_id`) REFERENCES `clans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_clan_invitation_character` FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
--  8. ADMINISTRACJA I DIAGNOSTYKA
-- ============================================================================

-- Ślad po każdej decyzji administracyjnej (zmiana roli, blokada konta,
-- zatwierdzenie karty). Wpis przeżywa usunięcie administratora - dlatego
-- `admin_id` nie ma klucza obcego.
CREATE TABLE `admin_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) NOT NULL COMMENT 'users.id osoby wykonującej akcję',
  `action` varchar(100) NOT NULL COMMENT 'Krótki kod akcji, np. change_role',
  `target_user_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_admin_logs_admin` (`admin_id`, `created_at`),
  KEY `idx_admin_logs_target` (`target_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bugtrack: błędy backendu łapane automatycznie i zgłoszenia graczy.
CREATE TABLE `bug_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) DEFAULT 'Untitled Bug',
  `description` text DEFAULT NULL,
  `error_message` text NOT NULL,
  `stack_trace` text DEFAULT NULL,
  `severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('open','in_progress','resolved','closed','wontfix') NOT NULL DEFAULT 'open',
  `bug_type` enum('frontend','backend','database','other') NOT NULL DEFAULT 'other',
  `url` varchar(500) DEFAULT NULL COMMENT 'Adres, na którym błąd wystąpił',
  `browser_info` text DEFAULT NULL,
  `reported_by` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_bug_logs_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
--  KONIEC SCHEMATU
--
--  Po imporcie wejdź na /install - kreator zapyta o nazwę gry, kolory, rasy,
--  klasy i konto administratora, a potem zapisze backend/.env i sam zrestartuje
--  serwer. Nic więcej nie trzeba wpisywać ręcznie.
-- ============================================================================
