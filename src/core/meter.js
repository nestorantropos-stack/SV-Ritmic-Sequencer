'use strict';
// Pesos métricos (COG.3.1, §4.2) y deducción de la jerarquía a partir del compás.
const { primeFactors, mod } = require('./util');

const LHL_16 = [0, -4, -3, -4, -2, -4, -3, -4, -1, -4, -3, -4, -2, -4, -3, -4];

// §4.2 con una corrección: el pseudocódigo del informe da peso 0 también al paso 8 de 16;
// aquí el inicio del ciclo es el nivel 0 y cada nivel siguiente resta 1, lo que reproduce
// exactamente los pesos de Longuet-Higgins y Lee (LHL_16) para levels = [2,2,2,2] (D-017).
function meterWeights(levels) {
  const n = levels.reduce((p, L) => p * L, 1);
  const w = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    let depth = 1;
    let step = n;
    for (const L of levels) {
      step = step / L;
      if (i % step === 0) break;
      depth += 1;
    }
    w[i] = -depth;
  }
  return w;
}

// Compases aditivos: inicio del ciclo 0, inicio de grupo −1, el resto −2 (§4.2).
function groupingWeights(grouping) {
  const n = grouping.reduce((s, g) => s + g, 0);
  const w = new Array(n).fill(-2);
  let pos = 0;
  for (const g of grouping) { w[pos] = -1; pos += g; }
  w[0] = 0;
  return w;
}

function parseMeter(meter) {
  const m = /^(\d+)\/(\d+)$/.exec(meter || '4/4');
  return m ? { num: +m[1], den: +m[2] } : { num: 4, den: 4 };
}

// Deduce los niveles (de mayor a menor) para un ciclo: compases × pulsos × subdivisión.
function levelsFor(cycleLen, meter, stepValue) {
  const { num, den } = parseMeter(meter);
  const barBeats = (num * 4) / den;
  const stepsPerBar = Math.round(barBeats / stepValue);
  const fallback = primeFactors(cycleLen);
  if (stepsPerBar <= 0 || Math.abs(stepsPerBar * stepValue - barBeats) > 1e-3) return fallback;
  if (cycleLen % stepsPerBar !== 0) return fallback;
  const bars = cycleLen / stepsPerBar;
  const compound = den === 8 && num % 3 === 0 && num > 3;
  // 5/8, 7/8, 11/8 sin grouping: no hay pulso isócrono que deducir; se divide el compás por factores primos
  const beats = compound ? num / 3 : (den === 8 ? null : num);
  if (beats === null || stepsPerBar % beats !== 0) {
    const levels = [...primeFactors(bars), ...primeFactors(stepsPerBar)].filter((f) => f > 1);
    return levels.reduce((p, L) => p * L, 1) === cycleLen ? levels : fallback;
  }
  const stepsPerBeat = stepsPerBar / beats;
  const levels = [...primeFactors(bars), ...primeFactors(beats), ...primeFactors(stepsPerBeat)].filter((f) => f > 1);
  return levels.reduce((p, L) => p * L, 1) === cycleLen ? levels : fallback;
}

// Pesos de un patrón: grouping si existe; si no, jerarquía deducida del compás.
function weightsForPattern(p) {
  if (Array.isArray(p.meter_weights) && p.meter_weights.length === p.cycle_len) return p.meter_weights.slice();
  if (Array.isArray(p.grouping) && p.grouping.reduce((s, g) => s + g, 0) === p.cycle_len) {
    // combina el agrupamiento con los niveles de compás cuando el ciclo abarca varios compases
    return groupingWeights(p.grouping);
  }
  return meterWeights(levelsFor(p.cycle_len, p.meter, p.step_value));
}

// Peso normalizado 0..1 (1 = más fuerte).
function normalizeWeights(w) {
  const min = Math.min(...w);
  if (min === 0) return w.map(() => 1);
  return w.map((v) => 1 - v / min);
}

// Velocity por defecto a partir del peso (ACE.1.1).
function velocityFromWeight(wNorm, lo = 70, hi = 112) {
  return Math.round(lo + (hi - lo) * wNorm);
}

const weightAt = (w, i) => w[mod(i, w.length)];

module.exports = { LHL_16, meterWeights, groupingWeights, parseMeter, levelsFor, weightsForPattern, normalizeWeights, velocityFromWeight, weightAt };
