"""Odczyt alertów bezpieczeństwa morskiego z poczty (IMAP): UKMTO, MDAT-GoG, IFC-IOR i inne, na które zapiszesz się e-mailem.
KRONOS tylko czyta (BODY.PEEK – wiadomości nie są oznaczane jako przeczytane ani usuwane) i pamięta, co już przetworzył.
Najlepiej użyć osobnej skrzynki (np. nowe konto Gmail z hasłem aplikacji)."""
import email, email.header, email.utils, imaplib, json, re, threading, time
from pathlib import Path

from . import i18n
from .marsec import coords, kind_of, place

SENDERS = {   # fragment adresu nadawcy → (identyfikator źródła, nazwa)
    "ukmto": ("ukmto", "UKMTO"), "mdat": ("mdat", "MDAT-GoG"), "ifc-ior": ("ifcior", "IFC-IOR"), "ifc.ior": ("ifcior", "IFC-IOR"),
    "jmic": ("ukmto", "JMIC / UKMTO"), "maritime.dot.gov": ("marad", "MARAD MSCI"), "govdelivery": ("marad", "MARAD MSCI"),
    "recaap": ("recaap", "ReCAAP ISC"), "icc-ccs": ("imb", "IMB PRC (ICC)"), "eunavfor": ("eunavfor", "EUNAVFOR"),
}
COORD_COMPACT = re.compile(r"\b(\d{2})(\d{2}(?:\.\d+)?)\s?([NS])[\s,/–-]+(\d{3})(\d{2}(?:\.\d+)?)\s?([EW])\b")


def _dec(h):
    try:
        return str(email.header.make_header(email.header.decode_header(h or "")))
    except Exception:
        return h or ""


def _body(msg):
    plain, htm = [], []
    for part in msg.walk() if msg.is_multipart() else [msg]:
        ct = part.get_content_type()
        if part.get_content_maintype() == "multipart" or part.get("Content-Disposition", "").startswith("attachment"):
            continue
        try:
            payload = part.get_payload(decode=True) or b""
            text = payload.decode(part.get_content_charset() or "utf-8", "replace")
        except Exception:
            continue
        (plain if ct == "text/plain" else htm if ct == "text/html" else []).append(text)
    if plain:
        return "\n".join(plain)
    import html as H
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", "\n".join(htm), flags=re.S | re.I)
    t = re.sub(r"<br\s*/?>|</p>|</tr>|</div>", "\n", t, flags=re.I)
    return H.unescape(re.sub(r"<[^>]+>", " ", t))


def positions(text):
    pts = coords(text)
    for m in COORD_COMPACT.finditer(text):
        la = int(m.group(1)) + float(m.group(2)) / 60; lo = int(m.group(4)) + float(m.group(5)) / 60
        if la <= 90 and lo <= 180:
            pts.append([round(-la if m.group(3) == "S" else la, 4), round(-lo if m.group(6) == "W" else lo, 4)])
    return pts


