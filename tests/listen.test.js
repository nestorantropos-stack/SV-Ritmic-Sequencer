'use strict';
// SV Listen: análisis con señales sintéticas, integración con el modo Adaptable y script v8 con Max simulado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');
const { build } = require('../tools/bundle');
const { devicePatch, BUF } = require('../tools/build_listen');
const { amxd, readAmxd } = require('../tools/lib/patcher');

const D = loadAll();
const SR = 44100;
const L = core.listen;

// Acorde sostenido con armónicos decrecientes.
function chord(freqs, seconds) {
  const n = Math.round(seconds * SR);
  const out = new Float64Array(n);
  for (const f of freqs) for (let h = 1; h <= 4; h++) for (let i = 0; i < n; i++) out[i] += (0.2 / h) * Math.sin((2 * Math.PI * f * h * i) / SR);
  return out;
}

// Bucle de 120 BPM: bombo (55 Hz con caída) en cada negra y clic (ruido agudo de 8 ms) en cada contratiempo de corchea.
function drumLoop(bars) {
  const spb = SR / 2;
  const n = Math.round(bars * 4 * spb);
  const out = new Float64Array(n);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let b = 0; b < bars * 4; b++) {
    const k = Math.round(b * spb);
    for (let i = 0; i < SR * 0.15 && k + i < n; i++) out[k + i] += 0.9 * Math.exp(-i / (SR * 0.04)) * Math.sin((2 * Math.PI * 55 * i) / SR);
    const c = Math.round((b + 0.5) * spb);
    for (let i = 0; i < SR * 0.008 && c + i < n; i++) out[c + i] += 0.5 * rnd() * Math.exp(-i / (SR * 0.002));
  }
  return out;
}

function listenTo(samples, opts = {}) {
  const lis = L.createListener({ sampleRate: SR, ...opts });
  lis.bpm = 120;
  for (let end = 2048; end <= samples.length; end += 512) lis.feed(samples.subarray(end - 2048, end), (end / SR) * 2);
  return lis;
}

test('FFT: un seno de 1 kHz cae en su bin', () => {
  const n = 2048;
  const s = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 1000 * i) / SR));
  const m = L.magnitudes(s);
  const peak = m.indexOf(Math.max(...m));
  assert.equal(peak, Math.round((1000 * n) / SR));
  assert.ok(Math.abs(m[peak] - 1) < 0.15, `amplitud ≈ 1 (${m[peak].toFixed(2)})`);
});

test('croma de La menor (A3, C4, E4) y tonalidad estimada', () => {
  const lis = listenTo(chord([220, 261.63, 329.63], 2));
  const s = lis.summary('Pad audio');
  const top = s.chroma.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]).sort((a, b) => a - b);
  assert.deepEqual(top, [0, 4, 9], `croma: ${s.chroma.join(' ')}`);
  assert.ok(s.level > 0.01);
  assert.equal(s.onsets <= 2, true, 'un acorde sostenido no produce ataques repetidos');
  const a = core.analysis.analyzeSet([], { scales: D.scales.scales, audio: [s] });
  assert.equal(a.key.root, 9);
  assert.equal(a.key.mode, 'minor');
  assert.equal(a.audioTracks, 1);
});

test('bombo en las negras y ataques en cada corchea, alineados al compás', () => {
  const s = listenTo(drumLoop(4)).summary('Batería');
  const steps = (arr) => arr.map((v, i) => (v >= 0.5 ? i : null)).filter((v) => v !== null);
  assert.deepEqual(steps(s.kick), [0, 4, 8, 12], `bombo: ${s.kick.join(' ')}`);
  assert.deepEqual(steps(s.occupancy), [0, 2, 4, 6, 8, 10, 12, 14], `ataques: ${s.occupancy.join(' ')}`);
  for (const i of [1, 3, 5, 7, 9, 11, 13, 15]) assert.equal(s.occupancy[i], 0, `paso ${i} vacío`);
  // la misma batería sobre un acorde sostenido (mezcla de una pista de grupo)
  const dr = drumLoop(4);
  const pad = chord([220, 261.63, 329.63], dr.length / SR);
  const m = listenTo(dr.map((v, i) => v + pad[i])).summary('Mezcla');
  assert.deepEqual(steps(m.occupancy), [0, 2, 4, 6, 8, 10, 12, 14], `ataques en la mezcla: ${m.occupancy.join(' ')}`);
  assert.deepEqual(steps(m.kick), [0, 4, 8, 12], `bombo en la mezcla: ${m.kick.join(' ')}`);
});

