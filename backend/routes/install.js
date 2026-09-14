// ================================
// routes/install.js
// Kreator instalacyjny (/install) - konfiguruje baze danych, nazwe gry,
// rasy, klasy i konto administratora BEZ reczne edycji .env czy phpMyAdmin.
//
// Jak to dziala (bo Node, w przeciwienstwie do PHP, wczytuje .env raz przy
// starcie procesu):
// 1. Serwer startuje NORMALNIE nawet bez skonfigurowanej bazy - mysql2 nie
//    rzuca wyjatkiem przy tworzeniu poola z pustymi danymi, wiec caly proces
//    dziala, tylko zapytania do bazy beda failowac (co jest OK, bo /install
//    nie korzysta ze wspoldzielonego poola z config/database.js).
// 2. Ten router uzywa WLASNYCH, tymczasowych polaczen mysql2 (nie
//    wspoldzielonego poola) do testowania/tworzenia bazy i importu schema.sql.
// 3. Na koniec zapisuje kompletny plik .env (DB_*, JWT_SECRET) i
//    sam zamyka proces (process.exit) - pm2 (autorestart domyslnie wlaczony)
//    odpala go ponownie ze swiezym .env, bez recznej interwencji admina.
// 5. Plik backend/.installed (pusty marker) blokuje ponowne uruchomienie
//    kreatora i nadpisanie istniejacych danych.
//
// UWAGA - marker to za malo. Plik `.installed` jest w .gitignore, wiec kazdy
// deploy odtwarzajacy katalog od zera (swiezy klon, `rsync --delete`, nowy
// kontener, przeniesienie na inny hosting) zabiera go ze soba i kreator
// - razem z `DROP DATABASE` w kroku 1 - wraca na dzialajacej grze. Dlatego
// obok markera sprawdzamy TAKZE stan bazy (patrz detectExistingInstall) i przy
// jakiejkolwiek watpliwosci uznajemy silnik za ZAINSTALOWANY. Kreator ma sie
// otworzyc tylko wtedy, gdy potrafimy pozytywnie stwierdzic, ze nie ma czego
// zniszczyc.
// ================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const ENV_PATH = path.join(__dirname, '../.env');
const INSTALLED_MARKER = path.join(__dirname, '../.installed');
const SCHEMA_PATH = path.join(__dirname, '../../database/schema.sql');

// Pamiec tymczasowa danych z kolejnych krokow kreatora (proces zyje az do
// restartu, wiec to wystarczy - nie trzeba tego trzymac w bazie/na dysku).
let pendingDb = null; // { host, port, user, password, database }
let installConnection = null; // aktywne polaczenie mysql2/promise do bazy zainstalowanej w tym przebiegu

// Raz ustalone "zainstalowane" nie ma prawa sie cofnac w trakcie zycia procesu.
let installedCache = null;

function markerExists() {
  return fs.existsSync(INSTALLED_MARKER);
}

function writeMarker() {
  try {
    fs.writeFileSync(INSTALLED_MARKER, new Date().toISOString(), 'utf8');
  } catch (err) {
    // Brak prawa zapisu nie moze wywrocic zapytania - sam wynik detekcji jest
    // wazniejszy niz odtworzenie pliku.
    console.error('❌ Nie udało się odtworzyć markera .installed:', err.message);
  }
}

// Blad znaczacy "tej bazy/tabeli po prostu nie ma" - czyli naprawde swieze
// srodowisko. KAZDY inny blad (baza padla, zle haslo, timeout) znaczy tylko
// tyle, ze nie umiemy sprawdzic - i wtedy zakladamy, ze instalacja istnieje.
const isMissingSchemaError = (err) =>
  ['ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR', 'ER_BAD_TABLE_ERROR'].includes(err?.code);

// Czy w bazie wskazanej przez .env siedzi dzialajaca gra?
async function databaseLooksLive() {
  const db = pool.promise();

  // 1. Znacznik zakonczonej instalacji zapisany przez sam kreator.
  try {
    const [rows] = await db.query('SELECT installed_at FROM game_config WHERE id = 1');
    if (rows.length > 0 && rows[0].installed_at) return true;
  } catch (err) {
    if (!isMissingSchemaError(err)) return true;
    return false;
  }

  // 2. Gra postawiona PRZED powstaniem kreatora ma installed_at = NULL, a i tak
  //    jest produkcja z zywymi kontami - jedno konto wystarczy za dowod.
  try {
    const [users] = await db.query('SELECT id FROM users LIMIT 1');
    return users.length > 0;
  } catch (err) {
    return !isMissingSchemaError(err);
  }
}

