/* KRONOS-7 v3.22.2 — interfejs terminala. Dane: lokalny serwer (/api/*). */
(function () {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc0 = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const esc = s => esc0(typeof s === "string" && window.K7_EN && window.K7_LANG === "en" && window.K7_EN[s] != null ? window.K7_EN[s] : s);   // dane z serwera: kraje, kategorie
const A = a => Array.isArray(a) ? a : [];
const LANG = (() => { try { return localStorage.getItem("k7-lang") === '"en"' ? "en" : "pl"; } catch (e) { return "pl"; } })();
const EN = (LANG === "en" && window.K7_EN) || {};
const TX = s => (LANG === "en" && EN[s] != null) ? EN[s] : s;   // tłumaczenie napisu interfejsu
const LOC = LANG === "en" ? "en-GB" : "pl-PL";
window.K7_LANG = LANG;
document.documentElement.lang = LANG;
/* statyczne teksty i atrybuty strony */
(function translateStatic() {
  if (LANG !== "en") return;
  const tr = t => { const m = t.match(/^(\s*)([\s\S]*?)(\s*)$/); return EN[m[2]] != null ? m[1] + EN[m[2]] + m[3] : null; };
  const walkNode = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => { if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) return; const r = tr(n.nodeValue); if (r != null) n.nodeValue = r; });
    (root.querySelectorAll ? root.querySelectorAll("[placeholder],[title],[aria-label]") : []).forEach(el => ["placeholder", "title", "aria-label"].forEach(a => { const v = el.getAttribute(a); if (v) { const r = tr(v); if (r != null) el.setAttribute(a, r); } }));
  };
  walkNode(document.body);
  /* atrybuty dodawane później (np. podpowiedzi przycisków) */
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) n.querySelectorAll && [n, ...n.querySelectorAll("[title],[placeholder]")].forEach(el => ["title", "placeholder"].forEach(a => { const v = el.getAttribute && el.getAttribute(a); if (v && EN[v.trim()] != null) el.setAttribute(a, EN[v.trim()]); })); }))).observe(document.body, { childList: true, subtree: true });
})();
const SOLO = new URLSearchParams(location.search).get("panel") || "";   // okno z jednym odpiętym panelem
const BC = "BroadcastChannel" in window ? new BroadcastChannel("kronos7") : null;
const store = {
  get(k, d) { try { const v = localStorage.getItem("k7-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("k7-" + k, JSON.stringify(v)); } catch (e) {} }
};
/* tryb oszczędny (bez efektów, rzadsze rysowanie) i wstrzymanie animacji, gdy okno nie jest aktywne – mniej pracy dla karty graficznej */
let ECO = !!store.get("eco", false), BGPAUSE = store.get("bgpause", true) !== false, BG = false;
function setEco(on) { ECO = !!on; store.set("eco", ECO); document.body.classList.toggle("eco", ECO); if (typeof markStatic === "function") markStatic(); }
function bgState() { BG = BGPAUSE && !document.hasFocus(); document.body.classList.toggle("bgp", BG); }
document.body.classList.toggle("eco", ECO);
window.addEventListener("blur", bgState); window.addEventListener("focus", bgState); setTimeout(bgState, 1500);
document.addEventListener("keydown", e => { if ((e.key === "e" || e.key === "E") && !e.ctrlKey && !e.altKey && !e.metaKey && !/input|textarea|select/i.test(document.activeElement.tagName)) { setEco(!ECO); if (typeof beep === "function") beep(ECO ? 600 : 1200, .06); } });
const api = (p, body) => fetch(p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then(r => r.json());

const SEC = { all: TX("WSZYSTKO"), conflict: TX("KONFLIKTY"), geo: TX("GEOPOLITYKA"), human: TX("HUMANITARNE"), nature: TX("NATURA"), space: TX("KOSMOS"), ai: TX("AI"), cyber: TX("CYBER"), watch: TX("OBSERWOWANE") };
const LVL = { crit: TX("KRYTYCZNY"), high: TX("WYSOKI"), med: TX("ŚREDNI"), low: TX("NISKI") };
const TREND = { new: [TX("NOWY"), "var(--red)"], esc: [TX("ESKALACJA"), "var(--red)"], ongoing: [TX("TRWAJĄCY"), "var(--amber)"], truce: [TX("KRUCHY ROZEJM"), "var(--violet)"], watch: [TX("OBSERWACJA"), "var(--phos-dim)"] };
const TORDER = { new: 0, esc: 1, ongoing: 2, truce: 3, watch: 4 };
const SHIP = { closed: [TX("ZAMKNIĘTA"), "var(--red)"], restricted: [TX("OGRANICZONA"), "var(--amber)"], disrupted: [TX("ZAKŁÓCONA"), "var(--amber)"], open: [TX("OTWARTA"), "var(--phos)"] };
const CAT = { elect: TX("WYBORY"), summit: TX("SZCZYT"), bank: TX("BANK CENTR."), energy: TX("ENERGIA"), deadline: TX("TERMIN"), space: TX("KOSMOS"), war: TX("WOJNA") };
const FKIND = { cvn: [TX("CV"), TX("LOTNISKOWIEC")], amphib: [TX("AM"), TX("GRUPA DESANTOWA")], naval: ["N", TX("SIŁY MORSKIE")], air: ["A", TX("LOTNICTWO")], ground: ["G", TX("SIŁY LĄDOWE")], exercise: [TX("EX"), TX("ĆWICZENIA")] };
const KND = { airspace: TX("PRZESTRZEŃ"), sabotage: TX("SABOTAŻ"), cable: TX("KABEL"), jamming: TX("ZAGŁUSZANIE"), military: TX("WOJSKO"), shadowfleet: TX("FLOTA CIENI") };
const ACN = { isr: TX("ROZPOZNANIE"), tanker: TX("TANKOWIEC"), bomber: TX("BOMBOWIEC"), transport: TX("TRANSPORT"), fighter: TX("MYŚLIWIEC"), other: TX("INNY") };
const NKS = { crit: [TX("KRYTYCZNY"), "var(--red)"], warn: [TX("OSTRZEŻENIE"), "var(--amber)"], ok: [TX("OK"), "var(--phos)"], unknown: [TX("NIEZNANY"), "var(--phos-dim)"] };
const ASL = { closed: [TX("ZAMKNIĘTA"), "var(--red)"], avoid: [TX("OMIJAĆ"), "var(--amber)"], caution: [TX("OSTROŻNIE"), "var(--violet)"] };
const REL = { A: TX("całkowicie wiarygodne"), B: TX("zwykle wiarygodne"), C: TX("dość wiarygodne"), D: TX("zwykle niewiarygodne"), E: "niewiarygodne", F: TX("nie można ocenić") };
const INFO = { 1: TX("potwierdzona przez inne źródła"), 2: TX("prawdopodobnie prawdziwa"), 3: TX("możliwie prawdziwa"), 4: TX("wątpliwa"), 5: "nieprawdopodobna", 6: TX("nie można ocenić") };
const MON = LANG === "en" ? window.K7_EN_MON : ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const COL = c => "var(--" + (c || "phos") + ")";
const THEATERS = [["world", TX("ŚWIAT"), null], ["ua", TX("UKRAINA"), [[29.5, 45.6], [40.8, 52.6]]], ["bs", TX("M. CZARNE"), [[27, 40.6], [42, 47.6]]],
  ["ef", TX("FLANKA NATO"), [[13, 50], [32, 60.5]]], ["me", TX("BLISKI WSCHÓD"), [[30, 11], [64, 40]]], ["hz", TX("ORMUZ"), [[50.5, 23], [60, 28.8]]],
  ["ye", TX("JEMEN · M. CZERWONE"), [[36.5, 11], [50, 20]]], ["lev", TX("LEWANT"), [[33.9, 30.95], [36.4, 33.8]]], ["sd", TX("SUDAN"), [[21, 7.5], [39, 20]]],
  ["cd", TX("KONGO"), [[26.8, -4.6], [30.8, 0.6]]], ["mm", TX("MJANMA"), [[91.5, 16.5], [98.5, 25.5]]], ["tw", TX("TAJWAN"), [[115, 19.5], [126, 27.5]]], ["wp", TX("ZACH. PACYFIK"), [[110, 5], [160, 42]]]];
const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
function fmtDate(d) { const p = String(d).split("-"); if (p.length === 3) return (+p[2].slice(0, 2)) + " " + MON[+p[1] - 1] + " " + p[0]; if (p.length === 2) return MON[+p[1] - 1] + " " + p[0]; return d; }
const fd = d => d ? fmtDate(String(d).slice(0, 10)) : "";
function dayDiff(d) { const p = String(d).split("-"); if (p.length < 3) return null; const t = Date.UTC(+p[0], +p[1] - 1, +p[2].slice(0, 2)); const n = new Date(); return Math.round((t - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); }
function countdown(d) { const n = dayDiff(d); if (n == null) return TX("termin w miesiącu"); if (n === 0) return TX("DZIŚ"); if (n === 1) return "jutro"; if (n < 0) return Math.abs(n) + " " + TX("dni temu"); return "za " + n + " dni"; }
const pct = p => Math.round(p * 100) + "%";
const chip = (txt, col) => `<span class="chip" style="color:${col}">${esc(txt)}</span>`;
function spark(h, hgt) { h = A(h); if (h.length < 2) return ""; const mx = Math.max(...h), mn = Math.min(...h), r = (mx - mn) || 1, hh = hgt || 24;
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * 98 + 1},${hh - 2 - ((v - mn) / r) * (hh - 6)}`).join(" "); const up = h[h.length - 1] >= h[0];
  return `<svg viewBox="0 0 100 ${hh}" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:${hh}px;display:block"><polyline points="${pts}" style="fill:none;stroke:${up ? "var(--phos)" : "var(--red)"}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`; }
function srcLinks(arr) { return A(arr).filter(s => Array.isArray(s) && s[1]).map(s => `<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a>`).join(" · "); }
const L = (u, n) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n || TX("źródło"))}</a>` : "";
function dd(rows) { return `<dl class="dl">${rows.filter(r => r && r[1] != null && r[1] !== "").map(r => `<dt>${r[0]}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd>`).join("")}</dl>`; }

const AIR = { ok: false, d: null, mk: {}, skew: 0, lastEv: 0, first: true, at: 0 };
const SATSEL = Object.assign({ base: true, groups: [], pins: [] }, store.get("satsel", {}));
let SATPIN = [];                      // [nazwa, norad, l1, l2] przypiętych
const SATG = {};                      // grupa -> { recs:[{name,norad,rec,l1}], el:path, pts:[] }
const SEA = { ok: false, d: null, skew: 0, lastEv: 0, first: true, since: 0, detail: {} };
const CABLES = { lines: null, loading: false };
const SHIPSTAT = { view: 0, filt: 0, old: 0, total: 0, at: 0 };
const REPLAY = { on: false, t: 0, from: 0, to: 0, playing: false, air: [], ships: new Map(), ev: [], busy: false, want: 0, timer: null };
let S = {}, CURRENT = null, ARCH = false, STATUS = null, MK = null, selected = null;
const F = () => S.feeds || {};

/* ------------------------------------------------------------ dźwięk, alarm, kompakt, zegary */
/* Dźwięk: silnik w sound.js (K7Sound). Tu tylko włączanie, ustawienia i wywołania. */
let actx = null, SE = null, audioOn = SOLO ? false : store.get("audio", false), klaxon = null, humH = null, burbleT = null;
const SND = Object.assign({ vol: .7, hum: true, chatter: true }, store.get("sound", {}));
function eng() {
  if (!audioOn || !window.K7Sound) return null;
  try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); SE = window.K7Sound(actx, actx.destination); SE.setVol(SND.vol); }
    if (actx.state === "suspended") actx.resume(); return SE; } catch (e) { return null; }
}
const sfxRaw = (name, ...a) => { const e = eng(); if (e) try { return e[name](...a); } catch (err) {} };
/* własne dźwięki: każde zdarzenie (slot) może grać plik z data/sounds, syntezator KRONOS-a albo nic */
const SLOT_OF = { click: "click", beep: "click", blip: "click", error: "click", key: "key", carriage: "key", chatter: "key", powerUp: "boot", done: "done", contact: "contact", whoop: "klaxon", alarm: "threat", burblePhrase: "burble" };
let CSND = { map: {}, files: [] };
const BUF = {}, SLOT_T = {};
function audioCtx() { try { if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); SE = window.K7Sound ? window.K7Sound(actx, actx.destination) : null; if (SE) SE.setVol(SND.vol); }
  if (actx.state === "suspended") actx.resume(); return actx; } catch (e) { return null; } }
function loadBuf(file) {
  if (!BUF[file]) BUF[file] = fetch("/sounds/" + encodeURIComponent(file)).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(b => audioCtx().decodeAudioData(b)).catch(() => { delete BUF[file]; return null; });
  return BUF[file];
}
function playFile(file, vol, loop, force) {
  if (!force && !audioOn) return null; const c = audioCtx(); if (!c) return null;
  const g = c.createGain(); g.gain.value = SND.vol * (vol == null ? 1 : vol / 100); g.connect(c.destination);
  const h = { src: null, stopped: false, stop() { this.stopped = true; try { this.src && this.src.stop(); } catch (e) {} } };
  loadBuf(file).then(buf => { if (!buf || h.stopped) return; const s2 = c.createBufferSource(); s2.buffer = buf; s2.loop = !!loop; s2.connect(g); s2.start(); h.src = s2; h.dur = buf.duration; });
  return h;
}
const slotCfg = slot => CSND.map[slot] || null;
/* zwraca: undefined – użyj syntezatora; 0 – wyciszone; liczba – zagrano plik */
function slotPlay(slot) {
  const c = slotCfg(slot); if (!c) return undefined; if (c.off) return 0;
  const now = performance.now(); if (now - (SLOT_T[slot] || 0) < (slot === "key" ? 90 : 40)) return 0; SLOT_T[slot] = now;
  playFile(c.file, c.vol); return .4;
}
const sfx = (name, ...a) => { const sl = SLOT_OF[name]; if (sl) { const r = slotPlay(sl); if (r !== undefined) return r; } return sfxRaw(name, ...a); };
function sndEvent(slot, synth) { const r = slotPlay(slot); if (r === undefined && synth) synth(); }
function beep(f = 880, d = .05, type = "square") { sfx("beep", f, d, type); }
function chatter(n = 20) { if (SND.chatter) sfx("chatter", n); }
let burbleH = null;
function burble(on) {
  clearTimeout(burbleT); burbleT = null; if (burbleH) { burbleH.stop(); burbleH = null; } if (!on || !audioOn || !SND.chatter) return;
  const c = slotCfg("burble"); if (c) { if (!c.off) { burbleH = playFile(c.file, c.vol, true); burbleT = -1; } return; }
  const loop = () => { const dur = sfxRaw("burblePhrase") || .4; burbleT = setTimeout(loop, dur * 1000); }; loop();
}
function hum(on) { if (humH) { humH.stop(); humH = null; } if (on && audioOn && SND.hum) { const c = slotCfg("hum"); if (c) { if (!c.off) humH = playFile(c.file, c.vol, true); return; } const e = eng(); if (e) humH = e.humStart(); } }
const powerUp = () => sfx("powerUp"), doneChime = () => sfx("done"), alarmBurst = n => sfx("alarm", n || 2);
const WATCHK = new Set(["sanc", "dark", "sts", "cable"]);
let klaxonH = null;
function startKlaxon() { stopKlaxon(); if (!audioOn) return; const c = slotCfg("klaxon"); if (c) { if (!c.off) klaxonH = playFile(c.file, c.vol, true); return; } sfxRaw("whoop"); klaxon = setInterval(() => sfxRaw("whoop"), 780); }
function stopKlaxon() { if (klaxon) { clearInterval(klaxon); klaxon = null; } if (klaxonH) { klaxonH.stop(); klaxonH = null; } }
function setAudio(on) { audioOn = on; store.set("audio", on); $("#audioBtn").setAttribute("aria-pressed", on);
  if (on) { sfx("click"); sfx("blip", 1568, .08); hum(true); if (document.body.classList.contains("alert")) startKlaxon(); } else { hum(false); burble(false); stopKlaxon(); } }
$("#audioBtn").addEventListener("click", () => setAudio(!audioOn));
$("#audioBtn").setAttribute("aria-pressed", audioOn);
window.K7SND = { state: () => ({ on: audioOn, ctx: actx && actx.state, hum: !!humH, burble: !!burbleT, vol: SND.vol }), sfx };
/* przeglądarka pozwala grać dopiero po pierwszym kliknięciu – wtedy wznawiamy dźwięk z poprzedniej sesji */
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (audioOn && !humH) hum(true); }, { once: true }));
/* każdy przycisk terminala klika jak przekaźnik */
document.addEventListener("click", e => { if (e.target.closest("button.btn") && e.target.id !== "audioBtn") sfx("click"); }, true);
$("#alertBtn").addEventListener("click", e => { const on = !document.body.classList.contains("alert"); document.body.classList.toggle("alert", on); e.currentTarget.setAttribute("aria-pressed", on); on ? startKlaxon() : stopKlaxon(); });
function setCompact(on) { document.body.classList.toggle("compact", on); $("#compactBtn").setAttribute("aria-pressed", on); store.set("compact", on); }
$("#compactBtn").addEventListener("click", () => { beep(700); setCompact(!document.body.classList.contains("compact")); });
setCompact(store.get("compact", false));
function clocks() { const n = new Date(); $("#utc").textContent = n.toISOString().slice(11, 19); $("#loc").textContent = n.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }); nextRun(n); }
/* odliczanie do następnej analizy AI – wtedy karta graficzna jest zajęta i komputer może zwolnić */
function nextRun(n) {
  const el = $("#nextAn"), box = el && el.parentNode; if (!el || !STATUS) return;
  const j = STATUS.job || {}, pull = (STATUS.engine && STATUS.engine.pull) || {};
  if (j.running || pull.active) { el.textContent = (pull.active ? TX("POBIERANIE") : TX("TRWA")) + " " + (j.pct || pull.pct || 0) + "%"; box.classList.add("busy"); box.title = TX("Analiza AI w toku – karta graficzna jest zajęta"); return; }
  box.classList.remove("busy");
  if (!STATUS.next) { el.textContent = "—"; return; }
  const ms = new Date(STATUS.next) - n; if (ms <= 0) { el.textContent = TX("ZARAZ"); return; }
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), sec = Math.floor(ms % 60000 / 1000);
  el.textContent = h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m}:${String(sec).padStart(2, "0")}`;
  box.classList.toggle("soon", ms < 10 * 60000);
  box.title = TX("Następna analiza AI:") + " " + new Date(STATUS.next).toLocaleString(LOC, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
clocks(); setInterval(clocks, 1000);

/* ------------------------------------------------------------ MAPA */
const W = 960; let H = 480;   // szerokość stała (współrzędne wewnętrzne), wysokość dopasowana do okna
const svg = d3.select("#map");
let mode = store.get("proj", "flat"), rot = [-30, -25], dragging = false, T = d3.zoomIdentity;
/* mapa płaska: wektorowa (rzut walcowy równoodległościowy) albo z podkładem kafelkowym (rzut Merkatora, jak w mapach internetowych) */
/* [nazwa, adres kafelków, atrybucja, filtr, nakładka z napisami, maks. zoom] */
const BASES = { vector: [TX("WEKTOR"), null],
  dark: [TX("CIEMNA SZCZEGÓŁOWA"), "/tile/dark{r}/{z}/{x}/{y}", "© Stadia Maps · © OpenMapTiles · © OpenStreetMap", null, null, 20],
  darkesri: [TX("CIEMNA SZARA"), "/tile/darkesri/{z}/{x}/{y}", "Esri, HERE, Garmin, © OpenStreetMap", null, "/tile/darkesri+/{z}/{x}/{y}", 16],
  sat: [TX("SATELITA"), "/tile/sat/{z}/{x}/{y}", "Esri, Maxar, Earthstar Geographics", "brightness(.6) saturate(.75)", "/tile/sat+/{z}/{x}/{y}", 18],
  osm: [TX("OSM NOCNA"), "/tile/osm/{z}/{x}/{y}", "© OpenStreetMap", "invert(1) hue-rotate(180deg) brightness(.85) contrast(.9) saturate(.6)", null, 19] };
let BASE = BASES[store.get("basemap", "vector")] ? store.get("basemap", "vector") : "vector";
let MERC = BASE !== "vector";
const equi = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
const merc = d3.geoMercator().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
let flat = MERC ? merc : equi;
const flatExtent = () => MERC ? [[0, H / 2 - W / 2], [W, H / 2 + W / 2]] : [[0, Math.min(0, H / 2 - W / 4)], [W, Math.max(H, H / 2 + W / 4)]];
const globe = d3.geoOrthographic().scale(232).translate([W / 2, H / 2]).clipAngle(90).precision(.4);
function sizeMap() {
  const r = $("#mapbox").getBoundingClientRect(); if (!r.width || !r.height) return false;
  const nh = Math.round(W * Math.max(.3, Math.min(.85, r.height / r.width)));
  if (nh === H && sizeMap.done) return false; H = nh; sizeMap.done = true;
  svg.attr("viewBox", `0 0 ${W} ${H}`); equi.translate([W / 2, H / 2]); merc.translate([W / 2, H / 2]); globe.scale(Math.min(W, H) * .47).translate([W / 2, H / 2]);
  if (typeof zoom !== "undefined") zoom.extent([[0, 0], [W, H]]).translateExtent(flatExtent());
  return true;
}
let proj = flat, path = d3.geoPath(flat);
function fixWinding(fc) {   // niektóre wielokąty mają odwrotną orientację i d3 rysuje je jako „cały świat bez kraju”
  const fix = poly => { if (d3.geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI) poly.forEach(r => r.reverse()); };
  fc.features.forEach(f => { const g = f.geometry; if (!g) return; if (g.type === "Polygon") fix(g.coordinates); else if (g.type === "MultiPolygon") g.coordinates.forEach(fix); });
  return fc;
}
const land110 = fixWinding(topojson.feature(window.__LAND, window.__LAND.objects.countries));
let land50 = null, landHi = false;
const root = svg.append("g");
const gSphere = root.append("path").attr("class", "sphere");
const gGrat = root.append("path").attr("class", "grat");
const gLand = root.append("path").attr("class", "land");
const LAYERS = [["conf", TX("KONFLIKTY"), 1], ["front", TX("FRONTY"), 1], ["move", TX("NATARCIA"), 1], ["strike", TX("UDERZENIA"), 1], ["force", TX("SIŁY"), 1], ["ship", TX("ŻEGLUGA"), 1],
  ["haz", TX("NATURA"), 1], ["sat", TX("ORBITY"), 1], ["air", TX("LOTNICTWO"), 1], ["vessel", TX("STATKI"), 1], ["cable", TX("KABLE"), 0], ["marsec", TX("INCYDENTY MORSKIE"), 1], ["uaal", TX("ALARMY UA"), 1], ["dstate", TX("DEEPSTATE"), 0], ["notam", TX("NOTAM"), 0], ["sar", TX("SAR"), 0], ["osint", TX("OSINT TG"), 0], ["corr", TX("KORELACJE"), 1], ["acled", TX("ACLED"), 0], ["rad", TX("PROMIENIOWANIE"), 0], ["il", TX("ALARMY IL"), 1], ["isw", TX("ISW"), 0], ["gc", TX("GEOCONFIRMED"), 0], ["emsc", TX("EMSC"), 0], ["myadsb", TX("MOJE ADS-B"), 0], ["aprs", TX("APRS"), 0], ["flank", TX("FLANKA"), 1], ["nuke", TX("ATOM"), 1], ["asp", TX("PRZESTRZEŃ"), 0], ["gps", TX("GNSS"), 0],
  ["fire", TX("POŻARY"), 0], ["net", TX("SIEĆ"), 0], ["hum", TX("HUMANITARNE"), 0], ["cyber", TX("CYBER"), 0], ["news", TX("DEPESZE"), 0], ["night", TX("NOC"), 1]];
const DRAW_ORDER = ["uaal", "dstate", "notam", "sar", "osint", "corr", "acled", "rad", "il", "isw", "gc", "emsc", "myadsb", "aprs", "marsec", "cable", "night", "gps", "fire", "asp", "vessel", "ship", "sat", "haz", "front", "move", "strike", "force", "net", "hum", "nuke", "flank", "air", "airlive", "cyber", "news", "conf"];
const G = {}; DRAW_ORDER.forEach(k => G[k] = root.append("g").attr("data-l", k));
const pNight = G.night.append("path").attr("class", "night"), pTwi = G.night.append("path").attr("class", "twi");
let layerOn = Object.assign(Object.fromEntries(LAYERS.map(l => [l[0], !!l[2]])), store.get("layers3", {}));
$("#layers").innerHTML = LAYERS.map(([k, n]) => `<button class="btn" data-layer="${k}" aria-pressed="${!!layerOn[k]}">${n}</button>`).join("");
function applyLayers() { LAYERS.forEach(([k]) => G[k].style("display", layerOn[k] ? null : "none"));
  G.air.style("display", layerOn.air && !AIR.ok ? null : "none"); if (layerOn.cable) loadCables(); if (layerOn.dstate) loadDS(); if (layerOn.myadsb || layerOn.aprs) pollSdr(); if (layerOn.acled && typeof loadAcled === "function") loadAcled(); if (typeof loadX === "function") loadX(); markStatic(); }
$$("[data-layer]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.layer; layerOn[k] = !layerOn[k]; b.setAttribute("aria-pressed", layerOn[k]); store.set("layers3", layerOn); beep(600); applyLayers(); }));
function ensureLayer(k) { if (k && !layerOn[k]) { const b = $(`[data-layer="${k}"]`); if (b) b.click(); } }

let markers = [], dots = [], geoPaths = [];   // markery (stały rozmiar), kropki (skalują się z mapą), ścieżki geograficzne
const grat = d3.geoGraticule().step([15, 15])(), sphere = { type: "Sphere" };
let nightGeo = null;
function sunPos(date) {
  const rad = Math.PI / 180, d = (date - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const g = (357.529 + .98560028 * d) * rad, q = 280.459 + .98564736 * d;
  const Ls = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * rad, e = (23.439 - .00000036 * d) * rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(Ls)), ra = Math.atan2(Math.cos(e) * Math.sin(Ls), Math.cos(Ls)) / rad;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360; return [((ra - gmst + 540) % 360) - 180, dec / rad];
}
function updNight() { const [lon, lat] = sunPos(Date.now()); nightGeo = d3.geoCircle().center([lon > 0 ? lon - 180 : lon + 180, -lat]).radius(90)(); }
const LL = pts => ({ type: "LineString", coordinates: pts.map(p => [p[1], p[0]]) });

function visible(lon, lat) { return mode !== "globe" || d3.geoDistance([lon, lat], [-rot[0], -rot[1]]) < Math.PI / 2 - .03; }
function placeMarkers() {
  const k = mode === "globe" ? 1 : T.k;
  markers.forEach(m => {
    if (!visible(m.lon, m.lat)) { m.el.style.display = "none"; return; }
    const p = proj([m.lon, m.lat]); if (!p) { m.el.style.display = "none"; return; }
    m.el.style.display = "";
    m.el.setAttribute("transform", `translate(${p[0].toFixed(2)},${p[1].toFixed(2)})${k !== 1 ? ` scale(${1 / k})` : ""}${m.rot ? ` rotate(${m.rot})` : ""}`);
  });
}
function redraw() {
  if (typeof seaViewCheck === "function" && mode === "globe") seaViewCheck();
  root.attr("transform", mode === "globe" ? null : T);
  gSphere.attr("d", mode === "globe" ? path(sphere) : null);
  gGrat.attr("d", path(grat));
  gLand.attr("d", path(mode === "flat" && landHi && land50 ? land50 : land110));
  if (nightGeo) { pNight.attr("d", path(nightGeo)); pTwi.attr("d", path(nightGeo)); }
  geoPaths.forEach(g => g.node.setAttribute("d", path(g.geo) || ""));
  dots.forEach(d => { const vis = visible(d.lon, d.lat), p = vis && proj([d.lon, d.lat]);
    if (!p) { d.el.style.display = "none"; return; } d.el.style.display = ""; d.el.setAttribute("cx", p[0].toFixed(2)); d.el.setAttribute("cy", p[1].toFixed(2)); });
  placeMarkers(); zoomClasses();
}
function zoomClasses() { markStatic(); const k = mode === "globe" ? 1 : T.k; svg.classed("z3", k >= 3).classed("z6", k >= 6); $("#zoomlvl").textContent = mode === "globe" ? "3D" : "×" + (k < 10 ? k.toFixed(1) : Math.round(k)); }
function loadHi() {
  if (land50 || loadHi.busy) return; loadHi.busy = true;
  const s = document.createElement("script"); s.src = "vendor/land50.js";
  s.onload = () => { land50 = fixWinding(topojson.feature(window.__LAND50, window.__LAND50.objects.countries)); if (landHi) redraw(); };
  document.body.appendChild(s);
}
const zoom = d3.zoom().scaleExtent([1, MERC ? 4000 : 320]).translateExtent(flatExtent()).extent([[0, 0], [W, H]])
  .filter(ev => mode === "flat" && (ev.type === "wheel" || ev.type === "dblclick" || ev.type === "mousedown" ? !ev.button : (ev.touches ? ev.touches.length > 1 : true)))
  .on("zoom", ev => { T = ev.transform; root.attr("transform", T); placeMarkers(); zoomClasses(); if (typeof seaViewCheck === "function") seaViewCheck();
    const hi = T.k >= 2.5; if (hi !== landHi) { landHi = hi; if (hi) loadHi(); gLand.attr("d", path(hi && land50 ? land50 : land110)); } });
svg.call(zoom).on("dblclick.zoom", null);
svg.style("touch-action", "pan-y");
svg.call(d3.drag().filter(ev => mode === "globe" && !ev.target.closest(".mk"))
  .on("start", () => { dragging = true; }).on("drag", ev => { rot = [rot[0] + ev.dx * .3, Math.max(-85, Math.min(85, rot[1] - ev.dy * .3))]; globe.rotate(rot); redraw(); })
  .on("end", () => { dragging = false; spinPaused = Date.now() + 8000; }));
let lastSpin = 0, spinPaused = 0;
d3.timer(t => {
  if (mode !== "globe" || dragging || reduce || t - lastSpin < 60 || document.hidden || spinPaused > Date.now() || document.body.classList.contains("compact")) return;
  lastSpin = t; rot = [rot[0] + .12, rot[1]]; globe.rotate(rot); redraw();
});
function setMode(m) {
  mode = m; store.set("proj", m);
  proj = m === "globe" ? globe.rotate(rot) : flat; path = d3.geoPath(proj);
  $("#map").classList.toggle("globe", m === "globe"); $("#projBtn").setAttribute("aria-pressed", m === "globe"); $("#map").classList.toggle("tiles", MERC && m === "flat");
  if (m === "globe") { T = d3.zoomIdentity; svg.call(zoom.transform, d3.zoomIdentity); }
  redraw();
}
$("#projBtn").addEventListener("click", () => { beep(600); setMode(mode === "globe" ? "flat" : "globe"); });
$("#baseSel").innerHTML = Object.entries(BASES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join(""); $("#baseSel").value = BASE;
$("#baseSel").addEventListener("change", e => setBase(e.target.value));
let AUTOZ = store.get("autozoom", true);      // przybliżanie mapy po kliknięciu obiektu
function zoomBox(box, anim) {
  if (go.busy && !AUTOZ) return;
  if (mode === "globe") { if (box) rotateTo((box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2); return; }
  if (!box) { svg.transition().duration(anim && !reduce ? 650 : 0).call(zoom.transform, d3.zoomIdentity); return; }
  const a = flat([box[0][0], box[1][1]]), b = flat([box[1][0], box[0][1]]);
  const k = Math.max(1, Math.min(320, .92 / Math.max((b[0] - a[0]) / W, (b[1] - a[1]) / H)));
  const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2);
  svg.transition().duration(anim && !reduce ? 750 : 0).call(zoom.transform, t);
}
function rotateTo(lon, lat) {
  if (go.busy && !AUTOZ) return;
  spinPaused = Date.now() + 15000; const from = rot.slice(), to = [-lon, -lat * .8];
  if (reduce) { rot = to; globe.rotate(rot); redraw(); return; }
  const it = d3.interpolate(from, to); d3.transition().duration(900).tween("rot", () => t => { rot = it(t); globe.rotate(rot); redraw(); });
}
let theater = store.get("theater", "world");
function setTheater(id, anim) {
  theater = id; store.set("theater", id); const th = THEATERS.find(t => t[0] === id) || THEATERS[0];
  $("#theaterName").textContent = th[1]; $$("[data-th]").forEach(b => b.setAttribute("aria-pressed", b.dataset.th === id)); zoomBox(th[2], anim);
}
$("#theaters").innerHTML = THEATERS.map(t => `<button class="btn" data-th="${t[0]}" aria-pressed="false">${t[1]}</button>`).join("");
$$("[data-th]").forEach(b => b.addEventListener("click", () => { beep(800); setView("map"); setTheater(b.dataset.th, true); }));
function flyTo(lat, lon, span) {
  if (lat == null || lon == null || (go.busy && !AUTOZ)) return;
  if (mode === "globe") { rotateTo(lon, lat); return; }
  const s = span || 6; zoomBox([[lon - s, lat - s / 2], [lon + s, lat + s / 2]], true);
  theater = ""; $$("[data-th]").forEach(b => b.setAttribute("aria-pressed", "false")); $("#theaterName").textContent = fmtLL(lat, lon);
}
function flyPts(pts) {
  if (go.busy && !AUTOZ) return;
  const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
  if (mode === "globe") return rotateTo(d3.mean(lo), d3.mean(la));
  const pad = Math.max(1.1, (d3.max(lo) - d3.min(lo)) * .6, (d3.max(la) - d3.min(la)) * .6);
  zoomBox([[d3.min(lo) - pad, d3.min(la) - pad / 2], [d3.max(lo) + pad, d3.max(la) + pad / 2]], true);
  theater = ""; $$("[data-th]").forEach(b => b.setAttribute("aria-pressed", "false"));
}
function setAutoZ(on) { AUTOZ = on; store.set("autozoom", on); $("#azBtn").setAttribute("aria-pressed", on); }
$("#azBtn").addEventListener("click", () => setAutoZ(!AUTOZ)); setAutoZ(AUTOZ);
$("#zin").addEventListener("click", () => { if (mode === "flat") svg.transition().duration(reduce ? 0 : 300).call(zoom.scaleBy, 2); });
$("#zout").addEventListener("click", () => { if (mode === "flat") svg.transition().duration(reduce ? 0 : 300).call(zoom.scaleBy, .5); });
$("#zreset").addEventListener("click", () => setTheater("world", true));

function mk(layer, lat, lon, shape, color, id, label, opt = {}) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;
  const a = G[layer].append("g").attr("class", "mk" + (opt.cls ? " " + opt.cls : "")).attr("tabindex", 0).attr("role", "button").attr("aria-label", label).attr("data-id", id);
  if (opt.pulse && !reduce) a.append("circle").attr("class", "pulse").attr("r", 6).style("stroke", color);
  const s = opt.size || 1;
  if (shape === "sq") a.append("rect").attr("class", "core").attr("x", -4 * s).attr("y", -4 * s).attr("width", 8 * s).attr("height", 8 * s).style("fill", color);
  else if (shape === "tri") a.append("path").attr("class", "core").attr("d", "M0,-5L5,4L-5,4Z").style("fill", color);
  else if (shape === "dia") a.append("path").attr("class", "core").attr("d", "M0,-5L5,0L0,5L-5,0Z").style("fill", color);
  else if (shape === "ring") a.append("circle").attr("class", "core").attr("r", 6).style("fill", "var(--void)").style("stroke", color).style("stroke-width", 2.2);
  else if (shape === "x") a.append("path").attr("class", "core").attr("d", "M-4,-4L4,4M4,-4L-4,4").style("stroke", color).style("stroke-width", 2.4).style("fill", "none");
  else if (shape === "head") a.append("path").attr("class", "core").attr("d", "M7,0L-3,-5L-1,0L-3,5Z").style("fill", color);
  else if (shape === "tag") { const w = opt.w || 16; a.append("rect").attr("class", "core").attr("x", -w / 2).attr("y", -7).attr("width", w).attr("height", 14).style("fill", "var(--void)").style("stroke", color).style("stroke-width", 1.4);
    a.append("text").attr("text-anchor", "middle").attr("y", 4).style("fill", color).style("font-family", "var(--f-display)").style("font-size", "12px").style("pointer-events", "none").text(opt.txt || ""); }
  else if (shape === "dot") a.append("circle").attr("class", "core").attr("r", 3.2 * s).style("fill", color).style("stroke", "var(--void)").style("stroke-width", 1);
  else a.append("circle").attr("class", "core").attr("r", 4.5).style("fill", color);
  if (opt.lbl) a.append("text").attr("class", opt.lblClass || "lbl").attr("x", opt.lx || 8).attr("y", opt.ly || 4).text(opt.lbl);
  markers.push({ el: a.node(), lon, lat, rot: opt.rot || 0 });
  return a;
}
function gpath(layer, geo, cls, style) { const n = G[layer].append("path").attr("class", cls); if (style) Object.entries(style).forEach(([k, v]) => n.style(k, v)); geoPaths.push({ node: n.node(), geo }); return n; }
function gdot(layer, lat, lon, r, style, id) { const c = G[layer].append("circle").attr("r", r); Object.entries(style).forEach(([k, v]) => c.style(k, v));
  if (id) c.attr("data-id", id).style("cursor", "pointer").on("click", () => go(id)); dots.push({ el: c.node(), lon, lat }); return c; }

function buildMap() {
  DRAW_ORDER.filter(k => k !== "night" && k !== "airlive" && k !== "vessel").forEach(k => G[k].selectAll(":scope > :not(.satcloud)").remove()); markers = []; dots = []; geoPaths = [];
  const f = F(), ch = S.changes || {}, nm = ch.new_mods || {};
  const isNew = (k, id) => A(nm[k]).includes(id);
  if (f.gpsjam && f.gpsjam.pts) f.gpsjam.pts.forEach(d => gdot("gps", d[0], d[1], .55, { fill: d[2] >= .3 ? "var(--red)" : "var(--amber)", opacity: .15 + d[2] * .45, "pointer-events": "none" }));
  A(f.firms).forEach((c, i) => gdot("fire", c.lat, c.lon, Math.max(.3, .3 * Math.min(3, Math.sqrt(c.frp / 80))), { fill: "#ff7a2a", opacity: .85 }, "fire:" + i));
  const AL = { closed: ["X", "var(--red)"], avoid: ["!", "var(--amber)"], caution: ["?", "var(--violet)"] };
  A(S.airspace).forEach(a => { const l = AL[a.level] || AL.caution; mk("asp", a.lat, a.lon, "tag", l[1], "asp:" + a.id, a.name, { txt: l[0], w: 14, lbl: a.name, lblClass: "lbl shlbl", lx: 10 }); });
  A(f.ioda).filter(x => x.lat != null).slice(0, 12).forEach((x, i) => mk("net", x.lat, x.lon, "ring", "var(--red)", "net:" + i, x.name, { lbl: x.name, lblClass: "lbl shlbl", lx: 9 }));
  A(S.humanitarian).forEach((h, i) => mk("hum", h.lat, h.lon, "tag", "var(--amber)", "hum:" + i, h.t, { txt: "+", w: 13, cls: isNew("humanitarian", h.id) ? "new" : "" }));
  A(f.who).forEach((w, i) => mk("hum", w.lat, w.lon, "tag", "var(--red)", "who:" + i, w.dis, { txt: "+", w: 13, lbl: w.dis, lblClass: "lbl shlbl", lx: 9 }));
  A(S.items).filter(i => i.s === "human" && i.lat != null).forEach(i => mk("hum", i.lat, i.lon, "dot", "var(--khaki)", "n:" + i.id, i.h));
  const NC = { crit: "var(--red)", warn: "var(--amber)", ok: "var(--phos)", unknown: "var(--phos-dim)" };
  A(S.nuclear).forEach((n, i) => mk("nuke", n.lat, n.lon, "tag", NC[n.status] || NC.unknown, "nk:" + i, n.name, { txt: TX("AT"), w: 20, lbl: n.name, lblClass: "lbl hlbl", lx: 12 }));
  A(S.eastflank).forEach((e, i) => mk("flank", e.lat, e.lon, "dot", "var(--violet)", "ef:" + i, e.t, { size: 1.4, lbl: e.t, lblClass: "lbl hlbl", lx: 6, cls: isNew("eastflank", e.id) ? "new" : "" }));
  const AC = { isr: "var(--cyan)", tanker: "var(--amber)", bomber: "var(--red)", transport: "var(--violet)", fighter: "var(--phos)", other: "var(--phos-dim)" };
  A(f.adsb && f.adsb.ac).forEach((a, i) => mk("air", a.lat, a.lon, "head", AC[a.cat] || AC.other, "ac:" + i, (a.cs || a.hex) + " " + a.t, { rot: (a.trk || 0) - 90, size: .9 }));
  A(f.gdacs).forEach((g, i) => { if (g.track && g.track.length > 1) gpath("haz", LL(g.track), "gtrack");
    mk("haz", g.lat, g.lon, "ring", g.lvl === "Red" ? "var(--red)" : "#ff9a3a", "gd:" + i, g.kind + " " + g.name, { pulse: g.lvl === "Red" }); });
  A(f.nhc).forEach((n, i) => mk("haz", n.lat, n.lon, "ci", "var(--red)", "nhc:" + i, n.name, { pulse: true, lbl: n.name, lblClass: "lbl shlbl" }));
  A(S.hazards).forEach((h, i) => { const shape = h.kind === "quake" ? "tri" : h.kind === "volcano" ? "dia" : "ci"; mk("haz", h.lat, h.lon, shape, (h.alert === "RED" || /^M7|^M8|^M9/.test(h.mag || "")) ? "var(--red)" : "var(--amber)", "h:" + i, (LANG === "en" ? h.name || h.name_pl : h.name_pl || h.name), { pulse: h.kind === "storm" }); });
  A(S.fronts).forEach(fr => {
    A(fr.prev).forEach(seg => gpath("front", LL(seg), "fprev"));
    A(fr.line).forEach(seg => { gpath("front", LL(seg), "fline"); gpath("front", LL(seg), "fline hit").attr("data-id", "f:" + fr.id).on("click", () => go("f:" + fr.id)); });
    A(fr.holds).forEach((h, i) => { const sd = fr.sides && fr.sides[h[2]]; const c = h[2] === "x" ? "var(--white)" : COL(sd && sd[1]);
      mk("front", h[1][0], h[1][1], "dot", c, "fh:" + fr.id + ":" + i, h[0], { lbl: h[0], lblClass: "lbl hlbl", lx: 6, ly: -5 }); });
    A(fr.moves).forEach((m, i) => { const sd = fr.sides && fr.sides[m.side]; const c = COL(sd && sd[1]);
      gpath("move", LL([m.from, m.to]), "mvline", { stroke: c });
      const a = flat([m.from[1], m.from[0]]), b = flat([m.to[1], m.to[0]]); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      mk("move", m.to[0], m.to[1], "head", c, "m:" + fr.id + ":" + i, m.label, { rot: ang, size: 1.2, cls: m.ai ? "new" : "" }); });
  });
  A(S.strikes).forEach((s, i) => mk("strike", s.lat, s.lon, "x", s.side === "ru" ? "var(--red)" : "var(--cyan)", "st:" + i, s.target, { lbl: s.target, lblClass: "lbl shlbl", cls: isNew("strikes", s.id) ? "new" : "" }));
  A(S.forces).forEach((x, i) => { const kd = FKIND[x.kind] || ["?", ""]; mk("force", x.lat, x.lon, "tag", "var(--violet)", "fo:" + i, x.name, { txt: kd[0], w: kd[0].length > 1 ? 20 : 15, lbl: x.name, lblClass: "lbl shlbl", lx: 12 }); });
  A(S.shipping).forEach(s => { const st = SHIP[s.status] || SHIP.open; mk("ship", s.lat, s.lon, "ring", st[1], "sh:" + s.id, s.name, { pulse: s.status === "closed", lbl: s.name.split(" /")[0], lblClass: "slbl shlbl", lx: 9 }); });
  const newItems = new Set(ch.new_items || []);
  A(S.items).forEach(i => {
    if (i.lat == null || i.s === "human" || i.conflict) return;
    const layer = i.s === "cyber" ? "cyber" : "news";
    mk(layer, i.lat, i.lon, "dot", i.p === "crit" ? "var(--red)" : i.p === "high" ? "var(--amber)" : layer === "cyber" ? "var(--violet)" : "var(--phos)", "n:" + i.id, i.h, { cls: newItems.has(i.id) ? "new" : "" });
  });
  const newConf = new Set(ch.new_conflicts || []);
  A(S.conflicts).forEach(c => { const t = TREND[c.trend] || TREND.ongoing;
    mk("conf", c.lat, c.lon, "sq", t[1], "c:" + c.id, c.name, { pulse: c.trend === "new" || c.trend === "esc", lbl: c.name.split(/[ –:]/)[0], lblClass: "lbl clbl", lx: 7, cls: newConf.has(c.id) ? "new" : "" }); });
  initSats(); drawSats(true); updNight();
  svg.selectAll(".mk").on("click", function (ev) { ev.stopPropagation(); go(this.dataset.id); })
    .on("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(this.dataset.id); } });
  applyLayers(); redraw();
}

/* satelity */
let satrecs = [], satMarkers = [], satPaths = [];
function initSats() { satrecs = [];
  (SATSEL.base ? A(S.tle).concat(A(F().celestrak)) : []).concat(SATPIN.map(p => [p[0], p[2], p[3], p[1]])).forEach(t => {
    if (satrecs.some(x => x.name === t[0])) return;
    try { satrecs.push({ name: t[0], rec: satellite.twoline2satrec(t[1], t[2]), norad: t[3] || +t[1].slice(2, 7) }); } catch (e) {} }); }
function satAt(rec, date) { const pv = satellite.propagate(rec, date); if (!pv || !pv.position) return null;
  const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(date)); return { lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude), alt: gd.height }; }
function drawSats(noRedraw) {
  G.sat.selectAll(":scope > :not(.satcloud)").remove();
  markers = markers.filter(m => !satMarkers.includes(m)); geoPaths = geoPaths.filter(g => !satPaths.includes(g)); satMarkers = []; satPaths = [];
  const now = new Date(), rows = [];
  satrecs.forEach((s, i) => {
    const pts = []; for (let m = -10; m <= 95; m += 1.5) { const p = satAt(s.rec, new Date(now.getTime() + m * 6e4)); if (p) pts.push([p.lat, p.lon]); }
    if (pts.length > 1) { gpath("sat", LL(pts), "track"); satPaths.push(geoPaths[geoPaths.length - 1]); }
    const p = satAt(s.rec, now); if (!p) return; s.last = p;
    const g = mk("sat", p.lat, p.lon, "dia", "var(--cyan)", "s:" + i, s.name, { lbl: s.name, lblClass: "slbl", lx: 6, ly: -5 });
    if (g) { g.select(".core").attr("transform", "scale(.7)"); g.on("click", () => go("s:" + i)); satMarkers.push(markers[markers.length - 1]); }
    rows.push(`<tr><td>${esc(s.name)}</td><td>${p.lat.toFixed(1)}°</td><td>${p.lon.toFixed(1)}°</td><td>${Math.round(p.alt)}</td></tr>`);
  });
  $("#sats").innerHTML = rows.join("") || ("<tr>" + "<td colspan=\"4\">" + TX("Brak danych orbitalnych") + "</td>" + "</tr>");
  $("#satTime").textContent = TX("SGP4 ·") + " " + now.toISOString().slice(11, 16) + " " + TX("UTC");
  if (!noRedraw) { satPaths.forEach(g => g.node.setAttribute("d", path(g.geo) || "")); placeMarkers(); }
}

/* ------------------------------------------------------------ WARSTWA PŁÓTNA: statki, samoloty, chmury satelitów */
/* Tysiące obiektów rysowane na jednym płótnie zamiast osobnych elementów SVG – mapa nie zacina się przy przybliżaniu.
   Samoloty: serwer pobiera adsb.fi (zapasowo adsb.lol) co ~10 s; między odczytami pozycja jest przewidywana z kursu i prędkości.
   Statki: aisstream.io (cały świat) + Digitraffic; serwer wysyła tylko zmiany od poprzedniego odczytu. */
const ACOL = { isr: "var(--cyan)", tanker: "var(--amber)", bomber: "var(--red)", transport: "var(--violet)", fighter: "var(--phos)", other: "var(--phos-dim)" };
const NOTABLE = new Set(["isr", "bomber", "tanker"]);
const SCOL = { military: "var(--red)", law: "#ff8f6b", tanker: "var(--amber)", cargo: "var(--violet)", passenger: "var(--cyan)", sar: "var(--white)", service: "#6fae86", fishing: "var(--khaki)", pleasure: "#d89ad8", other: "#7d9c88" };
const SCN = { military: TX("WOJSKOWY"), law: TX("STRAŻ"), tanker: TX("TANKOWIEC"), cargo: TX("TOWAROWY"), passenger: TX("PASAŻERSKI"), sar: TX("RATOWNICZY"), service: TX("SERWISOWY"), fishing: TX("RYBACKI"), pleasure: TX("REKREACYJNY"), other: TX("INNY") };
const SHOT = new Set(["military", "law", "tanker"]);
const CSSV = {}; const cssv = c => { if (!/^var\(/.test(c)) return c; if (!CSSV[c]) CSSV[c] = getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || "#7dffa8"; return CSSV[c]; };
/* filtry (zapamiętywane w przeglądarce) */
const FLT = Object.assign({ ship: { military: 1, law: 1, tanker: 1, cargo: 1, passenger: 1, sar: 1, service: 1, fishing: 1, pleasure: 0, other: 1 }, shipOld: 1, shipNames: 1,
  air: { isr: 1, tanker: 1, bomber: 1, transport: 1, fighter: 1, other: 1 }, airTrails: 1, airNames: 1, watch: 1, suspect: 0 }, store.get("filters", {}));
const saveFlt = () => store.set("filters", FLT);

function airPos(a, now) {
  const dt = Math.min(90, Math.max(0, (now - a.ts) / 1000));
  if (a.ground || !a.gs || a.trk == null || dt < .5) return [a.lat, a.lon];
  const nm = a.gs * dt / 3600, r = a.trk * Math.PI / 180, lat = a.lat + nm * Math.cos(r) / 60;
  return [lat, a.lon + nm * Math.sin(r) / (60 * Math.max(.2, Math.cos(a.lat * Math.PI / 180)))];
}
const airAge = (a, now) => Math.max(0, Math.round((now - a.ts) / 1000));
function agoTxt(sec) { return sec < 60 ? sec + " " + TX("s temu") : sec < 3600 ? Math.round(sec / 60) + " " + TX("min temu") : Math.round(sec / 3600) + " " + TX("h temu"); }
/* statek: wiersz [mmsi, lat, lon, sog, cog, kat, czas_s, nazwa, hdg] */
const SHIPS = new Map(); let SCATS = ["military", "law", "tanker", "cargo", "passenger", "sar", "service", "fishing", "pleasure", "other"];
function seaPos(r, now) {
  const dt = Math.min(1800, Math.max(0, (now - r.ts) / 1000)); if (!r.sog || r.sog < .5 || r.cog == null) return [r.lat, r.lon];
  const nm = r.sog * dt / 3600, a = r.cog * Math.PI / 180; return [r.lat + nm * Math.cos(a) / 60, r.lon + nm * Math.sin(a) / (60 * Math.max(.2, Math.cos(r.lat * Math.PI / 180)))];
}
function seaRec(mmsi) {
  const w = (REPLAY.on && REPLAY.ships.get(+mmsi)) || SHIPS.get(+mmsi); if (!w) return null;
  return Object.assign({ mmsi: w[0], lat: w[1], lon: w[2], sog: w[3], cog: w[4], cat: SCATS[w[5]] || "other", ts: w[6] * 1000, name: w[7], hdg: w[8], kind: "", flag: "", flags: w[11] || 0 }, SEA.detail[w[0]] || {}, { lat: w[1], lon: w[2], sog: w[3], cog: w[4], ts: w[6] * 1000 });
}

/* --- płótno: warstwa stała (statki, satelity – przerysowywana przy zmianie widoku lub danych) + samoloty (co 250 ms) */
const CV = document.createElement("canvas"); CV.id = "mapCanvas"; CV.setAttribute("aria-hidden", "true"); $("#mapbox").insertBefore(CV, $("#chain"));
const CX = CV.getContext("2d"), SCV = document.createElement("canvas"), SX = SCV.getContext("2d");
const TIP = document.createElement("div"); TIP.className = "maptip"; TIP.hidden = true; $("#mapbox").appendChild(TIP);
let cvW = 0, cvH = 0, DPR = 1, vS = 1, vX = 0, vY = 0, needDraw = true, staticDirty = true, lastDraw = 0, drCache = 0, lastSel = null;
let SHIT = { n: 0, x: new Float32Array(0), y: new Float32Array(0), k: new Uint8Array(0), v: new Float64Array(0) }, AHIT = [];
const markStatic = () => { staticDirty = true; needDraw = true; };
/* podkład kafelkowy – kafelki idą przez serwer KRONOS, który trzyma je na dysku (data/tiles): każdy pobierany jest z internetu tylko raz.
   Dwa płótna pod mapą: podkład i nakładka z napisami. Rysowane tylko przy zmianie widoku albo po doczytaniu kafelka. */
const TCV = document.createElement("canvas"); TCV.id = "tileCanvas"; TCV.setAttribute("aria-hidden", "true"); $("#mapbox").insertBefore(TCV, $("#map"));
const TCV2 = document.createElement("canvas"); TCV2.id = "tileCanvas2"; TCV2.className = "tilecv"; TCV2.setAttribute("aria-hidden", "true"); $("#mapbox").insertBefore(TCV2, $("#map"));
const TC2 = TCV.getContext("2d"), TC3 = TCV2.getContext("2d"), TILES = new Map(); let tileDirty = false, tileSig = "";
const ATTR = document.createElement("div"); ATTR.className = "mapattr"; ATTR.hidden = true; $("#mapbox").appendChild(ATTR);
function tileUrl(u, z, x, y) { return u.replace("{z}", z).replace("{x}", x).replace("{y}", y).replace("{r}", DPR > 1 ? "@2x" : ""); }
/* filtr (przyciemnienie satelity, odwrócenie OSM) liczony raz na kafelek w osobnym wątku (Web Worker) jako macierz kolorów –
   bez filtrów CSS, które bez akceleracji potrafią zablokować przeglądarkę na sekundy */
function fltMatrix(f) {
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1], o = [0, 0, 0];
  const mul = (A, b2) => { const R = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * M[j] + A[i * 3 + 1] * M[3 + j] + A[i * 3 + 2] * M[6 + j];
    const ro = [0, 1, 2].map(i => A[i * 3] * o[0] + A[i * 3 + 1] * o[1] + A[i * 3 + 2] * o[2] + b2[i]); M = R; o = ro; };
  for (const m of String(f || "").matchAll(/([a-z-]+)\(([-\d.]+)(deg)?\)/g)) { const v = +m[2];
    if (m[1] === "invert") mul([1 - 2 * v, 0, 0, 0, 1 - 2 * v, 0, 0, 0, 1 - 2 * v], [v, v, v]);
    else if (m[1] === "brightness") mul([v, 0, 0, 0, v, 0, 0, 0, v], [0, 0, 0]);
    else if (m[1] === "contrast") mul([v, 0, 0, 0, v, 0, 0, 0, v], [.5 - .5 * v, .5 - .5 * v, .5 - .5 * v]);
    else if (m[1] === "saturate") mul([.213 + .787 * v, .715 - .715 * v, .072 - .072 * v, .213 - .213 * v, .715 + .285 * v, .072 - .072 * v, .213 - .213 * v, .715 - .715 * v, .072 + .928 * v], [0, 0, 0]);
    else if (m[1] === "hue-rotate") { const r = v * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
      mul([.213 + c * .787 - sn * .213, .715 - c * .715 - sn * .715, .072 - c * .072 + sn * .928, .213 - c * .213 + sn * .143, .715 + c * .285 + sn * .140, .072 - c * .072 - sn * .283, .213 - c * .213 - sn * .787, .715 - c * .715 + sn * .715, .072 + c * .928 + sn * .072], [0, 0, 0]); } }
  return M.concat(o.map(x => x * 255));
}
const TWORK = (() => { try {
  if (!window.OffscreenCanvas || !window.createImageBitmap) return null;
  const src = `onmessage = async e => { const { id, url, m } = e.data; try {
      const r = await fetch(url); if (!r.ok) throw 0; const bm = await createImageBitmap(await r.blob());
      if (!m) { postMessage({ id, bm }, [bm]); return; }
      const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext("2d"); x.drawImage(bm, 0, 0); bm.close();
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const R = p[i], G = p[i + 1], B = p[i + 2];
        p[i] = m[0] * R + m[1] * G + m[2] * B + m[9]; p[i + 1] = m[3] * R + m[4] * G + m[5] * B + m[10]; p[i + 2] = m[6] * R + m[7] * G + m[8] * B + m[11]; }
      x.putImageData(d, 0, 0); const out = c.transferToImageBitmap(); postMessage({ id, bm: out }, [out]);
    } catch (err) { postMessage({ id, bad: 1 }); } };`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  w.onmessage = e => { const t = TWAIT.get(e.data.id); TWAIT.delete(e.data.id); if (!t) { if (e.data.bm) e.data.bm.close(); return; }
    if (e.data.bad) { t.bad = 1; return; } t.px = e.data.bm; t.pw = e.data.bm.width; t.ph = e.data.bm.height; t.ok = 1; tileDirty = true; };
  return w; } catch (e) { return null; } })();
const TWAIT = new Map(), FLTM = {}; let twId = 0;
function tileGet(key, url, flt) {
  let im = TILES.get(key);
  if (im) { if (im.ok && TILES.size > 200) { TILES.delete(key); TILES.set(key, im); } return im; }   // LRU
  if (TWORK) { im = {}; const id = ++twId; TWAIT.set(id, im); im.id = id;
    TWORK.postMessage({ id, url: new URL(url, location.href).href, m: flt ? (FLTM[flt] || (FLTM[flt] = fltMatrix(flt))) : null }); }
  else { im = new Image(); im.decoding = "async"; const m = flt ? (FLTM[flt] || (FLTM[flt] = fltMatrix(flt))) : null;
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { im.px = im; im.pw = im.naturalWidth; im.ph = im.naturalHeight;
      if (m) { try { const c = document.createElement("canvas"); c.width = im.pw; c.height = im.ph; const x = c.getContext("2d"); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) { const R = p[i], G = p[i + 1], B = p[i + 2]; p[i] = m[0] * R + m[1] * G + m[2] * B + m[9]; p[i + 1] = m[3] * R + m[4] * G + m[5] * B + m[10]; p[i + 2] = m[6] * R + m[7] * G + m[8] * B + m[11]; }
        x.putImageData(d, 0, 0); im.px = c; } catch (e) {} }
      im.ok = 1; tileDirty = true; }); };
    im.onerror = () => { im.bad = 1; }; im.src = url; }
  TILES.set(key, im);
  while (TILES.size > 420) { const k0 = TILES.keys().next().value, o = TILES.get(k0); TILES.delete(k0); if (o) { if (o.id) TWAIT.delete(o.id); if (o.px && o.px.close) o.px.close(); if (o.src && !o.ok) o.src = ""; } }
  return im;
}
function drawTiles(force) {
  const on = MERC && mode === "flat";
  if (TCV.width !== CV.width || TCV.height !== CV.height) { TCV.width = TCV2.width = CV.width; TCV.height = TCV2.height = CV.height; force = true; }
  ATTR.hidden = !on;
  if (!on) { if (tileSig) { TC2.setTransform(1, 0, 0, 1, 0, 0); TC2.clearRect(0, 0, TCV.width, TCV.height); TC3.setTransform(1, 0, 0, 1, 0, 0); TC3.clearRect(0, 0, TCV.width, TCV.height); tileSig = ""; } return; }
  ATTR.textContent = BASES[BASE][2] || "";
  viewFit();
  const wpx = W * T.k * vS, ox = vX + T.x * vS, oy = vY + (T.y + (H / 2 - W / 2) * T.k) * vS;
  const B = BASES[BASE], z = Math.max(1, Math.min(B[5] || 19, Math.round(Math.log2(wpx * DPR / (DPR > 1 && /\{r\}/.test(B[1]) ? 512 : 256))))), n = 2 ** z, ts = wpx / n;
  const sig = [BASE, z, ox.toFixed(1), oy.toFixed(1), wpx.toFixed(1), cvW, cvH].join("|");
  if (!force && sig === tileSig) return;
  tileSig = sig;
  const x0 = Math.floor(-ox / ts), x1 = Math.floor((cvW - ox) / ts), y0 = Math.max(0, Math.floor(-oy / ts)), y1 = Math.min(n - 1, Math.floor((cvH - oy) / ts));
  [TC2, TC3].forEach(c => { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, TCV.width, TCV.height); c.setTransform(DPR, 0, 0, DPR, 0, 0); c.imageSmoothingQuality = "low"; });
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) return;
  /* najpierw kafelki ze środka ekranu */
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, order = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) order.push([tx, ty, (tx - cx) ** 2 + (ty - cy) ** 2]);
  order.sort((a, b) => a[2] - b[2]);
  [[B[1], BASE, TC2], [B[4], BASE + "+", TC3]].forEach(([url, pre, c], li) => { if (!url) return;
    for (const [tx, ty] of order) {
      const wx = ((tx % n) + n) % n, key = pre + "/" + z + "/" + wx + "/" + ty, dx = ox + tx * ts, dy = oy + ty * ts;
      const im = tileGet(key, tileUrl(url, z, wx, ty), li ? null : B[3]);
      if (im.ok) { c.drawImage(im.px, dx, dy, ts + .6, ts + .6); continue; }
      if (li) continue;
      for (let up = 1; up <= 6 && z - up >= 0; up++) {      // dopóki kafelek się ładuje – powiększony kafelek z niższego poziomu
        const f = 2 ** up, pim = TILES.get(pre + "/" + (z - up) + "/" + Math.floor(wx / f) + "/" + Math.floor(ty / f));
        if (pim && pim.ok) { const sw = pim.pw / f, sh = pim.ph / f; c.drawImage(pim.px, (wx % f) * sw, (ty % f) * sh, sw, sh, dx, dy, ts + .6, ts + .6); break; }
      }
    } });
}
function setBase(b) {
  if (!BASES[b]) b = "vector"; BASE = b; store.set("basemap", b); MERC = b !== "vector"; flat = MERC ? merc : equi;
  if (mode === "flat") { proj = flat; path = d3.geoPath(proj); }
  zoom.scaleExtent([1, MERC ? 4000 : 320]).translateExtent(flatExtent());
  $("#map").classList.toggle("tiles", MERC); $("#baseSel").value = b;
  if (mode === "flat") setTheater(theater || "world", false); redraw(); markStatic(); sfx("click");
}
function sizeCanvas() { const r = $("#map").getBoundingClientRect(); DPR = Math.min(2, devicePixelRatio || 1); cvW = r.width; cvH = r.height;
  CV.width = SCV.width = Math.max(1, Math.round(cvW * DPR)); CV.height = SCV.height = Math.max(1, Math.round(cvH * DPR)); markStatic(); }
if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe($("#map"));
function viewFit() { vS = Math.min(cvW / W, cvH / H); vX = (cvW - W * vS) / 2; vY = (cvH - H * vS) / 2; }
/* współrzędne geograficzne -> piksele (płaska mapa liczona wprost, globus przez projekcję) */
const MKS = W / (2 * Math.PI), QP = Math.PI / 4, RD2 = Math.PI / 360;
function scr(lon, lat) {
  if (mode === "globe") { if (!visible(lon, lat)) return null; const p = proj([lon, lat]); return p ? [vX + p[0] * vS, vY + p[1] * vS] : null; }
  const x = W / 2 + lon * W / 360, y = MERC ? H / 2 - MKS * Math.log(Math.tan(QP + (lat > 85 ? 85 : lat < -85 ? -85 : lat) * RD2)) : H / 2 - lat * W / 360;
  return [vX + (T.x + x * T.k) * vS, vY + (T.y + y * T.k) * vS];
}
const inView = (x, y, m) => x > -m && y > -m && x < cvW + m && y < cvH + m;
function tri(c, x, y, ang, s) { const co = Math.cos(ang), si = Math.sin(ang); c.moveTo(x + co * s * 1.6, y + si * s * 1.6); c.lineTo(x - co * s + si * s * .9, y - si * s - co * s * .9); c.lineTo(x - co * s - si * s * .9, y - si * s + co * s * .9); c.closePath(); }
const RGB = {}; function rgb32(css, alpha) { const key = css + alpha; if (RGB[key] != null) return RGB[key];
  const c = document.createElement("canvas").getContext("2d"); c.fillStyle = cssv(css); c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data;
  return RGB[key] = ((Math.round(alpha * 255) << 24) | (d[2] << 16) | (d[1] << 8) | d[0]) >>> 0; }
const FONT = () => "10px " + (getComputedStyle(document.body).getPropertyValue("--f-display") || "monospace");
function drawStatic() {
  staticDirty = false; viewFit(); drawTiles();
  const k = mode === "globe" ? 1 : T.k, nowMs = Date.now(), w2 = SCV.width, h2 = SCV.height;
  SX.setTransform(1, 0, 0, 1, 0, 0); SX.clearRect(0, 0, w2, h2);
  /* przy dużej liczbie punktów piksele zapisujemy wprost do bufora – to kilkanaście razy szybsze niż ścieżki */
  if (!drawStatic.img || drawStatic.img.width !== w2 || drawStatic.img.height !== h2) { drawStatic.img = SX.createImageData(w2, h2); drawStatic.buf = new Uint32Array(drawStatic.img.data.buffer); }
  const img = drawStatic.img, buf = drawStatic.buf; buf.fill(0);
  const cap = SHIPS.size + CELLS.length + Object.values(SATG).reduce((a, g) => a + (g.names ? g.names.length : 0), 0);
  if (SHIT.x.length < cap) SHIT = { n: 0, x: new Float32Array(cap + 1000), y: new Float32Array(cap + 1000), k: new Uint8Array(cap + 1000), v: new Float64Array(cap + 1000) };
  let n = 0; const H_ = SHIT;
  const dot = (x, y, sz, col) => { const px = Math.round(x * DPR), py = Math.round(y * DPR), r = sz >> 1;
    for (let yy = py - r; yy < py - r + sz; yy++) { if (yy < 0 || yy >= h2) continue; const o = yy * w2; for (let xx = px - r; xx < px - r + sz; xx++) if (xx >= 0 && xx < w2) buf[o + xx] = col; } };
  /* chmury satelitów */
  if (layerOn.sat) for (const id of SATSEL.groups) { const g = SATG[id]; if (!g || !g.pos) continue;
    const big = id === "all" || id === "starlink", col = rgb32(GCOL[id] || "var(--phos-dim)", big ? .6 : .95), sz = Math.max(1, Math.round((big ? 1.3 : 2.4) * DPR));
    for (let i = 0; i < g.names.length; i++) { const la = g.pos[i * 3], lo = g.pos[i * 3 + 1]; if (la !== la) continue; const p = scr(lo, la); if (!p || !inView(p[0], p[1], 2)) continue;
      dot(p[0], p[1], sz, col); H_.x[n] = p[0]; H_.y[n] = p[1]; H_.k[n] = 3; H_.v[n] = g.norad[i]; n++; } }
  /* statki */
  const names = [], tris = [], rings = [], cl = [];
  const SRC = REPLAY.on ? REPLAY.ships : SHIPS;
  if (layerOn.vessel && (SRC.size || (!REPLAY.on && CELLS.length))) {
    const nowS = (REPLAY.on ? REPLAY.t : nowMs + SEA.skew) / 1000, recalc = REPLAY.on || nowMs - drCache > 4000, useTri = k >= 4, s0 = Math.max(1.4, Math.min(4.5, 1.2 + Math.log2(k) * .7));
    if (recalc) drCache = nowMs;
    const cols = SCATS.map(c => [rgb32(SCOL[c], c === "other" || c === "service" ? .8 : 1), rgb32(SCOL[c], .35)]);
    let cF = 0, cO = 0, cV = 0;
    for (const w of SRC.values()) {
      const ci = w[5], cat = SCATS[ci] || "other", fl = w[11] || 0; if (!FLT.ship[cat] && !(fl && FLT.watch)) { cF++; continue; }
      if (FLT.suspect && !fl && cat !== "military" && cat !== "law") { cF++; continue; }
      const age = nowS - w[6], old = age > 3600 ? 1 : 0; if (old && !FLT.shipOld && !fl) { cO++; continue; }
      if (recalc || w[9] == null) { if (w[3] >= .5 && w[4] != null && age < 1800) { const nm = w[3] * age / 3600, a2 = w[4] * Math.PI / 180; w[9] = w[1] + nm * Math.cos(a2) / 60; w[10] = w[2] + nm * Math.sin(a2) / (60 * Math.max(.2, Math.cos(w[1] * Math.PI / 180))); } else { w[9] = w[1]; w[10] = w[2]; } }
      const p = scr(w[10], w[9]); if (!p || !inView(p[0], p[1], 6)) continue;
      if (useTri) tris.push(p[0], p[1], w[3] >= .5 && w[4] != null ? (w[4] - 90) * Math.PI / 180 : NaN, ci, old);
      else dot(p[0], p[1], Math.max(2, Math.round((SHOT.has(cat) ? 2.6 : 1.9) * DPR)), cols[ci][old]);
      H_.x[n] = p[0]; H_.y[n] = p[1]; H_.k[n] = 1; H_.v[n] = w[0]; n++;
      if (fl && FLT.watch) rings.push(p[0], p[1], fl);
      cV++;
      if (FLT.shipNames && w[7] && (k >= 8 || (k >= 3 && SHOT.has(cat)))) names.push(p[0], p[1], w[7]);
    }
    /* kratki (widok oddalony): kółko z liczbą, kolor przeważającej kategorii spośród włączonych w FILTRACH */
    if (!REPLAY.on && CELLS.length && !FLT.suspect) {
      const lab = [];
      for (let ci2 = 0; ci2 < CELLS.length; ci2++) { const c = CELLS[ci2]; let tot = 0, best = -1, bn = 0;
        for (let j = 0; j < SCATS.length; j++) { const v = c[2 + j] || 0; if (!v || !FLT.ship[SCATS[j]]) continue; tot += v; if (v > bn) { bn = v; best = j; } }
        if (!tot) continue; const p = scr(c[1], c[0]); if (!p || !inView(p[0], p[1], 20)) continue;
        cl.push(p[0], p[1], Math.min(12, 2.2 + Math.log2(tot + 1) * 1.1), best, tot);
        H_.x[n] = p[0]; H_.y[n] = p[1]; H_.k[n] = 5; H_.v[n] = ci2; n++; cV += tot; }
    }
    Object.assign(SHIPSTAT, { view: cV, filt: cF, old: cO, total: SRC.size, at: Date.now() });
  }
  SX.putImageData(img, 0, 0); SX.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (layerOn.cable && CABLES.lines) drawCables(k);   // pod punktami (destination-over)
  if (layerOn.dstate && IN.ds) drawDS(k);
  if (layerOn.isw && IN.isw) drawISW(k);
  if (cl.length) { SX.lineWidth = 1;
    SCATS.forEach((cat, ci) => { SX.beginPath(); let any = false;
      for (let i = 0; i < cl.length; i += 5) if (cl[i + 3] === ci) { any = true; SX.moveTo(cl[i] + cl[i + 2], cl[i + 1]); SX.arc(cl[i], cl[i + 1], cl[i + 2], 0, 6.2832); }
      if (any) { SX.globalAlpha = .28; SX.fillStyle = cssv(SCOL[cat]); SX.fill(); SX.globalAlpha = .9; SX.strokeStyle = cssv(SCOL[cat]); SX.stroke(); } });
    SX.globalAlpha = 1; SX.font = FONT(); SX.textAlign = "center"; SX.fillStyle = cssv("var(--text)");
    for (let i = 0; i < cl.length; i += 5) if (cl[i + 4] >= 100 || (cl[i + 4] >= 25 && k >= 2)) { const t = cl[i + 4] >= 1000 ? (cl[i + 4] / 1000).toFixed(cl[i + 4] >= 1e4 ? 0 : 1) + "k" : String(cl[i + 4]); SX.fillText(t, cl[i], cl[i + 1] + 3.5); }
    SX.textAlign = "start"; }
  if (tris.length) { const s0 = Math.max(1.4, Math.min(4.5, 1.2 + Math.log2(k) * .7));
    SCATS.forEach((cat, ci) => { for (const old of [0, 1]) { SX.beginPath(); let any = false; const s = SHOT.has(cat) ? s0 * 1.35 : s0;
      for (let i = 0; i < tris.length; i += 5) { if (tris[i + 3] !== ci || tris[i + 4] !== old) continue; any = true; const x = tris[i], y = tris[i + 1], ang = tris[i + 2];
        if (ang === ang) tri(SX, x, y, ang, s); else SX.rect(x - s * .7, y - s * .7, s * 1.4, s * 1.4); }
      if (any) { SX.globalAlpha = old ? .35 : 1; SX.fillStyle = cssv(SCOL[cat]); SX.fill(); } } });
    SX.globalAlpha = 1; }
  if (names.length && names.length < 1800) { SX.font = FONT(); SX.fillStyle = cssv("var(--text)"); SX.strokeStyle = cssv("var(--void)"); SX.lineWidth = 3;
    for (let i = 0; i < names.length; i += 3) { SX.strokeText(names[i + 2], names[i] + 6, names[i + 1] - 4); SX.fillText(names[i + 2], names[i] + 6, names[i + 1] - 4); } }
  /* sankcje, „ciemne” statki, statki nad kablami, przeładunki STS */
  if (rings.length || (FLT.watch && WATCH())) drawWatch(rings);
  /* trasa wybranego statku */
  if (selected && selected.startsWith("vs:")) { const d = SEA.detail[+selected.slice(3)], r = seaRec(selected.slice(3));
    if (d && r && A(d.trail).length) { SX.beginPath(); let first = true; A(d.trail).concat([[r.lat, r.lon]]).forEach(t => { const p = scr(t[1], t[0]); if (!p) return; first ? SX.moveTo(p[0], p[1]) : SX.lineTo(p[0], p[1]); first = false; });
      SX.setLineDash([3, 3]); SX.strokeStyle = cssv(SCOL[r.cat]); SX.lineWidth = 1.4; SX.stroke(); SX.setLineDash([]); } }
  H_.n = n;
}
function drawCanvas() {
  if (selected !== lastSel) { lastSel = selected; staticDirty = true; }
  if (staticDirty) drawStatic();
  CX.setTransform(1, 0, 0, 1, 0, 0); CX.clearRect(0, 0, CV.width, CV.height); CX.drawImage(SCV, 0, 0); CX.setTransform(DPR, 0, 0, DPR, 0, 0); viewFit();
  const k = mode === "globe" ? 1 : T.k; AHIT = [];
  if (selected && /^(s|sc):/.test(selected) && layerOn.sat) drawSatSel(k);
  if (layerOn.air && (AIR.ok || REPLAY.on)) {
    const now = REPLAY.on ? REPLAY.t : Date.now() + AIR.skew, labels = [];
    for (const a of airList()) {
      if (a.loiter && !REPLAY.on && FLT.air[a.cat] !== 0) drawLoiter(a);
      if (!FLT.air[a.cat] && selected !== "ah:" + a.hex) continue;
      const ll = airPos(a, now), p = scr(ll[1], ll[0]); if (!p) continue;
      const col = cssv(ACOL[a.cat] || ACOL.other), hot = NOTABLE.has(a.cat), sel = selected === "ah:" + a.hex;
      if ((FLT.airTrails && hot || sel) && A(a.trail).length) { CX.beginPath(); let first = true; A(a.trail).concat([[ll[0], ll[1]]]).forEach(t => { const q = scr(t[1], t[0]); if (!q) return; first ? CX.moveTo(q[0], q[1]) : CX.lineTo(q[0], q[1]); first = false; });
        CX.strokeStyle = col; CX.globalAlpha = sel ? .9 : .5; CX.lineWidth = sel ? 1.8 : 1.1; CX.stroke(); CX.globalAlpha = 1; }
      if (!inView(p[0], p[1], 12)) continue;
      const age = airAge(a, now); CX.globalAlpha = REPLAY.on ? (age < 150 ? 1 : .5) : age < 60 ? 1 : age < 180 ? .55 : .25;
      CX.beginPath(); tri(CX, p[0], p[1], ((a.trk || 0) - 90) * Math.PI / 180, hot ? 4.2 : 3.4); CX.fillStyle = col; CX.fill(); CX.lineWidth = 1; CX.strokeStyle = cssv("var(--void)"); CX.stroke(); CX.globalAlpha = 1;
      AHIT.push([p[0], p[1], "ah:" + a.hex]);
      if (FLT.airNames && (hot ? k >= 2 : k >= 4)) labels.push(p[0], p[1], a.cs || a.hex);
    }
    CX.font = FONT(); CX.fillStyle = cssv("var(--text)"); CX.strokeStyle = cssv("var(--void)"); CX.lineWidth = 3;
    for (let i = 0; i < labels.length; i += 3) { CX.strokeText(labels[i + 2], labels[i] + 7, labels[i + 1] - 6); CX.fillText(labels[i + 2], labels[i] + 7, labels[i + 1] - 6); }
  }
  if (layerOn.marsec && MS.d && !REPLAY.on) drawMS();
  if (!REPLAY.on) drawIntel();
  /* wyróżnienie zaznaczonego obiektu */
  if (selected && /^(vs|ah|sc):/.test(selected)) { let pt = null;
    if (selected.startsWith("ah:")) { const h = AHIT.find(x => x[2] === selected); if (h) pt = h; }
    else { const kind = selected.startsWith("vs:") ? 1 : 3, v = +selected.slice(3); for (let i = 0; i < SHIT.n; i++) if (SHIT.k[i] === kind && SHIT.v[i] === v) { pt = [SHIT.x[i], SHIT.y[i]]; break; } }
    if (pt) { CX.beginPath(); CX.arc(pt[0], pt[1], 9, 0, Math.PI * 2); CX.strokeStyle = "#fff"; CX.lineWidth = 1.5; CX.stroke(); } }
}
/* ślad podsatelitarny (−15…+90 min) i zasięg widoczności zaznaczonego satelity */
let SELTRK = { id: null, at: 0 };
function drawSatSel(k) {
  const now = Date.now();
  if (SELTRK.id !== selected || now - SELTRK.at > 10000) {
    let rec = null; if (selected.startsWith("s:")) { const x = satrecs[+selected.slice(2)]; rec = x && x.rec; } else if (SATCLICK && "sc:" + SATCLICK.norad === selected) rec = SATCLICK.rec;
    if (!rec) return; const pts = []; let cur = null;
    for (let m = -15; m <= 90; m += 1) { const d = new Date(now + m * 6e4), pv = satellite.propagate(rec, d); if (!pv || !pv.position) continue;
      const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(d)), p = [satellite.degreesLong(gd.longitude), satellite.degreesLat(gd.latitude)]; pts.push(p); if (m === 0) cur = { lon: p[0], lat: p[1], alt: gd.height }; }
    SELTRK = { id: selected, at: now, pts, cur };
  }
  if (!SELTRK.cur) return;
  const sc = DPR * vS * k, gp = d3.geoPath(proj, CX);
  CX.save(); CX.setTransform(sc, 0, 0, sc, DPR * (vX + (mode === "globe" ? 0 : T.x) * vS), DPR * (vY + (mode === "globe" ? 0 : T.y) * vS));
  const radius = Math.acos(6371 / (6371 + SELTRK.cur.alt)) * 180 / Math.PI;
  CX.beginPath(); gp(d3.geoCircle().center([SELTRK.cur.lon, SELTRK.cur.lat]).radius(radius)()); CX.fillStyle = "rgba(111,228,255,.07)"; CX.fill();
  CX.lineWidth = 1 / (vS * k); CX.strokeStyle = "rgba(111,228,255,.55)"; CX.stroke();
  CX.beginPath(); gp({ type: "LineString", coordinates: SELTRK.pts }); CX.setLineDash([4 / (vS * k), 3 / (vS * k)]); CX.lineWidth = 1.4 / (vS * k); CX.strokeStyle = "rgba(111,228,255,.85)"; CX.stroke(); CX.setLineDash([]);
  CX.restore(); CX.setTransform(DPR, 0, 0, DPR, 0, 0);
}
/* pętla rysowania: najwyżej 30 klatek/s (tryb oszczędny 10, okno w tle 2), rysuje tylko gdy coś się zmieniło */
let lastFrame = 0;
function frame(t) {
  requestAnimationFrame(frame);
  if (document.hidden || view !== "map" || mapHidden()) return;
  const slow = ECO || BG;
  if (t - lastFrame < (BG ? 500 : ECO ? 100 : 33)) return;
  lastFrame = t;
  if (tileDirty) { tileDirty = false; drawTiles(true); }
  if (t - drCache > (BG ? 15000 : ECO ? 10000 : 4000) && layerOn.vessel && SHIPS.size) staticDirty = true;
  const live = (AIR.ok || REPLAY.on) && layerOn.air;
  const satSel = selected && /^(s|sc):/.test(selected);
  const msPulse = !slow && layerOn.marsec && MS.d && t - lastDraw > 500 && A(MS.d.items).some(x => !x.warn && x.t > Date.now() - 2 * 864e5);
  if (needDraw || staticDirty || msPulse || (live && t - lastDraw > (slow && !REPLAY.on ? 2000 : 250)) || (satSel && t - lastDraw > 2000)) { needDraw = false; lastDraw = t; drawCanvas(); }
}
requestAnimationFrame(frame);
window.K7DBG = { go: id => go(id), ships: () => [...SHIPS.keys()].slice(0, 20), intel: () => IN, vg: () => VG, sea: () => ({ ships: SHIPS.size, cells: CELLS.length, cell: SEAQ && SEAQ.cell, bbox: SEAQ && SEAQ.bbox, view: SHIPSTAT.view, hit: (() => { for (let i = 0; i < SHIT.n; i++) if (SHIT.k[i] === 5) return [SHIT.x[i], SHIT.y[i]]; return null; })() }), draw: () => { const a = performance.now(); staticDirty = true; drawCanvas(); return performance.now() - a; }, air: () => { const a = performance.now(); drawCanvas(); return performance.now() - a; } };
function hitAt(x, y, lim = 8) {
  let best = null, bd = lim * lim;
  for (const h of AHIT) { const d = (h[0] - x) ** 2 + (h[1] - y) ** 2; if (d < bd) { bd = d; best = h[2]; } }
  if (best) return best;
  const H_ = SHIT; let bi = -1;
  for (let i = 0; i < H_.n; i++) { const dx = H_.x[i] - x; if (dx > lim || dx < -lim) continue; const d = dx * dx + (H_.y[i] - y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi < 0 ? null : (H_.k[bi] === 1 ? "vs:" : H_.k[bi] === 5 ? "cl:" : "sc:") + H_.v[bi];
}
const evXY = ev => { const r = CV.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
svg.on("click.canvas", ev => { if (ev.target.closest && ev.target.closest(".mk")) return; const id = hitAt(...evXY(ev), 12); if (id && id.startsWith("cl:")) { ev.stopPropagation(); const c = CELLS[+id.slice(3)], h2 = (SEAQ && SEAQ.cell || 2) * 1.2; if (c) zoomBox([[c[1] - h2, c[0] - h2 / 2], [c[1] + h2, c[0] + h2 / 2]], true); return; }
  if (id) { ev.stopPropagation(); if (id.startsWith("sc:")) SATCLICK = satByNorad(+id.slice(3)); go(id); } });
let tipT = 0;
svg.on("mousemove.canvas", ev => { const now = performance.now(); if (now - tipT < 60) return; tipT = now; const [x, y] = evXY(ev), id = hitAt(x, y, 7);
  if (!id) { TIP.hidden = true; svg.style("cursor", null); return; } svg.style("cursor", "pointer"); TIP.hidden = false; TIP.textContent = tipText(id);
  TIP.style.left = Math.min(cvW - 10, x + 12) + "px"; TIP.style.top = (y + 12) + "px"; });
svg.on("mouseleave.canvas", () => { TIP.hidden = true; });
function tipText(id) {
  const t = id.startsWith("acl:") ? "acl" : id.slice(0, 2), key = id.slice(3);
  if (t === "cl") { const c = CELLS[+key]; if (!c) return ""; const parts = SCATS.map((c2, j) => [c2, c[2 + j] || 0]).filter(x => x[1] && FLT.ship[x[0]]).sort((a, b) => b[1] - a[1]);
    return `${parts.reduce((a, x) => a + x[1], 0)} ${TX("statków")} · ` + parts.slice(0, 3).map(x => (SCN[x[0]] || x[0]) + " " + x[1]).join(", ") + " · " + TX("kliknij, aby przybliżyć"); }
  if (t === "vs") { const r = seaRec(key), fl = r ? r.flags : 0; return r ? `${r.name || "MMSI " + r.mmsi} · ${SCN[r.cat] || ""}${r.sog != null ? " · " + r.sog + " kn" : ""}${fl & 1 ? " · " + TX("SANKCJE") : ""}${fl & 4 ? " · " + TX("MILCZY") : ""}${fl & 2 ? " · " + TX("NAD KABLEM") : ""}` : ""; }
  if (t === "ah") { const a = airList().find(x => x.hex === key); return a ? `${a.flag || ""} ${a.cs || a.hex} · ${a.desc || (a.model || "").split(" (")[0] || a.t || ""}${a.country ? " · " + TX(a.country) : ""}${a.alt != null ? " · " + a.alt + " ft" : ""}${a.loiter ? " · " + TX("KRĄŻY") : ""}` : ""; }
  if (t === "sc") { const r = satByNorad(+key); return r ? r.name : ""; }
  if (t === "ua") { const o = A(IN.d && IN.d.ua && IN.d.ua.oblasts).find(x => x.id === key); return o ? `${TX("ALARM")} · ${o.name}${o.since ? " · " + cd(Date.now() - o.since) : ""}` : ""; }
  if (t === "nt") { const n = A(IN.d && IN.d.notam && IN.d.notam.items).find(x => x.id === key); return n ? `NOTAM ${n.loc} · ${NT_N[n.kind] || n.kind}` : ""; }
  if (t === "tg") { const p = A(IN.d && IN.d.tg).find(x => x.id === key); return p ? `@${p.ch} · ${p.title || ""}` : ""; }
  if (t === "cr") { const c = A(IN.d && IN.d.corr).find(x => x.id === id.slice(3)); return c ? `⛓ ${(c.ai && c.ai.title) || c.lnames.join(" + ")}` : ""; }
  if (t === "rd") { const r = A(IN.d && IN.d.rad && IN.d.rad.pts).find(x => x.id === id.slice(3)); return r ? `☢ ${r.name} · ${r.usv} µSv/h${r.anom ? " · " + TX("ANOMALIA") : ""}` : ""; }
  if (id.startsWith("il:")) { const a = ilAll().filter(x => x.c === id.slice(3)).sort((x, y) => y.t - x.t)[0]; return a ? `🚀 ${a.c} · ${(((IN.d || {}).il || {}).types || {})[a.thr] || ""} · ${hm(a.t)}` : ""; }
  if (id.startsWith("gc:")) { const g = A(IN.gc).find(x => x.id === id.slice(3)); return g ? `GeoConfirmed · ${g.fac || ""} · ${new Date(g.t).toLocaleDateString(LOC)}` : ""; }
  if (id.startsWith("eq:")) { const e = A((IN.d || {}).emsc).find(x => String(x.id) === id.slice(3)); return e ? `EMSC M${e.mag} · ${e.where || ""}` : ""; }
  if (id.startsWith("acl:")) { const a = A(IN.acl).find(x => String(x[0]) === id.slice(4)); return a ? `ACLED · ${ACL_N[ACL_T[a[3]]]} · ${a[5]}${a[4] ? " · " + a[4] + " " + TX("ofiar") : ""}` : ""; }
  if (t === "la") { const a = A(IN.sdr && IN.sdr.adsb).find(x => x.hex === key); return a ? `${a.cs || a.hex} · ${a.t || ""} · ${a.alt ?? ""} ft · ${TX("Twój odbiornik")}` : ""; }
  if (t === "ap") { const s2 = A(IN.sdr && IN.sdr.aprs).find(x => x.call === key); return s2 ? `APRS ${s2.call} · ${s2.cmt || s2.kind || ""}` : ""; }
  if (t === "mi") { const x = A(MS.d && MS.d.items).find(y => y.id === key); return x ? `${x.title || ""} · ${((MS.d.kinds || {})[x.kind] || x.kind)} · ${x.t ? new Date(x.t).toLocaleDateString(LOC) : ""}` : ""; }
  return "";
}

/* --- samoloty: pobieranie */
let airT = null;
function contactSound(kind) {
  if (kind === "squawk") sndEvent("emergency", () => sfxRaw("alarm", 1));
  else if (WATCHK.has(kind)) sndEvent("watch", () => sfxRaw("contact"));
  else sfx("contact"); }
function airToast(e) {
  const box = $("#airToast"); if (!box) return; const b = document.createElement("button");
  b.className = "toast" + (e.kind === "squawk" || e.kind === "alarm" ? " red" : ""); b.innerHTML = `<b>${e.head || TX("KONTAKT ·") + " " + esc(new Date(e.at).toISOString().slice(11, 16)) + " " + TX("UTC")}</b>${esc(e.msg)}`;
  b.addEventListener("click", () => { const g = e.go || (e.hex && "ah:" + e.hex); if (g) go(g); b.remove(); }); box.appendChild(b); setTimeout(() => b.remove(), 12000);
  while (box.children.length > 4) box.firstChild.remove();
}
async function pollAir() {
  clearTimeout(airT); let next = 10000;
  try {
    const d = await api("/api/air?since=" + AIR.lastEv); next = (d.interval || 10) * 1000;
    if (d.status && d.status.ok && A(d.ac).length) {
      const was = AIR.ok; AIR.ok = true; AIR.skew = d.now - Date.now(); AIR.d = Object.assign({}, d, { events: (AIR.d ? A(AIR.d.events) : []).concat(A(d.events)).slice(-30) });
      A(d.events).forEach(e => { AIR.lastEv = Math.max(AIR.lastEv, e.at); if (!AIR.first) { airToast(e); contactSound(e.kind); } });
      AIR.first = false; if (!was) applyLayers(); needDraw = true; renderSky(); renderFilterCounts();
      if (selected && selected.startsWith("ah:")) pick(selected, true);
    } else if (d.status && d.status.err) { AIR.err = d.status.err; renderSky(); }
  } catch (e) {}
  airT = setTimeout(pollAir, document.hidden ? 30000 : next);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { pollAir(); pollSea(); } });

/* --- statki: pobieranie (tylko zmiany od poprzedniego odczytu) */
let seaT = null;
/* v3.15: serwer wysyła tylko statki z widocznego obszaru (z zapasem); przy oddaleniu zwykłe statki przychodzą jako kratki z liczbą,
   a pojedynczo tylko okręty, straż, SAR i statki z listy obserwacji. Przy przesunięciu mapy poza pobrany obszar – dociągnięcie. */
let SEAQ = null, CELLS = [], seaVT = null, seaBusy = false, seaAgain = false;
const CELL_STEPS = [0.5, 1, 2, 3, 5, 8];
function seaWant() {
  const world = [-180, -90, 180, 90], cl = FLT.cluster !== 0;
  if (mode !== "flat" || !cvW) return { bbox: world, view: world, cell: cl ? 3 : 0 };
  viewFit();
  const inv = (sx, sy) => flat.invert([((sx - vX) / vS - T.x) / T.k, ((sy - vY) / vS - T.y) / T.k]);
  const a = inv(0, 0), b = inv(cvW, cvH); if (!a || !b) return { bbox: world, view: world, cell: cl ? 3 : 0 };
  const v = [Math.max(-180, a[0]), Math.max(-90, b[1]), Math.min(180, b[0]), Math.min(90, a[1])], sx = v[2] - v[0], sy = v[3] - v[1];
  const cellRaw = sx / Math.max(20, cvW / 26), cell = cl && sx > 45 ? CELL_STEPS.find(c => c >= cellRaw) || 8 : 0;
  const bb = sx > 250 ? world : [Math.max(-180, v[0] - sx * .5), Math.max(-90, v[1] - sy * .5), Math.min(180, v[2] + sx * .5), Math.min(90, v[3] + sy * .5)].map(x => +x.toFixed(2));
  return { bbox: bb, view: v, cell };
}
const bbIn = (v, bb) => v[0] >= bb[0] - .01 && v[1] >= bb[1] - .01 && v[2] <= bb[2] + .01 && v[3] <= bb[3] + .01;
function seaViewCheck() { clearTimeout(seaVT); seaVT = setTimeout(() => { const w = seaWant(); if (!SEAQ || w.cell !== SEAQ.cell || !bbIn(w.view, SEAQ.bbox)) pollSea(); }, 400); }
async function pollSea() {
  if (seaBusy) { seaAgain = true; return; }
  clearTimeout(seaT); let next = 20000; seaBusy = true;
  try {
    const w = seaWant(), re = !SEAQ || w.cell !== SEAQ.cell || !bbIn(w.view, SEAQ.bbox) || SEAQ.old !== (FLT.shipOld ? 1 : 0);
    if (re) SEAQ = Object.assign(w, { old: FLT.shipOld ? 1 : 0 });
    const sel = selected && selected.startsWith("vs:") ? selected.slice(3) : 0;
    const d = await api(`/api/sea?since=${re || SEAQ.cell ? 0 : SEA.since || 0}&ev=${SEA.lastEv}&bbox=${SEAQ.bbox.join(",")}&cell=${SEAQ.cell}&old=${SEAQ.old}&sel=${sel}`); next = (d.interval || 20) * 1000;
    if (d.full) SHIPS.clear(); if (A(d.cats).length) SCATS = d.cats;
    A(d.rows).forEach(w => { w[11] = w[9] || 0; w[9] = null; SHIPS.set(w[0], w); });
    CELLS = A(d.cells); SEA.total = d.total || SHIPS.size; SEA.catn = d.catn || null;
    const lim = d.now / 1000 - (d.keep_s || 21600); for (const [k2, w] of SHIPS) if (w[6] < lim) SHIPS.delete(k2);
    SEA.since = d.now; SEA.skew = d.now - Date.now(); SEA.ok = SHIPS.size > 0 || CELLS.length > 0; drCache = 0; markStatic();
    SEA.d = Object.assign({}, d, { rows: null, cells: null, events: (SEA.d ? A(SEA.d.events) : []).concat(A(d.events)).slice(-30) });
    A(d.events).forEach(e => { SEA.lastEv = Math.max(SEA.lastEv, e.at); if (!SEA.first) { airToast(Object.assign({}, e, { hex: null, go: "vs:" + e.mmsi })); contactSound(e.kind === "alarm" ? "squawk" : e.kind); } });
    SEA.first = false; renderSea(); renderFilterCounts();
    if (selected && selected.startsWith("vs:")) pick(selected, true);
  } catch (e) {}
  seaBusy = false;
  if (seaAgain) { seaAgain = false; setTimeout(pollSea, 50); return; }
  seaT = setTimeout(pollSea, document.hidden ? 60000 : next);
}
async function loadShipDetail(mmsi) {
  try { const d = await api("/api/sea/ship/" + mmsi); if (d && d.mmsi) { SEA.detail[d.mmsi] = d; if (selected === "vs:" + mmsi) { pick(selected, true); markStatic(); } } } catch (e) {}
}
function renderSea() {
  const d = SEA.d; if (!d) return; const st = d.status || {}, dt = st.digitraffic || {}, ai = st.aisstream || {}, sm = d.summary || {}, now = Date.now() + SEA.skew;
  const tot = SEA.total || SHIPS.size;
  $("#seaT").innerHTML = tot ? `<span class="livedot"></span>${TX("NA ŻYWO ·")} ${tot.toLocaleString(LOC)} ${TX("jednostek")}` : "";
  const srcLine = (n, s, extra) => `<li><button tabindex="-1" style="cursor:default"><span class="t">${n}</span><span class="${s.ok ? "" : s.ok === false ? "red" : "dim"}">${s.ok ? (s.n || 0).toLocaleString(LOC) + " " + TX("statków") : s.ok === false ? TX("BŁĄD") : "—"}</span><span class="sub">${esc(s.err || extra || "")}</span></button></li>`;
  const ist = (IN.d && IN.d.status) || {}, extra = Object.entries(ist).filter(([k]) => k.startsWith("tcp:") || k === "aishub" || k === "ais").filter(([, v]) => v && !v.off)
    .map(([k, v]) => srcLine(k === "aishub" ? "AISHub" : k === "ais" ? TX("Twój odbiornik AIS (UDP)") : esc(v.name || k), { ok: v.ok, n: v.n, err: v.err }, k === "tcp:kystverket" ? TX("Norwegia, bez klucza") : "")).join("");
  const diag = `<li><button tabindex="-1" style="cursor:default"><span class="t">${TX("Na mapie (w widoku)")}</span><span>${SHIPSTAT.view.toLocaleString(LOC)}</span><span class="sub">${TX("na serwerze")} ${(SEA.total || SHIPS.size).toLocaleString(LOC)} · ${TX("pobrane dla widoku")} ${SHIPS.size.toLocaleString(LOC)}${CELLS.length ? " + " + CELLS.length + " " + TX("kratek") : ""} · ${TX("ukryte filtrem")} ${SHIPSTAT.filt.toLocaleString(LOC)} · ${TX("starsze niż 1 h (ukryte)")} ${SHIPSTAT.old.toLocaleString(LOC)}${!layerOn.vessel ? " · " + TX("warstwa STATKI wyłączona") : ""}</span></button></li>`;
  let h = `<li class="hd">${TX("Źródła")}</li>` + diag + srcLine(TX("Digitraffic · północny Bałtyk"), dt, TX("bez klucza"))
    + srcLine(d.scope === "world" ? TX("aisstream.io · cały świat") : TX("aisstream.io · obserwowane rejony świata"), ai, d.key ? (ai.rate ? ai.rate + " " + TX("komunikatów/s") : TX("łączenie…")) : TX("wpisz darmowy klucz w oknie OPERATOR")) + extra;
  const ev = A(d.events).slice(-8).reverse();
  if (ev.length) h += `<li class="hd">${TX("Zdarzenia")}</li>` + ev.map(e => `<li><button data-go="vs:${e.mmsi}"><span class="t">${esc(e.msg)}</span><span class="dim">${new Date(e.at).toISOString().slice(11, 16)}</span></button></li>`).join("");
  const zones = sm.zones || {};
  if (Object.keys(zones).length) h += `<li class="hd">${TX("Rejony")}</li>` + Object.entries(zones).sort((a, b) => b[1].all - a[1].all).map(([n, z]) => `<li><button tabindex="-1" style="cursor:default"><span class="t">${esc(n)}</span><span class="dim">${z.all}</span><span class="sub">${TX("tankowce")} ${z.tanker} ${TX("(rosyjska bandera")} ${z.ru}${TX(", bandery wygody")} ${z.foc}${TX(") · towarowe")} ${z.cargo} ${TX("· wojskowe/straż")} ${z.military}</span></button></li>`).join("");
  const hot = A(sm.hot).slice(0, 15);
  if (hot.length) h += `<li class="hd">${TX("Jednostki wojskowe i straży")}</li>` + hot.map(r => `<li><button data-go="vs:${r.mmsi}"><span class="t">${esc(r.flag_e || "")} ${esc(r.name || r.mmsi)}</span>${chip(SCN[r.cat], SCOL[r.cat])}<span class="sub">${esc(r.flag || "")} · ${esc(r.zone || fmtLL(r.lat, r.lon))} · ${agoTxt(Math.round((now - (r.ts || 0)) / 1000))}</span></button></li>`).join("");
  const W = sm.watch || {}, wl = (title, arr, fn) => arr.length ? `<li class="hd">${title} · ${arr.length}</li>` + arr.slice(0, 12).map(fn).join("") : "";
  const where = x => esc(x.zone ? TX(x.zone) : fmtLL(x.lat, x.lon));
  h = wl(TX("Możliwe przeładunki STS (statek przy statku)"), A(W.sts), x => `<li><button data-go="vs:${x.a.mmsi}"><span class="t">${esc(x.a.flag_e)} ${esc(x.a.name)} ⇄ ${esc(x.b.flag_e)} ${esc(x.b.name)}</span><span class="${x.confirmed ? "red" : "amber"}">${x.d} m</span><span class="sub">${where(x)} · ${TX("od")} ${hm(x.since)}${x.confirmed ? " · " + TX("ponad 30 min") : ""}</span></button></li>`)
    + wl(TX("Statki stojące nad kablami podmorskimi"), A(W.cable), x => `<li><button data-go="vs:${x.mmsi}"><span class="t">${esc(x.flag_e)} ${esc(x.name)}</span><span class="${x.confirmed ? "red" : "amber"}">${x.d} km</span><span class="sub">${esc(x.cable)} · ${where(x)} · ${TX("od")} ${hm(x.since)}</span></button></li>`)
    + wl(TX("„Ciemne” statki – przestały nadawać AIS"), A(W.dark), x => `<li><button data-go="vs:${x.mmsi}"><span class="t">${esc(x.flag_e)} ${esc(x.name)}</span>${chip(SCN[x.cat] || "", SCOL[x.cat] || "var(--amber)")}<span class="sub">${where(x)}${x.since ? " · " + TX("cisza od") + " " + hm(x.since) : ""}</span></button></li>`)
    + wl(TX("Statki z listy sankcji OFAC"), A(W.sanc), x => `<li><button data-go="vs:${x.mmsi}"><span class="t">${esc(x.flag_e)} ${esc(x.name)}</span><span class="red">OFAC</span><span class="sub">${esc(x.prog || "")} · ${where(x)}${x.ts ? " · " + agoTxt(Math.round((now - x.ts) / 1000)) : ""}</span></button></li>`)
    + h;
  rowsInto("#sea", h);
}

/* --- kable podmorskie (submarinecablemap.com) */
async function loadCables() {
  if (CABLES.lines || CABLES.loading) return; CABLES.loading = true;
  try { const d = await api("/api/cables");
    if (d.ready) { CABLES.lines = A(d.lines); markStatic(); }
    else setTimeout(() => { CABLES.loading = false; if (layerOn.cable) loadCables(); }, 60000);
  } catch (e) { CABLES.loading = false; }
}
function drawCables(k) {
  SX.save(); SX.globalCompositeOperation = "destination-over"; SX.beginPath();
  for (const ln of CABLES.lines) { let prev = null;
    for (const c of ln.c) { const p = scr(c[0], c[1]); if (!p) { prev = null; continue; }
      if (prev && Math.abs(p[0] - prev[0]) < cvW * .5) SX.lineTo(p[0], p[1]); else SX.moveTo(p[0], p[1]); prev = p; } }
  SX.strokeStyle = "rgba(196,140,255,.5)"; SX.lineWidth = k >= 4 ? 1.3 : .8; SX.stroke(); SX.restore();
}
/* --- obserwacja: sankcje (czerwony pierścień), milczące AIS (bursztyn), nad kablem (fiolet), STS */
const WATCH = () => !REPLAY.on && SEA.d && SEA.d.summary && SEA.d.summary.watch;
function drawWatch(rings) {
  SX.lineWidth = 1.4;
  for (let i = 0; i < rings.length; i += 3) { const f = rings[i + 2];
    SX.beginPath(); SX.arc(rings[i], rings[i + 1], 6.5, 0, 6.2832); SX.strokeStyle = f & 1 ? "#ff4b4b" : f & 2 ? "#c48cff" : "#ffb347"; SX.stroke(); }
  const w = WATCH(); if (!w) return;
  SX.setLineDash([2, 2]); SX.strokeStyle = "#ffb347";
  A(w.dark).forEach(d => { const p = scr(d.lon, d.lat); if (p && inView(p[0], p[1], 8)) SX.strokeRect(p[0] - 5, p[1] - 5, 10, 10); });
  SX.setLineDash([3, 2]); SX.strokeStyle = SX.fillStyle = "#ff4b4b"; SX.font = FONT();
  A(w.sts).forEach(d => { const p = scr(d.lon, d.lat); if (!p || !inView(p[0], p[1], 20)) return; SX.beginPath(); SX.arc(p[0], p[1], 11, 0, 6.2832); SX.stroke(); SX.fillText("STS", p[0] + 13, p[1] + 3); });
  SX.setLineDash([]);
}
/* --- samolot krążący po orbicie: przerywany okrąg o wykrytym promieniu */
function drawLoiter(a) {
  const L0 = a.loiter, c = scr(L0.lon, L0.lat), e = scr(L0.lon, L0.lat + L0.r / 111.2); if (!c || !e) return;
  const rp = Math.max(8, Math.abs(e[1] - c[1])); if (!inView(c[0], c[1], rp)) return;
  CX.beginPath(); CX.arc(c[0], c[1], rp, 0, 6.2832); CX.setLineDash([5, 4]); CX.strokeStyle = cssv(ACOL[a.cat] || ACOL.other); CX.globalAlpha = .75; CX.lineWidth = 1.3; CX.stroke(); CX.setLineDash([]); CX.globalAlpha = 1;
}

/* --- ODTWARZANIE (do 48 h wstecz z bazy historii): samoloty co minutę, ważne statki co 10 min */
const airList = () => REPLAY.on ? REPLAY.air : A(AIR.d && AIR.d.ac);
async function replayOpen() {
  let r = null; try { r = await api("/api/history/range"); } catch (e) {}
  if (!r || !r.from || r.to - r.from < 120e3) { airToast({ at: Date.now(), kind: "", head: TX("ODTWARZANIE"), msg: TX("Historia jest jeszcze pusta – KRONOS zapisuje pozycje co minutę od uruchomienia v3.9 i przechowuje je 48 h. Wróć za kilkanaście minut.") }); return; }
  Object.assign(REPLAY, { on: true, from: Math.max(r.from, r.to - 48 * 3600e3), to: r.to, t: Math.max(r.from, r.to - 3600e3) });
  $("#replay").hidden = false; $("#replayBtn").setAttribute("aria-pressed", true); sfx("click");
  const sl = $("#rpSlider"); sl.min = REPLAY.from; sl.max = REPLAY.to; sl.value = REPLAY.t;
  if (!layerOn.air) ensureLayer("air"); if (!layerOn.vessel) ensureLayer("vessel");
  replayFetch(REPLAY.t);
}
function replayClose() { replayPlay(false); REPLAY.on = false; $("#replay").hidden = true; $("#replayBtn").setAttribute("aria-pressed", false); markStatic(); renderSky(); }
async function replayFetch(t) {
  REPLAY.want = t; if (REPLAY.busy) return; REPLAY.busy = true;
  try { const d = await api("/api/history/frame?t=" + Math.round(t));
    if (REPLAY.on) {
      REPLAY.t = t; REPLAY.air = A(d.air);
      const m = new Map(); A(d.sea).forEach(r => { const ci = SCATS.indexOf(r[5]); m.set(r[0], [r[0], r[1], r[2], r[3], r[4], ci < 0 ? SCATS.length - 1 : ci, r[7], r[6] || "", null, null, null, 0]); });
      REPLAY.ships = m; REPLAY.ev = A(d.events); markStatic(); renderReplay(); }
  } catch (e) {}
  REPLAY.busy = false; if (REPLAY.on && REPLAY.want !== t) replayFetch(REPLAY.want);
}
function renderReplay() {
  const d = new Date(REPLAY.t); $("#rpSlider").value = REPLAY.t;
  $("#rpTime").textContent = d.toLocaleDateString(LOC, { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
  $("#rpCount").textContent = `✈ ${REPLAY.air.length} · ⚓ ${REPLAY.ships.size}`;
  const e = REPLAY.ev[0]; $("#rpEv").textContent = e ? new Date(e.at).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }) + " · " + e.msg : "";
}
function replayPlay(on) {
  REPLAY.playing = on; clearInterval(REPLAY.timer); $("#rpPlay").textContent = on ? "❚❚" : "▶"; $("#rpPlay").setAttribute("aria-pressed", on);
  if (!on) return;
  if (REPLAY.t >= REPLAY.to - 60e3) REPLAY.t = REPLAY.from;
  REPLAY.timer = setInterval(() => { const nt = Math.min(REPLAY.to, REPLAY.t + +$("#rpSpeed").value * 500); replayFetch(nt); if (nt >= REPLAY.to) replayPlay(false); }, 500);
}
$("#replayBtn").addEventListener("click", () => REPLAY.on ? replayClose() : replayOpen());
$("#rpLive").addEventListener("click", replayClose);
$("#rpPlay").addEventListener("click", () => replayPlay(!REPLAY.playing));
$("#rpSlider").addEventListener("input", e => { replayPlay(false); replayFetch(+e.target.value); });
$$("[data-rpjump]").forEach(b => b.addEventListener("click", () => { replayPlay(false); replayFetch(Math.max(REPLAY.from, Math.min(REPLAY.to, REPLAY.t + +b.dataset.rpjump * 60e3))); }));

/* --- HISTORIA: wykresy wskaźników (zapis co godzinę, rok wstecz) i dziennik zdarzeń */
const HST = Object.assign({ key: "threat", days: 7 }, store.get("hist", {}));
let HKEYS = null;
async function loadHist() {
  try {
    if (!HKEYS) { HKEYS = A((await api("/api/history/keys")).keys).filter(k => !/^zone\./.test(k.key) || /\.(all|tanker|military)$/.test(k.key));
      const zl = k => { const m = k.key.match(/^zone\.(.+)\.(all|tanker|military)$/); return m ? `${TX(m[1])} – ${TX({ all: "statki", tanker: "tankowce", military: "okręty i straż" }[m[2]])}` : k.label; };
      $("#histKey").innerHTML = HKEYS.map(k => `<option value="${esc(k.key)}">${esc(zl(k))}</option>`).join("") || `<option value="threat">${TX("Poziom napięcia")}</option>`;
      if (!HKEYS.some(k => k.key === HST.key)) HST.key = "threat"; $("#histKey").value = HST.key; }
    $$("#histDays [data-d]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.d === HST.days));
    const d = await api(`/api/history/metrics?keys=${encodeURIComponent(HST.key)}&days=${HST.days}`);
    drawHist(A(d.series[HST.key]));
    const ev = A((await api("/api/history/events?hours=24&limit=40")).events);
    $("#histEvN").textContent = ev.length ? ev.length + " " + TX("w 24 h") : "";
    rowsInto("#histEv", ev.slice(0, 25).map(e => `<li><button${e.ref ? ` data-go="${e.src === "sea" ? "vs" : "ah"}:${esc(e.ref)}"` : ""}><span class="t">${esc(e.msg)}</span><span class="dim">${hm(e.at)}</span></button></li>`).join("") || `<li class="empty">${TX("Brak zdarzeń w ostatnich 24 h.")}</li>`);
  } catch (e) {}
}
function drawHist(s) {
  const el = d3.select("#histChart"); el.selectAll("*").remove();
  const w = 320, hh = 120, m = { l: 30, r: 8, t: 8, b: 18 };
  if (s.length < 2) { el.append("text").attr("x", w / 2).attr("y", hh / 2).attr("text-anchor", "middle").attr("class", "hist-empty").text(TX("Za mało danych – wskaźniki zapisują się co godzinę.")); $("#histNote").textContent = ""; return; }
  const pts = s.map(p => ({ t: new Date(p[0]), v: p[1] })), x = d3.scaleTime().domain(d3.extent(pts, p => p.t)).range([m.l, w - m.r]);
  const ext = d3.extent(pts, p => p.v); if (ext[0] === ext[1]) { ext[0] -= 1; ext[1] += 1; }
  const y = d3.scaleLinear().domain(ext).nice(4).range([hh - m.b, m.t]);
  el.append("g").attr("class", "tax").attr("transform", `translate(0,${hh - m.b})`).call(d3.axisBottom(x).ticks(4).tickSizeOuter(0).tickFormat(d3.timeFormat(HST.days <= 1 ? "%H:%M" : "%d.%m")));
  el.append("g").attr("class", "tax").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)));
  el.append("path").attr("class", "hist-area").attr("d", d3.area().x(p => x(p.t)).y0(hh - m.b).y1(p => y(p.v))(pts));
  el.append("path").attr("class", "hist-line").attr("d", d3.line().x(p => x(p.t)).y(p => y(p.v))(pts));
  const last = pts[pts.length - 1], mx = d3.max(pts, p => p.v), mn = d3.min(pts, p => p.v);
  $("#histNote").textContent = `${TX("teraz")} ${+last.v.toFixed(1)} · max ${+mx.toFixed(1)} · min ${+mn.toFixed(1)}`;
}
$("#histKey").addEventListener("change", e => { HST.key = e.target.value; store.set("hist", HST); loadHist(); });
$$("#histDays [data-d]").forEach(b => b.addEventListener("click", () => { HST.days = +b.dataset.d; store.set("hist", HST); beep(700); loadHist(); }));
$("#reportBtn").addEventListener("click", () => { sfx("click"); window.open("/report", "_blank"); });
setInterval(() => { if (!document.hidden) loadHist(); }, 600e3);

/* --- zestawienie postów i zdjęć dla zdarzenia (v3.20) */
const EVC = {}; let EVBLUR = store.get("evblur", true) !== false, LB = null;
/* GeoConfirmed: opis, sprzęt, jednostki i linki do oryginału (v3.22.2) */
const GCD = {};
async function gcFill() {
  const el = $("#gcDet"); if (!el) return; const id = el.dataset.gc;
  let d = GCD[id]; if (!d) { try { d = GCD[id] = await api("/api/intel/gc/" + encodeURIComponent(id)); } catch (e) { el.innerHTML = `<p class="hint">${TX("Nie udało się pobrać szczegółów – otwórz stronę GeoConfirmed.")}</p>`; return; } }
  const e2 = $("#gcDet"); if (!e2 || e2.dataset.gc !== id) return;
  const links = s => String(s || "").split(/[\s,]+/).filter(u => /^https?:\/\//.test(u)).map(u => { const x = u.match(/(?:x|twitter)\.com\/([^/]+)\/status/); return L(u, x ? "X · @" + x[1] : u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 34)); }).join("<br>");
  const ORG = { VID: TX("nagranie"), IMG: TX("zdjęcie"), SAT: TX("zdjęcie satelitarne") };
  e2.innerHTML = (d.description ? `<p>${esc(d.description)}</p>` : "") + dd([[TX("SPRZĘT"), d.gear || null], [TX("JEDNOSTKI"), d.units || null],
    [TX("MATERIAŁ"), d.origin ? (ORG[d.origin] || d.origin) : null], [TX("MIEJSCE"), d.plusCode ? d.plusCode.replace(/^\S+\s+/, "") : null],
    [TX("ORYGINAŁ"), links(d.originalSource) || null, 1], [TX("GEOLOKALIZACJA"), links(d.geolocation) || null, 1]]);
}
function evBox(type, id) { return `<div class="evbox" data-evt="${type}" data-evid="${esc0(String(id))}"><p class="sat-h">${TX("POSTY I ZDJĘCIA")}</p><div class="evbody"><p class="hint">${TX("Szukam relacji…")}</p></div></div>`; }
const LBS = {};
function evThumb(m, p, i, set) { return `<button class="evth${m.k === "video" ? " vid" : ""}" data-lb="${i}" data-lbs="${set || "ev"}" title="${esc(p ? (p.chn || p.ch || "") + " · " + hm(p.t) : "")}"><img loading="lazy" src="/media/${m.h}.jpg" alt="" class="${EVBLUR ? "blur" : ""}" onerror="this.parentNode.classList.add('gone')">${m.k === "video" ? "<i>▶</i>" : ""}</button>`; }
function evGal(ms, p) { if (!A(ms).length) return ""; LBS.post = A(ms).map(m => ({ m, p })); return `<div class="evg">${A(ms).map((m, i) => evThumb(m, p, i, "post")).join("")}</div>`; }
async function evFill(force) {
  const box = $("#detail .evbox"); if (!box) { bindLb(); return; }
  const t = box.dataset.evt, id = box.dataset.evid, key = t + "|" + id, c = EVC[key];
  if (c && !force && Date.now() - c.at < 120e3) { evRender(box, c.d); return; }
  if (c) evRender(box, c.d);
  const gq = t === "geo" ? (() => { const [la, lo, hh, ...nm] = id.split(","); return `&lat=${la}&lon=${lo}&h=${hh}&q=${encodeURIComponent(nm.join(","))}`; })() : "";
  try { const d = await api(`/api/media/event?type=${t}&id=${encodeURIComponent(id)}${gq}`); EVC[key] = { at: Date.now(), d }; const b2 = $(`#detail .evbox[data-evt="${t}"]`); if (b2 && b2.dataset.evid === id) evRender(b2, d); } catch (e) {}
}
function evRender(box, d) {
  const el = box.querySelector(".evbody"), ps = A(d.posts), items = [];
  ps.forEach(p => A(p.media).forEach(m => items.push({ m, p })));
  const cr = p => p.cred ? `<span class="chip" style="color:${CRED[p.cred] || "var(--phos-dim)"}">${esc(p.cred)}</span>` : "";
  el.innerHTML = `<p class="hint">${ps.length} ${TX("postów")} · ${items.length} ${TX("zdjęć i nagrań")} · ${hm(d.t0)}–${hm(d.t1)}${A(d.names).length ? " · " + TX("szukam:") + " " + esc(A(d.names).slice(0, 6).join(", ")) : ""}</p>`
    + `<div class="seg"><button class="btn" data-evsum>${TX("PODSUMUJ (AI)")}</button><button class="btn" data-evref>${TX("ODŚWIEŻ")}</button><button class="btn" data-evblur aria-pressed="${!EVBLUR}">${TX("BEZ ROZMYCIA")}</button></div>`
    + `<div class="evsum" hidden></div>`
    + (items.length ? `<div class="evg">${items.slice(0, 48).map((x, i) => evThumb(x.m, x.p, i)).join("")}</div>` : "")
    + (ps.length ? `<ul class="rows evposts">` + ps.slice(0, 40).map(p => `<li><button ${p.src === "tg" && !String(p.id).includes(":") ? `data-go="tg:${esc0(p.id)}"` : 'tabindex="-1" style="cursor:default"'}><span class="t">${esc(p.title || (p.text || "").slice(0, 160))}</span>${cr(p)}<span class="sub">${esc(p.src && p.src !== "tg" ? p.src + " · " : "")}${esc(p.chn || p.ch || "")} · ${hm(p.t)}${A(p.media).length ? " · " + A(p.media).length + " ▣" : ""} · ${L(p.url, TX("oryginał"))}</span></button></li>`).join("") + `</ul>`
      : `<p class="hint">${TX("Na razie brak relacji w śledzonych kanałach. Pierwsze posty pojawiają się zwykle kilka minut po zdarzeniu – zestawienie odświeża się co 2 minuty, gdy karta jest otwarta.")}</p>`)
    + (Object.keys(d.errors || {}).length ? `<p class="hint red">${esc(Object.entries(d.errors).map(([k, v]) => k + ": " + v).join(" · "))}</p>` : "")
    + `<p class="hint">${TX("Zdjęcia i nagrania pochodzą z kanałów – mogą być stare, z innego miejsca albo zmanipulowane. Przycisk „Sprawdź, czy już krążyło” otwiera wyszukiwanie obrazem.")}</p>`;
  LBS.ev = items;
  el.querySelector("[data-evref]").addEventListener("click", () => evFill(true));
  el.querySelector("[data-evblur]").addEventListener("click", () => { EVBLUR = !EVBLUR; store.set("evblur", EVBLUR); $$("#detail .evth img").forEach(i => i.classList.toggle("blur", EVBLUR)); el.querySelector("[data-evblur]").setAttribute("aria-pressed", !EVBLUR); });
  el.querySelector("[data-evsum]").addEventListener("click", async () => { const sb = el.querySelector(".evsum"); sb.hidden = false; sb.textContent = TX("AI czyta relacje…");
    try { const r = await fetch("/api/media/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: box.dataset.evt, id: box.dataset.evid }) });
      const rd = r.body.getReader(), dec = new TextDecoder(); let txt = ""; for (;;) { const { done, value } = await rd.read(); if (done) break; txt += dec.decode(value, { stream: true }); sb.textContent = txt; } } catch (e) { sb.textContent = TX("błąd"); } });
  bindDetail2(el); bindLb();
}
function bindDetail2(el) { el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go))); }
function bindLb() { $$("#detail .evth").forEach(b => { if (b.dataset.bound) return; b.dataset.bound = 1; b.addEventListener("click", e => { e.stopPropagation(); LB = { items: LBS[b.dataset.lbs] || [] }; lbOpen(+b.dataset.lb); }); }); }
function lbOpen(i) {
  if (!LB || !LB.items[i]) return; LB.i = i; const { m, p } = LB.items[i]; let o = $("#lightbox");
  if (!o) { o = document.createElement("div"); o.id = "lightbox"; o.className = "lightbox"; document.body.appendChild(o); o.addEventListener("click", e => { if (e.target === o) lbClose(); }); }
  const lens = m.o ? `<a class="btn" target="_blank" rel="noopener" href="https://lens.google.com/uploadbyurl?url=${encodeURIComponent(m.o)}">${TX("Sprawdź, czy już krążyło (Google)")}</a><a class="btn" target="_blank" rel="noopener" href="https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(m.o)}">Yandex</a>` : "";
  o.innerHTML = `<div class="lb-in">${m.k === "video" ? `<video src="/media/${m.h}.mp4" poster="/media/${m.h}.jpg" controls autoplay playsinline></video>` : `<img src="/media/${m.h}.jpg" alt="">`}
    <div class="lb-cap"><span>${esc(p ? (p.chn || p.ch || "") + " · " + new Date(p.t).toLocaleString(LOC) : "")}</span><span>${esc(p ? (p.title || (p.text || "").slice(0, 200)) : "")}</span>
    <div class="seg"><button class="btn" data-lbp>◀</button><button class="btn" data-lbn>▶</button>${p && p.url ? L(p.url, TX("oryginał na Telegramie")) : ""}${lens}<button class="btn" data-lbx>✕</button></div>
    ${m.k === "video" ? `<p class="hint">${TX("Jeśli film się nie odtwarza (link wygasł), otwórz oryginał.")}</p>` : ""}</div></div>`;
  o.hidden = false;
  o.querySelector("[data-lbp]").onclick = () => lbOpen((LB.i - 1 + LB.items.length) % LB.items.length);
  o.querySelector("[data-lbn]").onclick = () => lbOpen((LB.i + 1) % LB.items.length);
  o.querySelector("[data-lbx]").onclick = lbClose;
}
function lbClose() { const o = $("#lightbox"); if (o) { o.hidden = true; o.innerHTML = ""; } }
document.addEventListener("keydown", e => { const o = $("#lightbox"); if (!o || o.hidden) return; if (e.key === "Escape") lbClose(); if (e.key === "ArrowRight") lbOpen((LB.i + 1) % LB.items.length); if (e.key === "ArrowLeft") lbOpen((LB.i - 1 + LB.items.length) % LB.items.length); });
setInterval(() => { if (!document.hidden && $("#detail .evbox")) evFill(); }, 120e3);

/* --- graf powiązań statku (v3.17): właściciel, zarządcy, bandera, sankcje, flota tych samych firm */
const VG = {}, VGC = { vessel: "var(--cyan)", org: "var(--amber)", person: "var(--violet)", flag: "var(--white)", sanc: "var(--red)" };
const flagEmoji = c => /^[a-z]{2}$/i.test(c || "") ? String.fromCodePoint(...c.toUpperCase().split("").map(x => 0x1F1A5 + x.charCodeAt(0))) : "";
function vgBox(mmsi) { return `<div class="vgraph" data-vg="${mmsi}"><p class="sat-h">${TX("POWIĄZANIA")}</p><div class="vgbody">${VG[mmsi] ? "" : `<p class="hint">${TX("Szukam właściciela, zarządców i sankcji…")}</p>`}</div></div>`; }
async function vgFill() {
  const box = $("#detail .vgraph"); if (!box) return; const mmsi = box.dataset.vg;
  if (!VG[mmsi]) { VG[mmsi] = { loading: true }; try { VG[mmsi] = await api("/api/graph/vessel?mmsi=" + mmsi); } catch (e) { VG[mmsi] = { error: 1 }; } }
  if (VG[mmsi].loading) return;
  const b2 = $(`#detail .vgraph[data-vg="${mmsi}"] .vgbody`); if (b2) vgRender(b2, VG[mmsi]);
}
function vgRender(el, g) {
  if (g.error) { el.innerHTML = `<p class="hint">${TX("Graf niedostępny.")}</p>`; return; }
  const f = g.facts || {}, meta = g.meta || {};
  if (!meta.n_v) { el.innerHTML = `<p class="hint">${TX("Baza powiązań jeszcze się pobiera (OpenSanctions, ok. 40 MB, raz w tygodniu) – spróbuj za chwilę.")}</p>`; delete VG[el.closest(".vgraph").dataset.vg]; return; }
  const W2 = 360, H2 = g.found ? 300 : 110, nodes = g.nodes.map(n => Object.assign({}, n)), byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const links = g.edges.filter(e => byId[e[0]] && byId[e[1]]).map(e => ({ source: e[0], target: e[1], l: e[2] }));
  const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(d => d.target.t === "flag" || d.target.t === "sanc" ? 62 : 78))
    .force("charge", d3.forceManyBody().strength(-260)).force("center", d3.forceCenter(W2 / 2, H2 / 2)).force("col", d3.forceCollide(24)).stop();
  for (let i = 0; i < 220; i++) sim.tick();
  nodes.forEach(n => { n.x = Math.max(16, Math.min(W2 - 16, n.x)); n.y = Math.max(14, Math.min(H2 - 14, n.y)); });
  const cut = (t, m) => (t || "").length > m ? t.slice(0, m - 1) + "…" : t || "";
  const shape = n => { const c = n.t === "vessel" && (n.risk || []).includes("sanction") ? "var(--red)" : VGC[n.t] || "var(--phos)", r = n.center ? 9 : 6;
    if (n.t === "vessel") return `<circle r="${r}" fill="${c}" fill-opacity="${n.center ? 1 : .75}" stroke="${n.live ? "var(--white)" : "none"}" stroke-width="2"/>`;
    if (n.t === "flag") return `<rect x="-11" y="-7" width="22" height="14" fill="none" stroke="${c}" stroke-opacity="${n.old ? .45 : 1}"/><text text-anchor="middle" y="4" class="vgf">${esc(flagEmoji(n.n) || n.n.slice(0, 3))}</text>`;
    if (n.t === "sanc") return `<path d="M0,-8L8,0L0,8L-8,0Z" fill="${n.kind === "sanc" ? c : "none"}" stroke="${c}"/>`;
    if (n.t === "person") return `<circle r="6" fill="none" stroke="${c}" stroke-width="2"/>`;
    return `<rect x="-6" y="-6" width="12" height="12" fill="${(n.risk || []).includes("sanction") ? "var(--red)" : c}" fill-opacity=".85"/>`; };
  const tip = n => [n.n, n.c ? n.c.toUpperCase() : "", n.t === "vessel" ? (n.imo ? "IMO " + n.imo : "") + (n.live ? " · " + TX("teraz na mapie") : "") : "", (n.risk || []).includes("sanction") ? TX("SANKCJE") : (n.risk || []).includes("mare.shadow") ? TX("flota cieni") : ""].filter(Boolean).join(" · ");
  const svgS = `<svg viewBox="0 0 ${W2} ${H2}" class="vgsvg" role="img" aria-label="${TX("Graf powiązań statku")}">` +
    links.map(l => `<line x1="${l.source.x.toFixed(1)}" y1="${l.source.y.toFixed(1)}" x2="${l.target.x.toFixed(1)}" y2="${l.target.y.toFixed(1)}"><title>${esc(l.l)}</title></line>`).join("") +
    nodes.map(n => `<g transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})" class="vgn${n.t === "vessel" && !n.center && (n.mmsi || n.imo) ? " go" : ""}" data-mmsi="${n.mmsi || ""}" data-imo="${n.imo || ""}" data-n="${esc(n.n)}"><title>${esc(tip(n))}</title>${shape(n)}<text y="${n.center ? 20 : 17}" text-anchor="middle">${esc(cut(n.t === "flag" ? "" : n.n, n.center ? 24 : 18))}</text></g>`).join("") + `</svg>`;
  const leg = `<p class="vgleg"><i style="background:var(--cyan)"></i>${TX("statek")} <i style="background:var(--red)"></i>${TX("sankcje")} <i style="background:var(--amber)"></i>${TX("firma")} <i class="o" style="border-color:var(--violet)"></i>${TX("osoba")} <i class="o" style="border-color:var(--white)"></i>${TX("bandera")} · ${TX("biała obwódka = teraz na mapie")}</p>`;
  let facts = "";
  if (g.found) facts = dd([[TX("NA LISTACH"), A(f.auth).map(a => a.name).join(", ") || "—"], [TX("STATUS"), [f.sanctioned ? TX("objęty sankcjami") : "", f.shadow ? TX("flota cieni") : "", f.detained ? TX("zatrzymany w porcie (kontrola PSC)") : ""].filter(Boolean).join(" · ") || null],
      [TX("TYP"), f.type], [TX("ROK BUDOWY"), f.built], [TX("NOŚNOŚĆ"), f.dwt ? f.dwt + " t" : null], [TX("DAWNE NAZWY"), A(f.prev).join(", ") || null],
      [TX("DAWNE BANDERY"), A(f.pf).map(c => flagEmoji(c) + " " + c.toUpperCase()).join(", ") || null], [TX("FLOTA TYCH FIRM"), f.fleet_n ? f.fleet_n + " " + TX("statków") : null],
      [TX("PROFIL"), f.url ? L(f.url, "OpenSanctions") : null, 1], [TX("WYWIAD UA"), f.gur ? L(f.gur, "war-sanctions.gur.gov.ua") : null, 1]])
    + (f.desc ? `<details class="vgdesc"><summary>${TX("OPIS (wywiad Ukrainy, GUR)")}</summary><p>${esc(f.desc)}</p></details>` : "");
  else facts = `<p class="hint">${TX("Statku nie ma na listach sankcyjnych ani w bazie właścicieli (OpenSanctions, wywiad Ukrainy). Brak wpisu nie oznacza, że statek jest „czysty” – właściciele zwykle są ukryci za spółkami-wydmuszkami.")}</p>`;
  el.innerHTML = svgS + leg + facts + `<p class="hint">${TX("Dane: OpenSanctions (CC BY-NC 4.0) i baza „War & Sanctions” wywiadu Ukrainy; aktualizacja raz w tygodniu. Powiązania dotyczą właścicieli rejestrowych i zarządców – rzeczywisty właściciel bywa inny.")}</p>`;
  el.querySelectorAll(".vgn.go").forEach(gn => gn.addEventListener("click", () => { const m = +gn.dataset.mmsi;
    if (m && SHIPS.has(m)) go("vs:" + m); else if (m) { $("#findQ").value = String(m); $("#findQ").dispatchEvent(new Event("input")); } else if (gn.dataset.n) { $("#findQ").value = gn.dataset.n; $("#findQ").dispatchEvent(new Event("input")); } }));
}
function shipWatch(r) {
  const W = (SEA.d && SEA.d.summary && SEA.d.summary.watch) || {}, out = [], m = +r.mmsi;
  if (r.sanc) out.push(`<b class="red">${TX("SANKCJE")} OFAC</b> · ${esc(r.sanc.prog || "")}${r.sanc.name ? " · " + esc(r.sanc.name) : ""} · ${TX("dopasowanie:")} ${esc(r.sanc.by === "IMO" ? "IMO" : TX("nazwa"))}`);
  const dk = A(W.dark).find(x => x.mmsi === m); if (dk || (r.flags & 4)) out.push(`<b class="amber">${TX("MILCZY")}</b> · ${TX("statek nadawał regularnie, a od")} ${dk && dk.since ? hm(dk.since) : "?"} ${TX("nie wysłał pozycji AIS (możliwe wyłączenie transpondera)")}`);
  const cb = r.cable || A(W.cable).find(x => x.mmsi === m); if (cb) out.push(`<b class="violet">${TX("NAD KABLEM")}</b> · ${esc(cb.cable)} · ${cb.d} km · ${TX("od")} ${hm((cb.since > 1e12 ? cb.since : cb.since * 1000))}`);
  A(W.sts).filter(x => x.a.mmsi === m || x.b.mmsi === m).forEach(x => { const o = x.a.mmsi === m ? x.b : x.a; out.push(`<b class="red">STS</b> · ${TX("burta w burtę z")} <button class="linkbtn" data-go="vs:${o.mmsi}">${esc(o.name)}</button> · ${x.d} m · ${TX("od")} ${hm(x.since)}`); });
  return out.length ? `<div class="watchbox">${out.map(x => `<p>${x}</p>`).join("")}</div>` : "";
}
/* ------------------------------------------------------------ BEZPIECZEŃSTWO MORSKIE (IMB, ReCAAP, NGA, UKHO, EUNAVFOR, MARAD) */
const MS = { d: null, at: 0, det: {}, loading: {} };
const MSF = Object.assign({ days: 30, warn: 1, all: 0 }, store.get("msflt", {}));
const MS_SECW = new Set(["mine", "gnss", "closure", "exercise", "launch", "attack", "missile"]);
const MS_SRC = { nga: "NGA", ukho: "UKHO", imb: "IMB", recaap: "ReCAAP", eunavfor: "EUNAVFOR", marad: "MARAD" };
const MS_SYM = { missile: "✸", hijack: "☠", attack: "✕", boarding: "⚑", approach: "◌", robbery: "$", mine: "⊛", gnss: "⌁", closure: "⛔", launch: "↑", exercise: "✚", advisory: "!", casualty: "+", cable: "≈", hazard: "△", other: "·" };
const msCol = (x) => x.warn ? (x.kind === "mine" || x.kind === "closure" ? "#ff8f6b" : x.kind === "gnss" ? "#ffb347" : "#c48cff") : x.sev >= 4 ? "#ff4b4b" : x.sev === 3 ? "#ffb347" : "#ffe27a";
function msVisible(x, now) {
  if (x.warn) return MSF.warn && (MSF.all || MS_SECW.has(x.kind));
  return (x.t || 0) > now - MSF.days * 864e5;
}
const msList = () => { const now = Date.now(); return A(MS.d && MS.d.items).filter(x => msVisible(x, now)); };
async function pollMS() {
  try { MS.d = await api("/api/marsec?days=120"); MS.at = Date.now(); renderMS(); needDraw = true; } catch (e) {}
}
function drawMS() {
  const now = Date.now(), k = mode === "globe" ? 1 : T.k;
  CX.font = "bold 12px " + (getComputedStyle(document.body).getPropertyValue("--f-display") || "monospace"); CX.textAlign = "center"; CX.textBaseline = "middle";
  for (const x of msList()) {
    if (!x.pos) continue; const p = scr(x.pos[1], x.pos[0]); if (!p || !inView(p[0], p[1], 14)) continue;
    const age = (now - (x.t || now)) / 864e5, col = msCol(x), r = x.warn ? 5 : 5 + Math.min(3, x.sev - 1) * 1.2, sel = selected === "mi:" + x.id;
    CX.globalAlpha = x.warn ? .8 : age < 2 ? 1 : age < 10 ? .8 : .5;
    CX.beginPath();
    if (x.warn) CX.rect(p[0] - r, p[1] - r, r * 2, r * 2); else { CX.moveTo(p[0], p[1] - r - 1); CX.lineTo(p[0] + r + 1, p[1]); CX.lineTo(p[0], p[1] + r + 1); CX.lineTo(p[0] - r - 1, p[1]); CX.closePath(); }
    CX.fillStyle = x.warn ? "rgba(5,8,5,.75)" : col; CX.fill(); CX.lineWidth = sel ? 2.2 : 1.2; CX.strokeStyle = x.warn ? col : cssv("var(--void)"); CX.stroke();
    if (x.warn || k >= 3) { CX.fillStyle = x.warn ? col : "#050805"; CX.fillText(MS_SYM[x.kind] || "·", p[0], p[1] + .5); }
    if (!x.warn && age < 2) { CX.beginPath(); CX.arc(p[0], p[1], r + 5 + (now / 120 % 6), 0, 6.2832); CX.strokeStyle = col; CX.lineWidth = 1; CX.globalAlpha = .45; CX.stroke(); }
    CX.globalAlpha = 1; AHIT.push([p[0], p[1], "mi:" + x.id]);
  }
  CX.textAlign = "start"; CX.textBaseline = "alphabetic";
  const det = selected && selected.startsWith("mi:") && MS.det[selected.slice(3)];
  if (det && A(det.area).length >= 3) { CX.beginPath(); det.area.forEach((q, i) => { const p = scr(q[1], q[0]); if (!p) return; i ? CX.lineTo(p[0], p[1]) : CX.moveTo(p[0], p[1]); }); CX.closePath();
    CX.fillStyle = "rgba(196,140,255,.12)"; CX.fill(); CX.setLineDash([4, 3]); CX.strokeStyle = "#c48cff"; CX.lineWidth = 1.4; CX.stroke(); CX.setLineDash([]); }
}
function renderMS() {
  const d = MS.d; if (!d) return; const all = msList(), inc = all.filter(x => !x.warn), w = all.filter(x => x.warn), now = Date.now();
  const n24 = inc.filter(x => x.t > now - 864e5).length;
  $("#msT").textContent = `${inc.length} ${TX("incydentów")} · ${w.length} ${TX("ostrzeżeń")}${n24 ? " · " + n24 + " " + TX("w 24 h") : ""}`;
  $$("#msDays [data-d]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.d === MSF.days));
  $("#msWarn").setAttribute("aria-pressed", !!MSF.warn); $("#msAll").setAttribute("aria-pressed", !!MSF.all); $("#msAll").hidden = !MSF.warn;
  const row = x => { const kn = (d.kinds || {})[x.kind] || x.kind, col = msCol(x);
    return `<li><button data-go="mi:${esc0(x.id)}"><span class="t"><span class="ms-sym" style="color:${col}">${MS_SYM[x.kind] || "·"}</span>${esc(x.title || kn)}</span><span class="dim">${x.t ? new Date(x.t).toLocaleDateString(LOC, { day: "2-digit", month: "2-digit" }) : ""}</span>`
      + `<span class="sub">${esc(kn)} · ${esc(x.region || "")} · ${A(x.src).map(s => `<b class="ms-src">${MS_SRC[s] || s}</b>`).join(" ")}${A(x.src).length > 1 ? " · " + TX("potwierdzone przez") + " " + A(x.src).length + " " + TX("źródła") : ""}</span></button></li>`; };
  let h = inc.length ? inc.slice(0, 40).map(row).join("") : `<li class="empty">${TX("Brak incydentów w wybranym okresie.")}</li>`;
  if (w.length) h += `<li class="hd">${TX("Ostrzeżenia nawigacyjne w mocy")} · ${w.length}</li>` + w.slice(0, 30).map(row).join("");
  const st = Object.entries(d.status || {}).map(([k, s]) => `<span class="${s.ok ? "" : s.ok === false ? "red" : "dim"}" title="${esc0(s.err || "")}">${esc(s.name || k)}${s.ok ? " ✓" : s.ok === false ? " ✕" : " …"}</span>`).join(" · ");
  h += `<li class="hd">${TX("Źródła")}</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${st}</span></button></li>`;
  rowsInto("#marsec", h);
}
function msCard(iid, silent) {
  const r = MS.det[iid];
  if (!r) { if (!MS.loading[iid]) { MS.loading[iid] = 1; api("/api/marsec/item/" + encodeURIComponent(iid)).then(x => { delete MS.loading[iid]; if (x && x.id) { MS.det[iid] = x; if (selected === "mi:" + iid) { pick(selected, true); needDraw = true; } } }).catch(() => { delete MS.loading[iid]; }); }
    return chip(TX("BEZPIECZEŃSTWO MORSKIE"), "var(--amber)") + `<p class="hint">${TX("Wczytuję zgłoszenie…")}</p>`; }
  const kn = ((MS.d || {}).kinds || {})[r.kind] || r.kind, col = msCol(r), ai = r.ai || {}, s = r.ship || {};
  const when = r.t ? new Date(r.t).toLocaleString(LOC, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const inReplay = r.t && Date.now() - r.t < 47 * 3600e3;
  let h = chip((r.warn ? TX("OSTRZEŻENIE · ") : TX("INCYDENT · ")) + kn.toUpperCase(), col) + `<h2 class="glow">${esc(ai.title || r.title || kn)}</h2>`;
  if (ai.summary) h += `<p>${esc(ai.summary)}</p>`;
  h += dd([[TX("KIEDY"), when + " UTC"], [TX("GDZIE"), [r.region, r.pos ? fmtLL(r.pos[0], r.pos[1]) : null].filter(Boolean).join(" · ")], [TX("WAGA"), "●".repeat(r.sev || 1) + "○".repeat(5 - (r.sev || 1))],
    [TX("STATEK"), s.name ? [s.name, s.type, s.flag ? TX(s.flag) : null, s.imo ? "IMO " + s.imo : null].filter(Boolean).join(" · ") : null],
    [TX("ŹRÓDŁA"), A(r.reports).map(x => esc(x.name)).join(", ") + (A(r.reports).length > 1 ? " – " + TX("połączone w jedno zdarzenie") : ""), 1]]);
  h += A(r.reports).map(x => `<details class="ms-rep"><summary>${esc(x.name)} · ${esc(x.ref || "")}${x.t ? " · " + new Date(x.t).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""}</summary><pre>${esc0(x.text || x.title || "")}</pre>${x.url ? L(x.url, TX("otwórz źródło")) : ""}</details>`).join("");
  if (r.pos) h += evBox("mi", iid) + satBtn(r.pos[0], r.pos[1], 1.5);
  if (inReplay) h += `<p><button class="btn" data-msreplay="${r.t}">${TX("ODTWÓRZ RUCH STATKÓW I SAMOLOTÓW Z TEJ CHWILI")}</button></p>`;
  h += `<p class="hint">${ai.title ? TX("Tytuł i streszczenie: lokalne AI na podstawie oryginalnych zgłoszeń (poniżej).") : TX("Lokalne AI jeszcze nie przeanalizowało tego zgłoszenia – zrobi to w wolnej chwili.")} ${r.warn ? TX("Ostrzeżenie zniknie z mapy, gdy źródło je wycofa.") : ""}</p>`;
  setTimeout(() => { const b = $("#detail [data-msreplay]"); if (b) b.addEventListener("click", async () => { await replayOpen(); if (REPLAY.on) replayFetch(Math.max(REPLAY.from, Math.min(REPLAY.to, +b.dataset.msreplay))); }); }, 0);
  return h;
}
$$("#msDays [data-d]").forEach(b => b.addEventListener("click", () => { MSF.days = +b.dataset.d; store.set("msflt", MSF); renderMS(); needDraw = true; }));
$("#msWarn").addEventListener("click", () => { MSF.warn = MSF.warn ? 0 : 1; store.set("msflt", MSF); renderMS(); needDraw = true; });
$("#msAll").addEventListener("click", () => { MSF.all = MSF.all ? 0 : 1; store.set("msflt", MSF); renderMS(); needDraw = true; });
setInterval(() => { if (!document.hidden) pollMS(); }, 5 * 60e3);

/* --- filtry warstw */
function renderFilterCounts() {
  if ($("#filtModal").hidden) return; const sc = {}, ac = {};
  if (SEA.catn) SCATS.forEach((c, i) => sc[c] = SEA.catn[i] || 0); else for (const w of SHIPS.values()) { const c = SCATS[w[5]] || "other"; sc[c] = (sc[c] || 0) + 1; }
  A(AIR.d && AIR.d.ac).forEach(a => ac[a.cat] = (ac[a.cat] || 0) + 1);
  $$("#filtModal [data-fs]").forEach(i => { const em = i.parentNode.querySelector("em"); if (em) em.textContent = (sc[i.dataset.fs] || 0).toLocaleString(LOC); });
  $$("#filtModal [data-fa]").forEach(i => { const em = i.parentNode.querySelector("em"); if (em) em.textContent = ac[i.dataset.fa] || 0; });
}
function openFilters() {
  const S2 = SCATS.map(c => `<label class="chk"><input type="checkbox" data-fs="${c}"${FLT.ship[c] ? " checked" : ""}><i style="background:${cssv(SCOL[c])}"></i>${esc(SCN[c] || c)}<em></em></label>`).join("");
  const A2 = Object.keys(FLT.air).map(c => `<label class="chk"><input type="checkbox" data-fa="${c}"${FLT.air[c] ? " checked" : ""}><i style="background:${cssv(ACOL[c])}"></i>${esc(ACN[c] || c)}<em></em></label>`).join("");
  $("#filtShips").innerHTML = S2 + `<label class="chk"><input type="checkbox" data-fo="shipOld"${FLT.shipOld ? " checked" : ""}>${TX("Pokaż pozycje starsze niż 1 h (wyblakłe)")}</label><label class="chk"><input type="checkbox" data-fo="shipNames"${FLT.shipNames ? " checked" : ""}>${TX("Nazwy statków po przybliżeniu")}</label><label class="chk"><input type="checkbox" data-fo="cluster"${FLT.cluster !== 0 ? " checked" : ""}>${TX("Przy oddaleniu grupuj statki w kratki z liczbą (szybciej; okręty, straż i statki z listy obserwacji zawsze osobno)")}</label>`
    + `<label class="chk"><input type="checkbox" data-fo="watch"${FLT.watch ? " checked" : ""}>${TX("Wyróżniaj: sankcje (czerwony), milczące AIS (bursztyn), nad kablem (fiolet), STS")}</label><label class="chk"><input type="checkbox" data-fo="suspect"${FLT.suspect ? " checked" : ""}>${TX("Tylko podejrzane statki (oraz okręty i straż)")}</label>`;
  $("#filtAir").innerHTML = A2 + `<label class="chk"><input type="checkbox" data-fo="airTrails"${FLT.airTrails ? " checked" : ""}>${TX("Trasy rozpoznania, tankowców i bombowców")}</label><label class="chk"><input type="checkbox" data-fo="airNames"${FLT.airNames ? " checked" : ""}>${TX("Znaki wywoławcze")}</label>`;
  $$("#filtModal input").forEach(i => i.addEventListener("change", () => {
    if (i.dataset.fs) FLT.ship[i.dataset.fs] = i.checked ? 1 : 0; else if (i.dataset.fa) FLT.air[i.dataset.fa] = i.checked ? 1 : 0; else FLT[i.dataset.fo] = i.checked ? 1 : 0;
    saveFlt(); markStatic(); if (i.dataset.fo === "cluster" || i.dataset.fo === "shipOld") pollSea(); }));
  $("#filtModal").hidden = false; renderFilterCounts();
}
$("#filtBtn").addEventListener("click", openFilters);
$("#filtClose").addEventListener("click", () => { $("#filtModal").hidden = true; });
$("#filtModal").addEventListener("click", e => { if (e.target.id === "filtModal") $("#filtModal").hidden = true; });
$$("#filtModal [data-fall]").forEach(b => b.addEventListener("click", () => { const [grp, v] = b.dataset.fall.split(":"); Object.keys(FLT[grp]).forEach(k2 => FLT[grp][k2] = +v); saveFlt(); openFilters(); markStatic(); }));

/* ------------------------------------------------------------ WYBÓR SATELITÓW (katalog CelesTrak) */
let SATCAT = null;
const GCOL = { stations: "var(--white)", military: "var(--red)", analyst: "var(--violet)", gnss: "var(--amber)", weather: "var(--cyan)", earth: "var(--khaki)",
  comms: "#9fd3ff", amateur: "var(--phos)", science: "#ffd6a8", starlink: "#5e8f74", oneweb: "#6f88a8", kuiper: "#a88f6f", china_mega: "#c76f6f", iridium: "#8a8a8a", all: "#4c6a58" };
const saveSatSel = () => store.set("satsel", SATSEL);
let SATW = null; try { SATW = new Worker("satworker.js"); SATW.onmessage = e => { if (e.data.t === "pos") { Object.entries(e.data.out).forEach(([id, a]) => { if (SATG[id]) SATG[id].pos = a; }); markStatic(); } else if (e.data.t === "passes") onPasses(e.data); }; } catch (e) { SATW = null; }
async function loadSatGroup(id) {
  if (SATG[id] && SATG[id].names) return SATG[id];
  const d = await api("/api/sats/group/" + id), names = [], norad = [], tle = [];
  A(d.sats).forEach(t => { names.push(t[0]); norad.push(t[1]); tle.push([t[2], t[3]]); });
  SATG[id] = { names, norad, tle, pos: null };
  if (SATW) SATW.postMessage({ t: "set", id, tle });
  return SATG[id];
}
async function loadPins() {
  if (!SATSEL.pins.length) { SATPIN = []; return; }
  try { SATPIN = A((await api("/api/sats/tle?ids=" + SATSEL.pins.join(","))).sats); SATPIN.forEach(t => SATX[t[1]] = { name: t[0], l1: t[2], l2: t[3] }); } catch (e) {}
}
function satCloud() { if (SATW && SATSEL.groups.length) SATW.postMessage({ t: "calc", ids: SATSEL.groups.filter(id => SATG[id]) }); }
const SATX = {};   // TLE pojedynczych satelitów (lista przelotów, przypięte)
function satByNorad(n) {
  if (SATX[n] && !Object.values(SATG).some(g => g.norad && g.norad.includes(n))) { const x = SATX[n], r = { name: x.name, norad: n, l1: x.l1 };
    try { r.rec = satellite.twoline2satrec(x.l1, x.l2); const pv = satellite.propagate(r.rec, new Date()), gd = satellite.eciToGeodetic(pv.position, satellite.gstime(new Date()));
      r.last = { lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude), alt: gd.height }; } catch (e) { return null; } return r; }
  for (const [id, g] of Object.entries(SATG)) { const i = g.norad ? g.norad.indexOf(n) : -1;
    if (i >= 0) { const r = { name: g.names[i], norad: n, l1: g.tle[i][0], grp: id }; try { r.rec = satellite.twoline2satrec(g.tle[i][0], g.tle[i][1]); } catch (e) { return null; }
      if (g.pos) r.last = { lat: g.pos[i * 3], lon: g.pos[i * 3 + 1], alt: g.pos[i * 3 + 2] }; return r; } }
  return null;
}
function renderSatSum() {
  const g = SATSEL.groups.map(id => TX(SATCAT && (SATCAT.groups.find(x => x.id === id) || {}).label || id).split(" (")[0]);
  const n = Object.entries(SATG).filter(([id]) => SATSEL.groups.includes(id)).reduce((a, [, x]) => a + x.names.length, 0);
  $("#satSum").textContent = (SATSEL.base ? TX("Podstawowe") : "") + (g.length ? (SATSEL.base ? " + " : "") + g.join(", ") + ` (${n.toLocaleString(LOC)})` : "") + (SATPIN.length ? ` ${TX("· przypięte:")} ${SATPIN.length}` : "") || TX("Brak satelitów na mapie");
}
async function applySats() {
  for (const id of SATSEL.groups) { try { await loadSatGroup(id); } catch (e) {} }
  await loadPins(); initSats(); drawSats(); satCloud(); renderSatSum(); markStatic(); computePasses();
}
let SATCLICK = null;
const SATINF = {}, SATINF_LOAD = {};
const fmtMHz = hz => hz ? (hz / 1e6).toFixed(hz % 1000 ? 4 : 3) : "–";
async function loadSatInfo(norad) {
  if (SATINF_LOAD[norad]) return; SATINF_LOAD[norad] = true;
  try { SATINF[norad] = await api("/api/sats/info/" + norad); } catch (e) { SATINF[norad] = { error: true }; }
  SATINF_LOAD[norad] = false; if (PASS.single["s" + norad]) setTimeout(() => renderSinglePasses(norad), 50);
  if (selected === "sc:" + norad || (selected && selected.startsWith("s:") && satrecs[+selected.slice(2)] && satrecs[+selected.slice(2)].norad === norad)) pick(selected, true);
}
function satCard(r, silent) {
  const inf = r.rec ? satInfo(r) : {}, I = SATINF[r.norad];
  if (!I && r.norad) loadSatInfo(r.norad);
  const grp = I ? A(I.groups).map(id => TX(SATCAT && (SATCAT.groups.find(x => x.id === id) || {}).label || id).split(" (")[0]).join(", ") : "";
  const col = GCOL[(I && A(I.groups)[0]) || r.grp] || "var(--cyan)";
  const orbit = [inf.orbit, I && I.apogee ? `${TX("apogeum")} ${Math.round(I.apogee)} km · ${TX("perygeum")} ${Math.round(I.perigee)} km` : ""].filter(Boolean).join(" · ");
  let h = chip(TX("SATELITA") + (I && I.otype ? " · " + esc(I.otype).toUpperCase() : ""), col) + `<h2 class="glow">${esc(r.name)}</h2>`;
  if (I && I.role) h += `<p class="sat-role">${esc(I.role)}</p>`;
  h += dd([[TX("GRUPA"), grp], [TX("WŁAŚCICIEL"), I && (I.owner || I.countries)], [TX("OPERATOR"), I && I.operator],
    [TX("STATUS"), I && [I.ops, I.status].filter(Boolean).join(" · ")], [TX("START"), I && [I.launch || I.launched, I.site].filter(Boolean).join(" · ")],
    [TX("OZNACZENIE"), I && I.intl], [TX("INNE NAZWY"), I && I.alt_names],
    [TX("POZYCJA"), r.last ? fmtLL(r.last.lat, r.last.lon) : null], [TX("WYSOKOŚĆ"), inf.alt != null ? inf.alt + " km" : null], [TX("ORBITA"), orbit],
    [TX("OKRES OBIEGU"), inf.per ? Math.round(inf.per) + " min" : null], [TX("INKLINACJA"), inf.inc != null ? inf.inc.toFixed(1) + "°" : null], [TX("NORAD"), r.norad]]);
  if (!I) h += `<p class="hint">${TX("Pobieram dane o satelicie…")}</p>`;
  if (I && I.wiki) h += `<div class="sat-wiki">${I.wiki.img ? `<img src="${esc(I.wiki.img)}" alt="" loading="lazy">` : ""}<p>${esc(I.wiki.text)}</p><p class="hint">${L(I.wiki.url, "Wikipedia" + (I.wiki.lang === "en" && LANG !== "en" ? " (EN)" : ""))}</p></div>`;
  const tx = I ? A(I.tx) : [];
  if (tx.length) h += `<p class="sat-h">${TX("CZĘSTOTLIWOŚCI")} · SatNOGS</p><div class="txtab"><table><thead><tr><th>${TX("Nadajnik")}</th><th>↓ MHz</th><th>↑ MHz</th><th>${TX("Emisja")}</th><th>Bd</th><th></th></tr></thead><tbody>` +
    tx.map(x => `<tr class="${x.alive ? "" : "dead"}"><td>${esc(x.desc || x.type || "")}</td><td>${fmtMHz(x.down)}${x.down_hi ? "–" + fmtMHz(x.down_hi) : ""}</td><td>${fmtMHz(x.up)}</td><td>${esc(x.mode || "")}${x.invert ? " inv" : ""}</td><td>${x.baud ? Math.round(x.baud) : ""}</td><td>${x.alive ? "●" : "✕"}</td></tr>`).join("") + `</tbody></table></div>` +
    (I.freq_violator ? `<p class="hint red">${TX("SatNOGS oznacza ten satelitę jako naruszającego przydział częstotliwości.")}</p>` : "");
  else if (I && !I.error) h += `<p class="hint">${TX("Brak znanych częstotliwości w bazie SatNOGS (satelity wojskowe zwykle ich nie ujawniają).")}</p>`;
  const links = [L("https://www.n2yo.com/satellite/?s=" + r.norad, "n2yo"), L("https://db.satnogs.org/search/?q=" + r.norad, "SatNOGS"), I && I.website ? L(I.website, TX("strona misji")) : ""].filter(Boolean).join(" · ");
  h += `<p class="hint">${links}${I && I.partial ? " · " + TX("część serwisów nie odpowiedziała – dane uzupełnią się później") : ""}</p>`;
  h += `<div class="dbtns"><button class="btn" data-satpin="${r.norad}">${SATSEL.pins.includes(r.norad) ? TX("PRZYPIĘTY") : TX("PRZYPNIJ (TRASA I NAZWA)")}</button><button class="btn" data-satai="${r.norad}">${TX("WYJAŚNIJ (AI)")}</button><button class="btn" data-satpass="${r.norad}">${TX("PRZELOTY NAD QTH")}</button></div><div class="sat-ai" id="satAI" hidden></div><div id="satPassBox"></div>`;
  return h;
}
document.addEventListener("click", async e => {
  const p = e.target.closest("[data-satpin]"), a = e.target.closest("[data-satai]");
  if (p) { const n = +p.dataset.satpin; if (!SATSEL.pins.includes(n)) { SATSEL.pins.push(n); saveSatSel(); await applySats(); } p.textContent = TX("PRZYPIĘTY"); }
  if (a) { const el = $("#satAI"); el.hidden = false; streamTo("/api/sats/explain", { norad: +a.dataset.satai }, el); }
});

function satInfo(r) {
  const l1 = r.l1 || "", l2 = r.rec, mm = r.rec.no * 1440 / (2 * Math.PI), per = 1440 / mm, inc = r.rec.inclo * 180 / Math.PI, alt = r.last ? Math.round(r.last.alt) : null;
  const yy = +l1.slice(9, 11), year = isNaN(yy) ? null : (yy < 57 ? 2000 + yy : 1900 + yy);
  const orbit = alt == null ? "" : alt > 34000 && alt < 37000 ? TX("geostacjonarna (GEO)") : alt > 2000 && alt < 34000 ? TX("średnia (MEO)") : r.rec.ecco > .25 ? TX("eliptyczna (HEO)") : TX("niska (LEO)");
  return { per, inc, alt, year, orbit };
}
async function openSatModal() {
  $("#satModal").hidden = false; $("#satBase").checked = SATSEL.base; $("#satQ").focus(); renderPins();
  try { SATCAT = await api("/api/sats/groups"); } catch (e) { SATCAT = null; }
  $("#satGroups").innerHTML = SATCAT && SATCAT.groups.some(g => g.n) ? SATCAT.groups.map(g => `<label class="chk"><input type="checkbox" data-sg="${g.id}"${SATSEL.groups.includes(g.id) ? " checked" : ""}><i style="background:${GCOL[g.id]}"></i>${esc(TX(g.label))}<em>${g.n}</em></label>`).join("")
    : `<p class="empty">${TX("Nie udało się pobrać katalogu z CelesTrak")}${SATCAT && SATCAT.err ? " (" + esc(SATCAT.err) + ")" : ""}${TX(". Spróbuj później.")}</p>`;
  $("#satGroups").querySelectorAll("[data-sg]").forEach(c => c.addEventListener("change", async () => {
    const id = c.dataset.sg; SATSEL.groups = SATSEL.groups.filter(x => x !== id); if (c.checked) SATSEL.groups.push(id); saveSatSel();
    if (c.checked && (id === "all" || id === "starlink")) $("#satSum").textContent = TX("Wczytywanie") + " " + id + "…";
    await applySats(); ensureLayer("sat");
  }));
}
function renderPins() {
  $("#satPins").innerHTML = SATPIN.length ? SATPIN.map(p => `<li><button data-unpin="${p[1]}"><span class="t">${esc(p[0])}</span><span class="dim">${TX("ODEPNIJ")}</span><span class="sub">${TX("NORAD")} ${p[1]}</span></button></li>`).join("") : ("<li class=\"empty\">" + TX("Nic nie przypięto.") + "</li>");
  $("#satPins").querySelectorAll("[data-unpin]").forEach(b => b.addEventListener("click", async () => { SATSEL.pins = SATSEL.pins.filter(x => x !== +b.dataset.unpin); saveSatSel(); await applySats(); renderPins(); }));
}
let satQT = null;
$("#satQ").addEventListener("input", () => { clearTimeout(satQT); satQT = setTimeout(async () => {
  const q = $("#satQ").value.trim(); if (q.length < 2) { $("#satRes").innerHTML = ""; return; }
  $("#satRes").innerHTML = ("<li class=\"empty\">" + TX("Szukam…") + "</li>");
  let r = []; try { r = A((await api("/api/sats/search?q=" + encodeURIComponent(q))).results); } catch (e) {}
  const lab = id => TX(SATCAT && (SATCAT.groups.find(x => x.id === id) || {}).label || id).split(" (")[0].split(" i ")[0];
  $("#satRes").innerHTML = r.length ? r.map(x => `<li><button data-pin="${x.id}"><span class="t">${esc(x.name)}</span><span class="${SATSEL.pins.includes(x.id) ? "dim" : ""}">${SATSEL.pins.includes(x.id) ? TX("PRZYPIĘTY") : TX("PRZYPNIJ")}</span><span class="sub">${TX("NORAD")} ${x.id}${x.groups.length ? " · " + x.groups.map(lab).join(", ") : ""}</span></button></li>`).join("") : ("<li class=\"empty\">" + TX("Brak wyników.") + "</li>");
  $("#satRes").querySelectorAll("[data-pin]").forEach(b => b.addEventListener("click", async () => {
    const id = +b.dataset.pin; if (!SATSEL.pins.includes(id)) { SATSEL.pins.push(id); saveSatSel(); } b.querySelector("span:nth-child(2)").textContent = TX("PRZYPIĘTY");
    await applySats(); renderPins(); ensureLayer("sat"); }));
}, 250); });
$("#satBase").addEventListener("change", async () => { SATSEL.base = $("#satBase").checked; saveSatSel(); await applySats(); });
[$("#satBtn"), $("#satBtn2")].forEach(b => b.addEventListener("click", openSatModal));
$("#satClose").addEventListener("click", () => { $("#satModal").hidden = true; });
$("#satModal").addEventListener("click", e => { if (e.target.id === "satModal") $("#satModal").hidden = true; });

/* ------------------------------------------------------------ PRZELOTY NAD QTH */
const PCFG = Object.assign({ iss: 1, css: 1, amateur: 0, minEl: 10, alarm: 5, sound: 1 }, store.get("passcfg", {}));
const PASS = { list: [], at: 0, alarmed: {}, single: {} };
function qth() { const q = SET && SET.qth; return q && q.lat != null ? q : { lat: 51.07, lon: -1.79, loc: "IO91", def: true }; }
function maidenhead(lat, lon) { lon += 180; lat += 90; const A_ = "ABCDEFGHIJKLMNOPQR", a = "abcdefghijklmnopqrstuvwx";
  return A_[Math.floor(lon / 20)] + A_[Math.floor(lat / 10)] + Math.floor(lon % 20 / 2) + Math.floor(lat % 10) + a[Math.floor(lon % 2 * 12)] + a[Math.floor(lat % 1 * 24)]; }
const COMPASS = az => az == null ? "" : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(az / 45) % 8];
let passReqId = 0;
async function computePasses() {
  const ids = new Set(SATSEL.pins); if (PCFG.iss) ids.add(25544); if (PCFG.css) ids.add(48274);
  let tles = [];
  try { if (ids.size) tles = A((await api("/api/sats/tle?ids=" + [...ids].join(","))).sats); } catch (e) {}
  if (PCFG.amateur) { try { tles = tles.concat(A((await api("/api/sats/group/amateur")).sats)); } catch (e) {} }
  tles.forEach(t => SATX[t[1]] = { name: t[0], l1: t[2], l2: t[3] });
  const seen = new Set(), sats = tles.filter(t => !seen.has(t[1]) && seen.add(t[1])).map(t => ({ norad: t[1], name: t[0], l1: t[2], l2: t[3] }));
  if (!SATW || !sats.length) { PASS.list = []; renderPasses(); return; }
  SATW.postMessage({ t: "passes", id: "list" + (++passReqId), qth: qth(), sats, hours: 24, minEl: PCFG.minEl });
}
function onPasses(d) {
  if (String(d.id).startsWith("list")) { if (d.id !== "list" + passReqId) return; PASS.list = d.passes; PASS.at = Date.now(); renderPasses(); }
  else { PASS.single[d.id] = d.passes; renderSinglePasses(+String(d.id).slice(1)); }
}
const hm = t => new Date(t).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
const cd = ms => ms <= 0 ? TX("TERAZ") : ms < 3600e3 ? Math.ceil(ms / 60e3) + " min" : Math.floor(ms / 3600e3) + " h " + Math.round(ms % 3600e3 / 60e3) + " min";
function renderPasses() {
  const q = qth(), now = Date.now(), list = PASS.list.filter(p => p.los > now).slice(0, 25);
  $("#passQth").textContent = (q.loc || maidenhead(q.lat, q.lon).slice(0, 6)) + (q.def ? " · " + TX("domyślne") : "");
  let h = `<li class="hd">${TX("Najbliższe przeloty (24 h, elewacja ≥")} ${PCFG.minEl}°)</li>`;
  h += list.length ? list.map(p => { const now2 = p.aos <= now;
    return `<li${now2 ? ' class="newrow"' : ""}><button data-pass="${p.norad}"><span class="t">${p.vis ? "👁 " : ""}${esc(p.name)}</span><span class="${now2 ? "amber" : p.aos - now < 15 * 60e3 ? "amber" : "dim"}">${now2 ? TX("NAD HORYZONTEM") : cd(p.aos - now)}</span>
      <span class="sub">${hm(p.aos)}–${hm(p.los)} · max ${p.maxEl}° ${COMPASS(p.azMax)} · ${COMPASS(p.azAos)} → ${COMPASS(p.azLos)} · ${Math.round((p.los - p.aos) / 60e3)} min${p.vis ? " · " + TX("widoczny gołym okiem") : ""}</span></button></li>`; }).join("")
    : `<li class="empty">${TX("Brak przelotów – dodaj satelity (PRZYPNIJ) albo zmień próg elewacji.")}</li>`;
  rowsInto("#passes", h);
  $$("#passes [data-pass]").forEach(b => b.addEventListener("click", () => { const n = +b.dataset.pass, r = satByNorad(n); if (r) { SATCLICK = r; go("sc:" + n); } }));
}
function passAlarms() {
  const now = Date.now();
  PASS.list.forEach(p => { const k = p.norad + ":" + p.aos;
    if (PCFG.alarm && !PASS.alarmed[k] && p.aos > now && p.aos - now <= PCFG.alarm * 60e3) { PASS.alarmed[k] = 1;
      const msg = `${p.name}: ${TX("przelot za")} ${cd(p.aos - now)} · ${hm(p.aos)}–${hm(p.los)} · max ${p.maxEl}° ${COMPASS(p.azMax)}${p.vis ? " · " + TX("widoczny gołym okiem") : ""}`;
      airToast({ at: now, msg, go: "sc:" + p.norad, kind: "pass" }); if (PCFG.sound) sndEvent("pass", () => sfxRaw("contact"));
      api("/api/notify", { kind: "pass", text: "🛰 " + msg }).catch(() => {}); } });
}
setInterval(() => { if (PASS.list.length) { renderPasses(); passAlarms(); } }, 30000);
setInterval(() => { if (Date.now() - PASS.at > 30 * 60e3) computePasses(); }, 60000);
function renderSinglePasses(norad) {
  const box = $("#satPassBox"); if (!box) return; const list = A(PASS.single["s" + norad]).slice(0, 8), I = SATINF[norad], now = Date.now();
  const tx = I ? A(I.tx).filter(x => x.down && x.alive).slice(0, 4) : [], dop = (f, rr) => -f * rr / 299792.458;
  box.innerHTML = `<p class="sat-h">${TX("PRZELOTY NAD QTH")} ${esc(qth().loc || maidenhead(qth().lat, qth().lon).slice(0, 6))} · 24 h</p>` + (list.length ? `<div class="txtab"><table><thead><tr><th>AOS</th><th>LOS</th><th>max</th><th>az</th><th></th></tr></thead><tbody>` +
    list.map(p => `<tr><td>${hm(p.aos)}${p.aos > now ? " (" + cd(p.aos - now) + ")" : ""}</td><td>${hm(p.los)}</td><td>${p.maxEl}°</td><td>${COMPASS(p.azAos)}→${COMPASS(p.azMax)}→${COMPASS(p.azLos)}</td><td>${p.vis ? "👁" : ""}</td></tr>` +
      (tx.length ? `<tr><td colspan="5" class="dop">Doppler: ${tx.map(x => `${fmtMHz(x.down)} ${dop(x.down, p.rrAos) >= 0 ? "+" : ""}${(dop(x.down, p.rrAos) / 1000).toFixed(1)} → ${(dop(x.down, p.rrLos) / 1000).toFixed(1)} kHz`).join(" · ")}</td></tr>` : "")).join("") + `</tbody></table></div>`
    : `<p class="hint">${TX("Brak przelotów nad Twoim QTH w ciągu 24 h (albo satelita jest na orbicie geostacjonarnej).")}</p>`);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-satpass]"); if (!b) return; const n = +b.dataset.satpass, r = satByNorad(n) || (SATCLICK && SATCLICK.norad === n ? SATCLICK : null);
  const tle = SATX[n] || (r && r.l1 && Object.values(SATG).map(g => g.norad ? g.tle[g.norad.indexOf(n)] : null).find(Boolean));
  const l = SATX[n] ? [SATX[n].l1, SATX[n].l2] : tle; if (!l || !SATW) return;
  $("#satPassBox").innerHTML = `<p class="hint">${TX("Liczę przeloty…")}</p>`;
  SATW.postMessage({ t: "passes", id: "s" + n, qth: qth(), sats: [{ norad: n, name: r ? r.name : "", l1: l[0], l2: l[1] }], hours: 24, minEl: 0 }); });
function openPassCfg() {
  const c = $("#passCfg"); c.hidden = !c.hidden; if (c.hidden) return;
  c.innerHTML = `<label class="chk"><input type="checkbox" data-pc="iss"${PCFG.iss ? " checked" : ""}> ISS</label><label class="chk"><input type="checkbox" data-pc="css"${PCFG.css ? " checked" : ""}> Tiangong</label>
    <label class="chk"><input type="checkbox" data-pc="amateur"${PCFG.amateur ? " checked" : ""}> ${TX("Wszystkie krótkofalarskie")}</label><label class="chk"><input type="checkbox" data-pc="sound"${PCFG.sound ? " checked" : ""}> ${TX("Dźwięk przy alarmie")}</label>
    <label>${TX("Min. elewacja")} <select data-pn="minEl">${[0, 5, 10, 20, 30].map(v => `<option${v === PCFG.minEl ? " selected" : ""}>${v}</option>`).join("")}</select>°</label>
    <label>${TX("Alarm przed przelotem")} <select data-pn="alarm">${[0, 2, 5, 10, 15].map(v => `<option value="${v}"${v === PCFG.alarm ? " selected" : ""}>${v ? v + " min" : TX("wyłączony")}</option>`).join("")}</select></label>
    <p class="hint">${TX("Na liście są też wszystkie przypięte satelity. QTH ustawiasz w oknie OPERATOR.")}</p>`;
  c.querySelectorAll("[data-pc]").forEach(i => i.addEventListener("change", () => { PCFG[i.dataset.pc] = i.checked ? 1 : 0; store.set("passcfg", PCFG); computePasses(); }));
  c.querySelectorAll("[data-pn]").forEach(i => i.addEventListener("change", () => { PCFG[i.dataset.pn] = +i.value; store.set("passcfg", PCFG); computePasses(); }));
}
$("#passCfgBtn").addEventListener("click", openPassCfg);

/* ------------------------------------------------------------ UKŁAD EKRANU */
const LAY = Object.assign({ w: "full", scale: 100, map: 74, auto: true }, store.get("layout", {}));
function applyLayout() {
  const R = document.documentElement.style;
  R.setProperty("--scale", LAY.scale / 100);
  R.setProperty("--wrapmax", LAY.w === "center" ? "1500px" : LAY.w === "narrow" ? "1100px" : "none");
  if (LAY.auto) R.removeProperty("--maph"); else R.setProperty("--maph", `max(220px, ${LAY.map}vh)`);
  $$("#layWidth [data-w]").forEach(b => b.setAttribute("aria-pressed", b.dataset.w === LAY.w));
  $("#layScale").value = LAY.scale; $("#layScaleV").textContent = LAY.scale + "%"; $("#layMap").value = LAY.map; $("#layMapV").textContent = LAY.auto ? "automatyczna" : LAY.map + TX("% wysokości okna");
  $("#layMap").disabled = LAY.auto; $("#layAuto").checked = LAY.auto; store.set("layout", LAY);
}
$$("#layWidth [data-w]").forEach(b => b.addEventListener("click", () => { LAY.w = b.dataset.w; applyLayout(); }));
$("#layScale").addEventListener("input", e => { LAY.scale = +e.target.value; applyLayout(); });
$("#layMap").addEventListener("input", e => { LAY.map = +e.target.value; applyLayout(); });
$("#layAuto").addEventListener("change", e => { LAY.auto = e.target.checked; applyLayout(); });
$("#layReset").addEventListener("click", () => { Object.assign(LAY, { w: "full", scale: 100, map: 74, auto: true }); applyLayout(); });
$("#layoutBtn").addEventListener("click", () => { $("#layoutModal").hidden = false; $("#layClose").focus(); });
$("#layClose").addEventListener("click", () => { $("#layoutModal").hidden = true; });
$("#layoutModal").addEventListener("click", e => { if (e.target.id === "layoutModal") $("#layoutModal").hidden = true; });
function toggleFs() { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }
$("#fsBtn").addEventListener("click", toggleFs); $("#layFs").addEventListener("click", toggleFs);
document.addEventListener("fullscreenchange", () => $("#fsBtn").setAttribute("aria-pressed", !!document.fullscreenElement));
document.addEventListener("keydown", e => { if (e.key === "Escape") { $("#layoutModal").hidden = true; $("#satModal").hidden = true; } });
applyLayout();

/* ------------------------------------------------------------ ODPINANE PANELE (osobne okna, np. na drugi monitor) */
const slug = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PANELS = { status: $("#rail") }, DETACHED = new Set(), ALIVE = {}, WINS = {};
$$(".wrap section.frame").forEach(sec => {
  const h = sec.querySelector(":scope > .frame-h"); if (!h) return;
  const main = sec.classList.contains("mainview"), name = main ? TX("MAPA") : ((h.querySelector("span") || {}).textContent || "").replace(/^>\s*/, "").trim(); if (!name) return;
  const id = sec.dataset.panel || (main ? "mapa" : slug(name)); if (PANELS[id]) return;
  sec.dataset.panel = id; sec.dataset.pname = name; PANELS[id] = sec;
  if (!SOLO) h.insertAdjacentHTML("beforeend", `<button class="btn detach" data-detach="${id}" title="Odepnij do osobnego okna (np. na drugi monitor)">⧉</button>`);
});
const mapHidden = () => SOLO ? SOLO !== "mapa" : DETACHED.has("mapa");
function markDetached(id, on) {
  const sec = PANELS[id]; if (!sec || DETACHED.has(id) === on) return;
  on ? DETACHED.add(id) : DETACHED.delete(id); sec.classList.toggle("detached", on);
  const h = sec.querySelector(":scope > .frame-h");
  if (h) { h.querySelectorAll(".reattach").forEach(b => b.remove());
    if (on) h.insertAdjacentHTML("beforeend", `<button class="btn reattach" data-show="${id}">${TX("POKAŻ OKNO")}</button><button class="btn reattach" data-attach="${id}">${TX("PRZYPNIJ")}</button>`); }
  if (id === "mapa" && !on) setTimeout(() => { sizeMap(); redraw(); }, 50);
}
async function detach(id) {
  const sec = PANELS[id]; if (!sec) return; sfx("click");
  const r = sec.getBoundingClientRect();
  let feat = `popup=yes,width=${Math.round(Math.max(520, r.width))},height=${Math.round(Math.min(screen.availHeight - 60, Math.max(380, id === "mapa" ? innerHeight * .9 : r.height + 50)))}`;
  try { if ("getScreenDetails" in window) { const sd = await window.getScreenDetails(), o = sd.screens.find(x => x !== sd.currentScreen);
    if (o) feat = `popup=yes,left=${o.availLeft},top=${o.availTop},width=${o.availWidth},height=${o.availHeight}`; } } catch (e) {}
  const w = window.open("/?panel=" + encodeURIComponent(id), "kronos7-" + id, feat);
  if (!w) { $("#foot").textContent = TX("Przeglądarka zablokowała nowe okno. Kliknij ⧉ jeszcze raz albo zezwól na wyskakujące okna dla 127.0.0.1."); $("#foot").scrollIntoView({ block: "center" }); return; }
  WINS[id] = w; ALIVE[id] = Date.now(); markDetached(id, true);
}
document.addEventListener("click", e => {
  const d = e.target.closest("[data-detach]"), a = e.target.closest("[data-attach]"), sh = e.target.closest("[data-show]");
  if (d) { e.stopPropagation(); detach(d.dataset.detach); }
  else if (a) { e.stopPropagation(); if (BC) BC.postMessage({ t: "close", id: a.dataset.attach }); try { WINS[a.dataset.attach] && WINS[a.dataset.attach].close(); } catch (er) {} markDetached(a.dataset.attach, false); }
  else if (sh) { e.stopPropagation(); const w = WINS[sh.dataset.show]; if (w && !w.closed) w.focus(); else if (BC) BC.postMessage({ t: "focus", id: sh.dataset.show }); }
  else if (!SOLO && e.target.closest(".rail.detached")) { if (BC) BC.postMessage({ t: "close", id: "status" }); markDetached("status", false); }
});
if (BC) BC.onmessage = ev => {
  const m = ev.data || {};
  if (m.t === "go" && !mapHidden()) { go.remote = true; try { go(m.id); } finally { go.remote = false; } return; }
  if (SOLO) { if (m.id === SOLO && m.t === "close") window.close(); if (m.id === SOLO && m.t === "focus") window.focus(); return; }
  if (m.t === "hello") { ALIVE[m.id] = Date.now(); markDetached(m.id, true); }
  if (m.t === "bye") { delete ALIVE[m.id]; markDetached(m.id, false); }
};
if (!SOLO) setInterval(() => { DETACHED.forEach(id => { if (Date.now() - (ALIVE[id] || 0) > 8000 && !(WINS[id] && !WINS[id].closed)) markDetached(id, false); }); }, 3000);
if (SOLO) {
  const sec = PANELS[SOLO];
  if (sec) {
    document.body.classList.add("solo"); sec.classList.add("solo-target"); document.body.appendChild(sec);
    document.title = TX("KRONOS-7 ·") + " " + (sec.dataset.pname || SOLO);
    document.body.insertAdjacentHTML("afterbegin", `<div class="solo-bar"><span>${TX("KRONOS-7 ·")} <b>${esc(sec.dataset.pname || SOLO)}</b></span><span><span id="soloClock"></span> <button class="btn" id="soloFs">${TX("PEŁNY EKRAN")}</button> <button class="btn" id="soloBack">${TX("PRZYPNIJ Z POWROTEM")}</button></span></div>`);
    setInterval(() => { $("#soloClock").textContent = new Date().toISOString().slice(11, 19) + " " + TX("UTC") + "  "; }, 1000);
    $("#soloBack").addEventListener("click", () => { if (BC) BC.postMessage({ t: "bye", id: SOLO }); window.close(); });
    $("#soloFs").addEventListener("click", () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));
    const hello = () => BC && BC.postMessage({ t: "hello", id: SOLO }); hello(); setInterval(hello, 2000);
    addEventListener("pagehide", () => BC && BC.postMessage({ t: "bye", id: SOLO }));
  }
}

/* ------------------------------------------------------------ ŁAŃCUCH PRZYCZYN */
const csvg = d3.select("#chain"), CW = 960, CH = 560;
csvg.append("defs").append("marker").attr("id", "arr").attr("viewBox", "0 -4 8 8").attr("refX", 8).attr("refY", 0)
  .attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto").append("path").attr("d", "M0,-4L8,0L0,4").style("fill", "var(--phos-dim)");
const gE = csvg.append("g"), gEL = csvg.append("g"), gN = csvg.append("g");
const NCOL = { conflict: "var(--red)", event: "var(--amber)", market: "var(--cyan)", policy: "var(--violet)", social: "var(--khaki)", nature: "var(--phos)" };
let sim = null, CN = [], CE = [];
function rectPt(a, b) { const dx = a.x - b.x, dy = a.y - b.y, hw = b.w / 2 + 3, hh = 16; const s = Math.min(Math.abs(hw / (dx || 1e-6)), Math.abs(hh / (dy || 1e-6))); return [b.x + dx * s, b.y + dy * s]; }
function buildChain() {
  const ch = S.chain;
  gE.selectAll("*").remove(); gEL.selectAll("*").remove(); gN.selectAll("*").remove();
  if (!ch || !A(ch.nodes).length) return;
  CN = ch.nodes.map(n => Object.assign({}, n, { w: Math.max(70, n.label.length * 7.6 + 18) }));
  const ids = new Set(CN.map(n => n.id));
  CE = A(ch.edges).filter(e => ids.has(e.from) && ids.has(e.to)).map(e => ({ source: e.from, target: e.to, label: e.label }));
  if (sim) sim.stop();
  sim = d3.forceSimulation(CN).force("link", d3.forceLink(CE).id(d => d.id).distance(150).strength(.6)).force("charge", d3.forceManyBody().strength(-650))
    .force("x", d3.forceX(CW / 2).strength(.05)).force("y", d3.forceY(CH / 2).strength(.08)).force("collide", d3.forceCollide().radius(d => d.w / 2 + 10)).stop();
  const indeg = {}; CE.forEach(e => indeg[e.target.id] = (indeg[e.target.id] || 0) + 1);
  CN.forEach((n, i) => { n.x = indeg[n.id] ? CW * .6 + (i % 3) * 40 : CW * .2; n.y = 60 + (i * 47) % (CH - 120); });
  for (let i = 0; i < 260; i++) sim.tick();
  const edge = gE.selectAll("path").data(CE).join("path").attr("class", "edge").attr("marker-end", "url(#arr)");
  const elbl = gEL.selectAll("text").data(CE).join("text").attr("class", "elbl").attr("text-anchor", "middle").text(d => d.label);
  const node = gN.selectAll("g").data(CN).join("g").attr("class", "node").attr("tabindex", 0).attr("role", "button").attr("aria-label", d => d.label);
  node.append("rect").attr("x", d => -d.w / 2).attr("y", -13).attr("width", d => d.w).attr("height", 26).style("stroke", d => NCOL[d.type] || "var(--phos)");
  node.append("text").attr("text-anchor", "middle").attr("y", 5).style("fill", d => NCOL[d.type] || "var(--phos)").text(d => d.label);
  node.on("click", (ev, d) => chainPick(d.id)).on("keydown", (ev, d) => { if (ev.key === "Enter") chainPick(d.id); });
  node.call(d3.drag().on("start", (ev, d) => { if (!reduce) sim.alphaTarget(.2).restart(); d.fx = d.x; d.fy = d.y; })
    .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; if (reduce) { d.x = ev.x; d.y = ev.y; tick(); } })
    .on("end", (ev, d) => { sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  function tick() {
    CN.forEach(n => { n.x = Math.max(n.w / 2 + 4, Math.min(CW - n.w / 2 - 4, n.x)); n.y = Math.max(18, Math.min(CH - 18, n.y)); });
    edge.attr("d", d => { const a = rectPt(d.target, d.source), b = rectPt(d.source, d.target); return `M${a[0]},${a[1]}L${b[0]},${b[1]}`; });
    elbl.attr("x", d => (d.source.x + d.target.x) / 2).attr("y", d => (d.source.y + d.target.y) / 2 - 4);
    node.attr("transform", d => `translate(${d.x},${d.y})`);
  }
  sim.on("tick", tick); tick();
  if (!reduce) sim.alpha(.15).restart();
}
function reach(id, dir) { const out = new Set(), st = [id];
  while (st.length) { const x = st.pop(); CE.forEach(e => { const a = dir > 0 ? e.source.id : e.target.id, b = dir > 0 ? e.target.id : e.source.id; if (a === x && !out.has(b)) { out.add(b); st.push(b); } }); }
  return out; }
function longest(id, dir, seen = new Set()) { seen.add(id); let best = [];
  CE.forEach(e => { const a = dir > 0 ? e.source.id : e.target.id, b = dir > 0 ? e.target.id : e.source.id; if (a === id && !seen.has(b)) { const p = longest(b, dir, new Set(seen)); if (p.length + 1 > best.length) best = [b].concat(p); } });
  return best; }
function chainReset() { gN.selectAll("g").classed("dim", false).classed("sel", false); gE.selectAll("path").classed("dim", false).classed("hl", false); gEL.selectAll("text").classed("dim", false).classed("hl", false); }
function chainPick(id) {
  beep(980, .04);
  const up = reach(id, -1), down = reach(id, 1), keep = new Set([id, ...up, ...down]);
  const on = d => keep.has(d.source.id) && keep.has(d.target.id);
  gN.selectAll("g").classed("dim", d => !keep.has(d.id)).classed("sel", d => d.id === id);
  gE.selectAll("path").classed("dim", d => !on(d)).classed("hl", on); gEL.selectAll("text").classed("dim", d => !on(d)).classed("hl", on);
  const n = CN.find(x => x.id === id), lab = x => (CN.find(n => n.id === x) || {}).label || x;
  const pathIds = longest(id, -1).reverse().concat([id], longest(id, 1));
  const ins = CE.filter(e => e.target.id === id), outs = CE.filter(e => e.source.id === id);
  $("#detail").innerHTML = `${chip(n.type, NCOL[n.type])}<h2 class="glow">${esc(n.label)}</h2>
  ${dd([[TX("ŚCIEŻKA"), pathIds.map(x => x === id ? `<b>${esc(lab(x))}</b>` : esc(lab(x))).join(" → "), 1],
    [TX("PRZYCZYNY"), ins.length ? ins.map(e => `${esc(e.source.label)} <span class="dim">(${esc(e.label)})</span>`).join("<br>") : TX("punkt wyjścia łańcucha"), 1],
    [TX("SKUTKI"), outs.length ? outs.map(e => `${esc(e.target.label)} <span class="dim">(${esc(e.label)})</span>`).join("<br>") : TX("brak dalszych skutków w grafie"), 1]])}
  <div class="dbtns">${n.ref ? `<button class="btn" data-open="${esc(n.ref)}">${TX("OTWÓRZ KARTĘ")}</button>` : ""}<button class="btn" id="chainReset">${TX("POKAŻ CAŁOŚĆ")}</button></div>
  <p class="hint">${TX("Graf zbudowany przez lokalne AI z bieżących depesz")}${S.chain && S.chain.at ? ", " + new Date(S.chain.at).toLocaleString(LOC) : ""}${TX(". To hipoteza analityczna, nie fakt.")}</p>`;
  const ob = $("#detail [data-open]"); if (ob) ob.addEventListener("click", () => { setView("map"); openRef(ob.dataset.open); });
  $("#chainReset").addEventListener("click", () => { chainReset(); idleDetail(); });
}
function chainFocusFor(ref) { const n = CN.find(x => x.ref === ref || x.id === ref); if (!n) return false; setView("chain"); chainPick(n.id); return true; }

let view = "map";
function setView(v) {
  view = v; $$("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === v));
  $("#map").toggleAttribute("hidden", v !== "map"); $("#chain").toggleAttribute("hidden", v !== "chain");
  $("#mapbox").classList.toggle("chainview", v === "chain");     // v3.22.2: podkłady kafelkowe (płótna) nie mogą zasłaniać łańcucha
  if (v === "map") { try { redraw(); } catch (e) {} }
  $("#chainEmpty").hidden = v !== "chain" || !!(S.chain && A(S.chain.nodes).length);
  $("#maptools").hidden = v !== "map"; $("#projBtn").hidden = v !== "map";
  $("#legendMap").hidden = v !== "map"; $("#legendChain").hidden = v !== "chain";
}
$$("[data-view]").forEach(b => b.addEventListener("click", () => { beep(640); setView(b.dataset.view); }));

/* ------------------------------------------------------------ ODCZYT */
function credHTML(i) {
  const col = (i.rel || "F") <= "B" && (i.info || 6) <= 3 ? "var(--phos)" : (i.info || 6) >= 4 ? "var(--red)" : "var(--amber)";
  return `<span class="cred" style="color:${col}"><b>${esc(i.rel || "F")}${esc(i.info || 6)}</b><span>${TX("źródło:")} ${REL[i.rel] || "?"}${TX("; informacja:")} ${INFO[i.info] || "?"}${i.claim ? ("; " + "<span class='amber'>" + TX("deklaracja jednej ze stron") + "</span>") : ""}</span></span>`;
}
function itemLL(i) { if (i.lat != null && i.lon != null) return [i.lat, i.lon]; const c = A(S.conflicts).find(c => c.id === i.conflict || c.id === i.loc); return c ? [c.lat, c.lon] : null; }
function openRef(ref) { if (A(S.conflicts).some(c => c.id === ref)) return go("c:" + ref); if (A(S.items).some(i => i.id === ref)) return go("n:" + ref); }
const frontOf = cid => A(S.fronts).filter(f => f.conflict === cid);
function go(id) { go.busy = true; try { go2(id); } finally { go.busy = false; } }
function go2(id) {
  if (!go.remote && BC && mapHidden()) BC.postMessage({ t: "go", id });   // mapa jest w innym oknie – tam też pokaż
  const parts = id.split(":"), t = parts[0], key = t === "mi" || t === "rd" || t === "acl" || t === "cr" || t === "il" || t === "gc" || t === "eq" ? id.slice(t.length + 1) : parts[1];
  const fly = (lat, lon, s, layer) => { ensureLayer(layer); setView("map"); flyTo(lat, lon, s); };
  if (t === "f") { const f = A(S.fronts).find(x => x.id === key); if (f) { ensureLayer("front"); setView("map"); const th = THEATERS.find(x => x[0] === f.theater); if (th) setTheater(th[0], true); else flyPts([].concat(...A(f.line))); } }
  else if (t === "m") { const f = A(S.fronts).find(x => x.id === key), m = f && A(f.moves)[+parts[2]]; if (m) { ensureLayer("move"); setView("map"); flyPts([m.from, m.to]); } }
  else if (t === "fh") { const f = A(S.fronts).find(x => x.id === key), h = f && A(f.holds)[+parts[2]]; if (h) fly(h[1][0], h[1][1], 2, "front"); }
  else if (t === "c") { const c = A(S.conflicts).find(x => x.id === key), fr = frontOf(key)[0]; if (fr && mode === "flat") { setView("map"); const th = THEATERS.find(x => x[0] === fr.theater); if (th) setTheater(th[0], true); else if (c) flyTo(c.lat, c.lon, 10); } else if (c) fly(c.lat, c.lon, 10); }
  else if (t === "n") { const it = A(S.items).find(i => i.id === key), p = it && itemLL(it); if (p) fly(p[0], p[1], 8, it.lat != null && !it.conflict ? (it.s === "human" ? "hum" : it.s === "cyber" ? "cyber" : "news") : null); }
  else if (t === "sh") { const s = A(S.shipping).find(x => x.id === key); if (s) fly(s.lat, s.lon, 8, "ship"); }
  else if (t === "fo") { const x = A(S.forces)[+key]; if (x) fly(x.lat, x.lon, 14, "force"); }
  else if (t === "st") { const x = A(S.strikes)[+key]; if (x) fly(x.lat, x.lon, 10, "strike"); }
  else if (t === "h") { const x = A(S.hazards)[+key]; if (x) fly(x.lat, x.lon, 14, "haz"); }
  else if (t === "s") { const s = satrecs[+key]; if (s && s.last) fly(s.last.lat, s.last.lon, 40, "sat"); }
  else { const ll = locExtra(t, key); if (ll && ll[0] != null) fly(ll[0], ll[1], ll[2] || 8, ll[3]); }
  pick(id);
}
function locExtra(t, key) {
  const f = F();
  if (t === "ac") { const a = A(f.adsb && f.adsb.ac)[+key]; return a && [a.lat, a.lon, 6, "air"]; }
  if (t === "vs") { const r = seaRec(key); if (!r) return null; const p = seaPos(r, Date.now() + SEA.skew); return [p[0], p[1], 5, "vessel"]; }
  if (t === "ah") { const a = A(AIR.d && AIR.d.ac).find(x => x.hex === key); if (!a) return null; const p = airPos(a, Date.now() + AIR.skew); return [p[0], p[1], 4, "air"]; }
  if (t === "gd") { const g = A(f.gdacs)[+key]; return g && [g.lat, g.lon, 12, "haz"]; }
  if (t === "mi") { const x = A(MS.d && MS.d.items).find(y => y.id === key); return x && x.pos && [x.pos[0], x.pos[1], 4, "marsec"]; }
  if (/^(ua|nt|tg|la|ap|cr|rd|acl|il|gc|eq)$/.test(t)) return intelLL(t, key);
  if (t === "nhc") { const n = A(f.nhc)[+key]; return n && [n.lat, n.lon, 12, "haz"]; }
  if (t === "asp") { const a = A(S.airspace).find(x => x.id === key); return a && [a.lat, a.lon, 14, "asp"]; }
  if (t === "net") { const n = A(f.ioda)[+key]; return n && [n.lat, n.lon, 14, "net"]; }
  if (t === "hum") { const h = A(S.humanitarian)[+key]; return h && [h.lat, h.lon, 12, "hum"]; }
  if (t === "who") { const w = A(f.who)[+key]; return w && [w.lat, w.lon, 14, "hum"]; }
  if (t === "nk") { const n = A(S.nuclear)[+key]; return n && [n.lat, n.lon, 5, "nuke"]; }
  if (t === "ef") { const e = A(S.eastflank)[+key]; return e && [e.lat, e.lon, 6, "flank"]; }
  if (t === "fire") { const x = A(f.firms)[+key]; return x && [x.lat, x.lon, 3, "fire"]; }
  if (t === "trv") { const x = A((f.travel || {}).us)[+key]; return x && [x.lat, x.lon, 14, null]; }
  if (t === "p") { const s = A(S.shipping).find(x => x.id === key); return s && [s.lat, s.lon, 8, "ship"]; }
  return null;
}
function bindDetail() {
  const D = $("#detail");
  D.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  D.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => openRef(b.dataset.open)));
  D.querySelectorAll("[data-chain]").forEach(b => b.addEventListener("click", () => chainFocusFor(b.dataset.chain)));
  D.querySelectorAll("[data-sit]").forEach(b => b.addEventListener("click", () => { $("#sitIn").value = b.dataset.sit; sitrep(); }));
}
function pick(id, silent) {
  if (!silent) beep(980, .04);
  selected = id;
  svg.selectAll(".mk").classed("sel", function () { return this.dataset.id === id; });
  const parts = id.split(":"), t = parts[0], key = parts[1], f = F();
  let h = "";
  if (t === "c") {
    const c = A(S.conflicts).find(x => x.id === key); if (!c) return;
    const tr = TREND[c.trend] || TREND.ongoing, rel = A(S.items).filter(i => i.conflict === c.id), fr = frontOf(c.id);
    const sc = A(c.scenarios).map(s => `<div><span class="t"><span>${esc(s.name)}</span><b class="amber">${s.prob}%</b></span><span class="bar"><i style="width:${Math.max(0, Math.min(100, s.prob))}%"></i></span><small>${esc(s.desc)}${A(s.signals).length ? ("<br>" + TX("Sygnały:") + " ") + s.signals.map(esc).join(" · ") : ""}</small></div>`).join("");
    const tl = A(c.timeline).slice(-10).map(x => `<li><time>${esc(fmtDate(x.d))}</time>${esc(x.e)}</li>`).join("");
    h = `${chip(tr[0], tr[1])}<h2 class="glow">${esc(c.name)}</h2>` + dd([
      [TX("CO"), c.what], [TX("GDZIE"), `${fmtLL(c.lat, c.lon)} ${TX("· od")} ${esc(c.since)}`, 1], [TX("DLACZEGO"), c.why], [TX("OSTATNIO"), c.latest],
      c.id === "iran" && S.iranStatus ? [TX("STATUS ROZEJMU"), `${esc(S.iranStatus.summary)} ${srcLinks(S.iranStatus.src)}`, 1] : null,
      [TX("SCENARIUSZE · 30 DNI"), sc ? `<div class="scen">${sc}</div>` : ("<span class=\"dim\">" + TX("Pojawią się po analizie lokalnego AI.") + "</span>"), 1],
      tl ? [TX("OŚ CZASU"), `<ul class="tl">${tl}</ul>`, 1] : null,
      fr.length ? [TX("FRONT"), `<ul class="mini">${fr.map(x => `<li><button data-go="f:${x.id}">▸ ${esc(x.name)} · ${A(x.moves).length} ${TX("ruchów · stan")} ${esc(x.asOf)}</button></li>`).join("")}</ul>`, 1] : null,
      rel.length ? [`${TX("DEPESZE (")}${rel.length})`, `<ul class="mini">${rel.map(r => `<li><button data-go="n:${r.id}">▸ ${esc(r.h)} <span class="dim">${esc(r.rel)}${esc(r.info)}</span></button></li>`).join("")}</ul>`, 1] : null,
      [TX("ŹRÓDŁA"), srcLinks(c.src) || "—", 1]]) +
      `<div class="dbtns"><button class="btn" data-sit="${esc(c.name)}">${TX("SITREP")}</button>${(S.chain && A(S.chain.nodes).some(n => n.ref === c.id || n.id === c.id)) ? `<button class="btn" data-chain="${c.id}">${TX("W ŁAŃCUCHU")}</button>` : ""}</div>`;
  } else if (t === "n") {
    const i = A(S.items).find(x => x.id === key); if (!i) return; const ll = itemLL(i);
    h = `${chip((SEC[i.s] || i.s) + " · " + LVL[i.p], i.p === "crit" ? "var(--red)" : "var(--amber)")}<h2 class="glow">${esc(i.h)}</h2>` + dd([
      [TX("CO"), i.b], ll ? [TX("GDZIE"), `${esc(i.place || "")} ${fmtLL(ll[0], ll[1])}`, 1] : null, [TX("DLACZEGO"), i.why || "—"], [TX("KIEDY"), i.t],
      [TX("WIARYGODNOŚĆ"), credHTML(i), 1], [`${TX("ŹRÓDŁA (")}${A(i.sources).length || 1})`, srcLinks(i.links || [[i.src, i.u]]), 1]]) +
      `<div class="dbtns">${i.conflict ? `<button class="btn" data-go="c:${i.conflict}">${TX("KARTA KONFLIKTU")}</button>` : ""}${(S.chain && A(S.chain.nodes).some(n => n.ref === i.id)) ? `<button class="btn" data-chain="${i.id}">${TX("W ŁAŃCUCHU")}</button>` : ""}</div>`;
  } else if (t === "f") {
    const x = A(S.fronts).find(y => y.id === key); if (!x) return;
    h = `${chip(TX("FRONT · STAN") + " " + x.asOf, "var(--amber)")}<h2 class="glow">${esc(x.name)}</h2>` + dd([
      [TX("STRONY"), Object.entries(x.sides || {}).map(([k, v]) => `<span class="sw" style="background:${COL(v[1])}"></span>${esc(v[0])}`).join("<br>") + `<br><span class="sw" style="background:var(--white)"></span>sporne`, 1],
      [TX("SYTUACJA"), x.note], [`${TX("RUCHY (")}${A(x.moves).length})`, `<ul class="mini">${A(x.moves).map((m, i) => `<li><button data-go="m:${x.id}:${i}"><span class="sw" style="background:${COL((x.sides[m.side] || [])[1])}"></span>${esc(m.when)} · ${esc(m.label)}${m.ai ? (" " + "<span class=\"cyan\">" + TX("AI") + "</span>") : ""}</button></li>`).join("")}</ul>`, 1],
      [TX("ŹRÓDŁA"), srcLinks(x.src), 1]]) + `<p class="hint">${TX("Linia zrekonstruowana z miejscowości w raportach; to szacunek, nie mapa sztabowa. Lokalne AI dopisuje natarcia i zmiany kontroli, ale nie przesuwa linii.")}</p>`;
  } else if (t === "m") {
    const x = A(S.fronts).find(y => y.id === key), m = x && A(x.moves)[+parts[2]]; if (!m) return; const sd = x.sides[m.side] || ["?", "phos"];
    h = `${chip(TX("NATARCIE ·") + " " + sd[0], COL(sd[1]))}<h2 class="glow">${esc(m.label)}</h2>` + dd([[TX("CO"), m.note], [TX("KIEDY"), m.when],
      [TX("KIERUNEK"), `${fmtLL(m.from[0], m.from[1])} → ${fmtLL(m.to[0], m.to[1])}`], [TX("FRONT"), `<ul class="mini"><li><button data-go="f:${x.id}">▸ ${esc(x.name)}</button></li></ul>`, 1],
      [TX("ŹRÓDŁO"), srcLinks([m.src]), 1]]) + (m.ai ? `<p class="hint">${TX("Wpis dodany przez lokalne AI na podstawie wiadomości; współrzędne przybliżone.")}</p>` : "");
  } else if (t === "fh") {
    const x = A(S.fronts).find(y => y.id === key), hd = x && A(x.holds)[+parts[2]]; if (!hd) return; const sd = hd[2] === "x" ? ["sporne", "white"] : (x.sides[hd[2]] || ["?", "phos"]);
    h = `${chip(TX("KONTROLA ·") + " " + sd[0], COL(sd[1]))}<h2 class="glow">${esc(hd[0])}</h2>` + dd([[TX("GDZIE"), fmtLL(hd[1][0], hd[1][1])], [TX("FRONT"), `<ul class="mini"><li><button data-go="f:${x.id}">▸ ${esc(x.name)} ${TX("(stan")} ${esc(x.asOf)})</button></li></ul>`, 1]]);
  } else if (t === "st") {
    const x = A(S.strikes)[+key]; if (!x) return;
    h = `${chip(TX("UDERZENIE ·") + " " + (x.side === "ru" ? TX("ROSJA") : TX("UKRAINA")), x.side === "ru" ? "var(--red)" : "var(--cyan)")}<h2 class="glow">${esc(x.target)}</h2>` + dd([[TX("CO"), x.note], [TX("KIEDY"), x.when || fd(x.d)], [TX("GDZIE"), fmtLL(x.lat, x.lon) + " " + TX("(przybliżenie)")], [TX("ŹRÓDŁO"), srcLinks([x.src]), 1]]);
  } else if (t === "fo") {
    const x = A(S.forces)[+key]; if (!x) return; const kd = FKIND[x.kind] || ["", ""];
    h = `${chip(kd[1], "var(--violet)")}<h2 class="glow">${esc(x.name)}</h2>` + dd([[TX("GDZIE"), `${esc(x.where)} · ${fmtLL(x.lat, x.lon)} ${TX("(pozycja orientacyjna)")}`, 1], [TX("STAN NA"), x.when], [TX("CO"), x.note], [TX("ŹRÓDŁO"), srcLinks([x.src]), 1]]);
  } else if (t === "sh" || t === "p") {
    const x = A(S.shipping).find(y => y.id === key); if (!x) return; const st = SHIP[x.status] || SHIP.open, pw = (f.portwatch || {})[x.id];
    h = `${chip(TX("ŻEGLUGA ·") + " " + st[0], st[1])}<h2 class="glow">${esc(x.name)}</h2>${pw ? spark(pw.series.map(r => r[1]), 70) : ""}` + dd([[TX("RUCH"), x.metric],
      pw ? [TX("AIS · IMF PORTWATCH"), `${TX("Średnio")} ${pw.avg7} ${TX("statków/dobę w ostatnim tygodniu (do")} ${esc(pw.last)})${pw.base ? `${TX(", rok temu")} ${pw.base}${TX("/dobę")}` : ""}${TX(". Wykres: ostatnie")} ${pw.series.length} ${TX("dni. Liczy tylko statki z włączonym AIS; w strefach wojny wiele płynie bez niego, więc to dolna granica.")}`] : null,
      [TX("OSTATNIO"), x.latest], [TX("DLACZEGO"), x.why], [TX("ŹRÓDŁA"), srcLinks(x.src), 1]]);
  } else if (t === "mk") {
    const m = A(MK && MK.items).find(x => x.id === key); if (!m) return; const up = m.change_pct >= 0;
    h = `${chip(TX("RYNEK · 5 DNI") + " " + (up ? "+" : "") + (m.change_pct || 0).toFixed(2) + "%", up ? "var(--phos)" : "var(--red)")}<h2 class="glow">${esc(m.label)}: ${m.price != null ? m.price.toLocaleString(LOC) : "—"} ${esc(m.unit)}</h2>${spark(m.spark, 80)}` +
      dd([[TX("DLACZEGO"), S.marketsNote || TX("Komentarz pojawi się po analizie AI.")], [TX("ŹRÓDŁO"), `${esc(m.source || "")} · ${MK.fetched ? new Date(MK.fetched).toLocaleTimeString(LOC) : ""}`, 1]]) + `<p class="hint">${TX("Notowania pobierane na żywo co 5 minut; mogą być opóźnione o kilkanaście minut.")}</p>`;
  } else if (t === "cal") {
    const e = A(S.calendar)[+key]; if (!e) return;
    h = `${chip(CAT[e.cat] || e.cat || TX("WYDARZENIE"), "var(--amber)")}<h2 class="glow">${esc(e.t)}</h2>` + dd([[TX("KIEDY"), `${fmtDate(e.d)} · ${countdown(e.d)}`], [TX("DLACZEGO WAŻNE"), e.note], [TX("ŹRÓDŁO"), srcLinks([e.src]), 1],
      e.ref ? [TX("DEPESZA"), `<ul class="mini"><li><button data-go="n:${esc(e.ref)}">${TX("▸ otwórz")}</button></li></ul>`, 1] : null]);
  } else if (t === "h") {
    const x = A(S.hazards)[+key]; if (!x) return; const kind = { quake: TX("TRZĘSIENIE ZIEMI"), volcano: TX("WULKAN"), storm: TX("CYKLON TROPIKALNY"), flood: TX("POWÓDŹ"), fire: TX("POŻAR") }[x.kind] || x.kind;
    h = `${chip(kind, "var(--amber)")}<h2 class="glow">${esc((LANG === "en" ? x.name || x.name_pl : x.name_pl || x.name))}</h2>` + dd([[TX("CO"), x.note], [TX("GDZIE"), fmtLL(x.lat, x.lon)], [TX("SIŁA / KIEDY"), `${x.mag} · ${x.when}`], [TX("ŹRÓDŁO"), srcLinks([x.src]), 1]]);
  } else if (t === "s" || t === "sc") {
    let r = null;
    if (t === "s") { const x = satrecs[+key]; if (!x) return; r = { name: x.name, norad: x.norad, rec: x.rec, last: x.last, l1: "" }; }
    else { r = (SATCLICK && String(SATCLICK.norad) === key) ? SATCLICK : satByNorad(+key); if (!r) return; SATCLICK = r; }
    h = satCard(r, silent);
  } else if (t === "vs") { const r = seaRec(key); if (r && !SEA.detail[+key] && !silent) loadShipDetail(+key); else if (r && !SEA.detail[+key]) setTimeout(() => loadShipDetail(+key), 0);
    if (!r) h = chip(TX("AIS"), "var(--cyan)") + `<h2 class="glow">${TX("MMSI")} ${esc(key)}</h2><p class="hint">${TX("Statek przestał nadawać albo wypłynął poza zasięg odbiorników.")}</p>`;
    else { const now = Date.now() + SEA.skew, p = seaPos(r, now), age = Math.round((now - r.ts) / 1000), NAV = [TX("w drodze (silnik)"), TX("na kotwicy"), TX("bez napędu"), TX("ograniczona manewrowość"), TX("ograniczony zanurzeniem"), "zacumowany", TX("na mieliźnie"), TX("połów"), TX("w drodze (żagle)")];
      h = chip(TX("NA ŻYWO ·") + " " + (SCN[r.cat] || r.cat), SCOL[r.cat]) + `<h2 class="glow">${esc(r.flag_e || "")} ${esc(r.name || TX("MMSI") + " " + r.mmsi)}</h2>` + dd([
        [TX("BANDERA"), (esc(r.flag) || TX("nieustalona")) + (r.foc ? " " + TX("(bandera wygody – armator zwykle z innego kraju)") : "")], [TX("TYP"), r.kind],
        [TX("CEL PODRÓŻY"), r.dest], [TX("WYMIARY"), r.length ? `${r.length} × ${r.width || "?"} m` : null], [TX("ZANURZENIE"), r.draught ? r.draught + " m" : null],
        [TX("PRĘDKOŚĆ"), r.sog != null ? `${r.sog} w. (${Math.round(r.sog * 1.852)} km/h)` : null], [TX("KURS"), r.cog != null ? Math.round(r.cog) + "°" : null],
        [TX("STATUS"), r.nav === 14 ? TX("ALARM AIS-SART") : NAV[r.nav]], [TX("POZYCJA"), fmtLL(p[0], p[1]) + (r.zone ? " · " + esc(r.zone) : "")], [TX("OSTATNI ODCZYT"), agoTxt(age)],
        [TX("MMSI"), r.mmsi], [TX("IMO"), r.imo], [TX("ZNAK WYWOŁAWCZY"), r.cs], [TX("ŹRÓDŁO"), r.src], [TX("PODGLĄD"), L(r.u, TX("MarineTraffic")), 1]]) + shipWatch(r) + vgBox(r.mmsi) +
        `<p class="hint">${TX("Dane AIS nadaje sam statek, więc nazwa, typ i cel podróży mogą być nieaktualne lub fałszywe. Okręty zwykle wyłączają AIS. Linia przerywana to trasa z ostatnich godzin.")}</p>`; }
  } else if (t === "mi") { h = msCard(id.slice(3), silent);
  } else if (/^(ua|nt|tg|la|ap|cr|rd|acl|il|gc|eq)$/.test(t)) { h = intelCard(t, id.slice(t.length + 1)); if (!h) return;
  } else if (t === "ah") { const a = A(AIR.d && AIR.d.ac).find(x => x.hex === key);
    if (!a) h = chip(TX("ADS-B NA ŻYWO"), "var(--cyan)") + `<h2 class="glow">${esc(key)}</h2><p class="hint">${TX("Samolot przestał nadawać albo zniknął z zasięgu odbiorników.")}</p>`;
    else { const now = Date.now() + AIR.skew, p = airPos(a, now), age = airAge(a, now);
      h = chip(TX("NA ŻYWO ·") + " " + (ACN[a.cat] || a.cat), ACOL[a.cat] || "var(--cyan)") + `<h2 class="glow">${esc(a.flag || "")} ${esc(a.cs || a.hex)} · ${esc(a.t || "?")}</h2>` + dd([
        [TX("KRAJ"), a.country ? a.country + (a.country === "NATO" ? " " + TX("(rejestracja luksemburska)") : "") : "nieustalony"],
        [TX("MODEL"), [a.desc, a.model && a.model !== a.desc ? a.model : ""].filter(Boolean).join(" — ") || a.t],
        [TX("OPERATOR"), a.op], [TX("ROK PRODUKCJI"), a.year], [TX("REJESTRACJA"), a.reg], [TX("ADRES ICAO"), a.hex.toUpperCase()], [TX("POZYCJA"), fmtLL(p[0], p[1])], [TX("WYSOKOŚĆ"), a.ground ? TX("na ziemi") : a.alt != null ? `${a.alt} ${TX("ft (")}${Math.round(a.alt * .3048)} m)` : null],
        [TX("PRĘDKOŚĆ"), a.gs ? `${Math.round(a.gs)} ${TX("kt (")}${Math.round(a.gs * 1.852)} km/h)` : null], [TX("KURS"), a.trk != null ? Math.round(a.trk) + "°" : null],
        [TX("WZNOSZENIE"), a.vr ? (a.vr > 0 ? "+" : "") + a.vr + " ft/min" : null], [TX("SQUAWK"), a.sq], [TX("OSTATNI ODCZYT"), agoTxt(age) + (a.mlat ? " " + TX("· pozycja z MLAT") : "")],
        [TX("ŹRÓDŁO"), L(a.u, (AIR.d.status || {}).src || TX("ADS-B")), 1]]) +
        `<p class="satimg-row"><button class="btn" onclick="this.disabled=true;window.__osTrack('${esc0(a.hex)}')">${TX("ŚLAD LOTU (OpenSky)")}</button> <span class="hint ostrk"></span></p>` +
        `<p class="hint">${TX("Pozycja aktualizowana co")} ${AIR.d.interval || 10} ${TX("s, między odczytami przewidywana z kursu i prędkości. Linia za samolotem to trasa z ostatnich 30 minut.")}</p>`; }
  } else if (t === "ac") { const a = A(f.adsb && f.adsb.ac)[+key]; if (!a) return;
    h = chip(TX("ADS-B ·") + " " + (ACN[a.cat] || a.cat), "var(--cyan)") + `<h2 class="glow">${esc(a.cs || a.hex)} · ${esc(a.t)}</h2>` + dd([[TX("POZYCJA"), fmtLL(a.lat, a.lon)], [TX("WYSOKOŚĆ"), a.alt != null ? a.alt + " ft" : null], [TX("KURS"), a.trk + "°"], [TX("MIGAWKA"), f.adsb.t], [TX("ŚLAD"), L(a.u, TX("globe.adsb.lol")), 1]]) + `<p class="hint">${TX("Pozycja z chwili pobrania, nie na żywo. Nad strefami walk samoloty często lecą z wyłączonym transponderem.")}</p>`;
  } else if (t === "gd") { const g = A(f.gdacs)[+key]; if (!g) return;
    h = chip(TX("GDACS ·") + " " + g.alert, g.lvl === "Red" ? "var(--red)" : "var(--amber)") + `<h2 class="glow">${esc(g.kind)}: ${esc(g.name)}</h2>` + dd([[TX("GDZIE"), g.country], [TX("OKRES"), fd(g.from) + " – " + fd(g.to)], [TX("SKALA"), g.sev], [TX("RAPORT"), L(g.u, TX("gdacs.org")), 1]]);
  } else if (t === "nhc") { const n = A(f.nhc)[+key]; if (!n) return;
    h = chip(TX("NHC ·") + " " + n.cls, "var(--red)") + `<h2 class="glow">${esc(n.name)}</h2>` + dd([[TX("WIATR"), `${n.kmh} km/h (${n.kt} ${TX("kt),")} ${n.hpa} hPa`], [TX("POZYCJA"), fmtLL(n.lat, n.lon)], [TX("RUCH"), `${n.dir}° · ${Math.round((n.spd || 0) * 1.852)} km/h`], [TX("KOMUNIKAT"), L(n.u, TX("nhc.noaa.gov")), 1]]);
  } else if (t === "asp") { const a = A(S.airspace).find(x => x.id === key); if (!a) return; const l = ASL[a.level] || ASL.caution;
    h = chip(TX("PRZESTRZEŃ ·") + " " + l[0], l[1]) + `<h2 class="glow">${esc(a.name)}</h2>` + dd([[TX("CO"), a.note], [TX("ŹRÓDŁO"), srcLinks([a.src]), 1]]);
  } else if (t === "net") { const n = A(f.ioda)[+key]; if (!n) return;
    h = chip(TX("IODA · SYGNAŁ ZAKŁÓCENIA"), "var(--red)") + `<h2 class="glow">${esc(n.name)}</h2>` + dd([[TX("WSKAŹNIK"), n.score + " " + TX("(log)")], [TX("ZDARZEŃ"), n.events], [TX("DETEKTORY"), A(n.src).join(", ")], [TX("WYKRES"), L(n.u, "ioda"), 1]]) + `<p class="hint">${TX("Wskaźnik sumuje spadki widoczności sieci z 48 godzin. W małym kraju może to być awaria jednego operatora; w państwach z wojną lub protestami często celowe wyłączenie.")}</p>`;
  } else if (t === "hum") { const x = A(S.humanitarian)[+key]; if (!x) return;
    h = chip(TX("HUMANITARNE ·") + " " + x.where, "var(--amber)") + `<h2 class="glow">${esc(x.t)}</h2>` + dd([[TX("CO"), x.note], [TX("KIEDY"), fd(x.d)], [TX("ŹRÓDŁO"), srcLinks([x.src]), 1]]);
  } else if (t === "who") { const w = A(f.who)[+key]; if (!w) return;
    h = chip(TX("WHO · OGNISKO CHOROBY"), "var(--red)") + `<h2 class="glow">${esc(w.dis)}</h2>` + dd([[TX("GDZIE"), w.country], [TX("KOMUNIKAT"), fd(w.d)], [TX("ŹRÓDŁO"), L(w.u, TX("WHO Disease Outbreak News")), 1]]);
  } else if (t === "rw") { const r = A(f.reliefweb)[+key]; if (!r) return;
    h = chip(TX("RELIEFWEB ·") + " " + r.country, "var(--amber)") + `<h2 class="glow">${esc(r.t)}</h2>` + dd([[TX("DATA"), fd(r.d)], [TX("RAPORT"), L(r.u, TX("reliefweb.int")), 1]]);
  } else if (t === "nk") { const n = A(S.nuclear)[+key]; if (!n) return; const st = NKS[n.status] || NKS.unknown;
    h = chip(TX("ATOM ·") + " " + st[0], st[1]) + `<h2 class="glow">${esc(n.name)}</h2>` + dd([[TX("STAN"), n.note], [TX("GDZIE"), fmtLL(n.lat, n.lon)], [TX("ŹRÓDŁO"), srcLinks([n.src]), 1]]);
  } else if (t === "ef") { const e = A(S.eastflank)[+key]; if (!e) return;
    h = chip(TX("FLANKA ·") + " " + (KND[e.kind] || e.kind), "var(--violet)") + `<h2 class="glow">${esc(e.t)}</h2>` + dd([[TX("CO"), e.note], [TX("KIEDY"), fd(e.d)], [TX("ŹRÓDŁO"), srcLinks([e.src]), 1]]);
  } else if (t === "fire") { const x = A(f.firms)[+key]; if (!x) return;
    h = chip(TX("NASA FIRMS · OGNISKO"), "#ff7a2a") + `<h2 class="glow">${esc(x.reg)}</h2>` + dd([[TX("POZYCJA"), fmtLL(x.lat, x.lon) + " " + TX("(komórka 0,2°)")], [TX("DETEKCJI"), x.n], [TX("MOC (FRP)"), x.frp + " " + TX("MW")], [TX("DATA"), fd(x.t)]]) + `<p class="hint">${TX("Satelita widzi każde gorące źródło: pożary rolnicze, pochodnie gazowe, ale też płonące rafinerie i składy po uderzeniach. Liczy się nagłe pojawienie w rejonie walk.")}</p>`;
  } else if (t === "pm") { const e = A(f.polymarket)[+key]; if (!e) return;
    h = chip(TX("POLYMARKET · RYNEK PREDYKCYJNY"), "var(--cyan)") + `<h2 class="glow">${esc(e.t)}</h2>` + e.m.map(m => `<div class="pbar" style="padding:2px 0"><span>${esc(m.q)}</span><i><b style="width:${pct(m.p)}"></b></i><span>${pct(m.p)}</span></div>`).join("") +
      dd([[TX("ORYGINAŁ"), e.orig], [TX("OBRÓT 24 H"), "$" + (e.vol24 || 0).toLocaleString(LOC)], [TX("RYNEK"), L(e.u, TX("polymarket.com")), 1]]) + `<p class="hint">${TX("Cena zakładu pokazuje oczekiwania graczy, a nie fakty. Warunki rozstrzygnięcia mogą różnić się od intuicyjnego znaczenia pytania.")}</p>`;
  } else if (t === "kev") { const v = A(f.kev)[+key]; if (!v) return;
    h = chip(TX("CISA KEV") + (v.ransom ? " " + TX("· RANSOMWARE") : ""), v.ransom ? "var(--red)" : "var(--amber)") + `<h2 class="glow">${esc(v.vendor)} ${esc(v.product)}</h2>` + dd([[TX("LUKA"), v.name], [TX("CVE"), v.cve], [TX("DODANA"), fd(v.added)], [TX("TERMIN ŁATANIA (US GOV)"), fd(v.due)], [TX("SZCZEGÓŁY"), L(v.u, TX("NVD")), 1]]) + `<p class="hint">${TX("Katalog obejmuje tylko luki, o których CISA wie, że są już wykorzystywane w atakach.")}</p>`;
  } else if (t === "sanc") { const x = A(S.sanctions)[+key]; if (!x) return;
    h = chip(TX("SANKCJE ·") + " " + x.who, "var(--amber)") + `<h2 class="glow">${esc(x.t)}</h2>` + dd([[TX("CO"), x.note], [TX("KIEDY"), fd(x.d)], [TX("ŹRÓDŁO"), srcLinks([x.src]), 1]]);
  } else if (t === "ofac") { const x = A(f.ofac)[+key]; if (!x) return;
    h = chip(TX("OFAC · USA"), "var(--amber)") + `<h2 class="glow">${esc(x.t)}</h2>` + dd([[TX("DATA"), fd(x.d)], [TX("KOMUNIKAT"), L(x.u, TX("ofac.treasury.gov")), 1]]) + `<p class="hint">${TX("Tytuł oryginalny z listy OFAC.")}</p>`;
  } else if (t === "trv") { const x = A((f.travel || {}).us)[+key]; if (!x) return;
    h = chip(TX("USA · POZIOM") + " " + x.lvl, x.lvl >= 4 ? "var(--red)" : "var(--amber)") + `<h2 class="glow">${esc(x.country)}</h2>` + dd([[TX("ZALECENIE"), x.lbl], [TX("ZMIANA"), fd(x.d)], [TX("ŹRÓDŁO"), L(x.u, TX("travel.state.gov")), 1]]);
  } else if (t === "nbp") { const s = A((f.nbp || {})[key]); if (!s.length) return;
    h = chip(TX("NBP · KURS ŚREDNI"), "var(--phos)") + `<h2 class="glow">${esc(key)}${TX("/PLN:")} ${s[s.length - 1][1].toFixed(4).replace(".", ",")}</h2>` + spark(s.map(x => x[1]), 80) + dd([[TX("SESJE"), s.map(x => x[0].slice(5) + ": " + x[1]).join(" · ")], [TX("ŹRÓDŁO"), L("https://api.nbp.pl/", TX("api.nbp.pl")), 1]]);
  } else if (t === "ec") { const e = A(S.econ)[+key]; if (!e) return;
    h = chip(TX("GOSPODARKA"), "var(--phos)") + `<h2 class="glow">${esc(e.k)}: ${esc(e.v)}</h2>` + dd([[TX("CO"), e.note], [TX("ŹRÓDŁO"), srcLinks([e.src]), 1]]);
  } else if (t === "aw") { const a = S.airwar, dy = a && A(a.days)[+key]; if (!dy) return; const tot = (dy.drones || 0) + (dy.missiles || 0);
    h = chip(TX("NOCNY ATAK ·") + " " + fd(dy.d), "var(--red)") + `<h2 class="glow">${tot} ${TX("celów, zestrzelono")} ${dy.downed ?? "?"}</h2>` + dd([[TX("DRONY"), dy.drones], [TX("RAKIETY"), dy.missiles == null ? TX("brak danych") : dy.missiles],
      [TX("SKUTECZNOŚĆ OBRONY"), dy.downed != null && tot ? Math.round(dy.downed / tot * 100) + "%" : null], [TX("CO"), dy.note], [TX("TREND"), a.note], [TX("ŹRÓDŁA"), srcLinks(a.src), 1]]) + `<p class="hint">${TX("Dane Sił Powietrznych Ukrainy, czyli jednej strony konfliktu.")}</p>`;
  } else if (t === "src") { const s = srcList()[+key]; if (!s) return;
    h = chip(TX("ŹRÓDŁO") + (s.rel ? " " + TX("· WIARYGODNOŚĆ") + " " + s.rel : ""), "var(--phos)") + `<h2 class="glow">${esc(s.name)}</h2>` + dd([[TX("STAN"), s.state], [TX("UWAGI"), s.note], s.url ? [TX("ADRES"), L(s.url, s.url), 1] : null]);
  } else return;
  if (t === "c") { const c0 = A(S.conflicts).find(x => x.id === key); if (c0 && c0.lat != null) h += satBtn(c0.lat, c0.lon, 3); }
  $("#detail").innerHTML = h; bindDetail(); bindSatImg(); vgFill(); evFill(); gcFill();
}
function idleDetail() {
  const hot = A(S.conflicts).filter(c => c.trend === "esc" || c.trend === "new");
  $("#detail").innerHTML = `${chip(TX("GOTOWY"), "var(--phos)")}<h2 class="glow">${TX("Wybierz cel")}</h2>
  <p class="hint">${TX("Kliknij obiekt na mapie albo pozycję w panelach. Teatr działań przybliża region; kółko myszy powiększa, ◎ wraca do świata. Na globusie przeciągnij, aby obrócić.")}</p>` +
  dd([[TX("NAJWYŻSZY PRIORYTET"), `<ul class="mini">${hot.map(c => `<li><button data-go="c:${c.id}">▸ ${esc(c.name)}</button></li>`).join("") || "—"}</ul>`, 1],
    A(S.fronts).length ? [TX("FRONTY"), `<ul class="mini">${A(S.fronts).map(x => `<li><button data-go="f:${x.id}">▸ ${esc(x.name)}</button></li>`).join("")}</ul>`, 1] : null,
    [TX("SKALA WIARYGODNOŚCI"), TX("Litera: ocena źródła (A najlepsze, F nieznane). Cyfra: ocena informacji (1 potwierdzona przez inne źródła, 6 nie da się ocenić). Na przykład B2 to zwykle wiarygodne źródło i prawdopodobnie prawdziwa informacja.")]]);
  bindDetail();
}

/* ------------------------------------------------------------ DEPESZE */
let filter = store.get("filter", "all"), query = "", unreadOnly = false, credOnly = false;
let readSet = new Set(store.get("read", [])), watchSet = new Set(store.get("watch", []));
function tabs() {
  $("#tabs").innerHTML = Object.keys(SEC).map(k => `<button class="btn" data-f="${k}" aria-pressed="${k === filter}">${SEC[k]}</button>`).join("");
  $("#tabs").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { filter = b.dataset.f; store.set("filter", filter); beep(720); tabs(); renderFeed(); }));
}
function renderFeed() {
  const q = query.toLowerCase(), newSet = new Set((S.changes || {}).new_items || []), items = A(S.items);
  const rows = items.filter(d => (filter === "all" || (filter === "watch" ? watchSet.has(d.key) : d.s === filter)) && (!unreadOnly || !readSet.has(d.key))
    && (!credOnly || ((d.rel || "F") <= "B" && (d.info || 6) <= 3)) && (!q || [d.h, d.b, d.why, d.src, d.place].join(" ").toLowerCase().includes(q)));
  $("#feed").innerHTML = rows.map(d => `<li class="msg${readSet.has(d.key) ? " read" : ""}${watchSet.has(d.key) ? " watch" : ""}${newSet.has(d.id) ? " new" : ""}" data-p="${d.p}"><i class="pri"></i>
    <div class="meta"><span class="sec">${SEC[d.s] || d.s}</span><span>${esc(d.t)}</span><span class="lvl">${LVL[d.p]}</span><span class="credm" title="${esc((REL[d.rel] || "") + "; " + (INFO[d.info] || ""))}">${esc(d.rel || "F")}${esc(d.info || 6)}${d.claim ? " " + TX("· DEKLARACJA") : ""}</span>${A(d.sources).length > 1 ? `<span>${d.sources.length} ${TX("ŹRÓDŁA")}</span>` : ""}</div>
    <h3 class="glow">${esc(d.h)}</h3><p>${esc(d.b)}</p>${d.why ? `<p class="why"><b>${TX("DLACZEGO ·")}</b> ${esc(d.why)}</p>` : ""}
    <div class="acts"><span>${TX("ŹRÓDŁO:")} <a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(d.src)}</a></span>
      ${itemLL(d) ? `<button data-a="map" data-id="${d.id}">${TX("◎ NA MAPIE")}</button>` : ""}
      <button data-a="read" data-k="${esc(d.key)}" aria-pressed="${readSet.has(d.key)}">${TX("✓ PRZECZYTANE")}</button>
      <button data-a="watch" data-k="${esc(d.key)}" aria-pressed="${watchSet.has(d.key)}">${TX("◆ OBSERWUJ")}</button></div></li>`).join("") || ("<li class=\"empty\">" + TX("BRAK REKORDÓW DLA TEGO FILTRA") + "</li>");
  $("#count").textContent = `${rows.length} / ${items.length} ${TX("· NIEPRZECZYTANE")} ${items.filter(i => !readSet.has(i.key)).length}`;
  $("#feed").querySelectorAll("button[data-a]").forEach(b => b.addEventListener("click", () => act(b.dataset.a, b.dataset.id, b.dataset.k)));
}
function act(a, id, key) {
  beep(a === "watch" ? 1300 : 900, .04);
  if (a === "read") { readSet.has(key) ? readSet.delete(key) : readSet.add(key); store.set("read", [...readSet]); }
  if (a === "watch") { watchSet.has(key) ? watchSet.delete(key) : watchSet.add(key); store.set("watch", [...watchSet]); }
  if (a === "map") { const it = A(S.items).find(i => i.id === id); go(it && it.conflict && it.lat == null ? "c:" + it.conflict : "n:" + id); scrollMap(); }
  renderFeed();
}
$("#search").addEventListener("input", e => { query = e.target.value; renderFeed(); });
$("#unreadBtn").addEventListener("click", e => { unreadOnly = !unreadOnly; e.currentTarget.setAttribute("aria-pressed", unreadOnly); renderFeed(); });
$("#credBtn").addEventListener("click", e => { credOnly = !credOnly; e.currentTarget.setAttribute("aria-pressed", credOnly); renderFeed(); });
function scrollMap() { if (document.body.classList.contains("compact")) return; const m = $(".mainview"), r = m.getBoundingClientRect(); if (r.top < -40 || r.top > innerHeight * .5) m.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }

/* ------------------------------------------------------------ PANELE */
function rowsInto(sel, html) {
  const el = $(sel); el.innerHTML = html || ("<li class=\"empty\">" + TX("BRAK DANYCH W TYM ODCZYCIE") + "</li>");
  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { go(b.dataset.go); const t = b.dataset.go.split(":")[0]; if (!["mk", "cal", "nbp", "ec", "pm", "kev", "sanc", "ofac", "aw", "src", "rw"].includes(t)) scrollMap(); else if (innerWidth < 1060) $("#detail").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); }));
}
const isNewMod = (k, id) => A(((S.changes || {}).new_mods || {})[k]).includes(id);
function renderRail() {
  const t = S.threat || { level: "–", label: "", note: "" }, C = A(S.conflicts), hot = C.filter(c => c.trend === "esc" || c.trend === "new").length;
  const b = A(MK && MK.items).find(m => m.id === "brent"), hz = A(S.shipping).find(s => s.id === "hormuz"), aw = S.airwar && A(S.airwar.days), last = aw && aw[aw.length - 1];
  const d = new Date(S.stamp);
  const cells = [
    [TX("Poziom napięcia"), `${t.level} · ${TX(t.label)}`, t.note, "red", null],
    [TX("Konflikty"), C.length, hot + " " + TX("nowe lub eskalujące"), "", null],
    [TX("Fronty"), A(S.fronts).length || "–", A(S.fronts).reduce((s, f) => s + A(f.moves).length, 0) + " " + TX("ruchów w 30 dni"), "amber", A(S.fronts).length ? "f:" + S.fronts[0].id : null],
    [TX("Ropa Brent"), b && !b.error ? "$" + b.price.toFixed(2) : "–", b && !b.error ? `${b.change_pct >= 0 ? "▲" : "▼"} ${Math.abs(b.change_pct).toFixed(2)}${TX("% · 5 dni · na żywo")}` : TX("łączenie…"), b && b.change_pct >= 0 ? "red" : "", b ? "mk:brent" : null],
    [TX("Ormuz"), hz ? (SHIP[hz.status] || SHIP.open)[0] : "–", hz ? String(hz.metric || "").split(";")[0] : "", hz && hz.status !== "open" ? "amber" : "", hz ? "sh:hormuz" : null],
    [TX("USA – Iran"), S.iranStatus ? (S.iranStatus.ceasefire === "in_force" ? TX("ROZEJM") : TX("BEZ ROZEJMU")) : "–", S.iranStatus ? TX("pauza do") + " " + String(S.iranStatus.expires || "?").split(" (")[0] : "", S.iranStatus && S.iranStatus.ceasefire !== "in_force" ? "red" : "", S.iranStatus ? "c:iran" : null],
    [TX("Noc nad Ukrainą"), last ? ((last.drones || 0) + (last.missiles || 0)) + " " + TX("celów") : "–", last ? TX("drony i rakiety ·") + " " + fd(last.d) : "", "amber", last ? "aw:" + (aw.length - 1) : null],
    [TX("Natura"), A(S.hazards).length + A(F().gdacs).length, `${A(S.hazards).filter(h => h.kind === "quake").length} ${TX("wstrząsów ≥M5.5 ·")} ${A(F().gdacs).length} ${TX("alertów GDACS")}`, "amber", null],
    [TX("Odczyt · AI"), isNaN(d) ? "--" : d.toLocaleDateString(LOC, { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }), (ARCH ? TX("archiwum ·") + " " : "") + (S.model ? TX("AI:") + " " + S.model : S.seed ? TX("dane startowe") : TX("bez analizy AI")), "", null]];
  $("#rail").innerHTML = cells.map(c => `<${c[4] ? `button class="stat" data-go="${c[4]}"` : 'div class="stat"'}><span class="k">${esc(c[0])}</span><span class="v ${c[3]}">${esc(c[1])}</span><span class="n" title="${esc(c[2])}">${esc(c[2])}</span></${c[4] ? "button" : "div"}>`).join("") + (SOLO ? "" : '<button class="btn detach" data-detach="status" title="Odepnij do osobnego okna (np. na drugi monitor)">⧉</button>');
  $("#rail").querySelectorAll("[data-go]").forEach(x => x.addEventListener("click", () => { go(x.dataset.go); if (!/^(mk|aw)/.test(x.dataset.go)) scrollMap(); }));
  $("#banner").textContent = `${TX("PRIORYTET JEDEN ·")} ${A(S.items).filter(i => i.p === "crit").length} ${TX("ZDARZENIA KRYTYCZNE ·")} ` + C.filter(c => c.trend === "esc").map(c => c.name.toUpperCase()).join(" / ");
  $("#ticker").textContent = A(S.items).map(x => "■ " + (SEC[x.s] || "") + " // " + x.h.toUpperCase()).join("   ") + "   " + TX("■ KONIEC TRANSMISJI");
}
const MODNAME = { strikes: [TX("uderzenia"), "#strikes"], eastflank: [TX("flanka NATO"), "#ef"], forces: [TX("ruchy sił"), "#forces"], airspace: [TX("przestrzeń"), "#sky"], nuclear: [TX("atom"), "#nuke"], sanctions: [TX("sankcje"), "#sanc"], humanitarian: [TX("humanitarne"), "#hum"], econ: [TX("gospodarka"), "#mktNote"] };
function renderChanges() {
  const ch = S.changes || {}, el = $("#changes");
  const items = A(S.items).filter(i => A(ch.new_items).includes(i.id)).slice(0, 8);
  const trends = A(ch.trend_changes).map(t => { const c = A(S.conflicts).find(x => x.id === t.id); return c ? `<button class="pill" data-go="c:${c.id}">${esc(c.name)}: ${(TREND[t.from] || ["?"])[0]} → <b>${(TREND[t.to] || ["?"])[0]}</b></button>` : ""; }).join("");
  const nc = A(ch.new_conflicts).map(id => { const c = A(S.conflicts).find(x => x.id === id); return c ? `<button class="pill" data-go="c:${c.id}"><b>${TX("NOWY")}</b> ${esc(c.name)}</button>` : ""; }).join("");
  const mods = Object.entries(ch.new_mods || {}).filter(([k, v]) => A(v).length && MODNAME[k]).map(([k, v]) => `<button class="pill" data-scroll="${MODNAME[k][1]}"><b>+${v.length}</b> ${MODNAME[k][0]}</button>`).join("")
    + (ch.new_moves ? `<button class="pill" data-scroll="#fronts"><b>+${ch.new_moves}</b> ${TX("ruchy na frontach")}</button>` : "");
  el.innerHTML = `<div class="row"><h2>&gt; ${TX("CO NOWEGO")}${ch.since ? ` ${TX("OD")} ${esc(new Date(ch.since).toLocaleString(LOC, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}` : ""}</h2>
    <span class="n">${A(ch.new_items).length} ${TX("nowych depesz ·")} ${A(ch.trend_changes).length} ${TX("zmian statusu ·")} ${A(ch.new_hazards).length} ${TX("nowych zagrożeń")}</span></div>
    ${ch.summary ? `<p>${esc(ch.summary)}</p>` : ""}${nc || trends || mods ? `<div class="row">${nc}${trends}${mods}</div>` : ""}
    ${items.length ? `<div class="row">${items.map(i => `<button class="pill" data-go="n:${i.id}">${esc(i.h)}</button>`).join("")}</div>` : ""}`;
  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { go(b.dataset.go); scrollMap(); }));
  el.querySelectorAll("[data-scroll]").forEach(b => b.addEventListener("click", () => { const t = $(b.dataset.scroll); if (t) t.closest("section").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }));
}
function renderReg() {
  const list = [...A(S.conflicts)].sort((a, b) => TORDER[a.trend] - TORDER[b.trend]);
  rowsInto("#reg", list.map(c => { const t = TREND[c.trend] || TREND.ongoing; return `<li${A((S.changes || {}).new_conflicts).includes(c.id) ? ' class="newrow"' : ""}><button data-go="c:${c.id}"><span>${esc(c.name)}</span>${chip(t[0], t[1])}</button></li>`; }).join(""));
  $("#regCount").textContent = list.length + " " + TX("WĘZŁÓW");
  $("#sitList").innerHTML = [TX("Świat"), TX("Bliski Wschód"), TX("Europa Wschodnia"), TX("Flanka NATO"), TX("Afryka"), TX("Azja i Pacyfik"), TX("Ameryki"), TX("Szlaki morskie"), TX("Cyberprzestrzeń")].concat(list.map(c => c.name)).map(x => `<option value="${esc(x)}">`).join("");
}
function renderShip() {
  const s = A(S.shipping), ord = { closed: 0, restricted: 1, disrupted: 2, open: 3 }, pwAll = F().portwatch || {};
  $("#shipCount").textContent = s.length ? s.filter(x => x.status !== "open").length + " Z " + s.length + " " + TX("ZAKŁÓCONYCH") : "";
  rowsInto("#ship", [...s].sort((a, b) => ord[a.status] - ord[b.status]).map(x => { const st = SHIP[x.status] || SHIP.open, pw = pwAll[x.id];
    return `<li><button data-go="sh:${x.id}"><span class="t">${esc(x.name)}</span>${chip(st[0], st[1])}<span class="sub">${esc(x.metric)}</span>${pw ? `<span class="sub">${TX("AIS (PortWatch): śr.")} ${pw.avg7}${TX("/dobę")}${pw.base ? ` ${TX("· rok temu")} ${pw.base}${TX("/dobę (")}${Math.round((pw.avg7 / pw.base - 1) * 100)}%)` : ""} ${TX("· do")} ${esc(pw.last)}</span><span class="sub">${spark(pw.series.map(r => r[1]), 18)}</span>` : ""}</button></li>`; }).join(""));
}
let calCat = store.get("calCat", "all");
function renderCal() {
  const all = A(S.calendar).map((e, i) => Object.assign({ i }, e)), cats = ["all", ...new Set(all.map(e => e.cat).filter(Boolean))];
  $("#calTabs").innerHTML = cats.map(c => `<button class="btn" data-c="${c}" aria-pressed="${c === calCat}">${c === "all" ? TX("WSZYSTKO") : CAT[c] || c}</button>`).join("");
  $("#calTabs").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { calCat = b.dataset.c; store.set("calCat", calCat); renderCal(); }));
  const list = all.filter(e => (calCat === "all" || e.cat === calCat) && (dayDiff(e.d) == null || dayDiff(e.d) >= -1)).sort((a, b) => { const ka = String(a.d).length === 7 ? a.d + "-32" : String(a.d), kb = String(b.d).length === 7 ? b.d + "-32" : String(b.d); return ka.localeCompare(kb); });
  $("#calCount").textContent = list.length + " " + TX("POZYCJI");
  rowsInto("#cal", list.map(e => { const n = dayDiff(e.d); return `<li><button data-go="cal:${e.i}"><span><span class="cal-d">${esc(fmtDate(e.d))}</span> &nbsp;<span class="t">${esc(e.t)}</span></span><span class="${n != null && n <= 7 ? "amber" : "dim"}">${esc(countdown(e.d))}</span><span class="sub">${esc(CAT[e.cat] || e.cat || "")} · ${esc(e.note || "")}</span></button></li>`; }).join(""));
}
function renderTrend() {
  const h = A(S.threat_history).map(x => ({ t: new Date(x.t), v: x.level })).filter(x => !isNaN(x.t));
  const el = d3.select("#trend"); el.selectAll("*").remove();
  const m = { l: 22, r: 10, t: 8, b: 18 }, w = 320, hh = 110;
  const x = d3.scaleTime().domain(h.length > 1 ? d3.extent(h, d => d.t) : [new Date(Date.now() - 864e5), new Date()]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([1, 5]).range([hh - m.b, m.t]);
  [1, 2, 3, 4, 5].forEach(v => { el.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(v)).attr("y2", y(v)).style("stroke", "var(--phos-faint)").attr("stroke-dasharray", "2 3");
    el.append("text").attr("x", m.l - 6).attr("y", y(v) + 3).attr("text-anchor", "end").style("fill", "var(--phos-dim)").style("font-size", "9px").text(v); });
  if (h.length) {
    el.append("path").attr("d", d3.area().x(d => x(d.t)).y0(y(1)).y1(d => y(d.v)).curve(d3.curveStepAfter)(h)).style("fill", "color-mix(in srgb,var(--red) 14%,transparent)");
    el.append("path").attr("d", d3.line().x(d => x(d.t)).y(d => y(d.v)).curve(d3.curveStepAfter)(h)).style("fill", "none").style("stroke", "var(--red)").attr("stroke-width", 1.6);
    const l = h[h.length - 1]; el.append("circle").attr("cx", x(l.t)).attr("cy", y(l.v)).attr("r", 3.5).style("fill", "var(--amber)");
    const f = d => d.toLocaleDateString(LOC, { day: "2-digit", month: "2-digit" });
    el.append("text").attr("x", m.l).attr("y", hh - 4).style("fill", "var(--phos-dim)").style("font-size", "9px").text(f(h[0].t));
    el.append("text").attr("x", w - m.r).attr("y", hh - 4).attr("text-anchor", "end").style("fill", "var(--phos-dim)").style("font-size", "9px").text(f(l.t));
  }
  $("#trendNote").textContent = h.length > 1 ? `${h.length} ${TX("odczytów")}` : TX("historia rośnie z każdym odczytem");
}
function renderMarkets() {
  const items = A(MK && MK.items);
  $("#markets").innerHTML = items.map(m => {
    if (m.error) return `<div class="mkt"><span class="k">${esc(m.label)}</span><span class="v dim">—</span><span class="n">${TX("brak danych")}</span></div>`;
    const s = A(m.spark), mn = Math.min(...s), mx = Math.max(...s), up = m.change_pct >= 0;
    const pts = s.map((v, i) => `${(i / Math.max(1, s.length - 1)) * 100},${24 - ((v - mn) / ((mx - mn) || 1)) * 20}`).join(" ");
    return `<button class="mkt" data-go="mk:${m.id}"><span class="k">${esc(m.label)}</span><span class="v">${m.price.toLocaleString(LOC, { maximumFractionDigits: m.price < 20 ? 4 : 2 })}</span>
      <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" style="fill:none;stroke:${up ? "var(--red)" : "var(--phos)"}" stroke-width="1.4" vector-effect="non-scaling-stroke"></polyline></svg>
      <span class="n"><span>${esc(m.unit)}</span><span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(m.change_pct).toFixed(2)}%</span></span></button>`;
  }).join("") || ("<div class=\"mkt\">" + "<span class=\"n\">" + TX("Łączenie z danymi rynkowymi…") + "</span>" + "</div>");
  const nb = F().nbp || {}, NBPL = { EUR: "EUR/PLN", GBP: "GBP/PLN", CHF: "CHF/PLN", UAH: "UAH/PLN" };
  $("#markets").insertAdjacentHTML("beforeend", Object.keys(NBPL).filter(c => A(nb[c]).length).map(c => { const s = nb[c], h = s.map(x => x[1]), ch = (h[h.length - 1] / h[0] - 1) * 100;
    return `<button class="mkt" data-go="nbp:${c}"><span class="k">${NBPL[c]} ${TX("· NBP")}</span><span class="v">${h[h.length - 1].toFixed(4).replace(".", ",")}</span>${spark(h, 26)}<span class="n"><span>${s.length} sesji</span><span class="${ch < 0 ? "down" : "up"}">${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1).replace(".", ",")}%</span></span></button>`; }).join(""));
  $("#markets").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { pick(b.dataset.go); if (innerWidth < 1060) $("#detail").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); }));
  $("#mktNote").innerHTML = (S.marketsNote ? `<b class="amber">${TX("DLACZEGO ·")}</b> ${esc(S.marketsNote)}` : "") + (A(S.econ).length ? `<ul class="mini" style="margin-top:6px">${A(S.econ).map((e, i) => `<li><button data-go="ec:${i}">▸ ${esc(e.k)}: <b>${esc(e.v)}</b></button></li>`).join("")}</ul>` : "");
  $("#mktNote").hidden = !(S.marketsNote || A(S.econ).length);
  $("#mktNote").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => pick(b.dataset.go)));
  $("#mkTime").textContent = MK && MK.fetched ? `${(items.find(m => m.source) || {}).source || ""} · ${new Date(MK.fetched).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })}` : TX("na żywo");
  renderRail();
}
async function loadMarkets() { try { MK = await api("/api/markets"); renderMarkets(); } catch (e) {} }

function renderFronts() {
  const fr = A(S.fronts); $("#frCount").textContent = fr.length ? fr.length + " " + TX("TEATRÓW") : "";
  $("#fronts").innerHTML = fr.length ? fr.map(f => `<ul class="rows"><li><button data-go="f:${f.id}"><span class="t">▸ ${esc(f.name)}</span>${chip(TX("STAN") + " " + f.asOf, "var(--amber)")}
      <span class="sub">${Object.entries(f.sides || {}).map(([k, v]) => `<span class="sw" style="background:${COL(v[1])}"></span>${esc(v[0].split(/[(,]/)[0])}`).join(" &nbsp;")}</span></button></li>
      ${A(f.moves).map((m, i) => `<li${m.ai ? ' class="newrow"' : ""}><button data-go="m:${f.id}:${i}"><span><span class="sw" style="background:${COL((f.sides[m.side] || [])[1])}"></span>${esc(m.label)}</span><span class="dim">${esc(m.when)}</span></button></li>`).join("")}</ul>`).join("")
    : ("<p class=\"empty\">" + TX("BRAK DANYCH O FRONTACH W TYM ODCZYCIE") + "</p>");
  $("#fronts").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { go(b.dataset.go); scrollMap(); }));
}
function renderAirwar() {
  const a = S.airwar, el = $("#airwar");
  if (!a || !A(a.days).length) { el.innerHTML = ("<p class=\"empty\">" + TX("BRAK DANYCH W TYM ODCZYCIE") + "</p>"); $("#awCount").textContent = ""; return; }
  const ds = A(a.days), mx = Math.max(...ds.map(d => (d.drones || 0) + (d.missiles || 0)), 1), w = 300 / ds.length;
  const bars = ds.map((d, i) => { const tot = (d.drones || 0) + (d.missiles || 0), dn = Math.min(tot, d.downed || 0), hT = tot / mx * 118, hD = dn / mx * 118, x = i * w + w * .15, bw = w * .7;
    return `<g data-go="aw:${i}" style="cursor:pointer"><rect x="${x}" y="${128 - hT}" width="${bw}" height="${hT}" style="fill:var(--red)"/><rect x="${x}" y="${128 - hD}" width="${bw}" height="${hD}" style="fill:var(--phos-dim)"/>
      <text x="${x + bw / 2}" y="${124 - hT}" text-anchor="middle" style="fill:var(--text);font-family:var(--f-display);font-size:13px">${tot}</text>
      <text x="${x + bw / 2}" y="140" text-anchor="middle" style="fill:var(--phos-dim);font-family:var(--f-display);font-size:12px">${+d.d.slice(8)} ${MON[+d.d.slice(5, 7) - 1]}</text></g>`; }).join("");
  const last = ds[ds.length - 1], lt = (last.drones || 0) + (last.missiles || 0);
  el.innerHTML = `<svg viewBox="0 0 300 144" role="img" aria-label="Liczba dronów i rakiet na noc">${bars}</svg>
    <div class="legend" style="border:0;padding:2px 0"><span><i style="background:var(--phos-dim)"></i>${TX("zestrzelone lub zneutralizowane")}</span><span><i style="background:var(--red)"></i>nieprzechwycone</span></div>
    <div class="kpi"><div><span class="k">${TX("Ostatnia noc")}</span><div class="v">${lt}</div></div><div><span class="k">${TX("Rakiety")}</span><div class="v">${last.missiles ?? "–"}</div></div><div><span class="k">${TX("Obrona")}</span><div class="v">${lt ? Math.round((last.downed || 0) / lt * 100) + "%" : "–"}</div></div></div>
    <p class="note">${esc(a.note)}</p>`;
  $("#awCount").textContent = ds.length + " " + TX("NOCY");
  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => pick(b.dataset.go)));
}
function renderStrikes() { rowsInto("#strikes", A(S.strikes).map((s, i) => `<li${isNewMod("strikes", s.id) ? ' class="newrow"' : ""}><button data-go="st:${i}"><span class="t"><span class="sw" style="background:${s.side === "ru" ? "var(--red)" : "var(--cyan)"}"></span>${esc(s.target)}</span><span class="dim">${esc(s.when || fd(s.d))}</span><span class="sub">${s.side === "ru" ? TX("ROSJA → UKRAINA") : TX("UKRAINA → ROSJA")} · ${esc(s.note)}</span></button></li>`).join("")); }
function renderForces() { const f = A(S.forces); $("#forceCount").textContent = f.length ? f.length + " " + TX("POZYCJI") : "";
  rowsInto("#forces", f.map((x, i) => { const kd = FKIND[x.kind] || ["", ""]; return `<li${isNewMod("forces", x.id) ? ' class="newrow"' : ""}><button data-go="fo:${i}"><span class="t">${esc(x.name)}</span><span class="chip violet">${esc(kd[1])}</span><span class="sub">${esc(x.where)} · ${esc(x.when)} · ${esc(x.note)}</span></button></li>`; }).join("")); }
function renderEF() { const e = A(S.eastflank); $("#efCount").textContent = e.length ? e.length + " " + TX("ZDARZEŃ") : "";
  rowsInto("#ef", e.map((x, i) => `<li${isNewMod("eastflank", x.id) ? ' class="newrow"' : ""}><button data-go="ef:${i}"><span class="t">${esc(x.t)}</span><span class="dim">${esc(fd(x.d))}</span><span class="sub">${esc(KND[x.kind] || x.kind)} · ${esc(x.note)}</span></button></li>`).join("")); }
function renderSky() {
  const f = F(), gj = f.gpsjam || {}; let h = "";
  if (AIR.ok) {
    const d = AIR.d, ac = A(d.ac), st = d.status || {}, now = Date.now() + AIR.skew, cnt = {}; ac.forEach(a => cnt[a.cat] = (cnt[a.cat] || 0) + 1);
    $("#airT").innerHTML = `<span class="livedot"></span>${TX("NA ŻYWO ·")} ${esc(st.src || "")} ${TX("· co")} ${d.interval} s`;
    h += `<li class="hd">${TX("Samoloty wojskowe na żywo ·")} ${ac.length} ${LANG === "en" ? "of" : "z"} ${st.total || "?"} ${TX("nadających")}</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${Object.entries(cnt).map(([k, v]) => `${ACN[k] || k}: ${v}`).join(" · ") || TX("brak danych")}</span></button></li>`;
    const ev = A(d.events).slice(-8).reverse();
    if (ev.length) h += `<li class="hd">${TX("Kontakty w obserwowanych rejonach")}</li>` + ev.map(e => `<li><button data-go="ah:${esc(e.hex)}"><span class="t">${esc(e.msg)}</span><span class="dim">${new Date(e.at).toISOString().slice(11, 16)}</span></button></li>`).join("");
    const lo = ac.filter(a => a.loiter);
    if (lo.length) h += `<li class="hd">${TX("Krążące teraz (orbita / tankowanie / patrol) ·")} ${lo.length}</li>` + lo.map(a => `<li><button data-go="ah:${esc(a.hex)}"><span class="t">${esc(a.flag || "")} ${esc(a.cs || a.hex)} · ${esc(a.desc || (a.model || "").split(" (")[0] || a.t || "")}</span>${chip(ACN[a.cat] || "", ACOL[a.cat] || ACOL.other)}<span class="sub">${TX("promień")} ~${a.loiter.r} km · ${TX("skręt")} ${a.loiter.turn}° · ${fmtLL(a.loiter.lat, a.loiter.lon)}</span></button></li>`).join("");
    const hot = ac.filter(a => NOTABLE.has(a.cat) && !a.ground).slice(0, 16);
    h += `<li class="hd">${TX("Rozpoznanie, tankowce, bombowce ·")} ${hot.length}</li>` + hot.map(a => { const p = airPos(a, now);
      return `<li><button data-go="ah:${esc(a.hex)}"><span class="t">${esc(a.flag || "")} ${esc(a.cs || a.hex)} · ${esc(a.desc || (a.model || "").split(" (")[0] || a.t)}</span><span class="chip" style="color:${ACOL[a.cat]};border-color:${ACOL[a.cat]}">${ACN[a.cat]}</span><span class="sub">${esc(a.country || "")}${a.op ? " · " + esc(a.op) : ""} · ${fmtLL(p[0], p[1])} · ${a.alt != null ? a.alt + " ft" : ""} · ${agoTxt(airAge(a, now))}</span></button></li>`; }).join("");
  } else {
    const ad = f.adsb || {}, ac = A(ad.ac); $("#airT").textContent = ad.t ? TX("MIGAWKA") + " " + ad.t + (AIR.err ? " " + TX("· brak łącza na żywo") : "") : "";
    const cnt = {}; ac.forEach(a => cnt[a.cat] = (cnt[a.cat] || 0) + 1);
    const far = ac.map((a, i) => Object.assign({ i }, a)).filter(a => !(a.lat > 15 && a.lat < 72 && a.lon > -170 && a.lon < -50)).slice(0, 14);
    h += `<li class="hd">${TX("Samoloty wojskowe (ADS-B, migawka) ·")} ${ac.length} ${LANG === "en" ? "of" : "z"} ${ad.total || "?"}</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${Object.entries(cnt).map(([k, v]) => `${ACN[k] || k}: ${v}`).join(" · ") || TX("brak danych")}</span></button></li>`;
    h += far.map(a => `<li><button data-go="ac:${a.i}"><span class="t">${esc(a.cs || a.hex)} · ${esc(a.t)}</span><span class="chip cyan">${ACN[a.cat] || a.cat}</span><span class="sub">${fmtLL(a.lat, a.lon)} · ${a.alt != null ? a.alt + " ft" : ""}</span></button></li>`).join("");
  }
  if (gj.regions) h += `<li class="hd">${TX("Zakłócenia GNSS ·")} ${esc(gj.day || "")} · ${gj.n || 0} ${TX("heksów")}</li>` + Object.entries(gj.regions).map(([k, v]) => `<li><button tabindex="-1" style="cursor:default"><span>${esc(k)}</span><span class="${v > 50 ? "red" : "amber"}">${v}</span></button></li>`).join("");
  h += `<li class="hd">${TX("Przestrzeń powietrzna (EASA / FAA)")}</li>` + A(S.airspace).map(a => { const l = ASL[a.level] || ASL.caution; return `<li${isNewMod("airspace", a.id) ? ' class="newrow"' : ""}><button data-go="asp:${a.id}"><span class="t">${esc(a.name)}</span>${chip(l[0], l[1])}</button></li>`; }).join("");
  rowsInto("#sky", h);
}
function renderPM() { const e = A(F().polymarket);
  $("#pm").innerHTML = e.length ? e.map((x, i) => `<div class="pm-ev"><button data-pm="${i}">▸ ${esc(x.t)}</button>${x.m.slice(0, 4).map(m => `<div class="pbar"><span>${esc(m.q)}</span><i><b style="width:${pct(m.p)};background:${m.p >= .5 ? "var(--phos)" : m.p >= .2 ? "var(--amber)" : "var(--phos-dim)"}"></b></i><span>${pct(m.p)}</span></div>`).join("")}</div>`).join("") : ("<p class=\"empty\">" + TX("BRAK DANYCH W TYM ODCZYCIE") + "</p>");
  $("#pm").querySelectorAll("[data-pm]").forEach(b => b.addEventListener("click", () => pick("pm:" + b.dataset.pm))); }
function renderNet() { rowsInto("#net", A(F().ioda).slice(0, 15).map((x, i) => `<li><button data-go="net:${i}"><span class="t">${esc(x.name)}</span><span class="${x.score >= 8 ? "red" : x.score >= 6 ? "amber" : "dim"}">${x.score}</span><span class="sub">${x.events} ${TX("zdarzeń ·")} ${esc(A(x.src).join(", "))}</span></button></li>`).join("")); }
function renderNuke() { const n = A(S.nuclear); $("#nkCount").textContent = n.length ? n.filter(x => x.status === "crit").length + " " + TX("KRYTYCZNE") : "";
  rowsInto("#nuke", n.map((x, i) => { const st = NKS[x.status] || NKS.unknown; return `<li${isNewMod("nuclear", x.id) ? ' class="newrow"' : ""}><button data-go="nk:${i}"><span class="t">${esc(x.name)}</span>${chip(st[0], st[1])}<span class="sub">${esc(x.note)}</span></button></li>`; }).join("")); }
function renderSanc() { const s = A(S.sanctions), o = A(F().ofac); $("#sancCount").textContent = (s.length + o.length) + " " + TX("POZYCJI");
  rowsInto("#sanc", (s.length ? `<li class="hd">${TX("Najważniejsze (analiza)")}</li>` + s.map((x, i) => `<li${isNewMod("sanctions", x.id) ? ' class="newrow"' : ""}><button data-go="sanc:${i}"><span class="t">${esc(x.t)}</span><span class="chip amber">${esc(x.who)}</span><span class="sub">${esc(fd(x.d))} · ${esc(x.note)}</span></button></li>`).join("") : "")
    + (o.length ? `<li class="hd">${TX("OFAC – lista działań (automat, po angielsku)")}</li>` + o.map((x, i) => `<li><button data-go="ofac:${i}"><span>${esc(x.t)}</span><span class="dim">${esc(fd(x.d))}</span></button></li>`).join("") : "")); }
function renderKev() { rowsInto("#kev", A(F().kev).map((v, i) => `<li><button data-go="kev:${i}"><span class="t">${esc(v.vendor)} · ${esc(v.product)}</span><span class="${v.ransom ? "red" : "dim"}">${v.ransom ? TX("RANSOMWARE") : esc(fd(v.added))}</span><span class="sub">${esc(v.cve)} · ${esc(v.name)}</span></button></li>`).join("")); }
function renderHum() { const h = A(S.humanitarian), f = F(), w = A(f.who), r = A(f.reliefweb); $("#humCount").textContent = (h.length + w.length) + " " + TX("ALERTÓW");
  rowsInto("#hum", (h.length ? `<li class="hd">${TX("Kryzysy humanitarne")}</li>` + h.map((x, i) => `<li${isNewMod("humanitarian", x.id) ? ' class="newrow"' : ""}><button data-go="hum:${i}"><span class="t">${esc(x.t)}</span><span class="dim">${esc(fd(x.d))}</span><span class="sub">${esc(x.where)} · ${esc(x.note)}</span></button></li>`).join("") : "")
    + (w.length ? `<li class="hd">${TX("WHO – ogniska chorób")}</li>` + w.map((x, i) => `<li><button data-go="who:${i}"><span class="t">${esc(x.dis)}</span><span class="dim">${esc(fd(x.d))}</span><span class="sub">${esc(x.country)}</span></button></li>`).join("") : "")
    + (r.length ? `<li class="hd">${TX("ReliefWeb – najnowsze raporty (po angielsku)")}</li>` + r.slice(0, 10).map((x, i) => `<li><button data-go="rw:${i}"><span>${esc(x.t)}</span><span class="dim">${esc(x.country)}</span></button></li>`).join("") : "")); }
function renderTrv() { const T2 = F().travel || {};
  rowsInto("#trv", (A(T2.us).length ? `<li class="hd">${TX("USA – podniesione do poziomu 3–4 (21 dni)")}</li>` + A(T2.us).map((x, i) => `<li><button data-go="trv:${i}"><span class="t">${esc(x.country)}</span><span class="${x.lvl >= 4 ? "red" : "amber"}">${TX("POZIOM")} ${x.lvl}</span><span class="sub">${esc(fd(x.d))} · ${esc(x.lbl)}</span></button></li>`).join("") : "")
    + (A(T2.lvl4).length ? `<li class="hd">${TX("USA – „nie podróżuj” (")}${T2.lvl4.length})</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${esc(T2.lvl4.join(", "))}</span></button></li>` : "")
    + (A(T2.uk).length ? `<li class="hd">${TX("UK FCDO – ostatnio zaktualizowane")}</li>` + A(T2.uk).map(x => `<li><a class="rowlink" href="${esc(x.u)}" target="_blank" rel="noopener"><span>${esc(x.country)}</span><span class="dim">${esc(fd(x.d))}</span></a></li>`).join("") : "")); }
function renderHaz() { const h = A(S.hazards), f = F(); $("#hazCount").textContent = (h.length + A(f.gdacs).length) + " " + TX("ZDARZEŃ");
  const ic = { quake: "▲", volcano: "◆", storm: "●" };
  rowsInto("#haz", h.map((x, i) => `<li><button data-go="h:${i}"><span><span class="amber">${ic[x.kind] || "•"}</span> ${esc((LANG === "en" ? x.name || x.name_pl : x.name_pl || x.name))}</span><span class="dim">${esc(x.mag)} · ${esc(x.when)}</span></button></li>`).join("")
    + (A(f.gdacs).length ? `<li class="hd">${TX("Alerty GDACS (10 dni)")}</li>` + A(f.gdacs).map((g, i) => `<li><button data-go="gd:${i}"><span class="t">${esc(g.kind)}: ${esc(g.name)}</span><span class="${g.lvl === "Red" ? "red" : "amber"}">${esc(g.alert)}</span><span class="sub">${esc(String(g.country || "").slice(0, 90))}</span></button></li>`).join("") : "")
    + (A(f.nhc).length ? `<li class="hd">${TX("NOAA NHC – aktywne cyklony")}</li>` + A(f.nhc).map((n, i) => `<li><button data-go="nhc:${i}"><span class="t">${esc(n.cls)} ${esc(n.name)}</span><span class="red">${n.kmh} km/h</span></button></li>`).join("") : "")); }
function renderLaunch() { const ll = A(F().ll2);
  rowsInto("#launch", ll.map(l => { const d = new Date(l.net), ok = l.past && /succ/i.test(l.st || ""), fail = l.past && /fail/i.test(l.st || "");
    return `<li><button tabindex="-1" style="cursor:default"><span><b class="cal-d ${l.past ? "" : "amber"}">${d.getUTCDate()} ${MON[d.getUTCMonth()]}</b> &nbsp;${esc(l.name)}</span><span class="${fail ? "red" : ok ? "ok" : "dim"}">${l.past ? (ok ? "✓" : fail ? "✕" : esc(l.st)) : esc(l.st || "")}</span><span class="sub">${esc(l.prov || "")} · ${esc(l.pad || "")}${l.past ? "" : " · " + d.toISOString().slice(11, 16) + " " + TX("UTC")}</span></button></li>`; }).join("")); }
function srcList() {
  const st = A(F().status).map(s => ({ name: s.name, url: s.url, rel: s.rel, note: s.note, auto: "feed",
    state: s.ok ? (s.stale ? TX("STARE (z") + " " + s.stale + ")" : TX("OK ·") + " " + (s.n != null ? s.n + " " + TX("rekordów ·") + " " : "") + s.t) : (s.stale ? TX("BŁĄD, pokazuję dane z") + " " + s.stale : TX("BŁĄD:") + " " + (s.err || "")), cls: s.ok && !s.stale ? "ok" : s.stale ? "stale" : "err" }));
  const rss = A((STATUS && A(STATUS.sources).length ? STATUS.sources : S.sources_report)).map(s => ({ name: s.source, url: "", rel: "", note: TX("wiadomości analizowane przez lokalne AI"), auto: "rss",
    state: s.error ? TX("BŁĄD:") + " " + s.error : TX("OK ·") + " " + s.count + " " + TX("wiadomości"), cls: s.error ? "err" : "ok" }));
  return st.concat(rss);
}
function renderSrc() {
  const Ls = srcList(), f = F();
  $("#srcCount").textContent = A(f.status).filter(s => s.ok).length + "/" + A(f.status).length + " " + TX("FEEDÓW OK") + (f.t ? " · " + f.t.replace("T", " ") : "");
  let h = "", last = "";
  Ls.forEach((s, i) => { if (s.auto !== last) { h += s.auto === "feed" ? `<li class="hd">${TX("Feedy automatyczne · A = oficjalne lub naukowe, B = dobre z zastrzeżeniami, C = sygnał pomocniczy")}</li>` : `<li class="hd">${TX("Źródła wiadomości dla AI (ostatnia analiza)")}</li>`; last = s.auto; }
    h += `<li><button data-go="src:${i}"><span class="t">${esc(s.name)}</span><span class="${s.cls}">● ${s.cls === "ok" ? TX("OK") : s.cls === "stale" ? TX("STARE") : TX("BŁĄD")}${s.rel ? " · " + esc(s.rel) : ""}</span><span class="sub">${esc(s.state)}</span></button></li>`; });
  rowsInto("#srcs", h);
}

/* ------------------------------------------------------------ STATUS */
let seenFinished;
function renderSys() {
  if (!STATUS) return;
  const e = STATUS.engine, hw = e.hardware, j = STATUS.job, pull = e.pull || {};
  $("#sysState").textContent = e.ready || (e.cloud && e.cloud_ok) ? TX("AI GOTOWE") : e.backend ? TX("BRAK MODELU") : TX("BRAK AI");
  $("#sys").innerHTML = `<dl>
    <dt>${TX("GPU")}</dt><dd>${esc(hw.gpu_name)}${hw.vram_gb ? ` · ${hw.vram_gb} ${TX("GB VRAM")}` : ""}</dd>
    <dt>${TX("RAM")}</dt><dd>${hw.ram_gb} ${TX("GB ·")} ${hw.cores} ${TX("wątków")}</dd>
    <dt>${TX("SILNIK")}</dt><dd>${e.backend ? esc(e.backend === "ollama" ? TX("Ollama") : e.backend === "lmstudio" ? TX("LM Studio") : e.backend) : ("<span class=\"red\">" + TX("nie wykryto: zainstaluj Ollamę (ollama.com) i uruchom ponownie") + "</span>")}</dd>
    <dt>${TX("MODEL")}</dt><dd>${e.model ? esc(e.model) : '<span class="red">brak</span>'}</dd>
    ${e.cloud ? `<dt>${TX("CHMURA")}</dt><dd>${esc(e.cloud)} · <span class="${e.cloud_ok ? "" : "red"}">${e.cloud_ok ? TX("gotowa") : TX("przerwa – lokalny model")}</span><br><span class="dim">${[["main", TX("analiza")], ["ask", TX("pytania")], ["bg", TX("AI w tle")]].filter(x => (e.cloud_use || {})[x[0]]).map(x => x[1]).join(", ") || TX("nic nie wysyła")}</span></dd>` : ""}
    <dt>${TX("ZALECANY")}</dt><dd>${esc(e.recommended)}${e.recommended_size_gb ? ` (${e.recommended_size_gb} ${TX("GB)")}` : ""}<br><span class="dim">${esc(e.reason)}</span></dd>
    ${STATUS.srctest && STATUS.srctest.at ? `<dt>${TX("ŹRÓDŁA")}</dt><dd><span class="srcsum" id="srcSum" title="${TX("Otwórz ŹRÓDŁA I INTEGRACJE")}">${STATUS.srctest.ok} OK · <span class="${STATUS.srctest.err ? "red" : ""}">${STATUS.srctest.err} ${TX("z błędem")}</span></span> <span class="dim">· ${TX("test")} ${hm(STATUS.srctest.at)}</span></dd>` : ""}
    <dt>${TX("NASTĘPNY")}</dt><dd>${STATUS.next ? new Date(STATUS.next).toLocaleString(LOC, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</dd></dl>
    ${e.suggest_pull ? `<div class="dbtns"><button class="btn" id="pullBtn" ${pull.active ? "disabled" : ""}>${pull.active ? `${TX("POBIERANIE")} ${pull.pct}%` : `${TX("POBIERZ")} ${esc(e.recommended)}`}</button></div>` : ""}
    ${pull.status && pull.status !== "gotowe" ? `<span class="dim">${esc(pull.status)}</span>` : ""}
    <details><summary>${TX("DZIENNIK")}</summary><pre>${esc(A(STATUS.log).slice(-50).join("\n"))}</pre></details>`;
  const ss = $("#srcSum"); if (ss) ss.addEventListener("click", () => $("#intgOpen").click());
  const pb = $("#pullBtn"); if (pb) pb.addEventListener("click", async () => { beep(1000); await api("/api/model/pull", {}); pollStatus(); });
  $("#jobbar").hidden = !j.running; $("#jobfill").style.width = j.pct + "%"; $("#jobtext").textContent = `${TX("ANALIZA:")} ${j.step} · ${j.pct}%`;
  $("#refreshBtn").disabled = j.running; $("#refreshBtn").textContent = j.running ? TX("ANALIZA TRWA…") : TX("ODŚWIEŻ ANALIZĘ");
  if (seenFinished === undefined) seenFinished = j.finished;
  else if (j.finished !== seenFinished) { seenFinished = j.finished; doneChime(); if (!ARCH) loadState(true); }
}
let pollT = null;
async function pollStatus() {
  clearTimeout(pollT);
  try { STATUS = await api("/api/status"); renderSys(); } catch (e) { $("#sysState").textContent = TX("SERWER NIEDOSTĘPNY"); }
  const busy = STATUS && (STATUS.job.running || (STATUS.engine.pull || {}).active);
  pollT = setTimeout(pollStatus, busy ? 2500 : 20000);
}
$("#refreshBtn").addEventListener("click", async () => { beep(1100); await api("/api/refresh", {}); pollStatus(); });

/* ------------------------------------------------------------ ZAPYTANIA I SITREP */
const HINTS = [TX("Dlaczego Ormuz jest zamknięty?"), TX("Co się zmieniło na froncie w Ukrainie?"), TX("Jak wojna z Iranem wpływa na ceny w Europie?"), TX("Co się dzieje na wschodniej flance NATO?"), TX("Które konflikty eskalują i dlaczego?")];
$("#qHints").innerHTML = HINTS.map(h => `<button>${esc(h)}</button>`).join("");
$("#qHints").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { $("#q").value = b.textContent; ask(); }));
async function streamTo(url, body, el, onDone, signal) {
  el.hidden = false; el.textContent = TX("> PRZETWARZANIE…"); let text = ""; burble(true);
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const rd = r.body.getReader(), dec = new TextDecoder();
    for (;;) { const { done, value } = await rd.read(); if (done) break; const part = dec.decode(value, { stream: true }); if (part && burbleT) burble(false); chatter(part.length); if (/\n/.test(part)) sfx("carriage", .1); text += part; el.textContent = text.replace(/\n?REF:.*$/s, "") || TX("> PRZETWARZANIE…"); }
  } catch (e) { burble(false); if (e.name === "AbortError") return; el.textContent = TX("Brak połączenia z serwerem KRONOS-7."); sfx("error"); return; }
  burble(false);
  el.textContent = text.replace(/\n?REF:.*$/s, "").trim(); sfx("carriage"); sfx("blip", 1568, .3); if (onDone) onDone(text);
}
function ask() {
  const q = $("#q").value.trim(); if (!q) return; beep(1000, .06);
  if (HIST_Q.test(q)) return askHistory();
  streamTo("/api/ask", { q }, $("#qOut"), text => { const m = text.match(/REF:\s*(.+)$/m); if (!m) return;
    const ids = m[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    const c = A(S.conflicts).find(x => ids.includes(x.id)); if (c) { go("c:" + c.id); return; }
    const it = ids.find(i => A(S.items).some(x => x.id === i)); if (it) go("n:" + it); });
}
$("#qGo").addEventListener("click", ask);
$("#q").addEventListener("keydown", e => { if (e.key === "Enter") ask(); else if (e.key.length === 1) sfx("key", 0, .8); });
/* SITREP w oknie: strumień, kopiuj, czytaj, drukuj */
let sitCtl = null, sitBusy = false, sitFocus = null, sitText = "";
function sitOpen() { sitFocus = document.activeElement; $("#sitModal").hidden = false; $("#sitClose").focus(); }
function sitClose() { burble(false); if (sitCtl) sitCtl.abort(); sitCtl = null; sitBusy = false; stopSpeak(); $("#sitModal").hidden = true; if (sitFocus) sitFocus.focus(); }
function sitButtons() { ["#sitCopy", "#sitSpeak", "#sitPrint", "#sitAgain"].forEach(b => $(b).disabled = sitBusy); }
function sitrep() {
  const r = $("#sitIn").value.trim() || TX("Świat"); beep(1000, .06);
  if (sitCtl) sitCtl.abort(); sitCtl = new AbortController(); sitBusy = true; sitText = "";
  const t = new Date(), op = opCall();
  $("#sitTitle").textContent = TX("> SITREP ·") + " " + r.toUpperCase();
  $("#sitMeta").textContent = `${t.toLocaleString(LOC, { dateStyle: "short", timeStyle: "short" })}${op ? " " + TX("· dla") + " " + op : ""} ${TX("· rdzeń:")} ${(STATUS && STATUS.engine && STATUS.engine.model) || TX("brak AI")}`;
  sitButtons(); if ($("#sitModal").hidden) sitOpen();
  streamTo("/api/sitrep", { region: r }, $("#sitOut"), text => {
    sitText = text.replace(/\n?REF:.*$/s, "").trim(); sitBusy = false; sitButtons(); sitCtl = null;
    $("#sitLast").hidden = false; }, sitCtl.signal)
    .finally(() => { if (sitBusy && !$("#sitModal").hidden) { sitBusy = false; sitButtons(); } });
}
$("#sitGo").addEventListener("click", sitrep);
$("#sitClose").addEventListener("click", sitClose);
$("#sitAgain").addEventListener("click", sitrep);
$("#sitReopen").addEventListener("click", () => { beep(900); sitOpen(); });
$("#sitModal").addEventListener("click", e => { if (e.target.id === "sitModal") sitClose(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sitModal").hidden) sitClose(); });
$("#sitCopy").addEventListener("click", async () => {
  const txt = $("#sitTitle").textContent.replace(/^> /, "") + "\n" + $("#sitMeta").textContent + "\n\n" + $("#sitOut").textContent;
  try { await navigator.clipboard.writeText(txt); $("#sitCopy").textContent = TX("SKOPIOWANO"); } catch (e) { $("#sitCopy").textContent = TX("BŁĄD SCHOWKA"); }
  beep(1400, .05); setTimeout(() => $("#sitCopy").textContent = TX("KOPIUJ"), 1500);
});
$("#sitSpeak").addEventListener("click", () => {
  if (SPK.on) { stopSpeak(); return; }
  speak($("#sitOut").textContent, { onstart: () => $("#sitSpeak").textContent = TX("STOP"), onend: () => $("#sitSpeak").textContent = TX("CZYTAJ") });
});
$("#sitPrint").addEventListener("click", () => { document.body.classList.add("print-sit"); window.print(); setTimeout(() => document.body.classList.remove("print-sit"), 500); });
$("#sitIn").addEventListener("keydown", e => { if (e.key === "Enter") sitrep(); });

/* ------------------------------------------------------------ BRIEFING GŁOSOWY */
let speaking = false;
$("#speakBtn").addEventListener("click", () => {
  if (speaking) { stopSpeak(); return; }
  beep(800, .1);
  speak(S.briefing || TX("Brak briefingu. Uruchom analizę lokalnego AI."), {
    onstart: () => { speaking = true; $("#speakBtn").setAttribute("aria-pressed", "true"); $("#speakBtn").textContent = TX("ZATRZYMAJ ODCZYT"); },
    onend: () => { speaking = false; $("#speakBtn").setAttribute("aria-pressed", "false"); $("#speakBtn").textContent = TX("ODCZYTAJ BRIEFING"); } });
});

/* ------------------------------------------------------------ TRYB EKRANU */
const SLIDES = [{ s: "map", v: "map" }, { s: "map", v: "chain" }, { s: "feed" }, { s: "panels" }, { s: "panels2" }, { s: "war" }, { s: "war2" }, { s: "watch" }, { s: "watch2" }];
let slideI = 0, slideT = null;
function showSlide() { const sl = SLIDES[slideI % SLIDES.length]; $$("[data-slide]").forEach(e => e.classList.toggle("on", e.dataset.slide === sl.s)); if (sl.v) setView(sl.v); window.scrollTo(0, 0); }
$("#screenBtn").addEventListener("click", () => {
  const on = !document.body.classList.contains("screen");
  document.body.classList.toggle("screen", on); $("#screenBtn").setAttribute("aria-pressed", on); beep(900);
  if (on) { slideI = 0; showSlide(); slideT = setInterval(() => { slideI++; showSlide(); }, 20000); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} }
  else { clearInterval(slideT); $$("[data-slide]").forEach(e => e.classList.remove("on")); setView("map"); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("screen")) $("#screenBtn").click(); });

/* ------------------------------------------------------------ ARCHIWUM */
function fillArchive() {
  const list = A(CURRENT && CURRENT.archive), cur = $("#day").value;
  $("#day").innerHTML = `<option value="">${TX("BIEŻĄCY")}</option>` + list.slice().reverse().map(n => { const m = n.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/); return `<option value="${n}">${m ? `${m[3]}.${m[2]} ${m[4]}:${m[5]}` : n}</option>`; }).join("");
  if (ARCH) $("#day").value = cur;
}
$("#day").addEventListener("change", async () => {
  const v = $("#day").value; beep(500); if (!v) return backToCurrent();
  try { S = await api("/api/archive/" + v); ARCH = true; $("#archbar").hidden = false; $("#archname").textContent = $("#day").selectedOptions[0].textContent; selected = null; renderAll(); } catch (e) {}
});
function backToCurrent() { ARCH = false; $("#archbar").hidden = true; $("#day").value = ""; S = CURRENT; selected = null; renderAll(); }
$("#archBack").addEventListener("click", backToCurrent);

/* ------------------------------------------------------------ CAŁOŚĆ */
function renderFoot() {
  $("#foot").innerHTML = `${TX("Odczyt:")} ${esc(S.stamp ? new Date(S.stamp).toLocaleString(LOC) : "—")}${TX(". Online: wiadomości RSS, 16 feedów automatycznych (PortWatch, IODA, ADS-B, GDACS, CISA, FIRMS, Launch Library, NBP, GPSJam, WHO, NHC, ostrzeżenia podróżne, OFAC, ReliefWeb, Polymarket, CelesTrak), USGS, AMSAT oraz ceny rynkowe na żywo. Analiza, tłumaczenia, fronty, moduły i scenariusze: lokalny model AI")}${S.model ? " (" + esc(S.model) + ")" : ""}${TX(". Linie frontów, pozycje sił i punkty uderzeń są przybliżone. Poziom napięcia, stan szlaków, łańcuch przyczyn i scenariusze to oceny systemu, nie oficjalne wskaźniki.")}`;
}
function renderPanels() {
  renderRail(); renderChanges(); tabs(); renderFeed(); renderReg(); renderShip(); renderCal(); renderTrend(); renderMarkets();
  renderFronts(); renderAirwar(); renderStrikes(); renderForces(); renderEF(); renderSky(); renderPM(); renderNuke(); renderSanc(); renderKev(); renderHum(); renderNet(); renderTrv(); renderHaz(); renderLaunch(); renderSrc(); renderFoot();
}
function renderAll() { renderPanels(); buildMap(); buildChain(); setView(view); if (selected) pick(selected, true); else idleDetail(); }
async function loadState(keepSel) {
  try { CURRENT = await api("/api/state"); } catch (e) { $("#foot").textContent = TX("Nie można połączyć się z serwerem KRONOS-7. Uruchom start.bat."); return; }
  const before = (S && S.threat && S.threat.level) || 0, after = (CURRENT.threat && CURRENT.threat.level) || 0;
  if (!ARCH) { S = CURRENT; if (!keepSel) selected = null; fillArchive(); renderAll(); } else fillArchive();
  if (keepSel && after > before && before > 0) alarmBurst(after >= 4 ? 4 : 2);
}

/* ------------------------------------------------------------ OPERATOR */
let SET = null;
const opCall = () => (SET && SET.callsign) || "";
function renderOp() { $("#opName").textContent = opCall() || TX("NIEZNANY"); }
async function loadSettings() { try { SET = await api("/api/settings"); if (SET.language && SET.language !== LANG) { if (store.get("lang", null) == null) { store.set("lang", SET.language); location.reload(); } else if (!SOLO) saveSettings({ language: LANG }); } } catch (e) { SET = { callsign: "", configured: false }; } renderOp(); return SET; }
async function saveSettings(body) {
  try { const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json());
    if (r.settings) { SET = r.settings; renderOp(); } return r; } catch (e) { return { ok: false, error: TX("Brak połączenia z serwerem.") }; }
}
let lastFocus = null;
async function openSettings() {
  beep(900); lastFocus = document.activeElement; await loadSettings();
  $("#setCall").value = SET.callsign || ""; $("#setName").value = SET.name || "";
  const t = A(SET.refresh_times); ["#setT1", "#setT2", "#setT3"].forEach((s2, i) => $(s2).value = t[i] || "");
  $("#setModel").innerHTML = [`<option value="auto">${TX("AUTOMATYCZNIE (zalecany:")} ${esc(SET.recommended || "?")})</option>`].concat(A(SET.installed).map(m => `<option value="${esc(m)}">${esc(m)}</option>`)).join("");
  $("#setModel").value = A(SET.installed).includes(SET.model) ? SET.model : "auto";
  $("#setPull").checked = !!SET.auto_pull; $("#setMsg").textContent = "";
  $("#setAiBg").value = SET.ai_bg || "after"; $("#setUnload").checked = !!SET.ai_unload; $("#setEco").checked = ECO; $("#setBgPause").checked = BGPAUSE;
  $("#setLang").value = LANG;
  $("#setScope").value = SET.ais_scope || "world";
  $("#setQth").value = SET.qth ? (SET.qth.loc || `${SET.qth.lat}, ${SET.qth.lon}`) : "";
  $("#setAis").value = ""; $("#setAis").placeholder = SET.ais_key ? `${TX("klucz ustawiony (")}${SET.ais_key}${TX(") – wklej nowy, aby zmienić")}` : TX("wklej klucz"); $("#setAisClr").hidden = !SET.ais_key;
  $("#setVol").value = Math.round(SND.vol * 100); $("#setHum").checked = SND.hum; $("#setChat").checked = SND.chatter;
  fillNotify();
  $("#settings").hidden = false; $("#setCall").focus();
}
function closeSettings() { $("#settings").hidden = true; if (lastFocus) lastFocus.focus(); }
$("#setBtn").addEventListener("click", openSettings);
$("#setClose").addEventListener("click", closeSettings);
$("#settings").addEventListener("click", e => { if (e.target.id === "settings") closeSettings(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#settings").hidden) closeSettings(); });
function applySound() {
  SND.vol = +$("#setVol").value / 100; SND.hum = $("#setHum").checked; SND.chatter = $("#setChat").checked; store.set("sound", SND);
  if (SE) SE.setVol(SND.vol); if (SND.hum && audioOn && !humH) hum(true); else if (!SND.hum && humH) hum(false);
}
$("#setVol").addEventListener("input", () => { applySound(); beep(1200, .06); });
$("#setHum").addEventListener("change", applySound);
$("#setChat").addEventListener("change", () => { applySound(); chatter(30); });
$("#setAisClr").addEventListener("click", async () => { const r = await saveSettings({ ais_clear: true }); $("#setMsg").textContent = r.ok ? TX("Klucz usunięty.") : r.error; $("#setAisClr").hidden = true; $("#setAis").placeholder = TX("wklej klucz"); });
$("#setEco").addEventListener("change", () => setEco($("#setEco").checked));
$("#setBgPause").addEventListener("change", () => { BGPAUSE = $("#setBgPause").checked; store.set("bgpause", BGPAUSE); bgState(); });
$("#setForm").addEventListener("submit", async e => {
  e.preventDefault(); applySound();
  const newLang = $("#setLang").value;
  const r = await saveSettings({ ...notifyBody(), qth: $("#setQth").value, ais_scope: $("#setScope").value, language: newLang, aisstream_key: $("#setAis").value.trim(), callsign: $("#setCall").value, name: $("#setName").value, model: $("#setModel").value, auto_pull: $("#setPull").checked, ai_bg: $("#setAiBg").value, ai_unload: $("#setUnload").checked,
    refresh_times: ["#setT1", "#setT2", "#setT3"].map(s2 => $(s2).value).filter(Boolean) });
  if (r.ok) { beep(1400, .08); $("#setMsg").textContent = TX("Zapisano."); if (newLang !== LANG) { store.set("lang", newLang); setTimeout(() => location.reload(), 400); return; } pollStatus(); computePasses(); setTimeout(closeSettings, 600); }
  else { beep(300, .2, "sawtooth"); $("#setMsg").textContent = r.error || TX("Nie udało się zapisać."); }
});

/* --- powiadomienia (Telegram / Discord) i dostęp z sieci lokalnej – część okna OPERATOR */
function fillNotify() {
  $("#setTg").value = ""; $("#setTg").placeholder = SET.tg_token ? `${TX("token ustawiony (")}${SET.tg_token}${TX(") – wklej nowy, aby zmienić")}` : TX("token bota Telegram"); $("#setTgClr").hidden = !SET.tg_token;
  $("#setTgChat").value = SET.tg_chat || "";
  $("#setDc").value = ""; $("#setDc").placeholder = SET.discord ? `${TX("webhook ustawiony (")}${SET.discord}${TX(") – wklej nowy, aby zmienić")}` : "https://discord.com/api/webhooks/…"; $("#setDcClr").hidden = !SET.discord;
  const on = new Set(A(SET.notify_kinds));
  $("#setKinds").innerHTML = Object.entries(SET.notify_all || {}).map(([k, n]) => `<label class="chk"><input type="checkbox" data-kind="${k}"${on.has(k) ? " checked" : ""}> ${esc(n)}</label>`).join("");
  $("#setNtMsg").textContent = SET.notify_err ? TX("Ostatni błąd:") + " " + SET.notify_err : "";
  $("#setLan").checked = !!SET.lan; $("#setPin").value = ""; $("#setPin").placeholder = SET.lan_pin ? TX("PIN ustawiony – wpisz nowy, aby zmienić") : TX("PIN 4–8 cyfr");
  const urls = A(SET.lan_urls);
  $("#setLanUrl").innerHTML = SET.lan ? (urls.length ? `${TX("Na telefonie (ta sama sieć Wi-Fi) otwórz:")} <b>${urls.map(esc).join(" · ")}</b>. ${TX("W przeglądarce wybierz „Dodaj do ekranu głównego”, żeby mieć ikonę jak aplikacja.")}` : TX("Nie udało się ustalić adresu w sieci lokalnej.")) + " " + TX("Zmiana działa po ponownym uruchomieniu KRONOS-a.")
    : TX("Wyłączone: terminal działa tylko na tym komputerze.");
}
const notifyBody = () => {
  const b = { tg_chat: $("#setTgChat").value.trim(), notify_kinds: $$("#setKinds [data-kind]").filter(i => i.checked).map(i => i.dataset.kind), lan: $("#setLan").checked };
  if ($("#setTg").value.trim()) b.tg_token = $("#setTg").value.trim();
  if ($("#setDc").value.trim()) b.discord = $("#setDc").value.trim();
  if ($("#setPin").value.trim()) b.lan_pin = $("#setPin").value.trim();
  return b;
};
$("#setTgClr").addEventListener("click", async () => { await saveSettings({ clear_tg_token: true }); fillNotify(); });
$("#setDcClr").addEventListener("click", async () => { await saveSettings({ clear_discord: true }); fillNotify(); });
$("#setNtTest").addEventListener("click", async () => {
  const m = $("#setNtMsg"); m.textContent = TX("Zapisuję i wysyłam…");
  const r = await saveSettings(notifyBody()); if (!r.ok) { m.textContent = r.error || TX("Nie udało się zapisać."); return; }
  fillNotify(); let t = null; try { t = await api("/api/notify/test", {}); } catch (e) {}
  m.textContent = t && t.ok ? TX("Wysłano – sprawdź telefon.") : (t && t.error) || TX("Nie udało się wysłać.");
});

/* --- XENEON EDGE (2560×720) i inne ekrany panoramiczne */
const XEN = new URLSearchParams(location.search).get("xeneon") === "1";
function applyXen() { const on = XEN || !!LAY.xeneon; document.body.classList.toggle("xeneon", on); $("#layXen").setAttribute("aria-pressed", on); }
$("#layXen").addEventListener("click", () => { LAY.xeneon = !LAY.xeneon; applyLayout(); applyXen(); sfx("click"); });
$("#layXenWin").addEventListener("click", () => { sfx("click"); window.open("/?xeneon=1", "kronos7-xeneon", "popup=yes,width=2560,height=720,left=0,top=0"); });
applyXen();

/* --- POLECENIA GŁOSOWE (rozpoznawanie mowy przeglądarki; w Chrome dźwięk przetwarzają serwery Google) */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, listening = false;
const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").trim();
function voiceSay(txt) { airToast({ at: Date.now(), kind: "", head: TX("GŁOS"), msg: "🎙 " + txt }); }
function voiceCmd(raw) {
  const t = norm(raw), has = (...w) => w.some(x => t.startsWith(norm(x)) || t === norm(x)), rest = (...w) => { for (const x of w) { const n = norm(x); if (t.startsWith(n)) return raw.slice(x.length).trim(); } return ""; };
  voiceSay(raw);
  if (has("sitrep", "raport sytuacyjny", "situation report")) { $("#sitIn").value = rest("sitrep", "raport sytuacyjny", "situation report") || TX("Świat"); return sitrep(); }
  if (has("raport dzienny", "daily report")) return window.open("/report", "_blank");
  if (has("odswiez", "refresh", "nowa analiza", "new analysis")) return $("#refreshBtn").click();
  if (has("briefing", "odczytaj", "read briefing")) return $("#speakBtn").click();
  if (has("stop", "cisza", "silence")) { stopSpeak(); stopKlaxon(); return; }
  if (has("pelny ekran", "full screen", "fullscreen")) return toggleFs();
  if (has("globus", "globe", "mapa plaska", "flat map")) return $("#projBtn").click();
  if (has("odtworz", "replay", "odtwarzanie")) return replayOpen();
  if (has("na zywo", "live")) return replayClose();
  if (has("przeloty", "passes", "satelity nad", "satellite passes")) { const p = $("#passes"); if (p) p.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  if (has("filtry", "filters")) return openFilters();
  const lay = rest("warstwa", "layer", "pokaz warstwe", "show layer");
  if (lay) { const L2 = LAYERS.find(l => norm(l[1]).startsWith(norm(lay).slice(0, 4))); if (L2) { $(`[data-layer="${L2[0]}"]`).click(); return; } }
  const th = rest("pokaz", "show", "przejdz do", "go to");
  if (th) { const T3 = THEATERS.find(x => norm(x[1]).includes(norm(th)) || norm(th).includes(norm(x[1]).split(" ")[0])); if (T3) { setView("map"); return setTheater(T3[0], true); } }
  $("#q").value = rest("pytanie", "zapytaj", "question", "ask") || raw; ask();
}
function voiceToggle() {
  if (!SR) { voiceSay(TX("Ta przeglądarka nie obsługuje rozpoznawania mowy (użyj Chrome lub Edge).")); return; }
  if (listening) { recog.stop(); return; }
  recog = new SR(); recog.lang = LANG === "en" ? "en-GB" : "pl-PL"; recog.interimResults = false; recog.maxAlternatives = 1;
  recog.onstart = () => { listening = true; $("#voiceBtn").setAttribute("aria-pressed", true); $("#voiceBtn").textContent = TX("SŁUCHAM…"); beep(1300, .05); };
  recog.onend = () => { listening = false; $("#voiceBtn").setAttribute("aria-pressed", false); $("#voiceBtn").textContent = TX("GŁOS"); };
  recog.onerror = e => { if (e.error === "not-allowed") voiceSay(TX("Brak zgody na mikrofon.")); else if (e.error === "network") voiceSay(TX("Rozpoznawanie mowy wymaga internetu.")); };
  recog.onresult = e => { const txt = e.results[0][0].transcript; if (txt) voiceCmd(txt); };
  try { recog.start(); } catch (e) {}
}
$("#voiceBtn").addEventListener("click", voiceToggle);
document.addEventListener("keydown", e => { if (e.key === "v" && e.altKey) { e.preventDefault(); voiceToggle(); } });


/* --- STREAM DECK i inne piloty: polecenia z serwera (/api/cmd) i raport stanu interfejsu (/api/ui) */
const MAPCMD = new Set(["theater", "layer", "zoom", "replay", "globe", "autozoom", "event", "sat", "view"]);
const cmdMine = c => SOLO ? SOLO === "mapa" && MAPCMD.has(c.do) : !(MAPCMD.has(c.do) && mapHidden());
const tri3 = (v, cur) => v === "on" ? true : v === "off" ? false : !cur;
function runCmd(c) {
  const a = String(c.arg || "");
  switch (c.do) {
    case "theater": if (THEATERS.some(t => t[0] === a)) { setView("map"); setTheater(a, true); beep(800); } break;
    case "layer": { const [k, v] = a.split(":"); if (!(k in layerOn)) break; if (tri3(v, layerOn[k]) !== !!layerOn[k]) $(`[data-layer="${k}"]`).click(); break; }
    case "zoom": setView("map");
      if (a === "reset") setTheater("world", true);
      else if (mode === "flat") svg.transition().duration(reduce ? 0 : 160).call(zoom.scaleBy, Math.pow(1.3, +a || 0));
      else { rot = [rot[0] - (+a || 0) * 8, rot[1]]; globe.rotate(rot); redraw(); }
      break;
    case "eco": setEco(a === "toggle" ? !ECO : a === "on"); break;
    case "replay":
      if (a === "toggle") REPLAY.on ? replayClose() : replayOpen();
      else if (a === "open") { if (!REPLAY.on) replayOpen(); }
      else if (a === "live") { if (REPLAY.on) replayClose(); }
      else if (a === "play") { if (REPLAY.on) replayPlay(!REPLAY.playing); else replayOpen().then(() => { if (REPLAY.on) replayPlay(true); }); }
      else if (/^-?\d+$/.test(a)) { if (!REPLAY.on) { replayOpen(); break; } replayPlay(false); const base = REPLAY.want || REPLAY.t; replayFetch(Math.max(REPLAY.from, Math.min(REPLAY.to, base + +a * 60e3))); }
      break;
    case "briefing": $("#speakBtn").click(); break;
    case "sitrep": $("#sitIn").value = a || TX("Świat"); sitrep(); break;
    case "ask": if (a) { $("#q").value = a; ask(); } break;
    case "stop": stopSpeak(); stopKlaxon(); if (!$("#sitModal").hidden) sitClose(); break;
    case "globe": if ((a === "on") !== (mode === "globe") || !a) $("#projBtn").click(); break;
    case "autozoom": setAutoZ(tri3(a, AUTOZ)); break;
    case "alert": if (tri3(a, document.body.classList.contains("alert")) !== document.body.classList.contains("alert")) $("#alertBtn").click(); break;
    case "audio": setAudio(tri3(a, audioOn)); break;
    case "view": setView(a === "chain" ? "chain" : "map"); break;
    case "voice": voiceToggle(); break;
    case "event": {   // pokaż najnowszy kontakt: air, sea, inc (incydent morski) albo dowolny
      if (a === "ua") { ensureLayer("uaal"); setView("map"); const z = AUTOZ; AUTOZ = true; setTheater("ua", true); AUTOZ = z; break; }
      if (a === "inc") { const x = A(MS.d && MS.d.items).filter(y => !y.warn).sort((p, q) => (q.t || 0) - (p.t || 0))[0]; if (x) { const z = AUTOZ; AUTOZ = true; ensureLayer("marsec"); setView("map"); go("mi:" + x.id); AUTOZ = z; } break; }
      const ev = [].concat(a !== "sea" ? A(AIR.d && AIR.d.events).map(e => Object.assign({ id: e.go || "ah:" + e.hex }, e)) : [],
                           a !== "air" ? A(SEA.d && SEA.d.events).map(e => Object.assign({ id: "vs:" + e.mmsi }, e)) : []).sort((x, y) => y.at - x.at)[0];
      if (ev) { const z = AUTOZ; AUTOZ = true; setView("map"); go(ev.id); AUTOZ = z; } break; }
    case "sat": { const n = +a; const r = n && satByNorad(n); if (r) { SATCLICK = r; const z = AUTOZ; AUTOZ = true; go("sc:" + n); AUTOZ = z; } break; }
  }
}
let cmdLast = -1;
async function cmdLoop() {
  for (;;) {
    try {
      const d = await api(cmdLast < 0 ? "/api/cmd/wait?init=1" : "/api/cmd/wait?after=" + cmdLast);
      if (cmdLast >= 0 && d.last < cmdLast) cmdLast = 0;           // serwer uruchomiony ponownie
      if (cmdLast < 0) cmdLast = d.last;
      for (const c of A(d.cmds)) { if (c.id <= cmdLast) continue; cmdLast = c.id; if (cmdMine(c)) try { runCmd(c); } catch (e) { console.warn("cmd", c, e); } }
    } catch (e) { await new Promise(r => setTimeout(r, 3000)); }
  }
}
let uiLast = "", uiAt = 0;
function reportUI() {
  const st = { alert: document.body.classList.contains("alert"), audio: audioOn };
  if (!mapHidden()) Object.assign(st, { layers: layerOn, autoz: AUTOZ, theater: theater || "", mode, view,
    replay: { on: REPLAY.on, playing: REPLAY.playing, t: REPLAY.t, from: REPLAY.from, to: REPLAY.to } });
  if (!SOLO) { const now = Date.now(), p = PASS.list.find(x => x.los > now); st.pass = p ? { name: p.name, norad: p.norad, aos: p.aos, los: p.los, maxEl: p.maxEl, vis: p.vis } : null; }
  const j = JSON.stringify(st), now = Date.now();
  if (j === uiLast && now - uiAt < 15000) return;
  uiLast = j; uiAt = now; fetch("/api/ui", { method: "POST", headers: { "Content-Type": "application/json" }, body: j }).catch(() => {});
}
if (!SOLO || SOLO === "mapa") { cmdLoop(); setInterval(() => { if (!document.hidden || !SOLO) reportUI(); }, 700); }
/* ------------------------------------------------------------ GŁOS LEKTORA: Piper (lokalny, neuronowy) albo głos przeglądarki */
let TTSC = null;
const SPK = { on: false, gen: 0, src: null, onend: null };
async function loadTTS() { try { TTSC = await api("/api/tts/status"); } catch (e) {} return TTSC; }
const ttsCfg = () => (TTSC && TTSC.cfg) || { engine: "auto", rate: 1, fx: true, pitch: .9 };
const msOk = () => !!(TTSC && TTSC.ms && TTSC.ms.installed);
function ttsEngine() {   // "ms" – głosy Microsoftu przez serwer, "piper" – lokalny Piper, "browser" – głos przeglądarki
  const c = ttsCfg(); if (c.engine === "browser") return "browser";
  if ((c.engine === "ms" || c.engine === "auto") && msOk()) return "ms";
  const v = c[LANG === "en" ? "voice_en" : "voice_pl"], ok = TTSC && TTSC.engine && A(TTSC.voices).some(x => x.id === v && x.installed);
  return ok && c.engine !== "ms" ? "piper" : "browser";
}
function ttsVoiceId() { const c = ttsCfg(); return ttsEngine() === "ms" ? c[LANG === "en" ? "ms_en" : "ms_pl"] : c[LANG === "en" ? "voice_en" : "voice_pl"]; }
function splitText(t) {   // kawałki ~300 znaków po zdaniach – pierwszy dźwięk po ułamku sekundy, kolejne liczą się w tle
  const sent = String(t || "").replace(/\s+/g, " ").match(/[^.!?…;:]+[.!?…;:]*\s*/g) || [], out = []; let cur = "";
  for (const x of sent) { if ((cur + x).length > 300 && cur) { out.push(cur.trim()); cur = ""; } cur += x; }
  if (cur.trim()) out.push(cur.trim()); return out;
}
async function ttsChunk(text, voice) {
  try { const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
    if (!r.ok) { try { SPK.err = (await r.json()).error; } catch (e2) { SPK.err = "HTTP " + r.status; } return null; }
    return await audioCtx().decodeAudioData(await r.arrayBuffer()); } catch (e) { SPK.err = String(e && e.message || e); return null; }
}
function fxChain(c) {   // „komputer pokładowy”: pasmo radiowe, lekka kompresja i krótki metaliczny pogłos
  const inp = c.createGain(), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), pk = c.createBiquadFilter(), comp = c.createDynamicsCompressor(), out = c.createGain();
  hp.type = "highpass"; hp.frequency.value = 220; lp.type = "lowpass"; lp.frequency.value = 4300; pk.type = "peaking"; pk.frequency.value = 1700; pk.Q.value = 1.2; pk.gain.value = 4;
  comp.threshold.value = -22; comp.ratio.value = 4;
  const d = c.createDelay(.2), fb = c.createGain(), wet = c.createGain(); d.delayTime.value = .038; fb.gain.value = .32; wet.gain.value = .22;
  inp.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(comp); comp.connect(out); comp.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(out);
  return { inp, out };
}
function playSpeech(buf, my) {
  return new Promise(res => {
    const c = audioCtx(); if (!c || my !== SPK.gen) return res();
    const s2 = c.createBufferSource(); s2.buffer = buf; const g = c.createGain(); g.gain.value = Math.max(.35, SND.vol) * 1.15;
    if (ttsCfg().fx) { const f = fxChain(c); s2.connect(f.inp); f.out.connect(g); } else s2.connect(g);
    g.connect(c.destination); s2.onended = res; SPK.src = s2; s2.start();
  });
}
function endSpeak(my) { if (my !== SPK.gen) return; SPK.on = false; SPK.src = null; const f = SPK.onend; SPK.onend = null; if (f) f(); }
function stopSpeak() { SPK.gen++; try { SPK.src && SPK.src.stop(); } catch (e) {} SPK.src = null; if ("speechSynthesis" in window) speechSynthesis.cancel(); SPK.on = false; const f = SPK.onend; SPK.onend = null; if (f) f(); }
function browserVoice() {
  const v = "speechSynthesis" in window ? speechSynthesis.getVoices() : [], want = ttsCfg().browser_voice, pre = LANG === "en" ? /^en-GB/i : /^pl/i, any = LANG === "en" ? /^en/i : /^pl/i;
  return v.find(x => x.name === want) || v.find(x => pre.test(x.lang) && /natural|online|neural/i.test(x.name)) || v.find(x => pre.test(x.lang) && /google/i.test(x.name)) || v.find(x => pre.test(x.lang)) || v.find(x => any.test(x.lang)) || null;
}
function browserSpeak(text, my) {
  if (!("speechSynthesis" in window)) return endSpeak(my);
  const u = new SpeechSynthesisUtterance(text), v = browserVoice(), c = ttsCfg(); u.lang = v ? v.lang : LOC; if (v) u.voice = v; u.rate = .95 * (c.rate || 1); u.pitch = c.pitch || .9;
  u.onend = u.onerror = () => endSpeak(my); speechSynthesis.cancel(); speechSynthesis.speak(u);
}
async function speak(text, cb = {}) {
  stopSpeak(); const my = ++SPK.gen; SPK.on = true; SPK.onend = cb.onend || null; if (cb.onstart) cb.onstart();
  if (!TTSC) await loadTTS();
  if (ttsEngine() === "browser") return browserSpeak(text, my);
  const v = ttsVoiceId(), parts = splitText(text); let next = ttsChunk(parts[0], v);
  for (let i = 0; i < parts.length; i++) {
    const buf = await next; if (my !== SPK.gen) return;
    next = i + 1 < parts.length ? ttsChunk(parts[i + 1], v) : null;
    if (!buf) {     // Piper nie odpowiedział – dokończ głosem przeglądarki i powiedz dlaczego
      airToast({ at: Date.now(), kind: "alarm", head: TX("GŁOS PIPER"), msg: TX("Piper nie zadziałał – czytam głosem przeglądarki.") + (SPK.err ? " " + SPK.err : "") }); loadTTS();
      browserSpeak(parts.slice(i).join(" "), my); return; }
    await playSpeech(buf, my); if (my !== SPK.gen) return;
  }
  endSpeak(my);
}

/* ------------------------------------------------------------ OKNO „DŹWIĘK I GŁOS” */
const SLOTS = [["boot", TX("Start terminala")], ["done", TX("Koniec analizy AI")], ["threat", TX("Wzrost poziomu napięcia")], ["klaxon", TX("PRIORYTET JEDEN – syrena (w pętli)")],
  ["contact", TX("Nowy kontakt (samolot, okręt)")], ["emergency", TX("Alarm: squawk 7500/7600/7700, AIS-SART")], ["watch", TX("Sankcje, STS, „ciemny” statek, kabel")],
  ["pass", TX("Przelot satelity")], ["click", TX("Przyciski")], ["key", TX("Dalekopis (drukowanie tekstu)")], ["burble", TX("Praca rdzenia AI (w pętli)")], ["hum", TX("Szum tła (w pętli)")]];
const SYNTH_DEMO = { boot: () => sfxRaw("powerUp"), done: () => sfxRaw("done"), threat: () => sfxRaw("alarm", 2), klaxon: () => sfxRaw("whoop"), contact: () => sfxRaw("contact"),
  emergency: () => sfxRaw("alarm", 1), watch: () => sfxRaw("contact"), pass: () => sfxRaw("contact"), click: () => sfxRaw("click"), key: () => sfxRaw("chatter", 24),
  burble: () => sfxRaw("burblePhrase"), hum: () => { const e = eng(); if (e) { const h = e.humStart(); setTimeout(() => h.stop(), 2500); } } };
async function loadSounds() { try { CSND = await api("/api/sounds"); } catch (e) {} return CSND; }
let demoH = null;
function demoSlot(slot) {
  if (demoH) { demoH.stop(); demoH = null; } const c = slotCfg(slot); audioCtx();
  if (c && c.off) return; if (c) { demoH = playFile(c.file, c.vol, false, true); return; }
  const was = audioOn; audioOn = true; try { SYNTH_DEMO[slot](); } finally { audioOn = was; }
}
function renderSndSlots() {
  const opts = f => `<option value="">${TX("KRONOS (syntezator)")}</option><option value="off"${f === "off" ? " selected" : ""}>${TX("WYŁĄCZONY")}</option>`
    + A(CSND.files).map(x => `<option value="${esc0(x.name)}"${f === x.name ? " selected" : ""}>${esc0(x.name)}</option>`).join("");
  $("#sndSlots").innerHTML = SLOTS.map(([k, n]) => { const c = CSND.map[k] || {}, f = c.off ? "off" : c.file || "";
    return `<div class="snd-row" data-slot="${k}"><span>${n}</span><select aria-label="${esc0(n)}">${opts(f)}</select><input type="range" min="0" max="200" step="5" value="${c.vol ?? 100}" title="${TX("Głośność")}" ${c.file ? "" : "disabled"}><button class="btn" type="button" title="${TX("Odsłuchaj")}">▶</button></div>`; }).join("");
  $("#sndFiles").innerHTML = A(CSND.files).map(x => `<div class="tts-row"><span class="nm">${esc0(x.name)}</span><span class="st">${(x.size / 1048576).toFixed(1)} MB</span><span class="bt"><button class="btn" type="button" data-sdel="${esc0(x.name)}">${TX("USUŃ")}</button></span></div>`).join("")
    || `<p class="hint">${TX("Brak własnych plików – dodaj je powyżej.")}</p>`;
}
async function saveSndMap() {
  const map = {}; $$("#sndSlots .snd-row").forEach(r => { const v = r.querySelector("select").value, vol = +r.querySelector("input").value;
    if (v === "off") map[r.dataset.slot] = { off: true }; else if (v) map[r.dataset.slot] = { file: v, vol }; });
  try { CSND = await api("/api/sounds/map", { map }); } catch (e) {}
  hum(false); hum(true); renderSndSlots();
}
$("#sndSlots").addEventListener("change", e => { if (e.target.matches("select, input")) saveSndMap(); });
$("#sndSlots").addEventListener("click", e => { const b = e.target.closest("button"); if (b) demoSlot(b.closest(".snd-row").dataset.slot); });
$("#sndFiles").addEventListener("click", async e => { const b = e.target.closest("[data-sdel]"); if (!b) return; try { CSND = await api("/api/sounds/delete", { name: b.dataset.sdel }); } catch (err) {} delete BUF[b.dataset.sdel]; renderSndSlots(); });
async function uploadSounds(files) {
  const msg = $("#sndMsg");
  for (const f of files) {
    msg.textContent = TX("Wgrywam") + " " + f.name + "…";
    try { const r = await fetch("/api/sounds/upload?name=" + encodeURIComponent(f.name), { method: "POST", headers: { "Content-Type": f.type || "application/octet-stream" }, body: f });
      const j = await r.json(); if (!j.ok) { msg.textContent = f.name + ": " + (j.error || TX("błąd")); continue; } CSND = j; delete BUF[j.name]; msg.textContent = TX("Dodano:") + " " + j.name;
    } catch (e) { msg.textContent = f.name + ": " + TX("błąd"); }
  }
  renderSndSlots();
}
$("#sndFile").addEventListener("change", e => { uploadSounds([...e.target.files]); e.target.value = ""; });
["dragover", "dragenter"].forEach(ev => $("#sndDrop").addEventListener(ev, e => { e.preventDefault(); $("#sndDrop").classList.add("over"); }));
["dragleave", "drop"].forEach(ev => $("#sndDrop").addEventListener(ev, e => { e.preventDefault(); $("#sndDrop").classList.remove("over"); if (ev === "drop") uploadSounds([...e.dataTransfer.files]); }));
$("#sndReset").addEventListener("click", async () => { try { CSND = await api("/api/sounds/map", { map: {} }); } catch (e) {} hum(false); hum(true); renderSndSlots(); });

let ttsPoll = null;
function renderTTS() {
  if (!TTSC) return; const c = TTSC.cfg, j = TTSC.job || {};
  $("#ttsEngine").value = c.engine; $("#ttsRate").value = c.rate; $("#ttsRateV").textContent = "×" + (+c.rate).toFixed(2); $("#ttsFx").checked = !!c.fx;
  const row = v => { const cur = c[v.lang === "en" ? "voice_en" : "voice_pl"] === v.id && v.installed;
    return `<div class="tts-row${cur ? " cur" : ""}"><span class="nm">${v.lang === "pl" ? "PL" : "EN"} · ${esc0(v.label)}</span><span class="st">${v.installed ? (cur ? TX("WYBRANY") : TX("pobrany")) : v.mb + " MB"}</span><span class="bt">`
      + (v.installed ? `${cur ? "" : `<button class="btn" type="button" data-tuse="${v.id}" data-tlang="${v.lang}">${TX("UŻYJ")}</button>`}<button class="btn" type="button" data-ttry="${v.id}" title="${TX("Odsłuchaj")}">▶</button><button class="btn" type="button" data-trm="${v.id}" title="${TX("Usuń głos")}">✕</button>`
        : `<button class="btn" type="button" data-tget="${v.id}" data-tlang="${v.lang}"${j.active ? " disabled" : ""}>${TX("POBIERZ")}</button>`) + `</span></div>`; };
  const mine = A(TTSC.voices).filter(v => v.lang === (LANG === "en" ? "en" : "pl")), other = A(TTSC.voices).filter(v => v.lang !== (LANG === "en" ? "en" : "pl"));
  const ms = TTSC.ms || {}, L2 = LANG === "en" ? "en" : "pl", msOn = ttsEngine() === "ms";
  const mrow = v => { const cur = msOn && c[v.lang === "en" ? "ms_en" : "ms_pl"] === v.id;
    return `<div class="tts-row${cur ? " cur" : ""}"><span class="nm">${v.lang === "pl" ? "PL" : "EN"} · ${esc0(v.label)}</span><span class="st">${cur ? TX("WYBRANY") : "online"}</span><span class="bt">${cur ? "" : `<button class="btn" type="button" data-muse="${v.id}" data-tlang="${v.lang}">${TX("UŻYJ")}</button>`}<button class="btn" type="button" data-ttry="${v.id}" title="${TX("Odsłuchaj")}">▶</button></span></div>`; };
  const msHtml = `<p class="sat-h">MICROSOFT · ${TX("głosy neuronowe online")}</p>` + (ms.installed
    ? A(ms.voices).filter(v => v.lang === L2).concat(A(ms.voices).filter(v => v.lang !== L2)).map(mrow).join("")
    : `<div class="tts-row"><span class="nm">${TX("Marek, Zofia (PL) · Ryan, Thomas, Sonia, Libby (EN)")}</span><span class="st">~5 MB</span><span class="bt"><button class="btn" type="button" id="msInst"${j.active ? " disabled" : ""}>${TX("ZAINSTALUJ")}</button></span></div>`);
  $("#ttsVoices").innerHTML = msHtml + `<p class="sat-h">PIPER · ${TX("lokalnie, offline")}</p>` + mine.concat(other).map(row).join("");
  $("#ttsProg").textContent = j.active ? `${TX("Pobieranie:")} ${j.what} · ${j.pct}%` : j.err ? TX("Błąd pobierania:") + " " + j.err : ttsEngine() === "ms" ? TX("Teraz czyta: Microsoft –") + " " + ((A(TTSC.ms.voices).find(v => v.id === ttsVoiceId()) || {}).label || "") + (TTSC.ms.err ? " · " + TX("ostatni błąd:") + " " + TTSC.ms.err : "") : TTSC.err ? TX("Błąd Pipera:") + " " + TTSC.err : ttsEngine() === "piper" ? TX("Teraz czyta: Piper –") + " " + ((A(TTSC.voices).find(v => v.id === ttsVoiceId()) || {}).label || "") : TX("Teraz czyta: głos przeglądarki –") + " " + ((browserVoice() || {}).name || TX("brak głosu dla tego języka"));
  const bv = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  $("#ttsBrowser").innerHTML = `<option value="">${TX("automatycznie – najlepszy dla języka")}</option>` + bv.slice().sort((a, b) => (a.lang.slice(0, 2) === (LANG === "en" ? "en" : "pl") ? -1 : 1) - (b.lang.slice(0, 2) === (LANG === "en" ? "en" : "pl") ? -1 : 1) || a.lang.localeCompare(b.lang))
    .map(v => `<option value="${esc0(v.name)}"${v.name === c.browser_voice ? " selected" : ""}>${esc0(v.lang)} · ${esc0(v.name)}</option>`).join("");
  clearTimeout(ttsPoll); if (j.active) ttsPoll = setTimeout(async () => { await loadTTS(); renderTTS(); }, 1000);
}
async function ttsSave(body) { try { TTSC = await api("/api/tts/settings", body); } catch (e) {} renderTTS(); }
$("#ttsEngine").addEventListener("change", e => ttsSave({ engine: e.target.value }));
$("#ttsRate").addEventListener("change", e => ttsSave({ rate: +e.target.value }));
$("#ttsRate").addEventListener("input", e => $("#ttsRateV").textContent = "×" + (+e.target.value).toFixed(2));
$("#ttsFx").addEventListener("change", e => ttsSave({ fx: e.target.checked }));
$("#ttsBrowser").addEventListener("change", e => ttsSave({ browser_voice: e.target.value }));
const TTS_SAMPLE = () => LANG === "en" ? "KRONOS-7 online. Tension level three. The Strait of Hormuz remains effectively closed." : "KRONOS-7 gotowy. Poziom napięcia trzy. Cieśnina Ormuz pozostaje praktycznie zamknięta.";
$("#ttsTest").addEventListener("click", () => SPK.on ? stopSpeak() : speak(TTS_SAMPLE()));
$("#ttsVoices").addEventListener("click", async e => {
  const g = e.target.closest("[data-tget]"), u = e.target.closest("[data-tuse]"), t = e.target.closest("[data-ttry]"), r = e.target.closest("[data-trm]");
  if (g) { try { TTSC = await api("/api/tts/install", { voice: g.dataset.tget }); } catch (err) {} await ttsSave({ ["voice_" + g.dataset.tlang]: g.dataset.tget, engine: TTSC.cfg.engine === "browser" ? "auto" : TTSC.cfg.engine }); }
  if (u) await ttsSave({ ["voice_" + u.dataset.tlang]: u.dataset.tuse, engine: "piper" });
  const mu = e.target.closest("[data-muse]"); if (mu) await ttsSave({ ["ms_" + mu.dataset.tlang]: mu.dataset.muse, engine: "ms" });
  if (e.target.closest("#msInst")) { try { TTSC = await api("/api/tts/ms/install", {}); } catch (err) {} await ttsSave({ engine: "ms" }); }
  if (r) { try { TTSC = await api("/api/tts/remove", { voice: r.dataset.trm }); } catch (err) {} renderTTS(); }
  if (t) { stopSpeak(); const buf = await ttsChunk(/^pl/i.test(t.dataset.ttry) ? "KRONOS-7 gotowy. Poziom napięcia trzy." : "KRONOS-7 online. Tension level three.", t.dataset.ttry);
    if (buf) { const my = ++SPK.gen; SPK.on = true; await playSpeech(buf, my); endSpeak(my); } else airToast({ at: Date.now(), kind: "alarm", head: TX("GŁOS"), msg: SPK.err || TX("błąd") }); }
});
async function openSnd() {
  $("#settings").hidden = true; await Promise.all([loadSounds(), loadTTS()]); renderSndSlots(); renderTTS(); $("#sndModal").hidden = false; $("#sndClose").focus();
}
$("#sndOpen").addEventListener("click", openSnd);
$("#sndClose").addEventListener("click", () => { $("#sndModal").hidden = true; if (demoH) demoH.stop(); });
$("#sndModal").addEventListener("click", e => { if (e.target.id === "sndModal") $("#sndModal").hidden = true; });
if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", () => { if (!$("#sndModal").hidden) renderTTS(); });
loadSounds().then(() => { if (humH) { hum(false); hum(true); } }); loadTTS();

/* ------------------------------------------------------------ WYWIAD+ (v3.14): alarmy UA, DeepState, NOTAM, SAR, Telegram OSINT, własne odbiorniki */
const IN = { d: null, sdr: null, ds: null, dsAt: 0 };
async function pollIntel() { try { IN.d = await api("/api/intel"); renderIntel(); needDraw = true; if (layerOn.dstate) loadDS(); } catch (e) {} }
async function pollSdr() { try { IN.sdr = await api("/api/sdr"); renderSdr(); needDraw = true; } catch (e) {} }
async function loadDS() {
  const at = IN.d && IN.d.deepstate && IN.d.deepstate.at; if (!at || at === IN.dsAt) return;
  try { IN.ds = await api("/api/intel/deepstate"); IN.dsAt = at; markStatic(); } catch (e) {}
}
const UA_COL = "#ff4b4b", NT_COL = { gnss: "#ffb347", missile: "#ff4b4b", uas: "#c48cff", military: "#6fe4ff", closed: "#ff8f6b" };
const NT_N = { gnss: TX("GNSS/GPS"), missile: TX("RAKIETY / STARTY"), uas: TX("DRONY"), military: TX("WOJSKOWE"), closed: TX("ZAMKNIĘTA PRZESTRZEŃ") };
const CRED = { A: "var(--phos)", B: "var(--phos)", C: "var(--amber)", D: "var(--amber)", E: "var(--red)", F: "var(--phos-dim)" };
function drawDS(k) {   // warstwa stała: obszary DeepStateMap pod punktami
  if (!IN.ds) return; SX.save(); SX.globalCompositeOperation = "destination-over";
  const fill = { occupied: "rgba(255,75,75,.22)", unknown: "rgba(180,180,180,.16)", liberated: "rgba(125,255,154,.10)", other: "rgba(255,143,107,.14)" };
  const line = { occupied: "rgba(255,75,75,.75)", unknown: "rgba(200,200,200,.5)", liberated: "rgba(125,255,154,.35)", other: "rgba(255,143,107,.5)" };
  for (const st of ["occupied", "unknown", "other", "liberated"]) {
    SX.beginPath();
    for (const pg of A(IN.ds.polys)) { if (pg.st !== st) continue;
      for (const ring of pg.r) { let first = true, prev = null; for (const c of ring) { const p = scr(c[0], c[1]); if (!p) { first = true; continue; } if (first || (prev && Math.abs(p[0] - prev[0]) > cvW * .5)) SX.moveTo(p[0], p[1]); else SX.lineTo(p[0], p[1]); first = false; prev = p; } SX.closePath(); } }
    SX.fillStyle = fill[st]; SX.fill("evenodd"); SX.strokeStyle = line[st]; SX.lineWidth = k >= 6 ? 1.4 : .9; SX.stroke();
  }
  SX.restore();
}
function drawIntel() {
  const now = Date.now(), k = mode === "globe" ? 1 : T.k, d = IN.d;
  const ring = (p, r, col, w, dash) => { CX.beginPath(); CX.arc(p[0], p[1], r, 0, 6.2832); CX.strokeStyle = col; CX.lineWidth = w || 1.2; if (dash) CX.setLineDash(dash); CX.stroke(); CX.setLineDash([]); };
  if (d && layerOn.uaal && d.ua) for (const o of A(d.ua.oblasts)) { if (!o.on) continue; const p = scr(o.lon, o.lat); if (!p || !inView(p[0], p[1], 30)) continue;
    const r = Math.max(9, Math.min(40, 6 * Math.sqrt(k) * 2)), pulse = (now / 900) % 1;
    CX.beginPath(); CX.arc(p[0], p[1], r, 0, 6.2832); CX.fillStyle = "rgba(255,75,75,.22)"; CX.fill(); ring(p, r, UA_COL, 1.4);
    CX.globalAlpha = 1 - pulse; ring(p, r + pulse * 14, UA_COL, 1); CX.globalAlpha = 1; AHIT.push([p[0], p[1], "ua:" + o.id]); }
  if (d && layerOn.notam && d.notam) for (const n of A(d.notam.items)) { if (!n.pos) continue; const p = scr(n.pos[1], n.pos[0]); if (!p || !inView(p[0], p[1], 30)) continue;
    const col = NT_COL[n.kind] || "#c48cff";
    if (n.r) { const e = scr(n.pos[1], n.pos[0] + n.r / 111.2); if (e) { const rp = Math.abs(e[1] - p[1]); if (rp > 6 && rp < 2000) { CX.globalAlpha = .55; ring(p, rp, col, 1, [4, 3]); CX.globalAlpha = 1; } } }
    CX.beginPath(); CX.moveTo(p[0], p[1] - 5); CX.lineTo(p[0] + 5, p[1] + 4); CX.lineTo(p[0] - 5, p[1] + 4); CX.closePath(); CX.fillStyle = "rgba(5,8,5,.8)"; CX.fill(); CX.strokeStyle = col; CX.lineWidth = 1.3; CX.stroke();
    AHIT.push([p[0], p[1], "nt:" + n.id]); }
  if (d && layerOn.sar && d.gfw) { CX.fillStyle = "rgba(255,179,71,.55)"; for (const c of A(d.gfw.cells)) { const p = scr(c.lon, c.lat); if (!p || !inView(p[0], p[1], 4)) continue; const s = Math.min(7, 1.5 + Math.sqrt(c.n)); CX.fillRect(p[0] - s / 2, p[1] - s / 2, s, s); } }
  if (d && layerOn.osint) for (const t of A(d.tg)) { if (!t.pos) continue; const p = scr(t.pos[1], t.pos[0]); if (!p || !inView(p[0], p[1], 10)) continue;
    const age = (now - t.t) / 3600e3; CX.globalAlpha = age < 3 ? 1 : age < 12 ? .75 : .45;
    CX.beginPath(); CX.arc(p[0], p[1], 4.5, 0, 6.2832); CX.fillStyle = cssv(CRED[t.cred] || "var(--phos-dim)"); CX.fill(); CX.strokeStyle = "#050805"; CX.lineWidth = 1; CX.stroke(); CX.globalAlpha = 1;
    AHIT.push([p[0], p[1], "tg:" + t.id]); }
  if (d && layerOn.il && d.il) { for (const x of A(d.il.hist)) { const p = scr(x.lon, x.lat); if (!p || !inView(p[0], p[1], 4)) continue; const age = (now - x.t) / 3600e3;
      CX.globalAlpha = age < 6 ? .9 : age < 48 ? .5 : .25; CX.fillStyle = IL_COL; CX.fillRect(p[0] - 2, p[1] - 2, 4, 4); CX.globalAlpha = 1; AHIT.push([p[0], p[1], "il:" + x.c]); }
    for (const x of A(d.il.active)) { const p = scr(x.lon, x.lat); if (!p) continue; const pulse = (now / 700) % 1; CX.beginPath(); CX.arc(p[0], p[1], 6, 0, 6.2832); CX.fillStyle = "rgba(255,90,74,.5)"; CX.fill();
      CX.globalAlpha = 1 - pulse; ring(p, 6 + pulse * 16, IL_COL, 1.4); CX.globalAlpha = 1; AHIT.push([p[0], p[1], "il:" + x.c]); needDraw = true; } }
  if (d && layerOn.emsc) for (const e of A(d.emsc)) { const p = scr(e.lon, e.lat); if (!p || !inView(p[0], p[1], 20)) continue; const r = Math.max(3, (e.mag - 2.5) * 3.2);
    ring(p, r, "rgba(255,179,71,.9)", 1.3); AHIT.push([p[0], p[1], "eq:" + e.id]); }
  if (layerOn.gc && IN.gc) { for (const g of IN.gc) { const p = scr(g.lon, g.lat); if (!p || !inView(p[0], p[1], 4)) continue; const age = (now - g.t) / 86400e3;
      CX.globalAlpha = age < 2 ? 1 : age < 10 ? .6 : .3; CX.fillStyle = g.col || "#6fe4ff"; CX.beginPath(); CX.arc(p[0], p[1], 3, 0, 6.2832); CX.fill(); CX.globalAlpha = 1; AHIT.push([p[0], p[1], "gc:" + g.id]); } }
  if (OS_TRK && OS_TRK.path && OS_TRK.path.length) { CX.beginPath(); let f2 = true; for (const q of OS_TRK.path) { const p = scr(q[1], q[0]); if (!p) { f2 = true; continue; } f2 ? CX.moveTo(p[0], p[1]) : CX.lineTo(p[0], p[1]); f2 = false; }
    CX.setLineDash([5, 3]); CX.strokeStyle = "rgba(111,228,255,.9)"; CX.lineWidth = 1.5; CX.stroke(); CX.setLineDash([]); }
  if (layerOn.acled && IN.acl) { for (const a of IN.acl) { const p = scr(a[2], a[1]); if (!p || !inView(p[0], p[1], 6)) continue; const sz = a[4] >= 10 ? 4.5 : a[4] ? 3.4 : 2.6;
      CX.fillStyle = ACL_C[ACL_T[a[3]]] || "#9fdcb0"; CX.globalAlpha = .8; CX.beginPath(); CX.moveTo(p[0], p[1] - sz); CX.lineTo(p[0] + sz, p[1]); CX.lineTo(p[0], p[1] + sz); CX.lineTo(p[0] - sz, p[1]); CX.closePath(); CX.fill(); CX.globalAlpha = 1;
      AHIT.push([p[0], p[1], "acl:" + a[0]]); } }
  if (d && layerOn.rad && d.rad) for (const r of A(d.rad.pts)) { const p = scr(r.lon, r.lat); if (!p || !inView(p[0], p[1], 8)) continue;
    CX.beginPath(); CX.arc(p[0], p[1], r.anom ? 5.5 : 3.6, 0, 6.2832); CX.fillStyle = radCol(r.usv); CX.globalAlpha = .85; CX.fill(); CX.globalAlpha = 1; CX.strokeStyle = "#050805"; CX.lineWidth = 1; CX.stroke();
    if (r.anom) ring(p, 9 + ((now / 700) % 1) * 6, "#ff4b4b", 1.2);
    AHIT.push([p[0], p[1], "rd:" + r.id]); }
  if (d && layerOn.corr) for (const c of A(d.corr)) { if (c.hidden || (c.ai && c.ai.routine && !(selected === "cr:" + c.id))) continue; const p = scr(c.lon, c.lat); if (!p || !inView(p[0], p[1], 60)) continue;
    const e = scr(c.lon, c.lat + Math.max(30, c.ext) / 111.2), rp = e ? Math.max(12, Math.min(160, Math.abs(e[1] - p[1]))) : 14, col = CORR_SEV[(c.ai && c.ai.sev) || 2];
    CX.globalAlpha = .9; ring(p, rp, col, 1.6, [6, 4]); CX.globalAlpha = 1; CX.font = FONT(); CX.fillStyle = col; CX.fillText("⛓ " + c.layers.length + (c.ai && c.ai.sev ? " · " + c.ai.sev : ""), p[0] + rp * .72, p[1] - rp * .72);
    AHIT.push([p[0], p[1], "cr:" + c.id]); }
  const S2 = IN.sdr;
  if (S2 && layerOn.myadsb) for (const a of A(S2.adsb)) { const p = scr(a.lon, a.lat); if (!p || !inView(p[0], p[1], 8)) continue;
    CX.beginPath(); tri(CX, p[0], p[1], ((a.trk || 0) - 90) * Math.PI / 180, 3); CX.fillStyle = a.emerg ? "#ff4b4b" : a.mil ? "#6fe4ff" : "#e8ffe8"; CX.globalAlpha = .85; CX.fill(); CX.globalAlpha = 1;
    AHIT.push([p[0], p[1], "la:" + a.hex]); if (k >= 5 && a.cs) { CX.font = FONT(); CX.fillStyle = "#e8ffe8"; CX.fillText(a.cs, p[0] + 5, p[1] - 4); } }
  if (S2 && layerOn.aprs) { CX.font = FONT(); for (const s of A(S2.aprs)) { const p = scr(s.lon, s.lat); if (!p || !inView(p[0], p[1], 8)) continue;
    if (A(s.trail).length) { CX.beginPath(); s.trail.concat([[s.lat, s.lon]]).forEach((q, i) => { const pp = scr(q[1], q[0]); if (pp) i ? CX.lineTo(pp[0], pp[1]) : CX.moveTo(pp[0], pp[1]); }); CX.strokeStyle = "rgba(196,140,255,.6)"; CX.lineWidth = 1; CX.stroke(); }
    CX.fillStyle = "#c48cff"; CX.fillRect(p[0] - 2.5, p[1] - 2.5, 5, 5); AHIT.push([p[0], p[1], "ap:" + s.call]);
    if (k >= 6) { CX.fillStyle = "#e3c9ff"; CX.fillText(s.call, p[0] + 5, p[1] - 4); } } }
  /* QTH operatora – punkt odniesienia dla odbiorników */
  if ((layerOn.myadsb || layerOn.aprs) && S2) { const q = qth(), p = scr(q.lon, q.lat); if (p) { ring(p, 6, "#e8ffe8", 1.5); CX.fillStyle = "#e8ffe8"; CX.fillRect(p[0] - 1, p[1] - 1, 2, 2); } }
}
const agoS = t => t ? agoTxt(Math.max(0, Math.round((Date.now() - t) / 1000))) : "";
function renderIntel() {
  const d = IN.d; if (!d) return;
  const tg = A(d.tg).filter(t => t.ai);
  $("#tgT").textContent = `${tg.length} ${TX("postów")} · 48 h`;
  rowsInto("#osint", tg.slice(0, 40).map(t => `<li><button data-go="tg:${esc0(t.id)}"><span class="t">${esc(t.title || "")}</span><span class="chip" style="color:${CRED[t.cred] || "var(--phos-dim)"}">${esc(t.cred || "?")}</span><span class="sub">@${esc(t.ch)} · ${esc(t.place || "")} · ${hm(t.t)}${A(t.also).length ? " · " + TX("też") + " " + t.also.map(x => "@" + x).join(", ") : ""}</span></button></li>`).join("")
    || `<li class="empty">${TX("Lokalne AI jeszcze nie przeczytało postów – pojawią się po pierwszej porcji.")}</li>`);
  if ($("#corr")) { const cs = A(d.corr).filter(c => !c.hidden);
    $("#crT").textContent = `${cs.filter(c => !(c.ai && c.ai.routine)).length} ${TX("aktywnych")}`;
    rowsInto("#corr", cs.slice(0, 30).map(c => { const a = c.ai || {}; return `<li><button data-go="cr:${esc0(c.id)}"><span class="t">${esc(a.title || c.lnames.join(" + "))}</span><span class="chip" style="color:${CORR_SEV[a.sev || 2]}">${a.sev ? a.sev + "/5" : "…"}</span><span class="sub">${esc(c.lnames.join(" · "))} · ${hm(c.last)}${a.routine ? " · " + TX("rutyna") : ""}</span></button></li>`; }).join("")
      || `<li class="empty">${TX("Brak – zdarzenie złożone powstaje, gdy w jednym miejscu i czasie pojawią się sygnały z co najmniej dwóch warstw.")}</li>`); }
  const ua = d.ua, on = ua ? A(ua.oblasts).filter(o => o.on).sort((a, b) => (a.since || 0) - (b.since || 0)) : [];
  let h = `<li class="hd">${TX("Alarmy w Ukrainie")} · ${on.length}${ua ? " · " + esc(ua.src) : ""}</li>` + (on.map(o => `<li><button data-go="ua:${esc0(o.id)}"><span class="t">${esc(o.name)}</span><span class="red">${o.since ? cd(Date.now() - o.since) : TX("TERAZ")}</span><span class="sub">${esc(A(o.kinds).join(", "))}${o.parts ? " · " + o.parts + " " + TX("części obwodu") : ""}</span></button></li>`).join("") || `<li class="empty">${TX("Brak alarmów.")}</li>`);
  const nt = d.notam ? A(d.notam.items) : [];
  h += `<li class="hd">NOTAM · ${nt.length}</li>` + (nt.length ? nt.slice(0, 30).map(n => `<li><button data-go="nt:${esc0(n.id)}"><span class="t">${esc(n.loc)} · ${esc(NT_N[n.kind] || n.kind)}</span><span class="dim">${esc(n.num || "")}</span><span class="sub">${esc((n.text || "").slice(0, 140))}</span></button></li>`).join("")
    : `<li class="empty">${(d.status.notam || {}).off ? TX("Wpisz darmowy klucz FAA w oknie ŹRÓDŁA I INTEGRACJE.") : TX("Brak NOTAM-ów z wybranych kategorii.")}</li>`);
  const g = d.gfw; h += `<li class="hd">${TX("Ciemne statki z radaru SAR")}</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${g ? `${A(g.cells).length} ${TX("obszarów z wykryciami bez AIS")} · ${esc(g.from)}–${esc(g.to)}` : (d.status.gfw || {}).off ? TX("Wpisz darmowy klucz Global Fishing Watch w oknie ŹRÓDŁA I INTEGRACJE.") : esc((d.status.gfw || {}).err || "…")}</span></button></li>`;
  const il = d.il || {}, ila = A(il.active), ty = il.types || {};
  const ilh = A(il.hist).slice().sort((a, b) => b.t - a.t);
  h += `<li class="hd">${TX("Izrael – alarmy (Tzeva Adom)")} · ${ila.length ? ila.length + " " + TX("TERAZ") : ilh.length + " " + TX("w 7 dni")}</li>`
    + (ila.concat(ilh.slice(0, 12)).map(x => `<li><button data-go="il:${esc0(x.c)}"><span class="t">${esc(x.c)}</span><span class="${x.on ? "red" : "dim"}">${x.on ? TX("TERAZ") : hm(x.t)}</span><span class="sub">${esc(ty[x.thr] || "")}${x.on ? "" : " · " + new Date(x.t).toLocaleDateString(LOC)}</span></button></li>`).join("") || `<li class="empty">${TX("Brak alarmów.")}</li>`);
  const eqs = A(d.emsc).slice(0, 10);
  if (eqs.length) h += `<li class="hd">${TX("Trzęsienia ziemi (EMSC, 48 h, M3.5+)")}</li>` + eqs.map(e => `<li><button data-go="eq:${esc0(String(e.id))}"><span class="t">M${e.mag} · ${esc(e.where || "")}</span><span class="dim">${hm(e.t)}</span></button></li>`).join("");
  const nets = A(d.net).slice(0, 10);
  if (nets.length) h += `<li class="hd">${TX("Wyłączenia internetu (Cloudflare Radar, 7 dni)")}</li>` + nets.map(n => `<li><button tabindex="-1" style="cursor:default"><span class="t">${esc(n.cc)} · ${esc(n.kind === "outage" ? TX("wyłączenie") : TX("anomalia ruchu"))}</span><span class="dim">${n.t ? hm(n.t) : ""}</span><span class="sub">${esc([n.cause, n.type, n.asn].filter(Boolean).join(" · "))} · ${n.t ? new Date(n.t).toLocaleDateString(LOC) : ""}</span></button></li>`).join("");
  rowsInto("#alerts2", h);
  if ($("#wsList") && (!IN.wsAt || Date.now() - IN.wsAt > (A((IN.ws || {}).items).length ? 30 * 60e3 : 60e3))) { IN.wsAt = Date.now(); api("/api/intel/ws").then(r => { IN.ws = r; renderWS(); }).catch(() => {}); }
  $("#alT").textContent = on.length ? on.length + " " + TX("alarmów") : "";
}
function renderSdr() {
  const s = IN.sdr; if (!s) return; const st = s.status || {}, a = A(s.adsb), ap = A(s.aprs);
  const line = (n, x, txt) => `<li><button tabindex="-1" style="cursor:default"><span class="t">${n}</span><span class="${x.ok ? "" : x.ok === false ? "red" : "dim"}">${x.off ? TX("wyłączony") : x.ok ? "OK" : x.ok === false ? TX("BŁĄD") : "…"}</span><span class="sub">${esc(x.err || txt || "")}</span></button></li>`;
  let h = line("ADS-B", st.adsb || {}, st.adsb && !st.adsb.off ? `${a.length} ${TX("samolotów")} · ${TX("zasięg do")} ${st.adsb.max_nm || 0} NM` : TX("adres aircraft.json w oknie ŹRÓDŁA I INTEGRACJE"))
    + line("AIS", st.ais || {}, st.ais && !st.ais.off ? `UDP ${st.ais.port} · ${st.ais.n} ${TX("statków (1 h)")} · ${st.ais.msgs} ${TX("komunikatów")}` : TX("port UDP z AIS-catcher / rtl_ais"))
    + line("APRS", st.aprs || {}, st.aprs && !st.aprs.off ? `${ap.length} ${TX("stacji w promieniu")}` : TX("włącz w oknie ŹRÓDŁA I INTEGRACJE"));
  const mil = a.filter(x => x.mil || x.emerg);
  if (mil.length) h += `<li class="hd">${TX("Wojskowe / alarmowe z Twojej anteny")}</li>` + mil.slice(0, 12).map(x => `<li><button data-go="la:${x.hex}"><span class="t">${esc(x.cs || x.hex)} · ${esc(x.t)}</span><span class="${x.emerg ? "red" : "cyan"}">${x.emerg ? "SQUAWK " + esc(x.sq) : TX("WOJSKOWY")}</span><span class="sub">${x.alt != null ? x.alt + " ft" : ""} · ${fmtLL(x.lat, x.lon)}</span></button></li>`).join("");
  if (ap.length) h += `<li class="hd">APRS · ${TX("ostatnie")}</li>` + ap.slice(0, 10).map(x => `<li><button data-go="ap:${esc0(x.call)}"><span class="t">${esc(x.call)}</span><span class="dim">${hm(x.t)}</span><span class="sub">${esc(x.cmt || x.kind || "")}</span></button></li>`).join("");
  rowsInto("#sdr", h);
  $("#sdrT").textContent = [a.length ? "✈ " + a.length : "", st.ais && st.ais.n ? "⚓ " + st.ais.n : "", ap.length ? "APRS " + ap.length : ""].filter(Boolean).join(" · ");
}
/* karty szczegółów */
const CORR_SEV = ["", "var(--phos-dim)", "var(--phos)", "var(--amber)", "#ff7a2a", "var(--red)"];
const ACL_T = ["battle", "explosion", "civilians", "strategic", "riot", "protest", "other"], ACL_N = { battle: TX("bitwa / starcie"), explosion: TX("ostrzał, nalot, wybuch"), civilians: TX("przemoc wobec cywilów"), strategic: TX("rozwój strategiczny"), riot: TX("zamieszki"), protest: TX("protest"), other: TX("inne") };
const ACL_C = { battle: "#ff4b4b", explosion: "#ff9d3a", civilians: "#c48cff", strategic: "#6fe4ff", riot: "#f0e68c", protest: "#9fdcb0", other: "#9fdcb0" };
const radCol = u => u >= 1 ? "#ff4b4b" : u >= 0.3 ? "#ffb347" : u >= 0.15 ? "#f0e68c" : "#7dffa8";
const ACLD = {};
async function loadAcled(force) { if (!force && IN.aclAt && Date.now() - IN.aclAt < 30 * 60e3) return; IN.aclAt = Date.now(); try { const r = await api("/api/intel/acled"); IN.acl = A(r.rows); IN.aclDays = r.days; markStatic(); needDraw = true; } catch (e) {} }
async function acledDetail(id) { if (ACLD[id]) return; ACLD[id] = { loading: 1 }; try { ACLD[id] = await api("/api/intel/acled/" + encodeURIComponent(id)); } catch (e) { ACLD[id] = { error: 1 }; } if (selected === "acl:" + id) pick(selected, true); }
const IL_COL = "#ff5a4a"; let OS_TRK = null;
window.__osTrack = hex => osTrack(hex);
async function osTrack(hex) { const box = $("#detail .ostrk"); if (box) box.textContent = TX("Pobieram ślad z OpenSky…");
  try { const r = await api("/api/opensky/track?icao24=" + hex); if (r.error) { if (box) box.textContent = r.error; return; } OS_TRK = r; markStatic(); needDraw = true;
    if (box) box.textContent = `${TX("Ślad")}: ${r.path.length} ${TX("punktów")} · ${hm(r.start)}–${hm(r.end)} · ${TX("linia przerywana na mapie")}`; } catch (e) { if (box) box.textContent = TX("błąd"); } }
function renderWS() {
  const r = IN.ws || {}, it = A(r.items), sm = r.sum || {};
  $("#wsT").textContent = it.length ? `RU ${Object.values(sm.russia || {}).reduce((a, b) => a + b, 0)} · UA ${Object.values(sm.ukraine || {}).reduce((a, b) => a + b, 0)} · 4 ${TX("dni")}` : "";
  rowsInto("#wsList", it.slice(0, 60).map(x => `<li><button tabindex="-1" style="cursor:default"><span class="t">${esc(x.model || x.type || "")}</span><span class="${x.side === "russia" ? "red" : "cyan"}">${x.side === "russia" ? "RU" : "UA"}</span><span class="sub">${esc(x.type || "")} · ${esc(x.status || "")}${x.near ? " · " + esc(x.near) : ""} · ${esc(x.d || "")} · ${L(x.url, TX("zdjęcie"))}</span></button></li>`).join("")
    || `<li class="empty">${TX("Brak danych.")}</li>`);
}
function ilAll() { const il = (IN.d || {}).il || {}; return A(il.active).concat(A(il.hist)); }
async function loadX(force) {
  const due = k => force || !IN["x_" + k] || Date.now() - IN["x_" + k] > 30 * 60e3;
  try { if (layerOn.gc && due("gc")) { IN.x_gc = Date.now(); const r = await api("/api/intel/gc"); IN.gc = A(r.pts); markStatic(); }
    if (layerOn.isw && due("isw")) { IN.x_isw = Date.now(); const r = await api("/api/intel/isw"); IN.isw = r.layers || {}; markStatic(); } } catch (e) {}
}
function drawISW(k) {
  const L2 = IN.isw || {}, sty = { control: ["rgba(255,75,75,.20)", "rgba(255,75,75,.8)", null], infiltration: ["rgba(255,160,60,.18)", "rgba(255,160,60,.7)", [3, 3]],
    claimed: ["rgba(0,0,0,0)", "rgba(255,120,120,.7)", [6, 4]], uacounter: ["rgba(90,160,255,.16)", "rgba(90,160,255,.75)", [5, 3]], gains24: ["rgba(255,40,40,.4)", "rgba(255,40,40,1)", null] };
  SX.save(); SX.globalCompositeOperation = "destination-over";
  for (const [lk, st] of Object.entries(sty)) { const fc = L2[lk]; if (!fc || !A(fc.features).length) continue; SX.beginPath();
    for (const f of fc.features) { const g = f.geometry || {}, polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
      for (const pg of polys) for (const ring of pg) { let first = true; for (const c of ring) { const p = scr(c[0], c[1]); if (!p) { first = true; continue; } first ? SX.moveTo(p[0], p[1]) : SX.lineTo(p[0], p[1]); first = false; } SX.closePath(); } }
    SX.fillStyle = st[0]; SX.fill("evenodd"); SX.strokeStyle = st[1]; SX.lineWidth = k >= 6 ? 1.3 : .8; if (st[2]) SX.setLineDash(st[2]); SX.stroke(); SX.setLineDash([]); }
  SX.restore();
}
function intelCard(t, key) {
  const d = IN.d || {}, sdr = IN.sdr || {};
  if (t === "il") { const a = ilAll().filter(x => x.c === key).sort((x, y) => y.t - x.t), x = a[0]; if (!x) return ""; const ty = (d.il || {}).types || {};
    return chip(TX("IZRAEL · ALARM") + (x.on ? " · " + TX("TRWA") : ""), IL_COL) + `<h2 class="glow">${esc(x.c)}</h2>` + dd([[TX("ZAGROŻENIE"), ty[x.thr] || x.thr], [TX("CZAS"), new Date(x.t).toLocaleString(LOC)], [TX("ALARMÓW W 7 DNI"), a.length]])
      + `<p class="hint">${TX("Źródło: Pikud HaOref przez tzevaadom.co.il.")}</p>` + evBox("geo", `${x.lat},${x.lon},6,${x.c}`); }
  if (t === "gc") { const g = A(IN.gc).find(x => x.id === key); if (!g) return "";
    return chip("GEOCONFIRMED · " + esc(g.conf || ""), g.col || "var(--cyan)") + `<h2 class="glow">${esc(g.fac || "")} · ${new Date(g.t).toLocaleDateString(LOC)}</h2>` + (g.icon ? `<p><img src="${esc(g.icon)}" alt="" style="height:28px"></p>` : "")
      + `<div id="gcDet" data-gc="${esc0(g.id)}"><p class="hint">${TX("Pobieram szczegóły z GeoConfirmed…")}</p></div>`
      + dd([[TX("POZYCJA"), fmtLL(g.lat, g.lon)], [TX("STRONA"), L(g.url, "geoconfirmed.org"), 1]]) + evBox("gc", g.id) + satBtn(g.lat, g.lon, .6); }
  if (t === "eq") { const e = A(d.emsc).find(x => String(x.id) === key); if (!e) return "";
    return chip("EMSC · " + TX("TRZĘSIENIE ZIEMI"), "#ffb347") + `<h2 class="glow">M${e.mag} · ${esc(e.where || "")}</h2>` + dd([[TX("CZAS"), new Date(e.t).toLocaleString(LOC)], [TX("GŁĘBOKOŚĆ"), e.depth != null ? Math.round(e.depth) + " km" : null], [TX("POZYCJA"), fmtLL(e.lat, e.lon)], [TX("SZCZEGÓŁY"), L(e.url, "seismicportal.eu"), 1]]); }
  if (t === "cr") { const c = A(d.corr).find(x => x.id === key); if (!c) return ""; const a = c.ai || {};
    return chip(TX("ZDARZENIE ZŁOŻONE") + (a.sev ? " · " + TX("WAGA") + " " + a.sev + "/5" : ""), CORR_SEV[a.sev || 2]) + `<h2 class="glow">${esc(a.title || c.lnames.join(" + "))}</h2>`
      + (a.assess ? `<p>${esc(a.assess)}</p>` : `<p class="hint">${TX("AI jeszcze nie oceniło tego zdarzenia (ocena co kilka minut; podczas głównej analizy czeka).")}</p>`)
      + (a.routine ? `<p class="hint">${TX("AI uznało to za rutynowe tło – bez powiadomienia.")}</p>` : "") + (c.hidden ? `<p class="hint">${TX("AI uznało, że sygnały nie są powiązane (przypadkowa zbieżność).")}</p>` : "")
      + dd([[TX("WARSTWY"), c.lnames.join(", ")], [TX("SYGNAŁÓW"), c.n], [TX("ZASIĘG"), "≈ " + c.ext + " km"], [TX("OD"), new Date(c.first).toLocaleString(LOC)], [TX("OSTATNI"), new Date(c.last).toLocaleString(LOC)]])
      + `<p class="sat-h">${TX("SYGNAŁY")}</p><ul class="rows">` + A(c.sig).map(x => `<li><button ${x.go ? `data-go="${esc0(x.go)}"` : 'tabindex="-1" style="cursor:default"'}><span class="t">${esc(x.text)}</span><span class="dim">${hm(x.t)}</span><span class="sub">${esc(x.ln)}</span></button></li>`).join("") + `</ul>`
      + `<p class="hint">${TX("Zdarzenie złożone = kilka różnych warstw danych w tym samym rejonie i czasie. Ocena i scalanie powtórzeń: AI. To hipoteza do sprawdzenia, nie potwierdzony fakt.")}</p>` + evBox("cr", c.id); }
  if (t === "rd") { const r = A(d.rad && d.rad.pts).find(x => x.id === key); if (!r) return "";
    return chip(TX("PROMIENIOWANIE · SAFECAST"), radCol(r.usv)) + `<h2 class="glow">${esc(r.name)} · ${r.usv} µSv/h</h2>` + dd([[TX("TŁO TEJ STACJI"), r.base + " µSv/h"], [TX("STOSUNEK DO TŁA"), (r.usv / Math.max(r.base, .01)).toFixed(1) + "×"],
      [TX("ANOMALIA"), r.anom ? TX("TAK – wyraźnie ponad tłem") : TX("nie")], [TX("KRAJ"), r.cc], [TX("ODCZYT"), new Date(r.t).toLocaleString(LOC)], [TX("POZYCJA"), fmtLL(r.lat, r.lon)]])
      + `<p class="hint">${TX("Typowe tło naturalne to 0,05–0,3 µSv/h. Pojedynczy skok bywa błędem czujnika lub deszczem (radon); liczy się wzrost na kilku stacjach naraz.")}</p>` + satBtn(r.lat, r.lon, 1.5); }
  if (t === "acl") { const row = A(IN.acl).find(x => String(x[0]) === key); const x = ACLD[key]; if (!x) acledDetail(key);
    const tt = row ? ACL_T[row[3]] : (x && x.type) || "other";
    return chip("ACLED · " + ACL_N[tt], ACL_C[tt]) + `<h2 class="glow">${esc(x && x.loc ? x.loc + " · " + x.cc : key)}</h2>` + (x && x.notes ? `<p>${esc(x.notes)}</p>` : x && x.loading ? `<p class="hint">…</p>` : "")
      + dd([[TX("DATA"), (x && x.d) || (row && row[5])], [TX("RODZAJ"), x && x.sub], [TX("STRONY"), x ? [x.a1, x.a2].filter(Boolean).join(" ↔ ") : null], [TX("OFIARY"), row ? row[4] : x && x.fat],
        [TX("REGION"), x && x.adm], [TX("ŹRÓDŁO"), x && x.src]])
      + `<p class="hint">${TX("ACLED – zdarzenia zweryfikowane przez analityków, publikowane z opóźnieniem (zwykle kilka dni). Liczby ofiar to szacunki z raportów.")}</p>`; }
  if (t === "ua") { const o = A(d.ua && d.ua.oblasts).find(x => x.id === key); if (!o) return "";
    return chip(TX("ALARM PRZECIWLOTNICZY"), "var(--red)") + `<h2 class="glow">${esc(o.name)}</h2>` + dd([[TX("STAN"), o.on ? TX("ALARM TRWA") : TX("brak alarmu")], [TX("OD"), o.since ? hm(o.since) + " (" + cd(Date.now() - o.since) + ")" : null],
      [TX("RODZAJ"), A(o.kinds).join(", ")], [TX("ŹRÓDŁO"), d.ua.src]]) + `<p class="hint">${TX("Dokładniejsze dane (rodzaj zagrożenia, rejony i gminy) daje darmowy token alerts.in.ua.")}</p>` + evBox("ua", o.id) + satBtn(o.lat, o.lon, 2.5); }
  if (t === "nt") { const n = A(d.notam && d.notam.items).find(x => x.id === key); if (!n) return "";
    return chip("NOTAM · " + (NT_N[n.kind] || n.kind), NT_COL[n.kind] || "var(--violet)") + `<h2 class="glow">${esc(n.loc)} ${esc(n.num || "")}</h2>` + dd([[TX("OD"), n.from], [TX("DO"), n.to], [TX("PROMIEŃ"), n.r ? Math.round(n.r) + " km" : null]])
      + `<pre class="ntext">${esc0(n.text)}</pre><p class="hint">${TX("Źródło: FAA NOTAM API. Treść w oryginalnym, skrótowym formacie ICAO.")}</p>`; }
  if (t === "tg") { const p = A(d.tg).find(x => x.id === key); if (!p) return "";
    return chip("TELEGRAM · @" + p.ch, "var(--cyan)") + `<h2 class="glow">${esc(p.title || p.ch)}</h2>` + (p.summary ? `<p>${esc(p.summary)}</p>` : "")
      + dd([[TX("KANAŁ"), `${esc(p.chn)} (${esc(p.type)})`, 1], [TX("WIARYGODNOŚĆ"), p.cred ? p.cred + " · " + (REL[p.cred] || "") : null], [TX("KIEDY"), new Date(p.t).toLocaleString(LOC)], [TX("MIEJSCE"), p.place],
        [TX("TO SAMO PODAJĄ"), A(p.also).map(x => "@" + x).join(", ")], [TX("ORYGINAŁ"), L(p.url, "t.me/" + p.id), 1]])
      + evGal(p.m, p) + `<p class="hint">${TX("Streszczenie i ocena: lokalne AI. Komunikaty stron wojny i propaganda to twierdzenia, nie potwierdzone fakty. Pozycja na mapie jest przybliżona.")}</p>` + evBox("tg", p.id) + (p.pos ? satBtn(p.pos[0], p.pos[1], 1.2) : ""); }
  if (t === "la") { const a = A(sdr.adsb).find(x => x.hex === key); if (!a) return "";
    return chip(TX("TWÓJ ODBIORNIK ADS-B"), a.mil ? "var(--cyan)" : "var(--phos)") + `<h2 class="glow">${esc(a.cs || a.hex.toUpperCase())} · ${esc(a.t || "?")}</h2>` + dd([[TX("REJESTRACJA"), a.r], [TX("ADRES ICAO"), a.hex.toUpperCase()],
      [TX("WYSOKOŚĆ"), a.alt != null ? a.alt + " ft" : null], [TX("PRĘDKOŚĆ"), a.gs ? Math.round(a.gs) + " kt" : null], [TX("KURS"), a.trk != null ? Math.round(a.trk) + "°" : null], [TX("SQUAWK"), a.sq],
      [TX("SYGNAŁ"), a.rssi != null ? a.rssi + " dBFS" : null], [TX("ODLEGŁOŚĆ"), Math.round(dist(qth(), a) / 1.852) + " NM"], [TX("PODGLĄD"), L("https://globe.adsb.fi/?icao=" + a.hex, "adsb.fi"), 1]]); }
  if (t === "ap") { const s = A(sdr.aprs).find(x => x.call === key); if (!s) return "";
    return chip("APRS", "var(--violet)") + `<h2 class="glow">${esc(s.call)}</h2>` + dd([[TX("RODZAJ"), s.kind], [TX("KOMENTARZ"), s.cmt], [TX("PRĘDKOŚĆ"), s.spd != null ? s.spd + " km/h" : null], [TX("POZYCJA"), fmtLL(s.lat, s.lon)],
      [TX("ODLEGŁOŚĆ"), Math.round(dist(qth(), s)) + " km"], [TX("OSTATNIO"), hm(s.t)], [TX("PODGLĄD"), L("https://aprs.fi/#!call=" + encodeURIComponent(s.call), "aprs.fi"), 1]]); }
  return "";
}
const dist = (a, b) => { const r = Math.PI / 180, x = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2; return 12742 * Math.asin(Math.min(1, Math.sqrt(x))); };
function intelLL(t, key) {
  const d = IN.d || {}, s = IN.sdr || {};
  if (t === "cr") { const c = A(d.corr).find(x => x.id === key); return c && [c.lat, c.lon, Math.max(1.5, Math.min(8, (c.ext || 80) / 40)), "corr"]; }
  if (t === "rd") { const r = A(d.rad && d.rad.pts).find(x => x.id === key); return r && [r.lat, r.lon, 2, "rad"]; }
  if (t === "acl") { const a = A(IN.acl).find(x => String(x[0]) === key); return a && [a[1], a[2], 1.5, "acled"]; }
  if (t === "il") { const a = ilAll().find(x => x.c === key); return a && [a.lat, a.lon, 1, "il"]; }
  if (t === "gc") { const g = A(IN.gc).find(x => x.id === key); return g && [g.lat, g.lon, 1, "gc"]; }
  if (t === "eq") { const e = A(d.emsc).find(x => String(x.id) === key); return e && [e.lat, e.lon, 6, "emsc"]; }
  if (t === "ua") { const o = A(d.ua && d.ua.oblasts).find(x => x.id === key); return o && [o.lat, o.lon, 8, "uaal"]; }
  if (t === "nt") { const n = A(d.notam && d.notam.items).find(x => x.id === key); return n && n.pos && [n.pos[0], n.pos[1], 6, "notam"]; }
  if (t === "tg") { const p = A(d.tg).find(x => x.id === key); return p && p.pos && [p.pos[0], p.pos[1], 4, "osint"]; }
  if (t === "la") { const a = A(s.adsb).find(x => x.hex === key); return a && [a.lat, a.lon, 2, "myadsb"]; }
  if (t === "ap") { const a = A(s.aprs).find(x => x.call === key); return a && [a.lat, a.lon, 1, "aprs"]; }
  return null;
}
/* zdjęcie satelitarne NASA dla dowolnego miejsca */
function satBtn(lat, lon, span) { return `<p class="satimg-row"><button class="btn" data-satimg="${(+lat).toFixed(3)},${(+lon).toFixed(3)},${span || 1.5}">${TX("ZDJĘCIE SATELITARNE (NASA, wczoraj)")}</button></p><div class="satimg" hidden></div>`; }
function bindSatImg() {
  const b = $("#detail [data-satimg]"); if (!b) return;
  b.addEventListener("click", () => { const [la, lo, sp] = b.dataset.satimg.split(",").map(Number), box = $("#detail .satimg"); box.hidden = false;
    const show = (layer, date) => { const cop = /^s2|s1|swir$/.test(layer); box.innerHTML = `<div class="seg"><button class="btn" data-sl="true">${TX("KOLOR")}</button><button class="btn" data-sl="fires">${TX("POŻARY")}</button><button class="btn" data-sl="night">${TX("NOC (ŚWIATŁA)")}</button><button class="btn" data-sl="s2" title="${TX("Copernicus Sentinel-2: 10 m, najmniej chmur z ostatnich 12 dni (klucz w ŹRÓDŁA I INTEGRACJE)")}">SENTINEL-2</button><button class="btn" data-sl="s1" title="${TX("Copernicus Sentinel-1: radar, widzi przez chmury i w nocy")}">${TX("RADAR S-1")}</button><button class="btn" data-sl="swir" title="${TX("Sentinel-2 w podczerwieni – pożary i świeże wypalenia")}">SWIR</button><button class="btn" data-sz="0.5">${TX("BLIŻEJ")}</button><button class="btn" data-sz="2">${TX("DALEJ")}</button></div>${cop ? `<img alt="" src="/api/s2img?lat=${la}&lon=${lo}&span=${Math.max(2, Math.round((box.dataset.sp || sp) * 30))}&kind=${layer === "swir" ? "fire" : layer}" onerror="this.outerHTML='<p class=&quot;hint red&quot;>${TX("Copernicus: brak klucza (ŹRÓDŁA I INTEGRACJE) albo brak zdjęcia z ostatnich dni.")}</p>'"><p class="hint">${TX("Copernicus Sentinel (ESA) · 10 m na piksel · najnowsze zdjęcie z ostatnich dni; radar S-1 widzi przez chmury i w nocy (jasne = metal, budynki, statki).")}</p>`
      : `<img alt="" src="/api/satimg?lat=${la}&lon=${lo}&span=${box.dataset.sp || sp}&layer=${layer}"><p class="hint">${TX("NASA Worldview · VIIRS/MODIS · zdjęcie z wczoraj (dane z opóźnieniem do doby; chmury zasłaniają widok). Warstwa NOC pokazuje światła miast – przydaje się do wykrywania przerw w dostawach prądu.")}</p>`}`;
      box.querySelectorAll("[data-sl]").forEach(x => { x.setAttribute("aria-pressed", x.dataset.sl === layer); x.addEventListener("click", () => show(x.dataset.sl)); });
      box.querySelectorAll("[data-sz]").forEach(x => x.addEventListener("click", () => { box.dataset.sp = Math.max(.2, Math.min(12, (+box.dataset.sp || sp) * +x.dataset.sz)); show(layer); })); };
    box.dataset.sp = sp; show("true"); b.closest(".satimg-row").hidden = true; });
}
setInterval(() => { if (!document.hidden) pollIntel(); }, 30000);
let sdrTick = 0;
setInterval(() => { sdrTick++; if (!document.hidden && ((layerOn.myadsb || layerOn.aprs) || sdrTick % 10 === 0)) pollSdr(); }, 3000);

/* ------------------------------------------------------------ MODELE LOKALNE (v3.18): wybór, polecane do sprzętu, pobieranie dowolnego */
let MDV = null, mdT = null, mdWant = null;
const FIT_COL = { gpu: "var(--phos)", mix_moe: "var(--amber)", mix: "var(--phos-dim)", cpu: "var(--phos-dim)", no: "var(--red)", unknown: "var(--phos-dim)" };
async function mdLoad(rescan) { try { MDV = await api("/api/models" + (rescan ? "?rescan=1" : "")); } catch (e) { return; } mdRender(); }
function mdRender() {
  const v = MDV; if (!v) return; const hw = v.hw || {}, pl = v.pull || {}, ol = v.backend === "ollama";
  $("#mdHw").innerHTML = `${esc(hw.gpu_name || "")}${hw.vram_gb ? " · " + hw.vram_gb + " " + TX("GB VRAM") : ""} · ${hw.ram_gb} ${TX("GB RAM")} · ${TX("silnik")}: ${v.backend ? esc(v.backend === "ollama" ? "Ollama" : v.backend === "lmstudio" ? "LM Studio" : v.backend) : `<span class="red">${TX("nie wykryto – zainstaluj Ollamę (ollama.com)")}</span>`}`
    + `<br>${TX("Aktywny")}: <b>${esc(v.active || "—")}</b>${v.auto ? " (" + TX("automatycznie") + ")" : ""}${v.best_fast ? " · " + TX("najszybszy dobry") + ": " + esc(v.best_fast) : ""}${v.best_quality ? " · " + TX("najlepsza jakość") + ": " + esc(v.best_quality) : ""}`;
  const fitB = (f, t) => `<span class="st" style="color:${FIT_COL[f] || "inherit"}">${esc(t)}</span>`;
  $("#mdInst").innerHTML = `<div class="tts-row"><span class="nm">${TX("AUTOMATYCZNIE")} <small class="dim">${TX("najlepszy zainstalowany, który mieści się na karcie")}</small></span><span class="st">${v.auto ? TX("AKTYWNY") : ""}</span><span class="bt">${v.auto ? "" : `<button class="btn" data-use="auto">${TX("UŻYJ")}</button>`}</span></div>`
    + (A(v.installed).map(m => `<div class="tts-row"><span class="nm">${esc(m.name)} <small class="dim">${m.size_gb ? m.size_gb + " GB" : ""}</small></span>${fitB(m.fit, m.fit_txt)}<span class="bt">${m.active && !v.auto ? `<b>${TX("AKTYWNY")}</b>` : `<button class="btn" data-use="${esc(m.name)}">${TX("UŻYJ")}</button>`}${ol && !(m.active && !v.auto) ? ` <button class="btn" data-del="${esc(m.name)}" title="${TX("Usuń z dysku")}">✕</button>` : ""}</span></div>`).join("") || `<p class="hint">${TX("Brak zainstalowanych modeli.")}</p>`);
  $("#mdCat").innerHTML = A(v.catalog).map(c => `<div class="tts-row"><span class="nm">${esc(c.name)} <small class="dim">${c.size_gb} GB${c.moe ? " · MoE" : ""} – ${esc(c.desc)}</small></span>${fitB(c.fit, c.fit_txt)}<span class="bt">${c.installed ? `<span class="dim">${TX("zainstalowany")}</span>` : ol ? `<button class="btn${c.fit === "no" ? " dimbtn" : ""}" data-pull="${esc(c.name)}"${c.fit === "no" ? ' data-big="1"' : ""}>${TX("POBIERZ")}</button>` : ""}</span></div>`).join("");
  const bar = $("#mdBar"); bar.hidden = !pl.active; bar.firstChild.style.width = (pl.pct || 0) + "%";
  if (pl.active) $("#mdMsg").textContent = TX("Pobieram") + " · " + (pl.status || "") + " · " + (pl.pct || 0) + "%";
  else if (pl.status && pl.status !== "gotowe") $("#mdMsg").textContent = pl.status;
  $("#mdPull").disabled = !!pl.active || !ol; $$("#modelModal [data-pull]").forEach(b => b.disabled = !!pl.active);
  $$("#modelModal [data-use]").forEach(b => b.addEventListener("click", () => mdUse(b.dataset.use)));
  $$("#modelModal [data-pull]").forEach(b => b.addEventListener("click", () => { if (b.dataset.big && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = TX("NA PEWNO?"); return; } mdPull(b.dataset.pull); }));
  $$("#modelModal [data-del]").forEach(b => b.addEventListener("click", async () => { if (!confirmDel(b)) return; const r = await api("/api/model/delete", { name: b.dataset.del }); if (r.ok === false) $("#mdMsg").textContent = r.error; else { MDV = r; mdRender(); } }));
  if (pl.active) { clearTimeout(mdT); mdT = setTimeout(() => { if (!$("#modelModal").hidden || mdWant) mdLoad(); }, 1500); }
  else if (mdWant) { const w = mdWant; mdWant = null; if (A(v.installed).some(m => m.name === w || m.name === w + ":latest" || m.name.split(":")[0] === w)) { const nm = A(v.installed).find(m => m.name === w || m.name === w + ":latest" || m.name.split(":")[0] === w).name; $("#mdMsg").textContent = TX("Pobrano") + " " + nm + "."; if ($("#mdUse").checked) mdUse(nm); } }
}
function confirmDel(b) { if (b.dataset.sure) return true; b.dataset.sure = 1; b.textContent = TX("NA PEWNO?"); setTimeout(() => { delete b.dataset.sure; b.textContent = "✕"; }, 3000); return false; }
async function mdUse(name) { const r = await api("/api/model/use", { name }); if (r.ok === false) $("#mdMsg").textContent = r.error || TX("błąd"); else { $("#mdMsg").textContent = TX("Aktywny model:") + " " + (name === "auto" ? TX("automatycznie") : name); beep(1400, .08); } MDV = r; mdRender(); pollStatus(); }
async function mdPull(name) { if (!name) return; $("#mdMsg").textContent = TX("Zaczynam pobieranie…") + " " + name;
  const r = await api("/api/model/pull", { name }); if (r.ok === false) { $("#mdMsg").textContent = r.error; return; } mdWant = name; setTimeout(() => mdLoad(), 800); }
$("#modelOpen").addEventListener("click", async () => { $("#settings").hidden = true; await mdLoad(true); $("#mdMsg").textContent = ""; $("#modelModal").hidden = false; $("#modelClose").focus(); });
$("#modelClose").addEventListener("click", () => { $("#modelModal").hidden = true; });
$("#modelModal").addEventListener("click", e => { if (e.target.id === "modelModal") $("#modelModal").hidden = true; });
$("#mdPull").addEventListener("click", () => mdPull($("#mdName").value.trim()));
/* Hugging Face: wyszukiwanie GGUF → repozytorium → wariant */
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + " mln" : n >= 1e3 ? Math.round(n / 1e3) + " tys." : String(n);
async function hfSearch() { const q = $("#hfQ").value.trim(); if (!q) return; $("#hfRes").innerHTML = `<p class="hint">${TX("Szukam…")}</p>`;
  try { const r = await api("/api/hf/search?q=" + encodeURIComponent(q));
    $("#hfRes").innerHTML = r.error ? `<p class="hint red">${esc(r.error)}</p>` : A(r.res).map(m => `<div class="tts-row"><span class="nm">${esc(m.id)} <small class="dim">↓ ${fmtN(m.downloads)} · ♥ ${m.likes}${m.updated ? " · " + m.updated : ""}${m.gated ? " · " + TX("ograniczony dostęp") : ""}</small></span><span class="st"></span><span class="bt"><button class="btn" data-hfrepo="${esc(m.id)}">${TX("WARIANTY")}</button></span></div><div class="hffiles" data-hff="${esc(m.id)}"></div>`).join("") || `<p class="hint">${TX("Nic nie znaleziono w formacie GGUF.")}</p>`;
    $$("#hfRes [data-hfrepo]").forEach(b => b.addEventListener("click", () => hfFiles(b.dataset.hfrepo))); } catch (e) { $("#hfRes").innerHTML = `<p class="hint red">${TX("błąd")}</p>`; } }
async function hfFiles(repo) { const box = $(`#hfRes [data-hff="${CSS.escape(repo)}"]`); if (!box) return; if (box.innerHTML) { box.innerHTML = ""; return; } box.innerHTML = `<p class="hint">…</p>`;
  const r = await api("/api/hf/files?repo=" + encodeURIComponent(repo));
  if (r.error) { box.innerHTML = `<p class="hint red">${esc(r.error)}</p>`; return; }
  box.innerHTML = (r.gated ? `<p class="hint amber">${TX("Model z ograniczonym dostępem – zanim pobierzesz, zaakceptuj licencję na")} ${L(r.url, "huggingface.co")} ${TX("i dodaj klucz Ollamy (niżej: „Modele z ograniczonym dostępem”).")}</p>` : "")
    + (A(r.files).map(f => `<div class="tts-row"><span class="nm">${f.rec ? "★ " : ""}${esc(f.quant || f.file)} <small class="dim">${f.size_gb} GB</small></span><span class="st" style="color:${FIT_COL[f.fit]}">${esc(f.fit_txt)}</span><span class="bt"><button class="btn${f.fit === "no" ? " dimbtn" : ""}" data-hfpull="${esc(f.name)}"${f.fit === "no" ? ` data-big="1" title="${TX("Prawdopodobnie za duży – kliknij dwa razy, aby mimo to pobrać")}"` : ""}>${TX("POBIERZ")}</button></span></div>`).join("")
      || `<p class="hint">${TX("Brak pojedynczych plików GGUF w tym repozytorium.")}</p>`)
    + (A(r.split).length ? `<p class="hint">${TX("Pominięte warianty podzielone na części (Ollama ich nie pobierze):")} ${esc(r.split.join(", "))}</p>` : "");
  box.querySelectorAll("[data-hfpull]").forEach(b => b.addEventListener("click", () => { if (b.dataset.big && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = TX("NA PEWNO?"); return; } mdPull(b.dataset.hfpull); })); }
$("#hfGo").addEventListener("click", hfSearch);
$("#hfQ").addEventListener("keydown", e => { if (e.key === "Enter") hfSearch(); });
$(".hfgate").addEventListener("toggle", async () => { if (!$(".hfgate").open) return; try { const r = await api("/api/hf/key"); $("#hfKey").value = r.key || TX("nie znaleziono klucza Ollamy – uruchom Ollamę raz, a klucz utworzy się w folderze .ollama"); $("#hfTok").placeholder = r.token_set ? TX("token zapisany – wpisz nowy, aby zmienić") : "hf_…"; } catch (e) {} });
$("#hfKeyCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#hfKey").value); $("#mdMsg").textContent = TX("Skopiowano klucz Ollamy."); } catch (e) { $("#hfKey").select(); document.execCommand("copy"); } });
$("#hfTokSave").addEventListener("click", async () => { const r = await api("/api/hf/token", { token: $("#hfTok").value.trim() }); $("#mdMsg").textContent = r.ok ? (r.token_set ? TX("Token zapisany.") : TX("Token usunięty.")) : r.error; $("#hfTok").value = ""; });
$("#mdName").addEventListener("keydown", e => { if (e.key === "Enter") mdPull($("#mdName").value.trim()); });

/* ------------------------------------------------------------ AI W CHMURZE (v3.17) */
let CLV = null;
function cloudFill() {
  const v = CLV; if (!v) return;
  $("#clProv").innerHTML = `<option value="">${TX("WYŁĄCZONE – tylko lokalny model")}</option>` + Object.entries(v.providers).map(([k, p]) => `<option value="${k}">${esc(TX(p.name))}</option>`).join("");
  $("#clProv").value = v.provider || ""; $("#clModel").value = v.provider ? v.model : ""; $("#clBase").value = v.base || "";
  $("#clKey").value = ""; $("#clKey").placeholder = v.key ? TX("klucz ustawiony") + " (" + v.key + ") – " + TX("wpisz nowy, aby zmienić") : TX("wklej klucz");
  const u = v.use || {}; $("#clUseMain").checked = u.main !== false; $("#clUseAsk").checked = u.ask !== false; $("#clUseBg").checked = !!u.bg; $("#clFallback").checked = v.fallback !== false;
  cloudProv(); cloudStat();
}
function cloudProv() {
  const k = $("#clProv").value, p = CLV && CLV.providers[k];
  $("#clHelp").textContent = p ? TX("Klucz:") + " " + p.help + (p.model ? " · " + TX("domyślny model:") + " " + p.model : "") : TX("AI działa tylko na Twoim komputerze.");
  $("#clBase").hidden = $("#clBaseL").hidden = k !== "custom";
  if (p && !$("#clModel").value) $("#clModel").placeholder = p.model || "";
}
function cloudStat() {
  const v = CLV; if (!v) return; const s = v.stats || {}, e = v.err;
  $("#clStat").innerHTML = !v.provider ? `<p class="hint">${TX("Chmura wyłączona.")}</p>` :
    `<div class="tts-row"><span class="nm">${esc(v.label || "—")}</span><span class="st ${v.available ? "" : "red"}">${!v.configured ? TX("brak klucza") : v.available ? TX("GOTOWE") : TX("PRZERWA")}</span><span class="bt"></span></div>`
    + `<p class="hint">${TX("Dziś:")} ${s.calls || 0} ${TX("zapytań")} · ${TX("błędów")} ${s.fails || 0} · ${TX("na lokalnym zamiast chmury")} ${s.fallbacks || 0} · ${TX("tokeny")} ${(s.tok_in || 0).toLocaleString(LOC)} / ${(s.tok_out || 0).toLocaleString(LOC)}${s.last_ok ? " · " + TX("ostatnio OK") + " " + hm(s.last_ok) : ""}</p>`
    + (e ? `<p class="hint red">${esc(e.msg)}${e.until > Date.now() ? " · " + TX("chmura wraca o") + " " + hm(e.until) : ""}</p>` : "");
}
async function cloudSave() {
  const body = { provider: $("#clProv").value, model: $("#clModel").value.trim(), base: $("#clBase").value.trim(), key: $("#clKey").value.trim(),
    use: { main: $("#clUseMain").checked, ask: $("#clUseAsk").checked, bg: $("#clUseBg").checked }, fallback: $("#clFallback").checked };
  try { CLV = await api("/api/cloud", body); cloudFill(); $("#clMsg").textContent = TX("Zapisano."); beep(1400, .08); pollStatus(); } catch (e) { $("#clMsg").textContent = TX("Nie udało się zapisać."); }
}
$("#cloudOpen").addEventListener("click", async () => { $("#settings").hidden = true; try { CLV = await api("/api/cloud"); } catch (e) { return; } $("#clMsg").textContent = ""; cloudFill(); $("#cloudModal").hidden = false; $("#cloudClose").focus(); });
$("#cloudClose").addEventListener("click", () => { $("#cloudModal").hidden = true; });
$("#cloudModal").addEventListener("click", e => { if (e.target.id === "cloudModal") $("#cloudModal").hidden = true; });
$("#clProv").addEventListener("change", () => { const p = CLV.providers[$("#clProv").value]; $("#clModel").value = p ? p.model : ""; $("#clModels").innerHTML = ""; cloudProv(); });
$("#clSave").addEventListener("click", cloudSave);
$("#clTest").addEventListener("click", async () => { await cloudSave(); $("#clMsg").textContent = TX("Łączę…");
  try { const r = await api("/api/cloud/test", {}); CLV = r.view || CLV; cloudStat(); $("#clMsg").textContent = r.ok ? TX("Działa") + " · " + r.ms + " ms" + (r.answer && r.answer.model ? " · " + r.answer.model : "") : TX("Błąd:") + " " + (r.error || "?"); } catch (e) { $("#clMsg").textContent = TX("błąd"); } });
$("#clList").addEventListener("click", async () => { await cloudSave(); $("#clMsg").textContent = TX("Pobieram listę…");
  try { const r = await api("/api/cloud/models", {}); $("#clModels").innerHTML = A(r.models).map(m => `<option value="${esc(m)}">`).join(""); $("#clMsg").textContent = r.error ? TX("Błąd:") + " " + r.error : A(r.models).length + " " + TX("modeli – kliknij pole Model, aby wybrać"); } catch (e) { $("#clMsg").textContent = TX("błąd"); } });
$("#clClear").addEventListener("click", async () => { CLV = await api("/api/cloud", { clear_key: true }); cloudFill(); $("#clMsg").textContent = TX("Klucz usunięty."); });

/* ------------------------------------------------------------ MAPY OFFLINE */
const OFF_KB = { dark: 22, darkesri: 30, sat: 45, osm: 18 };
function viewBBox() {
  if (!MERC || mode !== "flat") return [-180, -85, 180, 85];
  const inv = (sx, sy) => flat.invert([((sx - vX) / vS - T.x) / T.k, ((sy - vY) / vS - T.y) / T.k]);
  const a = inv(0, 0), b = inv(cvW, cvH);
  return [Math.max(-180, a[0]), Math.max(-85, b[1]), Math.min(180, b[0]), Math.min(85, a[1])].map(v => +v.toFixed(4));
}
let offT = null, OFFV = null;
async function offRefresh() {
  try { OFFV = await api("/api/tiles"); } catch (e) { return; }
  $("#offStat").textContent = OFFV.n + " " + TX("kafelków") + " · " + OFFV.mb + " MB";
  const j = OFFV.job, bar = $("#offModal .offbar");
  if (j) { bar.hidden = false; bar.firstChild.style.width = Math.round(100 * j.done / Math.max(1, j.total)) + "%";
    $("#offMsg").textContent = (j.running ? TX("Pobieram…") + " " : TX("Gotowe.") + " ") + j.done + " / " + j.total + " · " + TX("nowych") + " " + j.new + " (" + (j.bytes / 1e6).toFixed(0) + " MB)" + (j.fail ? " · " + TX("błędów") + " " + j.fail : ""); }
  $("#offStop").hidden = !(j && j.running); $("#offGo").disabled = !!(j && j.running);
  if (j && j.running) { clearTimeout(offT); offT = setTimeout(() => { if (!$("#offModal").hidden) offRefresh(); }, 1500); }
}
async function offEstimate() {
  const g = $("#offGroup").value, world = $("#offArea").value === "world";
  const zs = world ? [3, 4, 5, 6, 7] : [6, 7, 8, 9, 10, 11, 12], cur = +$("#offZoom").value;
  $("#offZoom").innerHTML = zs.map(z => `<option value="${z}">${z}</option>`).join(""); $("#offZoom").value = zs.includes(cur) ? cur : world ? 6 : 10;
  if (g === "osm") { $("#offEst").textContent = TX("OpenStreetMap nie pozwala na pobieranie hurtowe – KRONOS zapamiętuje tylko miejsca, które obejrzysz."); $("#offGo").disabled = true; return; }
  $("#offGo").disabled = !!(OFFV && OFFV.job && OFFV.job.running);
  try { const bbox = world ? [-180, -85, 180, 85] : viewBBox(), r = await api("/api/tiles", { act: "count", bbox, zmax: +$("#offZoom").value });
    const layers = g === "dark" ? 1 : 2, n = r.n * layers, mb = n * OFF_KB[g] * (g === "dark" && DPR > 1 ? 2.5 : 1) / 1000;
    $("#offEst").textContent = TX("Do pobrania ok.") + " " + n.toLocaleString(LOC) + " " + TX("kafelków") + " · ~" + Math.round(mb) + " MB · ~" + Math.max(1, Math.round(n / 8 / 60)) + " min" + (n > 60000 ? " – " + TX("za dużo, zmniejsz szczegółowość") : ""); } catch (e) {}
}
$("#offBtn").addEventListener("click", () => { const g = BASES[BASE] && BASE !== "vector" ? BASE : "dark"; $("#offGroup").value = g; $("#offModal").hidden = false; offEstimate(); offRefresh(); $("#offClose").focus(); });
$("#offClose").addEventListener("click", () => { $("#offModal").hidden = true; });
$("#offModal").addEventListener("click", e => { if (e.target.id === "offModal") $("#offModal").hidden = true; });
["offGroup", "offArea", "offZoom"].forEach(id => $("#" + id).addEventListener("change", offEstimate));
$("#offGo").addEventListener("click", async () => { const world = $("#offArea").value === "world";
  const r = await api("/api/tiles", { act: "start", group: $("#offGroup").value, bbox: world ? [-180, -85, 180, 85] : viewBBox(), zmax: +$("#offZoom").value, retina: DPR > 1 });
  if (!r.ok) $("#offMsg").textContent = r.error || TX("błąd"); else beep(1400, .08); offRefresh(); });
$("#offStop").addEventListener("click", async () => { await api("/api/tiles", { act: "cancel" }); setTimeout(offRefresh, 800); });
$("#offClear").addEventListener("click", async () => { await api("/api/tiles", { act: "clear", group: $("#offGroup").value }); TILES.forEach(o => o.px && o.px.close && o.px.close()); TILES.clear(); tileSig = ""; markStatic(); offRefresh(); });

/* ------------------------------------------------------------ okno ŹRÓDŁA I INTEGRACJE */
const INTG_FIELDS = ["stadia_key", "kystverket", "ais_tcp", "aishub_user", "alerts_token", "ua_watch", "faa_id", "faa_secret", "notam_locs", "gfw_token", "adsb_url", "ais_port", "aprs_on", "aprs_km", "ha_webhook",
  "imap_host", "imap_port", "imap_user", "imap_pass", "imap_folder", "imap_senders", "imap_days", "acled_user", "acled_pass", "acled_days",
  "ev_sources", "reddit_id", "reddit_secret", "reddit_subs", "yt_key", "vk_token", "gc_conflicts", "cdse_id", "cdse_secret", "opensky_id", "opensky_secret", "cf_token"];
const INTG_SECRET = new Set(["alerts_token", "gfw_token", "faa_secret", "imap_pass", "acled_pass", "reddit_secret", "yt_key", "vk_token", "cdse_secret", "opensky_secret", "cf_token"]);
let INTG = null;
async function openIntg() {
  $("#settings").hidden = true; try { INTG = await api("/api/intg"); } catch (e) { return; }
  INTG_FIELDS.forEach(k => { const el = $("#ig_" + k); if (!el) return;
    if (el.type === "checkbox") el.checked = !!INTG[k];
    else if (INTG_SECRET.has(k)) { el.value = ""; el.placeholder = INTG[k] ? TX("ustawiony") + " (" + INTG[k] + ") – " + TX("wpisz nowy, aby zmienić") : el.dataset.ph || ""; }
    else { el.value = INTG[k] || ""; if (INTG.defaults[k]) el.placeholder = INTG.defaults[k]; } });
  renderTgCat(); renderIntgStatus(); tgaLoad(); $("#intgModal").hidden = false; $("#intgClose").focus();
}
/* konto Telegram (v3.20) */
let TGA = null, tgaT = null;
async function tgaLoad() { try { TGA = await api("/api/tgacct"); } catch (e) { return; } tgaRender(); }
function tgaRender(msg) {
  const v = TGA; if (!v) return; const box = $("#tgaBox"); let h = "";
  if (!v.installed) h = `<p class="hint">${TX("Potrzebna biblioteka Telethon (ok. 2 MB).")}</p><div class="set-row"><button type="button" class="btn" data-tga="install" ${v.install === "running" ? "disabled" : ""}>${v.install === "running" ? TX("INSTALUJĘ…") : TX("ZAINSTALUJ OBSŁUGĘ KONTA")}</button></div>${v.install && v.install.startsWith("error") ? `<p class="hint red">${esc(v.install)}</p>` : ""}`;
  else if (v.step === "ready") h = `<div class="tts-row"><span class="nm">${TX("Zalogowano")}: <b>${esc((v.me || {}).name || "")}</b>${(v.me || {}).username ? " @" + esc(v.me.username) : ""}${(v.me || {}).premium ? " · Premium" : ""}</span><span class="st">OK</span><span class="bt"><button type="button" class="btn" data-tga="logout">${TX("WYLOGUJ")}</button></span></div>`
    + (v.flood ? `<p class="hint">${TX("Darmowe wyszukiwania pełnotekstowe dziś:")} ${v.flood.remains} / ${v.flood.total}</p>` : "");
  else {
    h = `<input id="tga_id" inputmode="numeric" autocomplete="off" placeholder="api_id" value="${esc(v.api_id || "")}">`
      + `<input id="tga_hash" type="password" autocomplete="off" placeholder="${v.hash_set ? TX("api_hash zapisany – wpisz nowy, aby zmienić") : "api_hash"}">`
      + `<input id="tga_phone" autocomplete="off" placeholder="${TX("numer telefonu z kierunkowym, np. +447…")}" value="${esc(v.phone || "")}">`
      + `<div class="set-row"><button type="button" class="btn" data-tga="save">${TX("ZAPISZ")}</button>${v.configured && v.phone ? `<button type="button" class="btn" data-tga="code">${TX("WYŚLIJ KOD")}</button>` : ""}</div>`;
    if (v.step === "code") h += `<label for="tga_code">${TX("Kod z Telegrama")} <small>${TX("przyszedł w aplikacji Telegram (czat „Telegram”)")}</small></label><div class="set-row"><input id="tga_code" inputmode="numeric" autocomplete="one-time-code"><button type="button" class="btn" data-tga="signin">${TX("ZALOGUJ")}</button></div>`;
    if (v.step === "password") h += `<label for="tga_pw">${TX("Hasło dwuetapowe (chmurowe) Telegrama")}</label><div class="set-row"><input id="tga_pw" type="password" autocomplete="current-password"><button type="button" class="btn" data-tga="password">${TX("ZALOGUJ")}</button></div>`;
  }
  h += (msg || v.err) ? `<p class="hint red">${esc(msg || v.err)}</p>` : "";
  h += `<p class="hint">${TX("Sesja zapisuje się w pliku data/tg_account.session – daje dostęp do konta, nie udostępniaj go. WYLOGUJ usuwa sesję.")}</p>`;
  box.innerHTML = h;
  box.querySelectorAll("[data-tga]").forEach(b => b.addEventListener("click", async () => { const act = b.dataset.tga, body = { act };
    if (act === "save") Object.assign(body, { api_id: $("#tga_id").value, api_hash: $("#tga_hash").value, phone: $("#tga_phone").value });
    if (act === "signin") body.code = $("#tga_code").value; if (act === "password") body.password = $("#tga_pw").value;
    b.disabled = true; try { TGA = await api("/api/tgacct", body); tgaRender(TGA.error); } catch (e) { tgaRender(TX("błąd")); }
    if (act === "install") { clearTimeout(tgaT); const poll = async () => { await tgaLoad(); if (TGA.install === "running") tgaT = setTimeout(poll, 2500); }; tgaT = setTimeout(poll, 2500); } }));
}
/* katalog kanałów Telegram – lista z zaznaczaniem, pogrupowana regionami */
function renderTgCat() {
  const cat = A(INTG.tg_catalog), known = new Set(cat.map(c => c.ch.toLowerCase()));
  const cur = String(INTG.tg_channels || INTG.defaults.tg_channels || "").split(/[,\s]+/).filter(Boolean), on = new Set(cur.map(x => x.toLowerCase()));
  const groups = {}; cat.forEach(c => (groups[c.g] = groups[c.g] || []).push(c));
  $("#tgCat").innerHTML = Object.entries(groups).map(([g, cs]) => `<p class="tgg" data-tgg="${g}" title="${TX("kliknij, aby zaznaczyć lub odznaczyć całą grupę")}">${TX((INTG.tg_groups || {})[g] || g)}</p>` + cs.map(c =>
    `<label class="chk"><input type="checkbox" data-tg="${esc(c.ch)}"${on.has(c.ch.toLowerCase()) ? " checked" : ""}> <span>${esc(TX(c.name))} <small>@${esc(c.ch)} · ${esc(TX(c.type))}</small></span></label>`).join("")).join("");
  $("#ig_tg_extra").value = cur.filter(x => !known.has(x.toLowerCase())).join(", ");
  $("#tgCat").querySelectorAll("[data-tgg]").forEach(h => h.addEventListener("click", () => { const bs = [...$("#tgCat").querySelectorAll(`[data-tg]`)].filter(b => cat.find(c => c.ch === b.dataset.tg).g === h.dataset.tgg), v = !bs.every(b => b.checked); bs.forEach(b => b.checked = v); tgCount(); }));
  $("#tgCat").querySelectorAll("[data-tg]").forEach(b => b.addEventListener("change", tgCount)); tgCount();
}
function tgCount() { $("#tgCount").textContent = TX("Zaznaczone:") + " " + $("#tgCat").querySelectorAll("[data-tg]:checked").length; }
function tgValue() { return [...$("#tgCat").querySelectorAll("[data-tg]:checked")].map(b => b.dataset.tg).concat($("#ig_tg_extra").value.split(/[,\s]+/).map(x => x.trim().replace(/^@|.*\//g, "")).filter(Boolean)).join(", "); }
$("#tgDef").addEventListener("click", () => { $("#tgCat").querySelectorAll("[data-tg]").forEach(b => b.checked = !!A(INTG.tg_catalog).find(c => c.ch === b.dataset.tg && c.on)); tgCount(); });
$("#tgAll").addEventListener("click", () => { $("#tgCat").querySelectorAll("[data-tg]").forEach(b => b.checked = true); tgCount(); });
$("#tgNone").addEventListener("click", () => { $("#tgCat").querySelectorAll("[data-tg]").forEach(b => b.checked = false); tgCount(); });
const SRC_EXTRA = () => ({ ai_local: TX("AI lokalne (Ollama / LM Studio)"), ai_cloud: TX("AI w chmurze"), air: TX("Samoloty (adsb.fi / adsb.lol)"), sea_dt: "Digitraffic (AIS)", sea_ais: "aisstream.io",
  copernicus: "Copernicus", opensky: "OpenSky", stadia: "Stadia Maps", notify_tg: TX("Powiadomienia – bot Telegram"), notify_dc: TX("Powiadomienia – Discord") });
let TESTING = new Set();
function renderIntgStatus() {
  const st = (INTG && INTG.status) || {}, T = (INTG && INTG.tests) || {}, N = Object.assign(SRC_EXTRA(), { ua_alerts: TX("Alarmy UA"), deepstate: "DeepStateMap", notam: "NOTAM (FAA)", gfw: "Global Fishing Watch", telegram: "Telegram OSINT",
    adsb: "ADS-B", ais: "AIS (UDP)", aprs: "APRS-IS", aishub: "AISHub", mail: TX("Poczta (IMAP)"), ha: "Home Assistant",
    radiation: TX("Promieniowanie (Safecast)"), acled: "ACLED", tgacct: TX("Telegram – konto"), geoconfirmed: "GeoConfirmed", warspotting: "WarSpotting",
    tzevaadom: TX("Alarmy w Izraelu (Tzeva Adom)"), emsc: "EMSC", isw: TX("Mapy ISW / CTP"), cfradar: "Cloudflare Radar", sx_bluesky: "Bluesky", sx_reddit: "Reddit", sx_gdelt: "GDELT", sx_youtube: "YouTube", sx_vk: "VK", corr: TX("Zdarzenia złożone (AI)"), vgraph: TX("Graf powiązań statków (OpenSanctions)") });
  Object.entries(st).forEach(([k, v]) => { if (k.startsWith("tcp:")) N[k] = "AIS · " + (v.name || k.slice(4)); });
  const testable = new Set(Object.keys((INTG && INTG.test_names) || {}));
  $("#igStatus").innerHTML = Object.entries(N).map(([k, n]) => {
    const s = st[k] || {}, t = T[k], busy = TESTING.has(k);
    // wynik testu jest świeższy niż stan pętli → pokaż go jako główny
    const useT = t && (!s.at || t.at >= s.at || t.off);
    const ok = useT ? t.ok : s.ok, off = useT ? t.off : s.off, cnt = useT ? t.n : s.n, err = useT ? t.err : s.err;
    const lab = busy ? TX("TESTUJĘ…") : off ? TX("wyłączone") : ok ? "OK" + (cnt != null && cnt !== "" ? " · " + cnt : "") : ok === false ? TX("BŁĄD") : "—";
    const tl = t ? `${TX("test")} ${hm(t.at)} · ${t.ms} ms${t.note ? " · " + esc0(t.note) : ""}` : "";
    return `<div class="tts-row" data-src="${esc0(k)}"><span class="nm">${n}</span><span class="st ${busy ? "amb" : ok === false && !off ? "red" : ""}">${lab}</span><span class="bt">${testable.has(k) ? `<button type="button" class="btn" data-test="${esc0(k)}" ${busy ? "disabled" : ""}>${TX("TEST")}</button>` : ""}</span>${tl ? `<span class="tr">${tl}</span>` : ""}</div>${err && !off ? `<p class="hint red">${esc0(err)}</p>` : ""}`; }).join("");
  $("#igStatus").querySelectorAll("[data-test]").forEach(b => b.addEventListener("click", () => srcTest([b.dataset.test])));
  renderTestSum();
}
function srcCounts() {
  const st = (INTG && INTG.status) || {}, T = (INTG && INTG.tests) || {}, c = { ok: 0, err: 0, off: 0 };
  (Object.keys(T).length ? Object.keys(T) : Object.keys(st)).forEach(k => { const s = st[k] || {}, t = T[k], useT = t && (!s.at || t.at >= s.at || t.off);
    const ok = useT ? t.ok : s.ok, off = useT ? t.off : s.off; if (off) c.off++; else if (ok) c.ok++; else if (ok === false) c.err++; });
  return c;
}
function renderTestSum() {
  const c = srcCounts(), T = (INTG && INTG.tests) || {}, last = Math.max(0, ...Object.values(T).map(t => t.at || 0));
  $("#igSum").innerHTML = TESTING.size ? `<span class="amb">${TX("Testuję połączenia…")} (${TESTING.size})</span>`
    : `${TX("STAN:")} ${c.ok} OK · <span class="${c.err ? "red" : ""}">${c.err} ${TX("z błędem")}</span> · ${c.off} ${TX("wyłączonych")}${last ? " · " + TX("ostatni test") + " " + hm(last) : ""}`;
  $("#igTestAll").disabled = TESTING.size > 0;
}
async function srcTest(keys) {
  const all = !keys;
  (keys || Object.keys((INTG && INTG.test_names) || {})).forEach(k => TESTING.add(k));
  renderIntgStatus(); if (all) beep(900, .05);
  try { const r = await api("/api/intg/test", all ? {} : { key: keys[0] }); INTG.status = r.status; INTG.tests = Object.assign(INTG.tests || {}, r.res); }
  catch (e) { $("#igSum").textContent = TX("Test nie powiódł się – serwer nie odpowiada."); }
  TESTING.clear(); renderIntgStatus(); pollStatus();
  const c = srcCounts(); if (all) beep(c.err ? 300 : 1400, .1);
}
$("#igTestAll").addEventListener("click", () => srcTest());
$("#igToStatus").addEventListener("click", () => $("#igStatusH").scrollIntoView({ behavior: "smooth", block: "start" }));
setInterval(async () => { if ($("#intgModal").hidden || TESTING.size) return; try { const r = await api("/api/intg"); INTG.status = r.status; INTG.tests = r.tests; renderIntgStatus(); } catch (e) {} }, 20000);
async function saveIntg() {
  const body = {}; INTG_FIELDS.forEach(k => { const el = $("#ig_" + k); if (!el) return; body[k] = el.type === "checkbox" ? el.checked : el.value; });
  if ($("#tgCat").children.length) body.tg_channels = tgValue();
  $("#igMsg").textContent = TX("Zapisuję…"); try { INTG = await api("/api/intg", body); $("#igMsg").textContent = TX("Zapisano. Źródła odświeżą się w ciągu minuty."); beep(1400, .08); } catch (e) { $("#igMsg").textContent = TX("Nie udało się zapisać."); }
  INTG_FIELDS.forEach(k => { if (INTG_SECRET.has(k)) { const el = $("#ig_" + k); el.value = ""; el.placeholder = INTG[k] ? TX("ustawiony") + " (" + INTG[k] + ")" : ""; } });
  renderIntgStatus(); setTimeout(async () => { try { INTG = await api("/api/intg"); renderIntgStatus(); } catch (e) {} pollIntel(); pollSdr(); }, 6000);
}
$("#intgOpen").addEventListener("click", openIntg);
$("#intgClose").addEventListener("click", () => { $("#intgModal").hidden = true; });
$("#intgModal").addEventListener("click", e => { if (e.target.id === "intgModal") $("#intgModal").hidden = true; });
$("#igSave").addEventListener("click", saveIntg);
$("#igMailTest").addEventListener("click", async () => { await saveIntg(); $("#igMailMsg").textContent = TX("Łączę…"); try { const r = await api("/api/intg/test-mail", {}); $("#igMailMsg").textContent = r.ok ? TX("Połączono – wiadomości w folderze:") + " " + r.n : r.error; } catch (e) { $("#igMailMsg").textContent = TX("błąd"); } });
$("#igHaTest").addEventListener("click", async () => { await saveIntg(); $("#igHaMsg").textContent = TX("Wysyłam…"); try { const r = await api("/api/intg/test-ha", {}); $("#igHaMsg").textContent = r.ok ? TX("Wysłano – sprawdź w Home Assistant (Narzędzia deweloperskie → Zdarzenia albo automatyzację z wyzwalaczem Webhook).") : r.error; } catch (e) { $("#igHaMsg").textContent = TX("błąd"); } });
/* PRIORYTET JEDEN → Home Assistant */
$("#alertBtn").addEventListener("click", () => setTimeout(() => api("/api/notify", { kind: "priority", text: document.body.classList.contains("alert") ? "PRIORYTET JEDEN: ON" : "PRIORYTET JEDEN: OFF" }).catch(() => {}), 50));

/* ------------------------------------------------------------ pytania o historię */
const HIST_Q = /wczoraj|przedwczoraj|zesz[łl]|ostatni(ch|m)?\s+(tydzie|tygodn|miesi|dni|\d)|w ci[ąa]gu|\b\d{1,2}\.\d{1,2}\b|\b20\d\d-\d\d|yesterday|last (week|month|\d+ days)|archiw|histori|dzia[łl]o si/i;
function askHistory() {
  const q = $("#q").value.trim(); if (!q) return; beep(900, .06);
  streamTo("/api/ask/history", { q }, $("#qOut"));
}
$("#qHist").addEventListener("click", askHistory);


/* ------------------------------------------------------------ WYSZUKIWARKA: statki (MMSI, nazwa, IMO, znak), samoloty (ICAO, znak, rejestracja, typ), APRS */
let findT = null, findSel = -1, findList = [];
const FIND_LAYER = { vs: "vessel", ah: "air", la: "myadsb", ap: "aprs" };
async function findRun() {
  const q = $("#findQ").value.trim(), box = $("#findRes");
  if (q.length < 2) { box.hidden = true; findList = []; return; }
  let d = null; try { d = await api("/api/find?q=" + encodeURIComponent(q)); } catch (e) { return; }
  if ($("#findQ").value.trim() !== q) return;
  findList = A(d.res); findSel = findList.length ? 0 : -1;
  const ic = { vs: "⚓", ah: "✈", la: "✈", ap: "◆" };
  box.innerHTML = findList.length ? findList.map((r, i) => `<li><button type="button" data-fi="${i}" class="${i === findSel ? "on" : ""}"><b>${ic[r.t] || "·"} ${esc(r.name)}</b><span>${esc(r.sub || "")}</span></button></li>`).join("")
    : `<li class="empty">${TX("Nic nie znaleziono (szukam w statkach, samolotach wojskowych, Twoim ADS-B i APRS).")}</li>`;
  box.hidden = false;
}
function findGo(i) {
  const r = findList[i]; if (!r) return; $("#findRes").hidden = true; $("#findQ").blur(); sfx("click");
  const lay = FIND_LAYER[r.t]; if (lay && !layerOn[lay]) ensureLayer(lay);
  if (r.t === "vs" && !SHIPS.has(+r.id)) { setView("map"); flyTo(r.lat, r.lon, 1); loadShipDetail(+r.id); }
  const z = AUTOZ; AUTOZ = true; setView("map"); go(r.t + ":" + r.id); AUTOZ = z;
  if (r.t === "vs" && r.lat != null) flyTo(r.lat, r.lon, 1.2);
}
$("#findQ").addEventListener("input", () => { clearTimeout(findT); findT = setTimeout(findRun, 220); });
$("#findQ").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); if (findSel >= 0) findGo(findSel); }
  else if (e.key === "Escape") { $("#findRes").hidden = true; $("#findQ").blur(); }
  else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!findList.length) return; findSel = (findSel + (e.key === "ArrowDown" ? 1 : -1) + findList.length) % findList.length;
    $$("#findRes [data-fi]").forEach(b => b.classList.toggle("on", +b.dataset.fi === findSel)); }
});
$("#findRes").addEventListener("mousedown", e => { const b = e.target.closest("[data-fi]"); if (b) { e.preventDefault(); findGo(+b.dataset.fi); } });
$("#findQ").addEventListener("blur", () => setTimeout(() => { $("#findRes").hidden = true; }, 150));
$("#findQ").addEventListener("focus", () => { if (findList.length) $("#findRes").hidden = false; });
document.addEventListener("keydown", e => { if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $("#findQ").focus(); $("#findQ").select(); } });

/* ------------------------------------------------------------ START */
function boot(done) {
  if (SOLO) return done();
  const needSetup = !(SET && SET.configured);
  let seen = false; try { seen = sessionStorage.getItem("k7-boot") === "1"; } catch (e) { seen = true; }
  if (!needSetup && (seen || reduce)) return done();
  const B = $("#boot"); B.hidden = false; const e = STATUS ? STATUS.engine : null, C = CURRENT || {};
  const lines = [TX("KRONOS-7 PLANETARY INTELLIGENCE · v3.22.2"), TX("TEST PAMIĘCI ........ OK"),
    TX("PROCESOR GRAFICZNY ..") + " " + (e ? TX(e.hardware.gpu_name) + (e.hardware.vram_gb ? " / " + e.hardware.vram_gb + " " + TX("GB") : "") : "?"),
    TX("RDZEŃ ANALITYCZNY ...") + " " + (e && e.model ? e.model.toUpperCase() : TX("NIEAKTYWNY")),
    TX("BAZA KONFLIKTÓW .....") + " " + A(C.conflicts).length + " " + TX("WĘZŁÓW"), TX("FRONTY ..............") + " " + A(C.fronts).length + " " + TX("TEATRÓW"),
    TX("FEEDY ...............") + " " + A((C.feeds || {}).status).filter(s => s.ok).length + "/" + A((C.feeds || {}).status).length + " " + TX("OK"),
    TX("ŁĄCZE ORBITALNE .....") + " " + (A(C.tle).length + A((C.feeds || {}).celestrak).length) + " " + TX("OBIEKTÓW"), ""];
  let i = 0, stop = false; const T2 = $("#bootText"), Lg = $("#bootLogin"); powerUp();
  const finish = () => { if (stop) return; stop = true; B.hidden = true; try { sessionStorage.setItem("k7-boot", "1"); } catch (e) {} done(); };
  const greet = () => { const n = SET && (SET.name || SET.callsign); Lg.innerHTML = `${TX("IDENTYFIKATOR OPERATORA:")} ${esc(opCall())}<br>${TX("DOSTĘP PRZYZNANY · WITAJ")}${n ? ", " + esc(n.toUpperCase()) : TX(", OPERATORZE")}`; setTimeout(finish, 900); };
  if (!needSetup) {
    $("#bootSkip").addEventListener("click", finish);
    document.addEventListener("keydown", function k(ev) { if (ev.key === "Escape") { finish(); document.removeEventListener("keydown", k); } });
  } else $("#bootSkip").hidden = true;
  const login = () => {
    if (needSetup) {
      Lg.textContent = TX("BRAK ZAREJESTROWANEGO OPERATORA."); const f = $("#bootSetup"); f.hidden = false; $("#bootCall").focus();
      $$("#bootLang [data-l]").forEach(b => { b.setAttribute("aria-pressed", b.dataset.l === LANG); b.addEventListener("click", async () => { if (b.dataset.l === LANG) return; store.set("lang", b.dataset.l); await saveSettings({ language: b.dataset.l }); location.reload(); }); });
      f.addEventListener("submit", async ev => { ev.preventDefault(); const r = await saveSettings({ callsign: $("#bootCall").value });
        if (r.ok) { f.hidden = true; beep(1400, .08); greet(); } else { beep(300, .2, "sawtooth"); $("#bootMsg").textContent = r.error || TX("Nie udało się zapisać."); } });
      return;
    }
    const id = opCall(); let j = 0; Lg.innerHTML = (TX("IDENTYFIKATOR OPERATORA:") + " " + "<span id=\"lg\">" + "</span>" + "<span class=\"cursor\">" + "</span>");
    (function type() { if (stop) return; if (j < id.length) { $("#lg").textContent += id[j++]; sfx("key"); setTimeout(type, 110); return; } setTimeout(() => { if (!stop) greet(); }, 300); })();
  };
  (function line() { if (stop) return; if (i < lines.length && !reduce) { chatter(lines[i].length); T2.textContent += lines[i++] + "\n"; sfx("carriage", lines[i - 1].length * .02); setTimeout(line, 120 + lines[i - 1].length * 8); return; } if (reduce) T2.textContent = lines.join("\n"); login(); })();
}

/* odczyt ma wysokość mapy (na szerokim ekranie) */
if (window.ResizeObserver) new ResizeObserver(() => { const h = $("#map").getBoundingClientRect().height; $("#detail").style.maxHeight = !SOLO && innerWidth > 1060 && h > 200 ? Math.round(h) + "px" : ""; }).observe($("#mapbox"));

(async function init() {
  sizeMap(); setMode(mode);
  if (window.ResizeObserver) { let rT = null; new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(() => { if (sizeMap()) { if (mode === "flat") setTheater(theater || "world", false); redraw(); } }, 120); }).observe($("#mapbox")); }
  try { STATUS = await api("/api/status"); } catch (e) {}
  await loadSettings();
  await loadState();
  pollAir(); pollSea(); loadHist(); pollMS(); pollIntel(); pollSdr();
  renderSys(); renderSrc();
  if (mode === "flat") setTheater(theater || "world", false);
  loadMarkets(); setInterval(loadMarkets, 5 * 60 * 1000);
  pollStatus();
  setInterval(() => { if (satrecs.length) drawSats(); satCloud(); if (selected && (selected.startsWith("s:") || selected.startsWith("sc:"))) pick(selected, true); }, 5000);
  applySats();
  setInterval(() => { updNight(); if (nightGeo) { pNight.attr("d", path(nightGeo)); pTwi.attr("d", path(nightGeo)); } }, 60000);
  boot(() => {});
})();
})();
