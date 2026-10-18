"""Moduły wywiadowcze aktualizowane przez lokalne AI na podstawie świeżych wiadomości.
Każdy moduł dostaje bieżącą listę i wiadomości wybrane słowami kluczowymi, a zwraca tylko zmiany
(upsert/remove). Scalanie, identyfikatory i przycinanie starych wpisów robi kod, nie model."""
import json, re
from datetime import datetime, timedelta, timezone

SYS = ("Jesteś analitykiem planetarnego systemu wywiadowczego KRONOS-7. Piszesz po polsku, krótko, własnymi słowami. "
       "Opierasz się wyłącznie na podanych wiadomościach i bieżącej liście. Nie zgadujesz liczb ani miejsc; gdy dane są "
       "niepewne, mówisz to w notatce. Deklaracje jednej strony konfliktu oznaczasz jako deklaracje.")
MON = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]


def _now():
    return datetime.now(timezone.utc)


def _short(d):
    try:
        x = datetime.fromisoformat(d[:10]); return f"{x.day} {MON[x.month-1]}"
    except Exception:
        return ""


def _num(x):
    try:
        x = float(x); return x if x == x else None
    except (TypeError, ValueError):
        return None


def pick_news(clusters, kws, limit=14, exclude=()):
    out = []
    for c in clusters:
        t = (c["title"] + " " + c["summary"]).lower()
        if any(k in t for k in kws) and not any(x in t for x in exclude):
            out.append(c)
        if len(out) >= limit:
            break
    return out


def news_block(news):
    return "\n".join(f"[{n}] {c['date'][:10]} · {c['source']} ({c['reliability']}, {c['corroboration']} źr.): {c['title']}. {c['summary'][:300]}"
                     for n, c in enumerate(news))


def _src(news, ref):
    try:
        c = news[int(ref)]; return [c["source"] + " " + _short(c["date"]), c["url"]]
    except (TypeError, ValueError, IndexError):
        return None


S_STR = {"type": "string"}
S_NUM = {"type": ["number", "null"]}

