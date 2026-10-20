"""Lokalna synteza mowy: Piper (neuronowe głosy, działa offline na procesorze, bez instalowania pakietów Python).
Program Piper i wybrane głosy pobierane są na żądanie do data/tts/. Jeden proces Piper na głos zostaje
uruchomiony w tle (--json-input), więc kolejne zdania syntezuje się bez ponownego ładowania modelu."""
import json, os, platform, subprocess, tarfile, threading, time, urllib.request, uuid, zipfile
from pathlib import Path

from . import i18n

PIPER_REL = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/"
VOICE_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/"
UA = "KRONOS-7 (local terminal)"
# id: (opis PL, opis EN, język, ścieżka w repozytorium głosów bez rozszerzenia, rozmiar MB)
VOICES = {
    "pl_PL-darkman-medium": ("Darkman – męski, niski", "Darkman – male, deep (Polish)", "pl", "pl/pl_PL/darkman/medium/pl_PL-darkman-medium", 63),
    "pl_PL-gosia-medium": ("Gosia – żeński", "Gosia – female (Polish)", "pl", "pl/pl_PL/gosia/medium/pl_PL-gosia-medium", 63),
    "pl_PL-mc_speech-medium": ("MC Speech – męski, lektorski", "MC Speech – male narrator (Polish)", "pl", "pl/pl_PL/mc_speech/medium/pl_PL-mc_speech-medium", 63),
    "en_GB-alan-medium": ("Alan – męski, brytyjski", "Alan – male, British", "en", "en/en_GB/alan/medium/en_GB-alan-medium", 63),
    "en_GB-northern_english_male-medium": ("Northern English – męski", "Northern English – male", "en", "en/en_GB/northern_english_male/medium/en_GB-northern_english_male-medium", 63),
    "en_GB-cori-high": ("Cori – żeński, wysoka jakość", "Cori – female, high quality", "en", "en/en_GB/cori/high/en_GB-cori-high", 114),
    "en_GB-alba-medium": ("Alba – żeński, szkocki", "Alba – female, Scottish", "en", "en/en_GB/alba/medium/en_GB-alba-medium", 63),
}
DEFAULT = {"pl": "pl_PL-darkman-medium", "en": "en_GB-alan-medium"}


def _asset():
    s, m = platform.system().lower(), platform.machine().lower()
    if s == "windows":
        return "piper_windows_amd64.zip"
    if s == "darwin":
        return "piper_macos_aarch64.tar.gz" if m in ("arm64", "aarch64") else "piper_macos_x64.tar.gz"
    return "piper_linux_aarch64.tar.gz" if m in ("arm64", "aarch64") else "piper_linux_x86_64.tar.gz"


