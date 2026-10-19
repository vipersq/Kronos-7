#!/usr/bin/env python3
"""KRONOS-7 — lokalny serwer planetarnego systemu wywiadowczego.
Uruchom:  python server.py   (potem przeglądarka: http://127.0.0.1:7707)"""
import json, mimetypes, os, re, sys, threading, time, traceback, urllib.parse, webbrowser
from collections import deque
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kronos import analyst, collector, live_air, live_sea, llm, sats  # noqa: E402

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
SEA = live_sea.LiveSea(CFG, log)
SATS = sats.Catalog(DATA, log)


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
                STATE = st
                save_state(st)
            log("Odczyt zapisany.")
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
            "ais_key": ("…" + SETTINGS["aisstream_key"][-4:]) if SETTINGS.get("aisstream_key") else ""}


def save_settings(body):
    global SETTINGS
    new = dict(SETTINGS)
    if "callsign" in body:
        c = str(body["callsign"]).strip().upper()
        if not CALL_RE.match(c):
            return False, "Identyfikator: 1–20 znaków, litery, cyfry oraz / - _ ."
        new["callsign"] = c
    if "name" in body:
        new["name"] = str(body["name"]).strip()[:40]
    if "refresh_times" in body:
        t = [x for x in body["refresh_times"] if x]
        if len(t) > 4 or not all(TIME_RE.match(x) for x in t):
            return False, "Godziny briefingów w formacie GG:MM, najwyżej 4."
        new["refresh_times"] = sorted(set(t))
    if "model" in body:
        m = str(body["model"]).strip()
        if m != "auto" and m not in [x["name"] for x in ENGINE.installed] and ENGINE.backend != "lmstudio":
            return False, f"Model {m} nie jest zainstalowany."
        new["model"] = m
    if "auto_pull" in body:
        new["auto_pull"] = bool(body["auto_pull"])
    if body.get("ais_clear"):
        new.pop("aisstream_key", None)
    elif str(body.get("aisstream_key") or "").strip():
        k = str(body["aisstream_key"]).strip()
        if not re.match(r"^[A-Za-z0-9_\-]{16,100}$", k):
            return False, "Klucz aisstream.io wygląda nieprawidłowo (skopiuj go w całości ze strony aisstream.io)."
        new["aisstream_key"] = k
    SETTINGS = new
    SETTINGS_FILE.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
    apply_settings(new)
    ENGINE._choose()
    SEA.set_key(new.get("aisstream_key", ""))
    log(f"Ustawienia zapisane (operator: {new.get('callsign') or '—'}).")
    return True, None


class H(BaseHTTPRequestHandler):
    server_version = "KRONOS7/3"

    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
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

    def do_GET(self):
        p = self.path.split("?")[0]
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
        if p == "/api/sats/search":
            q = urllib.parse.unquote_plus((re.search(r"q=([^&]*)", self.path) or [None, ""])[1])
            return self._json({"results": SATS.search(q)})
        if p == "/api/sats/tle":
            ids = [int(x) for x in re.findall(r"\d+", (re.search(r"ids=([^&]*)", self.path) or [None, ""])[1])][:200]
            return self._json({"sats": SATS.tles(ids)})
        if p == "/api/sea":
            m = re.search(r"since=(\d+)", self.path)
            return self._json(SEA.snapshot(int(m.group(1)) if m else 0))
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

    def do_POST(self):
        p = self.path.split("?")[0]
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
            user = "DANE:\n" + analyst.context_for(st, q, ENGINE.ctx * 2) + f"\n\nZAPYTANIE OPERATORA ({op}): " + q
            return self._stream(ENGINE.chat_stream(analyst.ASK_SYS, user))
        if p == "/api/sitrep":
            region = (self._body().get("region") or "").strip()[:120]
            with STATE_LOCK: st = STATE
            user = f"REGION LUB TEMAT: {region}\n\nDANE:\n" + analyst.context_for(st, region, ENGINE.ctx * 2)
            return self._stream(ENGINE.chat_stream(analyst.SITREP_SYS, user, 0.3))
        self.send_error(404)


def main():
    port = int(os.environ.get("KRONOS_PORT", CFG.get("port", 7707)))
    st = ENGINE.status()
    log("KRONOS-7 v3.6 · start")
    log(f"Sprzęt: {st['hardware']['gpu_name']} · VRAM {st['hardware']['vram_gb']} GB · RAM {st['hardware']['ram_gb']} GB")
    log(f"AI: {st['backend'] or 'brak (zainstaluj Ollamę)'} · model: {st['model'] or '—'} · zalecany: {st['recommended']}")
    log(st["reason"])
    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    threading.Thread(target=scheduler, daemon=True).start()
    if CFG.get("live_air", {}).get("enabled", True) and os.environ.get("KRONOS_NO_LIVE") != "1":
        AIR.start(); log(f"Samoloty wojskowe na żywo: co {AIR.interval} s, gdy terminal jest otwarty.")
    if CFG.get("live_sea", {}).get("enabled", True) and os.environ.get("KRONOS_NO_LIVE") != "1":
        SEA.start(); SEA.set_key(SETTINGS.get("aisstream_key", ""))
        log("Statki na żywo: Digitraffic (Bałtyk, bez klucza)" + (" + aisstream.io (świat)" if SETTINGS.get("aisstream_key") else "; świat po wpisaniu klucza aisstream.io w oknie OPERATOR"))
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