# ---------------------------------------------------------------- moduły listowe
SPECS = {
    "strikes": {
        "title": "uderzenia dalekiego zasięgu Rosja ↔ Ukraina (cele w głębi kraju: rafinerie, energetyka, lotniska, miasta)",
        "kw": ["strike", "drone attack", "missile attack", "refinery", "oil depot", "power plant", "substation", "explosions in", "shahed", "atacms", "storm shadow", "neptune", "flamingo"],
        "must": ["russia", "ukrain", "russian", "kyiv", "moscow"],
        "fields": {"side": {"type": "string", "enum": ["ru", "ua"]}, "target": S_STR, "lat": S_NUM, "lon": S_NUM, "d": S_STR, "note": S_STR},
        "hint": "side: ru = Rosja uderza w Ukrainę, ua = Ukraina uderza w Rosję lub okupowane tereny. target: cel i miejscowość. d: data RRRR-MM-DD. lat/lon: współrzędne miejscowości. note: co trafiono i skutki, 1 zdanie.",
        "max": 14, "age": 8, "prefix": "st"},
    "eastflank": {
        "title": "incydenty na wschodniej flance NATO i wokół Polski (naruszenia przestrzeni, drony, sabotaż, kable, zagłuszanie GPS, flota cieni)",
        "kw": ["poland", "polish", "lithuania", "latvia", "estonia", "finland", "baltic", "romania", "moldova", "kaliningrad", "belarus", "nato jets", "airspace violation", "sabotage", "undersea cable", "shadow fleet", "gps jamming", "drone incursion"],
        "fields": {"d": S_STR, "t": S_STR, "lat": S_NUM, "lon": S_NUM, "kind": {"type": "string", "enum": ["airspace", "sabotage", "cable", "jamming", "military", "shadowfleet"]}, "note": S_STR},
        "hint": "t: krótki tytuł po polsku. d: RRRR-MM-DD. kind: airspace, sabotage, cable, jamming, military, shadowfleet. note: 1–2 zdania, co i dlaczego to ważne.",
        "max": 14, "age": 35, "prefix": "ef"},
    "forces": {
        "title": "rozmieszczenie sił: grupy lotniskowców, okręty, przerzuty lotnictwa i wojsk, duże ćwiczenia",
        "kw": ["carrier", "strike group", "uss ", "destroyer", "amphibious", "deploy", "fleet", "bomber", "exercise", "drill", "frigate", "warship", "marines", "usni"],
        "fields": {"kind": {"type": "string", "enum": ["cvn", "amphib", "naval", "air", "ground", "exercise"]}, "name": S_STR, "lat": S_NUM, "lon": S_NUM, "where": S_STR, "when": S_STR, "note": S_STR},
        "hint": "kind: cvn (lotniskowiec), amphib, naval, air, ground, exercise. lat/lon: przybliżony rejon. where: akwen lub region po polsku. when: data stanu (np. '16 X'). note: rola i powód.",
        "max": 14, "age": None, "prefix": "fo"},
    "airspace": {
        "title": "przestrzeń powietrzna w strefach konfliktów (zamknięcia, zalecenia EASA/FAA, omijanie przez przewoźników)",
        "kw": ["airspace", "flights suspended", "airlines", "easa", "faa", "no-fly", "flight ban", "airport closed", "reroute"],
        "fields": {"name": S_STR, "lat": S_NUM, "lon": S_NUM, "level": {"type": "string", "enum": ["closed", "avoid", "caution"]}, "note": S_STR},
        "hint": "Zmieniaj poziom tylko gdy wiadomości to uzasadniają. level: closed (zamknięta), avoid (omijać), caution (ostrożnie).",
        "max": 18, "age": None, "prefix": "as"},
    "nuclear": {
        "title": "obiekty jądrowe w strefach napięć (Zaporoska EJ i inne w Ukrainie i Rosji, obiekty Iranu, KRLD)",
        "kw": ["nuclear", "zaporizhzhia", "iaea", "grossi", "enrichment", "uranium", "reactor", "chernobyl", "kursk npp", "yongbyon", "fordow", "natanz", "isfahan"],
        "fields": {"name": S_STR, "lat": S_NUM, "lon": S_NUM, "status": {"type": "string", "enum": ["crit", "warn", "ok", "unknown"]}, "note": S_STR},
        "hint": "status: crit (bezpośrednie zagrożenie), warn, ok, unknown. note: stan i powód, 1–2 zdania.",
        "max": 10, "age": None, "prefix": "nk"},
    "sanctions": {
        "title": "sankcje i kontrola eksportu (USA, UE, UK i inni)",
        "kw": ["sanction", "ofac", "export control", "tariff", "price cap", "blacklist", "asset freeze", "embargo"],
        "fields": {"d": S_STR, "who": {"type": "string", "enum": ["USA", "UE", "UK", "inne"]}, "t": S_STR, "note": S_STR},
        "hint": "t: krótki tytuł po polsku. d: RRRR-MM-DD. note: kogo dotyczy i dlaczego.",
        "max": 12, "age": 21, "prefix": "sn"},
    "humanitarian": {
        "title": "kryzysy humanitarne i zdrowotne (głód, epidemie, przesiedlenia, pomoc)",
        "kw": ["famine", "hunger", "cholera", "ebola", "outbreak", "displaced", "refugees", "humanitarian", "aid convoy", "malnutrition", "epidemic", "wfp", "unicef", "ocha"],
        "fields": {"t": S_STR, "where": S_STR, "lat": S_NUM, "lon": S_NUM, "d": S_STR, "note": S_STR},
        "hint": "t: tytuł po polsku. where: kraj lub region. d: RRRR-MM-DD. note: skala w liczbach i przyczyna.",
        "max": 12, "age": 40, "prefix": "hu"},
    "econ": {
        "title": "wskaźniki gospodarcze związane z kryzysami (zapasy ropy EIA, ceny żywności FAO, decyzje OPEC+, banki centralne)",
        "kw": ["eia", "crude inventories", "fao food price", "opec", "central bank", "interest rate", "inflation", "federal reserve", "ecb"],
        "fields": {"k": S_STR, "v": S_STR, "note": S_STR},
        "hint": "k: nazwa wskaźnika po polsku, v: wartość ze źródła (bez zgadywania), note: okres i znaczenie.",
        "max": 6, "age": None, "prefix": "ec"},
}


def _ensure_ids(lst, prefix):
    n = 0
    for x in lst:
        if not x.get("id"):
            n += 1
            while any(y.get("id") == f"{prefix}{n}" for y in lst):
                n += 1
            x["id"] = f"{prefix}{n}"


