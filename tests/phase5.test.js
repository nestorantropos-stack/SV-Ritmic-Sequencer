'use strict';
// Fase 5: Sugerir, preajustes, historial, exportar .mid, atajos y sincronización de parámetros.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');
const { parseSMF } = require('../tools/lib/smf');
const { createBridge } = require('../src/max/live_bridge');
const { createController } = require('../src/max/controller');
const { createFakeLive, sampleModel } = require('./helpers/fake_live');
const M = require('../src/ui/model');
const strip = require('../src/ui/strip');
const panel = require('../src/ui/panel');
const { recorderCanvas } = require('../src/ui/canvas');
const { build } = require('../tools/bundle');

const D = loadAll();
const S = core.suggest;
const OCC_4 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

test('Sugerir: tres propuestas con razones, aptas para el destino y públicas', () => {
  const ctx = { tempo: 124, timeSignature: '4/4', names: ['5-Chord Dub Pluck', '6-5P_DDT_Bass_Korg1'], analysis: { occupancy: OCC_4, density: 0.25 } };
  for (const dest of ['chords', 'hihats', 'bassline', 'ethnic', 'arpeggio', 'others']) {
    const out = S.suggest(D.patterns, ctx, { destination: dest });
    assert.equal(out.length, 3, dest);
    for (const s of out) {
      const p = D.patterns.find((x) => x.id === s.id);
      assert.ok(p.destinations.includes(dest), `${s.id} apto para ${dest}`);
      assert.ok(!core.catalog.isRestricted(p) && !p.missing_data, `${s.id} público y completo`);
      assert.ok(s.reasons.length >= 1, `${s.id} con razones`);
    }
    assert.ok(out[0].score >= out[1].score && out[1].score >= out[2].score);
  }
  const chords = S.suggest(D.patterns, ctx, { destination: 'chords' });
  assert.ok(chords.every((s) => /dub techno|RGG\.10\.2|GRV\.14/.test(`${s.id} ${s.name}`.toLowerCase()) || s.id.startsWith('RGG.10.2') || s.id.startsWith('GRV.14')), 'un set de dub techno a 124 BPM propone dub techno');
  assert.ok(chords[0].reasons.some((r) => /124 BPM/.test(r)));
  assert.ok(chords[0].reasons.some((r) => /dub|ddt/.test(r)));
});

test('Sugerir: tempo, compás, complementariedad, género y variedad', () => {
  const p = D.patterns.find((x) => x.id === 'RGG.10.3/dubstep_halftime');
  assert.equal(S.tempoScore(p, 140).s, 1);
  assert.ok(S.tempoScore(p, 70).s >= 0.75, 'medio tiempo');
  assert.ok(S.tempoScore(p, 95).s < 0.3);
  assert.equal(S.meterScore(D.patterns.find((x) => x.id === 'CIC.3.4/son_clave_3_2'), '4/4').s, 1);
  assert.ok(S.meterScore(D.patterns.find((x) => x.id === 'MET.3.3/aksak_7_223'), '4/4').s < 0.5);
  const offbeat = D.patterns.find((x) => x.id === 'RGG.4.2/hat_offbeat');
  const onbeat = D.patterns.find((x) => x.id === 'GRV.7/steppers');
  assert.ok(S.complementScore(offbeat, { occupancy: OCC_4 }).s > S.complementScore(onbeat, { occupancy: OCC_4 }).s, 'el contratiempo complementa un bombo en cuatro');
  assert.deepEqual(S.words(['2-MIDI', 'Wavetable', 'Dub Delay', 'Flamenco palmas']).sort(), ['dub', 'flamenco', 'palmas']);
  const flam = D.patterns.find((x) => x.id === 'CIC.7/solea');
  assert.ok(S.genreScore(flam, ['Flamenco palmas']).s > 0);
  const base = S.suggest(D.patterns, { tempo: 124, names: ['dub'] }, { destination: 'hihats' });
  const again = S.suggest(D.patterns, { tempo: 124, names: ['dub'], recent: [base[0].id, base[0].id] }, { destination: 'hihats' });
  assert.notEqual(again[0].id, base[0].id, 'evita repetir lo usado hace poco');
});

const setup = () => {
  const fake = createFakeLive(sampleModel());
  const bridge = createBridge(fake.LiveAPI);
  return { fake, bridge, ctl: createController({ core, data: D, bridge }) };
};

