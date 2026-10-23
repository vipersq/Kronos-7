"""Konto Telegram operatora (v3.20) – przeszukiwanie całego Telegrama, tylko odczyt.
Logowanie: api_id i api_hash z my.telegram.org → numer telefonu → kod z Telegrama → (hasło dwuetapowe).
Sesja zapisywana w data/tg_account.session – daje pełny dostęp do konta, więc nie udostępniaj tego pliku; WYLOGUJ usuwa ją.
Wyszukiwanie:
  • messages.searchGlobal – wszystkie kanały i grupy, do których należysz (także prywatne),
  • channels.searchPosts po hashtagu – publiczne posty z całego Telegrama (bez limitu),
  • channels.searchPosts pełnotekstowo – tylko w darmowej dziennej puli (KRONOS nigdy nie płaci gwiazdkami).
KRONOS niczego nie wysyła, nie dołącza do kanałów i nie oznacza wiadomości jako przeczytanych."""
import asyncio, hashlib, importlib, os, re, site, subprocess, sys, threading, time
from datetime import datetime, timezone
from pathlib import Path

from . import i18n


def installed():
    try:
        importlib.import_module("telethon")
        return True
    except Exception:
        return False


class TgAccount:
    def __init__(self, data_dir, log, settings, save_settings, media):
        self.dir = Path(data_dir)
        self.session = str(self.dir / "tg_account")
        self.log, self.settings, self.save, self.media = log, settings, save_settings, media
        self.loop = None; self.client = None; self.thread = None
        self.state = {"step": "idle", "err": None, "me": None, "flood": None, "install": None}
        self.phone_hash = None
        self.refs = {}                  # h -> (peer, msg_id, video)
        self.lock = threading.Lock()
        self.last_search = 0

    # ------------------------------------------------------------ instalacja biblioteki
    def install(self):
        if self.state.get("install") == "running":
            return
        self.state["install"] = "running"
        def run():
            try:
                flags = 0x08000000 if os.name == "nt" else 0
                r = subprocess.run([sys.executable, "-m", "pip", "install", "--user", "--disable-pip-version-check", "--quiet", "telethon"],
                                   capture_output=True, timeout=900, creationflags=flags)
                if r.returncode != 0:
                    raise RuntimeError(((r.stderr or r.stdout or b"").decode("utf-8", "replace").strip().splitlines() or ["pip"])[-1][:200])
                us = site.getusersitepackages()
                if us not in sys.path:
                    sys.path.append(us)
                importlib.invalidate_caches()
                if not installed():
                    raise RuntimeError(i18n.L("zainstalowano, ale Python jej nie widzi – uruchom KRONOS-a ponownie", "installed, but Python cannot see it – restart KRONOS"))
                self.state["install"] = "ok"
                self.log(i18n.L("Telegram: zainstalowano bibliotekę Telethon.", "Telegram: Telethon library installed."))
                self.start()
            except Exception as e:
                self.state["install"] = "error: " + str(e)[:200]
        threading.Thread(target=run, daemon=True, name="tg-install").start()

    # ------------------------------------------------------------ pętla asyncio w osobnym wątku
    def cfg(self):
        return self.settings() or {}

    def configured(self):
        c = self.cfg()
        return bool(c.get("api_id") and c.get("api_hash"))

    def start(self):
        if not installed() or not self.configured() or self.thread:
            return
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, daemon=True, name="tg-account")
        self.thread.start()
        try:
            self.call(self._connect(), 40)
        except Exception as e:
            self.state.update(err=str(e)[:200])

    def call(self, coro, timeout=60):
        if not self.loop:
            raise RuntimeError(i18n.L("konto Telegram nie jest skonfigurowane", "Telegram account is not configured"))
        return asyncio.run_coroutine_threadsafe(coro, self.loop).result(timeout)

    async def _connect(self):
        from telethon import TelegramClient
        c = self.cfg()
        if self.client is None:
            self.client = TelegramClient(self.session, int(c["api_id"]), c["api_hash"].strip(), device_model="KRONOS-7", app_version="3.22",
                                         system_version=sys.platform, receive_updates=False)
        if not self.client.is_connected():
            await self.client.connect()
        if await self.client.is_user_authorized():
            me = await self.client.get_me()
            self.state.update(step="ready", err=None, me={"name": " ".join(x for x in (me.first_name, me.last_name) if x), "username": me.username,
                                                          "premium": bool(getattr(me, "premium", False))})
        elif self.state["step"] not in ("code", "password"):
            self.state.update(step="login")

    def reconfigure(self):
        """Nowe api_id/api_hash – zamknij stary klient."""
        if self.client and self.loop:
            try:
                self.call(self.client.disconnect(), 15)
            except Exception:
                pass
        self.client = None
        if not self.thread:
            self.start()
        elif self.configured():
            try:
                self.call(self._connect(), 40)
            except Exception as e:
                self.state.update(err=str(e)[:200])

    # ------------------------------------------------------------ logowanie
    def send_code(self, phone):
        async def go():
            await self._connect()
            r = await self.client.send_code_request(phone)
            self.phone_hash = r.phone_code_hash
        self.call(go(), 60)
        self.state.update(step="code", err=None, phone=phone)

    def sign_in(self, code):
        from telethon.errors import SessionPasswordNeededError
        async def go():
            try:
                await self.client.sign_in(phone=self.state.get("phone"), code=code.strip(), phone_code_hash=self.phone_hash)
            except SessionPasswordNeededError:
                return "password"
            return "ok"
        r = self.call(go(), 60)
        if r == "password":
            self.state.update(step="password", err=None)
        else:
            self.call(self._connect(), 40)
            self.log(i18n.L("Telegram: zalogowano konto (tylko odczyt).", "Telegram: account signed in (read-only)."))

    def sign_in_password(self, pw):
        self.call(self.client.sign_in(password=pw), 60)
        self.call(self._connect(), 40)
        self.log(i18n.L("Telegram: zalogowano konto (tylko odczyt).", "Telegram: account signed in (read-only)."))

    def logout(self):
        try:
            if self.client:
                self.call(self.client.log_out(), 30)
        except Exception:
            pass
        self.client = None
        for f in self.dir.glob("tg_account.session*"):
            try:
                f.unlink()
            except OSError:
                pass
        self.state.update(step="login" if self.configured() else "idle", me=None, err=None)

    def view(self):
        c = self.cfg()
        return {"installed": installed(), "configured": self.configured(), "api_id": c.get("api_id") or "", "hash_set": bool(c.get("api_hash")),
                "phone": c.get("phone") or "", **{k: v for k, v in self.state.items() if k != "phone"}}

    def ready(self):
        return self.state.get("step") == "ready" and self.client is not None

    # ------------------------------------------------------------ wyszukiwanie
    @staticmethod
    def _queries(names):
        """Najwyżej 3 krótkie zapytania: pełne słowa (nie rdzenie), najpierw ukraińskie i rosyjskie."""
        out = []
        for n in names:
            n = n.strip()
            if len(n) < 4 or " " in n and len(n) > 20:
                continue
            if re.search(r"[а-яіїєґ]", n, re.I) and n not in out:
                out.append(n)
        for n in names:
            if len(n) >= 4 and re.match(r"^[a-z][a-z\-]+$", n, re.I) and n not in out:
                out.append(n)
        return out[:3]

    def search(self, names, pos, t0, t1):
        if not self.ready() or not names:
            return []
        return self.call(self._search(names, t0, t1), 40)

    async def _search(self, names, t0, t1):
        from telethon.tl import functions, types
        qs = self._queries(names)
        mind = datetime.fromtimestamp((t0 - 1800e3) / 1000, timezone.utc)
        res, flood = [], None
        for q in qs:
            try:
                r = await self.client(functions.messages.SearchGlobalRequest(q=q, filter=types.InputMessagesFilterEmpty(), min_date=mind, max_date=None,
                                                                             offset_rate=0, offset_peer=types.InputPeerEmpty(), offset_id=0, limit=40))
                res.append(("global", r))
            except Exception as e:
                self.state["err"] = f"searchGlobal: {e}"[:200]
            tag = re.sub(r"[^\w]", "", q)
            if tag:
                try:
                    r = await self.client(functions.channels.SearchPostsRequest(offset_rate=0, offset_peer=types.InputPeerEmpty(), offset_id=0, limit=40, hashtag=tag))
                    res.append(("hashtag", r))
                except Exception as e:
                    self.state["err"] = f"hashtag: {e}"[:200]
        # pełnotekstowo – tylko gdy darmowe (sprawdzamy pulę przed każdym zapytaniem; nigdy nie płacimy)
        if qs and time.time() - self.last_search > 60:
            try:
                fl = await self.client(functions.channels.CheckSearchPostsFloodRequest(query=qs[0]))
                flood = {"remains": fl.remains, "total": fl.total_daily, "free": bool(getattr(fl, "query_is_free", False))}
                if fl.remains > 0 or getattr(fl, "query_is_free", False):
                    r = await self.client(functions.channels.SearchPostsRequest(offset_rate=0, offset_peer=types.InputPeerEmpty(), offset_id=0, limit=40, query=qs[0]))
                    res.append(("posts", r)); self.last_search = time.time()
            except Exception as e:
                self.state["err"] = f"searchPosts: {e}"[:200]
        if flood:
            self.state["flood"] = flood
        out, seen = [], set()
        for kind, r in res:
            chats = {c.id: c for c in list(getattr(r, "chats", [])) + list(getattr(r, "users", []))}
            for m in getattr(r, "messages", []):
                if not getattr(m, "message", None) and not getattr(m, "media", None):
                    continue
                d = m.date.timestamp() * 1000 if m.date else 0
                if d < t0 - 1800e3 or d > t1 + 3 * 3600e3:
                    continue
                pid = getattr(m.peer_id, "channel_id", None) or getattr(m.peer_id, "chat_id", None) or getattr(m.peer_id, "user_id", None)
                ch = chats.get(pid)
                key = f"{pid}:{m.id}"
                if key in seen:
                    continue
                seen.add(key)
                uname = getattr(ch, "username", None)
                url = f"https://t.me/{uname}/{m.id}" if uname else f"https://t.me/c/{pid}/{m.id}"
                media = []
                vid = bool(getattr(m, "video", None) or (getattr(m, "document", None) and "video" in (getattr(m.document, "mime_type", "") or "")))
                if getattr(m, "photo", None) or vid:
                    h = hashlib.sha1(f"acct:{key}".encode()).hexdigest()[:16]
                    self.refs[h] = (m.peer_id, m.id, vid)
                    self.media.register({"h": h, "k": "video" if vid else "photo", "fetch": self.fetch_media}, prefetch=True)
                    media.append({"h": h, "k": "video" if vid else "photo"})
                out.append({"id": key, "src": i18n.L("Telegram (konto)", "Telegram (account)"), "ch": uname or str(pid), "chn": getattr(ch, "title", None) or uname or str(pid),
                            "type": {"global": i18n.L("Twoje czaty", "your chats"), "hashtag": "hashtag", "posts": i18n.L("cały Telegram", "all of Telegram")}[kind],
                            "t": int(d), "text": (m.message or "")[:2500], "url": url, "media": media})
        return out

    def fetch_media(self, h, ext, dest):
        ref = self.refs.get(h)
        if not ref or not self.ready():
            return None
        peer, mid, vid = ref
        async def go():
            msg = await self.client.get_messages(peer, ids=mid)
            if not msg:
                return None
            if ext == "jpg":
                p = await self.client.download_media(msg, file=str(dest), thumb=-1 if vid else None)
            else:
                if not vid or (getattr(msg.document, "size", 0) or 0) > 60 * 1024 * 1024:
                    return None
                p = await self.client.download_media(msg, file=str(dest))
            return p
        try:
            p = self.call(go(), 120)
        except Exception:
            return None
        if p and Path(p).exists() and Path(p) != dest:
            Path(p).replace(dest)
        return dest if dest.exists() else None