def update_list(ai, st, key, clusters, log):
    spec = SPECS[key]
    cur = st.setdefault(key, [])
    _ensure_ids(cur, spec["prefix"])
    news = pick_news(clusters, spec["kw"])
    if spec.get("must"):
        news = [c for c in news if any(m in (c["title"] + c["summary"]).lower() for m in spec["must"])]
    if news:
        item = {"type": "object", "properties": dict({"id": S_STR, "src": {"type": "integer"}}, **spec["fields"]),
                "required": ["id", "src"] + list(spec["fields"].keys())}
        schema = {"type": "object", "properties": {"upsert": {"type": "array", "items": item}, "remove": {"type": "array", "items": S_STR}},
                  "required": ["upsert", "remove"]}
        slim = [{k: v for k, v in x.items() if k not in ("src",)} for x in cur]
        prompt = f"""Moduł: {spec['title']}. Dzisiaj {_now().date().isoformat()}.
Zaktualizuj listę na podstawie wiadomości. Zwróć:
- upsert: tylko pozycje NOWE (id "new") albo ZMIENIONE (istniejące id, pełny obiekt). Nie powtarzaj pozycji bez zmian.
- remove: id pozycji, które wygasły lub okazały się nieprawdziwe.
- src: numer wiadomości w nawiasie, na której opierasz pozycję.
{spec['hint']}
Pomijaj wiadomości niezwiązane z tematem modułu.

BIEŻĄCA LISTA:
{json.dumps(slim, ensure_ascii=False)}

WIADOMOŚCI:
{news_block(news)}"""
        try:
            r = ai.chat_json(SYS, prompt, schema, temperature=0.2)
            byid = {x["id"]: x for x in cur}
            for rid in r.get("remove", []):
                if rid in byid:
                    cur.remove(byid.pop(rid))
            for u in r.get("upsert", [])[:8]:
                src = _src(news, u.pop("src", None))
                rec = {k: u.get(k) for k in spec["fields"]}
                for k in ("lat", "lon"):
                    if k in rec: rec[k] = _num(rec[k])
                if "lat" in rec and (rec["lat"] is None or rec["lon"] is None):
                    continue
                if src: rec["src"] = src
                if u.get("id") in byid:
                    byid[u["id"]].update({k: v for k, v in rec.items() if v not in (None, "")})
                else:
                    rec["id"] = ""; cur.insert(0, rec)
            _ensure_ids(cur, spec["prefix"])
            log(f"  {key}: {len(r.get('upsert', []))} zmian, {len(r.get('remove', []))} usuniętych")
        except Exception as e:
            log(f"AI moduł {key} – błąd: {e}")
    # przycinanie
    if spec.get("age"):
        lim = (_now() - timedelta(days=spec["age"])).date().isoformat()
        cur[:] = [x for x in cur if not x.get("d") or x["d"] >= lim]
    if key in ("strikes", "eastflank", "sanctions", "humanitarian"):
        cur.sort(key=lambda x: x.get("d") or "", reverse=True)
    for x in cur:
        if key == "strikes" and x.get("d") and not x.get("when"):
            x["when"] = _short(x["d"])
    del cur[spec["max"]:]


