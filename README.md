# KRONOS-7 · planetarny system wywiadowczy

Lokalny terminal w stylu komputerów pokładowych z filmów science fiction. Pokazuje **co, gdzie i dlaczego** dzieje się na świecie. Dane online pobiera sam, a analizę robi model AI działający na Twoim komputerze (Ollama lub LM Studio), bez chmury i bez kluczy API.

> **English:** the whole interface and the AI output can be switched to English in the OPERATOR window (or on the first-run screen). KRONOS-7 is a local, retro sci-fi styled world-intelligence dashboard. It pulls news and open data feeds (shipping, outages, disasters, markets, satellites…), and a local LLM (auto-selected for your GPU via Ollama) clusters, rates and explains events in Polish. Run `start.bat` on Windows or `./start.sh` on Linux/macOS, then open http://127.0.0.1:7707. On first launch you set your operator callsign.

![Terminal](docs/screen-main.png)

## Nowe w v3.9

- **Satelity:** kliknięcie satelity pokazuje kartę: rodzaj i misję, właściciela i operatora, datę i miejsce startu, orbitę (apogeum, perygeum, okres, nachylenie), opis z Wikipedii, częstotliwości nadajników z bazy SatNOGS oraz przycisk **WYJAŚNIJ (AI)**. Na mapie widać ślad podsatelitarny (−15…+90 min) i zasięg widoczności.
- **Przeloty nad QTH** (panel pod SITREP): AOS/LOS, maksymalna elewacja, azymuty, przesunięcie Dopplera dla częstotliwości, oznaczenie przelotów widocznych gołym okiem i alarm przed przelotem. Lokalizację (lokator Maidenhead albo współrzędne) wpisujesz w oknie OPERATOR; domyślnie IO91. Obliczenia idą w osobnym wątku przeglądarki.
- **Lotnictwo:** wykrywanie samolotów krążących po orbicie (rozpoznanie, tankowanie, patrol) – przerywany okrąg na mapie i lista „Krążące teraz” w panelu NIEBO. **ODTWÓRZ** (przy mapie) cofa mapę do 48 h wstecz: samoloty co minutę, okręty, tankowce i statki z sankcjami co 10 minut. NOTAM-ów nie ma, bo wszystkie sensowne źródła wymagają płatnych kluczy.
- **Morze:** statki z listy sankcji OFAC (dopasowanie po IMO), „ciemne” statki (przestały nadawać AIS w obserwowanych rejonach), możliwe przeładunki STS (dwa tankowce burta w burtę), statki stojące nad kablami podmorskimi; warstwa **KABLE** (submarinecablemap.com). Wyróżnienia na mapie i listy w panelu STATKI; w FILTRACH opcja „tylko podejrzane”.
- **Historia i raport:** baza `data/history.db` (SQLite) – wskaźniki co godzinę (rok), zdarzenia (90 dni), pozycje (48 h). Panel **HISTORIA** z wykresami (24 h, 7 dni, 30 dni, rok) i przycisk **RAPORT DZIENNY** – strona do wydruku lub zapisu jako PDF.
- **Powiadomienia na telefon** przez Telegram (bot) lub Discord (webhook): wzrost napięcia, briefing, krążące samoloty, kody alarmowe, sankcje, STS, kable, „ciemne” statki, przeloty satelitów. Rodzaje wybierasz w oknie OPERATOR, przycisk **WYŚLIJ TEST** sprawdza połączenie. Limit: 1 wiadomość na 5 s i 40 na godzinę.
- **Licznik do następnej analizy AI** w nagłówku – widać, kiedy karta graficzna będzie zajęta.
- **AUTO-ZOOM** – przełącznik przy mapie; wyłączony nie przybliża mapy po kliknięciu obiektu.
- **XENEON EDGE (2560×720):** w oknie EKRAN tryb panoramiczny (mapa, szczegóły i status w jednym rzędzie) albo osobne okno 2560×720 do przeciągnięcia na ten ekran.
- **Telefon i tablet:** w oknie OPERATOR możesz udostępnić terminal w sieci domowej (z PIN-em, po ponownym uruchomieniu). Na telefonie „Dodaj do ekranu głównego” tworzy ikonę jak aplikacja. Ustawienia da się zmieniać tylko na komputerze.
- **Polecenia głosowe** (przycisk GŁOS albo Alt+V), np. „sitrep Bałtyk”, „pokaż Ormuz”, „odśwież”, „briefing”, „odtwórz”, „na żywo”, „warstwa kable”, „pełny ekran”; wszystko inne trafia jako pytanie do AI. W Chrome i Edge rozpoznawanie mowy przetwarzają serwery Google/Microsoft.
- Wydajność: mapa rysowana na płótnie, obliczenia orbit i przelotów w osobnym wątku, zapis historii w tle.

