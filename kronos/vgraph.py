"""Graf powiązań statków (v3.17): statek – właściciel – zarządca – bandera – sankcje.
Dane: OpenSanctions (licencja CC BY-NC 4.0 – użytek niekomercyjny, z podaniem źródła):
  • maritime.csv – wszystkie statki z list sankcyjnych i ostrzegawczych (OFAC, UE, UK, Szwajcaria, Kanada, ONZ, Ukraina…),
    zatrzymania w portach (PSC) i flota cieni,
  • ua_war_sanctions – baza wywiadu Ukrainy (GUR „War & Sanctions”): właściciele, zarządcy handlowi i techniczni,
    ubezpieczyciele P&I, dawne nazwy i bandery, opisy.
Pobierane raz w tygodniu (ok. 40 MB), przetwarzane do zwięzłego indeksu data/vgraph.json.gz."""
import csv, gzip, io, json, re, threading, time, urllib.request
from pathlib import Path

from . import i18n

UA = "KRONOS-7/3.17 (personal, non-commercial)"
SRC_MAR = "https://data.opensanctions.org/datasets/latest/maritime/index.json"
SRC_GUR = "https://data.opensanctions.org/datasets/latest/ua_war_sanctions/entities.ftm.json"
DS_NAME = {   # zbiór danych → kto nałożył sankcje / skąd wpis
    "us_ofac_sdn": ("USA (OFAC)", "sanc"), "eu_sanctions_map": ("UE", "sanc"), "eu_journal_sanctions": ("UE", "sanc"), "eu_fsf": ("UE", "sanc"),
    "gb_fcdo_sanctions": ("Wielka Brytania", "sanc"), "gb_hmt_sanctions": ("Wielka Brytania", "sanc"), "ch_seco_sanctions": ("Szwajcaria", "sanc"),
    "ca_dfatd_sema_sanctions": ("Kanada", "sanc"), "un_1718_vessels": ("ONZ (Korea Płn.)", "sanc"), "un_sc_sanctions": ("ONZ", "sanc"),
    "fr_tresor_gels_avoir": ("Francja", "sanc"), "mc_fund_freezes": ("Monako", "sanc"), "be_fod_sanctions": ("Belgia", "sanc"),
    "au_dfat_sanctions": ("Australia", "sanc"), "jp_mof_sanctions": ("Japonia", "sanc"), "nz_russia_sanctions": ("Nowa Zelandia", "sanc"),
    "ua_war_sanctions": ("Ukraina – wywiad (GUR)", "watch"), "ua_nsdc_sanctions": ("Ukraina (RNBO)", "sanc"), "kp_rusi_reports": ("RUSI – raporty (Korea Płn.)", "watch"),
    "paris_mou_banned": ("zakaz wejścia do portów (Paris MoU)", "ban"), "us_trade_csl": None, "us_cbp_forced_labor": ("USA – praca przymusowa (CBP)", "watch"),
}
ROLE_PL = {"owner": "właściciel", "commerce manager": "zarządca handlowy", "security manager": "zarządca bezpieczeństwa (ISM)",
           "P&I Club": "ubezpieczyciel P&I", "subsidiary of": "spółka zależna od", "": "powiązanie"}
ROLE_EN = {"owner": "owner", "commerce manager": "commercial manager", "security manager": "ISM / safety manager",
           "P&I Club": "P&I insurer", "subsidiary of": "subsidiary of", "": "link"}
FLAG_EN_SKIP = set()


