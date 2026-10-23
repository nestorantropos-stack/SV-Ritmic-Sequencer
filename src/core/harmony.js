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