## Bezpieczeństwo morskie (v3.12)

Panel **BEZPIECZEŃSTWO MORSKIE** i warstwa mapy **INCYDENTY MORSKIE**: piractwo, ataki, porwania, abordaże oraz ostrzeżenia nawigacyjne (miny, zakłócenia GNSS, strzelania i starty rakiet, zamknięte akweny). Źródła, wszystkie oficjalne i bez kluczy, sprawdzane co 30 minut:

| Źródło | Co daje | Zasięg |
|---|---|---|
| NGA MSI (USA) | ostrzeżenia NAVAREA, HYDROLANT, HYDROPAC z pozycją i obszarem | cały świat |
| UKHO (Wielka Brytania) | ostrzeżenia radiowe NAVAREA I i przybrzeżne UK | północno-wschodni Atlantyk, UK |
| IMB Piracy Reporting Centre (ICC) | incydenty piractwa i rabunku z pozycją | cały świat |
| ReCAAP ISC | incydenty z pozycją, statkiem i opisem | Azja |
| EUNAVFOR ATALANTA | komunikaty operacji UE | Somalia, Zatoka Adeńska |
| MARAD MSCI (USA) | ostrzeżenia i porady dla żeglugi | strefy ryzyka |

- **Bez powtórzeń:** ten sam incydent zgłoszony przez kilka źródeł (np. IMB i ReCAAP) jest pokazywany raz, z listą wszystkich zgłoszeń. Łączenie robi program (ten sam statek, numer ostrzeżenia, miejsce i czas), a w wątpliwych przypadkach decyduje lokalne AI. Powiadomienia też idą tylko raz.
- **Analiza AI:** każde zgłoszenie z ostatnich 30 dni lokalne AI czyta tylko raz: pisze krótki tytuł i streszczenie, ustala rodzaj i wagę (1–5). Robi to porcjami i nie wtedy, gdy trwa główna analiza. Incydenty z ostatniego tygodnia trafiają do briefingu i oceny poziomu napięcia.
- Karta incydentu: streszczenie, oryginalne zgłoszenia z linkami, statek, pozycja; dla świeżych zdarzeń przycisk odtworzenia ruchu statków i samolotów z tej chwili. Ostrzeżenia pokazują swój obszar na mapie.
- Powiadomienia Telegram/Discord (rodzaj „Incydent bezpieczeństwa morskiego”), licznik w HISTORII i na Stream Decku (wtyczka 1.1).
- Na razie bez UKMTO (do zrobienia osobno). MDAT-GoG (Zatoka Gwinejska), IFC-IOR (Ocean Indyjski) i EUNAVFOR ASPIDES nie mają danych do automatycznego pobierania albo nie dało się ich sprawdzić. MARAD bywa blokowany przez zaporę serwera – wtedy w panelu widać „✕” przy tym źródle.

## Dźwięki i głos lektora (v3.11)

**OPERATOR → DŹWIĘKI I GŁOS LEKTORA…**