test('Adaptable con audio: el bombo de audio sustituye al MIDI ausente y el croma pesa junto al MIDI', () => {
  const drums = listenTo(drumLoop(4)).summary('Batería');
  const a = core.analysis.analyzeSet([], { scales: D.scales.scales, audio: [drums] });
  assert.equal(a.kick.source, 'audio');
  assert.deepEqual(a.kick.times, [0, 1, 2, 3]);
  assert.deepEqual(a.kickOccupancy.filter((v, i) => i % 4 === 0).map((v) => v >= 0.5), [true, true, true, true]);
  // Re menor en MIDI + audio en La menor con peso 0,5: manda el MIDI
  const n = (p, t) => ({ pitch: p, start_time: t, duration: 1, velocity: 90 });
  const midi = [{ name: 'Pad', notes: [62, 65, 69].flatMap((p) => [0, 1, 2, 3].map((t) => n(p, t))), length: 4 }];
  const pad = listenTo(chord([220, 261.63, 329.63], 2)).summary('Pad audio');
  const mix = core.analysis.analyzeSet(midi, { scales: D.scales.scales, audio: [pad], audioWeight: 0.5 });
  assert.equal(mix.key.root, 2);
  assert.ok(mix.histogram[9] > 0 && mix.histogram[0] > 0, 'el audio aporta al histograma');
  assert.equal(mix.tracks.filter((t) => t.source === 'audio').length, 1);
  // un audio en silencio no altera la tonalidad
  const silent = { ...pad, level: 0 };
  assert.deepEqual(core.analysis.analyzeSet(midi, { scales: D.scales.scales, audio: [silent] }).histogram, core.analysis.analyzeSet(midi, { scales: D.scales.scales }).histogram);
});

test('batería + pad en audio: la batería no decide la escala (antes salía «La cromática» en Live)', () => {
  const drums = listenTo(drumLoop(4)).summary('Batería');
  const pad = listenTo(chord([220, 261.63, 329.63], 2)).summary('Pad audio');
  const { tonalness } = core.analysis;
  assert.ok(tonalness(pad.chroma) > 0.9, `pad ${tonalness(pad.chroma)}`);
  assert.ok(tonalness(drums.chroma) < 0.3, `batería ${tonalness(drums.chroma)}`);
  const a = core.analysis.analyzeSet([], { scales: D.scales.scales, audio: [drums, pad] });
  assert.equal(a.key.root, 9);
  assert.notEqual(a.scale[0].id, 'chromatic');
  assert.equal(a.kick.source, 'audio');
});

test('el controlador mezcla los resúmenes recientes de SV Listen y descarta los viejos', () => {
  const { createController } = require('../src/max/controller');
  const { createFakeLive, sampleModel } = require('./helpers/fake_live');
  const { createBridge } = require('../src/max/live_bridge');
  const fake = createFakeLive(sampleModel());
  const drums = { ...listenTo(drumLoop(4)).summary('Batería'), updated: Date.now() };
  const old = { ...drums, name: 'Vieja', updated: Date.now() - 60000 };
  const ctl = createController({ core, data: D, bridge: createBridge(fake.LiveAPI), listenSource: () => [drums, old] });
  const s = ctl.analyze();
  assert.equal(s.audioTracks, 1, 'solo el resumen reciente');
  assert.ok(s.read.some((t) => t.source === 'audio' && t.name === 'Batería'));
  const bad = createController({ core, data: D, bridge: createBridge(fake.LiveAPI), listenSource: () => { throw new Error('dict roto'); } });
  assert.equal(bad.analyze().audioTracks, 0, 'un fallo de la fuente no rompe la lectura');
});

test('dispositivo SV Listen: cadena de audio, buffer único, transporte y controles', () => {
  const p = devicePatch().patcher;
  const boxes = p.boxes.map((b) => b.box);
  const by = (t) => boxes.find((b) => b.text === t);
  const pin = by('plugin~');
  const pout = by('plugout~');
  assert.ok(p.lines.some((l) => l.patchline.source[0] === pin.id && l.patchline.destination[0] === pout.id), 'el audio pasa');
  assert.ok(BUF.startsWith('---'));
  assert.ok(by(`buffer~ ${BUF} 2000 1`) && by(`record~ ${BUF} @loop 1`));
  const ps = by('plugsync~');
  const fromPs = p.lines.filter((l) => l.patchline.source[0] === ps.id).map((l) => [l.patchline.source[1], boxes.find((b) => b.id === l.patchline.destination[0]).text]);
  assert.deepEqual(fromPs.sort(), [[0, 'prepend transport'], [4, 'prepend ts'], [5, 'prepend tempo'], [6, 'prepend ppq']]);
  const params = boxes.filter((b) => b.parameter_enable === 1).map((b) => b.saved_attribute_attributes.valueof.parameter_longname);
  assert.deepEqual(params, ['Escuchar', 'Sensibilidad', 'Bombo Hz', 'Compases']);
  assert.equal(p.devicewidth, 396);
  for (const b of boxes) if (b.presentation_rect) assert.ok(b.presentation_rect[1] + b.presentation_rect[3] <= 169, `${b.maxclass} cabe en 169 px`);
  // cada mensaje que llega al v8 tiene su función en el script
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'max', 'sv_listen_v8.js'), 'utf8');
  const msgs = boxes.filter((b) => /^prepend /.test(b.text || '')).map((b) => b.text.split(' ')[1]).filter((m) => m !== 'set');
  for (const m of [...msgs, 'init', 'tick', 'bufname']) assert.ok(new RegExp(`function ${m}\\(`).test(src), `falta ${m}()`);
  const back = readAmxd(amxd({ patcher: p }, 'audio'));
  assert.equal(back.kind, 'aaaa');
});

