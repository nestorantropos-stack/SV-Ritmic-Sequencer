'use strict';
// Destino Others: cualquier voz con selección libre de notas, percusión de efectos y texturas rítmicas.
// - notes: lista de alturas MIDI; cada capa toma una (capa i → notes[i mod n]) y el timbre la desplaza.
// - sin notes: cada capa recibe un grado de la escala (capa i → grado 2i), o una deriva por grados (texture: 'walk').
const { degreePitch, tonicNear } = require('../harmony');
const { harmonyOf, note } = require('./common');

function render(events, ctx) {
  const o = ctx.opts;
  const h = harmonyOf(ctx);
  const rng = ctx.rng;
  const tonic = tonicNear(h, o.center ?? 60);
  const layers = [...new Set(events.map((e) => e.layer))].sort((a, b) => a - b);
  const walkPos = new Map(layers.map((l) => [l, 0]));
  return events.map((e) => {
    let pitch;
    const li = layers.indexOf(e.layer);
    if (Array.isArray(o.notes) && o.notes.length) pitch = o.notes[(li + (e.timbre || 0)) % o.notes.length];
    else if (o.texture === 'walk') {
      const cur = walkPos.get(e.layer) + rng.pick([-2, -1, 1, 2]);
      walkPos.set(e.layer, Math.max(-7, Math.min(10, cur)));
      pitch = degreePitch(h, walkPos.get(e.layer) + 2 * li, tonic);
    } else pitch = degreePitch(h, 2 * li + (e.timbre || 0), tonic);
    if (e.accentOctave && !o.notes) pitch += 12;
    return note(e, Math.max(0, Math.min(127, pitch)), Math.max(0.05, e.gate || 0.2), ctx);
  });
}

module.exports = { render };
