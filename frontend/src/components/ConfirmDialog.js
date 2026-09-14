import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Wspólny dialog potwierdzenia - wydzielony z Equipment.js, zamiast każdy ekran
// miał własną kopię (albo, jak Profile.js, natywne window.confirm()).
export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Potwierdź',
  cancelText = 'Anuluj',
  confirmColor = 'primary',
  hideCancel = false,
}) {
  const theme = useTheme();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{
        color: theme.palette.text.primary,
        fontWeight: 'bold',
        borderBottom: `2px solid ${theme.palette.divider}`
      }}>
        {title}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontSize: '1.1rem' }}>
          {message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        {!hideCancel && (
          <Button onClick={onCancel} variant="outlined" color="inherit">
            {cancelText}
          </Button>
        )}
        <Button onClick={onConfirm} variant="contained" color={confirmColor} autoFocus>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
