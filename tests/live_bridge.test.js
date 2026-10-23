'use strict';
// Puente con la Live API y controlador del dispositivo, contra una Live API simulada.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');
const { createBridge, parseDictResult, idOf, str } = require('../src/max/live_bridge');
const { createController } = require('../src/max/controller');
const { createFakeLive, sampleModel } = require('./helpers/fake_live');

const D = loadAll();
const setup = (mut) => {
  const model = sampleModel();
  if (mut) mut(model);
  const fake = createFakeLive(model);
  const bridge = createBridge(fake.LiveAPI);
  return { model, fake, bridge, ctl: createController({ core, data: D, bridge }) };
};

test('utilidades de respuesta de la Live API', () => {
  assert.equal(idOf(['id', 7]), 7);
  assert.equal(idOf(7), 7);
  assert.equal(str(['"live_set tracks 0"']), 'live_set tracks 0');
  assert.deepEqual(parseDictResult('{"notes":[{"pitch":60}]}'), { notes: [{ pitch: 60 }] });
  assert.deepEqual(parseDictResult({ notes: [] }), { notes: [] });
  assert.deepEqual(parseDictResult('no json'), { notes: [] });
});

test('lee el set, la pista propia y la escala de Live 12', () => {
  const { bridge } = setup();
  assert.deepEqual(bridge.setInfo(), { tempo: 124, timeSignature: '4/4', barBeats: 4, trackCount: 4, sceneCount: 4 });
  assert.equal(bridge.ownTrack().path, 'live_set tracks 2');
  const sc = bridge.readScale();
  assert.deepEqual(sc, { root_note: 9, scale_name: 'Minor', scale_mode: true, scale_intervals: [0, 2, 3, 5, 7, 8, 10] });
  const h = core.analysis.liveScaleToHarmony(sc, D.scales.scales);
  assert.equal(h.id, 'minor');
  assert.equal(h.root, 9);
});

test('escribe el clip en la primera ranura vacía de la pista propia, sin tocar clips ajenos', () => {
  const { model, bridge, fake } = setup();
  const p = D.patterns.find((x) => x.id === 'RGG.10.2/stab_weighted');
  const r = core.generate(p, { destination: 'chords', category: 'dub_techno', harmony: { root: 9, intervals: [0, 2, 3, 5, 7, 8, 10] }, seed: 3 }, D);
  const w = bridge.writeClip(r, { name: 'Dub techno' });
  assert.equal(w.slot, 0, 'la ranura 0 está vacía; la 1 tiene un clip del usuario');
  const clip = model.tracks[2].clip_slots[0].clip;
  assert.equal(clip.length, r.length_beats);
  assert.equal(clip.looping, 1);
  assert.equal(clip.name, 'SV · Dub techno');
  assert.equal(clip.notes.length, r.notes.length);
  for (const n of clip.notes) assert.deepEqual(Object.keys(n).sort(), ['duration', 'mute', 'pitch', 'probability', 'start_time', 'velocity', 'velocity_deviation'], 'solo campos de add_new_notes');
  assert.equal(model.tracks[2].clip_slots[1].clip.notes.length, 1, 'el clip del usuario queda intacto');
  assert.ok(fake.calls.some((c) => c[2] === 'add_new_notes'));
});

test('regenerar reescribe solo un clip de SV y rechaza sobrescribir uno ajeno', () => {
  const { model, bridge } = setup();
  const p = D.patterns.find((x) => x.id === 'GRV.1/four_on_the_floor');
  const r1 = core.generate(p, { destination: 'ethnic', seed: 1 }, D);
  const w1 = bridge.writeClip(r1);
  const r2 = core.generate(p, { destination: 'ethnic', seed: 2, repeats: 8 }, D);
  const w2 = bridge.writeClip(r2, { reuseSlot: w1.slot });
  assert.equal(w2.slot, w1.slot);
  const clip = model.tracks[2].clip_slots[w1.slot].clip;
  assert.equal(clip.notes.length, r2.notes.length, 'notas reemplazadas, no sumadas');
  assert.equal(clip.loop_end, r2.length_beats);
  assert.throws(() => bridge.writeClip(r1, { reuseSlot: 1 }), /no creó SV/);
});

test('usa la ranura seleccionada si es de esta pista y está vacía; crea escena si no hay ranuras libres', () => {
  const { model, bridge } = setup((m) => { m.view.highlighted = { track: 2, slot: 3 }; });
  const r = core.generate(D.patterns.find((x) => x.id === 'GRV.2/backbeat'), { destination: 'ethnic' }, D);
  assert.equal(bridge.writeClip(r).slot, 3, 'ranura seleccionada');
  const other = setup((m) => { m.view.highlighted = { track: 0, slot: 3 }; });
  assert.equal(other.bridge.writeClip(r).slot, 0, 'la selección en otra pista se ignora');
  const full = setup((m) => { m.tracks[2].clip_slots = m.tracks[2].clip_slots.map(() => ({ clip: { name: 'x', length: 4, is_midi_clip: 1, notes: [] } })); });
  const w = full.bridge.writeClip(r);
  assert.equal(w.createdScene, true);
  assert.equal(w.slot, 4);
  assert.equal(full.model.scenes.length, 5);
  assert.ok(model);
});

