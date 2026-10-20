/* KRONOS-7 v3.11 — interfejs terminala. Dane: lokalny serwer (/api/*). */
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
const flat = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
const globe = d3.geoOrthographic().scale(232).translate([W / 2, H / 2]).clipAngle(90).precision(.4);
function sizeMap() {
  const r = $("#mapbox").getBoundingClientRect(); if (!r.width || !r.height) return false;
  const nh = Math.round(W * Math.max(.3, Math.min(.85, r.height / r.width)));
  if (nh === H && sizeMap.done) return false; H = nh; sizeMap.done = true;
  svg.attr("viewBox", `0 0 ${W} ${H}`); flat.translate([W / 2, H / 2]); globe.scale(Math.min(W, H) * .47).translate([W / 2, H / 2]);
  if (typeof zoom !== "undefined") zoom.extent([[0, 0], [W, H]]).translateExtent([[0, Math.min(0, H / 2 - W / 4)], [W, Math.max(H, H / 2 + W / 4)]]);
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
  ["haz", TX("NATURA"), 1], ["sat", TX("ORBITY"), 1], ["air", TX("LOTNICTWO"), 1], ["vessel", TX("STATKI"), 1], ["cable", TX("KABLE"), 0], ["flank", TX("FLANKA"), 1], ["nuke", TX("ATOM"), 1], ["asp", TX("PRZESTRZEŃ"), 0], ["gps", TX("GNSS"), 0],
  ["fire", TX("POŻARY"), 0], ["net", TX("SIEĆ"), 0], ["hum", TX("HUMANITARNE"), 0], ["cyber", TX("CYBER"), 0], ["news", TX("DEPESZE"), 0], ["night", TX("NOC"), 1]];
