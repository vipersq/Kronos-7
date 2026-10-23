# KRONOS-7 – notatki dla Claude

## Wydanie nowej wersji (vX.YY)
1. Podbij wersję: `server.py` (log startu), `web/app.js` (linia 1 i linia rozruchu „KRONOS-7 PLANETARY INTELLIGENCE · vX.YY”), `web/i18n.js` (ten sam klucz), `kronos/sdr.py` (APRS vers), `kronos/tiles.py` (UA), `kronos/tgacct.py` (app_version), `kronos/extra.py` (UA).
2. Sekcja w `README.md` („… (vX.YY)”), tłumaczenia EN w `web/i18n.js`.
3. **Zawsze zaktualizuj instrukcję PDF**: edytuj `docs/manual/instrukcja.html` (nowe funkcje, klucze, numer wersji na okładce i w stopce `docs/manual/build_pdf.mjs`), w razie potrzeby nowe zrzuty w `docs/manual/img/`, potem `node docs/manual/build_pdf.mjs` → `docs/KRONOS-7-Instrukcja.pdf`. Operator chce aktualną instrukcję w każdej wersji.
4. Commit, push na `operator-settings` i `main`, ZIP (`git archive`) z instrukcją w środku; instrukcję wysłać też osobno.
