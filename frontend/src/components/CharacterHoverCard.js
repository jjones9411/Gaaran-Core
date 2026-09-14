// ================================
// CharacterHoverCard
// Wspólna karta postaci pokazywana w tooltipach (najechanie na imię).
// Wygląd 1:1 z tooltipem z listy online (OnlineList): duży portret,
// nazwa z poświatą, ramka ze statystykami. Wiersze, dla których nie ma
// danych (poziom / styl gry / rola fabularna / status), są pomijane - dzięki temu ta sama
// karta działa i na liście online (pełne dane), i w oknach sesji/karczmy/
// wiadomości (tylko avatar + rasa + płeć).
//
// Przydomek (nadawany przez administrację, tak jak rola fabularna) stoi tuż pod
// nazwą postaci - to część tego, jak postać jest znana, a nie kolejny wiersz
// statystyk.
// ================================

import { Box, Typography, Avatar, Stack, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getPlayStyle } from './playStyle';

export default function CharacterHoverCard({
  avatar,
  name,
  id,
  raceName,
  gender,
  level = null,
  prestige = 0,
  playStyle = null,
  characterStatus = null,
  narrativeRole = null,
  epithet = null,
}) {
  const theme = useTheme();

  return (
    <Box sx={{ p: 0, minWidth: 300 }}>
      <Box sx={{ position: 'relative', width: '100%', mb: 0 }}>
        <Avatar
          src={avatar ? `/api${avatar}` : undefined}
          alt={name || 'Postać'}
          sx={{
            width: '100%',
            height: 420,
            border: 'none',
            borderBottom: `2px solid ${theme.palette.divider}`,
            boxShadow: `0 6px 20px ${theme.palette.primary.main}60`,
            fontSize: 64,
            objectFit: 'cover',
            objectPosition: '50% 0%',
            borderRadius: '0',
            fontWeight: 'bold',
            color: theme.palette.text.secondary,
            backgroundColor: theme.palette.background.default,
          }}
        >
          {!avatar && name?.[0]?.toUpperCase()}
        </Avatar>
      </Box>

      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          mb: epithet && epithet.trim() !== '' ? 0.25 : 1.5,
        }}>
          <Typography sx={{
            fontWeight: 'bold',
            color: theme.palette.primary.main,
            fontSize: 18,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textShadow: `0 0 10px ${theme.palette.primary.main}60`,
          }}>
            {name || 'Nieznany'}
          </Typography>
          {id != null && (
            <Chip
              label={`#${id}`}
              size="small"
              sx={{
                fontSize: 11,
                fontWeight: 'bold',
                height: 20,
                backgroundColor: theme.palette.background.default,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '0',
              }}
            />
          )}
        </Box>

        {epithet && epithet.trim() !== '' && (
          <Typography sx={{
            fontSize: 13,
            fontStyle: 'italic',
            fontWeight: 700,
            color: theme.palette.info.text,
            letterSpacing: '0.04em',
            wordBreak: 'break-word',
            mb: 1.5,
          }}>
            „{epithet}"
          </Typography>
        )}

        <Stack spacing={1} sx={{ width: '100%' }}>
          <Box sx={{
            p: 1,
            borderRadius: '0',
            backgroundColor: theme.palette.background.default,
            border: `1px solid ${theme.palette.divider}`,
            textAlign: 'left',
          }}>
            {level != null && (
              <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, mb: 0.5 }}>
                POZIOM: <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>{level || 1}</Box>
                {prestige > 0 && (
                  <Box component="span" sx={{ color: theme.palette.warning.main, fontWeight: 'bold', ml: 0.5, textShadow: `0 0 5px ${theme.palette.warning.main}aa` }}>
                    ({prestige})
                  </Box>
                )}
              </Typography>
            )}
            <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, mb: 0.5 }}>
              RASA: <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>{raceName || '-'}</Box>
            </Typography>
            <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary, ...(playStyle ? { mb: 0.5 } : {}) }}>
              PŁEĆ: <Box component="span" sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>{gender || '-'}</Box>
            </Typography>
            {playStyle && (
              <Typography sx={{ fontSize: 12, color: theme.palette.text.secondary }}>
                STYL: <Box component="span" sx={{ color: getPlayStyle(playStyle).color, fontWeight: 'bold' }}>{getPlayStyle(playStyle).short}</Box>
              </Typography>
            )}
          </Box>

          {/* Rola fabularna (od administracji) + status (od gracza) w jednym
              bloku - tak samo jak w dymku listy online. Status większym tekstem,
              bo to najczęściej czytana treść karty. */}
          {((narrativeRole && narrativeRole.trim() !== '') || (characterStatus && characterStatus.trim() !== '')) && (
            <Box sx={{
              p: 1.5,
              borderRadius: '0',
              backgroundColor: theme.palette.background.default,
              border: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}>
              {narrativeRole && narrativeRole.trim() !== '' && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: theme.palette.text.secondary,
                    mb: 0.25,
                  }}>
                    ROLA FABULARNA
                  </Typography>
                  <Typography sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: theme.palette.warning.main,
                    letterSpacing: '0.04em',
                    wordBreak: 'break-word',
                    lineHeight: 1.4,
                  }}>
                    {narrativeRole}
                  </Typography>
                </Box>
              )}

              {narrativeRole && narrativeRole.trim() !== '' && characterStatus && characterStatus.trim() !== '' && (
                <Box sx={{ height: '1px', backgroundColor: theme.palette.divider }} />
              )}

              {characterStatus && characterStatus.trim() !== '' && (
                <Typography sx={{
                  fontSize: 14,
                  color: theme.palette.text.primary,
                  fontStyle: 'italic',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  textAlign: 'center',
                }}>
                  "{characterStatus}"
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
