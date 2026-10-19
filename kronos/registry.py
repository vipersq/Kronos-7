"""Słowniki identyfikacji: kraj z adresu ICAO samolotu, bandera z MMSI statku,
nazwy typów samolotów wojskowych, prefiksy znaków wywoławczych, typy statków AIS."""

# --- bloki adresów ICAO 24-bit przydzielone państwom (ICAO Annex 10, t. III)
_ICAO = """
004000 0043FF Zimbabwe|006000 006FFF Mozambik|008000 00FFFF RPA|010000 017FFF Egipt|018000 01FFFF Libia|020000 027FFF Maroko
028000 02FFFF Tunezja|030000 0303FF Botswana|032000 032FFF Burundi|034000 034FFF Kamerun|038000 038FFF Kongo|03E000 03EFFF Gabon
040000 040FFF Etiopia|042000 042FFF Gwinea Równikowa|044000 044FFF Ghana|046000 046FFF Gwinea|04C000 04CFFF Kenia|050000 050FFF Liberia
054000 054FFF Madagaskar|058000 058FFF Malawi|05C000 05CFFF Mali|060000 0603FF Mauretania|062000 062FFF Niger|064000 064FFF Nigeria
068000 068FFF Uganda|06A000 06A3FF Katar|06C000 06CFFF Rep. Środkowoafrykańska|06E000 06EFFF Rwanda|070000 070FFF Senegal
078000 078FFF Somalia|07C000 07CFFF Sudan|080000 080FFF Tanzania|084000 084FFF Czad|088000 088FFF Togo|08A000 08AFFF Zambia
08C000 08CFFF DR Konga|090000 090FFF Angola|094000 0943FF Benin|09A000 09AFFF Gambia|09C000 09CFFF Burkina Faso|0A0000 0A7FFF Algieria
0A8000 0A8FFF Bahamy|0AC000 0ACFFF Kolumbia|0AE000 0AEFFF Kostaryka|0B0000 0B0FFF Kuba|0B4000 0B4FFF Salwador|0B8000 0B8FFF Gwatemala
0BC000 0BCFFF Haiti|0C0000 0C0FFF Honduras|0C4000 0C4FFF Jamajka|0C8000 0C8FFF Nikaragua|0CC000 0CCFFF Panama|0D0000 0D7FFF Meksyk
0D8000 0DFFFF Wenezuela|100000 1FFFFF Rosja|201000 2013FF Namibia|202000 2023FF Erytrea|300000 33FFFF Włochy|340000 37FFFF Hiszpania
380000 3BFFFF Francja|3C0000 3FFFFF Niemcy|400000 43FFFF Wielka Brytania|440000 447FFF Austria|448000 44FFFF Belgia|450000 457FFF Bułgaria
458000 45FFFF Dania|460000 467FFF Finlandia|468000 46FFFF Grecja|470000 477FFF Węgry|478000 47FFFF Norwegia|480000 487FFF Holandia
488000 48FFFF Polska|490000 497FFF Portugalia|498000 49FFFF Czechy|4A0000 4A7FFF Rumunia|4A8000 4AFFFF Szwecja|4B0000 4B7FFF Szwajcaria
4B8000 4BFFFF Turcja|4C0000 4C7FFF Serbia|4C8000 4C83FF Cypr|4CA000 4CAFFF Irlandia|4CC000 4CCFFF Islandia|4D0000 4D03FF Luksemburg
4D2000 4D2FFF Malta|4D4000 4D43FF Monako|500000 5003FF San Marino|501000 5013FF Albania|501C00 501FFF Chorwacja|502C00 502FFF Łotwa
503C00 503FFF Litwa|504C00 504FFF Mołdawia|505C00 505FFF Słowacja|506C00 506FFF Słowenia|507C00 507FFF Uzbekistan|508000 50FFFF Ukraina
510000 5103FF Białoruś|511000 5113FF Estonia|512000 5123FF Macedonia Płn.|513000 5133FF Bośnia i Hercegowina|514000 5143FF Gruzja
515000 5153FF Tadżykistan|516000 5163FF Czarnogóra|600000 6003FF Armenia|600800 600BFF Azerbejdżan|601000 6013FF Kirgistan
601800 601BFF Turkmenistan|680000 6803FF Bhutan|682000 6823FF Mongolia|683000 6833FF Kazachstan|700000 700FFF Afganistan
702000 702FFF Bangladesz|704000 704FFF Mjanma|706000 706FFF Kuwejt|708000 708FFF Laos|70A000 70AFFF Nepal|70C000 70C3FF Oman
70E000 70EFFF Kambodża|710000 717FFF Arabia Saudyjska|718000 71FFFF Korea Płd.|720000 727FFF Korea Płn.|728000 72FFFF Irak
730000 737FFF Iran|738000 73FFFF Izrael|740000 747FFF Jordania|748000 74FFFF Liban|750000 757FFF Malezja|758000 75FFFF Filipiny
760000 767FFF Pakistan|768000 76FFFF Singapur|770000 777FFF Sri Lanka|778000 77FFFF Syria|780000 7BFFFF Chiny|7C0000 7FFFFF Australia
800000 83FFFF Indie|840000 87FFFF Japonia|880000 887FFF Tajlandia|888000 88FFFF Wietnam|890000 890FFF Jemen|894000 894FFF Bahrajn
895000 8953FF Brunei|896000 896FFF ZEA|898000 898FFF Papua-Nowa Gwinea|899000 8993FF Tajwan|8A0000 8A7FFF Indonezja
A00000 AFFFFF USA|C00000 C3FFFF Kanada|C80000 C87FFF Nowa Zelandia|C88000 C88FFF Fidżi|E00000 E3FFFF Argentyna|E40000 E7FFFF Brazylia
E80000 E80FFF Chile|E84000 E84FFF Ekwador|E88000 E88FFF Paragwaj|E8C000 E8CFFF Peru|E90000 E90FFF Urugwaj|E94000 E94FFF Boliwia
"""
ICAO = sorted((int(a, 16), int(b, 16), n) for a, b, n in
              (x.strip().split(" ", 2) for x in _ICAO.replace("\n", "|").split("|") if x.strip()))