# ---------------------------------------------------------------- noc nad Ukrainą
def airwar(ai, st, clusters, log):
    aw = st.setdefault("airwar", {"days": [], "note": "", "src": []})
    news = pick_news(clusters, ["shahed", "drones overnight", "air force", "launched", "drones and missiles", "attack drones", "shot down", "intercepted", "neutralized"])
    news = [c for c in news if any(k in (c["title"] + c["summary"]).lower() for k in ("ukrain", "russia"))]
    if not news:
        return
    schema = {"type": "object", "properties": {
        "days": {"type": "array", "items": {"type": "object", "properties": {
            "d": S_STR, "drones": {"type": ["integer", "null"]}, "missiles": {"type": ["integer", "null"]},
            "downed": {"type": ["integer", "null"]}, "note": S_STR, "src": {"type": "integer"}}, "required": ["d", "drones", "missiles", "downed", "note", "src"]}},
        "note": S_STR}, "required": ["days", "note"]}
    last = aw["days"][-4:]
    prompt = f"""Wypisz nocne ataki powietrzne Rosji na Ukrainę według raportów Sił Powietrznych Ukrainy z wiadomości.
d: data poranka po nocy ataku (RRRR-MM-DD). drones: liczba dronów, missiles: liczba rakiet (null, gdy brak danych), downed: ile zestrzelono lub zneutralizowano (null, gdy brak).
note: typy broni i skutki, 1 zdanie. Podawaj tylko liczby, które są w wiadomościach. Uwzględnij tylko noce, których nie ma w ostatnich wpisach albo które trzeba poprawić.
note (główne): trend kampanii w 1–2 zdaniach, z uwzględnieniem ostatnich wpisów.

OSTATNIE WPISY: {json.dumps(last, ensure_ascii=False)}

WIADOMOŚCI:
{news_block(news)}"""
    try:
        r = ai.chat_json(SYS, prompt, schema)
    except Exception as e:
        log(f"AI noc nad Ukrainą – błąd: {e}"); return
    byd = {d["d"]: d for d in aw["days"]}
    for d in r.get("days", []):
        if not re.match(r"\d{4}-\d{2}-\d{2}$", d.get("d", "")) or d["d"] > _now().date().isoformat():
            continue
        if d.get("drones") is None and d.get("missiles") is None:
            continue
        s = _src(news, d.pop("src", None))
        if s:
            aw.setdefault("src", [])
            if s not in aw["src"]: aw["src"] = (aw["src"] + [s])[-4:]
        byd[d["d"]] = {k: d.get(k) for k in ("d", "drones", "missiles", "downed", "note")}
    aw["days"] = sorted(byd.values(), key=lambda x: x["d"])[-10:]
    if r.get("note"): aw["note"] = r["note"]
    log(f"  airwar: {len(r.get('days', []))} nocy z wiadomości")


# ---------------------------------------------------------------- fronty
FRONT_KW = {
    "ua": ["ukrain", "donetsk", "pokrovsk", "kupiansk", "zaporizh", "kharkiv", "kostiantyn", "lyman", "dobropil", "orikhiv", "huliaipole", "siversk", "kramatorsk", "isw", "front line"],
    "ye": ["yemen", "houthi", "taiz", "marib", "aden", "hodeidah"],
    "sd": ["sudan", "rsf", "darfur", "kordofan", "el obeid", "fasher", "khartoum"],
    "gz": ["gaza", "yellow line", "rafah", "khan younis", "hamas"],
    "lb": ["lebanon", "hezbollah", "litani", "beirut"],
    "cd": ["congo", "m23", "goma", "kivu", "drc", "uvira"],
    "mm": ["myanmar", "rakhine", "arakan", "junta", "shan state", "kachin"],
}


