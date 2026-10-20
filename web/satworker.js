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
