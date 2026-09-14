import { useEffect, useMemo, useState } from 'react';
import {
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Button,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Search, Visibility, VisibilityOff } from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { decodeJwtPayload, formatRoleForDisplay } from './AuthContext';
import { appColors, getRaceColorSet } from './theme';
import { PanelPage, PanelHeader, panelSectionSx } from './PanelUI';
import RoleBadge, { getRoleAccent } from './RoleBadge';

// ===========================================================================
// KARTOTEKA POSTACI (/home/players)
// ===========================================================================
// Strona chodziła jeszcze na domyślnym, wyśrodkowanym Container/Paper MUI z
// zaokrąglonymi rogami - obok reszty gry (PanelUI: kanciaste ramki, kapitaliki,
// akcent rasy po lewej krawędzi) wyglądała jak wklejka z innej aplikacji.
// Teraz korzysta z tego samego szkieletu co strony-encyklopedie.
//
// Lista niesie DWIE role, których wcześniej tu nie było, bo gracze mylili je
// ze sobą:
//   * rola fabularna (`characters.narrative_role`) - funkcja postaci w świecie,
//     nadawana z ręki przez administrację, czysto fabularna,
//   * ranga konta (`users.role`) - mieszkaniec / zasłużony / karczmarz /
//     mistrz gry / administrator, czyli uprawnienia POZA fikcją.
// Trzymamy je w osobnych kolumnach i w innej typografii (kursywa vs. odznaka),
// żeby nie dało się wziąć "Kapłana Zapomnianych" za rangę w grze.
//
// Przydomek (`characters.epithet`) - nadawany tak samo z ręki, przez admina lub
// mistrza gry - jedzie jako podpis pod nazwą postaci, a nie w osobnej kolumnie:
// czyta się go razem z imieniem ("Vargen «Bez Twarzy»"), a tabela zostaje wąska.

// Progi "świeżości" ostatniego logowania. Kolor jest tu tylko wzmocnieniem -
// obok zawsze stoi tekst ("3 dni temu"), więc informacja nie ginie u osoby
// nierozróżniającej barw.
const ACTIVITY_TIERS = [
  { maxHours: 24, color: appColors.statusSuccess, label: 'ostatnia doba' },
  { maxHours: 24 * 7, color: appColors.textPrimary, label: 'ostatni tydzień' },
  { maxHours: 24 * 30, color: appColors.statusWarning, label: 'ostatni miesiąc' },
  { maxHours: Infinity, color: appColors.dangerText, label: 'ponad miesiąc temu' },
];

const activityTier = (isoString) => {
  if (!isoString) return null;
  const ms = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(ms)) return null;
  const hours = ms / (1000 * 60 * 60);
  return ACTIVITY_TIERS.find((tier) => hours < tier.maxHours) || ACTIVITY_TIERS[ACTIVITY_TIERS.length - 1];
};

const formatRelative = (isoString) => {
  if (!isoString) return '';
  const ms = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(ms)) return '';
  if (ms < 0) return 'przed chwilą';

  const minutes = Math.floor(ms / (1000 * 60));
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;

  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} ${days === 1 ? 'dzień' : 'dni'} temu`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mies. temu`;

  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'rok' : 'lat'} temu`;
};

const formatDate = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Krótki znacznik do KOMÓRKI tabeli (pełna data + godzina siedzi w tooltipie) -
// pełny format rozpychał kolumnę logowania poza szerokość panelu.
const formatShortDateTime = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateTime = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Wspólny rytm nagłówka tabeli: kapitaliki, rozstrzelone, stalowy kolor.
const headCellSx = {
  color: appColors.steelLighter,
  fontWeight: 'bold',
  fontSize: '0.72rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${appColors.borderSteel}`,
  py: 1.25,
  px: 1.25,
};

const bodyCellSx = {
  color: appColors.textPrimary,
  borderBottom: `1px solid ${appColors.borderSteel}55`,
  py: 1.25,
  px: 1.25,
};

