/* KRONOS-7 v3.4 — interfejs terminala. Dane: lokalny serwer (/api/*). */
(function () {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const A = a => Array.isArray(a) ? a : [];
const store = {
  get(k, d) { try { const v = localStorage.getItem("k7-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("k7-" + k, JSON.stringify(v)); } catch (e) {} }
};
const api = (p, body) => fetch(p, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then(r => r.json());

const SEC = { all: "WSZYSTKO", conflict: "KONFLIKTY", geo: "GEOPOLITYKA", human: "HUMANITARNE", nature: "NATURA", space: "KOSMOS", ai: "AI", cyber: "CYBER", watch: "OBSERWOWANE" };
const LVL = { crit: "KRYTYCZNY", high: "WYSOKI", med: "ŚREDNI", low: "NISKI" };
const TREND = { new: ["NOWY", "var(--red)"], esc: ["ESKALACJA", "var(--red)"], ongoing: ["TRWAJĄCY", "var(--amber)"], truce: ["KRUCHY ROZEJM", "var(--violet)"], watch: ["OBSERWACJA", "var(--phos-dim)"] };
const TORDER = { new: 0, esc: 1, ongoing: 2, truce: 3, watch: 4 };
const SHIP = { closed: ["ZAMKNIĘTA", "var(--red)"], restricted: ["OGRANICZONA", "var(--amber)"], disrupted: ["ZAKŁÓCONA", "var(--amber)"], open: ["OTWARTA", "var(--phos)"] };
const CAT = { elect: "WYBORY", summit: "SZCZYT", bank: "BANK CENTR.", energy: "ENERGIA", deadline: "TERMIN", space: "KOSMOS", war: "WOJNA" };
const FKIND = { cvn: ["CV", "LOTNISKOWIEC"], amphib: ["AM", "GRUPA DESANTOWA"], naval: ["N", "SIŁY MORSKIE"], air: ["A", "LOTNICTWO"], ground: ["G", "SIŁY LĄDOWE"], exercise: ["EX", "ĆWICZENIA"] };
const KND = { airspace: "PRZESTRZEŃ", sabotage: "SABOTAŻ", cable: "KABEL", jamming: "ZAGŁUSZANIE", military: "WOJSKO", shadowfleet: "FLOTA CIENI" };
const ACN = { isr: "ROZPOZNANIE", tanker: "TANKOWIEC", bomber: "BOMBOWIEC", transport: "TRANSPORT", fighter: "MYŚLIWIEC", other: "INNY" };
const NKS = { crit: ["KRYTYCZNY", "var(--red)"], warn: ["OSTRZEŻENIE", "var(--amber)"], ok: ["OK", "var(--phos)"], unknown: ["NIEZNANY", "var(--phos-dim)"] };
const ASL = { closed: ["ZAMKNIĘTA", "var(--red)"], avoid: ["OMIJAĆ", "var(--amber)"], caution: ["OSTROŻNIE", "var(--violet)"] };
const REL = { A: "całkowicie wiarygodne", B: "zwykle wiarygodne", C: "dość wiarygodne", D: "zwykle niewiarygodne", E: "niewiarygodne", F: "nie można ocenić" };
const INFO = { 1: "potwierdzona przez inne źródła", 2: "prawdopodobnie prawdziwa", 3: "możliwie prawdziwa", 4: "wątpliwa", 5: "nieprawdopodobna", 6: "nie można ocenić" };
const MON = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const COL = c => "var(--" + (c || "phos") + ")";
const THEATERS = [["world", "ŚWIAT", null], ["ua", "UKRAINA", [[29.5, 45.6], [40.8, 52.6]]], ["bs", "M. CZARNE", [[27, 40.6], [42, 47.6]]],
  ["ef", "FLANKA NATO", [[13, 50], [32, 60.5]]], ["me", "BLISKI WSCHÓD", [[30, 11], [64, 40]]], ["hz", "ORMUZ", [[50.5, 23], [60, 28.8]]],
  ["ye", "JEMEN · M. CZERWONE", [[36.5, 11], [50, 20]]], ["lev", "LEWANT", [[33.9, 30.95], [36.4, 33.8]]], ["sd", "SUDAN", [[21, 7.5], [39, 20]]],
  ["cd", "KONGO", [[26.8, -4.6], [30.8, 0.6]]], ["mm", "MJANMA", [[91.5, 16.5], [98.5, 25.5]]], ["tw", "TAJWAN", [[115, 19.5], [126, 27.5]]], ["wp", "ZACH. PACYFIK", [[110, 5], [160, 42]]]];
const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
function fmtDate(d) { const p = String(d).split("-"); if (p.length === 3) return (+p[2].slice(0, 2)) + " " + MON[+p[1] - 1] + " " + p[0]; if (p.length === 2) return MON[+p[1] - 1] + " " + p[0]; return d; }
const fd = d => d ? fmtDate(String(d).slice(0, 10)) : "";
function dayDiff(d) { const p = String(d).split("-"); if (p.length < 3) return null; const t = Date.UTC(+p[0], +p[1] - 1, +p[2].slice(0, 2)); const n = new Date(); return Math.round((t - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); }
function countdown(d) { const n = dayDiff(d); if (n == null) return "termin w miesiącu"; if (n === 0) return "DZIŚ"; if (n === 1) return "jutro"; if (n < 0) return Math.abs(n) + " dni temu"; return "za " + n + " dni"; }
const pct = p => Math.round(p * 100) + "%";
const chip = (txt, col) => `<span class="chip" style="color:${col}">${esc(txt)}</span>`;
function spark(h, hgt) { h = A(h); if (h.length < 2) return ""; const mx = Math.max(...h), mn = Math.min(...h), r = (mx - mn) || 1, hh = hgt || 24;
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * 98 + 1},${hh - 2 - ((v - mn) / r) * (hh - 6)}`).join(" "); const up = h[h.length - 1] >= h[0];
  return `<svg viewBox="0 0 100 ${hh}" preserveAspectRatio="none" aria-hidden="true" style="width:100%;height:${hh}px;display:block"><polyline points="${pts}" style="fill:none;stroke:${up ? "var(--phos)" : "var(--red)"}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`; }
function srcLinks(arr) { return A(arr).filter(s => Array.isArray(s) && s[1]).map(s => `<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a>`).join(" · "); }
const L = (u, n) => u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n || "źródło")}</a>` : "";
function dd(rows) { return `<dl class="dl">${rows.filter(r => r && r[1] != null && r[1] !== "").map(r => `<dt>${r[0]}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd>`).join("")}</dl>`; }

const AIR = { ok: false, d: null, mk: {}, skew: 0, lastEv: 0, first: true, at: 0 };
let S = {}, CURRENT = null, ARCH = false, STATUS = null, MK = null, selected = null;
const F = () => S.feeds || {};

/* ------------------------------------------------------------ dźwięk, alarm, kompakt, zegary */
/* Syntezator dźwięków terminala (Web Audio, wszystko generowane na żywo, bez plików):
   beep – krótki sygnał, chatter – terkot drukowania tekstu, burble – „liczenie” rdzenia,
   hum – szum tła statku, klaxon – alarm, power – rozruch, done – koniec analizy. */
let actx = null, master = null, audioOn = store.get("audio", false), klaxon = null;
const SND = Object.assign({ vol: .7, hum: true, chatter: true }, store.get("sound", {}));
function ac() {
  if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = SND.vol;
    const comp = actx.createDynamicsCompressor(); master.connect(comp); comp.connect(actx.destination); }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function tone(f, d, type = "square", vol = .04, at = 0, slideTo = 0, lp = 0) {
  if (!audioOn) return;
  try { const c = ac(), t = c.currentTime + at, o = c.createOscillator(), g = c.createGain(); let out = o;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + d);
    if (lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); out = fl; }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    out.connect(g); g.connect(master); o.start(t); o.stop(t + d + .03); } catch (e) {}
}
let noiseBuf = null;
function noise(d, vol = .03, at = 0, hp = 2000) {
  if (!audioOn) return;
  try { const c = ac(), t = c.currentTime + at;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f); f.connect(g); g.connect(master);
    n.start(t, Math.random() * .5); n.stop(t + d + .02); } catch (e) {}
}
function beep(f = 880, d = .05, type = "square", vol = .04) { tone(f, d, type, vol, 0, 0, 5000); }
/* terkot drukarki terminala: szybkie, nieregularne kliknięcia wysokich tonów */
let chatterUntil = 0;
function chatter(chars = 20) {
  if (!audioOn || !SND.chatter) return;
  const c = ac(), now = c.currentTime; if (now < chatterUntil - .05) return;
  const n = Math.min(24, Math.max(3, Math.round(chars / 3)));
  for (let i = 0; i < n; i++) { const at = i * (.022 + Math.random() * .018);
    if (Math.random() < .55) tone(1800 + Math.random() * 2600, .012, "square", .018, at, 0, 7000); else noise(.008, .03, at, 3500); }
  chatterUntil = now + n * .03;
}
/* „liczenie” rdzenia: przypadkowe tony z siatki, jak bulgotanie komputera pokładowego */
let burbleT = null;
const BURBLE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093];
function burble(on) {
  clearInterval(burbleT); burbleT = null; if (!on || !audioOn) return;
  burbleT = setInterval(() => { const f = BURBLE[Math.floor(Math.random() * BURBLE.length)]; tone(f, .055, Math.random() < .7 ? "square" : "triangle", .022, 0, 0, 4000);
    if (Math.random() < .25) tone(f * 1.5, .04, "square", .014, .05, 0, 4000); }, 85);
}
/* szum tła: niskie buczenie i przefiltrowany szum wentylacji */
let humNodes = null;
function hum(on) {
  if (humNodes) { const { g, nodes } = humNodes; try { g.gain.setTargetAtTime(0, actx.currentTime, .4); setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 1500); } catch (e) {} humNodes = null; }
  if (!on || !audioOn || !SND.hum) return;
  try { const c = ac(), g = c.createGain(), lp = c.createBiquadFilter(), nodes = []; g.gain.value = 0; g.gain.setTargetAtTime(.05, c.currentTime, 1.5);
    lp.type = "lowpass"; lp.frequency.value = 320; lp.connect(g); g.connect(master);
    [[50, .5], [100.4, .25], [150.2, .08]].forEach(([f, v]) => { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(lp); o.start(); nodes.push(o); });
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; ch[i] = last * 3.5; }
    const n = c.createBufferSource(), ng = c.createGain(); n.buffer = buf; n.loop = true; ng.gain.value = .6; n.connect(ng); ng.connect(lp); n.start(); nodes.push(n);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .08; lg.gain.value = 60; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); nodes.push(lfo);
    humNodes = { g, nodes }; } catch (e) {}
}
function powerUp() { tone(60, 1.2, "sawtooth", .05, 0, 900, 1200); [0, .35, .7].forEach((at, i) => { noise(.05, .08, at, 300); tone(90 + i * 30, .08, "square", .03, at, 0, 600); }); tone(1760, .12, "square", .03, 1.25, 0, 5000); }
function doneChime() { [1568, 1175, 1568, 2093].forEach((f, i) => tone(f, .09, "square", .03, i * .1, 0, 5000)); }
function alarmBurst(times = 3) { for (let i = 0; i < times * 2; i++) tone(i % 2 ? 440 : 660, .36, "sawtooth", .035, i * .42, 0, 1800); }
function startKlaxon() { stopKlaxon(); if (!audioOn) return; let hi = true; const go = () => { tone(hi ? 660 : 440, .38, "sawtooth", .035, 0, 0, 1800); hi = !hi; }; go(); klaxon = setInterval(go, 420); }
function stopKlaxon() { if (klaxon) { clearInterval(klaxon); klaxon = null; } }
function setAudio(on) { audioOn = on; store.set("audio", on); $("#audioBtn").setAttribute("aria-pressed", on);
  if (on) { ac(); beep(1200, .08); hum(true); if (document.body.classList.contains("alert")) startKlaxon(); } else { hum(false); burble(false); stopKlaxon(); } }
$("#audioBtn").addEventListener("click", () => setAudio(!audioOn));
$("#audioBtn").setAttribute("aria-pressed", audioOn);
window.K7SND = { state: () => ({ on: audioOn, ctx: actx && actx.state, hum: !!humNodes, burble: !!burbleT, vol: SND.vol }), alarmBurst, doneChime, powerUp, chatter };
/* przeglądarka pozwala grać dopiero po pierwszym kliknięciu – wtedy wznawiamy dźwięk zapamiętany z poprzedniej sesji */
document.addEventListener("pointerdown", function first() { document.removeEventListener("pointerdown", first); if (audioOn) { ac(); hum(true); } }, { once: true });
document.addEventListener("keydown", function firstK() { document.removeEventListener("keydown", firstK); if (audioOn) { ac(); if (!humNodes) hum(true); } }, { once: true });
$("#alertBtn").addEventListener("click", e => { const on = !document.body.classList.contains("alert"); document.body.classList.toggle("alert", on); e.currentTarget.setAttribute("aria-pressed", on); on ? startKlaxon() : stopKlaxon(); });
function setCompact(on) { document.body.classList.toggle("compact", on); $("#compactBtn").setAttribute("aria-pressed", on); store.set("compact", on); }
$("#compactBtn").addEventListener("click", () => { beep(700); setCompact(!document.body.classList.contains("compact")); });
setCompact(store.get("compact", false));
function clocks() { const n = new Date(); $("#utc").textContent = n.toISOString().slice(11, 19); $("#loc").textContent = n.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }); }
clocks(); setInterval(clocks, 1000);

/* ------------------------------------------------------------ MAPA */
const W = 960, H = 480;
const svg = d3.select("#map");
let mode = store.get("proj", "flat"), rot = [-30, -25], dragging = false, T = d3.zoomIdentity;
const flat = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
const globe = d3.geoOrthographic().scale(232).translate([W / 2, H / 2]).clipAngle(90).precision(.4);
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
const LAYERS = [["conf", "KONFLIKTY", 1], ["front", "FRONTY", 1], ["move", "NATARCIA", 1], ["strike", "UDERZENIA", 1], ["force", "SIŁY", 1], ["ship", "ŻEGLUGA", 1],
  ["haz", "NATURA", 1], ["sat", "ORBITY", 1], ["air", "LOTNICTWO", 1], ["flank", "FLANKA", 1], ["nuke", "ATOM", 1], ["asp", "PRZESTRZEŃ", 0], ["gps", "GNSS", 0],
  ["fire", "POŻARY", 0], ["net", "SIEĆ", 0], ["hum", "HUMANITARNE", 0], ["cyber", "CYBER", 0], ["news", "DEPESZE", 0], ["night", "NOC", 1]];
const DRAW_ORDER = ["night", "gps", "fire", "asp", "ship", "sat", "haz", "front", "move", "strike", "force", "net", "hum", "nuke", "flank", "air", "airlive", "cyber", "news", "conf"];
const G = {}; DRAW_ORDER.forEach(k => G[k] = root.append("g").attr("data-l", k));
const pNight = G.night.append("path").attr("class", "night"), pTwi = G.night.append("path").attr("class", "twi");
let layerOn = Object.assign(Object.fromEntries(LAYERS.map(l => [l[0], !!l[2]])), store.get("layers3", {}));
$("#layers").innerHTML = LAYERS.map(([k, n]) => `<button class="btn" data-layer="${k}" aria-pressed="${!!layerOn[k]}">${n}</button>`).join("");
function applyLayers() { LAYERS.forEach(([k]) => G[k].style("display", layerOn[k] ? null : "none"));
  const live = AIR.ok; G.air.style("display", layerOn.air && !live ? null : "none"); G.airlive.style("display", layerOn.air && live ? null : "none"); }
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
function zoomClasses() { placeLive(true); const k = mode === "globe" ? 1 : T.k; svg.classed("z3", k >= 3).classed("z6", k >= 6); $("#zoomlvl").textContent = mode === "globe" ? "3D" : "×" + (k < 10 ? k.toFixed(1) : Math.round(k)); }
function loadHi() {
  if (land50 || loadHi.busy) return; loadHi.busy = true;
  const s = document.createElement("script"); s.src = "vendor/land50.js";
  s.onload = () => { land50 = fixWinding(topojson.feature(window.__LAND50, window.__LAND50.objects.countries)); if (landHi) redraw(); };
  document.body.appendChild(s);
}
const zoom = d3.zoom().scaleExtent([1, 320]).translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]])
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
function zoomBox(box, anim) {
  if (mode === "globe") { if (box) rotateTo((box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2); return; }
  if (!box) { svg.transition().duration(anim && !reduce ? 650 : 0).call(zoom.transform, d3.zoomIdentity); return; }
  const a = flat([box[0][0], box[1][1]]), b = flat([box[1][0], box[0][1]]);
  const k = Math.max(1, Math.min(320, .92 / Math.max((b[0] - a[0]) / W, (b[1] - a[1]) / H)));
  const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(a[0] + b[0]) / 2, -(a[1] + b[1]) / 2);
  svg.transition().duration(anim && !reduce ? 750 : 0).call(zoom.transform, t);
}
function rotateTo(lon, lat) {
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
  if (lat == null || lon == null) return;
  if (mode === "globe") { rotateTo(lon, lat); return; }
  const s = span || 6; zoomBox([[lon - s, lat - s / 2], [lon + s, lat + s / 2]], true);
  theater = ""; $$("[data-th]").forEach(b => b.setAttribute("aria-pressed", "false")); $("#theaterName").textContent = fmtLL(lat, lon);
}
function flyPts(pts) {
  const la = pts.map(p => p[0]), lo = pts.map(p => p[1]);
  if (mode === "globe") return rotateTo(d3.mean(lo), d3.mean(la));
  const pad = Math.max(1.1, (d3.max(lo) - d3.min(lo)) * .6, (d3.max(la) - d3.min(la)) * .6);
  zoomBox([[d3.min(lo) - pad, d3.min(la) - pad / 2], [d3.max(lo) + pad, d3.max(la) + pad / 2]], true);
  theater = ""; $$("[data-th]").forEach(b => b.setAttribute("aria-pressed", "false"));
}
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
  DRAW_ORDER.filter(k => k !== "night" && k !== "airlive").forEach(k => G[k].selectAll("*").remove()); markers = []; dots = []; geoPaths = [];
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
  A(S.nuclear).forEach((n, i) => mk("nuke", n.lat, n.lon, "tag", NC[n.status] || NC.unknown, "nk:" + i, n.name, { txt: "AT", w: 20, lbl: n.name, lblClass: "lbl hlbl", lx: 12 }));
  A(S.eastflank).forEach((e, i) => mk("flank", e.lat, e.lon, "dot", "var(--violet)", "ef:" + i, e.t, { size: 1.4, lbl: e.t, lblClass: "lbl hlbl", lx: 6, cls: isNew("eastflank", e.id) ? "new" : "" }));
  const AC = { isr: "var(--cyan)", tanker: "var(--amber)", bomber: "var(--red)", transport: "var(--violet)", fighter: "var(--phos)", other: "var(--phos-dim)" };
  A(f.adsb && f.adsb.ac).forEach((a, i) => mk("air", a.lat, a.lon, "head", AC[a.cat] || AC.other, "ac:" + i, (a.cs || a.hex) + " " + a.t, { rot: (a.trk || 0) - 90, size: .9 }));
  A(f.gdacs).forEach((g, i) => { if (g.track && g.track.length > 1) gpath("haz", LL(g.track), "gtrack");
    mk("haz", g.lat, g.lon, "ring", g.lvl === "Red" ? "var(--red)" : "#ff9a3a", "gd:" + i, g.kind + " " + g.name, { pulse: g.lvl === "Red" }); });
  A(f.nhc).forEach((n, i) => mk("haz", n.lat, n.lon, "ci", "var(--red)", "nhc:" + i, n.name, { pulse: true, lbl: n.name, lblClass: "lbl shlbl" }));
  A(S.hazards).forEach((h, i) => { const shape = h.kind === "quake" ? "tri" : h.kind === "volcano" ? "dia" : "ci"; mk("haz", h.lat, h.lon, shape, (h.alert === "RED" || /^M7|^M8|^M9/.test(h.mag || "")) ? "var(--red)" : "var(--amber)", "h:" + i, h.name_pl || h.name, { pulse: h.kind === "storm" }); });
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
function initSats() { satrecs = []; A(S.tle).concat(A(F().celestrak)).forEach(t => { try { satrecs.push({ name: t[0], rec: satellite.twoline2satrec(t[1], t[2]) }); } catch (e) {} }); }
function satAt(rec, date) { const pv = satellite.propagate(rec, date); if (!pv || !pv.position) return null;
  const gd = satellite.eciToGeodetic(pv.position, satellite.gstime(date)); return { lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude), alt: gd.height }; }
function drawSats(noRedraw) {
  G.sat.selectAll("*").remove();
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
  $("#sats").innerHTML = rows.join("") || '<tr><td colspan="4">Brak danych orbitalnych</td></tr>';
  $("#satTime").textContent = "SGP4 · " + now.toISOString().slice(11, 16) + " UTC";
  if (!noRedraw) { satPaths.forEach(g => g.node.setAttribute("d", path(g.geo) || "")); placeMarkers(); }
}

/* ------------------------------------------------------------ SAMOLOTY NA ŻYWO (ADS-B) */
/* Serwer pobiera adsb.lol (zapasowo adsb.fi) co ~10 s. Między odczytami pozycja jest
   przewidywana z kursu i prędkości, więc samoloty płyną jak na radarze. */
const ACOL = { isr: "var(--cyan)", tanker: "var(--amber)", bomber: "var(--red)", transport: "var(--violet)", fighter: "var(--phos)", other: "var(--phos-dim)" };
const NOTABLE = new Set(["isr", "bomber", "tanker"]);
function airPos(a, now) {
  const dt = Math.min(90, Math.max(0, (now - a.ts) / 1000));
  if (a.ground || !a.gs || a.trk == null || dt < .5) return [a.lat, a.lon];
  const nm = a.gs * dt / 3600, r = a.trk * Math.PI / 180, lat = a.lat + nm * Math.cos(r) / 60;
  return [lat, a.lon + nm * Math.sin(r) / (60 * Math.max(.2, Math.cos(a.lat * Math.PI / 180)))];
}
const airAge = (a, now) => Math.max(0, Math.round((now - a.ts) / 1000));
function agoTxt(sec) { return sec < 60 ? sec + " s temu" : sec < 3600 ? Math.round(sec / 60) + " min temu" : Math.round(sec / 3600) + " h temu"; }
function drawLive() {
  const seen = new Set();
  A(AIR.d && AIR.d.ac).forEach(a => {
    seen.add(a.hex); let m = AIR.mk[a.hex];
    if (!m) {
      const tr = G.airlive.append("path").attr("class", "actrail" + (NOTABLE.has(a.cat) ? " hot" : "")).style("stroke", ACOL[a.cat] || ACOL.other);
      const g = G.airlive.append("g").attr("class", "mk live").attr("tabindex", 0).attr("role", "button").attr("data-id", "ah:" + a.hex);
      g.append("path").attr("class", "core").attr("d", "M7,0L-3,-5L-1,0L-3,5Z");
      g.append("text").attr("class", "lbl " + (NOTABLE.has(a.cat) ? "hlbl aclbl" : "shlbl aclbl")).attr("x", 8).attr("y", -6);
      g.on("click", ev => { ev.stopPropagation(); go("ah:" + a.hex); }).on("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go("ah:" + a.hex); } });
      m = AIR.mk[a.hex] = { g: g.node(), core: g.node().firstChild, txt: g.node().lastChild, tr: tr.node() };
    }
    m.a = a; m.core.style.fill = ACOL[a.cat] || ACOL.other; m.txt.textContent = a.cs || a.hex;
    m.g.setAttribute("aria-label", `${a.cs || a.hex} ${a.desc || a.t}`); m.g.classList.toggle("sel", selected === "ah:" + a.hex);
  });
  Object.keys(AIR.mk).forEach(h => { if (!seen.has(h)) { AIR.mk[h].g.remove(); AIR.mk[h].tr.remove(); delete AIR.mk[h]; } });
  placeLive(true);
}
function placeLive(trails) {
  if (!AIR.ok) return; const now = Date.now() + AIR.skew, k = mode === "globe" ? 1 : T.k;
  Object.values(AIR.mk).forEach(m => {
    const a = m.a, ll = airPos(a, now), age = airAge(a, now);
    if (trails) { const pts = A(a.trail).map(p => [p[0], p[1]]).concat([ll]); m.tr.setAttribute("d", pts.length > 1 ? (path(LL(pts)) || "") : ""); }
    if (!visible(ll[1], ll[0])) { m.g.style.display = "none"; return; }
    const p = proj([ll[1], ll[0]]); if (!p) { m.g.style.display = "none"; return; }
    m.g.style.display = ""; m.g.style.opacity = age < 60 ? 1 : age < 180 ? .55 : .25;
    m.g.setAttribute("transform", `translate(${p[0].toFixed(2)},${p[1].toFixed(2)})${k !== 1 ? ` scale(${1 / k})` : ""}`);
    m.core.setAttribute("transform", `rotate(${((a.trk || 0) - 90).toFixed(0)})`);
  });
}
let airT = null, airTick = 0;
d3.timer(t => { if (!AIR.ok || document.hidden || t - airTick < 200 || view !== "map") return; airTick = t; placeLive(t % 2000 < 210); });
function contactSound(kind) { if (kind === "squawk") { alarmBurst(1); return; } tone(880, .12, "sine", .05, 0, 1320); tone(1320, .18, "sine", .04, .16, 990); }
function airToast(e) {
  const box = $("#airToast"); if (!box) return; const b = document.createElement("button");
  b.className = "toast" + (e.kind === "squawk" ? " red" : ""); b.innerHTML = `<b>KONTAKT · ${esc(new Date(e.at).toISOString().slice(11, 16))} UTC</b>${esc(e.msg)}`;
  b.addEventListener("click", () => { go("ah:" + e.hex); b.remove(); }); box.appendChild(b); setTimeout(() => b.remove(), 12000);
  while (box.children.length > 4) box.firstChild.remove();
}
async function pollAir() {
  clearTimeout(airT); let next = 10000;
  try {
    const d = await api("/api/air?since=" + AIR.lastEv); next = (d.interval || 10) * 1000;
    if (d.status && d.status.ok && A(d.ac).length) {
      const was = AIR.ok; AIR.ok = true; AIR.skew = d.now - Date.now(); AIR.d = Object.assign({}, d, { events: (AIR.d ? A(AIR.d.events) : []).concat(A(d.events)).slice(-30) });
      A(d.events).forEach(e => { AIR.lastEv = Math.max(AIR.lastEv, e.at); if (!AIR.first) { airToast(e); contactSound(e.kind); } });
      AIR.first = false; if (!was) applyLayers(); drawLive(); renderSky();
      if (selected && selected.startsWith("ah:")) pick(selected, true);
    } else if (d.status && d.status.err) { AIR.err = d.status.err; renderSky(); }
  } catch (e) {}
  airT = setTimeout(pollAir, document.hidden ? 30000 : next);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) pollAir(); });

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
  ${dd([["ŚCIEŻKA", pathIds.map(x => x === id ? `<b>${esc(lab(x))}</b>` : esc(lab(x))).join(" → "), 1],
    ["PRZYCZYNY", ins.length ? ins.map(e => `${esc(e.source.label)} <span class="dim">(${esc(e.label)})</span>`).join("<br>") : "punkt wyjścia łańcucha", 1],
    ["SKUTKI", outs.length ? outs.map(e => `${esc(e.target.label)} <span class="dim">(${esc(e.label)})</span>`).join("<br>") : "brak dalszych skutków w grafie", 1]])}
  <div class="dbtns">${n.ref ? `<button class="btn" data-open="${esc(n.ref)}">OTWÓRZ KARTĘ</button>` : ""}<button class="btn" id="chainReset">POKAŻ CAŁOŚĆ</button></div>
  <p class="hint">Graf zbudowany przez lokalne AI z bieżących depesz${S.chain && S.chain.at ? ", " + new Date(S.chain.at).toLocaleString("pl-PL") : ""}. To hipoteza analityczna, nie fakt.</p>`;
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
  return `<span class="cred" style="color:${col}"><b>${esc(i.rel || "F")}${esc(i.info || 6)}</b><span>źródło: ${REL[i.rel] || "?"}; informacja: ${INFO[i.info] || "?"}${i.claim ? "; <span class='amber'>deklaracja jednej ze stron</span>" : ""}</span></span>`;
}
function itemLL(i) { if (i.lat != null && i.lon != null) return [i.lat, i.lon]; const c = A(S.conflicts).find(c => c.id === i.conflict || c.id === i.loc); return c ? [c.lat, c.lon] : null; }
function openRef(ref) { if (A(S.conflicts).some(c => c.id === ref)) return go("c:" + ref); if (A(S.items).some(i => i.id === ref)) return go("n:" + ref); }
const frontOf = cid => A(S.fronts).filter(f => f.conflict === cid);
function go(id) {
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
    const sc = A(c.scenarios).map(s => `<div><span class="t"><span>${esc(s.name)}</span><b class="amber">${s.prob}%</b></span><span class="bar"><i style="width:${Math.max(0, Math.min(100, s.prob))}%"></i></span><small>${esc(s.desc)}${A(s.signals).length ? "<br>Sygnały: " + s.signals.map(esc).join(" · ") : ""}</small></div>`).join("");
    const tl = A(c.timeline).slice(-10).map(x => `<li><time>${esc(fmtDate(x.d))}</time>${esc(x.e)}</li>`).join("");
    h = `${chip(tr[0], tr[1])}<h2 class="glow">${esc(c.name)}</h2>` + dd([
      ["CO", c.what], ["GDZIE", `${fmtLL(c.lat, c.lon)} · od ${esc(c.since)}`, 1], ["DLACZEGO", c.why], ["OSTATNIO", c.latest],
      c.id === "iran" && S.iranStatus ? ["STATUS ROZEJMU", `${esc(S.iranStatus.summary)} ${srcLinks(S.iranStatus.src)}`, 1] : null,
      ["SCENARIUSZE · 30 DNI", sc ? `<div class="scen">${sc}</div>` : '<span class="dim">Pojawią się po analizie lokalnego AI.</span>', 1],
      tl ? ["OŚ CZASU", `<ul class="tl">${tl}</ul>`, 1] : null,
      fr.length ? ["FRONT", `<ul class="mini">${fr.map(x => `<li><button data-go="f:${x.id}">▸ ${esc(x.name)} · ${A(x.moves).length} ruchów · stan ${esc(x.asOf)}</button></li>`).join("")}</ul>`, 1] : null,
      rel.length ? [`DEPESZE (${rel.length})`, `<ul class="mini">${rel.map(r => `<li><button data-go="n:${r.id}">▸ ${esc(r.h)} <span class="dim">${esc(r.rel)}${esc(r.info)}</span></button></li>`).join("")}</ul>`, 1] : null,
      ["ŹRÓDŁA", srcLinks(c.src) || "—", 1]]) +
      `<div class="dbtns"><button class="btn" data-sit="${esc(c.name)}">SITREP</button>${(S.chain && A(S.chain.nodes).some(n => n.ref === c.id || n.id === c.id)) ? `<button class="btn" data-chain="${c.id}">W ŁAŃCUCHU</button>` : ""}</div>`;
  } else if (t === "n") {
    const i = A(S.items).find(x => x.id === key); if (!i) return; const ll = itemLL(i);
    h = `${chip((SEC[i.s] || i.s) + " · " + LVL[i.p], i.p === "crit" ? "var(--red)" : "var(--amber)")}<h2 class="glow">${esc(i.h)}</h2>` + dd([
      ["CO", i.b], ll ? ["GDZIE", `${esc(i.place || "")} ${fmtLL(ll[0], ll[1])}`, 1] : null, ["DLACZEGO", i.why || "—"], ["KIEDY", i.t],
      ["WIARYGODNOŚĆ", credHTML(i), 1], [`ŹRÓDŁA (${A(i.sources).length || 1})`, srcLinks(i.links || [[i.src, i.u]]), 1]]) +
      `<div class="dbtns">${i.conflict ? `<button class="btn" data-go="c:${i.conflict}">KARTA KONFLIKTU</button>` : ""}${(S.chain && A(S.chain.nodes).some(n => n.ref === i.id)) ? `<button class="btn" data-chain="${i.id}">W ŁAŃCUCHU</button>` : ""}</div>`;
  } else if (t === "f") {
    const x = A(S.fronts).find(y => y.id === key); if (!x) return;
    h = `${chip("FRONT · STAN " + x.asOf, "var(--amber)")}<h2 class="glow">${esc(x.name)}</h2>` + dd([
      ["STRONY", Object.entries(x.sides || {}).map(([k, v]) => `<span class="sw" style="background:${COL(v[1])}"></span>${esc(v[0])}`).join("<br>") + `<br><span class="sw" style="background:var(--white)"></span>sporne`, 1],
      ["SYTUACJA", x.note], [`RUCHY (${A(x.moves).length})`, `<ul class="mini">${A(x.moves).map((m, i) => `<li><button data-go="m:${x.id}:${i}"><span class="sw" style="background:${COL((x.sides[m.side] || [])[1])}"></span>${esc(m.when)} · ${esc(m.label)}${m.ai ? ' <span class="cyan">AI</span>' : ""}</button></li>`).join("")}</ul>`, 1],
      ["ŹRÓDŁA", srcLinks(x.src), 1]]) + `<p class="hint">Linia zrekonstruowana z miejscowości w raportach; to szacunek, nie mapa sztabowa. Lokalne AI dopisuje natarcia i zmiany kontroli, ale nie przesuwa linii.</p>`;
  } else if (t === "m") {
    const x = A(S.fronts).find(y => y.id === key), m = x && A(x.moves)[+parts[2]]; if (!m) return; const sd = x.sides[m.side] || ["?", "phos"];
    h = `${chip("NATARCIE · " + sd[0], COL(sd[1]))}<h2 class="glow">${esc(m.label)}</h2>` + dd([["CO", m.note], ["KIEDY", m.when],
      ["KIERUNEK", `${fmtLL(m.from[0], m.from[1])} → ${fmtLL(m.to[0], m.to[1])}`], ["FRONT", `<ul class="mini"><li><button data-go="f:${x.id}">▸ ${esc(x.name)}</button></li></ul>`, 1],
      ["ŹRÓDŁO", srcLinks([m.src]), 1]]) + (m.ai ? `<p class="hint">Wpis dodany przez lokalne AI na podstawie wiadomości; współrzędne przybliżone.</p>` : "");
  } else if (t === "fh") {
    const x = A(S.fronts).find(y => y.id === key), hd = x && A(x.holds)[+parts[2]]; if (!hd) return; const sd = hd[2] === "x" ? ["sporne", "white"] : (x.sides[hd[2]] || ["?", "phos"]);
    h = `${chip("KONTROLA · " + sd[0], COL(sd[1]))}<h2 class="glow">${esc(hd[0])}</h2>` + dd([["GDZIE", fmtLL(hd[1][0], hd[1][1])], ["FRONT", `<ul class="mini"><li><button data-go="f:${x.id}">▸ ${esc(x.name)} (stan ${esc(x.asOf)})</button></li></ul>`, 1]]);
  } else if (t === "st") {
    const x = A(S.strikes)[+key]; if (!x) return;
    h = `${chip("UDERZENIE · " + (x.side === "ru" ? "ROSJA" : "UKRAINA"), x.side === "ru" ? "var(--red)" : "var(--cyan)")}<h2 class="glow">${esc(x.target)}</h2>` + dd([["CO", x.note], ["KIEDY", x.when || fd(x.d)], ["GDZIE", fmtLL(x.lat, x.lon) + " (przybliżenie)"], ["ŹRÓDŁO", srcLinks([x.src]), 1]]);
  } else if (t === "fo") {
    const x = A(S.forces)[+key]; if (!x) return; const kd = FKIND[x.kind] || ["", ""];
    h = `${chip(kd[1], "var(--violet)")}<h2 class="glow">${esc(x.name)}</h2>` + dd([["GDZIE", `${esc(x.where)} · ${fmtLL(x.lat, x.lon)} (pozycja orientacyjna)`, 1], ["STAN NA", x.when], ["CO", x.note], ["ŹRÓDŁO", srcLinks([x.src]), 1]]);
  } else if (t === "sh" || t === "p") {
    const x = A(S.shipping).find(y => y.id === key); if (!x) return; const st = SHIP[x.status] || SHIP.open, pw = (f.portwatch || {})[x.id];
    h = `${chip("ŻEGLUGA · " + st[0], st[1])}<h2 class="glow">${esc(x.name)}</h2>${pw ? spark(pw.series.map(r => r[1]), 70) : ""}` + dd([["RUCH", x.metric],
      pw ? ["AIS · IMF PORTWATCH", `Średnio ${pw.avg7} statków/dobę w ostatnim tygodniu (do ${esc(pw.last)})${pw.base ? `, rok temu ${pw.base}/dobę` : ""}. Wykres: ostatnie ${pw.series.length} dni. Liczy tylko statki z włączonym AIS; w strefach wojny wiele płynie bez niego, więc to dolna granica.`] : null,
      ["OSTATNIO", x.latest], ["DLACZEGO", x.why], ["ŹRÓDŁA", srcLinks(x.src), 1]]);
  } else if (t === "mk") {
    const m = A(MK && MK.items).find(x => x.id === key); if (!m) return; const up = m.change_pct >= 0;
    h = `${chip("RYNEK · 5 DNI " + (up ? "+" : "") + (m.change_pct || 0).toFixed(2) + "%", up ? "var(--phos)" : "var(--red)")}<h2 class="glow">${esc(m.label)}: ${m.price != null ? m.price.toLocaleString("pl-PL") : "—"} ${esc(m.unit)}</h2>${spark(m.spark, 80)}` +
      dd([["DLACZEGO", S.marketsNote || "Komentarz pojawi się po analizie AI."], ["ŹRÓDŁO", `${esc(m.source || "")} · ${MK.fetched ? new Date(MK.fetched).toLocaleTimeString("pl-PL") : ""}`, 1]]) + `<p class="hint">Notowania pobierane na żywo co 5 minut; mogą być opóźnione o kilkanaście minut.</p>`;
  } else if (t === "cal") {
    const e = A(S.calendar)[+key]; if (!e) return;
    h = `${chip(CAT[e.cat] || e.cat || "WYDARZENIE", "var(--amber)")}<h2 class="glow">${esc(e.t)}</h2>` + dd([["KIEDY", `${fmtDate(e.d)} · ${countdown(e.d)}`], ["DLACZEGO WAŻNE", e.note], ["ŹRÓDŁO", srcLinks([e.src]), 1],
      e.ref ? ["DEPESZA", `<ul class="mini"><li><button data-go="n:${esc(e.ref)}">▸ otwórz</button></li></ul>`, 1] : null]);
  } else if (t === "h") {
    const x = A(S.hazards)[+key]; if (!x) return; const kind = { quake: "TRZĘSIENIE ZIEMI", volcano: "WULKAN", storm: "CYKLON TROPIKALNY", flood: "POWÓDŹ", fire: "POŻAR" }[x.kind] || x.kind;
    h = `${chip(kind, "var(--amber)")}<h2 class="glow">${esc(x.name_pl || x.name)}</h2>` + dd([["CO", x.note], ["GDZIE", fmtLL(x.lat, x.lon)], ["SIŁA / KIEDY", `${x.mag} · ${x.when}`], ["ŹRÓDŁO", srcLinks([x.src]), 1]]);
  } else if (t === "s") {
    const s = satrecs[+key]; if (!s) return; const p = s.last || {};
    h = `${chip("OBIEKT ORBITALNY", "var(--cyan)")}<h2 class="glow">${esc(s.name)}</h2>` + dd([["POZYCJA", p.lat != null ? fmtLL(p.lat, p.lon) : "–"], ["WYSOKOŚĆ", p.alt ? Math.round(p.alt) + " km" : "–"],
      ["TOR", "Linia przerywana: najbliższe ok. 95 minut lotu."], ["DANE", "TLE (AMSAT, CelesTrak), propagacja SGP4 na żywo."]]);
  } else if (t === "ah") { const a = A(AIR.d && AIR.d.ac).find(x => x.hex === key);
    if (!a) h = chip("ADS-B NA ŻYWO", "var(--cyan)") + `<h2 class="glow">${esc(key)}</h2><p class="hint">Samolot przestał nadawać albo zniknął z zasięgu odbiorników.</p>`;
    else { const now = Date.now() + AIR.skew, p = airPos(a, now), age = airAge(a, now);
      h = chip("NA ŻYWO · " + (ACN[a.cat] || a.cat), ACOL[a.cat] || "var(--cyan)") + `<h2 class="glow">${esc(a.cs || a.hex)} · ${esc(a.t || "?")}</h2>` + dd([
        ["TYP", a.desc || a.t], ["REJESTRACJA", a.reg], ["POZYCJA", fmtLL(p[0], p[1])], ["WYSOKOŚĆ", a.ground ? "na ziemi" : a.alt != null ? `${a.alt} ft (${Math.round(a.alt * .3048)} m)` : null],
        ["PRĘDKOŚĆ", a.gs ? `${Math.round(a.gs)} kt (${Math.round(a.gs * 1.852)} km/h)` : null], ["KURS", a.trk != null ? Math.round(a.trk) + "°" : null],
        ["WZNOSZENIE", a.vr ? (a.vr > 0 ? "+" : "") + a.vr + " ft/min" : null], ["SQUAWK", a.sq], ["OSTATNI ODCZYT", agoTxt(age) + (a.mlat ? " · pozycja z MLAT" : "")],
        ["ŹRÓDŁO", L(a.u, (AIR.d.status || {}).src || "ADS-B"), 1]]) +
        `<p class="hint">Pozycja aktualizowana co ${AIR.d.interval || 10} s, między odczytami przewidywana z kursu i prędkości. Linia za samolotem to trasa z ostatnich 30 minut.</p>`; }
  } else if (t === "ac") { const a = A(f.adsb && f.adsb.ac)[+key]; if (!a) return;
    h = chip("ADS-B · " + (ACN[a.cat] || a.cat), "var(--cyan)") + `<h2 class="glow">${esc(a.cs || a.hex)} · ${esc(a.t)}</h2>` + dd([["POZYCJA", fmtLL(a.lat, a.lon)], ["WYSOKOŚĆ", a.alt != null ? a.alt + " ft" : null], ["KURS", a.trk + "°"], ["MIGAWKA", f.adsb.t], ["ŚLAD", L(a.u, "globe.adsb.lol"), 1]]) + `<p class="hint">Pozycja z chwili pobrania, nie na żywo. Nad strefami walk samoloty często lecą z wyłączonym transponderem.</p>`;
  } else if (t === "gd") { const g = A(f.gdacs)[+key]; if (!g) return;
    h = chip("GDACS · " + g.alert, g.lvl === "Red" ? "var(--red)" : "var(--amber)") + `<h2 class="glow">${esc(g.kind)}: ${esc(g.name)}</h2>` + dd([["GDZIE", g.country], ["OKRES", fd(g.from) + " – " + fd(g.to)], ["SKALA", g.sev], ["RAPORT", L(g.u, "gdacs.org"), 1]]);
  } else if (t === "nhc") { const n = A(f.nhc)[+key]; if (!n) return;
    h = chip("NHC · " + n.cls, "var(--red)") + `<h2 class="glow">${esc(n.name)}</h2>` + dd([["WIATR", `${n.kmh} km/h (${n.kt} kt), ${n.hpa} hPa`], ["POZYCJA", fmtLL(n.lat, n.lon)], ["RUCH", `${n.dir}° · ${Math.round((n.spd || 0) * 1.852)} km/h`], ["KOMUNIKAT", L(n.u, "nhc.noaa.gov"), 1]]);
  } else if (t === "asp") { const a = A(S.airspace).find(x => x.id === key); if (!a) return; const l = ASL[a.level] || ASL.caution;
    h = chip("PRZESTRZEŃ · " + l[0], l[1]) + `<h2 class="glow">${esc(a.name)}</h2>` + dd([["CO", a.note], ["ŹRÓDŁO", srcLinks([a.src]), 1]]);
  } else if (t === "net") { const n = A(f.ioda)[+key]; if (!n) return;
    h = chip("IODA · SYGNAŁ ZAKŁÓCENIA", "var(--red)") + `<h2 class="glow">${esc(n.name)}</h2>` + dd([["WSKAŹNIK", n.score + " (log)"], ["ZDARZEŃ", n.events], ["DETEKTORY", A(n.src).join(", ")], ["WYKRES", L(n.u, "ioda"), 1]]) + `<p class="hint">Wskaźnik sumuje spadki widoczności sieci z 48 godzin. W małym kraju może to być awaria jednego operatora; w państwach z wojną lub protestami często celowe wyłączenie.</p>`;
  } else if (t === "hum") { const x = A(S.humanitarian)[+key]; if (!x) return;
    h = chip("HUMANITARNE · " + x.where, "var(--amber)") + `<h2 class="glow">${esc(x.t)}</h2>` + dd([["CO", x.note], ["KIEDY", fd(x.d)], ["ŹRÓDŁO", srcLinks([x.src]), 1]]);
  } else if (t === "who") { const w = A(f.who)[+key]; if (!w) return;
    h = chip("WHO · OGNISKO CHOROBY", "var(--red)") + `<h2 class="glow">${esc(w.dis)}</h2>` + dd([["GDZIE", w.country], ["KOMUNIKAT", fd(w.d)], ["ŹRÓDŁO", L(w.u, "WHO Disease Outbreak News"), 1]]);
  } else if (t === "rw") { const r = A(f.reliefweb)[+key]; if (!r) return;
    h = chip("RELIEFWEB · " + r.country, "var(--amber)") + `<h2 class="glow">${esc(r.t)}</h2>` + dd([["DATA", fd(r.d)], ["RAPORT", L(r.u, "reliefweb.int"), 1]]);
  } else if (t === "nk") { const n = A(S.nuclear)[+key]; if (!n) return; const st = NKS[n.status] || NKS.unknown;
    h = chip("ATOM · " + st[0], st[1]) + `<h2 class="glow">${esc(n.name)}</h2>` + dd([["STAN", n.note], ["GDZIE", fmtLL(n.lat, n.lon)], ["ŹRÓDŁO", srcLinks([n.src]), 1]]);
  } else if (t === "ef") { const e = A(S.eastflank)[+key]; if (!e) return;
    h = chip("FLANKA · " + (KND[e.kind] || e.kind), "var(--violet)") + `<h2 class="glow">${esc(e.t)}</h2>` + dd([["CO", e.note], ["KIEDY", fd(e.d)], ["ŹRÓDŁO", srcLinks([e.src]), 1]]);
  } else if (t === "fire") { const x = A(f.firms)[+key]; if (!x) return;
    h = chip("NASA FIRMS · OGNISKO", "#ff7a2a") + `<h2 class="glow">${esc(x.reg)}</h2>` + dd([["POZYCJA", fmtLL(x.lat, x.lon) + " (komórka 0,2°)"], ["DETEKCJI", x.n], ["MOC (FRP)", x.frp + " MW"], ["DATA", fd(x.t)]]) + `<p class="hint">Satelita widzi każde gorące źródło: pożary rolnicze, pochodnie gazowe, ale też płonące rafinerie i składy po uderzeniach. Liczy się nagłe pojawienie w rejonie walk.</p>`;
  } else if (t === "pm") { const e = A(f.polymarket)[+key]; if (!e) return;
    h = chip("POLYMARKET · RYNEK PREDYKCYJNY", "var(--cyan)") + `<h2 class="glow">${esc(e.t)}</h2>` + e.m.map(m => `<div class="pbar" style="padding:2px 0"><span>${esc(m.q)}</span><i><b style="width:${pct(m.p)}"></b></i><span>${pct(m.p)}</span></div>`).join("") +
      dd([["ORYGINAŁ", e.orig], ["OBRÓT 24 H", "$" + (e.vol24 || 0).toLocaleString("pl-PL")], ["RYNEK", L(e.u, "polymarket.com"), 1]]) + `<p class="hint">Cena zakładu pokazuje oczekiwania graczy, a nie fakty. Warunki rozstrzygnięcia mogą różnić się od intuicyjnego znaczenia pytania.</p>`;
  } else if (t === "kev") { const v = A(f.kev)[+key]; if (!v) return;
    h = chip("CISA KEV" + (v.ransom ? " · RANSOMWARE" : ""), v.ransom ? "var(--red)" : "var(--amber)") + `<h2 class="glow">${esc(v.vendor)} ${esc(v.product)}</h2>` + dd([["LUKA", v.name], ["CVE", v.cve], ["DODANA", fd(v.added)], ["TERMIN ŁATANIA (US GOV)", fd(v.due)], ["SZCZEGÓŁY", L(v.u, "NVD"), 1]]) + `<p class="hint">Katalog obejmuje tylko luki, o których CISA wie, że są już wykorzystywane w atakach.</p>`;
  } else if (t === "sanc") { const x = A(S.sanctions)[+key]; if (!x) return;
    h = chip("SANKCJE · " + x.who, "var(--amber)") + `<h2 class="glow">${esc(x.t)}</h2>` + dd([["CO", x.note], ["KIEDY", fd(x.d)], ["ŹRÓDŁO", srcLinks([x.src]), 1]]);
  } else if (t === "ofac") { const x = A(f.ofac)[+key]; if (!x) return;
    h = chip("OFAC · USA", "var(--amber)") + `<h2 class="glow">${esc(x.t)}</h2>` + dd([["DATA", fd(x.d)], ["KOMUNIKAT", L(x.u, "ofac.treasury.gov"), 1]]) + `<p class="hint">Tytuł oryginalny z listy OFAC.</p>`;
  } else if (t === "trv") { const x = A((f.travel || {}).us)[+key]; if (!x) return;
    h = chip("USA · POZIOM " + x.lvl, x.lvl >= 4 ? "var(--red)" : "var(--amber)") + `<h2 class="glow">${esc(x.country)}</h2>` + dd([["ZALECENIE", x.lbl], ["ZMIANA", fd(x.d)], ["ŹRÓDŁO", L(x.u, "travel.state.gov"), 1]]);
  } else if (t === "nbp") { const s = A((f.nbp || {})[key]); if (!s.length) return;
    h = chip("NBP · KURS ŚREDNI", "var(--phos)") + `<h2 class="glow">${esc(key)}/PLN: ${s[s.length - 1][1].toFixed(4).replace(".", ",")}</h2>` + spark(s.map(x => x[1]), 80) + dd([["SESJE", s.map(x => x[0].slice(5) + ": " + x[1]).join(" · ")], ["ŹRÓDŁO", L("https://api.nbp.pl/", "api.nbp.pl"), 1]]);
  } else if (t === "ec") { const e = A(S.econ)[+key]; if (!e) return;
    h = chip("GOSPODARKA", "var(--phos)") + `<h2 class="glow">${esc(e.k)}: ${esc(e.v)}</h2>` + dd([["CO", e.note], ["ŹRÓDŁO", srcLinks([e.src]), 1]]);
  } else if (t === "aw") { const a = S.airwar, dy = a && A(a.days)[+key]; if (!dy) return; const tot = (dy.drones || 0) + (dy.missiles || 0);
    h = chip("NOCNY ATAK · " + fd(dy.d), "var(--red)") + `<h2 class="glow">${tot} celów, zestrzelono ${dy.downed ?? "?"}</h2>` + dd([["DRONY", dy.drones], ["RAKIETY", dy.missiles == null ? "brak danych" : dy.missiles],
      ["SKUTECZNOŚĆ OBRONY", dy.downed != null && tot ? Math.round(dy.downed / tot * 100) + "%" : null], ["CO", dy.note], ["TREND", a.note], ["ŹRÓDŁA", srcLinks(a.src), 1]]) + `<p class="hint">Dane Sił Powietrznych Ukrainy, czyli jednej strony konfliktu.</p>`;
  } else if (t === "src") { const s = srcList()[+key]; if (!s) return;
    h = chip("ŹRÓDŁO" + (s.rel ? " · WIARYGODNOŚĆ " + s.rel : ""), "var(--phos)") + `<h2 class="glow">${esc(s.name)}</h2>` + dd([["STAN", s.state], ["UWAGI", s.note], s.url ? ["ADRES", L(s.url, s.url), 1] : null]);
  } else return;
  $("#detail").innerHTML = h; bindDetail();
}
function idleDetail() {
  const hot = A(S.conflicts).filter(c => c.trend === "esc" || c.trend === "new");
  $("#detail").innerHTML = `${chip("GOTOWY", "var(--phos)")}<h2 class="glow">Wybierz cel</h2>
  <p class="hint">Kliknij obiekt na mapie albo pozycję w panelach. Teatr działań przybliża region; kółko myszy powiększa, ◎ wraca do świata. Na globusie przeciągnij, aby obrócić.</p>` +
  dd([["NAJWYŻSZY PRIORYTET", `<ul class="mini">${hot.map(c => `<li><button data-go="c:${c.id}">▸ ${esc(c.name)}</button></li>`).join("") || "—"}</ul>`, 1],
    A(S.fronts).length ? ["FRONTY", `<ul class="mini">${A(S.fronts).map(x => `<li><button data-go="f:${x.id}">▸ ${esc(x.name)}</button></li>`).join("")}</ul>`, 1] : null,
    ["SKALA WIARYGODNOŚCI", "Litera: ocena źródła (A najlepsze, F nieznane). Cyfra: ocena informacji (1 potwierdzona przez inne źródła, 6 nie da się ocenić). Na przykład B2 to zwykle wiarygodne źródło i prawdopodobnie prawdziwa informacja."]]);
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
    <div class="meta"><span class="sec">${SEC[d.s] || d.s}</span><span>${esc(d.t)}</span><span class="lvl">${LVL[d.p]}</span><span class="credm" title="${esc((REL[d.rel] || "") + "; " + (INFO[d.info] || ""))}">${esc(d.rel || "F")}${esc(d.info || 6)}${d.claim ? " · DEKLARACJA" : ""}</span>${A(d.sources).length > 1 ? `<span>${d.sources.length} ŹRÓDŁA</span>` : ""}</div>
    <h3 class="glow">${esc(d.h)}</h3><p>${esc(d.b)}</p>${d.why ? `<p class="why"><b>DLACZEGO ·</b> ${esc(d.why)}</p>` : ""}
    <div class="acts"><span>ŹRÓDŁO: <a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(d.src)}</a></span>
      ${itemLL(d) ? `<button data-a="map" data-id="${d.id}">◎ NA MAPIE</button>` : ""}
      <button data-a="read" data-k="${esc(d.key)}" aria-pressed="${readSet.has(d.key)}">✓ PRZECZYTANE</button>
      <button data-a="watch" data-k="${esc(d.key)}" aria-pressed="${watchSet.has(d.key)}">◆ OBSERWUJ</button></div></li>`).join("") || '<li class="empty">BRAK REKORDÓW DLA TEGO FILTRA</li>';
  $("#count").textContent = `${rows.length} / ${items.length} · NIEPRZECZYTANE ${items.filter(i => !readSet.has(i.key)).length}`;
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
  const el = $(sel); el.innerHTML = html || '<li class="empty">BRAK DANYCH W TYM ODCZYCIE</li>';
  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { go(b.dataset.go); const t = b.dataset.go.split(":")[0]; if (!["mk", "cal", "nbp", "ec", "pm", "kev", "sanc", "ofac", "aw", "src", "rw"].includes(t)) scrollMap(); else if (innerWidth < 1060) $("#detail").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); }));
}
const isNewMod = (k, id) => A(((S.changes || {}).new_mods || {})[k]).includes(id);
function renderRail() {
  const t = S.threat || { level: "–", label: "", note: "" }, C = A(S.conflicts), hot = C.filter(c => c.trend === "esc" || c.trend === "new").length;
  const b = A(MK && MK.items).find(m => m.id === "brent"), hz = A(S.shipping).find(s => s.id === "hormuz"), aw = S.airwar && A(S.airwar.days), last = aw && aw[aw.length - 1];
  const d = new Date(S.stamp);
  const cells = [
    ["Poziom napięcia", `${t.level} · ${t.label}`, t.note, "red", null],
    ["Konflikty", C.length, hot + " nowe lub eskalujące", "", null],
    ["Fronty", A(S.fronts).length || "–", A(S.fronts).reduce((s, f) => s + A(f.moves).length, 0) + " ruchów w 30 dni", "amber", A(S.fronts).length ? "f:" + S.fronts[0].id : null],
    ["Ropa Brent", b && !b.error ? "$" + b.price.toFixed(2) : "–", b && !b.error ? `${b.change_pct >= 0 ? "▲" : "▼"} ${Math.abs(b.change_pct).toFixed(2)}% · 5 dni · na żywo` : "łączenie…", b && b.change_pct >= 0 ? "red" : "", b ? "mk:brent" : null],
    ["Ormuz", hz ? (SHIP[hz.status] || SHIP.open)[0] : "–", hz ? String(hz.metric || "").split(";")[0] : "", hz && hz.status !== "open" ? "amber" : "", hz ? "sh:hormuz" : null],
    ["USA – Iran", S.iranStatus ? (S.iranStatus.ceasefire === "in_force" ? "ROZEJM" : "BEZ ROZEJMU") : "–", S.iranStatus ? "pauza do " + String(S.iranStatus.expires || "?").split(" (")[0] : "", S.iranStatus && S.iranStatus.ceasefire !== "in_force" ? "red" : "", S.iranStatus ? "c:iran" : null],
    ["Noc nad Ukrainą", last ? ((last.drones || 0) + (last.missiles || 0)) + " celów" : "–", last ? "drony i rakiety · " + fd(last.d) : "", "amber", last ? "aw:" + (aw.length - 1) : null],
    ["Natura", A(S.hazards).length + A(F().gdacs).length, `${A(S.hazards).filter(h => h.kind === "quake").length} wstrząsów ≥M5.5 · ${A(F().gdacs).length} alertów GDACS`, "amber", null],
    ["Odczyt · AI", isNaN(d) ? "--" : d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }), (ARCH ? "archiwum · " : "") + (S.model ? "AI: " + S.model : S.seed ? "dane startowe" : "bez analizy AI"), "", null]];
  $("#rail").innerHTML = cells.map(c => `<${c[4] ? `button class="stat" data-go="${c[4]}"` : 'div class="stat"'}><span class="k">${esc(c[0])}</span><span class="v ${c[3]}">${esc(c[1])}</span><span class="n" title="${esc(c[2])}">${esc(c[2])}</span></${c[4] ? "button" : "div"}>`).join("");
  $("#rail").querySelectorAll("[data-go]").forEach(x => x.addEventListener("click", () => { go(x.dataset.go); if (!/^(mk|aw)/.test(x.dataset.go)) scrollMap(); }));
  $("#banner").textContent = `PRIORYTET JEDEN · ${A(S.items).filter(i => i.p === "crit").length} ZDARZENIA KRYTYCZNE · ` + C.filter(c => c.trend === "esc").map(c => c.name.toUpperCase()).join(" / ");
  $("#ticker").textContent = A(S.items).map(x => "■ " + (SEC[x.s] || "") + " // " + x.h.toUpperCase()).join("   ") + "   ■ KONIEC TRANSMISJI";
}
const MODNAME = { strikes: ["uderzenia", "#strikes"], eastflank: ["flanka NATO", "#ef"], forces: ["ruchy sił", "#forces"], airspace: ["przestrzeń", "#sky"], nuclear: ["atom", "#nuke"], sanctions: ["sankcje", "#sanc"], humanitarian: ["humanitarne", "#hum"], econ: ["gospodarka", "#mktNote"] };
function renderChanges() {
  const ch = S.changes || {}, el = $("#changes");
  const items = A(S.items).filter(i => A(ch.new_items).includes(i.id)).slice(0, 8);
  const trends = A(ch.trend_changes).map(t => { const c = A(S.conflicts).find(x => x.id === t.id); return c ? `<button class="pill" data-go="c:${c.id}">${esc(c.name)}: ${(TREND[t.from] || ["?"])[0]} → <b>${(TREND[t.to] || ["?"])[0]}</b></button>` : ""; }).join("");
  const nc = A(ch.new_conflicts).map(id => { const c = A(S.conflicts).find(x => x.id === id); return c ? `<button class="pill" data-go="c:${c.id}"><b>NOWY</b> ${esc(c.name)}</button>` : ""; }).join("");
  const mods = Object.entries(ch.new_mods || {}).filter(([k, v]) => A(v).length && MODNAME[k]).map(([k, v]) => `<button class="pill" data-scroll="${MODNAME[k][1]}"><b>+${v.length}</b> ${MODNAME[k][0]}</button>`).join("")
    + (ch.new_moves ? `<button class="pill" data-scroll="#fronts"><b>+${ch.new_moves}</b> ruchy na frontach</button>` : "");
  el.innerHTML = `<div class="row"><h2>&gt; CO NOWEGO${ch.since ? ` OD ${esc(new Date(ch.since).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }))}` : ""}</h2>
    <span class="n">${A(ch.new_items).length} nowych depesz · ${A(ch.trend_changes).length} zmian statusu · ${A(ch.new_hazards).length} nowych zagrożeń</span></div>
    ${ch.summary ? `<p>${esc(ch.summary)}</p>` : ""}${nc || trends || mods ? `<div class="row">${nc}${trends}${mods}</div>` : ""}
    ${items.length ? `<div class="row">${items.map(i => `<button class="pill" data-go="n:${i.id}">${esc(i.h)}</button>`).join("")}</div>` : ""}`;
  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { go(b.dataset.go); scrollMap(); }));
  el.querySelectorAll("[data-scroll]").forEach(b => b.addEventListener("click", () => { const t = $(b.dataset.scroll); if (t) t.closest("section").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }));
}
function renderReg() {
  const list = [...A(S.conflicts)].sort((a, b) => TORDER[a.trend] - TORDER[b.trend]);
  rowsInto("#reg", list.map(c => { const t = TREND[c.trend] || TREND.ongoing; return `<li${A((S.changes || {}).new_conflicts).includes(c.id) ? ' class="newrow"' : ""}><button data-go="c:${c.id}"><span>${esc(c.name)}</span>${chip(t[0], t[1])}</button></li>`; }).join(""));
  $("#regCount").textContent = list.length + " WĘZŁÓW";
  $("#sitList").innerHTML = ["Świat", "Bliski Wschód", "Europa Wschodnia", "Flanka NATO", "Afryka", "Azja i Pacyfik", "Ameryki", "Szlaki morskie", "Cyberprzestrzeń"].concat(list.map(c => c.name)).map(x => `<option value="${esc(x)}">`).join("");
}
function renderShip() {
  const s = A(S.shipping), ord = { closed: 0, restricted: 1, disrupted: 2, open: 3 }, pwAll = F().portwatch || {};
  $("#shipCount").textContent = s.length ? s.filter(x => x.status !== "open").length + " Z " + s.length + " ZAKŁÓCONYCH" : "";
  rowsInto("#ship", [...s].sort((a, b) => ord[a.status] - ord[b.status]).map(x => { const st = SHIP[x.status] || SHIP.open, pw = pwAll[x.id];
    return `<li><button data-go="sh:${x.id}"><span class="t">${esc(x.name)}</span>${chip(st[0], st[1])}<span class="sub">${esc(x.metric)}</span>${pw ? `<span class="sub">AIS (PortWatch): śr. ${pw.avg7}/dobę${pw.base ? ` · rok temu ${pw.base}/dobę (${Math.round((pw.avg7 / pw.base - 1) * 100)}%)` : ""} · do ${esc(pw.last)}</span><span class="sub">${spark(pw.series.map(r => r[1]), 18)}</span>` : ""}</button></li>`; }).join(""));
}
let calCat = store.get("calCat", "all");
function renderCal() {
  const all = A(S.calendar).map((e, i) => Object.assign({ i }, e)), cats = ["all", ...new Set(all.map(e => e.cat).filter(Boolean))];
  $("#calTabs").innerHTML = cats.map(c => `<button class="btn" data-c="${c}" aria-pressed="${c === calCat}">${c === "all" ? "WSZYSTKO" : CAT[c] || c}</button>`).join("");
  $("#calTabs").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { calCat = b.dataset.c; store.set("calCat", calCat); renderCal(); }));
  const list = all.filter(e => (calCat === "all" || e.cat === calCat) && (dayDiff(e.d) == null || dayDiff(e.d) >= -1)).sort((a, b) => { const ka = String(a.d).length === 7 ? a.d + "-32" : String(a.d), kb = String(b.d).length === 7 ? b.d + "-32" : String(b.d); return ka.localeCompare(kb); });
  $("#calCount").textContent = list.length + " POZYCJI";
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
    const f = d => d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
    el.append("text").attr("x", m.l).attr("y", hh - 4).style("fill", "var(--phos-dim)").style("font-size", "9px").text(f(h[0].t));
    el.append("text").attr("x", w - m.r).attr("y", hh - 4).attr("text-anchor", "end").style("fill", "var(--phos-dim)").style("font-size", "9px").text(f(l.t));
  }
  $("#trendNote").textContent = h.length > 1 ? `${h.length} odczytów` : "historia rośnie z każdym odczytem";
}
function renderMarkets() {
  const items = A(MK && MK.items);
  $("#markets").innerHTML = items.map(m => {
    if (m.error) return `<div class="mkt"><span class="k">${esc(m.label)}</span><span class="v dim">—</span><span class="n">brak danych</span></div>`;
    const s = A(m.spark), mn = Math.min(...s), mx = Math.max(...s), up = m.change_pct >= 0;
    const pts = s.map((v, i) => `${(i / Math.max(1, s.length - 1)) * 100},${24 - ((v - mn) / ((mx - mn) || 1)) * 20}`).join(" ");
    return `<button class="mkt" data-go="mk:${m.id}"><span class="k">${esc(m.label)}</span><span class="v">${m.price.toLocaleString("pl-PL", { maximumFractionDigits: m.price < 20 ? 4 : 2 })}</span>
      <svg viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" style="fill:none;stroke:${up ? "var(--red)" : "var(--phos)"}" stroke-width="1.4" vector-effect="non-scaling-stroke"></polyline></svg>
      <span class="n"><span>${esc(m.unit)}</span><span class="${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(m.change_pct).toFixed(2)}%</span></span></button>`;
  }).join("") || '<div class="mkt"><span class="n">Łączenie z danymi rynkowymi…</span></div>';
  const nb = F().nbp || {}, NBPL = { EUR: "EUR/PLN", GBP: "GBP/PLN", CHF: "CHF/PLN", UAH: "UAH/PLN" };
  $("#markets").insertAdjacentHTML("beforeend", Object.keys(NBPL).filter(c => A(nb[c]).length).map(c => { const s = nb[c], h = s.map(x => x[1]), ch = (h[h.length - 1] / h[0] - 1) * 100;
    return `<button class="mkt" data-go="nbp:${c}"><span class="k">${NBPL[c]} · NBP</span><span class="v">${h[h.length - 1].toFixed(4).replace(".", ",")}</span>${spark(h, 26)}<span class="n"><span>${s.length} sesji</span><span class="${ch < 0 ? "down" : "up"}">${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1).replace(".", ",")}%</span></span></button>`; }).join(""));
  $("#markets").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { pick(b.dataset.go); if (innerWidth < 1060) $("#detail").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); }));
  $("#mktNote").innerHTML = (S.marketsNote ? `<b class="amber">DLACZEGO ·</b> ${esc(S.marketsNote)}` : "") + (A(S.econ).length ? `<ul class="mini" style="margin-top:6px">${A(S.econ).map((e, i) => `<li><button data-go="ec:${i}">▸ ${esc(e.k)}: <b>${esc(e.v)}</b></button></li>`).join("")}</ul>` : "");
  $("#mktNote").hidden = !(S.marketsNote || A(S.econ).length);
  $("#mktNote").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => pick(b.dataset.go)));
  $("#mkTime").textContent = MK && MK.fetched ? `${(items.find(m => m.source) || {}).source || ""} · ${new Date(MK.fetched).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : "na żywo";
  renderRail();
}
async function loadMarkets() { try { MK = await api("/api/markets"); renderMarkets(); } catch (e) {} }

function renderFronts() {
  const fr = A(S.fronts); $("#frCount").textContent = fr.length ? fr.length + " TEATRÓW" : "";
  $("#fronts").innerHTML = fr.length ? fr.map(f => `<ul class="rows"><li><button data-go="f:${f.id}"><span class="t">▸ ${esc(f.name)}</span>${chip("STAN " + f.asOf, "var(--amber)")}
      <span class="sub">${Object.entries(f.sides || {}).map(([k, v]) => `<span class="sw" style="background:${COL(v[1])}"></span>${esc(v[0].split(/[(,]/)[0])}`).join(" &nbsp;")}</span></button></li>
      ${A(f.moves).map((m, i) => `<li${m.ai ? ' class="newrow"' : ""}><button data-go="m:${f.id}:${i}"><span><span class="sw" style="background:${COL((f.sides[m.side] || [])[1])}"></span>${esc(m.label)}</span><span class="dim">${esc(m.when)}</span></button></li>`).join("")}</ul>`).join("")
    : '<p class="empty">BRAK DANYCH O FRONTACH W TYM ODCZYCIE</p>';
  $("#fronts").querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => { go(b.dataset.go); scrollMap(); }));
}
function renderAirwar() {
  const a = S.airwar, el = $("#airwar");
  if (!a || !A(a.days).length) { el.innerHTML = '<p class="empty">BRAK DANYCH W TYM ODCZYCIE</p>'; $("#awCount").textContent = ""; return; }
  const ds = A(a.days), mx = Math.max(...ds.map(d => (d.drones || 0) + (d.missiles || 0)), 1), w = 300 / ds.length;
  const bars = ds.map((d, i) => { const tot = (d.drones || 0) + (d.missiles || 0), dn = Math.min(tot, d.downed || 0), hT = tot / mx * 118, hD = dn / mx * 118, x = i * w + w * .15, bw = w * .7;
    return `<g data-go="aw:${i}" style="cursor:pointer"><rect x="${x}" y="${128 - hT}" width="${bw}" height="${hT}" style="fill:var(--red)"/><rect x="${x}" y="${128 - hD}" width="${bw}" height="${hD}" style="fill:var(--phos-dim)"/>
      <text x="${x + bw / 2}" y="${124 - hT}" text-anchor="middle" style="fill:var(--text);font-family:var(--f-display);font-size:13px">${tot}</text>
      <text x="${x + bw / 2}" y="140" text-anchor="middle" style="fill:var(--phos-dim);font-family:var(--f-display);font-size:12px">${+d.d.slice(8)} ${MON[+d.d.slice(5, 7) - 1]}</text></g>`; }).join("");
  const last = ds[ds.length - 1], lt = (last.drones || 0) + (last.missiles || 0);
  el.innerHTML = `<svg viewBox="0 0 300 144" role="img" aria-label="Liczba dronów i rakiet na noc">${bars}</svg>
    <div class="legend" style="border:0;padding:2px 0"><span><i style="background:var(--phos-dim)"></i>zestrzelone lub zneutralizowane</span><span><i style="background:var(--red)"></i>nieprzechwycone</span></div>
    <div class="kpi"><div><span class="k">Ostatnia noc</span><div class="v">${lt}</div></div><div><span class="k">Rakiety</span><div class="v">${last.missiles ?? "–"}</div></div><div><span class="k">Obrona</span><div class="v">${lt ? Math.round((last.downed || 0) / lt * 100) + "%" : "–"}</div></div></div>
    <p class="note">${esc(a.note)}</p>`;
  $("#awCount").textContent = ds.length + " NOCY";
  el.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => pick(b.dataset.go)));
}
function renderStrikes() { rowsInto("#strikes", A(S.strikes).map((s, i) => `<li${isNewMod("strikes", s.id) ? ' class="newrow"' : ""}><button data-go="st:${i}"><span class="t"><span class="sw" style="background:${s.side === "ru" ? "var(--red)" : "var(--cyan)"}"></span>${esc(s.target)}</span><span class="dim">${esc(s.when || fd(s.d))}</span><span class="sub">${s.side === "ru" ? "ROSJA → UKRAINA" : "UKRAINA → ROSJA"} · ${esc(s.note)}</span></button></li>`).join("")); }
function renderForces() { const f = A(S.forces); $("#forceCount").textContent = f.length ? f.length + " POZYCJI" : "";
  rowsInto("#forces", f.map((x, i) => { const kd = FKIND[x.kind] || ["", ""]; return `<li${isNewMod("forces", x.id) ? ' class="newrow"' : ""}><button data-go="fo:${i}"><span class="t">${esc(x.name)}</span><span class="chip violet">${esc(kd[1])}</span><span class="sub">${esc(x.where)} · ${esc(x.when)} · ${esc(x.note)}</span></button></li>`; }).join("")); }
function renderEF() { const e = A(S.eastflank); $("#efCount").textContent = e.length ? e.length + " ZDARZEŃ" : "";
  rowsInto("#ef", e.map((x, i) => `<li${isNewMod("eastflank", x.id) ? ' class="newrow"' : ""}><button data-go="ef:${i}"><span class="t">${esc(x.t)}</span><span class="dim">${esc(fd(x.d))}</span><span class="sub">${esc(KND[x.kind] || x.kind)} · ${esc(x.note)}</span></button></li>`).join("")); }
function renderSky() {
  const f = F(), gj = f.gpsjam || {}; let h = "";
  if (AIR.ok) {
    const d = AIR.d, ac = A(d.ac), st = d.status || {}, now = Date.now() + AIR.skew, cnt = {}; ac.forEach(a => cnt[a.cat] = (cnt[a.cat] || 0) + 1);
    $("#airT").innerHTML = `<span class="livedot"></span>NA ŻYWO · ${esc(st.src || "")} · co ${d.interval} s`;
    h += `<li class="hd">Samoloty wojskowe na żywo · ${ac.length} z ${st.total || "?"} nadających</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${Object.entries(cnt).map(([k, v]) => `${ACN[k] || k}: ${v}`).join(" · ") || "brak"}</span></button></li>`;
    const ev = A(d.events).slice(-8).reverse();
    if (ev.length) h += `<li class="hd">Kontakty w obserwowanych rejonach</li>` + ev.map(e => `<li><button data-go="ah:${esc(e.hex)}"><span class="t">${esc(e.msg)}</span><span class="dim">${new Date(e.at).toISOString().slice(11, 16)}</span></button></li>`).join("");
    const hot = ac.filter(a => NOTABLE.has(a.cat) && !a.ground).slice(0, 16);
    h += `<li class="hd">Rozpoznanie, tankowce, bombowce · ${hot.length}</li>` + hot.map(a => { const p = airPos(a, now);
      return `<li><button data-go="ah:${esc(a.hex)}"><span class="t">${esc(a.cs || a.hex)} · ${esc(a.desc || a.t)}</span><span class="chip" style="color:${ACOL[a.cat]};border-color:${ACOL[a.cat]}">${ACN[a.cat]}</span><span class="sub">${fmtLL(p[0], p[1])} · ${a.alt != null ? a.alt + " ft" : ""} · ${agoTxt(airAge(a, now))}</span></button></li>`; }).join("");
  } else {
    const ad = f.adsb || {}, ac = A(ad.ac); $("#airT").textContent = ad.t ? "MIGAWKA " + ad.t + (AIR.err ? " · brak łącza na żywo" : "") : "";
    const cnt = {}; ac.forEach(a => cnt[a.cat] = (cnt[a.cat] || 0) + 1);
    const far = ac.map((a, i) => Object.assign({ i }, a)).filter(a => !(a.lat > 15 && a.lat < 72 && a.lon > -170 && a.lon < -50)).slice(0, 14);
    h += `<li class="hd">Samoloty wojskowe (ADS-B, migawka) · ${ac.length} z ${ad.total || "?"}</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${Object.entries(cnt).map(([k, v]) => `${ACN[k] || k}: ${v}`).join(" · ") || "brak"}</span></button></li>`;
    h += far.map(a => `<li><button data-go="ac:${a.i}"><span class="t">${esc(a.cs || a.hex)} · ${esc(a.t)}</span><span class="chip cyan">${ACN[a.cat] || a.cat}</span><span class="sub">${fmtLL(a.lat, a.lon)} · ${a.alt != null ? a.alt + " ft" : ""}</span></button></li>`).join("");
  }
  if (gj.regions) h += `<li class="hd">Zakłócenia GNSS · ${esc(gj.day || "")} · ${gj.n || 0} heksów</li>` + Object.entries(gj.regions).map(([k, v]) => `<li><button tabindex="-1" style="cursor:default"><span>${esc(k)}</span><span class="${v > 50 ? "red" : "amber"}">${v}</span></button></li>`).join("");
  h += `<li class="hd">Przestrzeń powietrzna (EASA / FAA)</li>` + A(S.airspace).map(a => { const l = ASL[a.level] || ASL.caution; return `<li${isNewMod("airspace", a.id) ? ' class="newrow"' : ""}><button data-go="asp:${a.id}"><span class="t">${esc(a.name)}</span>${chip(l[0], l[1])}</button></li>`; }).join("");
  rowsInto("#sky", h);
}
function renderPM() { const e = A(F().polymarket);
  $("#pm").innerHTML = e.length ? e.map((x, i) => `<div class="pm-ev"><button data-pm="${i}">▸ ${esc(x.t)}</button>${x.m.slice(0, 4).map(m => `<div class="pbar"><span>${esc(m.q)}</span><i><b style="width:${pct(m.p)};background:${m.p >= .5 ? "var(--phos)" : m.p >= .2 ? "var(--amber)" : "var(--phos-dim)"}"></b></i><span>${pct(m.p)}</span></div>`).join("")}</div>`).join("") : '<p class="empty">BRAK DANYCH W TYM ODCZYCIE</p>';
  $("#pm").querySelectorAll("[data-pm]").forEach(b => b.addEventListener("click", () => pick("pm:" + b.dataset.pm))); }
function renderNet() { rowsInto("#net", A(F().ioda).slice(0, 15).map((x, i) => `<li><button data-go="net:${i}"><span class="t">${esc(x.name)}</span><span class="${x.score >= 8 ? "red" : x.score >= 6 ? "amber" : "dim"}">${x.score}</span><span class="sub">${x.events} zdarzeń · ${esc(A(x.src).join(", "))}</span></button></li>`).join("")); }
function renderNuke() { const n = A(S.nuclear); $("#nkCount").textContent = n.length ? n.filter(x => x.status === "crit").length + " KRYTYCZNE" : "";
  rowsInto("#nuke", n.map((x, i) => { const st = NKS[x.status] || NKS.unknown; return `<li${isNewMod("nuclear", x.id) ? ' class="newrow"' : ""}><button data-go="nk:${i}"><span class="t">${esc(x.name)}</span>${chip(st[0], st[1])}<span class="sub">${esc(x.note)}</span></button></li>`; }).join("")); }
function renderSanc() { const s = A(S.sanctions), o = A(F().ofac); $("#sancCount").textContent = (s.length + o.length) + " POZYCJI";
  rowsInto("#sanc", (s.length ? `<li class="hd">Najważniejsze (analiza)</li>` + s.map((x, i) => `<li${isNewMod("sanctions", x.id) ? ' class="newrow"' : ""}><button data-go="sanc:${i}"><span class="t">${esc(x.t)}</span><span class="chip amber">${esc(x.who)}</span><span class="sub">${esc(fd(x.d))} · ${esc(x.note)}</span></button></li>`).join("") : "")
    + (o.length ? `<li class="hd">OFAC – lista działań (automat, po angielsku)</li>` + o.map((x, i) => `<li><button data-go="ofac:${i}"><span>${esc(x.t)}</span><span class="dim">${esc(fd(x.d))}</span></button></li>`).join("") : "")); }
function renderKev() { rowsInto("#kev", A(F().kev).map((v, i) => `<li><button data-go="kev:${i}"><span class="t">${esc(v.vendor)} · ${esc(v.product)}</span><span class="${v.ransom ? "red" : "dim"}">${v.ransom ? "RANSOMWARE" : esc(fd(v.added))}</span><span class="sub">${esc(v.cve)} · ${esc(v.name)}</span></button></li>`).join("")); }
function renderHum() { const h = A(S.humanitarian), f = F(), w = A(f.who), r = A(f.reliefweb); $("#humCount").textContent = (h.length + w.length) + " ALERTÓW";
  rowsInto("#hum", (h.length ? `<li class="hd">Kryzysy humanitarne</li>` + h.map((x, i) => `<li${isNewMod("humanitarian", x.id) ? ' class="newrow"' : ""}><button data-go="hum:${i}"><span class="t">${esc(x.t)}</span><span class="dim">${esc(fd(x.d))}</span><span class="sub">${esc(x.where)} · ${esc(x.note)}</span></button></li>`).join("") : "")
    + (w.length ? `<li class="hd">WHO – ogniska chorób</li>` + w.map((x, i) => `<li><button data-go="who:${i}"><span class="t">${esc(x.dis)}</span><span class="dim">${esc(fd(x.d))}</span><span class="sub">${esc(x.country)}</span></button></li>`).join("") : "")
    + (r.length ? `<li class="hd">ReliefWeb – najnowsze raporty (po angielsku)</li>` + r.slice(0, 10).map((x, i) => `<li><button data-go="rw:${i}"><span>${esc(x.t)}</span><span class="dim">${esc(x.country)}</span></button></li>`).join("") : "")); }
function renderTrv() { const T2 = F().travel || {};
  rowsInto("#trv", (A(T2.us).length ? `<li class="hd">USA – podniesione do poziomu 3–4 (21 dni)</li>` + A(T2.us).map((x, i) => `<li><button data-go="trv:${i}"><span class="t">${esc(x.country)}</span><span class="${x.lvl >= 4 ? "red" : "amber"}">POZIOM ${x.lvl}</span><span class="sub">${esc(fd(x.d))} · ${esc(x.lbl)}</span></button></li>`).join("") : "")
    + (A(T2.lvl4).length ? `<li class="hd">USA – „nie podróżuj” (${T2.lvl4.length})</li><li><button tabindex="-1" style="cursor:default"><span class="sub">${esc(T2.lvl4.join(", "))}</span></button></li>` : "")
    + (A(T2.uk).length ? `<li class="hd">UK FCDO – ostatnio zaktualizowane</li>` + A(T2.uk).map(x => `<li><a class="rowlink" href="${esc(x.u)}" target="_blank" rel="noopener"><span>${esc(x.country)}</span><span class="dim">${esc(fd(x.d))}</span></a></li>`).join("") : "")); }
function renderHaz() { const h = A(S.hazards), f = F(); $("#hazCount").textContent = (h.length + A(f.gdacs).length) + " ZDARZEŃ";
  const ic = { quake: "▲", volcano: "◆", storm: "●" };
  rowsInto("#haz", h.map((x, i) => `<li><button data-go="h:${i}"><span><span class="amber">${ic[x.kind] || "•"}</span> ${esc(x.name_pl || x.name)}</span><span class="dim">${esc(x.mag)} · ${esc(x.when)}</span></button></li>`).join("")
    + (A(f.gdacs).length ? `<li class="hd">Alerty GDACS (10 dni)</li>` + A(f.gdacs).map((g, i) => `<li><button data-go="gd:${i}"><span class="t">${esc(g.kind)}: ${esc(g.name)}</span><span class="${g.lvl === "Red" ? "red" : "amber"}">${esc(g.alert)}</span><span class="sub">${esc(String(g.country || "").slice(0, 90))}</span></button></li>`).join("") : "")
    + (A(f.nhc).length ? `<li class="hd">NOAA NHC – aktywne cyklony</li>` + A(f.nhc).map((n, i) => `<li><button data-go="nhc:${i}"><span class="t">${esc(n.cls)} ${esc(n.name)}</span><span class="red">${n.kmh} km/h</span></button></li>`).join("") : "")); }
function renderLaunch() { const ll = A(F().ll2);
  rowsInto("#launch", ll.map(l => { const d = new Date(l.net), ok = l.past && /succ/i.test(l.st || ""), fail = l.past && /fail/i.test(l.st || "");
    return `<li><button tabindex="-1" style="cursor:default"><span><b class="cal-d ${l.past ? "" : "amber"}">${d.getUTCDate()} ${MON[d.getUTCMonth()]}</b> &nbsp;${esc(l.name)}</span><span class="${fail ? "red" : ok ? "ok" : "dim"}">${l.past ? (ok ? "✓" : fail ? "✕" : esc(l.st)) : esc(l.st || "")}</span><span class="sub">${esc(l.prov || "")} · ${esc(l.pad || "")}${l.past ? "" : " · " + d.toISOString().slice(11, 16) + " UTC"}</span></button></li>`; }).join("")); }
function srcList() {
  const st = A(F().status).map(s => ({ name: s.name, url: s.url, rel: s.rel, note: s.note, auto: "feed",
    state: s.ok ? (s.stale ? "STARE (z " + s.stale + ")" : "OK · " + (s.n != null ? s.n + " rekordów · " : "") + s.t) : (s.stale ? "BŁĄD, pokazuję dane z " + s.stale : "BŁĄD: " + (s.err || "")), cls: s.ok && !s.stale ? "ok" : s.stale ? "stale" : "err" }));
  const rss = A((STATUS && A(STATUS.sources).length ? STATUS.sources : S.sources_report)).map(s => ({ name: s.source, url: "", rel: "", note: "wiadomości analizowane przez lokalne AI", auto: "rss",
    state: s.error ? "BŁĄD: " + s.error : "OK · " + s.count + " wiadomości", cls: s.error ? "err" : "ok" }));
  return st.concat(rss);
}
function renderSrc() {
  const Ls = srcList(), f = F();
  $("#srcCount").textContent = A(f.status).filter(s => s.ok).length + "/" + A(f.status).length + " FEEDÓW OK" + (f.t ? " · " + f.t.replace("T", " ") : "");
  let h = "", last = "";
  Ls.forEach((s, i) => { if (s.auto !== last) { h += s.auto === "feed" ? `<li class="hd">Feedy automatyczne · A = oficjalne lub naukowe, B = dobre z zastrzeżeniami, C = sygnał pomocniczy</li>` : `<li class="hd">Źródła wiadomości dla AI (ostatnia analiza)</li>`; last = s.auto; }
    h += `<li><button data-go="src:${i}"><span class="t">${esc(s.name)}</span><span class="${s.cls}">● ${s.cls === "ok" ? "OK" : s.cls === "stale" ? "STARE" : "BŁĄD"}${s.rel ? " · " + esc(s.rel) : ""}</span><span class="sub">${esc(s.state)}</span></button></li>`; });
  rowsInto("#srcs", h);
}

/* ------------------------------------------------------------ STATUS */
let seenFinished;
function renderSys() {
  if (!STATUS) return;
  const e = STATUS.engine, hw = e.hardware, j = STATUS.job, pull = e.pull || {};
  $("#sysState").textContent = e.ready ? "AI GOTOWE" : e.backend ? "BRAK MODELU" : "BRAK AI";
  $("#sys").innerHTML = `<dl>
    <dt>GPU</dt><dd>${esc(hw.gpu_name)}${hw.vram_gb ? ` · ${hw.vram_gb} GB VRAM` : ""}</dd>
    <dt>RAM</dt><dd>${hw.ram_gb} GB · ${hw.cores} wątków</dd>
    <dt>SILNIK</dt><dd>${e.backend ? esc(e.backend === "ollama" ? "Ollama" : e.backend === "lmstudio" ? "LM Studio" : e.backend) : '<span class="red">nie wykryto: zainstaluj Ollamę (ollama.com) i uruchom ponownie</span>'}</dd>
    <dt>MODEL</dt><dd>${e.model ? esc(e.model) : '<span class="red">brak</span>'}</dd>
    <dt>ZALECANY</dt><dd>${esc(e.recommended)}${e.recommended_size_gb ? ` (${e.recommended_size_gb} GB)` : ""}<br><span class="dim">${esc(e.reason)}</span></dd>
    <dt>NASTĘPNY</dt><dd>${STATUS.next ? new Date(STATUS.next).toLocaleString("pl-PL", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</dd></dl>
    ${e.suggest_pull ? `<div class="dbtns"><button class="btn" id="pullBtn" ${pull.active ? "disabled" : ""}>${pull.active ? `POBIERANIE ${pull.pct}%` : `POBIERZ ${esc(e.recommended)}`}</button></div>` : ""}
    ${pull.status && pull.status !== "gotowe" ? `<span class="dim">${esc(pull.status)}</span>` : ""}
    <details><summary>DZIENNIK</summary><pre>${esc(A(STATUS.log).slice(-50).join("\n"))}</pre></details>`;
  const pb = $("#pullBtn"); if (pb) pb.addEventListener("click", async () => { beep(1000); await api("/api/model/pull", {}); pollStatus(); });
  $("#jobbar").hidden = !j.running; $("#jobfill").style.width = j.pct + "%"; $("#jobtext").textContent = `ANALIZA: ${j.step} · ${j.pct}%`;
  $("#refreshBtn").disabled = j.running; $("#refreshBtn").textContent = j.running ? "ANALIZA TRWA…" : "ODŚWIEŻ ANALIZĘ";
  if (seenFinished === undefined) seenFinished = j.finished;
  else if (j.finished !== seenFinished) { seenFinished = j.finished; doneChime(); if (!ARCH) loadState(true); }
}
let pollT = null;
async function pollStatus() {
  clearTimeout(pollT);
  try { STATUS = await api("/api/status"); renderSys(); } catch (e) { $("#sysState").textContent = "SERWER NIEDOSTĘPNY"; }
  const busy = STATUS && (STATUS.job.running || (STATUS.engine.pull || {}).active);
  pollT = setTimeout(pollStatus, busy ? 2500 : 20000);
}
$("#refreshBtn").addEventListener("click", async () => { beep(1100); await api("/api/refresh", {}); pollStatus(); });

/* ------------------------------------------------------------ ZAPYTANIA I SITREP */
const HINTS = ["Dlaczego Ormuz jest zamknięty?", "Co się zmieniło na froncie w Ukrainie?", "Jak wojna z Iranem wpływa na ceny w Europie?", "Co się dzieje na wschodniej flance NATO?", "Które konflikty eskalują i dlaczego?"];
$("#qHints").innerHTML = HINTS.map(h => `<button>${esc(h)}</button>`).join("");
$("#qHints").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { $("#q").value = b.textContent; ask(); }));
async function streamTo(url, body, el, onDone, signal) {
  el.hidden = false; el.textContent = "> PRZETWARZANIE…"; let text = ""; burble(true);
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const rd = r.body.getReader(), dec = new TextDecoder();
    for (;;) { const { done, value } = await rd.read(); if (done) break; const part = dec.decode(value, { stream: true }); if (part && burbleT) burble(false); chatter(part.length); text += part; el.textContent = text.replace(/\n?REF:.*$/s, "") || "> PRZETWARZANIE…"; }
  } catch (e) { burble(false); if (e.name === "AbortError") return; el.textContent = "Brak połączenia z serwerem KRONOS-7."; beep(220, .3, "sawtooth"); return; }
  burble(false);
  el.textContent = text.replace(/\n?REF:.*$/s, "").trim(); tone(1400, .05, "square", .03); tone(2100, .07, "square", .03, .07); if (onDone) onDone(text);
}
function ask() {
  const q = $("#q").value.trim(); if (!q) return; beep(1000, .06);
  streamTo("/api/ask", { q }, $("#qOut"), text => { const m = text.match(/REF:\s*(.+)$/m); if (!m) return;
    const ids = m[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
    const c = A(S.conflicts).find(x => ids.includes(x.id)); if (c) { go("c:" + c.id); return; }
    const it = ids.find(i => A(S.items).some(x => x.id === i)); if (it) go("n:" + it); });
}
$("#qGo").addEventListener("click", ask);
$("#q").addEventListener("keydown", e => { if (e.key === "Enter") ask(); else if (e.key.length === 1) { noise(.012, .045, 0, 2500); tone(1600 + Math.random() * 400, .01, "square", .012); } });
/* SITREP w oknie: strumień, kopiuj, czytaj, drukuj */
let sitCtl = null, sitBusy = false, sitFocus = null, sitText = "";
function sitOpen() { sitFocus = document.activeElement; $("#sitModal").hidden = false; $("#sitClose").focus(); }
function sitClose() { burble(false); if (sitCtl) sitCtl.abort(); sitCtl = null; sitBusy = false; if ("speechSynthesis" in window) speechSynthesis.cancel(); $("#sitModal").hidden = true; if (sitFocus) sitFocus.focus(); }
function sitButtons() { ["#sitCopy", "#sitSpeak", "#sitPrint", "#sitAgain"].forEach(b => $(b).disabled = sitBusy); }
function sitrep() {
  const r = $("#sitIn").value.trim() || "Świat"; beep(1000, .06);
  if (sitCtl) sitCtl.abort(); sitCtl = new AbortController(); sitBusy = true; sitText = "";
  const t = new Date(), op = opCall();
  $("#sitTitle").textContent = "> SITREP · " + r.toUpperCase();
  $("#sitMeta").textContent = `${t.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}${op ? " · dla " + op : ""} · rdzeń: ${(STATUS && STATUS.engine && STATUS.engine.model) || "brak AI"}`;
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
  try { await navigator.clipboard.writeText(txt); $("#sitCopy").textContent = "SKOPIOWANO"; } catch (e) { $("#sitCopy").textContent = "BŁĄD SCHOWKA"; }
  beep(1400, .05); setTimeout(() => $("#sitCopy").textContent = "KOPIUJ", 1500);
});
$("#sitSpeak").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) return;
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance($("#sitOut").textContent), v = plVoice(); u.lang = "pl-PL"; if (v) u.voice = v; u.rate = .95; u.pitch = .85;
  u.onstart = () => $("#sitSpeak").textContent = "STOP"; u.onend = u.onerror = () => $("#sitSpeak").textContent = "CZYTAJ";
  speechSynthesis.cancel(); speechSynthesis.speak(u);
});
$("#sitPrint").addEventListener("click", () => { document.body.classList.add("print-sit"); window.print(); setTimeout(() => document.body.classList.remove("print-sit"), 500); });
$("#sitIn").addEventListener("keydown", e => { if (e.key === "Enter") sitrep(); });

/* ------------------------------------------------------------ BRIEFING GŁOSOWY */
let speaking = false;
function plVoice() { return speechSynthesis.getVoices().find(x => /^pl/i.test(x.lang)) || null; }
$("#speakBtn").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) { $("#speakBtn").textContent = "BRAK SYNTEZY MOWY"; return; }
  if (speaking) { speechSynthesis.cancel(); return; }
  const u = new SpeechSynthesisUtterance(S.briefing || "Brak briefingu. Uruchom analizę lokalnego AI."), v = plVoice();
  u.lang = "pl-PL"; if (v) u.voice = v; u.rate = .95; u.pitch = .85;
  u.onstart = () => { speaking = true; $("#speakBtn").setAttribute("aria-pressed", "true"); $("#speakBtn").textContent = "ZATRZYMAJ ODCZYT"; };
  u.onend = u.onerror = () => { speaking = false; $("#speakBtn").setAttribute("aria-pressed", "false"); $("#speakBtn").textContent = v ? "ODCZYTAJ BRIEFING" : "ODCZYTAJ (BRAK GŁOSU PL)"; };
  beep(800, .1); speechSynthesis.cancel(); speechSynthesis.speak(u);
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
  $("#day").innerHTML = `<option value="">BIEŻĄCY</option>` + list.slice().reverse().map(n => { const m = n.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/); return `<option value="${n}">${m ? `${m[3]}.${m[2]} ${m[4]}:${m[5]}` : n}</option>`; }).join("");
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
  $("#foot").innerHTML = `Odczyt: ${esc(S.stamp ? new Date(S.stamp).toLocaleString("pl-PL") : "—")}. Online: wiadomości RSS, 16 feedów automatycznych (PortWatch, IODA, ADS-B, GDACS, CISA, FIRMS, Launch Library, NBP, GPSJam, WHO, NHC, ostrzeżenia podróżne, OFAC, ReliefWeb, Polymarket, CelesTrak), USGS, AMSAT oraz ceny rynkowe na żywo. Analiza, tłumaczenia, fronty, moduły i scenariusze: lokalny model AI${S.model ? " (" + esc(S.model) + ")" : ""}. Linie frontów, pozycje sił i punkty uderzeń są przybliżone. Poziom napięcia, stan szlaków, łańcuch przyczyn i scenariusze to oceny systemu, nie oficjalne wskaźniki.`;
}
function renderPanels() {
  renderRail(); renderChanges(); tabs(); renderFeed(); renderReg(); renderShip(); renderCal(); renderTrend(); renderMarkets();
  renderFronts(); renderAirwar(); renderStrikes(); renderForces(); renderEF(); renderSky(); renderPM(); renderNuke(); renderSanc(); renderKev(); renderHum(); renderNet(); renderTrv(); renderHaz(); renderLaunch(); renderSrc(); renderFoot();
}
function renderAll() { renderPanels(); buildMap(); buildChain(); setView(view); if (selected) pick(selected, true); else idleDetail(); }
async function loadState(keepSel) {
  try { CURRENT = await api("/api/state"); } catch (e) { $("#foot").textContent = "Nie można połączyć się z serwerem KRONOS-7. Uruchom start.bat."; return; }
  const before = (S && S.threat && S.threat.level) || 0, after = (CURRENT.threat && CURRENT.threat.level) || 0;
  if (!ARCH) { S = CURRENT; if (!keepSel) selected = null; fillArchive(); renderAll(); } else fillArchive();
  if (keepSel && after > before && before > 0) alarmBurst(after >= 4 ? 4 : 2);
}

/* ------------------------------------------------------------ OPERATOR */
let SET = null;
const opCall = () => (SET && SET.callsign) || "";
function renderOp() { $("#opName").textContent = opCall() || "NIEZNANY"; }
async function loadSettings() { try { SET = await api("/api/settings"); } catch (e) { SET = { callsign: "", configured: false }; } renderOp(); return SET; }
async function saveSettings(body) {
  try { const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json());
    if (r.settings) { SET = r.settings; renderOp(); } return r; } catch (e) { return { ok: false, error: "Brak połączenia z serwerem." }; }
}
let lastFocus = null;
async function openSettings() {
  beep(900); lastFocus = document.activeElement; await loadSettings();
  $("#setCall").value = SET.callsign || ""; $("#setName").value = SET.name || "";
  const t = A(SET.refresh_times); ["#setT1", "#setT2", "#setT3"].forEach((s2, i) => $(s2).value = t[i] || "");
  $("#setModel").innerHTML = [`<option value="auto">AUTOMATYCZNIE (zalecany: ${esc(SET.recommended || "?")})</option>`].concat(A(SET.installed).map(m => `<option value="${esc(m)}">${esc(m)}</option>`)).join("");
  $("#setModel").value = A(SET.installed).includes(SET.model) ? SET.model : "auto";
  $("#setPull").checked = !!SET.auto_pull; $("#setMsg").textContent = "";
  $("#setVol").value = Math.round(SND.vol * 100); $("#setHum").checked = SND.hum; $("#setChat").checked = SND.chatter;
  $("#settings").hidden = false; $("#setCall").focus();
}
function closeSettings() { $("#settings").hidden = true; if (lastFocus) lastFocus.focus(); }
$("#setBtn").addEventListener("click", openSettings);
$("#setClose").addEventListener("click", closeSettings);
$("#settings").addEventListener("click", e => { if (e.target.id === "settings") closeSettings(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#settings").hidden) closeSettings(); });
function applySound() {
  SND.vol = +$("#setVol").value / 100; SND.hum = $("#setHum").checked; SND.chatter = $("#setChat").checked; store.set("sound", SND);
  if (master) master.gain.setTargetAtTime(SND.vol, actx.currentTime, .05);
  if (SND.hum && audioOn && !humNodes) hum(true); else if (!SND.hum && humNodes) hum(false);
}
$("#setVol").addEventListener("input", () => { applySound(); beep(1200, .06); });
$("#setHum").addEventListener("change", applySound);
$("#setChat").addEventListener("change", () => { applySound(); chatter(30); });
$("#setForm").addEventListener("submit", async e => {
  e.preventDefault(); applySound();
  const r = await saveSettings({ callsign: $("#setCall").value, name: $("#setName").value, model: $("#setModel").value, auto_pull: $("#setPull").checked,
    refresh_times: ["#setT1", "#setT2", "#setT3"].map(s2 => $(s2).value).filter(Boolean) });
  if (r.ok) { beep(1400, .08); $("#setMsg").textContent = "Zapisano."; pollStatus(); setTimeout(closeSettings, 600); }
  else { beep(300, .2, "sawtooth"); $("#setMsg").textContent = r.error || "Nie udało się zapisać."; }
});

/* ------------------------------------------------------------ START */
function boot(done) {
  const needSetup = !(SET && SET.configured);
  let seen = false; try { seen = sessionStorage.getItem("k7-boot") === "1"; } catch (e) { seen = true; }
  if (!needSetup && (seen || reduce)) return done();
  const B = $("#boot"); B.hidden = false; const e = STATUS ? STATUS.engine : null, C = CURRENT || {};
  const lines = ["KRONOS-7 PLANETARY INTELLIGENCE · v3.4", "TEST PAMIĘCI ........ OK",
    "PROCESOR GRAFICZNY .. " + (e ? e.hardware.gpu_name + (e.hardware.vram_gb ? " / " + e.hardware.vram_gb + " GB" : "") : "?"),
    "RDZEŃ ANALITYCZNY ... " + (e && e.model ? e.model.toUpperCase() : "NIEAKTYWNY"),
    "BAZA KONFLIKTÓW ..... " + A(C.conflicts).length + " WĘZŁÓW", "FRONTY .............. " + A(C.fronts).length + " TEATRÓW",
    "FEEDY ............... " + A((C.feeds || {}).status).filter(s => s.ok).length + "/" + A((C.feeds || {}).status).length + " OK",
    "ŁĄCZE ORBITALNE ..... " + (A(C.tle).length + A((C.feeds || {}).celestrak).length) + " OBIEKTÓW", ""];
  let i = 0, stop = false; const T2 = $("#bootText"), Lg = $("#bootLogin"); powerUp();
  const finish = () => { if (stop) return; stop = true; B.hidden = true; try { sessionStorage.setItem("k7-boot", "1"); } catch (e) {} done(); };
  const greet = () => { const n = SET && (SET.name || SET.callsign); Lg.innerHTML = `IDENTYFIKATOR OPERATORA: ${esc(opCall())}<br>DOSTĘP PRZYZNANY · WITAJ${n ? ", " + esc(n.toUpperCase()) : ", OPERATORZE"}`; setTimeout(finish, 900); };
  if (!needSetup) {
    $("#bootSkip").addEventListener("click", finish);
    document.addEventListener("keydown", function k(ev) { if (ev.key === "Escape") { finish(); document.removeEventListener("keydown", k); } });
  } else $("#bootSkip").hidden = true;
  const login = () => {
    if (needSetup) {
      Lg.textContent = "BRAK ZAREJESTROWANEGO OPERATORA."; const f = $("#bootSetup"); f.hidden = false; $("#bootCall").focus();
      f.addEventListener("submit", async ev => { ev.preventDefault(); const r = await saveSettings({ callsign: $("#bootCall").value });
        if (r.ok) { f.hidden = true; beep(1400, .08); greet(); } else { beep(300, .2, "sawtooth"); $("#bootMsg").textContent = r.error || "Nie udało się zapisać."; } });
      return;
    }
    const id = opCall(); let j = 0; Lg.innerHTML = 'IDENTYFIKATOR OPERATORA: <span id="lg"></span><span class="cursor"></span>';
    (function type() { if (stop) return; if (j < id.length) { $("#lg").textContent += id[j++]; noise(.012, .05, 0, 2500); tone(2400, .01, "square", .015); setTimeout(type, 110); return; } setTimeout(() => { if (!stop) greet(); }, 300); })();
  };
  (function line() { if (stop) return; if (i < lines.length && !reduce) { chatter(lines[i].length); T2.textContent += lines[i++] + "\n"; setTimeout(line, 150); return; } if (reduce) T2.textContent = lines.join("\n"); login(); })();
}

/* odczyt ma wysokość mapy (na szerokim ekranie) */
if (window.ResizeObserver) new ResizeObserver(() => { const h = $("#map").getBoundingClientRect().height; $("#detail").style.maxHeight = innerWidth > 1060 && h > 200 ? Math.round(h) + "px" : ""; }).observe($("#mapbox"));

(async function init() {
  setMode(mode);
  try { STATUS = await api("/api/status"); } catch (e) {}
  await loadSettings();
  await loadState();
  pollAir();
  renderSys(); renderSrc();
  if (mode === "flat") setTheater(theater || "world", false);
  loadMarkets(); setInterval(loadMarkets, 5 * 60 * 1000);
  pollStatus();
  setInterval(() => { if (satrecs.length) drawSats(); if (selected && selected.startsWith("s:")) pick(selected, true); }, 5000);
  setInterval(() => { updNight(); if (nightGeo) { pNight.attr("d", path(nightGeo)); pTwi.attr("d", path(nightGeo)); } }, 60000);
  boot(() => {});
})();
})();
