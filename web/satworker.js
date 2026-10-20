/* KRONOS-7 – obliczanie pozycji satelitów (SGP4) poza głównym wątkiem, żeby mapa nie zacinała się przy tysiącach obiektów. */
importScripts("vendor/satellite.min.js");
const G = {};
onmessage = e => {
  const m = e.data;
  if (m.t === "set") { G[m.id] = m.tle.map(t => { try { return satellite.twoline2satrec(t[0], t[1]); } catch (err) { return null; } }); return; }
  if (m.t === "del") { delete G[m.id]; return; }
  if (m.t === "calc") {
    const now = new Date(m.at || Date.now()), gm = satellite.gstime(now), out = {}, bufs = [];
    for (const id of m.ids) {
      const recs = G[id]; if (!recs) continue;
      const a = new Float32Array(recs.length * 3);
      for (let i = 0; i < recs.length; i++) {
        let la = NaN, lo = NaN, al = NaN; const r = recs[i];
        if (r) { const pv = satellite.propagate(r, now);
          if (pv && pv.position) { const gd = satellite.eciToGeodetic(pv.position, gm); la = satellite.degreesLat(gd.latitude); lo = satellite.degreesLong(gd.longitude); al = gd.height; } }
        a[i * 3] = la; a[i * 3 + 1] = lo; a[i * 3 + 2] = al;
      }
      out[id] = a; bufs.push(a.buffer);
    }
    postMessage({ t: "pos", out, at: now.getTime() }, bufs);
  }
};

/* --- przeloty nad stacją (QTH): AOS/LOS, maks. elewacja, azymuty, widoczność gołym okiem, Doppler */
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
function sunEci(date) {   // przybliżona pozycja Słońca w ECI (km)
  const d = (date - Date.UTC(2000, 0, 1, 12)) / 864e5, g = (357.529 + .98560028 * d) * RAD, q = 280.459 + .98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * RAD, e = (23.439 - .00000036 * d) * RAD, R = 1.496e8;
  return { x: R * Math.cos(L), y: R * Math.cos(e) * Math.sin(L), z: R * Math.sin(e) * Math.sin(L) };
}
function sunlit(pos, date) {   // satelita poza cieniem Ziemi (model walca)
  const s = sunEci(date), sl = Math.hypot(s.x, s.y, s.z), u = { x: s.x / sl, y: s.y / sl, z: s.z / sl };
  const dot = pos.x * u.x + pos.y * u.y + pos.z * u.z; if (dot > 0) return true;
  const px = pos.x - dot * u.x, py = pos.y - dot * u.y, pz = pos.z - dot * u.z; return Math.hypot(px, py, pz) > 6371;
}
function sunElev(obs, date) {   // wysokość Słońca nad horyzontem stacji
  const s = sunEci(date), gm = satellite.gstime(date), ecf = satellite.eciToEcf(s, gm);
  return satellite.ecfToLookAngles(obs, ecf).elevation * DEG;
}
function look(rec, obs, date) {
  const pv = satellite.propagate(rec, date); if (!pv || !pv.position) return null;
  const gm = satellite.gstime(date), ecf = satellite.eciToEcf(pv.position, gm), la = satellite.ecfToLookAngles(obs, ecf);
  return { el: la.elevation * DEG, az: (la.azimuth * DEG + 360) % 360, range: la.rangeSat, eci: pv.position };
}
function passesFor(rec, obs, start, hours, minEl) {
  const out = [], end = start + hours * 3600e3; let t = start, prev = look(rec, obs, new Date(t)), inPass = prev && prev.el > 0 ? { aos: t } : null;
  if (!prev) return out;
  const refine = (a, b) => { for (let i = 0; i < 12; i++) { const m = (a + b) / 2, l = look(rec, obs, new Date(m)); if (l && l.el > 0) b = m; else a = m; } return b; };
  while (t < end) {
    const t2 = t + 60e3, l = look(rec, obs, new Date(t2)); if (!l) break;
    if (!inPass && l.el > 0) inPass = { aos: refine(t, t2) };
    else if (inPass && l.el <= 0) {
      let a = t, b = t2; for (let i = 0; i < 12; i++) { const m = (a + b) / 2, lm = look(rec, obs, new Date(m)); if (lm && lm.el > 0) a = m; else b = m; }
      inPass.los = a; out.push(inPass); inPass = null;
    }
    t = t2;
  }
  return out.map(p => {
    let best = { el: -90 }, vis = false;
    for (let x = p.aos; x <= p.los; x += 20e3) { const l = look(rec, obs, new Date(x)); if (l && l.el > best.el) best = Object.assign({ t: x }, l); }
    const a = look(rec, obs, new Date(p.aos)), b = look(rec, obs, new Date(p.los));
    if (best.eci && sunElev(obs, new Date(best.t)) < -6) for (let x = p.aos; x <= p.los; x += 30e3) { const pv = satellite.propagate(rec, new Date(x)); const l = look(rec, obs, new Date(x)); if (pv && pv.position && l && l.el > 10 && sunlit(pv.position, new Date(x))) { vis = true; break; } }
    /* prędkość zbliżania (km/s) na początku i końcu przelotu – do obliczenia przesunięcia Dopplera */
    const rr = x => { const l1 = look(rec, obs, new Date(x)), l2 = look(rec, obs, new Date(x + 1000)); return l1 && l2 ? l2.range - l1.range : 0; };
    return { aos: p.aos, los: p.los, tmax: best.t, maxEl: Math.round(best.el), azAos: a ? Math.round(a.az) : null, azMax: Math.round(best.az), azLos: b ? Math.round(b.az) : null,
             vis, rrAos: rr(p.aos + 5e3), rrLos: rr(p.los - 6e3) };
  }).filter(p => p.maxEl >= minEl);
}
const prevOnMsg = onmessage;
onmessage = e => {
  const m = e.data;
  if (m.t === "passes") {
    const obs = { longitude: m.qth.lon * RAD, latitude: m.qth.lat * RAD, height: (m.qth.alt || 0) / 1000 }, res = [];
    for (const s of m.sats) { let rec; try { rec = satellite.twoline2satrec(s.l1, s.l2); } catch (err) { continue; }
      passesFor(rec, obs, m.start || Date.now(), m.hours || 24, m.minEl || 0).forEach(p => res.push(Object.assign({ norad: s.norad, name: s.name }, p))); }
    res.sort((a, b) => a.aos - b.aos);
    postMessage({ t: "passes", id: m.id, passes: res });
    return;
  }
  prevOnMsg(e);
};
