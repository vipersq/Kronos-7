"""Historia: pozycje samolotów i ważnych statków (odtwarzanie 48 h), metryki godzinowe (wykresy, rok)
i dziennik zdarzeń (90 dni). SQLite z biblioteki standardowej, zapis w osobnym wątku."""
import json, sqlite3, threading, time
from pathlib import Path

from .live_air import zone_of

SCHEMA = """
CREATE TABLE IF NOT EXISTS air(ts INTEGER, hex TEXT, cs TEXT, t TEXT, cat TEXT, lat REAL, lon REAL, alt INTEGER, trk INTEGER, cn TEXT);
CREATE INDEX IF NOT EXISTS air_ts ON air(ts);
CREATE TABLE IF NOT EXISTS sea(ts INTEGER, mmsi INTEGER, name TEXT, cat TEXT, lat REAL, lon REAL, sog REAL, cog REAL);
CREATE INDEX IF NOT EXISTS sea_ts ON sea(ts);
CREATE TABLE IF NOT EXISTS metrics(ts INTEGER, key TEXT, val REAL);
CREATE INDEX IF NOT EXISTS metrics_k ON metrics(key, ts);
CREATE TABLE IF NOT EXISTS events(ts INTEGER, kind TEXT, src TEXT, msg TEXT, ref TEXT);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
"""
KEEP_POS = 48 * 3600
KEEP_EV = 90 * 86400
KEEP_MET = 400 * 86400
METRIC_LABELS = {
    "threat": ("Poziom napięcia", "Tension level"), "brent": ("Ropa Brent (USD)", "Brent crude (USD)"),
    "air.total": ("Samoloty wojskowe w powietrzu", "Military aircraft airborne"), "air.isr": ("Samoloty rozpoznawcze", "Reconnaissance aircraft"),
    "air.isr_zones": ("Rozpoznanie w obserwowanych rejonach", "Reconnaissance in watched regions"), "air.loiter": ("Samoloty krążące", "Loitering aircraft"),
    "sea.total": ("Statki w pamięci", "Ships in memory"), "sea.military": ("Okręty i straż (AIS)", "Warships and coast guard (AIS)"),
    "sea.dark": ("„Ciemne” statki (24 h)", "“Dark” ships (24 h)"), "sea.sts": ("Możliwe przeładunki STS", "Possible STS transfers"),
    "sea.sanc": ("Statki z listy sankcji OFAC", "OFAC-sanctioned ships"), "sea.cable": ("Statki nad kablami", "Ships over cables"),
    "hormuz.transits": ("Ormuz – przejścia/dobę (PortWatch)", "Hormuz – transits/day (PortWatch)"),
}


