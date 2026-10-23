"""Twoje własne odbiorniki (v3.14):
  • ADS-B – plik aircraft.json z readsb / dump1090 / tar1090 (np. http://192.168.1.50/tar1090/data/aircraft.json),
  • AIS – zdania NMEA (!AIVDM) po UDP z AIS-catcher, rtl_ais, dAISy, OpenCPN… (np. port 10110); statki trafiają do warstwy STATKI,
  • APRS – serwery APRS-IS (tylko odbiór, bez hasła), stacje w promieniu od QTH.
Wszystko na bibliotece standardowej Pythona."""
import json, math, re, socket, threading, time, urllib.parse, urllib.request
from collections import deque

from . import i18n


def _now_ms():
    return int(time.time() * 1000)


# ------------------------------------------------ własny odbiornik ADS-B
class LocalADSB:
    def __init__(self, log, settings, mil_hexes=lambda: set()):
        self.log, self.settings, self.mil = log, settings, mil_hexes
        self.status = {"ok": None, "err": None, "at": None, "n": 0, "off": True, "max_nm": 0}
        self.ac = []
        self.range_max = 0.0

    def url(self):
        return (self.settings() or {}).get("adsb_url", "").strip()

    def poll(self):
        u = self.url()
        if not u:
            self.status.update(off=True, ok=None, err=None); self.ac = []; return
        if not re.match(r"^https?://", u):
            u = "http://" + u
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "KRONOS-7"}), timeout=8) as r:
            d = json.loads(r.read())
        now = d.get("now") or time.time()
        mil = self.mil()
        out = []
        for a in d.get("aircraft", []):
            lat, lon = a.get("lat"), a.get("lon")
            if lat is None or lon is None or (a.get("seen_pos") or 0) > 60:
                continue
            alt = a.get("alt_baro") if isinstance(a.get("alt_baro"), (int, float)) else a.get("alt_geom")
            hx = (a.get("hex") or "").lower().lstrip("~")
            out.append({"hex": hx, "cs": (a.get("flight") or "").strip(), "lat": round(lat, 4), "lon": round(lon, 4), "alt": alt if alt != "ground" else 0,
                        "gs": a.get("gs"), "trk": a.get("track"), "sq": a.get("squawk"), "t": a.get("t") or a.get("type") or "", "r": a.get("r") or "",
                        "rssi": a.get("rssi"), "mil": hx in mil or bool((a.get("dbFlags") or 0) & 1), "ts": int((now - (a.get("seen_pos") or 0)) * 1000),
                        "emerg": a.get("emergency") not in (None, "none")})
        self.ac = out
        q = (self.settings() or {}).get("_qth")
        if q:
            for a in out:
                d_nm = _dist_km(q["lat"], q["lon"], a["lat"], a["lon"]) / 1.852
                self.range_max = max(self.range_max, d_nm)
        self.status.update(ok=True, err=None, at=_now_ms(), n=len(out), off=False, max_nm=round(self.range_max))

    def loop(self):
        while True:
            try:
                self.poll()
            except Exception as e:
                self.status.update(ok=False, err=str(e)[:160], at=_now_ms(), off=False)
            time.sleep(3 if self.url() else 20)

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="sdr-adsb").start()


def _dist_km(la1, lo1, la2, lo2):
    a = math.sin(math.radians(la2 - la1) / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(a)))


# ------------------------------------------------ AIS z NMEA (AIVDM/AIVDO)
def _bits(payload, fill=0):
    out = []
    for ch in payload:
        v = ord(ch) - 48
        if v > 40:
            v -= 8
        out.append(format(v & 0x3F, "06b"))
    b = "".join(out)
    return b[:len(b) - fill] if fill else b


def _u(b, s, n):
    x = b[s:s + n]
    return int(x, 2) if x else 0


def _i(b, s, n):
    v = _u(b, s, n)
    return v - (1 << n) if x_sign(b, s) else v


