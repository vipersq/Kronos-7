/* KRONOS-7 widget for CORSAIR XENEON EDGE.
   Reads the local KRONOS-7 server (http://127.0.0.1:7707/api/edge) and shows events, live contacts, news and source status.
   Touching an event shows it on the KRONOS-7 map (/api/edge/go). Nothing leaves this computer. */

var T = {
  pl: {
    connecting: "ŁĄCZENIE Z KRONOS-7…", noconn: "BRAK POŁĄCZENIA Z KRONOS-7",
    noconnSub: "Uruchom KRONOS-7 (start.bat). Widżet łączy się z 127.0.0.1:{p}.", online: "NA ŻYWO", offline: "OFFLINE",
    events: "ALARMY I ZDARZENIA", contacts: "KONTAKTY NA ŻYWO", news: "DEPESZE", none: "BRAK AKTYWNYCH ALARMÓW",
    noneSub: "Ostatnie dane: {t}", noOther: "Nic więcej w ostatnim czasie.",
    k: { corr: "ZDARZENIE ZŁOŻONE", ua: "ALARM · UKRAINA", il: "ALARM · IZRAEL", marsec: "INCYDENT MORSKI", air: "LOTNICTWO", sea: "STATKI" },
    sev: "WAGA", ago: "temu", now: "teraz", m: "min", h: "h", d: "d",
    c: { air: "SAMOLOTY", isr: "ROZPOZNANIE", tanker: "TANKOWCE", bomber: "BOMBOWCE", loiter: "KRĄŻĄCE", sea: "STATKI", mil: "OKRĘTY", sanc: "SANKCJE", dark: "„CIEMNE”", sts: "STS", cable: "NAD KABLEM", inc: "INCYDENTY 24 H" },
    chUa: "UA", chIl: "IL", chCorr: "ZŁOŻONE",
    src: "ŹRÓDŁA", ok: "OK", err: "z błędem", test: "test",
    an: "▶ ANALIZA", anArm: "DOTKNIJ PONOWNIE", anRun: "ANALIZA", sent: "pokazuję w KRONOS-7"
  },
  en: {
    connecting: "CONNECTING TO KRONOS-7…", noconn: "NO CONNECTION TO KRONOS-7",
    noconnSub: "Start KRONOS-7 (start.bat). The widget connects to 127.0.0.1:{p}.", online: "LIVE", offline: "OFFLINE",
    events: "ALERTS AND EVENTS", contacts: "LIVE CONTACTS", news: "NEWS", none: "NO ACTIVE ALERTS",
    noneSub: "Last data: {t}", noOther: "Nothing else recently.",
    k: { corr: "COMPOUND EVENT", ua: "ALERT · UKRAINE", il: "ALERT · ISRAEL", marsec: "MARITIME INCIDENT", air: "AVIATION", sea: "SHIPS" },
    sev: "SEVERITY", ago: "ago", now: "now", m: "min", h: "h", d: "d",
    c: { air: "AIRCRAFT", isr: "RECON", tanker: "TANKERS", bomber: "BOMBERS", loiter: "ORBITING", sea: "SHIPS", mil: "WARSHIPS", sanc: "SANCTIONED", dark: "“DARK”", sts: "STS", cable: "OVER CABLE", inc: "INCIDENTS 24 H" },
    chUa: "UA", chIl: "IL", chCorr: "COMPOUND",
    src: "SOURCES", ok: "OK", err: "with errors", test: "test",
    an: "▶ ANALYSIS", anArm: "TAP AGAIN", anRun: "ANALYSIS", sent: "showing in KRONOS-7"
  }
};

var S = { data: null, lang: "pl", lastOk: 0, base: null, timer: null, armed: 0, fails: 0 };

function $(id) { return document.getElementById(id); }
function L() { return T[S.lang] || T.pl; }

