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
        # Piper w Windows potrafi się wysypać (kod 0xC0000409), gdy ścieżka zawiera polskie znaki lub inne spoza ASCII.
        # Wtedy trzymamy program i głosy w C:\\ProgramData\\KRONOS7\\tts (zawsze bezpieczna ścieżka).
        if os.name == "nt" and not str(self.dir).isascii():
            safe = Path(os.environ.get("PROGRAMDATA") or "C:/ProgramData") / "KRONOS7" / "tts"
            try:
                if self.dir.is_dir() and not (safe / "piper").is_dir():
                    import shutil
                    shutil.copytree(self.dir, safe, dirs_exist_ok=True)
                safe.mkdir(parents=True, exist_ok=True)
                self.dir = safe
            except Exception as e:
                log(f"TTS: {e}")
        self.vdir = self.dir / "voices"
        self.tmp = self.dir / "tmp"
        self.log = log
        self.job = {"active": False, "what": "", "pct": 0, "err": None}
        self.procs = {}                       # voice -> (Popen, lock)
        self.last_err = None
        try:   # zapamiętany tryb (na części komputerów z Windows działa tylko jednorazowy)
            self.mode = "once" if (self.dir / "mode.txt").read_text().strip() == "once" else "json"
        except Exception:
            self.mode = "json"
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
        return {"engine": bool(self.exe()), "job": dict(self.job), "default": DEFAULT, "err": self.last_err, "mode": self.mode,
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
    # Dwa tryby: „stały proces” (--json-input, szybki) i „jednorazowy” (tekst na wejście, plik na wyjście).
    # Jeśli tryb stały nie zadziała (różnie bywa w Windows), przechodzimy na jednorazowy i zapisujemy przyczynę.
    def _flags(self):
        return 0x08000000 if os.name == "nt" else 0          # CREATE_NO_WINDOW – bez migającej konsoli w Windows

    def _proc(self, voice):
        with self.lock:
            p = self.procs.get(voice)
            if p and p[0].poll() is None:
                return p
            exe = self.exe()
            if not exe or not self.has_voice(voice):
                return None
            self.tmp.mkdir(parents=True, exist_ok=True)
            errf = open(self.dir / "piper.log", "ab")
            pr = subprocess.Popen([str(exe), "--model", str(self.vdir / f"{voice}.onnx"), "--espeak_data", str(exe.parent / "espeak-ng-data"), "--json-input"],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errf, cwd=str(exe.parent), creationflags=self._flags())
            p = (pr, threading.Lock())
            self.procs[voice] = p
            return p

    def _log_tail(self):
        try:
            return (self.dir / "piper.log").read_bytes()[-600:].decode("utf-8", "replace").strip().splitlines()[-1][:240]
        except Exception:
            return ""

    def _wait_file(self, out, sec=3.0):
        end = time.time() + sec
        while time.time() < end:
            if out.exists() and out.stat().st_size > 44:
                time.sleep(.03); return True
            time.sleep(.02)
        return False

    def _synth_json(self, text, voice, ls, speaker):
        p = self._proc(voice)
        if not p:
            return None
        pr, lk = p
        out = self.tmp / f"{uuid.uuid4().hex}.wav"
        req = {"text": text, "output_file": str(out), "length_scale": ls}
        if speaker is not None:
            req["speaker_id"] = int(speaker)
        with lk:
            try:
                pr.stdin.write((json.dumps(req, ensure_ascii=False) + "\n").encode("utf-8")); pr.stdin.flush()
                line = pr.stdout.readline()          # Piper wypisuje ścieżkę gotowego pliku
            except (BrokenPipeError, OSError) as e:
                self.procs.pop(voice, None); self.last_err = f"json: {e} {self._log_tail()}"; return None
        if not line or not self._wait_file(out):
            self.procs.pop(voice, None)
            try: pr.kill()
            except Exception: pass
            self.last_err = "json: " + (self._log_tail() or "brak pliku wyjściowego"); return None
        try:
            return out.read_bytes()
        finally:
            out.unlink(missing_ok=True)

    def _synth_once(self, text, voice, ls, speaker):
        exe = self.exe()
        if not exe or not self.has_voice(voice):
            return None
        self.tmp.mkdir(parents=True, exist_ok=True)
        out = self.tmp / f"{uuid.uuid4().hex}.wav"
        cmd = [str(exe), "--model", str(self.vdir / f"{voice}.onnx"), "--espeak_data", str(exe.parent / "espeak-ng-data"), "--output_file", str(out), "--length_scale", str(ls)]
        if speaker is not None:
            cmd += ["--speaker", str(int(speaker))]
        try:
            r = subprocess.run(cmd, input=(text + "\n").encode("utf-8"), capture_output=True, timeout=120, cwd=str(exe.parent), creationflags=self._flags())
        except Exception as e:
            self.last_err = f"run: {e}"; return None
        if not self._wait_file(out, 1.0):
            err = (r.stderr or b"").decode("utf-8", "replace").strip().splitlines()
            if r.returncode in (3221226505, -1073740791) and not str(exe).isascii():
                self.last_err = i18n.L("Piper nie lubi polskich znaków w ścieżce folderu – przenieś KRONOS-a do folderu bez polskich liter, np. C:\\KRONOS7",
                                       "Piper fails with non-ASCII characters in the folder path – move KRONOS to e.g. C:\\KRONOS7")
            elif r.returncode in (3221226505, -1073740791):
                self.last_err = i18n.L(f"program Piper uległ awarii (0xC0000409). {err[-1][:200] if err else ''}", f"Piper crashed (0xC0000409). {err[-1][:200] if err else ''}")
            elif r.returncode in (3221225781, -1073741515):
                self.last_err = i18n.L("brakuje bibliotek Microsoft Visual C++ – zainstaluj „VC++ Redistributable x64” ze strony Microsoftu (aka.ms/vs/17/release/vc_redist.x64.exe)",
                                       "Microsoft Visual C++ libraries missing – install 'VC++ Redistributable x64' (aka.ms/vs/17/release/vc_redist.x64.exe)")
            else:
                self.last_err = f"run (kod {r.returncode}): " + (err[-1][:240] if err else "brak pliku wyjściowego")
            return None
        try:
            return out.read_bytes()
        finally:
            out.unlink(missing_ok=True)

    def synth(self, text, voice, rate=1.0, speaker=None):
        """Zwraca WAV (bytes) albo None (przyczyna w self.last_err). rate > 1 = szybciej."""
        text = " ".join(str(text or "").split())[:2000]
        if not text:
            return None
        ls = round(1 / max(.5, min(2.0, rate or 1.0)), 3)
        b = None
        if self.mode != "once":
            try:
                b = self._synth_json(text, voice, ls, speaker)
            except Exception as e:
                self.last_err = f"json: {e}"; b = None
            if b is None and self.exe() and self.has_voice(voice):
                self.log(i18n.L(f"Głos: tryb stały Pipera nie działa ({self.last_err}) – przechodzę na tryb jednorazowy.",
                                f"Voice: Piper persistent mode failed ({self.last_err}) – switching to one-shot mode."))
                self.mode = "once"
                try: (self.dir / "mode.txt").write_text("once")
                except Exception: pass
        if b is None and self.mode == "once":
            b = self._synth_once(text, voice, ls, speaker)
        if b:
            self.last_err = None
        elif self.last_err:
            self.log(i18n.L(f"Głos: Piper nie wygenerował mowy – {self.last_err}", f"Voice: Piper produced no speech – {self.last_err}"))
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