test('script v8 de SV Listen con Max simulado: lee el buffer circular y publica en el dict compartido', () => {
  const out = path.join(os.tmpdir(), `sv_rs_engine_listen_${process.pid}.js`);
  build(out);
  const box = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(out, 'utf8'), box);
  fs.unlinkSync(out);
  const SV = box.module.exports;

  const loop = drumLoop(4);
  const RING = SR * 2;
  const ring = new Float64Array(RING);
  const dicts = {};
  const outlets = [];
  class Buffer { constructor(name) { assert.equal(name, BUF); } framecount() { return RING; } peek(ch, start, count) { assert.equal(ch, 1); return Array.from(ring.subarray(start, start + count)); } }
  class Dict { constructor(n) { this.d = dicts[n] = dicts[n] || {}; } set(k, v) { this.d[k] = v; } get(k) { return this.d[k]; } remove(k) { delete this.d[k]; } getkeys() { return Object.keys(this.d); } }
  class LiveAPI { constructor(p) { this.p = p; } get(prop) { if (prop === 'canonical_parent') return ['id', 7]; if (prop === 'name') return ['"3-Batería"']; return []; } }
  class Task { schedule() {} }
  const ctx = { post: () => {}, outlet: (i, ...a) => outlets.push([i, ...a]), require: () => SV, Buffer, Dict, LiveAPI, Task, messagename: '', Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'max', 'sv_listen_v8.js'), 'utf8'), ctx);
  ctx.sr(SR); ctx.bufname(BUF); ctx.init(); ctx.tempo(120); ctx.ts(4, 4); ctx.transport(1);
  // simula 20 ms de audio por tick: record~ escribe en el anillo, snapshot~ da la posición, plugsync~ la negra
  let w = 0;
  const block = Math.round(SR * 0.02);
  let clock = 0;
  ctx.Date = { now: () => clock };
  for (let pos = 0; pos < loop.length; pos += block) {
    for (let i = 0; i < block && pos + i < loop.length; i++) { ring[w] = loop[pos + i]; w = (w + 1) % RING; }
    const done = Math.min(loop.length, pos + block);
    ctx.recpos(w / RING); ctx.ppq((done / SR) * 2);
    clock += 20;
    ctx.tick();
  }
  const pub = JSON.parse(dicts.sv_listen['7']);
  assert.equal(pub.name, '3-Batería');
  assert.equal(pub.track, '7');
  const steps = (arr) => arr.map((v, i) => (v >= 0.5 ? i : null)).filter((v) => v !== null);
  assert.deepEqual(steps(pub.kick), [0, 4, 8, 12], `bombo: ${pub.kick.join(' ')}`);
  assert.deepEqual(steps(pub.occupancy), [0, 2, 4, 6, 8, 10, 12, 14], `ataques: ${pub.occupancy.join(' ')}`);
  assert.ok(outlets.some((o) => o[0] === 0 && o[1] === 'listen'), 'la vista recibe el resumen');
  ctx.on(0);
  assert.equal(JSON.parse(dicts.sv_listen['7']).active, false, 'en pausa se marca inactivo');
  ctx.notifydeleted();
  assert.equal(dicts.sv_listen['7'], undefined, 'al borrar el dispositivo sale del dict');
});

test('vista de SV Listen se dibuja sin resumen y con resumen', () => {
  const ui = require('../src/ui');
  const calls = [];
  const g = ui.canvas.recorderCanvas ? ui.canvas.recorderCanvas() : null;
  assert.ok(g, 'hay lienzo de registro');
  ui.listenView.draw(g, null);
  ui.listenView.draw(g, { name: 'Pad', level: 0.1, chroma: [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0], occupancy: new Array(16).fill(0.5), kick: new Array(16).fill(0), onsets: 3, kicks: 0, bars: 8 });
  calls.push(1);
  assert.equal(calls.length, 1);
});