FLAGS = {"Polska": "🇵🇱", "USA": "🇺🇸", "Wielka Brytania": "🇬🇧", "Niemcy": "🇩🇪", "Francja": "🇫🇷", "Włochy": "🇮🇹", "Hiszpania": "🇪🇸",
         "Holandia": "🇳🇱", "Belgia": "🇧🇪", "Dania": "🇩🇰", "Norwegia": "🇳🇴", "Szwecja": "🇸🇪", "Finlandia": "🇫🇮", "Estonia": "🇪🇪",
         "Łotwa": "🇱🇻", "Litwa": "🇱🇹", "Rumunia": "🇷🇴", "Bułgaria": "🇧🇬", "Turcja": "🇹🇷", "Grecja": "🇬🇷", "Ukraina": "🇺🇦",
         "Rosja": "🇷🇺", "Kanada": "🇨🇦", "Czechy": "🇨🇿", "Słowacja": "🇸🇰", "Węgry": "🇭🇺", "Austria": "🇦🇹", "Szwajcaria": "🇨🇭",
         "Portugalia": "🇵🇹", "Izrael": "🇮🇱", "Iran": "🇮🇷", "Arabia Saudyjska": "🇸🇦", "ZEA": "🇦🇪", "Katar": "🇶🇦", "Chiny": "🇨🇳",
         "Japonia": "🇯🇵", "Korea Płd.": "🇰🇷", "Tajwan": "🇹🇼", "Australia": "🇦🇺", "Indie": "🇮🇳", "Pakistan": "🇵🇰", "NATO": "🏳",
         "Panama": "🇵🇦", "Liberia": "🇱🇷", "Wyspy Marshalla": "🇲🇭", "Malta": "🇲🇹", "Bahamy": "🇧🇸", "Cypr": "🇨🇾", "Singapur": "🇸🇬",
         "Hongkong": "🇭🇰", "Egipt": "🇪🇬", "Oman": "🇴🇲", "Kuwejt": "🇰🇼", "Bahrajn": "🇧🇭", "Jordania": "🇯🇴", "Irak": "🇮🇶", "Brazylia": "🇧🇷",
         "Irlandia": "🇮🇪", "Gruzja": "🇬🇪", "Białoruś": "🇧🇾", "Kazachstan": "🇰🇿", "Azerbejdżan": "🇦🇿", "Nowa Zelandia": "🇳🇿", "Meksyk": "🇲🇽"}


def icao_country(hexid, reg=""):
    if (reg or "").upper().startswith("LX-N"):
        return "NATO"                        # samoloty NATO (AWACS) są rejestrowane w Luksemburgu
    try:
        v = int(hexid.lstrip("~"), 16)
    except (ValueError, AttributeError):
        return ""
    lo, hi = 0, len(ICAO) - 1
    while lo <= hi:
        m = (lo + hi) // 2
        a, b, n = ICAO[m]
        if v < a:
            hi = m - 1
        elif v > b:
            lo = m + 1
        else:
            return n
    return ""


