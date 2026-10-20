"""Dodatkowe źródła wywiadowcze (v3.14):
  • alarmy przeciwlotnicze w Ukrainie (ubilling.net.ua bez klucza; alerts.in.ua z darmowym tokenem – dokładniejsze),
  • linia frontu i obszary okupowane z DeepStateMap,
  • NOTAM-y (FAA NOTAM API, darmowy klucz) – zamknięte przestrzenie, strzelania, zakłócenia GNSS, drony,
  • „ciemne” statki z radaru satelitarnego SAR (Global Fishing Watch, darmowy klucz),
  • publiczne kanały Telegram (OSINT) – tłumaczenie, streszczenie, ocena i łączenie powtórzeń przez lokalne AI,
  • zdjęcia satelitarne NASA (Worldview Snapshots, bez klucza).
Każde źródło ma własny wątek i stan widoczny w terminalu; brak klucza = źródło wyłączone."""
import hashlib, html, json, math, re, threading, time, urllib.parse, urllib.request
from collections import OrderedDict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import i18n

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 KRONOS-7"


def _get(url, timeout=40, headers=None, data=None, method=None):
    h = {"User-Agent": UA, "Accept": "application/json, text/html;q=0.9, */*;q=0.5"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h, data=data, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _txt(s):
    s = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    return re.sub(r"[ \t]+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()


def _now_ms():
    return int(time.time() * 1000)


class Source:
    """Wspólna obsługa: stan, pętla z odstępem, zapis błędów."""
    name = "?"
    interval = 600

    def __init__(self, log, settings):
        self.log, self.settings = log, settings
        self.status = {"ok": None, "err": None, "at": None, "n": 0, "off": False}
        self.data = None
        self.wake = threading.Event()

    def cfg(self):
        return self.settings() or {}

    def enabled(self):
        return True

    def run_once(self):
        raise NotImplementedError

    def loop(self):
        time.sleep(5)
        while True:
            if self.enabled():
                try:
                    n = self.run_once()
                    self.status.update(ok=True, err=None, at=_now_ms(), n=n or 0, off=False)
                except Exception as e:
                    msg = str(e)[:200]
                    if "401" in msg or "403" in msg:
                        msg = i18n.L("odmowa dostępu – sprawdź klucz/token", "access denied – check the key/token") + f" ({msg})"
                    self.status.update(ok=False, err=msg, at=_now_ms())
            else:
                self.status.update(ok=None, off=True, err=None)
            self.wake.wait(self.interval); self.wake.clear()

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="intel-" + self.name).start()


# ------------------------------------------------ alarmy przeciwlotnicze w Ukrainie
OBLASTS = {   # klucz: początek nazwy ukraińskiej → (PL, EN, szer., dł.)
    "вінниц": ("Winnica", "Vinnytsia", 49.23, 28.47), "волин": ("Wołyń", "Volyn", 50.75, 25.33), "дніпроп": ("Dniepr", "Dnipro", 48.46, 35.05),
    "донец": ("Donieck", "Donetsk", 48.30, 37.60), "житомир": ("Żytomierz", "Zhytomyr", 50.25, 28.66), "закарпат": ("Zakarpacie", "Zakarpattia", 48.62, 22.29),
    "запоріз": ("Zaporoże", "Zaporizhzhia", 47.84, 35.14), "івано": ("Iwano-Frankiwsk", "Ivano-Frankivsk", 48.92, 24.71), "київська": ("obw. kijowski", "Kyiv oblast", 50.30, 30.30),
    "кіровогр": ("Kropywnycki", "Kirovohrad", 48.51, 32.26), "луган": ("Ługańsk", "Luhansk", 48.80, 39.00), "львів": ("Lwów", "Lviv", 49.84, 24.03),
    "миколаїв": ("Mikołajów", "Mykolaiv", 46.97, 32.00), "одес": ("Odessa", "Odesa", 46.48, 30.72), "полтав": ("Połtawa", "Poltava", 49.59, 34.55),
    "рівнен": ("Równe", "Rivne", 50.62, 26.25), "сум": ("Sumy", "Sumy", 50.91, 34.80), "терноп": ("Tarnopol", "Ternopil", 49.55, 25.59),
    "харків": ("Charków", "Kharkiv", 49.99, 36.23), "херсон": ("Chersoń", "Kherson", 46.64, 32.61), "хмельниц": ("Chmielnicki", "Khmelnytskyi", 49.42, 26.99),
    "черкас": ("Czerkasy", "Cherkasy", 49.44, 32.06), "чернівец": ("Czerniowce", "Chernivtsi", 48.29, 25.94), "чернігів": ("Czernihów", "Chernihiv", 51.50, 31.29),
    "м. київ": ("Kijów (miasto)", "Kyiv city", 50.45, 30.52), "київ": ("Kijów (miasto)", "Kyiv city", 50.45, 30.52),
    "автономна республіка крим": ("Krym", "Crimea", 45.00, 34.10), "ар крим": ("Krym", "Crimea", 45.00, 34.10), "крим": ("Krym", "Crimea", 45.00, 34.10),
    "севастоп": ("Sewastopol", "Sevastopol", 44.60, 33.52),
}
ALERT_KIND = {"air_raid": ("alarm przeciwlotniczy", "air raid"), "artillery_shelling": ("ostrzał artyleryjski", "artillery shelling"),
              "urban_fights": ("walki w mieście", "urban fighting"), "chemical": ("zagrożenie chemiczne", "chemical threat"), "nuclear": ("zagrożenie radiacyjne", "nuclear threat")}


def oblast_of(name):
    n = (name or "").lower().replace("’", "'").strip()
    for k in sorted(OBLASTS, key=len, reverse=True):
        if n.startswith(k):
            return k
    return None


class AirAlerts(Source):
    name = "ua_alerts"
    interval = 30

    def __init__(self, log, settings):
        super().__init__(log, settings)
        self.since = {}                          # obwód -> czas włączenia alarmu (ms)
        self.events = deque(maxlen=40)
        self.hist = deque(maxlen=400)            # (ms, obwód, on/off)
        self.first = True

    def run_once(self):
        tok = (self.cfg().get("alerts_token") or "").strip()
        active = {}
        if tok:
            d = json.loads(_get("https://api.alerts.in.ua/v1/alerts/active.json", 20, {"Authorization": "Bearer " + tok}))
            for a in d.get("alerts", []):
                k = oblast_of(a.get("location_oblast") or a.get("location_title"))
                if not k:
                    continue
                t = a.get("started_at")
                try:
                    ms = int(datetime.fromisoformat(str(t).replace("Z", "+00:00")).timestamp() * 1000)
                except Exception:
                    ms = _now_ms()
                cur = active.setdefault(k, {"since": ms, "kinds": set(), "parts": 0})
                cur["since"] = min(cur["since"], ms); cur["kinds"].add(a.get("alert_type") or "air_raid")
                if a.get("location_type") != "oblast":
                    cur["parts"] += 1
            src = "alerts.in.ua"
        else:
            d = json.loads(_get("https://ubilling.net.ua/aerialalerts/", 20))
            for name, v in (d.get("states") or {}).items():
                if v.get("alertnow"):
                    k = oblast_of(name)
                    if k:
                        active.setdefault(k, {"since": None, "kinds": {"air_raid"}, "parts": 0})
            src = "ubilling.net.ua"
        now = _now_ms(); en = i18n.en()
        for k, v in active.items():
            if k not in self.since:
                self.since[k] = v["since"] or now
                self.hist.append((now, k, 1))
                if not self.first:
                    o = OBLASTS[k]
                    self.events.append({"at": now, "kind": "ua_alert", "msg": i18n.L(f"Alarm: {o[0]}", f"Alert: {o[1]}"), "obl": k})
            elif v["since"]:
                self.since[k] = v["since"]
        for k in [k for k in self.since if k not in active]:
            del self.since[k]; self.hist.append((now, k, 0))
        self.first = False
        out = []
        for k, (pl, enn, la, lo) in OBLASTS.items():
            if k in ("київ", "ар крим", "крим") and k not in active:
                continue
            a = active.get(k)
            out.append({"id": k, "name": enn if en else pl, "lat": la, "lon": lo, "on": bool(a), "since": self.since.get(k) if a else None,
                        "kinds": [ALERT_KIND.get(x, (x, x))[1 if en else 0] for x in sorted(a["kinds"])] if a else [], "parts": a["parts"] if a else 0})
        self.data = {"src": src, "at": now, "oblasts": out, "active": len(active)}
        return len(active)


# ------------------------------------------------ DeepStateMap
class DeepState(Source):
    name = "deepstate"
    interval = 3 * 3600

    def run_once(self):
        d = json.loads(_get("https://deepstatemap.live/api/history/last", 60))
        feats = ((d.get("map") or {}).get("features")) or []
        polys, points = [], []
        for f in feats:
            g = f.get("geometry") or {}; pr = f.get("properties") or {}
            name = pr.get("name") or ""
            parts = [p.strip() for p in name.split("///")]
            en_name = parts[1] if len(parts) > 1 else name
            st = "occupied" if "status.occupied" in name or "Окуповано" in name else "liberated" if "status.liberated" in name or "Звільнено" in name \
                else "unknown" if "status.unknown" in name else "other"
            if g.get("type") == "Polygon":
                rings = []
                for ring in g.get("coordinates") or []:
                    step = 1 if len(ring) < 400 else 2 if len(ring) < 2000 else 4      # odchudzenie dużych wielokątów
                    rings.append([[round(c[0], 3), round(c[1], 3)] for c in ring[::step]])
                polys.append({"st": st, "n": en_name[:80], "r": rings})
            elif g.get("type") == "Point":
                c = g.get("coordinates") or [0, 0]
                kind = "attack" if "Direction of attack" in name or "Напрямок удару" in name else "unit"
                points.append({"k": kind, "n": (parts[0] if kind == "unit" else en_name)[:120], "en": en_name[:120], "lon": round(c[0], 4), "lat": round(c[1], 4)})
        try:
            ts = int(d.get("id")) * 1000
        except Exception:
            ts = _now_ms()
        self.data = {"at": ts, "polys": polys, "points": points}
        self.gz = None
        return len(polys)


# ------------------------------------------------ NOTAM (FAA NOTAM API)
NOTAM_LOCS = ["UKBV", "UKDV", "UKOV", "UKLV", "EPWW", "EYVL", "EVRR", "EETT", "UMMV", "LRBB", "LUUU", "ULLL", "UUWV", "URRV",
              "OIIX", "ORBB", "LLLL", "OLBB", "OSTT", "OJAC", "OEJD", "OYSC", "OBBB", "OMAE", "OKAC", "OOMM", "HSSS", "RCAA", "EGTT", "EGPX"]
NOTAM_KIND = [("gnss", r"\bGPS\b|GNSS|JAMMING|INTERFERENCE|RAIM"), ("missile", r"ROCKET|MISSILE|LAUNCH|SPACE ?(LAUNCH|DEBRIS)"),
              ("uas", r"\bUAS\b|\bUAV\b|DRONE|UNMANNED"), ("military", r"\bMIL\b|MILITARY|EXER|AIR DEFEN|FIRING|GUNNERY|AERIAL REFUEL"),
              ("closed", r"\bCLSD\b|CLOSED|PROHIBITED|RESTRICTED AREA|DANGER AREA|\bTRA\b|\bTSA\b")]
QLINE = re.compile(r"(\d{2})(\d{2})([NS])(\d{3})(\d{2})([EW])(\d{3})")


class Notams(Source):
    name = "notam"
    interval = 1800

    def enabled(self):
        c = self.cfg()
        return bool(c.get("faa_id") and c.get("faa_secret"))

    def run_once(self):
        c = self.cfg(); hdr = {"client_id": c["faa_id"].strip(), "client_secret": c["faa_secret"].strip()}
        locs = [x.strip().upper() for x in (c.get("notam_locs") or NOTAM_LOCS) if re.match(r"^[A-Z]{4}$", x.strip().upper())][:40]
        out, seen = [], set()
        for loc in locs:
            try:
                d = json.loads(_get("https://external-api.faa.gov/notamapi/v1/notams?" + urllib.parse.urlencode({"icaoLocation": loc, "responseFormat": "geoJson", "pageSize": 1000}), 40, hdr))
            except Exception as e:
                if "401" in str(e) or "403" in str(e):
                    raise
                continue
            for it in d.get("items", []):
                n = (((it.get("properties") or {}).get("coreNOTAMData") or {}).get("notam")) or {}
                text = n.get("text") or ""
                kind = next((k for k, rx in NOTAM_KIND if re.search(rx, text.upper())), None)
                if not kind:
                    continue
                key = n.get("id") or (n.get("number"), loc)
                if key in seen:
                    continue
                seen.add(key)
                pos, rad = None, None
                g = it.get("geometry") or {}
                try:
                    if g.get("type") == "Point":
                        pos = [g["coordinates"][1], g["coordinates"][0]]
                    elif g.get("type") == "Polygon":
                        ring = g["coordinates"][0]; pos = [sum(p[1] for p in ring) / len(ring), sum(p[0] for p in ring) / len(ring)]
                except Exception:
                    pos = None
                q = QLINE.search(n.get("coordinates") or "") or QLINE.search(text)
                if q:
                    la = int(q.group(1)) + int(q.group(2)) / 60; lo = int(q.group(4)) + int(q.group(5)) / 60
                    pos = pos or [-la if q.group(3) == "S" else la, -lo if q.group(6) == "W" else lo]
                    rad = int(q.group(7)) * 1.852
                out.append({"id": str(key), "loc": n.get("icaoLocation") or loc, "num": n.get("number"), "kind": kind, "text": text[:1500],
                            "from": n.get("effectiveStart"), "to": n.get("effectiveEnd"), "pos": [round(pos[0], 3), round(pos[1], 3)] if pos else None,
                            "r": round(rad, 1) if rad else None})
            time.sleep(.4)
        self.data = {"at": _now_ms(), "items": out}
        return len(out)


# ------------------------------------------------ Global Fishing Watch – wykrycia SAR bez AIS
GFW_REGIONS = [("Baltic", (53.5, 9.0, 66.0, 31.0)), ("Black Sea", (40.5, 27.0, 47.5, 42.0)), ("Hormuz / Gulf", (23.0, 48.0, 30.5, 60.5)),
               ("Red Sea", (11.0, 32.0, 30.0, 44.5)), ("E. Mediterranean", (31.0, 26.0, 37.5, 36.5)), ("Taiwan Strait", (21.0, 116.0, 27.0, 123.0))]


class DarkSAR(Source):
    name = "gfw"
    interval = 6 * 3600

    def enabled(self):
        return bool((self.cfg().get("gfw_token") or "").strip())

    def run_once(self):
        tok = self.cfg()["gfw_token"].strip()
        end = datetime.now(timezone.utc).date(); start = end - timedelta(days=10)
        out = []
        for name, (la0, lo0, la1, lo1) in GFW_REGIONS:
            q = urllib.parse.urlencode({"spatial-resolution": "LOW", "temporal-resolution": "ENTIRE", "datasets[0]": "public-global-sar-presence:latest",
                                        "filters[0]": "matched='false'", "date-range": f"{start},{end}", "format": "JSON"})
            body = json.dumps({"geojson": {"type": "Polygon", "coordinates": [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]]}}).encode()
            d = json.loads(_get("https://gateway.api.globalfishingwatch.org/v3/4wings/report?" + q, 90,
                                {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}, body, "POST"))
            for ent in d.get("entries", []):
                for rows in ent.values():
                    for r in rows or []:
                        if r.get("lat") is None:
                            continue
                        out.append({"lat": round(r["lat"], 2), "lon": round(r["lon"], 2), "n": r.get("detections") or r.get("hours") or 1, "zone": name})
            time.sleep(1)
        self.data = {"at": _now_ms(), "from": str(start), "to": str(end), "cells": out}
        return len(out)


