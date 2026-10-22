#!/usr/bin/env python3
"""KRONOS-7 — lokalny serwer planetarnego systemu wywiadowczego.
Uruchom:  python server.py   (potem przeglądarka: http://127.0.0.1:7707)"""
import atexit, gzip, json, mimetypes, os, re, sys, threading, time, traceback, urllib.error, urllib.parse, webbrowser
mimetypes.add_type("application/manifest+json", ".webmanifest"); mimetypes.add_type("image/svg+xml", ".svg"); mimetypes.add_type("text/javascript", ".js")
from collections import deque
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kronos import analyst, collector, history, i18n, live_air, live_sea, llm, marsec, notify, report, satinfo, sats, tts, intel, sdr, mailin, tiles, vgraph, correlate  # noqa: E402

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
CLOUD = llm.Cloud(lambda: SETTINGS.get("cloud") or {}, log)          # v3.17: AI w chmurze z powrotem na lokalny model
AI_MAIN, AI_ASK, AI_BG = (llm.Router(ENGINE, CLOUD, r) for r in ("main", "ask", "bg"))
AIR = live_air.LiveAir(CFG, log)
SEA = live_sea.LiveSea(CFG, log, DATA)
SATS = sats.Catalog(DATA, log)
SATINFO = satinfo.SatInfo(DATA, SATS, log)
HIST = history.History(DATA, log)
MARSEC = marsec.MarSec(DATA, log)


# ------------------------------------------------ integracje (v3.14): klucze, odbiorniki SDR, poczta, Home Assistant
def intg_cfg():
    c = dict(SETTINGS.get("intg") or {})
    q = SETTINGS.get("qth")
    c["_qth"] = q if q and q.get("lat") is not None else {"lat": 51.07, "lon": -1.79}
    c["_call"] = CFG["operator"].get("callsign") or ""
    return c


UAALERT = intel.AirAlerts(log, intg_cfg)
DEEPST = intel.DeepState(log, intg_cfg)
NOTAMS = intel.Notams(log, intg_cfg)
DARKSAR = intel.DarkSAR(log, intg_cfg)
TGOSINT = intel.TgOsint(log, intg_cfg, DATA)
SATIMG = intel.SatImg()
TILES = tiles.TileCache(DATA, log, intg_cfg)
RADIATION = intel.Radiation(log, intg_cfg, DATA)      # v3.17: promieniowanie (Safecast)
ACLED = intel.Acled(log, intg_cfg)                     # v3.17: zdarzenia konfliktowe ACLED
VGRAPH = vgraph.VGraph(DATA, log)                     # v3.17: statek – właściciel – zarządca – bandera – sankcje
VGRAPH.on_load = lambda g: SEA.merge_sanctions(*g.sanctioned())
LADSB = sdr.LocalADSB(log, intg_cfg, lambda: set(AIR.ac.keys()))
LAIS = sdr.LocalAIS(log, intg_cfg, SEA)
APRSIS = sdr.APRS(log, intg_cfg)
AISTCP = sdr.AISTcp(log, intg_cfg, SEA)
AISHUB = sdr.AISHub(log, intg_cfg, SEA)
MAILIN = mailin.MailIn(DATA, log, intg_cfg, MARSEC)
INTG_SECRET = ("alerts_token", "gfw_token", "faa_secret", "imap_pass", "acled_pass")
INTG_KEYS = {"alerts_token": 200, "gfw_token": 2000, "faa_id": 200, "faa_secret": 200, "notam_locs": 400, "tg_channels": 4000, "adsb_url": 300, "ais_port": 6,
             "aprs_on": 0, "aprs_km": 4, "ha_webhook": 400, "imap_host": 120, "imap_port": 5, "imap_user": 200, "imap_pass": 200, "imap_folder": 120,
             "imap_senders": 400, "imap_days": 3, "ua_watch": 400, "kystverket": 0, "ais_tcp": 300, "aishub_user": 80, "stadia_key": 80,
             "acled_user": 200, "acled_pass": 200, "acled_days": 3}


def intg_view():
    c = SETTINGS.get("intg") or {}
    out = {}
    for k in INTG_KEYS:
        v = c.get(k)
        if k in INTG_SECRET:
            out[k] = ("…" + str(v)[-4:]) if v else ""
        elif k in ("notam_locs", "tg_channels"):
            out[k] = ", ".join(v) if isinstance(v, list) else (v or "")
        else:
            out[k] = (v if v is not None else True) if k == "kystverket" else (v if v is not None else "")
    out["defaults"] = {"notam_locs": ", ".join(intel.NOTAM_LOCS), "tg_channels": ", ".join(intel.TG_ON)}
    out["tg_catalog"] = [{"ch": c[0], "name": c[1], "type": c[2], "g": c[3], "on": bool(c[4])} for c in intel.TG_CATALOG]
    out["tg_groups"] = intel.TG_GROUPS
    out["status"] = intg_status()
    return out


def intg_status():
    return {"ua_alerts": UAALERT.status, "deepstate": DEEPST.status, "notam": NOTAMS.status, "gfw": DARKSAR.status, "telegram": TGOSINT.status,
            "adsb": LADSB.status, "ais": LAIS.status, "aprs": APRSIS.status, "aishub": AISHUB.status,
            **{"tcp:" + k: v for k, v in AISTCP.status.items()}, "mail": MAILIN.status, "radiation": RADIATION.status, "acled": ACLED.status, "corr": CORR.status,
            "vgraph": {"ok": bool(VGRAPH.meta.get("n_v")) if VGRAPH.meta.get("n_v") or VGRAPH.meta.get("err") else None, "err": VGRAPH.meta.get("err"), "n": VGRAPH.meta.get("n_v")}, "ha": {"ok": None if not NOTIFY.cfg.get("ha") else NOTIFY.ha_err is None, "err": NOTIFY.ha_err}}


def save_intg(body):
    global SETTINGS
    c = dict(SETTINGS.get("intg") or {})
    for k, lim in INTG_KEYS.items():
        if k not in body:
            continue
        v = body[k]
        if k in INTG_SECRET and not str(v or "").strip():
            continue                                   # puste pole = bez zmian (sekrety są ukryte)
        if body.get("clear_" + k):
            c.pop(k, None); continue
        if k in ("notam_locs", "tg_channels"):
            c[k] = list(dict.fromkeys(x.strip() for x in re.split(r"[,\s]+", str(v or "")) if x.strip()))[:150 if k == "tg_channels" else 40]
        elif k in ("aprs_on", "kystverket"):
            c[k] = bool(v)
        else:
            c[k] = str(v).strip()[:lim]
    for k in INTG_SECRET:
        if body.get("clear_" + k):
            c.pop(k, None)
    new = dict(SETTINGS); new["intg"] = c
    SETTINGS = new
    SETTINGS_FILE.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
    NOTIFY.configure(new)
    for src in (UAALERT, DEEPST, NOTAMS, DARKSAR, TGOSINT, ACLED):
        src.wake.set()
    MAILIN.wake.set()