# --- typy samolotów wojskowych (kod ICAO → opis)
AC_TYPES = {
    "K35R": "Boeing KC-135R Stratotanker (tankowiec)", "K35E": "Boeing KC-135E Stratotanker (tankowiec)", "KC46": "Boeing KC-46A Pegasus (tankowiec)",
    "K46": "Boeing KC-46A Pegasus (tankowiec)", "KC10": "McDonnell Douglas KC-10 Extender (tankowiec)", "A332": "Airbus A330 / A330 MRTT (tankowiec lub transport VIP)",
    "MRTT": "Airbus A330 MRTT (tankowiec)", "R135": "Boeing RC-135 Rivet Joint / Cobra Ball (rozpoznanie elektroniczne)",
    "E3TF": "Boeing E-3 Sentry AWACS (wczesne ostrzeganie)", "E3CF": "Boeing E-3 Sentry AWACS (wczesne ostrzeganie)", "E6": "Boeing E-6B Mercury (łączność z okrętami podwodnymi)",
    "E7": "Boeing E-7 Wedgetail (wczesne ostrzeganie)", "P8": "Boeing P-8 Poseidon (patrol morski, ZOP)", "Q4": "Northrop Grumman RQ-4 Global Hawk (dron rozpoznawczy)",
    "RQ4": "Northrop Grumman RQ-4 Global Hawk (dron rozpoznawczy)", "Q9": "General Atomics MQ-9 Reaper (dron)", "MQ9": "General Atomics MQ-9 Reaper (dron)",
    "U2": "Lockheed U-2 Dragon Lady (rozpoznanie strategiczne)", "E8": "Northrop Grumman E-8 JSTARS (rozpoznanie naziemne)", "P3": "Lockheed P-3 Orion (patrol morski)",
    "E2": "Northrop Grumman E-2 Hawkeye (wczesne ostrzeganie)", "B52": "Boeing B-52 Stratofortress (bombowiec strategiczny)", "B1": "Rockwell B-1B Lancer (bombowiec)",
    "B2": "Northrop B-2 Spirit (bombowiec stealth)", "C17": "Boeing C-17 Globemaster III (transport strategiczny)", "C5M": "Lockheed C-5M Super Galaxy (transport strategiczny)",
    "C5": "Lockheed C-5 Galaxy (transport strategiczny)", "C30J": "Lockheed Martin C-130J Super Hercules (transport)", "C130": "Lockheed C-130 Hercules (transport)",
    "A400": "Airbus A400M Atlas (transport)", "C295": "Airbus C295 (transport)", "CN35": "Airbus CN-235 (transport, patrol)", "IL76": "Iljuszyn Ił-76 (transport)",
    "C27J": "Leonardo C-27J Spartan (transport)", "KC39": "Embraer KC-390 Millennium (transport, tankowiec)", "C2": "Kawasaki C-2 (transport)",
    "F35": "Lockheed Martin F-35 Lightning II (myśliwiec)", "F16": "General Dynamics F-16 Fighting Falcon (myśliwiec)", "F15": "Boeing F-15 Eagle (myśliwiec)",
    "F18": "Boeing F/A-18 Hornet (myśliwiec)", "F18S": "Boeing F/A-18E/F Super Hornet (myśliwiec)", "EUFI": "Eurofighter Typhoon (myśliwiec)",
    "RFAL": "Dassault Rafale (myśliwiec)", "F22": "Lockheed Martin F-22 Raptor (myśliwiec)", "GRIF": "Saab JAS 39 Gripen (myśliwiec)", "TOR": "Panavia Tornado",
    "H60": "Sikorsky UH-60 Black Hawk (śmigłowiec)", "H47": "Boeing CH-47 Chinook (śmigłowiec transportowy)", "V22": "Bell Boeing V-22 Osprey (zmiennowirnikowiec)",
    "EC35": "Airbus H135 (śmigłowiec)", "EC45": "Airbus H145 (śmigłowiec)", "NH90": "NHIndustries NH90 (śmigłowiec)", "A139": "Leonardo AW139 (śmigłowiec)",
    "G115": "Grob G 115 (szkolny)", "PC21": "Pilatus PC-21 (szkolny)", "PC9": "Pilatus PC-9 (szkolny)", "TEX2": "Beechcraft T-6 Texan II (szkolny)",
    "M346": "Leonardo M-346 Master (szkolny)", "HAWK": "BAE Hawk (szkolny)", "T38": "Northrop T-38 Talon (szkolny)", "BE20": "Beechcraft King Air 200 (łącznikowy)",
    "B350": "Beechcraft King Air 350 (łącznikowy, często rozpoznanie)", "GLF4": "Gulfstream IV (VIP lub rozpoznanie)", "GLF5": "Gulfstream V (VIP lub rozpoznanie)",
    "GLEX": "Bombardier Global Express (VIP lub rozpoznanie)", "B736": "Boeing 737-600", "B737": "Boeing 737-700 (transport VIP / C-40)", "B738": "Boeing 737-800",
    "B752": "Boeing 757-200 (transport VIP / C-32)", "B748": "Boeing 747-8 (VIP)", "B742": "Boeing 747-200 (VC-25 / E-4B)", "E35L": "Embraer Legacy 600",
    "TU95": "Tupolew Tu-95 (bombowiec strategiczny)", "T160": "Tupolew Tu-160 (bombowiec strategiczny)", "A50": "Beriew A-50 (wczesne ostrzeganie)",
}

