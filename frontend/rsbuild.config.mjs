import fs from 'node:fs';
import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { defineConfig } from '@rsbuild/core';
import { resolveSiteMeta, buildMetaTags } from './scripts/site-meta.mjs';

// Unikalny identyfikator buildu (znacznik czasu). Wstrzykiwany do bundla jako
// process.env.APP_BUILD_ID i zapisywany do dist/version.json. Klient (VersionChecker)
// porównuje jedno z drugim i gdy się różnią, wie że wyszła nowa wersja frontu.
const BUILD_ID = Date.now().toString();

// Po zbudowaniu zapisz dist/version.json z aktualnym BUILD_ID. To nowy plik -
// nie nadpisuje niczego istniejącego (np. Twojego .htaccess).
const emitBuildMetaPlugin = {
  name: 'emit-build-meta',
  setup(api) {
    api.onAfterBuild(() => {
      try {
        const distPath = api.context?.distPath || path.resolve(process.cwd(), 'dist');
        fs.mkdirSync(distPath, { recursive: true });
        fs.writeFileSync(
          path.join(distPath, 'version.json'),
          `${JSON.stringify({ buildId: BUILD_ID })}\n`,
        );
      } catch (e) {
        console.warn('emit-build-meta: nie udało się zapisać version.json:', e);
      }
    });
  },
};

// Metadane strony wyliczamy asynchronicznie (kreator/API), stąd konfiguracja
// jako funkcja - rsbuild czeka na wynik przed startem builda.
export default defineConfig(async () => {
  const siteMeta = await resolveSiteMeta();

  if (siteMeta.isPlaceholder) {
    console.warn(
      '[site-meta] Nie udało się ustalić nazwy gry - w <title> i Open Graph zostaje "[NAZWA_GRY]".\n' +
        '            Ustaw GAME_NAME (albo uruchom backend pod FRONTEND_URL) przed `npm run build`,\n' +
        '            inaczej podgląd linku w Messengerze/Telegramie pokaże placeholder.',
    );
  } else {
    console.log(`[site-meta] Tytuł strony i Open Graph: "${siteMeta.gameName}"`);
  }

  return {
    plugins: [pluginReact(), emitBuildMetaPlugin],
    source: {
      // UWAGA: definiujemy własny, osobny token (nie 'process.env.*'), żeby nie
      // zaburzyć wbudowanej podmiany process.env.NODE_ENV (inaczej w bundlu leci
      // "process is not defined").
      define: {
        __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
      },
    },
    html: {
      // Prawdziwa nazwa gry (a nie placeholder) musi być w statycznym HTML-u -
      // crawlery od podglądów linków nie odpalają JS, więc document.title
      // ustawiany w App.js jest dla nich niewidoczny.
      title: siteMeta.gameName,
      meta: buildMetaTags(siteMeta),
      favicon: './public/favicon.png'
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          pathRewrite: { '^/api': '' },
        },
        '/vampires': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/werewolves': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/mag': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/infos': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/infos2': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/bestiary': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/npc': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/drugs': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/technology': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/mechanics': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/law': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/rules': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/news': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