# ------------------------------------------------ wyszukiwarka: statki (MMSI, nazwa, IMO, znak), samoloty (ICAO, znak, rejestracja, typ), APRS
def find_all(q):
    ql = q.lower().strip()
    if len(ql) < 2:
        return {"q": q, "res": []}
    res = []
    def score(*fields):
        best = 0
        for f in fields:
            f = str(f or "").lower()
            if not f:
                continue
            if f == ql: best = max(best, 100)
            elif f.startswith(ql): best = max(best, 70)
            elif ql in f: best = max(best, 40)
        return best
    with SEA.lock:
        ships = [r for r in SEA.ships.values() if "lat" in r]
    for r in ships:
        sc = score(r["mmsi"], r.get("name"), r.get("imo"), r.get("cs"))
        if sc:
            res.append((sc + (5 if r.get("cat") in ("military", "law") else 0), {"t": "vs", "id": r["mmsi"], "name": r.get("name") or f"MMSI {r['mmsi']}",
                        "sub": f"MMSI {r['mmsi']}" + (f" · IMO {r['imo']}" if r.get("imo") else "") + f" · {r.get('kind') or r.get('cat')} · {r.get('flag') or ''}",
                        "lat": r["lat"], "lon": r["lon"], "ts": r.get("ts")}))
    with AIR.lock:
        acs = list(AIR.ac.values())
    for a in acs:
        sc = score(a.get("hex"), a.get("cs"), a.get("reg"), a.get("t"), a.get("desc"), a.get("op"))
        if sc:
            res.append((sc + 10, {"t": "ah", "id": a["hex"], "name": a.get("cs") or a["hex"].upper(), "sub": f"{a.get('desc') or a.get('t') or ''} · {a.get('country') or ''} · {a.get('reg') or ''}",
                                  "lat": a.get("lat"), "lon": a.get("lon")}))
    for a in LADSB.ac:
        sc = score(a.get("hex"), a.get("cs"), a.get("r"), a.get("t"))
        if sc:
            res.append((sc, {"t": "la", "id": a["hex"], "name": a.get("cs") or a["hex"].upper(), "sub": f"{a.get('t') or ''} · {a.get('r') or ''} · " + i18n.L("Twój odbiornik ADS-B", "your ADS-B receiver"),
                             "lat": a["lat"], "lon": a["lon"]}))
    for st in APRSIS.view():
        sc = score(st.get("call"))
        if sc:
            res.append((sc - 5, {"t": "ap", "id": st["call"], "name": st["call"], "sub": "APRS · " + (st.get("cmt") or ""), "lat": st["lat"], "lon": st["lon"]}))
    res.sort(key=lambda x: -x[0])
    return {"q": q, "res": [r for _, r in res[:30]]}


# ------------------------------------------------ pytania o historię (archiwum odczytów + baza historii + incydenty)
HIST_SYS = ("Jesteś KRONOS-7, komputer pokładowy systemu wywiadowczego. Odpowiadasz na pytania o PRZESZŁOŚĆ wyłącznie na podstawie DANYCH z archiwum "
            "(odczyty analizy, zdarzenia, incydenty, wskaźniki). Podawaj daty. Jeśli danych brak, mów to wprost. Do 200 słów, tonem raportu.")


