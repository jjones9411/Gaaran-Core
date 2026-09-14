// ================================
// CharacterSwitchGuard
// Ostrzega, że TA karta przeglądarki jest otwarta na innej postaci niż ta,
// którą gracz gra w tej chwili.
//
// Skąd problem: token siedzi w `localStorage`, czyli jest WSPÓLNY dla
// wszystkich kart tej samej przeglądarki, ale komponenty gry zapamiętują
// `characterId` w stanie Reacta przy montowaniu. Wybór drugiej postaci w
// nowej karcie podmienia token wszystkim kartom, a stara karta dalej wysyła
// akcje ze starym `characterId` - i wychodziły z tego dwie równoległe sesje
// gry na jednym koncie (obie postacie zbierały exp i wbijały poziomy).
//
// Serwer takie żądania teraz odrzuca (409, patrz backend/utils/activeCharacter.js).
// Tutaj mówimy o tym graczowi, ZANIM kliknie - ale bez automatycznego
// przeładowania, żeby nie skasować komuś w połowie napisanego posta.
// ================================

import { useEffect, useState, useCallback } from 'react';
import { Snackbar, Alert, Button } from '@mui/material';
import { useAuth, decodeJwtPayload } from './AuthContext';

export default function CharacterSwitchGuard() {
  const { user } = useAuth();
  // Postać, którą ta karta ma "w rękach" - stan Reacta, ustawiony przy
  // logowaniu/wyborze postaci W TEJ karcie.
  const tabCharacterId = user?.characterId || null;
  const [activeName, setActiveName] = useState(null);

  const check = useCallback(() => {
    if (!tabCharacterId) {
      setActiveName(null);
      return;
    }

    const payload = decodeJwtPayload(localStorage.getItem('token'));
    const tokenCharacterId = payload?.characterId || null;

    // Brak tokena/postaci = wylogowanie lub powrót do lobby - tym zajmuje się
    // AuthProvider, nie nasza sprawa.
    if (!tokenCharacterId) {
      setActiveName(null);
      return;
    }

    setActiveName(
      Number(tokenCharacterId) === Number(tabCharacterId)
        ? null
        : payload.characterName || 'inną postacią'
    );
  }, [tabCharacterId]);

  useEffect(() => {
    check();

    // `storage` leci tylko do POZOSTAŁYCH kart - dokładnie tych, które
    // zostały z nieaktualną postacią. Powrót do karty sprawdzamy dodatkowo,
    // na wypadek zdarzenia zgubionego przy uśpionej karcie.
    const onStorage = (e) => {
      if (!e.key || e.key === 'token') check();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  return (
    <Snackbar
      open={Boolean(activeName)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 10 }}
    >
      <Alert
        severity="warning"
        variant="filled"
        sx={{ borderRadius: 0, alignItems: 'center', boxShadow: 6 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => window.location.reload()}
            sx={{ fontWeight: 'bold' }}
          >
            Odśwież
          </Button>
        }
      >
        Grasz teraz postacią <strong>{activeName}</strong> (w innej karcie). Ta karta jest
        nieaktualna — odśwież ją, żeby grać dalej.
      </Alert>
    </Snackbar>
  );
}
