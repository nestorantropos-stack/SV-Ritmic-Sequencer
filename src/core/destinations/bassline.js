'use strict';
// Destino Bassline: raíz y grados fuertes sobre los acentos métricos; notas de paso y saltos de octava
// en posiciones débiles; seguimiento del bombo; estilos ostinato continuo, tumbao anticipado y one drop.
const { degreePitch, tonicNear } = require('../harmony');
const { harmonyOf, degreeAt, note, monophonic } = require('./common');

const BASS_ROLES = ['bass', 'kick', 'surdo', 'timeline', 'bell', 'darbuka', 'group', 'euclid', 'cell', 'beat', 'voice'];

// Grado de quinta disponible en la escala (o el más cercano por intervalo).
function fifthDegree(h) {
  const i7 = h.intervals.indexOf(7);
  if (i7 >= 0) return i7;
  let best = 1;
  h.intervals.forEach((iv, k) => { if (Math.abs(iv - 7) < Math.abs(h.intervals[best] - 7)) best = k; });
  return best;
}

function sourceEvents(events, ctx) {
  const o = ctx.opts;
  if (o.bassSource === 'external' && Array.isArray(o.kickTimes)) {
    // Fase 3: tiempos de bombo leídos de otra pista (en negras)
    return o.kickTimes.filter((t) => t < ctx.plan.totalBeats).map((t, i) => ({ time: t, velocity: 100, probability: 1, role: 'bass', layer: 0, cycle: 0, stepInCycle: Math.round(t / ctx.norm.step_value), accentStrength: t % ctx.plan.barBeats === 0 ? 1 : t % 1 === 0 ? 0.9 : 0.4, gate: 0.4, idx: i }));
  }
  const prefer = o.bassSource === 'kick' ? ['kick', ...BASS_ROLES] : BASS_ROLES;
  for (const r of prefer) {
    const ev = events.filter((e) => e.role === r);
    if (ev.length) return ev;
  }
  return events.filter((e) => e.layer === ctx.norm.mainIndex);
}

function render(events, ctx) {
  const o = ctx.opts;
  const h = harmonyOf(ctx);
  const rng = ctx.rng;
  const center = o.center ?? 40;
  const tonic = tonicNear(h, center);
  const style = o.bassStyle || (ctx.norm.params && ctx.norm.params.bass_style) || 'auto';
  const params = ctx.norm.params || {};
  // dub techno: bajo casi estático sobre la tónica (corpus DDT Bass: 1–3 alturas por clip, D-026)
  const dubTechno = ctx.category === 'dub_techno';
  const octaveJump = o.octaveJumpProb ?? params.octave_jump_prob ?? (dubTechno ? 0.15 : 0.12);
  const passingProb = o.passingProb ?? (dubTechno ? 0.05 : 0.35);
  const fifthProb = o.fifthProb ?? (dubTechno ? 0.15 : 0.5);
  const space = o.bassSpace ?? params.bass_space ?? 0;
  const fifth = fifthDegree(h);
  const sv = ctx.norm.step_value;
  const barBeats = ctx.plan.barBeats;
  let src = sourceEvents(events, ctx);

  if (style === 'moroder') {
    // CIC.1.1 · corriente continua de semicorcheas; el acento va por altura (ACE.1.4).
    // Alternancia raíz / octava como diseño: el contorno exacto de I Feel Love sigue [V].
    src = [];
    for (let t = 0; t < ctx.plan.totalBeats - 1e-9; t += 0.25) src.push({ time: t, velocity: t % 1 === 0 ? 110 : 88, probability: 1, role: 'bass', layer: 0, cycle: Math.floor(t / ctx.plan.cycleBeats), stepInCycle: Math.round((t % ctx.plan.cycleBeats) / sv), accentStrength: t % 1 === 0 ? 1 : 0.5, gate: 0.2 });
  } else if (style === 'tumbao') {
    // ACE.2.3 · tumbao: «y» del 2 y pulso 4 de cada compás; el 4 anticipa el acorde siguiente y se liga.
    src = [];
    for (let b = 0; b * barBeats < ctx.plan.totalBeats - 1e-9; b++) {
      src.push({ time: b * barBeats + 1.5, velocity: 96, probability: 1, role: 'bass', layer: 0, cycle: b, stepInCycle: 6, accentStrength: 0.6, gate: 1.4 });
      src.push({ time: b * barBeats + 3, velocity: 108, probability: 1, role: 'bass', layer: 0, cycle: b, stepInCycle: 12, accentStrength: 0.8, gate: 2.4, anticipates: true });
    }
  } else if (style === 'one_drop') {
    // RGG.3.1 / GRV.5 · el pulso 1 queda vacío
    src = src.filter((e) => Math.abs(e.time % barBeats) > 1e-6);
  }

  const out = [];
  let prevDeg = 0;
  src.forEach((e, idx) => {
    if (space > 0 && e.accentStrength < 0.5 && rng.chance(space * 0.5)) return; // RGG.5 · espacio
    const root = degreeAt(e.time, ctx, e.anticipates ? barBeats : 0);
    const s = e.accentStrength ?? 0.5;
    let deg;
    let passing = false;
    if (style === 'moroder') deg = root + (idx % 2 === 1 ? h.intervals.length : 0);
    else if (s >= 0.95 || style === 'root' || style === 'tumbao') deg = root;
    else if (s >= 0.7) deg = rng.chance(1 - fifthProb * 0.7) ? root : root + fifth;
    else {
      // posición débil: nota de paso diatónica hacia la raíz, o salto de octava
      const r = rng.next();
      if (r < octaveJump) deg = root + h.intervals.length;
      else if (r < octaveJump + passingProb) { deg = prevDeg + (prevDeg > root ? -1 : 1); passing = true; }
      else deg = rng.chance(fifthProb) ? root + fifth : root;
    }
    if (e.accentOctave) deg += h.intervals.length;
    prevDeg = deg;
    let pitch = degreePitch(h, deg, tonic);
    const lo = (o.range && o.range[0]) ?? 26;
    const hi = (o.range && o.range[1]) ?? 60;
    while (pitch > hi) pitch -= 12;
    while (pitch < lo) pitch += 12;
    const dur = Math.max(0.05, e.gate ?? 0.4);
    out.push(note(e, pitch, dur, ctx, { degree: deg, passingDiatonic: passing }));
  });
  return monophonic(out);
}

module.exports = { render, fifthDegree };