const SortableHead = ({ id, label, hint, sortBy, sortDir, onSort, align = 'left', sx = {} }) => {
  const control = (
    <TableSortLabel
      active={sortBy === id}
      direction={sortBy === id ? sortDir : 'asc'}
      onClick={() => onSort(id)}
      sx={{
        color: 'inherit',
        '&.Mui-active': { color: appColors.textLight },
        '&:hover': { color: appColors.textLight },
        '& .MuiTableSortLabel-icon': { color: 'inherit !important', opacity: sortBy === id ? 1 : 0.35 },
      }}
    >
      {label}
    </TableSortLabel>
  );

  return (
    <TableCell align={align} sortDirection={sortBy === id ? sortDir : false} sx={{ ...headCellSx, ...sx }}>
      {hint ? <Tooltip title={hint} arrow>{control}</Tooltip> : control}
    </TableCell>
  );
};

const PlayerList = () => {
  const theme = useTheme();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFaction, setFilterFaction] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [userRole, setUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showAdminColumns, setShowAdminColumns] = useState(false);
  // O tym, czy w odpowiedzi SĄ dane wrażliwe, decyduje serwer (rola z bazy),
  // a nie token w localStorage - front tylko rysuje to, co dostał.
  const [serverAdmin, setServerAdmin] = useState(false);
  const [lastLoginTracked, setLastLoginTracked] = useState(true);
  const [races, setRaces] = useState([]);
  const navigate = useNavigate();

  const isAdmin = serverAdmin || userRole === 'admin';

  useEffect(() => {
    fetch('/api/races?includeInactive=1')
      .then(res => res.json())
      .then(data => setRaces(Array.isArray(data) ? data : []))
      .catch(err => console.error('Błąd pobierania ras:', err));
  }, []);

  const getRaceName = (key) => races.find(r => r.key === key)?.name || key || '-';
  const getRaceColor = (key) => {
    const r = races.find(rr => rr.key === key);
    return getRaceColorSet(r?.color, { name: r?.name, key });
  };

  useEffect(() => {
    // Pobierz role i userId z tokena JWT
    const token = localStorage.getItem('token');

    if (token) {
      const payload = decodeJwtPayload(token);
      const role = payload?.role || '';
      const userId = payload?.id || null; // Używamy 'id' z tokena JWT

      setUserRole(role);
      setCurrentUserId(userId);
    } else {
      setUserRole('');
      setCurrentUserId(null);
    }
  }, []);

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');

        const params = {};
        if (filterFaction) {
          params.faction = filterFaction;
        }

        const response = await axios.get('/api/players', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: params,
        });

        setPlayers(Array.isArray(response.data.players) ? response.data.players : []);
        setServerAdmin(Boolean(response.data.isAdmin));
        setLastLoginTracked(response.data.lastLoginTracked !== false);
      } catch (error) {
        console.error('Błąd pobierania graczy:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [filterFaction]);

  const handleProfileClick = (id) => {
    navigate(`/home/profile/${id}`);
  };

  const isMyCharacter = (ownerId) => currentUserId && ownerId === currentUserId;

  // Data do kolumny "Ostatnie logowanie". Baza bez migracji add-last-login.sql
  // nie ma `last_login` - wtedy pokazujemy `last_seen` (ostatnia aktywność) i
  // mówimy o tym wprost w tooltipie, zamiast udawać, że to logowanie.
  const loginStamp = (player) => player.last_login || player.last_seen || null;

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      // Daty i poziom czyta się od "najwyżej/najświeżej", reszta od początku.
      setSortDir(column === 'level' || column === 'lastLogin' ? 'desc' : 'asc');
    }
  };

  const visiblePlayers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? players.filter((p) => (
          (p.character_name || '').toLowerCase().includes(needle)
          || (p.owner_name || '').toLowerCase().includes(needle)
          || (p.narrative_role || '').toLowerCase().includes(needle)
          || (p.epithet || '').toLowerCase().includes(needle)
          || formatRoleForDisplay(p.account_role || '').toLowerCase().includes(needle)
        ))
      : [...players];

    const dir = sortDir === 'asc' ? 1 : -1;
    const byText = (a, b) => (a || '').localeCompare(b || '', 'pl');
    const byTime = (a, b) => new Date(a || 0).getTime() - new Date(b || 0).getTime();

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': return dir * byText(a.character_name, b.character_name);
        case 'race': return dir * byText(getRaceName(a.faction), getRaceName(b.faction));
        case 'level': return dir * ((a.level || 0) - (b.level || 0));
        case 'lastLogin': return dir * byTime(loginStamp(a), loginStamp(b));
        default: return dir * ((a.id || 0) - (b.id || 0));
      }
    });

    return filtered;
  }, [players, search, sortBy, sortDir, races]);

  // Skrót dla administracji: ile kont żyje, a ile jest realnie porzuconych.
  const activityStats = useMemo(() => {
    if (!isAdmin) return null;
    const stats = { day: 0, week: 0, stale: 0, never: 0 };
    players.forEach((p) => {
      const stamp = loginStamp(p);
      if (!stamp) { stats.never += 1; return; }
      const hours = (Date.now() - new Date(stamp).getTime()) / (1000 * 60 * 60);
      if (hours < 24) stats.day += 1;
      if (hours < 24 * 7) stats.week += 1;
      if (hours >= 24 * 30) stats.stale += 1;
    });
    return stats;
  }, [players, isAdmin]);

  const totalColumns = 6 + (showAdminColumns ? 1 : 0);

  return (
    <PanelPage>
      <PanelHeader
        eyebrow="Kartoteka"
        title="Lista Postaci"
        theme={theme}
        action={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{
              color: appColors.steelLighter,
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              {loading ? 'Wczytywanie...' : `${visiblePlayers.length} z ${players.length}`}
            </Typography>
            {isAdmin && (
              <Button
                onClick={() => setShowAdminColumns((prev) => !prev)}
                startIcon={showAdminColumns ? <VisibilityOff /> : <Visibility />}
                sx={{
                  color: showAdminColumns ? appColors.statusGold : appColors.textLight,
                  border: `1px solid ${showAdminColumns ? appColors.statusGold : appColors.borderSteel}`,
                  borderRadius: '2px',
                  letterSpacing: '0.1em',
                  fontSize: '0.72rem',
                  px: 1.75,
                  py: 0.5,
                  '&:hover': {
                    borderColor: appColors.statusGold,
                    backgroundColor: `${appColors.statusGold}12`,
                  },
                }}
              >
                Widok admina
              </Button>
            )}
          </Box>
        )}
      />

      {/* ===== FILTRY ===== */}
      <Box sx={{ ...panelSectionSx(theme), display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Szukaj postaci, przydomka, gracza lub roli..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 260px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: appColors.steelLighter, fontSize: '1.1rem' }} />
              </InputAdornment>
            ),
          }}
        />

        {/* TextField z `select` zamiast gołego FormControl+Select: globalne
            style gry (MuiTextField) obejmują tylko TextField, więc samotny
            Select wyglądałby jak domyślne MUI obok pola wyszukiwania. */}
        <TextField
          select
          size="small"
          label="Rasa"
          value={filterFaction}
          onChange={(e) => setFilterFaction(e.target.value)}
          sx={{ flex: '0 1 240px', minWidth: 180 }}
        >
          <MenuItem value="">Wszystkie rasy</MenuItem>
          {races.map((race) => (
            <MenuItem key={race.key} value={race.key}>{race.name}</MenuItem>
          ))}
        </TextField>
      </Box>

      {/* ===== PODSUMOWANIE AKTYWNOŚCI (tylko admin, tylko w widoku admina) ===== */}
      {isAdmin && showAdminColumns && activityStats && (
        <Box sx={{
          ...panelSectionSx(theme),
          display: 'flex',
          gap: { xs: 2, sm: 4 },
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Logowanie w dobie', value: activityStats.day, color: appColors.statusSuccess },
            { label: 'Logowanie w tygodniu', value: activityStats.week, color: appColors.textLight },
            { label: 'Cisza 30 dni+', value: activityStats.stale, color: appColors.statusWarning },
            { label: 'Nigdy / brak danych', value: activityStats.never, color: appColors.dangerText },
          ].map((tile) => (
            <Box key={tile.label}>
              <Typography sx={{
                color: appColors.textMuted,
                fontSize: '0.62rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}>
                {tile.label}
              </Typography>
              <Typography sx={{ color: tile.color, fontSize: '1.4rem', fontWeight: 'bold', lineHeight: 1.2 }}>
                {tile.value}
              </Typography>
            </Box>
          ))}
          {!lastLoginTracked && (
            <Typography sx={{ color: appColors.statusWarning, fontSize: '0.7rem', alignSelf: 'center', maxWidth: 360 }}>
              Baza nie ma jeszcze kolumny <code>users.last_login</code> (migracja
              <code> database/add-last-login.sql</code>) - pokazana jest ostatnia AKTYWNOŚĆ konta.
            </Typography>
          )}
        </Box>
      )}

      {loading ? (
        <Typography sx={{ color: appColors.steelLighter, letterSpacing: '0.1em' }}>
          Ładowanie...
        </Typography>
      ) : (
        <TableContainer sx={{
          border: `1px solid ${appColors.borderSteel}`,
          borderRadius: '2px',
          backgroundColor: appColors.bgDeep,
          overflowX: 'auto',
        }}>
          <Table size="small" sx={{ minWidth: showAdminColumns ? 900 : 760 }} aria-label="Lista postaci">
            <TableHead>
              <TableRow sx={{ backgroundColor: appColors.bgSurface }}>
                <SortableHead id="id" label="ID" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} sx={{ width: 56 }} />
                <SortableHead id="name" label="Postać" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <TableCell sx={headCellSx}>Rola fabularna</TableCell>
                <TableCell sx={headCellSx}>Ranga konta</TableCell>
                <SortableHead id="race" label="Rasa / płeć" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHead id="level" label="Poziom" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="center" sx={{ width: 80 }} />
                {showAdminColumns && (
                  <SortableHead
                    id="lastLogin"
                    label={lastLoginTracked ? 'Logowanie' : 'Aktywność'}
                    hint={lastLoginTracked
                      ? 'Ostatnie logowanie na konto gracza'
                      : 'Ostatnia aktywność konta (brak migracji add-last-login.sql)'}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {visiblePlayers.map((player) => {
                const raceColor = getRaceColor(player.faction);
                const mine = isMyCharacter(player.user_id);
                const roleAccent = getRoleAccent(player.account_role);
                const stamp = loginStamp(player);
                const tier = activityTier(stamp);

                return (
                  <TableRow
                    key={player.id}
                    sx={{
                      // Lewa krawędź w kolorze rasy - ten sam sygnał co w
                      // panelRowSx, dzięki czemu listę czyta się rasami nawet
                      // przy szybkim skrolowaniu.
                      borderLeft: `3px solid ${mine ? appColors.statusSuccess : raceColor.border}`,
                      backgroundColor: mine ? `${appColors.statusSuccess}0f` : 'transparent',
                      transition: 'background-color 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        backgroundColor: raceColor.soft,
                        boxShadow: `inset 0 0 24px ${raceColor.hover}22`,
                      },
                    }}
                  >
                    <TableCell sx={{ ...bodyCellSx, color: appColors.textMuted, fontSize: '0.8rem' }}>
                      {player.id}
                    </TableCell>

                    <TableCell sx={{ ...bodyCellSx, minWidth: 170 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          variant="text"
                          onClick={() => handleProfileClick(player.id)}
                          sx={{
                            color: mine ? appColors.statusSuccess : raceColor.accent,
                            fontWeight: 'bold',
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            letterSpacing: '0.02em',
                            p: 0,
                            minWidth: 0,
                            minHeight: 0,
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            wordBreak: 'break-word',
                            whiteSpace: 'normal',
                            lineHeight: 1.3,
                            '&:hover': {
                              backgroundColor: 'transparent',
                              color: appColors.textLight,
                              textShadow: `0 0 12px ${raceColor.hover}`,
                            },
                          }}
                        >
                          {player.character_name}
                        </Button>
                        {mine && (
                          <Chip
                            label="Ty"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.6rem',
                              borderRadius: '2px',
                              backgroundColor: `${appColors.statusSuccess}20`,
                              border: `1px solid ${appColors.statusSuccess}66`,
                              color: appColors.statusSuccess,
                            }}
                          />
                        )}
                      </Box>
                      {player.epithet && (
                        <Typography sx={{
                          color: appColors.textLight,
                          fontStyle: 'italic',
                          fontSize: '0.8rem',
                          lineHeight: 1.3,
                          mb: 0.25,
                        }}>
                          „{player.epithet}"
                        </Typography>
                      )}
                      {/* Metryczka konta jako podpis, a nie trzy osobne kolumny:
                          konto/IP/data założenia to kontekst DO postaci, a nie
                          osobne osie porównania - w kolumnach rozpychały tabelę
                          poza szerokość panelu. Osobną kolumnę dostaje tylko to,
                          po czym admin faktycznie skanuje listę: logowanie. */}
                      <Typography sx={{ color: appColors.textMuted, fontSize: '0.72rem' }}>
                        konto: {player.owner_name || '—'}
                        {showAdminColumns && player.last_ip ? ` · ${player.last_ip}` : ''}
                      </Typography>
                      {showAdminColumns && (
                        <Typography sx={{ color: appColors.textMuted, fontSize: '0.72rem' }}>
                          utworzona: {formatDate(player.created_at)}
                        </Typography>
                      )}
                    </TableCell>

                    {/* Rola FABULARNA - kursywa i cudzysłowy, żeby czytało się
                        jak tytuł w świecie gry, a nie jak uprawnienie. */}
                    <TableCell sx={bodyCellSx}>
                      {player.narrative_role ? (
                        <Typography sx={{
                          color: raceColor.accent,
                          fontStyle: 'italic',
                          fontSize: '0.85rem',
                          lineHeight: 1.3,
                        }}>
                          „{player.narrative_role}"
                        </Typography>
                      ) : (
                        <Tooltip title="Rolę fabularną nadaje administracja w profilu postaci" arrow>
                          <Typography sx={{ color: appColors.textMuted, fontSize: '0.85rem' }}>—</Typography>
                        </Tooltip>
                      )}
                    </TableCell>

                    {/* Ranga KONTA - ta sama insygnia co przy awatarze na
                        liście online (RoleBadge), tylko w linii. */}
                    <TableCell sx={bodyCellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <RoleBadge role={player.account_role} size="small" overlay={false} />
                        <Typography sx={{
                          color: roleAccent || appColors.steelLighter,
                          fontSize: '0.72rem',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          fontWeight: roleAccent ? 'bold' : 'normal',
                          whiteSpace: 'nowrap',
                        }}>
                          {formatRoleForDisplay(player.account_role || 'mieszkaniec')}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell sx={bodyCellSx}>
                      <Chip
                        label={getRaceName(player.faction)}
                        size="small"
                        sx={{
                          borderRadius: '2px',
                          backgroundColor: raceColor.light,
                          border: `1px solid ${raceColor.border}`,
                          color: raceColor.accent,
                          fontWeight: 'bold',
                        }}
                      />
                      <Typography sx={{ color: appColors.textMuted, fontSize: '0.72rem', mt: 0.25 }}>
                        {player.gender || '—'}
                      </Typography>
                    </TableCell>

                    <TableCell align="center" sx={bodyCellSx}>
                      <Box sx={{
                        display: 'inline-block',
                        minWidth: 34,
                        px: 1,
                        py: 0.25,
                        border: `1px solid ${appColors.borderSteel}`,
                        borderRadius: '2px',
                        color: appColors.textLight,
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                      }}>
                        {player.level}
                      </Box>
                    </TableCell>

                    {showAdminColumns && (
                      <TableCell sx={bodyCellSx}>
                        {stamp ? (
                          <Tooltip
                            title={lastLoginTracked
                              ? `Ostatnie logowanie: ${formatDateTime(stamp)}`
                              : `Ostatnia aktywność konta: ${formatDateTime(stamp)} (brak migracji add-last-login.sql)`}
                            arrow
                          >
                            <Box>
                              <Typography sx={{ color: tier?.color || appColors.textPrimary, fontSize: '0.85rem', fontWeight: 'bold' }}>
                                {formatRelative(stamp)}
                              </Typography>
                              <Typography sx={{ color: appColors.textMuted, fontSize: '0.72rem' }}>
                                {formatShortDateTime(stamp)}
                              </Typography>
                            </Box>
                          </Tooltip>
                        ) : (
                          <Typography sx={{ color: appColors.dangerText, fontSize: '0.85rem', fontWeight: 'bold' }}>
                            nigdy
                          </Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}

              {visiblePlayers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={totalColumns} sx={{ ...bodyCellSx, textAlign: 'center', py: 6 }}>
                    <Typography sx={{
                      color: appColors.steelLighter,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}>
                      Brak postaci do wyświetlenia
                    </Typography>
                    <Typography sx={{ color: appColors.textMuted, fontSize: '0.8rem', mt: 1 }}>
                      {search
                        ? 'Żadna postać nie pasuje do wyszukiwania'
                        : filterFaction
                          ? 'Spróbuj zmienić filtr rasy'
                          : 'Nie znaleziono żadnych postaci'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PanelPage>
  );
};

export default PlayerList;