# --- prefiksy znaków wywoławczych (pewne, szeroko znane)
CALLSIGNS = {
    "RCH": "USAF Air Mobility Command (REACH)", "NATO": "NATO (AWACS, Geilenkirchen)", "FORTE": "USAF – RQ-4 Global Hawk", "HOMER": "US Navy – P-8 Poseidon",
    "SPAR": "USAF – lot VIP rządu USA", "SAM": "USAF – Special Air Mission (VIP)", "RRR": "Royal Air Force", "ASCOT": "Royal Air Force – transport",
    "GAF": "Luftwaffe (Niemcy)", "CTM": "Armée de l'Air (Francja) – transport", "FAF": "Armée de l'Air (Francja)", "IAM": "Aeronautica Militare (Włochy)",
    "PLF": "Siły Powietrzne RP", "BAF": "Siły Powietrzne Belgii", "NAF": "Siły Powietrzne Holandii", "SVF": "Siły Powietrzne Szwecji", "HAF": "Siły Powietrzne Grecji",
    "CFC": "Królewskie Kanadyjskie Siły Powietrzne", "ASY": "Królewskie Australijskie Siły Powietrzne", "MMF": "NATO Multinational MRTT Fleet",
    "CNV": "US Navy", "PAT": "US Army – lot priorytetowy", "TUAF": "Siły Powietrzne Turcji", "RFF": "Siły Powietrzne Rosji",
}


def callsign_operator(cs, en=False):
    cs = (cs or "").upper()
    for k in sorted(CALLSIGNS, key=len, reverse=True):
        if cs.startswith(k):
            return (CALLSIGNS_EN if en else CALLSIGNS)[k]
    return ""


# --- MMSI: kod MID (pierwsze 3 cyfry) → bandera
_MID = """201 Albania|202 Andora|203 Austria|204 Portugalia (Azory)|205 Belgia|206 Białoruś|207 Bułgaria|208 Watykan|209 Cypr|210 Cypr|211 Niemcy
212 Cypr|213 Gruzja|214 Mołdawia|215 Malta|216 Armenia|218 Niemcy|219 Dania|220 Dania|224 Hiszpania|225 Hiszpania|226 Francja|227 Francja|228 Francja
229 Malta|230 Finlandia|231 Wyspy Owcze|232 Wielka Brytania|233 Wielka Brytania|234 Wielka Brytania|235 Wielka Brytania|236 Gibraltar|237 Grecja
238 Chorwacja|239 Grecja|240 Grecja|241 Grecja|242 Maroko|243 Węgry|244 Holandia|245 Holandia|246 Holandia|247 Włochy|248 Malta|249 Malta|250 Irlandia
251 Islandia|252 Liechtenstein|253 Luksemburg|254 Monako|255 Portugalia (Madera)|256 Malta|257 Norwegia|258 Norwegia|259 Norwegia|261 Polska
262 Czarnogóra|263 Portugalia|264 Rumunia|265 Szwecja|266 Szwecja|267 Słowacja|268 San Marino|269 Szwajcaria|270 Czechy|271 Turcja|272 Ukraina
273 Rosja|274 Macedonia Płn.|275 Łotwa|276 Estonia|277 Litwa|278 Słowenia|279 Serbia|301 Anguilla|303 USA (Alaska)|304 Antigua i Barbuda
305 Antigua i Barbuda|306 Curaçao|307 Aruba|308 Bahamy|309 Bahamy|310 Bermudy|311 Bahamy|312 Belize|314 Barbados|316 Kanada|319 Kajmany
321 Kostaryka|323 Kuba|325 Dominika|327 Dominikana|329 Gwadelupa|330 Grenada|331 Grenlandia|332 Gwatemala|334 Honduras|336 Haiti|338 USA
339 Jamajka|341 Saint Kitts i Nevis|343 Saint Lucia|345 Meksyk|347 Martynika|348 Montserrat|350 Nikaragua|351 Panama|352 Panama|353 Panama
354 Panama|355 Panama|356 Panama|357 Panama|358 Portoryko|359 Salwador|361 Saint-Pierre|362 Trynidad i Tobago|364 Turks i Caicos|366 USA|367 USA
368 USA|369 USA|370 Panama|371 Panama|372 Panama|373 Panama|374 Panama|375 Saint Vincent|376 Saint Vincent|377 Saint Vincent
378 Brytyjskie Wyspy Dziewicze|379 Wyspy Dziewicze USA|401 Afganistan|403 Arabia Saudyjska|405 Bangladesz|408 Bahrajn|410 Bhutan|412 Chiny|413 Chiny
414 Chiny|416 Tajwan|417 Sri Lanka|419 Indie|422 Iran|423 Azerbejdżan|425 Irak|428 Izrael|431 Japonia|432 Japonia|434 Turkmenistan|436 Kazachstan
437 Uzbekistan|438 Jordania|440 Korea Płd.|441 Korea Płd.|443 Palestyna|445 Korea Płn.|447 Kuwejt|450 Liban|451 Kirgistan|453 Makau|455 Malediwy
457 Mongolia|459 Nepal|461 Oman|463 Pakistan|466 Katar|468 Syria|470 ZEA|471 ZEA|472 Tadżykistan|473 Jemen|475 Jemen|477 Hongkong
478 Bośnia i Hercegowina|501 Francja (Antarktyda)|503 Australia|506 Mjanma|508 Brunei|510 Mikronezja|511 Palau|512 Nowa Zelandia|514 Kambodża
515 Kambodża|518 Wyspy Cooka|520 Fidżi|525 Indonezja|529 Kiribati|531 Laos|533 Malezja|536 Mariany Płn.|538 Wyspy Marshalla|540 Nowa Kaledonia
542 Niue|544 Nauru|546 Polinezja Francuska|548 Filipiny|550 Timor Wschodni|553 Papua-Nowa Gwinea|557 Wyspy Salomona|559 Samoa Amerykańskie|561 Samoa
563 Singapur|564 Singapur|565 Singapur|566 Singapur|567 Tajlandia|570 Tonga|572 Tuvalu|574 Wietnam|576 Vanuatu|577 Vanuatu|601 RPA|603 Angola
605 Algieria|609 Burundi|610 Benin|611 Botswana|612 Rep. Środkowoafrykańska|613 Kamerun|615 Kongo|616 Komory|617 Republika Zielonego Przylądka
619 Wybrzeże Kości Słoniowej|620 Komory|621 Dżibuti|622 Egipt|624 Etiopia|625 Erytrea|626 Gabon|627 Ghana|629 Gambia|630 Gwinea Bissau
631 Gwinea Równikowa|632 Gwinea|633 Burkina Faso|634 Kenia|636 Liberia|637 Liberia|638 Sudan Płd.|642 Libia|644 Lesotho|645 Mauritius
647 Madagaskar|649 Mali|650 Mozambik|654 Mauretania|655 Malawi|656 Niger|657 Nigeria|659 Namibia|660 Reunion|661 Rwanda|662 Sudan|663 Senegal
664 Seszele|665 Wyspa Świętej Heleny|666 Somalia|667 Sierra Leone|668 Wyspy Świętego Tomasza|669 Eswatini|670 Czad|671 Togo|672 Tunezja
674 Tanzania|675 Uganda|676 DR Konga|677 Tanzania|678 Zambia|679 Zimbabwe|701 Argentyna|710 Brazylia|720 Boliwia|725 Chile|730 Kolumbia
735 Ekwador|740 Falklandy|745 Gujana Francuska|750 Gujana|755 Paragwaj|760 Peru|765 Surinam|770 Urugwaj|775 Wenezuela"""
MID = {int(a): b for a, b in (x.strip().split(" ", 1) for x in _MID.replace("\n", "|").split("|") if x.strip())}
# bandery wygody – statek zwykle należy do armatora z innego kraju
FLAGS_OF_CONVENIENCE = {"Panama", "Liberia", "Wyspy Marshalla", "Malta", "Bahamy", "Cypr", "Antigua i Barbuda", "Saint Vincent", "Belize",
                        "Komory", "Gabon", "Kamerun", "Togo", "Sierra Leone", "Palau", "Tuvalu", "Wyspy Cooka", "Mongolia", "Gwinea Równikowa", "Eswatini"}


