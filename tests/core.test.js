'use strict';
// Pruebas de los algoritmos del §4 del informe con los ejemplos verificables que el propio informe da.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');
const { transforms: T } = core;
const { loadAll } = require('../tools/lib/data');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('euclidiano: ejemplos de Toussaint (§4.1)', () => {
  assert.ok(core.isRotationOf(core.euclid(3, 8), [0, 3, 6], 8), 'E(3,8) ~ tresillo');
  assert.ok(core.isRotationOf(core.euclid(5, 8), [0, 2, 3, 5, 6], 8), 'E(5,8) ~ cinquillo');
  assert.ok(core.isRotationOf(core.euclid(7, 12), [0, 2, 4, 5, 7, 9, 11], 12), 'E(7,12) ~ standard pattern');
  assert.ok(core.isRotationOf(core.euclid(5, 16), [0, 3, 6, 10, 13], 16), 'E(5,16) ~ bossa clave');
  assert.equal(core.euclid(4, 16).length, 4);
  assert.deepEqual(core.euclid(0, 8), []);
  assert.deepEqual(core.euclid(8, 8), [0, 1, 2, 3, 4, 5, 6, 7]);
  // la rotación desplaza todos los ataques
  assert.deepEqual(core.euclid(3, 8, 1), core.euclid(3, 8).map((o) => (o + 1) % 8).sort((a, b) => a - b));
});

test('pesos métricos: reproduce Longuet-Higgins y Lee (COG.3.1)', () => {
  assert.deepEqual(core.meterWeights([2, 2, 2, 2]), core.LHL_16);
  assert.deepEqual(core.meterWeights([3]), [0, -1, -1]);
  assert.deepEqual(core.groupingWeights([2, 2, 3]), [0, -2, -1, -2, -1, -2, -2]);
  assert.deepEqual(core.levelsFor(16, '4/4', 0.25), [2, 2, 2, 2]);
  assert.deepEqual(core.levelsFor(12, '12/8', 0.5), [2, 2, 3]);
  assert.deepEqual(core.levelsFor(32, '4/4', 0.25), [2, 2, 2, 2, 2]);
  assert.equal(core.levelsFor(7, '7/8', 0.5).reduce((p, v) => p * v, 1), 7);
});

test('aksak: composiciones de n en 2 y 3 (§4.3)', () => {
  assert.deepEqual(core.aksak(7), [[2, 2, 3], [2, 3, 2], [3, 2, 2]]);
  assert.deepEqual(core.aksak(5), [[2, 3], [3, 2]]);
  assert.deepEqual(core.aksak(1), []);
  for (let n = 2; n <= 16; n++) for (const c of core.aksak(n)) assert.equal(c.reduce((s, v) => s + v, 0), n);
  // número de composiciones: sucesión de Padovan desplazada
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => core.aksak(n).length), [1, 1, 1, 2, 2, 3, 4, 5, 7]);
});

test('tala carnática (§4.4)', () => {
  const adi = core.carnaticTala('triputa', 'chatusra', 4);
  assert.equal(adi.cycle_len, 32, 'Adi tala en chatusra nadai = 32 matras');
  assert.deepEqual(adi.grouping, [16, 8, 8]);
  assert.equal(core.carnaticTala('matya', 'khanda', 4).cycle_len, 48, 'khanda jati matya = 48 matras');
  const all = core.allCarnaticTalas();
  assert.equal(all.length, 35, '7 familias × 5 jatis');
  const lens = all.map((t) => t.units);
  assert.equal(Math.min(...lens), 3, 'tisra eka');
  assert.equal(Math.max(...lens), 29, 'sankeerna dhruva');
  assert.equal(adi.weights[0], 0);
  assert.equal(adi.weights[16], -1);
});

test('tihai: la llegada cae en sam (§4.5)', () => {
  for (const cycle of [7, 10, 12, 16, 32]) for (let P = 1; P <= 9; P++) for (let G = 0; G <= 3; G++) {
    const t = core.tihaiOnsets([0], P, G, cycle);
    assert.equal(t.landing % cycle, 0, `P=${P} G=${G} ciclo=${cycle}`);
    assert.equal(t.start, core.tihaiStart(P, G, cycle));
  }
  assert.equal(core.tihaiStart(5, 1, 16), 16 - 17 % 16);
});

test('índice de síncopa y mutación hacia objetivo (§4.6)', () => {
  const w = core.LHL_16;
  const b = (on) => core.toBool(on, 16);
  assert.equal(core.syncopation(b([0, 4, 8, 12]), w), 0, 'four-on-the-floor sin síncopa');
  assert.ok(core.syncopation(b([2, 6, 10, 14]), w) > 0, 'contratiempo sincopa');
  assert.ok(core.syncopation(b([0, 3, 6, 10, 12]), w) > 0, 'son clave sincopa');
  const rngA = core.createRng(42);
  const rngB = core.createRng(42);
  const start = [0, 4, 8, 12, 14];
  const a = core.mutateTowardTarget(start, w, 0.4, rngA);
  const bb = core.mutateTowardTarget(start, w, 0.4, rngB);
  assert.deepEqual(a, bb, 'determinista por semilla');
  assert.equal(a.length, start.length, 'conserva el número de ataques');
  const err = (on) => Math.abs(core.syncopation(b(on), w) / core.maxSyncopation(w) - 0.4);
  assert.ok(err(a) <= err(start), 'se acerca al objetivo');
  const locked = core.mutateTowardTarget(start, w, 0.9, core.createRng(1), { locked: [0] });
  assert.ok(locked.includes(0), 'respeta pasos bloqueados');
});

