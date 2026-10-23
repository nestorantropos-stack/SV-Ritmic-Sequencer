'use strict';
// Normaliza un patrón de datos (data/patterns) a una forma uniforme lista para los generadores:
// resuelve generadores, completa valores por defecto por ataque y calcula pesos métricos.
const { mod, lcmAll, range } = require('./util');
const { euclid } = require('./rhythm');
const { carnaticTala } = require('./cycles');
const { polyrhythm } = require('./layers');
const { weightsForPattern, normalizeWeights, velocityFromWeight } = require('./meter');

function expandGenerator(p, rng) {
  const g = p.generator;
  if (!g) return { cycle_len: p.cycle_len, layers: p.layers, grouping: p.grouping };
  switch (g.type) {
    case 'euclid': {
      let on = euclid(g.k, g.n, g.rotation || 0);
      // por defecto se alinea el primer ataque con el paso 0 (más útil en un secuenciador)
      if (g.align !== 'raw' && on.length && !g.rotation) on = on.map((o) => mod(o - on[0], g.n)).sort((a, b) => a - b);
      return { cycle_len: g.n, layers: [{ role: 'euclid', onsets: on }] };
    }
    case 'carnatic_tala': {
      const t = carnaticTala(g.family, g.jati, g.gati);
      return {
        cycle_len: t.cycle_len,
        grouping: t.grouping,
        weights: t.weights,
        layers: [
          { role: 'anga', onsets: t.anga_starts, timbre: t.anga_starts.map((s) => (s === 0 ? 0 : 1)), velocity: t.anga_starts.map((s) => (s === 0 ? 127 : 100)) },
          { role: 'matra', onsets: range(t.cycle_len).filter((i) => i % t.gati === 0), velocity: range(t.units).map(() => 70) },
        ],
      };
    }
    case 'polyrhythm': {
      const pr = polyrhythm(g.ratios);
      return { cycle_len: pr.cycle_len, layers: pr.layers };
    }
    case 'weighted_steps': {
      if (!rng) throw new Error(`El patrón ${p.id} necesita una semilla (weighted_steps)`);
      const n = p.cycle_len;
      const [lo, hi] = g.hits_range || [2, 5];
      const hits = rng.int(lo, hi);
      const chosen = new Set();
      if (rng.chance(g.force_first ?? 0)) chosen.add(0);
      const w = g.step_weights.slice();
      let guard = 0;
      while (chosen.size < hits && guard++ < 200) {
        const i = rng.weighted(w.map((x, k) => (chosen.has(k) ? 0 : x)));
        chosen.add(i);
      }
      const onsets = [...chosen].sort((a, b) => a - b);
      const [g0, g1] = g.gate_range || [0.5, 0.5];
      return { cycle_len: n, layers: [{ role: 'chord', onsets, gate: onsets.map(() => +(rng.float(g0, g1)).toFixed(3)) }] };
    }
    default:
      throw new Error(`Generador desconocido: ${g.type}`);
  }
}

// Completa un array por ataque con un valor por defecto o una función del paso.
const fill = (arr, onsets, def) => onsets.map((o, i) => (arr && arr[i] !== undefined ? arr[i] : typeof def === 'function' ? def(o) : def));

function normalizePattern(p, opts = {}) {
  const ex = expandGenerator(p, opts.rng);
  const layerLens = (ex.layers || []).map((l) => l.cycle_len).filter(Boolean);
  const cycle_len = ex.cycle_len || (layerLens.length ? lcmAll(layerLens) : 16);
  const base = { ...p, cycle_len, grouping: ex.grouping || p.grouping };
  const weights = ex.weights || weightsForPattern(base);
  const wNorm = normalizeWeights(weights);
  const defaultGate = Math.max(0.05, Math.min(p.step_value, 0.5)); // en negras
  const layers = (ex.layers || []).map((l) => {
    const len = l.cycle_len || cycle_len;
    const onsets = l.onsets.slice();
    return {
      role: l.role,
      cycle_len: len,
      onsets,
      velocity: fill(l.velocity, onsets, (o) => velocityFromWeight(wNorm[mod(o, cycle_len)])),
      timbre: fill(l.timbre, onsets, 0),
      microtiming: fill(l.microtiming, onsets, 0),
      gate: fill(l.gate, onsets, defaultGate),
      probability: fill(l.probability, onsets, 1),
      swing: l.swing ?? null,
    };
  });
  return {
    id: p.id, name: p.name, status: p.status, verify: !!p.verify,
    restricted_use: !!(p.restricted_use || (p.origin && p.origin.restricted_use)),
    structural_only: !!p.structural_only,
    cycle_len, step_value: p.step_value, meter: p.meter,
    cycle_beats: cycle_len * p.step_value,
    grouping: base.grouping || null,
    weights, layers,
    repeat_policy: p.repeat_policy,
    params: p.params || {}, fx: p.fx || null,
    source: p,
  };
}

// Una capa con su propio ciclo (polimetría) repetida hasta `totalLen` pasos.
function tileLayer(layer, totalLen) {
  const out = { ...layer, onsets: [], velocity: [], timbre: [], microtiming: [], gate: [], probability: [] };
  for (let start = 0; start < totalLen; start += layer.cycle_len) {
    layer.onsets.forEach((o, i) => {
      if (start + o >= totalLen) return;
      out.onsets.push(start + o);
      for (const k of ['velocity', 'timbre', 'microtiming', 'gate', 'probability']) out[k].push(layer[k][i]);
    });
  }
  out.cycle_len = totalLen;
  return out;
}

module.exports = { normalizePattern, expandGenerator, tileLayer };