def mmsi_flag(mmsi):
    s = str(mmsi or "")
    if len(s) != 9 or not s.isdigit():
        return ""
    if s[0] in "234567":
        return MID.get(int(s[:3]), "")
    if s.startswith("8"):
        return MID.get(int(s[1:4]), "")     # urządzenia przenośne
    if s.startswith("00") or s.startswith("0"):
        return MID.get(int(s[2:5] if s.startswith("00") else s[1:4]), "")   # stacje brzegowe / grupy
    return ""


# --- typ statku z kodu AIS
def ship_type(code):
    try:
        c = int(code or 0)
    except (TypeError, ValueError):
        return ("other", "nieznany")
    if 80 <= c <= 89: return ("tanker", "tankowiec" + (" (ładunek niebezpieczny)" if c in (81, 82, 83, 84) else ""))
    if 70 <= c <= 79: return ("cargo", "statek towarowy" + (" (ładunek niebezpieczny)" if c in (71, 72, 73, 74) else ""))
    if 60 <= c <= 69: return ("passenger", "pasażerski / prom")
    if c == 35: return ("military", "okręt / jednostka wojskowa")
    if c == 55: return ("law", "jednostka straży / policji")
    if c == 30: return ("fishing", "kuter rybacki")
    if c == 51: return ("sar", "ratownictwo (SAR)")
    if c in (31, 32): return ("service", "holownik (holowanie)")
    if c == 52: return ("service", "holownik")
    if c == 50: return ("service", "pilotówka")
    if c == 33: return ("service", "pogłębiarka / roboty podwodne")
    if c == 34: return ("service", "jednostka nurkowa")
    if c == 53: return ("service", "jednostka portowa")
    if c == 54: return ("service", "zwalczanie zanieczyszczeń")
    if c == 58: return ("service", "transport medyczny")
    if c == 36: return ("pleasure", "jacht żaglowy")
    if c == 37: return ("pleasure", "jednostka rekreacyjna")
    if 40 <= c <= 49: return ("passenger", "jednostka szybka (HSC)")
    if 20 <= c <= 29: return ("other", "ekranoplan (WIG)")
    return ("other", "inny")


NAV_STATUS = {0: "w drodze (na silniku)", 1: "na kotwicy", 2: "bez napędu", 3: "ograniczona manewrowość", 4: "ograniczona zanurzeniem",
              5: "zacumowany", 6: "na mieliźnie", 7: "połów", 8: "w drodze (pod żaglami)", 14: "AIS-SART (alarm)", 15: "brak danych"}