def history_context(q, limit):
    ql = q.lower(); now = time.time()
    days = 7
    if re.search(r"dzi[sś]|today", ql): days = 1
    elif re.search(r"wczoraj|yesterday", ql): days = 2
    elif re.search(r"miesi|month|30 dni", ql): days = 31
    elif re.search(r"rok|year", ql): days = 365
    m = re.search(r"(\d+)\s*(dni|days|godz|hours)", ql)
    if m:
        days = max(1, int(m.group(1)) // (24 if m.group(2).startswith(("godz", "hour")) else 1))
    words = {w[:5] for w in re.findall(r"[a-ząćęłńóśźżA-Z]{4,}", ql) if w not in ("było", "jakie", "które", "what", "which", "działo", "dzialo", "zeszłym", "zeszlym", "tygodniu", "week")}
    hit = lambda t: not words or any(w in (t or "").lower() for w in words)
    out = [f"ZAKRES: ostatnie {days} dni (do {datetime.now():%Y-%m-%d %H:%M})"]
    files = sorted(ARCH.glob("*.json"))
    files = [f for f in files if now - f.stat().st_mtime < days * 86400 + 3600]
    step = max(1, len(files) // 14)
    for f in files[::step][-14:]:
        try:
            st = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        th = st.get("threat") or {}
        conf = [f"{c['name']}: {c.get('trend')} – {(c.get('latest') or '')[:140]}" for c in st.get("conflicts", []) if hit(c.get("name", "") + " " + (c.get("latest") or ""))][:6]
        items = [i["h"] for i in st.get("items", []) if hit(i.get("h", "") + " " + i.get("b", ""))][:6]
        out.append(f"\n# ODCZYT {st.get('stamp', f.stem)[:16]} · napięcie {th.get('level')}/5 {th.get('label', '')}\n"
                   f"briefing: {(st.get('briefing') or '')[:500]}\n" + ("konflikty: " + " | ".join(conf) + "\n" if conf else "") + ("depesze: " + " | ".join(items) if items else ""))
    ev = [e for e in HIST.events(days * 24, 400) if hit(e.get("msg"))][:40]
    if ev:
        out.append("\n# ZDARZENIA (samoloty, statki, incydenty)\n" + "\n".join(f"{datetime.fromtimestamp(e['at'] / 1000):%Y-%m-%d %H:%M} {e['src']}: {e['msg']}" for e in ev))
    inc = [x for x in MARSEC.brief(days, 60) if hit(json.dumps(x, ensure_ascii=False))][:20]
    if inc:
        out.append("\n# BEZPIECZEŃSTWO MORSKIE\n" + "\n".join(f"{x['when']} {x['kind']} {x.get('where') or ''}: {x.get('what') or ''}" for x in inc))
    for key in ("threat", "brent", "air.isr", "sea.dark", "hormuz.transits"):
        sr = HIST.series(key, days)
        if len(sr) > 2:
            daily = {}
            for t_, v in sr:
                daily.setdefault(datetime.fromtimestamp(t_ / 1000).strftime("%m-%d"), []).append(v)
            out.append(f"{history.METRIC_LABELS.get(key, (key,))[0]}: " + ", ".join(f"{d} {sum(v) / len(v):.1f}" for d, v in list(daily.items())[-14:]))
    s = "\n".join(out)
    return s[-limit:]
TTS = tts.TTS(DATA, log)
atexit.register(TTS.stop_all)
NOTIFY = notify.Notifier(log)
NOTIFY.configure(SETTINGS)
EMO = {"air": "✈", "sea": "⚓", "marsec": "🏴‍☠️", "corr": "🔗", "rad": "☢"}
NOTE_SEEN = {}


def ev_pos(src, e):
    """Pozycja zdarzenia (do wyciszania alarmów należących do już zgłoszonego zdarzenia złożonego)."""
    try:
        if e.get("lat") is not None:
            return e["lat"], e["lon"]
        if src == "air" and e.get("hex") in AIR.ac:
            r = AIR.ac[e["hex"]]; return r.get("lat"), r.get("lon")
        if src == "sea" and e.get("mmsi") in SEA.ships:
            r = SEA.ships[e["mmsi"]]; return r.get("lat"), r.get("lon")
        if src == "ua" and e.get("obl") in intel.OBLASTS:
            o = intel.OBLASTS[e["obl"]]; return o[2], o[3]
        if src == "osint":
            p = TGOSINT.posts.get(e.get("id")) or {}
            pos = (p.get("ai") or {}).get("pos"); return (pos[0], pos[1]) if pos else (None, None)
        if src == "marsec":
            r = MARSEC.items.get(e.get("id")) or {}
            return tuple(r["pos"][:2]) if r.get("pos") else (None, None)
    except Exception:
        pass
    return None, None


def _on_event(src, e):
    if src == "ua":          # alarmy UA – tylko obwody wybrane przez operatora (pusta lista = żaden)
        watch = [x.strip().lower() for x in str((SETTINGS.get("intg") or {}).get("ua_watch") or "").split(",") if x.strip()]
        if not any(w and (w in e.get("msg", "").lower() or w in str(e.get("obl", ""))) for w in watch):
            return
    now = time.time()
    if src not in ("ua", "corr"):            # v3.17: ten sam alarm o tym samym obiekcie najwyżej raz na 6 h
        key = f"{src}|{e.get('kind')}|{e.get('hex') or e.get('mmsi') or e.get('id') or re.sub(r'[0-9]+', '#', str(e.get('msg', '')))[:90]}"
        if now - NOTE_SEEN.get(key, 0) < 6 * 3600:
            return
        NOTE_SEEN[key] = now
        if len(NOTE_SEEN) > 5000:
            for k in [k for k, v in NOTE_SEEN.items() if now - v > 6 * 3600]:
                NOTE_SEEN.pop(k, None)
    if src != "corr" and e.get("kind") != "squawk":
        inc = CORR.covered(*ev_pos(src, e))
        if inc:                              # należy do zgłoszonego już zdarzenia złożonego – jedno powiadomienie zamiast kilku
            log(i18n.L(f"Powiadomienie wyciszone (część zdarzenia „{(inc.get('ai') or {}).get('title', '')}”): {e.get('msg')}",
                       f"Notification muted (part of incident “{(inc.get('ai') or {}).get('title', '')}”): {e.get('msg')}"))
            return
    NOTIFY.send(notify.kind_of(src, e), f"{EMO.get(src, '')} {e.get('msg')}")


def corr_signals():
    """Sygnały do korelacji ze wszystkich warstw: id, warstwa, czas (ms), pozycja, opis, odnośnik do karty."""
    out, now = [], int(time.time() * 1000)
    def add(sid, layer, t, lat, lon, text, go=None):
        if lat is None or lon is None:
            return
        out.append({"id": sid, "layer": layer, "t": int(t or now), "lat": float(lat), "lon": float(lon), "text": str(text or "")[:300], "go": go})
    try:
        for e in list(AIR.events):
            r = AIR.ac.get(e.get("hex"))
            if r and e.get("kind") in ("loiter", "squawk", "zone"):
                add(f"air-{e['kind']}-{e['hex']}-{e['at'] // 3600000}", "air", e["at"], r.get("lat"), r.get("lon"), e.get("msg"), "ah:" + e["hex"])
        for hx, r in list(AIR.ac.items()):
            if r.get("loiter"):
                add(f"air-loit-{hx}", "air", now, r["loiter"]["lat"], r["loiter"]["lon"],
                    i18n.L(f"{r.get('cs') or hx} krąży (promień {r['loiter']['r']} km)", f"{r.get('cs') or hx} orbiting (radius {r['loiter']['r']} km)"), "ah:" + hx)
        for e in list(SEA.events):
            r = SEA.ships.get(e.get("mmsi"))
            if r and "lat" in r:
                add(f"sea-{e['kind']}-{e['mmsi']}-{e['at'] // 3600000}", "sea", e["at"], r["lat"], r["lon"], e.get("msg"), f"vs:{e['mmsi']}")
        for o in ((UAALERT.data or {}).get("oblasts") or []):
            if o.get("on"):
                add(f"ua-{o['id']}-{o.get('since')}", "ua", o.get("since") or now, o["lat"], o["lon"],
                    i18n.L("Alarm przeciwlotniczy: ", "Air raid alert: ") + o["name"] + (" (" + ", ".join(o.get("kinds") or []) + ")" if o.get("kinds") else ""), "ua:" + o["id"])
        for r in (MARSEC.view(3).get("items") or []):
            if r.get("pos") and not r.get("warn") and r.get("t"):
                add("ms-" + r["id"], "marsec", r["t"], r["pos"][0], r["pos"][1], r.get("title"), "mi:" + r["id"])
        for p in TGOSINT.view(36):
            if p.get("pos") and p.get("ai"):
                add("tg-" + p["id"], "osint", p["t"], p["pos"][0], p["pos"][1], f"@{p['ch']}: {p.get('title') or ''} – {p.get('summary') or ''}", "tg:" + p["id"])
        for n in ((NOTAMS.data or {}).get("items") or []):
            if n.get("pos") and n.get("kind") in ("gnss", "missile", "uas", "military", "closed"):
                add("nt-" + str(n["id"]), "notam", now - 3600e3, n["pos"][0], n["pos"][1], f"NOTAM {n.get('loc')} {n.get('kind')}: {(n.get('text') or '')[:160]}", "nt:" + str(n["id"]))
        with STATE_LOCK:
            st = STATE
        fd = (st.get("feeds") or {})
        gj = fd.get("gpsjam") or {}
        day = gj.get("day")
        try:
            tday = int(datetime.fromisoformat(day + "T12:00:00+00:00").timestamp() * 1000) if day else now
        except ValueError:
            tday = now
        for la, lo, pct in (gj.get("pts") or [])[:1800]:
            if pct >= 0.35:
                add(f"gps-{la}-{lo}-{day}", "gps", tday, la, lo, i18n.L(f"Zakłócenia GPS: {round(pct * 100)}% samolotów ze słabą nawigacją", f"GPS jamming: {round(pct * 100)}% of aircraft with degraded navigation"))
        for c in (fd.get("firms") or [])[:120]:
            try:
                t = int(datetime.fromisoformat(str(c.get("t")) + "T12:00:00+00:00").timestamp() * 1000)
            except ValueError:
                t = now
            add(f"fire-{c['lat']}-{c['lon']}-{c.get('t')}", "fire", t, c["lat"], c["lon"],
                i18n.L(f"Pożary z satelity: {c['n']} ognisk, moc {c['frp']} MW ({c.get('reg')})", f"Satellite fires: {c['n']} hotspots, {c['frp']} MW ({c.get('reg')})"))
        for h in (st.get("hazards") or []):
            if h.get("kind") == "quake" and h.get("lat") is not None:
                try:
                    t = int(datetime.fromisoformat(h["date"]).timestamp() * 1000)
                except Exception:
                    t = now
                add("q-" + str(h.get("name"))[:40], "quake", t, h["lat"], h["lon"], h.get("name"))
        for x in ((RADIATION.data or {}).get("pts") or []):
            if x.get("anom"):
                add("rad-" + x["id"], "rad", x["t"], x["lat"], x["lon"], f"{x['name']}: {x['usv']} µSv/h ({i18n.L('tło', 'background')} {x['base']})", "rd:" + x["id"])
        for x in ((ACLED.data or {}).get("ev") or [])[:4000]:
            try:
                t = int(datetime.fromisoformat(x["d"] + "T12:00:00+00:00").timestamp() * 1000)
            except Exception:
                continue
            if now - t < 40 * 3600e3:
                add("ac-" + str(x["id"]), "acled", t, x["lat"], x["lon"], f"ACLED {x['sub']}: {x['loc']} ({x['cc']}) – {x['a1']}{' vs ' + x['a2'] if x.get('a2') else ''}; {x['fat']} ofiar", "ac:" + str(x["id"]))
    except Exception as e:
        log(f"Korelacje – zbieranie: {e}")
    return out


CORR = correlate.Correlator(log, corr_signals, AI_BG, lambda: JOB["running"])


HIST.on_event = _on_event


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
            if AI_BG.status().get("ready"):          # AI w tle (Telegram, alerty morskie) liczy się tu, razem z analizą – karta nie pracuje co 10 minut
                JOB.update(step=i18n.L("AI: Telegram OSINT i alerty morskie", "AI: Telegram OSINT and maritime alerts"), pct=1)
                try:
                    n1 = TGOSINT.enrich(120, in_job=True); n2 = MARSEC.enrich(60, in_job=True)
                    if n1 or n2:
                        MARSEC.save(); log(i18n.L(f"AI w tle: {n1} wpisów z Telegrama, {n2} alertów morskich.", f"Background AI: {n1} Telegram posts, {n2} maritime alerts."))
                except Exception as e:
                    log(f"AI w tle: {e}")
            base = dict(STATE); base["marsec"] = MARSEC.brief(); base["osint_tg"] = TGOSINT.brief()
            base["acled"] = ACLED.brief() if ACLED.data else None; base["radiation"] = RADIATION.brief() if RADIATION.data else None; base["correlations"] = CORR.brief()
            st = analyst.Pipeline(CFG, AI_MAIN, log, progress).run(base)
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
            if SETTINGS.get("ai_unload") and ENGINE.unload():
                log(i18n.L("Model AI zwolniony z karty graficznej.", "AI model unloaded from the GPU."))
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
            "auto_pull": CFG["ai"].get("auto_pull", True), "ai_bg": SETTINGS.get("ai_bg", "after"), "ai_unload": bool(SETTINGS.get("ai_unload")), "installed": [m["name"] for m in st["installed"]],
            "recommended": st["recommended"], "configured": bool(CFG["operator"]["callsign"]),
            "ais_key": ("…" + SETTINGS["aisstream_key"][-4:]) if SETTINGS.get("aisstream_key") else "",
            "language": CFG.get("language", "pl"), "ais_scope": SETTINGS.get("ais_scope", "world"), "qth": SETTINGS.get("qth"),
            "tg_token": ("…" + SETTINGS["tg_token"][-4:]) if SETTINGS.get("tg_token") else "", "tg_chat": SETTINGS.get("tg_chat", ""),
            "discord": ("…" + SETTINGS["discord"][-6:]) if SETTINGS.get("discord") else "", "notify_kinds": sorted(NOTIFY.cfg.get("kinds", [])),
            "notify_all": {k: v[1 if i18n.en() else 0] for k, v in notify.KINDS.items()}, "notify_err": NOTIFY.last_err,
            "lan": bool(SETTINGS.get("lan")), "lan_pin": bool(SETTINGS.get("lan_pin")), "lan_urls": lan_urls()}


CABLES_GZ = None

# ------------------------------------------------ własne dźwięki operatora (data/sounds)
SOUNDS = DATA / "sounds"
SND_EXT = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".m4a": "audio/mp4",
           ".aac": "audio/aac", ".flac": "audio/flac", ".webm": "audio/webm"}