def x_sign(b, s):
    return b[s:s + 1] == "1"


def _txt6(b, s, n):
    chars = []
    for k in range(s, s + n, 6):
        if k + 6 > len(b):
            break
        v = int(b[k:k + 6], 2)
        chars.append(chr(v + 64) if v < 32 else chr(v))
    return "".join(chars).replace("@", "").strip()


def decode_ais(bits):
    """Zwraca słownik z polami albo None. Obsługiwane typy: 1, 2, 3, 5, 18, 19, 24."""
    if len(bits) < 38:
        return None
    t = _u(bits, 0, 6); mmsi = _u(bits, 8, 30)
    if t in (1, 2, 3) and len(bits) >= 137:
        lon = _i(bits, 61, 28) / 600000; lat = _i(bits, 89, 27) / 600000
        sog = _u(bits, 50, 10); cog = _u(bits, 116, 12); hdg = _u(bits, 128, 9)
        return {"t": t, "mmsi": mmsi, "nav": _u(bits, 38, 4), "sog": None if sog == 1023 else sog / 10, "lon": lon, "lat": lat,
                "cog": None if cog >= 3600 else cog / 10, "hdg": None if hdg >= 360 else hdg}
    if t in (18, 19) and len(bits) >= 133:
        lon = _i(bits, 57, 28) / 600000; lat = _i(bits, 85, 27) / 600000
        sog = _u(bits, 46, 10); cog = _u(bits, 112, 12); hdg = _u(bits, 124, 9)
        r = {"t": t, "mmsi": mmsi, "sog": None if sog == 1023 else sog / 10, "lon": lon, "lat": lat, "cog": None if cog >= 3600 else cog / 10, "hdg": None if hdg >= 360 else hdg}
        if t == 19 and len(bits) >= 271:
            r.update(name=_txt6(bits, 143, 120), type=_u(bits, 263, 8))
        return r
    if t == 5 and len(bits) >= 420:
        return {"t": 5, "mmsi": mmsi, "imo": _u(bits, 40, 30) or None, "cs": _txt6(bits, 70, 42), "name": _txt6(bits, 112, 120), "type": _u(bits, 232, 8),
                "length": (_u(bits, 240, 9) + _u(bits, 249, 9)) or None, "width": (_u(bits, 258, 6) + _u(bits, 264, 6)) or None,
                "draught": (_u(bits, 294, 8) / 10) or None, "dest": _txt6(bits, 302, 120)}
    if t == 24 and len(bits) >= 160:
        part = _u(bits, 38, 2)
        if part == 0:
            return {"t": 24, "mmsi": mmsi, "name": _txt6(bits, 40, 120)}
        if len(bits) >= 132:
            return {"t": 24, "mmsi": mmsi, "type": _u(bits, 40, 8), "cs": _txt6(bits, 90, 42)}
    return None


class NMEAAssembler:
    def __init__(self):
        self.parts = {}

    def feed(self, line):
        line = line.strip()
        i = line.find("!AIVD")
        if i < 0:
            i = line.find("!BSVD")
        if i < 0:
            return None
        line = line[i:].split("*")[0]
        f = line.split(",")
        if len(f) < 7:
            return None
        try:
            total, num = int(f[1]), int(f[2]); seq = f[3]; payload = f[5]; fill = int(f[6] or 0)
        except ValueError:
            return None
        if total == 1:
            return decode_ais(_bits(payload, fill))
        key = (seq, f[4])
        self.parts.setdefault(key, {})[num] = (payload, fill)
        got = self.parts[key]
        if len(got) == total:
            del self.parts[key]
            pl = "".join(got[k][0] for k in range(1, total + 1))
            return decode_ais(_bits(pl, got[total][1]))
        if len(self.parts) > 50:
            self.parts.clear()
        return None