# ------------------------------------------------ Telegram OSINT (publiczny podgląd kanałów t.me/s/…)
TG_DEFAULT = {   # kanał: (opis, rodzaj źródła – do oceny wiarygodności)
    "kpszsu": ("Siły Powietrzne Ukrainy", "oficjalne UA"), "GeneralStaffZSU": ("Sztab Generalny ZSU", "oficjalne UA"),
    "DeepStateUA": ("DeepState (UA, analitycy)", "OSINT UA"), "mod_russia": ("Ministerstwo Obrony Rosji", "oficjalne RU"),
    "rybar": ("Rybar (rosyjski milbloger)", "milbloger RU"), "idfofficial": ("Siły Obronne Izraela", "oficjalne IL"),
    "presstv": ("PressTV (media państwowe Iranu)", "propaganda IR"), "nexta_live": ("NEXTA (media BY/opozycja)", "media"),
    "militarysummary": ("Military Summary", "agregator"), "war_monitor": ("War Monitor", "agregator"),
}


class TgOsint(Source):
    name = "telegram"
    interval = 600

    def __init__(self, log, settings, data_dir):
        super().__init__(log, settings)
        self.file = Path(data_dir) / "osint_tg.json"
        self.posts = OrderedDict()            # id -> post
        self.ai = None; self.busy = lambda: False
        self.lock = threading.Lock()
        self.events = deque(maxlen=40)
        try:
            for p in json.loads(self.file.read_text(encoding="utf-8")):
                self.posts[p["id"]] = p
        except Exception:
            pass
        self.loaded = bool(self.posts)

    def channels(self):
        ch = self.cfg().get("tg_channels")
        if isinstance(ch, list) and ch:
            return [re.sub(r"[^A-Za-z0-9_]", "", c.split("/")[-1].lstrip("@")) for c in ch if c.strip()][:30]
        return list(TG_DEFAULT)

    def save(self):
        with self.lock:
            s = json.dumps(list(self.posts.values())[-1500:], ensure_ascii=False)
        tmp = self.file.with_suffix(".tmp"); tmp.write_text(s, encoding="utf-8"); tmp.replace(self.file)

    def fetch(self, ch):
        s = _get(f"https://t.me/s/{ch}", 30).decode("utf-8", "replace")
        out = []
        for blk in s.split('data-post="')[1:]:
            pid = blk.split('"', 1)[0]
            m = re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', blk, re.S)
            t = re.search(r'<time datetime="([^"]+)"', blk)
            if not m or not t:
                continue
            text = _txt(m.group(1))
            if len(text) < 25:
                continue
            try:
                ms = int(datetime.fromisoformat(t.group(1)).timestamp() * 1000)
            except Exception:
                ms = _now_ms()
            out.append({"id": pid, "ch": ch, "t": ms, "text": text[:2500], "url": "https://t.me/" + pid})
        return out

    def run_once(self):
        new = 0; errs = []
        for ch in self.channels():
            try:
                for p in self.fetch(ch):
                    with self.lock:
                        if p["id"] not in self.posts:
                            p["first"] = _now_ms()
                            self.posts[p["id"]] = p; new += 1
            except Exception as e:
                errs.append(f"{ch}: {e}")
            time.sleep(.8)
        with self.lock:
            cut = _now_ms() - 7 * 86400e3
            for k in [k for k, v in self.posts.items() if v["t"] < cut]:
                del self.posts[k]
        if errs and not new:
            raise RuntimeError("; ".join(errs)[:200])
        self.enrich()
        self.loaded = True
        self.save()
        return new

    def enrich(self, limit=60):
        if not self.ai or not self.ai.status().get("ready"):
            return 0
        with self.lock:
            todo = [p for p in self.posts.values() if "ai" not in p and p["t"] > _now_ms() - 3 * 86400e3 and p.get("ai_fail", 0) < 2]
        todo.sort(key=lambda p: -p["t"]); todo = todo[:limit]
        done = 0
        for i in range(0, len(todo), 8):
            if self.busy():
                break
            done += self._batch(todo[i:i + 8]); time.sleep(8)
        return done

    def _batch(self, batch):
        en = i18n.en()
        with self.lock:
            recent = [p for p in self.posts.values() if p.get("ai", {}).get("keep") and not p.get("dup") and p["t"] > _now_ms() - 36 * 3600e3][-25:]
        ref = "\n".join(f"  {p['id']}: {p['ai'].get('title')}" for p in recent)
        lines = []
        for n, p in enumerate(batch):
            meta = TG_DEFAULT.get(p["ch"], (p["ch"], "inne"))
            lines.append(f"[{n}] KANAŁ {p['ch']} ({meta[0]}; typ: {meta[1]}) | {datetime.fromtimestamp(p['t'] / 1000, timezone.utc):%Y-%m-%d %H:%M} UTC\n{p['text'][:1200]}")
        schema = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
            "i": {"type": "integer"}, "keep": {"type": "boolean"}, "title": {"type": "string"}, "summary": {"type": "string"}, "place": {"type": "string"},
            "lat": {"type": "number"}, "lon": {"type": "number"}, "cred": {"type": "string", "enum": ["A", "B", "C", "D", "E", "F"]},
            "dup_of": {"type": "string"}}, "required": ["i", "keep", "title", "summary", "place", "lat", "lon", "cred", "dup_of"]}}}, "required": ["items"]}
        lang = "po angielsku" if en else "po polsku"
        prompt = (f"Oceniasz posty z kanałów Telegram (OSINT). Dla każdego:\n"
                  f"keep: true tylko jeśli opisuje konkretne zdarzenie wojskowe, bezpieczeństwa lub geopolityczne (atak, ostrzał, ruch wojsk, zestrzelenie, decyzja rządu); false dla reklam, apeli, zbiórek, życzeń, ogólników.\n"
                  f"title: do 70 znaków {lang}. summary: 1–2 zdania {lang}, z zaznaczeniem kto twierdzi (np. 'według MO Rosji').\n"
                  f"place: główne miejsce (miasto/region) albo pusty tekst; lat/lon: przybliżone współrzędne tego miejsca albo 0, 0 jeśli nieznane.\n"
                  f"cred: wiarygodność źródła w skali Admiralicji (oficjalne komunikaty stron wojny i propaganda – co najwyżej C, bo są stronnicze).\n"
                  f"dup_of: identyfikator z listy WCZEŚNIEJSZE, jeśli post opisuje to samo zdarzenie; inaczej pusty tekst.\n\n"
                  f"WCZEŚNIEJSZE:\n{ref or '  brak'}\n\nPOSTY:\n" + "\n\n".join(lines))
        try:
            res = self.ai.chat_json("Jesteś analitykiem OSINT systemu KRONOS-7. Rzeczowo, bez powtarzania propagandy jako faktu.", prompt, schema, temperature=0.1)
        except Exception as e:
            self.log(i18n.L(f"Telegram OSINT: AI – błąd ({e}).", f"Telegram OSINT: AI error ({e})."))
            with self.lock:
                for p in batch:
                    p["ai_fail"] = p.get("ai_fail", 0) + 1
            return 0
        ok = 0
        ids = {p["id"] for p in recent}
        with self.lock:
            for x in (res.get("items", []) if isinstance(res, dict) else []):
                i = x.get("i")
                if not isinstance(i, int) or not 0 <= i < len(batch):
                    continue
                p = batch[i]
                la, lo = x.get("lat") or 0, x.get("lon") or 0
                p["ai"] = {"keep": bool(x.get("keep")), "title": str(x.get("title") or "")[:90], "summary": str(x.get("summary") or "")[:400],
                           "place": str(x.get("place") or "")[:60], "cred": x.get("cred") if x.get("cred") in list("ABCDEF") else "F",
                           "pos": [round(la, 3), round(lo, 3)] if (abs(la) > .01 or abs(lo) > .01) and abs(la) <= 90 and abs(lo) <= 180 else None}
                d = str(x.get("dup_of") or "").strip()
                if d and d in ids and d in self.posts:
                    p["dup"] = d; self.posts[d].setdefault("also", []).append(p["id"])
                elif p["ai"]["keep"] and self.loaded and _now_ms() - p["t"] < 3 * 3600e3:
                    self.events.append({"at": _now_ms(), "kind": "osint", "msg": f"{p['ai']['title']} · @{p['ch']}", "id": p["id"]})
                ok += 1
            for p in batch:
                if "ai" not in p:
                    p["ai_fail"] = p.get("ai_fail", 0) + 1
        return ok

    def view(self, hours=48):
        cut = _now_ms() - hours * 3600e3
        with self.lock:
            ps = [p for p in self.posts.values() if p["t"] > cut and not p.get("dup") and (p.get("ai") or {}).get("keep", True)]
        ps.sort(key=lambda p: -p["t"])
        out = []
        for p in ps[:150]:
            a = p.get("ai") or {}
            out.append({"id": p["id"], "ch": p["ch"], "chn": TG_DEFAULT.get(p["ch"], (p["ch"], ""))[0], "type": TG_DEFAULT.get(p["ch"], ("", "inne"))[1],
                        "t": p["t"], "title": a.get("title"), "summary": a.get("summary"), "place": a.get("place"), "pos": a.get("pos"), "cred": a.get("cred"),
                        "also": [x.split("/")[0] for x in p.get("also", [])], "text": p["text"][:600] if not a else None, "url": p["url"], "ai": bool(a)})
        return out

    def brief(self, hours=24, limit=15):
        return [{"when": datetime.fromtimestamp(x["t"] / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M"), "who": "@" + x["ch"] + " (" + x["type"] + ")",
                 "what": x.get("summary") or x.get("title")} for x in self.view(hours) if x.get("ai")][:limit]


# ------------------------------------------------ zdjęcia satelitarne NASA (Worldview Snapshots)
SAT_LAYERS = {"true": "VIIRS_SNPP_CorrectedReflectance_TrueColor", "modis": "MODIS_Terra_CorrectedReflectance_TrueColor",
              "night": "VIIRS_SNPP_DayNightBand_ENCC", "fires": "VIIRS_SNPP_CorrectedReflectance_TrueColor,VIIRS_SNPP_Thermal_Anomalies_375m_All"}


class SatImg:
    def __init__(self):
        self.cache = OrderedDict()

    def get(self, lat, lon, span=1.5, layer="true", date=None):
        span = max(.2, min(12.0, float(span)))
        lat = max(-85, min(85, float(lat))); lon = max(-180, min(180, float(lon)))
        date = date or (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
        k = math.cos(math.radians(lat))
        bbox = f"{lat - span / 2:.4f},{lon - span / 2 / max(.2, k):.4f},{lat + span / 2:.4f},{lon + span / 2 / max(.2, k):.4f}"
        key = (bbox, layer, date)
        if key in self.cache:
            return self.cache[key]
        q = urllib.parse.urlencode({"REQUEST": "GetSnapshot", "LAYERS": SAT_LAYERS.get(layer, SAT_LAYERS["true"]), "CRS": "EPSG:4326", "TIME": date,
                                    "BBOX": bbox, "FORMAT": "image/jpeg", "WIDTH": 768, "HEIGHT": 768})
        b = _get("https://wvs.earthdata.nasa.gov/api/v1/snapshot?" + q, 60)
        if len(self.cache) > 40:
            self.cache.popitem(last=False)
        self.cache[key] = b
        return b
