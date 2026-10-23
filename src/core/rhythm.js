'use strict';
// Representación de patrones y medidas de COG.3: euclidiano, uniformidad, densidad, entropía.
const { mod, range, uniqSorted } = require('./util');

const toBool = (onsets, n) => {
  const b = new Array(n).fill(false);
  for (const o of onsets) b[mod(o, n)] = true;
  return b;
};
const toOnsets = (bools) => bools.reduce((acc, v, i) => (v ? (acc.push(i), acc) : acc), []);

// PRO.1 · §4.1: k ataques en n pasos; equivale a una rotación de Bjorklund.
function euclid(k, n, rot = 0) {
  if (n <= 0) return [];
  const kk = Math.max(0, Math.min(k, n));
  const onsets = range(n).filter((i) => Math.floor(((i + 1) * kk) / n) - Math.floor((i * kk) / n) === 1);
  return uniqSorted(onsets.map((o) => mod(o + rot, n)));
}

// Intervalos entre ataques (perfil durativo), cíclico.
function ioi(onsets, n) {
  const s = uniqSorted(onsets.map((o) => mod(o, n)));
  if (s.length === 0) return [];
  return s.map((o, i) => (i + 1 < s.length ? s[i + 1] - o : n - o + s[0]));
}

// Dos patrones son la misma figura salvo rotación (collar, PRO.14).
function isRotationOf(a, b, n) {
  const A = uniqSorted(a.map((o) => mod(o, n)));
  const B = uniqSorted(b.map((o) => mod(o, n)));
  if (A.length !== B.length) return false;
  const key = (s) => s.join(',');
  const target = key(B);
  for (let r = 0; r < n; r++) if (key(uniqSorted(A.map((o) => mod(o + r, n)))) === target) return true;
  return false;
}

// COG.3.6
const density = (onsets, n) => (n ? uniqSorted(onsets).length / n : 0);

// COG.3.5 · distancia media (en pasos) a la distribución máximamente uniforme mejor alineada. 0 = uniforme.
function evenness(onsets, n) {
  const s = uniqSorted(onsets.map((o) => mod(o, n)));
  const k = s.length;
  if (k < 2) return 0;
  let best = Infinity;
  for (let a = 0; a < k; a++) {
    let d = 0;
    for (let i = 0; i < k; i++) {
      const ideal = s[a] + (i * n) / k;
      const actual = s[(a + i) % k] + (a + i >= k ? n : 0);
      d += Math.abs(actual - ideal);
    }
    best = Math.min(best, d / k);
  }
  return best;
}

// COG.3.7 · entropía de Shannon (bits) de los intervalos entre ataques.
function ioiEntropy(onsets, n) {
  const iv = ioi(onsets, n);
  if (iv.length === 0) return 0;
  const c = {};
  for (const v of iv) c[v] = (c[v] || 0) + 1;
  return -Object.values(c).reduce((s, k) => { const p = k / iv.length; return s + p * Math.log2(p); }, 0);
}

module.exports = { toBool, toOnsets, euclid, ioi, isRotationOf, density, evenness, ioiEntropy };
