"""Bezpieczeństwo morskie: incydenty (piractwo, ataki, abordaże) i ostrzeżenia nawigacyjne z oficjalnych źródeł.

Źródła (bez kluczy):
  • NGA MSI – ostrzeżenia nawigacyjne NAVAREA / HYDROLANT / HYDROPAC (USA, cały świat, JSON z pozycją)
  • UKHO – ostrzeżenia radiowe NAVAREA I i przybrzeżne Wielkiej Brytanii (HTML)
  • IMB Piracy Reporting Centre (ICC) – mapa piractwa na żywo (JSON wtyczki mapy)
  • ReCAAP ISC – incydenty w Azji (otwarte API mapy IFN)
  • EUNAVFOR ATALANTA – komunikaty operacji UE (Somalia, Zatoka Adeńska)
  • MARAD MSCI – ostrzeżenia i porady dla żeglugi (USA)

Ten sam incydent bywa zgłaszany przez kilka źródeł – łączymy je w jedną pozycję (czas + odległość + statek),
a w wątpliwych przypadkach decyduje lokalne AI. AI dopisuje też krótki tytuł, streszczenie, rodzaj i ważność.
Każda pozycja jest analizowana przez AI tylko raz."""
import gzip, hashlib, html, json, math, re, threading, time, urllib.parse, urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from . import i18n

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 KRONOS-7"
KEEP_INC = 120 * 86400          # incydenty: 120 dni
KEEP_WARN = 3 * 86400           # ostrzeżenie znika 3 dni po wycofaniu
INTERVAL = 30 * 60

KINDS = {   # rodzaj: (PL, EN, domyślna ważność, czy to incydent (a nie ostrzeżenie))
    "missile": ("Atak rakietowy / dronem", "Missile / drone attack", 5, True),
    "hijack": ("Porwanie statku", "Hijacking", 5, True),
    "attack": ("Atak / ostrzał", "Attack / fired upon", 4, True),
    "mine": ("Miny", "Mines", 4, False),
    "boarding": ("Abordaż", "Boarding", 3, True),
    "approach": ("Podejrzane podejście", "Suspicious approach", 2, True),
    "robbery": ("Kradzież / rabunek", "Robbery / theft", 2, True),
    "gnss": ("Zakłócenia GNSS", "GNSS interference", 3, False),
    "closure": ("Zamknięcie portu / akwenu", "Port / area closure", 3, False),
    "launch": ("Strzelania rakietowe / starty", "Missile firings / launches", 2, False),
    "exercise": ("Ćwiczenia wojskowe / strzelania", "Military exercise / firing", 2, False),
    "advisory": ("Ostrzeżenie dla żeglugi", "Shipping advisory", 3, False),
    "casualty": ("Wypadek / jednostka w niebezpieczeństwie", "Casualty / vessel in distress", 2, True),
    "cable": ("Prace przy kablach / rurociągach", "Cable / pipeline operations", 1, False),
    "hazard": ("Niebezpieczne operacje", "Hazardous operations", 1, False),
    "other": ("Inne", "Other", 1, False),
}
SRC_NAMES = {"nga": "NGA MSI", "ukho": "UKHO NAVAREA I", "imb": "IMB PRC (ICC)", "recaap": "ReCAAP ISC", "eunavfor": "EUNAVFOR ATALANTA", "marad": "MARAD MSCI",
             "ukmto": "UKMTO (e-mail)", "mdat": "MDAT-GoG (e-mail)", "ifcior": "IFC-IOR (e-mail)", "email": "e-mail"}
SRC_KIND = {"nga": "warning", "ukho": "warning", "imb": "incident", "recaap": "incident", "eunavfor": "report", "marad": "advisory",
            "ukmto": "incident", "mdat": "incident", "ifcior": "incident", "email": "incident"}
FETCHED = ("nga", "ukho", "imb", "recaap", "eunavfor", "marad")     # źródła pobierane ze stron (pozostałe przychodzą pocztą)

