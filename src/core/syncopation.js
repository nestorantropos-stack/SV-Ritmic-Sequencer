'use strict';
// COG.3.2 · índice de síncopa (§4.6) y mutación hacia un objetivo en la curva en U invertida (COG.3.3).
const { mod } = require('./util');
const { toBool, toOnsets } = require('./rhythm');

// §4.6: un ataque de peso w seguido de un silencio de peso W > w suma W − w.
// Interpretación (D-019): el «silencio» es la posición más fuerte entre el ataque y el ataque siguiente
// (cíclico). Leer solo el paso inmediato daría 0 a un contratiempo de corcheas en rejilla de 16.
// La adaptación exacta de Witek et al. sigue marcada [V].
function syncopation(bools, w) {
  const n = bools.length;
  if (!bools.some(Boolean)) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (!bools[i]) continue;
    let W = -Infinity;
    for (let d = 1; d < n; d++) {
      const j = mod(i + d, n);
      if (bools[j]) break;
      W = Math.max(W, w[j]);
    }
    if (W > w[i]) s += W - w[i];
  }
  return s;
}

// Escala de normalización (aproximada): suma de todos los saltos de peso hacia arriba entre pasos
// vecinos. syncopation()/maxSyncopation() se recorta a [0, 1] donde se usa como objetivo.
function maxSyncopation(w) {
  const n = w.length;
  let s = 0;
  for (let i = 0; i < n; i++) { const j = mod(i + 1, n); if (w[j] > w[i]) s += w[j] - w[i]; }
  return s || 1;
}

// Muta ataques (mover uno a un paso vecino vacío) para acercar la síncopa normalizada a target (0..1),
// conservando el número de ataques. Determinista con rng. Respeta `locked` (pasos que no se tocan).
function mutateTowardTarget(onsets, w, target, rng, opts = {}) {
  const n = w.length;
  const maxIter = opts.maxIter || 200;
  const locked = new Set(opts.locked || []);
  const norm = maxSyncopation(w);
  let cur = toBool(onsets, n);
  const level = (b) => Math.min(1, syncopation(b, w) / norm);
  let curErr = Math.abs(level(cur) - target);
  for (let it = 0; it < maxIter && curErr > (opts.tolerance || 0.02); it++) {
    const hits = toOnsets(cur).filter((i) => !locked.has(i));
    if (!hits.length) break;
    const from = rng.pick(hits);
    const dir = rng.chance(0.5) ? 1 : -1;
    const to = mod(from + dir, n);
    if (cur[to] || locked.has(to)) continue;
    const cand = cur.slice();
    cand[from] = false;
    cand[to] = true;
    const err = Math.abs(level(cand) - target);
    if (err <= curErr) { cur = cand; curErr = err; }
  }
  return toOnsets(cur);
}

// Valor por defecto: tramo medio de la curva en U invertida (COG.3.3). Valor de diseño, ajustable.
const DEFAULT_TARGET = 0.35;

module.exports = { syncopation, maxSyncopation, mutateTowardTarget, DEFAULT_TARGET };