test('lee las pistas MIDI del set (sin audio ni la propia) y el modo Adaptable resume lo leído', () => {
  const { bridge, ctl } = setup();
  const tracks = bridge.readTracks();
  assert.deepEqual(tracks.map((t) => t.name), ['Pad', 'Drums']);
  assert.equal(tracks[0].playing, true, 'clip en reproducción primero');
  assert.equal(tracks[1].isDrum, true, 'Drum Rack detectado');
  const s = ctl.analyze();
  assert.equal(s.key.name, 'A menor');
  assert.equal(s.scale[0].id, 'minor');
  assert.equal(s.kick.track, 'Drums');
  assert.deepEqual(s.kick.times, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(s.occupancy[0], 1, 'el pulso 1 está ocupado');
  assert.equal(s.agreesWithLive, true, 'coincide con la escala de Live');
  assert.deepEqual(s.read.map((r) => r.name), ['Pad', 'Drums']);
});

test('controlador: los cuatro pasos de punta a punta', () => {
  const { model, ctl } = setup();
  ctl.setDestination('chords');
  ctl.setPattern('RGG.10.2/stab_1_7_15');
  ctl.setHarmony(0, 'minor');
  const s1 = ctl.generate();
  assert.equal(s1.destination, 'chords');
  assert.equal(s1.written.slot, 0);
  assert.equal(model.tracks[2].clip_slots[0].clip.notes.length, s1.notes);
  assert.ok(model.tracks[2].clip_slots[0].clip.notes.every((n) => [0, 3, 7].includes(n.pitch % 12)), 'Do menor');
  // armonía desde Live 12 (La menor)
  ctl.setHarmonyMode('live');
  const s2 = ctl.regenerate();
  assert.equal(s2.written.slot, 0, 'regenerar usa la misma ranura');
  assert.ok(model.tracks[2].clip_slots[0].clip.notes.every((n) => [9, 0, 4].includes(n.pitch % 12)), 'La menor de Live');
  // deshacer vuelve a la generación anterior
  ctl.undo();
  assert.ok(model.tracks[2].clip_slots[0].clip.notes.every((n) => [0, 3, 7].includes(n.pitch % 12)));
  ctl.redo();
  assert.ok(model.tracks[2].clip_slots[0].clip.notes.every((n) => [9, 0, 4].includes(n.pitch % 12)));
  assert.equal(ctl.historyList().length, 2);
  const v = ctl.vary();
  assert.equal(v.written.slot, 0);
  // un patrón fijo: Regenerar no repite el mismo clip
  ctl.setPattern('RGG.4.3/flying_cymbal');
  ctl.setDestination('hihats');
  ctl.generate();
  const a = ctl.state.history[ctl.state.historyIndex].result.notes.map((n) => n.start_time).join();
  const seedBefore = ctl.state.seed;
  ctl.generate();
  const b = ctl.state.history[ctl.state.historyIndex].result;
  assert.notEqual(b.notes.map((n) => n.start_time).join(), a, 'Generar dos veces no repite el mismo clip');
  assert.ok(ctl.state.seed > seedBefore, 'la semilla nueva queda en el estado');
  // patrón sin azar (sin relleno final): se aplica una variación
  ctl.setPattern('RGG.4.1/hat_8ths');
  ctl.setOption('variation', 'none');
  ctl.generate();
  ctl.generate();
  const c = ctl.state.history[ctl.state.historyIndex].result;
  assert.ok(c.meta.warnings.some((w) => /Patrón fijo/.test(w)), 'un patrón fijo recurre a una variación');
  ctl.setOption('variation', null);
  // Random reproducible por semilla
  ctl.setRandomSeed(42);
  const h1 = ctl.setHarmonyMode('random');
  ctl.setRandomSeed(42);
  assert.deepEqual(ctl.resolveHarmony(), h1);
});

test('controlador Adaptable: complementariedad y bajo alineado con el bombo', () => {
  const { ctl } = setup();
  ctl.setDestination('bassline');
  ctl.setPattern('RGG.10.2/bass_offbeat');
  ctl.analyze();
  ctl.setHarmonyMode('adaptive');
  const h = ctl.resolveHarmony();
  assert.equal(h.root, 9);
  assert.equal(h.id, 'minor');
  ctl.generate();
  const off = ctl.state.history[ctl.state.historyIndex].result;
  assert.ok(off.notes.every((n) => Math.abs((n.start_time % 1) - 0.5) < 0.1), 'un bajo en contratiempo queda entre los bombos (auto)');
  ctl.setPattern('RGG.5.4/bass_dub_sub');
  ctl.setDestination('bassline');
  ctl.generate();
  const res = ctl.state.history[ctl.state.historyIndex].result;
  const starts = res.notes.map((n) => n.start_time);
  assert.ok([0, 1, 2, 3].every((t) => starts.includes(t)), 'un bajo de pulso sigue al bombo (auto)');
  assert.equal(res.notes.find((n) => n.start_time === 0).pitch % 12, 9, 'el pulso 1 es la raíz');
  // corrección manual de lo leído
  ctl.correctAdaptive(2, 'dorian');
  const hc = ctl.resolveHarmony();
  assert.equal(hc.root, 2);
  assert.equal(hc.corrected, true);
});

test('controlador: uso restringido y observador de escala', () => {
  const { ctl, bridge, fake, model } = setup();
  ctl.setPattern('CIC.9/kultrun_principio');
  const s = ctl.generate();
  assert.match(s.cultural_note, /machi/);
  let seen = null;
  bridge.observeScale((sc) => { seen = sc; });
  model.root_note = 2;
  fake.fire('root_note');
  assert.equal(seen.root_note, 2);
});
