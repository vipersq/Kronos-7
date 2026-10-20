/* KRONOS-7 – Property Inspector (ustawienia przycisku w aplikacji Stream Deck) */
const EN = !/^pl/i.test(navigator.language || "");
const T = (pl, en) => EN ? en : pl;
const THEATERS = [["world", "ŚWIAT", "World"], ["ua", "UKRAINA", "Ukraine"], ["bs", "MORZE CZARNE", "Black Sea"], ["ef", "FLANKA NATO", "NATO eastern flank"], ["me", "BLISKI WSCHÓD", "Middle East"],
  ["hz", "ORMUZ", "Hormuz"], ["ye", "JEMEN · M. CZERWONE", "Yemen · Red Sea"], ["lev", "LEWANT", "Levant"], ["sd", "SUDAN", "Sudan"], ["cd", "KONGO", "Congo"], ["mm", "MJANMA", "Myanmar"],
  ["tw", "TAJWAN", "Taiwan"], ["wp", "ZACHODNI PACYFIK", "Western Pacific"]];
const LAYERS = [["vessel", "Statki (AIS)", "Ships (AIS)"], ["air", "Lotnictwo (ADS-B)", "Aircraft (ADS-B)"], ["cable", "Kable podmorskie", "Undersea cables"], ["sat", "Orbity", "Orbits"],
  ["conf", "Konflikty", "Conflicts"], ["front", "Fronty", "Fronts"], ["move", "Natarcia", "Advances"], ["strike", "Uderzenia", "Strikes"], ["force", "Siły", "Forces"], ["ship", "Żegluga", "Shipping"],
  ["haz", "Natura", "Nature"], ["flank", "Flanka NATO", "NATO flank"], ["nuke", "Atom", "Nuclear"], ["asp", "Przestrzeń powietrzna", "Airspace"], ["gps", "Zakłócenia GNSS", "GNSS jamming"],
  ["fire", "Pożary", "Fires"], ["net", "Sieć", "Network"], ["hum", "Humanitarne", "Humanitarian"], ["cyber", "Cyber", "Cyber"], ["news", "Depesze", "Reports"], ["night", "Noc", "Night"]];
const METRICS = [["air.n", "Samoloty wojskowe – wszystkie", "Military aircraft – all"], ["air.isr", "Samoloty rozpoznawcze", "Reconnaissance aircraft"], ["air.tanker", "Tankowce powietrzne", "Air tankers"],
  ["air.bomber", "Bombowce", "Bombers"], ["air.loiter", "Samoloty krążące (orbita)", "Loitering aircraft"], ["sea.n", "Statki – wszystkie", "Ships – all"], ["sea.mil", "Okręty i straż", "Warships and coast guard"],
  ["sea.sanc", "Statki z sankcjami OFAC", "OFAC-sanctioned ships"], ["sea.dark", "„Ciemne” statki (AIS wyłączony)", "Dark ships (AIS off)"], ["sea.sts", "Przeładunki STS", "STS transfers"], ["sea.cable", "Statki nad kablami", "Ships over cables"],
  ["inc.n24", "Incydenty morskie (24 h: piractwo, ataki)", "Maritime incidents (24 h: piracy, attacks)"], ["inc.hi24", "Poważne incydenty morskie (24 h)", "Serious maritime incidents (24 h)"]];
const COMMANDS = [["briefing", "Odczytaj briefing", "Read briefing"], ["sitrep", "SITREP (region w polu Tekst)", "SITREP (region in Text)"], ["ask", "Pytanie do AI (w polu Tekst)", "Ask AI (question in Text)"],
  ["stop", "Stop – cisza (mowa, syrena, SITREP)", "Stop – silence (speech, siren, SITREP)"], ["refresh", "Odśwież analizę AI", "Refresh AI analysis"], ["alert", "PRIORYTET JEDEN (alarm)", "PRIORITY ONE (alarm)"],
  ["globe", "Globus 3D / mapa", "3D globe / flat map"], ["autozoom", "AUTO-ZOOM wł./wył.", "AUTO-ZOOM on/off"], ["replay:toggle", "Odtwarzanie 48 h wł./wył.", "48 h replay on/off"],
  ["replay:play", "Odtwarzanie: start / pauza", "Replay: play / pause"], ["replay:live", "Powrót na żywo", "Back to live"], ["zoom:1", "Przybliż", "Zoom in"], ["zoom:-1", "Oddal", "Zoom out"],
  ["zoom:reset", "Cały świat", "Whole world"], ["view:map", "Widok: mapa", "View: map"], ["view:chain", "Widok: łańcuch przyczyn", "View: causal chain"], ["event:", "Pokaż ostatni kontakt", "Show latest contact"],
  ["audio", "Dźwięk terminala wł./wył.", "Terminal sound on/off"], ["voice", "Polecenie głosowe", "Voice command"], ["report", "Raport dzienny (PDF)", "Daily report (PDF)"], ["open", "Otwórz terminal", "Open terminal"]];
const DIALS = [["zoom", "Zoom mapy", "Map zoom"], ["replay", "Odtwarzanie 48 h", "48 h replay"], ["theater", "Wybór teatru działań", "Theatre picker"]];
const DIAL_HINT = { zoom: T("Obrót: przybliż/oddal (na globusie obrót). Naciśnięcie: cały świat. Dotyk: globus/mapa.", "Rotate: zoom (rotates the globe). Press: whole world. Touch: globe/map."),
  replay: T("Obrót: przewijanie czasu. Naciśnięcie: start/pauza. Dotyk: włącz/wyłącz odtwarzanie.", "Rotate: scrub time. Press: play/pause. Touch: replay on/off."),
  theater: T("Obrót: wybór teatru. Naciśnięcie: przejdź. Dotyk: cały świat.", "Rotate: pick a theatre. Press: go. Touch: whole world.") };