- **Głos lektora** (briefing, SITREP): zamiast słabego głosu przeglądarki KRONOS może czytać lokalnym neuronowym syntezatorem **Piper** – działa offline na procesorze, nie zajmuje karty graficznej i ma dobre polskie głosy (Darkman, Gosia, MC Speech) oraz brytyjskie (Alan, Northern English, Cori, Alba). Kliknij **POBIERZ** przy głosie: program (ok. 25 MB) i głos (ok. 60 MB) ściągną się same do `data/tts`. Do tego tempo czytania i efekt „komputera pokładowego” (pasmo radiowe i metaliczny pogłos). Bez Pipera można wybrać dowolny głos przeglądarki – w Edge najlepiej brzmią głosy „Online (Natural)”.
- **Własne dźwięki:** każde zdarzenie – start, koniec analizy, wzrost napięcia, syrena PRIORYTET JEDEN, nowy kontakt, alarm squawk/AIS-SART, sankcje/STS/kable, przelot satelity, przyciski, dalekopis, praca rdzenia AI, szum tła – może grać Twój plik (MP3, WAV, OGG, M4A, FLAC, do 15 MB), wbudowany syntezator albo nic. Każdy ma osobną głośność i przycisk odsłuchu. Pliki wgrywasz przeciągając je do okna albo wrzucasz do `data/sounds`.

## Stream Deck (v3.10)

Wtyczka w `streamdeck/dist/com.vipersq.kronos7.streamDeckPlugin` – kliknij plik dwa razy, a aplikacja Stream Deck sama ją zainstaluje (wymaga Stream Deck 6.4 lub nowszego). Akcje pojawią się w kategorii **KRONOS-7**. Przyciski działają, gdy KRONOS jest uruchomiony, a polecenia mapy i głosu – gdy terminal jest otwarty w przeglądarce (może być w tle albo na innym monitorze).

| Akcja | Co pokazuje | Naciśnięcie |
|---|---|---|
| Poziom napięcia | 1–5 z kolorem, przy 5 miga | otwiera terminal |
| Analiza AI | odliczanie do analizy; w trakcie postęp % (GPU zajęte) | uruchamia analizę |
| Teatr działań | nazwa regionu, podświetlony gdy aktywny | przybliża mapę |
| Warstwa mapy | WŁ./WYŁ. | przełącza warstwę |
| Licznik kontaktów | samoloty, rozpoznanie, tankowce, bombowce, krążące, statki, okręty, sankcje, „ciemne”, STS, kable; miga przy nowym kontakcie | pokazuje ostatni kontakt na mapie |
| Przelot satelity | odliczanie do najbliższego przelotu nad QTH, AOS/LOS, elewacja | pokazuje satelitę |
| Polecenie | briefing, SITREP (z regionem), pytanie do AI, stop, odśwież, PRIORYTET JEDEN, globus, AUTO-ZOOM, odtwarzanie, zoom, widok, kontakt, audio, głos, raport, terminal | wykonuje polecenie |
| Pokrętło (Stream Deck +) | zoom mapy, odtwarzanie 48 h albo wybór teatru – na ekranie dotykowym | obrót / naciśnięcie / dotyk |

Ustawienia przycisku (region, warstwa, licznik, polecenie, tryb pokrętła, adres serwera) są w panelu pod przyciskiem w aplikacji Stream Deck; tam też jest **SPRAWDŹ POŁĄCZENIE**. Żółty trójkąt na przycisku oznacza, że terminal nie jest otwarty albo serwer nie działa.

Polecenia można też wysyłać z innych programów: `http://127.0.0.1:7707/api/cmd?do=theater&arg=hz` (do: theater, layer, zoom, replay, briefing, sitrep, ask, stop, globe, autozoom, alert, audio, view, event, sat, voice, refresh). Stan dla przycisków: `/api/deck`.

Budowanie wtyczki ze źródeł: `cd streamdeck && npm install && npm run pack`.

## Szybki start

