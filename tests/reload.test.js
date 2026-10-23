'use strict';
// D-053: recarga en caliente de los scripts v8 y v8ui (PM-031) y carpeta del dispositivo sin patcher.filepath (PM-027).
// Max se simula con File (search path por nombre y rutas absolutas), require y Task.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { build } = require('../tools/bundle');
const { prepareScript } = require('../tools/lib/install');
const { parseSMF } = require('../tools/lib/smf');
const { createFakeLive, sampleModel } = require('./helpers/fake_live');

const DIR = 'C:/Users/X/Documents/Ableton/User Library/Presets/MIDI Effects/Max MIDI Effect/SV Ritmic Sequencer/';
const out = path.join(os.tmpdir(), `sv_rs_engine_reload_${process.pid}.js`);
const info = build(out);
const engineBytes = fs.readFileSync(out);
fs.unlinkSync(out);
const loadBundle = () => { const box = { module: { exports: {} } }; vm.runInNewContext(engineBytes.toString('utf8'), box); return box.module.exports; };

// File de Max simulado: `found` = archivos que el search path encuentra por nombre (con su carpeta);
// `disk` = rutas absolutas legibles; escribir solo funciona dentro de `writable`.
function maxFiles({ found = {}, disk = {}, writable = null } = {}) {
  const written = {};
  const opened = [];
  class File {
    constructor(p, mode) {
      this.p = p; this.position = 0; opened.push([p, mode]);
      if (mode === 'read') {
        const hit = found[p] || (disk[p] && { bytes: disk[p], folder: p.replace(/[^/]+$/, '') });
        this.isopen = !!hit;
        if (hit) { this.bytes = hit.bytes; this.eof = hit.bytes.length; this.foldername = hit.folder.replace(/\/$/, ''); }
      } else this.isopen = !!writable && p.startsWith(writable);
    }
    readbytes(n) { const a = Array.from(this.bytes.subarray(this.position, this.position + n)); this.position += a.length; return a; }
    writebytes(b) { written[this.p] = b.slice(); this.position = b.length; }
    writestring(s) { written[this.p] = s; this.position = s.length; }
    close() { this.isopen = false; }
  }
  return { File, written, opened };
}

function runScript(file, ctx, opts = {}) {
  let src = fs.readFileSync(path.join(__dirname, '..', 'src', 'max', file), 'utf8');
  if (opts.build || opts.installDir) src = prepareScript(src, opts);
  const posts = [];
  const outlets = [];
  class Task { constructor(fn) { this.fn = fn; } schedule() {} cancel() {} }
  Object.assign(ctx, { post: (s) => posts.push(s), outlet: (i, ...a) => outlets.push([i, ...a]), Task, arrayfromargs: (a) => Array.from(a), messagename: '' });
  ctx.this = ctx;
  vm.runInNewContext(src, ctx);
  return { posts, outlets };
}

test('prepareScript escribe el sello y la carpeta de instalación, y falla si falta la constante', () => {
  const src = "var SV_ENGINE_BUILD = '';\nvar SV_INSTALL_DIR = '';\n";
  const s = prepareScript(src, { build: '0.1.0+abc', installDir: 'C:\\Users\\X\\Docs\\SV Ritmic Sequencer' });
  assert.match(s, /^var SV_ENGINE_BUILD = "0\.1\.0\+abc";$/m);
  assert.match(s, /^var SV_INSTALL_DIR = "C:\/Users\/X\/Docs\/SV Ritmic Sequencer\/";$/m);
  assert.equal(prepareScript(src), src, 'sin opciones no cambia nada');
  assert.throws(() => prepareScript('var x = 1;', { build: 'a' }), /SV_ENGINE_BUILD/);
  for (const f of ['sv_rs_v8.js', 'sv_listen_v8.js', 'sv_rs_ui.js', 'sv_listen_ui.js']) {
    const real = fs.readFileSync(path.join(__dirname, '..', 'src', 'max', f), 'utf8');
    assert.doesNotThrow(() => prepareScript(real, { build: 'x', installDir: 'C:/a' }), f);
  }
});

