"""Karta satelity: właściciel, start, status, orbita, rola, opis i częstotliwości.

Źródła (bez kluczy):
 * CelesTrak SATCAT – właściciel, data i miejsce startu, typ obiektu, status, apogeum/perygeum;
 * SatNOGS DB – status, operator, inne nazwy, strona misji i nadajniki (częstotliwości, emisja, prędkość);
 * Wikipedia – krótki opis misji (polska, a gdy brak – angielska);
 * reguły nazw – rola satelity (np. Yaogan = chińskie rozpoznanie).
Wynik jest zapisywany w data/satinfo/ na 7 dni, żeby nie obciążać serwisów."""
import json, re, threading, time, urllib.parse, urllib.request
from pathlib import Path

from . import i18n

UA = "KRONOS-7/3.9 (+https://github.com/vipersq/Kronos-7)"
TTL = 7 * 86400

OWNERS = {"US": ("USA", "USA"), "PRC": ("Chiny", "China"), "CIS": ("Rosja / ZSRR", "Russia / USSR"), "UK": ("Wielka Brytania", "United Kingdom"),
          "FR": ("Francja", "France"), "GER": ("Niemcy", "Germany"), "JPN": ("Japonia", "Japan"), "IND": ("Indie", "India"), "ISRA": ("Izrael", "Israel"),
          "ESA": ("Europejska Agencja Kosmiczna", "European Space Agency"), "EUME": ("EUMETSAT", "EUMETSAT"), "EUTE": ("Eutelsat", "Eutelsat"),
          "ITSO": ("Intelsat", "Intelsat"), "SES": ("SES", "SES"), "GLOB": ("Globalstar", "Globalstar"), "ORB": ("Orbcomm", "Orbcomm"), "IRID": ("Iridium", "Iridium"),
          "SKOR": ("Korea Płd.", "South Korea"), "NKOR": ("Korea Płn.", "North Korea"), "IRAN": ("Iran", "Iran"), "TURK": ("Turcja", "Turkey"), "UAE": ("ZEA", "UAE"),
          "SAUD": ("Arabia Saudyjska", "Saudi Arabia"), "CA": ("Kanada", "Canada"), "AUS": ("Australia", "Australia"), "IT": ("Włochy", "Italy"), "SPN": ("Hiszpania", "Spain"),
          "NETH": ("Holandia", "Netherlands"), "SWED": ("Szwecja", "Sweden"), "NOR": ("Norwegia", "Norway"), "FIN": ("Finlandia", "Finland"), "POL": ("Polska", "Poland"),
          "BRAZ": ("Brazylia", "Brazil"), "ARGN": ("Argentyna", "Argentina"), "EGYP": ("Egipt", "Egypt"), "PAKI": ("Pakistan", "Pakistan"), "TWN": ("Tajwan", "Taiwan"),
          "INDO": ("Indonezja", "Indonesia"), "THAI": ("Tajlandia", "Thailand"), "SING": ("Singapur", "Singapore"), "MEX": ("Meksyk", "Mexico"), "LUXE": ("Luksemburg", "Luxembourg"),
          "NATO": ("NATO", "NATO"), "UKR": ("Ukraina", "Ukraine"), "KAZ": ("Kazachstan", "Kazakhstan"), "BELA": ("Białoruś", "Belarus"), "VTNM": ("Wietnam", "Vietnam"),
          "NZ": ("Nowa Zelandia", "New Zealand"), "DEN": ("Dania", "Denmark"), "SWTZ": ("Szwajcaria", "Switzerland"), "CZCH": ("Czechy", "Czechia"), "LTU": ("Litwa", "Lithuania"),
          "EST": ("Estonia", "Estonia"), "QAT": ("Katar", "Qatar"), "ISS": ("Międzynarodowa Stacja Kosmiczna", "International Space Station"), "SEAL": ("Sea Launch", "Sea Launch")}
TYPES = {"PAY": ("satelita (ładunek)", "payload"), "R/B": ("człon rakiety", "rocket body"), "DEB": ("szczątek", "debris"), "UNK": ("nieznany", "unknown")}
OPS = {"+": ("działa", "operational"), "-": ("nie działa", "non-operational"), "P": ("działa częściowo", "partially operational"), "B": ("zapasowy", "backup"),
       "S": ("rezerwowy", "spare"), "X": ("misja przedłużona", "extended mission"), "D": ("spłonął w atmosferze", "decayed"), "?": ("nieznany", "unknown")}
