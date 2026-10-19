"""KRONOS-7 — automatyczne feedy (16 otwartych źródeł).
Przeniesione z wersji chmurowej. Każdy feed jest niezależny: błąd jednego nie zatrzymuje reszty,
a przy błędzie zostają poprzednie dane z oznaczeniem "stale". Pakiety pycountry (nazwy krajów)
i h3 (GPSJam) są opcjonalne: bez nich feedy działają w ograniczonym zakresie."""
import json, csv, gzip, io, re, time, math, datetime as dt, html, os
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from .collector import fetch as _fetch

NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date()
STATUS = []
LAND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "vendor", "land.js")


def fetch(name, url, timeout=60, binary=False):
    b = _fetch(url, timeout=timeout)
    return b if binary else b.decode("utf-8", "replace")


def feed(fid, name, url, reliab, note=""):
    def deco(fn):
        def run():
            t0 = time.time()
            try:
                out = fn()
                n = len(out) if isinstance(out, (list, dict)) else None
                STATUS.append({"id": fid, "name": name, "url": url, "ok": True, "n": n, "rel": reliab, "note": note,
                               "t": NOW.strftime("%Y-%m-%dT%H:%MZ"), "ms": int((time.time() - t0) * 1000)})
                return out
            except Exception as e:  # noqa
                STATUS.append({"id": fid, "name": name, "url": url, "ok": False, "err": str(e)[:160], "rel": reliab, "note": note,
                               "t": NOW.strftime("%Y-%m-%dT%H:%MZ")})
                return None
        run.fid = fid
        return run
    return deco

# ---------- country helpers ----------
try:
    import pycountry, gettext
    try:
        PL = gettext.translation("iso3166-1", pycountry.LOCALES_DIR, languages=["pl"]).gettext
    except Exception:
        PL = lambda s: s
except ImportError:
    pycountry = None
    PL = lambda s: s
SHORT = {"IR": "Iran", "RU": "Rosja", "SY": "Syria", "KP": "Korea Północna", "KR": "Korea Południowa", "CD": "DR Konga",
         "CG": "Kongo", "VE": "Wenezuela", "BO": "Boliwia", "TZ": "Tanzania", "MD": "Mołdawia", "TW": "Tajwan", "VN": "Wietnam",
         "LA": "Laos", "PS": "Palestyna", "GB": "Wielka Brytania", "US": "USA", "AE": "ZEA", "CZ": "Czechy", "MK": "Macedonia Płn.",
         "FM": "Mikronezja", "BN": "Brunei", "XK": "Kosowo", "CI": "Wybrzeże Kości Słoniowej", "TR": "Turcja", "NL": "Holandia"}
NAME_FIX = {"democratic republic of the congo": "CD", "democratic republic congo": "CD", "dr congo": "CD", "congo dr": "CD",
            "iran islamic republic": "IR", "syrian arab republic": "SY", "occupied palestinian territory": "PS", "russian federation": "RU",
            "the russian federation": "RU", "kingdom of saudi arabia": "SA", "turkiye": "TR", "türkiye": "TR", "lao pdr": "LA",
            "united republic of tanzania": "TZ", "venezuela bolivarian republic": "VE", "bolivia plurinational state": "BO",
            "korea democratic people s republic": "KP", "republic of korea": "KR", "moldova republic": "MD", "viet nam": "VN",
            "cote d ivoire": "CI", "burma": "MM", "myanmar": "MM", "the bahamas": "BS", "united states": "US", "united states america": "US", "usa": "US",
            "uk": "GB", "united kingdom": "GB", "kosovo": "XK", "gaza": "PS", "west bank": "PS", "israel the west bank and gaza": "IL",
            "mainland china": "CN", "china": "CN", "macau": "MO", "hong kong": "HK", "taiwan": "TW", "micronesia": "FM", "north korea": "KP", "south korea": "KR"}
