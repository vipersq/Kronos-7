# KRONOS-7 · planetarny system wywiadowczy

Lokalny terminal w stylu komputerów pokładowych z filmów science fiction. Pokazuje **co, gdzie i dlaczego** dzieje się na świecie. Dane online pobiera sam, a analizę robi model AI działający na Twoim komputerze (Ollama lub LM Studio), bez chmury i bez kluczy API.

> **English:** KRONOS-7 is a local, retro sci-fi styled world-intelligence dashboard. It pulls news and open data feeds (shipping, outages, disasters, markets, satellites…), and a local LLM (auto-selected for your GPU via Ollama) clusters, rates and explains events in Polish. Run `start.bat` on Windows or `./start.sh` on Linux/macOS, then open http://127.0.0.1:7707. On first launch you set your operator callsign.

![Terminal](docs/screen-main.png)

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
- **aisstream.io**: cały świat w obserwowanych rejonach (Bałtyk, Morze Czarne, Zatoka Perska, Morze Czerwone, wschodnie Morze Śródziemne, Tajwan, Morze Południowochińskie, La Manche). Potrzebny jest darmowy klucz. Zaloguj się na https://aisstream.io przez GitHub, wejdź w **API Keys**, utwórz klucz i wklej go w oknie **OPERATOR**.

Przy statku widać:

- banderę (z MMSI), z oznaczeniem bander wygody;
- typ, cel podróży, wymiary i zanurzenie;
- prędkość i status (np. na kotwicy);
- link do MarineTraffic.

Panel liczy tankowce w każdym rejonie, osobno te pod rosyjską banderą i pod banderami wygody. Okręty zwykle wyłączają AIS.

Serwer pobiera dane na żywo tylko wtedy, gdy terminal jest otwarty w przeglądarce. Wyłączysz je w `config.json` (`live_air`, `live_sea`).

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

## Uwagi

- Wszystkie oceny (poziom napięcia, scenariusze, stan szlaków, łańcuch przyczyn) to hipotezy modelu AI, a nie oficjalne wskaźniki. Mniejsze modele częściej się mylą.
- Serwer nasłuchuje tylko na tym komputerze (127.0.0.1).
- Test bez AI: ustaw zmienną `KRONOS_MOCK=1`, a program użyje atrapy modelu.
- Biblioteki i mapy dołączone w `web/vendor/` mają własne licencje, opisane w [THIRD_PARTY.md](THIRD_PARTY.md).
- Treści z kanałów RSS i serwisów danych należą do ich wydawców. Program tylko je pobiera i streszcza na Twoim komputerze.
