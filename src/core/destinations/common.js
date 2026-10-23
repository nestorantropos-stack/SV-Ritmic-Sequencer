'use strict';
// Piezas compartidas por los destinos.
const { defaultProgression } = require('../harmony');

const MINOR = { root: 9, intervals: [0, 2, 3, 5, 7, 8, 10], id: 'minor' }; // La menor por defecto

const harmonyOf = (ctx) => ctx.opts.harmony || MINOR;

// Progresión de grados y ritmo armónico (MET.2.5: cambio cada 1, 2, 4 u 8 compases).
function progressionOf(ctx) {
  const h = harmonyOf(ctx);
  const prog = Array.isArray(ctx.opts.progression) && ctx.opts.progression.length ? ctx.opts.progression : defaultProgression(ctx.category, h.intervals.length);
  const hr = ctx.opts.harmonicRhythmBars || (ctx.category === 'dub_techno' ? 0 : 2); // 0 = acorde fijo
  return { prog, hrBars: hr };
}

// Grado vigente en el tiempo t (en negras). anticipate = negras de anticipación (ACE.2.3).
function degreeAt(t, ctx, anticipate = 0) {
  const { prog, hrBars } = progressionOf(ctx);
  if (!hrBars || prog.length === 1) return prog[0];
  const segBeats = hrBars * ctx.plan.barBeats;
  const seg = Math.floor((t + anticipate + 1e-9) / segBeats);
  return prog[((seg % prog.length) + prog.length) % prog.length];
}

const segmentIndex = (t, ctx) => {
  const { hrBars } = progressionOf(ctx);
  return hrBars ? Math.floor((t + 1e-9) / (hrBars * ctx.plan.barBeats)) : 0;
};

// Nota en el formato de add_new_notes de Live (los campos extra los quita el adaptador).
function note(e, pitch, duration, ctx, extra = {}) {
  return {
    pitch, start_time: e.time, duration, velocity: e.velocity, mute: 0,
    probability: e.probability ?? 1, velocity_deviation: ctx.opts.velocityDeviation || 0,
    role: e.role, layer: e.layer, cycle: e.cycle, step: e.stepInCycle, variation: !!e.variation, ...extra,
  };
}

// Duración monofónica: no pisa la nota siguiente.
function monophonic(notes, gap = 0.02) {
  const s = notes.slice().sort((a, b) => a.start_time - b.start_time);
  for (let i = 0; i < s.length - 1; i++) {
    const room = s[i + 1].start_time - s[i].start_time - gap;
    if (room <= 0) { s[i].drop = true; continue; }
    s[i].duration = Math.min(s[i].duration, room);
  }
  return s.filter((n) => !n.drop);
}

module.exports = { MINOR, harmonyOf, progressionOf, degreeAt, segmentIndex, note, monophonic };
