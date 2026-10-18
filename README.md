# KRONOS-7 · planetarny system wywiadowczy (v3.1)

Lokalny terminal w stylu komputerów pokładowych z filmów science fiction. Pokazuje **co, gdzie i dlaczego** dzieje się na świecie. Dane online pobiera sam, a analizę robi model AI działający na Twoim komputerze.

## Instalacja (Windows)

Rozpakuj folder `kronos7` w dowolnym miejscu i uruchom **`start.bat`**. Skrypt sam:

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

## Co jest online, a co robi AI

**Feedy automatyczne (16, bez AI):** IMF PortWatch (ruch statków przez wąskie gardła, AIS), IODA (odcięcia internetu), adsb.lol (samoloty wojskowe), GDACS (alerty katastrof z torami cyklonów), CISA KEV (aktywnie wykorzystywane luki), NASA FIRMS (ogniska pożarów w rejonach walk), Launch Library 2 (starty), NBP (kursy złotego), GPSJam (zakłócenia GPS), WHO (ogniska chorób), NOAA NHC (huragany), ostrzeżenia podróżne USA i UK, OFAC (sankcje USA), ReliefWeb, Polymarket (prognozy rynkowe) i CelesTrak (stacja Tiangong).

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

Dane startowe w paczce to odczyt z 18.10.2026, 14:33. Pierwsza analiza na Twoim komputerze zacznie od nich.

## Funkcje terminala

- Mapa 2D z powiększaniem (kółko myszy, teatry działań: Ukraina, Morze Czarne, flanka NATO, Bliski Wschód, Ormuz, Jemen, Lewant, Sudan, Kongo, Mjanma, Tajwan, Zachodni Pacyfik) albo globus 3D. Przy zbliżeniu włącza się dokładniejsza linia brzegowa.
- 19 warstw: konflikty, fronty, natarcia, uderzenia, siły, żegluga, natura, orbity, lotnictwo, flanka, atom, przestrzeń, GNSS, pożary, sieć, humanitarne, cyber, depesze, noc.
- **Łańcuch przyczyn:** kliknij węzeł, a zobaczysz ścieżkę przyczyn i skutków.
- **Co nowego:** nowe depesze, zmiany statusu konfliktów i nowe zagrożenia od poprzedniego odczytu.
- **Trend napięcia** i **archiwum** wszystkich odczytów (rozwijana lista ARCHIWUM).
- **Briefing głosowy:** potrzebny jest polski głos w Windows (Ustawienia → Czas i język → Mowa → dodaj głos „Polski”).
- **Tryb ekranu:** pełny ekran z pokazem slajdów co 20 sekund, np. na XENEON EDGE. Wyjście klawiszem Esc.
- Zapytania do systemu, SITREP dla regionu, filtr „tylko A–B / 1–3”, oznaczanie przeczytanych i obserwowanych.

## Pliki

- `data/state.json` – bieżący odczyt
- `data/archive/` – kopie każdego odczytu (ostatnie 120)

Na start dołączony jest odczyt z 18.10.2026, żeby terminal nie był pusty przed pierwszą analizą.

## Uwagi

- Wszystkie oceny (poziom napięcia, scenariusze, stan szlaków, łańcuch przyczyn) to hipotezy modelu AI, a nie oficjalne wskaźniki. Mniejsze modele częściej się mylą.
- Serwer nasłuchuje tylko na tym komputerze (127.0.0.1).
- Test bez AI: ustaw zmienną `KRONOS_MOCK=1`, a program użyje atrapy modelu.