def plname(a2=None, name=None):
    c = None
    if pycountry is None:
        return name or a2 or "?", None
    if name and not a2:
        k = re.sub(r"[^a-z ]", " ", name.lower().replace("’", " ").replace("'", " ")); k = re.sub(r"\s+", " ", k).strip()
        if k in NAME_FIX:
            a2 = NAME_FIX[k]
            if a2 == "XK": return "Kosowo", None
    try:
        if a2: c = pycountry.countries.get(alpha_2=a2)
        if not c and name:
            try: c = pycountry.countries.lookup(name)
            except LookupError:
                c = pycountry.countries.search_fuzzy(name)[0]
    except Exception:
        c = None
    if not c: return name or a2 or "?", None
    if c.alpha_2 in SHORT: return SHORT[c.alpha_2], c
    return PL(c.name), c

def load_centroids():
    s = open(LAND, encoding="utf-8").read()
    topo = json.loads(s[s.index("{"): s.rindex("}") + 1])
    sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        x = y = 0; pts = []
        for dx, dy in a:
            x += dx; y += dy; pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)
    def ring(idx):
        out = []
        for i in idx:
            pts = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(pts)
        return out
    cent = {}
    for g in topo["objects"]["countries"]["geometries"]:
        polys = g.get("arcs") or []
        if g["type"] == "Polygon": polys = [polys]
        best = None; barea = -1
        for poly in polys:
            r = ring(poly[0])
            if not r: continue
            xs = [p[0] for p in r]; ys = [p[1] for p in r]
            area = (max(xs) - min(xs)) * (max(ys) - min(ys))
            if area > barea: barea, best = area, r
        if best:
            cent[str(g.get("id"))] = (round(sum(p[1] for p in best) / len(best), 2), round(sum(p[0] for p in best) / len(best), 2))
    return cent
try:
    CENT = load_centroids()
except Exception:
    CENT = {}
def centroid(c):
    if not c: return None
    n = getattr(c, "numeric", None)
    return (CENT.get(n) or CENT.get(str(int(n)))) if n else None

def d10(s): return s[:10] if s else None

# ---------- feeds ----------
PW_URL = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query"
PW_MAP = {"hormuz": "chokepoint6", "bab": "chokepoint4", "suez": "chokepoint1", "blacksea": "chokepoint3", "malacca": "chokepoint5",
          "taiwan": "chokepoint11", "panama": "chokepoint2", "cape": "chokepoint7", "kerch": "chokepoint28", "gibraltar": "chokepoint8"}
@feed("portwatch", "IMF PortWatch – przejścia przez wąskie gardła", "https://portwatch.imf.org/pages/chokepoints", "A", "dane AIS, opóźnienie ok. 5–7 dni")
def f_portwatch():
    since = (TODAY - dt.timedelta(days=75)).isoformat()
    ids = ",".join("'%s'" % v for v in PW_MAP.values())
    q = f"{PW_URL}?where=portid+IN+({ids})+AND+date%3E%3D%27{since}%27&outFields=date,portid,portname,n_total,n_tanker&orderByFields=date&resultRecordCount=4000&f=json"
    q = q.replace("'", "%27").replace(" ", "+")
    rows = json.loads(fetch("pw.json", q))["features"]
    b0 = (TODAY - dt.timedelta(days=365 + 45)).isoformat(); b1 = (TODAY - dt.timedelta(days=365 - 15)).isoformat()
    qb = f"{PW_URL}?where=portid+IN+({ids})+AND+date%3E%3D%27{b0}%27+AND+date%3C%3D%27{b1}%27&outFields=portid,n_total&resultRecordCount=4000&f=json".replace("'", "%27")
    base = json.loads(fetch("pwb.json", qb))["features"]
    bavg = defaultdict(list)
    for f in base: bavg[f["attributes"]["portid"]].append(f["attributes"]["n_total"])
    ser = defaultdict(list); names = {}
    for f in rows:
        a = f["attributes"]; ser[a["portid"]].append([a["date"], a["n_total"], a["n_tanker"]]); names[a["portid"]] = a["portname"]
    out = {}
    for sid, pid in PW_MAP.items():
        s = sorted(ser.get(pid, []))[-60:]
        if not s: continue
        last7 = [x[1] for x in s[-7:]]
        out[sid] = {"name": names.get(pid), "last": s[-1][0], "series": s, "avg7": round(sum(last7) / len(last7), 1),
                    "base": round(sum(bavg[pid]) / len(bavg[pid]), 1) if bavg.get(pid) else None}
    return out