# miejsca do przybliżonej pozycji, gdy źródło podaje tylko opis
GAZ = [("northern coast of somalia|north(?:ern)? somalia|puntland|eyl", 10.5, 50.5), ("bab el.mandeb|bab-el-mandeb", 12.6, 43.3), ("gulf of aden", 12.5, 47.5), ("red sea", 18.5, 39.5), ("hodeidah|hudaydah", 14.8, 42.9),
       ("strait of hormuz|hormuz", 26.5, 56.3), ("gulf of oman", 24.5, 58.5), ("persian gulf|arabian gulf", 27.0, 51.0), ("arabian sea", 16.0, 62.0),
       ("northern coast of somalia|north(?:ern)? somalia|puntland|eyl", 10.5, 50.5), ("somali basin", 1.5, 50.0), ("somalia", 6.0, 49.5),
       ("mogadishu", 2.0, 45.4), ("indian ocean", 5.0, 65.0), ("black sea", 43.5, 34.0), ("sea of azov", 46.0, 36.5), ("eastern mediterranean", 34.0, 32.0),
       ("mediterranean", 36.0, 18.0), ("libya", 33.0, 15.0), ("gulf of guinea", 3.0, 4.0), ("nigeria", 4.0, 6.0), ("venezuela", 11.5, -66.0),
       ("caribbean", 15.0, -75.0), ("haiti", 18.6, -72.4), ("south china sea", 12.0, 114.0), ("singapore strait|straits of malacca & singapore|straits of malacca and singapore", 1.2, 104.0),
       ("straits? of malacca", 3.0, 100.5), ("sulu", 6.5, 120.5), ("celebes", 4.0, 122.0), ("taiwan strait", 24.0, 119.5), ("baltic", 57.0, 19.0),
       ("english channel", 50.2, -1.0), ("north sea", 56.0, 3.0), ("mozambique", -17.0, 41.0), ("bangladesh|chattogram|chittagong", 22.2, 91.7),
       ("callao|peru", -12.0, -77.2), ("ecuador|guayaquil", -2.3, -80.0), ("brazil", -23.0, -43.0), ("kenya|mombasa", -4.1, 39.7)]
COORD_DASH = re.compile(r"(\d{1,2})-(\d{1,2}(?:\.\d+)?)\s*([NS])\s*[,/ ]*\s*(\d{1,3})-(\d{1,2}(?:\.\d+)?)\s*([EW])")
COORD_COLON = re.compile(r"(\d{1,2})[:°]\s?(\d{1,2}(?:\.\d+)?)'?\s*([NS])\s*[–\-,/ ]+\s*(\d{1,3})[:°]\s?(\d{1,2}(?:\.\d+)?)'?\s*([EW])")
NAVREF = re.compile(r"\b(NAVAREA\s+[IVXL]+|HYDROLANT|HYDROPAC|WZ)\s+(\d{1,4}/\d{2})\b")


def _get(url, timeout=40, headers=None, raw=False):
    h = {"User-Agent": UA, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en-GB,en;q=0.8", "Accept-Encoding": "gzip"}
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout) as r:
        b = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            b = gzip.decompress(b)
    return b if raw else b.decode("utf-8", "replace")


def _txt(s):
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s or "", flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>|</p>|</li>", "\n", s, flags=re.I)
    return re.sub(r"[ \t\r\f\v]+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def coords(text):
    out = []
    for rx in (COORD_DASH, COORD_COLON):
        for m in rx.finditer(text or ""):
            la = int(m.group(1)) + float(m.group(2)) / 60; lo = int(m.group(4)) + float(m.group(5)) / 60
            la = -la if m.group(3) == "S" else la; lo = -lo if m.group(6) == "W" else lo
            if abs(la) <= 90 and abs(lo) <= 180:
                out.append([round(la, 4), round(lo, 4)])
    return out


def place(text):
    t = (text or "").lower()
    for rx, la, lo in GAZ:
        if re.search(rx, t):
            return [la, lo]
    return None


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(h)))


def kind_of(text, cat=""):
    t = f"{cat} {text}".lower()
    if re.search(r"missile|drone|uav|usv|projectile|unmanned", t) and re.search(r"attack|struck|hit|impact|explosion|fired|launched at", t):
        return "missile"
    if re.search(r"hijack|pirated|seized|taken over|commandeer", t):
        return "hijack"
    if re.search(r"fired upon|fired at|shots|small arms|rpg|attack(?:ed)?\b|exchange of fire|gunfire", t) and not re.search(r"exercise|firing practice|gunnery", t):
        return "attack"
    if re.search(r"\bmine(s|field)?\b|mine danger|mine-like", t):
        return "mine"
    if re.search(r"gnss|gps|jamming|spoofing|interference", t):
        return "gnss"
    if re.search(r"boarded|boarding|climbed", t):
        return "boarding"
    if re.search(r"robbery|theft|stole|stolen", t):
        return "robbery"
    if re.search(r"suspicious|approached|skiff|attempt", t):
        return "approach"
    if re.search(r"port closure|closed to navigation|area closed|prohibited", t):
        return "closure"
    if re.search(r"rocket|missile operations|missile firing|space debris|launch", t):
        return "launch"
    if re.search(r"gunnery|military exercise|naval exercise|firing exercise|live firing|special operations|warships|submarine", t):
        return "exercise"
    if re.search(r"casualty|abandoned|derelict|man overboard|disabled|aground|sinking|distress|fire on board", t):
        return "casualty"
    if re.search(r"cable|pipeline", t):
        return "cable"
    if re.search(r"hazardous operations", t):
        return "hazard"
    return "other"


def _ms(dt):
    return int(dt.timestamp() * 1000)


def _hid(*parts):
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:12]