test('controlador: sugerir lee el set (tempo, nombres, clips) y usar una sugerencia', () => {
  const { ctl, bridge } = setup();
  const info = bridge.describeSet();
  assert.equal(info.tempo, 124);
  assert.ok(info.tracks.find((t) => t.name === 'Drums').clips.includes('beat'), 'nombres de clips');
  assert.equal(info.filePath, null, 'la ruta del set no está en la Live API simulada');
  ctl.setDestination('bassline');
  const r = ctl.suggest();
  assert.equal(r.suggestions.length, 3);
  assert.equal(r.context.tempo, 124);
  const id = r.suggestions[1].id;
  ctl.useSuggestion(1);
  assert.equal(ctl.state.patternId, id);
});

test('controlador: preajustes, historial navegable, exportar .mid e índices de parámetros', () => {
  const { ctl, fake } = setup();
  ctl.setPattern('RGG.10.2/stab_1_7_15');
  ctl.setHarmony(2, 'dorian');
  ctl.setRepeats(8);
  const list = ctl.savePreset('Mi dub');
  assert.equal(list[0].name, 'Mi dub');
  ctl.setPattern('GRV.1/four_on_the_floor');
  ctl.setHarmony(0, 'minor');
  ctl.loadPreset(0);
  assert.equal(ctl.state.patternId, 'RGG.10.2/stab_1_7_15');
  assert.equal(ctl.state.root, 2);
  assert.equal(ctl.state.scaleId, 'dorian');
  assert.equal(ctl.state.repeats, 8);
  const idx = ctl.paramIndices();
  assert.equal(idx.p_raiz, 2);
  assert.equal(D.scales.scales[idx.p_escala].id, 'dorian');
  assert.equal(idx.p_repeticiones, 3);
  assert.equal(core.catalog.publicPatterns(D.patterns)[idx.p_ritmo].id, 'RGG.10.2/stab_1_7_15');
  ctl.savePreset('');
  assert.match(ctl.listPresets()[1].name, /Stab/, 'nombre automático');
  assert.equal(ctl.deletePreset(0).length, 1);
  // historial
  ctl.generate();
  ctl.regenerate();
  ctl.vary();
  const h = ctl.historyList();
  assert.equal(h.length, 3);
  assert.ok(h[2].current);
  const back = ctl.gotoHistory(0);
  assert.equal(back.seed, h[0].seed);
  assert.ok(ctl.historyList()[0].current);
  assert.equal(fake.model.tracks[2].clip_slots[0].clip.notes.length, back.notes, 'reescribe la generación elegida');
  // exportar
  const e = ctl.exportMidi();
  const smf = parseSMF(Buffer.from(e.bytes));
  assert.equal(smf.notes.length, e.notes);
  assert.equal(Math.round(smf.tempos[0].bpm), 124);
  assert.ok(!/[\\/:*?"<>|]/.test(e.name), 'nombre de archivo válido');
});

test('interfaz: superposición de sugerencias, pestañas del panel y atajos', () => {
  const m = M.create({ core, data: D });
  const sug = S.suggest(D.patterns, { tempo: 124, names: ['dub'] }, { destination: 'chords' });
  M.receive(m, 'suggestions', JSON.stringify({ suggestions: sug }));
  assert.equal(m.showSuggest, true);
  let hits = strip.draw(recorderCanvas(), m);
  const uses = hits.filter((k) => k.action.name === 'use_suggestion');
  assert.deepEqual(uses.map((k) => k.action.value), [0, 1, 2]);
  const close = hits.find((k) => k.action.name === 'close_suggest');
  assert.ok(strip.applyUiAction(m, close.action));
  assert.equal(m.showSuggest, false);
  hits = strip.draw(recorderCanvas(), m);
  assert.ok(hits.some((k) => k.action.name === 'suggest'), 'botón Sugerir');
  // panel
  M.receive(m, 'history', JSON.stringify([{ i: 0, seed: 1, name: 'Stab', current: false }, { i: 1, seed: 2, name: 'Stab', current: true }]));
  M.receive(m, 'presets', JSON.stringify([{ i: 0, name: 'Mi dub' }]));
  panel.applyUiAction(m, { name: 'tab', value: 'history' });
  hits = panel.draw(recorderCanvas(), m);
  assert.deepEqual(hits.filter((k) => k.action.name === 'history_goto').map((k) => k.action.value), [1, 0], 'más reciente primero');
  panel.applyUiAction(m, { name: 'tab', value: 'presets' });
  hits = panel.draw(recorderCanvas(), m);
  assert.ok(hits.some((k) => k.action.name === 'preset_save'));
  assert.ok(hits.some((k) => k.action.name === 'preset_load' && k.action.value === 0));
  assert.ok(hits.some((k) => k.action.name === 'preset_delete'));
  assert.ok(hits.some((k) => k.action.name === 'export_midi'));
  // atajos: solo letras en mayúscula; las minúsculas son texto del buscador
  assert.equal(panel.keyAction(m, 'g'.charCodeAt(0)), null);
  assert.deepEqual(panel.keyAction(m, 'G'.charCodeAt(0)), { kind: 'cmd', name: 'generate' });
  assert.equal(panel.keyAction(m, 'P'.charCodeAt(0)).name, 'audition');
  m.panel.onlyDest = false;
  const before = m.panel.selected || m.state.patternId;
  panel.keyAction(m, 29);
  assert.notEqual(m.panel.selected, before, 'flecha → elige el siguiente');
  const use = panel.keyAction(m, 13);
  assert.equal(m.lists.patterns[use.value], m.panel.selected, 'Intro usa el elegido');
});

test('script v8: preajustes en Dict, sincronía de live.*, sugerir y exportar con File', () => {
  const out = path.join(os.tmpdir(), `sv_rs_engine_p5_${process.pid}.js`);
  build(out);
  const box = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(out, 'utf8'), box);
  fs.unlinkSync(out);
  const fake = createFakeLive(sampleModel());
  const dicts = {};
  class Dict { constructor(name) { this.name = name; dicts[name] = dicts[name] || {}; } get(k) { return dicts[this.name][k]; } set(k, v) { dicts[this.name][k] = v; } }
  const files = {};
  class File { constructor(p) { this.p = p; this.isopen = /exports\//.test(p); this.position = 0; } writebytes(b) { files[this.p] = b.slice(); this.position = b.length; } close() {} }
  class Task { constructor(fn) { this.fn = fn; } schedule() {} cancel() {} }
  const outlets = [];
  const ctx = {
    post: () => {}, outlet: (i, ...a) => outlets.push([i, ...a]), LiveAPI: fake.LiveAPI, Task, Dict, File,
    require: () => box.module.exports, arrayfromargs: (a) => Array.from(a), messagename: '',
    patcher: { filepath: 'C:/Users/X/Documents/Ableton/User Library/Presets/MIDI Effects/Max MIDI Effect/SV Ritmic Sequencer/SV Ritmic Sequencer.amxd' },
  };
  ctx.this = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'max', 'sv_rs_v8.js'), 'utf8'), ctx);
  ctx.presets_dict('1234_sv_rs_presets');
  ctx.init();
  const last = (type) => { const o = outlets.filter((x) => x[0] === 0 && x[1] === type).pop(); return o ? JSON.parse(o[2]) : null; };
  ctx.preset_save('Uno');
  assert.equal(JSON.parse(dicts['1234_sv_rs_presets'].json)[0].name, 'Uno', 'el preajuste queda en el dict');
  ctx.generate();
  assert.ok(outlets.some((o) => o[0] === 4 && o[1] === 'p_semilla'), 'la semilla vuelve al live.numbox');
  ctx.preset_load(0);
  const sync = outlets.filter((o) => o[0] === 4).map((o) => o[1]);
  for (const k of ['p_destino', 'p_armonia', 'p_raiz', 'p_escala', 'p_ritmo', 'p_repeticiones', 'p_semilla']) assert.ok(sync.includes(k), `sincroniza ${k}`);
  ctx.suggest();
  assert.equal(last('suggestions').suggestions.length, 3);
  ctx.use_suggestion(0);
  assert.equal(last('state').patternId, last('suggestions').suggestions[0].id);
  ctx.history();
  assert.ok(last('history').length >= 1);
  ctx.export_midi();
  const written = Object.keys(files)[0];
  assert.ok(written && written.endsWith('.mid') && written.includes('/SV Ritmic Sequencer/exports/'), `exporta a exports/: ${written}`);
  assert.equal(parseSMF(Buffer.from(files[written])).notes.length, last('exported').notes);
});