test('swing dependiente del tempo (§4.9)', () => {
  near(core.swingOddOffset(1), 0);
  near(core.swingOddOffset(2), 1 / 3);
  near(core.swingOddOffset(5 / 3), 0.25); // moda del corpus DDT: 62,5 %
  near(core.effectiveSwingRatio(2, 140, 0), 2);
  near(core.effectiveSwingRatio(2, 90, 1), 2);
  assert.ok(core.effectiveSwingRatio(2, 180, 1) < core.effectiveSwingRatio(2, 120, 1), 'a más tempo, menos swing');
  near(core.effectiveSwingRatio(2, 210, 1), 1);
  assert.deepEqual(core.swingOffsets([0, 1, 2, 3], 1, 2).map((v) => +v.toFixed(4)), [0, 0.3333, 0, 0.3333]);
  assert.deepEqual(core.swingOffsets([0, 2, 4, 6], 2, 1.5).map((v) => +v.toFixed(4)), [0, 0.4, 0, 0.4]);
});

test('rejilla deformable y telespringar (§4.10, MIC.2.3)', () => {
  const g = core.gridFromBeatProportions([0.38, 0.34, 0.28], 1);
  g.forEach((v, i) => near(v, [0, 0.38, 0.72][i]));
  near(core.timeOfStep(1, g, 0, 3), 1.14);
  near(core.timeOfStep(4, g, 0, 3), 3 + 1.14);
  assert.deepEqual(core.gridPositions([1, 1, 1, 1]), [0, 0.25, 0.5, 0.75]);
});

test('humanizador browniano: determinista y con la dispersión pedida (MIC.4)', () => {
  const a = core.brownianOffsets(4000, core.createRng(7), { sigmaMs: 5, drift: 0.8 });
  const b = core.brownianOffsets(4000, core.createRng(7), { sigmaMs: 5, drift: 0.8 });
  assert.deepEqual(a, b);
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length);
  assert.ok(sd > 4 && sd < 6, `sd=${sd}`);
  // correlación de lag 1 cercana a drift (ruido browniano, no blanco)
  let c = 0;
  for (let i = 1; i < a.length; i++) c += (a[i] - mean) * (a[i - 1] - mean);
  const r1 = c / (a.length - 1) / (sd * sd);
  assert.ok(r1 > 0.7 && r1 < 0.9, `r1=${r1}`);
  near(core.msToBeats(500, 120), 1);
});

test('fase, polimetría, polirritmia e irama (§4.7, §4.8, SUP.1)', () => {
  assert.equal(core.realignLength([16, 12]), 48);
  assert.equal(core.realignLength([16, 5]), 80);
  near(core.phaseTempo(120, 0.01), 121.2);
  assert.equal(core.polymeterStep(50, 12), 2);
  const pr = core.polyrhythm([3, 2]);
  assert.equal(pr.cycle_len, 6);
  assert.deepEqual(pr.layers.map((l) => l.onsets), [[0, 2, 4], [0, 3]]);
  assert.equal(core.elaborationDensity(1, 3), 8);
  assert.equal(core.gongCycleDuration(16, 2, 2), 32);
  assert.deepEqual(core.IRAMA.map((x) => x.strokes), [1, 2, 4, 8, 16]);
  assert.equal(core.isTextureRate(0.0625, 140), true, 'fusa a 140 BPM < 100 ms');
  assert.equal(core.isTextureRate(0.25, 140), false);
});