function getIcueProperty(name) {
  if (typeof window !== "undefined" && Object.prototype.hasOwnProperty.call(window, name)) {
    var v = window[name];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  try {
    var v2 = Function("return typeof " + name + " !== 'undefined' ? " + name + " : undefined")();
    if (v2 !== undefined && v2 !== null && v2 !== "") return v2;
  } catch (e) {}
  return undefined;
}
function prop(name, def) { var v = getIcueProperty(name); return v === undefined ? def : v; }
function clampRange(v, min, max, d) { v = Number(v); if (!isFinite(v)) return d; return Math.max(min, Math.min(max, v)); }
function port() { var p = String(prop("serverPort", "7707")).replace(/[^0-9]/g, ""); return p && +p > 0 && +p < 65536 ? p : "7707"; }

function applyStyles() {
  var r = document.documentElement;
  r.style.setProperty("--text-color", prop("textColor", "#9dffb8"));
  r.style.setProperty("--accent-color", prop("accentColor", "#ffb347"));
  r.style.setProperty("--bg-color", prop("backgroundColor", "#050805"));
  r.style.setProperty("--bg-opacity", clampRange(prop("transparency", 100), 0, 100, 100) / 100);
  $("root").classList.toggle("noscan", prop("scanlines", true) === false);
}

/* ---------------------------------------------------------------- data */
function fetchJson(path) {
  var p = port();
  var bases = S.base ? [S.base] : ["http://127.0.0.1:" + p, "http://localhost:" + p];
  var i = 0;
  function next() {
    var b = bases[i++];
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(b + path, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(to); if (!r.ok) throw new Error("HTTP " + r.status); S.base = b; return r.json(); })
      .catch(function (e) { clearTimeout(to); if (i < bases.length) return next(); S.base = null; throw e; });
  }
  return next();
}

function poll() {
  clearTimeout(S.timer);
  var gen = S.gen = (S.gen || 0) + 1;
  fetchJson("/api/edge").then(function (d) {
    if (gen !== S.gen) return;
    S.data = d; S.lastOk = Date.now(); S.fails = 0; S.lang = d.lang === "en" ? "en" : "pl";
    render();
  }).catch(function () {
    if (gen !== S.gen) return;
    S.fails++;
    render();
  }).then(function () {
    if (gen !== S.gen) return;
    var sec = clampRange(prop("refreshSec", 10), 5, 60, 10);
    S.timer = setTimeout(poll, (S.fails > 3 ? Math.max(sec, 20) : sec) * 1000);
  });
}

function go(id, el) {
  if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  fetchJson("/api/edge/go?id=" + encodeURIComponent(id)).catch(function () {});
}

