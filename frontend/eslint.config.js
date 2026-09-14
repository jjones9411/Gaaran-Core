// ============================================================================
// Konfiguracja ESLint (format "flat config", wymagany od ESLint 9)
// ============================================================================
// `npm run lint` do tej pory w ogóle się nie uruchamiał: ESLint i wtyczki były
// w devDependencies, ale w repo nie było ŻADNEGO pliku konfiguracyjnego, więc
// komenda kończyła się błędem "ESLint couldn't find an eslint.config.(js|mjs|cjs)".
//
// Zestaw jest celowo zachowawczy - ma wyłapywać realne błędy (nieużywane
// zmienne, złamane zasady hooków), a nie zasypywać istniejący, działający kod
// tysiącami uwag o stylu. Formatowaniem zajmuje się `npm run format` (Prettier).

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    // `dist` to wynik builda, `node_modules` to cudzy kod, a `art-source`
    // trzyma same grafiki - nie ma tam czego lintować.
    ignores: ['dist/**', 'node_modules/**', 'art-source/**'],
  },
  js.configs.recommended,
  {
    // Konfiguracja builda i skrypty pomocnicze działają w Node, nie w
    // przeglądarce - mają `process`, `console`, `fetch`, `setTimeout` itd.
    files: ['rsbuild.config.mjs', 'eslint.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      // `__APP_BUILD_ID__` (wstrzykiwany przez rsbuild) NIE jest tu deklarowany
      // celowo: VersionChecker.js deklaruje go u siebie przez `/* global ... */`,
      // czyli dokładnie tam, gdzie jest używany. Podanie go również tutaj dawało
      // błąd `no-redeclare`.
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Projekt używa nowej transformacji JSX (rsbuild/pluginReact), więc
      // `import React` nie jest wymagany w każdym pliku.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // Gra nie używa PropTypes ani TypeScriptu - to świadoma decyzja, nie błąd.
      'react/prop-types': 'off',
      // Treści encyklopedii przechodzą przez `sanitizeHtml` (DOMPurify), więc
      // `dangerouslySetInnerHTML` jest tu użyciem zamierzonym i zaudytowanym.
      'react/no-danger': 'off',
      // Apostrofy i cudzysłowy w polskich tekstach są w porządku.
      'react/no-unescaped-entities': 'off',
      // Gra świadomie używa `//` jako OZDOBNEGO prefiksu nagłówków w klimacie
      // terminala (np. `// SYSTEM KOMUNIKACJI` przy 0.65rem z rozstrzeleniem
      // 0.22em). Regula czyta to jako zabłąkany komentarz w JSX, ale to
      // zamierzony element wizualny - nie ma tu czego naprawiać.
      'react/jsx-no-comment-textnodes': 'off',

      // Nieużywane zmienne warto widzieć, ale bez blokowania builda. Wzorzec
      // `_` z przodu to uzgodniony sposób na "wiem, że nieużywane".
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Zależności hooków to realne źródło błędów (nieodświeżające się dane),
      // ale w istniejącym kodzie jest ich sporo - na razie ostrzeżenie.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
