const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { resendActivationLimiter } = require('../middleware/rateLimiter');
const { getGameName } = require('./gameInfo');
const { isReservedNpcIdentity, npcTokenClaims } = require('../utils/npcAccount');

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

async function sendActivationEmail(email, username, token) {
  const gameName = await getGameName(pool);
  return new Promise((resolve, reject) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      return reject(new Error('SMTP_NOT_CONFIGURED'));
    }

    const activationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/activate/${token}`;
    const transporter = createSmtpTransporter();

    transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: `Aktywacja konta - ${gameName}`,
      text: `Witaj ${username}!\n\nKliknij w ten link, aby aktywować swoje konto: ${activationLink}\n\nTwoja nazwa użytkownika: ${username}`,
    }, (err) => (err ? reject(err) : resolve()));
  });
}

// POST /api/register - BEZ ZMIAN
router.post('/register', (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, hasło i nazwa użytkownika są wymagane.' });
  }

  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ message: 'Nazwa użytkownika musi mieć od 3 do 50 znaków.' });
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ message: 'Nazwa użytkownika może zawierać tylko litery, cyfry, myślniki i podkreślenia.' });
  }

  // Nazwa/adres wspólnego subkonta NPC administracji są zarezerwowane - inaczej
  // gracz mógłby je zająć i zablokować (albo przechwycić) tryb NPC.
  if (isReservedNpcIdentity({ email, username })) {
    return res.status(400).json({ message: 'Ta nazwa użytkownika jest zarezerwowana.' });
  }

  const token = crypto.randomBytes(20).toString('hex');

  pool.query('SELECT * FROM aktywacja WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Błąd podczas sprawdzania emaila:', err);
      return res.status(500).json({ message: 'Błąd serwera.' });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: 'Użytkownik o tym emailu już istnieje.' });
    }

    pool.query('SELECT * FROM aktywacja WHERE username = ?', [username], (err, results) => {
      if (err) {
        console.error('Błąd podczas sprawdzania nazwy użytkownika w aktywacji:', err);
        return res.status(500).json({ message: 'Błąd serwera.' });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: 'Ta nazwa użytkownika jest już zajęta.' });
      }

      pool.query('SELECT * FROM users WHERE user = ?', [username], (err, results) => {
        if (err) {
          console.error('Błąd podczas sprawdzania nazwy użytkownika w users:', err);
          return res.status(500).json({ message: 'Błąd serwera.' });
        }

        if (results.length > 0) {
          return res.status(400).json({ message: 'Ta nazwa użytkownika jest już zajęta.' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
            console.error('Błąd podczas szyfrowania hasła:', err);
            return res.status(500).json({ message: 'Błąd serwera.' });
          }

          const query = 'INSERT INTO aktywacja (email, password, username, token) VALUES (?, ?, ?, ?)';
          pool.query(query, [email, hashedPassword, username, token], (err, results) => {
            if (err) {
              console.error('Błąd podczas dodawania użytkownika:', err);
              return res.status(500).json({ message: 'Błąd serwera.' });
            }

            sendActivationEmail(email, username, token).then(() => {
              res.status(201).json({
                message: 'Rejestracja zakończona sukcesem! Sprawdź swoją skrzynkę pocztową, aby aktywować konto.',
                username: username
              });
            }).catch((err) => {
              console.error('Błąd podczas wysyłania emaila:', err);

              // Wysyłka się nie powiodła - usuwamy rekord, żeby email/username
              // nie zostały trwale zablokowane bez możliwości dokończenia rejestracji.
              pool.query('DELETE FROM aktywacja WHERE token = ?', [token], (delErr) => {
                if (delErr) {
                  console.error('Błąd podczas usuwania rekordu aktywacji po nieudanej wysyłce:', delErr);
                }
              });

              const message = err.message === 'SMTP_NOT_CONFIGURED'
                ? 'Błąd serwera - konfiguracja SMTP'
                : 'Błąd serwera podczas wysyłania emaila. Spróbuj zarejestrować się ponownie.';
              res.status(500).json({ message });
            });
          });
        });
      });
    });
  });
});

// POST /api/resend-activation
router.post('/resend-activation', resendActivationLimiter, (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Podaj adres e-mail.' });
  }

  pool.query('SELECT * FROM aktywacja WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Błąd podczas sprawdzania emaila w aktywacji:', err);
      return res.status(500).json({ message: 'Błąd serwera.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Nie znaleziono oczekującej rejestracji dla tego adresu e-mail.' });
    }

    const { username } = results[0];
    const newToken = crypto.randomBytes(20).toString('hex');

    pool.query('UPDATE aktywacja SET token = ? WHERE email = ?', [newToken, email], (err) => {
      if (err) {
        console.error('Błąd podczas aktualizacji tokenu aktywacji:', err);
        return res.status(500).json({ message: 'Błąd serwera.' });
      }

      sendActivationEmail(email, username, newToken).then(() => {
        res.status(200).json({ message: 'Wysłano nowy e-mail aktywacyjny. Sprawdź swoją skrzynkę pocztową.' });
      }).catch((err) => {
        console.error('Błąd podczas ponownego wysyłania emaila aktywacyjnego:', err);
        const message = err.message === 'SMTP_NOT_CONFIGURED'
          ? 'Błąd serwera - konfiguracja SMTP'
          : 'Błąd serwera podczas wysyłania emaila.';
        res.status(500).json({ message });
      });
    });
  });
});

// POST /api/activate/:token - BEZ ZMIAN
router.post('/activate/:token', (req, res) => {
  const { token } = req.params;
  const userIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || null;

  pool.query('SELECT * FROM aktywacja WHERE token = ?', [token], (err, results) => {
    if (err) {
      console.error('Błąd podczas sprawdzania tokenu:', err);
      return res.status(500).json({ message: 'Błąd serwera.' });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: 'Nieprawidłowy lub wygasły token.' });
    }

    const { email, password, username } = results[0];

    pool.query('SELECT * FROM users WHERE email = ?', [email], (err, userCheck) => {
      if (err) {
        console.error('Błąd podczas sprawdzania emaila w users:', err);
        return res.status(500).json({ message: 'Błąd serwera.' });
      }

      if (userCheck.length > 0) {
        return res.status(400).json({ message: 'To konto zostało już aktywowane.' });
      }

      pool.query('SELECT * FROM users WHERE user = ?', [username], (err, nameCheck) => {
        if (err) {
          console.error('Błąd podczas sprawdzania nazwy użytkownika:', err);
          return res.status(500).json({ message: 'Błąd serwera.' });
        }

        if (nameCheck.length > 0) {
          return res.status(400).json({ message: 'Ta nazwa użytkownika jest już zajęta. Skontaktuj się z administratorem.' });
        }

        const insertUserQuery = `
          INSERT INTO users (
            user, 
            email, 
            password, 
            last_ip,
            role,
            last_seen
          ) VALUES (?, ?, ?, ?, ?, NOW())
        `;

        const userData = [
          username,
          email,
          password,
          userIP,
          'mieszkaniec'
        ];

        pool.query(insertUserQuery, userData, (err, insertResult) => {
          if (err) {
            console.error('Błąd podczas dodawania użytkownika do tabeli users:', err);
            console.error('SQL Error:', err.sqlMessage);
            return res.status(500).json({ message: 'Błąd serwera podczas tworzenia konta.' });
          }

          const newUserId = insertResult.insertId;

          pool.query('DELETE FROM aktywacja WHERE token = ?', [token], (err) => {
            if (err) {
              console.error('Błąd podczas usuwania rekordu z tabeli aktywacja:', err);
              return res.status(500).json({ message: 'Błąd serwera.' });
            }

            res.status(200).json({
              message: `Witaj ${username}! Twoje konto zostało aktywowane. Możesz się teraz zalogować.`,
              userId: newUserId,
              username: username
            });
          });
        });
      });
    });
  });
});

// POST /api/login - ✅ ROZSZERZONY TOKEN
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email i hasło są wymagane.' });
  }

  pool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('Błąd podczas sprawdzania użytkownika:', err);
      return res.status(500).json({ message: 'Błąd serwera.' });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: 'Nie znaleziono użytkownika o tym emailu.' });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Błąd podczas porównywania haseł:', err);
        return res.status(500).json({ message: 'Błąd serwera.' });
      }

      if (!isMatch) {
        return res.status(400).json({ message: 'Niepoprawne hasło.' });
      }

      // ✅ SPRAWDŹ BLOKADĘ KONTA (używając REALNEGO czasu)
      if (user.blocked_until) {
        const now = new Date();
        const blockedUntilDate = new Date(user.blocked_until);

        if (now < blockedUntilDate) {
          // Ban nadal aktywny
          const timeLeft = blockedUntilDate - now;
          const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
          const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));

          const blockedUntilFormatted = blockedUntilDate.toLocaleString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });

          return res.status(403).json({
            message: 'Konto zablokowane',
            blocked: true,
            blockedUntil: blockedUntilFormatted,
            blockedUntilISO: user.blocked_until,
            daysLeft: daysLeft,
            hoursLeft: hoursLeft,
            blockReason: 'Naruszenie regulaminu'
          });
        }
      }

      proceedWithLogin();

      function proceedWithLogin() {
        const userIp = req.clientIp || 
                      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.headers['x-real-ip'] || 
                      req.socket.remoteAddress || 
                      req.connection.remoteAddress || 
                      'unknown';

        // `last_login` to znacznik SAMEGO logowania - w odróżnieniu od
        // `last_seen`, które middleware odświeża przy każdym żądaniu. Baza bez
        // migracji add-last-login.sql tej kolumny nie ma, więc przy
        // ER_BAD_FIELD_ERROR wracamy do starego zapytania (logowanie nie może
        // się wywalić przez brak kolumny statystycznej).
        const markLogin = (withLastLogin) => {
          const query = withLastLogin
            ? 'UPDATE users SET last_seen = NOW(), last_login = NOW(), last_ip = ? WHERE id = ?'
            : 'UPDATE users SET last_seen = NOW(), last_ip = ? WHERE id = ?';

          pool.query(query, [userIp, user.id], (err) => {
            if (err) {
              if (withLastLogin && err.code === 'ER_BAD_FIELD_ERROR') {
                return markLogin(false);
              }
              console.error('Błąd aktualizacji IP:', err);
            }
          });
        };

        markLogin(true);

        // ✅ POBIERZ AKTYWNĄ POSTAĆ
        pool.query(`
          SELECT id, name, avatar, race, gender, faction
          FROM characters
          WHERE user_id = ? AND is_active = 1 AND (is_deleted IS NULL OR is_deleted = 0)
          LIMIT 1
        `, [user.id], (err, characterResults) => {
          if (err) {
            console.error('❌ Błąd pobierania postaci:', err);
            // Kontynuuj logowanie bez postaci
          }

          const character = characterResults && characterResults.length > 0 ? characterResults[0] : null;

          // ✅ ROZSZERZONY TOKEN
          const token = jwt.sign(
            {
              id: user.id,
              email: user.email,
              username: user.user,
              role: user.role,
              // ✅ DANE POSTACI (null jeśli brak)
              characterId: character ? character.id : null,
              characterName: character ? character.name : null,
              characterAvatar: character ? character.avatar : null,
              characterRace: character ? character.race : null,
              characterGender: character ? character.gender : null,
              characterFaction: character ? character.faction : null
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' } // ✅ Zwiększony czas (było 4h)
          );

          // ✅ ROZSZERZONA ODPOWIEDŹ
          res.status(200).json({
            message: 'Zalogowano pomyślnie.',
            token,
            blocked: false,
            // ✅ DANE UŻYTKOWNIKA
            user: {
              id: user.id,
              username: user.user,
              email: user.email,
              role: user.role
            },
            // ✅ DANE POSTACI (jeśli istnieje)
            character: character ? {
              id: character.id,
              name: character.name,
              avatar: character.avatar,
              race: character.race,
              gender: character.gender,
              faction: character.faction
            } : null,
            // ✅ BACKWARD COMPATIBILITY (dla starego kodu)
            userId: user.id,
            userRole: user.role
          });
        });
      }
    });
  });
});

// ✅ NOWY ENDPOINT - Odświeżanie tokena
// Front woła `/api/refresh-token`, a dev-proxy obcina `^/api` - bez wariantu
// bez prefiksu odświeżanie tokena kończyło się 404, czyli wylogowaniem gracza
// na kilkanaście minut przed wygaśnięciem tokena.
router.post(['/refresh-token', '/api/refresh-token'], verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Pobierz aktualne dane użytkownika i postaci. Postać bierzemy w pierwszej
    // kolejności z BIEŻĄCEGO tokena, a dopiero w drugiej z `is_active` - inaczej
    // na koncie współdzielonym (subkonto NPC administracji) odświeżenie tokena
    // przerzuciłoby admina na postać, którą właśnie wybrał ktoś inny.
    const [users] = await pool.promise().query(`
      SELECT u.id, u.user, u.email, u.role,
             c.id as character_id, c.name as character_name, c.avatar,
             c.race, c.gender, c.faction
      FROM users u
      LEFT JOIN characters c
        ON u.id = c.user_id
       AND (c.is_deleted IS NULL OR c.is_deleted = 0)
       AND (c.id = ? OR (? IS NULL AND c.is_active = 1))
      WHERE u.id = ?
      LIMIT 1
    `, [req.user.characterId, req.user.characterId, userId]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
    }

    const user = users[0];

    // Wygeneruj nowy token
    const newToken = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.user,
        role: user.role,
        characterId: user.character_id || null,
        characterName: user.character_name || null,
        characterAvatar: user.avatar || null,
        characterRace: user.race || null,
        characterGender: user.gender || null,
        characterFaction: user.faction || null,
        // Tryb NPC przeżywa odświeżenie tokena - inaczej admin utknąłby na
        // subkoncie NPC bez przycisku powrotu na własne konto.
        ...npcTokenClaims(req.user)
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: newToken,
      user: {
        id: user.id,
        username: user.user,
        email: user.email,
        role: user.role
      },
      character: user.character_id ? {
        id: user.character_id,
        name: user.character_name,
        avatar: user.avatar,
        race: user.race,
        gender: user.gender,
        faction: user.faction
      } : null
    });
  } catch (error) {
    console.error('❌ Błąd odświeżania tokena:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// ✅ ENDPOINT LOGOUT - Wylogowanie użytkownika
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Dezaktywuj wszystkie postacie użytkownika (is_active = 0)
    await pool.promise().query(
      'UPDATE characters SET is_active = 0 WHERE user_id = ?',
      [userId]
    );

    console.log(`✅ Użytkownik ${userId} wylogowany - wszystkie postacie dezaktywowane`);

    res.status(200).json({
      message: 'Wylogowano pomyślnie.',
      success: true
    });
  } catch (error) {
    console.error('❌ Błąd podczas wylogowania:', error);
    res.status(500).json({ message: 'Błąd serwera podczas wylogowania' });
  }
});

module.exports = router;