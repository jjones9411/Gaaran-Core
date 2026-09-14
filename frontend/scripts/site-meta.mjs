// ================================
// scripts/site-meta.mjs
// Ustala metadane strony (nazwa gry, opis, adres, obrazek) NA CZAS BUDOWANIA
// frontu, żeby trafiły do statycznego <head> w dist/index.html.
//
// Po co: crawlery generujące podglądy linków (Messenger, Telegram, Discord,
// WhatsApp, Signal) NIE uruchamiają JavaScriptu. Widzą tylko surowy HTML, więc
// runtime'owe ustawianie document.title w App.js ich nie dotyczy - dostawali
// placeholder "[NAZWA_GRY]" z szablonu. Tutaj wyliczamy prawdziwe wartości i
// wstrzykujemy je do HTML-a (title + Open Graph + Twitter Card).
//
// Kolejność źródeł (pierwsze trafione wygrywa):
//   1. zmienna środowiskowa GAME_NAME (jawne nadpisanie przy buildzie)
//   2. działające API /api/game-info (źródło prawdy - kolumna game_config.game_name)
//   3. GAME_NAME zapisane w backend/.env przez kreator instalacyjny
//   4. placeholder '[NAZWA_GRY]' (czysty szablon, przed instalacją)
// ================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Pliki .env przeszukiwane od najważniejszego. frontend/.env jest tu dlatego,
// że front często buduje się na innej maszynie niż ta, na której leży
// backend/.env (build lokalnie -> wgranie dist na hosting statyczny).
const ENV_FILES = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../backend/.env'),
];

export const GAME_NAME_PLACEHOLDER = '[NAZWA_GRY]';

// Minimalny parser .env - nie chcemy ciągnąć dotenv do zależności frontu.
function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

// Scalenie plików: wcześniejszy z listy wygrywa, puste wartości nie przykrywają
// wypełnionych (np. puste GAME_DESCRIPTION= w frontend/.env).
function readEnvFiles() {
  const merged = {};
  for (const filePath of ENV_FILES) {
    for (const [key, value] of Object.entries(parseEnvFile(filePath))) {
      if (!merged[key] && value) merged[key] = value;
    }
  }
  return merged;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '');
}

function toAbsoluteUrl(src, baseUrl) {
  if (!src) return '';
  if (/^https?:\/\//i.test(src)) return src;
  if (!baseUrl) return '';
  return `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
}

// Odpytanie działającego backendu o nazwę gry. Build nie może się o to wywrócić
// (backend bywa wyłączony albo budujemy lokalnie), więc krótki timeout i cisza
// przy każdym błędzie - lecimy dalej na kolejnym źródle.
async function fetchGameNameFromApi(baseUrl) {
  if (!baseUrl) return '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${baseUrl}/api/game-info`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return clean(data?.gameName);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveSiteMeta() {
  const fileEnv = readEnvFiles();
  const pick = key => clean(process.env[key]) || clean(fileEnv[key]);

  // Adres publiczny gry - z GAME_URL albo z FRONTEND_URL zapisanego przez kreator.
  const siteUrl = stripTrailingSlash(pick('GAME_URL') || pick('FRONTEND_URL'));
  // Skąd pytać o nazwę gry: GAME_INFO_URL (gdy API stoi pod innym adresem) lub adres gry.
  const apiBase = stripTrailingSlash(pick('GAME_INFO_URL')) || siteUrl;

  const explicitName = clean(process.env.GAME_NAME);
  const gameName =
    explicitName ||
    (await fetchGameNameFromApi(apiBase)) ||
    clean(fileEnv.GAME_NAME) ||
    GAME_NAME_PLACEHOLDER;

  const description = pick('GAME_DESCRIPTION');
  const customImage = pick('GAME_OG_IMAGE');
  // Domyślnie favicon (1024x1024) - kwadratowy podgląd zamiast pustej ramki.
  // Bez własnej grafiki podglądu link nie dostaje obrazka - i dobrze:
  // silnik nie wozi ze sobą żadnych plików graficznych. Ustaw GAME_OG_IMAGE,
  // jeśli chcesz mieć miniaturę w podglądach linków.
  const image = customImage ? toAbsoluteUrl(customImage, siteUrl) : '';

  return {
    gameName,
    isPlaceholder: gameName === GAME_NAME_PLACEHOLDER,
    description,
    siteUrl,
    image,
    // Duży obrazek na Twitterze/X tylko gdy ktoś podał własną grafikę - favicon
    // rozciągnięty na baner wygląda źle.
    largeImageCard: Boolean(customImage),
  };
}

// Znaczniki <meta> dla rsbuild (html.meta). Wartości pustych nie emitujemy.
export function buildMetaTags(meta) {
  const tags = {};

  if (meta.description) {
    tags.description = meta.description;
    tags['og:description'] = { property: 'og:description', content: meta.description };
    tags['twitter:description'] = { name: 'twitter:description', content: meta.description };
  }

  tags['og:type'] = { property: 'og:type', content: 'website' };
  tags['og:locale'] = { property: 'og:locale', content: 'pl_PL' };
  tags['og:title'] = { property: 'og:title', content: meta.gameName };
  tags['og:site_name'] = { property: 'og:site_name', content: meta.gameName };
  tags['twitter:title'] = { name: 'twitter:title', content: meta.gameName };
  tags['twitter:card'] = {
    name: 'twitter:card',
    content: meta.largeImageCard ? 'summary_large_image' : 'summary',
  };

  if (meta.siteUrl) {
    tags['og:url'] = { property: 'og:url', content: meta.siteUrl };
  }
  if (meta.image) {
    tags['og:image'] = { property: 'og:image', content: meta.image };
    tags['twitter:image'] = { name: 'twitter:image', content: meta.image };
  }

  return tags;
}