class History:
    def __init__(self, data_dir, log=print):
        self.path = Path(data_dir) / "history.db"
        self.log = log
        self.lock = threading.Lock()
        self.db = sqlite3.connect(str(self.path), check_same_thread=False, timeout=10)
        self.db.execute("PRAGMA journal_mode=WAL"); self.db.execute("PRAGMA synchronous=NORMAL")
        self.db.executescript(SCHEMA); self.db.commit()
        self.last_air = self.last_sea = self.last_met = self.last_clean = 0
        self.ev_seen = {}
        self.on_event = None

    # ------------------------------------------------ zapis
    def sample(self, air, sea, state, markets):
        now = time.time()
        rows = []
        with self.lock:
            if air and now - self.last_air >= 60:
                self.last_air = now
                ts = int(now)
                with air.lock:
                    rows = [(ts, r["hex"], r.get("cs"), r.get("t"), r.get("cat"), r["lat"], r["lon"], r.get("alt") if isinstance(r.get("alt"), int) else None,
                             int(r["trk"]) if r.get("trk") is not None else None, r.get("country")) for r in air.ac.values() if now - r.get("upd", 0) < 120]
                self.db.executemany("INSERT INTO air VALUES(?,?,?,?,?,?,?,?,?,?)", rows)
            if sea and now - self.last_sea >= 600:
                self.last_sea = now
                ts = int(now)
                with sea.lock:
                    srows = [(ts, r["mmsi"], r.get("name"), r["cat"], r["lat"], r["lon"], r.get("sog"), r.get("cog")) for r in sea.ships.values()
                             if "lat" in r and now - r.get("upd", 0) < 1800 and (r["cat"] in ("military", "law") or r.get("sanc")
                                                                                   or (r["cat"] == "tanker" and zone_of(r["lat"], r["lon"])))]
                self.db.executemany("INSERT INTO sea VALUES(?,?,?,?,?,?,?,?)", srows)
            # zdarzenia z modułów na żywo
            for src, mod in (("air", air), ("sea", sea)):
                if not mod:
                    continue
                last = self.ev_seen.get(src, 0)
                new = [e for e in list(mod.events) if e["at"] > last]
                if new:
                    first = src not in self.ev_seen
                    self.ev_seen[src] = max(e["at"] for e in new)
                    if self.on_event and not first:
                        for e in new:
                            try: self.on_event(src, e)
                            except Exception: pass
                    self.db.executemany("INSERT INTO events VALUES(?,?,?,?,?)",
                                        [(int(e["at"] / 1000), e.get("kind"), src, e.get("msg"), str(e.get("hex") or e.get("mmsi") or "")) for e in new])
            if now - self.last_met >= 3600 or self.last_met == 0:
                self.last_met = now
                self._metrics(int(now // 3600 * 3600), air, sea, state, markets)
            if now - self.last_clean > 3600:
                self.last_clean = now
                self.db.execute("DELETE FROM air WHERE ts < ?", (int(now - KEEP_POS),))
                self.db.execute("DELETE FROM sea WHERE ts < ?", (int(now - KEEP_POS),))
                self.db.execute("DELETE FROM events WHERE ts < ?", (int(now - KEEP_EV),))
                self.db.execute("DELETE FROM metrics WHERE ts < ?", (int(now - KEEP_MET),))
            self.db.commit()

    def _metrics(self, ts, air, sea, state, markets):
        m = {}
        if state and (state.get("threat") or {}).get("level") is not None:
            m["threat"] = state["threat"]["level"]
        for it in (markets or {}).get("items", []):
            if it.get("id") == "brent" and it.get("price"):
                m["brent"] = it["price"]
        pw = (((state or {}).get("feeds") or {}).get("portwatch") or {}).get("hormuz") or {}
        ser = pw.get("series") or []
        if ser:
            last7 = [x[1] for x in ser[-7:] if isinstance(x, list) and len(x) > 1]
            if last7:
                m["hormuz.transits"] = round(sum(last7) / len(last7), 1)
        if air:
            with air.lock:
                ac = [r for r in air.ac.values() if time.time() - r.get("upd", 0) < 300]
            m["air.total"] = len(ac)
            m["air.isr"] = sum(1 for r in ac if r.get("cat") == "isr")
            m["air.isr_zones"] = sum(1 for r in ac if r.get("cat") == "isr" and zone_of(r["lat"], r["lon"]))
            m["air.loiter"] = sum(1 for r in ac if r.get("loiter"))
        if sea:
            sm = sea.summary or {}
            m["sea.total"] = sm.get("total", 0)
            m["sea.military"] = (sm.get("cats") or {}).get("military", 0) + (sm.get("cats") or {}).get("law", 0)
            for k in ("dark", "sts", "sanc", "cable"):
                m["sea." + k] = len((sm.get("watch") or {}).get(k, []))
            for z, v in (sm.get("zones") or {}).items():
                for k2 in ("all", "tanker", "military", "ru", "foc"):
                    m[f"zone.{z}.{k2}"] = v.get(k2, 0)
        self.db.executemany("INSERT INTO metrics VALUES(?,?,?)", [(ts, k, float(v)) for k, v in m.items()])

    # ------------------------------------------------ odczyt
    def range(self):
        with self.lock:
            a = self.db.execute("SELECT MIN(ts), MAX(ts) FROM air").fetchone()
        return {"from": (a[0] or 0) * 1000, "to": (a[1] or 0) * 1000}

    def frame(self, t_ms):
        t = int(t_ms / 1000)
        with self.lock:
            air = self.db.execute("SELECT hex, cs, t, cat, lat, lon, alt, trk, cn, MAX(ts) FROM air WHERE ts BETWEEN ? AND ? GROUP BY hex", (t - 120, t)).fetchall()
            sea = self.db.execute("SELECT mmsi, name, cat, lat, lon, sog, cog, MAX(ts) FROM sea WHERE ts BETWEEN ? AND ? GROUP BY mmsi", (t - 1200, t)).fetchall()
            ev = self.db.execute("SELECT ts, kind, src, msg, ref FROM events WHERE ts BETWEEN ? AND ? ORDER BY ts DESC LIMIT 12", (t - 3600, t)).fetchall()
        return {"t": t_ms,
                "air": [{"hex": r[0], "cs": r[1], "t": r[2], "cat": r[3], "lat": r[4], "lon": r[5], "alt": r[6], "trk": r[7], "country": r[8], "ts": r[9] * 1000} for r in air],
                "sea": [[r[0], r[3], r[4], r[5], r[6], r[2], r[1], r[7]] for r in sea],
                "events": [{"at": r[0] * 1000, "kind": r[1], "src": r[2], "msg": r[3], "ref": r[4]} for r in ev]}

    def track(self, hex_or_mmsi, t_ms, minutes=30):
        t = int(t_ms / 1000)
        with self.lock:
            if str(hex_or_mmsi).isdigit():
                rows = self.db.execute("SELECT lat, lon, ts FROM sea WHERE mmsi=? AND ts BETWEEN ? AND ? ORDER BY ts", (int(hex_or_mmsi), t - minutes * 60 * 6, t)).fetchall()
            else:
                rows = self.db.execute("SELECT lat, lon, ts FROM air WHERE hex=? AND ts BETWEEN ? AND ? ORDER BY ts", (hex_or_mmsi, t - minutes * 60, t)).fetchall()
        return [[r[0], r[1], r[2] * 1000] for r in rows]

    def series(self, key, days=30):
        since = int(time.time() - days * 86400)
        with self.lock:
            rows = self.db.execute("SELECT ts, val FROM metrics WHERE key=? AND ts>=? ORDER BY ts", (key, since)).fetchall()
        return [[r[0] * 1000, r[1]] for r in rows]

    def keys(self):
        with self.lock:
            rows = self.db.execute("SELECT DISTINCT key FROM metrics").fetchall()
        return sorted(r[0] for r in rows)

    def events(self, hours=24, limit=200):
        since = int(time.time() - hours * 3600)
        with self.lock:
            rows = self.db.execute("SELECT ts, kind, src, msg, ref FROM events WHERE ts>=? ORDER BY ts DESC LIMIT ?", (since, limit)).fetchall()
        return [{"at": r[0] * 1000, "kind": r[1], "src": r[2], "msg": r[3], "ref": r[4]} for r in rows]

    def loop(self, air, sea, get_state, get_markets):
        while True:
            try:
                self.sample(air, sea, get_state(), get_markets())
            except Exception as e:
                self.log(f"Historia: {e}")
            time.sleep(20)

    def start(self, air, sea, get_state, get_markets):
        threading.Thread(target=self.loop, args=(air, sea, get_state, get_markets), daemon=True, name="history").start()
