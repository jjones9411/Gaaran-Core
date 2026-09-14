const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const pool = require('../config/database');

// POST /api/forgot-password
router.post('/forgot-password', (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9);
  const { email } = req.body;

  if (!email) {
    console.warn(`⚠️ [${requestId}] Brak adresu e-mail w żądaniu resetu hasła.`);
    return res.status(400).json({ message: 'Podaj adres e-mail' });
  }

  pool.query('SELECT email FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error(`❌ [${requestId}] Błąd zapytania do bazy:`, err);
      return res.status(500).json({ message: 'Błąd serwera - baza danych' });
    }

    if (results.length === 0) {
      console.warn(`⚠️ [${requestId}] Nie znaleziono użytkownika o e-mailu: ${email}`);
      return res.status(400).json({ message: 'Nie znaleziono użytkownika' });
    }


    let token;
    try {
      token = crypto.randomBytes(20).toString('hex');
    } catch (err) {
      console.error(`❌ [${requestId}] Błąd generowania tokenu:`, err);
      return res.status(500).json({ message: 'Błąd serwera - generowanie tokenu' });
    }

    pool.query('SELECT reset_token, reset_expires FROM users WHERE email = ?', [email], (err, existingTokens) => {
      if (!err && existingTokens.length > 0) {
        // Token już istnieje
      }

      pool.query(
        'UPDATE users SET reset_token = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE email = ?',
        [token, email],
        (err, updateResult) => {
          if (err) {
            console.error(`❌ [${requestId}] Błąd zapisu tokenu do bazy:`, err);
            return res.status(500).json({ message: 'Błąd serwera - zapis tokenu' });
          }

          pool.query('SELECT reset_token, reset_expires FROM users WHERE email = ?', [email], (err, savedToken) => {
            if (!err && savedToken.length > 0) {
              // Token zapisany
            }
          });

          const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/newpassword/${token}`;

          if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.SMTP_HOST || !process.env.SMTP_PORT) {
            console.error(`❌ [${requestId}] Brak konfiguracji SMTP w pliku .env!`);
            return res.status(500).json({ message: 'Błąd serwera - konfiguracja SMTP' });
          }

          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          });

          const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: email,
            subject: 'Resetowanie hasła',
            html: `<p>Kliknij w poniższy link, aby zresetować hasło:</p>
                   <a href="${resetLink}">Resetuj hasło</a>
                   <p><small>Token: ${token}</small></p>`
          };


          transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
              console.error(`❌ [${requestId}] Błąd wysyłania e-maila:`, err);
              return res.status(500).json({ message: 'Błąd serwera - wysyłka e-maila' });
            }
            
            res.status(200).json({ message: 'Link do resetu hasła został wysłany' });
          });
        }
      );
    });
  });
});

// POST /api/reset-password
router.post('/reset-password', (req, res) => {
  const { email, token, password } = req.body;
  const requestId = Math.random().toString(36).substr(2, 9);

  if (!email || !token || !password) {
    console.warn(`⚠️ [${requestId}] Brak wymaganych danych do resetu hasła`);
    return res.status(400).json({ message: 'Email, token i nowe hasło są wymagane.' });
  }

  pool.query(
    'SELECT email FROM users WHERE email = ? AND reset_token = ? AND reset_expires > NOW()',
    [email, token],
    (err, results) => {
      if (err) {
        console.error(`❌ [${requestId}] Błąd zapytania do bazy przy resecie:`, err);
        return res.status(500).json({ message: 'Błąd serwera - baza danych' });
      }
      
      
      if (results.length === 0) {
        console.warn(`⚠️ [${requestId}] Nieprawidłowy lub wygasły token dla: ${email}`);
        return res.status(400).json({ message: 'Nieprawidłowy lub wygasły token' });
      }


      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          console.error(`❌ [${requestId}] Błąd hashowania hasła:`, err);
          return res.status(500).json({ message: 'Błąd serwera - hashowanie' });
        }

        pool.query(
          'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?',
          [hashedPassword, email],
          (err) => {
            if (err) {
              console.error(`❌ [${requestId}] Błąd zapisu nowego hasła:`, err);
              return res.status(500).json({ message: 'Błąd serwera - zapis hasła' });
            }

            res.status(200).json({ message: 'Hasło zostało zmienione' });
          }
        );
      });
    }
  );
});

// POST /api/newpassword/:token
router.post('/newpassword/:token', (req, res) => {
  const { token } = req.params;
  const requestId = Math.random().toString(36).substr(2, 9);

  if (!token) {
    console.warn(`⚠️ [${requestId}] Brak tokena w żądaniu`);
    return res.status(400).json({ message: 'Token jest wymagany' });
  }

  pool.query('SELECT email, reset_token, reset_expires FROM users WHERE reset_token IS NOT NULL', [], (err, allTokens) => {
    if (!err) {
      // Debug
    }

    pool.query(
      'SELECT email FROM users WHERE reset_token = ? AND reset_expires > NOW()', 
      [token], 
      (err, results) => {
        if (err) {
          console.error(`❌ [${requestId}] Błąd zapytania do bazy przy sprawdzaniu tokena:`, err);
          return res.status(500).json({ message: 'Błąd serwera - baza danych' });
        }
        
        
        if (results.length === 0) {
          console.warn(`⚠️ [${requestId}] Nieprawidłowy lub wygasły token resetu: ${token}`);
          return res.status(400).json({ message: 'Nieprawidłowy lub wygasły token' });
        }

        
        res.status(200).json({ 
          message: 'Token poprawny', 
          email: results[0].email 
        });
      }
    );
  });
});

module.exports = router;