class LocalAIS:
    SRC = "własny odbiornik AIS"

    def __init__(self, log, settings, sea):
        self.log, self.settings, self.sea = log, settings, sea
        self.status = {"ok": None, "err": None, "at": None, "n": 0, "off": True, "msgs": 0, "port": None}
        self.mmsi = {}
        self.asm = NMEAAssembler()

    def port(self):
        try:
            p = int((self.settings() or {}).get("ais_port") or 0)
            return p if 1024 <= p <= 65535 else 0
        except (TypeError, ValueError):
            return 0

    def handle(self, line):
        m = self.asm.feed(line)
        if not m or not self.sea:
            return
        now = time.time() * 1000
        with self.sea.lock:
            if m["t"] in (5, 24) or m.get("name"):
                kw = {k: m.get(k) for k in ("name", "type", "cs", "imo", "dest", "draught", "length", "width") if m.get(k) not in (None, "")}
                rec = self.sea._upd(m["mmsi"], self.SRC, **kw)
            else:
                rec = self.sea._upd(m["mmsi"], self.SRC)
            if rec is not None:
                rec["local"] = int(now)
            if "lat" in m and abs(m["lat"]) <= 90 and abs(m["lon"]) <= 180:
                self.sea._pos(rec, m["lat"], m["lon"], now, m.get("sog"), m.get("cog"), m.get("hdg"), m.get("nav"))
        self.mmsi[m["mmsi"]] = now
        self.status["msgs"] += 1

    def loop(self):
        while True:
            p = self.port()
            if not p:
                self.status.update(off=True, ok=None, err=None); time.sleep(15); continue
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(("0.0.0.0", p)); s.settimeout(5)
                self.status.update(off=False, ok=True, err=None, port=p)
                self.log(i18n.L(f"AIS: nasłuch NMEA na porcie UDP {p}.", f"AIS: listening for NMEA on UDP port {p}."))
                while self.port() == p:
                    try:
                        data, _ = s.recvfrom(65535)
                    except socket.timeout:
                        self._stat(); continue
                    for line in data.decode("ascii", "ignore").splitlines():
                        try:
                            self.handle(line)
                        except Exception:
                            pass
                    self._stat()
                s.close()
            except Exception as e:
                self.status.update(ok=False, err=str(e)[:160], at=_now_ms(), off=False); time.sleep(20)

    def _stat(self):
        cut = time.time() * 1000 - 3600e3
        for k in [k for k, v in self.mmsi.items() if v < cut]:
            del self.mmsi[k]
        self.status.update(n=len(self.mmsi), at=_now_ms())

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="sdr-ais").start()


# ------------------------------------------------ APRS-IS
APRS_SYM = {"/>": "car", "/k": "truck", "/-": "house", "/_": "wx", "/#": "digi", "/&": "igate", "/[": "person", "/b": "bike", "/Y": "boat",
            "/s": "ship", "/^": "aircraft", "/'": "aircraft", "/O": "balloon", "/v": "van", "/j": "jeep", "/r": "repeater", "/y": "yagi"}
POS_UNC = re.compile(r"(\d{2})(\d{2}\.\d{2})([NS])(.)(\d{3})(\d{2}\.\d{2})([EW])(.)")


def _mice(dest, info):
    """Dekoduje pozycję Mic-E (najczęstszy format w radiach samochodowych i ręcznych)."""
    if len(dest) < 6 or len(info) < 9:
        return None
    d = dest[:6]; digs = []
    for c in d:
        if c.isdigit():
            digs.append(int(c))
        elif "A" <= c <= "J":
            digs.append(ord(c) - 65)
        elif "P" <= c <= "Y":
            digs.append(ord(c) - 80)
        elif c in "KLZ":
            digs.append(0)
        else:
            return None
    lat = digs[0] * 10 + digs[1] + (digs[2] * 10 + digs[3] + (digs[4] * 10 + digs[5]) / 100) / 60
    if not ("P" <= d[3] <= "Z"):
        lat = -lat
    lon_off = 100 if "P" <= d[4] <= "Z" else 0
    west = "P" <= d[5] <= "Z"
    lo_d = ord(info[1]) - 28 + lon_off
    if 180 <= lo_d <= 189:
        lo_d -= 80
    elif 190 <= lo_d <= 199:
        lo_d -= 190
    lo_m = ord(info[2]) - 28
    if lo_m >= 60:
        lo_m -= 60
    lo_h = ord(info[3]) - 28
    lon = lo_d + (lo_m + lo_h / 100) / 60
    if west:
        lon = -lon
    sp = (ord(info[4]) - 28) * 10 + (ord(info[5]) - 28) // 10
    if sp >= 800:
        sp -= 800
    co = ((ord(info[5]) - 28) % 10) * 100 + ord(info[6]) - 28
    if co >= 400:
        co -= 400
    return lat, lon, info[8] + info[7], sp * 1.852, co