def fronts(ai, st, clusters, log, progress=None):
    for n, f in enumerate(st.get("fronts", [])):
        news = pick_news(clusters, FRONT_KW.get(f["id"], [f["id"]]), limit=10)
        if not news:
            continue
        if progress: progress(f"AI: front {f['name']}", None)
        sides = {k: v[0] for k, v in (f.get("sides") or {}).items()}
        schema = {"type": "object", "properties": {
            "changed": {"type": "boolean"}, "note": S_STR, "asOf": S_STR,
            "moves": {"type": "array", "items": {"type": "object", "properties": {
                "side": {"type": "string", "enum": list(sides.keys()) or ["x"]}, "from_lat": {"type": "number"}, "from_lon": {"type": "number"},
                "to_lat": {"type": "number"}, "to_lon": {"type": "number"}, "label": S_STR, "note": S_STR, "src": {"type": "integer"}},
                "required": ["side", "from_lat", "from_lon", "to_lat", "to_lon", "label", "note", "src"]}},
            "holds": {"type": "array", "items": {"type": "object", "properties": {"name": S_STR, "side": {"type": "string", "enum": list(sides.keys()) + ["x"]}},
                                                  "required": ["name", "side"]}}},
            "required": ["changed", "note", "asOf", "moves", "holds"]}
        prompt = f"""Front: {f['name']}. Strony: {json.dumps(sides, ensure_ascii=False)}. Stan opisu: {f.get('asOf')}.
Obecny opis: {f.get('note')}
Miejscowości i kontrola: {json.dumps([[h[0], h[2]] for h in f.get('holds', [])], ensure_ascii=False)}
Ostatnie natarcia: {json.dumps([m.get('label') for m in f.get('moves', [])][-6:], ensure_ascii=False)}

Na podstawie wiadomości:
- changed: czy sytuacja na tym froncie się zmieniła.
- note: zaktualizowany opis sytuacji (2–3 zdania, z liczbami ze źródeł; zaznacz niepewność).
- asOf: data stanu, np. "18 X".
- moves: tylko NOWE potwierdzone natarcia lub postępy (skąd → dokąd, współrzędne miejscowości), label do 50 znaków. Pusta lista, jeśli brak.
- holds: tylko miejscowości, których kontrola się ZMIENIŁA (side: strona kontrolująca, x = sporne).
Nie wymyślaj ruchów, których nie ma w wiadomościach.

WIADOMOŚCI:
{news_block(news)}"""
        try:
            r = ai.chat_json(SYS, prompt, schema, temperature=0.2)
        except Exception as e:
            log(f"AI front {f['id']} – błąd: {e}"); continue
        if not r.get("changed") and not r.get("moves"):
            continue
        if r.get("note"): f["note"] = r["note"]
        if r.get("asOf"): f["asOf"] = r["asOf"]
        today = _now().date().isoformat()
        for m in r.get("moves", [])[:4]:
            a, b = (_num(m.get("from_lat")), _num(m.get("from_lon"))), (_num(m.get("to_lat")), _num(m.get("to_lon")))
            if None in a or None in b or abs(a[0] - b[0]) + abs(a[1] - b[1]) > 3:
                continue
            f.setdefault("moves", []).append({"side": m["side"], "from": list(a), "to": list(b), "label": m["label"][:60], "when": _short(today),
                                              "d": today, "note": m.get("note", ""), "src": _src(news, m.get("src")), "ai": True})
        hmap = {h[0].lower(): h for h in f.get("holds", [])}
        for h in r.get("holds", []):
            if h.get("name", "").lower() in hmap:
                hmap[h["name"].lower()][2] = h["side"]
        lim = (_now() - timedelta(days=30)).date().isoformat()
        f["moves"] = [m for m in f.get("moves", []) if (m.get("d") or "9999") >= lim][-14:]
        log(f"  front {f['id']}: {len(r.get('moves', []))} nowych ruchów")


# ---------------------------------------------------------------- Iran
def iran_status(ai, st, clusters, log):
    news = pick_news(clusters, ["iran"], limit=12)
    if not news:
        return
    cur = st.get("iranStatus") or {}
    schema = {"type": "object", "properties": {"ceasefire": {"type": "string", "enum": ["in_force", "collapsed", "none"]},
              "since": S_STR, "expires": S_STR, "summary": S_STR}, "required": ["ceasefire", "since", "expires", "summary"]}
    prompt = f"""Oceń stan rozejmu lub pauzy USA–Iran oraz Izrael–Iran.
Obecny opis: {json.dumps(cur, ensure_ascii=False)}
Zmieniaj tylko to, co wynika z wiadomości. summary: 2–3 zdania po polsku.

WIADOMOŚCI:
{news_block(news)}"""
    try:
        r = ai.chat_json(SYS, prompt, schema)
        cur.update({k: v for k, v in r.items() if v}); st["iranStatus"] = cur
    except Exception as e:
        log(f"AI Iran – błąd: {e}")


# ---------------------------------------------------------------- żegluga
SHIP_KW = {
    "hormuz": ["hormuz", "persian gulf", "gulf of oman", "tanker"], "bab": ["bab el-mandeb", "bab al-mandab", "red sea", "houthi"],
    "suez": ["suez"], "blacksea": ["black sea", "odesa", "novorossiysk"], "aden": ["gulf of aden", "somali pira", "aden"],
    "taiwan": ["taiwan strait"], "malacca": ["malacca", "singapore strait"], "panama": ["panama canal"],
}