# ------------------------------------------------ pobieranie ze źródeł (każde zwraca listę ujednoliconych rekordów)
NGA_SKIP = {"LIGHT", "BUOY", "RACON", "AIDS TO NAVIGATION", "DEPTH REPORTED", "SURVEY OPERATIONS", "ADMIN", "INFORCE BULLETIN", "RADIO SERVICE",
            "RADIO SERVICES", "NAVTEX", "NGA TECHNICAL ALERT", "ICEBERG", "NAIS ICE LIMIT", "NAVAREA IV RIG LIST", "FOUL GROUND", "OBSTRUCTION",
            "DANGEROUS WRECK", "FISHING GEAR", "PLATFORM", "CONTAINER", "UNDERWATER OPERATIONS", "PIPELINE OPERATIONS", "SALVAGE OPERATIONS"}
NGA_KIND = {"MISSILE OPERATIONS": "launch", "ROCKET LAUNCHING": "launch", "SPACE DEBRIS": "launch", "GUNNERY EXERCISES": "exercise", "SPECIAL OPERATIONS": "exercise",
            "MINE": "mine", "GPS JAMMING": "gnss", "PORT CLOSURE": "closure", "MARINE CASUALTY": "casualty", "VESSEL ABANDONED": "casualty",
            "DERELICT VESSEL": "casualty", "MAN OVERBOARD": "casualty", "DISABLED": "casualty", "CABLE OPERATIONS": "cable", "PIRACY": "attack"}


def _nga_time(s):
    try:
        return _ms(datetime.strptime(s.strip(), "%d%H%MZ %b %Y").replace(tzinfo=timezone.utc))
    except Exception:
        return None


def fetch_nga():
    d = json.loads(_get("https://msi.nga.mil/api/publications/smaps?output=json", 60))
    out = []
    for x in d.get("smaps", []):
        cat = (x.get("category") or "").upper()
        if cat in NGA_SKIP or x.get("status") not in (None, "INFORCE"):
            continue
        text = (x.get("msgText") or "").strip()
        kind = NGA_KIND.get(cat)
        if not kind:
            kind = kind_of(text, cat)
            if kind in ("other",) or (cat == "HAZARDOUS OPERATIONS" and kind not in ("exercise", "launch", "mine", "gnss", "closure", "attack", "missile")):
                kind = "hazard"
        pts = coords(text)
        la, lo = x.get("latitude"), x.get("longitude")
        pos = [round(la, 4), round(lo, 4)] if isinstance(la, (int, float)) and isinstance(lo, (int, float)) and (la or lo) else (pts[0] if pts else None)
        if pos and len(pts) >= 3:      # środek obszaru
            pos = [round(sum(p[0] for p in pts) / len(pts), 4), round(sum(p[1] for p in pts) / len(pts), 4)]
        ref = f"{x.get('msgType') or ''} {x.get('msgSqncNumber') or ''}/{str(x.get('createdOn') or '')[-2:]}".strip()
        m = NAVREF.search(text)
        out.append({"src": "nga", "key": str(x.get("msgID") or x.get("outgoingID") or ref), "ref": ref, "navref": f"{m.group(1)} {m.group(2)}" if m else None,
                    "t": _nga_time(x.get("createdOn") or "") or None, "title": f"{cat.title()} – {(x.get('oceans') or x.get('navArea') or '').title()}",
                    "text": text, "kind": kind, "pos": pos, "area": pts if len(pts) >= 3 else None, "region": x.get("navArea"),
                    "url": "https://msi.nga.mil/NavWarnings", "warn": True, "cat": cat})
    return out


UKHO_KEEP = re.compile(r"firing|exercise|gunnery|missile|rocket|ordnance|explosive|unexploded|mine|gnss|gps|jamming|military|submarine|naval|hazardous|"
                       r"piracy|drone|uav|security|restricted|prohibited|closed|derelict|adrift|casualty|cable", re.I)


def _ukho_time(s):
    m = re.match(r"(\d{2})(\d{2})(\d{2})\s*UTC\s*(\w{3})\s*(\d{2})", s.strip())
    if not m:
        return None
    try:
        return _ms(datetime.strptime(f"{m.group(1)} {m.group(4)} 20{m.group(5)} {m.group(2)}{m.group(3)}", "%d %b %Y %H%M").replace(tzinfo=timezone.utc))
    except Exception:
        return None


def fetch_ukho():
    s = _get("https://msi.admiralty.co.uk/RadioNavigationalWarnings", 60)
    out = []
    for m in re.finditer(r'<h1 id="Details_WarningType_\d+"[^>]*>(.*?)</h1>\s*<h2[^>]*>(.*?)</h2>\s*<h3[^>]*>(.*?)</h3>\s*<pre[^>]*>(.*?)</pre>', s, re.S):
        wtype, ref, dtg, body = (_txt(g) for g in m.groups())
        body = body.replace("&#xA;", "\n")
        if not UKHO_KEEP.search(body) or re.search(r"RIGLIST|IN FORCE AT|CANCEL \w+ \d+/\d+\.?$", body):
            continue
        k = kind_of(body)
        if k == "other":
            k = "hazard"
        pts = coords(body)
        pos = pts[0] if pts else place(body)
        if pts and len(pts) >= 3:
            pos = [round(sum(p[0] for p in pts) / len(pts), 4), round(sum(p[1] for p in pts) / len(pts), 4)]
        r = NAVREF.search(ref + " ")
        out.append({"src": "ukho", "key": ref, "ref": ref, "navref": f"{r.group(1)} {r.group(2)}" if r else ref, "t": _ukho_time(dtg),
                    "title": f"{wtype} {ref}", "text": body, "kind": k, "pos": pos, "area": pts if len(pts) >= 3 else None, "region": wtype,
                    "url": "https://msi.admiralty.co.uk/RadioNavigationalWarnings", "warn": True})
    return out


