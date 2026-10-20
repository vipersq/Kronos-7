/* KRONOS-7 – wtyczka Stream Deck.
   Łączy się z lokalnym serwerem KRONOS-a (domyślnie http://127.0.0.1:7707):
   – co sekundę czyta /api/deck (poziom napięcia, analiza AI, samoloty, statki, stan mapy),
   – przyciskami wysyła polecenia przez /api/cmd, które wykonuje otwarty terminal w przeglądarce.
   Napisana na „gołym” protokole WebSocket Stream Decka, bez SDK – jedyną zależnością jest ws. */
"use strict";
const WebSocket = require("ws");

const P = "com.vipersq.kronos7.";
const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const PORT = arg("-port"), UUID = arg("-pluginUUID"), REG = arg("-registerEvent");

const C = { phos: "#7dff9a", dim: "#3f8f55", faint: "#16331f", amber: "#ffb347", red: "#ff4b4b", cyan: "#6fe4ff", violet: "#c48cff", white: "#e8ffe8", void: "#050805" };
const THEATERS = [["world", "ŚWIAT", "WORLD"], ["ua", "UKRAINA", "UKRAINE"], ["bs", "M. CZARNE", "BLACK SEA"], ["ef", "FLANKA NATO", "NATO FLANK"], ["me", "BLISKI WSCHÓD", "MIDDLE EAST"],
  ["hz", "ORMUZ", "HORMUZ"], ["ye", "JEMEN", "YEMEN"], ["lev", "LEWANT", "LEVANT"], ["sd", "SUDAN", "SUDAN"], ["cd", "KONGO", "CONGO"], ["mm", "MJANMA", "MYANMAR"],
  ["tw", "TAJWAN", "TAIWAN"], ["wp", "ZACH. PACYFIK", "W. PACIFIC"]];
const LAYERS = { conf: ["KONFLIKTY", "CONFLICTS"], front: ["FRONTY", "FRONTS"], move: ["NATARCIA", "ADVANCES"], strike: ["UDERZENIA", "STRIKES"], force: ["SIŁY", "FORCES"],
  ship: ["ŻEGLUGA", "SHIPPING"], haz: ["NATURA", "NATURE"], sat: ["ORBITY", "ORBITS"], air: ["LOTNICTWO", "AIRCRAFT"], vessel: ["STATKI", "SHIPS"], cable: ["KABLE", "CABLES"],
  flank: ["FLANKA", "FLANK"], nuke: ["ATOM", "NUCLEAR"], asp: ["PRZESTRZEŃ", "AIRSPACE"], gps: ["GNSS", "GNSS"], fire: ["POŻARY", "FIRES"], net: ["SIEĆ", "NETWORK"],
  hum: ["HUMANIT.", "HUMANIT."], cyber: ["CYBER", "CYBER"], news: ["DEPESZE", "REPORTS"], night: ["NOC", "NIGHT"] };
const COUNTERS = { "air.n": ["SAMOLOTY", "AIRCRAFT", "air"], "air.isr": ["ROZPOZN.", "RECON", "air"], "air.tanker": ["TANKOWCE", "TANKERS", "air"], "air.bomber": ["BOMBOWCE", "BOMBERS", "air"],
  "air.loiter": ["KRĄŻĄ", "LOITER", "air"], "sea.n": ["STATKI", "SHIPS", "sea"], "sea.mil": ["OKRĘTY", "WARSHIPS", "sea"], "sea.sanc": ["SANKCJE", "SANCTIONS", "sea"],
  "sea.dark": ["CIEMNE", "DARK", "sea"], "sea.sts": ["STS", "STS", "sea"], "sea.cable": ["NAD KABLEM", "ON CABLE", "sea"],
  "inc.n24": ["INCYDENTY 24H", "INCIDENTS 24H", "inc"], "inc.hi24": ["POWAŻNE 24H", "SERIOUS 24H", "inc"], "ua.n": ["ALARMY UA", "UA ALERTS", "ua"] };
