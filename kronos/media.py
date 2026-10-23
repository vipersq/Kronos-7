"""Zdjęcia i nagrania z postów (v3.20): pamięć na dysku (data/media), żeby nie znikały, gdy kanał usunie post albo wygaśnie link CDN.
Miniatury pobierane od razu po pojawieniu się posta; filmy dopiero przy pierwszym odtworzeniu (do 60 MB)."""
import hashlib, os, queue, threading, time, urllib.request
from pathlib import Path

UA = "Mozilla/5.0 KRONOS-7"
MAX_IMG = 4 * 1024 * 1024
MAX_VID = 60 * 1024 * 1024
KEEP_DAYS = 10
MAX_TOTAL = 1500 * 1024 * 1024


class MediaStore:
    def __init__(self, data_dir, log):
        self.dir = Path(data_dir) / "media"; self.dir.mkdir(parents=True, exist_ok=True)
        self.log = log
        self.idx = {}                       # h -> {"u": miniatura, "v": film, "k": rodzaj, "fetch": funkcja zastępcza (konto Telegram)}
        self.q = queue.Queue(maxsize=4000)
        self.lock = threading.Lock()
        for _ in range(3):
            threading.Thread(target=self._worker, daemon=True, name="media").start()
        threading.Thread(target=self._prune_loop, daemon=True, name="media-prune").start()

    def register(self, m, prefetch=True):
        with self.lock:
            old = self.idx.get(m["h"]) or {}
            self.idx[m["h"]] = {**old, **{k: v for k, v in m.items() if v}}
        if prefetch and not self.path(m["h"], "jpg").exists():
            try:
                self.q.put_nowait(m["h"])
            except queue.Full:
                pass

    def register_post(self, p):
        for m in p.get("media", []):
            self.register(m)

    def path(self, h, ext):
        return self.dir / f"{h}.{ext}"

    def _download(self, url, dest, cap):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        tmp = dest.with_suffix(dest.suffix + ".part")
        with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
            n = 0
            while True:
                b = r.read(256 * 1024)
                if not b:
                    break
                n += len(b)
                if n > cap:
                    raise ValueError("za duży plik")
                f.write(b)
        tmp.replace(dest)

    def _worker(self):
        while True:
            h = self.q.get()
            try:
                self.get(h, "jpg")
            except Exception:
                pass
            time.sleep(0.15)

    def get(self, h, ext):
        """Ścieżka do pliku (pobiera przy pierwszym użyciu) albo None."""
        if not h or not all(c in "0123456789abcdef" for c in h):
            return None
        f = self.path(h, ext)
        if f.exists():
            return f
        m = self.idx.get(h)
        if not m:
            return None
        try:
            if m.get("fetch"):                         # zdjęcie z konta Telegram (Telethon)
                return m["fetch"](h, ext, f)
            url = m.get("u") if ext == "jpg" else m.get("v")
            if not url:
                return None
            self._download(url, f, MAX_IMG if ext == "jpg" else MAX_VID)
            return f
        except Exception:
            return None

    def _prune_loop(self):
        while True:
            time.sleep(1800)
            try:
                files = sorted((p for p in self.dir.iterdir() if p.is_file()), key=lambda p: p.stat().st_mtime)
                now = time.time(); total = sum(p.stat().st_size for p in files)
                for p in files:
                    if now - p.stat().st_mtime > KEEP_DAYS * 86400 or total > MAX_TOTAL:
                        total -= p.stat().st_size; p.unlink(missing_ok=True)
            except Exception:
                pass

    def stats(self):
        try:
            fs = list(self.dir.iterdir())
            return {"n": len(fs), "mb": round(sum(p.stat().st_size for p in fs) / 1e6, 1)}
        except Exception:
            return {"n": 0, "mb": 0}