test('hoquetus, kotekan y arco jo-ha-kyū (§4.11, §4.12)', () => {
  const v = core.hocket([0, 2, 3, 5, 6], 2, 'alternate');
  assert.deepEqual(v, [[0, 3, 6], [2, 5]]);
  const k = core.hocket([0, 1, 2, 3, 4, 5, 6, 7], 2, 'kotekan', { beatSteps: 2 });
  assert.deepEqual(k, [[0, 2, 4, 6], [1, 3, 5, 7]]);
  const r = core.hocket([0, 1, 2], 2, 'register', { pitches: [40, 70, 50], split: 60 });
  assert.deepEqual(r, [[0, 2], [1]]);
  const pair = core.kotekanPair(8, 2);
  assert.deepEqual([...pair.polos, ...pair.sangsih].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  let prev = -Infinity;
  for (let i = 0; i <= 100; i++) { const val = core.jhk(i / 100); assert.ok(val >= prev - 1e-12, 'jo-ha-kyū no decrece'); prev = val; }
  near(core.jhk(0), 0.2);
  near(core.jhk(1), 1);
  assert.ok(Number.isFinite(core.jhk(0.6, 2)));
});

test('transformaciones de collar (PRO.14) y binarización (CIC.3)', () => {
  assert.deepEqual(T.rotate([0, 3, 6, 10, 12], 16, 8), [2, 4, 8, 11, 14], 'clave 3-2 → 2-3');
  const clave = [0, 3, 6, 10, 12];
  assert.deepEqual(T.reverse(T.reverse(clave, 16), 16), clave, 'la retrogradación es involutiva');
  assert.deepEqual(core.ioi(T.reverse(clave, 16), 16), [4, 2, 4, 3, 3], 'intervalos al revés');
  assert.deepEqual(T.complement([0, 2, 4, 6], 8), [1, 3, 5, 7]);
  const w = core.LHL_16;
  const less = T.density([0, 3, 6, 10, 12], 16, w, -0.4);
  assert.equal(less.length, 3);
  assert.ok(less.includes(0), 'conserva el paso más fuerte');
  const more = T.density([0, 8], 16, w, 0.15);
  assert.ok(more.includes(4) && more.includes(12), 'añade en los pulsos fuertes vacíos');
  assert.equal(T.densityTo([0, 3, 6, 10, 12], 16, w, 7).length, 7);
  assert.ok(T.density([0, 3, 6], 8, [0, -3, -2, -3, -1, -3, -2, -3], -1, null, [0]).includes(0), 'locked');
  const bin = T.binarize([0, 2, 4, 5, 7, 9, 11], 12, 16, 'nearest');
  assert.deepEqual(bin, [0, 3, 5, 7, 9, 12, 15]);
  assert.equal(T.binarize([0, 1, 2], 12, 16, 'floor').length, 3, 'resuelve colisiones');
});

test('rng: reproducible por semilla, numérica o de texto', () => {
  const a = core.createRng('SV-001');
  const b = core.createRng('SV-001');
  const xs = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b.next()));
  assert.notDeepEqual(xs, Array.from({ length: 20 }, () => core.createRng('SV-002').next()));
  const r = core.createRng(3);
  for (let i = 0; i < 500; i++) { const v = r.int(2, 5); assert.ok(v >= 2 && v <= 5); }
  assert.equal(core.createRng(9).weighted([0, 0, 5, 0]), 2);
  assert.deepEqual(core.createRng(5).fork('kick').next(), core.createRng(5).fork('kick').next());
});

test('medidas: densidad, uniformidad y entropía (COG.3.5–3.7)', () => {
  near(core.density([0, 4, 8, 12], 16), 0.25);
  near(core.evenness([0, 4, 8, 12], 16), 0);
  assert.ok(core.evenness([0, 1, 2, 3], 16) > core.evenness([0, 3, 6, 10, 12], 16));
  near(core.ioiEntropy([0, 4, 8, 12], 16), 0);
  assert.ok(core.ioiEntropy([0, 3, 6, 10, 12], 16) > 0.9);
});

test('normalización: todos los patrones del catálogo se resuelven', () => {
  const D = loadAll();
  for (const p of D.patterns) {
    const n = core.normalizePattern(p, { rng: core.createRng(p.id) });
    assert.ok(Number.isInteger(n.cycle_len) && n.cycle_len > 0, `${p.id}: cycle_len`);
    assert.equal(n.weights.length, n.cycle_len, `${p.id}: pesos`);
    for (const l of n.layers) {
      for (const o of l.onsets) assert.ok(o < l.cycle_len, `${p.id}/${l.role}`);
      assert.equal(l.velocity.length, l.onsets.length);
      for (const v of l.velocity) assert.ok(v >= 1 && v <= 127, `${p.id}: velocity ${v}`);
    }
  }
  const adi = core.normalizePattern(D.patterns.find((p) => p.id === 'CIC.4.2/adi_tala'));
  assert.equal(adi.cycle_len, 32);
  near(adi.cycle_beats, 8);
  const e = core.normalizePattern(D.patterns.find((p) => p.id === 'PRO.1/e_3_8'));
  assert.equal(e.layers[0].onsets[0], 0, 'euclidiano alineado al paso 0');
  const poly = core.normalizePattern(D.patterns.find((p) => p.id === 'SUP.2.1/polymeter_16_12'));
  const tiled = core.tileLayer(poly.layers[1], poly.cycle_len);
  assert.equal(tiled.onsets.length, 16, 'capa de 12 repetida 4 veces en 48 pasos');
  // weighted_steps: misma semilla, mismo resultado
  const ws = D.patterns.find((p) => p.id === 'RGG.10.2/stab_weighted');
  const a = core.normalizePattern(ws, { rng: core.createRng(11) }).layers[0].onsets;
  const b = core.normalizePattern(ws, { rng: core.createRng(11) }).layers[0].onsets;
  assert.deepEqual(a, b);
  assert.ok(a.length >= 2 && a.length <= 5);
  assert.throws(() => core.normalizePattern(ws), /semilla/);
});
