'use strict';
// Dispositivo: cabecera .amxd, estructura del patcher (franja, parámetros live.*, ventana del navegador) y el
// script v8 del motor en un entorno Max simulado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { amxd, readAmxd, Patch } = require('../tools/lib/patcher');
const { devicePatch } = require('../tools/build_amxd');
const { build } = require('../tools/bundle');
const { loadAll } = require('../tools/lib/data');
const core = require('../src/core');
const UIM = require('../src/ui/model');
const panel = require('../src/ui/panel');
const { createFakeLive, sampleModel } = require('./helpers/fake_live');

const D = loadAll();
const boxesOf = (p) => p.boxes.map((b) => b.box);
const lists = UIM.create({ core, data: D }).lists;

test('cabecera .amxd igual a la de los dispositivos reales del equipo', () => {
  const P = new Patch();
  P.obj('midiin', 0, 0);
  const bin = amxd(P.dump(), 'midi');
  assert.equal(bin.toString('latin1', 0, 4), 'ampf');
  assert.equal(bin.readUInt32LE(4), 4);
  assert.equal(bin.toString('latin1', 8, 12), 'mmmm');
  assert.equal(bin.toString('latin1', 12, 16), 'meta');
  assert.equal(bin.readUInt32LE(20), 0);
  assert.equal(bin.toString('latin1', 24, 28), 'ptch');
  assert.equal(bin.readUInt32LE(28), bin.length - 32, 'la longitud incluye el «\\n\\0» final');
  assert.equal(bin[bin.length - 1], 0);
  assert.equal(readAmxd(bin).patch.patcher.boxes.length, 1);
});

test('patcher: MIDI pasa, init tras live.thisdevice, escucha previa por midiformat, franja de 169 px', () => {
  const p = devicePatch(D).patcher;
  const boxes = boxesOf(p);
  const byText = (t) => boxes.find((b) => b.text === t);
  const link = (a, b, ao = null) => p.lines.some((l) => l.patchline.source[0] === a.id && l.patchline.destination[0] === b.id && (ao === null || l.patchline.source[1] === ao));
  const v8 = byText('v8 sv_rs_v8.js');
  assert.ok(link(byText('midiin'), byText('midiout')), 'midiin → midiout');
  const tbb = byText('t b b');
  assert.ok(link(byText('live.thisdevice'), byText('deferlow')) && link(byText('deferlow'), tbb) && link(byText('init'), v8));
  assert.ok(link(tbb, byText('presets_dict ---sv_rs_presets'), 1) && link(tbb, byText('init'), 0), '[t b b]: primero el dict (derecha), luego init');
  assert.ok(boxes.some((b) => b.text === 'dict ---sv_rs_presets @embed 1'), 'dict de preajustes guardado con el set');
  assert.ok(link(v8, boxes.find((b) => b.text && b.text.startsWith('route p_destino')), 4), 'el motor sincroniza los live.*');
  assert.ok(link(v8, byText('midiformat'), 3) && link(byText('midiformat'), byText('midiout')), 'escucha previa');
  const ui = boxes.find((b) => b.maxclass === 'v8ui');
  assert.deepEqual(ui.jsarguments, ['strip']);
  assert.equal(ui.filename, 'sv_rs_ui.js');
  assert.ok(link(v8, ui, 0), 'el motor alimenta la franja');
  for (const b of boxes) if (b.presentation) assert.ok(b.presentation_rect[1] + b.presentation_rect[3] <= 169, `${b.maxclass} fuera de 169 px`);
  assert.equal(p.devicewidth, 860);
  const ids = new Set(boxes.map((b) => b.id));
  for (const l of p.lines) assert.ok(ids.has(l.patchline.source[0]) && ids.has(l.patchline.destination[0]), 'líneas válidas');
});

test('parámetros live.*: el route de la interfaz llega a cada uno y el orden de los menús es el del modelo', () => {
  const p = devicePatch(D).patcher;
  const boxes = boxesOf(p);
  const route = boxes.find((b) => b.text && b.text.startsWith('route p_destino'));
  const names = route.text.split(' ').slice(1);
  assert.deepEqual(names, ['p_destino', 'p_armonia', 'p_raiz', 'p_escala', 'p_ritmo', 'p_repeticiones', 'p_semilla', 'open_panel']);
  const outOf = (i) => p.lines.filter((l) => l.patchline.source[0] === route.id && l.patchline.source[1] === i).map((l) => boxes.find((b) => b.id === l.patchline.destination[0]));
  const expectLen = { p_destino: lists.destinations.length, p_armonia: lists.modes.length, p_raiz: 12, p_escala: lists.scales.length, p_ritmo: lists.patterns.length, p_repeticiones: lists.repeats.length };
  names.slice(0, 7).forEach((n, i) => {
    const target = outOf(i)[0];
    assert.ok(target && /^live\./.test(target.maxclass), `${n} → live.*`);
    const v = target.saved_attribute_attributes.valueof;
    if (expectLen[n]) assert.equal(v.parameter_enum.length, expectLen[n], `${n}: tamaño del menú`);
  });
  const ritmo = outOf(4)[0].saved_attribute_attributes.valueof.parameter_enum;
  assert.ok(ritmo.every((label, i) => label.endsWith(`(${lists.patterns[i].split('/')[0]})`)), 'el menú Ritmo sigue el orden de la lista pública');
  assert.ok(outOf(names.length).some((b) => b.text === 'v8 sv_rs_v8.js'), 'los comandos sin parámetro van al motor');
  const all = [...boxes, ...boxesOf(boxes.find((b) => b.text === 'p sv_rs_panel').patcher)];
  const pnames = all.filter((b) => b.parameter_enable).map((b) => b.saved_attribute_attributes.valueof.parameter_longname);
  assert.equal(new Set(pnames).size, pnames.length, 'nombres de parámetro únicos en todo el dispositivo');
  for (const b of all.filter((x) => x.parameter_enable)) {
    const v = b.saved_attribute_attributes.valueof;
    if (v.parameter_type === 1) assert.ok(v.parameter_mmax - v.parameter_mmin + 1 <= 256, `${v.parameter_longname}: un entero de Live admite como máximo 256 valores`);
    if (v.parameter_type === 2) assert.ok(v.parameter_enum.length <= 256, `${v.parameter_longname}: demasiadas opciones`);
  }
});