test('el bundle lleva un sello estable que cambia con el contenido', () => {
  assert.match(info.stamp, /^\d+\.\d+\.\d+\+[0-9a-f]{12}$/);
  assert.equal(loadBundle().build, info.stamp);
  const again = path.join(os.tmpdir(), `sv_rs_engine_reload2_${process.pid}.js`);
  assert.equal(build(again).stamp, info.stamp, 'determinista');
  fs.unlinkSync(again);
});

test('recarga en caliente: require da un módulo vacío y el motor se lee del archivo (PM-031)', () => {
  const fake = createFakeLive(sampleModel());
  const files = maxFiles({ found: { 'sv_rs_engine.js': { bytes: engineBytes, folder: DIR } } });
  const ctx = { LiveAPI: fake.LiveAPI, File: files.File, require: () => ({}) };
  const r = runScript('sv_rs_v8.js', ctx, { build: info.stamp });
  ctx.init();
  assert.ok(r.outlets.some((o) => o[0] === 2 && o[1] === 'bang'), `init termina: ${r.posts.join('')}`);
  assert.ok(r.posts.some((p) => /desde el archivo/.test(p)), 'avisa en la consola de la carga por archivo');
  // el texto con tildes del motor sobrevive a la lectura por bytes
  const SV = loadBundle();
  ctx.catalog();
  const cat = JSON.parse(r.outlets.filter((o) => o[1] === 'catalog').pop()[2]);
  assert.equal(JSON.stringify(cat.map((p) => p.name)), JSON.stringify(SV.core.catalog.search(SV.data.patterns, {}).map((p) => p.name)));
  assert.ok(cat.some((p) => /[^\x00-\x7f]/.test(p.name)), 'hay nombres con caracteres no ASCII');
});

test('recarga en caliente: require da el motor viejo de su caché y se usa el del archivo', () => {
  const fake = createFakeLive(sampleModel());
  const old = Object.assign({}, loadBundle(), { build: '0.0.1+viejo' });
  const files = maxFiles({ found: { 'sv_rs_engine.js': { bytes: engineBytes, folder: DIR } } });
  const ctx = { LiveAPI: fake.LiveAPI, File: files.File, require: () => old };
  const r = runScript('sv_rs_v8.js', ctx, { build: info.stamp });
  ctx.init();
  assert.ok(r.outlets.some((o) => o[0] === 2 && o[1] === 'bang'));
  assert.equal(ctx.loadEngine().build, info.stamp);
  // sin sello (script de src/) y sin archivo legible, el motor de require vale aunque sea de otra versión
  const ctx2 = { LiveAPI: fake.LiveAPI, File: maxFiles().File, require: () => old };
  const r2 = runScript('sv_rs_v8.js', ctx2);
  assert.equal(ctx2.loadEngine(), old);
  assert.ok(r2.posts.some((p) => /cargado con require/.test(p)));
});

test('el archivo va primero: si File lee el motor, require no se llama (sin «could not find file» en rojo)', () => {
  const files = maxFiles({ found: { 'sv_rs_engine.js': { bytes: engineBytes, folder: DIR } } });
  let calls = 0;
  const req = () => { calls += 1; return {}; };
  const ctx = { LiveAPI: createFakeLive(sampleModel()).LiveAPI, File: files.File, require: req };
  const r = runScript('sv_rs_v8.js', ctx, { build: info.stamp });
  ctx.init();
  const ui = { mgraphics: fakeMgraphics(860, 169), jsarguments: ['sv_rs_ui.js', 'strip'], File: files.File, require: req };
  const rui = runScript('sv_rs_ui.js', ui, { build: info.stamp });
  assert.equal(calls, 0);
  assert.ok(r.posts.some((p) => p.includes(`sv_rs_engine ${loadBundle().version} (${info.stamp}) cargado desde el archivo`)), r.posts.join(''));
  // el v8ui siempre dice qué motor cargó y de dónde
  assert.deepEqual(rui.posts, [`SV Ritmic Sequencer UI: sv_rs_engine.js ${info.stamp} cargado desde el archivo\n`]);
});

