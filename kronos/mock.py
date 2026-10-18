"""Atrapa modelu do testów bez AI (KRONOS_MOCK=1). Generuje odpowiedzi zgodne ze schematem."""
import random, re, time


def _fill(schema, prompt, path=""):
    t = schema.get("type")
    if isinstance(t, list):
        t = [x for x in t if x != "null"][0]
    if "enum" in schema:
        return random.choice(schema["enum"])
    if t == "object":
        return {k: _fill(v, prompt, k) for k, v in schema.get("properties", {}).items()}
    if t == "array":
        if path == "items" and "i" in schema["items"].get("properties", {}):
            idx = [int(x) for x in re.findall(r"^\[(\d+)\]", prompt, re.M)]
            out = []
            for i in idx:
                o = _fill(schema["items"], prompt)
                o["i"] = i
                if "keep" in o: o["keep"] = True
                if "conflict" in o: o["conflict"] = ""
                out.append(o)
            return out
        if path == "nodes":
            return [{"id": f"n{i}", "label": f"Węzeł testowy {i}", "type": "event", "ref": ""} for i in range(6)]
        if path == "edges":
            return [{"from": f"n{i}", "to": f"n{i+1}", "label": "wpływa na"} for i in range(5)]
        if path in ("new", "events", "timeline_add"):
            return []
        return [_fill(schema["items"], prompt) for _ in range(2)]
    if t == "integer":
        return 3 if path == "level" else random.randint(20, 50)
    if t == "number":
        return round(random.uniform(-50, 60), 2)
    if t == "boolean":
        return False
    return {"h": "Depesza testowa z trybu atrapy", "b": "Opis testowy.", "why": "Uzasadnienie testowe.",
            "label": "UMIARKOWANY", "briefing": "Raport KRONOS-7. To jest briefing testowy wygenerowany w trybie atrapy.",
            "note": "Tryb testowy", "d": "2026-10-18"}.get(path, f"tekst testowy ({path})")


def answer(system, user, schema):
    time.sleep(0.05)
    return _fill(schema, user)


def stream(user):
    text = "TRYB TESTOWY. Model atrapy nie analizuje danych; zainstaluj Ollamę, aby uzyskać prawdziwą odpowiedź.\nREF: iran"
    for w in text.split(" "):
        time.sleep(0.02)
        yield w + " "