def parse_aprs(line):
    if not line or line.startswith("#") or ":" not in line or ">" not in line:
        return None
    head, info = line.split(":", 1)
    src = head.split(">")[0]
    path = head.split(">", 1)[1].split(",")
    dest = path[0]
    if not info:
        return None
    dt = info[0]
    r = {"call": src, "raw": info[:120]}
    if dt in "`'":
        m = _mice(dest, info)
        if not m:
            return None
        r.update(lat=m[0], lon=m[1], sym=m[2], spd=round(m[3]), crs=m[4], cmt=info[9:60].strip())
        return r
    if dt in "!=/@":
        body = info[1:] if dt in "!=" else info[8:]
        m = POS_UNC.match(body)
        if m:
            lat = int(m.group(1)) + float(m.group(2)) / 60; lon = int(m.group(5)) + float(m.group(6)) / 60
            r.update(lat=-lat if m.group(3) == "S" else lat, lon=-lon if m.group(7) == "W" else lon, sym=m.group(4) + m.group(8), cmt=body[19:80].strip())
            return r
        if len(body) >= 13 and body[0] in "/\\ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij":     # pozycja skompresowana
            try:
                y = sum((ord(c) - 33) * 91 ** (3 - i) for i, c in enumerate(body[1:5])); x = sum((ord(c) - 33) * 91 ** (3 - i) for i, c in enumerate(body[5:9]))
                r.update(lat=90 - y / 380926, lon=-180 + x / 190463, sym=body[0] + body[9], cmt=body[13:70].strip())
                return r
            except Exception:
                return None
    if dt == ";" and len(info) > 18:          # obiekt
        m = POS_UNC.match(info[18:])
        if m:
            lat = int(m.group(1)) + float(m.group(2)) / 60; lon = int(m.group(5)) + float(m.group(6)) / 60
            r.update(call=info[1:10].strip(), lat=-lat if m.group(3) == "S" else lat, lon=-lon if m.group(7) == "W" else lon, sym=m.group(4) + m.group(8), obj=True)
            return r
    return None