test('UTF-8 de 1 a 4 bytes y BOM en la lectura del motor', () => {
  const text = '\uFEFFmodule.exports = { core: {}, build: "b", s: "añ€🥁" };';
  const files = maxFiles({ found: { 'sv_listen_engine.js': { bytes: Buffer.from(text, 'utf8'), folder: DIR } } });
  const ctx = { File: files.File, require: () => { throw new Error('caché rota'); } };
  runScript('sv_listen_v8.js', ctx, { build: 'b' });
  assert.equal(ctx.loadEngine().s, 'añ€🥁');
});

test('sin motor legible: el error pide volver a cargar el dispositivo', () => {
  const files = maxFiles();
  const ctx = { LiveAPI: createFakeLive(sampleModel()).LiveAPI, File: files.File, require: () => ({}) };
  const r = runScript('sv_rs_v8.js', ctx, { build: info.stamp });
  ctx.init();
  const err = r.outlets.filter((o) => o[1] === 'error').map((o) => JSON.parse(o[2]).message).pop();
  assert.match(err, /No se pudo cargar sv_rs_engine\.js: vuelve a cargar el dispositivo/);
  assert.ok(r.posts.some((p) => /módulo sin \.core/.test(p) && /no se abre sv_rs_engine\.js/.test(p)), 'la consola explica cada intento');
});

test('Exportar .mid sin patcher.filepath: carpeta donde Max encontró el motor (PM-027)', () => {
  const SV = loadBundle();
  const files = maxFiles({ found: { 'sv_rs_engine.js': { bytes: engineBytes, folder: DIR } }, writable: DIR });
  const ctx = { LiveAPI: createFakeLive(sampleModel()).LiveAPI, File: files.File, require: () => SV, patcher: { filepath: '' } };
  const r = runScript('sv_rs_v8.js', ctx);
  ctx.init();
  ctx.generate();
  ctx.export_midi();
  const exp = JSON.parse(r.outlets.filter((o) => o[1] === 'exported').pop()[2]);
  assert.ok(exp.path.startsWith(DIR + 'exports/') && exp.path.endsWith('.mid'), exp.path);
  assert.equal(parseSMF(Buffer.from(files.written[exp.path])).notes.length, exp.notes);
});

