"""Samoloty wojskowe na żywo (ADS-B), bez AI.

Serwer odpytuje darmowe API (adsb.lol, zapasowo adsb.fi) co kilkanaście sekund,
ale tylko wtedy, gdy terminal jest otwarty. Bez otwartej strony – raz na 5 minut.
Trzyma ślad trasy każdego samolotu i wykrywa zdarzenia: wejście samolotu
rozpoznawczego, bombowca lub tankowca w obserwowany rejon oraz kody alarmowe."""
import gzip, json, threading, time, urllib.request
from collections import deque

from .feeds import MIL_TYPES

UA = "KRONOS-7/3.4 (+https://github.com/vipersq/Kronos-7)"
SOURCES = [
    ("adsb.lol", "https://api.adsb.lol/v2/mil", "https://globe.adsb.lol/?icao={hex}"),
    ("adsb.fi", "https://opendata.adsb.fi/api/v2/mil", "https://globe.adsb.fi/?icao={hex}"),
]
# obserwowane rejony: nazwa, (szer. min, szer. max), (dł. min, dł. max)
ZONES = [
    ("Morze Czarne", (41.0, 47.0), (27.5, 42.0)),
    ("Bałtyk", (53.8, 66.0), (9.5, 30.0)),
    ("Polska", (49.0, 54.8), (14.1, 24.2)),
    ("Rumunia i Mołdawia", (43.6, 48.5), (20.2, 30.2)),
    ("Zatoka Perska i Ormuz", (23.0, 30.5), (47.5, 60.0)),
    ("Morze Czerwone i Jemen", (12.0, 28.0), (32.0, 45.0)),
    ("Wschodnie Morze Śródziemne", (30.0, 37.0), (29.0, 36.5)),
    ("Cieśnina Tajwańska", (21.0, 27.0), (117.0, 124.0)),
    ("Morze Południowochińskie", (5.0, 21.0), (105.0, 120.0)),
    ("Półwysep Koreański", (33.0, 43.0), (124.0, 131.0)),
]
NOTABLE = {"isr", "bomber", "tanker"}
FAMILY = [("K35", "tanker"), ("KC1", "tanker"), ("KC4", "tanker"), ("R13", "isr"), ("RC1", "isr"), ("E3T", "isr"), ("E3C", "isr"),
          ("P8", "isr"), ("RQ4", "isr"), ("MQ9", "isr"), ("TU95", "bomber"), ("T95", "bomber"), ("TU16", "bomber"), ("T160", "bomber")]
SQUAWK = {"7500": "porwanie (7500)", "7600": "utrata łączności (7600)", "7700": "sytuacja awaryjna (7700)"}
CAT_PL = {"isr": "rozpoznawczy", "tanker": "tankowiec", "bomber": "bombowiec", "transport": "transportowy", "fighter": "myśliwiec", "other": "wojskowy"}


def zone_of(lat, lon):
    for name, (a, b), (c, d) in ZONES:
        if a <= lat <= b and c <= lon <= d:
            return name
    return None


def classify(t):
    t = (t or "").upper()
    if t in MIL_TYPES:
        return MIL_TYPES[t]
    for pre, v in FAMILY:                   # warianty kodów, np. K35E, E3CF, RC135
        if t.startswith(pre):
            return v
    return "other"


