'use strict';
// Destino Chords: voicings por grado y modo, stabs, anticipaciones, ritmo armónico, colchón y eco.
// Estilo Dub Techno (D-023): tríada del grado I en estado fundamental, fija, registro centrado en ~62
// (corpus DDT: 0-3-7 sobre la tónica en 170 de 200 eventos, raíz entre 57 y 66), stab corto.
const { chordPitches, placeChord, tonicNear } = require('../harmony');
const { harmonyOf, degreeAt, segmentIndex, note } = require('./common');

const CHORD_ROLES = new Set(['chord', 'chord_low', 'pad', 'stab', 'skank']);

function styleDefaults(ctx) {
  const cat = ctx.category;
  if (cat === 'dub_techno') return { center: 62, voicing: 'root', size: 3, gateScale: 1 };
  if (cat === 'dub_reggae') return { center: 67, voicing: 'closest', size: 3, gateScale: 1 };
  return { center: 62, voicing: 'closest', size: 3, gateScale: 1 };
}

function render(events, ctx) {
  const o = ctx.opts;
  const st = styleDefaults(ctx);
  const h = harmonyOf(ctx);
  const size = Math.min(6, Math.max(2, o.chordSize || st.size));
  const shape = o.chordShape || 'tertian';
  const center = o.center ?? st.center;
  const voicing = o.voicing || st.voicing;
  const range = o.range || [36, 96];
  const tonic = tonicNear(h, center - 2);
  const gateScale = o.gateScale ?? st.gateScale;
  const antic = o.anticipation ? (o.anticipationBeats || 0.25) : 0;

  // qué eventos son acordes: roles de acorde; si el patrón no los tiene, la capa principal
  let src = events.filter((e) => CHORD_ROLES.has(e.role));
  if (!src.length) src = events.filter((e) => e.layer === ctx.norm.mainIndex);

  // un voicing por segmento armónico, con conducción de voces entre segmentos
  const cache = new Map();
  let prev = null;
  const voicingFor = (deg, seg, low) => {
    const key = `${seg}:${deg}:${low ? 1 : 0}`;
    if (cache.has(key)) return cache.get(key);
    const raw = chordPitches(h, deg, tonic, size, shape);
    const placed = placeChord(raw, { mode: voicing, center: low ? center - 12 : center, prev: low ? null : prev, range });
    if (!low) prev = placed;
    cache.set(key, placed);
    return placed;
  };

  const out = [];
  for (const e of src) {
    const deg = degreeAt(e.time, ctx, antic);
    const seg = segmentIndex(e.time + antic, ctx);
    const low = e.role === 'chord_low';
    let pitches = voicingFor(deg, seg, low);
    if (low && o.bubbleSplit !== false) pitches = pitches.slice(0, 2); // mano izquierda del bubble: dos notas graves
    const dur = Math.max(1 / 32, e.gate * gateScale);
    for (const p of pitches) out.push(note(e, p, dur, ctx, { degree: deg }));
    // PRO.19 · ritmo de delay como notas de eco (opcional; útil sin un delay en la pista)
    if (o.echo && o.echo.repeats > 0) {
      const ratio = o.echo.ratioBeats || 0.75; // corchea con puntillo
      for (let k = 1; k <= o.echo.repeats; k++) {
        const v = Math.round(e.velocity * (o.echo.feedback ?? 0.5) ** k);
        if (v < 8) break;
        for (const p of pitches) out.push(note({ ...e, time: e.time + k * ratio, velocity: v }, p, dur, ctx, { degree: deg, role: 'echo', echo: k }));
      }
    }
  }
  // colchón opcional (capa de acorde sostenido): un acorde largo por segmento armónico
  if (o.pad) {
    const segBeats = (o.harmonicRhythmBars || ctx.plan.bars) * ctx.plan.barBeats;
    for (let t = 0; t < ctx.plan.totalBeats - 1e-9; t += Math.min(segBeats, ctx.plan.totalBeats)) {
      const deg = degreeAt(t, ctx);
      // una octava bajo los stabs para que no coincida en altura e instante con ellos
      const pitches = placeChord(chordPitches(h, deg, tonic, size, shape), { mode: 'root', center: center - 12, range });
      for (const p of pitches) out.push(note({ time: t, velocity: o.padVelocity || 64, probability: 1, role: 'pad', layer: -1, cycle: 0, stepInCycle: 0 }, p, Math.min(segBeats, ctx.plan.totalBeats - t) - 0.01, ctx, { degree: deg }));
    }
  }
  return out;
}

module.exports = { render, styleDefaults, CHORD_ROLES };