@feed("ioda", "IODA (Georgia Tech) – odcięcia internetu", "https://ioda.inetintel.cc.gatech.edu/", "A", "wskaźnik zakłóceń z BGP, ping i ruchu; sygnał, nie potwierdzenie")
def f_ioda():
    u = int(NOW.timestamp()); f = u - 48 * 3600
    d = json.loads(fetch("ioda.json", f"https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?from={f}&until={u}&entityType=country&limit=40"))["data"]
    out = []
    for e in d:
        ent = e["entity"]; nm, c = plname(ent["code"], ent["name"]); ll = centroid(c)
        sc = e["scores"].get("overall", 0)
        out.append({"cc": ent["code"], "name": nm, "score": round(math.log10(sc + 1), 2), "events": e.get("event_cnt"),
                    "src": sorted(k.split(".")[0] for k in e["scores"] if k != "overall"), "lat": ll[0] if ll else None, "lon": ll[1] if ll else None,
                    "u": f"https://ioda.inetintel.cc.gatech.edu/country/{ent['code']}"})
    out.sort(key=lambda x: -x["score"])
    return out[:20]

MIL_TYPES = {"K35R": "tanker", "KC46": "tanker", "K46": "tanker", "A332": "tanker", "A330": "tanker", "KC10": "tanker", "K10": "tanker", "MRTT": "tanker",
             "R135": "isr", "E3TF": "isr", "E3CF": "isr", "E3": "isr", "E6": "isr", "E7": "isr", "P8": "isr", "Q4": "isr", "RQ4": "isr", "GLF5": "isr",
             "E2": "isr", "U2": "isr", "C135": "isr", "B350": "isr", "MQ9": "isr", "Q9": "isr", "P3": "isr", "E8": "isr",
             "B52": "bomber", "B1": "bomber", "B2": "bomber",
             "C17": "transport", "C5M": "transport", "C5": "transport", "C30J": "transport", "C130": "transport", "A400": "transport", "IL76": "transport",
             "F35": "fighter", "F16": "fighter", "F15": "fighter", "F18": "fighter", "EUFI": "fighter", "RFAL": "fighter", "F22": "fighter"}
@feed("adsb", "adsb.fi / adsb.lol – samoloty wojskowe (ADS-B)", "https://adsb.fi/", "B", "migawka dla analizy AI; na mapie samoloty są na żywo; transpondery bywają wyłączane, brak pokrycia nad Rosją i Iranem")
def f_adsb():
    try:
        d = json.loads(fetch("mil.json", "https://opendata.adsb.fi/api/v2/mil"))
    except Exception:
        d = json.loads(fetch("mil.json", "https://api.adsb.lol/v2/mil"))
    out = []
    for a in d.get("ac", []):
        if a.get("lat") is None: continue
        t = (a.get("t") or "").upper(); cat = MIL_TYPES.get(t)
        in_na = 15 < a["lat"] < 72 and -170 < a["lon"] < -50
        if not cat and in_na: continue
        if cat is None: cat = "other"
        if in_na and cat in ("transport", "fighter", "other"): continue
        alt = a.get("alt_baro"); alt = 0 if alt == "ground" else alt
        out.append({"hex": a.get("hex"), "cs": (a.get("flight") or a.get("r") or "").strip(), "t": t, "cat": cat, "lat": round(a["lat"], 2), "lon": round(a["lon"], 2),
                    "alt": alt, "trk": round(a.get("track") or 0), "u": f"https://globe.adsb.lol/?icao={a.get('hex')}"})
    rank = {"isr": 0, "tanker": 1, "bomber": 2, "transport": 3, "fighter": 4, "other": 5}
    out.sort(key=lambda x: rank[x["cat"]])
    return {"t": NOW.strftime("%H:%M UTC %d.%m"), "total": d.get("total"), "ac": out[:90]}

