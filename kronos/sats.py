"""Katalog satelitów z CelesTrak (TLE), z podziałem na grupy, w tym wojskowe.

Pobierane są tylko 4 pliki (aktywne, wojskowe, analityczne, stacje), raz na 12 godzin,
i trzymane w data/tle/. Pozostałe grupy powstają z nazw w katalogu aktywnych.
CelesTrak prosi, by nie pobierać tych samych danych częściej niż co 2 godziny."""
import re, threading, time, urllib.request
from pathlib import Path

UA = "KRONOS-7/3.5 (+https://github.com/vipersq/Kronos-7)"
URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP={g}&FORMAT=tle"
FILES = {"active": "active", "military": "military", "analyst": "analyst", "stations": "stations"}
MAX_AGE = 12 * 3600

MIL_RE = re.compile(r"^(USA[ -]?\d|NROL|KOSMOS|COSMOS \d+(?!.*GLONASS)|YAOGAN|SAR-LUPE|SARAH|CSO-|HELIOS|OFEQ|OFEK|IGS[ -]|SBIRS|WGS[ -]?\d|MUOS|AEHF|MILSTAR|"
                    r"DSCS|SKYNET|SYRACUSE|SICRAL|TJS|TONGXIN JISHU|SHIJIAN|OLYMP|MERIDIAN|TUNDRA|KONDOR|BARS-M|LOTOS|PERSONA|STRELA|RODNIK|"
                    r"BLAGOVEST|GONETS|UFO[ -]|GSSAP|SAPPHIRE|PRAETORIAN|JIANBING|TIANHUI|XJS|425 PROJECT|EROS|SPAINSAT|STPSAT|ORS-|SDA |TRANCHE|"
                    r"NAVY|DMSP|SECTOR|PAZ|COSMO-SKYMED|ZIYUAN|HUANJING|CHUANGXIN|LUCH|RAZDAN|PION-NKS|LIANA|EKS)", re.I)
GROUPS = [
    ("stations", "Stacje kosmiczne (ISS, Tiangong)", None),
    ("military", "Wojskowe i rozpoznawcze", MIL_RE),
    ("analyst", "Niezidentyfikowane obiekty (analyst – często niejawne)", None),
    ("gnss", "Nawigacja: GPS, GLONASS, Galileo, BeiDou", re.compile(r"^(GPS|NAVSTAR)|GLONASS|^GSAT0|GALILEO|^BEIDOU|^QZS|^IRNSS|^NVS-", re.I)),
    ("weather", "Meteorologiczne", re.compile(r"^(NOAA|GOES|METOP|METEOSAT|METEOR|FENGYUN|FY-?\d|HIMAWARI|ELEKTRO|JPSS|SUOMI|ARKTIKA|MTG-)", re.I)),
    ("earth", "Obserwacja Ziemi i radary SAR", re.compile(r"^(SENTINEL|LANDSAT|WORLDVIEW|PLEIADES|SPOT[ -]|TERRA|AQUA|GAOFEN|RESURS|KANOPUS|SKYSAT|ICEYE|CAPELLA|UMBRA|"
                                                         r"RADARSAT|TERRASAR|TANDEM|KOMPSAT|FLOCK|JILIN|SUPERVIEW|BLACKSKY|PELICAN|LEGION|NEONSAT|SAOCOM|ALOS)", re.I)),
    ("comms", "Łączność (GEO i inne)", re.compile(r"^(INTELSAT|SES[ -]|EUTELSAT|ASTRA|INMARSAT|VIASAT|ECHOSTAR|TELKOM|THURAYA|EXPRESS|YAMAL|CHINASAT|APSTAR|ARABSAT|"
                                                   r"TURKSAT|HISPASAT|AMAZONAS|DIRECTV|TDRS|GALAXY|HOTBIRD|NILESAT|O3B)", re.I)),
    ("amateur", "Krótkofalarskie", re.compile(r"^(AO-|SO-|RS-|FO-|CAS-|XW-|IO-|PO-|JO-|LILACSAT|FUNCUBE|ISS \(ZARYA\)|TEVEL|GREENCUBE|HADES|UVSQ)", re.I)),
    ("science", "Teleskopy i naukowe", re.compile(r"^(HST|HUBBLE|CHANDRA|SWIFT|FERMI|NUSTAR|TESS|XMM|INTEGRAL|NEIL GEHRELS|XRISM|EINSTEIN|SVOM|IXPE|ICESAT|GRACE|SMAP|CALIPSO)", re.I)),
    ("starlink", "Starlink (ponad 10 000)", re.compile(r"^STARLINK", re.I)),
    ("oneweb", "OneWeb", re.compile(r"^ONEWEB", re.I)),
    ("kuiper", "Kuiper (Amazon)", re.compile(r"^KUIPER", re.I)),
    ("china_mega", "Qianfan i Guowang (Chiny)", re.compile(r"^(QIANFAN|GUOWANG|SPACESAIL|HULIANWANG)", re.I)),
    ("iridium", "Iridium", re.compile(r"^IRIDIUM", re.I)),
    ("all", "Wszystkie aktywne (ok. 16 000)", None),
]
LABEL = {g[0]: g[1] for g in GROUPS}


