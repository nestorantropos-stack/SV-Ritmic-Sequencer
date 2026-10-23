'use strict';
// Superposición: polirritmia (SUP.1), hoquetus y kotekan (SUP.4, §4.11), arco jo-ha-kyū (FOR.2.1, §4.12).
const { lcmAll, range, clamp } = require('./util');

// SUP.1 · capas a:b:… sobre el mcm; onsets de la capa a: i * cycle/a.
function polyrhythm(ratios) {
  const cycle = lcmAll(ratios);
  return { cycle_len: cycle, layers: ratios.map((r) => ({ role: `ratio_${r}`, onsets: range(r).map((i) => (i * cycle) / r) })) };
}

// §4.11 · reparte una lista de ataques entre `voices` voces.
// rule: 'alternate' (por orden), 'kotekan' (sobre el pulso / entre pulsos), 'register' (por altura).
function hocket(onsets, voices, rule = 'alternate', opts = {}) {
  const out = Array.from({ length: voices }, () => []);
  onsets.forEach((o, idx) => {
    let v;
    if (rule === 'kotekan') v = o % (opts.beatSteps || 4) === 0 ? 0 : 1;
    else if (rule === 'register') {
      const pitch = (opts.pitches || [])[idx] ?? 60;
      const split = opts.split ?? 60;
      v = voices === 2 ? (pitch < split ? 0 : 1) : clamp(Math.floor(((pitch - (opts.low ?? 36)) / ((opts.high ?? 96) - (opts.low ?? 36))) * voices), 0, voices - 1);
    } else v = idx % voices;
    out[Math.min(v, voices - 1)].push(o);
  });
  return out;
}

// SUP.4.2 · completa una corriente continua: polos sobre el pulso, sangsih en el resto.
function kotekanPair(n, beatSteps = 2) {
  const polos = range(n).filter((i) => i % beatSteps === 0);
  const sangsih = range(n).filter((i) => i % beatSteps !== 0);
  return { polos, sangsih };
}

// FOR.2.1 · §4.12. t en [0,1] → intensidad (tempo interno o densidad) con tres fases:
// jo (introducción lenta), ha (desarrollo que acelera), kyū (conclusión rápida).
// Curva lineal por tramos en los puntos `seg` con valores `values`; proporciones editables.
// depth > 0 añade el arco recursivo: cada fase contiene su propio jo-ha-kyū (modulación del 10 %).
function jhk(t, depth = 0, opts = {}) {
  const seg = opts.seg || [0, 0.5, 0.85, 1];
  const values = opts.values || [0.2, 0.3, 0.8, 1];
  const tt = clamp(t, 0, 1);
  let k = 0;
  while (k < seg.length - 2 && tt > seg[k + 1]) k++;
  const local = (tt - seg[k]) / (seg[k + 1] - seg[k] || 1);
  let base = values[k] + (values[k + 1] - values[k]) * local;
  if (depth > 0) base *= 1 + 0.1 * (jhk(local, depth - 1, opts) - 0.5);
  return base;
}

module.exports = { polyrhythm, hocket, kotekanPair, jhk };
