"""Powiadomienia na telefon: Telegram (bot) i Discord (webhook).
Wysyłka w osobnym wątku, z limitem (najwyżej 1 wiadomość na 5 s i 40 na godzinę), żeby nie zalać telefonu."""
import json, queue, threading, time, urllib.parse, urllib.request
from collections import deque

from . import i18n

KINDS = {  # rodzaj zdarzenia: (opis PL, opis EN)
    "threat": ("Wzrost poziomu napięcia po analizie", "Tension level rises after an analysis"),
    "briefing": ("Nowy briefing po każdej analizie", "New briefing after every analysis"),
    "air_zone": ("Rozpoznanie, tankowiec lub bombowiec w obserwowanym rejonie", "Reconnaissance, tanker or bomber in a watched region"),
    "loiter": ("Samolot krąży (orbita rozpoznawcza / tankowanie)", "Aircraft orbiting (reconnaissance / refuelling)"),
    "squawk": ("Kod alarmowy samolotu (7500/7600/7700)", "Aircraft emergency code (7500/7600/7700)"),
    "sea_zone": ("Okręt lub straż w obserwowanym rejonie", "Warship or coast guard in a watched region"),
    "sanc": ("Statek z listy sankcji OFAC", "OFAC-sanctioned ship"),
    "dark": ("Statek przestał nadawać AIS", "Ship stopped transmitting AIS"),
    "sts": ("Możliwy przeładunek STS", "Possible STS transfer"),
    "cable": ("Statek stoi nad kablem podmorskim", "Ship stationary over an undersea cable"),
    "pass": ("Przelot satelity nad QTH", "Satellite pass over your QTH"),
    "marsec": ("Incydent bezpieczeństwa morskiego (piractwo, atak, porwanie)", "Maritime security incident (piracy, attack, hijacking)"),
    "ua_alert": ("Alarm przeciwlotniczy w wybranych obwodach Ukrainy", "Air raid alert in selected Ukrainian oblasts"),
    "osint": ("Ważny post z kanałów OSINT (Telegram)", "Important OSINT post (Telegram)"),
}
DEFAULT_ON = {"threat", "loiter", "squawk", "sanc", "sts", "cable", "pass", "marsec"}


def kind_of(src, ev):
    k = ev.get("kind")
    if src == "air":
        return {"zone": "air_zone", "loiter": "loiter", "squawk": "squawk"}.get(k)
    if src == "sea":
        return {"zone": "sea_zone", "alarm": "sea_zone", "sanc": "sanc", "dark": "dark", "sts": "sts", "cable": "cable"}.get(k)
    return k


class Notifier:
    def __init__(self, log=print):
        self.log = log
        self.cfg = {}
        self.q = queue.Queue(maxsize=200)
        self.sent = deque(maxlen=60)
        self.last_err = None
        self.ha_err = None
        threading.Thread(target=self._worker, daemon=True, name="notify").start()

    def configure(self, st):
        self.cfg = {"tg_token": st.get("tg_token") or "", "tg_chat": str(st.get("tg_chat") or ""), "discord": st.get("discord") or "",
                    "kinds": set(st.get("notify_kinds") if st.get("notify_kinds") is not None else DEFAULT_ON),
                    "ha": ((st.get("intg") or {}).get("ha_webhook") or "").strip()}

    def enabled(self):
        c = self.cfg
        return bool((c.get("tg_token") and c.get("tg_chat")) or c.get("discord"))

    def ha(self, kind, text, extra=None):
        """Home Assistant: webhook dostaje każde zdarzenie (także PRIORYTET JEDEN), z rodzajem i treścią – automatyzacje decydują same."""
        url = self.cfg.get("ha")
        if not url:
            return False
        if not url.startswith("http"):
            url = "http://" + url
        body = dict(extra or {}, kind=kind, text=text, source="KRONOS-7", ts=int(time.time()))
        def go():
            try:
                self._post(url, body)
                self.ha_err = None
            except Exception as e:
                self.ha_err = str(e)[:160]
        threading.Thread(target=go, daemon=True).start()
        return True

    def send(self, kind, text, force=False, extra=None):
        if self.cfg.get("ha") and (force or kind in self.cfg.get("kinds", ()) or kind in ("priority", "threat_level")):
            self.ha(kind, text, extra)
        if kind in ("priority", "threat_level"):
            return True
        if not self.enabled() or (not force and kind not in self.cfg.get("kinds", ())):
            return False
        try:
            self.q.put_nowait((kind, text))
            return True
        except queue.Full:
            return False

    def _post(self, url, data, form=False):
        body = urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded" if form else "application/json",
                                                              "User-Agent": "KRONOS-7"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status

    def _worker(self):
        while True:
            kind, text = self.q.get()
            now = time.time()
            if len([t for t in self.sent if now - t < 3600]) >= 40:
                continue                                  # limit godzinowy
            if self.sent and now - self.sent[-1] < 5:
                time.sleep(5 - (now - self.sent[-1]))
            msg = "KRONOS-7 · " + text
            c = self.cfg
            try:
                if c.get("tg_token") and c.get("tg_chat"):
                    self._post(f"https://api.telegram.org/bot{c['tg_token']}/sendMessage", {"chat_id": c["tg_chat"], "text": msg[:4000], "disable_web_page_preview": "true"}, form=True)
                if c.get("discord"):
                    self._post(c["discord"], {"content": msg[:1900], "username": "KRONOS-7"})
                self.sent.append(time.time()); self.last_err = None
            except Exception as e:
                self.last_err = str(e)[:200]
                self.log(i18n.L(f"Powiadomienie nie wysłane: {e}", f"Notification not sent: {e}"))
