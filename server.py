#!/usr/bin/env python3
"""KRONOS-7 — lokalny serwer planetarnego systemu wywiadowczego.
Uruchom:  python server.py   (potem przeglądarka: http://127.0.0.1:7707)"""
import atexit, gzip, json, mimetypes, os, re, sys, threading, time, traceback, urllib.parse, webbrowser
mimetypes.add_type("application/manifest+json", ".webmanifest"); mimetypes.add_type("image/svg+xml", ".svg"); mimetypes.add_type("text/javascript", ".js")
from collections import deque
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kronos import analyst, collector, history, i18n, live_air, live_sea, llm, notify, report, satinfo, sats  # noqa: E402

DATA = ROOT / "data"; ARCH = DATA / "archive"; WEB = ROOT / "web"
ARCH.mkdir(parents=True, exist_ok=True)
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
SETTINGS_FILE = DATA / "settings.json"     # ustawienia operatora (poza gitem)
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
CALL_RE = re.compile(r"^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż/_.\- ]{1,20}$")


def load_settings():
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def apply_settings(st):
    CFG["language"] = st.get("language") or CFG.get("language", "pl")
    i18n.set_lang(CFG["language"])
    CFG["operator"] = {"callsign": st.get("callsign", ""), "name": st.get("name", "")}
    if st.get("refresh_times"): CFG["refresh_times"] = st["refresh_times"]
    if st.get("model"): CFG["ai"]["model"] = st["model"]
    if "auto_pull" in st: CFG["ai"]["auto_pull"] = bool(st["auto_pull"])


SETTINGS = load_settings()
apply_settings(SETTINGS)

LOG = deque(maxlen=300)
def log(msg):
    line = f"{datetime.now():%H:%M:%S} {msg}"
    LOG.append(line)
    try: print(line, flush=True)
    except Exception: pass

JOB = {"running": False, "step": "", "pct": 0, "started": None, "finished": None, "error": None}
STATE_LOCK = threading.Lock()
MARKETS = {"at": 0, "data": None}


def load_state():
    for p in (DATA / "state.json", DATA / "seed.json"):     # seed.json: dane startowe z repozytorium
        if p.exists():
            try: return json.loads(p.read_text(encoding="utf-8"))
            except Exception: log(f"{p.name} uszkodzony – pomijam")
    return {}


