"""Dodatkowe źródła (v3.21).
Warstwy i dane: GeoConfirmed (zgeolokalizowane nagrania), WarSpotting (straty sprzętu), Tzeva Adom (alarmy rakietowe w Izraelu),
EMSC (trzęsienia ziemi), ISW/CTP (ocena postępów wojsk rosyjskich), Cloudflare Radar (wyłączenia internetu).
Wyszukiwarki do zestawień przy zdarzeniach: Bluesky, Reddit, YouTube, VK, GDELT.
Na żądanie: zdjęcie Sentinel-1/2 (Copernicus) i ślad lotu (OpenSky)."""
import hashlib, json, re, threading, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import i18n
from .intel import Source, _now_ms

UA = "KRONOS-7/3.21 (personal OSINT dashboard)"


def _get(url, timeout=40, headers=None, data=None, method=None, raw=False):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h, data=data, method=method), timeout=timeout) as r:
        b = r.read()
    return b if raw else json.loads(b.decode("utf-8", "replace"))


def _iso_ms(s):
    try:
        return int(datetime.fromisoformat(str(s).replace("Z", "+00:00")).replace(tzinfo=timezone.utc if "+" not in str(s) and not str(s).endswith("Z") else None).timestamp() * 1000)
    except Exception:
        try:
            return int(datetime.fromisoformat(str(s).replace("Z", "+00:00")).timestamp() * 1000)
        except Exception:
            return None


# ------------------------------------------------------------------ GeoConfirmed
class GeoConfirmed(Source):
    """Wolontariusze lokalizują nagrania z wojen i publikują je na mapie (geoconfirmed.org). Pobieramy ostatnie 30 dni."""
    name = "geoconfirmed"
    interval = 4 * 3600

    def run_once(self):
        confs = [c for c in _get("https://geoconfirmed.org/api/Conflict", 40) if not c.get("isPrivate") and c.get("code") not in ("World",)]
        want = [x.strip().lower() for x in str(self.cfg().get("gc_conflicts") or "ukraine,israel,sudan,syria,myanmar").split(",") if x.strip()]
        cut = _now_ms() - 30 * 86400e3
        pts = []
        for c in confs:
            if c["url"].lower() not in want and c["name"].lower() not in want:
                continue
            try:
                facs = _get("https://geoconfirmed.org/api/Placemark/" + urllib.parse.quote(c["name"]), 120)
            except Exception:
                continue
            for f in facs:
                for ic in f.get("icons", []):
                    for p in ic.get("placemarks", []):
                        t = _iso_ms(p.get("date"))
                        if not t or t < cut:
                            continue
                        pts.append({"id": p["id"], "lat": p["la"], "lon": p["lo"], "t": t, "fac": f.get("name"), "col": f.get("color"),
                                    "icon": "https://geoconfirmed.org" + ic["icon"] if ic.get("icon") else None, "conf": c["name"], "url": f"https://geoconfirmed.org/{c['url']}/{p['id']}"})
            time.sleep(1)
        pts.sort(key=lambda x: -x["t"])
        self.data = {"at": _now_ms(), "pts": pts[:6000]}
        return len(pts)


# ------------------------------------------------------------------ WarSpotting
class WarSpotting(Source):
    """Potwierdzone (zdjęciem lub nagraniem) straty sprzętu w wojnie rosyjsko-ukraińskiej – ostatnie dni."""
    name = "warspotting"
    interval = 3 * 3600

    def run_once(self):
        out = []
        for side in ("russia", "ukraine"):
            for d in range(0, 4):
                day = (datetime.now(timezone.utc) - timedelta(days=d)).strftime("%Y-%m-%d")
                try:
                    r = _get(f"https://ukr.warspotting.net/api/losses/{side}/{day}/", 40)
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        continue
                    raise
                for x in r.get("losses", []):
                    geo = None
                    if x.get("geo"):
                        try:
                            la, lo = [float(v) for v in str(x["geo"]).split(",")[:2]]; geo = [la, lo]
                        except ValueError:
                            pass
                    out.append({"id": x["id"], "side": side, "d": x.get("date"), "type": x.get("type"), "model": x.get("model"), "status": x.get("status"),
                                "near": x.get("nearest_location"), "unit": x.get("unit"), "tags": x.get("tags"), "pos": geo, "url": f"https://ukr.warspotting.net/view/{x['id']}/"})
                time.sleep(1.2)
        out.sort(key=lambda x: (x["d"] or "", x["id"]), reverse=True)
        by = {}
        for x in out:
            by.setdefault(x["side"], {}).setdefault(x["status"] or "?", 0); by[x["side"]][x["status"] or "?"] += 1
        self.data = {"at": _now_ms(), "items": out[:400], "sum": by}
        return len(out)

    def brief(self):
        d = self.data or {}
        return {"days": 4, "summary": d.get("sum"), "latest": [f"{x['d']} {x['side']}: {x['model']} ({x['status']}{', ' + x['near'] if x.get('near') else ''})" for x in (d.get("items") or [])[:12]]}