const CMDS = { briefing: ["BRIEFING", "BRIEFING"], sitrep: ["SITREP", "SITREP"], ask: ["PYTANIE", "QUESTION"], stop: ["STOP", "STOP"], globe: ["GLOBUS", "GLOBE"],
  autozoom: ["AUTO-ZOOM", "AUTO-ZOOM"], alert: ["PRIORYTET", "PRIORITY"], audio: ["AUDIO", "AUDIO"], voice: ["GŁOS", "VOICE"], "replay:toggle": ["ODTWÓRZ", "REPLAY"],
  "replay:play": ["▶ / ❚❚", "▶ / ❚❚"], "replay:live": ["NA ŻYWO", "LIVE"], "zoom:1": ["ZOOM +", "ZOOM +"], "zoom:-1": ["ZOOM −", "ZOOM −"], "zoom:reset": ["ŚWIAT", "WORLD"],
  "view:chain": ["ŁAŃCUCH", "CHAIN"], "view:map": ["MAPA", "MAP"], "event:": ["KONTAKT", "CONTACT"], refresh: ["ANALIZA", "ANALYSIS"], report: ["RAPORT", "REPORT"], open: ["TERMINAL", "TERMINAL"] };

let ws = null, G = { url: "http://127.0.0.1:7707" }, D = null, online = false, lastOk = 0, polling = null;
const ctx = new Map();                 // context -> { action, settings, controller, last, seen, sel }
const en = () => D && D.lang === "en";
const L = (pl, eng) => en() ? eng : pl;
const base = () => String(G.url || "http://127.0.0.1:7707").replace(/\/+$/, "");
const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