const DRAW_ORDER = ["cable", "night", "gps", "fire", "asp", "vessel", "ship", "sat", "haz", "front", "move", "strike", "force", "net", "hum", "nuke", "flank", "air", "airlive", "cyber", "news", "conf"];
const G = {}; DRAW_ORDER.forEach(k => G[k] = root.append("g").attr("data-l", k));
const pNight = G.night.append("path").attr("class", "night"), pTwi = G.night.append("path").attr("class", "twi");
let layerOn = Object.assign(Object.fromEntries(LAYERS.map(l => [l[0], !!l[2]])), store.get("layers3", {}));
$("#layers").innerHTML = LAYERS.map(([k, n]) => `<button class="btn" data-layer="${k}" aria-pressed="${!!layerOn[k]}">${n}</button>`).join("");
function applyLayers() { LAYERS.forEach(([k]) => G[k].style("display", layerOn[k] ? null : "none"));
  G.air.style("display", layerOn.air && !AIR.ok ? null : "none"); if (layerOn.cable) loadCables(); markStatic(); }
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
const zoom = d3.zoom().scaleExtent([1, 320]).translateExtent([[0, Math.min(0, H / 2 - W / 4)], [W, Math.max(H, H / 2 + W / 4)]]).extent([[0, 0], [W, H]])
  .filter(ev => mode === "flat" && (ev.type === "wheel" || ev.type === "dblclick" || ev.type === "mousedown" ? !ev.button : (ev.touches ? ev.touches.length > 1 : true)))
  .on("zoom", ev => { T = ev.transform; root.attr("transform", T); placeMarkers(); zoomClasses();
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
  $("#map").classList.toggle("globe", m === "globe"); $("#projBtn").setAttribute("aria-pressed", m === "globe");
  if (m === "globe") { T = d3.zoomIdentity; svg.call(zoom.transform, d3.zoomIdentity); }
  redraw();
}
$("#projBtn").addEventListener("click", () => { beep(600); setMode(mode === "globe" ? "flat" : "globe"); });
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
function sizeCanvas() { const r = $("#map").getBoundingClientRect(); DPR = Math.min(2, devicePixelRatio || 1); cvW = r.width; cvH = r.height;
  CV.width = SCV.width = Math.max(1, Math.round(cvW * DPR)); CV.height = SCV.height = Math.max(1, Math.round(cvH * DPR)); markStatic(); }
if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe($("#map"));
function viewFit() { vS = Math.min(cvW / W, cvH / H); vX = (cvW - W * vS) / 2; vY = (cvH - H * vS) / 2; }
/* współrzędne geograficzne -> piksele (płaska mapa liczona wprost, globus przez projekcję) */
function scr(lon, lat) {
  if (mode === "globe") { if (!visible(lon, lat)) return null; const p = proj([lon, lat]); return p ? [vX + p[0] * vS, vY + p[1] * vS] : null; }
  const x = W / 2 + lon * W / 360, y = H / 2 - lat * W / 360; return [vX + (T.x + x * T.k) * vS, vY + (T.y + y * T.k) * vS];
}
const inView = (x, y, m) => x > -m && y > -m && x < cvW + m && y < cvH + m;
function tri(c, x, y, ang, s) { const co = Math.cos(ang), si = Math.sin(ang); c.moveTo(x + co * s * 1.6, y + si * s * 1.6); c.lineTo(x - co * s + si * s * .9, y - si * s - co * s * .9); c.lineTo(x - co * s - si * s * .9, y - si * s + co * s * .9); c.closePath(); }
const RGB = {}; function rgb32(css, alpha) { const key = css + alpha; if (RGB[key] != null) return RGB[key];
  const c = document.createElement("canvas").getContext("2d"); c.fillStyle = cssv(css); c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data;
  return RGB[key] = ((Math.round(alpha * 255) << 24) | (d[2] << 16) | (d[1] << 8) | d[0]) >>> 0; }
const FONT = () => "10px " + (getComputedStyle(document.body).getPropertyValue("--f-display") || "monospace");
function drawStatic() {
  staticDirty = false; viewFit();
  const k = mode === "globe" ? 1 : T.k, nowMs = Date.now(), w2 = SCV.width, h2 = SCV.height;
  SX.setTransform(1, 0, 0, 1, 0, 0); SX.clearRect(0, 0, w2, h2);
  /* przy dużej liczbie punktów piksele zapisujemy wprost do bufora – to kilkanaście razy szybsze niż ścieżki */
  if (!drawStatic.img || drawStatic.img.width !== w2 || drawStatic.img.height !== h2) { drawStatic.img = SX.createImageData(w2, h2); drawStatic.buf = new Uint32Array(drawStatic.img.data.buffer); }
  const img = drawStatic.img, buf = drawStatic.buf; buf.fill(0);
  const cap = SHIPS.size + Object.values(SATG).reduce((a, g) => a + (g.names ? g.names.length : 0), 0);
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
  const names = [], tris = [], rings = [];
  const SRC = REPLAY.on ? REPLAY.ships : SHIPS;
  if (layerOn.vessel && SRC.size) {
    const nowS = (REPLAY.on ? REPLAY.t : nowMs + SEA.skew) / 1000, recalc = REPLAY.on || nowMs - drCache > 4000, useTri = k >= 4, s0 = Math.max(1.4, Math.min(4.5, 1.2 + Math.log2(k) * .7));
    if (recalc) drCache = nowMs;
    const cols = SCATS.map(c => [rgb32(SCOL[c], c === "other" || c === "service" ? .8 : 1), rgb32(SCOL[c], .35)]);
    for (const w of SRC.values()) {
      const ci = w[5], cat = SCATS[ci] || "other", fl = w[11] || 0; if (!FLT.ship[cat] && !(fl && FLT.watch)) continue;
      if (FLT.suspect && !fl && cat !== "military" && cat !== "law") continue;
      const age = nowS - w[6], old = age > 3600 ? 1 : 0; if (old && !FLT.shipOld && !fl) continue;
      if (recalc || w[9] == null) { if (w[3] >= .5 && w[4] != null && age < 1800) { const nm = w[3] * age / 3600, a2 = w[4] * Math.PI / 180; w[9] = w[1] + nm * Math.cos(a2) / 60; w[10] = w[2] + nm * Math.sin(a2) / (60 * Math.max(.2, Math.cos(w[1] * Math.PI / 180))); } else { w[9] = w[1]; w[10] = w[2]; } }
      const p = scr(w[10], w[9]); if (!p || !inView(p[0], p[1], 6)) continue;
      if (useTri) tris.push(p[0], p[1], w[3] >= .5 && w[4] != null ? (w[4] - 90) * Math.PI / 180 : NaN, ci, old);
      else dot(p[0], p[1], Math.max(2, Math.round((SHOT.has(cat) ? 2.6 : 1.9) * DPR)), cols[ci][old]);
      H_.x[n] = p[0]; H_.y[n] = p[1]; H_.k[n] = 1; H_.v[n] = w[0]; n++;
      if (fl && FLT.watch) rings.push(p[0], p[1], fl);
      if (FLT.shipNames && w[7] && (k >= 8 || (k >= 3 && SHOT.has(cat)))) names.push(p[0], p[1], w[7]);
    }
  }
  SX.putImageData(img, 0, 0); SX.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (layerOn.cable && CABLES.lines) drawCables(k);   // pod punktami (destination-over)
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
function frame(t) {
  requestAnimationFrame(frame);
  if (document.hidden || view !== "map" || mapHidden()) return;
  if (t - drCache > 4000 && layerOn.vessel && SHIPS.size) staticDirty = true;
  const live = (AIR.ok || REPLAY.on) && layerOn.air;
  const satSel = selected && /^(s|sc):/.test(selected);
  if (needDraw || staticDirty || (live && t - lastDraw > 250) || (satSel && t - lastDraw > 2000)) { needDraw = false; lastDraw = t; drawCanvas(); }
}
requestAnimationFrame(frame);
window.K7DBG = { draw: () => { const a = performance.now(); staticDirty = true; drawCanvas(); return performance.now() - a; }, air: () => { const a = performance.now(); drawCanvas(); return performance.now() - a; } };
function hitAt(x, y, lim = 8) {
  let best = null, bd = lim * lim;
  for (const h of AHIT) { const d = (h[0] - x) ** 2 + (h[1] - y) ** 2; if (d < bd) { bd = d; best = h[2]; } }
  if (best) return best;
  const H_ = SHIT; let bi = -1;
  for (let i = 0; i < H_.n; i++) { const dx = H_.x[i] - x; if (dx > lim || dx < -lim) continue; const d = dx * dx + (H_.y[i] - y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi < 0 ? null : (H_.k[bi] === 1 ? "vs:" : "sc:") + H_.v[bi];
}
const evXY = ev => { const r = CV.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
svg.on("click.canvas", ev => { if (ev.target.closest && ev.target.closest(".mk")) return; const id = hitAt(...evXY(ev)); if (id) { ev.stopPropagation(); if (id.startsWith("sc:")) SATCLICK = satByNorad(+id.slice(3)); go(id); } });
let tipT = 0;
svg.on("mousemove.canvas", ev => { const now = performance.now(); if (now - tipT < 60) return; tipT = now; const [x, y] = evXY(ev), id = hitAt(x, y, 7);
  if (!id) { TIP.hidden = true; svg.style("cursor", null); return; } svg.style("cursor", "pointer"); TIP.hidden = false; TIP.textContent = tipText(id);
  TIP.style.left = Math.min(cvW - 10, x + 12) + "px"; TIP.style.top = (y + 12) + "px"; });
svg.on("mouseleave.canvas", () => { TIP.hidden = true; });
function tipText(id) {
  const t = id.slice(0, 2), key = id.slice(3);
  if (t === "vs") { const r = seaRec(key), fl = r ? r.flags : 0; return r ? `${r.name || "MMSI " + r.mmsi} · ${SCN[r.cat] || ""}${r.sog != null ? " · " + r.sog + " kn" : ""}${fl & 1 ? " · " + TX("SANKCJE") : ""}${fl & 4 ? " · " + TX("MILCZY") : ""}${fl & 2 ? " · " + TX("NAD KABLEM") : ""}` : ""; }
  if (t === "ah") { const a = airList().find(x => x.hex === key); return a ? `${a.flag || ""} ${a.cs || a.hex} · ${a.desc || (a.model || "").split(" (")[0] || a.t || ""}${a.country ? " · " + TX(a.country) : ""}${a.alt != null ? " · " + a.alt + " ft" : ""}${a.loiter ? " · " + TX("KRĄŻY") : ""}` : ""; }
  if (t === "sc") { const r = satByNorad(+key); return r ? r.name : ""; }
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
async function pollSea() {
  clearTimeout(seaT); let next = 20000;
  try {
    const d = await api(`/api/sea?since=${SEA.since || 0}&ev=${SEA.lastEv}`); next = (d.interval || 20) * 1000;
    if (d.full) SHIPS.clear(); if (A(d.cats).length) SCATS = d.cats;
    A(d.rows).forEach(w => { w[11] = w[9] || 0; w[9] = null; SHIPS.set(w[0], w); });
    const lim = d.now / 1000 - (d.keep_s || 21600); for (const [k2, w] of SHIPS) if (w[6] < lim) SHIPS.delete(k2);
    SEA.since = d.now; SEA.skew = d.now - Date.now(); SEA.ok = SHIPS.size > 0; drCache = 0; markStatic();
    SEA.d = Object.assign({}, d, { rows: null, events: (SEA.d ? A(SEA.d.events) : []).concat(A(d.events)).slice(-30) });
    A(d.events).forEach(e => { SEA.lastEv = Math.max(SEA.lastEv, e.at); if (!SEA.first) { airToast(Object.assign({}, e, { hex: null, go: "vs:" + e.mmsi })); contactSound(e.kind === "alarm" ? "squawk" : e.kind); } });
    SEA.first = false; renderSea(); renderFilterCounts();
    if (selected && selected.startsWith("vs:")) pick(selected, true);
  } catch (e) {}
  seaT = setTimeout(pollSea, document.hidden ? 60000 : next);
}
async function loadShipDetail(mmsi) {
  try { const d = await api("/api/sea/ship/" + mmsi); if (d && d.mmsi) { SEA.detail[d.mmsi] = d; if (selected === "vs:" + mmsi) { pick(selected, true); markStatic(); } } } catch (e) {}
}
function renderSea() {
  const d = SEA.d; if (!d) return; const st = d.status || {}, dt = st.digitraffic || {}, ai = st.aisstream || {}, sm = d.summary || {}, now = Date.now() + SEA.skew;
  $("#seaT").innerHTML = SHIPS.size ? `<span class="livedot"></span>${TX("NA ŻYWO ·")} ${SHIPS.size.toLocaleString(LOC)} ${TX("jednostek")}` : "";
  const srcLine = (n, s, extra) => `<li><button tabindex="-1" style="cursor:default"><span class="t">${n}</span><span class="${s.ok ? "" : s.ok === false ? "red" : "dim"}">${s.ok ? (s.n || 0).toLocaleString(LOC) + " " + TX("statków") : s.ok === false ? TX("BŁĄD") : "—"}</span><span class="sub">${esc(s.err || extra || "")}</span></button></li>`;
  let h = `<li class="hd">${TX("Źródła")}</li>` + srcLine(TX("Digitraffic · północny Bałtyk"), dt, TX("bez klucza"))
    + srcLine(d.scope === "world" ? TX("aisstream.io · cały świat") : TX("aisstream.io · obserwowane rejony świata"), ai, d.key ? (ai.rate ? ai.rate + " " + TX("komunikatów/s") : TX("łączenie…")) : TX("wpisz darmowy klucz w oknie OPERATOR"));
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

function shipWatch(r) {
  const W = (SEA.d && SEA.d.summary && SEA.d.summary.watch) || {}, out = [], m = +r.mmsi;
  if (r.sanc) out.push(`<b class="red">${TX("SANKCJE")} OFAC</b> · ${esc(r.sanc.prog || "")}${r.sanc.name ? " · " + esc(r.sanc.name) : ""} · ${TX("dopasowanie:")} ${esc(r.sanc.by === "IMO" ? "IMO" : TX("nazwa"))}`);
  const dk = A(W.dark).find(x => x.mmsi === m); if (dk || (r.flags & 4)) out.push(`<b class="amber">${TX("MILCZY")}</b> · ${TX("statek nadawał regularnie, a od")} ${dk && dk.since ? hm(dk.since) : "?"} ${TX("nie wysłał pozycji AIS (możliwe wyłączenie transpondera)")}`);
  const cb = r.cable || A(W.cable).find(x => x.mmsi === m); if (cb) out.push(`<b class="violet">${TX("NAD KABLEM")}</b> · ${esc(cb.cable)} · ${cb.d} km · ${TX("od")} ${hm((cb.since > 1e12 ? cb.since : cb.since * 1000))}`);
  A(W.sts).filter(x => x.a.mmsi === m || x.b.mmsi === m).forEach(x => { const o = x.a.mmsi === m ? x.b : x.a; out.push(`<b class="red">STS</b> · ${TX("burta w burtę z")} <button class="linkbtn" data-go="vs:${o.mmsi}">${esc(o.name)}</button> · ${x.d} m · ${TX("od")} ${hm(x.since)}`); });
  return out.length ? `<div class="watchbox">${out.map(x => `<p>${x}</p>`).join("")}</div>` : "";
}
/* --- filtry warstw */
function renderFilterCounts() {
  if ($("#filtModal").hidden) return; const sc = {}, ac = {};
  for (const w of SHIPS.values()) { const c = SCATS[w[5]] || "other"; sc[c] = (sc[c] || 0) + 1; }
  A(AIR.d && AIR.d.ac).forEach(a => ac[a.cat] = (ac[a.cat] || 0) + 1);
  $$("#filtModal [data-fs]").forEach(i => { const em = i.parentNode.querySelector("em"); if (em) em.textContent = (sc[i.dataset.fs] || 0).toLocaleString(LOC); });
  $$("#filtModal [data-fa]").forEach(i => { const em = i.parentNode.querySelector("em"); if (em) em.textContent = ac[i.dataset.fa] || 0; });
}
function openFilters() {
  const S2 = SCATS.map(c => `<label class="chk"><input type="checkbox" data-fs="${c}"${FLT.ship[c] ? " checked" : ""}><i style="background:${cssv(SCOL[c])}"></i>${esc(SCN[c] || c)}<em></em></label>`).join("");
  const A2 = Object.keys(FLT.air).map(c => `<label class="chk"><input type="checkbox" data-fa="${c}"${FLT.air[c] ? " checked" : ""}><i style="background:${cssv(ACOL[c])}"></i>${esc(ACN[c] || c)}<em></em></label>`).join("");
  $("#filtShips").innerHTML = S2 + `<label class="chk"><input type="checkbox" data-fo="shipOld"${FLT.shipOld ? " checked" : ""}>${TX("Pokaż pozycje starsze niż 1 h (wyblakłe)")}</label><label class="chk"><input type="checkbox" data-fo="shipNames"${FLT.shipNames ? " checked" : ""}>${TX("Nazwy statków po przybliżeniu")}</label>`
    + `<label class="chk"><input type="checkbox" data-fo="watch"${FLT.watch ? " checked" : ""}>${TX("Wyróżniaj: sankcje (czerwony), milczące AIS (bursztyn), nad kablem (fiolet), STS")}</label><label class="chk"><input type="checkbox" data-fo="suspect"${FLT.suspect ? " checked" : ""}>${TX("Tylko podejrzane statki (oraz okręty i straż)")}</label>`;
  $("#filtAir").innerHTML = A2 + `<label class="chk"><input type="checkbox" data-fo="airTrails"${FLT.airTrails ? " checked" : ""}>${TX("Trasy rozpoznania, tankowców i bombowców")}</label><label class="chk"><input type="checkbox" data-fo="airNames"${FLT.airNames ? " checked" : ""}>${TX("Znaki wywoławcze")}</label>`;
  $$("#filtModal input").forEach(i => i.addEventListener("change", () => {
    if (i.dataset.fs) FLT.ship[i.dataset.fs] = i.checked ? 1 : 0; else if (i.dataset.fa) FLT.air[i.dataset.fa] = i.checked ? 1 : 0; else FLT[i.dataset.fo] = i.checked ? 1 : 0;
    saveFlt(); markStatic(); }));
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
  const parts = id.split(":"), t = parts[0], key = parts[1];
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
        [TX("MMSI"), r.mmsi], [TX("IMO"), r.imo], [TX("ZNAK WYWOŁAWCZY"), r.cs], [TX("ŹRÓDŁO"), r.src], [TX("PODGLĄD"), L(r.u, TX("MarineTraffic")), 1]]) + shipWatch(r) +
        `<p class="hint">${TX("Dane AIS nadaje sam statek, więc nazwa, typ i cel podróży mogą być nieaktualne lub fałszywe. Okręty zwykle wyłączają AIS. Linia przerywana to trasa z ostatnich godzin.")}</p>`; }
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
  $("#detail").innerHTML = h; bindDetail();
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
  $("#sysState").textContent = e.ready ? TX("AI GOTOWE") : e.backend ? TX("BRAK MODELU") : TX("BRAK AI");
  $("#sys").innerHTML = `<dl>
    <dt>${TX("GPU")}</dt><dd>${esc(hw.gpu_name)}${hw.vram_gb ? ` · ${hw.vram_gb} ${TX("GB VRAM")}` : ""}</dd>
    <dt>${TX("RAM")}</dt><dd>${hw.ram_gb} ${TX("GB ·")} ${hw.cores} ${TX("wątków")}</dd>
    <dt>${TX("SILNIK")}</dt><dd>${e.backend ? esc(e.backend === "ollama" ? TX("Ollama") : e.backend === "lmstudio" ? TX("LM Studio") : e.backend) : ("<span class=\"red\">" + TX("nie wykryto: zainstaluj Ollamę (ollama.com) i uruchom ponownie") + "</span>")}</dd>
    <dt>${TX("MODEL")}</dt><dd>${e.model ? esc(e.model) : '<span class="red">brak</span>'}</dd>
    <dt>${TX("ZALECANY")}</dt><dd>${esc(e.recommended)}${e.recommended_size_gb ? ` (${e.recommended_size_gb} ${TX("GB)")}` : ""}<br><span class="dim">${esc(e.reason)}</span></dd>
    <dt>${TX("NASTĘPNY")}</dt><dd>${STATUS.next ? new Date(STATUS.next).toLocaleString(LOC, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</dd></dl>
    ${e.suggest_pull ? `<div class="dbtns"><button class="btn" id="pullBtn" ${pull.active ? "disabled" : ""}>${pull.active ? `${TX("POBIERANIE")} ${pull.pct}%` : `${TX("POBIERZ")} ${esc(e.recommended)}`}</button></div>` : ""}
    ${pull.status && pull.status !== "gotowe" ? `<span class="dim">${esc(pull.status)}</span>` : ""}
    <details><summary>${TX("DZIENNIK")}</summary><pre>${esc(A(STATUS.log).slice(-50).join("\n"))}</pre></details>`;
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
$("#setForm").addEventListener("submit", async e => {
  e.preventDefault(); applySound();
  const newLang = $("#setLang").value;
  const r = await saveSettings({ ...notifyBody(), qth: $("#setQth").value, ais_scope: $("#setScope").value, language: newLang, aisstream_key: $("#setAis").value.trim(), callsign: $("#setCall").value, name: $("#setName").value, model: $("#setModel").value, auto_pull: $("#setPull").checked,
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
    case "event": {   // pokaż najnowszy kontakt: air, sea albo dowolny
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
function ttsVoiceId() { const c = ttsCfg(); return c[LANG === "en" ? "voice_en" : "voice_pl"]; }
function ttsEngine() {
  const c = ttsCfg(), v = ttsVoiceId(), ok = TTSC && TTSC.engine && A(TTSC.voices).some(x => x.id === v && x.installed);
  return c.engine === "browser" || !ok ? "browser" : "piper";
}
function splitText(t) {   // kawałki ~300 znaków po zdaniach – pierwszy dźwięk po ułamku sekundy, kolejne liczą się w tle
  const sent = String(t || "").replace(/\s+/g, " ").match(/[^.!?…;:]+[.!?…;:]*\s*/g) || [], out = []; let cur = "";
  for (const x of sent) { if ((cur + x).length > 300 && cur) { out.push(cur.trim()); cur = ""; } cur += x; }
  if (cur.trim()) out.push(cur.trim()); return out;
}
async function ttsChunk(text, voice) {
  try { const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
    if (!r.ok) return null; return await audioCtx().decodeAudioData(await r.arrayBuffer()); } catch (e) { return null; }
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
  if (ttsEngine() !== "piper") return browserSpeak(text, my);
  const v = ttsVoiceId(), parts = splitText(text); let next = ttsChunk(parts[0], v);
  for (let i = 0; i < parts.length; i++) {
    const buf = await next; if (my !== SPK.gen) return;
    next = i + 1 < parts.length ? ttsChunk(parts[i + 1], v) : null;
    if (!buf) { browserSpeak(parts.slice(i).join(" "), my); return; }     // Piper nie odpowiedział – dokończ głosem przeglądarki
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
  const row = v => { const cur = c[v.lang === "en" ? "voice_en" : "voice_pl"] === v.id;
    return `<div class="tts-row${cur ? " cur" : ""}"><span class="nm">${v.lang === "pl" ? "PL" : "EN"} · ${esc0(v.label)}</span><span class="st">${v.installed ? (cur ? TX("WYBRANY") : TX("pobrany")) : v.mb + " MB"}</span><span class="bt">`
      + (v.installed ? `${cur ? "" : `<button class="btn" type="button" data-tuse="${v.id}" data-tlang="${v.lang}">${TX("UŻYJ")}</button>`}<button class="btn" type="button" data-ttry="${v.id}" title="${TX("Odsłuchaj")}">▶</button><button class="btn" type="button" data-trm="${v.id}" title="${TX("Usuń głos")}">✕</button>`
        : `<button class="btn" type="button" data-tget="${v.id}" data-tlang="${v.lang}"${j.active ? " disabled" : ""}>${TX("POBIERZ")}</button>`) + `</span></div>`; };
  const mine = A(TTSC.voices).filter(v => v.lang === (LANG === "en" ? "en" : "pl")), other = A(TTSC.voices).filter(v => v.lang !== (LANG === "en" ? "en" : "pl"));
  $("#ttsVoices").innerHTML = mine.concat(other).map(row).join("");
  $("#ttsProg").textContent = j.active ? `${TX("Pobieranie:")} ${j.what} · ${j.pct}%` : j.err ? TX("Błąd pobierania:") + " " + j.err : ttsEngine() === "piper" ? TX("Teraz czyta: Piper –") + " " + ((A(TTSC.voices).find(v => v.id === ttsVoiceId()) || {}).label || "") : TX("Teraz czyta: głos przeglądarki –") + " " + ((browserVoice() || {}).name || TX("brak głosu dla tego języka"));
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
  if (u) await ttsSave({ ["voice_" + u.dataset.tlang]: u.dataset.tuse });
  if (r) { try { TTSC = await api("/api/tts/remove", { voice: r.dataset.trm }); } catch (err) {} renderTTS(); }
  if (t) { stopSpeak(); const buf = await ttsChunk(/^pl/.test(t.dataset.ttry) ? "KRONOS-7 gotowy. Poziom napięcia trzy." : "KRONOS-7 online. Tension level three.", t.dataset.ttry); if (buf) { const my = ++SPK.gen; SPK.on = true; await playSpeech(buf, my); endSpeak(my); } }
});
async function openSnd() {
  $("#settings").hidden = true; await Promise.all([loadSounds(), loadTTS()]); renderSndSlots(); renderTTS(); $("#sndModal").hidden = false; $("#sndClose").focus();
}
$("#sndOpen").addEventListener("click", openSnd);
$("#sndClose").addEventListener("click", () => { $("#sndModal").hidden = true; if (demoH) demoH.stop(); });
$("#sndModal").addEventListener("click", e => { if (e.target.id === "sndModal") $("#sndModal").hidden = true; });
if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", () => { if (!$("#sndModal").hidden) renderTTS(); });
loadSounds().then(() => { if (humH) { hum(false); hum(true); } }); loadTTS();

/* ------------------------------------------------------------ START */
function boot(done) {
  if (SOLO) return done();
  const needSetup = !(SET && SET.configured);
  let seen = false; try { seen = sessionStorage.getItem("k7-boot") === "1"; } catch (e) { seen = true; }
  if (!needSetup && (seen || reduce)) return done();
  const B = $("#boot"); B.hidden = false; const e = STATUS ? STATUS.engine : null, C = CURRENT || {};
  const lines = [TX("KRONOS-7 PLANETARY INTELLIGENCE · v3.11"), TX("TEST PAMIĘCI ........ OK"),
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
  pollAir(); pollSea(); loadHist();
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
