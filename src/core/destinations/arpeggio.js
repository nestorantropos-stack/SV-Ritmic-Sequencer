'use strict';
// Destino Arpeggio: direcciones, subdivisión como métrica (ciclos de 3, 5 o 7 notas sobre la rejilla →
// hemiola y polimetría) y entrelazado de dos voces (SUP.4).
const { chordPitches, tonicNear } = require('../harmony');
const { harmonyOf, degreeAt, note } = require('./common');

function orderTones(tones, direction, rng) {
  const up = tones.slice().sort((a, b) => a - b);
  switch (direction) {
    case 'down': return up.slice().reverse();
    case 'updown': return [...up, ...up.slice(1, -1).reverse()];
    case 'converge': {
      const out = [];
      let i = 0; let j = up.length - 1;
      while (i <= j) { out.push(up[i++]); if (i <= j) out.push(up[j--]); }
      return out;
    }
    case 'random': return rng.shuffle(up);
    default: return up;
  }
}

function render(events, ctx) {
  const o = ctx.opts;
  const h = harmonyOf(ctx);
  const rng = ctx.rng;
  const center = o.center ?? 64;
  const tonic = tonicNear(h, center - 5);
  const size = o.arpChordSize || 3;
  const octaves = Math.max(1, o.octaves || 2);
  const direction = o.direction || 'up';
  const cycleN = o.arpCycle || null; // 3, 5 o 7: ciclo polimétrico de notas
  const sv = ctx.norm.step_value;

  // ritmo: eventos del patrón, o corriente continua a `rate` negras con acento donde el patrón ataca
  let src;
  if (o.stream) {
    const rate = o.rate || 0.25;
    const hits = new Set(events.filter((e) => e.layer === ctx.norm.mainIndex).map((e) => Math.round(e.time / rate)));
    src = [];
    for (let t = 0, k = 0; t < ctx.plan.totalBeats - 1e-9; t += rate, k++) {
      src.push({ time: t, velocity: hits.has(k) ? 108 : 78, probability: 1, role: 'arp', layer: 0, cycle: Math.floor(t / ctx.plan.cycleBeats), stepInCycle: Math.round((t % ctx.plan.cycleBeats) / sv), gate: rate * 0.8, accentOctave: 0 });
    }
  } else src = events.filter((e) => e.layer === ctx.norm.mainIndex);

  const out = [];
  const cacheDeg = new Map();
  src.forEach((e, idx) => {
    const deg = degreeAt(e.time, ctx);
    if (!cacheDeg.has(deg)) {
      const base = chordPitches(h, deg, tonic, size);
      const tones = [];
      for (let oc = 0; oc < octaves; oc++) for (const p of base) tones.push(p + 12 * oc);
      cacheDeg.set(deg, orderTones(tones, direction, rng.fork('dir' + deg)));
    }
    const seq = cacheDeg.get(deg);
    const pos = cycleN ? idx % cycleN : idx % seq.length;
    let pitch = seq[pos % seq.length];
    let role = 'arp';
    if (o.interleave) {
      // SUP.4 · dos voces que se alternan (hoquetus); la segunda una octava arriba
      if (idx % 2 === 1) { pitch += 12; role = 'arp_b'; } else role = 'arp_a';
    }
    if (e.accentOctave) pitch += 12;
    while (pitch > 108) pitch -= 12;
    out.push(note({ ...e, role }, pitch, Math.max(0.05, e.gate ?? sv * 0.8), ctx, { degree: deg }));
  });
  return out;
}

module.exports = { render, orderTones };