# --- angielskie nazwy krajów (klucz: nazwa polska)
COUNTRY_EN = dict(x.split("=", 1) for x in """Afganistan=Afghanistan|Albania=Albania|Algieria=Algeria|Andora=Andorra|Angola=Angola|Anguilla=Anguilla|Antigua i Barbuda=Antigua and Barbuda
|Arabia Saudyjska=Saudi Arabia|Argentyna=Argentina|Armenia=Armenia|Aruba=Aruba|Australia=Australia|Austria=Austria|Azerbejdżan=Azerbaijan|Bahamy=Bahamas|Bahrajn=Bahrain
|Bangladesz=Bangladesh|Barbados=Barbados|Belgia=Belgium|Belize=Belize|Benin=Benin|Bermudy=Bermuda|Bhutan=Bhutan|Białoruś=Belarus|Boliwia=Bolivia|Botswana=Botswana
|Bośnia i Hercegowina=Bosnia and Herzegovina|Brazylia=Brazil|Brunei=Brunei|Brytyjskie Wyspy Dziewicze=British Virgin Islands|Burkina Faso=Burkina Faso|Burundi=Burundi
|Bułgaria=Bulgaria|Chile=Chile|Chiny=China|Chorwacja=Croatia|Curaçao=Curaçao|Cypr=Cyprus|Czad=Chad|Czarnogóra=Montenegro|Czechy=Czechia|DR Konga=DR Congo|Dania=Denmark
|Dominika=Dominica|Dominikana=Dominican Republic|Dżibuti=Djibouti|Egipt=Egypt|Ekwador=Ecuador|Erytrea=Eritrea|Estonia=Estonia|Eswatini=Eswatini|Etiopia=Ethiopia
|Falklandy=Falkland Islands|Fidżi=Fiji|Filipiny=Philippines|Finlandia=Finland|Francja=France|Francja (Antarktyda)=France (Antarctica)|Gabon=Gabon|Gambia=Gambia|Ghana=Ghana
|Gibraltar=Gibraltar|Grecja=Greece|Grenada=Grenada|Grenlandia=Greenland|Gruzja=Georgia|Gujana=Guyana|Gujana Francuska=French Guiana|Gwadelupa=Guadeloupe|Gwatemala=Guatemala
|Gwinea=Guinea|Gwinea Bissau=Guinea-Bissau|Gwinea Równikowa=Equatorial Guinea|Haiti=Haiti|Hiszpania=Spain|Holandia=Netherlands|Honduras=Honduras|Hongkong=Hong Kong|Indie=India
|Indonezja=Indonesia|Irak=Iraq|Iran=Iran|Irlandia=Ireland|Islandia=Iceland|Izrael=Israel|Jamajka=Jamaica|Japonia=Japan|Jemen=Yemen|Jordania=Jordan|Kajmany=Cayman Islands
|Kambodża=Cambodia|Kamerun=Cameroon|Kanada=Canada|Katar=Qatar|Kazachstan=Kazakhstan|Kenia=Kenya|Kirgistan=Kyrgyzstan|Kiribati=Kiribati|Kolumbia=Colombia|Komory=Comoros
|Kongo=Congo|Korea Płd.=South Korea|Korea Płn.=North Korea|Kostaryka=Costa Rica|Kuba=Cuba|Kuwejt=Kuwait|Laos=Laos|Lesotho=Lesotho|Liban=Lebanon|Liberia=Liberia|Libia=Libya
|Liechtenstein=Liechtenstein|Litwa=Lithuania|Luksemburg=Luxembourg|Macedonia Płn.=North Macedonia|Madagaskar=Madagascar|Makau=Macau|Malawi=Malawi|Malediwy=Maldives
|Malezja=Malaysia|Mali=Mali|Malta=Malta|Mariany Płn.=Northern Mariana Islands|Maroko=Morocco|Martynika=Martinique|Mauretania=Mauritania|Mauritius=Mauritius|Meksyk=Mexico
|Mikronezja=Micronesia|Mjanma=Myanmar|Monako=Monaco|Mongolia=Mongolia|Montserrat=Montserrat|Mozambik=Mozambique|Mołdawia=Moldova|NATO=NATO|Namibia=Namibia|Nauru=Nauru
|Nepal=Nepal|Niemcy=Germany|Niger=Niger|Nigeria=Nigeria|Nikaragua=Nicaragua|Niue=Niue|Norwegia=Norway|Nowa Kaledonia=New Caledonia|Nowa Zelandia=New Zealand|Oman=Oman
|Pakistan=Pakistan|Palau=Palau|Palestyna=Palestine|Panama=Panama|Papua-Nowa Gwinea=Papua New Guinea|Paragwaj=Paraguay|Peru=Peru|Polinezja Francuska=French Polynesia
|Polska=Poland|Portoryko=Puerto Rico|Portugalia=Portugal|Portugalia (Azory)=Portugal (Azores)|Portugalia (Madera)=Portugal (Madeira)|RPA=South Africa
|Rep. Środkowoafrykańska=Central African Republic|Republika Zielonego Przylądka=Cape Verde|Reunion=Réunion|Rosja=Russia|Rumunia=Romania|Rwanda=Rwanda
|Saint Kitts i Nevis=Saint Kitts and Nevis|Saint Lucia=Saint Lucia|Saint Vincent=Saint Vincent|Saint-Pierre=Saint-Pierre|Salwador=El Salvador|Samoa=Samoa
|Samoa Amerykańskie=American Samoa|San Marino=San Marino|Senegal=Senegal|Serbia=Serbia|Seszele=Seychelles|Sierra Leone=Sierra Leone|Singapur=Singapore|Somalia=Somalia
|Sri Lanka=Sri Lanka|Sudan=Sudan|Sudan Płd.=South Sudan|Surinam=Suriname|Syria=Syria|Szwajcaria=Switzerland|Szwecja=Sweden|Słowacja=Slovakia|Słowenia=Slovenia
|Tadżykistan=Tajikistan|Tajlandia=Thailand|Tajwan=Taiwan|Tanzania=Tanzania|Timor Wschodni=East Timor|Togo=Togo|Tonga=Tonga|Trynidad i Tobago=Trinidad and Tobago
|Tunezja=Tunisia|Turcja=Turkey|Turkmenistan=Turkmenistan|Turks i Caicos=Turks and Caicos|Tuvalu=Tuvalu|USA=USA|USA (Alaska)=USA (Alaska)|Uganda=Uganda|Ukraina=Ukraine
|Urugwaj=Uruguay|Uzbekistan=Uzbekistan|Vanuatu=Vanuatu|Watykan=Vatican|Wenezuela=Venezuela|Wielka Brytania=United Kingdom|Wietnam=Vietnam
|Wybrzeże Kości Słoniowej=Ivory Coast|Wyspa Świętej Heleny=Saint Helena|Wyspy Cooka=Cook Islands|Wyspy Dziewicze USA=US Virgin Islands|Wyspy Marshalla=Marshall Islands
|Wyspy Owcze=Faroe Islands|Wyspy Salomona=Solomon Islands|Wyspy Świętego Tomasza=São Tomé and Príncipe|Węgry=Hungary|Włochy=Italy|ZEA=UAE|Zambia=Zambia|Zimbabwe=Zimbabwe
|Łotwa=Latvia""".replace("\n", "").split("|"))

