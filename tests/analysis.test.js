'use strict';
// Modo Adaptable: casos tomados de la prueba en Live (PM-011).
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');

const D = loadAll();
const n = (p, t, d, v = 90) => ({ pitch: p, start_time: t, duration: d, velocity: v });

test('Re menor con dos tríadas (Dm, Bb) y bombo de 1 compás en bucle', () => {
  const chords = [...[62, 65, 69].flatMap((p) => [n(p, 0, 4), n(p, 4, 4)]), ...[58, 62, 65].flatMap((p) => [n(p, 8, 4), n(p, 12, 4)])];
  const tracks = [
    { name: '2-MIDI', isDrum: true, notes: [0, 1, 2, 3].map((t) => n(36, t, 0.25, 110)), length: 4 },
    { name: 'Pad', notes: chords, length: 16 },
  ];
  const s = core.analysis.analyzeSet(tracks, { scales: D.scales.scales });
  assert.equal(s.key.name, 'D menor');
  assert.equal(s.scale[0].id, 'minor', `escala elegida: ${s.scale[0].id}`);
  assert.equal(s.scale[0].root, 2);
  assert.deepEqual([0, 4, 8, 12].map((i) => s.occupancy[i]), [1, 1, 1, 1], 'el bombo de 1 compás ocupa los cuatro pulsos');
  assert.equal(s.occupancy[2], 0);
});

test('Do mayor con muchas clases de altura elige mayor; La menor armónica con sol#', () => {
  const cmaj = [60, 62, 64, 65, 67, 69, 71].map((p, i) => n(p, i, 1));
  assert.equal(core.analysis.analyzeSet([{ name: 'm', notes: [...cmaj, n(60, 8, 4), n(64, 8, 4), n(67, 8, 4)], length: 12 }], { scales: D.scales.scales }).scale[0].id, 'major');
  const aharm = [69, 71, 72, 74, 76, 77, 80, 81, 69, 72, 76, 80, 76].map((p, i) => n(p, i, 1));
  const s = core.analysis.analyzeSet([{ name: 'm', notes: aharm, length: 16 }], { scales: D.scales.scales });
  assert.equal(s.scale[0].root, 9);
  assert.equal(s.scale[0].id, 'harmonic_minor');
});