def fetch_imb():
    page = _get("https://icc-ccs.org/map/", 60)
    ids = re.findall(r'data-map-id="(\d+)"', page) or re.findall(r'"map_id":"?(\d+)', page)
    if not ids:
        raise RuntimeError("brak identyfikatora mapy IMB")
    mid = max(ids, key=int)
    d = json.loads(_get("https://icc-ccs.org/wp-json/wpgmza/v1/features?filter=" + urllib.parse.quote(json.dumps({"map_id": mid})), 60))
    out = []
    for x in d.get("markers", []):
        f = {c.get("name", "").strip(": "): c.get("value") for c in x.get("custom_field_data") or []}
        text = (f.get("Sitrep") or x.get("description") or "").strip()
        try:
            pos = [round(float(x["lat"]), 4), round(float(str(x["lng"]).strip()), 4)]
        except Exception:
            pos = coords(text)[0] if coords(text) else None
        t = None
        m = re.match(r"(\d{2})\.(\d{2})\.(\d{4}):\s*(\d{4})\s*(UTC|LT)", text)
        if m:
            t = _ms(datetime.strptime(f"{m.group(3)}{m.group(2)}{m.group(1)}{m.group(4)}", "%Y%m%d%H%M").replace(tzinfo=timezone.utc))
        elif f.get("Date of Incident"):
            t = _ms(datetime.strptime(f["Date of Incident"], "%Y-%m-%d").replace(tzinfo=timezone.utc))
        body = re.sub(r"^\d{2}\.\d{2}\.\d{4}:\s*\d{4}\s*(UTC|LT):\s*Posn:[^,]*,[^\n]*?\.\s*", "", text).strip()
        out.append({"src": "imb", "key": x.get("title") or x.get("id"), "ref": "IMB " + str(x.get("title") or ""), "t": t, "title": body.split(".")[0][:120],
                    "text": text, "kind": kind_of(body), "pos": pos, "region": (re.search(r"Posn:[^,]*,\s*([^.]+)\.", text) or [None, None])[1],
                    "url": "https://icc-ccs.org/map/"})
    return out


def fetch_recaap(days=120):
    end = datetime.now(timezone.utc).date(); start = datetime.fromtimestamp(time.time() - days * 86400, timezone.utc).date()
    out, page = [], 0
    while page < 10:
        q = urllib.parse.urlencode({"incidentStart": start.isoformat(), "incidentEnd": end.isoformat(), "page": page, "size": 100})
        d = json.loads(_get("https://portal.recaap.org/recaap-api-be/api/v1/openMap/fetchInteractiveIncidents?" + q, 60))
        rows = d if isinstance(d, list) else d.get("content", [])
        for x in rows:
            text = (x.get("detailsAttackMethod") or "").strip()
            try:
                t = _ms(datetime.fromisoformat(str(x.get("timeOfIncident")).replace("Z", "+00:00")))
            except Exception:
                t = None
            la, lo = x.get("positionLatitude"), x.get("positionLongitude")
            pos = [round(la, 4), round(lo, 4)] if isinstance(la, (int, float)) and isinstance(lo, (int, float)) else None
            typ = x.get("incidentType") or ""
            k = kind_of(text, typ)
            if k in ("other", "approach") and "robbery" in typ.lower():
                k = "robbery"
            out.append({"src": "recaap", "key": x.get("incidentNo") or x.get("id"), "ref": x.get("incidentNo"), "t": t,
                        "title": f"{typ}: {x.get('shipName') or ''} ({x.get('shipType') or ''})".strip(), "text": text, "kind": k, "pos": pos,
                        "region": x.get("positionSeaName"), "url": "https://portal.recaap.org/OpenMap",
                        "ship": {"name": x.get("shipName"), "type": x.get("shipType"), "flag": x.get("shipFlag"), "imo": x.get("shipImoNumber")},
                        "cat": x.get("significanceLevelFinal")})
        if len(rows) < 100:
            break
        page += 1
    return out


