"""Potok analityczny: surowe dane -> stan terminala, z pomocą lokalnego AI."""
import copy, hashlib, json, re
from datetime import datetime, timedelta, timezone

from . import i18n
from . import collector, feeds, modules

SYS = ("Jesteś analitykiem planetarnego systemu wywiadowczego KRONOS-7. Piszesz po polsku, rzeczowo i krótko, "
       "własnymi słowami (bez cytowania źródeł). Nie wymyślasz faktów: opierasz się tylko na danych od użytkownika. "
       "Gdy czegoś nie wiadomo, mówisz to wprost.")

SECTORS = ["conflict", "geo", "nature", "space", "ai", "cyber", "human"]
PRIOS = ["crit", "high", "med", "low"]
TRENDS = ["new", "esc", "ongoing", "truce", "watch"]

CHOKEPOINTS = [
    {"id": "hormuz", "name": "Cieśnina Ormuz", "lat": 26.57, "lon": 56.25, "share": "ok. 20% światowej ropy",
     "kw": ["hormuz", "ormuz", "persian gulf tanker", "gulf of oman"]},
    {"id": "bab", "name": "Bab el-Mandeb", "lat": 12.6, "lon": 43.4, "share": "ok. 10% handlu morskiego, droga do Suezu",
     "kw": ["bab el-mandeb", "bab al-mandab", "red sea", "morze czerwone", "houthi ship", "huti"]},
    {"id": "suez", "name": "Kanał Sueski", "lat": 30.6, "lon": 32.33, "share": "ok. 12–15% handlu światowego",
     "kw": ["suez"]},
    {"id": "malacca", "name": "Cieśnina Malakka", "lat": 2.5, "lon": 101.2, "share": "ok. 25% handlu morskiego",
     "kw": ["malacca", "malakka", "singapore strait"]},
    {"id": "panama", "name": "Kanał Panamski", "lat": 9.08, "lon": -79.68, "share": "ok. 5% handlu morskiego",
     "kw": ["panama canal", "kanał panamski"]},
    {"id": "bosporus", "name": "Bosfor", "lat": 41.12, "lon": 29.07, "share": "ropa i zboże z Morza Czarnego",
     "kw": ["bosporus", "bosphorus", "bosfor", "turkish straits", "black sea shipping"]},
    {"id": "taiwan", "name": "Cieśnina Tajwańska", "lat": 24.3, "lon": 119.5, "share": "ok. połowa floty kontenerowej świata",
     "kw": ["taiwan strait", "cieśnina tajwańska"]},
    {"id": "gibraltar", "name": "Gibraltar", "lat": 35.95, "lon": -5.6, "share": "wejście na Morze Śródziemne",
     "kw": ["gibraltar"]},
]
CP_STATUS = ["open", "restricted", "disrupted", "closed"]


def _now():
    return datetime.now(timezone.utc)


def _short(d_iso):
    try:
        d = datetime.fromisoformat(d_iso)
        return f"{d.day} {['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][d.month-1]}"
    except Exception:
        return ""


def _hid(s):
    return "d" + hashlib.sha1(s.encode()).hexdigest()[:6]


def _num(x):
    try:
        x = float(x)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