test('Exportar .mid sin filepath ni File por nombre: carpeta de instalación escrita por build_amxd', () => {
  const SV = loadBundle();
  const files = maxFiles({ writable: DIR });
  const ctx = { LiveAPI: createFakeLive(sampleModel()).LiveAPI, File: files.File, require: () => SV };
  const r = runScript('sv_rs_v8.js', ctx, { installDir: DIR.replace(/\//g, '\\') });
  ctx.init();
  ctx.export_midi();
  const exp = JSON.parse(r.outlets.filter((o) => o[1] === 'exported').pop()[2]);
  assert.ok(exp.path.startsWith(DIR + 'exports/'), exp.path);
  // y sin ninguna de las tres, un error claro
  const ctx2 = { LiveAPI: createFakeLive(sampleModel()).LiveAPI, File: maxFiles().File, require: () => SV };
  const r2 = runScript('sv_rs_v8.js', ctx2);
  ctx2.init();
  ctx2.export_midi();
  assert.match(JSON.parse(r2.outlets.filter((o) => o[1] === 'error').pop()[2]).message, /No se conoce la carpeta/);
});

test('SV Listen: recarga en caliente por archivo y diagnóstico en la carpeta encontrada', () => {
  const LDIR = 'C:/Users/X/Documents/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/SV Listen/';
  const files = maxFiles({ found: { 'sv_listen_engine.js': { bytes: engineBytes, folder: LDIR } }, writable: LDIR });
  class LiveAPI { get(prop) { if (prop === 'canonical_parent') return ['id', 7]; if (prop === 'name') return ['"Pad"']; return []; } }
  class Dict { set() {} remove() {} }
  const ctx = { LiveAPI, Dict, Date, File: files.File, require: () => ({}) };
  const r = runScript('sv_listen_v8.js', ctx, { build: info.stamp });
  ctx.init();
  assert.ok(r.outlets.some((o) => o[0] === 1 && o[1] === 'Escuchando · Pad'), `estado: ${JSON.stringify(r.outlets)} ${r.posts.join('')}`);
  ctx.tick();
  assert.ok(files.written[LDIR + 'listen_debug_7.json'], 'escribe el diagnóstico junto al dispositivo');
});

// mgraphics simulado para los v8ui: solo guarda los textos y cuenta los redibujos.
function fakeMgraphics(w, h) {
  const calls = { show_text: [], redraw: 0 };
  const noop = () => {};
  return {
    calls, size: [w, h],
    init: noop, set_source_rgba: noop, rectangle: noop, rectangle_rounded: noop, fill: noop, fill_preserve: noop, stroke: noop,
    set_line_width: noop, arc: noop, move_to: noop, line_to: noop, close_path: noop, select_font_face: noop, set_font_size: noop,
    save: noop, restore: noop, clip: noop,
    text_measure: (s) => [String(s).length * 6, 12],
    show_text: (s) => calls.show_text.push(s),
    redraw: () => { calls.redraw += 1; },
  };
}

test('v8ui franja: recarga en caliente con require vacío o con el motor viejo (PM-031)', () => {
  const files = maxFiles({ found: { 'sv_rs_engine.js': { bytes: engineBytes, folder: DIR } } });
  const old = Object.assign({}, loadBundle(), { build: '0.0.1+viejo' });
  for (const req of [() => ({}), () => old]) {
    const mg = fakeMgraphics(860, 169);
    const ctx = { mgraphics: mg, jsarguments: ['sv_rs_ui.js', 'strip'], File: files.File, require: req };
    const r = runScript('sv_rs_ui.js', ctx, { build: info.stamp });
    assert.equal(ctx.SV.build, info.stamp);
    assert.ok(r.posts.some((p) => /desde el archivo/.test(p)), r.posts.join(''));
    ctx.paint();
    assert.ok(mg.calls.show_text.includes('Generar'), 'la franja se dibuja con el motor del archivo');
    ctx.messagename = 'state';
    ctx.anything(JSON.stringify({ destination: 'bassline', patternId: 'RGG.10.2/bass_offbeat' }));
    ctx.paint();
    assert.ok(mg.calls.show_text.some((s) => /Bajo de dub techno/.test(s)), 'el estado llega a la vista');
  }
});

test('v8ui sin motor legible: dibuja el aviso y no falla con mensajes ni ratón', () => {
  const mg = fakeMgraphics(860, 169);
  const ctx = { mgraphics: mg, jsarguments: ['sv_rs_ui.js', 'panel'], File: maxFiles().File, require: () => ({}) };
  const r = runScript('sv_rs_ui.js', ctx, { build: info.stamp });
  ctx.paint();
  assert.ok(mg.calls.show_text.some((s) => /No se pudo cargar sv_rs_engine\.js: vuelve a cargar el dispositivo/.test(s)));
  assert.ok(r.posts.some((p) => /módulo sin \.core/.test(p) && /no se abre sv_rs_engine\.js/.test(p)), 'la consola explica cada intento');
  ctx.messagename = 'state';
  assert.doesNotThrow(() => {
    ctx.anything('{}'); ctx.search('dub'); ctx.key(32); ctx.onclick(10, 10); ctx.ondrag(10, 20, 1); ctx.ondblclick(10, 10);
    ctx.onidle(10, 10); ctx.onidleout(); ctx.onresize();
  });
  assert.equal(r.outlets.length, 0);
});

test('v8ui de SV Listen: motor del archivo junto al dispositivo cuando require falla', () => {
  const LDIR = 'C:/Users/X/Documents/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/SV Listen/';
  // el search path no lo encuentra por nombre: queda la carpeta de instalación escrita por build_listen
  const files = maxFiles({ disk: { [LDIR + 'sv_listen_engine.js']: engineBytes } });
  const mg = fakeMgraphics(300, 169);
  const ctx = { mgraphics: mg, File: files.File, require: () => { throw new Error('caché rota'); } };
  const r = runScript('sv_listen_ui.js', ctx, { build: info.stamp, installDir: LDIR });
  assert.equal(ctx.SV.build, info.stamp, r.posts.join(''));
  ctx.listen(JSON.stringify({ frames: 0 }));
  assert.ok(mg.calls.redraw > 0);
  assert.doesNotThrow(() => ctx.paint());
  assert.ok(!mg.calls.show_text.some((s) => /No se pudo cargar/.test(s)));
});

test('SV Listen: los parámetros que llegan antes de init no cargan el motor', () => {
  const files = maxFiles();
  let calls = 0;
  const SV = loadBundle();
  const ctx = { File: files.File, require: () => { calls += 1; if (!ctx.ready) throw new Error('could not find file'); return SV; } };
  class LiveAPI { get(prop) { if (prop === 'canonical_parent') return ['id', 7]; if (prop === 'name') return ['"Pad"']; return []; } }
  Object.assign(ctx, { LiveAPI, Dict: class { set() {} remove() {} }, Date });
  const r = runScript('sv_listen_v8.js', ctx);
  assert.doesNotThrow(() => { ctx.sensitivity(4); ctx.kickhz(120); ctx.bars(4); ctx.sr(48000); ctx.ts(3, 4); });
  assert.equal(calls, 0, 'sin require antes de init');
  assert.equal(r.posts.length, 0, r.posts.join(''));
  ctx.ready = true;
  ctx.init();
  assert.ok(r.outlets.some((o) => o[0] === 1 && o[1] === 'Escuchando · Pad'));
  assert.equal(ctx.cfg.kickHz, 120);
  assert.equal(ctx.cfg.sr, 48000);
  const first = ctx.lis;
  ctx.bars(8);
  assert.notEqual(ctx.lis, first, 'tras init, cambiar un parámetro rehace el analizador');
});

test('carpeta del dispositivo: patcher.filepath con la carpeta en vez del .amxd (PM-027)', () => {
  const LDIR = 'C:/Users/X/Documents/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/SV Listen/';
  class LiveAPI { get(prop) { if (prop === 'canonical_parent') return ['id', 3]; if (prop === 'name') return ['"Pad"']; return []; } }
  const base = () => ({ LiveAPI, Dict: class { set() {} remove() {} }, Date, require: () => { throw new Error('could not find file'); } });
  // filepath = la carpeta, sin barra final: el motor se lee de ahí y el diagnóstico se escribe ahí, no en la carpeta madre
  const files = maxFiles({ disk: { [LDIR + 'sv_listen_engine.js']: engineBytes }, writable: 'C:/Users/X/' });
  const ctx = Object.assign(base(), { File: files.File, patcher: { filepath: LDIR.replace(/\/$/, '') } });
  const r = runScript('sv_listen_v8.js', ctx, { build: info.stamp });
  ctx.init();
  assert.ok(r.outlets.some((o) => o[0] === 1 && o[1] === 'Escuchando · Pad'), r.posts.join(''));
  ctx.tick();
  const dbg = JSON.parse(files.written[LDIR + 'listen_debug_3.json']);
  assert.equal(dbg.folder, LDIR);
  assert.equal(dbg.filepath, LDIR.replace(/\/$/, ''));
  assert.ok(!Object.keys(files.written).some((k) => /Max Audio Effect\/listen_debug/.test(k)), 'nada en la carpeta madre');
  // filepath sin el motor: gana la carpeta donde File lo encuentra por nombre
  const f2 = maxFiles({ found: { 'sv_listen_engine.js': { bytes: engineBytes, folder: LDIR } }, writable: 'C:/Users/X/' });
  const ctx2 = Object.assign(base(), { File: f2.File, patcher: { filepath: LDIR.replace(/SV Listen\/$/, '') } });
  runScript('sv_listen_v8.js', ctx2, { build: info.stamp });
  assert.equal(ctx2.deviceFolder(), LDIR);
  // filepath con el .amxd: su carpeta, aunque no se pueda confirmar
  const ctx3 = Object.assign(base(), { File: maxFiles().File, patcher: { filepath: LDIR + 'SV Listen.amxd' } });
  runScript('sv_listen_v8.js', ctx3);
  assert.equal(ctx3.deviceFolder(), LDIR);
});