def fetch_eunavfor(known):
    s = _get("https://eunavfor.eu/news", 60)
    out = []
    for blk in re.findall(r'<div class="news col[^"]*views-row">(.*?)views-field-created"><span class="field-content">(.*?)</span>', s, re.S)[:12]:
        body, date = blk
        m = re.search(r'views-field-title"><span class="field-content"><a href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)
        if not m:
            continue
        href, title = m.group(1), _txt(m.group(2))
        teaser = _txt((re.search(r'views-field-body"><div class="field-content">(.*?)</div>', body, re.S) or [None, ""])[1])
        if not re.search(r"pira|attack|hijack|skiff|dhow|approach|incident|board|seiz|merchant|tanker|vessel", (title + " " + teaser).lower()):
            continue
        url = urllib.parse.urljoin("https://eunavfor.eu/", href)
        key = href.rstrip("/").split("/")[-1]
        text = teaser
        if key not in known:                 # pełny tekst pobieramy tylko dla nowych komunikatów
            try:
                a = _get(url, 40)
                bodies = [_txt(b) for b in re.findall(r'field--name-body[^>]*>(.*?)</div>', a, re.S)]
                text = max(bodies, key=len) if bodies else teaser
            except Exception:
                pass
        try:
            t = _ms(datetime.strptime(_txt(date), "%b %d, %Y").replace(tzinfo=timezone.utc))
        except Exception:
            t = None
        pts = coords(text)
        out.append({"src": "eunavfor", "key": key, "ref": "EUNAVFOR", "t": t, "title": title.title() if title.isupper() else title, "text": text[:6000],
                    "kind": kind_of(title + " " + text), "pos": pts[0] if pts else place(title + " " + text) or [11.0, 50.0], "region": "Somalia / Gulf of Aden",
                    "url": url, "report": True})
    return out


def fetch_marad(known):
    out = []
    for lst in ("https://www.maritime.dot.gov/msci-alerts", "https://www.maritime.dot.gov/msci-advisories"):
        s = _get(lst, 60)
        links = [(h, _txt(t)) for h, _, t in re.findall(r'<a[^>]+href="(/msci/(20\d\d)-\d{3}[^"#?]*)"[^>]*>(.*?)</a>', s, re.S)]
        for href, title in links[:25]:
            m = re.match(r"(20\d\d-\d{3})\s*[-–]\s*([^-–]+?)\s*[-–]\s*(.+)", title)
            num, region, what = (m.group(1), m.group(2).strip(), m.group(3).strip()) if m else (href.split("/")[-1][:8], "", title)
            if num in {o["key"] for o in out}:
                continue
            url = urllib.parse.urljoin("https://www.maritime.dot.gov/", href)
            text, t = what, None
            if num not in known:
                try:
                    a = _txt(_get(url, 40))
                    i = a.find("Issue"); text = a[i:i + 2500] if i > 0 else a[:2500]
                    dm = re.search(r"Effective Date[^0-9]*(\d{2}/\d{2}/\d{4})", a)
                    if dm:
                        t = _ms(datetime.strptime(dm.group(1), "%m/%d/%Y").replace(tzinfo=timezone.utc))
                except Exception:
                    pass
            if "global" in region.lower() and not re.search(r"red sea|hormuz|gulf|black sea|guinea|somalia|venezuela", what.lower()):
                pos = None
            else:
                pos = place(region + " " + what)
            out.append({"src": "marad", "key": num, "ref": "MARAD " + num, "t": t, "title": f"{region}: {what}" if region else what, "text": text,
                        "kind": "advisory" if "advisor" in lst else kind_of(what + " " + text), "pos": pos, "region": region, "url": url, "advisory": True})
    return out


# ------------------------------------------------ magazyn, łączenie duplikatów, AI
class MarSec:
    def __init__(self, data_dir, log=print):
        self.file = Path(data_dir) / "marsec.json"
        self.log = log
        self.lock = threading.Lock()
        self.items = {}                 # id -> rekord
        self.status = {k: {"ok": None, "n": 0, "err": None, "at": None} for k in FETCHED}
        self.events = deque(maxlen=60)
        self.ai = None; self.busy = lambda: False
        self.wake = threading.Event()
        self.loaded = False
        self.last_fetch = 0
        try:
            d = json.loads(self.file.read_text(encoding="utf-8"))
            self.items = d.get("items", {}); self.status.update(d.get("status", {})); self.loaded = True
        except Exception:
            pass

    def save(self):
        with self.lock:
            s = json.dumps({"items": self.items, "status": self.status}, ensure_ascii=False)
        tmp = self.file.with_suffix(".tmp"); tmp.write_text(s, encoding="utf-8"); tmp.replace(self.file)

    # -- scalanie nowego rekordu ze źródła
    def _merge_src(self, rec, now):
        iid = rec["src"] + ":" + str(rec["key"])
        old = self.items.get(iid)
        if old:
            for k in ("title", "pos", "area", "t", "region", "url", "ship", "navref"):
                if rec.get(k):
                    old[k] = rec[k]
            if rec.get("text") and len(rec["text"]) >= len(old.get("text") or ""):
                old["text"] = rec["text"]
            old["seen"] = now; old.pop("gone", None)
            if old.get("kind_src") != rec["kind"]:
                old["kind_src"] = rec["kind"]
                if not old.get("ai"):
                    old["kind"] = rec["kind"]
            return iid, False
        rec = dict(rec, id=iid, first=now, seen=now, kind_src=rec["kind"], sev=KINDS[rec["kind"]][2], dup=None, ai=None)
        if not rec.get("t"):
            rec["t"] = now
        self.items[iid] = rec
        return iid, True

    def _auto_dup(self, iid):
        """Łączy oczywiste duplikaty: ten sam numer ostrzeżenia, ten sam statek, albo to samo miejsce i czas tego samego rodzaju."""
        r = self.items[iid]
        if r.get("dup"):
            return None
        fam = lambda k: {"hijack": "a", "attack": "a", "missile": "a", "boarding": "b", "robbery": "b", "approach": "c"}.get(k, k)
        best = None
        for o in self.items.values():
            if o["id"] == iid or o.get("dup") or o["src"] == r["src"]:
                continue
            if r.get("navref") and o.get("navref") and r["navref"] == o["navref"]:
                return o["id"]
            if r.get("warn") or o.get("warn"):
                continue
            dt = abs((r.get("t") or 0) - (o.get("t") or 0)) / 3600e3
            if dt > 72:
                continue
            sn, on = ((r.get("ship") or {}).get("name") or "").lower().strip(), ((o.get("ship") or {}).get("name") or "").lower().strip()
            if sn and len(sn) > 3 and (sn in (o.get("text") or "").lower() or sn == on) and dt <= 72:
                return o["id"]
            if r.get("pos") and o.get("pos") and dt <= 36:
                d = km(r["pos"], o["pos"])
                if d <= 25 and fam(r["kind"]) == fam(o["kind"]):
                    return o["id"]
                if d <= 200 and (best is None or d < best[0]):
                    best = (d, o["id"])
        if best:
            r["dup_cand"] = [best[1]]
        return None

    def ingest(self, src, recs, initial):
        now = int(time.time() * 1000)
        new = []
        with self.lock:
            for rec in recs:
                iid, is_new = self._merge_src(rec, now)
                if is_new:
                    new.append(iid)
            if SRC_KIND.get(src) == "warning":       # ostrzeżenia wycofane ze źródła
                live = {src + ":" + str(r["key"]) for r in recs}
                for o in self.items.values():
                    if o["src"] == src and o["id"] not in live and not o.get("gone"):
                        o["gone"] = now
            for iid in new:
                d = self._auto_dup(iid)
                if d:
                    self._link(iid, d)
            for iid in new:
                r = self.items[iid]
                if not initial and not r.get("dup") and not r.get("warn") and r["t"] > now - 7 * 86400e3 and KINDS[r["kind"]][2] >= 3:
                    self._event(r)
        return new

    def _link(self, iid, master):
        while self.items.get(master, {}).get("dup"):
            master = self.items[master]["dup"]
        if master == iid or master not in self.items:
            return
        r, m = self.items[iid], self.items[master]
        r["dup"] = master; r.pop("dup_cand", None)
        m.setdefault("also", [])
        if iid not in m["also"]:
            m["also"].append(iid)
        if not m.get("pos") and r.get("pos"):
            m["pos"] = r["pos"]
        if not m.get("ship") and r.get("ship"):
            m["ship"] = r["ship"]

    def _event(self, r):
        en = i18n.en()
        msg = f"{KINDS[r['kind']][1 if en else 0]}: {(r.get('ai') or {}).get('title') or r.get('title') or ''} · {r.get('region') or ''} · {SRC_NAMES[r['src']]}"
        self.events.append({"at": int(time.time() * 1000), "kind": "marsec", "id": r["id"], "msg": msg[:220], "sev": r.get("sev", 3)})

    def cleanup(self):
        now = int(time.time() * 1000)
        with self.lock:
            for k in [k for k, v in self.items.items() if (v.get("warn") and v.get("gone") and now - v["gone"] > KEEP_WARN * 1000)
                      or (not v.get("warn") and now - (v.get("t") or v["first"]) > KEEP_INC * 1000 and now - v["seen"] > 86400e3)]:
                del self.items[k]
            for v in self.items.values():          # sieroty po usuniętym głównym wpisie
                if v.get("dup") and v["dup"] not in self.items:
                    v["dup"] = None

    # -- analiza AI: krótki tytuł, streszczenie, rodzaj, ważność, rozstrzyganie duplikatów (każdy wpis tylko raz)
    def enrich(self, limit=24):
        if not self.ai or not self.ai.status().get("ready"):
            return 0
        with self.lock:
            old = time.time() * 1000 - 30 * 86400e3        # starsze niż 30 dni zostają z oryginalnym tytułem – nie obciążamy karty
            todo = [r for r in self.items.values() if not r.get("ai") and not r.get("dup") and not r.get("ai_fail", 0) >= 2
                    and (r.get("t") or 0) > old and (not r.get("warn") or r["kind"] in ("mine", "gnss", "closure", "attack", "missile", "exercise", "launch"))]
            todo.sort(key=lambda r: (-(r.get("t") or 0)))
            todo = todo[:limit]
        done = 0
        for i in range(0, len(todo), 6):
            if self.busy():
                break                                 # trwa główna analiza – nie dokładamy pracy karcie graficznej
            batch = todo[i:i + 6]
            done += self._enrich_batch(batch)
            time.sleep(10)                            # przerwa między porcjami – karta graficzna odpoczywa
        if done:
            self.save()
        return done

    def _enrich_batch(self, batch):
        en = i18n.en()
        kinds = list(KINDS)
        lines = []
        cands = {}
        with self.lock:
            for n, r in enumerate(batch):
                cs = [self.items[c] for c in r.get("dup_cand", []) if c in self.items]
                if not cs:
                    for o in self.items.values():
                        if o is r or o.get("dup") or o.get("warn") or r.get("warn") or o["src"] == r["src"] or not (o.get("pos") and r.get("pos")):
                            continue
                        if abs((o.get("t") or 0) - (r.get("t") or 0)) < 72 * 3600e3 and km(o["pos"], r["pos"]) < 300:
                            cs.append(o)
                    cs = cs[:4]
                cands[n] = [c["id"] for c in cs]
                ctext = "\n".join(f"    KANDYDAT {c['id']}: {datetime.fromtimestamp((c.get('t') or 0) / 1000, timezone.utc):%Y-%m-%d %H:%M} | {c.get('region') or ''} | {(c.get('title') or '')[:100]} | {(c.get('text') or '')[:300]}" for c in cs)
                when = datetime.fromtimestamp((r.get("t") or 0) / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M")
                lines.append(f"[{n}] ŹRÓDŁO {SRC_NAMES[r['src']]} | {when} UTC | {r.get('region') or ''} | rodzaj wstępny: {r['kind']}\n    {(r.get('title') or '')[:160]}\n    {(r.get('text') or '')[:900]}" + (("\n" + ctext) if ctext else ""))
        schema = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
            "i": {"type": "integer"}, "title": {"type": "string"}, "summary": {"type": "string"}, "kind": {"type": "string", "enum": kinds},
            "sev": {"type": "integer"}, "dup_of": {"type": "string"}}, "required": ["i", "title", "summary", "kind", "sev", "dup_of"]}}}, "required": ["items"]}
        sysmsg = ("Jesteś analitykiem bezpieczeństwa morskiego w systemie KRONOS-7. Dostajesz zgłoszenia z oficjalnych źródeł (IMB, ReCAAP, NGA, UKHO, EUNAVFOR, MARAD). "
                  "Piszesz rzeczowo, bez dramatyzowania, wyłącznie na podstawie tekstu zgłoszenia.")
        prompt = (f"Dla każdego zgłoszenia podaj:\n"
                  f"title: do 70 znaków {'po angielsku' if en else 'po polsku'}, co się stało i gdzie (np. 'Ostrzelano kontenerowiec na Morzu Czerwonym').\n"
                  f"summary: 1–2 zdania {'po angielsku' if en else 'po polsku'}: przebieg, skutki, statek (typ, bandera) jeśli podane.\n"
                  f"kind: jeden z {', '.join(kinds)}.\n"
                  f"sev: 1 (rutyna) do 5 (atak z ofiarami, porwanie, trafienie rakietą).\n"
                  f"dup_of: jeśli zgłoszenie opisuje TO SAMO zdarzenie co któryś KANDYDAT (to samo miejsce, czas i statek) – podaj jego identyfikator; w przeciwnym razie pusty tekst.\n\n"
                  + "\n\n".join(lines))
        try:
            res = self.ai.chat_json(sysmsg, prompt, schema, temperature=0.1)
        except Exception as e:
            self.log(i18n.L(f"Bezpieczeństwo morskie: AI – błąd ({e}).", f"Maritime security: AI error ({e})."))
            with self.lock:
                for r in batch:
                    r["ai_fail"] = r.get("ai_fail", 0) + 1
            return 0
        n_ok = 0
        with self.lock:
            for x in res.get("items", []) if isinstance(res, dict) else []:
                i = x.get("i")
                if not isinstance(i, int) or not 0 <= i < len(batch):
                    continue
                r = batch[i]
                k = x.get("kind") if x.get("kind") in KINDS else r["kind"]
                if r.get("warn") and KINDS[k][3]:
                    k = r["kind"]                       # ostrzeżenie nie staje się incydentem
                r["ai"] = {"title": str(x.get("title") or "")[:90], "summary": str(x.get("summary") or "")[:400], "lang": "en" if en else "pl"}
                r["kind"] = k
                try:
                    r["sev"] = max(1, min(5, int(x.get("sev"))))
                except (TypeError, ValueError):
                    r["sev"] = KINDS[k][2]
                d = str(x.get("dup_of") or "").strip()
                if d and d in cands.get(i, []) and d in self.items:
                    self._link(r["id"], d)
                r.pop("dup_cand", None)
                n_ok += 1
            for r in batch:
                if not r.get("ai"):
                    r["ai_fail"] = r.get("ai_fail", 0) + 1
        return n_ok

    # -- pętla
    FETCH = (("nga", lambda s: fetch_nga()), ("ukho", lambda s: fetch_ukho()), ("imb", lambda s: fetch_imb()), ("recaap", lambda s: fetch_recaap()),
             ("eunavfor", lambda s: fetch_eunavfor(s._known("eunavfor"))), ("marad", lambda s: fetch_marad(s._known("marad"))))

    def _known(self, src):
        with self.lock:
            return {str(v["key"]) for v in self.items.values() if v["src"] == src and len(v.get("text") or "") > 200}

    def fetch_all(self):
        initial = not self.loaded
        tot = 0
        for src, fn in self.FETCH:
            try:
                recs = fn(self)
                new = self.ingest(src, recs, initial)
                self.status[src] = {"ok": True, "n": len(recs), "new": len(new), "err": None, "at": int(time.time() * 1000)}
                tot += len(new)
            except Exception as e:
                msg = str(e)[:160]
                if "403" in msg:
                    msg = i18n.L("serwer źródła odrzucił połączenie (403)", "source server refused the connection (403)")
                self.status[src] = dict(self.status.get(src) or {}, ok=False, err=msg, at=int(time.time() * 1000))
        self.loaded = True
        self.cleanup()
        self.save()
        if tot:
            self.log(i18n.L(f"Bezpieczeństwo morskie: {tot} nowych wpisów.", f"Maritime security: {tot} new entries."))
        self.last_fetch = time.time()

    def loop(self):
        time.sleep(8)
        while True:
            try:
                self.fetch_all()
                self.enrich(60)
            except Exception as e:
                self.log(f"MarSec: {e}")
            self.wake.wait(INTERVAL); self.wake.clear()

    def start(self, ai=None, busy=None):
        self.ai = ai
        if busy:
            self.busy = busy
        threading.Thread(target=self.loop, daemon=True, name="marsec").start()

    # -- widoki
    def view(self, days=60):
        now = int(time.time() * 1000)
        en = i18n.en()
        out = []
        with self.lock:
            for r in self.items.values():
                if r.get("dup"):
                    continue
                if not r.get("warn") and (r.get("t") or 0) < now - days * 86400e3:
                    continue
                if r.get("gone"):
                    continue
                ai = r.get("ai") or {}
                srcs = [r["src"]] + [self.items[a]["src"] for a in r.get("also", []) if a in self.items]
                out.append({"id": r["id"], "src": srcs, "t": r.get("t"), "kind": r["kind"], "sev": r.get("sev", 1), "pos": r.get("pos"),
                            "title": ai.get("title") or r.get("title"), "ai": bool(ai), "region": r.get("region"), "warn": bool(r.get("warn")),
                            "area": bool(r.get("area"))})
        out.sort(key=lambda x: -(x["t"] or 0))
        return {"items": out, "status": {k: dict(v, name=SRC_NAMES.get(k, k)) for k, v in self.status.items() if k in FETCHED},
                "kinds": {k: v[1 if en else 0] for k, v in KINDS.items()}, "incident_kinds": [k for k, v in KINDS.items() if v[3]]}

    def detail(self, iid):
        with self.lock:
            r = self.items.get(iid)
            if not r:
                return None
            while r.get("dup") and r["dup"] in self.items:
                r = self.items[r["dup"]]
            out = {k: v for k, v in r.items() if k not in ("dup_cand",)}
            out["reports"] = [{"src": x["src"], "name": x.get("via") and f"{x['via']} (e-mail)" or SRC_NAMES.get(x["src"], x["src"]), "ref": x.get("ref"), "t": x.get("t"), "title": x.get("title"), "text": x.get("text"), "url": x.get("url")}
                              for x in [r] + [self.items[a] for a in r.get("also", []) if a in self.items]]
        out["src_name"] = SRC_NAMES[r["src"]]
        return out

    def brief(self, days=7, limit=25):
        """Skrót dla analizy AI (briefing, poziom napięcia): najważniejsze incydenty z ostatnich dni, bez duplikatów."""
        now = int(time.time() * 1000)
        with self.lock:
            rs = [r for r in self.items.values() if not r.get("dup") and not r.get("gone") and (r.get("t") or 0) > now - days * 86400e3
                  and (not r.get("warn") or r["kind"] in ("mine", "gnss", "closure", "missile", "attack"))]
        rs.sort(key=lambda r: (-r.get("sev", 1), -(r.get("t") or 0)))
        return [{"when": datetime.fromtimestamp((r.get("t") or 0) / 1000, timezone.utc).strftime("%Y-%m-%d"), "kind": r["kind"], "sev": r.get("sev"),
                 "where": r.get("region"), "what": (r.get("ai") or {}).get("summary") or (r.get("ai") or {}).get("title") or r.get("title"),
                 "src": SRC_NAMES[r["src"]]} for r in rs[:limit]]

    def counts(self, hours=24):
        now = int(time.time() * 1000)
        with self.lock:
            inc = [r for r in self.items.values() if not r.get("dup") and not r.get("warn") and (r.get("t") or 0) > now - hours * 3600e3]
        return {"n24": len(inc), "hi24": sum(1 for r in inc if r.get("sev", 1) >= 4), "ev": self.events[-1] if self.events else None}
