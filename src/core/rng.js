'use strict';
// Generador pseudoaleatorio con semilla (mulberry32): la misma semilla da siempre el mismo resultado.

function hashString(s) {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function createRng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : (seed >>> 0)) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    seed,
    next,
    float: (lo = 0, hi = 1) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), // ambos extremos incluidos
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // Elección ponderada: devuelve el índice.
    weighted: (weights) => {
      const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
      if (total <= 0) return Math.floor(next() * weights.length);
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) { r -= Math.max(0, weights[i]); if (r < 0) return i; }
      return weights.length - 1;
    },
    // Normal estándar (Box-Muller).
    gauss: () => {
      let u = 0;
      while (u === 0) u = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    // Semilla derivada, para que cada capa tenga su propia secuencia reproducible.
    fork: (label) => createRng(hashString(String(seed) + ':' + label)),
  };
  return rng;
}

module.exports = { createRng, hashString };