def save_state(st):
    tmp = DATA / "state.tmp"
    tmp.write_text(json.dumps(st, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, DATA / "state.json")
    name = datetime.now().strftime("%Y-%m-%d_%H%M") + ".json"
    (ARCH / name).write_text(json.dumps(st, ensure_ascii=False), encoding="utf-8")
    files = sorted(ARCH.glob("*.json"))
    for old in files[:-120]:
        old.unlink(missing_ok=True)


STATE = load_state()
ENGINE = llm.Engine(CFG, log)
AIR = live_air.LiveAir(CFG, log)
SEA = live_sea.LiveSea(CFG, log, DATA)
SATS = sats.Catalog(DATA, log)
SATINFO = satinfo.SatInfo(DATA, SATS, log)
HIST = history.History(DATA, log)
NOTIFY = notify.Notifier(log)
NOTIFY.configure(SETTINGS)
EMO = {"air": "✈", "sea": "⚓"}
HIST.on_event = lambda src, e: NOTIFY.send(notify.kind_of(src, e), f"{EMO.get(src, '')} {e.get('msg')}")


def progress(step, pct):
    JOB["step"], JOB["pct"] = step, int(pct)
    log(f"[{int(pct):3d}%] {step}")


def run_refresh():
    global STATE
    if JOB["running"]:
        return False
    def work():
        global STATE
        JOB.update(running=True, started=datetime.now().isoformat(), error=None, pct=0, step="start")
        try:
            ENGINE.refresh()
            st = analyst.Pipeline(CFG, ENGINE, log, progress).run(STATE)
            with STATE_LOCK:
                prev = (STATE.get("threat") or {}).get("level")
                STATE = st
                save_state(st)
            log("Odczyt zapisany.")
            lvl = (st.get("threat") or {}).get("level")
            if prev is not None and lvl is not None and lvl > prev:
                NOTIFY.send("threat", i18n.L(f"⚠ Poziom napięcia wzrósł: {prev} → {lvl} ({(st.get('threat') or {}).get('label', '')}). {(st.get('threat') or {}).get('note', '')}",
                                             f"⚠ Tension level rose: {prev} → {lvl} ({(st.get('threat') or {}).get('label', '')}). {(st.get('threat') or {}).get('note', '')}"))
            if st.get("briefing"):
                NOTIFY.send("briefing", "📋 " + st["briefing"])
        except Exception as e:
            JOB["error"] = str(e)
            log("BŁĄD odświeżania: " + str(e))
            traceback.print_exc()
        finally:
            JOB.update(running=False, finished=datetime.now().isoformat())
    threading.Thread(target=work, daemon=True).start()
    return True


def next_slot(now=None):
    now = now or datetime.now()
    cands = []
    for t in CFG.get("refresh_times", []):
        h, m = map(int, t.split(":"))
        d = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if d <= now: d += timedelta(days=1)
        cands.append(d)
    return min(cands) if cands else None


def ensure_model():
    """Czeka na Ollamę i automatycznie pobiera model dobrany do sprzętu (auto_pull w config.json)."""
    for _ in range(12):
        if ENGINE.backend and ENGINE.backend != "mock":
            break
        if ENGINE.backend == "mock":
            return
        time.sleep(5); ENGINE.refresh()
    st = ENGINE.status()
    if not CFG["ai"].get("auto_pull", True) or st["backend"] != "ollama":
        if not st["backend"]:
            log("Nie wykryto Ollamy ani LM Studio – terminal działa bez analizy AI.")
        return
    name = st["recommended"]
    have = ", ".join(m["name"] for m in st["installed"]) or "brak"
    log(f"Modele w Ollamie: {have}")
    if ENGINE.has_model(name):
        ENGINE.refresh()
        if not ENGINE.model:
            ENGINE.model = name
        log(f"Model {ENGINE.model} jest zainstalowany – nic nie pobieram.")
        return
    if st["model"]:
        # jest już używalny model – nie pobieramy kilku GB przy każdym starcie
        log(f"Używam zainstalowanego modelu {st['model']}. Zalecany {name} możesz pobrać w panelu STATUS SYSTEMU.")
        return
    log(f"Automatyczne pobieranie modelu {name} ({st['recommended_size_gb']} GB) – jednorazowo, może potrwać kilkanaście minut.")
    ENGINE.pull_model(name)
    time.sleep(1)
    JOB.update(running=True, started=datetime.now().isoformat(), error=None)
    try:
        while ENGINE.pull["active"]:
            JOB.update(step=f"pobieranie modelu {name}: {ENGINE.pull['status']}", pct=ENGINE.pull["pct"])
            time.sleep(2)
    finally:
        JOB.update(running=False, step="", pct=0)
    ENGINE.refresh()
    if ENGINE.has_model(name):
        log(f"Model {name} gotowy.")
        return True
    log(f"Nie udało się pobrać {name}: {ENGINE.pull['status']}")


def scheduler():
    done = set()
    time.sleep(3)
    pulled = ensure_model()
    stamp = STATE.get("stamp")
    age = (datetime.now().astimezone() - datetime.fromisoformat(stamp)).total_seconds() / 3600 if stamp else 999
    if age > CFG.get("max_age_hours", 8) or (pulled and not STATE.get("model")):
        log(f"Ostatni odczyt ma {age:.0f} h – odświeżam.")
        run_refresh()
    while True:
        now = datetime.now()
        for t in CFG.get("refresh_times", []):
            key = f"{now:%Y-%m-%d} {t}"
            if now.strftime("%H:%M") == t and key not in done:
                done.add(key); log(f"Zaplanowany briefing {t}"); run_refresh()
        time.sleep(20)


def get_markets(force=False):
    if force or not MARKETS["data"] or time.time() - MARKETS["at"] > 300:
        try:
            MARKETS["data"], MARKETS["at"] = collector.markets(CFG), time.time()
        except Exception as e:
            log("Rynki: " + str(e))
    return MARKETS["data"] or {"items": [], "fetched": None}


def settings_view():
    st = ENGINE.status()
    return {"callsign": CFG["operator"]["callsign"], "name": CFG["operator"]["name"],
            "refresh_times": CFG.get("refresh_times", []), "model": CFG["ai"].get("model", "auto"),
            "auto_pull": CFG["ai"].get("auto_pull", True), "installed": [m["name"] for m in st["installed"]],
            "recommended": st["recommended"], "configured": bool(CFG["operator"]["callsign"]),
            "ais_key": ("…" + SETTINGS["aisstream_key"][-4:]) if SETTINGS.get("aisstream_key") else "",
            "language": CFG.get("language", "pl"), "ais_scope": SETTINGS.get("ais_scope", "world"), "qth": SETTINGS.get("qth"),
            "tg_token": ("…" + SETTINGS["tg_token"][-4:]) if SETTINGS.get("tg_token") else "", "tg_chat": SETTINGS.get("tg_chat", ""),
            "discord": ("…" + SETTINGS["discord"][-6:]) if SETTINGS.get("discord") else "", "notify_kinds": sorted(NOTIFY.cfg.get("kinds", [])),
            "notify_all": {k: v[1 if i18n.en() else 0] for k, v in notify.KINDS.items()}, "notify_err": NOTIFY.last_err,
            "lan": bool(SETTINGS.get("lan")), "lan_pin": bool(SETTINGS.get("lan_pin")), "lan_urls": lan_urls()}


CABLES_GZ = None

# ------------------------------------------------ Stream Deck: kolejka poleceń dla terminala i stan do wyświetlenia na przyciskach
CMDS = deque(maxlen=50)
CMD_CV = threading.Condition()
CMD_N = [0]
UI = {"at": 0}
CMD_OK = {"theater", "layer", "zoom", "replay", "briefing", "sitrep", "stop", "globe", "autozoom", "alert", "event", "sat", "voice", "audio", "ask", "view"}


def push_cmd(do, arg=""):
    if do == "refresh":
        return {"ok": True, "started": run_refresh()}
    if do not in CMD_OK:
        return {"ok": False, "error": "unknown command"}
    with CMD_CV:
        CMD_N[0] += 1
        CMDS.append({"id": CMD_N[0], "do": do, "arg": str(arg)[:200], "at": time.time()})
        CMD_CV.notify_all()
    fresh = time.time() - UI.get("at", 0) < 40
    return {"ok": True, "id": CMD_N[0], "terminal": fresh}


def wait_cmds(after, timeout=25):
    end = time.time() + timeout
    with CMD_CV:
        while True:
            new = [c for c in CMDS if c["id"] > after and time.time() - c["at"] < 30]
            if new or time.time() >= end:
                return {"cmds": new, "last": CMD_N[0]}
            CMD_CV.wait(max(0.1, end - time.time()))


def deck_state():
    now = time.time()
    with AIR.lock:
        ac = [r for r in AIR.ac.values() if now - r.get("upd", 0) < 300]
    aev = list(AIR.events)[-1:] if AIR.events else []
    sev = list(SEA.events)[-1:] if SEA.events else []
    sm = SEA.summary or {}
    w = sm.get("watch") or {}
    cats = sm.get("cats") or {}
    th = STATE.get("threat") or {}
    ns = next_slot()
    pull = ENGINE.pull or {}
    return {"now": int(now * 1000), "lang": "en" if i18n.en() else "pl",
            "threat": {"level": th.get("level"), "label": th.get("label", "")},
            "job": {"running": JOB["running"], "pct": JOB["pct"], "step": JOB["step"], "pull": bool(pull.get("active"))},
            "next": ns.isoformat() if ns else None, "stamp": STATE.get("stamp"),
            "air": {"n": len(ac), "isr": sum(1 for r in ac if r.get("cat") == "isr"), "tanker": sum(1 for r in ac if r.get("cat") == "tanker"),
                    "bomber": sum(1 for r in ac if r.get("cat") == "bomber"), "loiter": sum(1 for r in ac if r.get("loiter")),
                    "ev": aev[0] if aev else None},
            "sea": {"n": sm.get("total", 0), "mil": cats.get("military", 0) + cats.get("law", 0), "sanc": len(w.get("sanc", [])), "dark": len(w.get("dark", [])),
                    "sts": len(w.get("sts", [])), "cable": len(w.get("cable", [])), "ev": sev[0] if sev else None},
            "ui": dict(UI, age=round(now - UI.get("at", 0)))}


def pin_token(pin):
    import hashlib
    return hashlib.sha256(("kronos7:" + pin + ":" + str(DATA.resolve())).encode()).hexdigest()[:24]


PIN_PAGE = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KRONOS-7</title><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#050805">
<style>body{background:#050805;color:#7dff9a;font:16px Consolas,monospace;display:grid;place-items:center;height:100vh;margin:0}
form{display:grid;gap:12px;text-align:center}h1{letter-spacing:.3em;font-size:20px;margin:0}input{background:#000;border:1px solid #7dff9a;color:#7dff9a;font:24px Consolas,monospace;text-align:center;padding:8px;width:180px;letter-spacing:.3em}
button{background:#7dff9a;color:#000;border:0;font:700 15px Consolas,monospace;padding:10px}p{color:#ff6b5b;min-height:1em;margin:0}</style></head>
<body><form id="f"><h1>KRONOS-7</h1><div>{{T}}</div><input id="p" type="password" inputmode="numeric" autocomplete="current-password" autofocus><button>{{B}}</button><p id="e"></p></form>
<script>f.onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:p.value})});
if(r.ok)location.href='/';else{document.getElementById('e').textContent='✕';p.value='';}};</script></body></html>"""


def lan_urls():
    import socket
    port = int(os.environ.get("KRONOS_PORT", CFG.get("port", 7707)))
    ips = set()
    try:
        s0 = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s0.connect(("10.255.255.255", 1)); ips.add(s0.getsockname()[0]); s0.close()
    except Exception:
        pass
    return [f"http://{ip}:{port}" for ip in sorted(ips) if not ip.startswith("127.")]


def parse_qth(txt):
    """Lokator Maidenhead (2–8 znaków) albo „szer, dł” -> {lat, lon, loc}."""
    t = (txt or "").strip()
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$", t)
    if m:
        lat, lon = float(m.group(1)), float(m.group(2))
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return {"lat": lat, "lon": lon, "loc": None}
        return None
    t = t.upper()
    if not re.match(r"^[A-R]{2}(\d{2}([A-X]{2}(\d{2})?)?)?$", t):
        return None
    lon, lat = (ord(t[0]) - 65) * 20 - 180, (ord(t[1]) - 65) * 10 - 90
    w, h = 20.0, 10.0
    if len(t) >= 4: lon += int(t[2]) * 2; lat += int(t[3]); w, h = 2.0, 1.0
    if len(t) >= 6: lon += (ord(t[4]) - 65) * (2 / 24); lat += (ord(t[5]) - 65) * (1 / 24); w, h = 2 / 24, 1 / 24
    if len(t) >= 8: lon += int(t[6]) * (2 / 240); lat += int(t[7]) * (1 / 240); w, h = 2 / 240, 1 / 240
    return {"lat": round(lat + h / 2, 4), "lon": round(lon + w / 2, 4), "loc": t}


def save_settings(body):
    global SETTINGS
    new = dict(SETTINGS)
    if "callsign" in body:
        c = str(body["callsign"]).strip().upper()
        if not CALL_RE.match(c):
            return False, i18n.L("Identyfikator: 1–20 znaków, litery, cyfry oraz / - _ .", "Operator ID: 1–20 characters, letters, digits and / - _ .")
        new["callsign"] = c
    if str(body.get("tg_token") or "").strip():
        new["tg_token"] = str(body["tg_token"]).strip()
    if "tg_chat" in body:
        new["tg_chat"] = str(body["tg_chat"]).strip()[:40]
    if str(body.get("discord") or "").strip():
        d = str(body["discord"]).strip()
        if not re.match(r"^https://(discord(app)?\.com)/api/webhooks/", d):
            return False, i18n.L("Adres webhooka Discord powinien zaczynać się od https://discord.com/api/webhooks/", "A Discord webhook URL should start with https://discord.com/api/webhooks/")
        new["discord"] = d
    for k in ("tg_token", "discord"):
        if body.get("clear_" + k):
            new.pop(k, None)
    if isinstance(body.get("notify_kinds"), list):
        new["notify_kinds"] = [k for k in body["notify_kinds"] if k in notify.KINDS]
    if "lan" in body:
        new["lan"] = bool(body["lan"])
    if "lan_pin" in body:
        pin = str(body["lan_pin"]).strip()
        if pin and not re.match(r"^\d{4,8}$", pin):
            return False, i18n.L("PIN: 4–8 cyfr.", "PIN: 4–8 digits.")
        if pin:
            new["lan_pin"] = pin
        elif body.get("clear_pin"):
            new.pop("lan_pin", None)
    if "qth" in body:
        if not str(body["qth"]).strip():
            new.pop("qth", None)
        else:
            q = parse_qth(body["qth"])
            if not q:
                return False, i18n.L("QTH: wpisz lokator (np. IO91WM) albo współrzędne „51.07, -1.79”.", "QTH: enter a locator (e.g. IO91WM) or coordinates “51.07, -1.79”.")
            new["qth"] = q
    if body.get("ais_scope") in ("world", "zones"):
        new["ais_scope"] = body["ais_scope"]
    if body.get("language") in ("pl", "en"):
        new["language"] = body["language"]
    if "name" in body:
        new["name"] = str(body["name"]).strip()[:40]
    if "refresh_times" in body:
        t = [x for x in body["refresh_times"] if x]
        if len(t) > 4 or not all(TIME_RE.match(x) for x in t):
            return False, i18n.L("Godziny briefingów w formacie GG:MM, najwyżej 4.", "Briefing times as HH:MM, at most 4.")
        new["refresh_times"] = sorted(set(t))
    if "model" in body:
        m = str(body["model"]).strip()
        if m != "auto" and m not in [x["name"] for x in ENGINE.installed] and ENGINE.backend != "lmstudio":
            return False, i18n.L(f"Model {m} nie jest zainstalowany.", f"Model {m} is not installed.")
        new["model"] = m
    if "auto_pull" in body:
        new["auto_pull"] = bool(body["auto_pull"])
    if body.get("ais_clear"):
        new.pop("aisstream_key", None)
    elif str(body.get("aisstream_key") or "").strip():
        k = str(body["aisstream_key"]).strip()
        if not re.match(r"^[A-Za-z0-9_\-]{16,100}$", k):
            return False, i18n.L("Klucz aisstream.io wygląda nieprawidłowo (skopiuj go w całości ze strony aisstream.io).", "The aisstream.io key looks invalid (copy the whole key from aisstream.io).")
        new["aisstream_key"] = k
    SETTINGS = new
    SETTINGS_FILE.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
    apply_settings(new)
    ENGINE._choose()
    if new.get("lan") and not new.get("lan_pin"):
        return False, i18n.L("Dostęp z sieci lokalnej wymaga PIN-u (4–8 cyfr).", "LAN access needs a PIN (4–8 digits).")
    SEA.set_key(new.get("aisstream_key", ""), new.get("ais_scope", "world"))
    NOTIFY.configure(new)
    log(f"Ustawienia zapisane (operator: {new.get('callsign') or '—'}).")
    return True, None


class H(BaseHTTPRequestHandler):
    server_version = "KRONOS7/3"

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
        self.send_response(code)
        if len(b) > 4096 and "gzip" in (self.headers.get("Accept-Encoding") or ""):
            b = gzip.compress(b, 4)
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        try: return json.loads(self.rfile.read(n) or b"{}")
        except ValueError: return {}

    def _stream(self, gen):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            for chunk in gen:
                if chunk:
                    self.wfile.write(chunk.encode("utf-8")); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try: self.wfile.write(f"\n[BŁĄD AI: {e}]".encode())
            except Exception: pass
        finally:
            try: gen.close()
            except Exception: pass

    def _local(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def _authed(self):
        if self._local():
            return True
        pin = SETTINGS.get("lan_pin")
        if not SETTINGS.get("lan") or not pin:
            return False
        ck = self.headers.get("Cookie") or ""
        return ("k7pin=" + pin_token(pin)) in ck

    def _html(self, txt, code=200, extra=None):
        b = txt.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers(); self.wfile.write(b)

    def _gate(self, p):
        """Dostęp z sieci lokalnej (telefon/tablet) tylko po podaniu PIN-u. Komputer, na którym działa KRONOS, wchodzi bez PIN-u."""
        if self._authed():
            return True
        if p in ("/pin", "/api/pin", "/manifest.webmanifest", "/icon.svg"):
            return True
        if p.startswith("/api/"):
            self._json({"error": "pin"}, 401)
        else:
            self.send_response(302); self.send_header("Location", "/pin"); self.end_headers()
        return False

    def do_GET(self):
        p = self.path.split("?")[0]
        if not self._gate(p):
            return
        if p == "/pin":
            return self._html(PIN_PAGE.replace("{{T}}", i18n.L("PODAJ PIN", "ENTER PIN")).replace("{{B}}", i18n.L("WEJDŹ", "ENTER")))
        if p == "/report":
            with STATE_LOCK: st = STATE
            return self._html(report.build(st, HIST, CFG.get("operator", {}).get("callsign") or ""))
        if p == "/api/cables":
            return self._cables()
        if p == "/api/deck":
            return self._json(deck_state())
        if p == "/api/cmd/wait":
            if "init=1" in self.path:
                return self._json({"cmds": [], "last": CMD_N[0]})
            a = int((re.search(r"after=(\d+)", self.path) or [0, 0])[1])
            if a > CMD_N[0]:
                a = 0                                   # serwer uruchomiony ponownie
            return self._json(wait_cmds(a))
        if p == "/api/cmd":                          # GET też działa – wygodne dla prostych wtyczek „Web Request”
            q = urllib.parse.parse_qs(self.path.partition("?")[2])
            return self._json(push_cmd((q.get("do") or [""])[0], (q.get("arg") or [""])[0]))
        if p.startswith("/api/history/"):
            return self._history(p[13:])
        if p == "/api/state":
            with STATE_LOCK:
                st = dict(STATE)
            st["archive"] = [f.stem for f in sorted(ARCH.glob("*.json"))]
            return self._json(st)
        if p == "/api/status":
            ns = next_slot()
            return self._json({"engine": ENGINE.status(), "job": JOB, "log": list(LOG)[-60:], "operator": CFG.get("operator"),
                               "stamp": STATE.get("stamp"), "next": ns.isoformat() if ns else None,
                               "sources": STATE.get("sources_report", [])})
        if p == "/api/settings":
            return self._json(settings_view())
        if p == "/api/air":
            m = re.search(r"since=(\d+)", self.path)
            return self._json(AIR.snapshot(int(m.group(1)) if m else 0))
        if p == "/api/sats/groups":
            ok = SATS.ensure()
            return self._json({"ok": ok, "err": SATS.err, "groups": SATS.list_groups()})
        m = re.match(r"^/api/sats/group/(\w+)$", p)
        if m:
            return self._json({"id": m.group(1), "sats": SATS.group(m.group(1))})
        m = re.match(r"^/api/sats/info/(\d+)$", p)
        if m:
            return self._json(SATINFO.get(int(m.group(1))))
        if p == "/api/sats/search":
            q = urllib.parse.unquote_plus((re.search(r"q=([^&]*)", self.path) or [None, ""])[1])
            return self._json({"results": SATS.search(q)})
        if p == "/api/sats/tle":
            ids = [int(x) for x in re.findall(r"\d+", (re.search(r"ids=([^&]*)", self.path) or [None, ""])[1])][:200]
            return self._json({"sats": SATS.tles(ids)})
        if p == "/api/sea":
            g = lambda k: int((re.search(k + r"=(\d+)", self.path) or [0, 0])[1])
            return self._json(SEA.snapshot(g("since"), g("ev")))
        m = re.match(r"^/api/sea/ship/(\d+)$", p)
        if m:
            r = SEA.ship(int(m.group(1)))
            return self._json(r or {"error": "brak"}, 200 if r else 404)
        if p == "/api/markets":
            return self._json(get_markets("force" in self.path))
        m = re.match(r"^/api/archive/([\w\-]+)$", p)
        if m:
            f = ARCH / (m.group(1) + ".json")
            if f.exists():
                return self._json(json.loads(f.read_text(encoding="utf-8")))
            return self._json({"error": "brak"}, 404)
        # pliki statyczne
        rel = "index.html" if p in ("/", "") else p.lstrip("/")
        f = (WEB / rel).resolve()
        if WEB.resolve() not in f.parents or not f.is_file():
            self.send_error(404); return
        b = f.read_bytes()
        self.send_response(200)
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript") or ctype.endswith("json"):
            ctype += "; charset=utf-8"
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers(); self.wfile.write(b)

    def _cables(self):
        global CABLES_GZ
        if not SEA.cables:
            return self._json({"lines": [], "ready": False})
        if not CABLES_GZ or CABLES_GZ[0] != id(SEA.cables):
            raw = json.dumps({"ready": True, "lines": SEA.cables}, ensure_ascii=False, separators=(",", ":")).encode()
            CABLES_GZ = (id(SEA.cables), gzip.compress(raw, 6), raw)
        gz = "gzip" in (self.headers.get("Accept-Encoding") or "")
        b = CABLES_GZ[1] if gz else CABLES_GZ[2]
        self.send_response(200)
        if gz:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "max-age=3600")
        self.end_headers(); self.wfile.write(b)

    def _history(self, what):
        q = urllib.parse.parse_qs(self.path.partition("?")[2])
        g = lambda k, d=0: (q.get(k) or [d])[0]
        try:
            if what == "range":
                return self._json(HIST.range())
            if what == "frame":
                return self._json(HIST.frame(int(g("t", time.time() * 1000))))
            if what == "track":
                return self._json({"track": HIST.track(g("id", ""), int(g("t", time.time() * 1000)), int(g("min", 30)))})
            if what == "metrics":
                keys = [k for k in str(g("keys", "threat")).split(",") if k][:6]
                days = max(1, min(400, int(g("days", 30))))
                return self._json({"days": days, "series": {k: HIST.series(k, days) for k in keys}})
            if what == "keys":
                en = i18n.en()
                return self._json({"keys": [{"key": k, "label": history.METRIC_LABELS.get(k, (k, k))[1 if en else 0]} for k in HIST.keys()]})
            if what == "events":
                return self._json({"events": HIST.events(int(g("hours", 24)), int(g("limit", 200)))})
        except (ValueError, TypeError) as e:
            return self._json({"error": str(e)}, 400)
        return self._json({"error": "?"}, 404)

    def do_POST(self):
        p = self.path.split("?")[0]
        if not self._gate(p):
            return
        if p == "/api/pin":
            pin = str(self._body().get("pin") or "")
            if SETTINGS.get("lan") and SETTINGS.get("lan_pin") and pin == SETTINGS["lan_pin"]:
                b = b'{"ok":true}'
                self.send_response(200)
                self.send_header("Set-Cookie", f"k7pin={pin_token(pin)}; Path=/; Max-Age=31536000; SameSite=Strict; HttpOnly")
                self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
                self.end_headers(); self.wfile.write(b); return
            time.sleep(1.5)
            return self._json({"ok": False}, 403)
        if p in ("/api/settings", "/api/model/pull", "/api/model/rescan", "/api/notify/test") and not self._local():
            return self._json({"error": i18n.L("Ustawienia można zmieniać tylko na komputerze z KRONOS-em.", "Settings can only be changed on the computer running KRONOS.")}, 403)
        if p == "/api/cmd":
            b = self._body()
            return self._json(push_cmd(str(b.get("do") or ""), b.get("arg") or ""))
        if p == "/api/ui":
            b = self._body()
            UI.update({k: b[k] for k in ("layers", "replay", "autoz", "theater", "mode", "alert", "audio", "pass", "view") if k in b}); UI["at"] = time.time()
            return self._json({"ok": True})
        if p == "/api/notify":
            b = self._body()
            ok = NOTIFY.send(str(b.get("kind") or "pass"), str(b.get("text") or "")[:500])
            return self._json({"ok": ok})
        if p == "/api/notify/test":
            if not NOTIFY.enabled():
                return self._json({"ok": False, "error": i18n.L("Najpierw wpisz token i czat Telegrama albo webhook Discorda i zapisz.", "Enter a Telegram token and chat, or a Discord webhook, and save first.")})
            NOTIFY.send("test", i18n.L("✅ Test powiadomień – działa.", "✅ Notification test – working."), force=True)
            time.sleep(3)
            return self._json({"ok": NOTIFY.last_err is None, "error": NOTIFY.last_err})
        if p == "/api/settings":
            ok, msg = save_settings(self._body())
            return self._json({"ok": ok, "error": msg, "settings": settings_view()}, 200 if ok else 400)
        if p == "/api/refresh":
            return self._json({"started": run_refresh(), "job": JOB})
        if p == "/api/model/pull":
            ENGINE.pull_model(self._body().get("name"))
            return self._json({"ok": True, "pull": ENGINE.pull})
        if p == "/api/model/rescan":
            ENGINE.refresh(); return self._json(ENGINE.status())
        if p == "/api/ask":
            q = (self._body().get("q") or "").strip()[:500]
            with STATE_LOCK: st = STATE
            op = CFG["operator"].get("name") or CFG["operator"].get("callsign") or "operator"
            user = "DANE:\n" + analyst.context_for(st, q, ENGINE.ctx * 2) + f"\n\n" + i18n.L("ZAPYTANIE OPERATORA", "OPERATOR QUERY") + f" ({op}): " + q
            return self._stream(ENGINE.chat_stream(analyst.ASK_SYS, user))
        if p == "/api/sats/explain":
            norad = int(self._body().get("norad") or 0)
            info = SATINFO.get(norad)
            return self._stream(ENGINE.chat_stream(satinfo.EXPLAIN_SYS, "DANE SATELITY:\n" + SATINFO.explain_prompt(info), 0.3))
        if p == "/api/sitrep":
            region = (self._body().get("region") or "").strip()[:120]
            with STATE_LOCK: st = STATE
            user = f"REGION LUB TEMAT: {region}\n\nDANE:\n" + analyst.context_for(st, region, ENGINE.ctx * 2)
            return self._stream(ENGINE.chat_stream(analyst.SITREP_SYS, user, 0.3))
        self.send_error(404)


def main():
    port = int(os.environ.get("KRONOS_PORT", CFG.get("port", 7707)))
    st = ENGINE.status()
    log("KRONOS-7 v3.10 · start")
    log(f"Sprzęt: {st['hardware']['gpu_name']} · VRAM {st['hardware']['vram_gb']} GB · RAM {st['hardware']['ram_gb']} GB")
    log(f"AI: {st['backend'] or 'brak (zainstaluj Ollamę)'} · model: {st['model'] or '—'} · zalecany: {st['recommended']}")
    log(st["reason"])
    host = "0.0.0.0" if SETTINGS.get("lan") and SETTINGS.get("lan_pin") else "127.0.0.1"
    srv = ThreadingHTTPServer((host, port), H)
    if host != "127.0.0.1":
        log(i18n.L("Dostęp z sieci lokalnej (PIN): ", "LAN access (PIN): ") + ", ".join(lan_urls()))
    threading.Thread(target=scheduler, daemon=True).start()
    if CFG.get("live_air", {}).get("enabled", True) and os.environ.get("KRONOS_NO_LIVE") != "1":
        AIR.start(); log(f"Samoloty wojskowe na żywo: co {AIR.interval} s, gdy terminal jest otwarty.")
    if CFG.get("live_sea", {}).get("enabled", True) and os.environ.get("KRONOS_NO_LIVE") != "1":
        SEA.start(); SEA.set_key(SETTINGS.get("aisstream_key", ""), SETTINGS.get("ais_scope", "world")); atexit.register(SEA.save)
        log("Statki na żywo: Digitraffic (Bałtyk, bez klucza)" + (" + aisstream.io (świat)" if SETTINGS.get("aisstream_key") else "; świat po wpisaniu klucza aisstream.io w oknie OPERATOR"))
    HIST.start(AIR, SEA, lambda: STATE, lambda: MARKETS["data"])
    url = f"http://127.0.0.1:{port}"
    log(f"Terminal: {url}")
    if CFG.get("open_browser", True) and os.environ.get("KRONOS_NO_BROWSER") != "1":
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        log("Zamykanie.")


if __name__ == "__main__":
    main()