def parse_tle(text):
    lines, out, i = [l.rstrip() for l in text.splitlines() if l.strip()], [], 0
    while i < len(lines) - 2:
        n, a, b = lines[i].strip(), lines[i + 1], lines[i + 2]
        if a.startswith("1 ") and b.startswith("2 "):
            try:
                out.append([n, int(a[2:7]), a, b])
            except ValueError:
                pass
            i += 3
        else:
            i += 1
    return out


class Catalog:
    def __init__(self, data_dir, log=print):
        self.dir = Path(data_dir) / "tle"; self.dir.mkdir(parents=True, exist_ok=True)
        self.log = log
        self.raw = {}            # plik -> lista [nazwa, norad, l1, l2]
        self.groups = {}         # grupa -> lista NORAD
        self.by_id = {}
        self.at = 0
        self.lock = threading.Lock()
        self.loading = False
        self.err = None

    def _file(self, name):
        p = self.dir / f"{name}.txt"
        fresh = p.exists() and time.time() - p.stat().st_mtime < MAX_AGE
        if not fresh:
            try:
                req = urllib.request.Request(URL.format(g=FILES[name]), headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    t = r.read().decode("utf-8", "replace")
                if "1 " in t and len(t) > 200:
                    p.write_text(t, encoding="utf-8")
            except Exception as e:
                self.err = f"{name}: {e}"
                self.log(f"Satelity: nie udało się pobrać {name} z CelesTrak ({e}) – używam kopii.")
        return p.read_text(encoding="utf-8") if p.exists() else ""

    def ensure(self):
        if self.at and time.time() - self.at < MAX_AGE:
            return True
        with self.lock:
            if self.at and time.time() - self.at < MAX_AGE:
                return True
            self.loading = True
            try:
                raw = {}
                for i, name in enumerate(FILES):
                    if i:
                        time.sleep(1.5)       # łagodnie dla CelesTrak
                    raw[name] = parse_tle(self._file(name))
                by_id = {}
                for name in ("active", "military", "analyst", "stations"):
                    for s in raw[name]:
                        by_id.setdefault(s[1], s)
                groups = {"stations": [s[1] for s in raw["stations"]], "analyst": [s[1] for s in raw["analyst"]],
                          "all": [s[1] for s in raw["active"]]}
                mil = {s[1] for s in raw["military"]}
                for gid, _, rx in GROUPS:
                    if rx is None:
                        continue
                    ids = [s[1] for s in raw["active"] if rx.search(s[0])]
                    if gid == "military":
                        ids = sorted(mil | set(ids))
                    groups[gid] = ids
                self.raw, self.by_id, self.groups, self.at = raw, by_id, groups, time.time()
                self.log(f"Satelity: katalog {len(by_id)} obiektów, w tym {len(groups['military'])} wojskowych.")
                return bool(by_id)
            finally:
                self.loading = False

    def list_groups(self):
        return [{"id": g, "label": l, "n": len(self.groups.get(g, []))} for g, l, _ in GROUPS]   # etykiety tłumaczy interfejs

    def group(self, gid):
        self.ensure()
        return [self.by_id[i] for i in self.groups.get(gid, []) if i in self.by_id]

    def tles(self, ids):
        self.ensure()
        return [self.by_id[i] for i in ids if i in self.by_id]

    def search(self, q, limit=60):
        self.ensure()
        q = q.strip().upper()
        if not q:
            return []
        member = {}
        for g, ids in self.groups.items():
            if g == "all":
                continue
            for i in ids:
                member.setdefault(i, []).append(g)
        res = []
        for i, s in self.by_id.items():
            if q in s[0].upper() or q == str(i):
                res.append({"name": s[0], "id": i, "groups": member.get(i, [])})
                if len(res) >= limit:
                    break
        return res