```
git clone https://github.com/vipersq/Kronos-7.git
cd Kronos-7
start.bat            (Windows)
./start.sh           (Linux / macOS, wymaga python3 i ollama)
```

Albo pobierz ZIP (zielony przycisk **Code → Download ZIP**), rozpakuj i uruchom `start.bat`.

## Operator

Przy pierwszym uruchomieniu terminal pyta o **identyfikator operatora**: znak wywoławczy, pseudonim albo inicjały (1–20 znaków).

![Pierwsze uruchomienie](docs/screen-setup.png)

Później zmienisz go przyciskiem **OPERATOR** w nagłówku. Tam ustawisz też:

- jak system ma się do Ciebie zwracać (np. imię, używane w powitaniu i briefingu);
- do 3 godzin automatycznej analizy (domyślnie 05:50 i 17:50);
- model AI: automatyczny dobór albo jeden z zainstalowanych;
- czy pobierać zalecany model automatycznie.

Ustawienia trafiają do `data/settings.json`. Ten plik nie jest w repozytorium, więc `git pull` ich nie nadpisze. Ustawienia z tego pliku mają pierwszeństwo przed `config.json`.

## Instalacja (Windows)

Uruchom **`start.bat`**. Skrypt sam:

1. sprawdzi Pythona, a jeśli go nie ma, zapyta o zgodę i zainstaluje Pythona 3.12 (przez winget);
2. doinstaluje dodatki pycountry i h3;
3. sprawdzi Ollamę (silnik lokalnego AI), a jeśli jej nie ma, zapyta o zgodę i ją zainstaluje: przez winget albo instalatorem z ollama.com;
4. uruchomi serwer i otworzy terminal pod adresem http://127.0.0.1:7707;
5. pobierze model AI dobrany do karty graficznej (na RTX 5080: qwen3:14b, ok. 9 GB, jednorazowo), a potem od razu zrobi pierwszą analizę. Postęp widać na pasku pod nagłówkiem.

Jeśli odmówisz instalacji Ollamy, terminal działa bez analizy AI, a pytanie nie wraca. Aby przywrócić pytanie, usuń plik `data\.no_ollama`. Automatyczne pobieranie modelu wyłączysz w `config.json` (`"auto_pull": false`).

Potem system odświeża się sam o 5:50 i 17:50, a analizę można też uruchomić przyciskiem **ODŚWIEŻ ANALIZĘ**.

## Dobór modelu do sprzętu

Przy starcie program sprawdza kartę graficzną (VRAM przez `nvidia-smi`, a dla AMD i Intela przez rejestr Windows) oraz pamięć RAM. Na tej podstawie wybiera model:

| VRAM            | Model        | Rozmiar |
|-----------------|--------------|---------|
| 24 GB i więcej  | qwen3:32b    | 20 GB   |
| 14–23 GB        | qwen3:14b    | 9,3 GB  |
| 8–13 GB         | qwen3:8b     | 5,2 GB  |
| 5–7 GB          | qwen3:4b     | 2,6 GB  |
| bez GPU         | według RAM: 8b / 4b / 1.7b na procesorze |

Na RTX 5080 (16 GB) wybór padnie na **qwen3:14b**. Jeśli masz już zainstalowany inny model, który mieści się w pamięci, program użyje go od razu, a w panelu zaproponuje pobranie zalecanego. Zamiast Ollamy możesz używać LM Studio (serwer na porcie 1234), które jest wykrywane automatycznie.

Ustawienia są w `config.json`:
- `"model": "auto"` możesz zamienić na konkretną nazwę, np. `"gemma3:12b"`.
- `model_catalog` to tabela powyżej. Gdy pojawią się nowsze modele, wystarczy dopisać je tutaj.
- `refresh_times` to godziny briefingów.
- `feeds` to źródła wiadomości z oceną wiarygodności.

## Na żywo: samoloty i statki

