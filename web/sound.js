/* KRONOS-7 – syntezator dźwięków terminala (Web Audio, bez plików audio).
   Inspirowany komputerami pokładowymi z kina SF lat 70.: bulgotanie rdzenia,
   dalekopis, buczenie statku, sonarowy „kontakt”, syrena alarmowa.
   K7Sound(ctx, out) działa z AudioContext (na żywo) i OfflineAudioContext (render demo). */
(function () {
"use strict";
window.K7Sound = function (ctx, out) {
  const R = Math.random, SR = ctx.sampleRate;
  /* --- tor główny: ton „taśmy” → lekki przester → kompresor */
  const master = ctx.createGain(); master.gain.value = .8;
  const tape = ctx.createBiquadFilter(); tape.type = "lowpass"; tape.frequency.value = 9500; tape.Q.value = .4;
  const sat = ctx.createWaveShaper(); const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
  sat.curve = curve; sat.oversample = "2x";
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .2;
  master.connect(tape); tape.connect(sat); sat.connect(comp); comp.connect(out);
  /* --- pogłos: metalowe wnętrze (wygenerowana odpowiedź impulsowa) */
  const verb = ctx.createConvolver(), wet = ctx.createGain(), send = ctx.createGain(); wet.gain.value = .42; send.gain.value = 1;
  const irLen = Math.floor(SR * 1.7), ir = ctx.createBuffer(2, irLen, SR);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) { const t = i / SR; d[i] = (R() * 2 - 1) * Math.exp(-t * 3.4) * (1 + .5 * Math.sin(t * 2 * Math.PI * (310 + c * 23))); }
    [.011, .019, .027, .041].forEach((e, k) => { const j = Math.floor(e * SR) + c * 37; if (j < irLen) d[j] += .7 / (k + 1); }); }
  verb.buffer = ir; send.connect(verb); verb.connect(wet); wet.connect(master);
  /* --- szumy */
  function nbuf(kind, sec) { const n = Math.floor(SR * sec), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = R() * 2 - 1;
      if (kind === "brown") { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
      else if (kind === "pink") { b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * .1848) * .2; }
      else d[i] = w; }
    return b; }
  const WHITE = nbuf("white", 2), PINK = nbuf("pink", 3), BROWN = nbuf("brown", 5);
  const T = at => ctx.currentTime + (at || 0);
  function route(node, pan, wetAmt) {
    let n = node; if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
    n.connect(master); if (wetAmt) { const g = ctx.createGain(); g.gain.value = wetAmt; n.connect(g); g.connect(send); }
  }
  function env(g, t, a, d, v, hold) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); if (hold) g.gain.setValueAtTime(v, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + (hold || 0) + d); }
  /* oscylator z obwiednią */
  function osc(o) {
    const t = T(o.at), g = ctx.createGain(), x = ctx.createOscillator(); x.type = o.type || "sine";
    x.frequency.setValueAtTime(o.f, t); if (o.f2) x.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.d));
    if (o.detune) x.detune.value = o.detune;
    let n = x; if (o.lp || o.bp) { const fl = ctx.createBiquadFilter(); fl.type = o.bp ? "bandpass" : "lowpass"; fl.frequency.value = o.bp || o.lp; fl.Q.value = o.q || .8; x.connect(fl); n = fl; }
    n.connect(g); env(g, t, o.a || .004, o.d, o.v || .1, o.hold); route(g, o.pan, o.wet);
    x.start(t); x.stop(t + (o.a || .004) + (o.hold || 0) + o.d + .05);
  }
  /* przefiltrowany szum z obwiednią */
  function nz(o) {
    const t = T(o.at), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = o.buf || WHITE; f.type = o.ft || "bandpass"; f.frequency.setValueAtTime(o.f, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d); f.Q.value = o.q || 1;
    s.connect(f); f.connect(g); env(g, t, o.a || .001, o.d, o.v || .1, o.hold); route(g, o.pan, o.wet);
    s.start(t, R() * 1.5); s.stop(t + (o.a || .001) + (o.hold || 0) + o.d + .05);
  }
  const PENTA = [0, 3, 5, 7, 10]; const note = (base, oct) => base * Math.pow(2, (PENTA[Math.floor(R() * 5)] + 12 * Math.floor(R() * oct)) / 12);
  const api = {
    master, setVol(v) { master.gain.setTargetAtTime(.8 * v, ctx.currentTime, .05); },
    /* krótki sygnał interfejsu */
    blip(f = 1200, at = 0, v = .07) { osc({ f, f2: f * .985, d: .07, v, at, pan: (R() - .5) * .5, wet: .25 }); osc({ f: f * 2, d: .03, v: v * .25, at, type: "triangle" }); },
    /* klik przycisku: mechaniczny trzask przekaźnika + cichy ton */
    click(at = 0) { nz({ f: 3200, q: 2, d: .012, v: .16, at }); osc({ f: 160, f2: 90, d: .03, v: .12, at }); osc({ f: 2400, d: .02, v: .02, at: (at || 0) + .004 }); },
    /* uderzenie czcionki dalekopisu */
    key(at = 0, v = 1) { const p = (R() - .5) * .6;
      nz({ f: 2600 + R() * 1400, q: 2.5, d: .014, v: .32 * v, at, pan: p });
      nz({ f: 820 + R() * 200, q: 9, d: .045, v: .13 * v, at, pan: p, wet: .15 });
      osc({ f: 190 + R() * 40, f2: 110, d: .035, v: .17 * v, at, pan: p }); },
    /* powrót karetki: „zzzyp” i dzwonek końca linii */
    carriage(at = 0) { nz({ f: 500, f2: 2600, q: 3, d: .16, v: .07, at, a: .02 }); osc({ f: 2093, d: .5, v: .03, at: (at || 0) + .16, wet: .5 }); },
    /* terkot drukowania n znaków */
    chatter(n = 20, at = 0) { const k = Math.min(36, Math.max(2, Math.round(n / 2))); let t = at || 0;
      for (let i = 0; i < k; i++) { api.key(t, .7 + R() * .4); t += .026 + R() * .022 + (R() < .08 ? .06 : 0); } return t; },
    /* bulgotanie rdzenia: frazy szybkich tonów z pogłosem */
    burblePhrase(at = 0) { let t = at || 0; const base = [523, 587, 659][Math.floor(R() * 3)], n = 3 + Math.floor(R() * 5), sp = .05 + R() * .03;
      for (let i = 0; i < n; i++) { const f = note(base, 3), sq = R() < .35;
        osc({ f, f2: R() < .2 ? f * (R() < .5 ? 1.5 : .66) : f * .99, d: sp * 1.1, v: sq ? .07 : .14, type: sq ? "square" : "sine", lp: sq ? 3000 : 0, at: t, pan: (R() - .5) * .8, wet: .45 });
        t += sp; }
      return t - (at || 0) + .06 + R() * .22; },
    /* rozruch: przekaźniki, narastający gwizd zasilania, akord gotowości */
    powerUp(at = 0) { const a = at || 0;
      [0, .22, .41, .55].forEach((d, i) => { nz({ f: 380, ft: "lowpass", d: .09, v: .3, at: a + d }); osc({ f: 75 + i * 12, f2: 45, d: .12, v: .2, at: a + d }); nz({ f: 4200, q: 3, d: .01, v: .12, at: a + d }); });
      osc({ f: 120, f2: 3800, glide: 1.6, d: 1.9, v: .03, a: .2, at: a + .3, wet: .3 });
      osc({ f: 60, d: 1.6, v: .18, a: .4, at: a + .3, type: "sawtooth", lp: 220 });
      [784, 1047, 1568].forEach((f, i) => osc({ f, d: .9, v: .06, at: a + 1.9 + i * .09, wet: .6 })); },
    /* koniec analizy: trzy dzwonki */
    done(at = 0) { [1047, 1319, 1568].forEach((f, i) => { const t = (at || 0) + i * .13; osc({ f, d: .9, v: .07, at: t, wet: .6 }); osc({ f: f * 2.76, d: .25, v: .015, at: t }); }); },
    /* kontakt: sonarowy „ping” z echem */
    contact(at = 0) { const a = at || 0; osc({ f: 1180, f2: 1120, d: 1.3, v: .11, a: .006, at: a, wet: .95 }); osc({ f: 1180, f2: 1120, d: .9, v: .035, at: a + .48, wet: .95, pan: .3 }); },
    /* błąd: niski brzęczyk */
    error(at = 0) { osc({ f: 110, d: .32, v: .14, type: "square", lp: 700, at, hold: .08 }); osc({ f: 116, d: .32, v: .1, type: "square", lp: 700, at, hold: .08 }); },
    /* jeden cykl syreny alarmowej (whoop) */
    whoop(at = 0) { const a = at || 0; [0, 7].forEach(dt => osc({ f: 360, f2: 860, glide: .62, d: .7, v: .11, a: .03, hold: .0, type: "sawtooth", lp: 2400, detune: dt, at: a, wet: .35 }));
      osc({ f: 180, f2: 430, glide: .62, d: .7, v: .06, type: "square", lp: 900, at: a }); },
    alarm(times = 3, at = 0) { for (let i = 0; i < times; i++) api.whoop((at || 0) + i * .78); },
    /* tło: buczenie maszynowni, wentylacja, cichy pisk kineskopu */
    humStart() {
      const t = T(), g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(.1, t, 2); g.connect(master); const nodes = [];
      const src = (buf, f, type, q, v) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), sg = ctx.createGain(); s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; sg.gain.value = v; s.connect(fl); fl.connect(sg); sg.connect(g); s.start(t, R() * 2); nodes.push(s); return fl; };
      const rumble = src(BROWN, 140, "lowpass", .7, .55);
      src(PINK, 650, "bandpass", .6, .045);
      [[48, .1], [96, .045], [144, .015]].forEach(([f, v]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); nodes.push(o); });
      const wh = ctx.createOscillator(), wg = ctx.createGain(); wh.frequency.value = 15625; wg.gain.value = .0025; wh.connect(wg); wg.connect(g); wh.start(t); nodes.push(wh);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = 50; lfo.connect(lg); lg.connect(rumble.frequency); lfo.start(t); nodes.push(lfo);
      return { stop() { try { g.gain.setTargetAtTime(0, ctx.currentTime, .5); } catch (e) {} setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 2500); }, nodes };
    },
    /* zgodność ze starymi wywołaniami beep(f, d, typ) */
    beep(f = 880, d = .05, type = "square") {
      if (type === "sawtooth" && f < 400) return api.error();
      if (f >= 1500 && d <= .02) return api.key(0, .6);
      return api.blip(Math.max(300, Math.min(2600, f)), 0, d > .1 ? .08 : .06);
    }
  };
  return api;
};
})();