// Pelna detekcja: marker LUB slady dzialajacej gry w bazie.
async function detectExistingInstall() {
  // Jedyna furtka do swiadomej reinstalacji: wpis w .env + restart procesu.
  // Stoi PRZED wszystkimi pozostalymi testami, zeby admin nie musial szukac
  // ukrytych plikow - i zeby zadne przypadkowe zdarzenie na serwerze (kasowanie
  // katalogu, pusta baza) nie umialo otworzyc kreatora samo z siebie.
  if (process.env.ALLOW_REINSTALL === 'true') return false;

  if (installedCache === true) return true;
  if (markerExists()) {
    installedCache = true;
    return true;
  }

  // Instalacja trwa wlasnie w tym procesie (krok 1 juz utworzyl schemat, wiec
  // sonda w bazie zaczelaby blokowac kolejne kroki wlasnego kreatora).
  if (pendingDb || installConnection) return false;

  // Silnik nigdy nie byl konfigurowany - brak DB_NAME znaczy brak .env, czyli
  // naprawde swiezy deploy. Tylko tutaj kreator ma prawo ruszyc.
  if (!process.env.DB_NAME) return false;

  let live;
  try {
    live = await databaseLooksLive();
  } catch (err) {
    // Nieoczekiwany blad sondy = brak wiedzy = zamykamy kreatora.
    console.error('❌ Nie udało się sprawdzić stanu instalacji:', err.message);
    live = true;
  }

  if (live) {
    installedCache = true;
    // Odtworz marker zgubiony przez deploy, zeby kolejne wejscia szly szybka
    // sciezka, bez odpytywania bazy.
    writeMarker();
  }
  return live;
}

// Blokuje wszystkie endpointy MODYFIKUJACE stan (wszystko poza /install/status)
// jesli instalacja juz zakonczona - zabezpieczenie przed nadpisaniem danych
// produkcyjnych przez ponowne wejscie na /install.
async function blockIfInstalled(req, res, next) {
  let installed;
  try {
    installed = await detectExistingInstall();
  } catch (err) {
    installed = true; // fail closed
  }
  if (installed) {
    return res.status(403).json({ error: 'Instalacja została już zakończona. Ten kreator jest zablokowany.' });
  }
  next();
}

// GET /install/status - czy instalacja jest zakonczona (sprawdzane przez frontend przy kazdym wejsciu do apki)
router.get('/install/status', async (req, res) => {
  try {
    res.json({ installed: await detectExistingInstall() });
  } catch (err) {
    res.json({ installed: true });
  }
});