SITES = {"AFETR": ("Cape Canaveral (USA)", "Cape Canaveral (USA)"), "AFWTR": ("Vandenberg (USA)", "Vandenberg (USA)"), "TYMSC": ("Bajkonur (Kazachstan)", "Baikonur (Kazakhstan)"),
         "PKMTR": ("Plesieck (Rosja)", "Plesetsk (Russia)"), "VOSTO": ("Wostocznyj (Rosja)", "Vostochny (Russia)"), "JSC": ("Jiuquan (Chiny)", "Jiuquan (China)"),
         "TSC": ("Taiyuan (Chiny)", "Taiyuan (China)"), "XICLF": ("Xichang (Chiny)", "Xichang (China)"), "WSC": ("Wenchang (Chiny)", "Wenchang (China)"),
         "YSLA": ("Morze Żółte (Chiny)", "Yellow Sea (China)"), "FRGUI": ("Kourou (Gujana Francuska)", "Kourou (French Guiana)"), "SRILR": ("Sriharikota (Indie)", "Sriharikota (India)"),
         "TNSTA": ("Tanegashima (Japonia)", "Tanegashima (Japan)"), "KYMSC": ("Kapustin Jar (Rosja)", "Kapustin Yar (Russia)"), "RLLB": ("Mahia, Rocket Lab (Nowa Zelandia)", "Mahia, Rocket Lab (New Zealand)"),
         "WRAS": ("Wallops (USA)", "Wallops (USA)"), "KSCUT": ("Kennedy Space Center (USA)", "Kennedy Space Center (USA)"), "SEMLS": ("Semnan (Iran)", "Semnan (Iran)"),
         "SVOBO": ("Swobodnyj (Rosja)", "Svobodny (Russia)"), "YAVNE": ("Palmachim (Izrael)", "Palmachim (Israel)"), "NSC": ("Naro (Korea Płd.)", "Naro (South Korea)"),
         "SADOL": ("okręt podwodny, Morze Barentsa", "submarine, Barents Sea"), "OREN": ("Jasny (Rosja)", "Yasny (Russia)")}

