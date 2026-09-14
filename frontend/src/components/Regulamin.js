import { Box, Paper, Typography, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useGameName from './useGameName';

function Regulamin() {
  const theme = useTheme();
  const gameName = useGameName();
  return (
    <Paper
      sx={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        border: `2px solid ${theme.palette.text.secondary}`,
        color: theme.palette.text.primary,
        maxWidth: '900px',
        mx: 'auto',
        my: 4,
        p: 4,
      }}
    >
      <Box>
        <Typography variant="h4" sx={{ mb: 1, textAlign: 'center', fontWeight: 'bold', color: theme.palette.text.primary }}>
          Regulamin Gry {gameName}
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: theme.palette.text.secondary, fontStyle: 'italic' }}>
          Ostatnia aktualizacja: Grudzień 2024
        </Typography>

        <Box
          sx={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: `1px solid ${theme.palette.info.main}`,
            borderRadius: 1,
            p: 2,
            mb: 4
          }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.info.light, textAlign: 'center' }}>
            📌 <strong>Informacja:</strong> Szczegółowe zasady dotyczące avatarów, mechaniki gry oraz inne informacje techniczne
            znajdują się w osobnej karcie dostępnej wewnątrz gry po zalogowaniu.
          </Typography>
        </Box>

        <Box sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 2 }}>
          {/* Postanowienia ogólne */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: theme.palette.warning.main }}>
              I. Postanowienia ogólne
            </Typography>

            <Typography variant="h6" sx={{ mb: 1.5, fontSize: '1rem', fontWeight: 'bold' }}>
              Definicje
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.8 }}>
              Na potrzeby regulaminu poniższe określenia oznaczają:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Administrator Techniczny Gry</strong> – osoba odpowiadająca za stan techniczny strony internetowej [ADRES_STRONY]/ (ID 1).
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Administracja</strong> – Administrator Techniczny Gry zwany Technicznym, Administrator Fabularny Gry zwany Stwórcą, Mistrzowie Gry albo inne osoby funkcyjne, które zostaną wskazane przez Administratora Technicznego drogą pocztową w grze lub w formie ogłoszenia na komunikatorze.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Gracz</strong> – osoba powyżej osiemnastego roku życia posiadająca konto na stronie internetowej [ADRES_STRONY]/.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Dane</strong> – informacje dotyczące zidentyfikowanej lub możliwej do zidentyfikowania osoby fizycznej w rozumieniu ustawy z dnia 29 sierpnia 1997 roku o ochronie danych osobowych (t.j. Dz. U. z 2019 r., poz. 1781) na stronie [ADRES_STRONY]/. Oznacza to: IP oraz adres e-mail.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Hasło</strong> – ustalany przez gracza podczas procesu rejestracji ciąg znaków służący późniejszej autoryzacji podczas logowania do gry.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Konto</strong> – przypisany do gracza zbiór danych, zawierający dane gracza niezbędne do jego autoryzacji oraz komunikowania się z innymi graczami. Konto tworzone jest na bieżąco i jest aktualizowane na podstawie danych dostarczanych dobrowolnie przez gracza.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Login</strong> – adres poczty elektronicznej gracza, służący jego identyfikacji i wraz z hasłem konieczny do dokonania autoryzacji w trakcie uzyskiwania dostępu do gry [ADRES_STRONY]/
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Rejestracja</strong> – jednorazowa czynność dokonywana przez gracza na stronie [ADRES_STRONY]/ polegająca na założeniu przez Gracza konta oraz zdefiniowaniu hasła.
              </Typography></li>
            </Box>

            <Typography variant="h6" sx={{ mb: 1.5, mt: 2, fontSize: '1rem', fontWeight: 'bold' }}>
              Zasady ogólne
            </Typography>
            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Administrator Techniczny Gry umożliwia dostęp do [ADRES_STRONY]/ oraz korzystanie ze wszystkich funkcjonalności pod warunkiem akceptacji wszystkich zapisów niniejszego regulaminu.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Administrator udostępnia Regulamin graczom przed utworzeniem konta oraz przez cały czas pod adresem [ADRES_STRONY]/ w sposób umożliwiający pozyskanie, odtwarzanie i utrwalanie jego treści przez gracza. Brak akceptacji zapisów Regulaminu lub zmian tychże oznacza brak możliwości korzystania z gry.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Gra [ADRES_STRONY]/ jest dostępna dla każdego gracza, przy czym zakres dostępu do niej może zostać w każdym czasie i w dowolnym zakresie ograniczony przez Administratora Technicznego Gry, w przypadku złamania postanowień Regulaminu.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Rejestracja konta w grze odbywa się poprzez podanie w formularzu rejestracyjnym następujących danych: Loginu oraz Hasła, a także akceptacji niniejszego Regulaminu.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Użytkownik dokonując Rejestracji i akceptując Regulamin oświadcza, że jest pełnoletni oraz nie został ubezwłasnowolniony w jakimkolwiek zakresie bądź ma ukończone 16 lat i posiada zgodę swojego przedstawiciela ustawowego na korzystanie z gry [ADRES_STRONY]/ oraz bierze na siebie odpowiedzialność za utrzymanie w tajemnicy danych dotyczących jego konta, w tym hasła oraz za wszystkie czynności wykonywane w ramach bądź przy wykorzystaniu jego konta.
              </Typography></li>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: theme.palette.text.secondary }} />

          {/* Zasady korzystania z gry */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: theme.palette.warning.main }}>
              II. Zasady korzystania z gry
            </Typography>

            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Gra {gameName} jest bezpłatną, przeglądarkową, wieloosobową grą fabularną (MMORPG), rozgrywającą się w świecie stworzonym przez jej twórców.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Dokonując rejestracji, gracz akceptuje Regulamin i wyraża zgodę na wykorzystanie wszystkich treści stworzonych przez gracza, a znajdujących się na serwerach gry, w tym prywatnej korespondencji, do celów ustalania oraz ukarania osób naruszających Regulamin. Administracja nie odpowiada za treści umieszczane w profilach graczy oraz prowadzone przez nich sesje.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                <strong>Gra przeznaczona jest dla osób powyżej 18. roku życia.</strong> Gra może zawierać elementy przemocy, wulgarny język, zachowania seksualne, nawiązania do używek oraz przypadki dyskryminacji.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Gracze wprowadzają do gry treści oraz grafiki, których są autorami lub mogą korzystać z treści oraz grafik, których nie są autorami, wyłącznie w zakresie dozwolonym przez prawo lub na podstawie odpowiednich licencji. Administracja w przypadku stwierdzenia łamania niniejszego punktu, skasuje nieuprawnione treści bądź grafiki, a także może usunąć konto gracza i uniemożliwić graczowi korzystanie z gry.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Każdy gracz zobowiązany jest do niezwłocznego zgłoszenia administracji wykrytych błędów w zakresie działania gry, w tym mechaniki gry. Wykorzystywanie powyższych błędów karane będzie usunięciem przez administrację konta gracza oraz uniemożliwieniem graczowi korzystania z gry.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Każdy z graczy może posiadać maksymalnie jedno konto w grze. Umożliwia się tworzenie w grze dodatkowych postaci na jednym/głównym koncie. Gracze współdzielący jeden adres IP zobowiązani są do niezwłocznego poinformowania Technicznego (ID 1). Wszelkich zgłoszeń dotyczących multikont oraz współdzielenia adresu IP należy dokonywać przez pocztę w grze oraz stosowną informację w profilu. Karą za nieprzestrzeganie niniejszego punktu jest usunięcie wszystkich powiązanych kont oraz, w przypadku recydywy, uniemożliwienie graczowi korzystania z gry.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Gracz może złożyć wniosek o przywrócenie usuniętego konta w terminie 3 dni od jego usunięcia. Konto zostanie przywrócone, jeśli zostało usunięte wskutek błędu Administracji. Konta usunięte wskutek awarii, na którą Administracja gry nie miała wpływu, lub nieprzestrzegania Regulaminu nie będą przywracane w żadnym wypadku. Po upływie powyższego terminu Techniczny nie będzie miał możliwości przywrócenia konta w żadnym wypadku.
              </Typography></li>
            </Box>

            <Typography variant="h6" sx={{ mb: 1.5, mt: 2, fontSize: '1rem', fontWeight: 'bold' }}>
              Usuwanie kont
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.8 }}>
              Administracja usuwa konta:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>nieaktywowane przez graczy w ciągu 3 dni od ich utworzenia,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>nieuzupełnione o profil i awatar w ciągu 14 dni od ich utworzenia,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>porzucone bez wcześniejszego powiadomienia administracji na 6 miesiące lub dłużej bez możliwości ich przywrócenia.</Typography></li>
            </Box>

            <Typography variant="h6" sx={{ mb: 1.5, mt: 2, fontSize: '1rem', fontWeight: 'bold' }}>
              Zakazy
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.8 }}>
              Graczom zabrania się:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>szykanowania i obrażania innych graczy,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>spamowania (tzn. wysyłania innym graczom niepożądanej korespondencji lub wysyłania tej samej treści kilka razy),</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>działań mających na celu dezorganizację pracy twórców lub wpływających negatywnie na funkcjonowanie gry,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>wszelkich zachowań uznanych ogólnie za nieobyczajne lub sprzeczne z prawem.</Typography></li>
            </Box>

            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Reklamowanie innych produktów bez zgody Administracji, w szczególności innych gier, jest zabronione i karane usunięciem konta.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Naruszający Regulamin będą karani przez Administrację gry. Dodatkowo, w przypadku naruszenia przepisów powszechnie obowiązującego prawa na terenie Rzeczypospolitej Polskiej, może to zostać zgłoszone przez Administrację gry odpowiednim organom państwowym.
            </Typography>
          </Box>

          <Divider sx={{ my: 3, borderColor: theme.palette.text.secondary }} />

          {/* Postanowienia fabularne */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: theme.palette.warning.main }}>
              III. Postanowienia fabularne
            </Typography>

            <Typography variant="h6" sx={{ mb: 1.5, fontSize: '1rem', fontWeight: 'bold' }}>
              Imiona, przydomki i nazwiska postaci
            </Typography>
            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.8 }}>
              Imiona, przydomki i nazwiska postaci, awatary oraz profile <strong>powinny</strong>:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>odzwierciedlać płeć, rasę i wygląd postaci,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>być zgodne z realiami gry.</Typography></li>
            </Box>

            <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.8 }}>
              Nickiem autora jest nazwa głównej postaci. Na nazwę głównej postaci powinien składać się przydomek/pseudonim bądź jedno imię oraz nazwisko jednoczłonowe. Pozostałe informacje mogą być zawarte w profilu.
            </Typography>

            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.8 }}>
              Imiona, przydomki i nazwiska postaci, awatary oraz profile <strong>nie mogą</strong>:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                być plagiatem imienia, nazwiska, awatara lub profilu innego gracza - gracz może mieć tak samo na imię, przydomek, czy nazwisko, ale nie we wszystkich trzech przypadkach na raz, dana postać musi być możliwa do zidentyfikowania przez innych graczy,
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>być plagiatami ze świata kultury, sztuki i mediów lub zawierać jednoznacznych do nich odniesień,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                awatary w szczególności nie mogą przedstawiać wizerunków postaci, osób znanych i rozpoznawalnych,
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>awatary mogą być grafikami, zdjęciami lub pracami własnymi,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                za użycie materiałów bez zgody autora, właściciela, powodujących naruszenie praw autorskich odpowiada gracz, który umieszcza wskazane treści w profilu na własną odpowiedzialność,
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                awatary nie mogą się dublować (chyba że korzystający z grafiki obopólnie wyrażą na to zgodę), zaś dany awatar może być wykorzystywany przez osobę, która pierwsza go wgrała; okres "przynależności" awataru przedłuża się na okres miesiąca od zmiany go na inny.
              </Typography></li>
            </Box>

            <Typography variant="h6" sx={{ mb: 1.5, mt: 2, fontSize: '1rem', fontWeight: 'bold' }}>
              Sesje fabularne
            </Typography>
            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Osoby uczestniczące w sesjach fabularnych na Rozdrożach i w Dziejach zobowiązane są do klimatycznego zachowania, a także do wypowiadania się w sposób czytelny, zgodny z zasadami ortografii i interpunkcji. Gracze nieprzestrzegający powyższych reguł mogą zostać ukarani środkami dostępnymi wyznaczonym do tego osobom rangowym.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Podczas gry w sesjach publicznych oraz w karczmie, które są ogólnodostępne, mogą pojawić się zachowania nieobyczajne, zawierające przemoc, dotykające tematu dyskryminacji i używek. W przypadku planowanych przez Administrację eventów w karczmie/sesji publicznych stosuje się odpowiednie ostrzeżenia - w treści wieści bądź w innej formie, która dotrze do zainteresowanych graczy.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Gracz organizujący sesje publiczne lub eventy karczemne ma obowiązek oznaczyć je krótkimi informacjami, o tym, jakie mogą tam wystąpić treści wrażliwe (np. przemoc, seks, narkotyki).
              </Typography></li>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: theme.palette.text.secondary }} />

          {/* Więzienie */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: theme.palette.warning.main }}>
              IV. Więzienie
            </Typography>

            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Konto może zostać zablokowane czasowo poprzez wtrącenie postaci do więzienia, co jest czynnością stricte mechaniczną.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Do więzienia może postać wtrącić Techniczny bądź Stwórca, do nich należy podjęcie decyzji o czasie trwania wyroku. Administracja nie przewiduje możliwości skrócenia tego okresu.
              </Typography></li>
            </Box>

            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.8 }}>
              Do więzienia może zostać wtrącona postać gracza:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>wykorzystującego świadomie PG (powergaming),</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>zachowującego się nieobyczajnie w sesjach publicznych/karczmie jako gracz w stosunku do gracza,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>obrażającego, zniesławiającego bądź nękającego innego gracza w wiadomościach publicznych bądź prywatnych,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>umieszczającego treści seksistowskie, rasistowskie itp.,</Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8 }}>świadomie nie oznaczającego sesji otwartej czy eventu w karczmie oznaczeniami ostrzegającymi o występujących tam treściach wrażliwych.</Typography></li>
            </Box>

            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              <strong>Ważne:</strong> Postać nie zostanie wtrącona do więzienia za obrażanie, zniesławianie bądź czynną napaść na inną postać, czy bycie postacią o poglądach seksistowskich, rasistowskich, itp., o ile jest to odpowiednio osadzone w fabule/mające na celu rozwój fabularny postaci.
            </Typography>

            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Postać może zostać skazana fabularnie za swoje czyny i umieszczona fabularnie w Twierdzy, co nie jest równoznaczne z wtrąceniem mechanicznym postaci do więzienia.
            </Typography>
          </Box>

          <Divider sx={{ my: 3, borderColor: theme.palette.text.secondary }} />

          {/* Ochrona danych osobowych */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: theme.palette.warning.main }}>
              V. Ochrona danych osobowych
            </Typography>

            <Box component="ol" sx={{ pl: 3, mb: 2 }}>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Administratorem danych osobowych zawartych na stronie [ADRES_STRONY]/ jest Administrator Techniczny Gry (ID 1). Dane te nie będą przekazywane żadnym innym podmiotom.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Przetwarzanie danych gracza podanych w procesie rejestracji odbywa się za wyraźną, dobrowolną zgodą gracza. Administrator Techniczny Gry przetwarza dane zgodnie z właściwymi przepisami prawa obowiązującymi na terytorium Rzeczypospolitej Polskiej, w tym ustawą o ochronie danych osobowych. Baza danych osobowych graczy podlega ochronie prawnej. Każdy gracz ma prawo wglądu do swoich danych przetwarzanych przez administratora, posiada prawo do poprawiania tych danych oraz do żądania zaniechania ich przetwarzania poprzez usunięcie z bazy danych osobowych.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Dane zebrane podczas rejestracji do gry będą wykorzystywane wyłącznie w celu logowania gracza do konta lub wysłania e-mail w celu zmiany hasła.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                W przypadku gdy dane osobowe gracza, użyte przy rejestracji ulegną zmianie, istnieje możliwość wprowadzenia ich modyfikacji. W tym celu należy wprowadzić zmiany w ustawieniach użytkownika lub skontaktować się z Administratorem Technicznym Gry. Administrator Techniczny Gry zapewnia graczom możliwość modyfikacji danych osobowych poprzez zmianę adresu e-mail.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Administrator Techniczny Gry może wykorzystać adresy IP zbierane w trakcie połączeń internetowych w celach technicznych, związanych z usunięciem kont graczy łamiących postanowienia Regulaminu gry.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Administrator Techniczny Gry może wykorzystywać pliki cookies, które służą do identyfikacji przeglądarki internetowej podczas korzystania ze strony [ADRES_STRONY]/. Pliki te nie zawierają żadnych danych osobowych.
              </Typography></li>
              <li><Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
                Gracz może w każdej chwili usunąć swoje konto z [ADRES_STRONY]/ za pomocą ustawień konta lub poprzez kontakt z Administratorem Technicznym Gry. Usunięcie konta gracza powoduje usunięcie jego danych osobowych. Usunięcie konta gracza następuje na stałe i bezpowrotnie. Usunięcie konta powoduje, iż logowanie do gry i korzystanie z jej zasobów jest niemożliwe.
              </Typography></li>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: theme.palette.text.secondary }} />

          <Box sx={{ mt: 4, p: 2, backgroundColor: 'rgba(75, 85, 99, 0.3)', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ textAlign: 'center', color: theme.palette.text.secondary, fontStyle: 'italic' }}>
              Akceptując niniejszy Regulamin, oświadczasz, że zapoznałeś się z jego treścią i zobowiązujesz się do jego przestrzegania.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

export default Regulamin;
