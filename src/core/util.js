'use strict';
// Utilidades numéricas y de listas sin dependencias.

const mod = (a, n) => ((a % n) + n) % n;

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

const lcm = (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0);
const lcmAll = (list) => list.reduce((acc, v) => lcm(acc, v), 1);

const range = (n) => Array.from({ length: n }, (_, i) => i);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (a) => a.reduce((s, v) => s + v, 0);

// Factores primos de n, de mayor a menor (10 -> [5, 2]).
function primeFactors(n) {
  const out = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) while (m % p === 0) { out.push(p); m /= p; }
  if (m > 1) out.push(m);
  return out.sort((a, b) => b - a);
}

const uniqSorted = (a) => [...new Set(a)].sort((x, y) => x - y);

module.exports = { mod, gcd, lcm, lcmAll, range, clamp, sum, primeFactors, uniqSorted };
