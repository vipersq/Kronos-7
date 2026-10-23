"""Lokalna pamięć podkładów mapy (kafelków).
Każdy kafelek pobierany jest z internetu tylko raz, potem leży na dysku (data/tiles) i serwowany jest lokalnie –
mapa ładuje się natychmiast, działa bez internetu w obejrzanych już miejscach i nie obciąża serwerów dostawców.
Można też z góry pobrać cały świat do wybranego przybliżenia albo widoczny obszar („MAPY OFFLINE”)."""
import math, os, threading, time, urllib.error, urllib.request
from pathlib import Path

from . import i18n

UA = "KRONOS-7/3.22.1 (personal desktop dashboard)"
# warstwa: (adres, rozszerzenie, maks. zoom, wolno pobierać hurtowo)
LAYERS = {
    "dark": ("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png", "png", 20, True),
    "dark@2x": ("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}@2x.png", "png", 20, True),
    "darkesri": ("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", "jpg", 16, True),
    "darkesri+": ("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", "png", 16, True),
    "sat": ("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "jpg", 18, True),
    "sat+": ("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", "png", 18, True),
    # OpenStreetMap: zasady korzystania zabraniają hurtowego pobierania – tylko pamięć tego, co obejrzysz
    "osm": ("https://tile.openstreetmap.org/{z}/{x}/{y}.png", "png", 19, False),
}
GROUPS = {"dark": ["dark", "dark@2x"], "darkesri": ["darkesri", "darkesri+"], "sat": ["sat", "sat+"], "osm": ["osm"]}
CTYPE = {"png": "image/png", "jpg": "image/jpeg"}


def _lonlat_tile(lon, lat, z):
    lat = max(-85.05, min(85.05, lat)); n = 2 ** z
    x = int((lon + 180) / 360 * n); y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


class TileCache:
    def __init__(self, data_dir, log, settings):
        self.dir = Path(data_dir) / "tiles"; self.dir.mkdir(parents=True, exist_ok=True)
        self.log, self.settings = log, settings
        self.sem = threading.Semaphore(6)
        self.inflight = {}; self.lock = threading.Lock()
        self.miss = {}                        # klucz → czas (kafelki, których dostawca nie ma)
        self.job = None; self.stop = threading.Event()
        self.stats = {"n": 0, "bytes": 0, "at": 0}
        self.hits = 0; self.fetched = 0
        threading.Thread(target=self._scan, daemon=True, name="tiles-scan").start()

    # ------------------------------------------------------------ pojedynczy kafelek
    def path(self, layer, z, x, y):
        return self.dir / layer / str(z) / str(x) / f"{y}.{LAYERS[layer][1]}"

    def _url(self, layer, z, x, y):
        u = LAYERS[layer][0].format(z=z, x=x, y=y)
        key = ((self.settings() or {}).get("stadia_key") or "").strip()
        if "stadiamaps" in u and key:
            u += "?api_key=" + urllib.request.quote(key)
        return u

    def _download(self, layer, z, x, y):
        u = self._url(layer, z, x, y)
        h = {"User-Agent": UA}
        if "stadiamaps" in u:
            h["Referer"] = "http://localhost/"          # serwer działa lokalnie – Stadia bez klucza obsługuje localhost
        req = urllib.request.Request(u, headers=h)
        with self.sem:
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    b = r.read()
            except urllib.error.HTTPError as e:
                if e.code in (404, 400):
                    return None
                raise
        if len(b) < 60:
            return None
        f = self.path(layer, z, x, y); f.parent.mkdir(parents=True, exist_ok=True)
        tmp = f.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_bytes(b); tmp.replace(f)
        self.fetched += 1; self.stats["n"] += 1; self.stats["bytes"] += len(b)
        return b

    def get(self, layer, z, x, y):
        """Zwraca (bajty, typ) albo (None, None). Najpierw dysk, potem internet (raz na kafelek, równoległe prośby czekają na siebie)."""
        if layer not in LAYERS or not (0 <= z <= LAYERS[layer][2]) or not (0 <= x < 2 ** z and 0 <= y < 2 ** z):
            return None, None
        ct = CTYPE[LAYERS[layer][1]]
        f = self.path(layer, z, x, y)
        try:
            b = f.read_bytes(); self.hits += 1
            return b, ct
        except OSError:
            pass
        key = (layer, z, x, y)
        if time.time() - self.miss.get(key, 0) < 3600:
            return None, None
        with self.lock:
            ev = self.inflight.get(key)
            mine = ev is None
            if mine:
                ev = self.inflight[key] = threading.Event()
        if not mine:
            ev.wait(25)
            try:
                return f.read_bytes(), ct
            except OSError:
                return None, None
        try:
            b = self._download(layer, z, x, y)
            if b is None:
                self.miss[key] = time.time()
                if len(self.miss) > 20000:
                    self.miss.clear()
            return (b, ct) if b else (None, None)
        finally:
            with self.lock:
                self.inflight.pop(key, None)
            ev.set()

    # ------------------------------------------------------------ rozmiar pamięci
    def _scan(self):
        n = b = 0
        for root, _, files in os.walk(self.dir):
            for fn in files:
                try:
                    b += os.path.getsize(os.path.join(root, fn)); n += 1
                except OSError:
                    pass
        self.stats = {"n": n, "bytes": b, "at": int(time.time() * 1000)}

    def clear(self, group=None):
        import shutil
        for layer in (GROUPS.get(group) if group else LAYERS):
            shutil.rmtree(self.dir / layer, ignore_errors=True)
        self._scan()

    # ------------------------------------------------------------ pobieranie hurtowe
    @staticmethod
    def count(bbox, zmax, zmin=0):
        """Liczba kafelków jednej warstwy w obszarze bbox = [lon0, lat0, lon1, lat1]."""
        n = 0
        for z in range(zmin, zmax + 1):
            (x0, y1), (x1, y0) = _lonlat_tile(bbox[0], bbox[1], z), _lonlat_tile(bbox[2], bbox[3], z)
            n += (x1 - x0 + 1) * (y1 - y0 + 1)
        return n

    def start(self, group, bbox, zmax, zmin=0, retina=False):
        if self.job and self.job.get("running"):
            return False, i18n.L("Pobieranie już trwa.", "A download is already running.")
        if group not in GROUPS:
            return False, "?"
        layers = [l for l in GROUPS[group] if LAYERS[l][3]]
        if "dark@2x" in layers:
            layers.remove("dark" if retina else "dark@2x")
        if not layers:
            return False, i18n.L("Ten podkład (OpenStreetMap) nie pozwala na pobieranie hurtowe – zapamiętuje tylko obejrzane miejsca.",
                                 "This basemap (OpenStreetMap) does not allow bulk downloads – only places you view are kept.")
        n = self.count(bbox, zmax, zmin) * len(layers)
        if n > 60000:
            return False, i18n.L(f"Za dużo kafelków ({n}). Zmniejsz obszar albo przybliżenie.", f"Too many tiles ({n}). Reduce the area or zoom.")
        self.stop.clear()
        self.job = {"running": True, "group": group, "total": n, "done": 0, "new": 0, "fail": 0, "bytes": 0, "started": int(time.time() * 1000), "zmax": zmax}
        threading.Thread(target=self._run, args=(layers, bbox, zmin, zmax), daemon=True, name="tiles-dl").start()
        return True, None

    def _run(self, layers, bbox, zmin, zmax):
        j = self.job
        try:
            for z in range(zmin, zmax + 1):
                (x0, y1), (x1, y0) = _lonlat_tile(bbox[0], bbox[1], z), _lonlat_tile(bbox[2], bbox[3], z)
                for x in range(x0, x1 + 1):
                    for y in range(y0, y1 + 1):
                        for layer in layers:
                            if self.stop.is_set():
                                return
                            j["done"] += 1
                            if z > LAYERS[layer][2] or self.path(layer, z, x, y).exists():
                                continue
                            for attempt in range(3):
                                try:
                                    b = self._download(layer, z, x, y)
                                    if b:
                                        j["new"] += 1; j["bytes"] += len(b)
                                    break
                                except Exception:
                                    if attempt == 2:
                                        j["fail"] += 1
                                    time.sleep(2 + attempt * 3)
                            time.sleep(.12)        # grzecznie: ok. 8 kafelków na sekundę
        finally:
            j["running"] = False; j["ended"] = int(time.time() * 1000)
            self.log(i18n.L(f"Mapy offline: pobrano {j['new']} kafelków ({j['bytes'] / 1e6:.0f} MB), błędów {j['fail']}.",
                            f"Offline maps: downloaded {j['new']} tiles ({j['bytes'] / 1e6:.0f} MB), {j['fail']} errors."))
            self._scan()

    def cancel(self):
        self.stop.set()

    def view(self):
        return {"n": self.stats["n"], "mb": round(self.stats["bytes"] / 1e6, 1), "job": self.job, "hits": self.hits, "fetched": self.fetched,
                "groups": {g: any(LAYERS[l][3] for l in ls) for g, ls in GROUPS.items()}}