**Samoloty wojskowe** (warstwa LOTNICTWO, panel NIEBO) odświeżają się co 10 sekund z adsb.fi, a zapasowo z adsb.lol. Oba serwisy są darmowe i nie wymagają klucza. Między odczytami samolot płynie po mapie według kursu i prędkości. Za samolotem widać trasę z ostatnich 30 minut. Po kliknięciu pojawiają się:

- kraj (z adresu ICAO);
- model i operator;
- rok produkcji;
- wysokość, prędkość i kurs;
- wiek pozycji.

Rozpoznanie, tankowce i bombowce są wyróżnione kolorem. Gdy taki samolot wleci w obserwowany rejon (Morze Czarne, Bałtyk, Polska, Ormuz, Morze Czerwone, Tajwan i inne), pojawia się komunikat i sonarowy sygnał. Samoloty z wyłączonym transponderem nie są widoczne. Dotyczy to zwykle maszyn bojowych nad Ukrainą i Rosją.

**Statki** (warstwa STATKI, panel STATKI) pochodzą z dwóch źródeł:

- **Digitraffic** (Finlandia): bez klucza, ale obejmuje tylko północny Bałtyk.
- **aisstream.io**: cały świat (albo tylko obserwowane rejony, do wyboru w oknie OPERATOR). Potrzebny jest darmowy klucz. Zaloguj się na https://aisstream.io przez GitHub, wejdź w **API Keys**, utwórz klucz i wklej go w oknie **OPERATOR**.

Przy statku widać:

- banderę (z MMSI), z oznaczeniem bander wygody;
- typ, cel podróży, wymiary i zanurzenie;
- prędkość i status (np. na kotwicy);
- link do MarineTraffic.

Panel liczy tankowce w każdym rejonie, osobno te pod rosyjską banderą i pod banderami wygody. Okręty zwykle wyłączają AIS.

Statki są pamiętane przez 6 godzin od ostatniego sygnału. Program zapisuje je na dysk (`data/ships.json.gz`), więc po restarcie mapa nie jest pusta. Starsze niż godzina pozycje są wyblakłe.

Statki, samoloty i chmury satelitów są rysowane na jednej warstwie graficznej, więc mapa płynnie pokazuje nawet kilkadziesiąt tysięcy obiektów. Najechanie myszą pokazuje nazwę, a kliknięcie otwiera szczegóły. Przycisk **FILTRY** przy mapie wybiera:
- typy statków: wojskowe, straż, tankowce, towarowe, pasażerskie, rybackie, jachty i inne;
- rodzaje samolotów: rozpoznanie, tankowce, bombowce, transport, myśliwce;
- trasy i podpisy na mapie.

Serwer pobiera samoloty i Digitraffic tylko wtedy, gdy terminal jest otwarty w przeglądarce. Wyłączysz je w `config.json` (`live_air`, `live_sea`).

## Co jest online, a co robi AI

**Feedy automatyczne (16, bez AI):** IMF PortWatch (ruch statków przez wąskie gardła, AIS), IODA (odcięcia internetu), adsb.fi / adsb.lol (migawka samolotów wojskowych dla AI), GDACS (alerty katastrof z torami cyklonów), CISA KEV (aktywnie wykorzystywane luki), NASA FIRMS (ogniska pożarów w rejonach walk), Launch Library 2 (starty), NBP (kursy złotego), GPSJam (zakłócenia GPS), WHO (ogniska chorób), NOAA NHC (huragany), ostrzeżenia podróżne USA i UK, OFAC (sankcje USA), ReliefWeb, Polymarket (prognozy rynkowe) i CelesTrak (stacja Tiangong).

**Na żywo co 5 minut:** ropa Brent i WTI, gaz TTF i Henry Hub, złoto, pszenica, USD/PLN, EUR/USD, S&P 500, VIX, Bitcoin (Yahoo Finance, zapasowo Stooq).