class Pipeline:
    def __init__(self, cfg, engine, log, progress):
        self.cfg, self.ai, self.log, self.progress = cfg, engine, log, progress

    # ------------------------------------------------------------ główny przebieg
    def run(self, prev):
        st = copy.deepcopy(prev) if prev else {}
        prev_keys = {i.get("key") for i in prev.get("items", [])} if prev else set()
        prev_trends = {c["id"]: c.get("trend") for c in prev.get("conflicts", [])} if prev else {}
        prev_haz = {h["name"] for h in prev.get("hazards", [])} if prev else set()
        prev_mods = {k: {x.get("id") for x in (prev or {}).get(k, [])} for k in modules.SPECS}
        ai_ok = self.ai.status()["ready"]
        ratings = self.cfg.get("source_ratings", {})

        self.progress("Pobieranie wiadomości", 5)
        raw, rep_news = collector.news(self.cfg, self.log)
        clusters = collector.cluster(raw, ratings)
        self.log(f"Wiadomości: {len(raw)} → {len(clusters)} zdarzeń po złączeniu.")

        self.progress("Zagrożenia naturalne", 15)
        haz, rep_haz = collector.hazards(self.log)

        self.progress("Feedy automatyczne (16 źródeł)", 18)
        st["feeds"] = feeds.run((prev or {}).get("feeds"), self.log)

        self.progress("Orbity i rynki", 22)
        tle = collector.tle(self.cfg["satellites"], self.log)
        mk = collector.markets(self.cfg)

        if tle: st["tle"] = tle
        st["markets_snapshot"] = mk
        st["sources_report"] = rep_news + rep_haz
        if haz or not st.get("hazards"):
            st["hazards"] = haz

        conflicts = st.setdefault("conflicts", [])
        top = clusters[: self.cfg["ai"].get("max_items_to_analyse", 60)]

        if not ai_ok:
            self.log("Brak modelu AI: zapisuję surowe dane bez analizy.")
            st["items"] = [self._raw_item(c) for c in top[:40]] or st.get("items", [])
        else:
            self.progress("AI: klasyfikacja depesz", 30)
            st["items"] = self.classify(top, conflicts) or st.get("items", [])
            self.progress("AI: rejestr konfliktów", 52)
            self.update_conflicts(conflicts, st["items"])
            modules.run_all(self.ai, st, clusters, st["items"], self.log, self.progress)
            self.progress("AI: łańcuch przyczyn", 87)
            ch = self.chain(st["items"], conflicts, mk)
            if ch: st["chain"] = ch
            self.progress("AI: tłumaczenie zagrożeń", 90)
            self.translate_hazards(st["hazards"])

        # zmiany od poprzedniego odczytu
        ch = {"new_items": [i["id"] for i in st.get("items", []) if i.get("key") not in prev_keys],
              "trend_changes": [{"id": c["id"], "from": prev_trends[c["id"]], "to": c.get("trend")}
                                for c in conflicts if c["id"] in prev_trends and prev_trends[c["id"]] != c.get("trend")],
              "new_conflicts": [c["id"] for c in conflicts if c["id"] not in prev_trends],
              "new_hazards": [h["name"] for h in st.get("hazards", []) if h["name"] not in prev_haz],
              "new_mods": {k: [x["id"] for x in st.get(k, []) if x.get("id") not in prev_mods.get(k, set())] for k in modules.SPECS},
              "new_moves": sum(1 for f in st.get("fronts", []) for m in f.get("moves", []) if m.get("d") and m.get("ai") and (m["d"] + "T23:59") > (prev.get("stamp") or "")[:16]),
              "since": prev.get("stamp") if prev else None}
        st["changes"] = ch

        if ai_ok:
            self.progress("AI: ocena zagrożenia i briefing", 92)
            self.assess(st)
        st.setdefault("threat", {"level": 3, "label": "BRAK OCENY", "note": "Uruchom analizę z modelem AI."})
        hist = st.setdefault("threat_history", [])
        hist.append({"t": _now().isoformat(), "level": st["threat"]["level"]})
        st["threat_history"] = hist[-90:]
        st["stamp"] = datetime.now().astimezone().isoformat(timespec="seconds")
        st["model"] = self.ai.model if ai_ok else None
        self.progress("Gotowe", 100)
        return st

    # ------------------------------------------------------------ elementy
    def _raw_item(self, c):
        s = {"world": "geo", "human": "human", "cyber": "cyber", "space": "space", "ai": "ai"}.get(c["hint"], "geo")
        return {"id": _hid(c["key"]), "key": c["key"], "s": s, "p": "med", "t": _short(c["date"]), "date": c["date"],
                "loc": None, "lat": None, "lon": None, "h": c["title"], "b": c["summary"][:280], "why": "",
                "src": c["source"], "u": c["url"], "sources": c["sources"], "links": c["links"],
                "rel": c["reliability"], "info": c["info"], "claim": False, "conflict": "", "raw": True}

    def classify(self, clusters, conflicts):
        schema = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
            "i": {"type": "integer"}, "keep": {"type": "boolean"},
            "s": {"type": "string", "enum": SECTORS}, "p": {"type": "string", "enum": PRIOS},
            "place": {"type": "string"}, "lat": {"type": ["number", "null"]}, "lon": {"type": ["number", "null"]},
            "conflict": {"type": "string"}, "h": {"type": "string"}, "b": {"type": "string"}, "why": {"type": "string"},
            "claim": {"type": "boolean"}},
            "required": ["i", "keep", "s", "p", "place", "lat", "lon", "conflict", "h", "b", "why", "claim"]}}},
            "required": ["items"]}
        conf_list = "\n".join(f"- {c['id']}: {c['name']}" for c in conflicts)
        bs = self.cfg["ai"].get("batch_size", 8)
        out = []
        for k in range(0, len(clusters), bs):
            batch = clusters[k:k + bs]
            self.progress(f"AI: klasyfikacja depesz {k + len(batch)}/{len(clusters)}", 30 + 25 * (k + len(batch)) / len(clusters))
            lines = "\n\n".join(f"[{k + n}] {c['title']}\n{c['summary'][:350]}\nŹródło: {c['source']} ({c['corroboration']} źródeł)"
                                for n, c in enumerate(batch))
            prompt = f"""Oceń poniższe wiadomości dla planetarnego systemu wywiadowczego.
Dla każdej zwróć obiekt z polem i (numer w nawiasie) oraz:
- keep: true tylko dla spraw o znaczeniu międzynarodowym (konflikty, geopolityka, gospodarka światowa, katastrofy, kosmos, AI, cyberbezpieczeństwo, kryzysy humanitarne). false dla sportu, rozrywki, plotek, lokalnej przestępczości i porad.
- s: sektor: conflict (walki, ataki, wojsko), geo (polityka, dyplomacja, gospodarka, protesty), nature (katastrofy naturalne, klimat), space, ai, cyber, human (głód, uchodźcy, pomoc humanitarna).
- p: priorytet: crit (ofiary masowe, nowa wojna, zagrożenie globalne), high (poważna eskalacja lub ważna decyzja), med, low.
- place: miejsce zdarzenia; lat i lon: przybliżone współrzędne tego miejsca (null, gdy sprawa nie ma miejsca).
- conflict: id konfliktu z listy, jeśli wiadomość go dotyczy, inaczej pusty tekst.
- h: polski nagłówek do 80 znaków. b: co się stało, 1–2 zdania. why: dlaczego to się dzieje lub dlaczego to ważne, 1 zdanie.
- claim: true, jeśli główna informacja to tylko deklaracja jednej ze stron konfliktu (np. "Iran twierdzi").

Konflikty w rejestrze:
{conf_list}

Wiadomości:
{lines}"""
            try:
                res = self.ai.chat_json(SYS, prompt, schema)
            except Exception as e:
                self.log(f"AI klasyfikacja – błąd partii: {e}")
                out += [self._raw_item(c) for c in batch[:3]]
                continue
            for r in res.get("items", []):
                i = r.get("i")
                if not isinstance(i, int) or not (k <= i < k + len(batch)) or not r.get("keep"):
                    continue
                c = clusters[i]
                info = c["info"]
                if r.get("claim"):
                    info = 4 if c["corroboration"] < 2 else max(info, 3)
                cid = r.get("conflict", "")
                if cid not in {x["id"] for x in conflicts}:
                    cid = ""
                out.append({"id": _hid(c["key"]), "key": c["key"], "s": r.get("s") if r.get("s") in SECTORS else "geo",
                            "p": r.get("p") if r.get("p") in PRIOS else "med", "t": _short(c["date"]), "date": c["date"],
                            "loc": cid or None, "place": r.get("place", ""), "lat": _num(r.get("lat")), "lon": _num(r.get("lon")),
                            "h": r.get("h") or c["title"], "b": r.get("b", ""), "why": r.get("why", ""),
                            "src": c["source"], "u": c["url"], "sources": c["sources"], "links": c["links"],
                            "rel": c["reliability"], "info": info, "claim": bool(r.get("claim")), "conflict": cid})
        order = {p: n for n, p in enumerate(PRIOS)}
        out.sort(key=lambda x: x["date"], reverse=True)
        out.sort(key=lambda x: order[x["p"]])
        return out[:45]

    def update_conflicts(self, conflicts, items):
        schema = {"type": "object", "properties": {
            "trend": {"type": "string", "enum": TRENDS}, "what": {"type": "string"}, "why": {"type": "string"},
            "latest": {"type": "string"},
            "timeline_add": {"type": "array", "items": {"type": "object", "properties": {"d": {"type": "string"}, "e": {"type": "string"}}, "required": ["d", "e"]}},
            "scenarios": {"type": "array", "items": {"type": "object", "properties": {
                "name": {"type": "string"}, "prob": {"type": "integer"}, "desc": {"type": "string"},
                "signals": {"type": "array", "items": {"type": "string"}}}, "required": ["name", "prob", "desc", "signals"]}}},
            "required": ["trend", "what", "why", "latest", "timeline_add", "scenarios"]}
        now = _now()
        todo = []
        for c in conflicts:
            rel = [i for i in items if i.get("conflict") == c["id"]]
            if rel:
                c["last_seen"] = now.isoformat()
            stale = not c.get("scen_at") or (now - datetime.fromisoformat(c["scen_at"])).total_seconds() > 20 * 3600
            if rel or stale:
                todo.append((c, rel))
            elif c.get("last_seen") and (now - datetime.fromisoformat(c["last_seen"])).days > 14 and c.get("trend") != "esc":
                c["trend"] = "watch"
        for n, (c, rel) in enumerate(todo):
            self.progress(f"AI: konflikt {c['name']}", 55 + 10 * n / max(1, len(todo)))
            news = "\n".join(f"- [{i['date'][:10]}] {i['h']}. {i['b']} (źródło: {i['src']}, wiarygodność {i['rel']}{i['info']})" for i in rel) or "(brak nowych wiadomości)"
            tl = "\n".join(f"- {t['d']}: {t['e']}" for t in c.get("timeline", [])[-8:])
            prompt = f"""Zaktualizuj kartę konfliktu na podstawie nowych wiadomości. Dzisiaj: {now.date().isoformat()}.

KARTA: {c['name']} (od {c.get('since','?')})
Status: {c.get('trend')}
Co: {c.get('what','')}
Dlaczego: {c.get('why','')}
Ostatnio: {c.get('latest','')}
Oś czasu (ostatnie):
{tl or '(pusta)'}

NOWE WIADOMOŚCI:
{news}

Zwróć:
- trend: new (nowy konflikt), esc (wyraźna eskalacja), ongoing (trwa bez dużej zmiany), truce (rozejm, choć kruchy), watch (wygasa, tylko obserwacja). Zmieniaj tylko, gdy wiadomości to uzasadniają.
- what, why: krótko (1–2 zdania); why ma wyjaśniać przyczyny konfliktu.
- latest: 1–3 zdania o najnowszej sytuacji z liczbami, jeśli są.
- timeline_add: nowe ważne zdarzenia do osi czasu (d w formacie RRRR-MM-DD, e do 90 znaków); pusta lista, jeśli nic nowego.
- scenarios: 2 lub 3 scenariusze na najbliższe 30 dni; prob w procentach (suma ok. 100); desc 1 zdanie; signals: 2–3 sygnały, które wskażą, że scenariusz się realizuje."""
            try:
                r = self.ai.chat_json(SYS, prompt, schema, temperature=0.3)
            except Exception as e:
                self.log(f"AI konflikt {c['id']} – błąd: {e}")
                continue
            if r.get("trend") in TRENDS: c["trend"] = r["trend"]
            for f in ("what", "why", "latest"):
                if r.get(f): c[f] = r[f]
            tl = c.setdefault("timeline", [])
            seen = {t["e"] for t in tl}
            for t in r.get("timeline_add", [])[:4]:
                if t.get("e") and t["e"] not in seen and re.match(r"\d{4}-\d{2}-\d{2}", t.get("d", "")):
                    tl.append({"d": t["d"][:10], "e": t["e"][:120]})
            tl.sort(key=lambda t: t["d"]); c["timeline"] = tl[-25:]
            sc = [s for s in r.get("scenarios", []) if s.get("name")][:3]
            if sc:
                c["scenarios"], c["scen_at"] = sc, now.isoformat()
            srcs = {u for _, u in c.get("src", [])}
            for i in rel[:3]:
                if i["u"] not in srcs:
                    c.setdefault("src", []).append([i["src"], i["u"]])
            c["src"] = c.get("src", [])[-6:]
            c["updated"] = now.isoformat()
        self.new_conflicts(conflicts, items)

    def new_conflicts(self, conflicts, items):
        cand = [i for i in items if i["s"] == "conflict" and not i.get("conflict") and i["p"] in ("crit", "high")]
        if not cand:
            return
        schema = {"type": "object", "properties": {"new": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "name": {"type": "string"}, "lat": {"type": "number"}, "lon": {"type": "number"},
            "since": {"type": "string"}, "what": {"type": "string"}, "why": {"type": "string"}, "latest": {"type": "string"},
            "items": {"type": "array", "items": {"type": "string"}}},
            "required": ["id", "name", "lat", "lon", "since", "what", "why", "latest", "items"]}}}, "required": ["new"]}
        listing = "\n".join(f"- {c['id']}: {c['name']}" for c in conflicts)
        news = "\n".join(f"[{i['id']}] {i['h']}. {i['b']} ({i.get('place','')})" for i in cand[:12])
        prompt = f"""Czy poniższe wiadomości opisują NOWY konflikt zbrojny lub poważny kryzys bezpieczeństwa, którego nie ma w rejestrze?
Rejestr:
{listing}

Wiadomości:
{news}

Zwróć listę new (może być pusta). id: krótki identyfikator łacińskimi literami (np. "ven"), name po polsku, lat/lon centrum, since (miesiąc i rok), what, why (przyczyny), latest, items: id wiadomości, których dotyczy."""
        try:
            r = self.ai.chat_json(SYS, prompt, schema)
        except Exception as e:
            self.log(f"AI nowe konflikty – błąd: {e}"); return
        have = {c["id"] for c in conflicts}
        for n in r.get("new", [])[:3]:
            cid = re.sub(r"[^a-z0-9]", "", n.get("id", "").lower())[:10]
            if not cid or cid in have or _num(n.get("lat")) is None:
                continue
            rel = [i for i in items if i["id"] in n.get("items", [])]
            for i in rel:
                i["conflict"] = i["loc"] = cid
            conflicts.append({"id": cid, "name": n["name"], "lat": _num(n["lat"]), "lon": _num(n["lon"]), "trend": "new",
                              "since": n.get("since", ""), "what": n.get("what", ""), "why": n.get("why", ""), "latest": n.get("latest", ""),
                              "src": [[i["src"], i["u"]] for i in rel[:3]], "timeline": [], "scenarios": [],
                              "last_seen": _now().isoformat(), "updated": _now().isoformat()})
            self.log(f"Nowy konflikt w rejestrze: {n['name']}")

    def chokepoints(self, prev, clusters, items):
        prevmap = {c["id"]: c for c in (prev or [])}
        schema = {"type": "object", "properties": {"status": {"type": "string", "enum": CP_STATUS}, "note": {"type": "string"}},
                  "required": ["status", "note"]}
        out = []
        for cp in CHOKEPOINTS:
            base = {k: v for k, v in cp.items() if k != "kw"}
            old = prevmap.get(cp["id"], {})
            texts = [f"{c['title']}. {c['summary'][:200]}" for c in clusters if any(k in (c['title'] + c['summary']).lower() for k in cp["kw"])][:8]
            texts += [f"{i['h']}. {i['b']}" for i in items if any(k in (i['h'] + i['b']).lower() for k in cp["kw"])][:4]
            if texts:
                prompt = f"""Oceń stan żeglugi w miejscu: {cp['name']} ({cp['share']}) na podstawie wiadomości.
status: open (normalny ruch), restricted (utrudnienia, eskorty, omijanie), disrupted (ataki, poważne zakłócenia), closed (ruch praktycznie wstrzymany).
note: 1–2 zdania po polsku, co się dzieje i dlaczego.

Wiadomości:
""" + "\n".join("- " + t for t in texts)
                try:
                    r = self.ai.chat_json(SYS, prompt, schema)
                    base.update(status=r["status"] if r.get("status") in CP_STATUS else "open", note=r.get("note", ""), checked=_now().isoformat(), evidence=len(texts))
                except Exception as e:
                    self.log(f"AI gardło {cp['id']} – błąd: {e}")
                    base.update(status=old.get("status", "open"), note=old.get("note", ""), checked=old.get("checked"))
            else:
                base.update(status=old.get("status", "open"), note=old.get("note") or "Brak sygnałów zakłóceń w bieżących wiadomościach.",
                            checked=old.get("checked"), evidence=0)
            out.append(base)
        return out

    def chain(self, items, conflicts, mk):
        schema = {"type": "object", "properties": {
            "nodes": {"type": "array", "items": {"type": "object", "properties": {
                "id": {"type": "string"}, "label": {"type": "string"},
                "type": {"type": "string", "enum": ["conflict", "event", "market", "social", "policy", "nature"]},
                "ref": {"type": "string"}}, "required": ["id", "label", "type", "ref"]}},
            "edges": {"type": "array", "items": {"type": "object", "properties": {
                "from": {"type": "string"}, "to": {"type": "string"}, "label": {"type": "string"}}, "required": ["from", "to", "label"]}}},
            "required": ["nodes", "edges"]}
        mlines = "\n".join(f"- {m['label']}: {m.get('price')} {m['unit']} ({m.get('change_pct', 0):+.1f}% w 5 dni)" for m in mk.get("items", []) if m.get("price"))
        clines = "\n".join(f"- [{c['id']}] {c['name']} ({c.get('trend')}): {c.get('latest','')}" for c in conflicts if c.get("trend") in ("new", "esc", "ongoing"))
        ilines = "\n".join(f"- [{i['id']}] {i['h']}. Dlaczego: {i['why']}" for i in items[:28])
        prompt = f"""Zbuduj graf przyczynowo-skutkowy, który wyjaśnia, jak bieżące zdarzenia na świecie wpływają na siebie.
Używaj tylko powiązań, które wynikają z danych lub są powszechnie znanym mechanizmem (np. zakłócenia dostaw ropy podnoszą ceny paliw).
Węzły: 8–16. id węzła: jeśli węzeł to konflikt lub depesza z listy, użyj jej id w nawiasie (np. "iran", "d1a2b3c") i wpisz to samo w ref; inaczej własne krótkie id i ref pusty.
type: conflict, event, market, social (protesty, migracja, głód), policy (decyzje rządów, sankcje, banki centralne), nature.
label: do 40 znaków po polsku. Krawędzie: from -> to, label: krótko, jak przyczyna działa (do 40 znaków).

KONFLIKTY:
{clines}

RYNKI:
{mlines or '(brak danych)'}

DEPESZE:
{ilines}"""
        try:
            r = self.ai.chat_json(SYS, prompt, schema, temperature=0.3)
        except Exception as e:
            self.log(f"AI łańcuch – błąd: {e}"); return None
        ids = set()
        nodes = []
        valid_refs = {c["id"] for c in conflicts} | {i["id"] for i in items}
        for n in r.get("nodes", [])[:18]:
            if n.get("id") and n["id"] not in ids:
                ids.add(n["id"])
                n["ref"] = n.get("ref") if n.get("ref") in valid_refs else (n["id"] if n["id"] in valid_refs else "")
                nodes.append(n)
        edges = [e for e in r.get("edges", []) if e.get("from") in ids and e.get("to") in ids and e["from"] != e["to"]][:30]
        return {"nodes": nodes, "edges": edges, "at": _now().isoformat()} if nodes and edges else None

    def calendar(self, items, prev, launches):
        today = _now().date().isoformat()
        schema = {"type": "object", "properties": {"events": {"type": "array", "items": {"type": "object", "properties": {
            "date": {"type": "string"}, "title": {"type": "string"}, "place": {"type": "string"}, "ref": {"type": "string"}},
            "required": ["date", "title", "place", "ref"]}}}, "required": ["events"]}
        ilines = "\n".join(f"[{i['id']}] {i['h']}. {i['b']}" for i in items[:35])
        prompt = f"""Dzisiaj jest {today}. Wypisz z depesz przyszłe wydarzenia z konkretną datą (wybory, szczyty, głosowania, terminy, ultimatum, rozmowy pokojowe, starty).
date: RRRR-MM-DD (tylko daty późniejsze niż dziś), title po polsku do 60 znaków, place, ref: id depeszy.
Jeśli nie ma takich wydarzeń, zwróć pustą listę.

{ilines}"""
        ev = []
        try:
            r = self.ai.chat_json(SYS, prompt, schema)
            ev = [dict(e, kind="event") for e in r.get("events", []) if re.match(r"\d{4}-\d{2}-\d{2}$", e.get("date", "")) and e["date"] > today]
        except Exception as e:
            self.log(f"AI kalendarz – błąd: {e}")
        keep = [e for e in (prev or []) if e.get("date", "") >= today and e.get("kind") != "launch"]
        for l in (launches or [])[:8]:
            if l.get("date") and l["date"][:10] >= today:
                ev.append({"date": l["date"][:10], "title": l["name"][:70], "place": l.get("pad", ""), "ref": "", "kind": "launch"})
        seen, out = set(), []
        for e in sorted(keep + ev, key=lambda x: x["date"]):
            k = (e["date"], e["title"].lower()[:30])
            if k not in seen:
                seen.add(k); out.append(e)
        return out[:24]

    def translate_hazards(self, hz):
        need = hz[:24]
        if not need:
            return
        schema = {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "object", "properties": {
            "i": {"type": "integer"}, "name": {"type": "string"}, "note": {"type": "string"}}, "required": ["i", "name", "note"]}}},
            "required": ["items"]}
        lines = "\n".join(f"[{n}] {h['name']} | {h['note']}" for n, h in enumerate(need))
        prompt = "Przetłumacz na polski nazwy i opisy zdarzeń naturalnych. name do 50 znaków (np. 'M6.9 Kamczatka'), note 1 zdanie.\n\n" + lines
        try:
            r = self.ai.chat_json(SYS, prompt, schema)
            for x in r.get("items", []):
                if isinstance(x.get("i"), int) and 0 <= x["i"] < len(need):
                    need[x["i"]]["name_pl"], need[x["i"]]["note"] = x.get("name") or need[x["i"]]["name"], x.get("note") or need[x["i"]]["note"]
        except Exception as e:
            self.log(f"AI tłumaczenie zagrożeń – błąd: {e}")

    def assess(self, st):
        schema = {"type": "object", "properties": {"level": {"type": "integer"}, "label": {"type": "string"},
                  "note": {"type": "string"}, "briefing": {"type": "string"}, "changes": {"type": "string"}, "markets": {"type": "string"}},
                  "required": ["level", "label", "note", "briefing", "changes", "markets"]}
        mk = "\n".join(f"- {m['label']}: {m.get('price')} ({m.get('change_pct', 0):+.1f}% / 5 dni)" for m in (st.get("markets_snapshot") or {}).get("items", []) if m.get("price"))
        op = (self.cfg.get("operator") or {}).get("name") or (self.cfg.get("operator") or {}).get("callsign") or ""
        conf = "\n".join(f"- {c['name']}: {c.get('trend')} — {c.get('latest','')}" for c in st["conflicts"])
        crit = "\n".join(f"- {i['h']} ({i['p']})" for i in st["items"] if i["p"] in ("crit", "high"))[:3000]
        haz = "\n".join(f"- {h.get('name_pl', h['name'])} {h['mag']}" for h in st["hazards"][:10])
        cps = "\n".join(f"- {c['name']}: {c['status']} — {c.get('latest','')}" for c in st.get("shipping", []) if c.get("status") != "open")
        aw = (st.get("airwar") or {}).get("days", [])[-1:] 
        extra = (f"NOC NAD UKRAINĄ: {json.dumps(aw, ensure_ascii=False)}\n"
                 f"IRAN: {(st.get('iranStatus') or {}).get('summary','')}\n"
                 f"UDERZENIA (7 dni): {len(st.get('strikes', []))}; FLANKA NATO: {'; '.join(e['t'] for e in st.get('eastflank', [])[:4])}\n"
                 f"FRONTY: {'; '.join(f['name'] + ': ' + (f.get('note') or '')[:160] for f in st.get('fronts', []))}")
        chg = st["changes"]
        prompt = f"""Oceń globalny poziom napięcia i przygotuj briefing.
level: 1 (spokój) do 5 (kryzys globalny). label: jedno słowo (NISKI, UMIARKOWANY, PODWYŻSZONY, WYSOKI, KRYTYCZNY). note: główne ogniska, do 60 znaków.
briefing: 120–170 słów po polsku do odczytania na głos przez komputer pokładowy; zacznij od "{i18n.L("Raport KRONOS-7" + (" dla operatora " + op if op else ""), "KRONOS-7 report" + (" for operator " + op if op else ""))}."; najważniejsze sprawy: co, gdzie, dlaczego. Bez list i skrótów trudnych do przeczytania.
changes: 1–2 zdania, co zmieniło się od poprzedniego odczytu.
markets: 1–2 zdania, co i DLACZEGO poruszyło rynkami (ropa, gaz, złoto, złoty, akcje), w powiązaniu z wydarzeniami.

RYNKI (5 dni):
{mk}

{extra}

KONFLIKTY:
{conf}

PILNE DEPESZE:
{crit}

ZAGROŻENIA NATURALNE:
{haz}

ŻEGLUGA (zakłócenia):
{cps or 'brak'}

ZMIANY: nowe depesze {len(chg['new_items'])}, zmiany statusu konfliktów {chg['trend_changes']}, nowe konflikty {chg['new_conflicts']}"""
        try:
            r = self.ai.chat_json(SYS, prompt, schema, temperature=0.4)
            lvl = max(1, min(5, int(r.get("level", 3))))
            st["threat"] = {"level": lvl, "label": r.get("label", "")[:14].upper(), "note": r.get("note", "")[:90]}
            st["briefing"] = r.get("briefing", "")
            st["changes"]["summary"] = r.get("changes", "")
            if r.get("markets"): st["marketsNote"] = r["markets"]
        except Exception as e:
            self.log(f"AI ocena – błąd: {e}")

    def _launch_list(self, raw, prev):
        if not raw:
            return prev or []
        out = []
        for l in raw[:8]:
            out.append({"d": _short(l["date"]) if l.get("date") else "?", "date": l.get("date"), "ok": l.get("go", False),
                        "t": f"{l['name']}" + (f" · {l['pad']}" if l.get("pad") else ""), "status": l.get("status", "")})
        return out