# rola satelity rozpoznana po nazwie: (wzorzec, opis PL, opis EN)
ROLES = [
    (r"^YAOGAN", "Chińskie satelity rozpoznawcze. Zależnie od serii wykonują zdjęcia optyczne, obrazowanie radarowe (SAR) albo wywiad elektroniczny (ELINT), często w trójkach do śledzenia okrętów.",
     "Chinese reconnaissance satellites. Depending on the series they do optical imaging, radar (SAR) imaging or electronic intelligence (ELINT), often in triplets for tracking ships."),
    (r"^(USA[ -]?\d|NROL)", "Amerykański satelita wojskowy lub wywiadowczy (NRO albo Siły Kosmiczne USA). Szczegóły misji są zwykle tajne.",
     "US military or intelligence satellite (NRO or US Space Force). Mission details are usually classified."),
    (r"^(COSMOS|KOSMOS) \d+(?!.*GLONASS)", "Rosyjski satelita wojskowy. „Kosmos” to nazwa zbiorcza: rozpoznanie, łączność, wczesne ostrzeganie, nawigacja lub inspekcja innych satelitów.",
     "Russian military satellite. “Kosmos” is a catch-all name: reconnaissance, communications, early warning, navigation or inspection of other satellites."),
    (r"GLONASS", "Rosyjski system nawigacji satelitarnej GLONASS.", "Russian GLONASS navigation satellite."),
    (r"^(GPS|NAVSTAR)", "Satelita amerykańskiego systemu nawigacji GPS (Siły Kosmiczne USA).", "US GPS navigation satellite (US Space Force)."),
    (r"^(GSAT0|GALILEO)", "Satelita europejskiego systemu nawigacji Galileo.", "European Galileo navigation satellite."),
    (r"^BEIDOU", "Satelita chińskiego systemu nawigacji BeiDou.", "Chinese BeiDou navigation satellite."),
    (r"^STARLINK", "Satelita internetowy SpaceX (konstelacja Starlink). Ukraina używa Starlinka w łączności wojskowej.", "SpaceX internet satellite (Starlink constellation). Ukraine uses Starlink for military communications."),
    (r"^ONEWEB", "Satelita internetowy OneWeb (Eutelsat).", "OneWeb internet satellite (Eutelsat)."),
    (r"^KUIPER", "Satelita internetowy Amazon Kuiper.", "Amazon Kuiper internet satellite."),
    (r"^(QIANFAN|GUOWANG|SPACESAIL)", "Chińska konstelacja internetu satelitarnego (odpowiednik Starlinka).", "Chinese satellite internet constellation (Starlink counterpart)."),
    (r"^(ISS|ZARYA)", "Międzynarodowa Stacja Kosmiczna – załogowa, ok. 400 km nad Ziemią. Krótkofalowcy mogą odbierać z niej APRS, SSTV i łączność ARISS.",
     "International Space Station – crewed, about 400 km up. Radio amateurs can receive APRS, SSTV and ARISS contacts from it."),
    (r"^(CSS|TIANHE|TIANGONG|WENTIAN|MENGTIAN)", "Chińska stacja kosmiczna Tiangong (załogowa).", "China's crewed Tiangong space station."),
    (r"^SAR-LUPE|^SARAH", "Niemieckie wojskowe satelity rozpoznania radarowego (Bundeswehra).", "German military radar reconnaissance satellites (Bundeswehr)."),
    (r"^CSO", "Francuskie wojskowe satelity rozpoznania optycznego bardzo wysokiej rozdzielczości.", "French military very-high-resolution optical reconnaissance satellites."),
    (r"^(OFEQ|OFEK)", "Izraelskie satelity rozpoznawcze.", "Israeli reconnaissance satellites."),
    (r"^IGS", "Japońskie satelity rozpoznawcze (Information Gathering Satellite).", "Japanese reconnaissance satellites (Information Gathering Satellite)."),
    (r"^SBIRS", "Amerykański system wczesnego ostrzegania przed startami rakiet (podczerwień).", "US missile launch early-warning system (infrared)."),
    (r"^(WGS|AEHF|MUOS|MILSTAR|DSCS)", "Amerykańska wojskowa łączność satelitarna.", "US military satellite communications."),
    (r"^SKYNET", "Brytyjska wojskowa łączność satelitarna.", "British military satellite communications."),
    (r"^(SYRACUSE|SICRAL)", "Wojskowa łączność satelitarna (Francja / Włochy).", "Military satellite communications (France / Italy)."),
    (r"^GONETS", "Rosyjska łączność satelitarna typu „store and forward” (cywilno-wojskowa).", "Russian store-and-forward communications satellites (civil-military)."),
    (r"^(TJS|TONGXIN JISHU)", "Chiński satelita na orbicie geostacjonarnej, oficjalnie „test technologii łączności”; analitycy łączą tę serię z wywiadem elektronicznym i wczesnym ostrzeganiem.",
     "Chinese geostationary satellite, officially a “communications technology test”; analysts link the series to electronic intelligence and early warning."),
    (r"^SHIJIAN", "Chiński satelita eksperymentalny; część serii testuje manewry i inspekcję innych obiektów na orbicie.", "Chinese experimental satellite; some of the series test manoeuvres and inspection of other objects in orbit."),
    (r"^(LUCH|OLYMP)", "Rosyjski satelita na orbicie geostacjonarnej, znany ze zbliżania się do zachodnich satelitów telekomunikacyjnych (podejrzenie podsłuchu).",
     "Russian geostationary satellite known for approaching Western communications satellites (suspected eavesdropping)."),
    (r"^GSSAP", "Amerykański satelita obserwujący inne obiekty na orbicie geostacjonarnej.", "US satellite that watches other objects in geostationary orbit."),
    (r"^(NOAA|METOP|GOES|METEOSAT|MTG|HIMAWARI|FENGYUN|FY-|METEOR|ELEKTRO|JPSS|SUOMI|ARKTIKA)", "Satelita meteorologiczny. Część z nich nadaje obrazy, które krótkofalowcy odbierają (APT/LRPT/HRPT).",
     "Weather satellite. Some of them broadcast images that radio amateurs can receive (APT/LRPT/HRPT)."),
    (r"^(SENTINEL|LANDSAT|WORLDVIEW|PLEIADES|SPOT|SKYSAT|ICEYE|CAPELLA|UMBRA|GAOFEN|JILIN|SUPERVIEW|BLACKSKY|RADARSAT|TERRASAR|KOMPSAT)", "Satelita obserwacji Ziemi (zdjęcia optyczne lub radarowe). Komercyjne zdjęcia z takich satelitów często pokazują skutki wojny.",
     "Earth observation satellite (optical or radar imagery). Commercial images from such satellites often show the effects of war."),
    (r"^(AO-|SO-|RS-|FO-|CAS-|XW-|IO-|PO-|JO-|LILACSAT|FUNCUBE|TEVEL|GREENCUBE)", "Satelita krótkofalarski – przekaźnik FM lub transponder liniowy dla radioamatorów.",
     "Amateur radio satellite – FM repeater or linear transponder for radio amateurs."),
    (r"^(HST|HUBBLE|CHANDRA|SWIFT|FERMI|NUSTAR|TESS|XMM|INTEGRAL|XRISM|EINSTEIN)", "Teleskop kosmiczny lub satelita naukowy.", "Space telescope or science satellite."),
    (r"^(INTELSAT|SES|EUTELSAT|ASTRA|INMARSAT|VIASAT|THURAYA|EXPRESS|YAMAL|CHINASAT|ARABSAT|TURKSAT|HISPASAT)", "Komercyjny satelita telekomunikacyjny (telewizja, internet, łączność).",
     "Commercial communications satellite (TV, internet, telecom)."),
    (r"^IRIDIUM", "Satelita telefonii satelitarnej Iridium (używanej też przez wojsko).", "Iridium satellite phone network satellite (also used by the military)."),
]
GROUP_ROLE = {"military": ("Satelita wojskowy lub rozpoznawczy.", "Military or reconnaissance satellite."),
              "analyst": ("Obiekt bez oficjalnej nazwy, śledzony przez radary – często satelita niejawny.", "Object without an official name, tracked by radar – often a classified satellite."),
              "weather": ("Satelita meteorologiczny.", "Weather satellite."), "earth": ("Satelita obserwacji Ziemi.", "Earth observation satellite."),
              "comms": ("Satelita telekomunikacyjny.", "Communications satellite."), "gnss": ("Satelita nawigacyjny.", "Navigation satellite."),
              "amateur": ("Satelita krótkofalarski.", "Amateur radio satellite."), "stations": ("Stacja kosmiczna lub statek kosmiczny.", "Space station or spacecraft."),
              "science": ("Satelita naukowy.", "Science satellite.")}