class MailIn:
    def __init__(self, data_dir, log, settings, marsec):
        self.file = Path(data_dir) / "mail_seen.json"
        self.log, self.settings, self.marsec = log, settings, marsec
        self.status = {"ok": None, "err": None, "at": None, "n": 0, "off": True, "last": None}
        self.wake = threading.Event()
        try:
            self.seen = set(json.loads(self.file.read_text(encoding="utf-8")))
        except Exception:
            self.seen = set()

    def cfg(self):
        c = self.settings() or {}
        return {k: c.get(k) for k in ("imap_host", "imap_port", "imap_user", "imap_pass", "imap_folder", "imap_senders", "imap_days")}

    def enabled(self):
        c = self.cfg()
        return bool(c["imap_host"] and c["imap_user"] and c["imap_pass"])

    def connect(self, c):
        port = int(c.get("imap_port") or 993)
        m = imaplib.IMAP4_SSL(c["imap_host"].strip(), port, timeout=40) if port != 143 else imaplib.IMAP4(c["imap_host"].strip(), port, timeout=40)
        if port == 143:
            m.starttls()
        m.login(c["imap_user"].strip(), c["imap_pass"])
        return m

    def test(self):
        c = self.cfg()
        m = self.connect(c)
        typ, data = m.select('"' + (c.get("imap_folder") or "INBOX") + '"', readonly=True)
        n = int(data[0]) if typ == "OK" and data and data[0] else 0
        m.logout()
        return n

    def poll(self):
        c = self.cfg()
        extra = [s.strip().lower() for s in str(c.get("imap_senders") or "").split(",") if s.strip()]
        days = max(1, min(60, int(c.get("imap_days") or 14)))
        m = self.connect(c)
        try:
            typ, _ = m.select('"' + (c.get("imap_folder") or "INBOX") + '"', readonly=True)
            if typ != "OK":
                raise RuntimeError(i18n.L("nie ma takiego folderu", "no such folder"))
            since = time.strftime("%d-%b-%Y", time.gmtime(time.time() - days * 86400))
            typ, data = m.search(None, "SINCE", since)
            ids = (data[0] or b"").split()[-300:]
            recs = {}
            for i in ids:
                typ, hd = m.fetch(i, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])")
                if typ != "OK" or not hd or not isinstance(hd[0], tuple):
                    continue
                h = email.message_from_bytes(hd[0][1])
                mid = (h.get("Message-ID") or f"{h.get('Date')}|{h.get('Subject')}").strip()
                if mid in self.seen:
                    continue
                frm = _dec(h.get("From")).lower()
                src = next((v for k, v in SENDERS.items() if k in frm), None)
                if not src and extra and any(x in frm for x in extra):
                    src = ("email", re.sub(r".*<|>.*", "", frm)[:40])
                if not src:
                    self.seen.add(mid); continue
                typ, full = m.fetch(i, "(BODY.PEEK[])")
                if typ != "OK" or not full or not isinstance(full[0], tuple):
                    continue
                msg = email.message_from_bytes(full[0][1])
                subj = _dec(msg.get("Subject")); text = re.sub(r"\n\s*\n+", "\n\n", _body(msg)).strip()
                try:
                    t = int(email.utils.parsedate_to_datetime(msg.get("Date")).timestamp() * 1000)
                except Exception:
                    t = int(time.time() * 1000)
                pts = positions(subj + "\n" + text)
                pos = pts[0] if pts else place(subj + " " + text)
                k = kind_of(subj + " " + text)
                recs.setdefault(src[0], []).append({"src": src[0], "key": "mail:" + mid[:120], "ref": f"{src[1]} · e-mail", "t": t, "title": subj[:200],
                                                    "text": text[:6000], "kind": "advisory" if k == "other" else k, "pos": pos,
                                                    "region": None, "url": None, "mail": True, "via": src[1]})
                self.seen.add(mid)
            n = 0
            for s, rs in recs.items():
                n += len(self.marsec.ingest(s, rs, False))
            if n:
                self.marsec.save()
                self.log(i18n.L(f"Poczta: {n} nowych alertów morskich.", f"Mail: {n} new maritime alerts."))
            self.file.write_text(json.dumps(sorted(self.seen)[-5000:]), encoding="utf-8")
            self.status.update(ok=True, err=None, at=int(time.time() * 1000), n=self.status.get("n", 0) + n, off=False, last=n)
        finally:
            try: m.logout()
            except Exception: pass

    def loop(self):
        time.sleep(20)
        while True:
            if self.enabled():
                try:
                    self.poll()
                except Exception as e:
                    msg = str(e)[:200]
                    if "AUTHENTICATIONFAILED" in msg.upper() or "LOGIN" in msg.upper():
                        msg = i18n.L("logowanie odrzucone – sprawdź adres i hasło aplikacji (w Gmailu: Konto Google → Bezpieczeństwo → Hasła do aplikacji)",
                                     "login rejected – check the address and app password (Gmail: Google Account → Security → App passwords)") + f" ({msg})"
                    self.status.update(ok=False, err=msg, at=int(time.time() * 1000), off=False)
            else:
                self.status.update(off=True, ok=None, err=None)
            self.wake.wait(600); self.wake.clear()

    def start(self):
        threading.Thread(target=self.loop, daemon=True, name="mailin").start()
