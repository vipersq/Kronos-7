"""Pobieranie danych online: wiadomości, zagrożenia naturalne, orbity, starty, rynki."""
import csv, email.utils, gzip, html, io, json, re, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KRONOS-7/3.0"


def fetch(url, timeout=20, accept="*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip" or data[:2] == b"\x1f\x8b":
            data = gzip.decompress(data)
        return data


def _now():
    return datetime.now(timezone.utc)


def _parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%d"):
        try:
            d = datetime.strptime(s.replace("Z", "+00:00") if "%z" in fmt else s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _strip(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def _local(tag):
    return tag.rsplit("}", 1)[-1].lower()


def parse_feed(raw):
    """Prosty parser RSS 2.0 / RSS 1.0 (RDF) / Atom. Zwraca słowniki z polami title, link, summary, date, lat, lon, extra."""
    root = ET.fromstring(raw)
    out = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        it = {"title": "", "link": "", "summary": "", "date": None, "lat": None, "lon": None, "extra": {}}
        for ch in el:
            n, txt = _local(ch.tag), (ch.text or "").strip()
            if n == "title":
                it["title"] = _strip(txt)
            elif n == "link":
                it["link"] = ch.get("href") or txt or it["link"]
            elif n in ("description", "summary", "content", "encoded") and not it["summary"]:
                it["summary"] = _strip(txt)[:600]
            elif n in ("pubdate", "published", "updated", "date") and not it["date"]:
                it["date"] = _parse_date(txt)
            elif n == "point" and txt:            # georss:point "lat lon"
                try:
                    a, b = txt.split()[:2]; it["lat"], it["lon"] = float(a), float(b)
                except ValueError:
                    pass
            elif n == "lat" and txt:
                try: it["lat"] = float(txt)
                except ValueError: pass
            elif n in ("long", "lon") and txt:
                try: it["lon"] = float(txt)
                except ValueError: pass
            else:
                if txt and len(txt) < 200:
                    it["extra"][n] = txt
                for g in ch:                      # geo:Point > geo:lat/geo:long
                    gn = _local(g.tag)
                    if gn == "lat" and g.text: it["lat"] = float(g.text)
                    if gn in ("long", "lon") and g.text: it["lon"] = float(g.text)
        if it["title"]:
            out.append(it)
    return out


# ---------------------------------------------------------------- wiadomości
def news(cfg, log, max_age_h=48):
    items, report = [], []

    def one(feed):
        cutoff = _now() - timedelta(hours=feed.get("max_age_h", max_age_h))
        try:
            entries = parse_feed(fetch(feed["url"]))
            got = []
            for e in entries:
                if (e["date"] and e["date"] < cutoff) or (not e["date"] and not feed.get("undated_ok")):
                    continue
                got.append({"title": e["title"], "summary": e["summary"], "url": e["link"],
                            "date": (e["date"] or _now()).isoformat(), "source": feed["name"],
                            "rating": feed.get("rating", "C"), "hint": feed.get("sector", "world")})
            return feed["name"], got, None
        except Exception as ex:
            return feed["name"], [], str(ex)[:120]

    with ThreadPoolExecutor(max_workers=8) as pool:
        for name, got, err in pool.map(one, cfg["feeds"]):
            items += got
            report.append({"source": name, "count": len(got), "error": err})
            log(f"  {name}: {'BŁĄD ' + err if err else str(len(got)) + ' wiad.'}")

    # CISA: aktywnie wykorzystywane podatności z ostatnich 3 dni
    try:
        kev = json.loads(fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"))
        lim = (_now() - timedelta(days=3)).date().isoformat()
        n = 0
        for v in kev.get("vulnerabilities", []):
            if v.get("dateAdded", "") >= lim:
                n += 1
                items.append({"title": f"CISA KEV: {v.get('vendorProject')} {v.get('product')} – {v.get('vulnerabilityName')}",
                              "summary": v.get("shortDescription", "")[:400], "url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
                              "date": v["dateAdded"] + "T12:00:00+00:00", "source": "CISA", "rating": "A", "hint": "cyber"})
        report.append({"source": "CISA KEV", "count": n, "error": None})
    except Exception as ex:
        report.append({"source": "CISA KEV", "count": 0, "error": str(ex)[:120]})
    return items, report


_STOP = set("the a an of to in on for and or with at by from as is are was were be after over into amid says said new".split())


def _tokens(t):
    return {w for w in re.findall(r"[a-z0-9]{3,}", t.lower()) if w not in _STOP}


def cluster(items, ratings):
    """Łączy wiadomości o tym samym zdarzeniu. Liczy niezależne źródła i ocenę wiarygodności (skala Admiralicji)."""
    clusters = []
    for it in sorted(items, key=lambda x: x["date"], reverse=True):
        tk = _tokens(it["title"])
        best, score = None, 0
        for c in clusters:
            inter = len(tk & c["tokens"])
            j = inter / max(1, len(tk | c["tokens"]))
            if inter >= 3 and j > score and j >= 0.28:
                best, score = c, j
        if best:
            best["members"].append(it); best["tokens"] |= tk
        else:
            clusters.append({"tokens": set(tk), "members": [it]})
    out = []
    order = "ABCDEF"
    for c in clusters:
        m = c["members"]
        srcs = sorted({x["source"] for x in m})
        lead = min(m, key=lambda x: order.index(ratings.get(x["source"], x.get("rating", "C"))))
        rel = ratings.get(lead["source"], lead.get("rating", "C"))
        n = len(srcs)
        info = 1 if n >= 3 and rel in "AB" else 2 if n >= 2 else 3 if rel in "AB" else 6
        key = "-".join(sorted(list(c["tokens"]))[:6])
        out.append({"key": key, "title": lead["title"], "summary": lead["summary"], "url": lead["url"],
                    "date": max(x["date"] for x in m), "source": lead["source"], "sources": srcs,
                    "links": [[x["source"], x["url"]] for x in m][:5], "hint": lead["hint"],
                    "reliability": rel, "info": info, "corroboration": n})
    # priorytet do analizy: potwierdzenia, ocena źródła, świeżość
    def rank(c):
        age_h = (_now() - datetime.fromisoformat(c["date"])).total_seconds() / 3600
        return c["corroboration"] * 3 + (2 if c["reliability"] in "AB" else 0) - age_h / 12
    out.sort(key=rank, reverse=True)
    return out


# ---------------------------------------------------------------- natura
GDACS_KIND = {"EQ": "quake", "TC": "storm", "FL": "flood", "VO": "volcano", "WF": "fire", "DR": "drought"}


def hazards(log):
    out, report = [], []
    try:
        gj = json.loads(fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"))
        n = 0
        for f in gj.get("features", []):
            p, g = f["properties"], f["geometry"]["coordinates"]
            if (p.get("mag") or 0) < 5.5:
                continue
            n += 1
            t = datetime.fromtimestamp(p["time"] / 1000, timezone.utc)
            out.append({"kind": "quake", "name": f"M{p['mag']:.1f} {p.get('place','')}", "lat": g[1], "lon": g[0],
                        "mag": f"M{p['mag']:.1f}", "when": t.strftime("%d.%m %H:%M UTC"), "date": t.isoformat(),
                        "note": f"Głębokość {g[2]:.0f} km." + (" Ostrzeżenie przed tsunami." if p.get("tsunami") else ""),
                        "alert": (p.get("alert") or "").upper(), "src": ["USGS", p.get("url", "https://earthquake.usgs.gov")]})
        report.append({"source": "USGS", "count": n, "error": None})
    except Exception as ex:
        report.append({"source": "USGS", "count": 0, "error": str(ex)[:120]})
    try:
        n = 0
        for e in parse_feed(fetch("https://volcano.si.edu/news/WeeklyVolcanoRSS.xml")):
            if e["lat"] is None:
                continue
            n += 1
            out.append({"kind": "volcano", "name": e["title"][:80], "lat": e["lat"], "lon": e["lon"], "mag": "raport tyg.",
                        "when": (e["date"] or _now()).strftime("%d.%m"), "date": (e["date"] or _now()).isoformat(),
                        "note": e["summary"][:240], "alert": "", "src": ["Smithsonian GVP", e["link"] or "https://volcano.si.edu"]})
        report.append({"source": "Smithsonian GVP", "count": n, "error": None})
    except Exception as ex:
        report.append({"source": "Smithsonian GVP", "count": 0, "error": str(ex)[:120]})
    for r in report:
        log(f"  {r['source']}: {'BŁĄD ' + r['error'] if r['error'] else str(r['count'])}")
    return out, report


# ---------------------------------------------------------------- orbity i starty
def tle(wanted, log):
    for url in ("https://www.amsat.org/tle/current/nasabare.txt",
                "https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle"):
        try:
            lines = [l.rstrip() for l in fetch(url).decode("utf-8", "replace").splitlines() if l.strip()]
            got = {}
            for i in range(len(lines) - 2):
                n = lines[i].strip()
                if lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
                    key = n.split("(")[0].strip()
                    for w in wanted:
                        if key == w or n.startswith(w + " ") or n == w:
                            got[w] = [w, lines[i + 1], lines[i + 2]]
            if got:
                log(f"  TLE: {len(got)} obiektów")
                return [got[w] for w in wanted if w in got]
        except Exception as ex:
            log(f"  TLE {url}: BŁĄD {str(ex)[:80]}")
    return None


def launches(log):
    for url in ("https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=12&mode=list",
                "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&mode=list"):
        try:
            js = json.loads(fetch(url, accept="application/json"))
            out = []
            for l in js.get("results", []):
                net = _parse_date(l.get("net"))
                status = (l.get("status") or {}).get("abbrev", "")
                loc = l.get("location")
                if not isinstance(loc, str):
                    pad = l.get("pad") if isinstance(l.get("pad"), dict) else {}
                    loc = (pad.get("location") or {}).get("name", "")
                out.append({"date": net.isoformat() if net else None, "name": l.get("name", ""),
                            "status": status, "pad": loc or "", "go": status in ("Go", "Success")})
            log(f"  Launch Library: {len(out)} startów")
            return out
        except Exception as ex:
            log(f"  Launch Library: BŁĄD {str(ex)[:80]}")
    return None


# ---------------------------------------------------------------- rynki (na żywo)
def _yahoo(sym):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(sym)}?range=5d&interval=1h"
    js = json.loads(fetch(url, timeout=10, accept="application/json"))
    r = js["chart"]["result"][0]
    closes = [c for c in r["indicators"]["quote"][0]["close"] if c is not None]
    meta = r["meta"]
    price = meta.get("regularMarketPrice") or closes[-1]
    prev = meta.get("chartPreviousClose") or meta.get("previousClose") or closes[0]
    r = lambda x: round(x, 4 if abs(x) < 20 else 2)
    return {"price": r(price), "prev": r(prev), "spark": [r(c) for c in closes[-60:]],
            "time": datetime.fromtimestamp(meta.get("regularMarketTime", time.time()), timezone.utc).isoformat()}


def _stooq(sym):
    raw = fetch(f"https://stooq.com/q/l/?s={sym}&f=sd2t2ohlc&h&e=csv", timeout=10).decode()
    row = list(csv.DictReader(io.StringIO(raw)))[0]
    close, opn = float(row["Close"]), float(row["Open"])
    return {"price": round(close, 2), "prev": round(opn, 2), "spark": [opn, close], "time": f"{row['Date']}T{row['Time']}Z"}


def markets(cfg):
    out = []
    def one(m):
        for fn, sym in ((_yahoo, m.get("yahoo")), (_stooq, m.get("stooq"))):
            if not sym:
                continue
            try:
                d = fn(sym)
                if m.get("div") and d["price"] > 50:      # pszenica w centach
                    k = m["div"]; d["price"], d["prev"] = round(d["price"] / k, 3), round(d["prev"] / k, 3); d["spark"] = [round(x / k, 3) for x in d["spark"]]
                d.update(id=m["id"], label=m["label"], unit=m["unit"],
                         change_pct=round(100 * (d["price"] - d["prev"]) / d["prev"], 2) if d["prev"] else 0,
                         source="Yahoo Finance" if fn is _yahoo else "Stooq")
                return d
            except Exception:
                continue
        return {"id": m["id"], "label": m["label"], "unit": m["unit"], "error": "brak danych"}
    with ThreadPoolExecutor(max_workers=6) as pool:
        out = list(pool.map(one, cfg["markets"]))
    return {"fetched": _now().isoformat(), "items": out}
