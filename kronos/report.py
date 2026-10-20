"""Raport dzienny – samodzielna strona HTML do wydruku lub zapisu jako PDF (Ctrl+P → Zapisz jako PDF).
Bez dodatkowych bibliotek: wykresy jako proste SVG generowane po stronie serwera."""
import html, time
from datetime import datetime

from . import i18n
from .history import METRIC_LABELS

TREND = {"esc": ("ESKALACJA", "ESCALATION"), "new": ("NOWY", "NEW"), "ongoing": ("TRWA", "ONGOING"),
         "deesc": ("DEESKALACJA", "DE-ESCALATION"), "frozen": ("ZAMROŻONY", "FROZEN")}
SRC = {"air": ("Lotnictwo", "Aviation"), "sea": ("Morze", "Maritime")}


def _e(s):
    return html.escape(str(s if s is not None else ""))


def spark(series, w=260, h=54):
    pts = [p for p in series if p[1] is not None]
    if len(pts) < 2:
        return f'<svg width="{w}" height="{h}"><text x="4" y="{h/2}" font-size="10" fill="#777">{_e(i18n.L("za mało danych", "not enough data"))}</text></svg>'
    t0, t1 = pts[0][0], pts[-1][0]
    v = [p[1] for p in pts]; lo, hi = min(v), max(v)
    if hi == lo:
        hi = lo + 1
    xy = " ".join(f"{(p[0]-t0)/(t1-t0 or 1)*(w-8)+4:.1f},{h-6-(p[1]-lo)/(hi-lo)*(h-14):.1f}" for p in pts)
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}"><polyline fill="none" stroke="#1a6b3c" stroke-width="1.6" points="{xy}"/>'
            f'<text x="4" y="10" font-size="9" fill="#555">max {hi:g}</text><text x="4" y="{h-1}" font-size="9" fill="#555">min {lo:g}</text></svg>')


def build(state, hist, operator=""):
    en = i18n.en()
    L = i18n.L
    st = state or {}
    th = st.get("threat") or {}
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    out = [f"""<!doctype html><html lang="{'en' if en else 'pl'}"><head><meta charset="utf-8"><title>KRONOS-7 – {_e(L('raport dzienny', 'daily report'))} {now[:10]}</title>
<style>
body{{font:13px/1.45 "Segoe UI",Arial,sans-serif;color:#111;max-width:900px;margin:24px auto;padding:0 18px}}
h1{{font:700 20px Consolas,monospace;letter-spacing:.12em;margin:0}} h2{{font:700 13px Consolas,monospace;letter-spacing:.1em;border-bottom:2px solid #111;padding-bottom:3px;margin:22px 0 8px}}
.meta{{color:#555;font-size:11px}} .lvl{{display:inline-block;font:700 14px Consolas,monospace;padding:4px 10px;border:2px solid #111;margin:8px 0}}
.c{{margin:0 0 10px;page-break-inside:avoid}} .c b{{font-family:Consolas,monospace}} .t{{font:700 10px Consolas,monospace;padding:1px 5px;border:1px solid #111;margin-left:6px}}
.t.esc{{background:#111;color:#fff}} table{{border-collapse:collapse;width:100%;font-size:12px}} td,th{{border-bottom:1px solid #ddd;padding:3px 6px;text-align:left;vertical-align:top}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px}} .m{{page-break-inside:avoid}} .m div{{font-size:11px;color:#333}}
.bar{{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #ccc;margin-bottom:10px}} button{{font:700 12px Consolas,monospace;padding:6px 14px;cursor:pointer}}
@media print{{.bar{{display:none}} body{{margin:0;max-width:none}}}}
</style></head><body>
<div class="bar"><button onclick="print()">{_e(L('DRUKUJ / ZAPISZ PDF', 'PRINT / SAVE PDF'))}</button></div>
<h1>KRONOS-7 · {_e(L('RAPORT DZIENNY', 'DAILY REPORT'))}</h1>
<div class="meta">{_e(L('Wygenerowano', 'Generated'))}: {now} · {_e(L('ostatnia analiza', 'last analysis'))}: {_e((st.get('stamp') or '—')[:16].replace('T', ' '))}{' · ' + _e(operator) if operator else ''} · {_e(L('model', 'model'))}: {_e(st.get('model') or '—')}</div>
<div class="lvl">{_e(L('POZIOM NAPIĘCIA', 'TENSION LEVEL'))}: {_e(th.get('level', '—'))}/5 · {_e(th.get('label', ''))}</div>
<div>{_e(th.get('note', ''))}</div>"""]
    if st.get("briefing"):
        out.append(f"<h2>{_e(L('BRIEFING', 'BRIEFING'))}</h2><p>{_e(st['briefing'])}</p>")
    if st.get("changes"):
        out.append(f"<h2>{_e(L('ZMIANY OD POPRZEDNIEJ ANALIZY', 'CHANGES SINCE LAST ANALYSIS'))}</h2><p>{_e(st['changes'])}</p>")
    cf = [c for c in st.get("conflicts", []) if c.get("trend") in ("esc", "new", "ongoing")]
    order = {"esc": 0, "new": 1, "ongoing": 2}
    cf.sort(key=lambda c: order.get(c.get("trend"), 3))
    if cf:
        out.append(f"<h2>{_e(L('OGNISKA KONFLIKTÓW', 'CONFLICT HOTSPOTS'))}</h2>")
        for c in cf[:14]:
            tr = c.get("trend") or ""
            out.append(f'<div class="c"><b>{_e(c.get("name"))}</b><span class="t {tr}">{_e(TREND.get(tr, (tr, tr))[1 if en else 0])}</span>'
                       f'<div>{_e(c.get("latest") or c.get("what") or "")}</div></div>')
    if st.get("marketsNote"):
        out.append(f"<h2>{_e(L('RYNKI', 'MARKETS'))}</h2><p>{_e(st['marketsNote'])}</p>")
    if hist:
        out.append(f"<h2>{_e(L('WSKAŹNIKI – OSTATNIE 7 DNI', 'INDICATORS – LAST 7 DAYS'))}</h2><div class='grid'>")
        for k in ("threat", "brent", "air.isr", "air.loiter", "sea.military", "sea.dark", "sea.sts", "hormuz.transits"):
            s = hist.series(k, 7)
            if not s:
                continue
            lab = METRIC_LABELS.get(k, (k, k))[1 if en else 0]
            out.append(f'<div class="m"><div>{_e(lab)} · {_e(L("teraz", "now"))}: <b>{s[-1][1]:g}</b></div>{spark(s)}</div>')
        out.append("</div>")
        ev = hist.events(24, 120)
        if ev:
            out.append(f"<h2>{_e(L('ZDARZENIA – OSTATNIE 24 H', 'EVENTS – LAST 24 H'))}</h2><table><tr><th>{_e(L('czas', 'time'))}</th><th>{_e(L('źródło', 'source'))}</th><th>{_e(L('zdarzenie', 'event'))}</th></tr>")
            for e in ev:
                out.append(f"<tr><td>{time.strftime('%d.%m %H:%M', time.localtime(e['at']/1000))}</td><td>{_e(SRC.get(e['src'], (e['src'], e['src']))[1 if en else 0])}</td><td>{_e(e['msg'])}</td></tr>")
            out.append("</table>")
    out.append(f"<p class='meta' style='margin-top:24px'>{_e(L('Raport z otwartych źródeł, opracowany automatycznie przez lokalny model AI. Wymaga weryfikacji.', 'Open-source report compiled automatically by a local AI model. Requires verification.'))}</p></body></html>")
    return "".join(out)