# ------------------------------------------------------------------ Tzeva Adom (Izrael)
TZ_THREAT = {0: ("rakiety", "rockets/missiles"), 1: ("zagrożenie radiologiczne", "radiological"), 2: ("infiltracja terrorystów", "terrorist infiltration"),
             3: ("trzęsienie ziemi", "earthquake"), 4: ("tsunami", "tsunami"), 5: ("wrogi dron / samolot", "hostile aircraft / drone"),
             6: ("materiały niebezpieczne", "hazardous materials"), 7: ("broń niekonwencjonalna", "non-conventional missile")}


class TzevaAdom(Source):
    """Alarmy rakietowe i dronowe w Izraelu (Pikud HaOref, przez tzevaadom.co.il) – na żywo, bez klucza."""
    name = "tzevaadom"
    interval = 10

    def __init__(self, log, settings, data_dir):
        super().__init__(log, settings)
        self.file = Path(data_dir) / "tz_cities.json"
        self.cities = None; self.events = __import__("collections").deque(maxlen=60)
        self.active = {}; self.hist = []; self.hist_at = 0

    def _cities(self):
        if self.cities is None:
            try:
                if self.file.exists() and time.time() - self.file.stat().st_mtime < 30 * 86400:
                    d = json.loads(self.file.read_text(encoding="utf-8"))
                else:
                    d = _get("https://www.tzevaadom.co.il/static/cities.json", 60)
                    self.file.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
                self.cities = {k: (v.get("lat"), v.get("lng"), v.get("en"), v.get("ru")) for k, v in (d.get("cities") or {}).items()}
            except Exception:
                self.cities = {}
        return self.cities

    def run_once(self):
        cs = self._cities(); now = _now_ms()
        cur = _get("https://api.tzevaadom.co.il/notifications", 15)
        for a in cur or []:
            thr = a.get("threat", 0)
            for c in a.get("cities", []):
                k = (c, thr)
                if k not in self.active:
                    ll = cs.get(c) or (None, None, c, c)
                    self.events.append({"kind": "il_alert", "at": now, "id": f"{c}|{thr}|{now // 60000}", "lat": ll[0], "lon": ll[1],
                                        "msg": i18n.L(f"Izrael – alarm ({TZ_THREAT.get(thr, ('?', '?'))[0]}): {ll[2] or c}", f"Israel – alert ({TZ_THREAT.get(thr, ('?', '?'))[1]}): {ll[2] or c}")})
                self.active[k] = now
        for k in [k for k, v in self.active.items() if now - v > 10 * 60e3]:
            del self.active[k]
        if time.time() - self.hist_at > 300:
            self.hist_at = time.time()
            try:
                h = _get("https://api.tzevaadom.co.il/alerts-history", 30)
                pts = []
                for grp in h or []:
                    for al in grp.get("alerts", []):
                        t = (al.get("time") or 0) * 1000
                        if now - t > 7 * 86400e3 or al.get("isDrill"):
                            continue
                        for c in al.get("cities", []):
                            ll = cs.get(c)
                            if ll and ll[0]:
                                pts.append({"c": ll[2] or c, "lat": ll[0], "lon": ll[1], "t": t, "thr": al.get("threat", 0)})
                self.hist = pts
            except Exception:
                pass
        act = []
        for (c, thr), t in self.active.items():
            ll = cs.get(c) or (None, None, c, c)
            if ll[0]:
                act.append({"c": ll[2] or c, "lat": ll[0], "lon": ll[1], "t": t, "thr": thr, "on": True})
        self.data = {"at": now, "active": act, "hist": self.hist[-2000:], "types": {k: v[1 if i18n.en() else 0] for k, v in TZ_THREAT.items()}}
        return len(act)