class LiveAir:
    def __init__(self, cfg, log=print):
        c = cfg.get("live_air", {})
        self.interval = max(5, int(c.get("interval_s", 10)))
        self.idle = max(60, int(c.get("idle_interval_s", 300)))
        self.hide_na = bool(c.get("hide_na_routine", True))
        self.log = log
        self.ac = {}                 # hex -> rekord z trasą
        self.events = deque(maxlen=60)
        self.seen_zone = {}          # (hex, strefa) -> czas ostatniego wejścia
        self.src_i = 0
        self.fallback_until = 0
        self.last_view = 0
        self.status = {"ok": False, "src": None, "err": None, "at": 0, "n": 0, "total": 0}
        self.lock = threading.Lock()
        self.wake = threading.Event()

    # ---------------------------------------------------------------- pobieranie
    def _get(self, url):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=12) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                b = gzip.decompress(b)
        return json.loads(b)

    def fetch(self):
        """adsb.lol, a gdy nie odpowiada – adsb.fi przez 5 minut, potem znowu próba adsb.lol."""
        order = [1, 0] if time.time() < self.fallback_until else [0, 1]
        errs = []
        for i in order:
            name, url, _ = SOURCES[i]
            try:
                d = self._get(url)
                if not isinstance(d.get("ac"), list):
                    raise ValueError("nieoczekiwany format")
            except Exception as e:
                errs.append(f"{name}: {e}")
                if i == 0:
                    self.fallback_until = time.time() + 300
                continue
            if i == 1 and self.src_i != 1:
                self.log(f"Samoloty na żywo: {SOURCES[0][0]} nie odpowiada ({errs[0] if errs else 'przerwa'}), używam {name}.")
            elif i == 0 and self.src_i != 0:
                self.log(f"Samoloty na żywo: wracam do {name}.")
            self.src_i = i
            return d
        raise RuntimeError(" · ".join(errs) or "brak źródeł")

    def ingest(self, d):
        now = time.time()
        now_ms = d.get("now") or now * 1000
        src = SOURCES[self.src_i]
        seen = set()
        new_events = []
        with self.lock:
            for a in d.get("ac", []):
                lat, lon = a.get("lat"), a.get("lon")
                if lat is None or lon is None:
                    lat, lon = (a.get("lastPosition") or {}).get("lat"), (a.get("lastPosition") or {}).get("lon")
                    if lat is None:
                        continue
                hx = a.get("hex")
                t = (a.get("t") or "").upper()
                cat = classify(t)
                in_na = 15 < lat < 72 and -170 < lon < -50
                if self.hide_na and in_na and cat not in NOTABLE:
                    continue
                alt = a.get("alt_baro")
                ground = alt == "ground"
                ts = int(now_ms - 1000 * float(a.get("seen_pos", a.get("seen", 0)) or 0))
                rec = self.ac.get(hx)
                if rec is None:
                    rec = self.ac[hx] = {"hex": hx, "trail": [], "first": now}
                rec.update({
                    "cs": (a.get("flight") or "").strip() or (a.get("r") or "").strip(), "reg": (a.get("r") or "").strip(),
                    "t": t, "desc": a.get("desc") or "", "cat": cat,
                    "lat": round(lat, 4), "lon": round(lon, 4), "ts": ts,
                    "alt": 0 if ground else alt, "ground": ground, "gs": a.get("gs"),
                    "trk": a.get("track", a.get("true_heading")), "vr": a.get("baro_rate"),
                    "sq": a.get("squawk"), "mlat": bool(a.get("mlat")),
                    "u": src[2].format(hex=hx), "upd": now,
                })
                tr = rec["trail"]
                if not tr or ts - tr[-1][2] >= 30000 or abs(tr[-1][0] - lat) + abs(tr[-1][1] - lon) > .15:
                    tr.append([round(lat, 3), round(lon, 3), ts])
                    cut = ts - 30 * 60000
                    while tr and (tr[0][2] < cut or len(tr) > 70):
                        tr.pop(0)
                seen.add(hx)
                # zdarzenia
                label = f"{rec['cs'] or hx} ({rec['desc'] or t or '?'})"
                z = zone_of(lat, lon)
                if z and cat in NOTABLE and not ground:
                    k = (hx, z)
                    if now - self.seen_zone.get(k, 0) > 2 * 3600:
                        new_events.append({"kind": "zone", "hex": hx, "cat": cat, "zone": z,
                                           "msg": f"Samolot {CAT_PL[cat]} {label} w rejonie: {z}"})
                    self.seen_zone[k] = now
                sq = rec["sq"]
                if sq in SQUAWK and rec.get("sq_ev") != sq:
                    new_events.append({"kind": "squawk", "hex": hx, "cat": cat, "zone": z,
                                       "msg": f"{label} nadaje kod {SQUAWK[sq]}"})
                rec["sq_ev"] = sq if sq in SQUAWK else None
            # sprzątanie: samoloty, których nikt nie widział od 10 minut
            for hx in [h for h, r in self.ac.items() if now - r["upd"] > 600]:
                del self.ac[hx]
            for k in [k for k, v in self.seen_zone.items() if now - v > 6 * 3600]:
                del self.seen_zone[k]
            for e in new_events:
                e["at"] = int(now * 1000)
                self.events.append(e)
            self.status.update(ok=True, src=src[0], err=None, at=int(now * 1000), n=len(self.ac), total=d.get("total") or len(d.get("ac", [])))
        for e in new_events:
            self.log("SAMOLOTY: " + e["msg"])

    # ---------------------------------------------------------------- pętla
    def loop(self):
        while True:
            try:
                self.ingest(self.fetch())
            except Exception as e:
                with self.lock:
                    self.status.update(ok=False, err=str(e)[:200])
            active = time.time() - self.last_view < 60
            self.wake.wait(self.interval if active else self.idle)
            self.wake.clear()

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="live-air").start()

    # ---------------------------------------------------------------- API
    def snapshot(self, since_ev=0):
        was_idle = time.time() - self.last_view > 60
        self.last_view = time.time()
        if was_idle:
            self.wake.set()          # ktoś otworzył terminal – pobierz od razu
        with self.lock:
            ac = [{k: v for k, v in r.items() if k not in ("upd", "first", "sq_ev")} for r in self.ac.values()]
            ev = [e for e in self.events if e["at"] > since_ev]
            st = dict(self.status)
        rank = {"isr": 0, "bomber": 1, "tanker": 2, "transport": 3, "fighter": 4, "other": 5}
        ac.sort(key=lambda r: rank.get(r["cat"], 9))
        return {"now": int(time.time() * 1000), "interval": self.interval, "status": st, "ac": ac, "events": ev}
