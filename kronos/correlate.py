"""Zdarzenia złożone (v3.17): to samo miejsce i czas w kilku warstwach danych = jedno zdarzenie, nie kilka alarmów.
1) Zbieranie sygnałów z warstw (samoloty, statki, alarmy UA, incydenty morskie, Telegram OSINT, NOTAM, zakłócenia GPS,
   pożary FIRMS, trzęsienia ziemi, promieniowanie, ACLED).
2) Grupowanie po odległości i czasie; zdarzenie złożone = co najmniej dwie różne warstwy, w tym jedna „ostra”
   (stałe tło, np. codzienne zakłócanie GPS nad Kaliningradem, samo z siebie nie tworzy zdarzenia).
3) AI ocenia każde nowe lub zmienione zdarzenie: czy sygnały są powiązane, czy to rutyna, co się prawdopodobnie dzieje,
   waga 1–5, czy to to samo co inne zdarzenie (scalanie).
4) Powiadomienia: jedno na zdarzenie (ponownie tylko przy wzroście wagi); pojedyncze alarmy z tego rejonu są wtedy wyciszane."""
import hashlib, math, threading, time
from collections import deque

from . import i18n

LAYER = {   # warstwa: (nazwa PL, nazwa EN, promień km, „ostra”)
    "air": ("samoloty", "aircraft", 150, True), "sea": ("statki", "ships", 80, True), "ua": ("alarmy UA", "UA air alerts", 120, True),
    "marsec": ("incydent morski", "maritime incident", 120, True), "osint": ("Telegram OSINT", "Telegram OSINT", 80, True),
    "notam": ("NOTAM", "NOTAM", 150, False), "gps": ("zakłócenia GPS", "GPS jamming", 120, False), "fire": ("pożary (satelita)", "fires (satellite)", 40, True),
    "quake": ("trzęsienie ziemi", "earthquake", 250, True), "rad": ("promieniowanie", "radiation", 120, True), "acled": ("ACLED", "ACLED", 40, True),
    "il": ("alarmy w Izraelu", "Israel alerts", 60, True), "gc": ("GeoConfirmed", "GeoConfirmed", 30, True), "net": ("wyłączenie internetu", "internet outage", 400, True),
}
WINDOW = 36 * 3600 * 1000


def km(a, b):
    r = math.pi / 180
    x = math.sin((b[0] - a[0]) * r / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin((b[1] - a[1]) * r / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(x)))