class TTS:
    def __init__(self, data_dir, log=print):
        self.dir = Path(data_dir).resolve() / "tts"
        self.vdir = self.dir / "voices"
        self.tmp = self.dir / "tmp"
        self.log = log
        self.job = {"active": False, "what": "", "pct": 0, "err": None}
        self.procs = {}                       # voice -> (Popen, lock)
        self.lock = threading.Lock()

    # ------------------------------------------------ instalacja
    def exe(self):
        n = "piper.exe" if os.name == "nt" else "piper"
        for p in (self.dir / "piper" / n, self.dir / n):
            if p.is_file():
                return p
        return None

    def has_voice(self, v):
        return (self.vdir / f"{v}.onnx").is_file() and (self.vdir / f"{v}.onnx.json").is_file()

    def status(self):
        en = i18n.en()
        return {"engine": bool(self.exe()), "job": dict(self.job), "default": DEFAULT,
                "voices": [{"id": k, "label": v[1 if en else 0], "lang": v[2], "mb": v[4], "installed": self.has_voice(k)} for k, v in VOICES.items()]}

    def _download(self, url, dest, label, base_pct=0, span=100):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        part = Path(str(dest) + ".part")
        with urllib.request.urlopen(req, timeout=60) as r, open(part, "wb") as f:
            total = int(r.headers.get("Content-Length") or 0); got = 0
            while True:
                b = r.read(256 * 1024)
                if not b:
                    break
                f.write(b); got += len(b)
                if total:
                    self.job.update(what=label, pct=int(base_pct + span * got / total))
        part.replace(dest)

    def install(self, voice):
        if voice not in VOICES or self.job["active"]:
            return False
        self.job.update(active=True, what="", pct=0, err=None)
        threading.Thread(target=self._install, args=(voice,), daemon=True, name="tts-install").start()
        return True

    def _install(self, voice):
        try:
            self.dir.mkdir(parents=True, exist_ok=True); self.vdir.mkdir(parents=True, exist_ok=True)
            if not self.exe():
                a = _asset(); arc = self.dir / a
                self._download(PIPER_REL + a, arc, i18n.L("program Piper", "Piper program"), 0, 30)
                if a.endswith(".zip"):
                    with zipfile.ZipFile(arc) as z:
                        z.extractall(self.dir)
                else:
                    with tarfile.open(arc) as t:
                        try: t.extractall(self.dir, filter="data")
                        except TypeError: t.extractall(self.dir)
                arc.unlink(missing_ok=True)
                e = self.exe()
                if e and os.name != "nt":
                    e.chmod(0o755)
                self.log(i18n.L("Głos: zainstalowano program Piper.", "Voice: Piper installed."))
            if not self.has_voice(voice):
                path = VOICES[voice][3]
                self._download(VOICE_BASE + path + ".onnx.json?download=true", self.vdir / f"{voice}.onnx.json", voice, 30, 1)
                self._download(VOICE_BASE + path + ".onnx?download=true", self.vdir / f"{voice}.onnx", voice, 31, 69)
                self.log(i18n.L(f"Głos: pobrano {voice}.", f"Voice: downloaded {voice}."))
            self.job.update(active=False, what="", pct=100)
        except Exception as e:
            self.job.update(active=False, err=str(e)[:200])
            self.log(i18n.L(f"Głos: nie udało się pobrać ({e}).", f"Voice: download failed ({e})."))

    # ------------------------------------------------ synteza
    def _proc(self, voice):
        with self.lock:
            p = self.procs.get(voice)
            if p and p[0].poll() is None:
                return p
            exe = self.exe()
            if not exe or not self.has_voice(voice):
                return None
            self.tmp.mkdir(parents=True, exist_ok=True)
            flags = 0x08000000 if os.name == "nt" else 0          # CREATE_NO_WINDOW – bez migającej konsoli w Windows
            pr = subprocess.Popen([str(exe), "--model", str(self.vdir / f"{voice}.onnx"), "--json-input", "--quiet"],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, cwd=str(exe.parent), creationflags=flags)
            p = (pr, threading.Lock())
            self.procs[voice] = p
            return p

    def synth(self, text, voice, rate=1.0, speaker=None):
        """Zwraca WAV (bytes) albo None. rate > 1 = szybciej."""
        text = " ".join(str(text or "").split())[:2000]
        if not text:
            return None
        p = self._proc(voice)
        if not p:
            return None
        pr, lk = p
        out = self.tmp / f"{uuid.uuid4().hex}.wav"
        req = {"text": text, "output_file": str(out), "length_scale": round(1 / max(.5, min(2.0, rate or 1.0)), 3)}
        if speaker is not None:
            req["speaker_id"] = int(speaker)
        with lk:
            try:
                pr.stdin.write((json.dumps(req, ensure_ascii=False) + "\n").encode("utf-8")); pr.stdin.flush()
                line = pr.stdout.readline()          # Piper wypisuje ścieżkę gotowego pliku
            except (BrokenPipeError, OSError):
                self.procs.pop(voice, None); return None
        if not line:
            self.procs.pop(voice, None); return None
        for _ in range(50):
            if out.exists() and out.stat().st_size > 44:
                break
            time.sleep(.02)
        try:
            b = out.read_bytes()
        finally:
            out.unlink(missing_ok=True)
        return b

    def stop_all(self):
        for pr, _ in list(self.procs.values()):
            try: pr.kill()
            except Exception: pass
        self.procs.clear()

    def remove_voice(self, voice):
        if voice in self.procs:
            try: self.procs.pop(voice)[0].kill()
            except Exception: pass
        for f in (self.vdir / f"{voice}.onnx", self.vdir / f"{voice}.onnx.json"):
            f.unlink(missing_ok=True)
