// ============================================================
// bugLogger - centralne zbieranie błędów backendu do tabeli bug_logs.
// Zasilany na trzy sposoby:
//   1. przechwycenie console.error (większość handlerów loguje tak błędy),
//   2. globalny error handler Express (rzucone / przekazane next(err)),
//   3. process 'uncaughtException' / 'unhandledRejection'.
// Błędy autoryzacji (token / JWT / uprawnienia) są celowo pomijane, żeby
// Bugtrack nie zapychał się nieudanymi logowaniami.
// ============================================================

const { AsyncLocalStorage } = require('async_hooks');

let pool = null;
const als = new AsyncLocalStorage();

// Oryginalny console.error - trzymamy referencję, żeby nadal pisać do stdout/pm2.
// Wszystkie wewnętrzne komunikaty bugLoggera piszemy WYŁĄCZNIE przez tę
// referencję (nigdy przez podmieniony console.error), więc zapis błędu nie
// może wywołać samego siebie - nie potrzebujemy dodatkowej flagi anty-rekurencji.
const originalConsoleError = console.error.bind(console);

// Wzorzec błędów autoryzacji - pomijamy je w logach.
const AUTH_NOISE = /(token|jwt|autoryzac|uprawnien|authorization|nieprawidłowy token|brak nagłówka)/i;

function initialize(dependencies) {
  pool = dependencies.pool;
}

function truncate(value, max) {
  if (value === null || value === undefined) return null;
  const str = String(value);
  return str.length > max ? str.slice(0, max) : str;
}

function stringifyArg(arg) {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch (e) {
    return String(arg);
  }
}

// Wyciąga tytuł z pierwszej linijki komunikatu (bez emoji na początku).
function deriveTitle(message) {
  const firstLine = String(message).split('\n')[0].trim();
  const cleaned = firstLine.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return truncate(cleaned || 'Błąd backendu', 255);
}

// Główna funkcja zapisu. Zwraca cicho, jeśli brak poola albo błąd autoryzacji.
function logError(payload = {}) {
  if (!pool) return;

  const store = als.getStore();
  const req = store && store.req;

  const errorMessage = payload.errorMessage || payload.message || 'Nieznany błąd';

  // Pomiń szum autoryzacji.
  if (AUTH_NOISE.test(errorMessage)) return;

  const bugType = payload.bugType || 'backend';
  const severity = payload.severity || 'medium';
  const status = payload.status || 'open';
  const title = payload.title || deriveTitle(errorMessage);
  const stackTrace = payload.stackTrace || null;
  const description = payload.description || null;
  const url =
    payload.url || (req ? `${req.method} ${req.originalUrl}` : null);
  const browserInfo =
    payload.browserInfo || (req ? req.headers['user-agent'] : null) || null;
  const reportedBy =
    payload.reportedBy !== undefined
      ? payload.reportedBy
      : req && req.user
      ? req.user.id
      : null;

  try {
    pool.query(
      `INSERT INTO bug_logs
        (title, description, error_message, stack_trace, severity, status, bug_type, url, browser_info, reported_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        truncate(title, 255),
        truncate(description, 5000),
        truncate(errorMessage, 5000),
        truncate(stackTrace, 8000),
        severity,
        status,
        bugType,
        truncate(url, 500),
        truncate(browserInfo, 1000),
        reportedBy,
      ],
      (err) => {
        if (err) {
          originalConsoleError('❌ bugLogger: nie udało się zapisać błędu:', err.message);
        }
      }
    );
  } catch (e) {
    originalConsoleError('❌ bugLogger: wyjątek podczas zapisu:', e.message);
  }
}

// Middleware: przechowuje bieżący req w kontekście, żeby logError mógł dołączyć
// endpoint / user-agent / użytkownika do błędów przechwyconych z console.error.
function requestContext(req, res, next) {
  als.run({ req }, () => next());
}

// ------------------------------------------------------------------
// Zachowanie kontekstu żądania w callbackach mysql2.
//
// Callbacki puli mysql2 są wywoływane z handlera 'data' gniazda TCP, a to
// gniazdo powstało w kontekście przypadkowego (pierwszego) żądania, które
// wymusiło otwarcie połączenia. Efekt: als.getStore() w callbacku zwracał req
// OBCEGO żądania, więc błędy logowane z callbacków (a tak loguje większość
// handlerów) trafiały do Bugtracka z cudzym endpointem, user-agentem i
// reported_by - typowo z często odpytywanego GET-a w rodzaju
// /user/content-width. Poniżej przywracamy store z momentu wywołania query.
//
// Zapytania spoza żądania (cron, start serwera) nie mają store i lecą bez
// zmian. Wariant promise (pool.promise().query / await) nie wymaga łatki -
// await sam przenosi kontekst.
// ------------------------------------------------------------------
function bindToCurrentContext(callback) {
  const store = als.getStore();
  if (!store) return callback;
  return function (...args) {
    return als.run(store, () => callback.apply(this, args));
  };
}

function preserveRequestContext(dbPool) {
  if (!dbPool || dbPool.__bugLoggerContextPatched) return dbPool;

  ['query', 'execute'].forEach((method) => {
    const original = dbPool[method];
    if (typeof original !== 'function') return;

    dbPool[method] = function (...args) {
      const lastIndex = args.length - 1;
      if (lastIndex >= 0 && typeof args[lastIndex] === 'function') {
        args[lastIndex] = bindToCurrentContext(args[lastIndex]);
      }
      return original.apply(this, args);
    };
  });

  dbPool.__bugLoggerContextPatched = true;
  return dbPool;
}

// Podmienia console.error tak, by dodatkowo zapisywał błąd do bug_logs.
function installConsoleCapture() {
  console.error = (...args) => {
    originalConsoleError(...args);
    try {
      const message = args.map(stringifyArg).join(' ');
      const errorArg = args.find((a) => a instanceof Error);
      logError({
        errorMessage: message,
        stackTrace: errorArg ? errorArg.stack : null,
        bugType: 'backend',
        severity: 'medium',
      });
    } catch (e) {
      // Nigdy nie pozwól, żeby logowanie wywróciło aplikację.
    }
  };
}

// Globalny error handler Express (4 argumenty). Rejestrować PO wszystkich trasach.
function errorHandler(err, req, res, next) {
  logError({
    errorMessage: err.message || 'Nieobsłużony wyjątek',
    stackTrace: err.stack,
    bugType: 'backend',
    severity: 'high',
  });
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Błąd serwera' });
}

// Rejestruje przechwytywanie błędów na poziomie procesu.
function installProcessHandlers() {
  process.on('uncaughtException', (err) => {
    logError({
      errorMessage: err.message || 'uncaughtException',
      stackTrace: err.stack,
      bugType: 'backend',
      severity: 'critical',
    });
    originalConsoleError('❌ uncaughtException:', err);
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logError({
      errorMessage: err.message || 'unhandledRejection',
      stackTrace: err.stack,
      bugType: 'backend',
      severity: 'critical',
    });
    originalConsoleError('❌ unhandledRejection:', reason);
  });
}

module.exports = {
  initialize,
  logError,
  requestContext,
  preserveRequestContext,
  installConsoleCapture,
  installProcessHandlers,
  errorHandler,
};
