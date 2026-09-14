// ================================
// routes/publicFeed.js
// Publiczne API dla zewnętrznych serwisów/portali (agregacja newsów i statystyk).
// Zwraca dane w formacie JSON oraz RSS 2.0 - bez autoryzacji (router montowany
// PRZED middleware verifyToken w server.js), zgodnie z wymaganiem portalu, że
// endpoint musi być dostępny publicznie.
// ================================

const express = require('express');
const router = express.Router();
const { getGameName } = require('./gameInfo');

let pool;

function initialize(dependencies) {
  pool = dependencies.pool;
}

// Publiczny adres gry (do pola game.url oraz linków w RSS). Bierzemy z FRONTEND_URL
// (ustawianego w .env przez kreator instalacyjny). Bez końcowego ukośnika.
function getBaseUrl() {
  const raw = (process.env.FRONTEND_URL || '').trim();
  return raw ? raw.replace(/\/+$/, '') : '';
}

// Zamień względny adres obrazka (np. "/api/uploads/...") na pełny URL, żeby portal
// mógł go wyświetlić. Data-URI oraz gotowe http(s) zostawiamy bez zmian.
function toAbsoluteUrl(src, baseUrl) {
  if (!src) return null;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return src;
  if (!baseUrl) return src;
  return `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
}

// Opis gry i tagi - brak dedykowanych kolumn w game_config, więc dajemy możliwość
// nadpisania przez .env, a w razie braku sensowny fallback.
function getGameDescription(gameName) {
  const envDesc = (process.env.GAME_DESCRIPTION || '').trim();
  if (envDesc) return envDesc;
  return gameName && gameName !== '[NAZWA_GRY]' ? gameName : '[OPIS_GRY]';
}

function getGameTags() {
  const envTags = (process.env.GAME_TAGS || '').trim();
  if (envTags) {
    const parsed = envTags.split(',').map(t => t.trim()).filter(Boolean);
    if (parsed.length) return parsed;
  }
  return ['rpg', 'fantasy', 'tekstówka', 'mmorpg'];
}

function extractCoverImage(html, baseUrl) {
  const imgMatch = html?.match(/<img[^>]+src="([^">]+)"/);
  if (imgMatch && imgMatch[1]) {
    return toAbsoluteUrl(imgMatch[1], baseUrl);
  }
  return null;
}

// GET: Publiczny feed w formacie JSON
// Zwraca dane o grze + wieści widoczne dla wszystkich
router.get('/feed', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();

    // Pobierz statystyki graczy
    const [registeredCount] = await pool.promise().query(
      'SELECT COUNT(*) as count FROM users'
    );

    const [onlineCount] = await pool.promise().query(
      'SELECT COUNT(*) as count FROM users WHERE last_seen > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'
    );

    // Pobierz wieści widoczne dla wszystkich (visible_to IS NULL lub pusta tablica)
    const [newsResults] = await pool.promise().query(`
      SELECT
        title,
        content as description,
        created_at as pubDate
      FROM news
      WHERE archived = FALSE
        AND (visible_to IS NULL OR visible_to = '[]')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const gameName = await getGameName(pool);

    // Formatuj dane zgodnie z wymaganym schematem
    const response = {
      game: {
        title: gameName,
        url: baseUrl || '[ADRES_STRONY]',
        description: getGameDescription(gameName),
        tags: getGameTags(),
        stats: {
          registered: registeredCount[0]?.count || 0,
          online: onlineCount[0]?.count || 0
        }
      },
      news: newsResults.map(news => ({
        title: news.title || 'Bez tytułu',
        pubDate: news.pubDate ? new Date(news.pubDate).toISOString().replace('T', ' ').substring(0, 19) : null,
        description: news.description || '',
        coverImage: extractCoverImage(news.description, baseUrl)
      }))
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Błąd pobierania publicznego feed:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET: Publiczny feed w formacie RSS 2.0
router.get('/feed/rss', async (req, res) => {
  try {
    const baseUrl = getBaseUrl();
    const link = baseUrl || '[ADRES_STRONY]';

    // Pobierz wieści widoczne dla wszystkich
    const [newsResults] = await pool.promise().query(`
      SELECT
        title,
        content as description,
        created_at as pubDate
      FROM news
      WHERE archived = FALSE
        AND (visible_to IS NULL OR visible_to = '[]')
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const gameName = await getGameName(pool);
    const channelDescription = getGameDescription(gameName)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Generuj RSS 2.0
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${(gameName || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    <link>${link}</link>
    <description>${channelDescription}</description>
    <language>pl</language>
    <atom:link href="${link}/api/public/feed/rss" rel="self" type="application/rss+xml"/>
`;

    newsResults.forEach(news => {
      const title = (news.title || 'Bez tytułu').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const description = (news.description || '').replace(/&/g, '&amp;');
      const pubDate = news.pubDate ? new Date(news.pubDate).toUTCString() : new Date().toUTCString();

      // Wyciągnij obrazek z HTML (opcjonalnie), pełny URL
      const absImage = extractCoverImage(news.description, baseUrl);
      const imageUrl = absImage ? absImage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : null;

      rss += `
    <item>
      <title>${title}</title>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>`;

      if (imageUrl) {
        rss += `
      <enclosure url="${imageUrl}" type="image/jpeg"/>`;
      }

      rss += `
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.status(200).send(rss);
  } catch (error) {
    console.error('❌ Błąd generowania RSS feed:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Błąd serwera</error>');
  }
});

module.exports = { router, initialize };