const INFO = { status: T("Pokazuje poziom napięcia z ostatniej analizy AI (1–5). Naciśnięcie otwiera terminal w przeglądarce.", "Shows the tension level from the last AI analysis (1–5). Press opens the terminal in your browser."),
  analysis: T("Odliczanie do następnej automatycznej analizy AI; w trakcie analizy postęp w % (karta graficzna zajęta). Naciśnięcie uruchamia analizę teraz.", "Countdown to the next scheduled AI analysis; progress % while it runs (GPU busy). Press starts an analysis now."),
  pass: T("Najbliższy przelot satelity nad Twoim QTH (lista z panelu PRZELOTY). Naciśnięcie pokazuje satelitę na mapie.", "Next satellite pass over your QTH (from the PASSES panel). Press shows the satellite on the map.") };
const fill = (id, list) => { document.getElementById(id).innerHTML = list.map(x => `<option value="${x[0]}">${EN ? x[2] : x[1]}</option>`).join(""); };
fill("theater", THEATERS); fill("layer", LAYERS); fill("metric", METRICS); fill("cmd", COMMANDS); fill("dial", DIALS);
if (EN) { document.querySelectorAll("[data-t]").forEach(e => { const m = { "Teatr": "Theatre", "Warstwa": "Layer", "Licznik": "Counter", "Polecenie": "Command", "Tekst": "Text", "Napis": "Label", "Pokrętło": "Dial", "Krok": "Step", "Serwer": "Server", "SPRAWDŹ POŁĄCZENIE": "TEST CONNECTION",
  "Przycisk włącza i wyłącza warstwę na mapie.": "The key toggles the layer on the map.", "Miga przy nowym kontakcie. Naciśnięcie pokazuje ostatni kontakt na mapie.": "Flashes on a new contact. Press shows the latest contact on the map." }[e.dataset.t]; if (m) e.textContent = m; });
  document.getElementById("arg").placeholder = "e.g. Baltic"; document.getElementById("label").placeholder = "(default)"; }

let ws = null, uuid = null, action = null, settings = {}, gs = {};
const $ = id => document.getElementById(id);
const sendWS = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
function show() {
  const a = action.split(".").pop(), sec = { theater: "s-theater", layer: "s-layer", counter: "s-counter", command: "s-command", dial: "s-dial" }[a];
  if (sec) $(sec).hidden = false; else if (INFO[a]) { $("s-info").hidden = false; $("info").textContent = INFO[a]; }
  document.querySelectorAll("[data-k]").forEach(el => { if (settings[el.dataset.k] != null) el.value = settings[el.dataset.k]; else if (el.tagName === "SELECT" && el.options.length) settings[el.dataset.k] = el.value; });
  upd();
}
function upd() {
  const c = $("cmd").value; $("argRow").hidden = !(c === "sitrep" || c === "ask");
  const d = $("dial").value; $("stepRow").hidden = d !== "replay"; $("dialHint").textContent = DIAL_HINT[d] || "";
}
document.querySelectorAll("[data-k]").forEach(el => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => {
  settings[el.dataset.k] = el.value; upd(); sendWS({ event: "setSettings", context: uuid, payload: settings }); }));
$("url").addEventListener("change", () => { gs.url = $("url").value.trim() || "http://127.0.0.1:7707"; sendWS({ event: "setGlobalSettings", context: uuid, payload: gs }); });
$("test").addEventListener("click", () => { $("res").textContent = "…"; sendWS({ event: "sendToPlugin", action, context: uuid, payload: { test: $("url").value.trim() || "http://127.0.0.1:7707" } }); });

window.connectElgatoStreamDeckSocket = (port, inUUID, regEvent, info, actionInfo) => {
  uuid = inUUID; const ai = JSON.parse(actionInfo || "{}"); action = ai.action || ""; settings = (ai.payload && ai.payload.settings) || {};
  show();
  ws = new WebSocket("ws://127.0.0.1:" + port);
  ws.onopen = () => { sendWS({ event: regEvent, uuid }); sendWS({ event: "getGlobalSettings", context: uuid }); sendWS({ event: "setSettings", context: uuid, payload: settings }); };
  ws.onmessage = e => { const m = JSON.parse(e.data), p = m.payload || {};
    if (m.event === "didReceiveGlobalSettings") { gs = p.settings || {}; $("url").value = gs.url || "http://127.0.0.1:7707"; }
    if (m.event === "sendToPropertyInspector" && p.test) {
      $("res").className = "hint " + (p.ok ? "ok" : "bad");
      $("res").textContent = p.ok ? T("Połączono z KRONOS-em", "Connected to KRONOS") + (p.ui ? T(" · terminal otwarty", " · terminal open") : T(" · otwórz terminal w przeglądarce, żeby przyciski sterowały mapą", " · open the terminal in a browser so keys can control the map"))
        : T("Brak połączenia – czy KRONOS jest uruchomiony? ", "No connection – is KRONOS running? ") + (p.err || ""); }
  };
};