# ---------------------------------------------------------------- zapytania na żywo
def context_for(st, focus=None, limit=14000):
    conf = [{"id": c["id"], "name": c["name"], "trend": c.get("trend"), "what": c.get("what"), "why": c.get("why"),
             "latest": c.get("latest"), "scenarios": c.get("scenarios", [])} for c in st.get("conflicts", [])]
    items = [{"id": i["id"], "s": i["s"], "p": i["p"], "t": i.get("t"), "place": i.get("place"), "h": i["h"], "b": i["b"],
              "why": i.get("why"), "src": i["src"], "rel": f"{i.get('rel','')}{i.get('info','')}"} for i in st.get("items", [])]
    if focus:
        f = focus.lower()
        items = sorted(items, key=lambda i: -(f in (i["h"] + i["b"] + (i.get("place") or "")).lower()))
    ctx = {"stamp": st.get("stamp"), "threat": st.get("threat"), "conflicts": conf, "items": items,
           "hazards": [{"name": h.get("name_pl", h["name"]), "mag": h["mag"], "when": h["when"]} for h in st.get("hazards", [])[:15]],
           "markets": [{"label": m["label"], "price": m.get("price"), "chg": m.get("change_pct")} for m in (st.get("markets_snapshot") or {}).get("items", [])],
           "calendar": [{"d": e.get("d"), "t": e.get("t")} for e in st.get("calendar", [])[:12]],
           "iranStatus": st.get("iranStatus"),
           "fronts": [{"name": f["name"], "asOf": f.get("asOf"), "note": f.get("note"), "moves": [m.get("label") for m in f.get("moves", [])][-5:]} for f in st.get("fronts", [])],
           "airwar": (st.get("airwar") or {}).get("days", [])[-5:],
           "strikes": [{k: x.get(k) for k in ("side", "target", "when", "note")} for x in st.get("strikes", [])],
           "forces": [{k: x.get(k) for k in ("name", "where", "note")} for x in st.get("forces", [])],
           "eastflank": [{k: x.get(k) for k in ("d", "t", "note")} for x in st.get("eastflank", [])],
           "nuclear": [{k: x.get(k) for k in ("name", "status", "note")} for x in st.get("nuclear", [])],
           "sanctions": [{k: x.get(k) for k in ("d", "who", "t")} for x in st.get("sanctions", [])],
           "humanitarian": [{k: x.get(k) for k in ("t", "where", "note")} for x in st.get("humanitarian", [])],
           "shipping": [{k: x.get(k) for k in ("name", "status", "metric", "why")} for x in st.get("shipping", [])],
           "forecasts": [{"t": e["t"], "m": e["m"][:3]} for e in ((st.get("feeds") or {}).get("polymarket") or [])],
           "marketsNote": st.get("marketsNote")}
    s = json.dumps(ctx, ensure_ascii=False)
    while len(s) > limit and len(ctx["items"]) > 10:
        ctx["items"] = ctx["items"][:-3]; s = json.dumps(ctx, ensure_ascii=False)
    for k in ("forecasts", "econ", "humanitarian", "sanctions", "forces", "nuclear", "hazards", "calendar", "eastflank", "strikes", "airwar", "shipping"):
        if len(s) <= limit:
            break
        ctx.pop(k, None); s = json.dumps(ctx, ensure_ascii=False)
    for c in ctx["conflicts"]:
        if len(s) <= limit:
            break
        c.pop("scenarios", None); c.pop("what", None); s = json.dumps(ctx, ensure_ascii=False)
    return s


ASK_SYS = ("Jesteś KRONOS-7, komputer pokładowy planetarnego systemu wywiadowczego w stylu terminali z klasycznych filmów science fiction. "
           "Odpowiadasz po polsku, zwięźle (do 150 słów), tonem raportu. Opierasz się wyłącznie na DANYCH od operatora; jeśli w nich czegoś nie ma, mówisz to. "
           "Na pytania 'dlaczego' podajesz przyczyny. Ostatnia linia odpowiedzi: 'REF: ' i identyfikatory konfliktów lub depesz, których dotyczy odpowiedź, albo 'REF: brak'.")

SITREP_SYS = ("Jesteś KRONOS-7. Przygotowujesz raport sytuacyjny (SITREP) po polsku w stylu wojskowym, na podstawie wyłącznie danych operatora. "
              "Układ: 1. SYTUACJA OGÓLNA  2. KLUCZOWE ZDARZENIA (z datami)  3. PRZYCZYNY  4. OCENA I SCENARIUSZE  5. WSKAŹNIKI DO OBSERWACJI. "
              "Zwięźle, do 300 słów. Zaznaczaj, gdy informacja pochodzi tylko od jednej strony konfliktu.")