// POST /install/database - testuje polaczenie, tworzy baze (jesli nie istnieje) i importuje schema.sql
router.post('/install/database', blockIfInstalled, async (req, res) => {
  const { host, port, user, password, database } = req.body;

  if (!host || !user || !database) {
    return res.status(400).json({ error: 'Host, użytkownik i nazwa bazy są wymagane.' });
  }

  let conn;
  try {
    // 1. Polacz sie BEZ wskazywania bazy (moze jeszcze nie istniec)
    conn = await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password: password || '',
      multipleStatements: true,
    });
  } catch (err) {
    return res.status(400).json({
      error: `Nie udało się połączyć z serwerem MySQL: ${err.message}. Sprawdź host, port, użytkownika i hasło.`
    });
  }

  try {
    // 2. Wyczysc baze do zera i utworz ja ponownie od podstaw.
    // Kreator jest zablokowany po zakonczeniu instalacji (blockIfInstalled),
    // wiec dopoki tu jestesmy, nie ma jeszcze zadnych produkcyjnych danych do
    // stracenia - bezpiecznie jest zawsze zaczac od czystej bazy. To takze
    // naprawia przerwane/nieudane wczesniejsze proby (np. baza z polowa
    // tabel po bledzie w trakcie importu) zamiast pozostawiac je po cichu
    // niekompletne.
    await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await conn.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();

    // Nowe polaczenie z juz wskazana baza (bezpieczniejsze i pewniejsze niz
    // zmiana bazy na istniejacym polaczeniu przez changeUser)
    conn = await mysql.createConnection({
      host, port: port || 3306, user, password: password || '', database,
      multipleStatements: true,
    });

    // 3. Zaimportuj caly schema.sql do swiezej bazy
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Nie znaleziono pliku schema.sql (oczekiwano w ${SCHEMA_PATH}).`);
    }
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    await conn.query(schemaSql);

    pendingDb = { host, port: port || 3306, user, password: password || '', database };
    installConnection = conn;

    res.json({
      success: true,
      message: 'Baza danych utworzona i struktura silnika zaimportowana pomyślnie.',
    });
  } catch (err) {
    await conn.end().catch(() => {});
    console.error('❌ Błąd konfiguracji bazy w instalatorze:', err);
    return res.status(500).json({ error: `Błąd podczas tworzenia bazy/importu struktury: ${err.message}` });
  }
});

function requireDbConnection(res) {
  if (!installConnection) {
    res.status(400).json({ error: 'Najpierw skonfiguruj bazę danych (krok 1).' });
    return false;
  }
  return true;
}

// POST /install/game-info - nazwa gry i kolory motywu (akcent, tekst, tło)
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
router.post('/install/game-info', blockIfInstalled, async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { gameName, themeColor, textColor, backgroundColor } = req.body;
  if (!gameName || !gameName.trim()) {
    return res.status(400).json({ error: 'Nazwa gry jest wymagana.' });
  }
  for (const [label, value] of [['motywu', themeColor], ['tekstu', textColor], ['tła', backgroundColor]]) {
    if (value && !HEX_COLOR_RE.test(value)) {
      return res.status(400).json({ error: `Kolor ${label} musi być w formacie HEX, np. #7a3b0f.` });
    }
  }
  try {
    await installConnection.query(
      'UPDATE game_config SET game_name = ?, theme_primary_color = ?, theme_text_color = ?, theme_background_color = ? WHERE id = 1',
      [gameName.trim(), themeColor || '#7a3b0f', textColor || '#cbd5e0', backgroundColor || '#0a0a0a']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Błąd zapisu nazwy gry:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /install/races - lista ras (dowolna liczba)
router.post('/install/races', blockIfInstalled, async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { races } = req.body;
  if (!Array.isArray(races) || races.length === 0) {
    return res.status(400).json({ error: 'Podaj przynajmniej jedną rasę.' });
  }

  try {
    await installConnection.query('DELETE FROM races');
    for (let i = 0; i < races.length; i++) {
      const r = races[i];
      if (!r.name || !r.name.trim()) {
        return res.status(400).json({ error: `Rasa #${i + 1}: nazwa jest wymagana.` });
      }
      const key = `RASA_${i + 1}`;
      await installConnection.query(
        `INSERT INTO races (\`key\`, name, description, color, traits, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          key, r.name.trim(), r.description || null, r.color || null,
          Array.isArray(r.traits) ? r.traits.join(',') : (r.traits || null),
          i,
        ]
      );
    }
    res.json({ success: true, count: races.length });
  } catch (err) {
    console.error('❌ Błąd zapisu ras:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /install/classes - lista klas (dowolna liczba)
router.post('/install/classes', blockIfInstalled, async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { classes } = req.body;
  if (!Array.isArray(classes) || classes.length === 0) {
    return res.status(400).json({ error: 'Podaj przynajmniej jedną klasę.' });
  }

  try {
    await installConnection.query('DELETE FROM classes');
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      if (!c.name || !c.name.trim()) {
        return res.status(400).json({ error: `Klasa #${i + 1}: nazwa jest wymagana.` });
      }
      const key = `KLASA_${i + 1}`;
      await installConnection.query(
        `INSERT INTO classes (\`key\`, name, description, sort_order)
         VALUES (?, ?, ?, ?)`,
        [key, c.name.trim(), c.description || null, i]
      );
    }
    res.json({ success: true, count: classes.length });
  } catch (err) {
    console.error('❌ Błąd zapisu klas:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /install/admin - konto pierwszego administratora
router.post('/install/admin', blockIfInstalled, async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Nazwa użytkownika, e-mail i hasło są wymagane.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Hasło musi mieć co najmniej 8 znaków.' });
  }

  try {
    const [existing] = await installConnection.query('SELECT id FROM users WHERE user = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Konto administratora już istnieje (uruchom instalator jeszcze raz od nowa, jeśli to pomyłka).' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await installConnection.query(
      `INSERT INTO users (user, email, password, role, active, last_seen) VALUES (?, ?, ?, 'admin', 1, NOW())`,
      [username, email, hashedPassword]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Błąd tworzenia konta admina:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /install/finish - zapisuje .env, oznacza instalacje jako zakonczona
router.post('/install/finish', blockIfInstalled, async (req, res) => {
  if (!pendingDb) {
    return res.status(400).json({ error: 'Najpierw skonfiguruj bazę danych (krok 1).' });
  }
  const { frontendUrl, emailUser, emailPass, smtpHost, smtpPort, emailFrom } = req.body || {};

  try {
    await installConnection.query('UPDATE game_config SET installed_at = NOW() WHERE id = 1');

    const jwtSecret = crypto.randomBytes(64).toString('hex');

    // Nazwa gry laduje tez do .env - build frontu czyta ja stad i wstawia do
    // statycznego <title>/Open Graph (podglady linkow w komunikatorach nie
    // odpalaja JS, wiec musza znalezc gotowa nazwe w HTML-u).
    let gameNameForEnv = '';
    try {
      const [rows] = await installConnection.query('SELECT game_name FROM game_config WHERE id = 1');
      gameNameForEnv = (rows[0]?.game_name || '').replace(/[\r\n]+/g, ' ').trim();
    } catch {
      gameNameForEnv = '';
    }

    const envLines = [
      '# Wygenerowane automatycznie przez kreator instalacyjny (/install)',
      `DB_HOST=${pendingDb.host}`,
      `DB_USER=${pendingDb.user}`,
      `DB_PASSWORD=${pendingDb.password}`,
      `DB_NAME=${pendingDb.database}`,
      pendingDb.port && pendingDb.port !== 3306 ? `DB_PORT=${pendingDb.port}` : null,
      '',
      `FRONTEND_URL=${frontendUrl || 'http://localhost:5173'}`,
      `GAME_NAME=${gameNameForEnv}`,
      '# Opis widoczny w podgladzie linku (Messenger/Telegram/Discord) i w RSS:',
      'GAME_DESCRIPTION=',
      '',
      `JWT_SECRET=${jwtSecret}`,
      '',
      `EMAIL_USER=${emailUser || ''}`,
      `EMAIL_PASS=${emailPass || ''}`,
      `SMTP_HOST=${smtpHost || ''}`,
      `SMTP_PORT=${smtpPort || ''}`,
      `EMAIL_FROM=${emailFrom || ''}`,
      '',
      'TRUST_PROXY_HOPS=1',
      '',
    ].filter(line => line !== null).join('\n');

    fs.writeFileSync(ENV_PATH, envLines, 'utf8');
    fs.writeFileSync(INSTALLED_MARKER, new Date().toISOString(), 'utf8');
    installedCache = true;

    await installConnection.end().catch(() => {});
    installConnection = null;
    pendingDb = null;

    res.json({
      success: true,
      message: 'Instalacja zakończona! Aplikacja zaraz automatycznie się zrestartuje, żeby wczytać nowe ustawienia.',
    });

    // Proces musi wczytac .env i mnozniki ras/klas od nowa (robi to tylko raz,
    // przy starcie - patrz server.js). Zamiast prosic admina o reczny restart
    // (pm2/nginx), zamykamy sam proces po wyslaniu odpowiedzi - pm2 ma domyslnie
    // wlaczony autorestart i odpali go ponownie ze swiezym .env w ulamku sekundy.
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    console.error('❌ Błąd finalizacji instalacji:', err);
    res.status(500).json({ error: 'Błąd serwera podczas finalizacji instalacji.' });
  }
});

module.exports = { router };