/* ------------------------------------------------ rysowanie klawiszy (SVG 144×144) */
const X = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const FONT = "Consolas, 'Cascadia Mono', 'Courier New', monospace";
const fit = (txt, max, w = 132) => Math.max(12, Math.min(max, Math.floor(w / (Math.max(1, [...String(txt)].length) * 0.6))));
function keySvg({ top = "", big = "", sub = "", col = C.phos, bg = C.void, frame = null, bar = null, glow = false }) {
  const fr = frame || col;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
    + `<defs><pattern id="sl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".35"/></pattern></defs>`
    + `<rect width="144" height="144" fill="${bg}"/>`
    + `<rect x="3" y="3" width="138" height="138" fill="none" stroke="${fr}" stroke-width="3" opacity="${glow ? 1 : .55}"/>`;
  if (top) s += `<text x="72" y="30" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fit(top, 21)}" fill="${col}" opacity=".8" letter-spacing="1">${X(top)}</text>`;
  if (big !== "") s += `<text x="72" y="${sub ? 90 : 96}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${fit(big, 50)}" fill="${col}">${X(big)}</text>`;
  if (sub) s += `<text x="72" y="124" text-anchor="middle" font-family="${FONT}" font-size="${fit(sub, 19)}" fill="${col}" opacity=".85">${X(sub)}</text>`;
  if (bar != null) s += `<rect x="14" y="131" width="116" height="5" fill="${C.faint}"/><rect x="14" y="131" width="${Math.round(116 * Math.max(0, Math.min(1, bar)))}" height="5" fill="${col}"/>`;
  return s + `<rect width="144" height="144" fill="url(#sl)"/></svg>`;
}
function setImage(c, svg) {
  const k = ctx.get(c); if (!k || k.last === svg) return; k.last = svg;
  send({ event: "setImage", context: c, payload: { image: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"), target: 0 } });
}
function setFeedback(c, fb) {
  const k = ctx.get(c); const j = JSON.stringify(fb); if (!k || k.last === j) return; k.last = j;
  send({ event: "setFeedback", context: c, payload: fb });
}

/* ------------------------------------------------ dane z serwera */
const fmtCd = ms => { if (ms <= 0) return L("ZARAZ", "SOON"); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`; };
const hm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const ui = () => (D && D.ui) || {};
const uiFresh = () => D && D.ui && D.ui.age < 40;
const offline = () => keySvg({ top: "KRONOS-7", big: "OFF", sub: L("brak serwera", "no server"), col: C.red, frame: C.red });

function render(c) {
  const k = ctx.get(c); if (!k) return;
  const a = k.action.slice(P.length), st = k.settings || {};
  if (k.controller === "Encoder") return renderDial(c, k, st);
  if (!online || !D) return setImage(c, offline());
  const U = ui(), now = Date.now();
  if (a === "status") {
    const lv = D.threat.level, col = lv >= 4 ? C.red : lv === 3 ? C.amber : C.phos;
    return setImage(c, keySvg({ top: L("NAPIĘCIE", "TENSION"), big: lv == null ? "–" : `${lv}/5`, sub: D.threat.label || "", col, glow: lv >= 4, bg: lv >= 5 && now % 2000 < 1000 ? "#2a0606" : C.void }));
  }
  if (a === "analysis") {
    const j = D.job;
    if (j.running) return setImage(c, keySvg({ top: j.pull ? L("MODEL AI", "AI MODEL") : L("ANALIZA AI", "AI ANALYSIS"), big: `${j.pct || 0}%`, sub: L("GPU ZAJĘTE", "GPU BUSY"), col: C.amber, glow: true, bar: (j.pct || 0) / 100 }));
    const ms = D.next ? new Date(D.next) - now : null;
    return setImage(c, keySvg({ top: L("ANALIZA ZA", "ANALYSIS IN"), big: ms == null ? "—" : fmtCd(ms), sub: D.next ? hm(D.next) : "", col: ms != null && ms < 600e3 ? C.amber : C.phos }));
  }
  if (a === "theater") {
    const id = st.theater || "world", t = THEATERS.find(x => x[0] === id) || THEATERS[0], on = U.theater === id && U.view !== "chain";
    return setImage(c, keySvg({ top: L("TEATR", "THEATRE"), big: en() ? t[2] : t[1], col: on ? C.void : C.phos, bg: on ? C.phos : C.void, frame: C.phos, glow: on }));
  }
  if (a === "layer") {
    const id = st.layer || "vessel", n = LAYERS[id] || [id, id], on = U.layers ? !!U.layers[id] : null;
    return setImage(c, keySvg({ top: L("WARSTWA", "LAYER"), big: en() ? n[1] : n[0], sub: on == null ? "?" : on ? L("WŁ.", "ON") : L("WYŁ.", "OFF"), col: on ? C.void : C.dim, bg: on ? C.phos : C.void, frame: on ? C.phos : C.dim }));
  }
  if (a === "counter") {
    const key = st.metric || "air.n", m = COUNTERS[key] || COUNTERS["air.n"], [grp, f] = key.split("."), val = (D[grp] || {})[f];
    const ev = (D[grp] || {}).ev, fresh = ev && ev.at > (k.seen || 0) && now - ev.at < 30 * 60e3, warn = ["sanc", "dark", "sts", "cable", "loiter", "n24", "hi24"].includes(f) && val > 0 || (grp === "ua" && val > 0);
    const blink = fresh && now % 1400 < 700;
    return setImage(c, keySvg({ top: en() ? m[1] : m[0], big: val == null ? "–" : val > 9999 ? Math.round(val / 1000) + "k" : String(val),
      sub: fresh ? L("NOWY KONTAKT", "NEW CONTACT") : ev ? hm(ev.at) : "", col: warn || fresh ? C.amber : C.cyan, bg: blink ? "#2a1a04" : C.void, glow: fresh }));
  }
  if (a === "pass") {
    const p = U.pass;
    if (!p) return setImage(c, keySvg({ top: L("PRZELOT", "PASS"), big: "—", sub: L("brak", "none"), col: C.dim }));
    const inPass = now >= p.aos && now < p.los, ms = (inPass ? p.los : p.aos) - now;
    return setImage(c, keySvg({ top: String(p.name || "").slice(0, 12), big: inPass ? L("TERAZ", "NOW") : fmtCd(ms), sub: `${inPass ? "LOS " + hm(p.los) : "AOS " + hm(p.aos)} ${p.maxEl}°`, col: inPass ? C.void : p.vis ? C.white : C.cyan, bg: inPass ? C.cyan : C.void, glow: inPass || ms < 300e3 }));
  }
  if (a === "command") {
    const cmd = st.cmd || "briefing", n = CMDS[cmd] || [cmd, cmd];
    let on = null;
    if (cmd === "globe") on = U.mode === "globe"; else if (cmd === "autozoom") on = U.autoz; else if (cmd === "alert") on = U.alert; else if (cmd === "audio") on = U.audio;
    else if (cmd === "replay:toggle" || cmd === "replay:play") on = U.replay && (cmd === "replay:play" ? U.replay.playing : U.replay.on);
    else if (cmd === "view:chain") on = U.view === "chain";
    const label = st.label || (en() ? n[1] : n[0]), sub = cmd === "sitrep" || cmd === "ask" ? (st.arg || (cmd === "sitrep" ? L("świat", "world") : "")) : on == null ? "" : on ? L("WŁ.", "ON") : L("WYŁ.", "OFF");
    const red = cmd === "alert" && on;
    if (cmd === "refresh" && D.job.running) return setImage(c, keySvg({ top: L("ANALIZA", "ANALYSIS"), big: `${D.job.pct || 0}%`, col: C.amber, bar: (D.job.pct || 0) / 100 }));
    if ((cmd === "replay:toggle" || cmd === "replay:play") && U.replay && U.replay.on && U.replay.t) return setImage(c, keySvg({ top: label, big: hm(U.replay.t), sub: U.replay.playing ? "▶" : "❚❚", col: C.void, bg: C.amber, frame: C.amber }));
    return setImage(c, keySvg({ top: "KRONOS", big: label, sub, col: on ? C.void : red ? C.red : C.phos, bg: on ? (red ? C.red : C.phos) : C.void, frame: red ? C.red : C.phos, glow: !!on }));
  }
}
function renderDial(c, k, st) {
  const mode = st.dial || "zoom", U = ui();
  if (!online || !D) return setFeedback(c, { title: "KRONOS-7", value: L("brak serwera", "no server"), indicator: { value: 0 } });
  if (mode === "replay") {
    const r = U.replay || {};
    if (!r.on) return setFeedback(c, { title: L("ODTWARZANIE", "REPLAY"), value: L("na żywo", "live"), indicator: { value: 100 } });
    const pct = r.to > r.from ? Math.round((r.t - r.from) / (r.to - r.from) * 100) : 0;
    return setFeedback(c, { title: (r.playing ? "▶ " : "❚❚ ") + L("ODTWARZANIE", "REPLAY"), value: hm(r.t), indicator: { value: pct } });
  }
  if (mode === "theater") {
    const i = k.sel ?? Math.max(0, THEATERS.findIndex(t => t[0] === U.theater)), t = THEATERS[i] || THEATERS[0];
    return setFeedback(c, { title: L("TEATR", "THEATRE") + (U.theater === t[0] ? " ✓" : ""), value: en() ? t[2] : t[1], indicator: { value: Math.round(i / (THEATERS.length - 1) * 100) } });
  }
  const t = THEATERS.find(x => x[0] === U.theater);
  return setFeedback(c, { title: U.mode === "globe" ? L("GLOBUS", "GLOBE") : "ZOOM", value: t ? (en() ? t[2] : t[1]) : L("własny widok", "custom view"), indicator: { value: U.mode === "globe" ? 50 : 0 } });
}
const renderAll = () => { for (const c of ctx.keys()) render(c); };

async function poll() {
  try {
    const r = await fetch(base() + "/api/deck", { signal: AbortSignal.timeout(2500) });
    D = await r.json(); online = true; lastOk = Date.now();
  } catch (e) { if (Date.now() - lastOk > 5000) { online = false; } }
  renderAll();
}
function startPoll() { if (!polling) { poll(); polling = setInterval(poll, 1000); } }
function stopPoll() { if (polling && !ctx.size) { clearInterval(polling); polling = null; } }

/* ------------------------------------------------ polecenia */
async function cmd(c, d, a = "", quiet = false) {
  try {
    const r = await fetch(base() + "/api/cmd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ do: d, arg: a }), signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    if (!j.ok || (j.terminal === false && d !== "refresh")) { send({ event: "showAlert", context: c }); return false; }
    if (!quiet) send({ event: "showOk", context: c });
    setTimeout(poll, 250); return true;
  } catch (e) { send({ event: "showAlert", context: c }); return false; }
}
const openUrl = path => send({ event: "openUrl", payload: { url: base() + path } });

function keyDown(c) {
  const k = ctx.get(c); if (!k) return; const a = k.action.slice(P.length), st = k.settings || {};
  if (a === "status") return openUrl("/");
  if (a === "analysis") return D && D.job.running ? send({ event: "showAlert", context: c }) : cmd(c, "refresh");
  if (a === "theater") return cmd(c, "theater", st.theater || "world", true);
  if (a === "layer") return cmd(c, "layer", st.layer || "vessel", true);
  if (a === "counter") { k.seen = Date.now(); return cmd(c, "event", (st.metric || "air.n").split(".")[0], true); }
  if (a === "pass") { const p = ui().pass; return p ? cmd(c, "sat", String(p.norad), true) : send({ event: "showAlert", context: c }); }
  if (a === "command") {
    const x = st.cmd || "briefing";
    if (x === "report") return openUrl("/report");
    if (x === "open") return openUrl("/");
    if (x === "refresh") return cmd(c, "refresh");
    const [d, v] = x.includes(":") ? x.split(":") : [x, ""];
    if (d === "sitrep" || d === "ask") return cmd(c, d, st.arg || "");
    return cmd(c, d, v, true);
  }
}
function dial(c, kind, ticks = 0) {
  const k = ctx.get(c); if (!k) return; const mode = (k.settings || {}).dial || "zoom", U = ui();
  if (mode === "zoom") {
    if (kind === "rotate") return cmd(c, "zoom", String(ticks), true);
    if (kind === "push") return cmd(c, "zoom", "reset", true);
    if (kind === "touch") return cmd(c, "globe", "", true);
  }
  if (mode === "replay") {
    const step = +(k.settings.step || 5);
    if (kind === "rotate") return cmd(c, "replay", String(ticks * step), true);
    if (kind === "push") return cmd(c, "replay", "play", true);
    if (kind === "touch") return cmd(c, "replay", "toggle", true);
  }
  if (mode === "theater") {
    const cur = k.sel ?? Math.max(0, THEATERS.findIndex(t => t[0] === U.theater));
    if (kind === "rotate") { k.sel = (cur + ticks + THEATERS.length * 10) % THEATERS.length; k.last = null; return render(c); }
    if (kind === "push") { k.sel = cur; return cmd(c, "theater", THEATERS[cur][0], true); }
    if (kind === "touch") { k.sel = 0; return cmd(c, "theater", "world", true); }
  }
}

/* ------------------------------------------------ protokół Stream Decka */
function connect() {
  ws = new WebSocket("ws://127.0.0.1:" + PORT);
  ws.on("open", () => { send({ event: REG, uuid: UUID }); send({ event: "getGlobalSettings", context: UUID }); });
  ws.on("close", () => process.exit(0));
  ws.on("message", raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const c = m.context, p = m.payload || {};
    switch (m.event) {
      case "willAppear": ctx.set(c, { action: m.action, settings: p.settings || {}, controller: p.controller, last: null, seen: Date.now() }); startPoll(); render(c); break;
      case "willDisappear": ctx.delete(c); stopPoll(); break;
      case "didReceiveSettings": { const k = ctx.get(c); if (k) { k.settings = p.settings || {}; k.last = null; k.sel = undefined; render(c); } break; }
      case "didReceiveGlobalSettings": G = Object.assign({ url: "http://127.0.0.1:7707" }, p.settings || {}); poll(); break;
      case "keyDown": keyDown(c); break;
      case "dialRotate": dial(c, "rotate", p.ticks || 0); break;
      case "dialDown": dial(c, "push"); break;
      case "touchTap": dial(c, "touch"); break;
      case "systemDidWakeUp": poll(); break;
      case "sendToPlugin":
        if (p.test != null) {
          const u = String(p.test || base()).replace(/\/+$/, "");
          fetch(u + "/api/deck", { signal: AbortSignal.timeout(3000) }).then(r => r.json())
            .then(d => send({ event: "sendToPropertyInspector", action: m.action, context: c, payload: { test: true, ok: true, ui: d.ui && d.ui.age < 40, level: d.threat && d.threat.level } }))
            .catch(e => send({ event: "sendToPropertyInspector", action: m.action, context: c, payload: { test: true, ok: false, err: String(e.message || e) } }));
        }
        break;
    }
  });
}
if (PORT && UUID && REG) connect();
module.exports = { keySvg, THEATERS, LAYERS, COUNTERS, CMDS };   // do testów
