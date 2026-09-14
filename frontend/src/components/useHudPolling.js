import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Wspólna logika odpytywania paska postaci i liczników nieprzeczytanych (sesje,
// wiadomości, logi, karczma). Używana zarówno przez Sidebar (mobile) jak i TopBar
// (desktop) - Home.js renderuje zawsze tylko jeden z nich naraz zależnie od
// szerokości ekranu, więc to jeden hook zamiast dwóch niezależnych kopii tego
// samego fetchowania w obu plikach.
export default function useHudPolling(token, characterId) {
  const location = useLocation();

  // Dane postaci pokazywane w pasku: imię, awatar, rasa, przydomek i rola
  // fabularna. Puste do czasu pierwszej odpowiedzi serwera - `loadingCharacter`
  // mówi, że to jeszcze nie są prawdziwe dane.
  const [characterData, setCharacterData] = useState({
    nickname: '', avatar: '', race: '', faction: '', epithet: '', narrativeRole: ''
  });
  const [loadingCharacter, setLoadingCharacter] = useState(true);
  const [generalSessionUnreadCount, setGeneralSessionUnreadCount] = useState(0);
  const [privateSessionUnreadCount, setPrivateSessionUnreadCount] = useState(0);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);
  // UWAGA: logi CELOWO nie mają powiadomień - w dziale KOMUNIKACJA sygnalizujemy
  // tylko sesje prywatne, sesje ogólne, karczmę i wiadomości. Logi sypią wpisami
  // po każdej akcji postaci, więc kropka przy nich świeciłaby się praktycznie
  // zawsze i zagłuszała realne powiadomienia. Dlatego nie ma tu stanu logsUnread
  // ani odpytywania /api/home/logs/unread (endpoint w backendzie zostaje).
  const [tavernUnread, setTavernUnread] = useState(false);
  // Codziennik: ile sesji czeka na odpis TEJ postaci (czerwone wpisy) i ile ma
  // zaznaczoną zaległą narrację. To inne liczby niż "nieprzeczytane sesje" -
  // nieprzeczytane gasną po zajrzeniu, a zaległy odpis dopiero po wysłaniu
  // wiadomości (narracja - po poście narratora).
  const [journalReplyNeededCount, setJournalReplyNeededCount] = useState(0);
  const [journalNarrationTodoCount, setJournalNarrationTodoCount] = useState(0);

  // Dane postaci.
  //
  // Źródłem jest /api/hud/character - wąski endpoint zrobiony pod ten pasek,
  // zamiast pełnego profilu (najcięższego zapytania w grze), który pasek
  // odpytywałby co 10 sekund.
  useEffect(() => {
    if (!token || !characterId) {
      setLoadingCharacter(false);
      return;
    }

    let cancelled = false;

    const fetchCharacterData = async () => {
      try {
        const response = await fetch(`/api/hud/character?characterId=${characterId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          // Nieudane żądanie (429, 5xx) NIE podmienia paska na wartości
          // domyślne - zostaje ostatni znany stan, a jeśli nie znamy jeszcze
          // żadnego, pasek dalej mówi "ładuję" zamiast zmyślać pełne HP.
          console.error('Błąd pobierania danych postaci');
          return;
        }
        const hud = await response.json();
        if (cancelled) return;

        setCharacterData({
          nickname: hud.nickname || '',
          avatar: hud.avatar || '',
          race: hud.race || '',
          faction: hud.faction || '',
          epithet: hud.epithet || '',
          narrativeRole: hud.narrativeRole || ''
        });
        setLoadingCharacter(false);
      } catch (error) {
        console.error('Błąd pobierania danych postaci:', error);
      }
    };

    fetchCharacterData();
    const interval = setInterval(() => {
      if (document.hidden) return; // w tle nie odpytujemy
      fetchCharacterData();
    }, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, characterId, location.pathname]);

  // Wszystkie liczniki "nieprzeczytane" w JEDNYM żądaniu.
  //
  // Wcześniej były to cztery osobne odpytania co 10 sekund (sesje ogólne, sesje
  // prywatne, wiadomości, karczma), i każde z nich ściągało PEŁNĄ listę tylko
  // po to, żeby policzyć w przeglądarce jedną cyfrę - lista wszystkich sesji z
  // ostatnimi wiadomościami leciała po sieci co 10 s, żeby wyświetlić "3".
  // Teraz liczy je baza (/hud/unread), a front dostaje gotowe liczby.
  //
  // To była też największa pojedyncza pozycja w rachunku, przez który gracze
  // wpadali w globalny limit żądań przy zwykłej grze.
  const isInTavern = location.pathname === '/home/tavern';

  const refreshUnreadCounters = useCallback(async () => {
    if (!token || !characterId) {
      setGeneralSessionUnreadCount(0);
      setPrivateSessionUnreadCount(0);
      setMessagesUnreadCount(0);
      setTavernUnread(false);
      return;
    }
    try {
      const res = await fetch(`/api/hud/unread?characterId=${characterId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Nieudane żądanie (429, 5xx, brak sieci) zostawia liczniki bez zmian -
      // zerowanie ich kasowałoby graczowi powiadomienia przy każdym mignięciu
      // błędu, a stara wartość jest bliższa prawdzie niż zero.
      if (!res.ok) return;
      const data = await res.json();
      setGeneralSessionUnreadCount(data.generalSessions || 0);
      setPrivateSessionUnreadCount(data.privateSessions || 0);
      setMessagesUnreadCount(data.messages || 0);
      // Siedząc w karczmie nie sygnalizujemy jej sami sobie.
      setTavernUnread(isInTavern ? false : Boolean(data.tavernUnread));
    } catch (e) {
      console.error('Błąd pobierania liczników HUD:', e);
    }
  }, [token, characterId, isInTavern]);

  // `location.pathname` w zależnościach zostaje z poprzedniej wersji: zmiana
  // ekranu odświeża liczniki od razu (np. po wyjściu z sesji, która właśnie
  // została oznaczona jako przeczytana), bez czekania na kolejny tik.
  useEffect(() => {
    refreshUnreadCounters();
    const interval = setInterval(refreshUnreadCounters, 10000);
    return () => clearInterval(interval);
  }, [location.pathname, refreshUnreadCounters]);

  // Natychmiastowe odświeżenie po akcji gracza (wysłanie posta, wejście do
  // sesji) - te same zdarzenia co wcześniej, tylko jeden słuchacz zamiast trzech.
  useEffect(() => {
    const events = ['generalSessionsUpdated', 'privateSessionsUpdated', 'conversationsUpdated'];
    events.forEach(name => window.addEventListener(name, refreshUnreadCounters));
    return () => events.forEach(name => window.removeEventListener(name, refreshUnreadCounters));
  }, [refreshUnreadCounters]);

  // Licznik zaległych odpisów do Codziennika. Odpytywany rzadziej (30 s) niż
  // nieprzeczytane - stan "muszę odpisać" zmienia się tylko przy nowym wpisie,
  // a zapytanie liczy wiadomości we wszystkich sesjach postaci.
  useEffect(() => {
    if (!token || !characterId) {
      setJournalReplyNeededCount(0);
      setJournalNarrationTodoCount(0);
      return;
    }
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/sessionJournal/summary?characterId=${characterId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) { setJournalReplyNeededCount(0); setJournalNarrationTodoCount(0); return; }
        const data = await res.json();
        setJournalReplyNeededCount(data.replyNeeded || 0);
        setJournalNarrationTodoCount(data.narrationTodo || 0);
      } catch {
        setJournalReplyNeededCount(0);
        setJournalNarrationTodoCount(0);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [token, characterId, location.pathname]);

  return {
    characterData,
    setCharacterData,
    loadingCharacter,
    generalSessionUnreadCount,
    privateSessionUnreadCount,
    messagesUnreadCount,
    tavernUnread,
    journalReplyNeededCount,
    journalNarrationTodoCount,
    // Licznik przy pozycji "Codziennik": wszystko, co w codzienniku czeka na ruch
    // gracza - zaległe odpisy i zaległe narracje.
    journalTodoCount: journalReplyNeededCount + journalNarrationTodoCount,
  };
}
