'use strict';
// Destino Hi-hats: capas cerrado / abierto / pedal y percusión aguda; tresillos y redobles de trap;
// shuffle y microtiempo (vía el motor común); contratiempo abierto opcional; corte del abierto.
const { chooseMap, makeResolver } = require('./drums');
const { note } = require('./common');

const HAT_FAMILY = new Set(['hat', 'hat_open', 'hat_pedal', 'ride', 'ride_bell', 'shaker', 'tambourine', 'cabasa', 'maracas', 'guiro', 'triangle', 'agogo_hi', 'agogo_lo', 'cowbell', 'woodblock', 'woodblock_hi', 'woodblock_lo', 'guacharaca', 'tamborim']);
const CLOSING = new Set(['hat', 'hat_pedal']);

function render(events, ctx) {
  const o = ctx.opts;
  const maps = (ctx.data.drumMaps && ctx.data.drumMaps.maps) || [];
  const map = chooseMap(ctx.norm.source, 'hihats', maps, o.drumMap) || { id: 'gm', roles: { hat: 42, hat_open: 46, hat_pedal: 44 } };
  const gm = maps.find((m) => m.id === 'gm_percussion');
  const resolve = makeResolver(map, gm ? [gm] : []);
  const rng = ctx.rng;
  const sv = ctx.norm.step_value;

  let src = events.filter((e) => HAT_FAMILY.has(e.role));
  // un patrón sin capas de hat (clave, timeline, euclidiano) se toca con el hat cerrado
  if (!src.length) src = events.filter((e) => e.layer === ctx.norm.mainIndex).map((e) => ({ ...e, role: 'hat' }));

  const out = [];
  for (const e of src) {
    let role = e.role;
    // contratiempo de corchea abierto (house, dub techno) como opción
    if (o.openOffbeat && role === 'hat' && Math.abs(e.time % 1 - 0.5) < 0.13) role = 'hat_open';
    const pitch = resolve(role, e.timbre);
    const base = role === 'hat_open' ? 0.45 : role === 'ride' ? 0.4 : 0.1;
    // GRV.9 · redobles: un ataque se convierte en 2–4 golpes de fusa o tresillo
    if (o.rollProb && role === 'hat' && !e.variation && rng.chance(o.rollProb)) {
      const div = rng.pick([2, 3, 4]);
      const span = Math.min(sv, 0.25);
      for (let k = 0; k < div; k++) out.push(note({ ...e, time: e.time + (k * span) / div, velocity: Math.max(1, Math.round(e.velocity * (0.7 + (0.3 * k) / div))) }, pitch, span / div / 2, ctx, { roll: true, role }));
      continue;
    }
    out.push(note({ ...e, role }, pitch, Math.min(e.gate || base, base * 2), ctx));
  }
  // pedal en negras opcional
  if (o.pedal) {
    const p = resolve('hat_pedal');
    for (let t = 0; t < ctx.plan.totalBeats - 1e-9; t += 1) out.push(note({ time: t, velocity: 70, probability: 1, role: 'hat_pedal', layer: -1, cycle: 0, stepInCycle: 0 }, p, 0.1, ctx));
  }
  // el abierto suena hasta el siguiente cerrado o pedal (corte natural del hi-hat)
  const sorted = out.sort((a, b) => a.start_time - b.start_time);
  sorted.forEach((n, i) => {
    if (n.role !== 'hat_open') return;
    const next = sorted.slice(i + 1).find((m) => CLOSING.has(m.role));
    if (next) n.duration = Math.max(0.05, Math.min(n.duration, next.start_time - n.start_time - 0.01));
  });
  return sorted;
}

module.exports = { render, HAT_FAMILY };