test('ventana del navegador: v8ui del panel, buscador sobre su área y controles de forma conocidos por el motor', () => {
  const p = devicePatch(D).patcher;
  const sub = boxesOf(p).find((b) => b.text === 'p sv_rs_panel');
  assert.ok(sub, 'subpatcher del panel');
  const sp = sub.patcher;
  assert.equal(sp.openinpresentation, 1);
  const inner = boxesOf(sp);
  const ui = inner.find((b) => b.maxclass === 'v8ui');
  assert.deepEqual(ui.jsarguments, ['panel']);
  const te = inner.find((b) => b.maxclass === 'textedit');
  const a = panel.AREAS.search;
  assert.deepEqual(te.presentation_rect, [a.x, a.y, a.w, a.h], 'el buscador cae sobre el área reservada');
  assert.deepEqual(inner.filter((b) => b.maxclass === 'outlet').map((b) => b.index).sort(), [1, 2]);
  const v8src = fs.readFileSync(path.join(__dirname, '..', 'src', 'max', 'sv_rs_v8.js'), 'utf8');
  for (const b of inner.filter((x) => x.text && x.text.startsWith('prepend form '))) {
    const name = b.text.split(' ')[2];
    assert.ok(v8src.includes(`case '${name}'`), `el motor conoce el control de forma «${name}»`);
  }
  const top = boxesOf(p);
  const pc = top.find((b) => b.text === 'pcontrol');
  assert.ok(p.lines.some((l) => l.patchline.source[0] === pc.id && l.patchline.destination[0] === sub.id), 'pcontrol abre el panel');
});

function loadEngineSandbox() {
  const out = path.join(os.tmpdir(), `sv_rs_engine_v8_${process.pid}.js`);
  build(out);
  const box = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(out, 'utf8'), box);
  fs.unlinkSync(out);
  return box.module.exports;
}

test('script v8 del motor: cola previa a init, vista previa, forma, escucha previa y errores', () => {
  const SV = loadEngineSandbox();
  const fake = createFakeLive(sampleModel());
  const outlets = [];
  const tasks = [];
  class Task { constructor(fn) { this.fn = fn; tasks.push(this); } schedule(ms) { this.ms = ms; } cancel() { this.cancelled = true; } }
  const ctx = {
    post: () => {}, outlet: (i, ...a) => outlets.push([i, ...a]), LiveAPI: fake.LiveAPI, Task,
    require: (name) => { assert.equal(name, 'sv_rs_engine.js'); return SV; },
    arrayfromargs: (a) => Array.from(a), messagename: '',
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'max', 'sv_rs_v8.js'), 'utf8'), ctx);
  ctx.pattern_index(lists.patterns.indexOf('RGG.6.2/chop_2_4'));
  ctx.root_note(7);
  ctx.init();
  assert.ok(outlets.some((o) => o[0] === 2 && o[1] === 'bang'), 'init termina con bang');
  const lastOf = (type) => { const o = outlets.filter((x) => x[0] === 0 && x[1] === type).pop(); return o ? JSON.parse(o[2]) : null; };
  assert.equal(lastOf('state').patternId, 'RGG.6.2/chop_2_4');
  assert.equal(lastOf('preview').meta.pattern, 'RGG.6.2/chop_2_4', 'vista previa tras init');
  ctx.repeats_index(3);
  assert.equal(lastOf('preview').plan.repeats, 8, 'repeticiones desde el live.menu');
  ctx.form('microtiempo', 0);
  ctx.form('densidad', 40);
  ctx.form('humanizar', 5);
  assert.deepEqual(lastOf('state').options.transform, { density: 0.4 });
  ctx.generate();
  const r = lastOf('result');
  assert.equal(r.harmony.root, 7);
  assert.ok(fake.model.tracks[2].clip_slots[0].clip.notes.length > 0, 'clip escrito');
  // escucha previa: programa notas y se detiene limpiamente
  const before = tasks.length;
  ctx.audition(1);
  const audTasks = tasks.slice(before);
  assert.ok(audTasks.length > 2 && audTasks.some((t) => t.ms > 0));
  assert.equal(lastOf('audition'), 1);
  ctx.audition(0);
  assert.ok(audTasks.every((t) => t.cancelled), 'detener cancela todo');
  assert.equal(tasks[0].ms, 1000, 'inicio automático diferido tras una recarga en caliente');
  ctx.messagename = 'foo';
  ctx.anything();
  ctx.pattern('NO/existe');
  assert.ok(outlets.some((o) => o[1] === 'error'), 'los errores salen como mensaje');
});
