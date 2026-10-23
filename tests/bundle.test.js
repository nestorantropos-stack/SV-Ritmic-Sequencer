'use strict';
// El bundle para v8 funciona sin Node (sin fs ni path) y produce exactamente lo mismo que los módulos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { build } = require('../tools/bundle');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');
const { createFakeLive, sampleModel } = require('./helpers/fake_live');

const out = path.join(os.tmpdir(), `sv_rs_engine_test_${process.pid}.js`);
const info = build(out);
// carga en un contexto aislado: solo existen module/exports, como en un require de v8
const sandbox = { module: { exports: {} }, console };
vm.runInNewContext(fs.readFileSync(out, 'utf8'), sandbox, { filename: 'sv_rs_engine.js' });
const SV = sandbox.module.exports;

test('el bundle incluye núcleo, puente, controlador y datos', () => {
  assert.ok(info.modules.includes('src/core/engine.js'));
  assert.ok(info.modules.includes('src/core/destinations/chords.js'));
  assert.ok(info.modules.includes('src/max/controller.js'));
  assert.equal(SV.data.patterns.length, loadAll().patterns.length);
  assert.equal(typeof SV.core.generate, 'function');
  assert.ok(info.bytes < 2_000_000, `tamaño razonable: ${info.bytes}`);
});

test('el bundle genera lo mismo que los módulos', () => {
  const D = loadAll();
  for (const [id, dest] of [['RGG.10.2/stab_weighted', 'chords'], ['CIC.4.1/teental', 'ethnic'], ['GRV.9/trap', 'hihats'], ['RGG.10.2/bass_swung_16', 'bassline']]) {
    const o = { destination: dest, seed: 'eq', harmony: { root: 0, intervals: [0, 2, 3, 5, 7, 8, 10] }, category: 'dub_techno', rollProb: 0.2 };
    const a = core.generate(D.patterns.find((p) => p.id === id), o, D);
    const b = SV.core.generate(SV.data.patterns.find((p) => p.id === id), o, SV.data);
    assert.equal(JSON.stringify(b), JSON.stringify(a), id);
  }
});

test('el controlador del bundle escribe un clip contra la Live API simulada', () => {
  const fake = createFakeLive(sampleModel());
  const bridge = SV.bridge.createBridge(fake.LiveAPI);
  const ctl = SV.controller.createController({ core: SV.core, data: SV.data, bridge });
  const s = ctl.generate();
  assert.ok(s.notes > 0);
  assert.equal(fake.model.tracks[2].clip_slots[0].clip.notes.length, s.notes);
  fs.unlinkSync(out);
});