class APRS:
    def __init__(self, log, settings):
        self.log, self.settings = log, settings
        self.st = {}
        self.status = {"ok": None, "err": None, "at": None, "n": 0, "off": True, "server": None}

    def cfg(self):
        c = self.settings() or {}
        q = c.get("_qth") or {}
        return bool(c.get("aprs_on")) and q.get("lat") is not None, q, max(10, min(500, int(c.get("aprs_km") or 150))), c.get("_call") or "N0CALL"

    def loop(self):
        while True:
            on, q, km, call = self.cfg()
            if not on:
                self.status.update(off=True, ok=None, err=None); time.sleep(15); continue
            try:
                s = socket.create_connection(("rotate.aprs2.net", 14580), timeout=30)
                s.settimeout(90)
                user = re.sub(r"[^A-Z0-9-]", "", call.upper())[:9] or "N0CALL"
                s.sendall(f"user {user} pass -1 vers KRONOS-7 3.22.1 filter r/{q['lat']:.3f}/{q['lon']:.3f}/{km}\r\n".encode())
                self.status.update(off=False, ok=True, err=None, server="rotate.aprs2.net")
                self.log(i18n.L(f"APRS: połączono z APRS-IS (promień {km} km).", f"APRS: connected to APRS-IS (radius {km} km)."))
                buf = b""; cfg0 = (on, q.get("lat"), q.get("lon"), km)
                while True:
                    data = s.recv(8192)
                    if not data:
                        raise ConnectionError("serwer zamknął połączenie")
                    buf += data
                    while b"\n" in buf:
                        ln, buf = buf.split(b"\n", 1)
                        p = parse_aprs(ln.decode("latin-1").strip())
                        if p and p.get("lat") is not None:
                            p["t"] = _now_ms(); p["lat"] = round(p["lat"], 4); p["lon"] = round(p["lon"], 4)
                            p["kind"] = APRS_SYM.get(p.get("sym", "")[:2], "other")
                            old = self.st.get(p["call"])
                            p["trail"] = ((old or {}).get("trail") or [])[-15:]
                            if old and (abs(old["lat"] - p["lat"]) + abs(old["lon"] - p["lon"]) > .0005):
                                p["trail"].append([old["lat"], old["lon"]])
                            self.st[p["call"]] = p
                    cut = _now_ms() - 2 * 3600e3
                    for k in [k for k, v in self.st.items() if v["t"] < cut]:
                        del self.st[k]
                    self.status.update(n=len(self.st), at=_now_ms())
                    c2 = self.cfg()
                    if (c2[0], c2[1].get("lat"), c2[1].get("lon"), c2[2]) != cfg0:
                        break
                s.close()
            except Exception as e:
                self.status.update(ok=False, err=str(e)[:160], at=_now_ms(), off=False); time.sleep(60)

    def view(self):
        return sorted(self.st.values(), key=lambda p: -p["t"])[:600]

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="sdr-aprs").start()


# ------------------------------------------------ dodatkowe darmowe strumienie AIS (TCP, NMEA) i AISHub
AIS_TCP_DEFAULT = {"kystverket": ("153.44.253.27", 5631, "Kystverket (Norwegia)")}


class AISTcp:
    """Klient strumieni NMEA po TCP: domyślnie publiczny strumień norweskiej administracji morskiej (Kystverket, bez klucza),
    plus dowolne własne (np. serwer TCP w AIS-catcher: -S 5012)."""
    def __init__(self, log, settings, sea):
        self.log, self.settings, self.sea = log, settings, sea
        self.status = {}
        self.threads = {}

    def feeds(self):
        c = self.settings() or {}
        out = {}
        if c.get("kystverket", True) not in (False, "0", "false"):
            out["kystverket"] = AIS_TCP_DEFAULT["kystverket"]
        for x in str(c.get("ais_tcp") or "").split(","):
            m = re.match(r"^\s*([\w.\-]+):(\d{2,5})\s*$", x)
            if m:
                out[f"{m.group(1)}:{m.group(2)}"] = (m.group(1), int(m.group(2)), f"TCP {m.group(1)}:{m.group(2)}")
        return out

    def run(self, key):
        asm = NMEAAssembler(); seen = {}
        while key in self.feeds():
            host, port, name = self.feeds()[key]
            st = self.status.setdefault(key, {"name": name, "ok": None, "err": None, "n": 0, "msgs": 0, "off": False})
            try:
                s = socket.create_connection((host, port), timeout=30); s.settimeout(120)
                st.update(ok=True, err=None)
                self.log(i18n.L(f"AIS: połączono ze strumieniem {name}.", f"AIS: connected to stream {name}."))
                buf = b""
                while key in self.feeds():
                    data = s.recv(65536)
                    if not data:
                        raise ConnectionError("koniec strumienia")
                    buf += data
                    lines = buf.split(b"\n"); buf = lines.pop()
                    now = time.time() * 1000
                    for ln in lines:
                        m = asm.feed(ln.decode("ascii", "ignore"))
                        if not m or not self.sea:
                            continue
                        with self.sea.lock:
                            kw = {k: m.get(k) for k in ("name", "type", "cs", "imo", "dest", "draught", "length", "width") if m.get(k) not in (None, "")}
                            rec = self.sea._upd(m["mmsi"], name, **kw)
                            if "lat" in m and abs(m["lat"]) <= 90 and abs(m["lon"]) <= 180:
                                self.sea._pos(rec, m["lat"], m["lon"], now, m.get("sog"), m.get("cog"), m.get("hdg"), m.get("nav"))
                        seen[m["mmsi"]] = now; st["msgs"] += 1
                    if len(seen) > 50000 or st["msgs"] % 500 == 0:
                        cut = now - 3600e3
                        for k2 in [k2 for k2, v in seen.items() if v < cut]:
                            del seen[k2]
                    st.update(n=len(seen), at=_now_ms())
                s.close()
            except Exception as e:
                st.update(ok=False, err=str(e)[:160], at=_now_ms()); time.sleep(60)
        self.threads.pop(key, None)

    def loop(self):
        while True:
            for k in self.feeds():
                if k not in self.threads:
                    t = threading.Thread(target=self.run, args=(k,), daemon=True, name="ais-tcp-" + k); self.threads[k] = t; t.start()
            for k in list(self.status):
                if k not in self.feeds():
                    self.status.pop(k, None)
            time.sleep(20)

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="ais-tcp").start()