SHIP_KIND_EN = {"tankowiec": "tanker", "tankowiec (ładunek niebezpieczny)": "tanker (hazardous cargo)", "statek towarowy": "cargo ship",
                "statek towarowy (ładunek niebezpieczny)": "cargo ship (hazardous cargo)", "pasażerski / prom": "passenger / ferry",
                "okręt / jednostka wojskowa": "warship / military vessel", "jednostka straży / policji": "coast guard / police vessel", "kuter rybacki": "fishing vessel",
                "ratownictwo (SAR)": "search and rescue (SAR)", "holownik (holowanie)": "tug (towing)", "holownik": "tug", "pilotówka": "pilot boat",
                "pogłębiarka / roboty podwodne": "dredger / underwater works", "jednostka nurkowa": "diving vessel", "jednostka portowa": "port tender",
                "zwalczanie zanieczyszczeń": "anti-pollution", "transport medyczny": "medical transport", "jacht żaglowy": "sailing yacht", "jednostka rekreacyjna": "pleasure craft",
                "jednostka szybka (HSC)": "high-speed craft (HSC)", "ekranoplan (WIG)": "wing-in-ground craft (WIG)", "inny": "other", "nieznany": "unknown"}
NAV_STATUS_EN = {0: "under way (engine)", 1: "at anchor", 2: "not under command", 3: "restricted manoeuvrability", 4: "constrained by draught", 5: "moored",
                 6: "aground", 7: "fishing", 8: "under way (sail)", 14: "AIS-SART (alarm)", 15: "no data"}