def _get(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _imo(v):
    m = re.search(r"(\d{7})", str(v or ""))
    return int(m.group(1)) if m else None


class VGraph:
    def __init__(self, data_dir, log):
        self.file = Path(data_dir) / "vgraph.json.gz"
        self.log = log
        self.v, self.e, self.by_mmsi, self.by_name, self.rev = {}, {}, {}, {}, {}
        self.meta = {"at": None, "n_v": 0, "n_e": 0, "err": None}
        self.lock = threading.Lock()
        self.on_load = None

    # ------------------------------------------------------------ pobieranie i indeks
    def build(self):
        idx = json.loads(_get(SRC_MAR, 60))
        url = next(r["url"] for r in idx["resources"] if r["name"] == "maritime.csv")
        rows = list(csv.DictReader(io.StringIO(_get(url).decode("utf-8", "replace"))))
        V, E = {}, {}
        for r in rows:
            imo = _imo(r["imo"])
            ds = [d for d in r["datasets"].split(";") if d]
            risk = [x for x in r["risk"].split(";") if x]
            if r["type"] == "VESSEL":
                key = str(imo) if imo else "id:" + r["id"]
                v = V.setdefault(key, {"n": r["caption"], "imo": imo, "mmsi": None, "flag": "", "risk": [], "ds": [], "url": r["url"], "links": []})
                v["risk"] = sorted(set(v["risk"]) | set(risk)); v["ds"] = sorted(set(v["ds"]) | set(ds))
                if r["mmsi"]:
                    v["mmsi"] = int(re.sub(r"\D", "", r["mmsi"])[:9] or 0) or None
                v["flag"] = v["flag"] or (r["flag"] or "").split(";")[0]
                if r["aliases"]:
                    v["alias"] = r["aliases"].split(";")[:6]
            elif imo:
                E["imo:" + str(imo)] = {"n": r["caption"], "kind": "org", "c": (r["countries"] or "").split(";")[0], "imo": imo, "risk": risk, "ds": ds, "url": r["url"], "up": []}
        self.log(i18n.L(f"Graf statków: lista morska OpenSanctions – {len(rows)} wpisów.", f"Vessel graph: OpenSanctions maritime list – {len(rows)} entries."))
        # baza GUR: właściciele i zarządcy
        ents, links = {}, []
        raw = _get(SRC_GUR, 300)
        for line in raw.splitlines():
            try:
                x = json.loads(line)
            except ValueError:
                continue
            s, p = x["schema"], x["properties"]
            if s == "Vessel":
                ents[x["id"]] = ("V", x)
            elif s in ("Company", "LegalEntity", "Organization", "Person"):
                ents[x["id"]] = ("E", x)
            elif s == "Ownership":
                for o in p.get("owner", []):
                    for a in p.get("asset", []):
                        links.append((o, a, (p.get("role") or ["owner"])[0], (p.get("startDate") or [""])[0]))
            elif s == "UnknownLink":
                for su in p.get("subject", []):
                    for ob in p.get("object", []):
                        links.append((su, ob, (p.get("role") or [""])[0], (p.get("startDate") or [""])[0]))
        gid2key = {}
        for gid, (t, x) in ents.items():
            p = x["properties"]
            if t == "V":
                imo = _imo((p.get("imoNumber") or [""])[0])
                key = str(imo) if imo else "id:" + gid
                v = V.setdefault(key, {"n": x["caption"], "imo": imo, "mmsi": None, "flag": "", "risk": [], "ds": ["ua_war_sanctions"], "url": None, "links": []})
                v.update({"type": (p.get("type") or [""])[0], "built": (p.get("buildDate") or [""])[0], "dwt": (p.get("deadweightTonnage") or [""])[0],
                          "pf": p.get("pastFlags", [])[:8], "prev": p.get("previousName", [])[:8], "desc": (p.get("description") or [""])[0][:900],
                          "gur": "https://war-sanctions.gur.gov.ua/en/transport/ships"})
                if p.get("mmsi") and not v.get("mmsi"):
                    v["mmsi"] = int(re.sub(r"\D", "", p["mmsi"][0])[:9] or 0) or None
                v["flag"] = v["flag"] or (p.get("flag") or [""])[0]
                v["risk"] = sorted(set(v["risk"]) | set(p.get("topics", [])))
                if "ua_war_sanctions" not in v["ds"]:
                    v["ds"] = sorted(set(v["ds"]) | {"ua_war_sanctions"})
                gid2key[gid] = ("V", key)
            else:
                imo = _imo((p.get("imoNumber") or [""])[0])
                key = "imo:" + str(imo) if imo else "g:" + gid
                e = E.setdefault(key, {"n": x["caption"], "kind": "person" if x["schema"] == "Person" else "org", "c": (p.get("country") or p.get("nationality") or [""])[0],
                                       "imo": imo, "risk": [], "ds": [], "url": None, "up": []})
                e["risk"] = sorted(set(e["risk"]) | set(p.get("topics", []))); e["ds"] = sorted(set(e["ds"]) | {"ua_war_sanctions"})
                if p.get("address"):
                    e["addr"] = p["address"][0][:160]
                gid2key[gid] = ("E", key)
        nl = 0
        for a, b, role, since in links:
            ka, kb = gid2key.get(a), gid2key.get(b)
            if not ka or not kb:
                continue
            if ka[0] == "E" and kb[0] == "V":         # firma → statek
                V[kb[1]]["links"].append([role or "owner", ka[1], since]); nl += 1
            elif ka[0] == "V" and kb[0] == "E":
                V[ka[1]]["links"].append([role, kb[1], since]); nl += 1
            elif ka[0] == "E" and kb[0] == "E":       # spółka matka (owner) → zależna (asset)
                E[kb[1]]["up"].append([role or "owner", ka[1]]); nl += 1
        # tylko firmy, do których coś prowadzi
        used = {l[1] for v in V.values() for l in v["links"]}
        for _ in range(2):
            used |= {u[1] for k in list(used) for u in E.get(k, {}).get("up", [])}
        E = {k: e for k, e in E.items() if k in used or e.get("imo")}
        out = {"at": int(time.time() * 1000), "v": V, "e": E}
        tmp = self.file.with_suffix(".tmp")
        with gzip.open(tmp, "wt", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        tmp.replace(self.file)
        self.log(i18n.L(f"Graf statków: {len(V)} statków, {len(E)} firm i osób, {nl} powiązań.", f"Vessel graph: {len(V)} vessels, {len(E)} companies and people, {nl} links."))
        return out

    def load(self, d):
        V, E = d["v"], d["e"]
        by_mmsi = {v["mmsi"]: k for k, v in V.items() if v.get("mmsi")}
        by_name = {}
        for k, v in V.items():
            by_name.setdefault(v["n"].upper(), k)
        rev = {}
        for k, v in V.items():
            for l in v["links"]:
                rev.setdefault(l[1], []).append(k)
        with self.lock:
            self.v, self.e, self.by_mmsi, self.by_name, self.rev = V, E, by_mmsi, by_name, rev
            self.meta = {"at": d.get("at"), "n_v": len(V), "n_e": len(E), "err": None}
        if self.on_load:
            try:
                self.on_load(self)
            except Exception as e:
                self.log(f"Graf statków: {e}")

    def loop(self):
        time.sleep(25)
        while True:
            try:
                fresh = self.file.exists() and time.time() - self.file.stat().st_mtime < 7 * 86400
                if fresh and not self.v:
                    with gzip.open(self.file, "rt", encoding="utf-8") as f:
                        self.load(json.load(f))
                elif not fresh:
                    self.load(self.build())
            except Exception as e:
                self.meta["err"] = str(e)[:200]
                self.log(i18n.L(f"Graf statków: nie udało się pobrać danych ({e}).", f"Vessel graph: download failed ({e})."))
                if self.file.exists() and not self.v:
                    try:
                        with gzip.open(self.file, "rt", encoding="utf-8") as f:
                            self.load(json.load(f))
                    except Exception:
                        pass
                time.sleep(3600); continue
            time.sleep(6 * 3600)

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="vgraph").start()

    # ------------------------------------------------------------ zapytania
    @staticmethod
    def authorities(ds):
        out, seen = [], set()
        for d in ds:
            n = DS_NAME.get(d, (None, None)) if d in DS_NAME else ((("zatrzymanie w porcie (PSC)", "psc") if ("_mou_" in d or d.endswith("_psc")) else (d, "watch")))
            if not n or not n[0] or n[0] in seen:
                continue
            seen.add(n[0]); out.append({"name": n[0], "kind": n[1], "ds": d})
        return out

    def sanctioned(self):
        """Statki objęte sankcjami: (po IMO, po MMSI) → [nazwa, program/kto, bandera]."""
        by_imo, by_mmsi = {}, {}
        with self.lock:
            for v in self.v.values():
                if "sanction" not in v["risk"] and "mare.shadow" not in v["risk"]:
                    continue
                who = ", ".join(a["name"] for a in self.authorities(v["ds"]) if a["kind"] == "sanc") or (i18n.L("flota cieni", "shadow fleet") if "mare.shadow" in v["risk"] else "")
                row = [v["n"], who, v.get("flag", "")]
                if v.get("imo"):
                    by_imo[v["imo"]] = row
                if v.get("mmsi"):
                    by_mmsi[v["mmsi"]] = row
        return by_imo, by_mmsi

    def find(self, mmsi=None, imo=None, name=None):
        with self.lock:
            if imo and str(imo) in self.v:
                return str(imo)
            if mmsi and mmsi in self.by_mmsi:
                return self.by_mmsi[mmsi]
            if name and not imo:
                return self.by_name.get(name.upper())
        return None

    def graph(self, mmsi=None, imo=None, name=None, live=None, flag=None):
        """Węzły i krawędzie wokół statku: właściciele i zarządcy (z firmami-matkami), bandera i dawne bandery, sankcje,
        oraz inne statki tych samych firm („flota”). live(mmsi) → czy statek jest teraz na mapie."""
        en = i18n.en(); R = ROLE_EN if en else ROLE_PL
        k = self.find(mmsi, imo, name)
        nodes, edges, seen = [], [], set()
        def add(nid, **kw):
            if nid not in seen:
                seen.add(nid); nodes.append(dict(id=nid, **kw))
        if not k:
            add("v:self", t="vessel", n=name or str(mmsi or imo or "?"), center=True, mmsi=mmsi)
            if flag:
                add("f:" + flag, t="flag", n=flag.upper()); edges.append(["v:self", "f:" + flag, i18n.L("bandera", "flag")])
            return {"found": False, "nodes": nodes, "edges": edges, "facts": {}, "meta": self.meta}
        with self.lock:
            v = self.v[k]
            add("v:" + k, t="vessel", n=v["n"], center=True, imo=v.get("imo"), mmsi=v.get("mmsi") or mmsi, risk=v["risk"])
            fl = (v.get("flag") or flag or "").lower()
            if fl:
                add("f:" + fl, t="flag", n=fl.upper()); edges.append(["v:" + k, "f:" + fl, i18n.L("bandera", "flag")])
            for pf in v.get("pf", [])[:5]:
                if pf.lower() != fl:
                    add("f:" + pf.lower(), t="flag", n=pf.upper(), old=True); edges.append(["v:" + k, "f:" + pf.lower(), i18n.L("dawna bandera", "former flag")])
            for a in self.authorities(v["ds"]):
                nid = "s:" + a["name"]; add(nid, t="sanc", n=a["name"], kind=a["kind"]); edges.append(["v:" + k, nid, i18n.L("na liście", "listed by")])
            fleet = {}
            for role, ek, since in v["links"][:14]:
                e = self.e.get(ek)
                if not e:
                    continue
                add("e:" + ek, t="org" if e["kind"] == "org" else "person", n=e["n"], c=e.get("c"), risk=e["risk"], url=e.get("url"))
                edges.append(["e:" + ek, "v:" + k, R.get(role, role) + (f" ({since[:7]})" if since else "")])
                for s in self.authorities(e.get("ds", [])):
                    if s["kind"] == "sanc":
                        nid = "s:" + s["name"]; add(nid, t="sanc", n=s["name"], kind="sanc"); edges.append(["e:" + ek, nid, i18n.L("sankcje", "sanctions")])
                for r2, up in e.get("up", [])[:3]:
                    pe = self.e.get(up)
                    if pe:
                        add("e:" + up, t="org", n=pe["n"], c=pe.get("c"), risk=pe["risk"]); edges.append(["e:" + up, "e:" + ek, R.get("owner") if r2 in ("owner", "subsidiary of") else R.get(r2, r2)])
                for vk in self.rev.get(ek, [])[:60]:
                    if vk != k:
                        fleet.setdefault(vk, set()).add(ek)
            # flota: inne statki tych samych firm (najpierw te z sankcjami i obecne na mapie)
            fl_items = []
            for vk, via in fleet.items():
                ov = self.v.get(vk)
                if not ov:
                    continue
                on = bool(live and ov.get("mmsi") and live(ov["mmsi"]))
                fl_items.append((("sanction" in ov["risk"]) * 2 + on, vk, ov, via, on))
            fl_items.sort(key=lambda x: -x[0])
            for _, vk, ov, via, on in fl_items[:12]:
                add("v:" + vk, t="vessel", n=ov["n"], imo=ov.get("imo"), mmsi=ov.get("mmsi"), risk=ov["risk"], live=on)
                for ek in list(via)[:2]:
                    edges.append(["e:" + ek, "v:" + vk, i18n.L("ta sama firma", "same company")])
            facts = {"name": v["n"], "imo": v.get("imo"), "type": v.get("type"), "built": v.get("built"), "dwt": v.get("dwt"), "prev": v.get("prev", []),
                     "pf": v.get("pf", []), "desc": v.get("desc"), "url": v.get("url"), "gur": v.get("gur") if "ua_war_sanctions" in v["ds"] else None,
                     "shadow": "mare.shadow" in v["risk"], "detained": "mare.detained" in v["risk"], "sanctioned": "sanction" in v["risk"],
                     "fleet_n": len(fleet), "auth": self.authorities(v["ds"])}
        return {"found": True, "nodes": nodes, "edges": edges, "facts": facts, "meta": self.meta}