def _get(url, timeout=12):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace") or "null")


def role_for(name, groups):
    en = i18n.en()
    for rx, pl, en_t in ROLES:
        if re.search(rx, name or "", re.I):
            return en_t if en else pl
    for g in groups:
        if g in GROUP_ROLE:
            return GROUP_ROLE[g][1 if en else 0]
    return ""


class SatInfo:
    def __init__(self, data_dir, catalog, log=print):
        self.dir = Path(data_dir) / "satinfo"; self.dir.mkdir(parents=True, exist_ok=True)
        self.cat, self.log = catalog, log
        self.lock = threading.Lock()
        self.partial = False

    def _satcat(self, norad):
        try:
            d = _get(f"https://celestrak.org/satcat/records.php?CATNR={norad}&FORMAT=JSON")
            return d[0] if isinstance(d, list) and d else None
        except Exception:
            self.partial = True
            return None

    def _satnogs(self, norad):
        sat, tx = None, []
        try:
            d = _get(f"https://db.satnogs.org/api/satellites/?norad_cat_id={norad}&format=json")
            sat = d[0] if isinstance(d, list) and d else None
        except Exception:
            self.partial = True
        try:
            d = _get(f"https://db.satnogs.org/api/transmitters/?satellite__norad_cat_id={norad}&format=json")
            tx = d if isinstance(d, list) else []
        except Exception:
            self.partial = True
        return sat, tx

    def _wiki(self, name, alt=""):
        """Szuka artykułu, którego tytuł pasuje do nazwy satelity (polska Wikipedia, potem angielska)."""
        base = re.sub(r"\s*\(.*?\)|\s*[-–]?\s*\d+[A-Z]?$|\s+\d+\s*\d*$", "", name or "").strip() or name
        tokens = {t for t in re.findall(r"[A-Za-zŁłŚśŻżŹźĆćŃńÓóĄąĘę]{3,}", (name + " " + alt).upper())}
        for lang in (["pl", "en"] if not i18n.en() else ["en"]):
            try:
                q = urllib.parse.quote(f"{base} satelita" if lang == "pl" else f"{base} satellite")
                d = _get(f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={q}&format=json&srlimit=5")
                for hit in d.get("query", {}).get("search", []):
                    t, snip = hit["title"], re.sub(r"<[^>]+>", "", hit.get("snippet") or "")
                    if not (any(tok in t.upper() for tok in tokens) or re.search(r"\b" + re.escape(base) + r"\b", snip, re.I)):
                        continue
                    s = _get(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(t.replace(' ', '_'))}")
                    if s and s.get("extract") and s.get("type") != "disambiguation":
                        return {"title": s.get("title"), "text": s["extract"][:900], "url": (s.get("content_urls") or {}).get("desktop", {}).get("page"),
                                "lang": lang, "img": (s.get("thumbnail") or {}).get("source")}
            except Exception:
                self.partial = True
                continue
        return None

    def get(self, norad):
        lang = "en" if i18n.en() else "pl"
        f = self.dir / f"{norad}_{lang}.json"
        if f.exists():
            try:
                old = json.loads(f.read_text(encoding="utf-8")); age = time.time() - f.stat().st_mtime
                if age < (3600 if old.get("partial") else TTL):     # niepełne dane (serwis nie odpowiedział) – ponów po godzinie
                    return old
            except Exception:
                pass
        self.partial = False
        self.cat.ensure()
        t = self.cat.by_id.get(norad)
        name = t[0] if t else str(norad)
        groups = [g for g, ids in self.cat.groups.items() if g != "all" and norad in ids]
        en = i18n.en()
        out = {"norad": norad, "name": name, "groups": groups, "role": role_for(name, groups)}
        if t:
            idd = t[2][9:17].strip()
            if idd:
                yy = int(idd[:2]) if idd[:2].isdigit() else None
                out["intl"] = (("19" if yy and yy >= 57 else "20") + idd[:2] + "-" + idd[2:]) if yy is not None else idd
        sc = self._satcat(norad)
        if sc:
            o = sc.get("OWNER") or ""
            out.update({"owner": OWNERS.get(o, (o, o))[1 if en else 0], "owner_code": o, "launch": sc.get("LAUNCH_DATE"),
                        "site": SITES.get(sc.get("LAUNCH_SITE") or "", (sc.get("LAUNCH_SITE"), sc.get("LAUNCH_SITE")))[1 if en else 0],
                        "otype": TYPES.get(sc.get("OBJECT_TYPE") or "", (sc.get("OBJECT_TYPE"), sc.get("OBJECT_TYPE")))[1 if en else 0],
                        "ops": OPS.get(sc.get("OPS_STATUS_CODE") or "", (None, None))[1 if en else 0],
                        "apogee": sc.get("APOGEE"), "perigee": sc.get("PERIGEE"), "rcs": sc.get("RCS"), "decay": sc.get("DECAY_DATE")})
        sat, tx = self._satnogs(norad)
        if sat:
            out.update({"status": sat.get("status"), "alt_names": sat.get("names"), "operator": None if sat.get("operator") in (None, "None") else sat.get("operator"),
                        "countries": sat.get("countries"), "website": sat.get("website"),
                        "image": ("https://db-satnogs.freetls.fastly.net/media/" + sat["image"]) if sat.get("image") else None,
                        "launched": (sat.get("launched") or "")[:10] or None, "freq_violator": sat.get("is_frequency_violator")})
        out["tx"] = [{"desc": x.get("description"), "type": x.get("type"), "down": x.get("downlink_low"), "down_hi": x.get("downlink_high"), "up": x.get("uplink_low"),
                      "mode": x.get("mode"), "baud": x.get("baud"), "alive": x.get("alive"), "status": x.get("status"), "service": x.get("service"),
                      "invert": x.get("invert")} for x in tx][:25]
        out["wiki"] = self._wiki(name, (sat or {}).get("names") or "")
        out["at"] = int(time.time() * 1000)
        out["partial"] = self.partial
        try:
            f.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
        except Exception:
            pass
        return out

    def explain_prompt(self, info):
        """Dane do opisu misji przez lokalne AI."""
        keep = {k: info.get(k) for k in ("name", "intl", "owner", "launch", "site", "otype", "ops", "apogee", "perigee", "role", "operator", "alt_names", "status")}
        keep["frequencies"] = [f"{(t['down'] or 0) / 1e6:.4f} MHz {t.get('mode') or ''} {t.get('desc') or ''}" for t in info.get("tx", []) if t.get("down")][:8]
        if info.get("wiki"):
            keep["wikipedia"] = info["wiki"]["text"][:600]
        return json.dumps(keep, ensure_ascii=False)


EXPLAIN_SYS = ("Jesteś KRONOS-7. Na podstawie danych opisz satelitę po polsku w 80–140 słowach: do czego służy, kto go używa i po co, "
               "co jest ważne z punktu widzenia wywiadu lub łączności. Jeśli czegoś nie wiadomo, napisz to wprost; przypuszczenia oznaczaj słowem „prawdopodobnie”. "
               "Bez list, zwykły tekst.")
