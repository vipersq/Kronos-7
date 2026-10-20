"""Statki na żywo (AIS), bez AI.

Źródła:
 * Digitraffic (Fińska Agencja Transportu) – bez klucza, północny Bałtyk
   (Zatoka Fińska, Botnicka, wody Estonii i Szwecji);
 * aisstream.io – cały świat, darmowy klucz API (rejestracja przez GitHub),
   wpisywany w oknie OPERATOR. Strumień obejmuje cały świat albo tylko obserwowane rejony.
Statki są pamiętane 6 godzin od ostatniego sygnału i zapisywane na dysk co 5 minut.
Klient WebSocket jest napisany na bibliotece standardowej – nic nie trzeba doinstalowywać."""
import base64, csv, gzip, io, json, math, os, re, socket, ssl, struct, threading, time, urllib.request
from array import array
from pathlib import Path
from collections import deque
from datetime import datetime, timezone

from . import registry as REG
from .live_air import ZONES, zone_of, zone_name
from . import i18n

UA = "KRONOS-7/3.4 (+https://github.com/vipersq/Kronos-7)"
DT = "https://meri.digitraffic.fi/api/ais/v1"
# rejony strumienia aisstream.io: [[szer. min, dł. min], [szer. max, dł. max]]
AIS_BOXES = [
    [[53.0, 9.0], [66.0, 31.0]],      # Bałtyk
    [[40.5, 27.0], [47.5, 42.0]],     # Morze Czarne, Bosfor
    [[22.0, 47.0], [30.5, 60.5]],     # Zatoka Perska, Ormuz, Zatoka Omańska
    [[10.0, 32.0], [30.0, 52.0]],     # Morze Czerwone, Bab al-Mandab, Zatoka Adeńska
    [[29.5, 28.0], [37.5, 36.5]],     # wschodnie Morze Śródziemne, Kanał Sueski
    [[20.0, 116.0], [27.5, 125.0]],   # Cieśnina Tajwańska
    [[0.0, 98.0], [22.0, 121.0]],     # Morze Południowochińskie, Malakka
    [[48.0, -6.0], [53.5, 4.0]],      # kanał La Manche
]
WORLD = [[[-90.0, -180.0], [90.0, 180.0]]]
CATS = ["military", "law", "tanker", "cargo", "passenger", "sar", "service", "fishing", "pleasure", "other"]
CAT_I = {c: i for i, c in enumerate(CATS)}
KEEP_S = 24 * 3600         # jak długo pamiętamy statek bez sygnału (stare pozycje są wyblakłe)
LINK = "https://www.marinetraffic.com/en/ais/details/ships/mmsi:{mmsi}"


