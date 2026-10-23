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