SND_SLOTS = ("boot", "done", "threat", "klaxon", "contact", "emergency", "watch", "pass", "click", "key", "burble", "hum")
SND_MAX = 15 * 1024 * 1024


def snd_name(name):
    """Bezpieczna nazwa pliku: bez katalogów, tylko litery/cyfry/-_. i znane rozszerzenie audio."""
    name = os.path.basename(str(name or "")).strip()
    stem, ext = os.path.splitext(name)
    stem = re.sub(r"[^\w\-. ]", "_", stem, flags=re.UNICODE).strip(" .")[:60]
    ext = ext.lower()
    return f"{stem}{ext}" if stem and ext in SND_EXT else None


def sounds_view():
    files = []
    if SOUNDS.is_dir():
        for f in sorted(SOUNDS.iterdir(), key=lambda x: x.name.lower()):
            if f.is_file() and f.suffix.lower() in SND_EXT:
                files.append({"name": f.name, "size": f.stat().st_size})
    names = {f["name"] for f in files}
    mp = {k: v for k, v in (SETTINGS.get("sounds") or {}).items() if k in SND_SLOTS and (v.get("file") in names or v.get("off"))}
    return {"files": files, "map": mp, "slots": list(SND_SLOTS), "max_mb": SND_MAX // (1024 * 1024)}


TTS_DEF = {"engine": "auto", "voice_pl": tts.DEFAULT["pl"], "voice_en": tts.DEFAULT["en"], "ms_pl": tts.MS_DEFAULT["pl"], "ms_en": tts.MS_DEFAULT["en"],
           "rate": 1.0, "fx": False, "browser_voice": "", "pitch": 0.9}


def tts_cfg():
    return dict(TTS_DEF, **(SETTINGS.get("tts") or {}))


def tts_view():
    return dict(TTS.status(), cfg=tts_cfg())


def save_tts(body):
    global SETTINGS
    c = tts_cfg()
    for k in ("ms_pl", "ms_en"):
        if body.get(k) in tts.MS_VOICES:
            c[k] = body[k]
    if body.get("engine") in ("auto", "ms", "piper", "browser"):
        c["engine"] = body["engine"]
    for k in ("voice_pl", "voice_en"):
        if body.get(k) in tts.VOICES:
            c[k] = body[k]
    for k, lo, hi in (("rate", .6, 1.6), ("pitch", .5, 1.5)):
        if k in body:
            try: c[k] = round(max(lo, min(hi, float(body[k]))), 2)
            except (TypeError, ValueError): pass
    if "fx" in body:
        c["fx"] = bool(body["fx"])
    if "browser_voice" in body:
        c["browser_voice"] = str(body["browser_voice"])[:120]
    new = dict(SETTINGS); new["tts"] = c
    SETTINGS = new
    SETTINGS_FILE.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")


def save_sound_map(mp):
    global SETTINGS
    clean = {}
    for k, v in (mp or {}).items():
        if k not in SND_SLOTS or not isinstance(v, dict):
            continue
        e = {}
        if v.get("off"):
            e["off"] = True
        elif v.get("file") and snd_name(v["file"]) == v["file"]:
            e["file"] = v["file"]
        else:
            continue
        try:
            e["vol"] = max(0, min(200, int(v.get("vol", 100))))
        except (TypeError, ValueError):
            e["vol"] = 100
        clean[k] = e
    new = dict(SETTINGS); new["sounds"] = clean
    SETTINGS = new
    SETTINGS_FILE.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")

# ------------------------------------------------ Stream Deck: kolejka poleceń dla terminala i stan do wyświetlenia na przyciskach
CMDS = deque(maxlen=50)
CMD_CV = threading.Condition()
CMD_N = [0]
UI = {"at": 0}
CMD_OK = {"theater", "layer", "zoom", "replay", "briefing", "sitrep", "stop", "globe", "autozoom", "alert", "event", "sat", "voice", "audio", "ask", "view", "eco"}


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
            "inc": MARSEC.counts(),
            "ua": {"n": (UAALERT.data or {}).get("active", 0), "ev": UAALERT.events[-1] if UAALERT.events else None},
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
        new["notify_kinds"] = [k for k in body["notify_kinds"] if k in notify.KINDS]; new["notify_v317"] = True
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
    if body.get("ai_bg") in ("after", "always"):
        new["ai_bg"] = body["ai_bg"]
    if "ai_unload" in body:
        new["ai_unload"] = bool(body["ai_unload"])
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
        if p == "/api/sounds":
            return self._json(sounds_view())
        if p == "/api/tts/status":
            return self._json(tts_view())
        m = re.match(r"^/sounds/([^/]+)$", p)
        if m:
            n = snd_name(urllib.parse.unquote(m.group(1)))
            f = SOUNDS / n if n else None
            if not f or not f.is_file():
                self.send_error(404); return
            b = f.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", SND_EXT[f.suffix.lower()])
            self.send_header("Content-Length", str(len(b)))
            self.send_header("Cache-Control", "max-age=86400")
            self.end_headers(); self.wfile.write(b); return
        m = re.match(r"^/tile/([a-z@2x+]+)/(\d+)/(\d+)/(\d+)$", p)
        if m:
            try:
                b, ct = TILES.get(m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)))
            except Exception:
                b, ct = None, None
            if not b:
                self.send_response(404); self.send_header("Content-Length", "0"); self.send_header("Cache-Control", "max-age=600"); self.end_headers(); return
            self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b)))
            self.send_header("Cache-Control", "max-age=2592000"); self.end_headers()
            try: self.wfile.write(b)
            except (BrokenPipeError, ConnectionResetError): pass
            return
        if p == "/api/tiles":
            return self._json(TILES.view())
        if p == "/api/graph/vessel":
            q = urllib.parse.parse_qs(self.path.partition("?")[2]); g1 = lambda k: (q.get(k) or [""])[0]
            mm = int(g1("mmsi")) if g1("mmsi").isdigit() else None
            im = int(g1("imo")) if g1("imo").isdigit() else None
            rec = SEA.ships.get(mm) if mm else None
            if rec and not im and rec.get("imo"):
                try: im = int(rec["imo"])
                except (TypeError, ValueError): pass
            live = lambda m: m in SEA.ships and "lat" in SEA.ships[m]
            return self._json(VGRAPH.graph(mm, im, g1("name") or (rec or {}).get("name"), live, (rec or {}).get("flag")))
        if p == "/api/cloud":
            return self._json(CLOUD.view())
        if p == "/api/hf/search":
            q = urllib.parse.unquote_plus((re.search(r"q=([^&]*)", self.path) or [None, ""])[1]).strip()[:80]
            try:
                return self._json({"res": llm.hf_search(q, SETTINGS.get("hf_token")) if q else []})
            except Exception as e:
                return self._json({"res": [], "error": str(e)[:200]})
        if p == "/api/hf/files":
            repo = urllib.parse.unquote_plus((re.search(r"repo=([^&]*)", self.path) or [None, ""])[1]).strip()
            if not re.match(r"^[\w.\-]+/[\w.\-]+$", repo):
                return self._json({"error": "repo"}, 400)
            try:
                return self._json(llm.hf_files(repo, ENGINE.hw, SETTINGS.get("hf_token")))
            except urllib.error.HTTPError as e:
                return self._json({"error": (i18n.L("Hugging Face: nie ma takiego repozytorium albo jest prywatne", "Hugging Face: no such repository, or it is private") if e.code in (401, 404)
                                             else i18n.L("Hugging Face: brak dostępu – model z ograniczonym dostępem", "Hugging Face: access denied – gated model")) + f" (HTTP {e.code})"})
            except Exception as e:
                return self._json({"error": str(e)[:200]})
        if p == "/api/hf/key":
            k, path = llm.ollama_pubkey()
            return self._json({"key": k, "path": path, "token_set": bool(SETTINGS.get("hf_token"))})
        if p == "/api/models":
            if "rescan" in self.path:
                ENGINE.refresh()
            return self._json(ENGINE.models_view())
        if p == "/api/deck":
            return self._json(deck_state())
        if p == "/api/intg":
            return self._json(intg_view())
        if p == "/api/find":
            q = urllib.parse.unquote_plus((re.search(r"q=([^&]*)", self.path) or [None, ""])[1]).strip()
            return self._json(find_all(q))
        if p == "/api/intel":
            en = i18n.en()
            return self._json({"tile_key": (SETTINGS.get("intg") or {}).get("stadia_key") or "", "status": intg_status(), "ua": UAALERT.data, "notam": NOTAMS.data, "gfw": DARKSAR.data,
                               "deepstate": {"at": DEEPST.data["at"], "n": len(DEEPST.data["polys"])} if DEEPST.data else None,
                               "tg": TGOSINT.view(48), "tg_names": {k: v[0] for k, v in intel.TG_DEFAULT.items()},
                               "ua_watch": [x.strip() for x in str((SETTINGS.get("intg") or {}).get("ua_watch") or "").split(",") if x.strip()],
                               "rad": RADIATION.data, "corr": CORR.view(), "acled_n": len((ACLED.data or {}).get("ev") or []), "acled_at": (ACLED.data or {}).get("at")})
        if p == "/api/intel/acled":
            ev = (ACLED.data or {}).get("ev") or []
            T_I = {t: i for i, t in enumerate(("battle", "explosion", "civilians", "strategic", "riot", "protest", "other"))}
            return self._json({"at": (ACLED.data or {}).get("at"), "days": (ACLED.data or {}).get("days"),
                               "rows": [[x["id"], round(x["lat"], 3), round(x["lon"], 3), T_I.get(x["type"], 6), x["fat"], x["d"]] for x in ev]})
        m = re.match(r"^/api/intel/acled/(.+)$", p)
        if m:
            k = urllib.parse.unquote(m.group(1))
            x = next((x for x in ((ACLED.data or {}).get("ev") or []) if str(x["id"]) == k), None)
            return self._json(x or {"error": "brak"}, 200 if x else 404)
        if p == "/api/intel/deepstate":
            if not DEEPST.data:
                return self._json({"polys": [], "points": []})
            return self._json(DEEPST.data)
        if p == "/api/sdr":
            return self._json({"adsb": LADSB.ac, "aprs": APRSIS.view(), "status": {"adsb": LADSB.status, "ais": LAIS.status, "aprs": APRSIS.status}})
        if p == "/api/satimg":
            q = urllib.parse.parse_qs(self.path.partition("?")[2]); g = lambda k, d=None: (q.get(k) or [d])[0]
            try:
                b = SATIMG.get(float(g("lat")), float(g("lon")), float(g("span", 1.5)), g("layer", "true"), g("date"))
            except Exception as e:
                return self._json({"error": str(e)[:200]}, 502)
            self.send_response(200); self.send_header("Content-Type", "image/jpeg"); self.send_header("Content-Length", str(len(b)))
            self.send_header("Cache-Control", "max-age=3600"); self.end_headers(); self.wfile.write(b); return
        if p == "/widget":
            f = WEB / "widget.html"
            return self._html(f.read_text(encoding="utf-8") if f.exists() else "brak")
        if p == "/api/marsec":
            d = int((re.search(r"days=(\d+)", self.path) or [0, 60])[1])
            return self._json(MARSEC.view(max(1, min(120, d))))
        m = re.match(r"^/api/marsec/item/(.+)$", p)
        if m:
            r = MARSEC.detail(urllib.parse.unquote(m.group(1)))
            return self._json(r or {"error": "brak"}, 200 if r else 404)
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
            return self._json({"engine": dict(ENGINE.status(), cloud=CLOUD.label() if CLOUD.configured() else None, cloud_ok=CLOUD.available(),
                                         cloud_use=(SETTINGS.get("cloud") or {}).get("use") or {"main": True, "ask": True, "bg": False}), "job": JOB, "log": list(LOG)[-60:], "operator": CFG.get("operator"),
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
            q = urllib.parse.parse_qs(self.path.partition("?")[2])
            if "bbox" in q:                    # v3.15: tylko widoczny obszar, przy oddaleniu kratki zamiast pojedynczych statków
                try:
                    bb = [float(x) for x in q["bbox"][0].split(",")][:4]
                    cell = max(0.0, min(20.0, float((q.get("cell") or ["0"])[0])))
                except ValueError:
                    bb, cell = None, 0.0
                return self._json(SEA.view(g("since"), g("ev"), bb if bb and len(bb) == 4 else None, cell, g("sel"), (q.get("old") or ["0"])[0] == "1"))
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
        if p.startswith("/api/cloud"):
            if not self._local():
                return self._json({"error": "local"}, 403)
            b = self._body()
            if p == "/api/cloud":
                c = dict(SETTINGS.get("cloud") or {})
                if "provider" in b:
                    c["provider"] = b["provider"] if b["provider"] in llm.PROVIDERS else ""
                for k in ("model", "base"):
                    if k in b:
                        c[k] = str(b[k] or "").strip()[:300]
                if str(b.get("key") or "").strip():
                    c["key"] = str(b["key"]).strip()[:400]
                if b.get("clear_key"):
                    c.pop("key", None)
                if isinstance(b.get("use"), dict):
                    c["use"] = {r: bool(b["use"].get(r)) for r in ("main", "ask", "bg")}
                if "fallback" in b:
                    c["fallback"] = bool(b["fallback"])
                SETTINGS["cloud"] = c; CLOUD.cool_until = 0
                SETTINGS_FILE.write_text(json.dumps(SETTINGS, ensure_ascii=False, indent=2), encoding="utf-8")
                return self._json(CLOUD.view())
            if p == "/api/cloud/test":
                try:
                    return self._json(dict(CLOUD.test(), view=CLOUD.view()))
                except Exception as e:
                    return self._json({"ok": False, "error": str(e)[:300], "view": CLOUD.view()})
            if p == "/api/cloud/models":
                try:
                    return self._json({"models": CLOUD.models()[:400]})
                except Exception as e:
                    return self._json({"models": [], "error": str(e)[:200]})
            return self._json({"error": "?"}, 404)
        if p == "/api/tiles":
            if not self._local():
                return self._json({"error": "local"}, 403)
            b = self._body(); act = b.get("act")
            if act == "start":
                try:
                    bb = [float(v) for v in b.get("bbox") or [-180, -85, 180, 85]]
                    ok, err = TILES.start(str(b.get("group")), bb, max(0, min(14, int(b.get("zmax") or 6))), max(0, int(b.get("zmin") or 0)), bool(b.get("retina")))
                except (TypeError, ValueError):
                    ok, err = False, "?"
                return self._json({"ok": ok, "error": err, **TILES.view()})
            if act == "count":
                bb = [float(v) for v in b.get("bbox") or [-180, -85, 180, 85]]
                return self._json({"n": TILES.count(bb, max(0, min(14, int(b.get("zmax") or 6))), max(0, int(b.get("zmin") or 0)))})
            if act == "cancel":
                TILES.cancel()
            if act == "clear":
                TILES.cancel(); TILES.clear(b.get("group") or None)
            return self._json(TILES.view())
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
        if (p in ("/api/settings", "/api/model/pull", "/api/model/rescan", "/api/model/delete", "/api/model/use", "/api/hf/token", "/api/notify/test") or p.startswith("/api/sounds/")) and not self._local():
            return self._json({"error": i18n.L("Ustawienia można zmieniać tylko na komputerze z KRONOS-em.", "Settings can only be changed on the computer running KRONOS.")}, 403)
        if p in ("/api/tts/install", "/api/tts/remove", "/api/tts/settings", "/api/tts/ms/install") and not self._local():
            return self._json({"error": "local only"}, 403)
        if p == "/api/tts/install":
            TTS.install(self._body().get("voice"))
            return self._json(tts_view())
        if p == "/api/tts/ms/install":
            TTS.ms_install()
            return self._json(tts_view())
        if p == "/api/tts/remove":
            TTS.remove_voice(self._body().get("voice"))
            return self._json(tts_view())
        if p == "/api/tts/settings":
            save_tts(self._body())
            return self._json(tts_view())
        if p == "/api/tts":
            b = self._body(); c = tts_cfg(); rate = float(b.get("rate") or c["rate"])
            eng = b.get("engine") or c["engine"]
            mv = b.get("voice") if b.get("voice") in tts.MS_VOICES else c["ms_en" if i18n.en() else "ms_pl"]
            if (eng == "ms" or (eng == "auto" and TTS.ms_ok()) or b.get("voice") in tts.MS_VOICES) and TTS.ms_ok():
                mp3 = TTS.synth_ms(b.get("text"), mv, rate)
                if mp3:
                    self.send_response(200)
                    self.send_header("Content-Type", "audio/mpeg"); self.send_header("Content-Length", str(len(mp3))); self.send_header("Cache-Control", "no-store")
                    self.end_headers(); self.wfile.write(mp3); return
                if b.get("voice") in tts.MS_VOICES:
                    return self._json({"error": "Microsoft: " + (TTS.ms_err or "?")}, 503)
            v = b.get("voice") if b.get("voice") in tts.VOICES else c["voice_en" if i18n.en() else "voice_pl"]
            wav = TTS.synth(b.get("text"), v, rate)
            if not wav:
                return self._json({"error": ("Microsoft: " + TTS.ms_err + " · Piper: " if TTS.ms_err else "") + (TTS.last_err or "")  or ("brak głosu" if not TTS.has_voice(v) else "tts"), "installed": TTS.has_voice(v), "engine": bool(TTS.exe())}, 503)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav"); self.send_header("Content-Length", str(len(wav))); self.send_header("Cache-Control", "no-store")
            self.end_headers(); self.wfile.write(wav); return
        if p == "/api/sounds/upload":
            n = snd_name(urllib.parse.unquote((re.search(r"name=([^&]*)", self.path) or [None, ""])[1]))
            size = int(self.headers.get("Content-Length") or 0)
            if not n:
                return self._json({"ok": False, "error": i18n.L("Nieobsługiwany format. Dozwolone: " + ", ".join(SND_EXT), "Unsupported format. Allowed: " + ", ".join(SND_EXT))}, 400)
            if size <= 0 or size > SND_MAX:
                self.rfile.read(min(size, SND_MAX + 1)) if size > 0 else None
                return self._json({"ok": False, "error": i18n.L(f"Plik za duży (najwyżej {SND_MAX // 1048576} MB).", f"File too large (max {SND_MAX // 1048576} MB).")}, 400)
            data = self.rfile.read(size)
            SOUNDS.mkdir(parents=True, exist_ok=True)
            (SOUNDS / n).write_bytes(data)
            log(i18n.L(f"Dźwięki: dodano plik {n}.", f"Sounds: added file {n}."))
            return self._json({"ok": True, "name": n, **sounds_view()})
        if p == "/api/sounds/delete":
            n = snd_name(self._body().get("name"))
            if n and (SOUNDS / n).is_file():
                (SOUNDS / n).unlink()
                save_sound_map({k: v for k, v in (SETTINGS.get("sounds") or {}).items() if v.get("file") != n})
            return self._json({"ok": True, **sounds_view()})
        if p == "/api/sounds/map":
            save_sound_map(self._body().get("map"))
            return self._json({"ok": True, **sounds_view()})
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
        if p == "/api/hf/token":
            t = str(self._body().get("token") or "").strip()
            if t and not re.match(r"^hf_[A-Za-z0-9]{20,}$", t):
                return self._json({"ok": False, "error": i18n.L("Token Hugging Face zaczyna się od „hf_” (huggingface.co → Settings → Access Tokens, rodzaj Read).", "A Hugging Face token starts with “hf_” (huggingface.co → Settings → Access Tokens, type Read).")}, 400)
            SETTINGS["hf_token"] = t
            SETTINGS_FILE.write_text(json.dumps(SETTINGS, ensure_ascii=False, indent=2), encoding="utf-8")
            return self._json({"ok": True, "token_set": bool(t)})
        if p == "/api/model/pull":
            nm = llm.model_name(str(self._body().get("name") or ""))
            if nm.lower().startswith("hf.co/"):          # sprawdź repozytorium przed pobraniem – czytelny błąd zamiast „400”
                try:
                    info = llm.hf_files(nm[6:].split(":")[0], ENGINE.hw, SETTINGS.get("hf_token"))
                    if not info["files"]:
                        return self._json({"ok": False, "error": llm.pull_error(nm, "not gguf")}, 400)
                    q = nm.split(":")[1].upper() if ":" in nm else None
                    if q and not any(f["quant"] == q for f in info["files"]):
                        return self._json({"ok": False, "error": i18n.L(f"W repozytorium nie ma wariantu {q}. Dostępne: ", f"No {q} variant in this repository. Available: ") + ", ".join(f["quant"] for f in info["files"] if f["quant"])}, 400)
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        return self._json({"ok": False, "error": i18n.L("Nie ma takiego repozytorium na Hugging Face (albo jest prywatne – wtedy wpisz token).", "No such repository on Hugging Face (or it is private – then enter a token).")}, 400)
                    if e.code == 401:
                        return self._json({"ok": False, "error": i18n.L("Nie ma takiego repozytorium na Hugging Face albo jest prywatne – sprawdź nazwę (wielkość liter nie ma znaczenia, ukośnik między autorem a nazwą).",
                                                                        "No such repository on Hugging Face, or it is private – check the name (author/name).")}, 400)
                    if e.code == 403:
                        return self._json({"ok": False, "error": llm.pull_error(nm, "403")}, 400)
                except Exception:
                    pass                                   # brak dostępu do API HF – spróbuj i tak
            if nm and not re.match(r"^[A-Za-z0-9][\w.\-/]*(:[\w.\-]+)?$", nm):
                return self._json({"ok": False, "error": i18n.L("Niepoprawna nazwa modelu (np. qwen3:14b albo hf.co/użytkownik/model:Q4_K_M).", "Invalid model name (e.g. qwen3:14b or hf.co/user/model:Q4_K_M).")}, 400)
            if ENGINE.backend != "ollama":
                return self._json({"ok": False, "error": i18n.L("Pobieranie działa tylko z Ollamą (w LM Studio pobierz model w jego oknie).", "Downloading works only with Ollama (in LM Studio, download the model in its own window).")}, 400)
            if ENGINE.pull["active"]:
                return self._json({"ok": False, "error": i18n.L("Już coś się pobiera.", "A download is already running."), "pull": ENGINE.pull}, 409)
            ENGINE.pull_model(nm or None)
            return self._json({"ok": True, "pull": ENGINE.pull})
        if p == "/api/model/delete":
            nm = str(self._body().get("name") or "").strip()
            if nm == ENGINE.model and CFG["ai"].get("model", "auto") != "auto":
                return self._json({"ok": False, "error": i18n.L("To aktywny model – najpierw wybierz inny.", "This is the active model – choose another one first.")}, 400)
            try:
                ENGINE.delete_model(nm); ENGINE._choose(); log(i18n.L(f"Usunięto model {nm}.", f"Deleted model {nm}."))
                return self._json(dict(ENGINE.models_view(), ok=True))
            except Exception as e:
                return self._json({"ok": False, "error": str(e)[:200]}, 400)
        if p == "/api/model/use":
            ok, msg = save_settings({"model": str(self._body().get("name") or "auto")})
            return self._json(dict(ENGINE.models_view(), ok=ok, error=msg))
        if p == "/api/model/rescan":
            ENGINE.refresh(); return self._json(ENGINE.status())
        if p == "/api/ask":
            q = (self._body().get("q") or "").strip()[:500]
            with STATE_LOCK: st = STATE
            op = CFG["operator"].get("name") or CFG["operator"].get("callsign") or "operator"
            user = "DANE:\n" + analyst.context_for(st, q, AI_ASK.ctx * 2) + f"\n\n" + i18n.L("ZAPYTANIE OPERATORA", "OPERATOR QUERY") + f" ({op}): " + q
            return self._stream(AI_ASK.chat_stream(analyst.ASK_SYS, user))
        if p == "/api/ask/history":
            q = (self._body().get("q") or "").strip()[:500]
            user = "DANE Z ARCHIWUM:\n" + history_context(q, AI_ASK.ctx * 2) + "\n\n" + i18n.L("PYTANIE", "QUESTION") + ": " + q
            return self._stream(AI_ASK.chat_stream(HIST_SYS, user, 0.3))
        if p == "/api/intg":
            if not self._local():
                return self._json({"error": "local only"}, 403)
            save_intg(self._body())
            return self._json(intg_view())
        if p == "/api/intg/test-mail":
            if not self._local():
                return self._json({"error": "local only"}, 403)
            try:
                n = MAILIN.test(); MAILIN.wake.set()
                return self._json({"ok": True, "n": n})
            except Exception as e:
                return self._json({"ok": False, "error": str(e)[:200]})
        if p == "/api/intg/test-ha":
            ok = NOTIFY.ha("test", i18n.L("Test połączenia KRONOS-7 → Home Assistant", "KRONOS-7 → Home Assistant connection test"), {"level": (STATE.get("threat") or {}).get("level")})
            time.sleep(2)
            return self._json({"ok": ok and NOTIFY.ha_err is None, "error": NOTIFY.ha_err or (None if ok else "brak adresu webhooka")})
        if p == "/api/sats/explain":
            norad = int(self._body().get("norad") or 0)
            info = SATINFO.get(norad)
            return self._stream(AI_ASK.chat_stream(satinfo.EXPLAIN_SYS, "DANE SATELITY:\n" + SATINFO.explain_prompt(info), 0.3))
        if p == "/api/sitrep":
            region = (self._body().get("region") or "").strip()[:120]
            with STATE_LOCK: st = STATE
            user = f"REGION LUB TEMAT: {region}\n\nDANE:\n" + analyst.context_for(st, region, AI_ASK.ctx * 2)
            return self._stream(AI_ASK.chat_stream(analyst.SITREP_SYS, user, 0.3))
        self.send_error(404)


def main():
    port = int(os.environ.get("KRONOS_PORT", CFG.get("port", 7707)))
    st = ENGINE.status()
    log("KRONOS-7 v3.19 · start")
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
    HIST.start(AIR, SEA, lambda: STATE, lambda: MARKETS["data"], MARSEC)
    if os.environ.get("KRONOS_NO_LIVE") != "1" or os.environ.get("KRONOS_MARSEC") == "1":
        MARSEC.start(AI_BG, lambda: JOB["running"], lambda: SETTINGS.get("ai_bg", "after"))
        TGOSINT.ai = AI_BG; TGOSINT.busy = lambda: JOB["running"]; TGOSINT.bg = lambda: SETTINGS.get("ai_bg", "after")
        for src in (UAALERT, DEEPST, NOTAMS, DARKSAR, TGOSINT, LADSB, LAIS, APRSIS, MAILIN, AISTCP, AISHUB, VGRAPH, RADIATION, ACLED, CORR):
            src.start()
        HIST.extra = [("ua", UAALERT), ("osint", TGOSINT), ("rad", RADIATION), ("corr", CORR)]
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