/* ---------------------------------------------------------------- render helpers */
function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function age(t) {
  if (!t) return "";
  var s = Math.max(0, (Date.now() - t) / 1000), x = L();
  if (s < 60) return x.now;
  if (s < 3600) return Math.round(s / 60) + " " + x.m;
  if (s < 86400) return Math.round(s / 3600) + " " + x.h;
  return Math.round(s / 86400) + " " + x.d;
}
function hm(t) { var d = new Date(t); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
function sevColor(e) {
  var s = e.sev || 1;
  if (e.k === "ua" || e.k === "il" || s >= 4) return "var(--red)";
  if (s >= 3) return "var(--accent-color)";
  if (e.k === "air" || e.k === "sea") return "var(--cyan)";
  return "var(--text-color)";
}
function pickHero(ev) {
  var now = Date.now(), best = null;
  ev.forEach(function (e) {
    if (now - (e.t || 0) > 6 * 3600e3 || e.k === "air" || e.k === "sea") return;
    if (!best || (e.sev || 0) > (best.sev || 0) || ((e.sev || 0) === (best.sev || 0) && e.t > best.t)) best = e;
  });
  return best || ev[0] || null;
}

function render() {
  var x = L(), d = S.data, conn = $("conn"), live = d && Date.now() - S.lastOk < 60e3 && S.fails === 0;
  conn.classList.toggle("off", !live);
  $("connTxt").textContent = live ? x.online : (d ? x.offline + " · " + hm(S.lastOk) : x.offline);

  if (!d) {
    $("main").hidden = true; $("stLoading").hidden = false; $("ticker").hidden = true; $("anBtn").hidden = true;
    $("ldTxt").textContent = S.fails ? x.noconn : x.connecting;
    $("ldSub").textContent = S.fails ? x.noconnSub.replace("{p}", port()) : "";
    return;
  }
  $("stLoading").hidden = true; $("main").hidden = false;

  var showRoutine = prop("showRoutine", true) !== false, showCt = prop("showContacts", true) !== false,
      showNews = prop("showNews", true) !== false, showSrc = prop("showSources", true) !== false;
  var ev = (d.events || []).filter(function (e) { return showRoutine || (e.k !== "air" && e.k !== "sea"); });

  /* chips */
  var chips = $("chips"); chips.textContent = "";
  var corrN = ev.filter(function (e) { return e.k === "corr"; }).length;
  [[x.chUa + " " + (d.ua_n || 0), d.ua_n ? "red" : ""], [x.chIl + " " + (d.il_n || 0), d.il_n ? "red" : ""], [x.chCorr + " " + corrN, corrN ? "amb" : ""]]
    .concat(showCt ? [["✈ " + ((d.air || {}).n || 0), "cy"], ["⚓ " + ((d.sea || {}).n || 0), "cy"]] : [])
    .forEach(function (c) { chips.appendChild(el("span", "chip " + c[1], c[0])); });

  /* hero */
  var hero = pickHero(ev), hb = $("hero");
  hb.classList.toggle("empty", !hero);
  if (hero) {
    hb.style.setProperty("--sev", sevColor(hero));
    $("hKind").textContent = (x.k[hero.k] || hero.k) + (hero.sev && hero.k !== "ua" && hero.k !== "il" ? " · " + x.sev + " " + hero.sev + "/5" : "") + " · " + age(hero.t);
    $("hTitle").textContent = hero.title || "";
    $("hSub").textContent = hero.sub || "";
    hb.onclick = function () { go(hero.id, hb); };
  } else {
    hb.style.removeProperty("--sev");
    $("hKind").textContent = x.events; $("hTitle").textContent = x.none; $("hSub").textContent = x.noneSub.replace("{t}", hm(S.lastOk));
    hb.onclick = null;
  }

  /* event list */
  $("evLbl").textContent = x.events;
  var ul = $("evList"); ul.textContent = "";
  var rest = ev.filter(function (e) { return e !== hero; }).slice(0, 12);
  if (!rest.length) ul.appendChild(el("li", "empty", x.noOther));
  rest.forEach(function (e) {
    var li = el("li"), b = el("button");
    b.type = "button"; b.style.setProperty("--sev", sevColor(e));
    b.appendChild(el("span", "k")); b.appendChild(el("span", "t", e.title || ""));
    if (e.sev >= 3 && e.k !== "ua" && e.k !== "il") b.appendChild(el("span", "r", e.sev + "/5"));
    b.appendChild(el("span", "a", age(e.t)));
    b.onclick = function () { go(e.id, b); };
    li.appendChild(b); ul.appendChild(li);
  });

  /* contacts */
  var ct = $("colCt"); ct.classList.toggle("on", showCt || showSrc);
  $("ctLbl").textContent = x.contacts; $("ctLbl").hidden = !showCt; $("ctGrid").hidden = !showCt;
  var a = d.air || {}, s = d.sea || {}, inc = d.inc || {};
  var cells = [["air", a.n, "cy"], ["isr", a.isr, "cy"], ["tanker", a.tanker, "amb"], ["bomber", a.bomber, "red"], ["loiter", a.loiter, "amb"], ["inc", inc.n24, "red"],
               ["sea", s.n, ""], ["mil", s.mil, "red"], ["sanc", s.sanc, "red"], ["dark", s.dark, "vi"], ["sts", s.sts, "amb"], ["cable", s.cable, "vi"]];
  var g = $("ctGrid"); g.textContent = "";
  cells.forEach(function (c) {
    var n = c[1] || 0, box = el("div", "cell " + c[2] + (n ? "" : " zero"));
    box.appendChild(el("div", "n", String(n))); box.appendChild(el("div", "l", x.c[c[0]])); g.appendChild(box);
  });
  var sr = $("srcs"); sr.textContent = ""; sr.hidden = !showSrc;
  var su = d.src || {};
  if (su.at) {
    sr.appendChild(el("span", "", x.src + ": " + su.ok + " " + x.ok));
    sr.appendChild(el("span", su.err ? "bad" : "", su.err + " " + x.err));
    sr.appendChild(el("span", "", x.test + " " + hm(su.at)));
  }

  /* news column (XL) and ticker */
  var nw = $("colNw"); nw.classList.toggle("on", showNews);
  $("nwLbl").textContent = x.news;
  var nl = $("nwList"); nl.textContent = "";
  (d.news || []).forEach(function (n) {
    var li = el("li"), b = el("button"); b.type = "button";
    b.appendChild(el("span", "t", n.h || "")); b.appendChild(el("span", "a", (n.src || "") + (n.rel ? " · " + n.rel + (n.info || "") : "")));
    b.onclick = function () { go(n.id, b); };
    li.appendChild(b); nl.appendChild(li);
  });
  var tk = $("tk"), tkBox = $("ticker"); tk.textContent = "";
  tkBox.hidden = !showNews || !(d.news || []).length; tkBox.classList.toggle("on", showNews);
  var len = 0;
  (d.news || []).forEach(function (n) { var sp = el("span"); sp.appendChild(el("b", "", n.src || "")); sp.appendChild(document.createTextNode(n.h || "")); tk.appendChild(sp); len += (n.h || "").length + 20; });
  tk.style.setProperty("--tick-s", Math.max(30, Math.round(len / 9)) + "s");

  /* analysis button */
  var ab = $("anBtn"), j = d.job || {};
  ab.hidden = false;
  ab.classList.toggle("run", !!j.running); ab.disabled = !!j.running;
  if (j.running) { ab.textContent = x.anRun + " " + (j.pct || 0) + "%"; ab.classList.remove("arm"); S.armed = 0; }
  else if (S.armed && Date.now() - S.armed < 4000) { ab.textContent = x.anArm; ab.classList.add("arm"); }
  else { ab.textContent = x.an; ab.classList.remove("arm"); S.armed = 0; }
}

$("anBtn").onclick = function () {
  var d = S.data; if (!d || (d.job || {}).running) return;
  if (S.armed && Date.now() - S.armed < 4000) {           // second tap within 4 s starts the analysis (protects against accidental touches)
    S.armed = 0; go("refresh"); if (S.data) S.data.job = { running: true, pct: 0 }; render();
  } else { S.armed = Date.now(); render(); setTimeout(render, 4100); }
};

/* ---------------------------------------------------------------- iCUE lifecycle */
function onIcueDataUpdated() { applyStyles(); S.base = null; render(); poll(); }
function onIcueInitialized() { onIcueDataUpdated(); }

icueEvents = {
  "onDataUpdated": onIcueDataUpdated,
  "onICUEInitialized": onIcueInitialized
};

var bootAttempts = 0;
function bootCheck() {
  if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) { onIcueInitialized(); return; }
  if (bootAttempts < 15) { bootAttempts++; setTimeout(bootCheck, 100); return; }
  onIcueDataUpdated();                                     // plain browser (development)
}
render();
bootCheck();
setInterval(function () { if (S.data) render(); }, 30000); // refresh relative times
