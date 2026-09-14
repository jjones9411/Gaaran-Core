import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Button, ToggleButton,
  ToggleButtonGroup, Collapse, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';

const API_URL = '/api';

const SEVERITY_COLORS = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const STATUS_COLORS = {
  open: 'error',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'default',
  wontfix: 'default',
};

const TYPE_LABELS = {
  backend: '⚙️ Backend',
  frontend: '🖥️ Frontend',
  database: '🗄️ Baza',
  other: '🐞 Gracz',
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pl-PL');
  } catch {
    return String(value);
  }
}

const BugRow = ({ log, onStatusChange, onDelete }) => {
  const [open, setOpen] = useState(false);
  const isResolved = ['resolved', 'closed', 'wontfix'].includes(log.status);

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <Chip label={TYPE_LABELS[log.bug_type] || log.bug_type} size="small" variant="outlined" />
        </TableCell>
        <TableCell>
          <Chip
            label={log.severity}
            size="small"
            color={SEVERITY_COLORS[log.severity] || 'default'}
          />
        </TableCell>
        <TableCell sx={{ maxWidth: 360 }}>
          <Typography
            variant="body2"
            sx={{ cursor: 'pointer', fontWeight: 500 }}
            onClick={() => setOpen((o) => !o)}
          >
            {log.title}
          </Typography>
          {log.url && (
            <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
              {log.url}
            </Typography>
          )}
        </TableCell>
        <TableCell>{log.reporter_name || (log.bug_type === 'other' ? '—' : 'system')}</TableCell>
        <TableCell>
          <Chip
            label={log.status}
            size="small"
            color={STATUS_COLORS[log.status] || 'default'}
          />
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</TableCell>
        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
          {!isResolved ? (
            <Tooltip title="Oznacz jako rozwiązane">
              <IconButton size="small" color="success" onClick={() => onStatusChange(log.id, 'resolved')}>
                ✓
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Otwórz ponownie">
              <IconButton size="small" onClick={() => onStatusChange(log.id, 'open')}>
                ↺
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Usuń">
            <IconButton size="small" color="error" onClick={() => onDelete(log.id)}>
              🗑
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              {log.description && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Opis:</strong> {log.description}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                <strong>Komunikat:</strong> {log.error_message}
              </Typography>
              {log.stack_trace && (
                <Box
                  component="pre"
                  sx={{
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    bgcolor: 'background.paper',
                    p: 1,
                    borderRadius: 1,
                    maxHeight: 240,
                  }}
                >
                  {log.stack_trace}
                </Box>
              )}
              {log.browser_info && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {log.browser_info}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const Bugtrack = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | backend | other
  const [clearOpen, setClearOpen] = useState(false);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    const query = filter === 'all' ? '' : `?type=${filter}`;
    fetch(`${API_URL}/admin/buglogs${query}`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setLogs(data.logs || []))
      .catch((err) => {
        console.error('Błąd przy pobieraniu logów:', err);
        setError('Nie udało się pobrać logów.');
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleStatusChange = (id, status) => {
    fetch(`${API_URL}/admin/buglogs/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      })
      .catch((err) => console.error('Błąd zmiany statusu:', err));
  };

  const handleDelete = (id) => {
    fetch(`${API_URL}/admin/buglogs/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setLogs((prev) => prev.filter((l) => l.id !== id));
      })
      .catch((err) => console.error('Błąd usuwania:', err));
  };

  const handleClear = (onlyResolved) => {
    fetch(`${API_URL}/admin/buglogs/clear`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ onlyResolved }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setClearOpen(false);
        fetchLogs();
      })
      .catch((err) => console.error('Błąd czyszczenia:', err));
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          🐞 Bugtrack
        </Typography>
        <Button variant="outlined" size="small" onClick={fetchLogs}>
          Odśwież
        </Button>
        <Button variant="outlined" size="small" color="error" onClick={() => setClearOpen(true)}>
          Wyczyść
        </Button>
      </Box>

      <ToggleButtonGroup
        value={filter}
        exclusive
        size="small"
        onChange={(e, val) => val && setFilter(val)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="all">Wszystkie</ToggleButton>
        <ToggleButton value="backend">⚙️ Backend</ToggleButton>
        <ToggleButton value="other">🐞 Zgłoszenia graczy</ToggleButton>
      </ToggleButtonGroup>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : logs.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', p: 2 }}>
          Brak zgłoszeń do wyświetlenia. 🎉
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Typ</TableCell>
                <TableCell>Waga</TableCell>
                <TableCell>Tytuł / endpoint</TableCell>
                <TableCell>Zgłaszający</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Akcje</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <BugRow
                  key={log.id}
                  log={log}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={clearOpen} onClose={() => setClearOpen(false)}>
        <DialogTitle>Wyczyść logi</DialogTitle>
        <DialogContent>
          <Typography>Które zgłoszenia usunąć?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearOpen(false)}>Anuluj</Button>
          <Button onClick={() => handleClear(true)} color="warning">
            Tylko rozwiązane
          </Button>
          <Button onClick={() => handleClear(false)} color="error">
            Wszystkie
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default Bugtrack;