GD_TYPES = {"EQ": "trzęsienie ziemi", "TC": "cyklon tropikalny", "FL": "powódź", "VO": "erupcja wulkanu", "DR": "susza", "WF": "pożar lasu", "TS": "tsunami"}
GD_ALERT = {"Red": "CZERWONY", "Orange": "POMARAŃCZOWY", "Green": "ZIELONY"}
@feed("gdacs", "GDACS (ONZ/UE) – alerty katastrof", "https://www.gdacs.org/", "A", "alerty pomarańczowe i czerwone z 10 dni")
def f_gdacs():
    a = (TODAY - dt.timedelta(days=10)).isoformat()
    d = json.loads(fetch("gdacs.json", f"https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?alertlevel=Orange;Red&fromDate={a}&toDate={TODAY.isoformat()}"))
    out = []
    for f in d.get("features", []):
        p = f["properties"]; g = f.get("geometry") or {}
        lon, lat = (g.get("coordinates") or [None, None])[:2]
        ev = {"type": p.get("eventtype"), "kind": GD_TYPES.get(p.get("eventtype"), p.get("eventtype")), "name": p.get("eventname") or p.get("name"),
              "country": p.get("country"), "alert": GD_ALERT.get(p.get("alertlevel"), p.get("alertlevel")), "lvl": p.get("alertlevel"),
              "from": d10(p.get("fromdate")), "to": d10(p.get("todate")), "lat": lat, "lon": lon,
              "sev": (p.get("severitydata") or {}).get("severitytext"), "u": (p.get("url") or {}).get("report"), "track": None}
        if ev["type"] == "TC":
            try:
                gj = json.loads(fetch(f"tc{p.get('eventid')}.json", (p.get("url") or {}).get("geometry")))
                pts = []
                for ff in gj.get("features", []):
                    gg = ff.get("geometry") or {}
                    cls = (ff.get("properties") or {}).get("Class", "")
                    if gg.get("type") == "Point" and "Point" in cls:
                        pts.append([round(gg["coordinates"][1], 2), round(gg["coordinates"][0], 2), (ff["properties"].get("polygonlabel") or "")[:24]])
                ev["track"] = pts[:80]
            except Exception:
                pass
        out.append(ev)
    return out

