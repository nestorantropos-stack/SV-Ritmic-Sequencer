'use strict';
// Medidas de corpus sobre notas en negras: agrupación en acordes, voicings,
// cuantización a rejilla, histogramas de ataque y microtiempo.

const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Agrupa notas cuyo ataque cae dentro de `tol` negras en un mismo evento (acorde).
function groupChords(notes, tol = 1 / 32) {
  const out = [];
  for (const n of [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch)) {
    const last = out[out.length - 1];
    if (last && n.start - last.start <= tol) last.notes.push(n);
    else out.push({ start: n.start, notes: [n] });
  }
  for (const c of out) {
    c.notes.sort((a, b) => a.pitch - b.pitch);
    c.pitches = c.notes.map((n) => n.pitch);
    c.duration = Math.max(...c.notes.map((n) => n.duration));
    c.velocity = Math.round(c.notes.reduce((s, n) => s + n.velocity, 0) / c.notes.length);
    c.intervals = c.pitches.map((p) => p - c.pitches[0]);
  }
  return out;
}

// Nombre de la forma interválica del voicing respecto de una raíz de clase de altura.
function voicingRelativeTo(pitches, rootPc) {
  return pitches.map((p) => ((p - rootPc) % 12 + 12) % 12);
}

// Cuantiza un ataque a la rejilla (paso en negras) y devuelve paso y desviación en fracción de paso.
function quantize(start, step) {
  const idx = Math.round(start / step);
  return { idx, dev: start / step - idx };
}

function histogram(values, size) {
  const h = new Array(size).fill(0);
  for (const v of values) h[((v % size) + size) % size]++;
  return h;
}

// Elige entre rejilla de semicorcheas (0.25) y de tresillos de corchea (1/3) según el error medio.
function bestGrid(starts) {
  const err = (step) => starts.reduce((s, t) => s + Math.abs(quantize(t, step).dev), 0) / Math.max(1, starts.length);
  const e16 = err(0.25);
  const e12 = err(1 / 3);
  return e12 + 0.02 < e16 ? { step: 1 / 3, perBeat: 3, error: e12 } : { step: 0.25, perBeat: 4, error: e16 };
}

// Clave tonal desde el nombre de archivo: "_Am", "_F#m", "_Bb" ...
function keyFromName(name) {
  const m = /_([A-G](?:#|b)?)(m?)(?:[_.\s]|$)/.exec(name);
  if (!m) return null;
  const flat = { Db: 'C#', Gb: 'F#', 'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab' };
  const nm = flat[m[1]] || m[1];
  return { root: PC_NAMES.indexOf(nm), name: nm + m[2], minor: m[2] === 'm' };
}

module.exports = { PC_NAMES, groupChords, voicingRelativeTo, quantize, histogram, bestGrid, keyFromName };