AC_TYPES_EN = {
    "K35R": "Boeing KC-135R Stratotanker (tanker)", "K35E": "Boeing KC-135E Stratotanker (tanker)", "KC46": "Boeing KC-46A Pegasus (tanker)", "K46": "Boeing KC-46A Pegasus (tanker)",
    "KC10": "McDonnell Douglas KC-10 Extender (tanker)", "A332": "Airbus A330 / A330 MRTT (tanker or VIP transport)", "MRTT": "Airbus A330 MRTT (tanker)",
    "R135": "Boeing RC-135 Rivet Joint / Cobra Ball (signals intelligence)", "E3TF": "Boeing E-3 Sentry AWACS (airborne early warning)", "E3CF": "Boeing E-3 Sentry AWACS (airborne early warning)",
    "E6": "Boeing E-6B Mercury (submarine communications)", "E7": "Boeing E-7 Wedgetail (airborne early warning)", "P8": "Boeing P-8 Poseidon (maritime patrol, ASW)",
    "Q4": "Northrop Grumman RQ-4 Global Hawk (reconnaissance drone)", "RQ4": "Northrop Grumman RQ-4 Global Hawk (reconnaissance drone)", "Q9": "General Atomics MQ-9 Reaper (drone)",
    "MQ9": "General Atomics MQ-9 Reaper (drone)", "U2": "Lockheed U-2 Dragon Lady (strategic reconnaissance)", "E8": "Northrop Grumman E-8 JSTARS (ground surveillance)",
    "P3": "Lockheed P-3 Orion (maritime patrol)", "E2": "Northrop Grumman E-2 Hawkeye (airborne early warning)", "B52": "Boeing B-52 Stratofortress (strategic bomber)",
    "B1": "Rockwell B-1B Lancer (bomber)", "B2": "Northrop B-2 Spirit (stealth bomber)", "C17": "Boeing C-17 Globemaster III (strategic airlift)",
    "C5M": "Lockheed C-5M Super Galaxy (strategic airlift)", "C5": "Lockheed C-5 Galaxy (strategic airlift)", "C30J": "Lockheed Martin C-130J Super Hercules (transport)",
    "C130": "Lockheed C-130 Hercules (transport)", "A400": "Airbus A400M Atlas (transport)", "C295": "Airbus C295 (transport)", "CN35": "Airbus CN-235 (transport, patrol)",
    "IL76": "Ilyushin Il-76 (transport)", "C27J": "Leonardo C-27J Spartan (transport)", "KC39": "Embraer KC-390 Millennium (transport, tanker)", "C2": "Kawasaki C-2 (transport)",
    "F35": "Lockheed Martin F-35 Lightning II (fighter)", "F16": "General Dynamics F-16 Fighting Falcon (fighter)", "F15": "Boeing F-15 Eagle (fighter)", "F18": "Boeing F/A-18 Hornet (fighter)",
    "F18S": "Boeing F/A-18E/F Super Hornet (fighter)", "EUFI": "Eurofighter Typhoon (fighter)", "RFAL": "Dassault Rafale (fighter)", "F22": "Lockheed Martin F-22 Raptor (fighter)",
    "GRIF": "Saab JAS 39 Gripen (fighter)", "TOR": "Panavia Tornado", "H60": "Sikorsky UH-60 Black Hawk (helicopter)", "H47": "Boeing CH-47 Chinook (transport helicopter)",
    "V22": "Bell Boeing V-22 Osprey (tiltrotor)", "EC35": "Airbus H135 (helicopter)", "EC45": "Airbus H145 (helicopter)", "NH90": "NHIndustries NH90 (helicopter)",
    "A139": "Leonardo AW139 (helicopter)", "G115": "Grob G 115 (trainer)", "PC21": "Pilatus PC-21 (trainer)", "PC9": "Pilatus PC-9 (trainer)", "TEX2": "Beechcraft T-6 Texan II (trainer)",
    "M346": "Leonardo M-346 Master (trainer)", "HAWK": "BAE Hawk (trainer)", "T38": "Northrop T-38 Talon (trainer)", "BE20": "Beechcraft King Air 200 (liaison)",
    "B350": "Beechcraft King Air 350 (liaison, often reconnaissance)", "GLF4": "Gulfstream IV (VIP or reconnaissance)", "GLF5": "Gulfstream V (VIP or reconnaissance)",
    "GLEX": "Bombardier Global Express (VIP or reconnaissance)", "B736": "Boeing 737-600", "B737": "Boeing 737-700 (VIP transport / C-40)", "B738": "Boeing 737-800",
    "B752": "Boeing 757-200 (VIP transport / C-32)", "B748": "Boeing 747-8 (VIP)", "B742": "Boeing 747-200 (VC-25 / E-4B)", "E35L": "Embraer Legacy 600",
    "TU95": "Tupolev Tu-95 (strategic bomber)", "T160": "Tupolev Tu-160 (strategic bomber)", "A50": "Beriev A-50 (airborne early warning)",
}
CALLSIGNS_EN = {
    "RCH": "USAF Air Mobility Command (REACH)", "NATO": "NATO (AWACS, Geilenkirchen)", "FORTE": "USAF – RQ-4 Global Hawk", "HOMER": "US Navy – P-8 Poseidon",
    "SPAR": "USAF – US government VIP flight", "SAM": "USAF – Special Air Mission (VIP)", "RRR": "Royal Air Force", "ASCOT": "Royal Air Force – transport",
    "GAF": "Luftwaffe (Germany)", "CTM": "French Air and Space Force – transport", "FAF": "French Air and Space Force", "IAM": "Aeronautica Militare (Italy)",
    "PLF": "Polish Air Force", "BAF": "Belgian Air Component", "NAF": "Royal Netherlands Air Force", "SVF": "Swedish Air Force", "HAF": "Hellenic Air Force",
    "CFC": "Royal Canadian Air Force", "ASY": "Royal Australian Air Force", "MMF": "NATO Multinational MRTT Fleet", "CNV": "US Navy", "PAT": "US Army – priority flight",
    "TUAF": "Turkish Air Force", "RFF": "Russian Air Force",
}
