// SV Ritmic Sequencer · motor empaquetado para el objeto v8 de Max for Live.
// Generado por tools/bundle.js (versión 0.5.0). No editar a mano: editar src/ y data/.
'use strict';
var __svDefs = {};
__svDefs["src/core/index.js"] = function (module, exports, require) {
'use strict';
// Núcleo de SV Ritmic Sequencer: JavaScript puro (CommonJS), sin dependencias de Max.
// Se prueba en Node (tests/) y se empaqueta en un único archivo para el objeto v8 (D-003).

module.exports = {
  ...require('./util'),
  ...require('./rng'),
  ...require('./rhythm'),
  ...require('./meter'),
  ...require('./cycles'),
  ...require('./syncopation'),
  ...require('./timing'),
  ...require('./layers'),
  transforms: require('./transforms'),
  ...require('./pattern'),
  catalog: require('./catalog'),
  harmony: require('./harmony'),
  ...require('./engine'),
  analysis: require('./analysis'),
  suggest: require('./suggest'),
  midifile: require('./midifile'),
  listen: require('./listen'),
};

};
__svDefs["src/core/util.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/rng.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/rhythm.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/meter.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/cycles.js"] = function (module, exports, require) {
'use strict';
// Generadores cíclicos: aksak (§4.3), tala carnática (§4.4), tihai (§4.5), irama (§4.8).
const { mod, sum } = require('./util');

// MET.3.3 · todas las composiciones de n en partes 2 y 3, en orden lexicográfico.
const aksakMemo = new Map();
function aksak(n) {
  if (n === 0) return [[]];
  if (n < 0) return [];
  if (aksakMemo.has(n)) return aksakMemo.get(n);
  const out = [];
  if (n >= 2) for (const r of aksak(n - 2)) out.push([2, ...r]);
  if (n >= 3) for (const r of aksak(n - 3)) out.push([3, ...r]);
  aksakMemo.set(n, out);
  return out;
}

// Inicios de grupo de un agrupamiento: [2,2,3] -> [0,2,4].
function groupStarts(grouping) {
  const out = [];
  let pos = 0;
  for (const g of grouping) { out.push(pos); pos += g; }
  return out;
}

// CIC.4.2 · sistema suladi sapta tala.
const JATI = { tisra: 3, chatusra: 4, khanda: 5, misra: 7, sankeerna: 9 };
const FAM = { dhruva: 'L D L L', matya: 'L D L', rupaka: 'D L', jhampa: 'L U D', triputa: 'L D D', ata: 'L L D D', eka: 'L' };

function carnaticTala(family, jati, gati) {
  if (!FAM[family]) throw new Error(`Familia de tala desconocida: ${family}`);
  if (!JATI[jati]) throw new Error(`Jati desconocida: ${jati}`);
  const symbols = FAM[family].split(' ');
  const angas = symbols.map((a) => (a === 'L' ? JATI[jati] : a === 'D' ? 2 : 1));
  const units = sum(angas);
  const grouping = angas.map((a) => a * gati);
  const starts = groupStarts(grouping);
  return {
    family, jati, gati, symbols, angas, units,
    cycle_len: units * gati,
    grouping,
    anga_starts: starts,
    // inicio del ciclo = máximo (0), inicio de anga = −1, resto = −2
    weights: Array.from({ length: units * gati }, (_, i) => (i === 0 ? 0 : starts.includes(i) ? -1 : -2)),
  };
}

// Las 35 combinaciones familia × jati, con su longitud en unidades.
function allCarnaticTalas() {
  const out = [];
  for (const f of Object.keys(FAM)) for (const j of Object.keys(JATI)) out.push(carnaticTala(f, j, 1));
  return out;
}

// PRO.16 · §4.5. Devuelve el paso de inicio para que la frase triple cierre en sam.
// Convención (D-018): P son los pasos de cada frase sin contar el golpe de llegada; la llegada cae en
// start + 3P + 2G, que es múltiplo del ciclo (sam).
function tihaiStart(P, G, cycleLen) {
  const total = 3 * P + 2 * G;
  return mod(cycleLen - mod(total, cycleLen), cycleLen);
}

// Construye los ataques de un tihai. phraseOnsets: posiciones dentro de la frase (0..P-1).
// Devuelve posiciones absolutas desde el inicio del ciclo donde empieza; la última es la llegada en sam.
function tihaiOnsets(phraseOnsets, P, G, cycleLen) {
  const start = tihaiStart(P, G, cycleLen);
  const out = [];
  for (let k = 0; k < 3; k++) for (const o of phraseOnsets) out.push(start + k * (P + G) + o);
  out.push(start + 3 * P + 2 * G); // llegada en sam
  return { start, onsets: out, landing: start + 3 * P + 2 * G };
}

// CIC.5 · FOR.2.3 · §4.8
const elaborationDensity = (base, iramaIndex) => base * 2 ** iramaIndex;
const gongCycleDuration = (baseCycle, iramaIndex, layaFactor = 1) => (baseCycle * 2 ** iramaIndex) / layaFactor;
const IRAMA = [
  { index: 0, label: '½', name: 'lancar', strokes: 1 },
  { index: 1, label: 'I', name: 'tanggung', strokes: 2 },
  { index: 2, label: 'II', name: 'dados', strokes: 4 },
  { index: 3, label: 'III', name: 'wilet', strokes: 8 },
  { index: 4, label: 'IV', name: 'rangkep', strokes: 16 },
];

module.exports = { aksak, groupStarts, JATI, FAM, carnaticTala, allCarnaticTalas, tihaiStart, tihaiOnsets, elaborationDensity, gongCycleDuration, IRAMA };

};
__svDefs["src/core/syncopation.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/timing.js"] = function (module, exports, require) {
'use strict';
// Microtiempo: swing dependiente del tempo (§4.9), rejilla deformable (§4.10), humanizador browniano (MIC.4),
// fase y polimetría (§4.7).
const { clamp, lcmAll, mod } = require('./util');

// MIC.1.1 · §4.9. La curva es una aproximación de diseño [I]; coeficientes calibrables de oído.
function effectiveSwingRatio(ratio, bpm, coupling = 0) {
  return 1 + (ratio - 1) * clamp(1 - (coupling * (bpm - 90)) / 120, 0, 1);
}

// Desplazamiento de la unidad impar, en fracción de la unidad de swing: (r/(1+r) − 0.5) · 2 = (r−1)/(r+1).
const swingOddOffset = (ratioEff) => (ratioEff / (1 + ratioEff) - 0.5) * 2;

// Desplazamiento en pasos de cada ataque para un swing aplicado a unidades de `unitSteps` pasos
// (unitSteps = 1 para semicorchea en rejilla de 16, 2 para corchea).
function swingOffsets(onsets, unitSteps, ratioEff) {
  const off = swingOddOffset(ratioEff) * unitSteps;
  return onsets.map((s) => (s % unitSteps === 0 && Math.floor(s / unitSteps) % 2 === 1 ? off : 0));
}

// MIC.3 · §4.10. Posición (0..1 del ciclo) del inicio de cada paso.
function gridPositions(stepDurations) {
  const total = stepDurations.reduce((s, d) => s + d, 0);
  const out = [];
  let acc = 0;
  for (const d of stepDurations) { out.push(acc / total); acc += d; }
  return out;
}

// Rejilla deformable desde proporciones de pulso (p. ej. telespringar [0.38,0.34,0.28]) con
// `stepsPerBeat` pasos iguales dentro de cada pulso.
function gridFromBeatProportions(props, stepsPerBeat) {
  const durations = [];
  for (const p of props) for (let i = 0; i < stepsPerBeat; i++) durations.push(p / stepsPerBeat);
  return gridPositions(durations);
}

const timeOfStep = (i, positions, barStart, barLen) => barStart + positions[mod(i, positions.length)] * barLen + Math.floor(i / positions.length) * barLen;

// MIC.4 · humanizador con ruido browniano: la desviación respira en lugar de saltar.
// Devuelve desplazamientos en ms; sigma = desviación típica objetivo, drift 0..1 (0 = ruido blanco).
function brownianOffsets(count, rng, { sigmaMs = 6, biasMs = 0, drift = 0.7 } = {}) {
  const out = [];
  let x = 0;
  const innov = Math.sqrt(1 - drift * drift);
  for (let i = 0; i < count; i++) {
    x = drift * x + innov * rng.gauss();
    out.push(biasMs + sigmaMs * x);
  }
  return out;
}

const msToBeats = (ms, bpm) => (ms / 1000) * (bpm / 60);

// §4.7
const phaseTempo = (tempoA, drift) => tempoA * (1 + drift);
const polymeterStep = (globalStep, layerLen) => mod(globalStep, layerLen);
const realignLength = (layerLens) => lcmAll(layerLens);

// MET.1 · un nivel con intervalos < 100 ms se percibe como textura.
const isTextureRate = (stepValueBeats, bpm) => (stepValueBeats * 60000) / bpm < 100;

module.exports = {
  effectiveSwingRatio, swingOddOffset, swingOffsets, gridPositions, gridFromBeatProportions, timeOfStep,
  brownianOffsets, msToBeats, phaseTempo, polymeterStep, realignLength, isTextureRate,
};

};
__svDefs["src/core/layers.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/transforms.js"] = function (module, exports, require) {
'use strict';
// Transformaciones de collar y de densidad (PRO.14, PRO.15, CIC.3 binarización).
// Todas son puras: reciben onsets y devuelven onsets nuevos ordenados.
const { mod, uniqSorted, range } = require('./util');

// rotate(onsets, n, k): desplaza k pasos hacia delante. La 3-2 rotada 8 da la 2-3.
const rotate = (onsets, n, k) => uniqSorted(onsets.map((o) => mod(o + k, n)));

// Retrogradación: el ataque en i pasa a (n − i) mod n, de modo que los intervalos se leen al revés
// y el ataque del paso 0 se conserva.
const reverse = (onsets, n) => uniqSorted(onsets.map((o) => mod(n - o, n)));

const complement = (onsets, n) => {
  const s = new Set(onsets.map((o) => mod(o, n)));
  return range(n).filter((i) => !s.has(i));
};

// PRO.15 · amount en [−1, 1]: negativo quita los ataques más débiles, positivo añade en los huecos más fuertes.
// `locked` protege pasos (por ejemplo el sam o el gong). Desempate determinista con rng (opcional).
function density(onsets, n, weights, amount, rng = null, locked = []) {
  const cur = uniqSorted(onsets.map((o) => mod(o, n)));
  const keep = new Set(locked.map((o) => mod(o, n)));
  const jitter = (i) => (rng ? rng.next() * 0.01 : (i % 7) * 1e-4);
  if (amount < 0) {
    const removable = cur.filter((o) => !keep.has(o));
    const count = Math.round(-amount * removable.length);
    const order = removable.map((o) => ({ o, w: weights[o] + jitter(o) })).sort((a, b) => a.w - b.w);
    const drop = new Set(order.slice(0, count).map((x) => x.o));
    return cur.filter((o) => !drop.has(o));
  }
  if (amount > 0) {
    const empty = range(n).filter((i) => !cur.includes(i));
    const count = Math.round(amount * empty.length);
    const order = empty.map((o) => ({ o, w: weights[o] + jitter(o) })).sort((a, b) => b.w - a.w);
    return uniqSorted([...cur, ...order.slice(0, count).map((x) => x.o)]);
  }
  return cur;
}

// Ajusta a un número exacto de ataques usando los pesos.
function densityTo(onsets, n, weights, targetCount, rng = null, locked = []) {
  const cur = uniqSorted(onsets.map((o) => mod(o, n)));
  if (targetCount === cur.length) return cur;
  if (targetCount < cur.length) {
    const removable = cur.length - locked.length || 1;
    return density(cur, n, weights, -(cur.length - targetCount) / removable, rng, locked);
  }
  const empty = n - cur.length || 1;
  return density(cur, n, weights, (targetCount - cur.length) / empty, rng, locked);
}

// PRO.10/11 · desplazamiento de fase discreto de una capa.
const phase = (onsets, n, k) => rotate(onsets, n, k);

// CIC.3 · §2.5 binarización (Pérez Fernández): i → round(i·16/12) con piso, techo o más cercano.
// Las colisiones se resuelven desplazando al siguiente paso libre.
function binarize(onsets, fromLen = 12, toLen = 16, rounding = 'nearest') {
  const f = rounding === 'floor' ? Math.floor : rounding === 'ceil' ? Math.ceil : Math.round;
  const used = new Set();
  const out = [];
  for (const o of uniqSorted(onsets)) {
    let p = mod(f((o * toLen) / fromLen), toLen);
    let guard = 0;
    while (used.has(p) && guard++ < toLen) p = mod(p + 1, toLen);
    used.add(p);
    out.push(p);
  }
  return uniqSorted(out);
}

// §6.2 · complementariedad (lógica de hoquetus contra el arreglo): cada ataque que cae en un paso muy
// ocupado por otras pistas se mueve, con probabilidad `amount`, al paso libre más cercano (±1, ±2).
// occ: ocupación 0..1 por paso del ciclo. locked: pasos que no se mueven.
function complementTo(onsets, n, occ, amount, rng, { threshold = 0.5, free = 0.25, locked = [] } = {}) {
  const keep = new Set(locked.map((o) => mod(o, n)));
  const taken = new Set(onsets.map((o) => mod(o, n)));
  const out = [];
  for (const o of uniqSorted(onsets.map((x) => mod(x, n)))) {
    if (keep.has(o) || occ[o] < threshold || !(rng ? rng.chance(amount) : amount >= 0.5)) { out.push(o); continue; }
    let moved = null;
    for (const d of [1, -1, 2, -2]) {
      const c = mod(o + d, n);
      if (!taken.has(c) && occ[c] <= free) { moved = c; break; }
    }
    if (moved === null) out.push(o);
    else { taken.delete(o); taken.add(moved); out.push(moved); }
  }
  return uniqSorted(out);
}

// Remuestrea una ocupación por compás (p. ej. 16 semicorcheas) a los pasos de un ciclo cualquiera.
function resampleOccupancy(occBar, cycleLen, stepValue, barBeats = 4) {
  const per = barBeats / occBar.length;
  return range(cycleLen).map((i) => occBar[mod(Math.round(((i * stepValue) % barBeats) / per), occBar.length)]);
}

module.exports = { rotate, reverse, complement, density, densityTo, phase, binarize, complementTo, resampleOccupancy };

};
__svDefs["src/core/pattern.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/catalog.js"] = function (module, exports, require) {
'use strict';
// Catálogo de patrones: lista pública, búsqueda y filtros del navegador (Paso 3).

const isRestricted = (p) => !!(p.restricted_use || (p.origin && p.origin.restricted_use));

// Lista pública: excluye repertorio de uso restringido (§6.4 del informe). Esos patrones solo se
// ofrecen como principio estructural con su nota de contexto, mediante structuralPrinciples().
const publicPatterns = (patterns) => patterns.filter((p) => !isRestricted(p));
const structuralPrinciples = (patterns) => patterns.filter((p) => isRestricted(p) && p.structural_only);

// Normaliza para búsqueda sin tildes ni mayúsculas.
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function haystack(p) {
  const o = p.origin || {};
  return fold([p.id, p.name, o.tradition, (o.genre || []).join(' '), o.context, (p.tags || []).join(' '), (p.taxonomy || []).join(' '), p.meter].join(' '));
}

// filters: { text, tradition, meter, destination, category, taxonomy (prefijo), status, verifiedOnly }
function search(patterns, filters = {}) {
  const terms = fold(filters.text).split(/\s+/).filter(Boolean);
  return publicPatterns(patterns).filter((p) => {
    if (terms.length) { const h = haystack(p); if (!terms.every((t) => h.includes(t))) return false; }
    if (filters.tradition && !fold(p.origin && p.origin.tradition).includes(fold(filters.tradition))) return false;
    if (filters.meter && p.meter !== filters.meter) return false;
    if (filters.destination && !(p.destinations || []).includes(filters.destination)) return false;
    if (filters.category && !(p.categories || []).includes(filters.category)) return false;
    if (filters.taxonomy && !(p.taxonomy || []).some((t) => t === filters.taxonomy || t.startsWith(filters.taxonomy + '.'))) return false;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.verifiedOnly && p.verify) return false;
    return true;
  });
}

// Insignias que la interfaz muestra junto a cada patrón.
function badges(p) {
  const out = [];
  if (p.verify) out.push('verificar');
  if (p.status === 'C') out.push('corpus');
  if (p.missing_data) out.push('datos faltantes');
  if (isRestricted(p)) out.push('uso restringido');
  return out;
}

module.exports = { isRestricted, publicPatterns, structuralPrinciples, search, badges, fold };

};
__svDefs["src/core/harmony.js"] = function (module, exports, require) {
'use strict';
// Armonía: escalas en registro, grados, acordes por superposición de terceras de la escala y voicings.
const { mod, clamp } = require('./util');

const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = (p) => PC[mod(p, 12)] + (Math.floor(p / 12) - 2); // convención de Live: C3 = 60

// harmony = { root: 0..11, intervals: [0, 2, 3, ...] }
const pitchClasses = (h) => h.intervals.map((i) => mod(h.root + i, 12));
const inScale = (h, pitch) => pitchClasses(h).includes(mod(pitch, 12));

// Altura del grado `degree` (índice de escala, puede ser negativo o superar el tamaño) con la tónica en `tonicPitch`.
function degreePitch(h, degree, tonicPitch) {
  const n = h.intervals.length;
  const oct = Math.floor(degree / n);
  return tonicPitch + h.intervals[mod(degree, n)] + 12 * oct;
}

// Tónica más cercana a `center` en clase de altura de la raíz.
function tonicNear(h, center) {
  const base = center - mod(center - h.root, 12);
  return center - base > 6 ? base + 12 : base;
}

// Todas las alturas de la escala dentro de [lo, hi].
function scaleNotesInRange(h, lo, hi) {
  const out = [];
  for (let p = lo; p <= hi; p++) if (inScale(h, p)) out.push(p);
  return out;
}

// Altura de la escala más cercana a `pitch` (empate: hacia abajo).
function snapToScale(h, pitch) {
  for (let d = 0; d < 12; d++) {
    if (inScale(h, pitch - d)) return pitch - d;
    if (inScale(h, pitch + d)) return pitch + d;
  }
  return pitch;
}

// Acorde por grado apilando terceras de la escala (saltando un grado): funciona con heptatónicas,
// pentatónicas (da acordes cuartales) y simétricas. size 3 = tríada, 4 = cuatríada, 5 = novena.
function chordDegrees(degree, size = 3, shape = 'tertian') {
  if (shape === 'sus2') return [degree, degree + 1, degree + 4].slice(0, Math.max(3, size));
  if (shape === 'sus4') return [degree, degree + 3, degree + 4].slice(0, Math.max(3, size));
  if (shape === 'power') return [degree, degree + 4, degree + 7];
  return Array.from({ length: size }, (_, i) => degree + 2 * i);
}

function chordPitches(h, degree, tonicPitch, size = 3, shape = 'tertian') {
  return chordDegrees(degree, size, shape).map((d) => degreePitch(h, d, tonicPitch));
}

// Inversiones de un acorde en estado fundamental (lista de alturas ascendente).
function inversions(chord) {
  const out = [chord.slice()];
  let cur = chord.slice();
  for (let i = 1; i < chord.length; i++) {
    cur = [...cur.slice(1), cur[0] + 12];
    out.push(cur);
  }
  return out;
}

const centroid = (c) => c.reduce((s, p) => s + p, 0) / c.length;

// Coloca el acorde: 'root' = estado fundamental con el centro cerca de `center`;
// 'closest' = inversión y octava con menor movimiento respecto de `prev` (conducción de voces).
function placeChord(chord, { mode = 'root', center = 60, prev = null, range = [36, 96] } = {}) {
  const candidates = [];
  const invs = mode === 'root' ? [chord] : inversions(chord);
  for (const inv of invs) for (let o = -4; o <= 4; o++) {
    const c = inv.map((p) => p + 12 * o);
    if (c[0] < range[0] || c[c.length - 1] > range[1]) continue;
    candidates.push(c);
  }
  if (!candidates.length) return chord.map((p) => clamp(p, range[0], range[1]));
  const cost = (c) => {
    if (mode === 'closest' && prev) {
      const m = Math.min(c.length, prev.length);
      let d = 0;
      for (let i = 0; i < m; i++) d += Math.abs(c[i] - prev[i]);
      return d + 0.1 * Math.abs(centroid(c) - center);
    }
    return Math.abs(centroid(c) - center);
  };
  return candidates.sort((a, b) => cost(a) - cost(b))[0];
}

// Grado por defecto de la progresión según la categoría (decisión de diseño D-024).
function defaultProgression(category, scaleSize) {
  if (category === 'dub_techno') return [0];
  if (category === 'dub_reggae') return scaleSize >= 7 ? [0, 3] : [0];
  return scaleSize >= 7 ? [0, 3, 4, 0] : [0, 2, 3, 0].map((d) => Math.min(d, scaleSize - 1));
}

module.exports = {
  PC, noteName, pitchClasses, inScale, degreePitch, tonicNear, scaleNotesInRange, snapToScale,
  chordDegrees, chordPitches, inversions, placeChord, defaultProgression,
};

};
__svDefs["src/core/engine.js"] = function (module, exports, require) {
'use strict';
// Motor común de generación: transformaciones → plan de repeticiones → eventos por ciclo con variación
// final → microtiempo (swing, plantillas, rejilla deformable, humanizador) → notas por destino → clip.
const { mod, lcm, clamp, range } = require('./util');
const { createRng } = require('./rng');
const { normalizePattern } = require('./pattern');
const { normalizeWeights, parseMeter } = require('./meter');
const T = require('./transforms');
const { mutateTowardTarget } = require('./syncopation');
const { tihaiStart } = require('./cycles');
const { effectiveSwingRatio, swingOddOffset, gridFromBeatProportions, brownianOffsets, msToBeats, isTextureRate } = require('./timing');
const { euclid } = require('./rhythm');

const EPS = 1e-6;
const MAIN_ROLES = ['timeline', 'bell', 'chord', 'bass', 'hat', 'clap', 'accent', 'darbuka', 'group', 'euclid', 'voice', 'cell', 'beat'];

function mainLayerIndex(norm, preferredRole) {
  if (preferredRole) { const i = norm.layers.findIndex((l) => l.role === preferredRole); if (i >= 0) return i; }
  for (const r of MAIN_ROLES) { const i = norm.layers.findIndex((l) => l.role === r && l.onsets.length); if (i >= 0) return i; }
  let best = 0;
  norm.layers.forEach((l, i) => { if (l.onsets.length > norm.layers[best].onsets.length) best = i; });
  return best;
}

// ---------------------------------------------------------------- transformaciones previas
function applyTransforms(norm, opts, rng, warnings) {
  const tr = opts.transform || {};
  const allowed = new Set(norm.source.transforms_allowed || []);
  const n = norm.cycle_len;
  const main = mainLayerIndex(norm, opts.mainRole);
  const want = (k) => {
    if (tr[k] === undefined || tr[k] === null || tr[k] === false || tr[k] === 0) return false;
    if (!allowed.has(k)) { warnings.push(`La transformación «${k}» no está permitida para ${norm.id}; se ignora.`); return false; }
    return true;
  };
  const locked = [0]; // el inicio del ciclo (sam, gong, pulso 1) no se mueve en density ni síncopa
  const layers = norm.layers.map((l) => ({ ...l, onsets: l.onsets.slice() }));
  const remap = (l, newOnsets) => {
    // conserva los atributos por ataque cuando el ataque sobrevive; los nuevos toman el valor por peso
    const wN = normalizeWeights(norm.weights);
    const idx = new Map(l.onsets.map((o, i) => [o, i]));
    const pick = (k, o, def) => (idx.has(o) ? l[k][idx.get(o)] : def);
    return {
      ...l,
      onsets: newOnsets,
      velocity: newOnsets.map((o) => pick('velocity', o, Math.round(70 + 40 * wN[mod(o, n)]))),
      timbre: newOnsets.map((o) => pick('timbre', o, l.timbre[0] ?? 0)),
      microtiming: newOnsets.map((o) => pick('microtiming', o, 0)),
      gate: newOnsets.map((o) => pick('gate', o, l.gate[0] ?? norm.step_value)),
      probability: newOnsets.map((o) => pick('probability', o, 1)),
    };
  };
  layers.forEach((l, i) => {
    const len = l.cycle_len;
    let on = l.onsets;
    const isMain = i === main || tr.allLayers;
    if (want('rotate') && isMain) on = T.rotate(on, len, tr.rotate);
    if (want('reverse') && isMain) on = T.reverse(on, len);
    if (want('complement') && isMain) on = T.complement(on, len);
    if (want('phase') && tr.phase && tr.phase.layer === i) on = T.phase(on, len, tr.phase.k);
    if (want('binarize') && len === 12 && isMain) {
      warnings.push('Binarización 12→16: hipótesis de Pérez Fernández, como experimento auditivo.');
      on = T.binarize(on, 12, 16, tr.binarizeRounding || 'nearest');
    }
    if (want('density') && (isMain || tr.allLayers) && len === n) on = T.density(on, len, norm.weights, clamp(tr.density, -1, 1), rng, locked);
    if (on !== l.onsets) layers[i] = remap(l, on);
  });
  if (norm.layers.some((l) => l.cycle_len === 12) && tr.binarize && allowed.has('binarize')) {
    // binarizar cambia la longitud del ciclo a 16 y el paso a semicorchea dentro de la misma duración
    norm = { ...norm, cycle_len: 16, step_value: (norm.cycle_len * norm.step_value) / 16, weights: require('./meter').LHL_16 };
    layers.forEach((l) => { l.cycle_len = 16; });
  }
  // síncopa objetivo sobre la capa principal (COG.3.3)
  if (typeof opts.syncopation === 'number' && layers[main] && layers[main].cycle_len === norm.cycle_len && layers[main].onsets.length > 1) {
    const on = mutateTowardTarget(layers[main].onsets, norm.weights, clamp(opts.syncopation, 0, 1), rng.fork('sync'), { locked });
    layers[main] = remap(layers[main], on);
  }
  // modo Adaptable (§6.2): ataques nuevos en los huecos del arreglo
  if (opts.complement && Array.isArray(opts.complement.occupancy) && opts.complement.amount > 0) {
    const setMeter = parseMeter(opts.timeSignature || '4/4');
    const occ = T.resampleOccupancy(opts.complement.occupancy, norm.cycle_len, norm.step_value, (setMeter.num * 4) / setMeter.den);
    const targets = opts.complement.allLayers ? layers.map((_, i) => i) : [main];
    for (const i of targets) {
      if (!layers[i] || layers[i].cycle_len !== norm.cycle_len) continue;
      const on = T.complementTo(layers[i].onsets, norm.cycle_len, occ, clamp(opts.complement.amount, 0, 1), rng.fork('comp' + i), { locked });
      layers[i] = remap(layers[i], on);
    }
  }
  return { ...norm, layers, mainIndex: main };
}

// ---------------------------------------------------------------- repeticiones
// repeats: número, 'auto' (política del patrón) o 'full' (ciclo completo contra el compás del set).
function planRepeats(norm, opts = {}) {
  const pol = norm.repeat_policy || { mode: 'fixed', default_repeats: 4, variation_on_last: 'none' };
  const cycleBeats = norm.cycle_len * norm.step_value;
  const setMeter = parseMeter(opts.timeSignature || '4/4');
  const barBeats = (setMeter.num * 4) / setMeter.den;
  let repeats;
  if (opts.repeats === 'full') {
    // mínimo común múltiplo en ticks para que el bucle cierre con el compás del set
    const q = 960;
    const total = lcm(Math.round(cycleBeats * q), Math.round(barBeats * q)) / q;
    repeats = Math.max(1, Math.round(total / cycleBeats));
  } else if (Number.isInteger(opts.repeats) && opts.repeats > 0) repeats = opts.repeats;
  else repeats = pol.default_repeats;
  let extraTihai = 0;
  if (pol.mode === 'tihai' && opts.variation !== 'none' && (opts.variation || pol.variation_on_last) === 'tihai') extraTihai = 1;
  repeats += extraTihai;
  if (pol.mode === 'lcm' && pol.max_bars) {
    const maxCycles = Math.max(1, Math.floor((pol.max_bars * barBeats) / cycleBeats));
    repeats = Math.min(repeats, maxCycles);
  }
  const variation = opts.variation && opts.variation !== 'auto' ? opts.variation : pol.variation_on_last || 'none';
  return {
    mode: pol.mode, repeats, cycleBeats, totalBeats: repeats * cycleBeats, barBeats,
    bars: (repeats * cycleBeats) / barBeats,
    variation, variationCycle: variation === 'none' ? null : repeats - 1,
  };
}

// ---------------------------------------------------------------- eventos
function layerEvents(norm, li, cycle) {
  const l = norm.layers[li];
  const n = norm.cycle_len;
  const params = norm.params || {};
  let onsets = l.onsets;
  // PRO.11 · desplazamiento discreto de una capa cada N ciclos
  if (params.shift_every && params.shift_layer === li) onsets = onsets.map((o) => mod(o + Math.floor(cycle / params.shift_every), l.cycle_len));
  const out = [];
  // una capa con ciclo propio (polimetría) se repite dentro del ciclo del patrón
  for (let start = 0; start < n; start += l.cycle_len) {
    onsets.forEach((o, i) => {
      const s = start + o;
      if (s >= n) return;
      out.push({
        layer: li, role: l.role, cycle, stepInCycle: s, step: cycle * n + s,
        velocity: l.velocity[i], timbre: l.timbre[i], micro: l.microtiming[i], gate: l.gate[i], probability: l.probability[i],
        swing: l.swing,
      });
    });
  }
  return out;
}

function stepsPerBeat(norm) { return Math.max(1, Math.round(1 / norm.step_value)); }

function applyVariation(events, norm, plan, rng) {
  if (plan.variationCycle === null) return events;
  const c = plan.variationCycle;
  const n = norm.cycle_len;
  const spb = stepsPerBeat(norm);
  const main = norm.mainIndex;
  const inLast = (e) => e.cycle === c;
  const lastBeatStart = n - Math.min(n, spb);
  const mainLayer = norm.layers[main] || { role: 'main' };
  const base = (stepInCycle, vel, extra = {}) => ({
    layer: main, role: mainLayer.role, cycle: c, stepInCycle, step: c * n + stepInCycle, velocity: vel,
    timbre: (mainLayer.timbre && mainLayer.timbre[0]) || 0, micro: 0, gate: Math.min(norm.step_value, 0.25), probability: 1, swing: null, variation: true, ...extra,
  });
  const ramp = (k, total) => Math.round(70 + (50 * (k + 1)) / total);
  switch (plan.variation) {
    case 'fill':
    case 'virada':
    case 'density_up': {
      const from = plan.variation === 'fill' ? lastBeatStart : Math.floor(n / 2);
      const amount = plan.variation === 'density_up' ? 0.4 : 0.6;
      const keep = events.filter((e) => !(inLast(e) && e.layer === main && e.stepInCycle >= from));
      const span = range(n - from).map((k) => from + k);
      const existing = events.filter((e) => inLast(e) && e.layer === main && e.stepInCycle >= from).map((e) => e.stepInCycle);
      const extra = span.filter((s) => !existing.includes(s) && rng.chance(amount));
      const all = [...new Set([...existing, ...extra])].sort((a, b) => a - b);
      return [...keep, ...all.map((s, k) => base(s, ramp(k, all.length)))];
    }
    case 'hat_triplet_fill':
    case 'trap_roll': {
      const div = plan.variation === 'trap_roll' ? 8 : 3; // fusas o tresillo por negra
      const keep = events.filter((e) => !(inLast(e) && e.layer === main && e.stepInCycle >= lastBeatStart));
      const add = range(div).map((k) => base(lastBeatStart + (k * spb) / div, ramp(k, div), { gate: 1 / div / 2 }));
      return [...keep, ...add];
    }
    case 'tihai': {
      // PRO.16 · frase de P pasos ×3 con huecos G; la llegada es el sam del inicio del bucle (ciclo 0, paso 0)
      const G = n >= 12 ? 1 : 0;
      const P = Math.max(1, Math.floor((n - 1 - 2 * G) / 3));
      const start = tihaiStart(P, G, n);
      const phrase = euclid(Math.max(1, Math.ceil(P / 2)), P).map((o) => o - (euclid(Math.max(1, Math.ceil(P / 2)), P)[0] || 0));
      const keep = events.filter((e) => !(inLast(e) && e.layer === main && e.stepInCycle >= start));
      const add = [];
      for (let k = 0; k < 3; k++) for (const o of phrase) add.push(base(start + k * (P + G) + o, 100 + 9 * k, { tihai: true }));
      return [...keep, ...add.filter((e) => e.stepInCycle < n)];
    }
    case 'gong':
      return events.map((e) => (inLast(e) && e.role === 'gong' ? { ...e, velocity: 127, gate: e.gate * 2, variation: true } : e));
    case 'llamada': {
      // Aproximación de diseño: el último compás conserva solo los acentos y remata en el 4.º acento;
      // los pasos siguientes quedan en silencio antes de volver al inicio del ciclo.
      const acc = norm.layers.find((l) => l.role === 'accent');
      const accents = acc ? acc.onsets : (norm.grouping ? require('./cycles').groupStarts(norm.grouping) : [0]);
      const stop = accents[Math.min(3, accents.length - 1)];
      return events
        .filter((e) => !inLast(e) || (accents.includes(e.stepInCycle) && e.stepInCycle <= stop))
        .map((e) => (inLast(e) ? { ...e, velocity: 127, variation: true } : e));
    }
    case 'dropout':
      // RGG.8.2 · se retira el ritmo en la segunda mitad del último ciclo; el regreso es el inicio del bucle
      return events.filter((e) => !(inLast(e) && e.stepInCycle >= n / 2));
    default:
      return events;
  }
}

function buildEvents(norm, plan, rng) {
  let events = [];
  for (let c = 0; c < plan.repeats; c++) for (let li = 0; li < norm.layers.length; li++) events.push(...layerEvents(norm, li, c));
  events = applyVariation(events, norm, plan, rng.fork('variation'));
  return events.sort((a, b) => a.step - b.step || a.layer - b.layer);
}

// ---------------------------------------------------------------- tiempo
function resolveTemplate(opts, data) {
  const id = opts.microtiming || null;
  if (!id || !data || !data.microtiming) return null;
  return data.microtiming.templates.find((t) => t.id === id) || null;
}

// Tiempo en negras de cada evento, con swing, plantilla, rejilla deformable y humanizador.
function timeEvents(events, norm, opts, rng, data, warnings) {
  const bpm = opts.bpm || 120;
  const sv = norm.step_value;
  const spb = stepsPerBeat(norm);
  const tpl = resolveTemplate(opts, data);
  const meter = parseMeter(norm.meter);
  const barBeats = (meter.num * 4) / meter.den;
  const barSteps = Math.round(barBeats / sv);
  let grid = null;
  if (tpl && tpl.beat_proportions && tpl.beat_proportions.length === Math.round(barBeats) && Math.abs(Math.round(barBeats) - barBeats) < EPS) {
    grid = gridFromBeatProportions(tpl.beat_proportions, spb);
  } else if (tpl && tpl.beat_proportions) warnings.push(`La plantilla ${tpl.id} requiere ${tpl.beat_proportions.length} pulsos por compás; se ignora.`);
  if (tpl && tpl.step_offsets && tpl.step_offsets.length !== spb) warnings.push(`La plantilla ${tpl.id} tiene ${tpl.step_offsets.length} subdivisiones y el patrón ${spb}; se ignora.`);
  if (tpl && (tpl.step_offsets === null || (tpl.beat_proportions === null && !tpl.step_offsets && tpl.global_offset === undefined))) warnings.push(`La plantilla ${tpl.id} no tiene valores (dato por verificar).`);
  // swing global (opción) en unidades de `unit` pasos
  const sw = opts.swing || null;
  const swUnit = sw ? Math.max(1, Math.round((sw.level || 0.25) / sv)) : 0;
  const swOff = sw ? swingOddOffset(effectiveSwingRatio(sw.ratio || 1, bpm, sw.coupling || 0)) * swUnit : 0;
  // humanizador por capa
  const hum = opts.humanize && opts.humanize.sigmaMs > 0 ? opts.humanize : null;
  const humByLayer = new Map();
  if (hum) {
    for (const li of new Set(events.map((e) => e.layer))) {
      const count = events.filter((e) => e.layer === li).length;
      humByLayer.set(li, { i: 0, offs: brownianOffsets(count, rng.fork('hum' + li), hum) });
    }
  }
  const layerSwingUnit = Math.max(1, Math.round(((norm.params && norm.params.swing_level) || 0.5) / sv));
  return events.map((e) => {
    let off = e.micro || 0; // en pasos
    const s = e.stepInCycle;
    const intStep = Math.abs(s - Math.round(s)) < EPS;
    if (intStep) {
      const si = Math.round(s);
      if (e.swing && e.swing > 1) off += swingOddOffset(effectiveSwingRatio(e.swing, bpm, (norm.params && norm.params.tempo_coupling) || 0)) * (si % layerSwingUnit === 0 && Math.floor(si / layerSwingUnit) % 2 === 1 ? layerSwingUnit : 0);
      if (sw && si % swUnit === 0 && Math.floor(si / swUnit) % 2 === 1) off += swOff;
      if (tpl && tpl.step_offsets && tpl.step_offsets.length === spb) off += tpl.step_offsets[mod(si, spb)];
    }
    if (tpl && typeof tpl.global_offset === 'number') off += tpl.global_offset;
    let t;
    if (grid && intStep && barSteps === grid.length) {
      const absStep = e.cycle * norm.cycle_len + s;
      const bar = Math.floor(absStep / barSteps);
      t = bar * barBeats + grid[mod(Math.round(absStep), barSteps)] * barBeats + off * sv;
    } else t = (e.cycle * norm.cycle_len + s + off) * sv;
    if (hum) { const h = humByLayer.get(e.layer); t += msToBeats(h.offs[h.i++], bpm); }
    return { ...e, time: t };
  });
}

// ---------------------------------------------------------------- acentos, velocity y salida
function accentAndVelocity(events, norm, opts, rng) {
  const wN = normalizeWeights(norm.weights);
  const acc = opts.accent || { velocity: 0, duration: 0, pitch: 0, cc: 0 };
  const vr = opts.velocityRange || null;
  return events.map((e) => {
    const s = wN[mod(Math.round(e.stepInCycle), norm.cycle_len)] ?? 0.5;
    let v = e.velocity * (1 - (acc.velocity || 0) * 0.45 * (1 - s));
    if (vr) v = vr[0] + ((v - 1) / 126) * (vr[1] - vr[0]);
    const gate = e.gate * (1 + (acc.duration || 0) * 0.6 * s);
    const octave = acc.pitch && s > 0.85 && rng.chance(acc.pitch) ? 12 : 0;
    return { ...e, velocity: clamp(Math.round(v), 1, 127), gate, accentStrength: s, accentOctave: octave, cc: acc.cc ? Math.round(127 * s * acc.cc) : null };
  });
}

// Envuelve y recorta para que el bucle cierre: los ataques anticipados en el paso 0 pasan al final (D-006).
function finalizeNotes(notes, totalBeats) {
  const placed = notes
    .map((n) => {
      let st = n.start_time;
      if (st < 0) st += totalBeats;
      if (st >= totalBeats - EPS) st -= totalBeats;
      st = clamp(st, 0, totalBeats - 1e-4);
      const dur = clamp(n.duration, 1 / 64, Math.max(1 / 64, totalBeats - st));
      return { ...n, start_time: +st.toFixed(6), duration: +dur.toFixed(6) };
    });
  // dos capas en la misma nota y el mismo instante (p. ej. tali y matra en un mapa por timbre): queda la más fuerte
  const best = new Map();
  for (const n of placed) {
    const k = `${n.pitch}@${n.start_time.toFixed(4)}`;
    const cur = best.get(k);
    if (!cur || n.velocity > cur.velocity) best.set(k, n);
  }
  const sorted = [...best.values()].sort((a, b) => a.start_time - b.start_time || a.pitch - b.pitch);
  // Live no admite dos notas de la misma altura solapadas: acorta la anterior hasta el inicio de la siguiente
  // (comprobado en Live 12.4.6 con Producer Pal, D-036)
  const lastByPitch = new Map();
  for (const n of sorted) {
    const prev = lastByPitch.get(n.pitch);
    if (prev && prev.start_time + prev.duration > n.start_time) prev.duration = +(n.start_time - prev.start_time).toFixed(6);
    lastByPitch.set(n.pitch, n);
  }
  return sorted;
}

const destinations = {
  chords: () => require('./destinations/chords'),
  bassline: () => require('./destinations/bassline'),
  arpeggio: () => require('./destinations/arpeggio'),
  hihats: () => require('./destinations/hihats'),
  ethnic: () => require('./destinations/ethnic'),
  others: () => require('./destinations/others'),
};

// Punto de entrada. pattern: patrón de data/patterns; data: { drumMaps, microtiming } (opcional).
// opts: { destination, harmony: {root, intervals, id}, seed, repeats, variation, bpm, timeSignature,
//         transform, syncopation, swing, microtiming, humanize, accent, velocityRange, lock, allowStructural,
//         category, … opciones propias del destino }
function generate(pattern, opts = {}, data = {}) {
  const warnings = [];
  const restricted = !!(pattern.restricted_use || (pattern.origin && pattern.origin.restricted_use));
  if (restricted && !(pattern.structural_only && opts.allowStructural)) {
    throw new Error(`${pattern.id} es de uso restringido; solo se admite como principio estructural (allowStructural).`);
  }
  const destination = opts.destination || (pattern.destinations && pattern.destinations[0]) || 'others';
  if (!destinations[destination]) throw new Error(`Destino desconocido: ${destination}`);
  if (pattern.destinations && !pattern.destinations.includes(destination)) warnings.push(`${pattern.id} no está pensado para ${destination}; se genera igualmente.`);
  const seed = opts.seed ?? 1;
  const rng = createRng(seed);
  let norm = normalizePattern(pattern, { rng: rng.fork('pattern') });
  norm = applyTransforms(norm, opts, rng.fork('transform'), warnings);
  if (isTextureRate(norm.step_value, opts.bpm || 120)) warnings.push('Hay intervalos menores de 100 ms: se perciben como textura (MET.1).');
  const plan = planRepeats(norm, opts);
  let events = buildEvents(norm, plan, rng.fork('events'));
  events = timeEvents(events, norm, opts, rng.fork('timing'), data, warnings);
  events = accentAndVelocity(events, norm, opts, rng.fork('accent'));
  const ctx = { norm, plan, opts, rng: rng.fork('dest:' + destination), data, warnings, category: opts.category || (pattern.categories || [])[0] || null };
  let notes = destinations[destination]().render(events, ctx);
  // capas bloqueadas: se copian las notas previas de esos roles (bloqueo por capa)
  if (opts.lock && opts.lock.previous && Array.isArray(opts.lock.roles) && opts.lock.roles.length) {
    const locked = new Set(opts.lock.roles);
    notes = [...notes.filter((n) => !locked.has(n.role)), ...opts.lock.previous.notes.filter((n) => locked.has(n.role))];
  }
  notes = finalizeNotes(notes, plan.totalBeats);
  if (!notes.length) warnings.push(pattern.missing_data ? 'El patrón tiene datos faltantes (por verificar): complétalo en el editor antes de generar.' : 'La generación no produjo notas con estos ajustes.');
  return {
    notes,
    length_beats: plan.totalBeats,
    loop: { start: 0, end: plan.totalBeats },
    plan,
    meta: {
      pattern: pattern.id, name: pattern.name, destination, seed, status: pattern.status, verify: !!pattern.verify,
      tradition: pattern.origin && pattern.origin.tradition, sources: pattern.origin && pattern.origin.sources,
      harmony: opts.harmony || null, cultural_note: pattern.cultural_note || null, warnings,
      cycle_len: norm.cycle_len, step_value: norm.step_value, cycle_beats: plan.cycleBeats,
    },
  };
}

// Variación suave: misma configuración con una semilla derivada y una mutación pequeña de síncopa.
function vary(pattern, opts = {}, data = {}, amount = 0.3) {
  const seed = `${opts.seed ?? 1}~v${opts.variationIndex ?? 1}`;
  const base = typeof opts.syncopation === 'number' ? opts.syncopation : 0.3;
  const delta = (createRng(seed).next() - 0.5) * amount;
  return generate(pattern, { ...opts, seed, syncopation: clamp(base + delta, 0, 1) }, data);
}

// Para la interfaz y las pruebas: notas que no pertenecen a la escala (debería estar vacío salvo notas de paso declaradas).
function outOfScale(result, harmony) {
  const pcs = new Set(harmony.intervals.map((i) => mod(harmony.root + i, 12)));
  return result.notes.filter((n) => !n.passing && !pcs.has(mod(n.pitch, 12)));
}

module.exports = { generate, vary, planRepeats, applyTransforms, buildEvents, timeEvents, finalizeNotes, mainLayerIndex, outOfScale, stepsPerBeat };

};
__svDefs["src/core/destinations/chords.js"] = function (module, exports, require) {
'use strict';
// Destino Chords: voicings por grado y modo, stabs, anticipaciones, ritmo armónico, colchón y eco.
// Estilo Dub Techno (D-023): tríada del grado I en estado fundamental, fija, registro centrado en ~62
// (corpus DDT: 0-3-7 sobre la tónica en 170 de 200 eventos, raíz entre 57 y 66), stab corto.
const { chordPitches, placeChord, tonicNear } = require('../harmony');
const { harmonyOf, degreeAt, segmentIndex, note } = require('./common');

const CHORD_ROLES = new Set(['chord', 'chord_low', 'pad', 'stab', 'skank']);

function styleDefaults(ctx) {
  const cat = ctx.category;
  if (cat === 'dub_techno') return { center: 62, voicing: 'root', size: 3, gateScale: 1 };
  if (cat === 'dub_reggae') return { center: 67, voicing: 'closest', size: 3, gateScale: 1 };
  return { center: 62, voicing: 'closest', size: 3, gateScale: 1 };
}

function render(events, ctx) {
  const o = ctx.opts;
  const st = styleDefaults(ctx);
  const h = harmonyOf(ctx);
  const size = Math.min(6, Math.max(2, o.chordSize || st.size));
  const shape = o.chordShape || 'tertian';
  const center = o.center ?? st.center;
  const voicing = o.voicing || st.voicing;
  const range = o.range || [36, 96];
  const tonic = tonicNear(h, center - 2);
  const gateScale = o.gateScale ?? st.gateScale;
  const antic = o.anticipation ? (o.anticipationBeats || 0.25) : 0;

  // qué eventos son acordes: roles de acorde; si el patrón no los tiene, la capa principal
  let src = events.filter((e) => CHORD_ROLES.has(e.role));
  if (!src.length) src = events.filter((e) => e.layer === ctx.norm.mainIndex);

  // un voicing por segmento armónico, con conducción de voces entre segmentos
  const cache = new Map();
  let prev = null;
  const voicingFor = (deg, seg, low) => {
    const key = `${seg}:${deg}:${low ? 1 : 0}`;
    if (cache.has(key)) return cache.get(key);
    const raw = chordPitches(h, deg, tonic, size, shape);
    const placed = placeChord(raw, { mode: voicing, center: low ? center - 12 : center, prev: low ? null : prev, range });
    if (!low) prev = placed;
    cache.set(key, placed);
    return placed;
  };

  const out = [];
  for (const e of src) {
    const deg = degreeAt(e.time, ctx, antic);
    const seg = segmentIndex(e.time + antic, ctx);
    const low = e.role === 'chord_low';
    let pitches = voicingFor(deg, seg, low);
    if (low && o.bubbleSplit !== false) pitches = pitches.slice(0, 2); // mano izquierda del bubble: dos notas graves
    const dur = Math.max(1 / 32, e.gate * gateScale);
    for (const p of pitches) out.push(note(e, p, dur, ctx, { degree: deg }));
    // PRO.19 · ritmo de delay como notas de eco (opcional; útil sin un delay en la pista)
    if (o.echo && o.echo.repeats > 0) {
      const ratio = o.echo.ratioBeats || 0.75; // corchea con puntillo
      for (let k = 1; k <= o.echo.repeats; k++) {
        const v = Math.round(e.velocity * (o.echo.feedback ?? 0.5) ** k);
        if (v < 8) break;
        for (const p of pitches) out.push(note({ ...e, time: e.time + k * ratio, velocity: v }, p, dur, ctx, { degree: deg, role: 'echo', echo: k }));
      }
    }
  }
  // colchón opcional (capa de acorde sostenido): un acorde largo por segmento armónico
  if (o.pad) {
    const segBeats = (o.harmonicRhythmBars || ctx.plan.bars) * ctx.plan.barBeats;
    for (let t = 0; t < ctx.plan.totalBeats - 1e-9; t += Math.min(segBeats, ctx.plan.totalBeats)) {
      const deg = degreeAt(t, ctx);
      // una octava bajo los stabs para que no coincida en altura e instante con ellos
      const pitches = placeChord(chordPitches(h, deg, tonic, size, shape), { mode: 'root', center: center - 12, range });
      for (const p of pitches) out.push(note({ time: t, velocity: o.padVelocity || 64, probability: 1, role: 'pad', layer: -1, cycle: 0, stepInCycle: 0 }, p, Math.min(segBeats, ctx.plan.totalBeats - t) - 0.01, ctx, { degree: deg }));
    }
  }
  return out;
}

module.exports = { render, styleDefaults, CHORD_ROLES };

};
__svDefs["src/core/destinations/common.js"] = function (module, exports, require) {
'use strict';
// Piezas compartidas por los destinos.
const { defaultProgression } = require('../harmony');

const MINOR = { root: 9, intervals: [0, 2, 3, 5, 7, 8, 10], id: 'minor' }; // La menor por defecto

const harmonyOf = (ctx) => ctx.opts.harmony || MINOR;

// Progresión de grados y ritmo armónico (MET.2.5: cambio cada 1, 2, 4 u 8 compases).
function progressionOf(ctx) {
  const h = harmonyOf(ctx);
  const prog = Array.isArray(ctx.opts.progression) && ctx.opts.progression.length ? ctx.opts.progression : defaultProgression(ctx.category, h.intervals.length);
  const hr = ctx.opts.harmonicRhythmBars || (ctx.category === 'dub_techno' ? 0 : 2); // 0 = acorde fijo
  return { prog, hrBars: hr };
}

// Grado vigente en el tiempo t (en negras). anticipate = negras de anticipación (ACE.2.3).
function degreeAt(t, ctx, anticipate = 0) {
  const { prog, hrBars } = progressionOf(ctx);
  if (!hrBars || prog.length === 1) return prog[0];
  const segBeats = hrBars * ctx.plan.barBeats;
  const seg = Math.floor((t + anticipate + 1e-9) / segBeats);
  return prog[((seg % prog.length) + prog.length) % prog.length];
}

const segmentIndex = (t, ctx) => {
  const { hrBars } = progressionOf(ctx);
  return hrBars ? Math.floor((t + 1e-9) / (hrBars * ctx.plan.barBeats)) : 0;
};

// Nota en el formato de add_new_notes de Live (los campos extra los quita el adaptador).
function note(e, pitch, duration, ctx, extra = {}) {
  return {
    pitch, start_time: e.time, duration, velocity: e.velocity, mute: 0,
    probability: e.probability ?? 1, velocity_deviation: ctx.opts.velocityDeviation || 0,
    role: e.role, layer: e.layer, cycle: e.cycle, step: e.stepInCycle, variation: !!e.variation, ...extra,
  };
}

// Duración monofónica: no pisa la nota siguiente.
function monophonic(notes, gap = 0.02) {
  const s = notes.slice().sort((a, b) => a.start_time - b.start_time);
  for (let i = 0; i < s.length - 1; i++) {
    const room = s[i + 1].start_time - s[i].start_time - gap;
    if (room <= 0) { s[i].drop = true; continue; }
    s[i].duration = Math.min(s[i].duration, room);
  }
  return s.filter((n) => !n.drop);
}

module.exports = { MINOR, harmonyOf, progressionOf, degreeAt, segmentIndex, note, monophonic };

};
__svDefs["src/core/destinations/bassline.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/destinations/arpeggio.js"] = function (module, exports, require) {
'use strict';
// Destino Arpeggio: direcciones, subdivisión como métrica (ciclos de 3, 5 o 7 notas sobre la rejilla →
// hemiola y polimetría) y entrelazado de dos voces (SUP.4).
const { chordPitches, tonicNear } = require('../harmony');
const { harmonyOf, degreeAt, note } = require('./common');

function orderTones(tones, direction, rng) {
  const up = tones.slice().sort((a, b) => a - b);
  switch (direction) {
    case 'down': return up.slice().reverse();
    case 'updown': return [...up, ...up.slice(1, -1).reverse()];
    case 'converge': {
      const out = [];
      let i = 0; let j = up.length - 1;
      while (i <= j) { out.push(up[i++]); if (i <= j) out.push(up[j--]); }
      return out;
    }
    case 'random': return rng.shuffle(up);
    default: return up;
  }
}

function render(events, ctx) {
  const o = ctx.opts;
  const h = harmonyOf(ctx);
  const rng = ctx.rng;
  const center = o.center ?? 64;
  const tonic = tonicNear(h, center - 5);
  const size = o.arpChordSize || 3;
  const octaves = Math.max(1, o.octaves || 2);
  const direction = o.direction || 'up';
  const cycleN = o.arpCycle || null; // 3, 5 o 7: ciclo polimétrico de notas
  const sv = ctx.norm.step_value;

  // ritmo: eventos del patrón, o corriente continua a `rate` negras con acento donde el patrón ataca
  let src;
  if (o.stream) {
    const rate = o.rate || 0.25;
    const hits = new Set(events.filter((e) => e.layer === ctx.norm.mainIndex).map((e) => Math.round(e.time / rate)));
    src = [];
    for (let t = 0, k = 0; t < ctx.plan.totalBeats - 1e-9; t += rate, k++) {
      src.push({ time: t, velocity: hits.has(k) ? 108 : 78, probability: 1, role: 'arp', layer: 0, cycle: Math.floor(t / ctx.plan.cycleBeats), stepInCycle: Math.round((t % ctx.plan.cycleBeats) / sv), gate: rate * 0.8, accentOctave: 0 });
    }
  } else src = events.filter((e) => e.layer === ctx.norm.mainIndex);

  const out = [];
  const cacheDeg = new Map();
  src.forEach((e, idx) => {
    const deg = degreeAt(e.time, ctx);
    if (!cacheDeg.has(deg)) {
      const base = chordPitches(h, deg, tonic, size);
      const tones = [];
      for (let oc = 0; oc < octaves; oc++) for (const p of base) tones.push(p + 12 * oc);
      cacheDeg.set(deg, orderTones(tones, direction, rng.fork('dir' + deg)));
    }
    const seq = cacheDeg.get(deg);
    const pos = cycleN ? idx % cycleN : idx % seq.length;
    let pitch = seq[pos % seq.length];
    let role = 'arp';
    if (o.interleave) {
      // SUP.4 · dos voces que se alternan (hoquetus); la segunda una octava arriba
      if (idx % 2 === 1) { pitch += 12; role = 'arp_b'; } else role = 'arp_a';
    }
    if (e.accentOctave) pitch += 12;
    while (pitch > 108) pitch -= 12;
    out.push(note({ ...e, role }, pitch, Math.max(0.05, e.gate ?? sv * 0.8), ctx, { degree: deg }));
  });
  return out;
}

module.exports = { render, orderTones };

};
__svDefs["src/core/destinations/hihats.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/destinations/drums.js"] = function (module, exports, require) {
'use strict';
// Resolución de golpe → nota MIDI con los mapas de data/drum_maps.json (editables por el usuario).

// Alias de roles del catálogo hacia los nombres de los mapas.
const ALIAS = {
  timeline: 'claves', bell: 'cowbell', clave: 'claves', surdo: 'kick', bombo: 'kick', alfaia: 'alfaia_grave',
  llamador: 'conga_open', guacharaca: 'guiro', darbuka: null, palmas: 'palma_sorda', accent: 'palma_abierta',
  group: 'perc_1', beat: 'perc_1', cell: 'perc_1', euclid: 'perc_1', ratio_2: 'perc_2', ratio_3: 'perc_1', ratio_4: 'perc_3',
  clap: 'clap', matra: 'perc_2', anga: 'perc_1', golpe: 'kick', sacudida: 'shaker', base: 'kick', pulse: 'tom', improvising: 'rim',
  six_eight: 'perc_1', three_four: 'perc_2', layer_a: 'perc_1', layer_b: 'perc_2', fixed: 'clap', shifting: 'rim',
  conga: 'conga_open', woodblock: 'woodblock_hi', tamborim: 'rim', chico_abierto: 'chico_abierto', gak: 'kick',
  tom: 'tom_mid', tom_mid: 'tom', ride_bell: 'ride', hat_open: 'hat_open',
};

// Mapa por defecto según el patrón (tradición) y el destino.
function chooseMap(pattern, destination, maps, override) {
  const byId = (id) => maps.find((m) => m.id === id);
  if (override && byId(override)) return byId(override);
  if (pattern.params && pattern.params.drum_map && byId(pattern.params.drum_map)) return byId(pattern.params.drum_map);
  const id = pattern.id || '';
  if (destination === 'hihats') return byId('hihats_gm');
  if (/^CIC\.4\.(3|4)/.test(id)) return byId('iqa_dum_tak');
  if (/^CIC\.4\.(1|2)/.test(id)) return byId('tala_bols');
  if (/^CIC\.4\.5/.test(id)) return byId('janggu');
  if (/^CIC\.5/.test(id)) return byId('gamelan_colotomic');
  if (/^CIC\.7/.test(id)) return byId('cajon_flamenco');
  if ((pattern.categories || []).includes('latin_percussion')) return byId('gm_percussion');
  if (/^RGG/.test(id) || (pattern.categories || []).includes('dub_reggae')) return byId('dub_kit');
  return byId('drum_rack_default');
}

// Devuelve una función role/timbre → nota. Los roles sin nota reciben pads libres en orden de aparición.
function makeResolver(map, fallbacks = []) {
  const used = new Set(Object.values(map.roles || {}));
  const extra = new Map();
  let nextPad = 36;
  const freePad = () => {
    while (used.has(nextPad) && nextPad < 52) nextPad++;
    const p = nextPad < 52 ? nextPad : 60 + extra.size;
    used.add(p);
    return p;
  };
  const lookup = (m, role) => {
    if (!m || !m.roles) return undefined;
    if (m.roles[role] !== undefined) return m.roles[role];
    const a = ALIAS[role];
    if (a && m.roles[a] !== undefined) return m.roles[a];
    return undefined;
  };
  return (role, timbre = 0) => {
    if (map.by_timbre && map.timbre) return map.timbre[String(timbre)] ?? map.timbre['0'];
    let p = lookup(map, role);
    for (const f of fallbacks) { if (p !== undefined) break; p = lookup(f, role); }
    if (p !== undefined) return p;
    if (!extra.has(role)) extra.set(role, freePad());
    return extra.get(role);
  };
}

module.exports = { chooseMap, makeResolver, ALIAS };

};
__svDefs["src/core/destinations/ethnic.js"] = function (module, exports, require) {
'use strict';
// Destino Ethnic drums: golpes con timbre (grave / agudo / abierto / apagado) mapeados por tradición:
// dum/tak, sam/tali/khali, gongs colotómicos, claves, capas latinas y kits de dub (drum_maps.json).
const { chooseMap, makeResolver } = require('./drums');
const { note } = require('./common');

const LONG = { gong: 2, kempul: 1, kenong: 0.8, pad: 2 };

function render(events, ctx) {
  const o = ctx.opts;
  const maps = (ctx.data.drumMaps && ctx.data.drumMaps.maps) || [];
  const map = chooseMap(ctx.norm.source, 'ethnic', maps, o.drumMap) || { id: 'rack', roles: { kick: 36 } };
  const rack = maps.find((m) => m.id === 'drum_rack_default');
  const resolve = makeResolver(map, rack ? [rack] : []);
  ctx.meta = { ...(ctx.meta || {}), drumMap: map.id };
  return events.map((e) => {
    const pitch = resolve(e.role, e.timbre);
    const dur = LONG[e.role] ? Math.max(e.gate, LONG[e.role]) : Math.max(0.05, Math.min(e.gate || 0.1, 0.5));
    return note(e, pitch, dur, ctx, { drumMap: map.id, timbre: e.timbre });
  });
}

module.exports = { render };

};
__svDefs["src/core/destinations/others.js"] = function (module, exports, require) {
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

};
__svDefs["src/core/analysis.js"] = function (module, exports, require) {
'use strict';
// Modo Adaptable (§6): análisis puro de las notas MIDI leídas del set.
// Entrada: pistas [{ name, isDrum, notes: [{ pitch, start_time, duration, velocity }], length }].
const { mod } = require('./util');

// Perfiles de Krumhansl y Kessler (1982), usados por el algoritmo de Krumhansl-Schmuckler.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Histograma de clases de altura ponderado por duración (y levemente por velocity).
function pitchClassHistogram(notes) {
  const h = new Array(12).fill(0);
  for (const n of notes) h[mod(n.pitch, 12)] += (n.duration || 0.25) * (0.5 + (n.velocity || 100) / 254);
  return h;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// Krumhansl-Schmuckler: correlación del histograma con los 24 perfiles rotados.
function estimateKey(hist) {
  const total = hist.reduce((s, v) => s + v, 0);
  if (total <= 0) return { root: null, mode: null, name: null, confidence: 0, ranking: [] };
  const ranking = [];
  for (let r = 0; r < 12; r++) {
    for (const [mode, prof] of [['major', KK_MAJOR], ['minor', KK_MINOR]]) {
      const rot = prof.map((_, i) => prof[mod(i - r, 12)]);
      ranking.push({ root: r, mode, name: `${PC[r]} ${mode === 'major' ? 'mayor' : 'menor'}`, r: pearson(hist, rot) });
    }
  }
  ranking.sort((a, b) => b.r - a.r);
  const best = ranking[0];
  const second = ranking[1];
  // confianza: correlación del ganador y separación respecto del segundo
  const confidence = Math.max(0, Math.min(1, best.r * 0.7 + (best.r - second.r) * 3));
  return { root: best.root, mode: best.mode, name: best.name, r: best.r, confidence, ranking: ranking.slice(0, 5) };
}

// Desempate a favor de las escalas más usadas cuando la evidencia es ambigua.
const COMMON = { minor: 0.015, major: 0.015, dorian: 0.008, mixolydian: 0.008, minor_pentatonic: 0.008, major_pentatonic: 0.008 };

// Escala de la biblioteca que mejor cubre el histograma con la raíz dada (o con cualquier raíz).
// Puntuación: peso cubierto (lo que suena fuera de la escala resta mucho) − pequeña penalización por notas
// de la escala que no suenan + preferencia por los modos diatónicos coherentes con el modo estimado.
// Con pocas clases de altura (p. ej. dos tríadas) muchas escalas exóticas «cubren» todo; la preferencia
// evita elegir hirajōshi para Re–Fa–La–Sib (D-037). La interfaz muestra las cinco candidatas para corregir.
const MODE_PRIOR = {
  minor: { minor: 0.06, dorian: 0.04, phrygian: 0.03, harmonic_minor: 0.02, minor_pentatonic: 0.02 },
  major: { major: 0.06, mixolydian: 0.04, lydian: 0.03, major_pentatonic: 0.02 },
};
function matchScale(hist, scales, root = null, mode = null) {
  const total = hist.reduce((s, v) => s + v, 0) || 1;
  const sounding = hist.filter((v) => v > total * 0.01).length;
  const silentWeight = sounding >= 6 ? 0.04 : 0.01;
  const prior = (mode && MODE_PRIOR[mode]) || {};
  const out = [];
  const roots = root === null ? [...Array(12).keys()] : [root];
  for (const r of roots) for (const sc of scales) {
    const pcs = sc.intervals.map((i) => mod(r + i, 12));
    const covered = pcs.reduce((s, pc) => s + hist[pc], 0) / total;
    const silent = pcs.filter((pc) => hist[pc] <= total * 0.01).length;
    const score = covered - silentWeight * silent - 0.005 * sc.intervals.length + (COMMON[sc.id] || 0) + (prior[sc.id] || 0);
    out.push({ id: sc.id, name: sc.name, root: r, intervals: sc.intervals, score: +score.toFixed(4) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

// Ocupación rítmica: fracción de compases con ataque en cada paso de una rejilla de `steps` por compás.
function rhythmOccupancy(notes, { barBeats = 4, steps = 16, lengthBeats = null } = {}) {
  const occ = new Array(steps).fill(0);
  if (!notes.length) return occ;
  const len = lengthBeats || Math.max(barBeats, Math.ceil(Math.max(...notes.map((n) => n.start_time + 1e-6)) / barBeats) * barBeats);
  const bars = Math.max(1, Math.round(len / barBeats));
  const hit = new Set();
  for (const n of notes) {
    const pos = n.start_time / (barBeats / steps);
    const s = Math.round(pos);
    if (Math.abs(pos - s) > 0.35) continue; // ataques fuera de la rejilla no cuentan como ocupación de paso
    hit.add(`${Math.floor(n.start_time / barBeats)}:${mod(s, steps)}`);
  }
  for (const k of hit) occ[+k.split(':')[1]] += 1;
  return occ.map((v) => Math.min(1, v / bars));
}

// Detecta los bombos de una pista de percusión: C1/B0 (36/35) en Drum Rack o GM.
function kickTimes(track) {
  if (!track || !track.notes) return [];
  const kicks = track.notes.filter((n) => n.pitch === 36 || n.pitch === 35);
  return [...new Set(kicks.map((n) => +n.start_time.toFixed(4)))].sort((a, b) => a - b);
}

const looksDrum = (t) => !!t.isDrum || /kick|drum|beat|perc|bater|bombo|hat|snare|caja/i.test(t.name || '');

// Resumen completo para la interfaz (§6.4): tonalidad, escala, pistas consideradas, densidad, bombo.
// audio: resúmenes de SV Listen ({ name, chroma[12], occupancy[16], kick[16], level }); su croma suma al histograma
// con peso `audioWeight` relativo al MIDI y su ocupación y bombo entran en la complementariedad (D-052).
// Cuánto «suena a alturas» un croma de audio (0–1): parte de la energía en sus tres clases más fuertes. Un pad o un
// acorde concentran ≥ 0,8; una batería reparte su ruido en las 12 clases (≈ 0,3–0,45) y no debe decidir la escala
// (visto en Live: batería + pad en La menor daba «La cromática»).
function tonalness(chroma) {
  const tot = chroma.reduce((s, v) => s + v, 0);
  if (!(tot > 0)) return 0;
  const top3 = chroma.slice().sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0) / tot;
  return Math.max(0, Math.min(1, (top3 - 0.5) / 0.3));
}

function analyzeSet(tracks, { scales = [], barBeats = 4, liveScale = null, audio = [], audioWeight = 0.5 } = {}) {
  const melodic = tracks.filter((t) => !looksDrum(t) && t.notes && t.notes.length);
  const drums = tracks.filter((t) => looksDrum(t) && t.notes && t.notes.length);
  const hist = pitchClassHistogram(melodic.flatMap((t) => t.notes));
  const audible = (audio || []).filter((a) => a && Array.isArray(a.chroma) && a.level > 1e-4);
  if (audible.length) {
    const midiTotal = hist.reduce((s, v) => s + v, 0);
    const scale = midiTotal > 0 ? midiTotal * audioWeight : 1;
    for (const a of audible) {
      const tot = a.chroma.reduce((s, v) => s + v, 0) || 1;
      const w = tonalness(a.chroma);
      a.chroma.forEach((v, i) => { hist[i] += (v / tot) * w * scale / audible.length; });
    }
  }
  const key = estimateKey(hist);
  const scale = key.root === null ? [] : matchScale(hist, scales, key.root, key.mode);
  const kickTrack = drums.find((t) => kickTimes(t).length) || null;
  const perTrack = tracks.map((t) => {
    const len = t.length || barBeats;
    return {
      name: t.name, isDrum: looksDrum(t), notes: (t.notes || []).length, source: 'midi',
      density: +(((t.notes || []).length / Math.max(1, len / 0.25))).toFixed(3),
      occupancy: rhythmOccupancy(t.notes || [], { barBeats, lengthBeats: len }),
    };
  });
  for (const a of audio || []) {
    if (!a || !Array.isArray(a.occupancy)) continue;
    perTrack.push({ name: a.name, isDrum: (a.kicks || 0) > 0, notes: 0, source: 'audio', density: +(a.occupancy.reduce((s, v) => s + v, 0) / 16).toFixed(3), occupancy: a.occupancy.slice(0, 16) });
  }
  // cada clip se mide con su propio bucle y la ocupación del arreglo es el máximo por paso (D-037)
  const occupancy = new Array(16).fill(0).map((_, i) => Math.max(0, ...perTrack.map((t) => t.occupancy[i] || 0)));
  // bombo: el de una pista MIDI de percusión; si no hay, el de una pista de audio escuchada por SV Listen
  let kick = kickTrack ? { track: kickTrack.name, times: kickTimes(kickTrack), length: kickTrack.length || null, source: 'midi' } : null;
  let kickOccupancy = kickTrack ? rhythmOccupancy(kickTrack.notes.filter((x) => x.pitch === 36 || x.pitch === 35), { barBeats, lengthBeats: kickTrack.length || barBeats }) : null;
  if (!kick) {
    const best = (audio || []).filter((a) => a && Array.isArray(a.kick) && a.kick.some((v) => v >= 0.5)).sort((x, y) => y.kick.reduce((s, v) => s + v, 0) - x.kick.reduce((s, v) => s + v, 0))[0];
    if (best) {
      const times = best.kick.map((v, i) => (v >= 0.5 ? (i * barBeats) / 16 : null)).filter((v) => v !== null);
      kick = { track: best.name, times, length: barBeats, source: 'audio' };
      kickOccupancy = best.kick.slice(0, 16);
    }
  }
  return {
    key, scale,
    histogram: hist.map((v) => +v.toFixed(3)),
    occupancy: occupancy.map((v) => +v.toFixed(3)),
    density: +(occupancy.reduce((s, v) => s + v, 0) / occupancy.length).toFixed(3),
    kick,
    kickOccupancy,
    tracks: perTrack,
    audioTracks: (audio || []).length,
    liveScale,
    // si Live 12 tiene una escala activa, se ofrece como alternativa a la estimada
    agreesWithLive: liveScale && key.root !== null ? liveScale.root === key.root : null,
  };
}

// Convierte la escala de Live 12 (root_note, scale_intervals, scale_name) a la armonía del núcleo
// y busca la escala equivalente de la biblioteca por intervalos.
function liveScaleToHarmony(live, scales = []) {
  if (!live || live.root_note === undefined || !Array.isArray(live.scale_intervals)) return null;
  const intervals = live.scale_intervals.map(Number).filter((v) => v >= 0 && v < 12).sort((a, b) => a - b);
  const key = intervals.join(',');
  const match = scales.find((s) => s.intervals.join(',') === key);
  return { root: mod(Number(live.root_note), 12), intervals, id: match ? match.id : null, liveName: live.scale_name || null, name: match ? match.name : live.scale_name || 'Escala de Live' };
}

module.exports = { KK_MAJOR, KK_MINOR, pitchClassHistogram, estimateKey, matchScale, rhythmOccupancy, kickTimes, looksDrum, tonalness, analyzeSet, liveScaleToHarmony };

};
__svDefs["src/core/suggest.js"] = function (module, exports, require) {
'use strict';
// Botón Sugerir (§7): puntúa los ritmos del catálogo contra el contexto del set y propone los mejores con razones.
// Contexto (lo arma el controlador desde la Live API):
//   { tempo, timeSignature, names: [nombres de pistas, dispositivos y clips], analysis: { occupancy, density }, recent: [ids] }
// Componentes (0..1) y pesos: tempo 0,30 · compás 0,20 · complementariedad 0,25 · género 0,20 · variedad 0,05.
const { mod } = require('./util');
const { normalizePattern } = require('./pattern');
const { createRng } = require('./rng');
const { syncopation, maxSyncopation } = require('./syncopation');
const { LHL_16, parseMeter } = require('./meter');
const { publicPatterns, fold } = require('./catalog');

const WEIGHTS = { tempo: 0.3, meter: 0.2, complement: 0.25, genre: 0.2, variety: 0.05 };

// Palabras de nombres de pista que no dicen nada del estilo.
const STOP = new Set(['midi', 'audio', 'track', 'pista', 'rack', 'group', 'grupo', 'return', 'main', 'master', 'instrument', 'sampler', 'simpler', 'operator', 'wavetable', 'analog', 'drift', 'meld', 'delay', 'reverb', 'chord', 'chords', 'bass', 'clip', 'scene', 'core', 'kit', 'producer', 'pal', 'ritmic', 'sequencer']);
// Alias de género: una palabra del set activa estas etiquetas.
const ALIASES = { techno: ['techno', 'dub techno', 'minimal'], dub: ['dub', 'dub techno', 'steppers', 'roots'], ddt: ['dub techno'], reggae: ['reggae', 'roots', 'one drop'], house: ['house', 'disco'], trap: ['trap', 'hiphop'], latin: ['latin', 'salsa', 'son', 'bossa'], salsa: ['salsa', 'son', 'latin'], bossa: ['bossa', 'brasil'], flamenco: ['flamenco'], tabla: ['india', 'tala'], darbuka: ['arabic'], gamelan: ['gamelan'], jungle: ['jungle', 'breakbeat'], dembow: ['dembow', 'reggaeton'], reggaeton: ['reggaeton', 'dembow'] };

function tempoScore(p, tempo) {
  if (!p.bpm_range || !tempo) return { s: 0.5, why: null };
  const [lo, hi] = p.bpm_range;
  const fit = (t) => (t >= lo && t <= hi ? 1 : Math.max(0, 1 - Math.min(Math.abs(t - lo), Math.abs(t - hi)) / 25));
  const direct = fit(tempo);
  const half = Math.max(fit(tempo / 2), fit(tempo * 2)) * 0.75; // medio tiempo o doble tiempo
  const s = Math.max(direct, half);
  if (direct >= 1) return { s, why: `tempo ${Math.round(tempo)} BPM dentro de ${lo}–${hi}` };
  if (half >= 0.75 && half > direct) return { s, why: `tempo ${Math.round(tempo)} BPM a medio o doble tiempo de ${lo}–${hi}` };
  return { s, why: s < 0.3 ? null : `tempo cercano a ${lo}–${hi} BPM` };
}

function meterScore(p, timeSignature) {
  const set = parseMeter(timeSignature || '4/4');
  const pm = parseMeter(p.meter);
  const barBeats = (set.num * 4) / set.den;
  const patBar = (pm.num * 4) / pm.den;
  if (pm.num === set.num && pm.den === set.den) return { s: 1, why: `mismo compás que el set (${p.meter})` };
  const ratio = patBar / barBeats;
  if (Math.abs(ratio - Math.round(ratio)) < 1e-6 || Math.abs(1 / ratio - Math.round(1 / ratio)) < 1e-6) return { s: 0.85, why: `ciclo compatible con ${timeSignature}` };
  if (pm.den === 8 && pm.num % 3 === 0) return { s: 0.6, why: `${p.meter} sobre ${timeSignature}: birritmia` };
  return { s: 0.35, why: `${p.meter} contra ${timeSignature}: polimetría (cierra en el mcm)` };
}

// Ataques de la capa principal en una rejilla de 16 por compás (o null si el patrón no cae en ella).
function barOnsets(p) {
  let norm;
  try { norm = normalizePattern(p, { rng: createRng(`suggest:${p.id}`) }); } catch (e) { return null; }
  const layer = norm.layers.find((l) => l.onsets.length) || null;
  if (!layer) return null;
  const set = new Set();
  for (const o of layer.onsets) {
    const beats = o * norm.step_value;
    const s = beats / 0.25;
    if (Math.abs(s - Math.round(s)) > 0.2) continue;
    set.add(mod(Math.round(s), 16));
  }
  return [...set];
}

function complementScore(p, analysis) {
  if (!analysis || !Array.isArray(analysis.occupancy)) return { s: 0.5, why: null };
  const on = barOnsets(p);
  if (!on || !on.length) return { s: 0.5, why: null };
  const occ = analysis.occupancy;
  const overlap = on.reduce((s, i) => s + (occ[i] || 0), 0) / on.length;
  // densidad: si el arreglo ya está lleno, mejor algo más escaso; si está vacío, algo más denso
  const setDensity = analysis.density ?? occ.reduce((s, v) => s + v, 0) / occ.length;
  const patDensity = on.length / 16;
  const densityFit = 1 - Math.abs(patDensity - Math.max(0.12, 0.5 - setDensity) * 1.2);
  // síncopa del conjunto: el ritmo nuevo busca llevar la mezcla al tramo medio de la curva en U invertida
  const bools = occ.map((v, i) => v >= 0.5 || on.includes(i));
  const mix = syncopation(bools, LHL_16) / maxSyncopation(LHL_16);
  const syncFit = 1 - Math.min(1, Math.abs(mix - 0.35) * 2);
  const s = Math.max(0, 0.5 * (1 - overlap) + 0.25 * Math.max(0, densityFit) + 0.25 * syncFit);
  const why = overlap <= 0.25 ? `llena huecos del arreglo (solapa ${Math.round(overlap * 100)} %)` : overlap >= 0.7 ? null : `solapa ${Math.round(overlap * 100)} % con el arreglo`;
  return { s, why };
}

function words(names) {
  const out = new Set();
  for (const n of names || []) for (const w of fold(n).split(/[^a-z0-9]+/)) if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) out.add(w);
  return [...out];
}

function genreScore(p, names) {
  const ws = words(names);
  if (!ws.length) return { s: 0, why: null };
  const o = p.origin || {};
  const hay = fold([p.name, o.tradition, (o.genre || []).join(' '), (p.tags || []).join(' '), (p.categories || []).join(' ').replace(/_/g, ' ')].join(' '));
  const hits = [];
  for (const w of ws) {
    const terms = ALIASES[w] || [w];
    if (terms.some((t) => hay.includes(fold(t)))) hits.push(w);
  }
  if (!hits.length) return { s: 0, why: null };
  return { s: Math.min(1, 0.5 + 0.25 * hits.length), why: `el set sugiere ${hits.slice(0, 3).map((h) => `«${h}»`).join(', ')}` };
}

function suggest(patterns, context = {}, { destination = null, top = 3 } = {}) {
  const recent = context.recent || [];
  const scored = [];
  for (const p of publicPatterns(patterns)) {
    if (p.missing_data) continue;
    if (destination && !(p.destinations || []).includes(destination)) continue;
    const parts = {
      tempo: tempoScore(p, context.tempo),
      meter: meterScore(p, context.timeSignature),
      complement: complementScore(p, context.analysis),
      genre: genreScore(p, context.names),
    };
    const uses = recent.filter((id) => id === p.id).length;
    parts.variety = { s: uses ? 0 : 1, why: uses ? null : null };
    let score = Object.entries(parts).reduce((s, [k, v]) => s + WEIGHTS[k] * v.s, 0);
    if (uses) score -= 0.15 * uses;
    if (p.verify) score -= 0.03;
    const reasons = Object.values(parts).map((v) => v.why).filter(Boolean);
    if (uses) reasons.push(`usado hace poco (${uses}×)`);
    scored.push({ id: p.id, name: p.name, tradition: p.origin && p.origin.tradition, score: +score.toFixed(4), reasons, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +v.s.toFixed(3)])) });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // diversidad: no proponer tres ritmos de la misma familia de taxonomía si hay alternativas cercanas
  const picked = [];
  for (const s of scored) {
    if (picked.length >= top) break;
    const fam = s.id.split('/')[0];
    const same = picked.filter((x) => x.id.split('/')[0] === fam).length;
    if (same >= 2 && scored.length > top * 3) continue;
    picked.push(s);
  }
  return picked;
}

module.exports = { suggest, WEIGHTS, tempoScore, meterScore, complementScore, genreScore, words };

};
__svDefs["src/core/midifile.js"] = function (module, exports, require) {
'use strict';
// Escritor mínimo de Standard MIDI File (formato 0): ejemplos de salida y «Exportar .mid» del dispositivo.
// Devuelve un Buffer en Node y una lista de bytes donde no hay Buffer (v8 de Max).
// notes: [{ pitch, start_time, duration, velocity }] con tiempos en negras.

function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

function writeSMF(notes, { bpm = 120, ppq = 480, name = 'SV Ritmic Sequencer', channel = 0, numerator = 4, denominator = 4 } = {}) {
  const ev = [];
  for (const n of notes) {
    const on = Math.round(n.start_time * ppq);
    const off = Math.max(on + 1, Math.round((n.start_time + n.duration) * ppq));
    ev.push({ t: on, order: 1, bytes: [0x90 | channel, n.pitch, Math.max(1, Math.min(127, n.velocity))] });
    ev.push({ t: off, order: 0, bytes: [0x80 | channel, n.pitch, 0] });
  }
  ev.sort((a, b) => a.t - b.t || a.order - b.order);
  const body = [];
  const nameBytes = utf8(name);
  body.push(0, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes);
  const mpq = Math.round(60000000 / bpm);
  body.push(0, 0xff, 0x51, 3, (mpq >> 16) & 0xff, (mpq >> 8) & 0xff, mpq & 0xff);
  body.push(0, 0xff, 0x58, 4, numerator, Math.log2(denominator), 24, 8);
  let last = 0;
  for (const e of ev) { body.push(...vlq(e.t - last), ...e.bytes); last = e.t; }
  body.push(0, 0xff, 0x2f, 0);
  const bytes = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff, 0x4d, 0x54, 0x72, 0x6b,
    (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff, ...body];
  return typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
}

// UTF-8 sin depender de Buffer ni TextEncoder.
function utf8(str) {
  const out = [];
  for (const ch of String(str)) {
    let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

module.exports = { writeSMF, utf8 };

};
__svDefs["src/core/listen.js"] = function (module, exports, require) {
'use strict';
// SV Listen (fase A): análisis de audio en tiempo real, puro y probado con señales sintéticas.
// El Max de Live no trae sigmund~, bonk~ ni fiddle~ (verificado en Max 9.1.5): el dispositivo graba el audio en un
// buffer~ circular y este módulo calcula, por cuadro, espectro (FFT), croma, ataques por flujo espectral y
// ataques en la banda grave (bombo), y acumula la ocupación por paso del compás en el formato de analysis.js.

// FFT radix-2 en el lugar (re, im de longitud potencia de 2).
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang); const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar; im[i + k] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const hannCache = new Map();
function hann(n) {
  if (!hannCache.has(n)) hannCache.set(n, Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  return hannCache.get(n);
}

// Magnitudes (n/2 bins) de un cuadro de muestras con ventana de Hann.
function magnitudes(samples) {
  const n = samples.length;
  const w = hann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i] * w[i];
  fft(re, im);
  const mags = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) mags[k] = Math.hypot(re[k], im[k]) / (n / 4);
  return mags;
}

// Croma: energía por clase de altura (C = 0) entre fmin y fmax, desde los picos del espectro con frecuencia
// refinada por interpolación parabólica (evita que la fuga de una nota grave caiga en semitonos vecinos).
function chroma(mags, sampleRate, { fmin = 80, fmax = 5000, rel = 0.02 } = {}) {
  const n = mags.length * 2;
  const out = new Array(12).fill(0);
  let max = 0;
  for (let k = 1; k < mags.length; k++) if (mags[k] > max) max = mags[k];
  if (max <= 0) return out;
  for (let k = 2; k < mags.length - 1; k++) {
    const m = mags[k];
    if (m < max * rel || m < mags[k - 1] || m < mags[k + 1]) continue;
    const a = Math.log(mags[k - 1] + 1e-12); const b = Math.log(m + 1e-12); const c = Math.log(mags[k + 1] + 1e-12);
    const den = a - 2 * b + c;
    const delta = den !== 0 ? (0.5 * (a - c)) / den : 0;
    const f = ((k + delta) * sampleRate) / n;
    if (f < fmin || f > fmax) continue;
    const pc = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
    out[pc] += m * m;
  }
  return out;
}

// Energía en una banda (para el bombo: bajo 150 Hz).
function bandEnergy(mags, sampleRate, f0, f1) {
  const n = mags.length * 2;
  let e = 0;
  for (let k = Math.max(1, Math.floor((f0 * n) / sampleRate)); k <= Math.min(mags.length - 1, Math.ceil((f1 * n) / sampleRate)); k++) e += mags[k] * mags[k];
  return e;
}

// Detector de ataques por flujo espectral (rectificado, con compresión logarítmica) y selección de picos:
// un cuadro es ataque si su flujo es máximo local, supera mediana + delta · MAD de la historia reciente y
// pasaron al menos `minGapFrames` cuadros desde el anterior. Responde con un cuadro de retraso
// (devuelve `onset` del cuadro previo, `lag = 1`).
// Ajustado con señales sintéticas (bombo grave + clic): log1p(10·m) y umbral máx(mediana + delta·MAD, 0,2 · máximo
// reciente) detectan 31 de 32 ataques; el ataque real cae ≈ 0,4 cuadros antes del final del cuadro pico.
// Además el flujo relativo (flujo / energía logarítmica del cuadro) debe superar `minRel`: un acorde sostenido
// produce batidos con flujo relativo ≤ 0,07 y los golpes de batería sobre ese acorde, ≥ 0,24.
function createOnsetDetector({ history = 43, delta = 3, minGapFrames = 6, floor = 1e-3, relMax = 0.2, minRel = 0.12 } = {}) {
  let prevMags = null;
  const hist = [];
  let last2 = 0;
  let last1 = 0;
  let last1Rel = 0;
  let since = minGapFrames;
  return {
    lag: 1,
    feed(mags) {
      let flux = 0;
      let eCur = 0;
      let ePrev = 0;
      if (prevMags) {
        for (let k = 0; k < mags.length; k++) {
          const a = Math.log1p(10 * mags[k]); const b = Math.log1p(10 * prevMags[k]);
          if (a > b) flux += a - b;
          eCur += a; ePrev += b;
        }
      }
      const rel = flux / (Math.max(eCur, ePrev) + 1e-9);
      prevMags = mags;
      const sorted = hist.slice().sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      const mad = sorted.length ? sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] : 0;
      const thr = Math.max(med + delta * Math.max(mad, floor) + floor, relMax * Math.max(0, ...hist));
      since += 1;
      // ¿el cuadro anterior fue un pico?
      const onset = hist.length >= 4 && last1 > thr && last1 > last2 && last1 >= flux && last1Rel > minRel && since > minGapFrames;
      if (onset) since = 0;
      hist.push(flux);
      if (hist.length > history) hist.shift();
      last2 = last1;
      last1 = flux;
      last1Rel = rel;
      return { flux, rel, onset };
    },
  };
}

// Igual que el anterior pero sobre la energía de una banda (bombo).
function createBandDetector({ history = 24, ratio = 2.2, minGap = 4, floor = 1e-6 } = {}) {
  const hist = [];
  let since = minGap;
  let prev = 0;
  return {
    feed(energy) {
      const sorted = hist.slice().sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      since += 1;
      const rising = energy > prev * 1.5;
      const onset = hist.length >= 4 && rising && energy > ratio * med + floor && since >= minGap;
      if (onset) since = 0;
      prev = energy;
      hist.push(energy);
      if (hist.length > history) hist.shift();
      return { energy, onset };
    },
  };
}

// Escucha de una pista: se alimenta con cuadros y su posición en negras; resume en el formato de analysis.js.
function createListener({ sampleRate = 44100, frameSize = 2048, hopSize = 512, chromaHalfLife = 4, bars = 8, barBeats = 4, kickHz = 150, sensitivity = 3 } = {}) {
  const onsets = createOnsetDetector({ delta: sensitivity });
  const kicks = createBandDetector({});
  const chr = new Array(12).fill(0);
  const hits = []; // { beat, kind: 'onset'|'kick' }
  let level = 0;
  let lastBeat = null;
  let firstBeat = null;
  // los primeros cuadros solo llenan la historia de los detectores: sin ella, la cola del primer golpe se
  // confunde con un ataque tardío (visto con señales sintéticas: falso ataque a 0,29 negras)
  const WARMUP = 16;
  let frames = 0;
  return {
    // samples: cuadro de frameSize muestras; beat: posición del transporte (negras) del final del cuadro
    feed(samples, beat) {
      const mags = magnitudes(samples);
      const c = chroma(mags, sampleRate);
      const dt = (samples.length / sampleRate);
      const decay = Math.pow(0.5, dt / chromaHalfLife);
      for (let i = 0; i < 12; i++) chr[i] = chr[i] * decay + c[i];
      let rms = 0;
      for (let i = 0; i < samples.length; i++) rms += samples[i] * samples[i];
      level = 0.8 * level + 0.2 * Math.sqrt(rms / samples.length);
      const o = onsets.feed(mags);
      const k = kicks.feed(bandEnergy(mags, sampleRate, 30, kickHz));
      // el detector responde un cuadro tarde (lag) y el ataque cae ≈ 0,4 cuadros antes del final de ese cuadro
      const beatsPerSample = (this.bpm || 120) / 60 / sampleRate;
      const at = beat === null || beat === undefined ? null : beat - (hopSize + 0.4 * samples.length) * beatsPerSample;
      frames += 1;
      if (at !== null) {
        if (o.onset && frames > WARMUP) hits.push({ beat: at, kind: 'onset' });
        if (k.onset && frames > WARMUP) hits.push({ beat: at, kind: 'kick' });
        lastBeat = beat;
        if (firstBeat === null) firstBeat = beat;
        const keep = lastBeat - bars * barBeats;
        while (hits.length && hits[0].beat < keep) hits.shift();
      }
      return { onset: o.onset, kick: k.onset, flux: o.flux };
    },
    bpm: 120,
    summary(name = '') {
      const occ = (kind) => {
        const steps = new Array(16).fill(0);
        if (lastBeat === null) return steps;
        const seen = new Set();
        for (const h of hits.filter((x) => kind === 'any' || x.kind === kind)) {
          const bar = Math.floor(h.beat / barBeats);
          const s = Math.round(((h.beat - bar * barBeats) / barBeats) * 16) % 16;
          seen.add(`${bar}:${s}`);
        }
        // compases efectivamente escuchados (no los de la ventana completa si aún no se llenó)
        const heard = lastBeat - Math.max(firstBeat, lastBeat - bars * barBeats);
        const nbars = Math.max(1, Math.min(bars, Math.round(heard / barBeats)));
        for (const key of seen) steps[Number(key.split(':')[1])] += 1;
        return steps.map((v) => +Math.min(1, v / nbars).toFixed(3));
      };
      const total = chr.reduce((s, v) => s + v, 0) || 1;
      return {
        name, kind: 'audio', level: +level.toFixed(4),
        chroma: chr.map((v) => +(v / total).toFixed(4)),
        occupancy: occ('onset'), kick: occ('kick'),
        onsets: hits.filter((h) => h.kind === 'onset').length, kicks: hits.filter((h) => h.kind === 'kick').length,
        bars, updatedBeat: lastBeat,
      };
    },
  };
}

module.exports = { fft, hann, magnitudes, chroma, bandEnergy, createOnsetDetector, createBandDetector, createListener };

};
__svDefs["src/max/live_bridge.js"] = function (module, exports, require) {
'use strict';
// Puente con la Live API (adaptador delgado hacia Max). Recibe el constructor LiveAPI por inyección
// para poder probarse en Node con una Live API simulada (tests/live_bridge.test.js).
//
// Rutas y llamadas usadas (Live Object Model, Live 12):
//   this_device → canonical_parent (la pista propia)
//   live_set: tempo, signature_numerator, signature_denominator, root_note, scale_name, scale_mode, scale_intervals,
//             tracks, scenes, create_scene
//   live_set view: highlighted_clip_slot
//   track: name, has_midi_input, playing_slot_index, clip_slots, devices (class_name), arrangement_clips
//   clip_slot: has_clip, create_clip(length), clip
//   clip: length, looping, loop_start, loop_end, name, is_midi_clip, add_new_notes, get_notes_extended,
//         remove_notes_extended
// Lo que solo se verifica dentro de Live está en docs/PRUEBAS_MANUALES.md (PM-003, PM-004, PM-008 a PM-012).

const NOTE_KEYS = ['pitch', 'start_time', 'duration', 'velocity', 'mute', 'probability', 'velocity_deviation', 'release_velocity'];
const SV_PREFIX = 'SV · ';

// La Live API devuelve listas planas: ["id", 3] o [120]. Estas funciones las normalizan.
const first = (v) => (Array.isArray(v) ? v[0] : v);
const idOf = (v) => {
  if (Array.isArray(v)) { const i = v.indexOf('id'); return i >= 0 ? Number(v[i + 1]) : Number(v[v.length - 1]); }
  return Number(v);
};
const str = (v) => {
  const x = Array.isArray(v) ? v.join(' ') : String(v ?? '');
  return x.replace(/^"|"$/g, '');
};
const parseDictResult = (r) => {
  // get_notes_extended devuelve un diccionario; en JavaScript llega como cadena JSON o como objeto
  if (r === null || r === undefined) return { notes: [] };
  if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return { notes: [] }; } }
  if (Array.isArray(r) && typeof r[0] === 'string') { try { return JSON.parse(r.join(' ')); } catch (e) { return { notes: [] }; } }
  return r;
};

function createBridge(LiveAPI, env = {}) {
  const log = env.post || (() => {});
  const api = (path) => new LiveAPI(path);

  function ownTrack() {
    const dev = api('this_device');
    const parentId = idOf(dev.get('canonical_parent'));
    const t = api(`id ${parentId}`);
    return { api: t, id: parentId, path: str(t.path) };
  }

  function setInfo() {
    const s = api('live_set');
    const num = Number(first(s.get('signature_numerator'))) || 4;
    const den = Number(first(s.get('signature_denominator'))) || 4;
    return { tempo: Number(first(s.get('tempo'))) || 120, timeSignature: `${num}/${den}`, barBeats: (num * 4) / den, trackCount: s.getcount('tracks'), sceneCount: s.getcount('scenes') };
  }

  // §3.5 · escala de Live 12
  function readScale() {
    const s = api('live_set');
    const intervals = s.get('scale_intervals');
    return {
      root_note: Number(first(s.get('root_note'))),
      scale_name: str(s.get('scale_name')),
      scale_mode: Number(first(s.get('scale_mode'))) === 1,
      scale_intervals: Array.isArray(intervals) ? intervals.map(Number) : [],
    };
  }

  // Observa cambios de escala (interruptor «sincronizar con Live»). Devuelve los observadores para soltarlos.
  function observeScale(onChange) {
    const props = ['root_note', 'scale_name', 'scale_intervals', 'scale_mode'];
    return props.map((p) => {
      const o = new LiveAPI(() => onChange(readScale()), 'live_set');
      o.property = p;
      return o;
    });
  }

  function clipSlotPath(trackPath, index) { return `${trackPath} clip_slots ${index}`; }

  // Ranura destino en la pista propia: la seleccionada si está vacía y es de esta pista; si no, la primera
  // vacía; si no hay ninguna, se crea una escena al final (D-030).
  function targetSlot(track, { preferSelected = true, reuseSlot = null } = {}) {
    if (reuseSlot !== null && reuseSlot !== undefined) return { index: reuseSlot, reused: true };
    const count = track.api.getcount('clip_slots');
    if (preferSelected) {
      const view = api('live_set view');
      const hid = idOf(view.get('highlighted_clip_slot'));
      if (hid) {
        const hs = api(`id ${hid}`);
        const hp = str(hs.path);
        const m = /clip_slots (\d+)$/.exec(hp);
        if (m && hp.startsWith(track.path) && Number(first(hs.get('has_clip'))) === 0) return { index: Number(m[1]), selected: true };
      }
    }
    for (let i = 0; i < count; i++) {
      const cs = api(clipSlotPath(track.path, i));
      if (Number(first(cs.get('has_clip'))) === 0) return { index: i };
    }
    api('live_set').call('create_scene', -1);
    return { index: count, createdScene: true };
  }

  // Notas en el formato de add_new_notes, sin los campos internos del generador.
  function toLiveNotes(notes) {
    return notes.map((n) => {
      const o = {};
      for (const k of NOTE_KEYS) if (n[k] !== undefined) o[k] = n[k];
      o.velocity = Math.max(1, Math.min(127, Math.round(o.velocity)));
      o.mute = o.mute ? 1 : 0;
      return o;
    });
  }

  // Escribe el resultado del generador como clip MIDI en la pista propia (§3.4).
  // Solo sobrescribe clips creados por SV (nombre con prefijo «SV · »); nunca toca otros clips.
  function writeClip(result, { name = null, reuseSlot = null, preferSelected = true } = {}) {
    const track = ownTrack();
    const slot = targetSlot(track, { preferSelected, reuseSlot });
    const cs = api(clipSlotPath(track.path, slot.index));
    const length = result.length_beats;
    if (Number(first(cs.get('has_clip'))) === 1) {
      const existing = api(`${clipSlotPath(track.path, slot.index)} clip`);
      if (!str(existing.get('name')).startsWith(SV_PREFIX)) throw new Error('La ranura tiene un clip que no creó SV Ritmic Sequencer; no se sobrescribe.');
      existing.call('remove_notes_extended', 0, 128, 0, Math.max(length, Number(first(existing.get('length'))) || length));
      existing.set('loop_end', length);
      existing.set('loop_start', 0);
      existing.set('end_marker', length);
    } else {
      cs.call('create_clip', length);
    }
    const clip = api(`${clipSlotPath(track.path, slot.index)} clip`);
    clip.set('looping', 1);
    clip.set('name', SV_PREFIX + (name || (result.meta && result.meta.name) || 'patrón'));
    const notes = toLiveNotes(result.notes);
    clip.call('add_new_notes', { notes });
    log(`SV Ritmic Sequencer: ${notes.length} notas en ranura ${slot.index + 1} (${length} negras)`);
    return { slot: slot.index, length, notes: notes.length, createdScene: !!slot.createdScene, trackPath: track.path };
  }

  // §6.1 · lee las notas MIDI del set: clip en reproducción o, si no hay, el primero con notas de cada pista.
  // Las pistas de audio y la pista propia se omiten. includeArrangement añade los clips del arreglo.
  function readTracks({ includeOwn = false, includeArrangement = false, maxNotesPerTrack = 4000 } = {}) {
    const own = ownTrack();
    const s = api('live_set');
    const n = s.getcount('tracks');
    const out = [];
    for (let i = 0; i < n; i++) {
      const path = `live_set tracks ${i}`;
      const t = api(path);
      if (!includeOwn && Number(t.id) === own.id) continue;
      if (Number(first(t.get('has_midi_input'))) !== 1) continue;
      const name = str(t.get('name'));
      const devCount = t.getcount('devices');
      let isDrum = false;
      for (let d = 0; d < devCount; d++) if (str(api(`${path} devices ${d}`).get('class_name')) === 'DrumGroupDevice') isDrum = true;
      const playing = Number(first(t.get('playing_slot_index')));
      const slots = t.getcount('clip_slots');
      const order = playing >= 0 ? [playing, ...[...Array(slots).keys()].filter((k) => k !== playing)] : [...Array(slots).keys()];
      let clipInfo = null;
      for (const k of order) {
        const cs = api(`${path} clip_slots ${k}`);
        if (Number(first(cs.get('has_clip'))) !== 1) continue;
        const clip = api(`${path} clip_slots ${k} clip`);
        if (Number(first(clip.get('is_midi_clip'))) !== 1) continue;
        const len = Number(first(clip.get('length')));
        const res = parseDictResult(clip.call('get_notes_extended', 0, 128, 0, len));
        const notes = (res.notes || []).filter((x) => !x.mute).slice(0, maxNotesPerTrack);
        if (notes.length) { clipInfo = { slot: k, length: len, notes, playing: k === playing, source: 'session' }; break; }
      }
      if (!clipInfo && includeArrangement) {
        const ac = t.getcount('arrangement_clips');
        for (let k = 0; k < ac && !clipInfo; k++) {
          const clip = api(`${path} arrangement_clips ${k}`);
          if (Number(first(clip.get('is_midi_clip'))) !== 1) continue;
          const len = Number(first(clip.get('length')));
          const res = parseDictResult(clip.call('get_notes_extended', 0, 128, 0, len));
          const notes = (res.notes || []).filter((x) => !x.mute);
          if (notes.length) clipInfo = { slot: null, length: len, notes, playing: false, source: 'arrangement' };
        }
      }
      if (clipInfo) out.push({ index: i, name, isDrum, ...clipInfo });
    }
    return out;
  }

  // Nombres de pistas y dispositivos, para Sugerir (§7) y para mostrar qué se leyó.
  function describeSet() {
    const s = api('live_set');
    const n = s.getcount('tracks');
    const tracks = [];
    for (let i = 0; i < n; i++) {
      const path = `live_set tracks ${i}`;
      const t = api(path);
      const devices = [];
      for (let d = 0; d < t.getcount('devices'); d++) devices.push(str(api(`${path} devices ${d}`).get('name')));
      const clips = [];
      const slots = t.getcount('clip_slots');
      for (let k = 0; k < slots && clips.length < 16; k++) {
        const cs = api(`${path} clip_slots ${k}`);
        if (Number(first(cs.get('has_clip'))) === 1) clips.push(str(api(`${path} clip_slots ${k} clip`).get('name')));
      }
      tracks.push({ index: i, name: str(t.get('name')), midi: Number(first(t.get('has_midi_input'))) === 1, devices, clips });
    }
    // ¿Expone Live la ruta del .als? Se intenta leer; si la propiedad no existe queda en null (PM-025)
    let filePath = null;
    try { const fp = s.get('file_path'); filePath = fp && fp.length ? str(fp) : null; } catch (e) { filePath = null; }
    return { ...setInfo(), tracks, filePath };
  }

  return { ownTrack, setInfo, readScale, observeScale, targetSlot, toLiveNotes, writeClip, readTracks, describeSet, SV_PREFIX };
}

module.exports = { createBridge, parseDictResult, idOf, str, NOTE_KEYS };

};
__svDefs["src/max/controller.js"] = function (module, exports, require) {
'use strict';
// Controlador del dispositivo: guarda el estado de los cuatro pasos (Destino · Armonía · Ritmo · Generar),
// resuelve la armonía (manual, Live 12, Adaptable, Random), llama al núcleo y escribe con el puente.
// Sin dependencias de Max: el script v8 solo traduce mensajes a estos métodos.

const DEFAULT_PATTERN = {
  chords: 'RGG.10.2/stab_weighted', bassline: 'RGG.10.2/bass_offbeat', arpeggio: 'CIC.3.4/son_clave_3_2',
  hihats: 'RGG.4.2/hat_offbeat', ethnic: 'RGG.3.3/steppers', others: 'PRO.1/e_5_16',
};
const HISTORY_MAX = 32;

// Fracción de ataques de la capa principal que caen en un pulso (negra).
function onBeatShare(p) {
  if (!p || !p.layers || !p.layers.length) return 1;
  const layer = p.layers.find((l) => ['bass', 'kick'].includes(l.role)) || p.layers[0];
  if (!layer.onsets.length) return 1;
  return layer.onsets.filter((o) => Math.abs((o * p.step_value) % 1) < 1e-9).length / layer.onsets.length;
}

// Almacén de preajustes en memoria (en Max se inyecta uno sobre un [dict ---sv_rs_presets @embed 1]).
function memoryStore() { let items = []; return { load: () => items.slice(), save: (arr) => { items = arr.slice(); } }; }

// Campos del estado que guarda un preajuste propio.
const PRESET_FIELDS = ['destination', 'harmonyMode', 'root', 'scaleId', 'randomSeed', 'patternId', 'category', 'repeats', 'seed', 'options', 'locks'];

// listenSource(): resúmenes de SV Listen ({ track, name, chroma, occupancy, kick, level, updated }) o [].
function createController({ core, data, bridge = null, post = () => {}, presetStore = memoryStore(), listenSource = () => [] }) {
  const scales = data.scales.scales;
  const findPattern = (id) => data.patterns.find((p) => p.id === id) || null;
  const state = {
    destination: 'chords',
    harmonyMode: 'manual', // manual | live | adaptive | random
    root: 0,
    scaleId: 'minor',
    randomSeed: 1,
    patternId: DEFAULT_PATTERN.chords,
    category: 'dub_techno',
    repeats: 'auto',
    seed: 1,
    options: { microtiming: 'swing_16_62' },
    syncScale: false,
    adaptive: { amount: 0.5, alignBassToKick: 'auto', summary: null, override: null },
    locks: [],
    history: [],
    historyIndex: -1,
    lastSlot: null,
    allowStructural: false,
    suggestions: [],
  };

  const harmonyFrom = (root, scaleId) => {
    const sc = scales.find((s) => s.id === scaleId) || scales.find((s) => s.id === 'minor');
    return { root: ((root % 12) + 12) % 12, intervals: sc.intervals, id: sc.id, name: sc.name };
  };

  // Random dentro de reglas musicales, con semilla visible y reutilizable (§2, Paso 2).
  function randomHarmony(seed) {
    const rng = core.createRng(`harmony:${seed}`);
    const rules = data.scales.random_rules || { family_weights: {} };
    const avoid = new Set((rules.avoid_for_destination || {})[state.destination] || []);
    const fams = data.scales.families.map((f) => f.id);
    const fam = fams[rng.weighted(fams.map((f) => rules.family_weights[f] ?? 1))];
    const pool = scales.filter((s) => s.family === fam && !avoid.has(s.id));
    const sc = rng.pick(pool.length ? pool : scales);
    return harmonyFrom(rng.int(0, 11), sc.id);
  }

  function setInfo() {
    if (!bridge) return { tempo: 120, timeSignature: '4/4', barBeats: 4 };
    try { return bridge.setInfo(); } catch (e) { post(`SV: no se pudo leer el set (${e.message})`); return { tempo: 120, timeSignature: '4/4', barBeats: 4 }; }
  }

  // Modo Adaptable: lee el MIDI del set y estima tonalidad, escala, ocupación y bombo (§6).
  function analyze() {
    if (!bridge) throw new Error('El modo Adaptable necesita Live.');
    const info = setInfo();
    const tracks = bridge.readTracks({ includeArrangement: !!state.options.readArrangement });
    let liveScale = null;
    try { liveScale = core.analysis.liveScaleToHarmony(bridge.readScale(), scales); } catch (e) { liveScale = null; }
    // pistas de audio escuchadas por SV Listen en los últimos 30 s
    let audio = [];
    try { const now = Date.now(); audio = (listenSource() || []).filter((a) => a && (!a.updated || now - a.updated < 30000)); } catch (e) { audio = []; }
    const summary = core.analysis.analyzeSet(tracks, { scales, barBeats: info.barBeats, liveScale, audio, audioWeight: state.adaptive.audioWeight ?? 0.5 });
    summary.read = tracks.map((t) => ({ name: t.name, slot: t.slot, source: t.source, playing: t.playing, notes: t.notes.length, isDrum: t.isDrum }))
      .concat(audio.map((a) => ({ name: a.name, source: 'audio', playing: true, notes: 0, isDrum: (a.kicks || 0) > 0 })));
    state.adaptive.summary = summary;
    return summary;
  }

  function resolveHarmony() {
    switch (state.harmonyMode) {
      case 'random': return { ...randomHarmony(state.randomSeed), mode: 'random', seed: state.randomSeed };
      case 'live': {
        const h = bridge ? core.analysis.liveScaleToHarmony(bridge.readScale(), scales) : null;
        if (h) return { ...h, mode: 'live' };
        post('SV: no se pudo leer la escala de Live; se usa la manual.');
        return { ...harmonyFrom(state.root, state.scaleId), mode: 'manual' };
      }
      case 'adaptive': {
        if (state.adaptive.override) return { ...harmonyFrom(state.adaptive.override.root, state.adaptive.override.scaleId), mode: 'adaptive', corrected: true };
        const s = state.adaptive.summary || analyze();
        const best = s.scale && s.scale[0];
        if (best) return { root: best.root, intervals: best.intervals, id: best.id, name: best.name, mode: 'adaptive', key: s.key.name, confidence: s.key.confidence };
        return { ...harmonyFrom(state.root, state.scaleId), mode: 'manual' };
      }
      default: return { ...harmonyFrom(state.root, state.scaleId), mode: 'manual' };
    }
  }

  function buildOptions(seed) {
    const info = setInfo();
    const harmony = resolveHarmony();
    const o = {
      ...state.options,
      destination: state.destination,
      category: state.category,
      harmony,
      seed,
      repeats: state.repeats,
      bpm: info.tempo,
      timeSignature: info.timeSignature,
      allowStructural: state.allowStructural,
    };
    if (state.harmonyMode === 'adaptive' && state.adaptive.summary) {
      const s = state.adaptive.summary;
      const occ = state.destination === 'bassline' && s.kickOccupancy ? s.kickOccupancy : s.occupancy;
      if (state.adaptive.amount > 0) o.complement = { occupancy: occ, amount: state.adaptive.amount };
      // seguir al bombo: siempre (true), nunca (false) o 'auto' = solo si el patrón de bajo ataca sobre todo en
      // los pulsos; un bajo en contratiempo conserva su ritmo y se coloca entre los bombos (D-038)
      const pattern = findPattern(state.patternId);
      const follow = state.adaptive.alignBassToKick === 'auto' ? onBeatShare(pattern) >= 0.5 : !!state.adaptive.alignBassToKick;
      if (state.destination === 'bassline' && follow && s.kick && s.kick.times.length) {
        // alinea el bajo con el bombo repitiendo su clip hasta cubrir el clip nuevo
        o.bassSource = 'external';
        const len = s.kick.length || 4;
        const times = [];
        for (let off = 0; off < 256; off += len) for (const t of s.kick.times) times.push(off + t);
        o.kickTimes = times;
      }
    }
    return o;
  }

  function pushHistory(entry) {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(entry);
    if (state.history.length > HISTORY_MAX) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function write(result, reuse) {
    if (!bridge) return null;
    const w = bridge.writeClip(result, { reuseSlot: reuse ? state.lastSlot : null, name: result.meta.name });
    state.lastSlot = w.slot;
    return w;
  }

  function summaryOf(result, written) {
    return {
      pattern: result.meta.pattern, name: result.meta.name, destination: result.meta.destination, seed: result.meta.seed,
      harmony: result.meta.harmony, status: result.meta.status, verify: result.meta.verify, tradition: result.meta.tradition,
      length_beats: result.length_beats, bars: result.plan.bars, repeats: result.plan.repeats, variation: result.plan.variation,
      notes: result.notes.length, warnings: result.meta.warnings, cultural_note: result.meta.cultural_note, written,
    };
  }

  const signature = (r) => r.notes.map((n) => `${n.pitch}@${n.start_time}:${n.duration}:${n.velocity}`).join('|');

  function run(seed, { reuse = false, varyIndex = null, mustDiffer = false } = {}) {
    const pattern = findPattern(state.patternId);
    if (!pattern) throw new Error(`Patrón inexistente: ${state.patternId}`);
    let opts = buildOptions(seed);
    const prev = state.history[state.historyIndex];
    if (state.locks.length && prev) opts.lock = { roles: state.locks, previous: prev.result };
    let result = varyIndex === null ? core.generate(pattern, opts, data) : core.vary(pattern, { ...opts, variationIndex: varyIndex }, data);
    // Generar o Regenerar no repiten el clip anterior: primero se prueban semillas siguientes (la nueva queda en
    // state.seed, visible y reutilizable) y, si el patrón es fijo, se aplica una variación suave (D-046)
    for (let k = 1; mustDiffer && varyIndex === null && prev && signature(result) === signature(prev.result) && k <= 8; k++) {
      seed = (Number(seed) || 0) + 1;
      state.seed = seed;
      opts = { ...opts, seed };
      result = core.generate(pattern, opts, data);
    }
    for (let k = 1; mustDiffer && prev && signature(result) === signature(prev.result) && k <= 6; k++) {
      result = core.vary(pattern, { ...opts, variationIndex: state.history.length + k }, data, 0.3 + 0.1 * k);
      result.meta.warnings = [...(result.meta.warnings || []), 'Patrón fijo: Regenerar aplicó una variación suave.'];
    }
    const written = write(result, reuse);
    pushHistory({ seed, patternId: state.patternId, destination: state.destination, result, written });
    return summaryOf(result, written);
  }

  return {
    state,
    setDestination(d) {
      if (!DEFAULT_PATTERN[d]) throw new Error(`Destino desconocido: ${d}`);
      state.destination = d;
      const p = findPattern(state.patternId);
      if (!p || !p.destinations.includes(d)) { state.patternId = DEFAULT_PATTERN[d]; state.category = (findPattern(state.patternId).categories || [])[0] || null; }
      return state.destination;
    },
    setHarmony(root, scaleId) { state.root = Number(root); if (scaleId) state.scaleId = String(scaleId); state.harmonyMode = 'manual'; return resolveHarmony(); },
    setHarmonyMode(mode) {
      if (!['manual', 'live', 'adaptive', 'random'].includes(mode)) throw new Error(`Modo de armonía desconocido: ${mode}`);
      state.harmonyMode = mode;
      return resolveHarmony();
    },
    setRandomSeed(seed) { state.randomSeed = seed; return resolveHarmony(); },
    rerollHarmony() { state.randomSeed = Math.floor(Math.random() * 1e6); state.harmonyMode = 'random'; return resolveHarmony(); },
    correctAdaptive(root, scaleId) { state.adaptive.override = root === null ? null : { root: Number(root), scaleId }; return resolveHarmony(); },
    setPattern(id) {
      const p = findPattern(id);
      if (!p) throw new Error(`Patrón inexistente: ${id}`);
      if (core.catalog.isRestricted(p) && !p.structural_only) throw new Error(`${id} es de uso restringido.`);
      state.patternId = id;
      state.allowStructural = core.catalog.isRestricted(p);
      if (!p.destinations.includes(state.destination)) state.destination = p.destinations[0];
      state.category = (p.categories || [])[0] || null;
      return { id, cultural_note: p.cultural_note || null };
    },
    setCategory(c) { state.category = c; },
    setRepeats(r) { state.repeats = r === 'full' || r === 'auto' ? r : Number(r); },
    setOption(key, value) { if (value === null || value === undefined) delete state.options[key]; else state.options[key] = value; },
    setSeed(s) { state.seed = s; },
    lock(role, on = true) { state.locks = on ? [...new Set([...state.locks, role])] : state.locks.filter((r) => r !== role); return state.locks; },
    setSyncScale(on) { state.syncScale = !!on; if (on) state.harmonyMode = 'live'; return state.syncScale; },
    analyze,
    resolveHarmony,
    // Generar: escribe un clip nuevo. Regenerar: nueva semilla en la misma ranura. Variar: mutación suave.
    generate() { return run(state.seed, { reuse: false, mustDiffer: true }); },
    regenerate() { state.seed = (Number(state.seed) || 0) + 1; return run(state.seed, { reuse: state.lastSlot !== null, mustDiffer: true }); },
    vary() { const n = state.history.length; return run(state.seed, { reuse: state.lastSlot !== null, varyIndex: n }); },
    preview() {
      const p = findPattern(state.patternId);
      return core.generate(p, buildOptions(state.seed), data);
    },
    undo() {
      if (state.historyIndex <= 0) return null;
      state.historyIndex -= 1;
      const h = state.history[state.historyIndex];
      const written = write(h.result, true);
      return summaryOf(h.result, written);
    },
    redo() {
      if (state.historyIndex >= state.history.length - 1) return null;
      state.historyIndex += 1;
      const h = state.history[state.historyIndex];
      const written = write(h.result, true);
      return summaryOf(h.result, written);
    },
    historyList() {
      return state.history.map((h, i) => ({ i, seed: h.seed, pattern: h.patternId, name: (findPattern(h.patternId) || {}).name || h.patternId, destination: h.destination, notes: h.result.notes.length, slot: h.written ? h.written.slot : null, current: i === state.historyIndex }));
    },
    // Vuelve a una generación del historial y la reescribe en su ranura.
    gotoHistory(i) {
      const k = Number(i);
      if (!(k >= 0 && k < state.history.length)) return null;
      state.historyIndex = k;
      const h = state.history[k];
      const written = write(h.result, true);
      return summaryOf(h.result, written);
    },
    // Sugerir (§7): contexto del set → tres ritmos con razones.
    suggest() {
      let info = { tempo: 120, timeSignature: '4/4', tracks: [] };
      if (bridge) { try { info = bridge.describeSet(); } catch (e) { post(`SV: no se pudo leer el set (${e.message})`); } }
      let analysis = state.adaptive.summary;
      if (!analysis && bridge) { try { analysis = analyze(); } catch (e) { analysis = null; } }
      const names = [];
      for (const t of info.tracks || []) names.push(t.name, ...(t.devices || []), ...(t.clips || []));
      const recent = state.history.slice(-8).map((h) => h.patternId);
      state.suggestions = core.suggest.suggest(data.patterns, { tempo: info.tempo, timeSignature: info.timeSignature, names, analysis, recent }, { destination: state.destination });
      return { suggestions: state.suggestions, context: { tempo: info.tempo, timeSignature: info.timeSignature, tracks: (info.tracks || []).length, setPath: info.filePath || null } };
    },
    useSuggestion(i) { const s = state.suggestions[Number(i)]; if (!s) return null; return this.setPattern(s.id); },
    // Preajustes propios (§8): se guardan con el set mediante el almacén inyectado.
    listPresets() { return presetStore.load().map((p, i) => ({ i, name: p.name, pattern: p.state.patternId, destination: p.state.destination })); },
    savePreset(name) {
      const list = presetStore.load();
      const snap = {};
      for (const k of PRESET_FIELDS) snap[k] = JSON.parse(JSON.stringify(state[k] ?? null));
      const p = findPattern(state.patternId);
      const auto = `${p ? p.name : state.patternId} · ${state.destination}`;
      list.push({ name: name && String(name).trim() ? String(name).trim() : auto, created: Date.now(), state: snap });
      presetStore.save(list);
      return this.listPresets();
    },
    loadPreset(i) {
      const p = presetStore.load()[Number(i)];
      if (!p) return null;
      for (const k of PRESET_FIELDS) if (p.state[k] !== undefined && p.state[k] !== null) state[k] = JSON.parse(JSON.stringify(p.state[k]));
      return { name: p.name, state: this.snapshot() };
    },
    deletePreset(i) { const list = presetStore.load(); list.splice(Number(i), 1); presetStore.save(list); return this.listPresets(); },
    // Exportar .mid: bytes del clip actual (o de la vista previa si aún no se generó nada).
    exportMidi() {
      const h = state.history[state.historyIndex];
      const r = h ? h.result : this.preview();
      const info = setInfo();
      const name = `SV ${r.meta.name} ${r.meta.destination} s${r.meta.seed}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
      return { name, bytes: Array.from(core.midifile.writeSMF(r.notes, { bpm: info.tempo, name })), notes: r.notes.length };
    },
    // Índices para sincronizar los live.* con el estado (tras cargar un preajuste o al avanzar la semilla).
    paramIndices() {
      const pub = core.catalog.publicPatterns(data.patterns).map((p) => p.id);
      const reps = ['auto', 3, 4, 8, 16, 'full'];
      return {
        p_destino: data.taxonomy.destinations.findIndex((d) => d.id === state.destination),
        p_armonia: ['manual', 'live', 'adaptive', 'random'].indexOf(state.harmonyMode),
        p_raiz: state.root,
        p_escala: scales.findIndex((s) => s.id === state.scaleId),
        p_ritmo: pub.indexOf(state.patternId),
        p_repeticiones: reps.findIndex((r) => String(r) === String(state.repeats)),
        p_semilla: state.seed,
      };
    },
    snapshot() {
      const { history, adaptive, suggestions, ...rest } = state;
      return { ...rest, adaptive: { amount: adaptive.amount, alignBassToKick: adaptive.alignBassToKick, override: adaptive.override } };
    },
  };
}

module.exports = { createController, DEFAULT_PATTERN, memoryStore, PRESET_FIELDS };

};
__svDefs["src/ui/index.js"] = function (module, exports, require) {
'use strict';
// Interfaz: tema, cadenas, geometría, dibujo (mgraphics y SVG), modelo y vistas (franja y panel).
module.exports = {
  theme: require('./theme'),
  strings: require('./strings'),
  geometry: require('./geometry'),
  canvas: require('./canvas'),
  widgets: require('./widgets'),
  model: require('./model'),
  strip: require('./strip'),
  panel: require('./panel'),
  listenView: require('./listen_view'),
};

};
__svDefs["src/ui/theme.js"] = function (module, exports, require) {
'use strict';
// Tema visual de SV Ritmic Sequencer (identidad Sidera Visus): fondo nocturno integrado con el tema oscuro
// de Live, acento celeste y lila «estelar», un color por eje de la taxonomía (taxonomy.json) y el círculo
// rítmico dibujado como una constelación: los ataques son estrellas y el polígono, sus líneas.

const THEME = {
  font: 'Ableton Sans Medium',
  fontBold: 'Ableton Sans Bold',
  bg: '#141519',
  surface: '#1B1D22',
  surface2: '#23262D',
  surface3: '#2D3139',
  line: '#3A3F49',
  text: '#ECEDF0',
  dim: '#A9ADB7',
  faint: '#737884',
  accent: '#8FD6EA', // celeste estelar
  accent2: '#C9B8FF', // lila
  ok: '#86DDA9',
  warn: '#F3C86E',
  danger: '#F29384',
  corpus: '#86BDF5',
  restricted: '#E7A6C4',
  star: '#F7F3DC',
  size: { xs: 9, sm: 10, md: 11, lg: 13, xl: 16 },
  radius: 4,
};

// Etiquetas de rol de capa → color estable (para el piano roll y la constelación multicapa).
const ROLE_COLORS = ['#8FD6EA', '#C9B8FF', '#F3C86E', '#86DDA9', '#F29384', '#86BDF5', '#E7A6C4', '#B9D98A'];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

const rgba = (hex, a = 1) => [...hexToRgb(hex), a];

// Mezcla dos colores (t = 0 → a, 1 → b).
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255).toString(16).padStart(2, '0')).join('');
}

// Contraste WCAG 2.x entre dos colores (para las pruebas de accesibilidad).
function luminance(hex) {
  return hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function axisColors(taxonomy) {
  const out = {};
  for (const ax of (taxonomy && taxonomy.axes) || []) out[ax.id] = ax.color;
  return out;
}

// Color de un ID de taxonomía por su eje (prefijo de tres letras).
const colorForId = (id, taxonomy) => axisColors(taxonomy)[String(id).slice(0, 3)] || THEME.accent;

function roleColor(role, roles) {
  const i = Math.max(0, roles.indexOf(role));
  return ROLE_COLORS[i % ROLE_COLORS.length];
}

module.exports = { THEME, ROLE_COLORS, hexToRgb, rgba, mix, luminance, contrast, axisColors, colorForId, roleColor };

};
__svDefs["src/ui/strings.js"] = function (module, exports, require) {
'use strict';
// Textos de la interfaz. Español por defecto; otro idioma = otro archivo strings.<lang>.json con las mismas claves.
const ES = require('./strings.es.json');

const LANGS = { es: ES };
let current = ES;

function setLanguage(lang) { current = LANGS[lang] || ES; }
function registerLanguage(lang, table) { LANGS[lang] = table; }

// t('gen.summary', { bars: 8 }) → reemplaza {bars}. Si falta la clave, devuelve la clave (visible en pruebas).
function t(key, vars) {
  let s = current[key] ?? ES[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

module.exports = { t, setLanguage, registerLanguage, ES };

};
__svDefs["src/ui/strings.es.json"] = function (module, exports, require) {
module.exports = {"app":"SV Ritmic Sequencer","step1":"1 · Destino","step2":"2 · Armonía","step3":"3 · Ritmo","step4":"4 · Generar","dest.bassline":"Bajo","dest.chords":"Acordes","dest.arpeggio":"Arpegio","dest.hihats":"Hi-hats","dest.ethnic":"Percusión","dest.others":"Otros","dest.help.bassline":"Bassline: raíz y grados fuertes sobre los acentos; notas de paso en posiciones débiles.","dest.help.chords":"Chords: voicings por grado y modo, stabs, anticipaciones y ritmo armónico.","dest.help.arpeggio":"Arpeggio: direcciones y ciclos de 3, 5 o 7 notas que crean hemiolas.","dest.help.hihats":"Hi-hats: capas cerrado, abierto y pedal; tresillos, redobles y microtiempo.","dest.help.ethnic":"Ethnic drums: golpes con timbre mapeados por tradición (dum/tak, tali/khali, gongs, congas).","dest.help.others":"Others: cualquier voz, con notas libres o grados de la escala.","mode.manual":"Manual","mode.live":"Live","mode.adaptive":"Adapt.","mode.random":"Azar","mode.help.manual":"Raíz y escala elegidas a mano.","mode.help.live":"Usa la escala activa del set de Live 12.","mode.help.adaptive":"Lee el MIDI del set y estima tonalidad, ocupación y bombo. Pulsa «Leer set».","mode.help.random":"Escala y raíz al azar dentro de reglas musicales, con semilla reutilizable.","harmony.read":"Leer set","harmony.seed":"semilla","harmony.reroll":"Otra","harmony.read.result":"Leído: {key} · confianza {conf} %","harmony.scale.prev":"Escala anterior","harmony.scale.next":"Escala siguiente","harmony.root.help":"Raíz: clic en una tecla. Las teclas encendidas son las notas de la escala.","rhythm.explore":"Explorar","rhythm.explore.help":"Abre el navegador completo de ritmos con su detalle y visualizaciones.","rhythm.prev":"Ritmo anterior","rhythm.next":"Ritmo siguiente","rhythm.cycle":"ciclo {n} · {meter}","badge.verify":"verificar","badge.corpus":"corpus","badge.missing":"datos faltantes","badge.restricted":"uso restringido","badge.help.verify":"Dato por verificar en una transcripción o fuente primaria antes de fijarlo como preset.","badge.help.corpus":"Medido en el corpus MIDI de referencia: describe una práctica de programación.","badge.help.missing":"El informe declara este dato faltante: complétalo en el editor antes de generar.","badge.help.restricted":"Repertorio ceremonial: solo se ofrece como principio estructural, con nota de contexto.","gen.generate":"Generar","gen.regenerate":"Regenerar","gen.vary":"Variar","gen.undo":"Deshacer","gen.redo":"Rehacer","gen.audition":"Escuchar","gen.help.generate":"Escribe un clip nuevo en la pista (primera ranura vacía o la seleccionada).","gen.help.regenerate":"Nueva semilla en la misma ranura.","gen.help.vary":"Mutación suave del clip actual.","gen.help.audition":"Escucha previa por el instrumento de la pista, sin escribir el clip.","gen.repeats":"Repeticiones","gen.repeats.auto":"Auto","gen.repeats.full":"∞","gen.repeats.help":"Repeticiones: Auto sigue la naturaleza del ritmo; ∞ cierra el ciclo completo contra el compás del set.","gen.summary":"{bars} comp. · {repeats}× {cycle} · fin: {variation}","var.none":"—","var.fill":"fill","var.hat_triplet_fill":"tresillo","var.trap_roll":"redoble","var.tihai":"tihai","var.gong":"gong","var.llamada":"llamada","var.virada":"virada","var.dropout":"drop-out","var.density_up":"más densidad","status.ready":"Listo","status.written":"Clip escrito en la ranura {slot}","panel.title":"Navegador de ritmos","panel.all":"Todos","panel.only_dest":"Solo {dest}","panel.verified":"Solo verificados","panel.results":"{n} ritmos","panel.use":"Usar este ritmo","panel.origin":"Origen","panel.sources":"Fuentes","panel.definition":"Definición","panel.preview":"Vista previa del clip","panel.locks":"Bloquear capas","panel.grid":"Rejilla deformable","panel.layers":"Capas","panel.empty":"Sin resultados con estos filtros.","panel.other_dest":"{n} ritmos para otros destinos: desactiva «Solo …» para verlos.","rhythm.suggest":"Sugerir","rhythm.suggest.help":"Propone tres ritmos para este set según tempo, compás, huecos del arreglo, nombres de pistas y variedad.","suggest.title":"Sugerencias para este set","suggest.close":"Cerrar sugerencias","suggest.empty":"Sin sugerencias para este destino.","suggest.use":"Usar «{name}»: {why}","panel.tab.layers":"Capas","panel.tab.history":"Historial","panel.tab.presets":"Preajustes","panel.history.empty":"Aún no hay generaciones.","panel.history.row":"{n} · {name} · semilla {seed}","panel.history.help":"Vuelve a esta generación y la reescribe en su ranura.","panel.presets.save":"Guardar actual","panel.presets.save.help":"Guarda destino, armonía, ritmo, repeticiones, semilla y forma como preajuste del set.","panel.presets.empty":"Sin preajustes guardados.","panel.presets.help":"Carga este preajuste. Los preajustes se guardan con el set.","panel.presets.delete":"Borrar este preajuste","panel.export":"Exportar .mid","panel.export.help":"Escribe el clip actual como .mid en la carpeta exports del dispositivo, visible en el navegador de Live.","panel.keys":"Atajos (Mayús +): G generar · R regenerar · V variar · Z deshacer · Y rehacer · P escuchar · ← → elegir · Intro usar"};
};
__svDefs["src/ui/geometry.js"] = function (module, exports, require) {
'use strict';
// Geometría pura de las visualizaciones (§8): círculo rítmico de Toussaint, rejilla de pasos, piano roll,
// línea de repeticiones y rejilla deformable. Devuelve números; el dibujo vive en draw.js.

const TAU = Math.PI * 2;

// Ángulo del paso i de n: el paso 0 arriba, sentido horario.
const stepAngle = (i, n) => -Math.PI / 2 + (TAU * i) / n;

// Círculo de Toussaint: marcas del ciclo, puntos de ataque por capa, polígono y arcos de agrupamiento.
function circleGeometry({ cycleLen, layers = [], grouping = null, weights = null }, cx, cy, r) {
  const n = Math.max(1, cycleLen);
  const ticks = [];
  const minW = weights ? Math.min(...weights) : 0;
  for (let i = 0; i < n; i++) {
    const a = stepAngle(i, n);
    const strength = weights && minW < 0 ? 1 - weights[i] / minW : i === 0 ? 1 : 0;
    ticks.push({ i, a, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, strength });
  }
  const shapes = layers.map((l, li) => {
    const rr = r * (1 - li * 0.14);
    const pts = l.onsets
      .filter((o) => o >= 0 && o < n)
      .map((o, k) => {
        const a = stepAngle(o, n);
        return { step: o, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, velocity: l.velocity ? l.velocity[k] : 100, timbre: l.timbre ? l.timbre[k] : 0 };
      });
    return { role: l.role, radius: rr, points: pts };
  });
  const arcs = [];
  if (Array.isArray(grouping) && grouping.reduce((s, g) => s + g, 0) === n) {
    let pos = 0;
    for (const g of grouping) { arcs.push({ start: stepAngle(pos, n), end: stepAngle(pos + g, n), from: pos, len: g }); pos += g; }
  }
  return { cx, cy, r, ticks, shapes, arcs };
}

// Línea de repeticiones: un bloque por ciclo, el último marcado si lleva variación final.
function repetitionLine(plan, x, y, w, h) {
  const reps = Math.max(1, plan.repeats || 1);
  const gap = reps > 16 ? 1 : 2;
  const bw = (w - gap * (reps - 1)) / reps;
  const blocks = [];
  for (let i = 0; i < reps; i++) blocks.push({ i, x: x + i * (bw + gap), y, w: bw, h, variation: plan.variationCycle === i });
  // marcas de compás dentro de la línea
  const bars = Math.round((plan.totalBeats || reps * plan.cycleBeats) / (plan.barBeats || 4));
  const barTicks = [];
  for (let b = 1; b < bars && bars <= 64; b++) barTicks.push(x + (w * b) / bars);
  return { blocks, barTicks };
}

// Piano roll: rectángulos por nota en un recuadro, con rango de alturas ajustado a las notas.
function pianoRoll(notes, lengthBeats, x, y, w, h, opts = {}) {
  if (!notes.length) return { rects: [], lo: 60, hi: 72 };
  let lo = Math.min(...notes.map((n) => n.pitch));
  let hi = Math.max(...notes.map((n) => n.pitch));
  if (hi - lo < (opts.minSpan || 12)) { const c = Math.round((hi + lo) / 2); lo = c - 6; hi = c + 6; }
  const rows = hi - lo + 1;
  const rh = h / rows;
  const sx = w / Math.max(lengthBeats, 1e-6);
  const rects = notes.map((n) => ({
    x: x + n.start_time * sx,
    y: y + (hi - n.pitch) * rh,
    w: Math.max(1.5, n.duration * sx - 0.5),
    h: Math.max(1.5, rh - (rh > 4 ? 1 : 0)),
    velocity: n.velocity, pitch: n.pitch, role: n.role,
  }));
  return { rects, lo, hi, rowHeight: rh, beatWidth: sx };
}

// Rejilla de pasos por capa para un ciclo: celdas con altura de velocity y desplazamiento de microtiempo.
function stepGrid({ cycleLen, layers }, x, y, w, h) {
  const n = Math.max(1, cycleLen);
  const rows = Math.max(1, layers.length);
  const cw = w / n;
  const rh = h / rows;
  const cells = [];
  layers.forEach((l, r) => {
    l.onsets.forEach((o, k) => {
      const vel = l.velocity ? l.velocity[k] : 100;
      const micro = l.microtiming ? l.microtiming[k] : 0;
      cells.push({ row: r, step: o, x: x + (o + micro) * cw, y: y + r * rh, w: cw - 1, h: rh - 1, velH: (rh - 2) * (vel / 127), velocity: vel, micro });
    });
  });
  const columns = Array.from({ length: n }, (_, i) => ({ i, x: x + i * cw }));
  return { cells, columns, cellWidth: cw, rowHeight: rh };
}

// Rejilla deformable (MIC.3): posición de cada paso según duraciones relativas, comparada con la isócrona.
function deformableGrid(positions, x, w) {
  const n = positions.length;
  return positions.map((p, i) => ({ i, x: x + p * w, isoX: x + (i / n) * w, offset: (p - i / n) * w }));
}

module.exports = { TAU, stepAngle, circleGeometry, repetitionLine, pianoRoll, stepGrid, deformableGrid };

};
__svDefs["src/ui/canvas.js"] = function (module, exports, require) {
'use strict';
// Contexto de dibujo con dos backends: mgraphics (v8ui en Max) y SVG (maquetas y pruebas en Node).
// Las vistas (strip.js, panel.js) solo usan estas primitivas, así el mismo código dibuja en ambos.
const { THEME, rgba } = require('./theme');

// ---------------------------------------------------------------- backend mgraphics
function fromMgraphics(mg) {
  const setColor = (c, a = 1) => { const v = Array.isArray(c) ? c : rgba(c, a); mg.set_source_rgba(v[0], v[1], v[2], v[3] ?? a); };
  const paint = (style) => {
    if (style.fill) { setColor(style.fill, style.fillAlpha ?? style.alpha ?? 1); if (style.stroke) mg.fill_preserve(); else mg.fill(); }
    if (style.stroke) { setColor(style.stroke, style.strokeAlpha ?? style.alpha ?? 1); mg.set_line_width(style.lw || 1); mg.stroke(); }
  };
  const font = (size, bold) => { mg.select_font_face(bold ? THEME.fontBold : THEME.font); mg.set_font_size(size); };
  return {
    kind: 'mgraphics',
    rect(x, y, w, h, style = {}) {
      if (style.r) mg.rectangle_rounded(x, y, w, h, style.r * 2, style.r * 2); else mg.rectangle(x, y, w, h);
      paint(style);
    },
    circle(cx, cy, r, style = {}) { mg.arc(cx, cy, r, 0, Math.PI * 2); paint(style); },
    arc(cx, cy, r, a0, a1, style = {}) { mg.arc(cx, cy, r, a0, a1); paint({ ...style, fill: null }); },
    line(x1, y1, x2, y2, style = {}) { mg.move_to(x1, y1); mg.line_to(x2, y2); paint({ stroke: style.stroke || style.color, lw: style.lw, alpha: style.alpha }); },
    poly(points, style = {}) {
      if (!points.length) return;
      mg.move_to(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) mg.line_to(points[i].x, points[i].y);
      if (style.closed !== false) mg.close_path();
      paint(style);
    },
    measure(str, size = THEME.size.md, bold = false) { font(size, bold); const m = mg.text_measure(String(str)); return m[0]; },
    text(str, x, y, style = {}) {
      const size = style.size || THEME.size.md;
      font(size, style.bold);
      const s = String(str);
      const w = mg.text_measure(s)[0];
      const dx = style.align === 'center' ? -w / 2 : style.align === 'right' ? -w : 0;
      setColor(style.color || THEME.text, style.alpha ?? 1);
      mg.move_to(x + dx, y + size * 0.36); // y = centro vertical de la línea
      mg.show_text(s);
    },
    clip(x, y, w, h) { mg.save(); mg.rectangle(x, y, w, h); mg.clip(); },
    unclip() { mg.restore(); },
  };
}

// ---------------------------------------------------------------- backend SVG
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (c, a = 1) => (Array.isArray(c) ? `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3] ?? a})` : c);
// Ancho aproximado de texto para SVG (Ableton Sans ≈ 0,56 em por carácter medio).
const approxWidth = (s, size, bold) => String(s).length * size * (bold ? 0.6 : 0.56);

function svgCanvas(width, height) {
  const out = [];
  let clipId = 0;
  const clipStack = [];
  const style = (s) => {
    const parts = [];
    parts.push(`fill="${s.fill ? col(s.fill) : 'none'}"`);
    if (s.fill && (s.fillAlpha ?? s.alpha ?? 1) < 1) parts.push(`fill-opacity="${s.fillAlpha ?? s.alpha}"`);
    if (s.stroke) parts.push(`stroke="${col(s.stroke)}" stroke-width="${s.lw || 1}"`);
    if (s.stroke && (s.strokeAlpha ?? s.alpha ?? 1) < 1) parts.push(`stroke-opacity="${s.strokeAlpha ?? s.alpha}"`);
    return parts.join(' ');
  };
  const push = (el) => out.push(clipStack.length ? el.replace(/^<(\w+)/, `<$1 clip-path="url(#c${clipStack[clipStack.length - 1]})"`) : el);
  return {
    kind: 'svg',
    rect(x, y, w, h, s = {}) { push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, w).toFixed(2)}" height="${Math.max(0, h).toFixed(2)}"${s.r ? ` rx="${s.r}"` : ''} ${style(s)}/>`); },
    circle(cx, cy, r, s = {}) { push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" ${style(s)}/>`); },
    arc(cx, cy, r, a0, a1, s = {}) {
      const x0 = cx + Math.cos(a0) * r; const y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r; const y1 = cy + Math.sin(a1) * r;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      push(`<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" ${style({ ...s, fill: null })}/>`);
    },
    line(x1, y1, x2, y2, s = {}) { push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ${style({ stroke: s.stroke || s.color, lw: s.lw, alpha: s.alpha })}/>`); },
    poly(points, s = {}) {
      if (!points.length) return;
      const tag = s.closed === false ? 'polyline' : 'polygon';
      push(`<${tag} points="${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" ${style(s)}/>`);
    },
    measure(str, size = THEME.size.md, bold = false) { return approxWidth(str, size, bold); },
    text(str, x, y, s = {}) {
      const size = s.size || THEME.size.md;
      const anchor = s.align === 'center' ? 'middle' : s.align === 'right' ? 'end' : 'start';
      push(`<text x="${x.toFixed(2)}" y="${(y + size * 0.36).toFixed(2)}" font-family="Ableton Sans, Inter, Segoe UI, Arial, sans-serif" font-size="${size}"${s.bold ? ' font-weight="700"' : ''} text-anchor="${anchor}" fill="${col(s.color || THEME.text)}"${(s.alpha ?? 1) < 1 ? ` fill-opacity="${s.alpha}"` : ''}>${esc(str)}</text>`);
    },
    clip(x, y, w, h) { clipId += 1; out.push(`<clipPath id="c${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`); clipStack.push(clipId); },
    unclip() { clipStack.pop(); },
    toString() { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${out.join('\n')}\n</svg>\n`; },
    elements: () => out.length,
  };
}

// Contexto que solo registra llamadas: para comprobar en pruebas que no se dibuja fuera del área, etc.
function recorderCanvas() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push([name, ...args]); };
  return { kind: 'recorder', calls, rect: rec('rect'), circle: rec('circle'), arc: rec('arc'), line: rec('line'), poly: rec('poly'), text: rec('text'), clip: rec('clip'), unclip: rec('unclip'), measure: (s, size = 11) => String(s).length * size * 0.56 };
}

// Recorta un texto para que quepa en `maxW` (añade «…»).
function ellipsize(g, str, maxW, size, bold) {
  const s = String(str);
  if (g.measure(s, size, bold) <= maxW) return s;
  let lo = 0; let hi = s.length;
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (g.measure(s.slice(0, m) + '…', size, bold) <= maxW) lo = m; else hi = m - 1; }
  return s.slice(0, lo) + '…';
}

module.exports = { fromMgraphics, svgCanvas, recorderCanvas, ellipsize };

};
__svDefs["src/ui/widgets.js"] = function (module, exports, require) {
'use strict';
// Componentes de dibujo reutilizables. Cada uno dibuja con el contexto `g` y registra sus zonas de clic en `hits`
// ({ x, y, w, h, action, help }). action: { kind: 'param'|'cmd'|'ui', name, value }.
const { THEME, mix, colorForId, roleColor } = require('./theme');
const { ellipsize } = require('./canvas');
const G = require('./geometry');

const hit = (hits, x, y, w, h, action, help) => { if (hits) hits.push({ x, y, w, h, action, help }); };

function panelBox(g, x, y, w, h, title, active = false) {
  g.rect(x, y, w, h, { fill: THEME.surface, stroke: active ? mix(THEME.line, THEME.accent, 0.35) : THEME.line, lw: 1, r: THEME.radius });
  if (title) g.text(title, x + 8, y + 10, { size: THEME.size.sm, color: active ? THEME.accent : THEME.dim, bold: true });
}

function button(g, hits, x, y, w, h, label, { selected = false, primary = false, disabled = false, action, help, size = THEME.size.md, glyph = null } = {}) {
  const fill = primary ? (disabled ? THEME.surface3 : THEME.accent) : selected ? mix(THEME.surface3, THEME.accent, 0.18) : THEME.surface2;
  const stroke = selected ? THEME.accent : primary ? THEME.accent : THEME.line;
  g.rect(x + 0.5, y + 0.5, w - 1, h - 1, { fill, stroke, lw: 1, r: THEME.radius });
  const color = primary ? THEME.bg : disabled ? THEME.faint : selected ? THEME.text : THEME.dim;
  let tx = x + w / 2;
  if (glyph) { drawGlyph(g, glyph, x + 11, y + h / 2, color); tx = x + 20 + (w - 20) / 2; }
  g.text(ellipsize(g, label, w - (glyph ? 24 : 8), size, primary || selected), tx, y + h / 2, { size, align: 'center', color, bold: primary || selected });
  if (!disabled) hit(hits, x, y, w, h, action, help);
}

function chip(g, x, y, label, color, { filled = false, size = THEME.size.xs } = {}) {
  const w = g.measure(label, size) + 10;
  g.rect(x, y, w, 13, { fill: filled ? color : mix(THEME.surface, color, 0.16), stroke: color, lw: 1, r: 6.5, strokeAlpha: 0.8 });
  g.text(label, x + 5, y + 6.5, { size, color: filled ? THEME.bg : color });
  return w;
}

function badges(g, hits, x, y, list, maxW) {
  const colors = { verificar: THEME.warn, corpus: THEME.corpus, 'datos faltantes': THEME.danger, 'uso restringido': THEME.restricted };
  const helps = { verificar: 'badge.help.verify', corpus: 'badge.help.corpus', 'datos faltantes': 'badge.help.missing', 'uso restringido': 'badge.help.restricted' };
  let cx = x;
  for (const b of list) {
    const w = g.measure(b, THEME.size.xs) + 10;
    if (cx + w > x + maxW) break;
    chip(g, cx, y, b, colors[b] || THEME.dim);
    hit(hits, cx, y, w, 13, { kind: 'ui', name: 'none' }, helps[b]);
    cx += w + 4;
  }
  return cx - x;
}

// Iconos simples de destino dibujados con primitivas.
function drawGlyph(g, kind, cx, cy, color) {
  const s = { stroke: color, lw: 1.4 };
  switch (kind) {
    case 'bassline': g.poly([{ x: cx - 6, y: cy + 2 }, { x: cx - 3, y: cy - 3 }, { x: cx, y: cy + 3 }, { x: cx + 3, y: cy - 2 }, { x: cx + 6, y: cy + 2 }], { ...s, closed: false }); break;
    case 'chords': for (const dy of [-4, 0, 4]) g.circle(cx, cy + dy, 1.8, { fill: color }); break;
    case 'arpeggio': [-5, -1.7, 1.7, 5].forEach((dx, i) => g.circle(cx + dx, cy + 4 - i * 2.7, 1.5, { fill: color })); break;
    case 'hihats': g.line(cx - 6, cy - 2, cx + 6, cy - 4, s); g.line(cx - 6, cy + 1, cx + 6, cy - 1, s); g.line(cx, cy - 3, cx, cy + 6, s); break;
    case 'ethnic': g.circle(cx, cy, 5.5, s); g.line(cx - 5.5, cy, cx + 5.5, cy, { stroke: color, lw: 1 }); break;
    case 'others': for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; const b = -Math.PI / 2 + ((k + 1) * 4 * Math.PI) / 5; g.line(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, cx + Math.cos(b) * 6, cy + Math.sin(b) * 6, { stroke: color, lw: 1 }); } break;
    case 'play': g.poly([{ x: cx - 3, y: cy - 4 }, { x: cx + 4, y: cy }, { x: cx - 3, y: cy + 4 }], { fill: color }); break;
    case 'stop': g.rect(cx - 3.5, cy - 3.5, 7, 7, { fill: color }); break;
    case 'undo': g.arc(cx + 1, cy + 1, 4.5, Math.PI, Math.PI * 1.9, s); g.poly([{ x: cx - 6, y: cy - 1 }, { x: cx - 3.5, y: cy + 3 }, { x: cx - 1, y: cy - 1 }], { fill: color }); break;
    case 'redo': g.arc(cx - 1, cy + 1, 4.5, Math.PI * 1.1, Math.PI * 2, s); g.poly([{ x: cx + 6, y: cy - 1 }, { x: cx + 3.5, y: cy + 3 }, { x: cx + 1, y: cy - 1 }], { fill: color }); break;
    case 'dice': g.rect(cx - 5, cy - 5, 10, 10, { stroke: color, lw: 1.2, r: 2 }); g.circle(cx - 2, cy - 2, 1.1, { fill: color }); g.circle(cx + 2, cy + 2, 1.1, { fill: color }); break;
    case 'lock': g.rect(cx - 4, cy - 1, 8, 6, { fill: color, r: 1 }); g.arc(cx, cy - 1, 3, Math.PI, Math.PI * 2, { stroke: color, lw: 1.3 }); break;
    case 'expand': g.poly([{ x: cx - 5, y: cy - 1 }, { x: cx - 5, y: cy - 5 }, { x: cx - 1, y: cy - 5 }], { ...s, closed: false }); g.poly([{ x: cx + 5, y: cy + 1 }, { x: cx + 5, y: cy + 5 }, { x: cx + 1, y: cy + 5 }], { ...s, closed: false }); break;
    default: break;
  }
}

// Flecha ‹ o › pulsable.
function arrow(g, hits, x, y, dir, action, help) {
  g.rect(x, y, 16, 16, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
  const c = THEME.dim;
  if (dir < 0) g.poly([{ x: x + 10, y: y + 4 }, { x: x + 5, y: y + 8 }, { x: x + 10, y: y + 12 }], { stroke: c, lw: 1.4, closed: false });
  else g.poly([{ x: x + 6, y: y + 4 }, { x: x + 11, y: y + 8 }, { x: x + 6, y: y + 12 }], { stroke: c, lw: 1.4, closed: false });
  hit(hits, x, y, 16, 16, action, help);
}

// Teclado de una octava: teclas de la escala encendidas, raíz marcada; clic → raíz.
function keyboard(g, hits, x, y, w, h, harmony, { action = (pc) => ({ kind: 'param', name: 'p_raiz', value: pc }), help } = {}) {
  const white = [0, 2, 4, 5, 7, 9, 11];
  const blackPos = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };
  const ww = w / 7;
  const pcs = new Set(harmony.intervals.map((i) => (harmony.root + i) % 12));
  white.forEach((pc, k) => {
    const on = pcs.has(pc);
    const isRoot = pc === harmony.root;
    g.rect(x + k * ww + 0.5, y, ww - 1, h, { fill: on ? mix('#D9DCE3', THEME.accent, 0.55) : '#C9CCD3', stroke: THEME.bg, lw: 1, r: 2 });
    if (isRoot) g.circle(x + k * ww + ww / 2, y + h - 7, 3.2, { fill: THEME.bg });
    hit(hits, x + k * ww, y, ww, h, action(pc), help);
  });
  for (const [pcStr, slot] of Object.entries(blackPos)) {
    const pc = Number(pcStr);
    const on = pcs.has(pc);
    const bx = x + slot * ww - ww * 0.32;
    g.rect(bx, y, ww * 0.64, h * 0.58, { fill: on ? mix('#2B2E36', THEME.accent, 0.6) : '#2B2E36', stroke: THEME.bg, lw: 1, r: 2 });
    if (pc === harmony.root) g.circle(bx + ww * 0.32, y + h * 0.58 - 6, 2.6, { fill: THEME.star });
    hit(hits, bx, y, ww * 0.64, h * 0.58, action(pc), help);
  }
  // las negras se registran después: la búsqueda de clics recorre las zonas al revés y gana la de encima
}

// Círculo rítmico de Toussaint dibujado como constelación.
function constellation(g, norm, cx, cy, r, { taxonomy = null, accentColor = THEME.accent, showTicks = true, maxLayers = 3, small = false } = {}) {
  g.circle(cx, cy, r + (small ? 3 : 6), { fill: mix(THEME.bg, accentColor, 0.05) });
  g.circle(cx, cy, r, { stroke: THEME.line, lw: 1 });
  if (!norm) return;
  const layers = norm.layers.filter((l) => l.onsets.length).slice(0, maxLayers);
  const geo = G.circleGeometry({ cycleLen: norm.cycle_len, layers, grouping: norm.grouping, weights: norm.weights }, cx, cy, r);
  for (const a of geo.arcs) g.arc(cx, cy, r + (small ? 2 : 4), a.start + 0.04, a.end - 0.04, { stroke: THEME.accent2, lw: small ? 1.2 : 2, alpha: 0.7 });
  if (showTicks && norm.cycle_len <= 64) {
    for (const tk of geo.ticks) {
      const len = 2 + tk.strength * (small ? 3 : 5);
      const dx = Math.cos(tk.a); const dy = Math.sin(tk.a);
      g.line(cx + dx * (r - len), cy + dy * (r - len), cx + dx * r, cy + dy * r, { stroke: tk.strength > 0.9 ? THEME.dim : THEME.faint, lw: tk.strength > 0.9 ? 1.4 : 1 });
    }
  }
  const roles = norm.layers.map((l) => l.role);
  geo.shapes.forEach((sh, li) => {
    const c = li === 0 ? accentColor : roleColor(sh.role, roles);
    if (sh.points.length > 1) g.poly(sh.points, { stroke: c, lw: small ? 1 : 1.4, strokeAlpha: 0.85, fill: c, fillAlpha: 0.08 });
    for (const p of sh.points) {
      const rr = (small ? 1.6 : 2.4) + (p.velocity / 127) * (small ? 1.6 : 2.8);
      g.circle(p.x, p.y, rr + (small ? 1.5 : 2.5), { fill: c, alpha: 0.18 });
      g.circle(p.x, p.y, rr, { fill: li === 0 ? THEME.star : c });
    }
  });
  if (taxonomy) { /* reservado: color por eje en el centro */ }
}

// Línea de repeticiones con la variación final marcada.
function repetitionBar(g, plan, x, y, w, h) {
  if (!plan) { g.rect(x, y, w, h, { fill: THEME.surface2, r: 2 }); return; }
  const geo = G.repetitionLine(plan, x, y, w, h);
  for (const b of geo.blocks) g.rect(b.x, b.y, b.w, b.h, { fill: b.variation ? THEME.accent2 : mix(THEME.surface3, THEME.accent, 0.35), r: 2 });
}

// Piano roll compacto de la vista previa, coloreado por capa.
function pianoRoll(g, preview, x, y, w, h, { maxBeats = null } = {}) {
  g.rect(x, y, w, h, { fill: THEME.bg, stroke: THEME.line, r: 3 });
  if (!preview || !preview.notes || !preview.notes.length) return;
  const notes = preview.notes.map((n) => (Array.isArray(n) ? { pitch: n[0], start_time: n[1], duration: n[2], velocity: n[3], role: n[4] } : n));
  const len = maxBeats ? Math.min(maxBeats, preview.length_beats) : preview.length_beats;
  const vis = notes.filter((n) => n.start_time < len);
  const geo = G.pianoRoll(vis, len, x + 2, y + 2, w - 4, h - 4);
  const bars = Math.round(len / 4);
  for (let b = 1; b < bars; b++) g.line(x + 2 + (w - 4) * (b / bars), y + 1, x + 2 + (w - 4) * (b / bars), y + h - 1, { stroke: THEME.line, lw: 1, alpha: 0.6 });
  const roles = [...new Set(notes.map((n) => n.role))];
  for (const r of geo.rects) g.rect(r.x, r.y, r.w, r.h, { fill: roleColor(r.role, roles), alpha: 0.35 + 0.65 * (r.velocity / 127), r: 1 });
}

module.exports = { hit, panelBox, button, chip, badges, drawGlyph, arrow, keyboard, constellation, repetitionBar, pianoRoll };

};
__svDefs["src/ui/model.js"] = function (module, exports, require) {
'use strict';
// Modelo de la interfaz: recibe los mensajes del motor («state», «harmony», «preview», «result», «analysis»,
// «error», «status») y deriva lo que necesitan las vistas. Las listas de los menús (destinos, modos, escalas,
// ritmos, repeticiones) salen de los mismos datos que los parámetros live.* del dispositivo.

const MODES = ['manual', 'live', 'adaptive', 'random'];
const REPEATS = ['auto', 3, 4, 8, 16, 'full'];

function create(SV) {
  const { data, core } = SV;
  return {
    SV,
    lists: {
      destinations: data.taxonomy.destinations.map((d) => d.id),
      modes: MODES,
      scales: data.scales.scales.map((s) => s.id),
      patterns: core.catalog.publicPatterns(data.patterns).map((p) => p.id),
      repeats: REPEATS,
    },
    state: { destination: 'chords', harmonyMode: 'manual', root: 0, scaleId: 'minor', patternId: 'RGG.10.2/stab_weighted', repeats: 'auto', seed: 1, locks: [] },
    harmony: null,
    preview: null,
    result: null,
    analysis: null,
    status: '',
    error: null,
    auditioning: false,
    hover: null,
    suggestions: null,
    showSuggest: false,
    history: [],
    presets: [],
    exported: null,
    panel: { axis: null, node: null, scroll: 0, treeScroll: 0, selected: null, text: '', onlyDest: true, verifiedOnly: false, tab: 'layers' },
    cache: {},
  };
}

function receive(model, type, payload) {
  let v = payload;
  if (typeof payload === 'string' && /^[[{]/.test(payload.trim())) { try { v = JSON.parse(payload); } catch (e) { v = payload; } }
  switch (type) {
    case 'state': model.state = { ...model.state, ...v }; break;
    case 'harmony': model.harmony = v; break;
    case 'preview': model.preview = v; break;
    case 'result': model.result = v; model.error = null; break;
    case 'analysis': model.analysis = v; break;
    case 'error': model.error = v && v.message ? v.message : String(v); break;
    case 'status': model.status = String(v); break;
    case 'audition': model.auditioning = !!Number(v); break;
    case 'search': model.panel.text = String(v || ''); model.panel.scroll = 0; break;
    case 'suggestions': model.suggestions = v; model.showSuggest = true; break;
    case 'history': model.history = Array.isArray(v) ? v : []; break;
    case 'presets': model.presets = Array.isArray(v) ? v : []; break;
    case 'exported': model.exported = v; break;
    default: return false;
  }
  return true;
}

const patternOf = (model, id) => model.SV.data.patterns.find((p) => p.id === (id || model.state.patternId)) || null;

// Patrón normalizado para dibujar su ciclo (con caché por id y semilla).
function normalized(model, id) {
  const p = patternOf(model, id);
  if (!p) return null;
  const key = `${p.id}@${model.state.seed}`;
  if (!model.cache[key]) {
    try { model.cache[key] = model.SV.core.normalizePattern(p, { rng: model.SV.core.createRng(`ui:${key}`) }); } catch (e) { model.cache[key] = null; }
  }
  return model.cache[key];
}

// Armonía mostrada: la que resolvió el motor, o la manual del estado mientras no llegue.
function harmonyOf(model) {
  if (model.harmony && Array.isArray(model.harmony.intervals)) return model.harmony;
  const sc = model.SV.data.scales.scales.find((s) => s.id === model.state.scaleId) || model.SV.data.scales.scales[0];
  return { root: model.state.root, intervals: sc.intervals, id: sc.id, name: sc.name, mode: model.state.harmonyMode };
}

// Ritmos navegables con las flechas de la franja: los públicos aptos para el destino actual.
function browseList(model) {
  return model.SV.core.catalog.search(model.SV.data.patterns, { destination: model.state.destination });
}

function patternIndex(model, id) { return model.lists.patterns.indexOf(id); }

// Lista del panel según filtros (texto, nodo de taxonomía, destino, solo verificados).
function panelList(model) {
  const f = model.panel;
  return model.SV.core.catalog.search(model.SV.data.patterns, {
    text: f.text, taxonomy: f.node || f.axis || undefined,
    destination: f.onlyDest ? model.state.destination : undefined, verifiedOnly: f.verifiedOnly,
  });
}

module.exports = { create, receive, patternOf, normalized, harmonyOf, browseList, patternIndex, panelList, MODES, REPEATS };

};
__svDefs["src/ui/strip.js"] = function (module, exports, require) {
'use strict';
// Franja compacta (≤ 169 px de alto): Destino · Armonía · Ritmo · Generar, cada módulo con su estado y su
// resumen visual, y una línea de estado que muestra ayudas (tooltips) al pasar el ratón.
const { THEME, mix, colorForId } = require('./theme');
const { t } = require('./strings');
const { ellipsize } = require('./canvas');
const W = require('./widgets');
const M = require('./model');

const SIZE = { width: 860, height: 169 };
const GLYPHS = { bassline: 'bassline', chords: 'chords', arpeggio: 'arpeggio', hihats: 'hihats', ethnic: 'ethnic', others: 'others' };

// Reparto horizontal de los cuatro módulos.
function layout(width = SIZE.width, height = SIZE.height) {
  const pad = 6;
  const top = 4;
  const statusH = 18;
  const h = height - top - statusH - 6;
  const ratios = [0.19, 0.25, 0.32, 0.24];
  const avail = width - pad * 5;
  const mods = [];
  let x = pad;
  for (const r of ratios) { const w = Math.floor(avail * r); mods.push({ x, y: top, w, h }); x += w + pad; }
  mods[3].w = width - pad - mods[3].x;
  return { mods, status: { x: pad, y: top + h + 4, w: width - pad * 2, h: statusH } };
}

function drawDestination(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step1'));
  const ids = m.lists.destinations;
  const cols = 2;
  const bw = (box.w - 12 - 4) / cols;
  const bh = 26;
  ids.forEach((id, i) => {
    const cx = box.x + 6 + (i % cols) * (bw + 4);
    const cy = box.y + 22 + Math.floor(i / cols) * (bh + 4);
    W.button(g, hits, cx, cy, bw, bh, t(`dest.${id}`), { selected: m.state.destination === id, glyph: GLYPHS[id], size: THEME.size.sm, action: { kind: 'param', name: 'p_destino', value: i }, help: t(`dest.help.${id}`) });
  });
}

function drawHarmony(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step2'));
  const h = M.harmonyOf(m);
  // modo
  const modes = m.lists.modes;
  const sw = (box.w - 12) / modes.length;
  modes.forEach((md, i) => W.button(g, hits, box.x + 6 + i * sw, box.y + 20, sw - (i < modes.length - 1 ? 2 : 0), 17, t(`mode.${md}`), { selected: m.state.harmonyMode === md, size: THEME.size.xs, action: { kind: 'param', name: 'p_armonia', value: i }, help: t(`mode.help.${md}`) }));
  // teclado
  W.keyboard(g, hits, box.x + 6, box.y + 42, box.w - 12, 38, h, { help: t('harmony.root.help') });
  // escala con flechas
  const sy = box.y + 86;
  const si = m.lists.scales.indexOf(h.id);
  W.arrow(g, hits, box.x + 6, sy, -1, { kind: 'param', name: 'p_escala', value: (si - 1 + m.lists.scales.length) % m.lists.scales.length }, t('harmony.scale.prev'));
  W.arrow(g, hits, box.x + box.w - 22, sy, 1, { kind: 'param', name: 'p_escala', value: (si + 1) % m.lists.scales.length }, t('harmony.scale.next'));
  const PC = m.SV.core.harmony.PC;
  const label = `${PC[h.root]} · ${h.name || h.id}`;
  g.text(ellipsize(g, label, box.w - 52, THEME.size.md, true), box.x + box.w / 2, sy + 8, { align: 'center', bold: true, size: THEME.size.md });
  // línea según el modo
  const ly = box.y + 110;
  const mode = m.state.harmonyMode;
  if (mode === 'adaptive') {
    W.button(g, hits, box.x + 6, ly, 64, 18, t('harmony.read'), { size: THEME.size.xs, action: { kind: 'cmd', name: 'analyze' }, help: t('mode.help.adaptive') });
    const a = m.analysis;
    const txt = a && a.key && a.key.name ? t('harmony.read.result', { key: a.key.name, conf: Math.round(a.key.confidence * 100) }) : '—';
    g.text(ellipsize(g, txt, box.w - 82, THEME.size.xs), box.x + 76, ly + 9, { size: THEME.size.xs, color: THEME.dim });
  } else if (mode === 'random') {
    W.button(g, hits, box.x + 6, ly, 64, 18, t('harmony.reroll'), { size: THEME.size.xs, glyph: 'dice', action: { kind: 'cmd', name: 'reroll' }, help: t('mode.help.random') });
    g.text(`${t('harmony.seed')} ${(m.harmony && m.harmony.seed) ?? '—'}`, box.x + 76, ly + 9, { size: THEME.size.xs, color: THEME.dim });
  } else if (mode === 'live') {
    g.text(ellipsize(g, t('mode.help.live'), box.w - 12, THEME.size.xs), box.x + 6, ly + 9, { size: THEME.size.xs, color: THEME.dim });
  } else {
    g.text(ellipsize(g, t('harmony.root.help'), box.w - 12, THEME.size.xs), box.x + 6, ly + 9, { size: THEME.size.xs, color: THEME.faint });
  }
}

function drawRhythm(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step3'));
  const p = M.patternOf(m);
  const norm = M.normalized(m);
  const tax = m.SV.data.taxonomy;
  const color = p ? colorForId(p.taxonomy[0], tax) : THEME.accent;
  const r = Math.min(46, (box.h - 30) / 2);
  const cx = box.x + 10 + r;
  const cy = box.y + 22 + r + 2;
  W.constellation(g, norm, cx, cy, r, { accentColor: color });
  hits.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, action: { kind: 'cmd', name: 'open_panel' }, help: t('rhythm.explore.help') });
  const tx = cx + r + 12;
  const tw = box.x + box.w - tx - 6;
  if (p) {
    g.text(ellipsize(g, p.name, tw, THEME.size.lg, true), tx, box.y + 26, { size: THEME.size.lg, bold: true });
    g.text(ellipsize(g, p.origin.tradition, tw, THEME.size.sm), tx, box.y + 42, { size: THEME.size.sm, color: THEME.dim });
    const list0 = M.browseList(m);
    const pos0 = list0.findIndex((x) => x.id === p.id);
    const cyc = (norm ? t('rhythm.cycle', { n: norm.cycle_len, meter: p.meter }) : p.meter) + (list0.length ? `  ·  ${pos0 + 1}/${list0.length}` : '');
    g.text(ellipsize(g, cyc, tw, THEME.size.xs), tx, box.y + 56, { size: THEME.size.xs, color: THEME.faint });
    // chips de taxonomía (color por eje) con su definición como ayuda
    let cxp = tx;
    const nodes = taxonomyIndex(m);
    for (const id of p.taxonomy.slice(0, 4)) {
      const w = g.measure(id, THEME.size.xs) + 10;
      if (cxp + w > tx + tw) break;
      W.chip(g, cxp, box.y + 66, id, colorForId(id, tax));
      const node = nodes[id];
      hits.push({ x: cxp, y: box.y + 66, w, h: 13, action: { kind: 'ui', name: 'none' }, help: node ? `${id} · ${node.name}: ${node.definition}` : id });
      cxp += w + 4;
    }
    W.badges(g, hits, tx, box.y + 84, m.SV.core.catalog.badges(p), tw);
  }
  // navegación
  const list = M.browseList(m);
  const pos = list.findIndex((x) => p && x.id === p.id);
  const by = box.y + box.h - 24;
  const go = (d) => {
    if (!list.length) return { kind: 'ui', name: 'none' };
    const next = list[((pos < 0 ? 0 : pos + d) + list.length) % list.length];
    return { kind: 'param', name: 'p_ritmo', value: M.patternIndex(m, next.id) };
  };
  W.arrow(g, hits, tx, by, -1, go(-1), t('rhythm.prev'));
  W.arrow(g, hits, tx + 20, by, 1, go(1), t('rhythm.next'));
  W.button(g, hits, box.x + box.w - 84, by - 1, 78, 18, t('rhythm.explore'), { size: THEME.size.xs, glyph: 'expand', action: { kind: 'cmd', name: 'open_panel' }, help: t('rhythm.explore.help') });
  W.button(g, hits, box.x + box.w - 154, by - 1, 66, 18, t('rhythm.suggest'), { size: THEME.size.xs, selected: m.showSuggest, action: { kind: 'cmd', name: 'suggest' }, help: t('rhythm.suggest.help') });
  if (m.showSuggest && m.suggestions) drawSuggestions(g, hits, m, box);

}

// Superposición con las tres sugerencias sobre el módulo de ritmo.
function drawSuggestions(g, hits, m, box) {
  const x = box.x + 4;
  const y = box.y + 18;
  const w = box.w - 8;
  const h = box.h - 22;
  g.rect(x, y, w, h, { fill: THEME.surface3, stroke: THEME.accent, r: 4, alpha: 0.98 });
  g.text(t('suggest.title'), x + 8, y + 10, { size: THEME.size.sm, bold: true, color: THEME.accent });
  hits.push({ x, y, w, h, action: { kind: 'ui', name: 'none' } });
  W.button(g, hits, x + w - 20, y + 3, 16, 14, '×', { size: THEME.size.sm, action: { kind: 'ui', name: 'close_suggest' }, help: t('suggest.close') });
  const list = (m.suggestions && m.suggestions.suggestions) || [];
  if (!list.length) { g.text(t('suggest.empty'), x + 8, y + 34, { size: THEME.size.sm, color: THEME.dim }); return; }
  const rowH = Math.min(34, (h - 24) / list.length);
  list.forEach((s, i) => {
    const ry = y + 22 + i * rowH;
    g.rect(x + 4, ry, w - 8, rowH - 3, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
    g.text(`${i + 1}. ${ellipsize(g, s.name, w - 70, THEME.size.sm, true)}`, x + 10, ry + 9, { size: THEME.size.sm, bold: true });
    g.text(`${Math.round(s.score * 100)}`, x + w - 12, ry + 9, { size: THEME.size.xs, color: THEME.accent, align: 'right' });
    g.text(ellipsize(g, s.reasons.join(' · '), w - 24, THEME.size.xs), x + 10, ry + 21, { size: THEME.size.xs, color: THEME.dim });
    hits.push({ x: x + 4, y: ry, w: w - 8, h: rowH - 3, action: { kind: 'cmd', name: 'use_suggestion', value: i }, help: t('suggest.use', { name: s.name, why: s.reasons.join(', ') }) });
  });
}

function drawGenerate(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step4'), true);
  const x = box.x + 6;
  const w = box.w - 12;
  W.button(g, hits, x, box.y + 20, w, 26, t('gen.generate'), { primary: true, size: THEME.size.lg, action: { kind: 'cmd', name: 'generate' }, help: t('gen.help.generate') });
  const half = (w - 4) / 2;
  W.button(g, hits, x, box.y + 50, half, 18, t('gen.regenerate'), { size: THEME.size.sm, action: { kind: 'cmd', name: 'regenerate' }, help: t('gen.help.regenerate') });
  W.button(g, hits, x + half + 4, box.y + 50, half, 18, t('gen.vary'), { size: THEME.size.sm, action: { kind: 'cmd', name: 'vary' }, help: t('gen.help.vary') });
  const q = (w - 8) / 3;
  W.button(g, hits, x, box.y + 72, q, 18, '', { glyph: 'undo', action: { kind: 'cmd', name: 'undo' }, help: t('gen.undo') });
  W.button(g, hits, x + q + 4, box.y + 72, q, 18, '', { glyph: 'redo', action: { kind: 'cmd', name: 'redo' }, help: t('gen.redo') });
  W.button(g, hits, x + 2 * (q + 4), box.y + 72, q, 18, '', { glyph: m.auditioning ? 'stop' : 'play', selected: m.auditioning, action: { kind: 'cmd', name: 'audition', value: m.auditioning ? 0 : 1 }, help: t('gen.help.audition') });
  // repeticiones
  const reps = m.lists.repeats;
  const rw = (w - (reps.length - 1) * 2) / reps.length;
  reps.forEach((r, i) => {
    const label = r === 'auto' ? t('gen.repeats.auto') : r === 'full' ? t('gen.repeats.full') : String(r);
    W.button(g, hits, x + i * (rw + 2), box.y + 94, rw, 15, label, { selected: String(m.state.repeats) === String(r), size: THEME.size.xs, action: { kind: 'param', name: 'p_repeticiones', value: i }, help: t('gen.repeats.help') });
  });
  const plan = m.preview && m.preview.plan;
  W.repetitionBar(g, plan, x, box.y + 113, w, 7);
  if (plan) {
    const txt = t('gen.summary', { bars: +plan.bars.toFixed(2), repeats: plan.repeats, cycle: +plan.cycleBeats.toFixed(2), variation: t(`var.${plan.variation}`) });
    g.text(ellipsize(g, txt, w, THEME.size.xs), x, box.y + 128, { size: THEME.size.xs, color: THEME.dim });
  }
}

function drawStatus(g, m, box) {
  g.rect(box.x, box.y, box.w, box.h, { fill: THEME.bg, stroke: THEME.line, r: 3 });
  let txt = m.hover && m.hover.help ? m.hover.help : m.error ? `Error: ${m.error}` : m.status || t('status.ready');
  const warn = m.preview && m.preview.meta && m.preview.meta.warnings && m.preview.meta.warnings[0];
  if (!m.hover && !m.error && warn) txt = warn;
  const color = m.error && !m.hover ? THEME.danger : m.hover ? THEME.text : warn ? THEME.warn : THEME.dim;
  g.text(ellipsize(g, txt, box.w - 16, THEME.size.sm), box.x + 8, box.y + box.h / 2, { size: THEME.size.sm, color });
}

function taxonomyIndex(m) {
  if (m.cache.__tax) return m.cache.__tax;
  const idx = {};
  const walk = (n) => { idx[n.id] = n; (n.children || []).forEach(walk); };
  for (const ax of m.SV.data.taxonomy.axes) { idx[ax.id] = { id: ax.id, name: ax.name, definition: ax.question }; ax.children.forEach(walk); }
  m.cache.__tax = idx;
  return idx;
}

// Dibuja la franja y devuelve las zonas de clic.
function draw(g, m, width = SIZE.width, height = SIZE.height) {
  const hits = [];
  g.rect(0, 0, width, height, { fill: THEME.bg });
  const L = layout(width, height);
  drawDestination(g, hits, m, L.mods[0]);
  drawHarmony(g, hits, m, L.mods[1]);
  drawRhythm(g, hits, m, L.mods[2]);
  drawGenerate(g, hits, m, L.mods[3]);
  drawStatus(g, m, L.status);
  return hits;
}

// Zona bajo el puntero (la última registrada gana: es la que se dibujó encima).
function hitTest(hits, x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  }
  return null;
}

// Acciones que la franja resuelve sin pasar por el motor.
function applyUiAction(m, action) {
  if (action.name === 'close_suggest') { m.showSuggest = false; return true; }
  return false;
}

module.exports = { SIZE, layout, draw, hitTest, taxonomyIndex, applyUiAction };

};
__svDefs["src/ui/panel.js"] = function (module, exports, require) {
'use strict';
// Panel ampliado (ventana flotante): navegador jerárquico por ejes con migas de pan, tarjetas de ritmos,
// detalle con definición, origen, fuentes y estatus, vista previa del clip (piano roll, repeticiones,
// rejilla deformable) y bloqueo de capas. Los controles de forma (live.*) van debajo, nativos.
const { THEME, mix, colorForId, roleColor } = require('./theme');
const { t } = require('./strings');
const { ellipsize } = require('./canvas');
const W = require('./widgets');
const M = require('./model');
const G = require('./geometry');
const { taxonomyIndex } = require('./strip');

const SIZE = { width: 1000, height: 640 };
const AREAS = {
  header: { x: 8, y: 6, w: 984, h: 30 },
  search: { x: 700, y: 9, w: 180, h: 22 }, // aquí va el [textedit] nativo, encima del v8ui
  tree: { x: 8, y: 44, w: 220, h: 404 },
  cards: { x: 236, y: 44, w: 380, h: 404 },
  detail: { x: 624, y: 44, w: 368, h: 404 },
  preview: { x: 8, y: 456, w: 700, h: 176 },
  layers: { x: 716, y: 456, w: 276, h: 176 },
};
const ROW = 18;
const CARD = 54;

// Texto en varias líneas dentro de un ancho.
function wrap(g, text, maxW, size) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (g.measure(test, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function paragraph(g, text, x, y, maxW, size, color, maxLines = 6) {
  const lines = wrap(g, text, maxW, size);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = ellipsize(g, `${shown[maxLines - 1]} …`, maxW, size);
  shown.forEach((l, i) => g.text(l, x, y + i * (size + 4), { size, color }));
  return shown.length * (size + 4);
}

// Filas visibles del árbol: ejes; el eje elegido se despliega con sus nodos hasta el nodo elegido.
function treeRows(m) {
  const tax = m.SV.data.taxonomy;
  const rows = [];
  const sel = m.panel.node || m.panel.axis;
  const onPath = (id) => sel && (sel === id || sel.startsWith(id + '.'));
  const walk = (node, depth, axis) => {
    rows.push({ id: node.id, name: node.name, depth, axis, hasChildren: !!(node.children && node.children.length) });
    if (node.children && (onPath(node.id) || sel === node.id)) node.children.forEach((c) => walk(c, depth + 1, axis));
  };
  for (const ax of tax.axes) {
    rows.push({ id: ax.id, name: ax.name, depth: 0, axis: ax.id, isAxis: true, hasChildren: true });
    if (onPath(ax.id)) ax.children.forEach((c) => walk(c, 1, ax.id));
  }
  return rows;
}

function drawHeader(g, hits, m) {
  const a = AREAS.header;
  g.text(t('panel.title'), a.x, a.y + 14, { size: THEME.size.xl, bold: true });
  // migas de pan
  let x = a.x + 190;
  const crumbs = [{ id: null, name: t('panel.all') }];
  const idx = taxonomyIndex(m);
  const sel = m.panel.node || m.panel.axis;
  if (sel) {
    const parts = sel.split('.');
    for (let i = 1; i <= parts.length; i++) {
      const id = parts.slice(0, i).join('.');
      if (idx[id]) crumbs.push({ id, name: i === 1 ? idx[id].name : id });
    }
  }
  crumbs.forEach((c, i) => {
    const label = ellipsize(g, c.name, 120, THEME.size.sm);
    const w = g.measure(label, THEME.size.sm);
    const last = i === crumbs.length - 1;
    g.text(label, x, a.y + 15, { size: THEME.size.sm, color: last ? THEME.text : THEME.dim, bold: last });
    hits.push({ x, y: a.y + 6, w, h: 18, action: { kind: 'ui', name: 'crumb', value: c.id }, help: c.id ? (idx[c.id] && idx[c.id].definition) : t('panel.all') });
    x += w + 6;
    if (!last) { g.text('›', x, a.y + 15, { size: THEME.size.sm, color: THEME.faint }); x += 12; }
  });
  // filtros
  const s = AREAS.search;
  g.rect(s.x, s.y, s.w, s.h, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
  if (!m.panel.text) g.text('Buscar…', s.x + 8, s.y + s.h / 2, { size: THEME.size.sm, color: THEME.faint });
  else g.text(ellipsize(g, m.panel.text, s.w - 12, THEME.size.sm), s.x + 8, s.y + s.h / 2, { size: THEME.size.sm });
  const dest = t(`dest.${m.state.destination}`);
  W.button(g, hits, s.x - 214, s.y, 104, 22, t('panel.only_dest', { dest }), { selected: m.panel.onlyDest, size: THEME.size.xs, action: { kind: 'ui', name: 'toggle', value: 'onlyDest' } });
  W.button(g, hits, s.x - 106, s.y, 100, 22, t('panel.verified'), { selected: m.panel.verifiedOnly, size: THEME.size.xs, action: { kind: 'ui', name: 'toggle', value: 'verifiedOnly' } });
  const n = M.panelList(m).length;
  g.text(t('panel.results', { n }), s.x + s.w + 10, s.y + s.h / 2, { size: THEME.size.sm, color: THEME.dim });
}

function drawTree(g, hits, m) {
  const a = AREAS.tree;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const rows = treeRows(m);
  const tax = m.SV.data.taxonomy;
  const visible = Math.floor((a.h - 8) / ROW);
  const maxScroll = Math.max(0, rows.length - visible);
  m.panel.treeScroll = Math.min(m.panel.treeScroll, maxScroll);
  hits.push({ x: a.x, y: a.y, w: a.w, h: a.h, action: { kind: 'scroll', name: 'treeScroll', rowH: ROW, max: maxScroll } });
  const sel = m.panel.node || m.panel.axis;
  const idx = taxonomyIndex(m);
  rows.slice(m.panel.treeScroll, m.panel.treeScroll + visible).forEach((r, i) => {
    const y = a.y + 4 + i * ROW;
    const x = a.x + 8 + r.depth * 12;
    const active = sel === r.id;
    if (active) g.rect(a.x + 3, y, a.w - 6, ROW - 1, { fill: mix(THEME.surface2, THEME.accent, 0.15), r: 3 });
    const c = colorForId(r.axis, tax);
    if (r.isAxis) g.circle(x + 4, y + ROW / 2, 4, { fill: c });
    else g.circle(x + 4, y + ROW / 2, 2, { fill: c, alpha: 0.8 });
    const label = r.isAxis ? `${r.id} · ${r.name}` : `${r.id}  ${r.name}`;
    g.text(ellipsize(g, label, a.w - (x - a.x) - 22, THEME.size.sm, r.isAxis), x + 12, y + ROW / 2, { size: THEME.size.sm, color: active ? THEME.text : r.isAxis ? THEME.text : THEME.dim, bold: r.isAxis });
    const node = idx[r.id];
    hits.push({ x: a.x, y, w: a.w, h: ROW, action: { kind: 'ui', name: 'node', value: r.id, axis: r.isAxis }, help: node ? `${r.id} · ${node.name}: ${node.definition}` : r.id });
  });
}

function drawCards(g, hits, m) {
  const a = AREAS.cards;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const list = M.panelList(m);
  const visible = Math.floor((a.h - 8) / CARD);
  const maxScroll = Math.max(0, list.length - visible);
  m.panel.scroll = Math.min(m.panel.scroll, maxScroll);
  hits.push({ x: a.x, y: a.y, w: a.w, h: a.h, action: { kind: 'scroll', name: 'scroll', rowH: CARD, max: maxScroll } });
  const tax = m.SV.data.taxonomy;
  const selected = m.panel.selected || m.state.patternId;
  list.slice(m.panel.scroll, m.panel.scroll + visible).forEach((p, i) => {
    const y = a.y + 4 + i * CARD;
    const active = p.id === selected;
    const current = p.id === m.state.patternId;
    g.rect(a.x + 4, y, a.w - 8, CARD - 4, { fill: active ? mix(THEME.surface2, THEME.accent, 0.12) : THEME.surface2, stroke: active ? THEME.accent : current ? THEME.accent2 : THEME.line, r: 4 });
    const norm = M.normalized(m, p.id);
    W.constellation(g, norm, a.x + 30, y + (CARD - 4) / 2, 17, { accentColor: colorForId(p.taxonomy[0], tax), showTicks: false, small: true, maxLayers: 2 });
    const tx = a.x + 56;
    const tw = a.w - 64;
    g.text(ellipsize(g, p.name, tw, THEME.size.md, true), tx, y + 12, { size: THEME.size.md, bold: true });
    const sub = `${p.origin.tradition} · ${p.meter}${norm ? ` · ${norm.cycle_len}` : ''}`;
    g.text(ellipsize(g, sub, tw, THEME.size.xs), tx, y + 26, { size: THEME.size.xs, color: THEME.dim });
    W.badges(g, null, tx, y + 34, m.SV.core.catalog.badges(p), tw);
    hits.push({ x: a.x + 4, y, w: a.w - 8, h: CARD - 4, action: { kind: 'ui', name: 'select', value: p.id }, help: `${p.id} · ${p.origin.context || p.origin.tradition}` });
  });
  if (!list.length) {
    g.text(t('panel.empty'), a.x + a.w / 2, a.y + 40, { align: 'center', color: THEME.dim });
    if (m.panel.onlyDest) {
      const others = M.panelList({ ...m, panel: { ...m.panel, onlyDest: false } }).length;
      if (others) g.text(t('panel.other_dest', { n: others }), a.x + a.w / 2, a.y + 58, { align: 'center', color: THEME.warn, size: THEME.size.sm });
    }
  }
}

function drawDetail(g, hits, m) {
  const a = AREAS.detail;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const id = m.panel.selected || m.state.patternId;
  const p = M.patternOf(m, id);
  if (!p) return;
  const tax = m.SV.data.taxonomy;
  const idx = taxonomyIndex(m);
  const norm = M.normalized(m, p.id);
  const color = colorForId(p.taxonomy[0], tax);
  W.constellation(g, norm, a.x + 72, a.y + 76, 58, { accentColor: color });
  const tx = a.x + 144;
  const tw = a.w - 152;
  paragraph(g, p.name, tx, a.y + 16, tw, THEME.size.lg, THEME.text, 2);
  g.text(ellipsize(g, p.id, tw, THEME.size.xs), tx, a.y + 52, { size: THEME.size.xs, color: THEME.faint });
  g.text(ellipsize(g, p.origin.tradition, tw, THEME.size.sm), tx, a.y + 68, { size: THEME.size.sm, color: THEME.dim });
  g.text(ellipsize(g, `${p.meter}${norm ? ` · ciclo ${norm.cycle_len} · ${+(norm.cycle_len * p.step_value).toFixed(2)} negras` : ''}`, tw, THEME.size.xs), tx, a.y + 84, { size: THEME.size.xs, color: THEME.faint });
  W.badges(g, hits, tx, a.y + 96, m.SV.core.catalog.badges(p).concat([`[${p.status}]`]), tw);
  let y = a.y + 146;
  let cx = a.x + 10;
  for (const tid of p.taxonomy) {
    const w = g.measure(tid, THEME.size.xs) + 10;
    if (cx + w > a.x + a.w - 10) break;
    W.chip(g, cx, y, tid, colorForId(tid, tax));
    const node = idx[tid];
    hits.push({ x: cx, y, w, h: 13, action: { kind: 'ui', name: 'node', value: tid }, help: node ? `${tid} · ${node.name}: ${node.definition}` : tid });
    cx += w + 4;
  }
  y += 22;
  const main = idx[p.taxonomy[0]];
  const section = (title, body, lines = 4) => {
    if (!body) return;
    g.text(title, a.x + 10, y, { size: THEME.size.xs, color: THEME.accent, bold: true });
    y += 12;
    y += paragraph(g, body, a.x + 10, y, a.w - 20, THEME.size.sm, THEME.dim, lines) + 4;
  };
  if (main) section(t('panel.definition'), `${main.name}: ${main.definition}`, 4);
  const o = p.origin;
  section(t('panel.origin'), [o.context, (o.genre || []).join(', '), (o.attributions || []).length ? `Atribución: ${o.attributions.join(', ')}` : ''].filter(Boolean).join(' · '), 3);
  section(t('panel.sources'), (o.sources || []).join(' · '), 2);
  if (p.verify_notes) section('Por verificar', p.verify_notes, 2);
  if (p.cultural_note) section('Contexto cultural', p.cultural_note, 3);
  const by = a.y + a.h - 30;
  const isCurrent = p.id === m.state.patternId;
  W.button(g, hits, a.x + 10, by, 160, 22, t('panel.use'), { primary: !isCurrent, selected: isCurrent, size: THEME.size.sm, action: { kind: 'param', name: 'p_ritmo', value: M.patternIndex(m, p.id) }, help: 'Elige este ritmo en el paso 3.' });
  W.button(g, hits, a.x + 176, by, 90, 22, m.auditioning ? 'Parar' : t('gen.audition'), { glyph: m.auditioning ? 'stop' : 'play', selected: m.auditioning, size: THEME.size.sm, action: { kind: 'cmd', name: 'audition', value: m.auditioning ? 0 : 1 }, help: t('gen.help.audition') });
  W.button(g, hits, a.x + 272, by, 86, 22, t('gen.generate'), { size: THEME.size.sm, action: { kind: 'cmd', name: 'generate' }, help: t('gen.help.generate') });
}

function drawPreview(g, hits, m) {
  const a = AREAS.preview;
  W.panelBox(g, a.x, a.y, a.w, a.h, t('panel.preview'));
  const pv = m.preview;
  W.pianoRoll(g, pv, a.x + 8, a.y + 20, a.w - 16, 100);
  W.repetitionBar(g, pv && pv.plan, a.x + 8, a.y + 126, a.w - 16, 8);
  W.button(g, hits, a.x + a.w - 98, a.y + 2, 90, 16, t('panel.export'), { size: THEME.size.xs, action: { kind: 'cmd', name: 'export_midi' }, help: t('panel.export.help') });
  g.text(ellipsize(g, t('panel.keys'), a.w - 260, THEME.size.xs), a.x + 150, a.y + 10, { size: THEME.size.xs, color: THEME.faint });
  if (pv && pv.plan) {
    const plan = pv.plan;
    g.text(t('gen.summary', { bars: +plan.bars.toFixed(2), repeats: plan.repeats, cycle: +plan.cycleBeats.toFixed(2), variation: t(`var.${plan.variation}`) }), a.x + 8, a.y + 144, { size: THEME.size.xs, color: THEME.dim });
  }
  // rejilla deformable de la plantilla de microtiempo, si la hay
  const tplId = m.state.options && m.state.options.microtiming;
  const tpl = tplId && m.SV.data.microtiming.templates.find((x) => x.id === tplId);
  const gy = a.y + 160;
  g.text(t('panel.grid'), a.x + 8, gy, { size: THEME.size.xs, color: THEME.faint });
  const gx = a.x + 110;
  const gw = a.w - 118;
  let positions = null;
  if (tpl && tpl.beat_proportions) positions = m.SV.core.gridFromBeatProportions(tpl.beat_proportions, 1);
  else if (tpl && tpl.step_offsets) { const n = tpl.step_offsets.length; positions = tpl.step_offsets.map((o, i) => (i + o) / n); }
  const cells = positions ? G.deformableGrid(positions, gx, gw) : Array.from({ length: 4 }, (_, i) => ({ x: gx + (i / 4) * gw, isoX: gx + (i / 4) * gw }));
  g.line(gx, gy, gx + gw, gy, { stroke: THEME.line });
  for (const c of cells) {
    g.line(c.isoX, gy - 5, c.isoX, gy + 5, { stroke: THEME.faint, lw: 1 });
    g.circle(c.x, gy, 3, { fill: Math.abs(c.x - c.isoX) > 0.5 ? THEME.accent2 : THEME.dim });
  }
  g.text(tpl ? tpl.name : 'recto', gx + gw, gy - 9, { size: THEME.size.xs, color: THEME.faint, align: 'right' });
}

// Caja lateral con pestañas: Capas (bloqueo), Historial y Preajustes.
function drawSide(g, hits, m) {
  const a = AREAS.layers;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const tabs = ['layers', 'history', 'presets'];
  const tw = (a.w - 12) / tabs.length;
  tabs.forEach((id, i) => W.button(g, hits, a.x + 6 + i * tw, a.y + 5, tw - 3, 17, t(`panel.tab.${id}`), { selected: m.panel.tab === id, size: THEME.size.xs, action: { kind: 'ui', name: 'tab', value: id } }));
  if (m.panel.tab === 'history') drawHistory(g, hits, m, a);
  else if (m.panel.tab === 'presets') drawPresets(g, hits, m, a);
  else drawLayers(g, hits, m, a);
}

function drawHistory(g, hits, m, a) {
  const list = (m.history || []).slice().reverse().slice(0, 7);
  if (!list.length) { g.text(t('panel.history.empty'), a.x + 10, a.y + 40, { size: THEME.size.sm, color: THEME.dim }); return; }
  list.forEach((h, k) => {
    const y = a.y + 28 + k * 20;
    g.rect(a.x + 6, y, a.w - 12, 18, { fill: h.current ? mix(THEME.surface2, THEME.accent, 0.15) : THEME.surface2, stroke: h.current ? THEME.accent : THEME.line, r: 3 });
    g.text(ellipsize(g, t('panel.history.row', { n: h.i + 1, name: h.name, seed: h.seed }), a.w - 24, THEME.size.xs), a.x + 12, y + 9, { size: THEME.size.xs, color: h.current ? THEME.text : THEME.dim });
    hits.push({ x: a.x + 6, y, w: a.w - 12, h: 18, action: { kind: 'cmd', name: 'history_goto', value: h.i }, help: t('panel.history.help') });
  });
}

function drawPresets(g, hits, m, a) {
  W.button(g, hits, a.x + 6, a.y + 27, a.w - 12, 18, t('panel.presets.save'), { size: THEME.size.xs, action: { kind: 'cmd', name: 'preset_save' }, help: t('panel.presets.save.help') });
  const list = (m.presets || []).slice(0, 6);
  if (!list.length) { g.text(t('panel.presets.empty'), a.x + 10, a.y + 60, { size: THEME.size.sm, color: THEME.dim }); return; }
  list.forEach((p, k) => {
    const y = a.y + 50 + k * 20;
    g.rect(a.x + 6, y, a.w - 34, 18, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
    g.text(ellipsize(g, p.name, a.w - 48, THEME.size.xs), a.x + 12, y + 9, { size: THEME.size.xs });
    hits.push({ x: a.x + 6, y, w: a.w - 34, h: 18, action: { kind: 'cmd', name: 'preset_load', value: p.i }, help: t('panel.presets.help') });
    W.button(g, hits, a.x + a.w - 26, y, 20, 18, '×', { size: THEME.size.sm, action: { kind: 'cmd', name: 'preset_delete', value: p.i }, help: t('panel.presets.delete') });
  });
}

function drawLayers(g, hits, m, a) {
  const norm = M.normalized(m);
  if (!norm) return;
  const roles = norm.layers.map((l) => l.role);
  const locks = new Set(m.state.locks || []);
  roles.slice(0, 6).forEach((r, i) => {
    const y = a.y + 28 + i * 21;
    const on = locks.has(r);
    g.rect(a.x + 8, y, a.w - 16, 18, { fill: on ? mix(THEME.surface2, THEME.warn, 0.15) : THEME.surface2, stroke: on ? THEME.warn : THEME.line, r: 3 });
    g.circle(a.x + 18, y + 9, 4, { fill: roleColor(r, roles) });
    g.text(`${r} · ${norm.layers[i].onsets.length} ataques`, a.x + 28, y + 9, { size: THEME.size.sm, color: on ? THEME.text : THEME.dim });
    W.drawGlyph(g, 'lock', a.x + a.w - 22, y + 9, on ? THEME.warn : THEME.faint);
    hits.push({ x: a.x + 8, y, w: a.w - 16, h: 18, action: { kind: 'cmd', name: 'lock', value: [r, on ? 0 : 1] }, help: `Bloquear «${r}»: al regenerar, esta capa conserva sus notas.` });
  });
}

function draw(g, m, width = SIZE.width, height = SIZE.height) {
  const hits = [];
  g.rect(0, 0, width, height, { fill: THEME.bg });
  drawHeader(g, hits, m);
  drawTree(g, hits, m);
  drawCards(g, hits, m);
  drawDetail(g, hits, m);
  drawPreview(g, hits, m);
  drawSide(g, hits, m);
  if (m.hover && m.hover.help) {
    // ayuda flotante en la parte inferior del detalle
    const a = AREAS.detail;
    const lines = wrap(g, m.hover.help, a.w - 20, THEME.size.sm).slice(0, 3);
    const h = lines.length * 14 + 10;
    g.rect(a.x + 4, a.y + a.h - h - 36, a.w - 8, h, { fill: THEME.surface3, stroke: THEME.accent, r: 4, alpha: 0.97 });
    lines.forEach((l, i) => g.text(l, a.x + 12, a.y + a.h - h - 36 + 12 + i * 14, { size: THEME.size.sm }));
  }
  return hits;
}

// Acciones que el panel resuelve sin pasar por el motor.
function applyUiAction(m, action) {
  const p = m.panel;
  switch (action.name) {
    case 'node': if (action.axis) { p.axis = action.value; p.node = null; } else { p.axis = action.value.slice(0, 3); p.node = action.value; } p.scroll = 0; return true;
    case 'crumb': if (!action.value) { p.axis = null; p.node = null; } else if (action.value.length === 3) { p.axis = action.value; p.node = null; } else p.node = action.value; p.scroll = 0; return true;
    case 'toggle': p[action.value] = !p[action.value]; p.scroll = 0; return true;
    case 'select': p.selected = action.value; return true;
    case 'tab': p.tab = action.value; return true;
    default: return false;
  }
}

// Atajos de teclado del panel ([key] en la ventana). Devuelve la acción a enviar o null.
// [key] recibe también lo que se escribe en el buscador: por eso las letras solo cuentan en mayúscula (Mayús + letra).
// Códigos de [key] en Windows: flechas 28 ← 29 → 30 ↑ 31 ↓, Intro 13.
function keyAction(m, code) {
  const c = Number(code);
  const ch = c >= 65 && c <= 90 ? String.fromCharCode(c) : '';
  if (ch === 'G') return { kind: 'cmd', name: 'generate' };
  if (ch === 'R') return { kind: 'cmd', name: 'regenerate' };
  if (ch === 'V') return { kind: 'cmd', name: 'vary' };
  if (ch === 'Z') return { kind: 'cmd', name: 'undo' };
  if (ch === 'Y') return { kind: 'cmd', name: 'redo' };
  if (ch === 'P') return { kind: 'cmd', name: 'audition', value: m.auditioning ? 0 : 1 };
  const list = M.panelList(m);
  if (!list.length) return null;
  const cur = Math.max(0, list.findIndex((p) => p.id === (m.panel.selected || m.state.patternId)));
  if (c === 28 || c === 30 || c === 29 || c === 31) {
    const next = list[(cur + (c === 28 || c === 30 ? -1 : 1) + list.length) % list.length];
    m.panel.selected = next.id;
    const visible = Math.floor((AREAS.cards.h - 8) / CARD);
    const pos = list.indexOf(next);
    if (pos < m.panel.scroll) m.panel.scroll = pos;
    if (pos >= m.panel.scroll + visible) m.panel.scroll = pos - visible + 1;
    return { kind: 'ui', name: 'none' };
  }
  if (c === 13) return { kind: 'param', name: 'p_ritmo', value: M.patternIndex(m, list[cur].id) };
  return null;
}

module.exports = { SIZE, AREAS, draw, treeRows, wrap, applyUiAction, keyAction };

};
__svDefs["src/ui/listen_view.js"] = function (module, exports, require) {
'use strict';
// Vista de SV Listen (franja de 300 × 169): nivel, croma (12 barras), ocupación de ataques y bombo por paso.
const { THEME, mix } = require('./theme');
const { ellipsize } = require('./canvas');
const W = require('./widgets');

const SIZE = { width: 300, height: 169 };
const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function draw(g, s, width = SIZE.width, height = SIZE.height) {
  g.rect(0, 0, width, height, { fill: THEME.bg });
  W.panelBox(g, 4, 4, width - 8, height - 8, 'SV Listen', true);
  const name = s && s.name ? s.name : '—';
  g.text(ellipsize(g, name, width - 120, THEME.size.sm), 84, 14, { size: THEME.size.sm, color: THEME.dim });
  // nivel
  const lv = s ? Math.min(1, (s.level || 0) * 4) : 0;
  g.rect(width - 52, 9, 40, 6, { fill: THEME.surface2, r: 2 });
  g.rect(width - 52, 9, 40 * lv, 6, { fill: lv > 0.9 ? THEME.danger : THEME.ok, r: 2 });
  // croma
  const cx = 12;
  const cw = (width - 24) / 12;
  const top = 30;
  const ch = 56;
  const chroma = (s && s.chroma) || new Array(12).fill(0);
  const max = Math.max(0.0001, ...chroma);
  chroma.forEach((v, i) => {
    const h = (v / max) * ch;
    const strong = v / max > 0.6;
    g.rect(cx + i * cw + 1, top + ch - h, cw - 2, h, { fill: strong ? THEME.accent : mix(THEME.surface3, THEME.accent, 0.4), r: 1 });
    g.text(PC[i], cx + i * cw + cw / 2, top + ch + 8, { size: THEME.size.xs, align: 'center', color: strong ? THEME.text : THEME.faint });
  });
  // ocupación y bombo
  const rows = [['ataques', (s && s.occupancy) || []], ['bombo', (s && s.kick) || []]];
  rows.forEach(([label, arr], r) => {
    const y = top + ch + 20 + r * 16;
    g.text(label, 12, y + 5, { size: THEME.size.xs, color: THEME.faint });
    const gx = 60;
    const gw = (width - gx - 12) / 16;
    for (let i = 0; i < 16; i++) {
      const v = arr[i] || 0;
      g.rect(gx + i * gw + 1, y, gw - 2, 11, { fill: v > 0 ? (r ? THEME.accent2 : THEME.accent) : THEME.surface2, fillAlpha: v > 0 ? 0.25 + 0.75 * v : 1, r: 2 });
    }
  });
  const info = s ? `${s.onsets || 0} ataques · ${s.kicks || 0} bombos en ${s.bars || 8} compases${s.active === false ? ' · en pausa' : ''}` : 'Esperando audio…';
  g.text(ellipsize(g, info, width - 24, THEME.size.xs), 12, height - 14, { size: THEME.size.xs, color: THEME.dim });
}

module.exports = { SIZE, draw };

};
var __svData = {"taxonomy":{"version":"1.0.0","sources":["docs/meta_analisis_ritmo_max4live.md","docs/clasificacion_ritmica_reggae_dub_steppers.md","docs/analisis_corpus_midi.md"],"status_legend":{"H":"Hecho documentado en la fuente citada","I":"Interpretación analítica compartida en la literatura","Hip":"Hipótesis abierta","V":"Dato por verificar en una transcripción o fuente primaria","C":"Medido en el corpus MIDI de referencia (packs); describe una práctica de programación"},"axes":[{"id":"MET","name":"Métrica","question":"¿Cómo se organiza y se divide el tiempo?","color":"#4FC3F7","children":[{"id":"MET.1","name":"Pulso, tactus y tempo","status":"H","definition":"Serie isócrona que el oyente infiere y a la que sincroniza el cuerpo; el tactus es el nivel más saliente y el tempo su velocidad. Elementos métricos entre ~100 ms y ~2 s.","params":["bpm","tactus_level"]},{"id":"MET.2","name":"Jerarquía métrica","status":"H","definition":"Pulsos periódicos anidados: subdivisión, pulso, compás, hipercompás.","params":["beats_per_bar","beat_division","hyper_len"],"children":[{"id":"MET.2.1","name":"Binaria","status":"H","definition":"Cada nivel se divide en 2 (2/4, 4/4)."},{"id":"MET.2.2","name":"Ternaria","status":"H","definition":"Compás de 3 pulsos (3/4: vals, mazurca, jota, sevillanas)."},{"id":"MET.2.3","name":"Cuaternaria","status":"H","definition":"4 pulsos con jerarquía fuerte, débil, semifuerte, débil."},{"id":"MET.2.4","name":"Compuesta","status":"H","definition":"El pulso se divide en 3 (6/8, 9/8, 12/8)."},{"id":"MET.2.5","name":"Hipermetro","status":"H","definition":"Frases de 2, 4, 8 y 16 compases (Cone, Rothstein); rige la forma de la música electrónica de baile."}]},{"id":"MET.3","name":"Compases aditivos y no isócronos","status":"H","definition":"Compases formados por unidades desiguales, típicamente de 2 y 3.","params":["grouping","unit"],"children":[{"id":"MET.3.1","name":"Amalgama","status":"H","definition":"Suma de compases de igual denominador que conservan sus acentos (5/4 = 3/4 + 2/4)."},{"id":"MET.3.2","name":"Compás de tiempos desiguales","status":"H","definition":"Un único compás con pulsos de distinta duración (7/8 = 2+2+3)."},{"id":"MET.3.3","name":"Aksak","status":"H","definition":"Ritmo con dos unidades, breve y larga, en proporción 2:3 (Brăiloiu)."},{"id":"MET.3.4","name":"Métrica no isócrona (NI-meter)","status":"H","definition":"Jerarquía con pulsos de dos o más duraciones, organizada por máxima uniformidad (London)."},{"id":"MET.3.5","name":"Ritmo aditivo / divisivo","status":"H","definition":"El divisivo subdivide una duración; el aditivo suma unidades desiguales (Sachs). Términos usados de forma confusa (London)."}]},{"id":"MET.4","name":"Ritmo libre y métricas flexibles","status":"H","definition":"Duraciones sin pulso isócrono o con pulso flexible.","params":["pulse_strength","duration_set"],"children":[{"id":"MET.4.1","name":"Ritmo libre / no medido","status":"H","definition":"Duraciones sin pulso isócrono (canto llano, alap, taqsim, baguala)."},{"id":"MET.4.2","name":"Parlando-rubato y tempo giusto","status":"H","definition":"Canto ligado al habla frente a canto medido y bailable (Bartók)."},{"id":"MET.4.3","name":"Giusto silábico","status":"H","definition":"Cada sílaba toma una de dos duraciones en proporción 1:2 (Brăiloiu)."}]}]},{"id":"ACE","name":"Acentuación","question":"¿Qué posiciones reciben peso y por qué medio?","color":"#FF8A65","children":[{"id":"ACE.1","name":"Fuentes del acento","status":"H","definition":"Medios sonoros que dan peso a una posición; Lerdahl y Jackendoff los agrupan en fenoménico, estructural y métrico.","params":["accent_matrix"],"children":[{"id":"ACE.1.1","name":"Métrico","status":"H","definition":"Peso por posición en la jerarquía.","params":["velocity_base"]},{"id":"ACE.1.2","name":"Dinámico","status":"H","definition":"Peso por intensidad.","params":["velocity"]},{"id":"ACE.1.3","name":"Agógico","status":"H","definition":"Peso por duración o leve retraso.","params":["gate","microtiming"]},{"id":"ACE.1.4","name":"Tónico","status":"H","definition":"Peso por altura: picos y saltos de octava.","params":["transpose"]},{"id":"ACE.1.5","name":"Tímbrico","status":"H","definition":"Peso por cambio de color.","params":["cc_filter","timbre"]},{"id":"ACE.1.6","name":"Armónico / textural","status":"H","definition":"Peso por cambio de acorde o de densidad.","params":["chord_change"]}]},{"id":"ACE.2","name":"Desplazamiento del acento","status":"H","definition":"Ataques que trasladan el peso a posiciones débiles.","params":["shift_steps","tie","level"],"children":[{"id":"ACE.2.1","name":"Síncopa (hispana)","status":"H","definition":"Ataque en parte débil que se prolonga sobre la parte fuerte siguiente."},{"id":"ACE.2.2","name":"Contratiempo","status":"H","definition":"Ataque en parte débil precedido de silencio en la fuerte; base del skank y del hi-hat abierto del house."},{"id":"ACE.2.3","name":"Anticipación","status":"H","definition":"El ataque llega antes del tiempo fuerte y lo ocupa (tumbao, pushes de acordes)."},{"id":"ACE.2.4","name":"Síncopa amplia (syncopation)","status":"H","definition":"Ataque en posición débil seguido de silencio en posición más fuerte; definición de los estudios de groove."}]},{"id":"ACE.3","name":"Inicio y cierre de frase","status":"H","definition":"Relación del comienzo y el final de la frase con el tiempo fuerte.","params":["phrase_offset","downbeat_mute"],"children":[{"id":"ACE.3.1","name":"Tético","status":"H","definition":"La frase empieza en el tiempo fuerte."},{"id":"ACE.3.2","name":"Anacrúsico","status":"H","definition":"Empieza con notas previas al tiempo fuerte."},{"id":"ACE.3.3","name":"Acéfalo","status":"H","definition":"El tiempo fuerte inicial es silencio."},{"id":"ACE.3.4","name":"Final masculino / femenino","status":"H","definition":"La frase termina en tiempo fuerte o débil."}]}]},{"id":"SUP","name":"Superposición","question":"¿Cómo conviven varias capas?","color":"#BA68C8","children":[{"id":"SUP.1","name":"Polirritmia","status":"H","definition":"Capas con agrupamientos distintos dentro de un mismo ciclo, que coinciden periódicamente.","params":["ratio_a","ratio_b","cycle_len"],"children":[{"id":"SUP.1.1","name":"3:2","status":"H","definition":"Tres contra dos sobre 6 pulsos."},{"id":"SUP.1.2","name":"4:3","status":"H","definition":"Cuatro contra tres sobre 12 pulsos."},{"id":"SUP.1.3","name":"Contramétrica (Arom)","status":"H","definition":"Figura cíclica que contradice sistemáticamente el pulso de la danza."},{"id":"SUP.1.4","name":"Cross-rhythm (Jones)","status":"H","definition":"Ambas capas tienen estatus de pulso."}]},{"id":"SUP.2","name":"Polimetría","status":"H","definition":"Ciclos de distinta longitud superpuestos que se realinean cada mcm de sus longitudes. Agawu discute su aplicación a la música africana.","params":["layer_len"],"children":[{"id":"SUP.2.1","name":"Ciclos de longitud distinta","status":"H","definition":"16 contra 12 se realinean a los 48 pasos; 16 contra 5, a los 80."},{"id":"SUP.2.2","name":"Compases distintos simultáneos","status":"H","definition":"3/4 contra 4/4."}]},{"id":"SUP.3","name":"Hemiola y sesquiáltera","status":"H","definition":"Proporción 3:2 aplicada de forma sucesiva (6/8 y 3/4 alternados) o simultánea.","params":["mode","alternation_pattern"],"children":[{"id":"SUP.3.1","name":"Sucesiva","status":"H","definition":"Compás en 6/8 seguido de compás en 3/4."},{"id":"SUP.3.2","name":"Simultánea (birritmia)","status":"H","definition":"Melodía en 6/8 sobre bombo en 3/4 (zamba, chacarera)."}]},{"id":"SUP.4","name":"Hoquetus y entrelazado","status":"H","definition":"Una línea repartida entre varias voces que se completan.","params":["voices","rule"],"children":[{"id":"SUP.4.1","name":"Hoquetus","status":"H","definition":"Sonidos aislados aportados por varios ejecutantes (ars antiqua, banda-linda, aka)."},{"id":"SUP.4.2","name":"Kotekan balinés","status":"H","definition":"Polos (sobre el pulso) y sangsih (entre pulsos) forman una figura rápida continua."},{"id":"SUP.4.3","name":"Siku andino (ira/arka)","status":"H","definition":"Dos mitades del instrumento alternan notas para completar la melodía."}]}]},{"id":"MIC","name":"Microtiempo y expresión","question":"¿Dónde cae cada ataque respecto de la rejilla?","color":"#FFF176","children":[{"id":"MIC.1","name":"Subdivisión desigual","status":"H","definition":"Subdivisiones largas y cortas alternadas.","children":[{"id":"MIC.1.1","name":"Swing / shuffle","status":"H","definition":"Corcheas o semicorcheas largas y cortas; la proporción crece a tempo lento y tiende a 1:1 a tempo rápido (Friberg y Sundström).","params":["ratio","swing_level","tempo_coupling"]},{"id":"MIC.1.2","name":"Straight","status":"H","definition":"Subdivisión igual 1:1."}]},{"id":"MIC.2","name":"Plantillas sistemáticas de microtiempo","status":"H","definition":"Desviaciones estructurales propias de un estilo, presentes también en el cuerpo de músicos y bailarines.","params":["template"],"children":[{"id":"MIC.2.1","name":"Samba","status":"H","definition":"Anticipación sistemática de la 3.ª y 4.ª semicorchea del pulso; perfil numérico por calibrar.","verify":true},{"id":"MIC.2.2","name":"Samba, detalle espectral (Naveda)","status":"H","definition":"Leve retraso del grave en la primera semicorchea y arcos de tempo en frases de 2 y 4 pulsos."},{"id":"MIC.2.3","name":"Telespringar noruego","status":"H","definition":"Compás de tres pulsos Largo, Medio, Corto en proporción media 38:34:28."},{"id":"MIC.2.4","name":"Vals vienés","status":"I","definition":"Segundo pulso adelantado; magnitud por medir.","verify":true},{"id":"MIC.2.5","name":"Jembe de Malí (Polak)","status":"I","definition":"Subdivisiones no isócronas del pulso; proporciones por verificar.","verify":true},{"id":"MIC.2.6","name":"Laid-back / push","status":"H","definition":"Colocación sistemática detrás o delante del pulso por instrumento (Danielsen; Iyer)."},{"id":"MIC.2.7","name":"Maracatu","status":"H","definition":"Perfiles que varían a lo largo de la pieza en caixa y tarol, según el instrumento de referencia."}]},{"id":"MIC.3","name":"Rejillas no isócronas como estructura","status":"H","definition":"Modelo de Sioros: rejillas no isócronas desde pulsos isócronos dentro de una estructura polirrítmica; implementado como rejilla deformable.","params":["grid_positions"]},{"id":"MIC.4","name":"Discrepancias participativas","status":"H","definition":"Pequeñas desviaciones de tiempo y textura que dan poder participativo (Keil); Berger discute su automatismo. Humanizador browniano por capa.","params":["sigma_ms","bias_ms","drift"]},{"id":"MIC.5","name":"Rubato y tempo flexible","status":"H","definition":"Flexión del tiempo de una capa o del conjunto.","children":[{"id":"MIC.5.1","name":"Rubato chopiniano","status":"H","definition":"La melodía se desplaza sobre un acompañamiento estable."},{"id":"MIC.5.2","name":"Rubato global","status":"H","definition":"El tempo entero se flexiona."}]}]},{"id":"CIC","name":"Ciclo y periodicidad","question":"¿Qué figura recurrente sostiene el tiempo?","color":"#81C784","children":[{"id":"CIC.1","name":"Ostinato y riff","status":"H","definition":"Figura repetida de forma persistente; riff en jazz, rock y funk.","children":[{"id":"CIC.1.1","name":"Ostinato de subdivisión continua","status":"I","definition":"Corriente de semicorcheas sobre four-on-the-floor con acentos por altura y filtro (bajo de Moroder); contorno por verificar.","verify":true}]},{"id":"CIC.2","name":"Timeline / patrón guía","status":"H","definition":"Figura de forma distintiva y duración modesta tocada como ostinato en una pieza de danza (Agawu).","children":[{"id":"CIC.2.1","name":"Standard pattern (12 pulsos)","status":"H","definition":"Ewe/yoruba: onsets [0,2,4,5,7,9,11], perfil ⟨2212221⟩."}]},{"id":"CIC.3","name":"Familia del tresillo y la clave","status":"H","definition":"Patrones afrocaribeños de 8 y 16 pasos; la binarización (Pérez Fernández) es una hipótesis influyente.","params":["rotation","binarize_rounding"],"children":[{"id":"CIC.3.1","name":"Tresillo (3+3+2)","status":"H","definition":"8 pasos, onsets [0,3,6]."},{"id":"CIC.3.2","name":"Habanera","status":"H","definition":"8 pasos, onsets [0,3,4,6]."},{"id":"CIC.3.3","name":"Cinquillo","status":"H","definition":"8 pasos, onsets [0,2,3,5,6]."},{"id":"CIC.3.4","name":"Son clave 3-2","status":"H","definition":"16 pasos, onsets [0,3,6,10,12]."},{"id":"CIC.3.5","name":"Rumba clave 3-2","status":"H","definition":"16 pasos, onsets [0,3,7,10,12]."},{"id":"CIC.3.6","name":"Bossa clave","status":"H","definition":"16 pasos, onsets [0,3,6,10,13]."},{"id":"CIC.3.7","name":"Claves 2-3","status":"H","definition":"Rotación de 8 pasos de la 3-2."}]},{"id":"CIC.4","name":"Sistemas cíclicos de tradiciones letradas","status":"H","definition":"Ciclos con teoría propia: tala, iqa', usul, jangdan.","children":[{"id":"CIC.4.1","name":"Tala indostánica","status":"H","definition":"Ciclos con vibhag, tali (palmada) y khali (vacío); laya vilambit, madhya, drut; tihai que aterriza en sam.","params":["tala","laya"]},{"id":"CIC.4.2","name":"Tala carnática (suladi sapta)","status":"H","definition":"Siete familias de angas (laghu, drutam, anudrutam) × cinco jatis × gati: 35 talas y 175 combinaciones.","params":["family","jati","gati"]},{"id":"CIC.4.3","name":"Iqa' árabe","status":"H","definition":"Ciclos de dum (grave) y tak (agudo) que el percusionista ornamenta.","children":[{"id":"CIC.4.3.1","name":"Maqsum","status":"H","definition":"4/4, 8 pasos: D T . T D . T ."},{"id":"CIC.4.3.2","name":"Baladi / Masmudi saghir","status":"H","definition":"4/4, 8 pasos: D D . T D . T ."},{"id":"CIC.4.3.3","name":"Saidi","status":"H","definition":"4/4, 8 pasos: D T . D D . T ."},{"id":"CIC.4.3.4","name":"Malfuf","status":"H","definition":"2/4, 8 pasos: D . . T . . T ."},{"id":"CIC.4.3.5","name":"Wahda","status":"H","definition":"4/4: dum en el pulso 1 con taks escasos; taks por verificar.","verify":true},{"id":"CIC.4.3.6","name":"Fox","status":"H","definition":"2/4, 4 pasos: D T D T."},{"id":"CIC.4.3.7","name":"Sama'i thaqil","status":"H","definition":"10/8 con agrupamiento 3+2+2+3; golpes por verificar.","verify":true}]},{"id":"CIC.4.4","name":"Usul otomano","status":"H","definition":"Ciclos compartidos con el repertorio árabe: aksak 9/8 = 2+2+2+3, curcuna 10/8 = 3+2+2+3."},{"id":"CIC.4.5","name":"Jangdan coreano","status":"H","definition":"Patrón cíclico del janggu: jinyangjo (24), jungmori (12), semachi, eotmori (10/8), jajinmori (12/8)."}]},{"id":"CIC.5","name":"Colotomía (gamelan)","status":"H","definition":"Los gongs marcan subdivisiones jerárquicas del gongan; el golpe principal llega al final del ciclo. Irama multiplica la densidad de elaboración; laya cambia el tempo.","params":["form","irama","laya"]},{"id":"CIC.6","name":"Ciclos afroamericanos y criollos","status":"H","definition":"Patrones de géneros del Caribe y Sudamérica.","children":[{"id":"CIC.6.1","name":"Dembow","status":"H","definition":"Bombo [0,4,8,12]; caja [3,6,11,14] en 16."},{"id":"CIC.6.2","name":"Samba","status":"H","definition":"Surdo con acento en el pulso 2 de 2/4; tamborim por verificar."},{"id":"CIC.6.3","name":"Maracatu de baque virado","status":"H","definition":"Alfaia, gonguê (función de clave), caixa, tarol, mineiro, abê; toques martelo, luanda, arrastão, baque parado; viradas. Patrones por verificar."},{"id":"CIC.6.4","name":"Candombe","status":"H","definition":"Chico, repique y piano, con madera en el casco; patrones por verificar."},{"id":"CIC.6.5","name":"Cumbia","status":"H","definition":"Llamador en contratiempo, alegre improvisando, guacharaca en corcheas."},{"id":"CIC.6.6","name":"Festejo y landó","status":"H","definition":"6/8 y 12/8 con cajón; patrones por verificar."},{"id":"CIC.6.7","name":"Huayno","status":"H","definition":"2/4 con célula corchea y dos semicorcheas."}]},{"id":"CIC.7","name":"Compás flamenco","status":"H","definition":"Ciclo de 12 con acentos en 3, 6, 8, 10 y 12 (3+3+2+2+2); la rotación convierte la soleá en seguiriya.","params":["start_offset"]},{"id":"CIC.8","name":"Ciclos sesquiálteros sudamericanos","status":"H","definition":"Cueca, tonada, zamba, chacarera, joropo y son jarocho alternan o superponen 6/8 y 3/4.","params":["mode","alternation_pattern"]},{"id":"CIC.9","name":"Kultrún mapuche","status":"H","restricted_use":true,"definition":"Tambor ceremonial de la machi. Se incorpora solo como principio estructural (ciclo de cuatro, golpe y sacudida); las transcripciones citadas por Grebe no se consultaron."}]},{"id":"PRO","name":"Procedimientos compositivos","question":"¿Qué operación transforma el material?","color":"#F06292","children":[{"id":"PRO.1","name":"Ritmo euclidiano","status":"H","definition":"E(k,n): k ataques repartidos en n pasos de la forma más uniforme (Toussaint).","params":["k","n","rotation"]},{"id":"PRO.2","name":"Máxima uniformidad","status":"H","definition":"Distribución más pareja posible de k en n; converge con E(k,n).","params":["k","n"]},{"id":"PRO.3","name":"Modos rítmicos","status":"H","definition":"Seis patrones de pies métricos largo/breve (Notre-Dame, Garlandia).","params":["mode"]},{"id":"PRO.4","name":"Isorritmia","status":"H","definition":"Talea rítmica independiente del color de alturas; los ciclos se desfasan.","params":["talea","color"]},{"id":"PRO.5","name":"Valor añadido","status":"H","definition":"Valor breve agregado mediante nota, silencio o puntillo (Messiaen).","params":["position","value"]},{"id":"PRO.6","name":"Ritmo no retrogradable","status":"H","definition":"Palíndromo rítmico en torno a un valor central.","params":["half","center"]},{"id":"PRO.7","name":"Aumentación / disminución","status":"H","definition":"Multiplicar duraciones por un factor.","params":["factor"]},{"id":"PRO.8","name":"Personajes rítmicos","status":"H","definition":"Una célula crece, otra decrece, otra permanece.","params":["cells"]},{"id":"PRO.9","name":"Modulación métrica","status":"H","definition":"Nuevo tempo = tempo × (valor común viejo / nuevo); autoría del término por verificar.","params":["ratio"],"verify":true},{"id":"PRO.10","name":"Proceso de fase","status":"H","definition":"Dos patrones idénticos a tempos levemente distintos (Reich).","params":["drift_ratio"]},{"id":"PRO.11","name":"Desplazamiento discreto","status":"H","definition":"Una capa avanza un paso cada N repeticiones (Clapping Music).","params":["shift_every"]},{"id":"PRO.12","name":"Canon de tempo","status":"H","definition":"Voces en proporciones fijas de tempo, incluso irracionales (Nancarrow).","params":["ratios"]},{"id":"PRO.13","name":"Serialización de duraciones","status":"H","definition":"Serie de valores permutada (Messiaen, Boulez).","params":["series","permutation"]},{"id":"PRO.14","name":"Rotación, retrogradación, inversión","status":"H","definition":"Operaciones de collar sobre el patrón (Toussaint).","params":["rot","retro","complement"]},{"id":"PRO.15","name":"Variación de densidad","status":"H","definition":"Añadir o quitar ataques según peso métrico.","params":["density"]},{"id":"PRO.16","name":"Tihai / cadencia triple","status":"H","definition":"Frase ×3 que aterriza en el inicio del ciclo.","params":["P","G"]},{"id":"PRO.17","name":"Viradas y fills","status":"H","definition":"Variación que rompe la repetición e introduce un nuevo patrón.","params":["every_n_bars","pool"]},{"id":"PRO.18","name":"Unificación altura–ritmo","status":"H","definition":"Duraciones tratadas como frecuencias subaudibles (Stockhausen).","params":["base_hz"]},{"id":"PRO.19","name":"Ritmo de delay (dub)","status":"H","definition":"El eco a corchea con puntillo genera un ritmo derivado.","params":["delay_ratio","feedback"]}]},{"id":"FOR","name":"Forma temporal y tempo","question":"¿Cómo evoluciona la velocidad y la densidad a gran escala?","color":"#7986CB","children":[{"id":"FOR.1","name":"Hipermetro y forma por bloques","status":"I","definition":"Bloques de 4, 8, 16 y 32 compases con cambios de textura en los bordes.","params":["block_len","fill_on_last_bar"]},{"id":"FOR.2","name":"Arcos de tempo y densidad","status":"H","definition":"Principios formales de aceleración y densificación.","children":[{"id":"FOR.2.1","name":"Jo-ha-kyū","status":"H","definition":"Introducción lenta, desarrollo que acelera, conclusión rápida, en escalas sucesivas (Zeami)."},{"id":"FOR.2.2","name":"Man-jung-sak","status":"H","definition":"Encadenamiento de jangdan de lento a medio a rápido."},{"id":"FOR.2.3","name":"Accelerando de irama","status":"H","definition":"Cambios de nivel de irama que cambian la marcha de la densidad."},{"id":"FOR.2.4","name":"Ma","status":"H","definition":"Intervalo de tiempo cargado de sentido; parámetro de silencio en bordes de frase.","params":["ma_prob","ma_len"]}]},{"id":"FOR.3","name":"Laya y relación tempo–densidad","status":"H","definition":"Todo dispositivo separa tempo de densidad.","params":["tempo","density"]}]},{"id":"COG","name":"Cognición y análisis","question":"¿Cómo se mide y se percibe lo que suena?","color":"#4DB6AC","children":[{"id":"COG.1","name":"Inducción del pulso","status":"H","definition":"Respuesta de discordancia en recién nacidos ante la omisión del tiempo fuerte; alcance innato en discusión."},{"id":"COG.2","name":"Sincronización y aculturación","status":"H","definition":"Entrainment de osciladores atencionales; aculturación métrica temprana; Many Meters Hypothesis (London)."},{"id":"COG.3","name":"Medidas computables","status":"H","definition":"Medidas que el generador calcula sobre el patrón.","children":[{"id":"COG.3.1","name":"Pesos métricos","status":"H","definition":"Longuet-Higgins y Lee: [0,-4,-3,-4,-2,-4,-3,-4,-1,-4,-3,-4,-2,-4,-3,-4] en 16 pasos."},{"id":"COG.3.2","name":"Índice de síncopa","status":"I","definition":"Suma W − w cuando un ataque de peso w va seguido de silencio de peso W > w; adaptación exacta de Witek por verificar.","verify":true},{"id":"COG.3.3","name":"Curva de groove en U invertida","status":"H","definition":"La síncopa intermedia produce más deseo de moverse (Witek et al. 2014).","params":["syncopation_target"]},{"id":"COG.3.4","name":"Groove como impulso al movimiento","status":"H","definition":"El groove disminuye cuando el acoplamiento bimanual se vuelve difícil (Janata et al. 2012)."},{"id":"COG.3.5","name":"Uniformidad (evenness)","status":"H","definition":"Distancia del patrón a la distribución máximamente uniforme."},{"id":"COG.3.6","name":"Densidad","status":"H","definition":"Ataques por paso."},{"id":"COG.3.7","name":"Entropía de intervalos","status":"H","definition":"Variedad de distancias entre ataques."}]},{"id":"COG.4","name":"Ritmo del paisaje sonoro","status":"H","definition":"Ciclos ambientales (Schafer), ritmo aditivo de eventos aleatorios (Truax), nicho acústico (Krause, hipótesis)."}]},{"id":"GRV","name":"Grooves electrónicos y populares","question":"¿Qué rejillas de 16 pasos sostienen la música de baile?","color":"#FFB74D","children":[{"id":"GRV.1","name":"Four-on-the-floor","status":"H","definition":"Bombo [0,4,8,12]; hat abierto [2,6,10,14]."},{"id":"GRV.2","name":"Backbeat","status":"H","definition":"Caja [4,12]."},{"id":"GRV.3","name":"Half-time","status":"H","definition":"Caja [8]."},{"id":"GRV.4","name":"Shuffle","status":"H","definition":"Rejilla de 12 en tresillos: [0,2,3,5,6,8,9,11]."},{"id":"GRV.5","name":"One drop","status":"H","definition":"Bombo y caja juntos en [8]; pulso 1 vacío."},{"id":"GRV.6","name":"Rockers","status":"I","definition":"Bombo [0,8]."},{"id":"GRV.7","name":"Steppers","status":"H","definition":"Bombo [0,4,8,12]."},{"id":"GRV.8","name":"Skank","status":"I","definition":"Acordes [2,6,10,14] o [4,12] según el estilo."},{"id":"GRV.9","name":"Trap","status":"H","definition":"Hats en semicorcheas con tresillos y redobles; caja [8]."},{"id":"GRV.10","name":"Motorik","status":"H","definition":"4/4 constante con mínima variación; patrón exacto por verificar.","verify":true},{"id":"GRV.11","name":"Breakbeat / Amen","status":"H","definition":"Bucles de breaks troceados; transcripción por verificar.","verify":true},{"id":"GRV.12","name":"2-step / UK garage","status":"I","definition":"Bombo que omite tiempos con swing de semicorchea; onsets por verificar.","verify":true},{"id":"GRV.13","name":"Bajo Moroder","status":"I","definition":"Semicorcheas continuas con acento por octava y filtro; contorno por verificar.","verify":true},{"id":"GRV.14","name":"Dub techno","status":"I","definition":"Stab de acorde en contratiempo más delay a corchea con puntillo."}]},{"id":"RGG","name":"Reggae, dub y derivados","question":"¿Qué conserva cada estilo de la familia jamaicana?","color":"#AED581","children":[{"id":"RGG.1","name":"Raíces rituales y precursores","status":"H","definition":"Tradiciones afrojamaicanas que anteceden al ska y al reggae.","children":[{"id":"RGG.1.1","name":"Nyabinghi","status":"H","restricted_use":true,"definition":"Reunión ceremonial rastafari; se incorpora el principio de tres roles (base, pulso, improvisación), sin toques ceremoniales como preset."},{"id":"RGG.1.2","name":"Burru y kumina","status":"H","restricted_use":true,"definition":"Tradiciones afrojamaicanas de tambor y canto; datos rítmicos faltantes."},{"id":"RGG.1.3","name":"Mento","status":"H","definition":"Folclor jamaicano de los cincuenta con guitarra, banjo y tambores."}]},{"id":"RGG.2","name":"Eras de la música popular jamaicana","status":"H","definition":"Marcos rítmicos sucesivos, de ska a dancehall digital.","children":[{"id":"RGG.2.1","name":"Ska","status":"H","definition":"2/4 rápido con acento en el contratiempo; bajo en cuatro pulsos (~1960–1966)."},{"id":"RGG.2.2","name":"Rocksteady","status":"H","definition":"Tempo percibido más lento, bajo más móvil (1966–1968)."},{"id":"RGG.2.3","name":"Reggae temprano","status":"H","definition":"Órgano bubble, strum de guitarra, se asienta el one drop (1968–1974)."},{"id":"RGG.2.4","name":"Roots reggae","status":"H","definition":"Bajo en primer plano, progresiones simples (1974–1983)."},{"id":"RGG.2.5","name":"Rub-a-dub","status":"H","definition":"Ritmo lento y rodado, bajo redondo, batería simple (1979–1985)."},{"id":"RGG.2.6","name":"Dancehall digital","status":"H","definition":"Riddims programados; Sleng Teng (1985)."}]},{"id":"RGG.3","name":"Batería: familias de bombo y caja","status":"H","definition":"One drop, rockers y steppers se ordenan alrededor del pulso 3 y se distinguen por el bombo.","params":["drop_beat","kick_mask","backbeat_mask","hat_mask","swing","half_time","kick_density"],"children":[{"id":"RGG.3.1","name":"One drop","status":"H","definition":"Pulso 1 sin bombo; bombo y aro en el pulso 3; hat cerrado continuo."},{"id":"RGG.3.2","name":"Rockers","status":"H","definition":"Dos acepciones: a) bombo en 1 y 3 (pedagógica); b) bombo en cada pulso con golpes dobles de caja (Sly Dunbar, 1976).","children":[{"id":"RGG.3.2a","name":"Rockers (acepción pedagógica)","status":"I","definition":"One drop con bombo añadido en el pulso 1: bombo en 1 y 3, aro en el 3."},{"id":"RGG.3.2b","name":"Rockers (Channel One, 1976)","status":"H","definition":"Bombo en cada pulso con golpes dobles sobre la caja abierta, carácter marcial (Sly Dunbar)."}]},{"id":"RGG.3.3","name":"Steppers","status":"H","definition":"Bombo en los cuatro pulsos; backbeat en el 3."},{"id":"RGG.3.4","name":"Variantes (half drop, two drop)","status":"V","verify":true,"definition":"Mencionadas en tutoriales; patrones por verificar."}]},{"id":"RGG.4","name":"Hi-hat y platillos","status":"H","definition":"Capas de subdivisión del reggae y el dub.","params":["open_mask","laid_back_ms","swing"],"children":[{"id":"RGG.4.1","name":"Corcheas cerradas","status":"H","definition":"Hat cerrado continuo, base del one drop."},{"id":"RGG.4.2","name":"Corcheas con swing","status":"I","definition":"Larga–corta; tiende a 1:1 a tempos rápidos."},{"id":"RGG.4.3","name":"Flying cymbal","status":"H","definition":"Alterna abierto y cerrado con siseo continuo (Santa Davis, 1974); rejilla por verificar.","verify":true},{"id":"RGG.4.4","name":"Rellenos en tresillo laid-back","status":"I","definition":"Tresillos de hat retrasados respecto del pulso."},{"id":"RGG.4.5","name":"Semicorcheas digitales","status":"I","definition":"Hat en 16 pasos con acentos en riddims programados."}]},{"id":"RGG.5","name":"Bajo","status":"H","definition":"El bajo lidera el roots reggae: frases cortas con silencios amplios.","params":["bass_space","offbeat_bias","repeat_len","octave_jump_prob","lock_to_kick"],"children":[{"id":"RGG.5.1","name":"Bajo de ska","status":"H","definition":"Patrón de cuatro pulsos estable."},{"id":"RGG.5.2","name":"Bajo de rocksteady","status":"H","definition":"Líneas variadas y móviles."},{"id":"RGG.5.3","name":"Bajo de roots","status":"I","definition":"Ostinato corto y melódico con espacio, grave y redondo."},{"id":"RGG.5.4","name":"Bajo de dub","status":"I","definition":"Línea mínima con retiradas y regresos."},{"id":"RGG.5.5","name":"Bajo digital","status":"H","definition":"Ostinato programado (Sleng Teng) y sub 808."}]},{"id":"RGG.6","name":"Guitarra, piano y órgano","status":"H","definition":"Skank, chop, bubble y strum.","params":["skank_mode","bubble_on","frame_16ths","chord_length_ms","swing","delay_on_gap"],"children":[{"id":"RGG.6.1","name":"Skank en contratiempo","status":"H","definition":"Acorde corto en el «y» de cada pulso."},{"id":"RGG.6.2","name":"Chop en 2 y 4","status":"H","definition":"Acorde en el backbeat, guitarra y piano duplicados."},{"id":"RGG.6.3","name":"Bubble (órgano)","status":"H","definition":"Contratiempos con semicorcheas de enmarque; patrón exacto por verificar."},{"id":"RGG.6.4","name":"Strum de semicorchea","status":"H","definition":"Rasgueo del reggae temprano; patrón por verificar.","verify":true}]},{"id":"RGG.7","name":"Percusión menor","status":"H","definition":"Pandereta, bloque, shakers y tambores de mano con función clara.","params":["shaker_8ths","tambourine_offbeat","rim_click_3"]},{"id":"RGG.8","name":"Dub: procedimientos con consecuencia rítmica","status":"H","definition":"La mezcla en consola como generadora de ritmo.","children":[{"id":"RGG.8.1","name":"Versión y riddim","status":"H","definition":"Pista de bajo y batería reutilizada con otro contenido.","params":["riddim_id"]},{"id":"RGG.8.2","name":"Retirada de capas (drop-out)","status":"H","definition":"Retirar el ritmo para dar fuerza a su regreso (King Tubby).","params":["dropout_layers","dropout_len_beats","return_accent"]},{"id":"RGG.8.3","name":"Ecos como ritmo derivado","status":"H","definition":"Delays de cinta a negra, corchea, corchea con puntillo o semicorchea.","params":["delay_ratio","feedback","wow","throw_prob"]},{"id":"RGG.8.4","name":"Arco de mezcla","status":"H","definition":"Mutes, filtros y envíos como gesto performativo.","params":["mute_mask"]}]},{"id":"RGG.9","name":"Riddim digital y dancehall","status":"H","definition":"Riddims programados desde 1985.","children":[{"id":"RGG.9.1","name":"Sleng Teng","status":"H","definition":"Bajo ostinato robótico sobre batería programada; contorno por verificar.","verify":true},{"id":"RGG.9.2","name":"Dem Bow / Poco Man Jam","status":"H","definition":"Bombo constante y cajas sincopadas en 3+3+2 (Steely & Clevie)."},{"id":"RGG.9.3","name":"Bam Bam (1992)","status":"H","definition":"Groove elástico con palmas; patrón por verificar.","verify":true},{"id":"RGG.9.4","name":"Punaany / Duck / Juice","status":"H","definition":"Riddims ragga de alta circulación; patrones por verificar.","verify":true}]},{"id":"RGG.10","name":"Derivados fuera de Jamaica","status":"H","definition":"Estilos que conservan piezas distintas del original.","children":[{"id":"RGG.10.1","name":"UK steppers","status":"H","definition":"Bombo constante en 4/4, sirenas de dub (Jah Shaka); tempo por verificar."},{"id":"RGG.10.2","name":"Dub techno","status":"H","definition":"Bombo en cuatro, hat en contratiempo y stabs de acorde con eco (Basic Channel, 1993); cambios microscópicos sobre un lazo estable.","params":["stab_positions","delay_ratio","feedback","filter_cutoff_lfo","hiss_amount"]},{"id":"RGG.10.3","name":"Dubstep y 2-step","status":"H","definition":"132–142 BPM; caja en el pulso 3; el 2-step con bombo en 1 y 3 y hats con swing."},{"id":"RGG.10.4","name":"Dembow y reggaetón","status":"H","definition":"Tresillo 3+3+2 sobre bombo constante; posiciones de caja por verificar."},{"id":"RGG.10.5","name":"Lovers rock","status":"H","definition":"One drop suave con sensibilidad soul y R&B (sur de Londres)."},{"id":"RGG.10.6","name":"Jungle y ragga","status":"H","definition":"Dancehall británico y toasting en el ragga jungle."},{"id":"RGG.10.7","name":"Fusiones de ska","status":"H","definition":"2 Tone, ska punk y skacore."}]}]}],"destinations":[{"id":"bassline","name":"Bassline","polyphony":1,"default_range":[28,52]},{"id":"chords","name":"Chords","polyphony":6,"default_range":[48,79]},{"id":"arpeggio","name":"Arpeggio","polyphony":1,"default_range":[55,84]},{"id":"hihats","name":"Hi-hats","polyphony":3,"drum_map":"hihats_gm"},{"id":"ethnic","name":"Ethnic drums","polyphony":8,"drum_map":"drum_rack_default"},{"id":"others","name":"Others","polyphony":8,"default_range":[36,96]}],"destination_categories":[{"id":"dub_techno","name":"Dub Techno","destinations":["chords","bassline","hihats"],"taxonomy":["RGG.10.2","GRV.14","PRO.19"]},{"id":"dub_reggae","name":"Dub / Reggae","destinations":["chords","bassline","hihats","ethnic","others"],"taxonomy":["RGG"]},{"id":"latin_percussion","name":"Latin percussion","destinations":["ethnic","hihats"],"taxonomy":["CIC.3","CIC.6"]},{"id":"electronic","name":"Grooves electrónicos","destinations":["hihats","ethnic","bassline","chords","arpeggio","others"],"taxonomy":["GRV"]},{"id":"world_cycles","name":"Ciclos del mundo","destinations":["ethnic","others","arpeggio","bassline"],"taxonomy":["CIC.2","CIC.4","CIC.5","CIC.7","CIC.8","MET.3"]},{"id":"procedures","name":"Procedimientos","destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"taxonomy":["PRO"]}]},"scales":{"version":"1.0.0","notes":"intervals: semitonos desde la raíz en 12-TET (lo que se escribe en el clip). cents: afinación nominal cuando difiere del temperamento (maqamat, gamelan); se conserva como metadato para una futura opción de cuartos de tono (D-009). El modo Adaptable compara por intervalos con live_set.scale_intervals, no por nombre.","families":[{"id":"western_modes","name":"Modos occidentales"},{"id":"pentatonic","name":"Pentatónicas y blues"},{"id":"minor_variants","name":"Menores y mayores alteradas"},{"id":"symmetric","name":"Escalas simétricas"},{"id":"world_12","name":"Otras escalas en 12 notas"},{"id":"maqam","name":"Maqamat (aproximación)"},{"id":"raga","name":"Ragas básicos (thaat)"},{"id":"gamelan","name":"Gamelan (aproximación)"}],"scales":[{"id":"major","name":"Mayor (jónico)","family":"western_modes","intervals":[0,2,4,5,7,9,11],"status":"H"},{"id":"dorian","name":"Dórico","family":"western_modes","intervals":[0,2,3,5,7,9,10],"status":"H"},{"id":"phrygian","name":"Frigio","family":"western_modes","intervals":[0,1,3,5,7,8,10],"status":"H"},{"id":"lydian","name":"Lidio","family":"western_modes","intervals":[0,2,4,6,7,9,11],"status":"H"},{"id":"mixolydian","name":"Mixolidio","family":"western_modes","intervals":[0,2,4,5,7,9,10],"status":"H"},{"id":"minor","name":"Menor natural (eólico)","family":"western_modes","intervals":[0,2,3,5,7,8,10],"status":"H"},{"id":"locrian","name":"Locrio","family":"western_modes","intervals":[0,1,3,5,6,8,10],"status":"H"},{"id":"major_pentatonic","name":"Pentatónica mayor","family":"pentatonic","intervals":[0,2,4,7,9],"status":"H"},{"id":"minor_pentatonic","name":"Pentatónica menor","family":"pentatonic","intervals":[0,3,5,7,10],"status":"H"},{"id":"minor_blues","name":"Blues menor","family":"pentatonic","intervals":[0,3,5,6,7,10],"status":"H"},{"id":"major_blues","name":"Blues mayor","family":"pentatonic","intervals":[0,2,3,4,7,9],"status":"H"},{"id":"egyptian","name":"Pentatónica suspendida","family":"pentatonic","intervals":[0,2,5,7,10],"status":"H"},{"id":"harmonic_minor","name":"Menor armónica","family":"minor_variants","intervals":[0,2,3,5,7,8,11],"status":"H"},{"id":"melodic_minor","name":"Menor melódica (ascendente)","family":"minor_variants","intervals":[0,2,3,5,7,9,11],"status":"H"},{"id":"harmonic_major","name":"Mayor armónica","family":"minor_variants","intervals":[0,2,4,5,7,8,11],"status":"H"},{"id":"dorian_sharp4","name":"Dórico #4","family":"minor_variants","intervals":[0,2,3,6,7,9,10],"status":"H"},{"id":"phrygian_dominant","name":"Frigio dominante","family":"minor_variants","intervals":[0,1,4,5,7,8,10],"status":"H"},{"id":"lydian_augmented","name":"Lidio aumentado","family":"minor_variants","intervals":[0,2,4,6,8,9,11],"status":"H"},{"id":"lydian_dominant","name":"Lidio dominante","family":"minor_variants","intervals":[0,2,4,6,7,9,10],"status":"H"},{"id":"super_locrian","name":"Superlocrio (alterada)","family":"minor_variants","intervals":[0,1,3,4,6,8,10],"status":"H"},{"id":"hungarian_minor","name":"Menor húngara","family":"minor_variants","intervals":[0,2,3,6,7,8,11],"status":"H"},{"id":"double_harmonic","name":"Doble armónica","family":"minor_variants","intervals":[0,1,4,5,7,8,11],"status":"H"},{"id":"whole_tone","name":"Tonos enteros","family":"symmetric","intervals":[0,2,4,6,8,10],"status":"H"},{"id":"dim_half_whole","name":"Disminuida semitono-tono","family":"symmetric","intervals":[0,1,3,4,6,7,9,10],"status":"H"},{"id":"dim_whole_half","name":"Disminuida tono-semitono","family":"symmetric","intervals":[0,2,3,5,6,8,9,11],"status":"H"},{"id":"augmented","name":"Aumentada (hexatónica)","family":"symmetric","intervals":[0,3,4,7,8,11],"status":"H"},{"id":"messiaen_3","name":"Messiaen modo 3","family":"symmetric","intervals":[0,2,3,4,6,7,8,10,11],"status":"H"},{"id":"chromatic","name":"Cromática","family":"symmetric","intervals":[0,1,2,3,4,5,6,7,8,9,10,11],"status":"H"},{"id":"spanish_8","name":"Española de 8 notas","family":"world_12","intervals":[0,1,3,4,5,6,8,10],"status":"H"},{"id":"hirajoshi","name":"Hirajōshi","family":"world_12","intervals":[0,2,3,7,8],"status":"H"},{"id":"in_sen","name":"In-sen","family":"world_12","intervals":[0,1,5,7,10],"status":"H"},{"id":"iwato","name":"Iwato","family":"world_12","intervals":[0,1,5,6,10],"status":"H"},{"id":"kumoi","name":"Kumoi","family":"world_12","intervals":[0,2,3,7,9],"status":"H"},{"id":"maqam_ajam","name":"Maqam ʿAjam","family":"maqam","intervals":[0,2,4,5,7,9,11],"cents":[0,200,400,500,700,900,1100],"status":"I","verify":false,"sources":["MaqamWorld"]},{"id":"maqam_nahawand","name":"Maqam Nahawand","family":"maqam","intervals":[0,2,3,5,7,8,11],"cents":[0,200,300,500,700,800,1100],"status":"I","verify":false,"sources":["MaqamWorld"]},{"id":"maqam_kurd","name":"Maqam Kurd","family":"maqam","intervals":[0,1,3,5,7,8,10],"cents":[0,100,300,500,700,800,1000],"status":"I","verify":false,"sources":["MaqamWorld"]},{"id":"maqam_hijaz","name":"Maqam Ḥijāz","family":"maqam","intervals":[0,1,4,5,7,8,10],"cents":[0,100,400,500,700,800,1000],"status":"I","verify":false,"sources":["MaqamWorld"]},{"id":"maqam_rast","name":"Maqam Rast","family":"maqam","intervals":[0,2,3,5,7,9,10],"cents":[0,200,350,500,700,900,1050],"approx_rule":"cuarto de tono redondeado hacia abajo","status":"I","verify":true,"verify_notes":"Cents nominales; la entonación real del 3.º y 7.º grado varía por región e intérprete.","sources":["MaqamWorld"]},{"id":"maqam_bayati","name":"Maqam Bayātī","family":"maqam","intervals":[0,1,3,5,7,8,10],"cents":[0,150,300,500,700,800,1000],"approx_rule":"cuarto de tono redondeado hacia abajo","status":"I","verify":true,"verify_notes":"El 2.º grado es un cuarto de tono; su aproximación en 12 notas coincide con Kurd.","sources":["MaqamWorld"]},{"id":"maqam_saba","name":"Maqam Ṣabā","family":"maqam","intervals":[0,1,3,4,7,8,10],"cents":[0,150,300,400,700,800,1000],"approx_rule":"cuarto de tono redondeado hacia abajo","status":"I","verify":true,"verify_notes":"Escala no octavante en la práctica; aquí se reduce a una octava.","sources":["MaqamWorld"]},{"id":"raga_bilawal","name":"Bilawal (thaat)","family":"raga","intervals":[0,2,4,5,7,9,11],"status":"H","notes":"Un raga es más que una escala: incluye movimientos, notas principales y hora. Aquí solo se usa el material de alturas."},{"id":"raga_kalyan","name":"Kalyan / Yaman (thaat)","family":"raga","intervals":[0,2,4,6,7,9,11],"status":"H"},{"id":"raga_khamaj","name":"Khamaj (thaat)","family":"raga","intervals":[0,2,4,5,7,9,10],"status":"H"},{"id":"raga_kafi","name":"Kafi (thaat)","family":"raga","intervals":[0,2,3,5,7,9,10],"status":"H"},{"id":"raga_asavari","name":"Asavari (thaat)","family":"raga","intervals":[0,2,3,5,7,8,10],"status":"H"},{"id":"raga_bhairavi","name":"Bhairavi (thaat)","family":"raga","intervals":[0,1,3,5,7,8,10],"status":"H"},{"id":"raga_bhairav","name":"Bhairav (thaat)","family":"raga","intervals":[0,1,4,5,7,8,11],"status":"H"},{"id":"raga_purvi","name":"Purvi (thaat)","family":"raga","intervals":[0,1,4,6,7,8,11],"status":"H"},{"id":"raga_marwa","name":"Marwa (thaat)","family":"raga","intervals":[0,1,4,6,7,9,11],"status":"H"},{"id":"raga_todi","name":"Todi (thaat)","family":"raga","intervals":[0,1,3,6,7,8,11],"status":"H"},{"id":"raga_bhupali","name":"Bhupali","family":"raga","intervals":[0,2,4,7,9],"status":"H"},{"id":"raga_malkauns","name":"Malkauns","family":"raga","intervals":[0,3,5,8,10],"status":"H"},{"id":"slendro","name":"Slendro (aprox.)","family":"gamelan","intervals":[0,2,5,7,9],"cents":[0,240,480,720,960],"status":"I","verify":true,"verify_notes":"Cada gamelan tiene su afinación; los cents son una media equidistante nominal.","sources":["Sumarsam"]},{"id":"pelog_selisir","name":"Pelog selisir (aprox.)","family":"gamelan","intervals":[0,1,3,7,8],"status":"I","verify":true,"verify_notes":"Aproximación pentatónica en 12 notas; afinación real variable."},{"id":"pelog_tembung","name":"Pelog tembung (aprox.)","family":"gamelan","intervals":[0,1,5,7,8],"status":"I","verify":true,"verify_notes":"Aproximación pentatónica en 12 notas; afinación real variable."}],"random_rules":{"notes":"Modo Random: elige familia con pesos, luego escala y raíz. Las reglas evitan combinaciones poco musicales para el destino.","family_weights":{"western_modes":5,"pentatonic":3,"minor_variants":2,"symmetric":0.5,"world_12":1,"maqam":1,"raga":1,"gamelan":0.5},"avoid_for_destination":{"bassline":["chromatic","messiaen_3"],"chords":["chromatic"]}}},"drumMaps":{"version":"1.0.0","notes":"Mapa de golpe → nota MIDI. Las notas de Drum Rack van de C1 = 36 a D#2 = 51 (16 pads). Todos los mapas son editables desde la interfaz; estos son valores de partida. 'timbre' sigue el §1 del informe: 0 grave/dum, 1 agudo/tak, 2 abierto, 3 apagado.","maps":[{"id":"drum_rack_default","name":"Drum Rack (16 pads)","tradition":"genérico","roles":{"kick":36,"rim":37,"snare":38,"clap":39,"hat":42,"hat_pedal":44,"hat_open":46,"tom_lo":41,"tom_mid":45,"tom_hi":48,"crash":49,"ride":51,"perc_1":40,"perc_2":43,"perc_3":47,"perc_4":50}},{"id":"hihats_gm","name":"Hi-hats (GM)","tradition":"General MIDI","roles":{"hat":42,"hat_pedal":44,"hat_open":46,"ride":51,"ride_bell":53,"shaker":70,"tambourine":54,"cabasa":69}},{"id":"gm_percussion","name":"General MIDI percusión","tradition":"General MIDI","roles":{"kick":36,"rim":37,"snare":38,"clap":39,"hat":42,"hat_pedal":44,"hat_open":46,"tom":45,"crash":49,"ride":51,"ride_bell":53,"tambourine":54,"cowbell":56,"bongo_hi":60,"bongo_lo":61,"conga_mute":62,"conga_open":63,"conga_lo":64,"timbale_hi":65,"timbale_lo":66,"agogo_hi":67,"agogo_lo":68,"cabasa":69,"maracas":70,"guiro":73,"claves":75,"woodblock_hi":76,"woodblock_lo":77,"cuica_mute":78,"cuica_open":79,"triangle":80,"triangle_open":81,"shaker":82}},{"id":"latin_rack","name":"Latin percussion (Drum Rack)","tradition":"afrolatina","roles":{"conga_lo":36,"conga_open":37,"conga_mute":38,"bongo_hi":39,"bongo_lo":40,"timbale_hi":41,"timbale_lo":42,"cowbell":43,"claves":44,"guiro":45,"maracas":46,"cabasa":47,"agogo_hi":48,"agogo_lo":49,"triangle":50,"shaker":51}},{"id":"dub_kit","name":"Dub kit (Drum Rack)","tradition":"reggae / dub","roles":{"kick":36,"rim":37,"snare":38,"clap":39,"shaker":40,"tom":41,"hat":42,"tambourine":43,"hat_pedal":44,"woodblock":45,"hat_open":46,"conga":47,"fx_siren":48,"crash":49,"fx_laser":50,"ride":51}},{"id":"iqa_dum_tak","name":"Iqa' (dum / tak)","tradition":"árabe","by_timbre":true,"timbre":{"0":36,"1":38,"2":37,"3":39},"labels":{"0":"dum","1":"tak","2":"tak abierto (ka)","3":"apagado"}},{"id":"tala_bols","name":"Tala (tali / khali / sam)","tradition":"indostánica","by_timbre":true,"timbre":{"0":36,"1":38,"2":37,"3":39},"labels":{"0":"bayan grave (sam, tali)","1":"dayan agudo (khali)","2":"abierto","3":"apagado"},"notes":"Mapeo funcional para marcar el ciclo; los bols de tabla no se modelan uno a uno."},{"id":"gamelan_colotomic","name":"Gamelan colotómico","tradition":"javanesa / balinesa","roles":{"gong":36,"kempul":38,"kenong":40,"ketuk":42,"kempyang":43,"saron":48,"peking":50,"bonang":52}},{"id":"cajon_flamenco","name":"Flamenco (palmas y cajón)","tradition":"flamenca","roles":{"cajon_grave":36,"cajon_agudo":38,"palma_sorda":39,"palma_abierta":40,"jaleo":41,"taco":42}},{"id":"maracatu","name":"Maracatu de baque virado","tradition":"Pernambuco","verify":true,"roles":{"alfaia_grave":36,"alfaia_aro":37,"caixa":38,"tarol":40,"gongue_grave":43,"gongue_agudo":44,"mineiro":46,"abe":47},"notes":"Mapa de roles; los patrones de maracatu están marcados para verificar."},{"id":"candombe","name":"Candombe","tradition":"Uruguay","verify":true,"roles":{"piano_abierto":36,"piano_apagado":37,"chico_abierto":38,"chico_apagado":39,"repique_abierto":40,"repique_apagado":41,"madera":42},"notes":"Mapa de roles; los patrones de candombe están marcados para verificar."},{"id":"janggu","name":"Janggu","tradition":"coreana","by_timbre":true,"timbre":{"0":36,"1":38,"2":37,"3":39},"labels":{"0":"kung (grave)","1":"deok (agudo)","2":"kung-deok (ambos)","3":"apagado"}}],"destination_defaults":{"hihats":"hihats_gm","ethnic":"drum_rack_default","others":"drum_rack_default"}},"microtiming":{"version":"1.0.0","notes":"Plantillas de microtiempo. 'step_offsets': desplazamiento por paso dentro del pulso, en fracción de paso (−0.5 a +0.5), repetido en cada pulso. 'beat_proportions': duraciones relativas de los pulsos del compás (suman 1), aplicadas como rejilla deformable (MIC.3).","templates":[{"id":"straight","name":"Recto","taxonomy":["MIC.1.2"],"status":"H","verify":false,"step_offsets":[0,0,0,0]},{"id":"swing_16_62","name":"Swing de semicorchea 62 %","taxonomy":["MIC.1.1"],"status":"C","verify":false,"step_offsets":[0,0.25,0,0.25],"notes":"Moda medida en DDT Bass y Bonus_Bass (docs/analisis_corpus_midi.md §3)."},{"id":"samba","name":"Samba","taxonomy":["MIC.2.1"],"status":"H","verify":true,"step_offsets":[0,0,-0.08,-0.06],"verify_notes":"Perfil inicial editable del informe; calibrar con mediciones."},{"id":"telespringar","name":"Telespringar","taxonomy":["MIC.2.3"],"status":"H","verify":false,"beat_proportions":[0.38,0.34,0.28],"meter":"3/4"},{"id":"viennese_waltz","name":"Vals vienés","taxonomy":["MIC.2.4"],"status":"I","verify":true,"beat_proportions":null,"verify_notes":"Segundo pulso adelantado; magnitud por medir. Entrada editable sin valores."},{"id":"jembe_mali","name":"Jembe de Malí","taxonomy":["MIC.2.5"],"status":"I","verify":true,"step_offsets":null,"verify_notes":"Proporciones de Polak por verificar. Entrada editable sin valores."},{"id":"laid_back","name":"Laid-back","taxonomy":["MIC.2.6"],"status":"H","verify":false,"global_offset":0.08,"notes":"Valor de diseño; ajustable por capa (bajo atrás)."},{"id":"push","name":"Push","taxonomy":["MIC.2.6"],"status":"H","verify":false,"global_offset":-0.06,"notes":"Valor de diseño; ajustable por capa (hat adelante)."}]},"families":[{"file":"afro_latin.json","family":"afro_latin","name":"Ciclos afroamericanos y criollos","patterns":[{"id":"CIC.6.1/dembow_cic","name":"Dembow (grilla CIC)","taxonomy":["CIC.6.1","CIC.3.1","RGG.10.4"],"origin":{"tradition":"Jamaica → Panamá → Puerto Rico","genre":["reggaetón"],"context":"bombo constante y caja sincopada","sources":["meta-análisis §2.5 CIC.6.1"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[3,6,11,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic","bassline","others"],"categories":["latin_percussion"],"tags":["reggaeton","dembow"],"bpm_range":[85,100],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Véase RGG.10.4/dembow para la divergencia entre fuentes."},{"id":"CIC.6.2/samba_surdo","name":"Samba: surdo","taxonomy":["CIC.6.2","MIC.2.1"],"origin":{"tradition":"Brasil (Río de Janeiro)","genre":["samba"],"context":"surdo con acento en el pulso 2 de 2/4","sources":["meta-análisis §2.5 CIC.6.2"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"surdo","onsets":[0,4],"velocity":[85,127],"timbre":[3,2]}],"params":{"microtiming_template":"samba"},"transforms_allowed":["density"],"destinations":["ethnic","bassline","others"],"categories":["latin_percussion"],"tags":["samba","brasil"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"virada"},"notes":"Golpe apagado en el 1 y abierto en el 2 como propuesta de timbre; el acento en el 2 es el dato documentado."},{"id":"CIC.6.2/samba_tamborim","name":"Samba: tamborim y partido alto","taxonomy":["CIC.6.2"],"origin":{"tradition":"Brasil","genre":["samba"],"context":"tamborim y partido alto","sources":["meta-análisis §7"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones de tamborim y partido alto faltantes en el informe.","cycle_len":16,"step_value":0.25,"meter":"2/4","layers":[{"role":"tamborim","onsets":[]}],"transforms_allowed":["density"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["samba"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"virada"}},{"id":"CIC.6.3/maracatu","name":"Maracatu de baque virado","taxonomy":["CIC.6.3","PRO.17","MIC.2.7"],"origin":{"tradition":"Pernambuco, Brasil","genre":["maracatu nação"],"context":"toques martelo, luanda, arrastão y baque parado; el gonguê cumple función de clave; viradas","sources":["ANPPOM 2025","Sambapedia"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones de toques por verificar (§7 del informe).","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"alfaia_grave","onsets":[]},{"role":"gongue_grave","onsets":[]},{"role":"caixa","onsets":[]},{"role":"tarol","onsets":[]},{"role":"mineiro","onsets":[]},{"role":"abe","onsets":[]}],"params":{"drum_map":"maracatu"},"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["maracatu","brasil"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"virada"}},{"id":"CIC.6.4/candombe","name":"Candombe","taxonomy":["CIC.6.4"],"origin":{"tradition":"Uruguay (afrouruguaya)","genre":["candombe"],"context":"tres tambores (chico, repique, piano) y madera en el casco","sources":["meta-análisis §2.5 CIC.6.4"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones por tambor por verificar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chico_abierto","onsets":[]},{"role":"repique_abierto","onsets":[]},{"role":"piano_abierto","onsets":[]},{"role":"madera","onsets":[]}],"params":{"drum_map":"candombe"},"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["candombe","uruguay"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"CIC.6.5/cumbia","name":"Cumbia","taxonomy":["CIC.6.5","ACE.2.2"],"origin":{"tradition":"Colombia (costa caribe)","genre":["cumbia"],"context":"llamador en contratiempo, alegre improvisando, guacharaca en corcheas","sources":["meta-análisis §2.5 CIC.6.5"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"llamador","onsets":[2,6]},{"role":"guacharaca","onsets":[0,2,4,6]}],"params":{"alegre_improv":true},"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["latin_percussion"],"tags":["cumbia","colombia"],"bpm_range":[80,110],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"notes":"El alegre improvisa: el generador lo trata como capa probabilística."},{"id":"CIC.6.6/festejo","name":"Festejo y landó","taxonomy":["CIC.6.6","MET.2.4"],"origin":{"tradition":"Perú (afroperuana)","genre":["festejo","landó"],"context":"6/8 y 12/8 con cajón","sources":["meta-análisis §2.5 CIC.6.6"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones de cajón por verificar.","cycle_len":12,"step_value":0.5,"meter":"12/8","layers":[{"role":"cajon_grave","onsets":[]},{"role":"cajon_agudo","onsets":[]}],"params":{"drum_map":"cajon_flamenco"},"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["peru","festejo"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.6.7/huayno","name":"Huayno","taxonomy":["CIC.6.7"],"origin":{"tradition":"Andes (Perú, Bolivia)","genre":["huayno"],"context":"2/4 con célula corchea y dos semicorcheas","sources":["meta-análisis §2.5 CIC.6.7"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"cell","onsets":[0,2,3,4,6,7]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","bassline","chords","arpeggio","others"],"categories":["latin_percussion","world_cycles"],"tags":["huayno","andes"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}}]},{"file":"aksak_additive.json","family":"aksak_additive","name":"Aksak y compases aditivos","notes":"Estructuras de Brăiloiu (MET.3.3): inicios de grupo de 2 y 3 corcheas. El generador aksak(n) produce todas las composiciones; aquí van las más usadas como presets. Los nombres de danzas concretas no se fijan sin fuente.","patterns":[{"id":"MET.3.3/aksak_5_23","name":"Aksak 5/8 (2+3)","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"Balcanes, Anatolia y otras","genre":["aksak"],"context":"unidad breve y larga en proporción 2:3","sources":["Brăiloiu 1951/52"]},"status":"H","verify":false,"cycle_len":5,"step_value":0.5,"meter":"5/8","grouping":[2,3],"layers":[{"role":"group","onsets":[0,2],"velocity":[120,95]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","5/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"MET.3.3/aksak_7_223","name":"Aksak 7/8 (2+2+3)","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"Balcanes, Anatolia","genre":["aksak"],"context":"7/8 con el grupo largo al final","sources":["Brăiloiu 1951/52","meta-análisis §4.3"]},"status":"H","verify":false,"cycle_len":7,"step_value":0.5,"meter":"7/8","grouping":[2,2,3],"layers":[{"role":"group","onsets":[0,2,4],"velocity":[120,95,100]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","7/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"MET.3.3/aksak_7_322","name":"Aksak 7/8 (3+2+2)","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"Balcanes, Anatolia","genre":["aksak"],"context":"7/8 con el grupo largo al inicio (como el rupak)","sources":["Brăiloiu 1951/52","meta-análisis §4.3"]},"status":"H","verify":false,"cycle_len":7,"step_value":0.5,"meter":"7/8","grouping":[3,2,2],"layers":[{"role":"group","onsets":[0,3,5],"velocity":[120,95,100]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","7/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"MET.3.3/aksak_9_2223","name":"Aksak 9/8 (2+2+2+3)","taxonomy":["MET.3.3","CIC.4.4"],"origin":{"tradition":"Turquía, Balcanes","genre":["aksak","karşılama"],"context":"el aksak por antonomasia","sources":["Brăiloiu 1951/52","meta-análisis §2.5 CIC.4.4"]},"status":"H","verify":false,"cycle_len":9,"step_value":0.5,"meter":"9/8","grouping":[2,2,2,3],"layers":[{"role":"group","onsets":[0,2,4,6],"velocity":[120,90,95,105]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","9/8","balkan","turkish"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"MET.3.3/aksak_11_22322","name":"Aksak 11/8 (2+2+3+2+2)","taxonomy":["MET.3.3","MET.3.4"],"origin":{"tradition":"Balcanes","genre":["aksak"],"context":"composición de 11 en 2 y 3 con el largo central","sources":["Brăiloiu 1951/52"]},"status":"H","verify":false,"cycle_len":11,"step_value":0.5,"meter":"11/8","grouping":[2,2,3,2,2],"layers":[{"role":"group","onsets":[0,2,4,7,9],"velocity":[120,90,105,90,95]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","11/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"MET.3.1/amalgama_5_4","name":"Amalgama 5/4 (3/4 + 2/4)","taxonomy":["MET.3.1"],"origin":{"tradition":"teoría hispana del solfeo","genre":["5/4"],"context":"suma de compases que conservan sus acentos","sources":["meta-análisis §2.1 MET.3.1"]},"status":"H","verify":false,"cycle_len":5,"step_value":1,"meter":"5/4","grouping":[3,2],"layers":[{"role":"beat","onsets":[0,1,2,3,4],"velocity":[120,70,70,100,70]}],"transforms_allowed":["rotate","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["5/4"],"bpm_range":[60,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}}]},{"file":"clave_tresillo.json","family":"clave_tresillo","name":"Tresillo, clave y timeline","patterns":[{"id":"CIC.3.1/tresillo","name":"Tresillo (3+3+2)","taxonomy":["CIC.3.1","PRO.1","SUP.1.3"],"origin":{"tradition":"Caribe afrocubano y afroamericano","genre":["son","habanera","rhythm and blues"],"context":"célula base de la familia de la clave","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","grouping":[3,3,2],"layers":[{"role":"timeline","onsets":[0,3,6]}],"transforms_allowed":["rotate","reverse","complement","density","swing","phase","binarize"],"destinations":["bassline","chords","arpeggio","ethnic","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","reggaeton","afro"],"bpm_range":[80,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Equivale a una rotación de E(3,8)."},{"id":"CIC.3.2/habanera","name":"Habanera","taxonomy":["CIC.3.2","CIC.3.1"],"origin":{"tradition":"Cuba","genre":["habanera","danzón","tango"],"context":"danza de salón del siglo XIX","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"2/4","grouping":[3,1,2,2],"layers":[{"role":"timeline","onsets":[0,3,4,6]}],"transforms_allowed":["rotate","reverse","complement","density","swing"],"destinations":["bassline","chords","arpeggio","ethnic","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","tango"],"bpm_range":[70,120],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.3.3/cinquillo","name":"Cinquillo","taxonomy":["CIC.3.3","PRO.1"],"origin":{"tradition":"Cuba / Caribe","genre":["danzón","merengue","tumba francesa"],"context":"timeline del danzón","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"2/4","grouping":[2,1,2,1,2],"layers":[{"role":"timeline","onsets":[0,2,3,5,6]}],"transforms_allowed":["rotate","reverse","complement","density","swing","binarize"],"destinations":["bassline","chords","arpeggio","ethnic","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","afro"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rotación de E(5,8)."},{"id":"CIC.3.4/son_clave_3_2","name":"Son clave 3-2","taxonomy":["CIC.3.4","SUP.1.3","ACE.2.1","PRO.1"],"origin":{"tradition":"Cuba / Caribe afrocubano","genre":["son","salsa"],"context":"baile social, regulación de arreglos","sources":["Toussaint 2013","Pérez Fernández 1987"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[3,3,4,2,4],"layers":[{"role":"timeline","onsets":[0,3,6,10,12],"velocity":[110,90,100,100,110],"gate":[0.5,0.5,0.5,0.5,0.5]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","salsa","son"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"La rotación de 8 pasos produce la clave 2-3."},{"id":"CIC.3.7/son_clave_2_3","name":"Son clave 2-3","taxonomy":["CIC.3.7","CIC.3.4","PRO.14"],"origin":{"tradition":"Cuba / Caribe afrocubano","genre":["son","salsa"],"context":"la dirección de la clave sigue la frase del arreglo","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[2,4,3,3,4],"layers":[{"role":"timeline","onsets":[2,4,8,11,14]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","salsa","son"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rotación de 8 pasos de la son clave 3-2."},{"id":"CIC.3.5/rumba_clave_3_2","name":"Rumba clave 3-2","taxonomy":["CIC.3.5","SUP.1.3","ACE.2.1"],"origin":{"tradition":"Cuba (rumba)","genre":["rumba","guaguancó"],"context":"rumba urbana","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[3,4,3,2,4],"layers":[{"role":"timeline","onsets":[0,3,7,10,12]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","rumba"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.3.6/bossa_clave","name":"Bossa clave","taxonomy":["CIC.3.6","PRO.1"],"origin":{"tradition":"Brasil","genre":["bossa nova"],"context":"patrón del aro en la bossa nova","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[3,3,4,3,3],"layers":[{"role":"timeline","onsets":[0,3,6,10,13]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","bossa","jazz"],"bpm_range":[110,150],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rotación de E(5,16)."},{"id":"CIC.2.1/standard_pattern","name":"Standard pattern (12 pulsos)","taxonomy":["CIC.2.1","PRO.1","SUP.1.3","MET.2.4"],"origin":{"tradition":"África occidental (ewe, yoruba)","genre":["agbadza","música de danza"],"context":"patrón de campana que guía la danza","sources":["Agawu 2006","Toussaint 2013"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.333333,"meter":"12/8","grouping":[2,2,1,2,2,2,1],"layers":[{"role":"bell","onsets":[0,2,4,5,7,9,11]}],"transforms_allowed":["rotate","reverse","complement","density","phase","binarize"],"destinations":["ethnic","hihats","arpeggio","others"],"categories":["world_cycles"],"tags":["afro","12/8"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Perfil durativo ⟨2212221⟩; rotación de E(7,12). La transformación binarize lo convierte a 16 pasos (hipótesis de Pérez Fernández)."}]},{"file":"colotomy.json","family":"colotomy","name":"Colotomía de gamelan","notes":"Numeración del informe desde 1 convertida a pasos desde 0. irama multiplica la densidad de elaboración (×2 por nivel) y laya cambia el tempo (CIC.5, §4.8).","patterns":[{"id":"CIC.5/lancaran","name":"Lancaran (16 pulsos)","taxonomy":["CIC.5","FOR.2.3","MET.2.5"],"origin":{"tradition":"Java (gamelan)","genre":["gendhing lancaran"],"context":"forma colotómica corta; el gong cierra el ciclo","sources":["Sumarsam (Wesleyan)","Wikipedia: Irama"]},"status":"I","verify":true,"verify_notes":"Convención estándar; variantes regionales por verificar.","cycle_len":16,"step_value":0.5,"meter":"16/8","layers":[{"role":"ketuk","onsets":[0,2,4,6,8,10,12,14]},{"role":"kenong","onsets":[3,7,11,15]},{"role":"kempul","onsets":[5,9,13]},{"role":"gong","onsets":[15],"velocity":[127]}],"params":{"irama":0,"laya":"sedeng","elaboration":true},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["gamelan","java"],"bpm_range":[60,160],"repeat_policy":{"mode":"gongan","default_repeats":2,"variation_on_last":"gong"}},{"id":"CIC.5/ketawang","name":"Ketawang (16 pulsos)","taxonomy":["CIC.5"],"origin":{"tradition":"Java (gamelan)","genre":["gendhing ketawang"],"context":"ciclo de 16 con distribución propia","sources":["meta-análisis §2.5 CIC.5"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Distribución de kenong, kempul y ketuk por verificar; solo se fija el gong final.","cycle_len":16,"step_value":0.5,"meter":"16/8","layers":[{"role":"gong","onsets":[15],"velocity":[127]},{"role":"kenong","onsets":[]},{"role":"kempul","onsets":[]},{"role":"ketuk","onsets":[]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["gamelan","java"],"repeat_policy":{"mode":"gongan","default_repeats":2,"variation_on_last":"gong"}},{"id":"CIC.5/ladrang","name":"Ladrang (32 pulsos)","taxonomy":["CIC.5"],"origin":{"tradition":"Java (gamelan)","genre":["gendhing ladrang"],"context":"ciclo de 32 con distribución propia","sources":["meta-análisis §2.5 CIC.5"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Distribución colotómica por verificar; solo se fija el gong final.","cycle_len":32,"step_value":0.5,"meter":"32/8","layers":[{"role":"gong","onsets":[31],"velocity":[127]},{"role":"kenong","onsets":[]},{"role":"kempul","onsets":[]},{"role":"ketuk","onsets":[]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["gamelan","java"],"repeat_policy":{"mode":"gongan","default_repeats":1,"variation_on_last":"gong"}}]},{"file":"dub_techno.json","family":"dub_techno","name":"Dub techno","notes":"Rejillas medidas en el corpus DDT (docs/analisis_corpus_midi.md §1–3) más la base del informe RGG.10.2. En el destino Chords, el acorde por defecto es la tríada del grado I del modo elegido en estado fundamental: el corpus usa 0-3-7 sobre la tónica en 170 de 200 eventos.","patterns":[{"id":"RGG.10.2/dub_techno_base","name":"Dub techno (base)","taxonomy":["RGG.10.2","GRV.14","PRO.19"],"origin":{"tradition":"Berlín, 1993","genre":["dub techno"],"context":"Basic Channel, Chain Reaction, Rhythm & Sound","attributions":["Moritz von Oswald","Mark Ernestus"],"sources":["Resident Advisor","Attack Magazine"]},"status":"H","verify":true,"verify_notes":"Posiciones del stab [2,10] propuestas por el informe; el corpus muestra más variedad (véanse los patrones [C] de esta familia).","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"hat","onsets":[2,6,10,14]},{"role":"chord","onsets":[2,10],"gate":[0.15,0.15]}],"fx":{"delay_ratio":"1/8.","feedback":0.55},"transforms_allowed":["rotate","density","swing","phase"],"destinations":["chords","hihats","ethnic"],"categories":["dub_techno"],"tags":["dub techno","techno","minimal"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/stab_1_7_15","name":"Stab: 1, «y» del 2, «y» del 4","taxonomy":["RGG.10.2","ACE.2.2"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"patrón más frecuente del corpus","sources":["corpus DDT: Chord_09, 16, 42"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,6,14],"gate":[0.5,0.5,0.5],"velocity":[96,80,84]}],"fx":{"delay_ratio":"1/8.","feedback":0.5},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/stab_1_11","name":"Stab: 1 y «y» del 3","taxonomy":["RGG.10.2"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"dos stabs por compás, máximo espacio","sources":["corpus DDT: Chord_10"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,10],"gate":[0.5,0.5]}],"fx":{"delay_ratio":"1/8.","feedback":0.6},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno","minimal"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/stab_1_6_11","name":"Stab: 1, 6, 11 (3+5+…)","taxonomy":["RGG.10.2","ACE.2.4"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"stab desplazado por semicorchea","sources":["corpus DDT: Em_26, Dm_21"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,5,10],"gate":[0.5,0.5,0.5],"velocity":[96,82,86]}],"fx":{"delay_ratio":"1/8.","feedback":0.5},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/stab_dense","name":"Stab denso (seis ataques)","taxonomy":["RGG.10.2","ACE.2.4"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"variante densa con acento tras el pulso 3","sources":["corpus DDT: Chord_01"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,3,6,9,12,15],"gate":[0.45,0.45,0.45,0.45,0.45,0.45],"velocity":[90,76,82,104,84,74]}],"fx":{"delay_ratio":"1/8.","feedback":0.45},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/stab_8ths","name":"Stab en corcheas continuas","taxonomy":["RGG.10.2","CIC.1"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"corriente de corcheas con variación de filtro y velocity","sources":["corpus DDT: Chord_19"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,2,4,6,8,10,12,14],"gate":[0.4,0.4,0.4,0.4,0.4,0.4,0.4,0.4]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/pad_colchon","name":"Colchón de acorde","taxonomy":["RGG.10.2","ACE.1.6"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"acorde largo en canal aparte como colchón","sources":["Attack Magazine (tutorial)","corpus DDT: Chord_02, 31, 38"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"pad","onsets":[0],"gate":[4]}],"transforms_allowed":[],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno","ambient"],"bpm_range":[100,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"gate en negras: 4 = un compás entero de 4/4."},{"id":"RGG.10.2/stab_weighted","name":"Stab generativo (pesos del corpus)","taxonomy":["RGG.10.2","PRO.15","COG.3.3"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"rejilla generada con probabilidades por paso derivadas del histograma de 51 clips","sources":["corpus DDT Chords (histograma §1)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","generator":{"type":"weighted_steps","step_weights":[41,5,13,9,7,12,14,9,17,7,15,10,12,9,18,2],"hits_range":[2,5],"force_first":0.8,"gate_range":[0.33,0.85]},"layers":[],"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"params":{"swing_template":"swing_16_62","chord":"triad_I_root"},"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/bass_offbeat","name":"Bajo de dub techno en contratiempo","taxonomy":["RGG.10.2","ACE.2.2","RGG.5.4"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"bajo en el «y» de cada pulso","sources":["corpus DDT: Bass_23, Bonus A_120_04"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[2,6,10,14],"gate":[0.6,0.6,0.6,0.6]}],"transforms_allowed":["density","swing","rotate"],"destinations":["bassline"],"categories":["dub_techno"],"tags":["dub techno","techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"RGG.10.2/bass_swung_16","name":"Bajo de semicorcheas con swing","taxonomy":["RGG.10.2","MIC.1.1","CIC.1.1"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"línea de semicorcheas con impares retrasadas un cuarto de paso (≈ 62 %)","sources":["corpus DDT: Bass_38_Bb (§2–3)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,1,3,5,7,9,11],"microtiming":[0,0.25,0.25,0.25,0.25,0.25,0.25],"gate":[0.4,0.4,0.4,0.4,0.4,0.4,1.6]}],"transforms_allowed":["density","rotate"],"destinations":["bassline"],"categories":["dub_techno"],"tags":["dub techno","deep"],"bpm_range":[115,128],"params":{"swing_template":"swing_16_62"},"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}}]},{"file":"flamenco.json","family":"flamenco","name":"Compás flamenco","notes":"Ciclo de 12 tiempos con acentos en 3, 6, 8, 10 y 12 (desde 1) = pasos [2,5,7,9,11]. start_offset rota el ciclo (CIC.7). Paso = corchea.","patterns":[{"id":"CIC.7/solea","name":"Soleá","taxonomy":["CIC.7","MET.3.2","SUP.3.1"],"origin":{"tradition":"Andalucía (flamenco)","genre":["soleá"],"context":"compás lento de base","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[3,3,2,2,2],"layers":[{"role":"palmas","onsets":[0,1,2,3,4,5,6,7,8,9,10,11],"velocity":[60,60,120,60,60,120,60,120,60,120,60,120],"timbre":[3,3,2,3,3,2,3,2,3,2,3,2]},{"role":"accent","onsets":[2,5,7,9,11]}],"params":{"start_offset":0},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[60,120],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"}},{"id":"CIC.7/alegrias","name":"Alegrías y cantiñas","taxonomy":["CIC.7"],"origin":{"tradition":"Andalucía (flamenco, Cádiz)","genre":["alegrías","cantiñas"],"context":"misma acentuación que la soleá, tempo más vivo","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[3,3,2,2,2],"layers":[{"role":"accent","onsets":[2,5,7,9,11]},{"role":"palmas","onsets":[0,1,3,4,6,8,10],"velocity":[60,60,60,60,60,60,60],"timbre":[3,3,3,3,3,3,3]}],"params":{"start_offset":0},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[100,170],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"}},{"id":"CIC.7/buleria","name":"Bulería (base)","taxonomy":["CIC.7","SUP.3"],"origin":{"tradition":"Andalucía (flamenco, Jerez)","genre":["bulería"],"context":"rápida y variable; medios compases de 6","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[3,3,2,2,2],"layers":[{"role":"accent","onsets":[2,5,7,9,11]}],"params":{"start_offset":0,"half_compas":true},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[180,260],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"},"notes":"Acentuación de base; la variación propia de la bulería la añade el generador con medios compases."},{"id":"CIC.7/seguiriya","name":"Seguiriya","taxonomy":["CIC.7","PRO.14","MET.3.4"],"origin":{"tradition":"Andalucía (flamenco)","genre":["seguiriya"],"context":"el mismo ciclo empezando en el 8, sentido como 2+2+3+3+2","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[2,2,3,3,2],"layers":[{"role":"accent","onsets":[0,2,4,7,10]}],"params":{"start_offset":7},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[50,100],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"}}]},{"file":"grooves_electronic.json","family":"grooves_electronic","name":"Grooves electrónicos y populares","patterns":[{"id":"GRV.1/four_on_the_floor","name":"Four-on-the-floor","taxonomy":["GRV.1","MET.2.3","COG.2"],"origin":{"tradition":"disco, house, techno","genre":["disco","house","techno"],"context":"música de baile","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"hat_open","onsets":[2,6,10,14]}],"transforms_allowed":["rotate","density","swing","phase"],"destinations":["ethnic","hihats","bassline","chords","others"],"categories":["electronic"],"tags":["house","techno","disco"],"bpm_range":[115,135],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"GRV.2/backbeat","name":"Backbeat","taxonomy":["GRV.2","ACE.2.2"],"origin":{"tradition":"rhythm and blues, rock, pop","genre":["rock","pop","funk"],"context":"caja en 2 y 4","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]},{"role":"snare","onsets":[4,12]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic","hihats","chords","others"],"categories":["electronic"],"tags":["rock","pop","funk","hiphop"],"bpm_range":[70,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"GRV.3/half_time","name":"Half-time","taxonomy":["GRV.3","FOR.3"],"origin":{"tradition":"música popular","genre":["dubstep","trap","rock"],"context":"caja en el pulso 3","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0]},{"role":"snare","onsets":[8]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["dubstep","trap"],"bpm_range":[130,150],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"GRV.4/shuffle","name":"Shuffle (tresillos)","taxonomy":["GRV.4","MIC.1.1"],"origin":{"tradition":"blues, jazz, rhythm and blues","genre":["blues","shuffle"],"context":"rejilla de 12 en tresillos","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.333333,"meter":"12/8","layers":[{"role":"hat","onsets":[0,2,3,5,6,8,9,11]}],"transforms_allowed":["rotate","density"],"destinations":["hihats","ethnic","bassline","chords","others"],"categories":["electronic"],"tags":["blues","shuffle"],"bpm_range":[70,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"GRV.5/one_drop","name":"One drop (grilla GRV)","taxonomy":["GRV.5","RGG.3.1"],"origin":{"tradition":"Jamaica, roots reggae","genre":["reggae"],"context":"bombo y caja en el pulso 3","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[8]},{"role":"snare","onsets":[8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["electronic","dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,90],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"}},{"id":"GRV.6/rockers","name":"Rockers (grilla GRV)","taxonomy":["GRV.6","RGG.3.2"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"bombo en 1 y 3","sources":["meta-análisis §3"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["electronic","dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,90],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Véase RGG.3.2a y RGG.3.2b para las dos acepciones."},{"id":"GRV.7/steppers","name":"Steppers (grilla GRV)","taxonomy":["GRV.7","RGG.3.3"],"origin":{"tradition":"Jamaica / Reino Unido","genre":["reggae","dub"],"context":"bombo en cada pulso","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["electronic","dub_reggae"],"tags":["dub","steppers"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"GRV.8/skank","name":"Skank (grilla GRV)","taxonomy":["GRV.8","ACE.2.2","RGG.6.1"],"origin":{"tradition":"Jamaica (ska, reggae)","genre":["ska","reggae"],"context":"acordes en contratiempo o en 2 y 4","sources":["meta-análisis §3"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,6,10,14],"gate":[0.2,0.2,0.2,0.2]}],"transforms_allowed":["rotate","density","swing"],"destinations":["chords","others"],"categories":["electronic","dub_reggae"],"tags":["reggae","ska","dub"],"bpm_range":[60,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"params":{"skank_mode":"offbeat"}},{"id":"GRV.9/trap","name":"Trap","taxonomy":["GRV.9","GRV.3"],"origin":{"tradition":"Atlanta, hip hop","genre":["trap"],"context":"hats rápidos con tresillos y redobles","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,10]},{"role":"snare","onsets":[8]},{"role":"hat","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]}],"transforms_allowed":["density","swing"],"destinations":["hihats","ethnic","others"],"categories":["electronic"],"tags":["trap","hiphop"],"bpm_range":[130,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"trap_roll"},"notes":"El bombo en [0,10] es una elección de diseño; el informe fija solo hats y caja. Los redobles de fusa y los tresillos los añade el generador de Hi-hats."},{"id":"GRV.10/motorik","name":"Motorik","taxonomy":["GRV.10"],"origin":{"tradition":"Alemania, krautrock","genre":["krautrock"],"context":"4/4 constante con mínima variación","sources":["meta-análisis §3"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrón exacto por verificar en transcripción.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]}],"transforms_allowed":["density"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["krautrock"],"bpm_range":[110,160],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"GRV.11/breakbeat","name":"Breakbeat / Amen","taxonomy":["GRV.11"],"origin":{"tradition":"funk, hip hop, jungle","genre":["breakbeat","jungle"],"context":"breaks troceados","sources":["meta-análisis §3"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Transcripción del Amen break pendiente; entrada vacía para completar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[]},{"role":"snare","onsets":[]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["jungle","breakbeat"],"bpm_range":[160,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"GRV.12/two_step","name":"2-step / UK garage","taxonomy":["GRV.12","MIC.1.1","RGG.10.3"],"origin":{"tradition":"Reino Unido","genre":["uk garage","2-step"],"context":"bombo que omite tiempos con swing de semicorchea","sources":["meta-análisis §3"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Onsets por verificar; el reggae informa bombo en 1 y 3 en el 2-step.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["garage","2-step"],"bpm_range":[130,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"params":{"swing_level":0.25,"ratio":1.5}},{"id":"GRV.13/moroder_bass","name":"Bajo Moroder","taxonomy":["GRV.13","CIC.1.1","ACE.1.4"],"origin":{"tradition":"Múnich, disco electrónica","genre":["disco","synth"],"context":"I Feel Love (1977)","sources":["meta-análisis §3"]},"status":"V","verify":true,"verify_notes":"Contorno de octavas por verificar; la rejilla de semicorcheas sí está documentada.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]}],"transforms_allowed":["density"],"destinations":["bassline","arpeggio"],"categories":["electronic"],"tags":["disco","synth","techno"],"bpm_range":[110,135],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"params":{"bass_style":"ostinato_continuo"}},{"id":"GRV.14/dub_techno","name":"Dub techno (grilla GRV)","taxonomy":["GRV.14","RGG.10.2","PRO.19"],"origin":{"tradition":"Berlín","genre":["dub techno"],"context":"stab en contratiempo con delay","sources":["meta-análisis §3"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,10],"gate":[0.15,0.15]}],"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["electronic","dub_techno"],"tags":["dub techno","techno","dub"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"fx":{"delay_ratio":"1/8.","feedback":0.55}}]},{"file":"iqa_usul.json","family":"iqa_usul","name":"Iqa' árabe y usul otomano","notes":"timbre 0 = dum (grave), 1 = tak (agudo). Las transiciones documentadas (baladi ↔ maqsum ↔ malfuf) se guardan en 'transitions' para el modo de cambio de patrón.","transitions":[{"from":"CIC.4.3.2/baladi","to":"CIC.4.3.1/maqsum","note":"modulación frecuente y regreso","status":"H"},{"from":"CIC.4.3.2/baladi","to":"CIC.4.3.4/malfuf","ratio":"2 compases de malfuf por 1 de baladi","status":"H"}],"patterns":[{"id":"CIC.4.3.1/maqsum","name":"Maqsum","taxonomy":["CIC.4.3.1","ACE.1.5"],"origin":{"tradition":"mundo árabe","genre":["tarab","pop árabe","folclor"],"context":"iqa' de 4/4 más usado","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0,1,3,4,6],"timbre":[0,1,1,0,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","maqsum"],"bpm_range":[80,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"params":{"ornament_grid":32}},{"id":"CIC.4.3.2/baladi","name":"Baladi / Masmudi saghir","taxonomy":["CIC.4.3.2","ACE.1.5"],"origin":{"tradition":"Egipto, mundo árabe","genre":["baladi","pop árabe"],"context":"doble dum inicial","sources":["MaqamWorld: Iqa' Baladi"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0,1,3,4,6],"timbre":[0,0,1,0,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","baladi"],"bpm_range":[80,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.4.3.3/saidi","name":"Saidi","taxonomy":["CIC.4.3.3","ACE.1.5"],"origin":{"tradition":"Alto Egipto","genre":["saidi"],"context":"danza con bastón","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0,1,3,4,6],"timbre":[0,1,0,0,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","saidi"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.4.3.4/malfuf","name":"Malfuf","taxonomy":["CIC.4.3.4","CIC.3.1"],"origin":{"tradition":"mundo árabe","genre":["folclor","entradas de danza"],"context":"2/4 rápido","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"darbuka","onsets":[0,3,6],"timbre":[0,1,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","malfuf"],"bpm_range":[100,180],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"notes":"Comparte la forma 3+3+2 con el tresillo."},{"id":"CIC.4.3.5/wahda","name":"Wahda","taxonomy":["CIC.4.3.5"],"origin":{"tradition":"mundo árabe","genre":["tarab","taqsim acompañado"],"context":"dum en el pulso 1 con taks escasos","sources":["MaqamWorld"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes tak exactos por verificar (§7 del informe).","cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0],"timbre":[0]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["arabic"],"bpm_range":[60,120],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"CIC.4.3.6/fox","name":"Fox","taxonomy":["CIC.4.3.6"],"origin":{"tradition":"mundo árabe","genre":["pop árabe"],"context":"2/4 alternado","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":4,"step_value":0.5,"meter":"2/4","layers":[{"role":"darbuka","onsets":[0,1,2,3],"timbre":[0,1,0,1]}],"transforms_allowed":["density"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"CIC.4.3.7/samai_thaqil","name":"Sama'i thaqil (10/8)","taxonomy":["CIC.4.3.7","MET.3.2"],"origin":{"tradition":"mundo árabe y otomano","genre":["sama'i","muwashshah"],"context":"forma instrumental","sources":["MaqamWorld"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Agrupamiento 3+2+2+3 documentado; golpes dum/tak por verificar. Solo se marcan los inicios de grupo.","cycle_len":10,"step_value":0.5,"meter":"10/8","grouping":[3,2,2,3],"layers":[{"role":"darbuka","onsets":[0,3,5,7],"timbre":[0,1,1,0]}],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["arabic","ottoman","10/8"],"bpm_range":[60,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"CIC.4.4/aksak_usul","name":"Usul aksak (9/8)","taxonomy":["CIC.4.4","MET.3.3"],"origin":{"tradition":"Turquía otomana","genre":["usul","música clásica otomana"],"context":"2+2+2+3","sources":["meta-análisis §2.5 CIC.4.4"]},"status":"I","verify":false,"cycle_len":9,"step_value":0.5,"meter":"9/8","grouping":[2,2,2,3],"layers":[{"role":"darbuka","onsets":[0,2,4,6],"timbre":[0,1,1,0]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","others","arpeggio","bassline"],"categories":["world_cycles"],"tags":["ottoman","aksak","9/8"],"bpm_range":[80,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Timbres de inicio de grupo como propuesta de diseño (inicio = dum)."},{"id":"CIC.4.4/curcuna","name":"Usul curcuna (10/8)","taxonomy":["CIC.4.4","MET.3.2"],"origin":{"tradition":"Turquía otomana","genre":["usul"],"context":"3+2+2+3","sources":["meta-análisis §2.5 CIC.4.4"]},"status":"I","verify":false,"cycle_len":10,"step_value":0.5,"meter":"10/8","grouping":[3,2,2,3],"layers":[{"role":"darbuka","onsets":[0,3,5,7],"timbre":[0,1,1,0]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","others","arpeggio","bassline"],"categories":["world_cycles"],"tags":["ottoman","10/8"],"bpm_range":[80,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Timbres de inicio de grupo como propuesta de diseño (inicio = dum)."}]},{"file":"jangdan_kultrun.json","family":"jangdan_kultrun","name":"Jangdan coreano y kultrún mapuche","notes":"Del jangdan se conocen longitudes y agrupamientos, no los golpes: se cargan los inicios de gak o de pulso como estructura editable. El kultrún queda fuera de la lista pública (restricted_use) y solo aporta un principio estructural.","patterns":[{"id":"CIC.4.5/jinyangjo","name":"Jinyangjo (24)","taxonomy":["CIC.4.5","FOR.2.2"],"origin":{"tradition":"Corea","genre":["pansori","sanjo"],"context":"el jangdan más lento; 6 pulsos por gak, 4 gak","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes del janggu por verificar; se marcan los inicios de gak.","cycle_len":24,"step_value":1,"meter":"24/4","grouping":[6,6,6,6],"layers":[{"role":"gak","onsets":[0,6,12,18],"timbre":[2,0,0,1]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["korea","jangdan"],"bpm_range":[20,60],"repeat_policy":{"mode":"cycles","default_repeats":2,"variation_on_last":"none"}},{"id":"CIC.4.5/jungmori","name":"Jungmori (12)","taxonomy":["CIC.4.5"],"origin":{"tradition":"Corea","genre":["pansori","minyo"],"context":"jangdan medio de 12 pulsos","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes por verificar; se marca el ciclo.","cycle_len":12,"step_value":1,"meter":"12/4","layers":[{"role":"beat","onsets":[0],"timbre":[2]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["korea","jangdan"],"bpm_range":[60,120],"repeat_policy":{"mode":"cycles","default_repeats":4,"variation_on_last":"none"}},{"id":"CIC.4.5/semachi","name":"Semachi (3 pulsos ternarios)","taxonomy":["CIC.4.5","MET.2.4"],"origin":{"tradition":"Corea","genre":["minyo"],"context":"algo rápido, de tres pulsos","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Subdivisión y golpes por verificar.","cycle_len":3,"step_value":1,"meter":"3/4","layers":[{"role":"beat","onsets":[0],"timbre":[2]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["korea","jangdan"],"repeat_policy":{"mode":"cycles","default_repeats":8,"variation_on_last":"none"}},{"id":"CIC.4.5/eotmori","name":"Eotmori (10/8)","taxonomy":["CIC.4.5","MET.3.2"],"origin":{"tradition":"Corea","genre":["pansori","sanjo"],"context":"jangdan muy rápido en 10/8","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"verify_notes":"Agrupamiento 3+3+2+2 o 3+2+2+3 según escuela; se carga 3+3+2+2 editable.","cycle_len":10,"step_value":0.5,"meter":"10/8","grouping":[3,3,2,2],"layers":[{"role":"group","onsets":[0,3,6,8],"timbre":[2,1,0,1]}],"params":{"grouping_alternatives":[[3,3,2,2],[3,2,2,3]]},"transforms_allowed":["density","rotate"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["korea","jangdan","10/8"],"bpm_range":[150,240],"repeat_policy":{"mode":"cycles","default_repeats":8,"variation_on_last":"none"}},{"id":"CIC.4.5/jajinmori","name":"Jajinmori (4 pulsos ternarios)","taxonomy":["CIC.4.5","MET.2.4"],"origin":{"tradition":"Corea","genre":["pansori","sanjo"],"context":"rápido, equivalente a 12/8","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes por verificar; se marcan los cuatro pulsos.","cycle_len":12,"step_value":0.333333,"meter":"12/8","grouping":[3,3,3,3],"layers":[{"role":"beat","onsets":[0,3,6,9],"timbre":[2,0,0,1]}],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["korea","jangdan","12/8"],"bpm_range":[100,180],"repeat_policy":{"mode":"cycles","default_repeats":8,"variation_on_last":"none"}},{"id":"CIC.9/kultrun_principio","name":"Kultrún (principio de ciclo de cuatro)","taxonomy":["CIC.9"],"origin":{"tradition":"Mapuche (Chile y Argentina)","genre":["ülkantun","purrun"],"context":"instrumento ceremonial de la machi; su membrana representa el universo dividido en cuatro","sources":["Grebe 1973, Revista Musical Chilena","Memoria Chilena"],"restricted_use":true},"status":"H","verify":true,"restricted_use":true,"structural_only":true,"missing_data":true,"cultural_note":"El kultrún es un instrumento ceremonial de la machi. Este principio (ciclo de cuatro, golpe y sacudida) no reproduce toques ceremoniales; su uso como repertorio requiere el consentimiento de las comunidades y especialistas que lo sostienen.","verify_notes":"Las transcripciones de 1934–1949 citadas por Grebe no se consultaron.","cycle_len":4,"step_value":1,"meter":"4/4","layers":[{"role":"golpe","onsets":[0,1,2,3],"timbre":[0,0,0,0]},{"role":"sacudida","onsets":[0,2],"timbre":[3,3]}],"transforms_allowed":[],"destinations":["ethnic"],"categories":["world_cycles"],"tags":["ritual"],"repeat_policy":{"mode":"cycles","default_repeats":4,"variation_on_last":"none"}}]},{"file":"latin_percussion.json","family":"latin_percussion","name":"Percusión latina (corpus)","notes":"Rejillas medidas en Latin MIDI drums (docs/analisis_corpus_midi.md §5). Los nombres de estilo que no vienen de una fuente se marcan verify: true.","patterns":[{"id":"CIC.6.2/bossa_kick","name":"Bombo de bossa / baião","taxonomy":["CIC.6.2","CIC.3.6","ACE.2.3"],"origin":{"tradition":"Brasil","genre":["bossa nova","baião"],"context":"negra con puntillo y corchea, dos veces por compás","sources":["corpus: Azure-Bossa-Nova, Bossa-Nova, Schuld…Bossa-Nova"]},"status":"C","verify":true,"verify_notes":"Nombre de estilo por contrastar con fuente pedagógica.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,6,8,14],"velocity":[100,80,100,80]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline"],"categories":["latin_percussion"],"tags":["bossa","brasil","latin"],"bpm_range":[120,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.3.6/bossa_cross_stick_32","name":"Cross-stick de bossa (2 compases)","taxonomy":["CIC.3.6","PRO.2"],"origin":{"tradition":"Brasil","genre":["bossa nova"],"context":"aro cada 6 semicorcheas: ciclo casi uniforme de 32 pasos","sources":["corpus: Azure-Bossa-Nova (rim)","corpus: Schuld…Bossa-Nova (cowbell)"]},"status":"C","verify":true,"verify_notes":"Comparar con la bossa clave del informe (CIC.3.6).","cycle_len":32,"step_value":0.25,"meter":"4/4","grouping":[6,6,6,6,8],"layers":[{"role":"rim","onsets":[4,10,16,22,28]},{"role":"cabasa","onsets":[2,6,10,14,18,22,26,30],"velocity":[70,70,70,70,70,70,70,70]},{"role":"kick","onsets":[0,6,8,14,16,22,24,30]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["bossa","brasil"],"bpm_range":[120,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.6/cowbell_bell_offbeat","name":"Cencerro en negras y campana a contratiempo","taxonomy":["CIC.6","ACE.2.2"],"origin":{"tradition":"afrolatina","genre":["latin"],"context":"pulso de cencerro con campana del ride en el «y»","sources":["corpus: Latin2, Latin15, Latin24, ethnic5"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"cowbell","onsets":[0,4,8,12]},{"role":"ride_bell","onsets":[2,6,10,14]},{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[3,7,10,13,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["latin"],"bpm_range":[100,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.6/kick_dotted_per_beat","name":"Bombo de corchea con puntillo y semicorchea","taxonomy":["CIC.6","ACE.2.3"],"origin":{"tradition":"afrolatina","genre":["latin"],"context":"cada pulso: ataque en la 1.ª y la 4.ª semicorchea","sources":["corpus: Latin6, Latin21"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,3,4,7,8,11,12,15]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline"],"categories":["latin_percussion"],"tags":["latin"],"bpm_range":[100,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.6/guiro_scrape","name":"Güiro","taxonomy":["CIC.6","ACE.2.3"],"origin":{"tradition":"afrolatina","genre":["latin","cumbia","salsa"],"context":"raspado de corchea con anticipación final","sources":["corpus: LS_4-4_NmlHrdSwg_FullKit_124"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"guiro","onsets":[2,3,6,7,10,11,13,14],"velocity":[90,60,90,60,90,60,80,90]}],"transforms_allowed":["density","swing"],"destinations":["hihats","ethnic"],"categories":["latin_percussion"],"tags":["latin"],"bpm_range":[90,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"CIC.6/congas_three_strokes","name":"Congas: abierta, apagada y grave","taxonomy":["CIC.6","ACE.1.5"],"origin":{"tradition":"afrolatina","genre":["latin"],"context":"figura repartida por golpe","sources":["corpus: ethnic5"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"conga_open","onsets":[6,7,14]},{"role":"conga_mute","onsets":[3,11]},{"role":"conga_lo","onsets":[12]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["latin","conga"],"bpm_range":[100,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.6/agogo_two_bar","name":"Agogó (2 compases)","taxonomy":["CIC.6","CIC.2"],"origin":{"tradition":"afrobrasileña","genre":["latin"],"context":"figura de campana de dos compases","sources":["corpus: ethnic5"]},"status":"C","verify":false,"cycle_len":32,"step_value":0.25,"meter":"4/4","layers":[{"role":"agogo_lo","onsets":[0,2,3,4,6,7,8,9,10,14,16,18,22,23,24,26,28,30,31]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["latin","brasil"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"CIC.6/maracas_ride_layers","name":"Capas agudas: ride, cabasa y maracas","taxonomy":["CIC.6","MET.2.1"],"origin":{"tradition":"afrolatina","genre":["bossa nova","latin"],"context":"subdivisión continua repartida","sources":["corpus: Azure-Bossa-Nova"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"ride","onsets":[0,2,4,6,8,10,12,14]},{"role":"cabasa","onsets":[2,6,10,14]},{"role":"maracas","onsets":[0,4,8,12]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["latin_percussion"],"tags":["bossa","latin"],"bpm_range":[110,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"MET.2.4/latin_6_8_kit","name":"Kit latino en 6/8","taxonomy":["MET.2.4","SUP.3"],"origin":{"tradition":"afrolatina","genre":["latin 6/8"],"context":"bombo en las corcheas 1, 4 y 6; caja en 3 y 5","sources":["corpus: Latin68time1, LS_6-8_FullKit_135"]},"status":"C","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[3,3],"layers":[{"role":"kick","onsets":[0,3,5]},{"role":"snare","onsets":[2,4]},{"role":"hat_open","onsets":[1,5]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["latin","6/8"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rejilla en corcheas (6 pasos)."},{"id":"MET.2.4/bell_12_8","name":"Campana y woodblock en 12/8","taxonomy":["MET.2.4","CIC.2"],"origin":{"tradition":"afrolatina","genre":["latin 12/8"],"context":"figura de campana de 12 corcheas (comparar con CIC.2.1)","sources":["corpus: LS_12-8_NmlStr_FullKit_142"]},"status":"C","verify":false,"cycle_len":24,"step_value":0.25,"meter":"12/8","layers":[{"role":"cowbell","onsets":[0,2,4,7,10,12,15,17]},{"role":"woodblock_lo","onsets":[0,6,10,14,16,22]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion","world_cycles"],"tags":["latin","12/8","afro"],"bpm_range":[80,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"Rejilla de semicorcheas (24 pasos = 12 corcheas): el cencerro usa posiciones de semicorchea impar."},{"id":"MET.3.3/triangle_9_8","name":"Triángulo en 9/8","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"percusión en métrica aditiva","genre":["9/8"],"context":"figura de triángulo de un pack de percusión latina","sources":["corpus: LS_9-8_NmlStr_Triangles_169"]},"status":"C","verify":false,"cycle_len":18,"step_value":0.25,"meter":"9/8","layers":[{"role":"triangle","onsets":[0,2,4,8,10,12,16]}],"transforms_allowed":["density","rotate"],"destinations":["hihats","ethnic"],"categories":["latin_percussion","world_cycles"],"tags":["9/8","aksak"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}}]},{"file":"procedures.json","family":"procedures","name":"Procedimientos: euclidianos, modos rítmicos, polirritmia y polimetría","patterns":[{"id":"PRO.1/e_3_8","name":"E(3,8)","taxonomy":["PRO.1","CIC.3.1"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación del tresillo","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.25,"meter":"2/4","generator":{"type":"euclid","k":3,"n":8,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"PRO.1/e_5_8","name":"E(5,8)","taxonomy":["PRO.1","CIC.3.3"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación del cinquillo","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.25,"meter":"2/4","generator":{"type":"euclid","k":5,"n":8,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"PRO.1/e_7_12","name":"E(7,12)","taxonomy":["PRO.1","CIC.2.1"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación del standard pattern","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.333333,"meter":"12/8","generator":{"type":"euclid","k":7,"n":12,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean","12/8"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"PRO.1/e_5_16","name":"E(5,16)","taxonomy":["PRO.1","CIC.3.6"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación de la bossa clave","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.25,"meter":"4/4","generator":{"type":"euclid","k":5,"n":16,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"PRO.1/e_custom","name":"Euclidiano libre E(k,n)","taxonomy":["PRO.1","PRO.2","PRO.14"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"k y n configurables con rotación","sources":["Toussaint 2005, 2013"]},"status":"H","verify":false,"step_value":0.25,"meter":"4/4","generator":{"type":"euclid","k":7,"n":16,"rotation":0,"editable":true},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"PRO.3/modo_1","name":"Modo rítmico 1 (largo–breve)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum","conductus"],"context":"pie trocaico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":3,"step_value":0.5,"meter":"3/8","grouping":[2,1],"layers":[{"role":"voice","onsets":[0,2],"gate":[0.95,0.45]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"PRO.3/modo_2","name":"Modo rítmico 2 (breve–largo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum","conductus"],"context":"pie yámbico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":3,"step_value":0.5,"meter":"3/8","grouping":[1,2],"layers":[{"role":"voice","onsets":[0,1],"gate":[0.45,0.95]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"PRO.3/modo_3","name":"Modo rítmico 3 (largo con puntillo–breve–largo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie dactílico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[3,1,2],"layers":[{"role":"voice","onsets":[0,3,4],"gate":[1.4,0.45,0.95]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"PRO.3/modo_4","name":"Modo rítmico 4 (breve–largo–largo con puntillo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie anapéstico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[1,2,3],"layers":[{"role":"voice","onsets":[0,1,3],"gate":[0.45,0.95,1.4]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"PRO.3/modo_5","name":"Modo rítmico 5 (largo–largo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie espondeo","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[3,3],"layers":[{"role":"voice","onsets":[0,3],"gate":[1.4,1.4]}],"transforms_allowed":["density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"PRO.3/modo_6","name":"Modo rítmico 6 (breve–breve–breve)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie tribraquio","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":3,"step_value":0.5,"meter":"3/8","grouping":[1,1,1],"layers":[{"role":"voice","onsets":[0,1,2],"gate":[0.45,0.45,0.45]}],"transforms_allowed":["density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"}},{"id":"SUP.1.1/poly_3_2","name":"Polirritmia 3:2","taxonomy":["SUP.1.1","SUP.1.4"],"origin":{"tradition":"procedimiento","genre":["polirritmia"],"context":"tres contra dos sobre 6 pulsos","sources":["meta-análisis §2.3 SUP.1"]},"status":"H","verify":false,"step_value":0.333333,"meter":"2/4","generator":{"type":"polyrhythm","ratios":[3,2]},"layers":[],"transforms_allowed":["rotate","density","phase"],"destinations":["ethnic","arpeggio","chords","bassline","others"],"categories":["procedures"],"tags":["polyrhythm"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"SUP.1.2/poly_4_3","name":"Polirritmia 4:3","taxonomy":["SUP.1.2"],"origin":{"tradition":"procedimiento","genre":["polirritmia"],"context":"cuatro contra tres sobre 12 pulsos","sources":["meta-análisis §2.3 SUP.1"]},"status":"H","verify":false,"step_value":0.25,"meter":"3/4","generator":{"type":"polyrhythm","ratios":[4,3]},"layers":[],"transforms_allowed":["rotate","density","phase"],"destinations":["ethnic","arpeggio","chords","bassline","others"],"categories":["procedures"],"tags":["polyrhythm"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"SUP.2.1/polymeter_16_12","name":"Polimetría 16 contra 12","taxonomy":["SUP.2.1","PRO.10"],"origin":{"tradition":"procedimiento","genre":["polimetría"],"context":"capas de 16 y 12 pasos que se realinean a los 48","sources":["meta-análisis §2.3 SUP.2"]},"status":"H","verify":false,"cycle_len":48,"step_value":0.25,"meter":"4/4","layers":[{"role":"layer_a","cycle_len":16,"onsets":[0,4,8,12]},{"role":"layer_b","cycle_len":12,"onsets":[0,3,6,8]}],"transforms_allowed":["rotate","density","phase"],"destinations":["ethnic","arpeggio","chords","bassline","hihats","others"],"categories":["procedures"],"tags":["polymeter"],"repeat_policy":{"mode":"lcm","default_repeats":1,"variation_on_last":"none","max_bars":16}},{"id":"PRO.11/clapping_shift","name":"Desplazamiento discreto (tipo Clapping Music)","taxonomy":["PRO.11","PRO.10"],"origin":{"tradition":"minimalismo (Reich)","genre":["proceso"],"context":"una capa avanza un paso cada N repeticiones","sources":["Reich 2002"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.25,"meter":"3/4","layers":[{"role":"fixed","onsets":[0,1,2,4,5,7,9,10]},{"role":"shifting","onsets":[0,1,2,4,5,7,9,10]}],"params":{"shift_every":4,"shift_layer":1},"transforms_allowed":["density"],"destinations":["ethnic","arpeggio","others"],"categories":["procedures"],"tags":["minimal","phase"],"repeat_policy":{"mode":"cycles","default_repeats":12,"variation_on_last":"none"},"notes":"Figura de 12 pasos de Clapping Music (Reich, 1972), citada como ejemplo del procedimiento."}]},{"file":"reggae_family.json","family":"reggae_family","name":"Reggae, dub y derivados","patterns":[{"id":"RGG.3.1/one_drop","name":"One drop","taxonomy":["RGG.3.1","ACE.2.2","MIC.1.1","GRV.5"],"origin":{"tradition":"Jamaica, roots reggae","genre":["roots reggae"],"context":"batería del roots; Bob Marley and the Wailers","attributions":["Carlton Barrett","Winston Grennan"],"sources":["Wikipedia: One drop rhythm","MusicRadar","Bradford College"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[8]},{"role":"rim","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.5}],"transforms_allowed":["density","swing","phase"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae"],"tags":["reggae","roots","dub","lovers rock"],"bpm_range":[60,90],"corpus":["80_Kick + 80_Snare (Echoes In The Smoke, 80 BPM)","64_Kick + 64_Snare en doble tiempo (Dub Front)"],"params":{"drop_beat":1,"half_time":true},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"}},{"id":"RGG.3.2a/rockers_pedagogico","name":"Rockers (acepción pedagógica)","taxonomy":["RGG.3.2","GRV.6"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"material pedagógico: one drop con bombo añadido en el 1","sources":["Soundbrenner","zZounds Blog"]},"status":"I","verify":true,"verify_notes":"Acepción de divulgación (calidad B); difiere de la histórica de Channel One.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]},{"role":"rim","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.5}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae"],"tags":["reggae","rockers"],"bpm_range":[60,90],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.3.2b/rockers_channel_one","name":"Rockers (Channel One, 1976)","taxonomy":["RGG.3.2","RGG.3.3"],"origin":{"tradition":"Jamaica, Channel One","genre":["rockers"],"context":"Sly Dunbar y The Revolutionaries; reemplazó a los flyers","attributions":["Sly Dunbar"],"sources":["Jamaica Gleaner 2026","Reggae.be"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Posiciones de los golpes dobles de caja por verificar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[],"notes":"golpes dobles: posiciones por verificar"}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["dub_reggae"],"tags":["reggae","rockers","dub"],"bpm_range":[60,90],"bpm_range_verify":true,"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.3.3/steppers","name":"Steppers","taxonomy":["RGG.3.3","GRV.7","COG.2"],"origin":{"tradition":"Jamaica / Reino Unido","genre":["steppers","uk dub"],"context":"bombo en cuatro pulsos dentro de un groove de reggae","attributions":["Sly Dunbar (Channel One)","Jah Shaka (difusión UK)"],"sources":["Soundbrenner","Bass Culture"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"rim","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1}],"transforms_allowed":["density","swing","phase"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae"],"tags":["steppers","dub","uk dub"],"bpm_range":[110,140],"bpm_range_verify":true,"corpus":["Kick_Steppers, Steppers_130BPM (Sub System Dub, 130)","135_Kick (Rebel Skank)","120/140 Drum Rack (Echoes In The Smoke)"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.3.3/steppers_push","name":"Steppers con empuje","taxonomy":["RGG.3.3","ACE.2.3"],"origin":{"tradition":"dub contemporáneo","genre":["steppers"],"context":"corchea o semicorchea añadida antes de un pulso","sources":["corpus: 112_Kick (Echoes In The Smoke)","corpus: 130_Kick 2 (Sub System Dub)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,2,4,8,12]},{"role":"rim","onsets":[8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["dub_reggae"],"tags":["steppers","dub"],"bpm_range":[110,135],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.3.4/half_drop","name":"Half drop / two drop","taxonomy":["RGG.3.4"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"mencionados en un tutorial de producción de dub","sources":["DubRoom (nivel C)"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones exactos no detallados en la fuente.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[]},{"role":"snare","onsets":[]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["dub_reggae"],"tags":["reggae"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.4.1/hat_8ths","name":"Hat en corcheas cerradas","taxonomy":["RGG.4.1","MIC.1.2"],"origin":{"tradition":"Jamaica","genre":["reggae","dub"],"context":"base del one drop","sources":["clasificación RGG §6","corpus: HiHat_8ths, 80_HiHat_2"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,2,4,6,8,10,12,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"}},{"id":"RGG.4.2/hat_8ths_swing","name":"Hat en corcheas con swing","taxonomy":["RGG.4.2","MIC.1.1"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"subdivisión larga–corta; tiende a 1:1 a tempo rápido","sources":["clasificación RGG §6"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.6}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","roots"],"bpm_range":[60,100],"params":{"swing_level":0.5,"tempo_coupling":0.6},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"}},{"id":"RGG.4.2/hat_offbeat","name":"Hat en contratiempo","taxonomy":["RGG.4.2","ACE.2.2","GRV.1"],"origin":{"tradition":"dub, steppers, dub techno","genre":["dub","steppers","dub techno"],"context":"contratiempo de corchea","sources":["corpus: HiHat-Offbeats, 130_Hihat, 112_HiHat_1, Steppers_130BPM"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[2,6,10,14]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae","dub_techno"],"tags":["dub","steppers","dub techno"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.4.3/flying_cymbal","name":"Flying cymbal (flyers)","taxonomy":["RGG.4.3"],"origin":{"tradition":"Jamaica, 1974–75","genre":["reggae"],"context":"hat que alterna abierto y cerrado con siseo continuo; deriva del Philly bump","attributions":["Carlton 'Santa' Davis","Bunny Lee (nombre)"],"sources":["FACT Magazine 2016","Red Bull Music Academy 2013"]},"status":"H","verify":true,"verify_notes":"Origen documentado; rejilla exacta por verificar. Valor inicial: abierto en 2 y 4 según la descripción del informe.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,2,6,8,10,14]},{"role":"hat_open","onsets":[4,12]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","flyers"],"bpm_range":[70,90],"params":{"open_mask":[4,12]},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.4.4/hat_triplet_fill","name":"Relleno de hat en tresillo","taxonomy":["RGG.4.4","MIC.2.6"],"origin":{"tradition":"Jamaica","genre":["reggae","dub"],"context":"tresillo de hat retrasado, recurso del one drop","sources":["clasificación RGG §6","corpus: Hihat_Triplets (Sub System Dub)"]},"status":"I","verify":false,"cycle_len":12,"step_value":0.333333,"meter":"4/4","layers":[{"role":"hat","onsets":[0,3,4,5,6,9]}],"transforms_allowed":["density"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,140],"params":{"laid_back_ms":10},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"Rejilla de tresillo de corchea (12 pasos por compás). El corpus (Hihat_Triplets) lo programa en semicorcheas 4, 5, 6; aquí se ofrece en tresillo como describe RGG.4.4."},{"id":"RGG.4.5/hat_16ths","name":"Hat en semicorcheas digitales","taxonomy":["RGG.4.5"],"origin":{"tradition":"Jamaica, riddims digitales","genre":["dancehall","dub"],"context":"16 pasos con acentos","sources":["clasificación RGG §6","corpus: 64_HiHat_1, 80_HiHat_1"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"velocity":[100,60,85,60,100,60,85,60,100,60,85,60,100,60,85,60]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["dancehall","dub"],"bpm_range":[64,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.4.5/hat_double_offbeat","name":"Doble semicorchea a contratiempo","taxonomy":["RGG.4.5","ACE.2.2"],"origin":{"tradition":"dub contemporáneo","genre":["dub"],"context":"par de semicorcheas en el «y» de cada pulso","sources":["corpus: 135_HiHat (Rebel Skank)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[2,3,6,7,10,11,14,15]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["dub","steppers"],"bpm_range":[120,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.4.1/hat_open_offbeat_13","name":"Hat abierto en el contratiempo de 1 y 3","taxonomy":["RGG.4.1","ACE.2.2"],"origin":{"tradition":"dub contemporáneo","genre":["dub","steppers"],"context":"apertura que respira en la primera mitad de cada pulso fuerte","sources":["corpus: 64_HiHat_Open_1, 137_HiHat_Open, 140 Drum Rack"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat_open","onsets":[2,10]}],"transforms_allowed":["density"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["dub","steppers"],"bpm_range":[64,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"RGG.7/percusion_menor","name":"Percusión menor de dub","taxonomy":["RGG.7"],"origin":{"tradition":"Jamaica / dub","genre":["reggae","dub"],"context":"pocas capas con función clara","sources":["clasificación RGG §9","corpus: Shaker, Tambourine, Woodblock (varios packs)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"shaker","onsets":[2,10]},{"role":"tambourine","onsets":[0,2,4,6,8,10,12,14],"velocity":[70,55,70,55,70,55,70,55]},{"role":"woodblock","onsets":[6]},{"role":"rim","onsets":[8]}],"transforms_allowed":["density","swing"],"destinations":["hihats","ethnic"],"categories":["dub_reggae"],"tags":["dub","reggae"],"bpm_range":[60,140],"params":{"shaker_8ths":false,"tambourine_offbeat":false,"rim_click_3":true},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"dropout"}},{"id":"RGG.6.1/skank_offbeat","name":"Skank en contratiempo","taxonomy":["RGG.6.1","ACE.2.2","GRV.8"],"origin":{"tradition":"Jamaica (ska, reggae)","genre":["ska","reggae","dub"],"context":"acorde corto en el «y» de cada pulso; frecuente en órgano y vientos","sources":["clasificación RGG §8","corpus: Organ Off Skank 135, Organ Skank 137, Horn Skank 64"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,6,10,14],"gate":[0.2,0.2,0.2,0.2]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","ska","dub"],"bpm_range":[60,160],"params":{"skank_mode":"offbeat"},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"RGG.6.2/chop_2_4","name":"Chop en 2 y 4","taxonomy":["RGG.6.2","ACE.2.2"],"origin":{"tradition":"Jamaica","genre":["reggae","dub"],"context":"acorde en el backbeat, guitarra y piano duplicados; el modo dominante en el corpus","sources":["clasificación RGG §8","corpus: Piano/Clav/Guitar Skank en la mayoría de los packs"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[4,12],"gate":[0.25,0.25]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","dub","roots"],"bpm_range":[60,140],"params":{"skank_mode":"backbeat"},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"RGG.6.2/double_skank","name":"Double skank","taxonomy":["RGG.6.2","RGG.6.1"],"origin":{"tradition":"reggae y dub","genre":["reggae","dub"],"context":"chop en 2 y 4 seguido de la corchea siguiente","sources":["corpus: Electric Keys Double Skank 137, DoubleSkank_1 130"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[4,6,12,14],"gate":[0.22,0.18,0.22,0.18],"velocity":[100,80,100,80]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","dub"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"RGG.6.3/bubble","name":"Bubble de órgano","taxonomy":["RGG.6.3"],"origin":{"tradition":"Jamaica, reggae temprano","genre":["reggae"],"context":"mano izquierda en contratiempo con semicorcheas de enmarque; mano derecha en 2 y 4","attributions":["Jenson (Berklee) como fuente pedagógica"],"sources":["Berklee, Bubblin' (Jenson 2015)","corpus: 116_F#m_Organ (Sinister Dub)"]},"status":"C","verify":true,"verify_notes":"La rejilla sale de un único archivo del corpus; contrastar con la transcripción de Jenson.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,4,6,10,12,14],"gate":[0.2,0.2,0.2,0.2,0.2,0.2],"velocity":[80,100,80,80,100,80]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","roots"],"bpm_range":[60,120],"params":{"bubble_on":true,"frame_16ths":true,"bubble_split":true},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"El corpus da una sola línea; el reparto entre mano izquierda (contratiempos) y derecha (2 y 4) se controla con el parámetro bubble_split."},{"id":"RGG.6.4/strum","name":"Strum de semicorchea","taxonomy":["RGG.6.4"],"origin":{"tradition":"Jamaica, reggae temprano","genre":["reggae"],"context":"rasgueo que sustituyó el skank en 2 y 4","sources":["clasificación RGG §8"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrón exacto por verificar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}},{"id":"RGG.5.3/bass_roots_space","name":"Bajo de roots con espacio","taxonomy":["RGG.5.3","RGG.5.4"],"origin":{"tradition":"Jamaica, roots y dub","genre":["roots","dub"],"context":"frase corta con silencios amplios, respuesta en la segunda mitad","sources":["clasificación RGG §7","corpus: 130_Gm_Bass_Line, 135_G_Synth_Bass_Sub, 137_Cm_Sub_Bass"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,8,10,12,14],"gate":[0.9,0.45,0.45,0.45,0.8]}],"transforms_allowed":["density","rotate","swing"],"destinations":["bassline"],"categories":["dub_reggae"],"tags":["roots","dub"],"bpm_range":[60,140],"params":{"bass_space":0.6,"offbeat_bias":0.3,"repeat_len":2,"octave_jump_prob":0.15,"lock_to_kick":false},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"dropout"}},{"id":"RGG.5.4/bass_dub_sub","name":"Sub de dub en 1 y 3","taxonomy":["RGG.5.4"],"origin":{"tradition":"dub","genre":["dub","steppers"],"context":"sub de notas largas","sources":["corpus: 116_F#m_SubBass, 120_Cm_SubBass, 80_Cm_SubBass"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,8],"gate":[1.8,1.8]}],"transforms_allowed":["density"],"destinations":["bassline"],"categories":["dub_reggae"],"tags":["dub","steppers"],"bpm_range":[70,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"dropout"}},{"id":"RGG.10.3/dubstep_halftime","name":"Dubstep (medio tiempo)","taxonomy":["RGG.10.3","FOR.3","GRV.3"],"origin":{"tradition":"Reino Unido","genre":["dubstep"],"context":"caja en el 3 a 140 BPM","attributions":["Kode9 (observación perceptiva)"],"sources":["Modern Drummer","Musical-U"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0]},{"role":"snare","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.3}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae","electronic"],"tags":["dubstep"],"bpm_range":[132,142],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.10.3/half_step","name":"Half-step de dub","taxonomy":["RGG.10.3","GRV.3"],"origin":{"tradition":"dub contemporáneo","genre":["dub","half-step"],"context":"bombo sincopado en la primera mitad, caja en el 3","sources":["corpus: Kick_Halfstep, Half_Step_130BPM (Sub System Dub)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,2,6]},{"role":"snare","onsets":[8]},{"role":"hat","onsets":[0,4,5,6,8,12]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats"],"categories":["dub_reggae"],"tags":["dub","half-step"],"bpm_range":[125,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.10.4/dembow","name":"Dembow","taxonomy":["RGG.10.4","CIC.6.1","CIC.3.1","RGG.9.2"],"origin":{"tradition":"Jamaica → Panamá → Puerto Rico","genre":["dancehall","reggaetón"],"context":"Poco Man Jam (1989), Dem Bow (1990)","attributions":["Steely & Clevie","Bobby Digital","Dennis 'the Menace' Thompson"],"sources":["Berklee, What Is Dembow?","Wayne & Wax"]},"status":"I","verify":true,"verify_notes":"Posiciones de caja divergentes entre fuentes.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[3,6,11,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic","others"],"categories":["dub_reggae","latin_percussion"],"tags":["reggaeton","dancehall","dembow"],"bpm_range":[85,100],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"RGG.1.1/nyabinghi_roles","name":"Nyabinghi (principio de tres roles)","taxonomy":["RGG.1.1","SUP.1"],"origin":{"tradition":"Rastafari, Jamaica","genre":["nyabinghi"],"context":"música ceremonial; precursora del ska y el reggae a través de Count Ossie","sources":["All Around This World","clasificación RGG §3"],"restricted_use":true},"status":"H","verify":true,"restricted_use":true,"structural_only":true,"cultural_note":"Repertorio religioso rastafari. El dispositivo usa solo el principio de tres roles (base, pulso, improvisación) y no ofrece toques ceremoniales como preset.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"base","onsets":[0,8],"timbre":[2,3]},{"role":"pulse","onsets":[0,4,8,12],"timbre":[1,1,1,1]},{"role":"improvising","onsets":[4,12],"timbre":[1,1]}],"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["dub_reggae"],"tags":["ritual"],"params":{"thunder_syncopation_prob":0.15,"repeater_density":0.4,"repeater_accent_beats":[2,4]},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"}}]},{"file":"sesquialtera.json","family":"sesquialtera","name":"Hemiola y sesquiáltera","notes":"Principios de SUP.3 con presets por género (CIC.8). Los patrones de bombo legüero y rasgueo por género están marcados como faltantes (§7 del informe).","patterns":[{"id":"SUP.3.1/hemiola_sucesiva","name":"Hemiola sucesiva (6/8 → 3/4)","taxonomy":["SUP.3.1","MET.2.4"],"origin":{"tradition":"Europa, Iberoamérica","genre":["hemiola"],"context":"compás A en 6/8 y compás B en 3/4","sources":["meta-análisis §2.3 SUP.3"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"6/8","layers":[{"role":"beat","onsets":[0,3,6,8,10],"velocity":[120,95,115,95,95]}],"params":{"mode":"sucesiva","alternation_pattern":"AB"},"transforms_allowed":["density","rotate"],"destinations":["ethnic","bassline","chords","arpeggio","others"],"categories":["world_cycles"],"tags":["sesquialtera","6/8"],"bpm_range":[60,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"SUP.3.2/birritmia","name":"Birritmia simultánea (6/8 sobre 3/4)","taxonomy":["SUP.3.2","SUP.1.1"],"origin":{"tradition":"Sudamérica","genre":["zamba","chacarera","joropo","son jarocho"],"context":"melodía en 6/8 sobre bombo en 3/4","sources":["meta-análisis §2.3 SUP.3.2"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"six_eight","onsets":[0,3]},{"role":"three_four","onsets":[0,2,4]}],"params":{"mode":"simultanea"},"transforms_allowed":["density","rotate"],"destinations":["ethnic","bassline","chords","arpeggio","others"],"categories":["world_cycles"],"tags":["sesquialtera","6/8","folclore"],"bpm_range":[60,180],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"CIC.8/cueca","name":"Cueca chilena (principio)","taxonomy":["CIC.8","SUP.3"],"origin":{"tradition":"Chile","genre":["cueca"],"context":"seis corcheas en 2×3 o 3×2 con fórmulas limitadas (Vega)","sources":["Vega, La forma de la cueca chilena","Spencer Espinosa 2021"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrones de rasgueo y de bombo por verificar; se carga el principio de alternancia.","cycle_len":12,"step_value":0.5,"meter":"6/8","layers":[{"role":"beat","onsets":[0,3,6,8,10]}],"params":{"mode":"sucesiva","alternation_pattern":"AB"},"transforms_allowed":["density","rotate"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles","latin_percussion"],"tags":["cueca","chile","folclore"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"}},{"id":"CIC.8/tonada","name":"Tonada chilena (principio)","taxonomy":["CIC.8","SUP.3"],"origin":{"tradition":"Chile","genre":["tonada"],"context":"fluctuación entre 6/8 y 3/4","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Rasgueo por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"six_eight","onsets":[0,3]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["chords","ethnic","others"],"categories":["world_cycles"],"tags":["tonada","chile","folclore"],"bpm_range":[70,120],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"CIC.8/zamba","name":"Zamba (principio)","taxonomy":["CIC.8","SUP.3.2"],"origin":{"tradition":"Argentina","genre":["zamba"],"context":"birritmia con bombo legüero","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrón de bombo legüero por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"bombo","onsets":[]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles","latin_percussion"],"tags":["zamba","argentina","folclore"],"bpm_range":[60,100],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"CIC.8/chacarera","name":"Chacarera (principio)","taxonomy":["CIC.8","SUP.3.2"],"origin":{"tradition":"Argentina","genre":["chacarera"],"context":"birritmia con bombo legüero","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrón de bombo legüero por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"bombo","onsets":[]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles","latin_percussion"],"tags":["chacarera","argentina","folclore"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}},{"id":"CIC.8/joropo","name":"Joropo (principio)","taxonomy":["CIC.8","SUP.3.2"],"origin":{"tradition":"Venezuela y Colombia (llanos)","genre":["joropo"],"context":"birritmia con reparto por instrumento","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrones por instrumento por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"six_eight","onsets":[0,3]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["ethnic","chords","others"],"categories":["world_cycles","latin_percussion"],"tags":["joropo","folclore"],"bpm_range":[150,220],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"}}]},{"file":"tala.json","family":"tala","name":"Tala indostánica y carnática","notes":"Los talas indostánicos marcan sam (timbre 0, acento máximo), tali (timbre 0) y khali (timbre 1), como propone el informe (CIC.4.1). Un matra = una negra por defecto; la laya cambia el tempo sin tocar la densidad (FOR.3). Los talas carnáticos se generan con tala(family, jati, gati) (CIC.4.2, §4.4).","patterns":[{"id":"CIC.4.1/teental","name":"Teental (16)","taxonomy":["CIC.4.1","PRO.16","MET.2.3"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal","kathak","tabla solo"],"context":"el tala más usado del repertorio indostánico","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":16,"step_value":1,"meter":"16/4","grouping":[4,4,4,4],"layers":[{"role":"clap","onsets":[0,4,8,12],"timbre":[0,0,1,0],"velocity":[127,100,80,100]},{"role":"matra","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"timbre":[0,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1],"velocity":[100,60,60,60,80,60,60,60,60,60,60,60,80,60,60,60]}],"params":{"sam":0,"tali":[0,4,12],"khali":[8],"laya":"madhya"},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[40,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}},{"id":"CIC.4.1/jhaptal","name":"Jhaptal (10)","taxonomy":["CIC.4.1","MET.3.2"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal"],"context":"tala de 10 matras en 2+3+2+3","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":10,"step_value":1,"meter":"10/4","grouping":[2,3,2,3],"layers":[{"role":"clap","onsets":[0,2,5,7],"timbre":[0,0,1,0],"velocity":[127,100,80,100]}],"params":{"sam":0,"tali":[0,2,7],"khali":[5]},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[40,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}},{"id":"CIC.4.1/rupak","name":"Rupak (7)","taxonomy":["CIC.4.1","MET.3.2"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal","bhajan"],"context":"el sam coincide con el khali","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":7,"step_value":1,"meter":"7/4","grouping":[3,2,2],"layers":[{"role":"clap","onsets":[0,3,5],"timbre":[1,0,0],"velocity":[110,100,100]}],"params":{"sam":0,"tali":[3,5],"khali":[0]},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[40,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}},{"id":"CIC.4.1/ektal","name":"Ektal (12)","taxonomy":["CIC.4.1","MET.2.2"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal","dhrupad"],"context":"tala de 12 matras en seis vibhag de 2","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":12,"step_value":1,"meter":"12/4","grouping":[2,2,2,2,2,2],"layers":[{"role":"clap","onsets":[0,2,4,6,8,10],"timbre":[0,1,0,1,0,0],"velocity":[127,80,100,80,100,100]}],"params":{"sam":0,"tali":[0,4,8,10],"khali":[2,6]},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[20,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}},{"id":"CIC.4.2/adi_tala","name":"Adi tala (triputa chatusra, chatusra nadai)","taxonomy":["CIC.4.2","MET.3.1"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti","varnam"],"context":"el tala más común del repertorio carnático","sources":["meta-análisis §2.5 CIC.4.2","karnatik.com"]},"status":"H","verify":false,"step_value":0.25,"meter":"8/4","generator":{"type":"carnatic_tala","family":"triputa","jati":"chatusra","gati":4},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"notes":"32 matras (§4.4)."},{"id":"CIC.4.2/rupaka_chatusra","name":"Rupaka tala (chatusra jati)","taxonomy":["CIC.4.2"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti"],"context":"drutam + laghu","sources":["meta-análisis §2.5 CIC.4.2"]},"status":"H","verify":false,"step_value":0.25,"meter":"6/4","generator":{"type":"carnatic_tala","family":"rupaka","jati":"chatusra","gati":4},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}},{"id":"CIC.4.2/khanda_matya","name":"Khanda jati matya (48 matras)","taxonomy":["CIC.4.2","MET.3.2"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti"],"context":"ejemplo del informe: 12 unidades × chatusra gati","sources":["meta-análisis §2.5 CIC.4.2"]},"status":"H","verify":false,"step_value":0.25,"meter":"12/4","generator":{"type":"carnatic_tala","family":"matya","jati":"khanda","gati":4},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}},{"id":"CIC.4.2/misra_jhampa","name":"Misra jati jhampa (10 unidades)","taxonomy":["CIC.4.2","MET.3.2"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti"],"context":"laghu de 7 + anudrutam + drutam","sources":["meta-análisis §2.5 CIC.4.2"]},"status":"H","verify":false,"step_value":0.5,"meter":"10/4","generator":{"type":"carnatic_tala","family":"jhampa","jati":"misra","gati":2},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"}}]}],"patterns":[{"id":"CIC.6.1/dembow_cic","name":"Dembow (grilla CIC)","taxonomy":["CIC.6.1","CIC.3.1","RGG.10.4"],"origin":{"tradition":"Jamaica → Panamá → Puerto Rico","genre":["reggaetón"],"context":"bombo constante y caja sincopada","sources":["meta-análisis §2.5 CIC.6.1"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[3,6,11,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic","bassline","others"],"categories":["latin_percussion"],"tags":["reggaeton","dembow"],"bpm_range":[85,100],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Véase RGG.10.4/dembow para la divergencia entre fuentes.","family":"afro_latin"},{"id":"CIC.6.2/samba_surdo","name":"Samba: surdo","taxonomy":["CIC.6.2","MIC.2.1"],"origin":{"tradition":"Brasil (Río de Janeiro)","genre":["samba"],"context":"surdo con acento en el pulso 2 de 2/4","sources":["meta-análisis §2.5 CIC.6.2"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"surdo","onsets":[0,4],"velocity":[85,127],"timbre":[3,2]}],"params":{"microtiming_template":"samba"},"transforms_allowed":["density"],"destinations":["ethnic","bassline","others"],"categories":["latin_percussion"],"tags":["samba","brasil"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"virada"},"notes":"Golpe apagado en el 1 y abierto en el 2 como propuesta de timbre; el acento en el 2 es el dato documentado.","family":"afro_latin"},{"id":"CIC.6.2/samba_tamborim","name":"Samba: tamborim y partido alto","taxonomy":["CIC.6.2"],"origin":{"tradition":"Brasil","genre":["samba"],"context":"tamborim y partido alto","sources":["meta-análisis §7"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones de tamborim y partido alto faltantes en el informe.","cycle_len":16,"step_value":0.25,"meter":"2/4","layers":[{"role":"tamborim","onsets":[]}],"transforms_allowed":["density"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["samba"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"virada"},"family":"afro_latin"},{"id":"CIC.6.3/maracatu","name":"Maracatu de baque virado","taxonomy":["CIC.6.3","PRO.17","MIC.2.7"],"origin":{"tradition":"Pernambuco, Brasil","genre":["maracatu nação"],"context":"toques martelo, luanda, arrastão y baque parado; el gonguê cumple función de clave; viradas","sources":["ANPPOM 2025","Sambapedia"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones de toques por verificar (§7 del informe).","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"alfaia_grave","onsets":[]},{"role":"gongue_grave","onsets":[]},{"role":"caixa","onsets":[]},{"role":"tarol","onsets":[]},{"role":"mineiro","onsets":[]},{"role":"abe","onsets":[]}],"params":{"drum_map":"maracatu"},"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["maracatu","brasil"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"virada"},"family":"afro_latin"},{"id":"CIC.6.4/candombe","name":"Candombe","taxonomy":["CIC.6.4"],"origin":{"tradition":"Uruguay (afrouruguaya)","genre":["candombe"],"context":"tres tambores (chico, repique, piano) y madera en el casco","sources":["meta-análisis §2.5 CIC.6.4"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones por tambor por verificar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chico_abierto","onsets":[]},{"role":"repique_abierto","onsets":[]},{"role":"piano_abierto","onsets":[]},{"role":"madera","onsets":[]}],"params":{"drum_map":"candombe"},"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["candombe","uruguay"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"afro_latin"},{"id":"CIC.6.5/cumbia","name":"Cumbia","taxonomy":["CIC.6.5","ACE.2.2"],"origin":{"tradition":"Colombia (costa caribe)","genre":["cumbia"],"context":"llamador en contratiempo, alegre improvisando, guacharaca en corcheas","sources":["meta-análisis §2.5 CIC.6.5"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"llamador","onsets":[2,6]},{"role":"guacharaca","onsets":[0,2,4,6]}],"params":{"alegre_improv":true},"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["latin_percussion"],"tags":["cumbia","colombia"],"bpm_range":[80,110],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"notes":"El alegre improvisa: el generador lo trata como capa probabilística.","family":"afro_latin"},{"id":"CIC.6.6/festejo","name":"Festejo y landó","taxonomy":["CIC.6.6","MET.2.4"],"origin":{"tradition":"Perú (afroperuana)","genre":["festejo","landó"],"context":"6/8 y 12/8 con cajón","sources":["meta-análisis §2.5 CIC.6.6"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones de cajón por verificar.","cycle_len":12,"step_value":0.5,"meter":"12/8","layers":[{"role":"cajon_grave","onsets":[]},{"role":"cajon_agudo","onsets":[]}],"params":{"drum_map":"cajon_flamenco"},"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["peru","festejo"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"afro_latin"},{"id":"CIC.6.7/huayno","name":"Huayno","taxonomy":["CIC.6.7"],"origin":{"tradition":"Andes (Perú, Bolivia)","genre":["huayno"],"context":"2/4 con célula corchea y dos semicorcheas","sources":["meta-análisis §2.5 CIC.6.7"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"cell","onsets":[0,2,3,4,6,7]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","bassline","chords","arpeggio","others"],"categories":["latin_percussion","world_cycles"],"tags":["huayno","andes"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"afro_latin"},{"id":"MET.3.3/aksak_5_23","name":"Aksak 5/8 (2+3)","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"Balcanes, Anatolia y otras","genre":["aksak"],"context":"unidad breve y larga en proporción 2:3","sources":["Brăiloiu 1951/52"]},"status":"H","verify":false,"cycle_len":5,"step_value":0.5,"meter":"5/8","grouping":[2,3],"layers":[{"role":"group","onsets":[0,2],"velocity":[120,95]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","5/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"aksak_additive"},{"id":"MET.3.3/aksak_7_223","name":"Aksak 7/8 (2+2+3)","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"Balcanes, Anatolia","genre":["aksak"],"context":"7/8 con el grupo largo al final","sources":["Brăiloiu 1951/52","meta-análisis §4.3"]},"status":"H","verify":false,"cycle_len":7,"step_value":0.5,"meter":"7/8","grouping":[2,2,3],"layers":[{"role":"group","onsets":[0,2,4],"velocity":[120,95,100]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","7/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"aksak_additive"},{"id":"MET.3.3/aksak_7_322","name":"Aksak 7/8 (3+2+2)","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"Balcanes, Anatolia","genre":["aksak"],"context":"7/8 con el grupo largo al inicio (como el rupak)","sources":["Brăiloiu 1951/52","meta-análisis §4.3"]},"status":"H","verify":false,"cycle_len":7,"step_value":0.5,"meter":"7/8","grouping":[3,2,2],"layers":[{"role":"group","onsets":[0,3,5],"velocity":[120,95,100]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","7/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"aksak_additive"},{"id":"MET.3.3/aksak_9_2223","name":"Aksak 9/8 (2+2+2+3)","taxonomy":["MET.3.3","CIC.4.4"],"origin":{"tradition":"Turquía, Balcanes","genre":["aksak","karşılama"],"context":"el aksak por antonomasia","sources":["Brăiloiu 1951/52","meta-análisis §2.5 CIC.4.4"]},"status":"H","verify":false,"cycle_len":9,"step_value":0.5,"meter":"9/8","grouping":[2,2,2,3],"layers":[{"role":"group","onsets":[0,2,4,6],"velocity":[120,90,95,105]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","9/8","balkan","turkish"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"aksak_additive"},{"id":"MET.3.3/aksak_11_22322","name":"Aksak 11/8 (2+2+3+2+2)","taxonomy":["MET.3.3","MET.3.4"],"origin":{"tradition":"Balcanes","genre":["aksak"],"context":"composición de 11 en 2 y 3 con el largo central","sources":["Brăiloiu 1951/52"]},"status":"H","verify":false,"cycle_len":11,"step_value":0.5,"meter":"11/8","grouping":[2,2,3,2,2],"layers":[{"role":"group","onsets":[0,2,4,7,9],"velocity":[120,90,105,90,95]}],"transforms_allowed":["rotate","reverse","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["aksak","11/8","balkan"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"aksak_additive"},{"id":"MET.3.1/amalgama_5_4","name":"Amalgama 5/4 (3/4 + 2/4)","taxonomy":["MET.3.1"],"origin":{"tradition":"teoría hispana del solfeo","genre":["5/4"],"context":"suma de compases que conservan sus acentos","sources":["meta-análisis §2.1 MET.3.1"]},"status":"H","verify":false,"cycle_len":5,"step_value":1,"meter":"5/4","grouping":[3,2],"layers":[{"role":"beat","onsets":[0,1,2,3,4],"velocity":[120,70,70,100,70]}],"transforms_allowed":["rotate","density"],"destinations":["ethnic","bassline","arpeggio","chords","others"],"categories":["world_cycles"],"tags":["5/4"],"bpm_range":[60,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"aksak_additive"},{"id":"CIC.3.1/tresillo","name":"Tresillo (3+3+2)","taxonomy":["CIC.3.1","PRO.1","SUP.1.3"],"origin":{"tradition":"Caribe afrocubano y afroamericano","genre":["son","habanera","rhythm and blues"],"context":"célula base de la familia de la clave","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","grouping":[3,3,2],"layers":[{"role":"timeline","onsets":[0,3,6]}],"transforms_allowed":["rotate","reverse","complement","density","swing","phase","binarize"],"destinations":["bassline","chords","arpeggio","ethnic","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","reggaeton","afro"],"bpm_range":[80,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Equivale a una rotación de E(3,8).","family":"clave_tresillo"},{"id":"CIC.3.2/habanera","name":"Habanera","taxonomy":["CIC.3.2","CIC.3.1"],"origin":{"tradition":"Cuba","genre":["habanera","danzón","tango"],"context":"danza de salón del siglo XIX","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"2/4","grouping":[3,1,2,2],"layers":[{"role":"timeline","onsets":[0,3,4,6]}],"transforms_allowed":["rotate","reverse","complement","density","swing"],"destinations":["bassline","chords","arpeggio","ethnic","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","tango"],"bpm_range":[70,120],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"clave_tresillo"},{"id":"CIC.3.3/cinquillo","name":"Cinquillo","taxonomy":["CIC.3.3","PRO.1"],"origin":{"tradition":"Cuba / Caribe","genre":["danzón","merengue","tumba francesa"],"context":"timeline del danzón","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"2/4","grouping":[2,1,2,1,2],"layers":[{"role":"timeline","onsets":[0,2,3,5,6]}],"transforms_allowed":["rotate","reverse","complement","density","swing","binarize"],"destinations":["bassline","chords","arpeggio","ethnic","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","afro"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rotación de E(5,8).","family":"clave_tresillo"},{"id":"CIC.3.4/son_clave_3_2","name":"Son clave 3-2","taxonomy":["CIC.3.4","SUP.1.3","ACE.2.1","PRO.1"],"origin":{"tradition":"Cuba / Caribe afrocubano","genre":["son","salsa"],"context":"baile social, regulación de arreglos","sources":["Toussaint 2013","Pérez Fernández 1987"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[3,3,4,2,4],"layers":[{"role":"timeline","onsets":[0,3,6,10,12],"velocity":[110,90,100,100,110],"gate":[0.5,0.5,0.5,0.5,0.5]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","salsa","son"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"La rotación de 8 pasos produce la clave 2-3.","family":"clave_tresillo"},{"id":"CIC.3.7/son_clave_2_3","name":"Son clave 2-3","taxonomy":["CIC.3.7","CIC.3.4","PRO.14"],"origin":{"tradition":"Cuba / Caribe afrocubano","genre":["son","salsa"],"context":"la dirección de la clave sigue la frase del arreglo","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[2,4,3,3,4],"layers":[{"role":"timeline","onsets":[2,4,8,11,14]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","salsa","son"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rotación de 8 pasos de la son clave 3-2.","family":"clave_tresillo"},{"id":"CIC.3.5/rumba_clave_3_2","name":"Rumba clave 3-2","taxonomy":["CIC.3.5","SUP.1.3","ACE.2.1"],"origin":{"tradition":"Cuba (rumba)","genre":["rumba","guaguancó"],"context":"rumba urbana","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[3,4,3,2,4],"layers":[{"role":"timeline","onsets":[0,3,7,10,12]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","rumba"],"bpm_range":[90,200],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"clave_tresillo"},{"id":"CIC.3.6/bossa_clave","name":"Bossa clave","taxonomy":["CIC.3.6","PRO.1"],"origin":{"tradition":"Brasil","genre":["bossa nova"],"context":"patrón del aro en la bossa nova","sources":["Toussaint 2013"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","grouping":[3,3,4,3,3],"layers":[{"role":"timeline","onsets":[0,3,6,10,13]}],"transforms_allowed":["rotate","reverse","density","swing","phase"],"destinations":["bassline","chords","arpeggio","ethnic","hihats","others"],"categories":["latin_percussion","world_cycles"],"tags":["latin","bossa","jazz"],"bpm_range":[110,150],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rotación de E(5,16).","family":"clave_tresillo"},{"id":"CIC.2.1/standard_pattern","name":"Standard pattern (12 pulsos)","taxonomy":["CIC.2.1","PRO.1","SUP.1.3","MET.2.4"],"origin":{"tradition":"África occidental (ewe, yoruba)","genre":["agbadza","música de danza"],"context":"patrón de campana que guía la danza","sources":["Agawu 2006","Toussaint 2013"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.333333,"meter":"12/8","grouping":[2,2,1,2,2,2,1],"layers":[{"role":"bell","onsets":[0,2,4,5,7,9,11]}],"transforms_allowed":["rotate","reverse","complement","density","phase","binarize"],"destinations":["ethnic","hihats","arpeggio","others"],"categories":["world_cycles"],"tags":["afro","12/8"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Perfil durativo ⟨2212221⟩; rotación de E(7,12). La transformación binarize lo convierte a 16 pasos (hipótesis de Pérez Fernández).","family":"clave_tresillo"},{"id":"CIC.5/lancaran","name":"Lancaran (16 pulsos)","taxonomy":["CIC.5","FOR.2.3","MET.2.5"],"origin":{"tradition":"Java (gamelan)","genre":["gendhing lancaran"],"context":"forma colotómica corta; el gong cierra el ciclo","sources":["Sumarsam (Wesleyan)","Wikipedia: Irama"]},"status":"I","verify":true,"verify_notes":"Convención estándar; variantes regionales por verificar.","cycle_len":16,"step_value":0.5,"meter":"16/8","layers":[{"role":"ketuk","onsets":[0,2,4,6,8,10,12,14]},{"role":"kenong","onsets":[3,7,11,15]},{"role":"kempul","onsets":[5,9,13]},{"role":"gong","onsets":[15],"velocity":[127]}],"params":{"irama":0,"laya":"sedeng","elaboration":true},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["gamelan","java"],"bpm_range":[60,160],"repeat_policy":{"mode":"gongan","default_repeats":2,"variation_on_last":"gong"},"family":"colotomy"},{"id":"CIC.5/ketawang","name":"Ketawang (16 pulsos)","taxonomy":["CIC.5"],"origin":{"tradition":"Java (gamelan)","genre":["gendhing ketawang"],"context":"ciclo de 16 con distribución propia","sources":["meta-análisis §2.5 CIC.5"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Distribución de kenong, kempul y ketuk por verificar; solo se fija el gong final.","cycle_len":16,"step_value":0.5,"meter":"16/8","layers":[{"role":"gong","onsets":[15],"velocity":[127]},{"role":"kenong","onsets":[]},{"role":"kempul","onsets":[]},{"role":"ketuk","onsets":[]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["gamelan","java"],"repeat_policy":{"mode":"gongan","default_repeats":2,"variation_on_last":"gong"},"family":"colotomy"},{"id":"CIC.5/ladrang","name":"Ladrang (32 pulsos)","taxonomy":["CIC.5"],"origin":{"tradition":"Java (gamelan)","genre":["gendhing ladrang"],"context":"ciclo de 32 con distribución propia","sources":["meta-análisis §2.5 CIC.5"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Distribución colotómica por verificar; solo se fija el gong final.","cycle_len":32,"step_value":0.5,"meter":"32/8","layers":[{"role":"gong","onsets":[31],"velocity":[127]},{"role":"kenong","onsets":[]},{"role":"kempul","onsets":[]},{"role":"ketuk","onsets":[]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["gamelan","java"],"repeat_policy":{"mode":"gongan","default_repeats":1,"variation_on_last":"gong"},"family":"colotomy"},{"id":"RGG.10.2/dub_techno_base","name":"Dub techno (base)","taxonomy":["RGG.10.2","GRV.14","PRO.19"],"origin":{"tradition":"Berlín, 1993","genre":["dub techno"],"context":"Basic Channel, Chain Reaction, Rhythm & Sound","attributions":["Moritz von Oswald","Mark Ernestus"],"sources":["Resident Advisor","Attack Magazine"]},"status":"H","verify":true,"verify_notes":"Posiciones del stab [2,10] propuestas por el informe; el corpus muestra más variedad (véanse los patrones [C] de esta familia).","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"hat","onsets":[2,6,10,14]},{"role":"chord","onsets":[2,10],"gate":[0.15,0.15]}],"fx":{"delay_ratio":"1/8.","feedback":0.55},"transforms_allowed":["rotate","density","swing","phase"],"destinations":["chords","hihats","ethnic"],"categories":["dub_techno"],"tags":["dub techno","techno","minimal"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/stab_1_7_15","name":"Stab: 1, «y» del 2, «y» del 4","taxonomy":["RGG.10.2","ACE.2.2"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"patrón más frecuente del corpus","sources":["corpus DDT: Chord_09, 16, 42"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,6,14],"gate":[0.5,0.5,0.5],"velocity":[96,80,84]}],"fx":{"delay_ratio":"1/8.","feedback":0.5},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/stab_1_11","name":"Stab: 1 y «y» del 3","taxonomy":["RGG.10.2"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"dos stabs por compás, máximo espacio","sources":["corpus DDT: Chord_10"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,10],"gate":[0.5,0.5]}],"fx":{"delay_ratio":"1/8.","feedback":0.6},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno","minimal"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/stab_1_6_11","name":"Stab: 1, 6, 11 (3+5+…)","taxonomy":["RGG.10.2","ACE.2.4"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"stab desplazado por semicorchea","sources":["corpus DDT: Em_26, Dm_21"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,5,10],"gate":[0.5,0.5,0.5],"velocity":[96,82,86]}],"fx":{"delay_ratio":"1/8.","feedback":0.5},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/stab_dense","name":"Stab denso (seis ataques)","taxonomy":["RGG.10.2","ACE.2.4"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"variante densa con acento tras el pulso 3","sources":["corpus DDT: Chord_01"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,3,6,9,12,15],"gate":[0.45,0.45,0.45,0.45,0.45,0.45],"velocity":[90,76,82,104,84,74]}],"fx":{"delay_ratio":"1/8.","feedback":0.45},"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/stab_8ths","name":"Stab en corcheas continuas","taxonomy":["RGG.10.2","CIC.1"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"corriente de corcheas con variación de filtro y velocity","sources":["corpus DDT: Chord_19"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[0,2,4,6,8,10,12,14],"gate":[0.4,0.4,0.4,0.4,0.4,0.4,0.4,0.4]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/pad_colchon","name":"Colchón de acorde","taxonomy":["RGG.10.2","ACE.1.6"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"acorde largo en canal aparte como colchón","sources":["Attack Magazine (tutorial)","corpus DDT: Chord_02, 31, 38"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"pad","onsets":[0],"gate":[4]}],"transforms_allowed":[],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno","ambient"],"bpm_range":[100,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"gate en negras: 4 = un compás entero de 4/4.","family":"dub_techno"},{"id":"RGG.10.2/stab_weighted","name":"Stab generativo (pesos del corpus)","taxonomy":["RGG.10.2","PRO.15","COG.3.3"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"rejilla generada con probabilidades por paso derivadas del histograma de 51 clips","sources":["corpus DDT Chords (histograma §1)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","generator":{"type":"weighted_steps","step_weights":[41,5,13,9,7,12,14,9,17,7,15,10,12,9,18,2],"hits_range":[2,5],"force_first":0.8,"gate_range":[0.33,0.85]},"layers":[],"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["dub_techno"],"tags":["dub techno"],"bpm_range":[115,128],"params":{"swing_template":"swing_16_62","chord":"triad_I_root"},"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/bass_offbeat","name":"Bajo de dub techno en contratiempo","taxonomy":["RGG.10.2","ACE.2.2","RGG.5.4"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"bajo en el «y» de cada pulso","sources":["corpus DDT: Bass_23, Bonus A_120_04"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[2,6,10,14],"gate":[0.6,0.6,0.6,0.6]}],"transforms_allowed":["density","swing","rotate"],"destinations":["bassline"],"categories":["dub_techno"],"tags":["dub techno","techno"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"RGG.10.2/bass_swung_16","name":"Bajo de semicorcheas con swing","taxonomy":["RGG.10.2","MIC.1.1","CIC.1.1"],"origin":{"tradition":"dub techno","genre":["dub techno"],"context":"línea de semicorcheas con impares retrasadas un cuarto de paso (≈ 62 %)","sources":["corpus DDT: Bass_38_Bb (§2–3)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,1,3,5,7,9,11],"microtiming":[0,0.25,0.25,0.25,0.25,0.25,0.25],"gate":[0.4,0.4,0.4,0.4,0.4,0.4,1.6]}],"transforms_allowed":["density","rotate"],"destinations":["bassline"],"categories":["dub_techno"],"tags":["dub techno","deep"],"bpm_range":[115,128],"params":{"swing_template":"swing_16_62"},"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"dub_techno"},{"id":"CIC.7/solea","name":"Soleá","taxonomy":["CIC.7","MET.3.2","SUP.3.1"],"origin":{"tradition":"Andalucía (flamenco)","genre":["soleá"],"context":"compás lento de base","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[3,3,2,2,2],"layers":[{"role":"palmas","onsets":[0,1,2,3,4,5,6,7,8,9,10,11],"velocity":[60,60,120,60,60,120,60,120,60,120,60,120],"timbre":[3,3,2,3,3,2,3,2,3,2,3,2]},{"role":"accent","onsets":[2,5,7,9,11]}],"params":{"start_offset":0},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[60,120],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"},"family":"flamenco"},{"id":"CIC.7/alegrias","name":"Alegrías y cantiñas","taxonomy":["CIC.7"],"origin":{"tradition":"Andalucía (flamenco, Cádiz)","genre":["alegrías","cantiñas"],"context":"misma acentuación que la soleá, tempo más vivo","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[3,3,2,2,2],"layers":[{"role":"accent","onsets":[2,5,7,9,11]},{"role":"palmas","onsets":[0,1,3,4,6,8,10],"velocity":[60,60,60,60,60,60,60],"timbre":[3,3,3,3,3,3,3]}],"params":{"start_offset":0},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[100,170],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"},"family":"flamenco"},{"id":"CIC.7/buleria","name":"Bulería (base)","taxonomy":["CIC.7","SUP.3"],"origin":{"tradition":"Andalucía (flamenco, Jerez)","genre":["bulería"],"context":"rápida y variable; medios compases de 6","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[3,3,2,2,2],"layers":[{"role":"accent","onsets":[2,5,7,9,11]}],"params":{"start_offset":0,"half_compas":true},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[180,260],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"},"notes":"Acentuación de base; la variación propia de la bulería la añade el generador con medios compases.","family":"flamenco"},{"id":"CIC.7/seguiriya","name":"Seguiriya","taxonomy":["CIC.7","PRO.14","MET.3.4"],"origin":{"tradition":"Andalucía (flamenco)","genre":["seguiriya"],"context":"el mismo ciclo empezando en el 8, sentido como 2+2+3+3+2","sources":["meta-análisis §2.5 CIC.7"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"12/8","grouping":[2,2,3,3,2],"layers":[{"role":"accent","onsets":[0,2,4,7,10]}],"params":{"start_offset":7},"transforms_allowed":["rotate","density"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles"],"tags":["flamenco"],"bpm_range":[50,100],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"llamada"},"family":"flamenco"},{"id":"GRV.1/four_on_the_floor","name":"Four-on-the-floor","taxonomy":["GRV.1","MET.2.3","COG.2"],"origin":{"tradition":"disco, house, techno","genre":["disco","house","techno"],"context":"música de baile","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"hat_open","onsets":[2,6,10,14]}],"transforms_allowed":["rotate","density","swing","phase"],"destinations":["ethnic","hihats","bassline","chords","others"],"categories":["electronic"],"tags":["house","techno","disco"],"bpm_range":[115,135],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"grooves_electronic"},{"id":"GRV.2/backbeat","name":"Backbeat","taxonomy":["GRV.2","ACE.2.2"],"origin":{"tradition":"rhythm and blues, rock, pop","genre":["rock","pop","funk"],"context":"caja en 2 y 4","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]},{"role":"snare","onsets":[4,12]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic","hihats","chords","others"],"categories":["electronic"],"tags":["rock","pop","funk","hiphop"],"bpm_range":[70,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"grooves_electronic"},{"id":"GRV.3/half_time","name":"Half-time","taxonomy":["GRV.3","FOR.3"],"origin":{"tradition":"música popular","genre":["dubstep","trap","rock"],"context":"caja en el pulso 3","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0]},{"role":"snare","onsets":[8]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["dubstep","trap"],"bpm_range":[130,150],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"grooves_electronic"},{"id":"GRV.4/shuffle","name":"Shuffle (tresillos)","taxonomy":["GRV.4","MIC.1.1"],"origin":{"tradition":"blues, jazz, rhythm and blues","genre":["blues","shuffle"],"context":"rejilla de 12 en tresillos","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.333333,"meter":"12/8","layers":[{"role":"hat","onsets":[0,2,3,5,6,8,9,11]}],"transforms_allowed":["rotate","density"],"destinations":["hihats","ethnic","bassline","chords","others"],"categories":["electronic"],"tags":["blues","shuffle"],"bpm_range":[70,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"grooves_electronic"},{"id":"GRV.5/one_drop","name":"One drop (grilla GRV)","taxonomy":["GRV.5","RGG.3.1"],"origin":{"tradition":"Jamaica, roots reggae","genre":["reggae"],"context":"bombo y caja en el pulso 3","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[8]},{"role":"snare","onsets":[8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["electronic","dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,90],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"},"family":"grooves_electronic"},{"id":"GRV.6/rockers","name":"Rockers (grilla GRV)","taxonomy":["GRV.6","RGG.3.2"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"bombo en 1 y 3","sources":["meta-análisis §3"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["electronic","dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,90],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Véase RGG.3.2a y RGG.3.2b para las dos acepciones.","family":"grooves_electronic"},{"id":"GRV.7/steppers","name":"Steppers (grilla GRV)","taxonomy":["GRV.7","RGG.3.3"],"origin":{"tradition":"Jamaica / Reino Unido","genre":["reggae","dub"],"context":"bombo en cada pulso","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["electronic","dub_reggae"],"tags":["dub","steppers"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"grooves_electronic"},{"id":"GRV.8/skank","name":"Skank (grilla GRV)","taxonomy":["GRV.8","ACE.2.2","RGG.6.1"],"origin":{"tradition":"Jamaica (ska, reggae)","genre":["ska","reggae"],"context":"acordes en contratiempo o en 2 y 4","sources":["meta-análisis §3"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,6,10,14],"gate":[0.2,0.2,0.2,0.2]}],"transforms_allowed":["rotate","density","swing"],"destinations":["chords","others"],"categories":["electronic","dub_reggae"],"tags":["reggae","ska","dub"],"bpm_range":[60,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"params":{"skank_mode":"offbeat"},"family":"grooves_electronic"},{"id":"GRV.9/trap","name":"Trap","taxonomy":["GRV.9","GRV.3"],"origin":{"tradition":"Atlanta, hip hop","genre":["trap"],"context":"hats rápidos con tresillos y redobles","sources":["meta-análisis §3"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,10]},{"role":"snare","onsets":[8]},{"role":"hat","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]}],"transforms_allowed":["density","swing"],"destinations":["hihats","ethnic","others"],"categories":["electronic"],"tags":["trap","hiphop"],"bpm_range":[130,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"trap_roll"},"notes":"El bombo en [0,10] es una elección de diseño; el informe fija solo hats y caja. Los redobles de fusa y los tresillos los añade el generador de Hi-hats.","family":"grooves_electronic"},{"id":"GRV.10/motorik","name":"Motorik","taxonomy":["GRV.10"],"origin":{"tradition":"Alemania, krautrock","genre":["krautrock"],"context":"4/4 constante con mínima variación","sources":["meta-análisis §3"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrón exacto por verificar en transcripción.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]}],"transforms_allowed":["density"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["krautrock"],"bpm_range":[110,160],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"grooves_electronic"},{"id":"GRV.11/breakbeat","name":"Breakbeat / Amen","taxonomy":["GRV.11"],"origin":{"tradition":"funk, hip hop, jungle","genre":["breakbeat","jungle"],"context":"breaks troceados","sources":["meta-análisis §3"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Transcripción del Amen break pendiente; entrada vacía para completar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[]},{"role":"snare","onsets":[]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["jungle","breakbeat"],"bpm_range":[160,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"grooves_electronic"},{"id":"GRV.12/two_step","name":"2-step / UK garage","taxonomy":["GRV.12","MIC.1.1","RGG.10.3"],"origin":{"tradition":"Reino Unido","genre":["uk garage","2-step"],"context":"bombo que omite tiempos con swing de semicorchea","sources":["meta-análisis §3"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Onsets por verificar; el reggae informa bombo en 1 y 3 en el 2-step.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["electronic"],"tags":["garage","2-step"],"bpm_range":[130,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"params":{"swing_level":0.25,"ratio":1.5},"family":"grooves_electronic"},{"id":"GRV.13/moroder_bass","name":"Bajo Moroder","taxonomy":["GRV.13","CIC.1.1","ACE.1.4"],"origin":{"tradition":"Múnich, disco electrónica","genre":["disco","synth"],"context":"I Feel Love (1977)","sources":["meta-análisis §3"]},"status":"V","verify":true,"verify_notes":"Contorno de octavas por verificar; la rejilla de semicorcheas sí está documentada.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]}],"transforms_allowed":["density"],"destinations":["bassline","arpeggio"],"categories":["electronic"],"tags":["disco","synth","techno"],"bpm_range":[110,135],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"params":{"bass_style":"ostinato_continuo"},"family":"grooves_electronic"},{"id":"GRV.14/dub_techno","name":"Dub techno (grilla GRV)","taxonomy":["GRV.14","RGG.10.2","PRO.19"],"origin":{"tradition":"Berlín","genre":["dub techno"],"context":"stab en contratiempo con delay","sources":["meta-análisis §3"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,10],"gate":[0.15,0.15]}],"transforms_allowed":["rotate","density","swing"],"destinations":["chords"],"categories":["electronic","dub_techno"],"tags":["dub techno","techno","dub"],"bpm_range":[115,128],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"fx":{"delay_ratio":"1/8.","feedback":0.55},"family":"grooves_electronic"},{"id":"CIC.4.3.1/maqsum","name":"Maqsum","taxonomy":["CIC.4.3.1","ACE.1.5"],"origin":{"tradition":"mundo árabe","genre":["tarab","pop árabe","folclor"],"context":"iqa' de 4/4 más usado","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0,1,3,4,6],"timbre":[0,1,1,0,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","maqsum"],"bpm_range":[80,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"params":{"ornament_grid":32},"family":"iqa_usul"},{"id":"CIC.4.3.2/baladi","name":"Baladi / Masmudi saghir","taxonomy":["CIC.4.3.2","ACE.1.5"],"origin":{"tradition":"Egipto, mundo árabe","genre":["baladi","pop árabe"],"context":"doble dum inicial","sources":["MaqamWorld: Iqa' Baladi"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0,1,3,4,6],"timbre":[0,0,1,0,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","baladi"],"bpm_range":[80,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"iqa_usul"},{"id":"CIC.4.3.3/saidi","name":"Saidi","taxonomy":["CIC.4.3.3","ACE.1.5"],"origin":{"tradition":"Alto Egipto","genre":["saidi"],"context":"danza con bastón","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0,1,3,4,6],"timbre":[0,1,0,0,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","saidi"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"iqa_usul"},{"id":"CIC.4.3.4/malfuf","name":"Malfuf","taxonomy":["CIC.4.3.4","CIC.3.1"],"origin":{"tradition":"mundo árabe","genre":["folclor","entradas de danza"],"context":"2/4 rápido","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":8,"step_value":0.25,"meter":"2/4","layers":[{"role":"darbuka","onsets":[0,3,6],"timbre":[0,1,1]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic","malfuf"],"bpm_range":[100,180],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"notes":"Comparte la forma 3+3+2 con el tresillo.","family":"iqa_usul"},{"id":"CIC.4.3.5/wahda","name":"Wahda","taxonomy":["CIC.4.3.5"],"origin":{"tradition":"mundo árabe","genre":["tarab","taqsim acompañado"],"context":"dum en el pulso 1 con taks escasos","sources":["MaqamWorld"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes tak exactos por verificar (§7 del informe).","cycle_len":8,"step_value":0.5,"meter":"4/4","layers":[{"role":"darbuka","onsets":[0],"timbre":[0]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["arabic"],"bpm_range":[60,120],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"iqa_usul"},{"id":"CIC.4.3.6/fox","name":"Fox","taxonomy":["CIC.4.3.6"],"origin":{"tradition":"mundo árabe","genre":["pop árabe"],"context":"2/4 alternado","sources":["MaqamWorld"]},"status":"H","verify":false,"cycle_len":4,"step_value":0.5,"meter":"2/4","layers":[{"role":"darbuka","onsets":[0,1,2,3],"timbre":[0,1,0,1]}],"transforms_allowed":["density"],"destinations":["ethnic","bassline","others"],"categories":["world_cycles"],"tags":["arabic"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"iqa_usul"},{"id":"CIC.4.3.7/samai_thaqil","name":"Sama'i thaqil (10/8)","taxonomy":["CIC.4.3.7","MET.3.2"],"origin":{"tradition":"mundo árabe y otomano","genre":["sama'i","muwashshah"],"context":"forma instrumental","sources":["MaqamWorld"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Agrupamiento 3+2+2+3 documentado; golpes dum/tak por verificar. Solo se marcan los inicios de grupo.","cycle_len":10,"step_value":0.5,"meter":"10/8","grouping":[3,2,2,3],"layers":[{"role":"darbuka","onsets":[0,3,5,7],"timbre":[0,1,1,0]}],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["arabic","ottoman","10/8"],"bpm_range":[60,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"iqa_usul"},{"id":"CIC.4.4/aksak_usul","name":"Usul aksak (9/8)","taxonomy":["CIC.4.4","MET.3.3"],"origin":{"tradition":"Turquía otomana","genre":["usul","música clásica otomana"],"context":"2+2+2+3","sources":["meta-análisis §2.5 CIC.4.4"]},"status":"I","verify":false,"cycle_len":9,"step_value":0.5,"meter":"9/8","grouping":[2,2,2,3],"layers":[{"role":"darbuka","onsets":[0,2,4,6],"timbre":[0,1,1,0]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","others","arpeggio","bassline"],"categories":["world_cycles"],"tags":["ottoman","aksak","9/8"],"bpm_range":[80,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Timbres de inicio de grupo como propuesta de diseño (inicio = dum).","family":"iqa_usul"},{"id":"CIC.4.4/curcuna","name":"Usul curcuna (10/8)","taxonomy":["CIC.4.4","MET.3.2"],"origin":{"tradition":"Turquía otomana","genre":["usul"],"context":"3+2+2+3","sources":["meta-análisis §2.5 CIC.4.4"]},"status":"I","verify":false,"cycle_len":10,"step_value":0.5,"meter":"10/8","grouping":[3,2,2,3],"layers":[{"role":"darbuka","onsets":[0,3,5,7],"timbre":[0,1,1,0]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","others","arpeggio","bassline"],"categories":["world_cycles"],"tags":["ottoman","10/8"],"bpm_range":[80,160],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Timbres de inicio de grupo como propuesta de diseño (inicio = dum).","family":"iqa_usul"},{"id":"CIC.4.5/jinyangjo","name":"Jinyangjo (24)","taxonomy":["CIC.4.5","FOR.2.2"],"origin":{"tradition":"Corea","genre":["pansori","sanjo"],"context":"el jangdan más lento; 6 pulsos por gak, 4 gak","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes del janggu por verificar; se marcan los inicios de gak.","cycle_len":24,"step_value":1,"meter":"24/4","grouping":[6,6,6,6],"layers":[{"role":"gak","onsets":[0,6,12,18],"timbre":[2,0,0,1]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["korea","jangdan"],"bpm_range":[20,60],"repeat_policy":{"mode":"cycles","default_repeats":2,"variation_on_last":"none"},"family":"jangdan_kultrun"},{"id":"CIC.4.5/jungmori","name":"Jungmori (12)","taxonomy":["CIC.4.5"],"origin":{"tradition":"Corea","genre":["pansori","minyo"],"context":"jangdan medio de 12 pulsos","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes por verificar; se marca el ciclo.","cycle_len":12,"step_value":1,"meter":"12/4","layers":[{"role":"beat","onsets":[0],"timbre":[2]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["korea","jangdan"],"bpm_range":[60,120],"repeat_policy":{"mode":"cycles","default_repeats":4,"variation_on_last":"none"},"family":"jangdan_kultrun"},{"id":"CIC.4.5/semachi","name":"Semachi (3 pulsos ternarios)","taxonomy":["CIC.4.5","MET.2.4"],"origin":{"tradition":"Corea","genre":["minyo"],"context":"algo rápido, de tres pulsos","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Subdivisión y golpes por verificar.","cycle_len":3,"step_value":1,"meter":"3/4","layers":[{"role":"beat","onsets":[0],"timbre":[2]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles"],"tags":["korea","jangdan"],"repeat_policy":{"mode":"cycles","default_repeats":8,"variation_on_last":"none"},"family":"jangdan_kultrun"},{"id":"CIC.4.5/eotmori","name":"Eotmori (10/8)","taxonomy":["CIC.4.5","MET.3.2"],"origin":{"tradition":"Corea","genre":["pansori","sanjo"],"context":"jangdan muy rápido en 10/8","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"verify_notes":"Agrupamiento 3+3+2+2 o 3+2+2+3 según escuela; se carga 3+3+2+2 editable.","cycle_len":10,"step_value":0.5,"meter":"10/8","grouping":[3,3,2,2],"layers":[{"role":"group","onsets":[0,3,6,8],"timbre":[2,1,0,1]}],"params":{"grouping_alternatives":[[3,3,2,2],[3,2,2,3]]},"transforms_allowed":["density","rotate"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["korea","jangdan","10/8"],"bpm_range":[150,240],"repeat_policy":{"mode":"cycles","default_repeats":8,"variation_on_last":"none"},"family":"jangdan_kultrun"},{"id":"CIC.4.5/jajinmori","name":"Jajinmori (4 pulsos ternarios)","taxonomy":["CIC.4.5","MET.2.4"],"origin":{"tradition":"Corea","genre":["pansori","sanjo"],"context":"rápido, equivalente a 12/8","sources":["Wikipedia: Traditional Korean rhythm"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Golpes por verificar; se marcan los cuatro pulsos.","cycle_len":12,"step_value":0.333333,"meter":"12/8","grouping":[3,3,3,3],"layers":[{"role":"beat","onsets":[0,3,6,9],"timbre":[2,0,0,1]}],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["korea","jangdan","12/8"],"bpm_range":[100,180],"repeat_policy":{"mode":"cycles","default_repeats":8,"variation_on_last":"none"},"family":"jangdan_kultrun"},{"id":"CIC.9/kultrun_principio","name":"Kultrún (principio de ciclo de cuatro)","taxonomy":["CIC.9"],"origin":{"tradition":"Mapuche (Chile y Argentina)","genre":["ülkantun","purrun"],"context":"instrumento ceremonial de la machi; su membrana representa el universo dividido en cuatro","sources":["Grebe 1973, Revista Musical Chilena","Memoria Chilena"],"restricted_use":true},"status":"H","verify":true,"restricted_use":true,"structural_only":true,"missing_data":true,"cultural_note":"El kultrún es un instrumento ceremonial de la machi. Este principio (ciclo de cuatro, golpe y sacudida) no reproduce toques ceremoniales; su uso como repertorio requiere el consentimiento de las comunidades y especialistas que lo sostienen.","verify_notes":"Las transcripciones de 1934–1949 citadas por Grebe no se consultaron.","cycle_len":4,"step_value":1,"meter":"4/4","layers":[{"role":"golpe","onsets":[0,1,2,3],"timbre":[0,0,0,0]},{"role":"sacudida","onsets":[0,2],"timbre":[3,3]}],"transforms_allowed":[],"destinations":["ethnic"],"categories":["world_cycles"],"tags":["ritual"],"repeat_policy":{"mode":"cycles","default_repeats":4,"variation_on_last":"none"},"family":"jangdan_kultrun"},{"id":"CIC.6.2/bossa_kick","name":"Bombo de bossa / baião","taxonomy":["CIC.6.2","CIC.3.6","ACE.2.3"],"origin":{"tradition":"Brasil","genre":["bossa nova","baião"],"context":"negra con puntillo y corchea, dos veces por compás","sources":["corpus: Azure-Bossa-Nova, Bossa-Nova, Schuld…Bossa-Nova"]},"status":"C","verify":true,"verify_notes":"Nombre de estilo por contrastar con fuente pedagógica.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,6,8,14],"velocity":[100,80,100,80]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline"],"categories":["latin_percussion"],"tags":["bossa","brasil","latin"],"bpm_range":[120,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"latin_percussion"},{"id":"CIC.3.6/bossa_cross_stick_32","name":"Cross-stick de bossa (2 compases)","taxonomy":["CIC.3.6","PRO.2"],"origin":{"tradition":"Brasil","genre":["bossa nova"],"context":"aro cada 6 semicorcheas: ciclo casi uniforme de 32 pasos","sources":["corpus: Azure-Bossa-Nova (rim)","corpus: Schuld…Bossa-Nova (cowbell)"]},"status":"C","verify":true,"verify_notes":"Comparar con la bossa clave del informe (CIC.3.6).","cycle_len":32,"step_value":0.25,"meter":"4/4","grouping":[6,6,6,6,8],"layers":[{"role":"rim","onsets":[4,10,16,22,28]},{"role":"cabasa","onsets":[2,6,10,14,18,22,26,30],"velocity":[70,70,70,70,70,70,70,70]},{"role":"kick","onsets":[0,6,8,14,16,22,24,30]}],"transforms_allowed":["rotate","density","swing"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["bossa","brasil"],"bpm_range":[120,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"latin_percussion"},{"id":"CIC.6/cowbell_bell_offbeat","name":"Cencerro en negras y campana a contratiempo","taxonomy":["CIC.6","ACE.2.2"],"origin":{"tradition":"afrolatina","genre":["latin"],"context":"pulso de cencerro con campana del ride en el «y»","sources":["corpus: Latin2, Latin15, Latin24, ethnic5"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"cowbell","onsets":[0,4,8,12]},{"role":"ride_bell","onsets":[2,6,10,14]},{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[3,7,10,13,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["latin"],"bpm_range":[100,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"latin_percussion"},{"id":"CIC.6/kick_dotted_per_beat","name":"Bombo de corchea con puntillo y semicorchea","taxonomy":["CIC.6","ACE.2.3"],"origin":{"tradition":"afrolatina","genre":["latin"],"context":"cada pulso: ataque en la 1.ª y la 4.ª semicorchea","sources":["corpus: Latin6, Latin21"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,3,4,7,8,11,12,15]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","bassline"],"categories":["latin_percussion"],"tags":["latin"],"bpm_range":[100,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"latin_percussion"},{"id":"CIC.6/guiro_scrape","name":"Güiro","taxonomy":["CIC.6","ACE.2.3"],"origin":{"tradition":"afrolatina","genre":["latin","cumbia","salsa"],"context":"raspado de corchea con anticipación final","sources":["corpus: LS_4-4_NmlHrdSwg_FullKit_124"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"guiro","onsets":[2,3,6,7,10,11,13,14],"velocity":[90,60,90,60,90,60,80,90]}],"transforms_allowed":["density","swing"],"destinations":["hihats","ethnic"],"categories":["latin_percussion"],"tags":["latin"],"bpm_range":[90,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"latin_percussion"},{"id":"CIC.6/congas_three_strokes","name":"Congas: abierta, apagada y grave","taxonomy":["CIC.6","ACE.1.5"],"origin":{"tradition":"afrolatina","genre":["latin"],"context":"figura repartida por golpe","sources":["corpus: ethnic5"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"conga_open","onsets":[6,7,14]},{"role":"conga_mute","onsets":[3,11]},{"role":"conga_lo","onsets":[12]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic"],"categories":["latin_percussion"],"tags":["latin","conga"],"bpm_range":[100,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"latin_percussion"},{"id":"CIC.6/agogo_two_bar","name":"Agogó (2 compases)","taxonomy":["CIC.6","CIC.2"],"origin":{"tradition":"afrobrasileña","genre":["latin"],"context":"figura de campana de dos compases","sources":["corpus: ethnic5"]},"status":"C","verify":false,"cycle_len":32,"step_value":0.25,"meter":"4/4","layers":[{"role":"agogo_lo","onsets":[0,2,3,4,6,7,8,9,10,14,16,18,22,23,24,26,28,30,31]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["latin","brasil"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"latin_percussion"},{"id":"CIC.6/maracas_ride_layers","name":"Capas agudas: ride, cabasa y maracas","taxonomy":["CIC.6","MET.2.1"],"origin":{"tradition":"afrolatina","genre":["bossa nova","latin"],"context":"subdivisión continua repartida","sources":["corpus: Azure-Bossa-Nova"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"ride","onsets":[0,2,4,6,8,10,12,14]},{"role":"cabasa","onsets":[2,6,10,14]},{"role":"maracas","onsets":[0,4,8,12]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["latin_percussion"],"tags":["bossa","latin"],"bpm_range":[110,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"latin_percussion"},{"id":"MET.2.4/latin_6_8_kit","name":"Kit latino en 6/8","taxonomy":["MET.2.4","SUP.3"],"origin":{"tradition":"afrolatina","genre":["latin 6/8"],"context":"bombo en las corcheas 1, 4 y 6; caja en 3 y 5","sources":["corpus: Latin68time1, LS_6-8_FullKit_135"]},"status":"C","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[3,3],"layers":[{"role":"kick","onsets":[0,3,5]},{"role":"snare","onsets":[2,4]},{"role":"hat_open","onsets":[1,5]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion"],"tags":["latin","6/8"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"notes":"Rejilla en corcheas (6 pasos).","family":"latin_percussion"},{"id":"MET.2.4/bell_12_8","name":"Campana y woodblock en 12/8","taxonomy":["MET.2.4","CIC.2"],"origin":{"tradition":"afrolatina","genre":["latin 12/8"],"context":"figura de campana de 12 corcheas (comparar con CIC.2.1)","sources":["corpus: LS_12-8_NmlStr_FullKit_142"]},"status":"C","verify":false,"cycle_len":24,"step_value":0.25,"meter":"12/8","layers":[{"role":"cowbell","onsets":[0,2,4,7,10,12,15,17]},{"role":"woodblock_lo","onsets":[0,6,10,14,16,22]}],"transforms_allowed":["density","rotate"],"destinations":["ethnic","hihats"],"categories":["latin_percussion","world_cycles"],"tags":["latin","12/8","afro"],"bpm_range":[80,130],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"Rejilla de semicorcheas (24 pasos = 12 corcheas): el cencerro usa posiciones de semicorchea impar.","family":"latin_percussion"},{"id":"MET.3.3/triangle_9_8","name":"Triángulo en 9/8","taxonomy":["MET.3.3","MET.3.2"],"origin":{"tradition":"percusión en métrica aditiva","genre":["9/8"],"context":"figura de triángulo de un pack de percusión latina","sources":["corpus: LS_9-8_NmlStr_Triangles_169"]},"status":"C","verify":false,"cycle_len":18,"step_value":0.25,"meter":"9/8","layers":[{"role":"triangle","onsets":[0,2,4,8,10,12,16]}],"transforms_allowed":["density","rotate"],"destinations":["hihats","ethnic"],"categories":["latin_percussion","world_cycles"],"tags":["9/8","aksak"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"latin_percussion"},{"id":"PRO.1/e_3_8","name":"E(3,8)","taxonomy":["PRO.1","CIC.3.1"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación del tresillo","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.25,"meter":"2/4","generator":{"type":"euclid","k":3,"n":8,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"procedures"},{"id":"PRO.1/e_5_8","name":"E(5,8)","taxonomy":["PRO.1","CIC.3.3"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación del cinquillo","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.25,"meter":"2/4","generator":{"type":"euclid","k":5,"n":8,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"procedures"},{"id":"PRO.1/e_7_12","name":"E(7,12)","taxonomy":["PRO.1","CIC.2.1"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación del standard pattern","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.333333,"meter":"12/8","generator":{"type":"euclid","k":7,"n":12,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean","12/8"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"procedures"},{"id":"PRO.1/e_5_16","name":"E(5,16)","taxonomy":["PRO.1","CIC.3.6"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"rotación de la bossa clave","sources":["Toussaint 2005"]},"status":"H","verify":false,"step_value":0.25,"meter":"4/4","generator":{"type":"euclid","k":5,"n":16,"rotation":0},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"procedures"},{"id":"PRO.1/e_custom","name":"Euclidiano libre E(k,n)","taxonomy":["PRO.1","PRO.2","PRO.14"],"origin":{"tradition":"procedimiento (Toussaint)","genre":["euclidiano"],"context":"k y n configurables con rotación","sources":["Toussaint 2005, 2013"]},"status":"H","verify":false,"step_value":0.25,"meter":"4/4","generator":{"type":"euclid","k":7,"n":16,"rotation":0,"editable":true},"layers":[],"transforms_allowed":["rotate","reverse","complement","density","swing","phase"],"destinations":["bassline","chords","arpeggio","hihats","ethnic","others"],"categories":["procedures"],"tags":["euclidean"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"procedures"},{"id":"PRO.3/modo_1","name":"Modo rítmico 1 (largo–breve)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum","conductus"],"context":"pie trocaico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":3,"step_value":0.5,"meter":"3/8","grouping":[2,1],"layers":[{"role":"voice","onsets":[0,2],"gate":[0.95,0.45]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"procedures"},{"id":"PRO.3/modo_2","name":"Modo rítmico 2 (breve–largo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum","conductus"],"context":"pie yámbico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":3,"step_value":0.5,"meter":"3/8","grouping":[1,2],"layers":[{"role":"voice","onsets":[0,1],"gate":[0.45,0.95]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"procedures"},{"id":"PRO.3/modo_3","name":"Modo rítmico 3 (largo con puntillo–breve–largo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie dactílico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[3,1,2],"layers":[{"role":"voice","onsets":[0,3,4],"gate":[1.4,0.45,0.95]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"procedures"},{"id":"PRO.3/modo_4","name":"Modo rítmico 4 (breve–largo–largo con puntillo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie anapéstico","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[1,2,3],"layers":[{"role":"voice","onsets":[0,1,3],"gate":[0.45,0.95,1.4]}],"transforms_allowed":["reverse","density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"procedures"},{"id":"PRO.3/modo_5","name":"Modo rítmico 5 (largo–largo)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie espondeo","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","grouping":[3,3],"layers":[{"role":"voice","onsets":[0,3],"gate":[1.4,1.4]}],"transforms_allowed":["density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"procedures"},{"id":"PRO.3/modo_6","name":"Modo rítmico 6 (breve–breve–breve)","taxonomy":["PRO.3"],"origin":{"tradition":"Notre-Dame, s. XII–XIII","genre":["organum"],"context":"pie tribraquio","sources":["Johannes de Garlandia"]},"status":"H","verify":false,"cycle_len":3,"step_value":0.5,"meter":"3/8","grouping":[1,1,1],"layers":[{"role":"voice","onsets":[0,1,2],"gate":[0.45,0.45,0.45]}],"transforms_allowed":["density"],"destinations":["bassline","chords","arpeggio","others"],"categories":["procedures"],"tags":["medieval"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"none"},"family":"procedures"},{"id":"SUP.1.1/poly_3_2","name":"Polirritmia 3:2","taxonomy":["SUP.1.1","SUP.1.4"],"origin":{"tradition":"procedimiento","genre":["polirritmia"],"context":"tres contra dos sobre 6 pulsos","sources":["meta-análisis §2.3 SUP.1"]},"status":"H","verify":false,"step_value":0.333333,"meter":"2/4","generator":{"type":"polyrhythm","ratios":[3,2]},"layers":[],"transforms_allowed":["rotate","density","phase"],"destinations":["ethnic","arpeggio","chords","bassline","others"],"categories":["procedures"],"tags":["polyrhythm"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"procedures"},{"id":"SUP.1.2/poly_4_3","name":"Polirritmia 4:3","taxonomy":["SUP.1.2"],"origin":{"tradition":"procedimiento","genre":["polirritmia"],"context":"cuatro contra tres sobre 12 pulsos","sources":["meta-análisis §2.3 SUP.1"]},"status":"H","verify":false,"step_value":0.25,"meter":"3/4","generator":{"type":"polyrhythm","ratios":[4,3]},"layers":[],"transforms_allowed":["rotate","density","phase"],"destinations":["ethnic","arpeggio","chords","bassline","others"],"categories":["procedures"],"tags":["polyrhythm"],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"procedures"},{"id":"SUP.2.1/polymeter_16_12","name":"Polimetría 16 contra 12","taxonomy":["SUP.2.1","PRO.10"],"origin":{"tradition":"procedimiento","genre":["polimetría"],"context":"capas de 16 y 12 pasos que se realinean a los 48","sources":["meta-análisis §2.3 SUP.2"]},"status":"H","verify":false,"cycle_len":48,"step_value":0.25,"meter":"4/4","layers":[{"role":"layer_a","cycle_len":16,"onsets":[0,4,8,12]},{"role":"layer_b","cycle_len":12,"onsets":[0,3,6,8]}],"transforms_allowed":["rotate","density","phase"],"destinations":["ethnic","arpeggio","chords","bassline","hihats","others"],"categories":["procedures"],"tags":["polymeter"],"repeat_policy":{"mode":"lcm","default_repeats":1,"variation_on_last":"none","max_bars":16},"family":"procedures"},{"id":"PRO.11/clapping_shift","name":"Desplazamiento discreto (tipo Clapping Music)","taxonomy":["PRO.11","PRO.10"],"origin":{"tradition":"minimalismo (Reich)","genre":["proceso"],"context":"una capa avanza un paso cada N repeticiones","sources":["Reich 2002"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.25,"meter":"3/4","layers":[{"role":"fixed","onsets":[0,1,2,4,5,7,9,10]},{"role":"shifting","onsets":[0,1,2,4,5,7,9,10]}],"params":{"shift_every":4,"shift_layer":1},"transforms_allowed":["density"],"destinations":["ethnic","arpeggio","others"],"categories":["procedures"],"tags":["minimal","phase"],"repeat_policy":{"mode":"cycles","default_repeats":12,"variation_on_last":"none"},"notes":"Figura de 12 pasos de Clapping Music (Reich, 1972), citada como ejemplo del procedimiento.","family":"procedures"},{"id":"RGG.3.1/one_drop","name":"One drop","taxonomy":["RGG.3.1","ACE.2.2","MIC.1.1","GRV.5"],"origin":{"tradition":"Jamaica, roots reggae","genre":["roots reggae"],"context":"batería del roots; Bob Marley and the Wailers","attributions":["Carlton Barrett","Winston Grennan"],"sources":["Wikipedia: One drop rhythm","MusicRadar","Bradford College"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[8]},{"role":"rim","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.5}],"transforms_allowed":["density","swing","phase"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae"],"tags":["reggae","roots","dub","lovers rock"],"bpm_range":[60,90],"corpus":["80_Kick + 80_Snare (Echoes In The Smoke, 80 BPM)","64_Kick + 64_Snare en doble tiempo (Dub Front)"],"params":{"drop_beat":1,"half_time":true},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"},"family":"reggae_family"},{"id":"RGG.3.2a/rockers_pedagogico","name":"Rockers (acepción pedagógica)","taxonomy":["RGG.3.2","GRV.6"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"material pedagógico: one drop con bombo añadido en el 1","sources":["Soundbrenner","zZounds Blog"]},"status":"I","verify":true,"verify_notes":"Acepción de divulgación (calidad B); difiere de la histórica de Channel One.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,8]},{"role":"rim","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.5}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae"],"tags":["reggae","rockers"],"bpm_range":[60,90],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.3.2b/rockers_channel_one","name":"Rockers (Channel One, 1976)","taxonomy":["RGG.3.2","RGG.3.3"],"origin":{"tradition":"Jamaica, Channel One","genre":["rockers"],"context":"Sly Dunbar y The Revolutionaries; reemplazó a los flyers","attributions":["Sly Dunbar"],"sources":["Jamaica Gleaner 2026","Reggae.be"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Posiciones de los golpes dobles de caja por verificar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[],"notes":"golpes dobles: posiciones por verificar"}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["dub_reggae"],"tags":["reggae","rockers","dub"],"bpm_range":[60,90],"bpm_range_verify":true,"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.3.3/steppers","name":"Steppers","taxonomy":["RGG.3.3","GRV.7","COG.2"],"origin":{"tradition":"Jamaica / Reino Unido","genre":["steppers","uk dub"],"context":"bombo en cuatro pulsos dentro de un groove de reggae","attributions":["Sly Dunbar (Channel One)","Jah Shaka (difusión UK)"],"sources":["Soundbrenner","Bass Culture"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"rim","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1}],"transforms_allowed":["density","swing","phase"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae"],"tags":["steppers","dub","uk dub"],"bpm_range":[110,140],"bpm_range_verify":true,"corpus":["Kick_Steppers, Steppers_130BPM (Sub System Dub, 130)","135_Kick (Rebel Skank)","120/140 Drum Rack (Echoes In The Smoke)"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.3.3/steppers_push","name":"Steppers con empuje","taxonomy":["RGG.3.3","ACE.2.3"],"origin":{"tradition":"dub contemporáneo","genre":["steppers"],"context":"corchea o semicorchea añadida antes de un pulso","sources":["corpus: 112_Kick (Echoes In The Smoke)","corpus: 130_Kick 2 (Sub System Dub)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,2,4,8,12]},{"role":"rim","onsets":[8]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["dub_reggae"],"tags":["steppers","dub"],"bpm_range":[110,135],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.3.4/half_drop","name":"Half drop / two drop","taxonomy":["RGG.3.4"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"mencionados en un tutorial de producción de dub","sources":["DubRoom (nivel C)"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrones exactos no detallados en la fuente.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[]},{"role":"snare","onsets":[]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","others"],"categories":["dub_reggae"],"tags":["reggae"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.4.1/hat_8ths","name":"Hat en corcheas cerradas","taxonomy":["RGG.4.1","MIC.1.2"],"origin":{"tradition":"Jamaica","genre":["reggae","dub"],"context":"base del one drop","sources":["clasificación RGG §6","corpus: HiHat_8ths, 80_HiHat_2"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,2,4,6,8,10,12,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"},"family":"reggae_family"},{"id":"RGG.4.2/hat_8ths_swing","name":"Hat en corcheas con swing","taxonomy":["RGG.4.2","MIC.1.1"],"origin":{"tradition":"Jamaica","genre":["reggae"],"context":"subdivisión larga–corta; tiende a 1:1 a tempo rápido","sources":["clasificación RGG §6"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.6}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","roots"],"bpm_range":[60,100],"params":{"swing_level":0.5,"tempo_coupling":0.6},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"hat_triplet_fill"},"family":"reggae_family"},{"id":"RGG.4.2/hat_offbeat","name":"Hat en contratiempo","taxonomy":["RGG.4.2","ACE.2.2","GRV.1"],"origin":{"tradition":"dub, steppers, dub techno","genre":["dub","steppers","dub techno"],"context":"contratiempo de corchea","sources":["corpus: HiHat-Offbeats, 130_Hihat, 112_HiHat_1, Steppers_130BPM"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[2,6,10,14]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae","dub_techno"],"tags":["dub","steppers","dub techno"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.4.3/flying_cymbal","name":"Flying cymbal (flyers)","taxonomy":["RGG.4.3"],"origin":{"tradition":"Jamaica, 1974–75","genre":["reggae"],"context":"hat que alterna abierto y cerrado con siseo continuo; deriva del Philly bump","attributions":["Carlton 'Santa' Davis","Bunny Lee (nombre)"],"sources":["FACT Magazine 2016","Red Bull Music Academy 2013"]},"status":"H","verify":true,"verify_notes":"Origen documentado; rejilla exacta por verificar. Valor inicial: abierto en 2 y 4 según la descripción del informe.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,2,6,8,10,14]},{"role":"hat_open","onsets":[4,12]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","flyers"],"bpm_range":[70,90],"params":{"open_mask":[4,12]},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.4.4/hat_triplet_fill","name":"Relleno de hat en tresillo","taxonomy":["RGG.4.4","MIC.2.6"],"origin":{"tradition":"Jamaica","genre":["reggae","dub"],"context":"tresillo de hat retrasado, recurso del one drop","sources":["clasificación RGG §6","corpus: Hihat_Triplets (Sub System Dub)"]},"status":"I","verify":false,"cycle_len":12,"step_value":0.333333,"meter":"4/4","layers":[{"role":"hat","onsets":[0,3,4,5,6,9]}],"transforms_allowed":["density"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["reggae","dub"],"bpm_range":[60,140],"params":{"laid_back_ms":10},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"Rejilla de tresillo de corchea (12 pasos por compás). El corpus (Hihat_Triplets) lo programa en semicorcheas 4, 5, 6; aquí se ofrece en tresillo como describe RGG.4.4.","family":"reggae_family"},{"id":"RGG.4.5/hat_16ths","name":"Hat en semicorcheas digitales","taxonomy":["RGG.4.5"],"origin":{"tradition":"Jamaica, riddims digitales","genre":["dancehall","dub"],"context":"16 pasos con acentos","sources":["clasificación RGG §6","corpus: 64_HiHat_1, 80_HiHat_1"]},"status":"I","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"velocity":[100,60,85,60,100,60,85,60,100,60,85,60,100,60,85,60]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["dancehall","dub"],"bpm_range":[64,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.4.5/hat_double_offbeat","name":"Doble semicorchea a contratiempo","taxonomy":["RGG.4.5","ACE.2.2"],"origin":{"tradition":"dub contemporáneo","genre":["dub"],"context":"par de semicorcheas en el «y» de cada pulso","sources":["corpus: 135_HiHat (Rebel Skank)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat","onsets":[2,3,6,7,10,11,14,15]}],"transforms_allowed":["density","swing"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["dub","steppers"],"bpm_range":[120,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.4.1/hat_open_offbeat_13","name":"Hat abierto en el contratiempo de 1 y 3","taxonomy":["RGG.4.1","ACE.2.2"],"origin":{"tradition":"dub contemporáneo","genre":["dub","steppers"],"context":"apertura que respira en la primera mitad de cada pulso fuerte","sources":["corpus: 64_HiHat_Open_1, 137_HiHat_Open, 140 Drum Rack"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"hat_open","onsets":[2,10]}],"transforms_allowed":["density"],"destinations":["hihats"],"categories":["dub_reggae"],"tags":["dub","steppers"],"bpm_range":[64,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"reggae_family"},{"id":"RGG.7/percusion_menor","name":"Percusión menor de dub","taxonomy":["RGG.7"],"origin":{"tradition":"Jamaica / dub","genre":["reggae","dub"],"context":"pocas capas con función clara","sources":["clasificación RGG §9","corpus: Shaker, Tambourine, Woodblock (varios packs)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"shaker","onsets":[2,10]},{"role":"tambourine","onsets":[0,2,4,6,8,10,12,14],"velocity":[70,55,70,55,70,55,70,55]},{"role":"woodblock","onsets":[6]},{"role":"rim","onsets":[8]}],"transforms_allowed":["density","swing"],"destinations":["hihats","ethnic"],"categories":["dub_reggae"],"tags":["dub","reggae"],"bpm_range":[60,140],"params":{"shaker_8ths":false,"tambourine_offbeat":false,"rim_click_3":true},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"dropout"},"family":"reggae_family"},{"id":"RGG.6.1/skank_offbeat","name":"Skank en contratiempo","taxonomy":["RGG.6.1","ACE.2.2","GRV.8"],"origin":{"tradition":"Jamaica (ska, reggae)","genre":["ska","reggae","dub"],"context":"acorde corto en el «y» de cada pulso; frecuente en órgano y vientos","sources":["clasificación RGG §8","corpus: Organ Off Skank 135, Organ Skank 137, Horn Skank 64"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,6,10,14],"gate":[0.2,0.2,0.2,0.2]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","ska","dub"],"bpm_range":[60,160],"params":{"skank_mode":"offbeat"},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"reggae_family"},{"id":"RGG.6.2/chop_2_4","name":"Chop en 2 y 4","taxonomy":["RGG.6.2","ACE.2.2"],"origin":{"tradition":"Jamaica","genre":["reggae","dub"],"context":"acorde en el backbeat, guitarra y piano duplicados; el modo dominante en el corpus","sources":["clasificación RGG §8","corpus: Piano/Clav/Guitar Skank en la mayoría de los packs"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[4,12],"gate":[0.25,0.25]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","dub","roots"],"bpm_range":[60,140],"params":{"skank_mode":"backbeat"},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"reggae_family"},{"id":"RGG.6.2/double_skank","name":"Double skank","taxonomy":["RGG.6.2","RGG.6.1"],"origin":{"tradition":"reggae y dub","genre":["reggae","dub"],"context":"chop en 2 y 4 seguido de la corchea siguiente","sources":["corpus: Electric Keys Double Skank 137, DoubleSkank_1 130"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[4,6,12,14],"gate":[0.22,0.18,0.22,0.18],"velocity":[100,80,100,80]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","dub"],"bpm_range":[110,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"reggae_family"},{"id":"RGG.6.3/bubble","name":"Bubble de órgano","taxonomy":["RGG.6.3"],"origin":{"tradition":"Jamaica, reggae temprano","genre":["reggae"],"context":"mano izquierda en contratiempo con semicorcheas de enmarque; mano derecha en 2 y 4","attributions":["Jenson (Berklee) como fuente pedagógica"],"sources":["Berklee, Bubblin' (Jenson 2015)","corpus: 116_F#m_Organ (Sinister Dub)"]},"status":"C","verify":true,"verify_notes":"La rejilla sale de un único archivo del corpus; contrastar con la transcripción de Jenson.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[2,4,6,10,12,14],"gate":[0.2,0.2,0.2,0.2,0.2,0.2],"velocity":[80,100,80,80,100,80]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae","roots"],"bpm_range":[60,120],"params":{"bubble_on":true,"frame_16ths":true,"bubble_split":true},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"notes":"El corpus da una sola línea; el reparto entre mano izquierda (contratiempos) y derecha (2 y 4) se controla con el parámetro bubble_split.","family":"reggae_family"},{"id":"RGG.6.4/strum","name":"Strum de semicorchea","taxonomy":["RGG.6.4"],"origin":{"tradition":"Jamaica, reggae temprano","genre":["reggae"],"context":"rasgueo que sustituyó el skank en 2 y 4","sources":["clasificación RGG §8"]},"status":"V","verify":true,"missing_data":true,"verify_notes":"Patrón exacto por verificar.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"chord","onsets":[]}],"transforms_allowed":["density","swing"],"destinations":["chords"],"categories":["dub_reggae"],"tags":["reggae"],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"reggae_family"},{"id":"RGG.5.3/bass_roots_space","name":"Bajo de roots con espacio","taxonomy":["RGG.5.3","RGG.5.4"],"origin":{"tradition":"Jamaica, roots y dub","genre":["roots","dub"],"context":"frase corta con silencios amplios, respuesta en la segunda mitad","sources":["clasificación RGG §7","corpus: 130_Gm_Bass_Line, 135_G_Synth_Bass_Sub, 137_Cm_Sub_Bass"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,8,10,12,14],"gate":[0.9,0.45,0.45,0.45,0.8]}],"transforms_allowed":["density","rotate","swing"],"destinations":["bassline"],"categories":["dub_reggae"],"tags":["roots","dub"],"bpm_range":[60,140],"params":{"bass_space":0.6,"offbeat_bias":0.3,"repeat_len":2,"octave_jump_prob":0.15,"lock_to_kick":false},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"dropout"},"family":"reggae_family"},{"id":"RGG.5.4/bass_dub_sub","name":"Sub de dub en 1 y 3","taxonomy":["RGG.5.4"],"origin":{"tradition":"dub","genre":["dub","steppers"],"context":"sub de notas largas","sources":["corpus: 116_F#m_SubBass, 120_Cm_SubBass, 80_Cm_SubBass"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"bass","onsets":[0,8],"gate":[1.8,1.8]}],"transforms_allowed":["density"],"destinations":["bassline"],"categories":["dub_reggae"],"tags":["dub","steppers"],"bpm_range":[70,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"dropout"},"family":"reggae_family"},{"id":"RGG.10.3/dubstep_halftime","name":"Dubstep (medio tiempo)","taxonomy":["RGG.10.3","FOR.3","GRV.3"],"origin":{"tradition":"Reino Unido","genre":["dubstep"],"context":"caja en el 3 a 140 BPM","attributions":["Kode9 (observación perceptiva)"],"sources":["Modern Drummer","Musical-U"]},"status":"H","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0]},{"role":"snare","onsets":[8]},{"role":"hat","onsets":[0,2,4,6,8,10,12,14],"swing":1.3}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats","others"],"categories":["dub_reggae","electronic"],"tags":["dubstep"],"bpm_range":[132,142],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.10.3/half_step","name":"Half-step de dub","taxonomy":["RGG.10.3","GRV.3"],"origin":{"tradition":"dub contemporáneo","genre":["dub","half-step"],"context":"bombo sincopado en la primera mitad, caja en el 3","sources":["corpus: Kick_Halfstep, Half_Step_130BPM (Sub System Dub)"]},"status":"C","verify":false,"cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,2,6]},{"role":"snare","onsets":[8]},{"role":"hat","onsets":[0,4,5,6,8,12]}],"transforms_allowed":["density","swing"],"destinations":["ethnic","hihats"],"categories":["dub_reggae"],"tags":["dub","half-step"],"bpm_range":[125,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.10.4/dembow","name":"Dembow","taxonomy":["RGG.10.4","CIC.6.1","CIC.3.1","RGG.9.2"],"origin":{"tradition":"Jamaica → Panamá → Puerto Rico","genre":["dancehall","reggaetón"],"context":"Poco Man Jam (1989), Dem Bow (1990)","attributions":["Steely & Clevie","Bobby Digital","Dennis 'the Menace' Thompson"],"sources":["Berklee, What Is Dembow?","Wayne & Wax"]},"status":"I","verify":true,"verify_notes":"Posiciones de caja divergentes entre fuentes.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"kick","onsets":[0,4,8,12]},{"role":"snare","onsets":[3,6,11,14]}],"transforms_allowed":["density","swing","rotate"],"destinations":["ethnic","others"],"categories":["dub_reggae","latin_percussion"],"tags":["reggaeton","dancehall","dembow"],"bpm_range":[85,100],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"reggae_family"},{"id":"RGG.1.1/nyabinghi_roles","name":"Nyabinghi (principio de tres roles)","taxonomy":["RGG.1.1","SUP.1"],"origin":{"tradition":"Rastafari, Jamaica","genre":["nyabinghi"],"context":"música ceremonial; precursora del ska y el reggae a través de Count Ossie","sources":["All Around This World","clasificación RGG §3"],"restricted_use":true},"status":"H","verify":true,"restricted_use":true,"structural_only":true,"cultural_note":"Repertorio religioso rastafari. El dispositivo usa solo el principio de tres roles (base, pulso, improvisación) y no ofrece toques ceremoniales como preset.","cycle_len":16,"step_value":0.25,"meter":"4/4","layers":[{"role":"base","onsets":[0,8],"timbre":[2,3]},{"role":"pulse","onsets":[0,4,8,12],"timbre":[1,1,1,1]},{"role":"improvising","onsets":[4,12],"timbre":[1,1]}],"transforms_allowed":["density"],"destinations":["ethnic"],"categories":["dub_reggae"],"tags":["ritual"],"params":{"thunder_syncopation_prob":0.15,"repeater_density":0.4,"repeater_accent_beats":[2,4]},"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"none"},"family":"reggae_family"},{"id":"SUP.3.1/hemiola_sucesiva","name":"Hemiola sucesiva (6/8 → 3/4)","taxonomy":["SUP.3.1","MET.2.4"],"origin":{"tradition":"Europa, Iberoamérica","genre":["hemiola"],"context":"compás A en 6/8 y compás B en 3/4","sources":["meta-análisis §2.3 SUP.3"]},"status":"H","verify":false,"cycle_len":12,"step_value":0.5,"meter":"6/8","layers":[{"role":"beat","onsets":[0,3,6,8,10],"velocity":[120,95,115,95,95]}],"params":{"mode":"sucesiva","alternation_pattern":"AB"},"transforms_allowed":["density","rotate"],"destinations":["ethnic","bassline","chords","arpeggio","others"],"categories":["world_cycles"],"tags":["sesquialtera","6/8"],"bpm_range":[60,180],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"SUP.3.2/birritmia","name":"Birritmia simultánea (6/8 sobre 3/4)","taxonomy":["SUP.3.2","SUP.1.1"],"origin":{"tradition":"Sudamérica","genre":["zamba","chacarera","joropo","son jarocho"],"context":"melodía en 6/8 sobre bombo en 3/4","sources":["meta-análisis §2.3 SUP.3.2"]},"status":"H","verify":false,"cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"six_eight","onsets":[0,3]},{"role":"three_four","onsets":[0,2,4]}],"params":{"mode":"simultanea"},"transforms_allowed":["density","rotate"],"destinations":["ethnic","bassline","chords","arpeggio","others"],"categories":["world_cycles"],"tags":["sesquialtera","6/8","folclore"],"bpm_range":[60,180],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"CIC.8/cueca","name":"Cueca chilena (principio)","taxonomy":["CIC.8","SUP.3"],"origin":{"tradition":"Chile","genre":["cueca"],"context":"seis corcheas en 2×3 o 3×2 con fórmulas limitadas (Vega)","sources":["Vega, La forma de la cueca chilena","Spencer Espinosa 2021"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrones de rasgueo y de bombo por verificar; se carga el principio de alternancia.","cycle_len":12,"step_value":0.5,"meter":"6/8","layers":[{"role":"beat","onsets":[0,3,6,8,10]}],"params":{"mode":"sucesiva","alternation_pattern":"AB"},"transforms_allowed":["density","rotate"],"destinations":["ethnic","chords","bassline","others"],"categories":["world_cycles","latin_percussion"],"tags":["cueca","chile","folclore"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":4,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"CIC.8/tonada","name":"Tonada chilena (principio)","taxonomy":["CIC.8","SUP.3"],"origin":{"tradition":"Chile","genre":["tonada"],"context":"fluctuación entre 6/8 y 3/4","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Rasgueo por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"six_eight","onsets":[0,3]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["chords","ethnic","others"],"categories":["world_cycles"],"tags":["tonada","chile","folclore"],"bpm_range":[70,120],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"CIC.8/zamba","name":"Zamba (principio)","taxonomy":["CIC.8","SUP.3.2"],"origin":{"tradition":"Argentina","genre":["zamba"],"context":"birritmia con bombo legüero","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrón de bombo legüero por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"bombo","onsets":[]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles","latin_percussion"],"tags":["zamba","argentina","folclore"],"bpm_range":[60,100],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"CIC.8/chacarera","name":"Chacarera (principio)","taxonomy":["CIC.8","SUP.3.2"],"origin":{"tradition":"Argentina","genre":["chacarera"],"context":"birritmia con bombo legüero","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrón de bombo legüero por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"bombo","onsets":[]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["ethnic","others"],"categories":["world_cycles","latin_percussion"],"tags":["chacarera","argentina","folclore"],"bpm_range":[90,140],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"CIC.8/joropo","name":"Joropo (principio)","taxonomy":["CIC.8","SUP.3.2"],"origin":{"tradition":"Venezuela y Colombia (llanos)","genre":["joropo"],"context":"birritmia con reparto por instrumento","sources":["meta-análisis §2.5 CIC.8"]},"status":"H","verify":true,"missing_data":true,"verify_notes":"Patrones por instrumento por verificar.","cycle_len":6,"step_value":0.5,"meter":"6/8","layers":[{"role":"six_eight","onsets":[0,3]},{"role":"three_four","onsets":[0,2,4]}],"transforms_allowed":["density"],"destinations":["ethnic","chords","others"],"categories":["world_cycles","latin_percussion"],"tags":["joropo","folclore"],"bpm_range":[150,220],"repeat_policy":{"mode":"fixed","default_repeats":8,"variation_on_last":"fill"},"family":"sesquialtera"},{"id":"CIC.4.1/teental","name":"Teental (16)","taxonomy":["CIC.4.1","PRO.16","MET.2.3"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal","kathak","tabla solo"],"context":"el tala más usado del repertorio indostánico","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":16,"step_value":1,"meter":"16/4","grouping":[4,4,4,4],"layers":[{"role":"clap","onsets":[0,4,8,12],"timbre":[0,0,1,0],"velocity":[127,100,80,100]},{"role":"matra","onsets":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"timbre":[0,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1],"velocity":[100,60,60,60,80,60,60,60,60,60,60,60,80,60,60,60]}],"params":{"sam":0,"tali":[0,4,12],"khali":[8],"laya":"madhya"},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[40,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"},{"id":"CIC.4.1/jhaptal","name":"Jhaptal (10)","taxonomy":["CIC.4.1","MET.3.2"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal"],"context":"tala de 10 matras en 2+3+2+3","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":10,"step_value":1,"meter":"10/4","grouping":[2,3,2,3],"layers":[{"role":"clap","onsets":[0,2,5,7],"timbre":[0,0,1,0],"velocity":[127,100,80,100]}],"params":{"sam":0,"tali":[0,2,7],"khali":[5]},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[40,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"},{"id":"CIC.4.1/rupak","name":"Rupak (7)","taxonomy":["CIC.4.1","MET.3.2"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal","bhajan"],"context":"el sam coincide con el khali","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":7,"step_value":1,"meter":"7/4","grouping":[3,2,2],"layers":[{"role":"clap","onsets":[0,3,5],"timbre":[1,0,0],"velocity":[110,100,100]}],"params":{"sam":0,"tali":[3,5],"khali":[0]},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[40,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"},{"id":"CIC.4.1/ektal","name":"Ektal (12)","taxonomy":["CIC.4.1","MET.2.2"],"origin":{"tradition":"India del norte (indostánica)","genre":["khayal","dhrupad"],"context":"tala de 12 matras en seis vibhag de 2","sources":["meta-análisis §2.5 CIC.4.1"]},"status":"H","verify":false,"cycle_len":12,"step_value":1,"meter":"12/4","grouping":[2,2,2,2,2,2],"layers":[{"role":"clap","onsets":[0,2,4,6,8,10],"timbre":[0,1,0,1,0,0],"velocity":[127,80,100,80,100,100]}],"params":{"sam":0,"tali":[0,4,8,10],"khali":[2,6]},"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala"],"bpm_range":[20,300],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"},{"id":"CIC.4.2/adi_tala","name":"Adi tala (triputa chatusra, chatusra nadai)","taxonomy":["CIC.4.2","MET.3.1"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti","varnam"],"context":"el tala más común del repertorio carnático","sources":["meta-análisis §2.5 CIC.4.2","karnatik.com"]},"status":"H","verify":false,"step_value":0.25,"meter":"8/4","generator":{"type":"carnatic_tala","family":"triputa","jati":"chatusra","gati":4},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"notes":"32 matras (§4.4).","family":"tala"},{"id":"CIC.4.2/rupaka_chatusra","name":"Rupaka tala (chatusra jati)","taxonomy":["CIC.4.2"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti"],"context":"drutam + laghu","sources":["meta-análisis §2.5 CIC.4.2"]},"status":"H","verify":false,"step_value":0.25,"meter":"6/4","generator":{"type":"carnatic_tala","family":"rupaka","jati":"chatusra","gati":4},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"},{"id":"CIC.4.2/khanda_matya","name":"Khanda jati matya (48 matras)","taxonomy":["CIC.4.2","MET.3.2"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti"],"context":"ejemplo del informe: 12 unidades × chatusra gati","sources":["meta-análisis §2.5 CIC.4.2"]},"status":"H","verify":false,"step_value":0.25,"meter":"12/4","generator":{"type":"carnatic_tala","family":"matya","jati":"khanda","gati":4},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"},{"id":"CIC.4.2/misra_jhampa","name":"Misra jati jhampa (10 unidades)","taxonomy":["CIC.4.2","MET.3.2"],"origin":{"tradition":"India del sur (carnática)","genre":["kriti"],"context":"laghu de 7 + anudrutam + drutam","sources":["meta-análisis §2.5 CIC.4.2"]},"status":"H","verify":false,"step_value":0.5,"meter":"10/4","generator":{"type":"carnatic_tala","family":"jhampa","jati":"misra","gati":2},"layers":[],"transforms_allowed":["density"],"destinations":["ethnic","others","arpeggio"],"categories":["world_cycles"],"tags":["india","tala","carnatic"],"bpm_range":[40,160],"repeat_policy":{"mode":"tihai","default_repeats":3,"variation_on_last":"tihai"},"family":"tala"}]};

var __svCache = {};
function __svJoin(from, req) {
  var base = from.split('/'); base.pop();
  var segs = req.split('/');
  for (var i = 0; i < segs.length; i++) {
    if (segs[i] === '.' || segs[i] === '') continue;
    if (segs[i] === '..') base.pop(); else base.push(segs[i]);
  }
  var p = base.join('/');
  return /\.(js|json)$/.test(p) ? p : p + '.js';
}
function __svRequire(key) {
  if (__svCache[key]) return __svCache[key].exports;
  if (!__svDefs[key]) throw new Error('SV bundle: módulo ausente ' + key);
  var mod = { exports: {} };
  __svCache[key] = mod;
  __svDefs[key].call(mod.exports, mod, mod.exports, function (req) { return __svRequire(__svJoin(key, req)); });
  return mod.exports;
}
var __sv = {
  version: "0.5.0",
  build: "0.5.0+8f41916305d6",
  core: __svRequire('src/core/index.js'),
  bridge: __svRequire('src/max/live_bridge.js'),
  controller: __svRequire('src/max/controller.js'),
  ui: __svRequire('src/ui/index.js'),
  data: __svData
};
if (typeof module !== 'undefined' && module.exports) module.exports = __sv;