**Wiadomości dla AI:** BBC, Al Jazeera, Guardian, DW, France 24, NPR, ONZ, Crisis Group, Kyiv Independent, Ukrinform, USNI News, Defense News, Breaking Defense, Notes from Poland, gCaptain, ReliefWeb, The Record, BleepingComputer, SpaceNews, Spaceflight Now, TechCrunch i The Verge. Do tego USGS (trzęsienia) i AMSAT (orbity).

**Programowo, bez AI:** łączenie wiadomości o tym samym zdarzeniu, liczenie niezależnych źródeł, ocena wiarygodności w skali Admiralicji (A–F dla źródła, 1–6 dla informacji), pozycje satelitów (SGP4), strefa nocy, zmiany od poprzedniego odczytu.

**Lokalne AI:**
- depesze po polsku z polem „dlaczego”;
- karty konfliktów z przyczynami, osią czasu i scenariuszami na 30 dni;
- **fronty** (opis sytuacji, nowe natarcia, zmiany kontroli miejscowości; samej linii frontu AI nie przesuwa);
- **noc nad Ukrainą** (drony, rakiety, zestrzelenia);
- **uderzenia dalekiego zasięgu**, **ruchy sił**, **wschodnia flanka NATO**;
- **przestrzeń powietrzna**, **obiekty jądrowe**, **sankcje**, **kryzysy humanitarne**, **gospodarka**;
- stan rozejmu USA–Iran, **żegluga** (z danymi PortWatch), kalendarz;
- łańcuch przyczyn, komentarz „dlaczego” do ruchów na rynkach, poziom napięcia, briefing głosowy, odpowiedzi na pytania i SITREP.

Każdy moduł dostaje bieżącą listę i świeże wiadomości, a zwraca tylko zmiany. Scalaniem i usuwaniem starych wpisów zajmuje się kod, nie model.

Dane startowe w repozytorium (`data/seed.json`) to odczyt z 18.10.2026, 14:33. Pierwsza analiza na Twoim komputerze zacznie od nich.

## Funkcje terminala

- Układ dopasowuje się do ekranu (od telefonu po 4K). Przycisk **EKRAN** pozwala ustawić:
  - szerokość: pełna, wyśrodkowana albo wąska;
  - wielkość tekstu i przycisków (60–170%);
  - wysokość mapy.

  **PEŁNY EKRAN** ukrywa pasek przeglądarki.
- **Język polski lub angielski:** wybierasz go w oknie **OPERATOR** albo na ekranie powitalnym.
  - Zmienia się cały interfejs, nazwy krajów, typy statków i samolotów oraz głos briefingu.
  - Po wybraniu angielskiego lokalne AI pisze po angielsku: briefing, SITREP, odpowiedzi, karty konfliktów. Dotyczy to następnych analiz; wcześniejsze odczyty zostają w języku, w którym powstały.
- **Odpinanie paneli:** przycisk ⧉ w nagłówku każdego panelu (mapa, depesze, rynki, niebo, statki, status itd.) otwiera go w osobnym oknie, które przeciągasz na inny monitor.
  - W Chrome i Edge, po zgodzie na „zarządzanie oknami”, okno otwiera się od razu na drugim ekranie, na całą jego powierzchnię.
  - Kliknięcie w depeszę albo pozycję w panelu przybliża mapę także w odpiętym oknie.
  - Przyciski **PRZYPNIJ** (w głównym oknie) albo **PRZYPNIJ Z POWROTEM** (w odpiętym) wracają panel na miejsce.
- **SATELITY**: wybór grup z katalogu CelesTrak (około 16 000 aktywnych). Grupy to m.in.:
  - wojskowe i rozpoznawcze (USA, Kosmos, Yaogan, SAR-Lupe i inne), obiekty niezidentyfikowane;
  - nawigacyjne (GPS, GLONASS, Galileo, BeiDou), meteorologiczne, obserwacji Ziemi;
  - Starlink, OneWeb, Kuiper, Qianfan.

  Grupy pojawiają się na mapie jako punkty, które można kliknąć. Wyszukiwarka pozwala przypiąć dowolnego satelitę: dostaje wtedy nazwę i trasę orbity. Katalog jest pobierany raz na 12 godzin.
