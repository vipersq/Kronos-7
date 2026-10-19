"""Wykrywanie sprzętu, wybór modelu i rozmowa z lokalnym AI (Ollama albo LM Studio)."""
import json, os, platform, re, shutil, subprocess, sys, threading, urllib.request, urllib.error
from . import i18n

GB = 1024 ** 3


# ---------------------------------------------------------------- sprzęt
def _run(cmd, timeout=6):
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        return out.stdout if out.returncode == 0 else ""
    except Exception:
        return ""


def system_ram_gb():
    try:
        if sys.platform.startswith("win"):
            import ctypes

            class MS(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MS(); m.dwLength = ctypes.sizeof(MS)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return round(m.ullTotalPhys / GB, 1)
        if sys.platform == "darwin":
            return round(int(_run(["sysctl", "-n", "hw.memsize"]).strip() or 0) / GB, 1)
        with open("/proc/meminfo") as f:
            kb = int(re.search(r"MemTotal:\s+(\d+)", f.read()).group(1))
        return round(kb / 1024 / 1024, 1)
    except Exception:
        return 0.0


def gpus():
    """Lista kart: [{name, vram_gb, vendor}]"""
    found = []
    smi = shutil.which("nvidia-smi") or (r"C:\Windows\System32\nvidia-smi.exe" if sys.platform.startswith("win") else None)
    if smi:
        out = _run([smi, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        for line in out.strip().splitlines():
            try:
                name, mem = [x.strip() for x in line.rsplit(",", 1)]
                found.append({"name": name, "vram_gb": round(float(mem) / 1024, 1), "vendor": "nvidia"})
            except ValueError:
                pass
    if not found and shutil.which("rocm-smi"):
        out = _run(["rocm-smi", "--showmeminfo", "vram", "--csv"])
        for m in re.finditer(r",(\d{9,})", out):
            found.append({"name": "AMD GPU", "vram_gb": round(int(m.group(1)) / GB, 1), "vendor": "amd"})
            break
    if not found and sys.platform.startswith("win"):
        # Windows: AdapterRAM bywa ucięte do 4 GB, więc najpierw rejestr (qwMemorySize)
        ps = ("Get-ItemProperty 'HKLM:\\SYSTEM\\ControlSet001\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' "
              "-ErrorAction SilentlyContinue | ForEach-Object { \"$($_.DriverDesc)|$($_.'HardwareInformation.qwMemorySize')\" }")
        out = _run(["powershell", "-NoProfile", "-Command", ps], timeout=10)
        for line in out.splitlines():
            if "|" in line:
                name, mem = line.split("|", 1)
                if mem.strip().isdigit() and int(mem) > GB:
                    vendor = "amd" if "AMD" in name or "Radeon" in name else "intel" if "Intel" in name else "other"
                    found.append({"name": name.strip(), "vram_gb": round(int(mem) / GB, 1), "vendor": vendor})
    if sys.platform == "darwin" and platform.machine() == "arm64":
        ram = system_ram_gb()
        found.append({"name": "Apple Silicon (pamięć wspólna)", "vram_gb": round(ram * 0.65, 1), "vendor": "apple"})
    return found


def detect_hardware():
    g = gpus()
    best = max(g, key=lambda x: x["vram_gb"]) if g else None
    return {
        "os": f"{platform.system()} {platform.release()}",
        "cpu": platform.processor() or platform.machine(),
        "cores": os.cpu_count(),
        "ram_gb": system_ram_gb(),
        "gpus": g,
        "vram_gb": best["vram_gb"] if best and best["vendor"] in ("nvidia", "amd", "apple") else 0,
        "gpu_name": best["name"] if best else "brak (tryb CPU)",
    }


def recommend(hw, cfg):
    """Model zalecany dla sprzętu. Zwraca (wpis katalogu, powód)."""
    vram = hw.get("vram_gb", 0)
    if vram >= 5:
        for m in cfg["model_catalog"]:
            if vram >= m["min_vram_gb"]:
                return m, f"GPU {hw['gpu_name']} ma {vram} GB VRAM, więc {m['name']} ({m['size_gb']} GB) zmieści się razem z kontekstem."
    ram = hw.get("ram_gb", 0)
    for c in cfg["cpu_catalog"]:
        if ram >= c["min_ram_gb"]:
            m = next((x for x in cfg["model_catalog"] if x["name"] == c["name"]), {"name": c["name"], "size_gb": 0, "ctx": 8192})
            return m, f"Brak odpowiedniej karty graficznej; {ram} GB RAM wystarczy na {m['name']} na procesorze (wolniej)."
    m = cfg["model_catalog"][-1]
    return m, "Słaby sprzęt: wybrano najmniejszy model."


# ---------------------------------------------------------------- HTTP
def _http(url, data=None, timeout=30, method=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method or ("POST" if body else "GET"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def _stream(url, data, timeout=600):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        for line in r:
            line = line.decode("utf-8", "replace").strip()
            if line.startswith("data:"):
                line = line[5:].strip()
            if not line or line == "[DONE]":
                continue
            try:
                yield json.loads(line)
            except ValueError:
                continue


def norm_name(n):
    """qwen3:14b == QWEN3:14B == registry.ollama.ai/library/qwen3:14b; brak tagu == :latest."""
    n = (n or "").strip().lower()
    for pre in ("registry.ollama.ai/library/", "library/"):
        if n.startswith(pre):
            n = n[len(pre):]
    return n if ":" in n else n + ":latest"


# ---------------------------------------------------------------- silnik
class Engine:
    def __init__(self, cfg, log=print):
        self.cfg, self.log = cfg, log
        self.hw = detect_hardware()
        self.backend = None          # "ollama" | "lmstudio" | "mock" | None
        self.model = None
        self.ctx = 8192
        self.installed = []
        self.recommended, self.reason = recommend(self.hw, cfg)
        self.pull = {"active": False, "status": "", "pct": 0}
        self.lock = threading.Lock()
        self.refresh()

    # --- wybór backendu i modelu
    def refresh(self):
        ai = self.cfg["ai"]
        if os.environ.get("KRONOS_MOCK") == "1":
            self.backend, self.model, self.installed = "mock", "mock", [{"name": "mock", "size_gb": 0}]
            return
        self.backend, self.model, self.installed = None, None, []
        want = ai.get("backend", "auto")
        if want in ("auto", "ollama"):
            try:
                tags = _http(ai["ollama_url"] + "/api/tags", timeout=4)
                self.backend = "ollama"
                self.installed = [{"name": m["name"], "size_gb": round(m.get("size", 0) / GB, 1)} for m in tags.get("models", [])]
            except Exception:
                pass
        if not self.backend and want in ("auto", "lmstudio"):
            try:
                ms = _http(ai["lmstudio_url"] + "/v1/models", timeout=4)
                self.backend = "lmstudio"
                self.installed = [{"name": m["id"], "size_gb": 0} for m in ms.get("data", [])]
            except Exception:
                pass
        self._choose()

    def _choose(self):
        ai = self.cfg["ai"]
        names = [m["name"] for m in self.installed]
        by_norm = {norm_name(n): n for n in names}
        rec = self.recommended
        self.ctx = rec.get("ctx", 8192)
        if ai.get("model", "auto") != "auto":
            self.model = by_norm.get(norm_name(ai["model"])) or (ai["model"] if self.backend == "lmstudio" else None)
            if not self.model:
                self.log(f"Model z config.json ({ai['model']}) nie jest zainstalowany.")
            return
        if self.backend == "lmstudio":
            self.model = names[0] if names else None
            return
        if norm_name(rec["name"]) in by_norm:
            self.model = by_norm[norm_name(rec["name"])]; return
        # najlepszy zainstalowany, który mieści się w budżecie pamięci
        budget = (self.hw["vram_gb"] * 0.85) if self.hw["vram_gb"] >= 5 else self.hw["ram_gb"] * 0.4
        skip = ("embed", "bge", "nomic", "minilm", "llava", "vision")
        fits = [m for m in self.installed if 0 < m["size_gb"] <= budget and not any(s in m["name"].lower() for s in skip)]
        if fits:
            self.model = max(fits, key=lambda m: m["size_gb"])["name"]
        else:
            self.model = None

    def status(self):
        better = bool(self.model and norm_name(self.model) != norm_name(self.recommended["name"]) and self.backend == "ollama")
        return {"backend": self.backend, "model": self.model, "recommended": self.recommended["name"],
                "recommended_size_gb": self.recommended.get("size_gb"), "reason": self.reason,
                "hardware": self.hw, "installed": self.installed, "pull": self.pull,
                "suggest_pull": (self.backend == "ollama" and (self.model is None or better)),
                "ready": bool(self.backend and self.model)}

    def has_model(self, name):
        """Pewne sprawdzenie w Ollamie (/api/show), niezależne od listy /api/tags."""
        if self.backend != "ollama":
            return False
        if norm_name(name) in {norm_name(m["name"]) for m in self.installed}:
            return True
        try:
            _http(self.cfg["ai"]["ollama_url"] + "/api/show", {"model": name, "name": name}, timeout=10)
            return True
        except Exception:
            return False

    # --- pobieranie modelu
    def pull_model(self, name=None):
        name = name or self.recommended["name"]
        if self.backend != "ollama" or self.pull["active"]:
            return
        def run():
            self.pull.update(active=True, status=f"pobieranie {name}", pct=0)
            try:
                for ev in _stream(self.cfg["ai"]["ollama_url"] + "/api/pull", {"name": name, "stream": True}, timeout=7200):
                    if ev.get("total"):
                        self.pull["pct"] = round(100 * ev.get("completed", 0) / ev["total"])
                    self.pull["status"] = ev.get("status", "")
                    if ev.get("error"):
                        raise RuntimeError(ev["error"])
                self.pull["status"] = "gotowe"
                self.log(f"Pobrano model {name}.")
            except Exception as e:
                self.pull["status"] = f"błąd: {e}"
                self.log(f"Pobieranie {name} nie powiodło się: {e}")
            finally:
                self.pull["active"] = False
                self.refresh()
        threading.Thread(target=run, daemon=True).start()

    # --- wywołania
    def _ollama_body(self, messages, schema, stream, temperature):
        body = {"model": self.model, "messages": messages, "stream": stream,
                "options": {"temperature": temperature, "num_ctx": self.ctx}}
        if schema is not None:
            body["format"] = schema
        if re.match(r"(qwen3|deepseek-r1|magistral)", self.model or "", re.I):
            body["think"] = False
        return body

    def chat_json(self, system, user, schema, temperature=0.2, retries=2):
        """Zwraca obiekt JSON zgodny ze schematem (w miarę możliwości modelu)."""
        if not self.model:
            raise RuntimeError("Brak modelu AI")
        if self.backend == "mock":
            from . import mock
            return mock.answer(system, user, schema)
        msgs = [{"role": "system", "content": system + "\nOdpowiadaj wyłącznie poprawnym JSON zgodnym ze schematem." + (i18n.AI_EN if i18n.en() else "")},
                {"role": "user", "content": user}]
        last = None
        for attempt in range(retries + 1):
            try:
                with self.lock:
                    if self.backend == "ollama":
                        url = self.cfg["ai"]["ollama_url"] + "/api/chat"
                        body = self._ollama_body(msgs, schema, False, temperature)
                        try:
                            res = _http(url, body, timeout=900)
                        except urllib.error.HTTPError as e:
                            if e.code == 400 and "think" in body:   # model bez trybu myślenia
                                body.pop("think"); res = _http(url, body, timeout=900)
                            else:
                                raise
                        text = res.get("message", {}).get("content", "")
                    else:
                        body = {"model": self.model, "messages": msgs, "temperature": temperature,
                                "response_format": {"type": "json_schema", "json_schema": {"name": "out", "schema": schema}}}
                        res = _http(self.cfg["ai"]["lmstudio_url"] + "/v1/chat/completions", body, timeout=900)
                        text = res["choices"][0]["message"]["content"]
                return parse_json(text)
            except Exception as e:
                last = e
        raise RuntimeError(f"AI nie zwróciło poprawnego JSON: {last}")

    def chat_stream(self, system, user, temperature=0.4):
        """Generator kolejnych fragmentów tekstu."""
        if not self.model:
            yield "BRAK MODELU AI. Zainstaluj Ollamę i pobierz zalecany model w panelu STATUS SYSTEMU."
            return
        if self.backend == "mock":
            from . import mock
            yield from mock.stream(user); return
        msgs = [{"role": "system", "content": system + (i18n.AI_EN if i18n.en() else "")}, {"role": "user", "content": user}]
        with self.lock:
            if self.backend == "ollama":
                body = self._ollama_body(msgs, None, True, temperature)
                try:
                    gen = _stream(self.cfg["ai"]["ollama_url"] + "/api/chat", body)
                    first = next(gen, None)
                except urllib.error.HTTPError as e:
                    if e.code == 400 and "think" in body:
                        body.pop("think"); gen = _stream(self.cfg["ai"]["ollama_url"] + "/api/chat", body); first = next(gen, None)
                    else:
                        raise
                if first:
                    yield first.get("message", {}).get("content", "")
                for ev in gen:
                    yield ev.get("message", {}).get("content", "")
            else:
                body = {"model": self.model, "messages": msgs, "temperature": temperature, "stream": True}
                for ev in _stream(self.cfg["ai"]["lmstudio_url"] + "/v1/chat/completions", body):
                    try:
                        yield ev["choices"][0]["delta"].get("content") or ""
                    except (KeyError, IndexError):
                        continue


def parse_json(text):
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except ValueError:
        m = re.search(r"[\{\[].*[\}\]]", text, re.S)
        if m:
            return json.loads(m.group(0))
        raise
