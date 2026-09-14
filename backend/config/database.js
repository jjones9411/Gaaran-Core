const mysql = require('mysql2');
const bugLogger = require('../utils/bugLogger');

// Rozmiar puli i kolejki - do przestrojenia bez wgrywania kodu.
// `connectionLimit` musi się mieścić w `max_connections` serwera MySQL
// (domyślnie 151); 25 zostawia zapas na inne procesy i na konsolę admina.
const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 25),
  // `queueLimit: 0` = kolejka BEZ GRANIC. Przy zalewie żądań (albo jednym
  // zapytaniu, które się zawiesiło) rosła w nieskończoność: pamięć procesu
  // szła w górę, a gracze dostawali odpowiedzi po minutach zamiast błędu.
  // Ograniczona kolejka sprawia, że nadmiar odpada od razu - serwer zostaje
  // responsywny dla tych, którzy się zmieścili.
  queueLimit: toInt(process.env.DB_QUEUE_LIMIT, 200),
  // Zerwane połączenia (restart MySQL, timeout NAT-a) mają być wykrywane,
  // a nie wisieć w puli jako martwe.
  enableKeepAlive: true,
  keepAliveInitialDelay: 30 * 1000
});

// Callbacki puli mysql2 gubią kontekst żądania (AsyncLocalStorage), przez co
// bugLogger podpisywał błędy endpointem przypadkowego, obcego requestu.
bugLogger.preserveRequestContext(pool);

// Testowe połączenie
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Błąd połączenia z MySQL:', err.stack);
    return;
  }
  connection.release();
});

module.exports = pool;