# ------------------------------------------------------------------ EMSC
class Emsc(Source):
    """EMSC (seismicportal.eu): trzęsienia ziemi szybciej niż USGS w Europie i rejonie Morza Śródziemnego."""
    name = "emsc"
    interval = 300

    def run_once(self):
        since = (datetime.now(timezone.utc) - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%S")
        d = _get(f"https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=3.5&limit=300&start={since}", 40)
        out = []
        for f in d.get("features", []):
            p = f.get("properties", {}); c = f.get("geometry", {}).get("coordinates", [None, None, None])
            out.append({"id": f.get("id"), "lat": c[1], "lon": c[0], "depth": -c[2] if c[2] is not None else None, "mag": p.get("mag"), "t": _iso_ms(p.get("time")),
                        "where": p.get("flynn_region"), "url": f"https://www.seismicportal.eu/eventdetails.html?unid={f.get('id')}"})
        self.data = {"at": _now_ms(), "items": out}
        return len(out)


# ------------------------------------------------------------------ ISW / CTP
ISW_LAYERS = {"control": ("VIEW_RussiaCoTinUkraine_V3", 49), "infiltration": ("View_AssessedRussianInfiltrationAreasinUkraine_V4", 0),
              "gains24": ("Assessed_Russian_Gains_in_the_Past_24_Hours_view", 0), "claimed": ("ClaimedRussianTerritoryinUkraine_V2_view", 0),
              "uacounter": ("MDS_ClaimedUkrainianCounteroffensives_V2_view", 0)}


class Isw(Source):
    """Mapy ISW/CTP (publiczne warstwy ArcGIS): ocenione postępy Rosji, zdobycze z ostatnich 24 h, terytorium deklarowane przez Rosję, kontrofensywy UA."""
    name = "isw"
    interval = 4 * 3600

    def run_once(self):
        out, n = {}, 0
        for k, (svc, lid) in ISW_LAYERS.items():
            url = (f"https://services5.arcgis.com/SaBe5HMtmnbqSWlu/ArcGIS/rest/services/{svc}/FeatureServer/{lid}/query?where=1%3D1&outFields=*"
                   f"&returnGeometry=true&outSR=4326&maxAllowableOffset=0.003&geometryPrecision=4&f=geojson")
            try:
                g = _get(url, 120)
                out[k] = {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": f["geometry"], "properties": {}} for f in g.get("features", []) if f.get("geometry")]}
                n += len(out[k]["features"])
            except Exception as e:
                out[k] = {"type": "FeatureCollection", "features": [], "err": str(e)[:120]}
        self.data = {"at": _now_ms(), "layers": out}
        return n


# ------------------------------------------------------------------ Cloudflare Radar
class CfRadar(Source):
    """Cloudflare Radar (darmowy token API): wyłączenia internetu i nietypowe spadki ruchu w krajach, ostatnie 7 dni."""
    name = "cfradar"
    interval = 1800

    def enabled(self):
        return bool(self.cfg().get("cf_token"))

    def run_once(self):
        h = {"Authorization": "Bearer " + self.cfg()["cf_token"].strip()}
        out = []
        try:
            o = _get("https://api.cloudflare.com/client/v4/radar/annotations/outages?dateRange=7d&limit=100&format=json", 40, h)
            for a in (o.get("result") or {}).get("annotations", []):
                for loc in a.get("locations") or []:
                    out.append({"kind": "outage", "cc": loc, "t": _iso_ms(a.get("startDate")), "end": _iso_ms(a.get("endDate")) if a.get("endDate") else None,
                                "cause": a.get("outage", {}).get("outageCause"), "type": a.get("outage", {}).get("outageType"), "desc": a.get("description"), "asn": a.get("asns")})
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"outages HTTP {e.code}")
        try:
            t = _get("https://api.cloudflare.com/client/v4/radar/traffic_anomalies?dateRange=7d&limit=100&format=json", 40, h)
            for a in (t.get("result") or {}).get("trafficAnomalies", []):
                loc = (a.get("locationDetails") or {}).get("code") or ((a.get("asnDetails") or {}).get("locations") or {}).get("code")
                if loc:
                    out.append({"kind": "anomaly", "cc": loc, "t": _iso_ms(a.get("startDate")), "end": _iso_ms(a.get("endDate")) if a.get("endDate") else None,
                                "status": a.get("status"), "type": a.get("type"), "asn": (a.get("asnDetails") or {}).get("name")})
        except Exception:
            pass
        out.sort(key=lambda x: -(x["t"] or 0))
        self.data = {"at": _now_ms(), "items": out}
        return len(out)


# ------------------------------------------------------------------ wyszukiwarki do zestawień przy zdarzeniach
def _hash(s):
    return hashlib.sha1(s.encode()).hexdigest()[:16]


def _latin(names, n=2):
    out = []
    for x in names:
        x = x.strip()
        if len(x) >= 4 and re.match(r"^[A-Za-zÀ-žĄ-ż' .\-]+$", x) and x.lower() not in [o.lower() for o in out]:
            out.append(x)
    return out[:n]


def _cyr(names, n=1):
    return [x for x in names if re.search(r"[а-яіїєґ]", x, re.I) and len(x) >= 4][:n]


class Searchers:
    """Zbiór wyszukiwarek – każda zwraca posty w formacie zestawienia; zdjęcia rejestruje w pamięci MEDIA."""

    def __init__(self, settings, media, log):
        self.settings, self.media, self.log = settings, media, log
        self.reddit_tok = (None, 0)
        self.status = {}

    def cfg(self):
        return self.settings() or {}

    def _m(self, url, kind="photo"):
        if not url:
            return None
        h = _hash(url)
        self.media.register({"h": h, "k": kind, "u": url}, prefetch=True)
        return {"h": h, "k": kind, "o": url}

    def _ok(self, k, n=None, err=None):
        self.status[k] = {"ok": err is None, "err": err, "at": _now_ms(), "n": n}

    def on(self, k):
        return k in [x.strip() for x in str(self.cfg().get("ev_sources") or "bluesky,reddit,gdelt,youtube,vk").split(",")]

    def all(self):
        fs = []
        for k, f in (("bluesky", self.bluesky), ("reddit", self.reddit), ("gdelt", self.gdelt), ("youtube", self.youtube), ("vk", self.vk)):
            if self.on(k):
                def w(names, pos, t0, t1, f=f, k=k):
                    try:
                        r = f(names, pos, t0, t1); self._ok(k, len(r)); return r
                    except Exception as e:
                        self._ok(k, err=str(e)[:160]); raise
                w.label = k
                fs.append(w)
        return fs

    # Bluesky – publiczne wyszukiwanie postów
    def bluesky(self, names, pos, t0, t1):
        qs = _latin(names, 2) + _cyr(names, 1)
        out = []
        for q in qs:
            u = "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?" + urllib.parse.urlencode(
                {"q": q, "limit": 40, "sort": "latest", "since": datetime.fromtimestamp((t0 - 1800e3) / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")})
            for p in _get(u, 20).get("posts", []):
                rec = p.get("record") or {}; a = p.get("author") or {}
                t = _iso_ms(rec.get("createdAt")) or _iso_ms(p.get("indexedAt"))
                media = []
                emb = p.get("embed") or {}
                for im in (emb.get("images") or (emb.get("media") or {}).get("images") or [])[:4]:
                    m = self._m(im.get("thumb") or im.get("fullsize")); media += [m] if m else []
                if (emb.get("$type") or "").startswith("app.bsky.embed.video") and emb.get("thumbnail"):
                    m = self._m(emb["thumbnail"], "photo"); media += [m] if m else []
                rk = p["uri"].rsplit("/", 1)[-1]
                out.append({"id": "bsky:" + rk, "src": "Bluesky", "ch": a.get("handle"), "chn": a.get("displayName") or a.get("handle"), "type": "Bluesky",
                            "t": t or _now_ms(), "text": (rec.get("text") or "")[:500], "url": f"https://bsky.app/profile/{a.get('handle')}/post/{rk}", "media": media})
        return out

    # Reddit – subreddity z nagraniami z wojen (z kluczem aplikacji przez API, bez – publiczny JSON)
    def _reddit_token(self):
        c = self.cfg()
        if not (c.get("reddit_id") and c.get("reddit_secret")):
            return None
        tok, exp = self.reddit_tok
        if tok and time.time() < exp - 60:
            return tok
        import base64
        auth = base64.b64encode(f"{c['reddit_id'].strip()}:{c['reddit_secret'].strip()}".encode()).decode()
        r = _get("https://www.reddit.com/api/v1/access_token", 20, {"Authorization": "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded"},
                 b"grant_type=client_credentials", "POST")
        self.reddit_tok = (r["access_token"], time.time() + int(r.get("expires_in") or 3600))
        return self.reddit_tok[0]

    def reddit(self, names, pos, t0, t1):
        subs = str(self.cfg().get("reddit_subs") or "UkraineWarVideoReport+CombatFootage+UkraineRussiaReport+CredibleDefense+worldnews+IsraelPalestine").replace(",", "+").replace(" ", "")
        q = " OR ".join(f'"{x}"' for x in (_latin(names, 3) or _cyr(names, 1)))
        if not q:
            return []
        tok = self._reddit_token()
        base, h = ("https://oauth.reddit.com", {"Authorization": "bearer " + tok}) if tok else ("https://www.reddit.com", {})
        r = _get(f"{base}/r/{subs}/search.json?" + urllib.parse.urlencode({"q": q, "restrict_sr": 1, "sort": "new", "t": "week", "limit": 40, "raw_json": 1}), 25, h)
        out = []
        for ch in (r.get("data") or {}).get("children", []):
            d = ch.get("data") or {}
            t = int((d.get("created_utc") or 0) * 1000)
            if t < t0 - 3 * 3600e3:
                continue
            media = []
            img = None
            try:
                img = d["preview"]["images"][0]["resolutions"][-1]["url"]
            except Exception:
                img = d.get("thumbnail") if str(d.get("thumbnail", "")).startswith("http") else None
            m = self._m(img, "video" if d.get("is_video") else "photo"); media += [m] if m else []
            out.append({"id": "rd:" + d.get("id", ""), "src": "Reddit", "ch": "r/" + str(d.get("subreddit")), "chn": "r/" + str(d.get("subreddit")), "type": "Reddit",
                        "t": t, "text": (d.get("title") or "")[:300] + ("\n" + d["selftext"][:300] if d.get("selftext") else ""), "url": "https://www.reddit.com" + d.get("permalink", ""), "media": media})
        return out

    # GDELT – artykuły z całego świata (z obrazkiem artykułu)
    def gdelt(self, names, pos, t0, t1):
        qs = _latin(names, 2)
        if not qs:
            return []
        hrs = max(1, min(72, int((time.time() * 1000 - t0) / 3600e3) + 1))
        q = "(" + " OR ".join(f'"{x}"' for x in qs) + ")"
        r = _get("https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode({"query": q, "mode": "artlist", "format": "json", "maxrecords": 40, "timespan": f"{hrs}h", "sort": "datedesc"}), 25)
        out = []
        for a in r.get("articles", []) or []:
            t = None
            try:
                t = int(datetime.strptime(a.get("seendate", ""), "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).timestamp() * 1000)
            except ValueError:
                pass
            m = self._m(a.get("socialimage"))
            out.append({"id": "gd:" + _hash(a.get("url", "")), "src": "GDELT", "ch": a.get("domain"), "chn": a.get("domain"), "type": i18n.L("media (GDELT)", "media (GDELT)"),
                        "t": t or _now_ms(), "text": (a.get("title") or "")[:300], "url": a.get("url"), "media": [m] if m else []})
        return out

    # YouTube – nagrania i transmisje (darmowy klucz Google)
    def youtube(self, names, pos, t0, t1):
        key = (self.cfg().get("yt_key") or "").strip()
        if not key:
            return []
        q = " | ".join(_latin(names, 2) + _cyr(names, 1))
        r = _get("https://www.googleapis.com/youtube/v3/search?" + urllib.parse.urlencode({"part": "snippet", "q": q, "type": "video", "order": "date", "maxResults": 20, "key": key,
                                                                                           "publishedAfter": datetime.fromtimestamp((t0 - 1800e3) / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}), 20)
        out = []
        for it in r.get("items", []):
            sn = it.get("snippet") or {}; vid = (it.get("id") or {}).get("videoId")
            th = ((sn.get("thumbnails") or {}).get("high") or (sn.get("thumbnails") or {}).get("default") or {}).get("url")
            m = self._m(th, "video")
            out.append({"id": "yt:" + str(vid), "src": "YouTube", "ch": sn.get("channelTitle"), "chn": sn.get("channelTitle"), "type": "YouTube",
                        "t": _iso_ms(sn.get("publishedAt")) or _now_ms(), "text": (sn.get("title") or "") + " – " + (sn.get("description") or "")[:250],
                        "url": f"https://www.youtube.com/watch?v={vid}", "media": [m] if m else []})
        return out

    # VK – rosyjskie relacje lokalne (token usługowy aplikacji VK)
    def vk(self, names, pos, t0, t1):
        tok = (self.cfg().get("vk_token") or "").strip()
        if not tok:
            return []
        out = []
        for q in (_cyr(names, 2) or _latin(names, 1)):
            r = _get("https://api.vk.com/method/newsfeed.search?" + urllib.parse.urlencode({"q": q, "count": 40, "start_time": int((t0 - 1800e3) / 1000), "extended": 1,
                                                                                            "access_token": tok, "v": "5.199"}), 20)
            if r.get("error"):
                raise RuntimeError("VK: " + str(r["error"].get("error_msg"))[:120])
            resp = r.get("response") or {}
            groups = {-g["id"]: g.get("name") for g in resp.get("groups", [])}; prof = {p["id"]: f"{p.get('first_name', '')} {p.get('last_name', '')}" for p in resp.get("profiles", [])}
            for it in resp.get("items", []):
                media = []
                for att in (it.get("attachments") or [])[:4]:
                    if att.get("type") == "photo":
                        sizes = (att.get("photo") or {}).get("sizes") or []
                        if sizes:
                            m = self._m(sorted(sizes, key=lambda s: s.get("width", 0))[-1].get("url")); media += [m] if m else []
                    elif att.get("type") == "video":
                        im = (att.get("video") or {}).get("image") or []
                        if im:
                            m = self._m(sorted(im, key=lambda s: s.get("width", 0))[-1].get("url"), "video"); media += [m] if m else []
                oid = it.get("owner_id")
                out.append({"id": f"vk:{oid}_{it.get('id')}", "src": "VK", "ch": str(oid), "chn": groups.get(oid) or prof.get(oid) or str(oid), "type": "VK",
                            "t": int((it.get("date") or 0) * 1000), "text": (it.get("text") or "")[:500], "url": f"https://vk.com/wall{oid}_{it.get('id')}", "media": media})
        return out


# ------------------------------------------------------------------ na żądanie: Copernicus (Sentinel) i OpenSky
class Copernicus:
    """Zdjęcia Sentinel-2 (kolor, najmniej chmur z ostatnich dni) i Sentinel-1 (radar, przez chmury) z Copernicus Data Space.
    Darmowe konto: dataspace.copernicus.eu → User settings → OAuth clients → Create (client_id, client_secret)."""

    def __init__(self, settings):
        self.settings = settings; self.tok = (None, 0); self.cache = {}

    def token(self):
        c = self.settings() or {}
        if not (c.get("cdse_id") and c.get("cdse_secret")):
            raise RuntimeError(i18n.L("wpisz client_id i client_secret Copernicus w ŹRÓDŁA I INTEGRACJE", "enter the Copernicus client_id and client_secret in SOURCES AND INTEGRATIONS"))
        t, exp = self.tok
        if t and time.time() < exp - 60:
            return t
        body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": c["cdse_id"].strip(), "client_secret": c["cdse_secret"].strip()}).encode()
        r = _get("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", 30, {"Content-Type": "application/x-www-form-urlencoded"}, body, "POST")
        self.tok = (r["access_token"], time.time() + int(r.get("expires_in") or 600))
        return self.tok[0]

    EVAL = {
        "s2": """//VERSION=3
function setup(){return{input:["B04","B03","B02","dataMask"],output:{bands:4}}}
function evaluatePixel(s){return [2.6*s.B04,2.6*s.B03,2.6*s.B02,s.dataMask]}""",
        "s1": """//VERSION=3
function setup(){return{input:["VV","VH","dataMask"],output:{bands:4}}}
function evaluatePixel(s){let v=Math.sqrt(s.VV)*1.6,h=Math.sqrt(s.VH)*3.2;return [v,h,v*0.6+h*0.4,s.dataMask]}""",
        "fire": """//VERSION=3
function setup(){return{input:["B12","B8A","B04","dataMask"],output:{bands:4}}}
function evaluatePixel(s){return [2.4*s.B12,2.0*s.B8A,2.4*s.B04,s.dataMask]}"""}

    def image(self, lat, lon, span_km=6, kind="s2", days=12):
        key = (round(lat, 3), round(lon, 3), span_km, kind, time.strftime("%Y%m%d%H"))
        if key in self.cache:
            return self.cache[key]
        import math
        dlat = span_km / 2 / 111.32; dlon = dlat / max(0.2, math.cos(math.radians(lat)))
        to = datetime.now(timezone.utc); fr = to - timedelta(days=days if kind != "s1" else 6)
        coll = "sentinel-1-grd" if kind == "s1" else "sentinel-2-l2a"
        flt = {"timeRange": {"from": fr.strftime("%Y-%m-%dT00:00:00Z"), "to": to.strftime("%Y-%m-%dT23:59:59Z")}, "mosaickingOrder": "mostRecent" if kind == "s1" else "leastCC"}
        if kind != "s1":
            flt["maxCloudCoverage"] = 60
        body = {"input": {"bounds": {"bbox": [lon - dlon, lat - dlat, lon + dlon, lat + dlat], "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}},
                          "data": [{"type": coll, "dataFilter": flt}]},
                "output": {"width": 1024, "height": 1024, "responses": [{"identifier": "default", "format": {"type": "image/jpeg"}}]},
                "evalscript": self.EVAL.get(kind, self.EVAL["s2"])}
        b = _get("https://sh.dataspace.copernicus.eu/api/v1/process", 90, {"Authorization": "Bearer " + self.token(), "Content-Type": "application/json", "Accept": "image/jpeg"},
                 json.dumps(body).encode(), "POST", raw=True)
        if len(self.cache) > 40:
            self.cache.clear()
        self.cache[key] = b
        return b


class OpenSky:
    """Ślad lotu z OpenSky Network (darmowe konto; od 2025 logowanie kluczem API – client_id i client_secret)."""

    def __init__(self, settings):
        self.settings = settings; self.tok = (None, 0)

    def _h(self):
        c = self.settings() or {}
        if not (c.get("opensky_id") and c.get("opensky_secret")):
            return {}
        t, exp = self.tok
        if not t or time.time() > exp - 60:
            body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": c["opensky_id"].strip(), "client_secret": c["opensky_secret"].strip()}).encode()
            r = _get("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", 30, {"Content-Type": "application/x-www-form-urlencoded"}, body, "POST")
            self.tok = (r["access_token"], time.time() + int(r.get("expires_in") or 1800)); t = self.tok[0]
        return {"Authorization": "Bearer " + t}

    def track(self, icao24):
        r = _get(f"https://opensky-network.org/api/tracks/all?icao24={icao24.lower()}&time=0", 30, self._h())
        return {"icao24": r.get("icao24"), "callsign": (r.get("callsign") or "").strip(), "start": (r.get("startTime") or 0) * 1000, "end": (r.get("endTime") or 0) * 1000,
                "path": [[p[1], p[2], p[3], p[0] * 1000] for p in r.get("path", []) if p[1] is not None]}