# ---------------------------------------------------------------- minimalny klient WebSocket (RFC 6455)
class WS:
    def __init__(self, host, path, timeout=30):
        raw = socket.create_connection((host, 443), timeout=timeout)
        self.s = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET {path} HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: {UA}\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head:
            c = self.s.recv(1)
            if not c:
                raise ConnectionError("serwer zamknął połączenie")
            head += c
        if b" 101 " not in head.split(b"\r\n", 1)[0]:
            raise ConnectionError(head.split(b"\r\n", 1)[0].decode(errors="replace"))
        self.buf = bytearray(); self.pos = 0

    def _read(self, n):
        # bufor z przesunięciem – bez kopiowania reszty danych przy każdym odczycie
        while len(self.buf) - self.pos < n:
            c = self.s.recv(262144)
            if not c:
                raise ConnectionError("połączenie przerwane")
            if self.pos > 1 << 20:
                del self.buf[:self.pos]; self.pos = 0
            self.buf += c
        out = bytes(self.buf[self.pos:self.pos + n]); self.pos += n
        return out

    def send(self, data, op=1):
        b = data.encode() if isinstance(data, str) else data
        hdr = bytes([0x80 | op])
        n = len(b)
        hdr += bytes([0x80 | n]) if n < 126 else (bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
        mask = os.urandom(4)
        self.s.sendall(hdr + mask + bytes(x ^ mask[i % 4] for i, x in enumerate(b)))

    def recv(self):
        """Zwraca kolejną wiadomość (tekst lub bajty); obsługuje ping, fragmentację i zamknięcie."""
        parts, first_op = [], None
        while True:
            b0, b1 = self._read(2)
            fin, op, n = b0 & 0x80, b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if b1 & 0x80 else None
            data = self._read(n)
            if mask:
                data = bytes(x ^ mask[i % 4] for i, x in enumerate(data))
            if op == 9:
                self.send(data, 10); continue
            if op == 10:
                continue
            if op == 8:
                raise ConnectionError("serwer zamknął strumień" + (": " + data[2:].decode(errors="replace") if len(data) > 2 else ""))
            if op in (1, 2):
                first_op = op
            parts.append(data)
            if fin:
                msg = b"".join(parts)
                return msg.decode("utf-8", "replace") if first_op == 1 else msg

    def close(self):
        try:
            self.send(b"\x03\xe8", 8); self.s.close()
        except Exception:
            pass


# ---------------------------------------------------------------- statki
class LiveSea:
    def __init__(self, cfg, log=print, data_dir=None):
        c = cfg.get("live_sea", {})
        self.interval = max(15, int(c.get("interval_s", 30)))
        self.max_ships = int(c.get("max_ships", 150000))
        self.use_dt = bool(c.get("digitraffic", True))
        self.scope = c.get("scope", "world")
        self.key = ""
        self.log = log
        self.ships = {}            # mmsi -> rekord (dict); trasa w array('i'): lat*1e4, lon*1e4, czas s
        self.events = deque(maxlen=60)
        self.seen_zone = {}
        self.meta_at = 0
        self.last_view = 0
        self.summary = {}
        self.sanc, self.sanc_names, self.sanc_at = {}, {}, 0      # OFAC: IMO -> (nazwa, program), nazwa -> IMO
        self.cables, self.cable_grid, self.cable_segs, self.cable_names, self.cable_at = None, {}, [], [], 0
        self.watch = {"dark": {}, "sts": {}, "cable": {}}
        self.file = Path(data_dir) / "ships.json.gz" if data_dir else None
        self.saved_at = time.time()
        self.status = {"digitraffic": {"ok": None, "err": None, "at": 0, "n": 0},
                       "aisstream": {"ok": None, "err": None, "at": 0, "n": 0, "msgs": 0, "rate": 0}}
        self.lock = threading.Lock()
        self.ws = None
        self.ws_gen = 0
        self.wake = threading.Event()
        self.load()

    # ------------------------------------------------ zapis i odczyt z dysku
    def load(self):
        if not self.file or not self.file.exists():
            return
        try:
            rows = json.loads(gzip.decompress(self.file.read_bytes()))
            now = time.time()
            for r in rows:
                if now - r.get("upd", 0) < KEEP_S:
                    r["trail"] = array("i", r.get("trail") or [])
                    self.ships[r["mmsi"]] = r
            self.log(f"Statki: wczytano {len(self.ships)} ostatnich pozycji z dysku.")
        except Exception as e:
            self.log(f"Statki: nie udało się wczytać zapisu ({e}).")

    def save(self):
        if not self.file:
            return
        with self.lock:
            rows = [dict(r, trail=list(r["trail"])) for r in self.ships.values() if "lat" in r]
        try:
            tmp = self.file.with_suffix(".tmp")
            tmp.write_bytes(gzip.compress(json.dumps(rows, separators=(",", ":")).encode(), 5))
            os.replace(tmp, self.file)
        except Exception as e:
            self.log(f"Statki: zapis nieudany ({e}).")
        self.saved_at = time.time()

    # ------------------------------------------------ wspólne
    def _get(self, url):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Digitraffic-User": "KRONOS-7", "Accept-Encoding": "gzip"})
        with urllib.request.urlopen(req, timeout=25) as r:
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                b = gzip.decompress(b)
        return json.loads(b)

    def _upd(self, mmsi, src, **kw):
        if not mmsi:
            return None
        rec = self.ships.get(mmsi)
        if rec is None:
            if len(self.ships) >= self.max_ships:
                return None
            flag = REG.mmsi_flag(mmsi)
            rec = self.ships[mmsi] = {"mmsi": mmsi, "flag": flag, "name": "", "type": 0, "cat": "other", "kind": "nieznany",
                                      "trail": array("i"), "src": src, "upd": 0}
        for k, v in kw.items():
            if v not in (None, ""):
                rec[k] = v
        if kw.get("type"):
            rec["cat"], rec["kind"] = REG.ship_type(kw["type"])
        if (kw.get("imo") or kw.get("name")) and self.sanc:
            self._sanc_match(rec)
        rec["src"] = src
        return rec

    def _pos(self, rec, lat, lon, ts, sog, cog, hdg, nav):
        if rec is None or lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180 or (lat == 0 and lon == 0):
            return
        rec.update(lat=round(lat, 4), lon=round(lon, 4), ts=int(ts), sog=sog if sog is not None and sog < 102.3 else None,
                   cog=cog if cog is not None and cog < 360 else None, hdg=hdg if hdg is not None and hdg < 360 else None, nav=nav, upd=time.time())
        tr, t = rec["trail"], int(ts / 1000)
        if not tr or t - tr[-1] > 300 or abs(tr[-3] - lat * 1e4) + abs(tr[-2] - lon * 1e4) > 400:
            tr.extend((int(lat * 1e4), int(lon * 1e4), t))
            if len(tr) > 60:                     # najwyżej 20 punktów
                del tr[:3]
        if rec["cat"] in ("military", "law") or nav in (6, 14):
            self._events(rec)
        if rec.get("sanc") and not rec.get("sanc_ev"):
            rec["sanc_ev"] = 1
            p = rec["sanc"]["prog"]
            self._event(rec, "sanc", i18n.L(f"Statek z listy sankcji OFAC ({p}): {self._label(rec)}", f"OFAC-sanctioned vessel ({p}): {self._label(rec)}"))

    def _label(self, rec):
        if i18n.en():
            return f"{rec.get('name') or rec['mmsi']} ({REG.SHIP_KIND_EN.get(rec['kind'], rec['kind'])}, flag: {REG.COUNTRY_EN.get(rec['flag'], rec['flag']) or '?'})"
        return f"{rec.get('name') or rec['mmsi']} ({rec['kind']}, bandera: {rec['flag'] or '?'})"

    def _events(self, rec):
        now = time.time()
        z = zone_of(rec["lat"], rec["lon"])
        ev = None
        if rec["cat"] in ("military", "law") and z:
            k = (rec["mmsi"], z)
            if now - self.seen_zone.get(k, 0) > 6 * 3600:
                name = self._label(rec)
                ev = {"kind": "zone", "msg": i18n.L(f"Jednostka {name} w rejonie: {z}", f"Vessel {name} in the {zone_name(z)} area")}
            self.seen_zone[k] = now
        nav = rec.get("nav")
        if nav in (6, 14) and rec.get("nav_ev") != nav:
            ev = {"kind": "alarm", "msg": f"{self._label(rec)}: {(REG.NAV_STATUS_EN if i18n.en() else REG.NAV_STATUS).get(nav)}" + (f" – {zone_name(z)}" if z else "")}
        rec["nav_ev"] = nav if nav in (6, 14) else None
        if ev:
            ev.update(at=int(now * 1000), mmsi=rec["mmsi"], zone=z)
            self.events.append(ev)
            self.log("STATKI: " + ev["msg"])

    # ------------------------------------------------ Digitraffic (bez klucza)
    def poll_dt(self):
        st = self.status["digitraffic"]
        try:
            if time.time() - self.meta_at > 900:
                vs = self._get(DT + "/vessels")
                with self.lock:
                    for v in vs:
                        a, b, c, d = (v.get("referencePoint" + x) or 0 for x in "ABCD")
                        self._upd(v.get("mmsi"), "Digitraffic", name=(v.get("name") or "").strip(), type=v.get("shipType"),
                                  dest=(v.get("destination") or "").strip(), cs=(v.get("callSign") or "").strip(), imo=v.get("imo") or None,
                                  draught=(v.get("draught") or 0) / 10 or None, length=(a + b) or None, width=(c + d) or None)
                self.meta_at = time.time()
            since = int((time.time() - 20 * 60) * 1000)
            d = self._get(f"{DT}/locations?from={since}")
            n = 0
            with self.lock:
                for f in d.get("features", []):
                    p, g = f.get("properties", {}), (f.get("geometry") or {}).get("coordinates") or [None, None]
                    rec = self._upd(f.get("mmsi") or p.get("mmsi"), "Digitraffic")
                    self._pos(rec, g[1], g[0], p.get("timestampExternal") or time.time() * 1000, p.get("sog"), p.get("cog"), p.get("heading"), p.get("navStat"))
                    n += 1
            st.update(ok=True, err=None, at=int(time.time() * 1000), n=n)
        except Exception as e:
            st.update(ok=False, err=str(e)[:200])

    # ------------------------------------------------ aisstream.io (klucz)
    def set_key(self, key, scope=None):
        key = (key or "").strip()
        scope = scope or self.scope
        if key == self.key and scope == self.scope:
            return
        self.key, self.scope = key, scope
        self.ws_gen += 1
        if self.ws:
            self.ws.close()
        st = self.status["aisstream"]
        st.update(ok=None, err=None if key else i18n.L("brak klucza API", "no API key"), n=0)
        if key:
            threading.Thread(target=self.loop_ais, args=(self.ws_gen,), daemon=True, name="aisstream").start()

    def loop_ais(self, gen):
        st, delay = self.status["aisstream"], 5
        while gen == self.ws_gen and self.key:
            got = 0
            try:
                ws = self.ws = WS("stream.aisstream.io", "/v0/stream")
                ws.send(json.dumps({"APIKey": self.key, "BoundingBoxes": WORLD if self.scope == "world" else AIS_BOXES,
                                    "FilterMessageTypes": ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData"]}))
                self.log(f"Statki: połączono z aisstream.io ({'cały świat' if self.scope == 'world' else 'obserwowane rejony'}).")
                st.update(err=None)
                t0, c0 = time.time(), 0
                while gen == self.ws_gen:
                    m = ws.recv()
                    try:
                        msg = json.loads(m)
                    except ValueError:
                        continue
                    if "error" in msg:
                        raise ConnectionError(msg["error"])
                    self.ingest_ais(msg)
                    st["msgs"] += 1; got += 1; c0 += 1
                    if time.time() - t0 > 10:
                        st.update(ok=True, at=int(time.time() * 1000), rate=round(c0 / (time.time() - t0)))
                        t0, c0 = time.time(), 0
                    delay = 5
            except Exception as e:
                if gen != self.ws_gen:
                    return
                err = str(e)[:200]
                if not got and "przerwane" in err:
                    err = i18n.L("aisstream.io zamknął połączenie bez danych – najpewniej nieprawidłowy klucz API", "aisstream.io closed the connection without data – most likely an invalid API key")
                    delay = max(delay, 120)
                st.update(ok=False, err=err)
                self.log(f"Statki: aisstream.io – {err}. Ponowna próba za {delay} s.")
                if "api key" in err.lower() or "apikey" in err.lower() or "klucz" in err:
                    delay = 300
                time.sleep(delay)
                delay = min(delay * 2, 300)

    def ingest_ais(self, msg):
        t = msg.get("MessageType")
        md = msg.get("MetaData") or {}
        body = (msg.get("Message") or {}).get(t) or {}
        mmsi = md.get("MMSI") or body.get("UserID")
        ts = time.time() * 1000
        tu = md.get("time_utc")
        if tu:
            try:
                ts = datetime.strptime(tu[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).timestamp() * 1000
            except ValueError:
                pass
        with self.lock:
            name = (md.get("ShipName") or "").strip()
            if t == "ShipStaticData":
                dim = body.get("Dimension") or {}
                self._upd(mmsi, "aisstream.io", name=(body.get("Name") or name).strip(), type=body.get("Type"), cs=(body.get("CallSign") or "").strip(),
                          imo=body.get("ImoNumber") or None, dest=(body.get("Destination") or "").strip(), draught=body.get("MaximumStaticDraught") or None,
                          length=(dim.get("A", 0) + dim.get("B", 0)) or None, width=(dim.get("C", 0) + dim.get("D", 0)) or None)
            else:
                kw = {"name": name}
                if t == "ExtendedClassBPositionReport" and body.get("Type"):
                    kw["type"] = body.get("Type")
                rec = self._upd(mmsi, "aisstream.io", **kw)
                self._pos(rec, body.get("Latitude", md.get("latitude")), body.get("Longitude", md.get("longitude")), ts,
                          body.get("Sog"), body.get("Cog"), body.get("TrueHeading"), body.get("NavigationalStatus"))


    # ------------------------------------------------ listy sankcyjne OFAC (statki)
    def load_sanctions(self):
        f = Path(self.file).parent / "ofac_vessels.json" if self.file else None
        try:
            if f and f.exists() and time.time() - f.stat().st_mtime < 86400:
                d = json.loads(f.read_text(encoding="utf-8"))
            else:
                req = urllib.request.Request("https://www.treasury.gov/ofac/downloads/sdn.csv", headers={"User-Agent": "Mozilla/5.0 " + UA})
                with urllib.request.urlopen(req, timeout=90) as r:
                    txt = r.read().decode("latin-1")
                d = {}
                for row in csv.reader(io.StringIO(txt)):
                    if len(row) < 12 or row[2].strip() != "vessel":
                        continue
                    m = re.search(r"IMO (\d{7})", row[11])
                    if m:
                        d[m.group(1)] = [row[1].strip(), row[3].strip(), row[9].strip() if row[9].strip() != "-0-" else ""]
                if f and d:
                    f.write_text(json.dumps(d), encoding="utf-8")
            self.sanc = {int(k): v for k, v in d.items()}
            self.sanc_names = {v[0].upper(): k for k, v in self.sanc.items()}
            self.sanc_at = time.time()
            with self.lock:
                for r in self.ships.values():
                    self._sanc_match(r)
            self.log(f"Statki: lista sankcji OFAC – {len(self.sanc)} statków z numerem IMO.")
        except Exception as e:
            self.log(f"Statki: nie udało się pobrać listy OFAC ({e}).")
            self.sanc_at = time.time() - 86400 + 3600     # ponów za godzinę

    def _sanc_match(self, rec):
        imo = rec.get("imo")
        hit = self.sanc.get(int(imo)) if imo else None
        if not hit and rec.get("name") and rec["cat"] in ("tanker", "cargo", "other"):
            k = self.sanc_names.get(rec["name"].upper())
            hit = self.sanc.get(k) if k and not imo else None      # sama nazwa – tylko gdy statek nie podaje IMO
        if hit and not rec.get("sanc"):
            rec["sanc"] = {"name": hit[0], "prog": hit[1], "flag": hit[2], "by": "IMO" if imo else "nazwa"}

    def _event(self, rec, kind, msg):
        ev = {"kind": kind, "msg": msg, "at": int(time.time() * 1000), "mmsi": rec["mmsi"], "zone": zone_of(rec["lat"], rec["lon"]) if "lat" in rec else None}
        self.events.append(ev)
        self.log("STATKI: " + msg)

    # ------------------------------------------------ kable podmorskie
    def load_cables(self):
        f = Path(self.file).parent / "cables.json" if self.file else None
        try:
            if f and f.exists() and time.time() - f.stat().st_mtime < 30 * 86400:
                d = json.loads(f.read_text(encoding="utf-8"))
            else:
                req = urllib.request.Request("https://www.submarinecablemap.com/api/v3/cable/cable-geo.json", headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    d = json.loads(r.read())
                if f:
                    f.write_text(json.dumps(d), encoding="utf-8")
            grid, lines, segs, names = {}, [], [], []
            for ft in d.get("features", []):
                name = (ft.get("properties") or {}).get("name") or "?"
                names.append(name)
                g = ft.get("geometry") or {}
                parts = g.get("coordinates") or []
                if g.get("type") == "LineString":
                    parts = [parts]
                for part in parts:
                    pts = [(p[1], p[0]) for p in part if len(p) >= 2]
                    lines.append({"n": name, "c": [[round(p[1], 3), round(p[0], 3)] for p in pts]})
                    # pomijamy ok. 15 km od lądowania kabla – tam statki stoją w portach
                    cum, L = [0.0], 0.0
                    for a, b in zip(pts, pts[1:]):
                        L += math.hypot((b[0] - a[0]) * 111.2, (b[1] - a[1]) * 111.2 * math.cos(math.radians(a[0]))); cum.append(L)
                    for i, (a, b) in enumerate(zip(pts, pts[1:])):
                        if cum[i] < 15 or L - cum[i + 1] < 15:
                            continue
                        si = len(segs); segs.append((a[0], a[1], b[0], b[1], len(names) - 1))
                        for cy in range(int(math.floor(min(a[0], b[0]))), int(math.floor(max(a[0], b[0]))) + 1):
                            for cx in range(int(math.floor(min(a[1], b[1]))), int(math.floor(max(a[1], b[1]))) + 1):
                                grid.setdefault(cy * 1000 + cx, []).append(si)
            self.cables, self.cable_grid, self.cable_segs, self.cable_names, self.cable_at = lines, grid, segs, names, time.time()
            self.log(f"Statki: mapa kabli podmorskich – {len(lines)} odcinków.")
        except Exception as e:
            self.log(f"Statki: nie udało się pobrać mapy kabli ({e}).")
            self.cable_at = time.time() - 30 * 86400 + 3600

    def _near_cable(self, lat, lon):
        best = None
        k = math.cos(math.radians(lat))
        for si in self.cable_grid.get(int(math.floor(lat)) * 1000 + int(math.floor(lon)), []):
            a0, a1, b0, b1, ni = self.cable_segs[si]; name = self.cable_names[ni]
            ax, ay, bx, by, px, py = a1 * k, a0, b1 * k, b0, lon * k, lat
            dx, dy = bx - ax, by - ay
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1e-12)))
            d = math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111.2
            if d < 1.0 and (not best or d < best[1]):
                best = (name, d)
        return best

    # ------------------------------------------------ wykrywanie: ciemne statki, STS, kotwiczenie nad kablem
    def check_watch(self):
        now = time.time()
        W = self.watch
        with self.lock:
            ships = [r for r in self.ships.values() if "lat" in r]
        pairs = {}
        for r in ships:
            age = now - (r.get("upd") or 0)
            z = zone_of(r["lat"], r["lon"])
            cat = r["cat"]
            tr = r["trail"]
            # „ciemny” statek: nadawał regularnie, płynął, w obserwowanym rejonie – i zamilkł
            if z and cat in ("tanker", "cargo", "military", "law", "other") and r.get("src") == "aisstream.io":
                regular = len(tr) >= 9 and tr[-1] - tr[-7] < 2 * 3600
                if age > 5400 and regular and (r.get("sog") or 0) >= 2 and r["mmsi"] not in W["dark"]:
                    W["dark"][r["mmsi"]] = {"since": r.get("upd"), "lat": r["lat"], "lon": r["lon"], "zone": z}
                    self._event(r, "dark", i18n.L(f"Statek przestał nadawać AIS ({round(age / 3600, 1)} h ciszy): {self._label(r)} – {z}. Możliwe wyłączenie nadajnika albo brak zasięgu odbiorników.",
                                                  f"Ship stopped transmitting AIS ({round(age / 3600, 1)} h of silence): {self._label(r)} – {zone_name(z)}. Possibly switched off, or out of receiver range."))
                elif age < 600 and r["mmsi"] in W["dark"]:
                    d0 = W["dark"].pop(r["mmsi"])
                    gap = (now - (d0["since"] or now)) / 3600
                    km = math.hypot((r["lat"] - d0["lat"]) * 111.2, (r["lon"] - d0["lon"]) * 111.2 * math.cos(math.radians(r["lat"])))
                    if gap > 2:
                        self._event(r, "dark_end", i18n.L(f"{self._label(r)} znów nadaje po {gap:.1f} h; przesunął się o {km:.0f} km.",
                                                          f"{self._label(r)} is transmitting again after {gap:.1f} h; moved {km:.0f} km."))
            if age > 1800:
                continue
            slow = (r.get("sog") or 0) < 1.0
            # zbliżenie dwóch tankowców na morzu (możliwy przeładunek STS)
            if slow and cat == "tanker" and z:
                pairs.setdefault((round(r["lat"] * 100), round(r["lon"] * 100)), []).append(r)
            # statek stoi nad kablem podmorskim
            if slow and self.cable_grid and cat not in ("pleasure", "sar", "service", "fishing"):
                nc = self._near_cable(r["lat"], r["lon"])
                if nc:
                    c = W["cable"].get(r["mmsi"])
                    if not c:
                        W["cable"][r["mmsi"]] = {"since": now, "cable": nc[0], "d": round(nc[1], 2), "lat": r["lat"], "lon": r["lon"], "zone": z, "told": False}
                    elif not c["told"] and now - c["since"] > 1800:
                        c["told"] = True
                        self._event(r, "cable", i18n.L(f"{self._label(r)} stoi od ponad 30 min ok. {c['d']} km od kabla {c['cable']}" + (f" – {z}" if z else ""),
                                                       f"{self._label(r)} has been stationary for over 30 min about {c['d']} km from the {c['cable']} cable" + (f" – {zone_name(z)}" if z else "")))
                else:
                    W["cable"].pop(r["mmsi"], None)
            elif r["mmsi"] in W["cable"] and not slow:
                W["cable"].pop(r["mmsi"], None)
        # pary tankowców w promieniu ok. 300 m
        seen = set()
        for (cy, cx), lst in pairs.items():
            cand = list(lst)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy or dx:
                        cand += pairs.get((cy + dy, cx + dx), [])
            for a in lst:
                for b in cand:
                    if a["mmsi"] >= b["mmsi"]:
                        continue
                    k = (a["mmsi"], b["mmsi"])
                    if k in seen:
                        continue
                    d = math.hypot((a["lat"] - b["lat"]) * 111.2, (a["lon"] - b["lon"]) * 111.2 * math.cos(math.radians(a["lat"])))
                    if d < 0.3:
                        seen.add(k)
                        s = W["sts"].get(k)
                        if not s:
                            W["sts"][k] = {"since": now, "a": a["mmsi"], "b": b["mmsi"], "lat": a["lat"], "lon": a["lon"], "zone": zone_of(a["lat"], a["lon"]), "told": False, "d": round(d * 1000)}
                        else:
                            s["seen"] = now
                            if not s["told"] and now - s["since"] > 1800:
                                s["told"] = True
                                self._event(a, "sts", i18n.L(f"Możliwy przeładunek STS: {self._label(a)} i {self._label(b)} stoją {s['d']} m od siebie od ponad 30 min – {s['zone']}",
                                                             f"Possible STS transfer: {self._label(a)} and {self._label(b)} have been {s['d']} m apart for over 30 min – {zone_name(s['zone'])}"))
        for k in [k for k, v in W["sts"].items() if k not in seen and now - v.get("seen", v["since"]) > 3600]:
            del W["sts"][k]
        for k in [k for k, v in W["dark"].items() if now - (v["since"] or now) > 24 * 3600]:
            del W["dark"][k]

    def watch_view(self):
        W, out = self.watch, {}
        def nm(m):
            r = self.ships.get(m) or {}
            return {"mmsi": m, "name": r.get("name") or str(m), "cat": r.get("cat"), "flag": r.get("flag"), "flag_e": REG.FLAGS.get(r.get("flag"), "")}
        with self.lock:
            out["dark"] = [dict(nm(m), since=v["since"] and int(v["since"] * 1000), lat=v["lat"], lon=v["lon"], zone=v["zone"]) for m, v in W["dark"].items()][:40]
            out["sts"] = [dict(a=nm(v["a"]), b=nm(v["b"]), since=int(v["since"] * 1000), lat=v["lat"], lon=v["lon"], zone=v["zone"], d=v["d"], confirmed=v["told"]) for v in W["sts"].values() if time.time() - v["since"] > 600][:40]
            out["cable"] = [dict(nm(m), cable=v["cable"], d=v["d"], since=int(v["since"] * 1000), lat=v["lat"], lon=v["lon"], zone=v["zone"], confirmed=v["told"]) for m, v in W["cable"].items() if time.time() - v["since"] > 600][:40]
            out["sanc"] = [dict(nm(r["mmsi"]), prog=r["sanc"]["prog"], by=r["sanc"]["by"], lat=r["lat"], lon=r["lon"], zone=zone_of(r["lat"], r["lon"]), ts=r.get("ts"))
                           for r in self.ships.values() if r.get("sanc") and "lat" in r][:200]
        return out

    # ------------------------------------------------ pętla: sprzątanie, podsumowanie, zapis
    def build_summary(self):
        zones, hot, cats = {}, [], [0] * len(CATS)
        now = time.time()
        with self.lock:
            items = [r for r in self.ships.values() if "lat" in r]
        for r in items:
            ci = CAT_I.get(r["cat"], 9); cats[ci] += 1
            z = zone_of(r["lat"], r["lon"])
            if z:
                zz = zones.setdefault(z, {"all": 0, "tanker": 0, "cargo": 0, "military": 0, "ru": 0, "foc": 0})
                zz["all"] += 1
                if r["cat"] in ("tanker", "cargo"): zz[r["cat"]] += 1
                if r["cat"] in ("military", "law"): zz["military"] += 1
                if r["cat"] == "tanker" and r["flag"] == "Rosja": zz["ru"] += 1
                if r["cat"] == "tanker" and r["flag"] in REG.FLAGS_OF_CONVENIENCE: zz["foc"] += 1
            if r["cat"] in ("military", "law") and now - r.get("upd", 0) < 3 * 3600:
                hot.append({"mmsi": r["mmsi"], "name": r.get("name"), "cat": r["cat"], "flag": r["flag"], "flag_e": REG.FLAGS.get(r["flag"], ""),
                            "zone": z, "lat": r["lat"], "lon": r["lon"], "ts": r.get("ts")})
        hot.sort(key=lambda h: -(h["ts"] or 0))
        self.summary = {"zones": zones, "hot": hot[:40], "cats": dict(zip(CATS, cats)), "total": len(items), "watch": self.watch_view()}

    def loop(self):
        while True:
            if time.time() - self.sanc_at > 86400:
                threading.Thread(target=self.load_sanctions, daemon=True).start(); self.sanc_at = time.time()
            if time.time() - self.cable_at > 30 * 86400:
                threading.Thread(target=self.load_cables, daemon=True).start(); self.cable_at = time.time()
            try:
                self.check_watch()
            except Exception as e:
                self.log(f"Statki: błąd wykrywania ({e}).")
            if self.use_dt and time.time() - self.last_view < 120:
                self.poll_dt()
            with self.lock:
                now = time.time()
                for k in [k for k, r in self.ships.items() if now - (r.get("upd") or 0) > KEEP_S and not ("lat" not in r and now - self.meta_at < 3600)]:
                    del self.ships[k]
                self.status["aisstream"]["n"] = sum(1 for r in self.ships.values() if r["src"] == "aisstream.io" and "lat" in r)
            self.build_summary()
            if time.time() - self.saved_at > 300:
                self.save()
            self.wake.wait(self.interval); self.wake.clear()

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="live-sea").start()

    # ------------------------------------------------ API
    def snapshot(self, since=0, since_ev=0):
        """Zwięzła lista zmian od `since` (ms czasu serwera): [mmsi, lat, lon, sog, cog, kat, czas_s, nazwa, hdg]."""
        if time.time() - self.last_view > 120:
            self.wake.set()               # terminal właśnie otwarty – pobierz od razu
        self.last_view = time.time()
        now = time.time()
        th = since / 1000 - 2 if since else 0
        with self.lock:
            rows = [[r["mmsi"], r["lat"], r["lon"], r.get("sog"), None if r.get("cog") is None else int(r["cog"]), CAT_I.get(r["cat"], 9),
                     int((r.get("ts") or 0) / 1000), r.get("name") or "", None if r.get("hdg") is None else int(r["hdg"]),
                     (1 if r.get("sanc") else 0) | (2 if r["mmsi"] in self.watch["cable"] else 0) | (4 if r["mmsi"] in self.watch["dark"] else 0)]
                    for r in self.ships.values() if "lat" in r and (r.get("upd") or 0) > th]
            ev = [e for e in self.events if e["at"] > since_ev]
            st = json.loads(json.dumps(self.status))
        return {"now": int(now * 1000), "interval": self.interval, "keep_s": KEEP_S, "full": not since, "status": st, "key": bool(self.key),
                "scope": self.scope, "cats": CATS, "rows": rows, "summary": self.summary, "events": ev}

    def view(self, since=0, since_ev=0, bbox=None, cell=0.0, sel=0, old=False):
        """Statki tylko dla tego, co widać na mapie.
        bbox = (lon0, lat0, lon1, lat1) – obszar z zapasem; poza nim nic nie wysyłamy (lon0 > lon1 = przez linię zmiany daty).
        cell > 0 – widok oddalony: zwykłe statki łączone w kratki cell° × cell° z liczbą na kategorię,
        pojedynczo tylko okręty, straż, SAR, statki z listy obserwacji (sankcje, kable, „ciemne”) i zaznaczony statek."""
        if time.time() - self.last_view > 120:
            self.wake.set()
        self.last_view = time.time()
        now = time.time()
        th = since / 1000 - 2 if since and not cell else 0
        lo0, la0, lo1, la1 = bbox or (-180, -90, 180, 90)
        wrap = lo0 > lo1
        fresh = now - 3600
        nc = len(CATS); grid = {}; rows = []; catn = [0] * nc; total = 0
        keep = {CAT_I["military"], CAT_I["law"], CAT_I["sar"]}
        with self.lock:
            wd, wc = self.watch["dark"], self.watch["cable"]
            for r in self.ships.values():
                if "lat" not in r:
                    continue
                ci = CAT_I.get(r["cat"], 9); total += 1; catn[ci] += 1
                la, lo = r["lat"], r["lon"]; m = r["mmsi"]
                fl = (1 if r.get("sanc") else 0) | (2 if m in wc else 0) | (4 if m in wd else 0)
                if m != sel and not (la0 <= la <= la1 and ((lo >= lo0 or lo <= lo1) if wrap else lo0 <= lo <= lo1)):
                    continue
                ts = (r.get("ts") or 0) / 1000
                if cell and not fl and ci not in keep and m != sel:
                    if ts < fresh and not old:
                        continue
                    key = (int((la + 90) // cell), int((lo + 180) // cell))
                    g = grid.get(key)
                    if g is None:
                        g = grid[key] = [0.0, 0.0] + [0] * nc
                    g[0] += la; g[1] += lo; g[2 + ci] += 1
                    continue
                if (r.get("upd") or 0) <= th:
                    continue
                rows.append([m, la, lo, r.get("sog"), None if r.get("cog") is None else int(r["cog"]), ci, int(ts), r.get("name") or "",
                             None if r.get("hdg") is None else int(r["hdg"]), fl])
            ev = [e for e in self.events if e["at"] > since_ev]
            st = json.loads(json.dumps(self.status))
        cells = []
        for g in grid.values():
            n = sum(g[2:])
            cells.append([round(g[0] / n, 3), round(g[1] / n, 3)] + g[2:])
        return {"now": int(now * 1000), "interval": self.interval, "keep_s": KEEP_S, "full": not th, "status": st, "key": bool(self.key),
                "scope": self.scope, "cats": CATS, "rows": rows, "cells": cells if cell else None, "cell": cell, "catn": catn, "total": total,
                "summary": self.summary, "events": ev}

    def ship(self, mmsi):
        with self.lock:
            r = self.ships.get(mmsi)
            if not r:
                return None
            out = {k: v for k, v in r.items() if k not in ("nav_ev", "trail")}
            tr = list(r["trail"])
        out["trail"] = [[tr[i] / 1e4, tr[i + 1] / 1e4, tr[i + 2] * 1000] for i in range(0, len(tr), 3)]
        out["flag_e"] = REG.FLAGS.get(r["flag"], "")
        out["foc"] = r["flag"] in REG.FLAGS_OF_CONVENIENCE
        out["u"] = LINK.format(mmsi=mmsi)
        out["zone"] = zone_of(r["lat"], r["lon"]) if "lat" in r else None
        out["cable"] = self.watch["cable"].get(mmsi)
        return out