@feed("kev", "CISA KEV – luki aktywnie wykorzystywane", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", "A", "dodane w ostatnich 14 dniach")
def f_kev():
    d = json.loads(fetch("kev.json", "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"))
    lim = (TODAY - dt.timedelta(days=14)).isoformat()
    v = [x for x in d["vulnerabilities"] if x["dateAdded"] >= lim]
    v.sort(key=lambda x: x["dateAdded"], reverse=True)
    return [{"cve": x["cveID"], "vendor": x["vendorProject"], "product": x["product"], "name": x["vulnerabilityName"], "added": x["dateAdded"],
             "due": x.get("dueDate"), "ransom": x.get("knownRansomwareCampaignUse") == "Known", "u": f"https://nvd.nist.gov/vuln/detail/{x['cveID']}"} for x in v[:25]]

FIRE_REG = [("Ukraina / zach. Rosja", 44.0, 60.0, 22.0, 50.0), ("Lewant", 29.0, 37.5, 33.0, 42.0), ("Jemen / Arabia", 12.0, 30.0, 35.0, 50.0),
            ("Sudan", 8.0, 22.5, 21.0, 39.0), ("Mjanma", 15.5, 28.5, 92.0, 101.0)]
@feed("firms", "NASA FIRMS – ogniska pożarów (VIIRS, 24 h)", "https://firms.modaps.eosdis.nasa.gov/", "A", "zawiera pożary rolnicze i pochodnie gazowe; liczy się nagłe pojawienie w rejonie walk")
def f_firms():
    raw = fetch("firms.csv", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv", timeout=120)
    cells = {}
    for r in csv.DictReader(io.StringIO(raw)):
        try:
            la, lo, frp = float(r["latitude"]), float(r["longitude"]), float(r["frp"] or 0)
        except Exception:
            continue
        if str(r.get("confidence", "")).lower()[:1] not in ("h", "n") or frp < 8: continue
        reg = next((n for n, a, b, c, d in FIRE_REG if a <= la <= b and c <= lo <= d), None)
        if not reg: continue
        k = (round(la * 5) / 5, round(lo * 5) / 5)
        c = cells.setdefault(k, {"lat": k[0], "lon": k[1], "n": 0, "frp": 0.0, "reg": reg, "t": r.get("acq_date")})
        c["n"] += 1; c["frp"] += frp
    out = [dict(c, frp=round(c["frp"])) for c in cells.values() if c["frp"] >= 40]
    out.sort(key=lambda c: -c["frp"])
    return out[:120]

@feed("ll2", "Launch Library 2 – starty rakiet", "https://thespacedevs.com/llapi", "A", "")
def f_ll2():
    up = json.loads(fetch("ll2u.json", "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=10&mode=normal"))["results"]
    pr = json.loads(fetch("ll2p.json", "https://ll.thespacedevs.com/2.3.0/launches/previous/?limit=6&mode=normal"))["results"]
    def m(x, past):
        pad = x.get("pad") or {}; loc = (pad.get("location") or {})
        return {"net": x.get("net"), "name": x.get("name"), "prov": ((x.get("launch_service_provider") or {}).get("name")),
                "pad": loc.get("name") or pad.get("name"), "st": (x.get("status") or {}).get("abbrev"), "past": past,
                "lat": float(pad["latitude"]) if pad.get("latitude") else None, "lon": float(pad["longitude"]) if pad.get("longitude") else None,
                "u": "https://ll.thespacedevs.com/2.3.0/launches/%s/" % x.get("id")}
    return [m(x, True) for x in reversed(pr)] + [m(x, False) for x in up]

@feed("nbp", "NBP – kursy średnie (tabela A)", "https://api.nbp.pl/", "A", "oficjalne kursy złotego")
def f_nbp():
    d = json.loads(fetch("nbp.json", "https://api.nbp.pl/api/exchangerates/tables/A/last/10/?format=json"))
    want = ["USD", "EUR", "GBP", "CHF", "UAH", "CNY", "JPY"]
    ser = defaultdict(list)
    for t in d:
        for r in t["rates"]:
            if r["code"] in want: ser[r["code"]].append([t["effectiveDate"], r["mid"]])
    return {c: ser[c] for c in want if ser.get(c)}

GPS_REG = [("Bałtyk i Kaliningrad", 53.0, 61.0, 12.0, 30.0), ("Morze Czarne i Ukraina", 43.0, 52.5, 28.0, 41.0), ("Bliski Wschód", 25.0, 38.0, 30.0, 45.0),
           ("Zatoka Perska", 22.0, 31.0, 46.0, 60.0), ("Kaukaz", 38.0, 44.0, 40.0, 50.5), ("Korea", 33.0, 40.0, 124.0, 131.0)]
@feed("gpsjam", "GPSJam – zakłócenia GNSS (z ADS-B)", "https://gpsjam.org/", "B", "dane z poprzedniej doby; heksy z ≥10% samolotów ze słabą nawigacją")
def f_gpsjam():
    try:
        import h3
    except ImportError:
        raise RuntimeError("brak pakietu h3 (pip install h3)")
    day = (TODAY - dt.timedelta(days=1)).isoformat()
    b = fetch("gps.csv", f"https://gpsjam.org/data/{day}-h3_4.csv", binary=True)
    txt = gzip.decompress(b).decode() if b[:2] == b"\x1f\x8b" else b.decode()
    pts = []; reg = defaultdict(int)
    for r in csv.DictReader(io.StringIO(txt)):
        g, bad = int(r["count_good_aircraft"]), int(r["count_bad_aircraft"])
        tot = g + bad
        if tot < 3: continue
        pct = bad / tot
        if pct < 0.1: continue
        la, lo = h3.cell_to_latlng(r["hex"])
        pts.append([round(la, 2), round(lo, 2), round(pct, 2)])
        for n, a, b2, c, d in GPS_REG:
            if a <= la <= b2 and c <= lo <= d: reg[n] += 1
    pts.sort(key=lambda p: -p[2])
    return {"day": day, "pts": pts[:1800], "regions": dict(sorted(reg.items(), key=lambda x: -x[1])), "n": len(pts)}

DIS = {"Ebola disease": "Ebola", "Middle East respiratory syndrome coronavirus": "MERS-CoV", "Pneumonia of undetermined etiology": "Zapalenie płuc o nieznanej przyczynie",
       "Cholera": "Cholera", "Avian Influenza": "Ptasia grypa", "Mpox": "Mpox", "Marburg virus disease": "Gorączka Marburg", "Dengue": "Denga",
       "Yellow fever": "Żółta febra", "Measles": "Odra", "Nipah virus": "Wirus Nipah", "Poliomyelitis": "Polio", "Anthrax": "Wąglik", "Plague": "Dżuma"}
@feed("who", "WHO – Disease Outbreak News", "https://www.who.int/emergencies/disease-outbreak-news", "A", "")
def f_who():
    d = json.loads(fetch("who.json", "https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$orderby=PublicationDateAndTime%20desc&$top=12"))["value"]
    out = []; seen = set()
    for x in d:
        t = x.get("OverrideTitle") or x.get("Title") or ""
        dis, _, ctry = t.rpartition(" - ") if " - " in t else (t, "", "")
        key = (dis, ctry)
        if key in seen: continue
        seen.add(key)
        dpl = next((v for k, v in DIS.items() if dis.lower().startswith(k.lower())), dis)
        if "Bundibugyo" in dis: dpl = "Ebola (szczep Bundibugyo)"
        nm, c = plname(None, re.sub(r"^(the|Kingdom of)\s+", "", ctry, flags=re.I)) if ctry else ("świat", None)
        ll = centroid(c)
        out.append({"d": d10(x.get("PublicationDateAndTime")), "dis": dpl, "country": nm, "lat": ll[0] if ll else None, "lon": ll[1] if ll else None,
                    "id": x.get("DonId"), "u": "https://www.who.int/emergencies/disease-outbreak-news/item" + (x.get("ItemDefaultUrl") or "")})
    return out[:8]

@feed("nhc", "NOAA NHC – aktywne cyklony (Atlantyk, Pacyfik wsch.)", "https://www.nhc.noaa.gov/", "A", "Pacyfik zach. i Ocean Indyjski: patrz GDACS")
def f_nhc():
    d = json.loads(fetch("nhc.json", "https://www.nhc.noaa.gov/CurrentStorms.json"))
    cls = {"HU": "huragan", "TS": "burza tropikalna", "TD": "depresja tropikalna", "PTC": "potencjalny cyklon", "STS": "burza subtropikalna"}
    return [{"name": s["name"], "cls": cls.get(s.get("classification"), s.get("classification")), "kt": int(s.get("intensity") or 0),
             "kmh": round(int(s.get("intensity") or 0) * 1.852), "hpa": s.get("pressure"), "lat": s.get("latitudeNumeric"), "lon": s.get("longitudeNumeric"),
             "dir": s.get("movementDir"), "spd": s.get("movementSpeed"), "t": s.get("lastUpdate"),
             "u": ((s.get("publicAdvisory") or {}).get("url"))} for s in d.get("activeStorms", [])]

LVL = {1: "zachowaj zwykłą ostrożność", 2: "zachowaj zwiększoną ostrożność", 3: "rozważ rezygnację z podróży", 4: "nie podróżuj"}
@feed("travel", "Departament Stanu USA + FCDO (UK) – ostrzeżenia podróżne", "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html", "A", "")
def f_travel():
    t = fetch("us.xml", "https://travel.state.gov/_res/rss/TAsTWs.xml")
    us = []
    for it in re.findall(r"<item>(.*?)</item>", t, re.S):
        title = html.unescape(re.sub(r"<.*?>", "", (re.search(r"<title>(.*?)</title>", it, re.S) or [None, ""])[1])).strip()
        m = re.match(r"(.+?)\s*-\s*Level\s*(\d)", title)
        if not m: continue
        pd = (re.search(r"<pubDate>(.*?)</pubDate>", it) or [None, ""])[1]
        try: day = dt.datetime.strptime(pd.strip()[:16], "%a, %d %b %Y").date()
        except Exception: day = None
        lv = int(m.group(2)); nm, c = plname(None, m.group(1)); ll = centroid(c)
        link = (re.search(r"<link>(.*?)</link>", it) or [None, ""])[1]
        us.append({"country": nm, "lvl": lv, "lbl": LVL.get(lv), "d": day.isoformat() if day else None, "lat": ll[0] if ll else None, "lon": ll[1] if ll else None, "u": link})
    lim = (TODAY - dt.timedelta(days=21)).isoformat()
    recent = sorted([x for x in us if x["d"] and x["d"] >= lim and x["lvl"] >= 3], key=lambda x: x["d"], reverse=True)
    lvl4 = sorted(x["country"] for x in us if x["lvl"] == 4)
    uk = []
    try:
        f = json.loads(fetch("fcdo.json", "https://www.gov.uk/api/search.json?filter_format=travel_advice&count=40&fields=title,public_timestamp,link&order=-public_timestamp"))
        for r in f["results"][:15]:
            nm, c = plname(None, r["title"].replace(" travel advice", ""))
            uk.append({"country": nm, "d": d10(r["public_timestamp"]), "u": "https://www.gov.uk" + r["link"]})
    except Exception:
        pass
    return {"us": recent[:20], "lvl4": lvl4, "uk": uk}

@feed("ofac", "OFAC (Departament Skarbu USA) – ostatnie działania", "https://ofac.treasury.gov/recent-actions", "A", "")
def f_ofac():
    h = fetch("ofac.html", "https://ofac.treasury.gov/recent-actions")
    out = []
    for m in re.finditer(r'<a[^>]+href="(/recent-actions/(20\d{6})[^"]*)"[^>]*>(.*?)</a>', h):
        href, ymd, title = m.group(1), m.group(2), html.unescape(re.sub(r"<.*?>", "", m.group(3))).strip()
        out.append({"d": f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}", "t": title, "u": "https://ofac.treasury.gov" + href})
    return out[:12]

@feed("reliefweb", "ReliefWeb (OCHA) – raporty humanitarne", "https://reliefweb.int/updates", "A", "")
def f_rw():
    t = fetch("rw.xml", "https://reliefweb.int/updates/rss.xml")
    out = []
    for it in re.findall(r"<item>(.*?)</item>", t, re.S)[:15]:
        title = html.unescape((re.search(r"<title>(.*?)</title>", it, re.S) or [None, ""])[1]).strip()
        link = (re.search(r"<link>(.*?)</link>", it) or [None, ""])[1].strip()
        pd = (re.search(r"<pubDate>(.*?)</pubDate>", it) or [None, ""])[1]
        ctry = (re.search(r"reliefweb\.int/report/([a-z\-]+)/", link) or [None, ""])[1].replace("-", " ")
        nm = plname(None, ctry)[0] if ctry and ctry != "world" else "świat"
        try: day = dt.datetime.strptime(pd.strip()[:16], "%a, %d %b %Y").date().isoformat()
        except Exception: day = None
        out.append({"t": title, "country": nm, "d": day, "u": link})
    return out

PM = [("us-iran-ceasefire-continues-throughptptpt", "Czy pauza USA–Iran przetrwa do…"),
      ("israel-x-iran-ceasefire-continues-throughptptpt-20260716224448963", "Czy pauza Izrael–Iran przetrwa do…"),
      ("us-announces-end-of-iranian-blockade-byptptpt-20260713152715080", "USA ogłaszają koniec blokady Iranu do…"),
      ("strait-of-hormuz-traffic-returns-to-normal-by-december-31", "Ruch w Ormuzie wróci do normy do 31 XII?"),
      ("bab-el-mandeb-strait-effectively-closed-by", "Bab el-Mandeb faktycznie zamknięte do…"),
      ("saudi-houthi-ceasefire-agreement-announced-by", "Rozejm saudyjsko-huticki do…"),
      ("russia-x-ukraine-ceasefire-agreement-by", "Rozejm Rosja–Ukraina do…"),
      ("nato-x-russia-military-clash-in-2025", "Starcie zbrojne NATO–Rosja do…"),
      ("will-china-invade-taiwan-before-2027", "Inwazja Chin na Tajwan przed 2027?"),
      ("will-the-iranian-regime-fall-by-the-end-of-2026", "Upadek reżimu w Iranie przed 2027?"),
      ("who-will-be-the-next-prime-minister-of-israel-after-the-next-election", "Premier Izraela po wyborach"),
      ("putin-out-before-2027", "Putin odchodzi do…")]
MON = {m: r for m, r in zip(["January","February","March","April","May","June","July","August","September","October","November","December"],
                             ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"])}
def PMDATE(q):
    return re.sub(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?",
                  lambda m: f"{m.group(2)} {MON[m.group(1)]}" + (f" {m.group(3)}" if m.group(3) else ""), q)
@feed("polymarket", "Polymarket – rynki predykcyjne", "https://polymarket.com/", "C", "ceny zakładów, nie fakty; płynność bywa niska")
def f_pm():
    out = []
    for slug, pl in PM:
        try:
            ev = json.loads(fetch("pm_" + slug[:30] + ".json", f"https://gamma-api.polymarket.com/events?slug={slug}"))
        except Exception:
            continue
        if not ev: continue
        e = ev[0]; ms = []
        for m in e.get("markets", []):
            if m.get("closed") or not m.get("active", True): continue
            try: p = float(json.loads(m.get("outcomePrices") or "[]")[0])
            except Exception: continue
            q = m.get("groupItemTitle") or ""
            if not q or len(e.get("markets", [])) == 1: q = "TAK"
            q = PMDATE(q)
            ms.append({"q": q, "p": round(p, 3), "end": d10(m.get("endDate")), "vol": round(float(m.get("volume") or 0))})
        if not ms: continue
        if len(ms) > 1 and any(x["q"] for x in ms):
            ms.sort(key=lambda x: (x["end"] or "9999"))
            if "prime-minister" in slug: ms = sorted(ms, key=lambda x: -x["p"])
        out.append({"t": pl, "orig": e.get("title"), "u": f"https://polymarket.com/event/{slug}", "vol24": round(float(e.get("volume24hr") or 0)), "m": ms[:5]})
    return out

@feed("celestrak", "CelesTrak – TLE stacji kosmicznych", "https://celestrak.org/", "A", "dodaje chińską stację Tiangong")
def f_celes():
    t = fetch("stations.txt", "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle").splitlines()
    out = []
    for i in range(0, len(t) - 2, 3):
        if t[i].strip().startswith("CSS (TIANHE)"):
            out.append(["TIANGONG", t[i + 1].strip(), t[i + 2].strip()])
    return out

FEEDS = [f_portwatch, f_ioda, f_adsb, f_gdacs, f_kev, f_firms, f_ll2, f_nbp, f_gpsjam, f_who, f_nhc, f_travel, f_ofac, f_rw, f_pm, f_celes]

def run(old=None, log=print):
    """Pobiera wszystkie feedy równolegle. old: poprzedni blok feeds (do zachowania przy błędzie)."""
    global NOW, TODAY
    NOW = dt.datetime.now(dt.timezone.utc); TODAY = NOW.date()
    STATUS.clear()
    old = old or {}
    res = {"t": NOW.strftime("%Y-%m-%dT%H:%MZ")}
    with ThreadPoolExecutor(max_workers=6) as pool:
        outs = list(pool.map(lambda fn: (fn.fid, fn()), FEEDS))
    for fid, v in outs:
        if v is None and fid in old:
            v = old[fid]
            for s in STATUS:
                if s["id"] == fid: s["stale"] = old.get("t")
        res[fid] = v
    order = {fn.fid: n for n, fn in enumerate(FEEDS)}
    res["status"] = sorted(STATUS, key=lambda s: order.get(s["id"], 99))
    for s in res["status"]:
        log(f"  {s['name']}: " + ("OK " + str(s.get("n", "")) if s["ok"] else "BŁĄD " + s.get("err", "")))
    return res