class Correlator:
    def __init__(self, log, collect, ai=None, busy=lambda: False, notify=None):
        self.log, self.collect, self.ai, self.busy, self.notify = log, collect, ai, busy, notify
        self.inc = {}                 # id -> zdarzenie
        self.lock = threading.Lock()
        self.last_ai = 0
        self.events = deque(maxlen=40)
        self.status = {"ok": None, "err": None, "at": None, "n": 0}

    # ------------------------------------------------------------ grupowanie
    def _cluster(self, sigs):
        now = time.time() * 1000
        sigs = [s for s in sigs if now - s["t"] < WINDOW and s.get("lat") is not None]
        sigs.sort(key=lambda s: s["t"])
        groups = []
        for s in sigs:
            p = (s["lat"], s["lon"]); best, bd = None, 1e9
            for g in groups:
                d = km(p, g["c"])
                if d < max(LAYER[s["layer"]][2], g["r"]) and d < bd and s["t"] - g["last"] < 12 * 3600e3:
                    best, bd = g, d
            if best:
                best["sig"].append(s); n = len(best["sig"])
                best["c"] = ((best["c"][0] * (n - 1) + p[0]) / n, (best["c"][1] * (n - 1) + p[1]) / n)
                best["r"] = max(best["r"], LAYER[s["layer"]][2]); best["last"] = max(best["last"], s["t"])
            else:
                groups.append({"sig": [s], "c": p, "r": LAYER[s["layer"]][2], "last": s["t"]})
        out = []
        for g in groups:
            layers = sorted({s["layer"] for s in g["sig"]})
            if len(layers) < 2 or not any(LAYER[l][3] for l in layers):
                continue
            ext = max(km(g["c"], (s["lat"], s["lon"])) for s in g["sig"])
            out.append({"sig": g["sig"], "c": g["c"], "ext": ext, "layers": layers, "first": min(s["t"] for s in g["sig"]), "last": g["last"]})
        return out

    def run(self):
        sigs = self.collect()
        groups = self._cluster(sigs)
        with self.lock:
            old = self.inc; new = {}
            for g in groups:
                ids = {s["id"] for s in g["sig"]}
                # zachowaj identyfikator zdarzenia, które ma najwięcej wspólnych sygnałów
                prev = max(old.values(), key=lambda i: len(ids & set(i["sids"])), default=None)
                if prev and ids & set(prev["sids"]) and prev["id"] not in new:
                    inc = dict(prev)
                else:
                    inc = {"id": "c" + hashlib.sha1(min(ids).encode()).hexdigest()[:8], "born": int(time.time() * 1000), "ai": None, "notified": 0, "sig_ai": ""}
                while inc["id"] in new:
                    inc["id"] += "x"
                inc.update(sids=sorted(ids), lat=round(g["c"][0], 3), lon=round(g["c"][1], 3), ext=round(g["ext"]), layers=g["layers"],
                           first=g["first"], last=g["last"], sig=sorted(g["sig"], key=lambda s: -s["t"])[:30], n=len(g["sig"]))
                # scalone wcześniej przez AI z innym – trzymamy wskazanie
                new[inc["id"]] = inc
            self.inc = new
        self._assess()
        self.status.update(ok=True, err=None, at=int(time.time() * 1000), n=sum(1 for i in self.inc.values() if self.visible(i)))

    @staticmethod
    def visible(i):
        a = i.get("ai") or {}
        return not i.get("merged") and a.get("related", True) is not False

    # ------------------------------------------------------------ ocena AI
    def _sig_key(self, i):
        return ",".join(i["layers"]) + f"|{min(i['n'], 12)}"

    def _assess(self):
        if not self.ai or self.busy():
            return
        try:
            if not self.ai.status().get("ready"):
                return
        except Exception:
            return
        todo = [i for i in self.inc.values() if i["sig_ai"] != self._sig_key(i)]
        if not todo or time.time() - self.last_ai < 120:
            return
        self.last_ai = time.time()
        todo.sort(key=lambda i: -i["last"]); todo = todo[:6]
        en = i18n.en()
        others = [i for i in self.inc.values() if i not in todo and i.get("ai")][:12]
        lines = []
        for i in todo:
            sl = "\n".join(f"    - [{LAYER[s['layer']][1 if en else 0]}] {time.strftime('%d.%m %H:%M', time.gmtime(s['t'] / 1000))} UTC: {s['text'][:220]}" for s in i["sig"][:14])
            lines.append(f"ZDARZENIE {i['id']} · okolice {i['lat']}, {i['lon']} (zasięg ok. {i['ext']} km)\n{sl}")
        ref = "\n".join(f"  {o['id']}: {(o.get('ai') or {}).get('title')}" for o in others) or "  (brak)"
        schema = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "related": {"type": "boolean"}, "routine": {"type": "boolean"}, "title": {"type": "string"}, "assess": {"type": "string"},
            "sev": {"type": "integer"}, "merge_with": {"type": "string"}}, "required": ["id", "related", "routine", "title", "assess", "sev", "merge_with"]}}}, "required": ["items"]}
        prompt = (f"Poniżej grupy sygnałów z różnych źródeł, które wystąpiły w tym samym rejonie i czasie. Dla każdej oceń:\n"
                  f"- related: czy sygnały prawdopodobnie dotyczą tego samego wydarzenia lub sytuacji (false = przypadkowa zbieżność),\n"
                  f"- routine: czy to codzienne tło (np. stałe zakłócanie GPS, rutynowe patrole, ćwiczenia ogłoszone NOTAM-em),\n"
                  f"- title: krótki tytuł (do 70 znaków), assess: 2–3 zdania – co się prawdopodobnie dzieje i jak sygnały się łączą; zaznacz niepewność,\n"
                  f"- sev: waga 1 (tło) do 5 (poważny incydent, zagrożenie życia lub eskalacja),\n"
                  f"- merge_with: identyfikator jednego z już znanych zdarzeń, jeśli to to samo zdarzenie; inaczej pusty tekst.\n"
                  f"Pisz {'po angielsku' if en else 'po polsku'}. Komunikaty stron wojny traktuj jako twierdzenia.\n\nZNANE ZDARZENIA:\n{ref}\n\n" + "\n\n".join(lines))
        try:
            r = self.ai.chat_json("Jesteś analitykiem fuzji danych wywiadowczych (all-source) systemu KRONOS-7. Rzeczowo, bez dramatyzowania.", prompt, schema, temperature=0.1)
        except Exception as e:
            self.status["err"] = str(e)[:160]
            return
        with self.lock:
            for x in r.get("items", []):
                i = self.inc.get(str(x.get("id")))
                if not i:
                    continue
                m = str(x.get("merge_with") or "").strip()
                if m and m in self.inc and m != i["id"]:
                    i["merged"] = m
                    tgt = self.inc[m]; tgt["sids"] = sorted(set(tgt["sids"]) | set(i["sids"]))
                i["ai"] = {"related": bool(x.get("related", True)), "routine": bool(x.get("routine")), "title": str(x.get("title") or "")[:90],
                           "assess": str(x.get("assess") or "")[:700], "sev": max(1, min(5, int(x.get("sev") or 2)))}
                i["sig_ai"] = self._sig_key(i)
                a = i["ai"]
                if self.visible(i) and not a["routine"] and a["sev"] >= 3 and a["sev"] > i.get("notified", 0):
                    i["notified"] = a["sev"]
                    lay = ", ".join(LAYER[l][1 if i18n.en() else 0] for l in i["layers"])
                    ev = {"kind": "corr", "at": int(time.time() * 1000), "id": i["id"], "lat": i["lat"], "lon": i["lon"],
                          "msg": f"{a['title']} — {a['assess'][:260]} ({lay}; {i18n.L('waga', 'severity')} {a['sev']}/5)"}
                    self.events.append(ev)

    # ------------------------------------------------------------ wyciszanie pojedynczych alarmów
    def covered(self, lat, lon, within_h=3):
        """Czy w tym miejscu jest już zgłoszone zdarzenie złożone (wtedy pojedynczy alarm z tego rejonu nie idzie na telefon)."""
        if lat is None or lon is None:
            return None
        now = time.time() * 1000
        with self.lock:
            for i in self.inc.values():
                if i.get("notified") and now - i["last"] < within_h * 3600e3 and km((lat, lon), (i["lat"], i["lon"])) < max(80, i["ext"] + 40):
                    return i
        return None

    def view(self):
        en = i18n.en()
        with self.lock:
            out = []
            for i in self.inc.values():
                if i.get("merged"):
                    continue
                a = i.get("ai") or {}
                out.append({"id": i["id"], "lat": i["lat"], "lon": i["lon"], "ext": i["ext"], "layers": i["layers"],
                            "lnames": [LAYER[l][1 if en else 0] for l in i["layers"]], "first": i["first"], "last": i["last"], "n": i["n"],
                            "ai": a or None, "hidden": a.get("related") is False,
                            "sig": [{"layer": s["layer"], "ln": LAYER[s["layer"]][1 if en else 0], "t": s["t"], "text": s["text"][:200], "go": s.get("go")} for s in i["sig"][:20]]})
        out.sort(key=lambda x: (-(x["ai"] or {}).get("sev", 2) if not x["hidden"] else 9, -x["last"]))
        return out

    def brief(self):
        return [{"when": time.strftime("%d.%m %H:%M", time.gmtime(x["last"] / 1000)), "title": (x["ai"] or {}).get("title") or ", ".join(x["lnames"]),
                 "layers": ", ".join(x["lnames"]), "sev": (x["ai"] or {}).get("sev"), "assess": (x["ai"] or {}).get("assess")}
                for x in self.view() if not x["hidden"] and not (x["ai"] or {}).get("routine")][:10]

    def loop(self):
        time.sleep(60)
        while True:
            try:
                self.run()
            except Exception as e:
                self.status.update(ok=False, err=str(e)[:200], at=int(time.time() * 1000))
                self.log(f"Korelacje: {e}")
            time.sleep(90)

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="correlate").start()