def shipping(ai, st, clusters, log):
    pw = (st.get("feeds") or {}).get("portwatch") or {}
    schema = {"type": "object", "properties": {"status": {"type": "string", "enum": ["open", "restricted", "disrupted", "closed"]},
              "metric": S_STR, "latest": S_STR, "why": S_STR}, "required": ["status", "metric", "latest", "why"]}
    for s in st.get("shipping", []):
        news = pick_news(clusters, SHIP_KW.get(s["id"], [s["name"].lower()]), limit=8)
        p = pw.get(s["id"])
        if not news:
            continue
        ais = f"AIS (IMF PortWatch): średnio {p['avg7']} statków/dobę w ostatnim tygodniu do {p['last']}, rok temu {p.get('base')}." if p else "brak danych AIS"
        prompt = f"""Oceń stan żeglugi: {s['name']}.
Obecnie: status {s.get('status')}; ruch: {s.get('metric')}; ostatnio: {s.get('latest')}; dlaczego: {s.get('why')}
{ais}
status: open, restricted (utrudnienia, eskorty), disrupted (ataki, poważne zakłócenia), closed.
metric: liczby o ruchu i zagrożeniu (tylko ze źródeł). latest: najnowsze zdarzenia z datami. why: przyczyna, 1 zdanie.

WIADOMOŚCI:
{news_block(news)}"""
        try:
            r = ai.chat_json(SYS, prompt, schema)
            s.update({k: v for k, v in r.items() if v})
            s["checked"] = _now().isoformat()
            for n2 in news[:2]:
                src = [n2["source"] + " " + _short(n2["date"]), n2["url"]]
                if src not in s.setdefault("src", []): s["src"] = (s["src"] + [src])[-4:]
        except Exception as e:
            log(f"AI żegluga {s['id']} – błąd: {e}")


# ---------------------------------------------------------------- kalendarz
def calendar(ai, st, items, log):
    today = _now().date().isoformat()
    schema = {"type": "object", "properties": {"events": {"type": "array", "items": {"type": "object", "properties": {
        "d": S_STR, "t": S_STR, "cat": {"type": "string", "enum": ["elect", "summit", "bank", "energy", "deadline", "space", "war"]}, "note": S_STR, "ref": S_STR},
        "required": ["d", "t", "cat", "note", "ref"]}}}, "required": ["events"]}
    il = "\n".join(f"[{i['id']}] {i['h']}. {i['b']}" for i in items[:35])
    have = "\n".join(f"- {e['d']}: {e['t']}" for e in st.get("calendar", []))
    prompt = f"""Dzisiaj {today}. Wypisz z depesz przyszłe wydarzenia z konkretną datą (RRRR-MM-DD, później niż dziś), których nie ma w kalendarzu.
cat: elect (wybory), summit, bank (bank centralny), energy, deadline (termin, ultimatum), space, war. t: do 60 znaków. note: dlaczego ważne, 1 zdanie. ref: id depeszy.

JUŻ W KALENDARZU:
{have}

DEPESZE:
{il}"""
    try:
        r = ai.chat_json(SYS, prompt, schema)
        refs = {i["id"]: i for i in items}
        for e in r.get("events", [])[:6]:
            if re.match(r"\d{4}-\d{2}-\d{2}$", e.get("d", "")) and e["d"] > today:
                it = refs.get(e.get("ref"))
                st.setdefault("calendar", []).append({"d": e["d"], "t": e["t"][:70], "cat": e["cat"], "note": e.get("note", ""),
                                                      "src": [it["src"], it["u"]] if it else None, "ref": e.get("ref") if it else ""})
    except Exception as e:
        log(f"AI kalendarz – błąd: {e}")
    seen, out = set(), []
    for e in sorted(st.get("calendar", []), key=lambda x: str(x["d"])):
        k = (str(e["d"])[:10], e["t"].lower()[:25])
        if k in seen or (len(str(e["d"])) == 10 and str(e["d"]) < today):
            continue
        seen.add(k); out.append(e)
    st["calendar"] = out[:30]


def run_all(ai, st, clusters, items, log, progress):
    steps = [("Noc nad Ukrainą", lambda: airwar(ai, st, clusters, log)),
             ("Fronty", lambda: fronts(ai, st, clusters, log)),
             ("Iran", lambda: iran_status(ai, st, clusters, log)),
             ("Żegluga", lambda: shipping(ai, st, clusters, log))]
    steps += [(k, (lambda k=k: update_list(ai, st, k, clusters, log))) for k in SPECS]
    steps += [("Kalendarz", lambda: calendar(ai, st, items, log))]
    for n, (name, fn) in enumerate(steps):
        progress(f"AI: {name}", 64 + 22 * n / len(steps))
        fn()
