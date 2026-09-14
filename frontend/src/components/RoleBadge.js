import React from 'react';
import { Tooltip, Box } from '@mui/material';
import { formatRoleForDisplay } from './AuthContext';

// ===========================================================================
// ODZNAKA RANGI - mała insygnia przy awatarze na liście online
// ===========================================================================
// Zwykły `mieszkaniec` NIE dostaje odznaki: gdyby każdy coś nosił, insygnia
// przestałyby cokolwiek znaczyć. Odznakę mają tylko rangi wyróżnione.
//
// Nośnikiem informacji jest KSZTAŁT, nie kolor. Cztery sylwetki (korona,
// księga, kufel, medal) są jednoznaczne nawet przy 12 px i bez rozróżniania
// barw; kolory są zbliżone jasnością (7-10:1 na czerni), więc same nie
// wystarczyłyby dla osoby nierozróżniającej barw. Dlatego każda odznaka ma
// dodatkowo tooltip z nazwą rangi i `aria-label`.
//
// Ikony są rysowane inline, a nie brane z @mui/icons-material, z dwóch
// powodów: MUI nie ma korony, a mieszanie jednej ręcznej ikony z trzema
// materialowymi dałoby zestaw niespójny stylistycznie. Te cztery są
// wektorowane w jednym, kanciastym duchu resztą UI (narożniki bez zaokrągleń,
// jak PlayerStatusIndicator i ramki awatarów).

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3.2 17.4h17.6V21H3.2zM3.2 15.9V6.2l4.4 4.9L12 4l4.4 7.1 4.4-4.9v9.7z" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.1 6.2C9.1 4.7 6.3 4 3 4v13.6c3.3 0 6.1.7 8.1 2.2zM12.9 6.2C14.9 4.7 17.7 4 21 4v13.6c-3.3 0-6.1.7-8.1 2.2z" />
  </svg>
);

const MugIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {/* piana */}
    <path d="M3.4 8.1c0-2 1.6-3.3 3.5-3.3.8 0 1.5.2 2 .6.6-.6 1.5-1 2.4-1 1.1 0 2.1.5 2.7 1.3.4-.2.9-.3 1.4-.3 1.6 0 2.8 1.1 2.8 2.7z" />
    {/* korpus */}
    <path d="M3.6 9.6h11.6V21H6.4a2.8 2.8 0 0 1-2.8-2.8z" />
    {/* ucho */}
    <path d="M16.8 11.2h1.9a2.5 2.5 0 0 1 2.5 2.5v2.6a2.5 2.5 0 0 1-2.5 2.5h-1.9v-1.9h1.7c.5 0 .8-.3.8-.8v-2.2c0-.5-.3-.8-.8-.8h-1.7z" />
  </svg>
);

const MedalIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {/* Wstążka jako szeroka trapezowa taśma, nie dwa cienkie paski - przy 15 px
        para wąskich rzemieni zlewała się w kształt litery "V". */}
    <path d="M7 2h10l-2.6 6.3H9.6z" />
    {/* krążek z wyciętą gwiazdą */}
    <path d="M12 9.2a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8m0 2.5 1.35 2.6 2.9.4-2.15 2 .55 2.85L12 20.9l-2.65-1.35.55-2.85-2.15-2 2.9-.4z" />
  </svg>
);

// Kolory dobrane z myślą o widoczności na ciemnym tle awatara (kontrast na
// czerni: złoto 10.4, srebro 8.9, miedź 6.6, oliwka 7.4) i o tym, żeby nie
// zderzały się z semantyką kolorów gry - czerwień/zieleń statusu gracza są
// zajęte przez PlayerStatusIndicator, więc odznaki trzymają się metali.
const ROLE_BADGES = {
  admin:      { color: '#d9b866', Icon: CrownIcon, hint: 'złota korona' },       // złoto
  mistrz_gry: { color: '#9fb0c4', Icon: BookIcon,  hint: 'księga' },             // srebro
  karczmarz:  { color: '#c9873f', Icon: MugIcon,   hint: 'kufel' },              // miedź
  zasluzony:  { color: '#93a56e', Icon: MedalIcon, hint: 'medal za wkład w grę' }, // laur
};

export const hasRoleBadge = (role) => Boolean(ROLE_BADGES[role]);

/**
 * Kolor rangi (złoto/srebro/miedź/laur) do użycia POZA samą odznaką - np. przy
 * podpisie rangi na liście postaci. Trzymamy to tutaj, żeby lista i awatary na
 * liście online nie rozjechały się kolorystycznie przy zmianie palety.
 * Zwykły `mieszkaniec` nie ma własnego koloru (null = neutralny stalowy).
 * @param {string} role
 * @returns {string|null}
 */
export const getRoleAccent = (role) => ROLE_BADGES[role]?.color || null;

/**
 * @param {string}  role      ranga konta ('admin' | 'mistrz_gry' | 'karczmarz' | 'zasluzony')
 * @param {string}  size      'small' (lista) | 'large' (portret w karcie hover)
 * @param {boolean} overlay   true = pozycjonowana w narożniku awatara,
 *                            false = zwykły element w linii (np. obok nazwy)
 */
const RoleBadge = React.memo(({ role, size = 'small', overlay = true }) => {
  const badge = ROLE_BADGES[role];
  if (!badge) return null;

  const { color, Icon, hint } = badge;
  const box = size === 'large' ? 26 : 15;
  const pad = size === 'large' ? 4 : 2.2;
  const roleName = formatRoleForDisplay(role);

  return (
    <Tooltip title={`${roleName} — ${hint}`} arrow placement="top">
      <Box
        aria-label={roleName}
        sx={{
          // Prawy GÓRNY narożnik - lewy dolny zajmuje PlayerStatusIndicator
          // (bottom/right), więc odznaka nigdy go nie zasłoni.
          ...(overlay ? { position: 'absolute', top: 0, right: 0, zIndex: 2 } : {}),
          width: box,
          height: box,
          p: `${pad}px`,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0',
          color,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          border: `1px solid ${color}`,
          boxShadow: `0 0 8px ${color}70`,
          cursor: 'help',
          '& svg': { width: '100%', height: '100%', display: 'block' },
        }}
      >
        <Icon />
      </Box>
    </Tooltip>
  );
});

// Nazwa do React DevTools - bez tego komponenty owiniete w React.memo
// pokazuja sie jako "Anonymous" i nie da sie ich znalezc w drzewie.
RoleBadge.displayName = 'RoleBadge';

export default RoleBadge;