- Mapa 2D z powiększaniem (kółko myszy, teatry działań: Ukraina, Morze Czarne, flanka NATO, Bliski Wschód, Ormuz, Jemen, Lewant, Sudan, Kongo, Mjanma, Tajwan, Zachodni Pacyfik) albo globus 3D. Przy zbliżeniu włącza się dokładniejsza linia brzegowa.
- 19 warstw: konflikty, fronty, natarcia, uderzenia, siły, żegluga, natura, orbity, lotnictwo, flanka, atom, przestrzeń, GNSS, pożary, sieć, humanitarne, cyber, depesze, noc.
- **Łańcuch przyczyn:** kliknij węzeł, a zobaczysz ścieżkę przyczyn i skutków.
- **Co nowego:** nowe depesze, zmiany statusu konfliktów i nowe zagrożenia od poprzedniego odczytu.
- **Trend napięcia** i **archiwum** wszystkich odczytów (rozwijana lista ARCHIWUM).
- **Dźwięk terminala** (przycisk AUDIO), w stylu komputerów pokładowych z kina SF lat 70.: przekaźniki przy rozruchu, dalekopis drukujący odpowiedzi, „bulgotanie” rdzenia podczas pracy AI, buczenie maszynowni, sonarowy sygnał kontaktu, syrena przy wzroście poziomu napięcia. Całość z pogłosem metalowego wnętrza. Wszystko generowane na żywo w przeglądarce, bez plików audio. Głośność i szum tła ustawisz w oknie OPERATOR.
- **Briefing głosowy:** potrzebny jest polski głos w Windows (Ustawienia → Czas i język → Mowa → dodaj głos „Polski”).
- **Tryb ekranu:** pełny ekran z pokazem slajdów co 20 sekund, np. na XENEON EDGE. Wyjście klawiszem Esc.
- Zapytania do systemu, SITREP dla regionu, filtr „tylko A–B / 1–3”, oznaczanie przeczytanych i obserwowanych.

## Pliki

- `data/seed.json` – dane startowe z repozytorium (odczyt z 18.10.2026), żeby terminal nie był pusty przed pierwszą analizą
- `data/state.json` – Twój bieżący odczyt (lokalny, poza gitem)
- `data/archive/` – kopie każdego odczytu, ostatnie 120 (lokalne)
- `data/settings.json` – ustawienia operatora (lokalne)
- `data/marsec.json` – incydenty i ostrzeżenia morskie z analizą AI (lokalne)
- `data/sounds/` – Twoje pliki dźwiękowe; `data/tts/` – program Piper i pobrane głosy
- `data/history.db` – historia: pozycje, wskaźniki i zdarzenia (lokalne)
- `data/satinfo/`, `data/tle/`, `data/cables.json`, `data/ofac_vessels.json` – pamięć podręczna danych (lokalne)

## Uwagi

- Wszystkie oceny (poziom napięcia, scenariusze, stan szlaków, łańcuch przyczyn) to hipotezy modelu AI, a nie oficjalne wskaźniki. Mniejsze modele częściej się mylą.
- Serwer nasłuchuje tylko na tym komputerze (127.0.0.1), chyba że włączysz dostęp z sieci lokalnej (wtedy wymaga PIN-u).
- Test bez AI: ustaw zmienną `KRONOS_MOCK=1`, a program użyje atrapy modelu.
- Biblioteki i mapy dołączone w `web/vendor/` mają własne licencje, opisane w [THIRD_PARTY.md](THIRD_PARTY.md).
- Treści z kanałów RSS i serwisów danych należą do ich wydawców. Program tylko je pobiera i streszcza na Twoim komputerze.