class AISHub:
    """AISHub: wymiana danych AIS – kto udostępnia własny odbiornik, dostaje dostęp do całej sieci (nazwa użytkownika = klucz API)."""
    def __init__(self, log, settings, sea):
        self.log, self.settings, self.sea = log, settings, sea
        self.status = {"ok": None, "err": None, "at": None, "n": 0, "off": True}

    def loop(self):
        time.sleep(30)
        while True:
            u = ((self.settings() or {}).get("aishub_user") or "").strip()
            if not u:
                self.status.update(off=True, ok=None, err=None); time.sleep(30); continue
            try:
                with urllib.request.urlopen(f"http://data.aishub.net/ws.php?username={urllib.parse.quote(u)}&format=1&output=json&compress=0", timeout=60) as r:
                    d = json.loads(r.read())
                head = d[0] if isinstance(d, list) and d else {}
                if head.get("ERROR"):
                    raise RuntimeError(head.get("ERROR_MESSAGE") or "AISHub: błąd")
                rows = d[1] if len(d) > 1 else []
                now = time.time() * 1000; n = 0
                with self.sea.lock:
                    for x in rows:
                        mmsi = x.get("MMSI")
                        if not mmsi:
                            continue
                        kw = {"name": (x.get("NAME") or "").strip(), "type": x.get("TYPE") or None, "cs": (x.get("CALLSIGN") or "").strip(),
                              "imo": x.get("IMO") or None, "dest": (x.get("DEST") or "").strip()}
                        rec = self.sea._upd(mmsi, "AISHub", **kw)
                        try:
                            import calendar
                            ts = calendar.timegm(time.strptime(str(x.get("TIME", ""))[:19], "%Y-%m-%d %H:%M:%S")) * 1000
                        except Exception:
                            ts = now
                        self.sea._pos(rec, x.get("LATITUDE"), x.get("LONGITUDE"), min(ts, now), x.get("SOG"),
                                      x.get("COG") if (x.get("COG") or 0) < 360 else None, x.get("HEADING") if (x.get("HEADING") or 511) < 360 else None, x.get("NAVSTAT"))
                        n += 1
                self.status.update(ok=True, err=None, at=_now_ms(), n=n, off=False)
            except Exception as e:
                self.status.update(ok=False, err=str(e)[:160], at=_now_ms(), off=False)
            time.sleep(70)          # AISHub pozwala na 1 zapytanie na minutę

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="aishub").start()
