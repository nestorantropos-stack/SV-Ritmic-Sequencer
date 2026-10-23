// SV Ritmic Sequencer · script del objeto [v8 sv_rs_v8.js] dentro del dispositivo Max for Live.
// Traduce mensajes de Max a métodos del controlador. Toda la lógica vive en sv_rs_engine.js (bundle).
//
// Mensajes de entrada (inlet 0):
//   init                        → crea el puente con la Live API (llamar tras [live.thisdevice] → [deferlow])
//   destination_index · harmony_mode_index · root_note · scale_index · pattern_index · repeats_index <i>
//                               → desde los live.* (el orden sale de los mismos datos que los menús)
//   destination <d> · harmony <raíz> <escala> · harmony_mode <m> · random_seed <n> · reroll · sync_scale <0|1>
//   pattern <id> · category <id> · repeats <auto|full|n> · seed <n> · option <clave> <valor|json>
//   form <nombre> <valor>       → controles de forma del panel (densidad, síncopa, microtiempo, humanizar…)
//   lock <rol> <0|1> · analyze · correct <raíz> <escala> | correct none
//   generate · regenerate · vary · undo · redo · audition <0|1> · preview · state · catalog [json]
//   suggest · use_suggestion <i> · history · history_goto <i> · export_midi
//   presets_dict <nombre> · preset_save [nombre] · preset_load <i> · preset_delete <i> · presets
// Salidas: outlet 0 → «<tipo> <json>» para la interfaz; outlet 1 → texto de estado;
//          outlet 2 → bang al terminar init; outlet 3 → «altura velocity» para [midiformat] (escucha previa);
//          outlet 4 → «p_<parámetro> <valor>» para sincronizar los live.* cuando el estado cambia desde dentro.

autowatch = 1;
inlets = 1;
outlets = 5;

var SV = null;
var ctl = null;
var presetsDictName = null;
var bridge = null;
var scaleObservers = null;
var self = this;

// Las escribe tools/build_amxd.js (D-053); en src/ quedan vacías.
var SV_ENGINE_BUILD = ''; // sello del motor con el que se construyó este script
var SV_INSTALL_DIR = ''; // carpeta de instalación: último recurso de deviceFolder()
var ENGINE = 'sv_rs_engine.js';

// Carga del motor (D-053). Tras una reinstalación, autowatch recarga este script pero el require de v8 devuelve
// un módulo sin exportaciones o el motor viejo de su caché (y Max escribe «could not find file» en rojo). Por eso el
// motor se lee del archivo con File y se evalúa aquí; require queda como último recurso. Solo vale un motor con .core
// y, si el script lleva sello, el mismo sello.
function engineOk(m) { return !!(m && m.core && (!SV_ENGINE_BUILD || m.build === SV_ENGINE_BUILD)); }
function utf8(b) {
  var s = '', buf = [];
  for (var i = 0; i < b.length;) {
    var c = b[i++] & 255;
    if (c >= 0xF0) {
      c = (((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63)) - 0x10000;
      buf.push(0xD800 + (c >> 10), 0xDC00 + (c & 1023));
    } else if (c >= 0xE0) buf.push(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else if (c >= 0xC0) buf.push(((c & 31) << 6) | (b[i++] & 63));
    else buf.push(c);
    if (buf.length >= 8192) { s += String.fromCharCode.apply(null, buf); buf = []; }
  }
  s += String.fromCharCode.apply(null, buf);
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}
// Texto del archivo (nombre en el search path de Max o ruta absoluta), o null si no se abre.
function readText(name) {
  var f = new File(name, 'read');
  if (!f.isopen) return null;
  var bytes = [];
  try {
    while (f.position < f.eof) {
      var chunk = f.readbytes(Math.min(65536, f.eof - f.position));
      if (!chunk || !chunk.length) break;
      for (var i = 0; i < chunk.length; i++) bytes.push(chunk[i]);
    }
  } finally { f.close(); }
  return utf8(bytes);
}
function evalEngine(path) {
  var src = readText(path);
  if (src === null) throw new Error('no se abre ' + path);
  var mod = { exports: {} };
  (new Function('module', 'exports', 'require', src))(mod, mod.exports, function (n) { throw new Error('el motor no puede requerir ' + n); });
  return mod.exports;
}
function requireEngine(name) {
  var why = [];
  var m = null;
  var paths = [name];
  var dir = deviceFolder();
  if (dir) paths.push(dir + name);
  for (var i = 0; i < paths.length; i++) {
    try { m = evalEngine(paths[i]); } catch (e) { why.push(paths[i] + ': ' + e.message); continue; }
    if (engineOk(m)) return { engine: m, via: 'archivo' };
    why.push(paths[i] + ': motor ' + (m && m.build) + ' distinto del esperado');
  }
  // último recurso: require (si no encuentra el archivo, Max escribe «could not find file» en rojo)
  m = null;
  try { m = require(name); } catch (e) { why.push('require: ' + e.message); }
  if (engineOk(m)) return { engine: m, via: 'require' };
  if (m && m.core) why.push('require dio el motor ' + m.build + ' y este script es del ' + SV_ENGINE_BUILD);
  else if (m) why.push('require dio un módulo sin .core');
  return { engine: null, why: why };
}

// Carpeta del dispositivo con «/» final, o '' si no se conoce (D-053). En Live, patcher.filepath sale vacío o con la
// carpeta en vez del .amxd, así que solo vale si el motor está ahí; si no, la carpeta donde File encuentra el motor en
// el search path (que incluye la del dispositivo) y, por último, la de instalación que escribió build_amxd.js --install.
var folderCache = null; // carpeta ya confirmada (con el motor dentro)
function withSlash(d) { d = String(d).replace(/\\/g, '/'); return /\/$/.test(d) ? d : d + '/'; }
function foundFolder(name) {
  try {
    var f = new File(name, 'read');
    var dir = f.isopen ? String(f.foldername || '') : '';
    if (f.isopen) f.close();
    return dir ? withSlash(dir) : '';
  } catch (e) { return ''; }
}
function hasEngine(dir) {
  try {
    var f = new File(dir + ENGINE, 'read');
    var ok = !!f.isopen;
    if (ok) f.close();
    return ok;
  } catch (e) { return false; }
}
// patcher.filepath: la ruta del .amxd (se quita el nombre) o, como en SV Listen en Live, la de su carpeta.
function filepathFolder() {
  var fp = String((self && self.patcher && self.patcher.filepath) || '').replace(/\\/g, '/');
  if (!fp) return '';
  return /\.[A-Za-z0-9]+$/.test(fp) ? fp.replace(/[^\/]+$/, '') : withSlash(fp);
}
function deviceFolder() {
  if (folderCache) return folderCache;
  var fp = filepathFolder();
  if (fp && hasEngine(fp)) return (folderCache = fp);
  var found = foundFolder(ENGINE); // File ya encontró el motor ahí
  if (found) return (folderCache = found);
  // sin confirmar: la carpeta de instalación y, si no, la de filepath
  return SV_INSTALL_DIR ? withSlash(SV_INSTALL_DIR) : fp;
}

function loadEngine() {
  if (SV) return SV;
  var r = requireEngine(ENGINE);
  if (!r.engine) {
    post('SV Ritmic Sequencer · ' + r.why.join(' · ') + '\n');
    throw new Error('No se pudo cargar ' + ENGINE + ': vuelve a cargar el dispositivo (arrástralo de nuevo o reabre el set)');
  }
  SV = r.engine;
  post('SV Ritmic Sequencer: sv_rs_engine ' + SV.version + (SV.build ? ' (' + SV.build + ')' : '') + ' cargado' + (r.via === 'archivo' ? ' desde el archivo' : ' con require') + '\n');
  return SV;
}

function emit(type, obj) { outlet(0, type, JSON.stringify(obj)); }
function status(text) { outlet(1, text); }
function guard(fn) {
  try { return fn(); } catch (e) {
    post('SV Ritmic Sequencer · error: ' + e.message + '\n');
    emit('error', { message: e.message });
    status('Error: ' + e.message);
    return null;
  }
}
function parseValue(v) {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return v; }
}

// Tras cualquier cambio: estado, armonía resuelta y vista previa de lo que escribirá Generar.
function refresh() {
  if (!ctl) return;
  emit('state', ctl.snapshot());
  try { emit('harmony', ctl.resolveHarmony()); } catch (e) { /* la armonía Live/Adaptable puede no estar disponible aún */ }
  try {
    var r = ctl.preview();
    emit('preview', { length_beats: r.length_beats, plan: r.plan, meta: r.meta, notes: r.notes.map(function (n) { return [n.pitch, n.start_time, n.duration, n.velocity, n.role]; }) });
  } catch (e) { emit('error', { message: e.message }); }
}

function init() {
  guard(function () {
    loadEngine();
    bridge = SV.bridge.createBridge(LiveAPI, { post: function (s) { post(s + '\n'); } });
    ctl = SV.controller.createController({ core: SV.core, data: SV.data, bridge: bridge, post: function (s) { post(s + '\n'); }, presetStore: dictStore(), listenSource: listenSource });
    flushPending();
    refresh();
    status('Listo');
    outlet(2, 'bang');
  });
}

function need() { if (!ctl) throw new Error('El motor aún no está listo (falta init).'); return ctl; }

// Los live.* restauran su valor al abrir el set, a veces antes de init: esos mensajes esperan en cola.
var pending = [];
function whenReady(fn) { if (ctl) { guard(fn); refresh(); } else pending.push(fn); }
function flushPending() { var q = pending; pending = []; q.forEach(function (fn) { guard(fn); }); }

function lists() {
  loadEngine();
  return {
    destinations: SV.data.taxonomy.destinations.map(function (d) { return d.id; }),
    modes: ['manual', 'live', 'adaptive', 'random'],
    scales: SV.data.scales.scales.map(function (s) { return s.id; }),
    patterns: SV.core.catalog.publicPatterns(SV.data.patterns).map(function (p) { return p.id; }),
    repeats: ['auto', 3, 4, 8, 16, 'full'],
  };
}
function destination_index(i) { whenReady(function () { need().setDestination(lists().destinations[i]); }); }
function harmony_mode_index(i) { whenReady(function () { need().setHarmonyMode(lists().modes[i]); }); }
function root_note(i) { whenReady(function () { need().setHarmony(i, ctl.state.scaleId); }); }
function scale_index(i) { whenReady(function () { need().setHarmony(ctl.state.root, lists().scales[i]); }); }
function pattern_index(i) { whenReady(function () { emit('pattern', need().setPattern(lists().patterns[i])); }); }
function repeats_index(i) { whenReady(function () { need().setRepeats(lists().repeats[i]); }); }
function seed(s) { whenReady(function () { need().setSeed(Math.max(1, Math.round(Number(s)) || 1)); }); }

function destination(d) { whenReady(function () { need().setDestination(String(d)); }); }
function harmony(root, scaleId) { whenReady(function () { need().setHarmony(root, scaleId); }); }
function harmony_mode(m) { whenReady(function () { need().setHarmonyMode(String(m)); }); }
function random_seed(s) { whenReady(function () { need().setRandomSeed(s); }); }
function reroll() { whenReady(function () { need().rerollHarmony(); }); }
function pattern(id) { whenReady(function () { emit('pattern', need().setPattern(String(id))); }); }
function category(c) { whenReady(function () { need().setCategory(String(c)); }); }
function repeats(r) { whenReady(function () { need().setRepeats(r); }); }
function lock(role, on) { whenReady(function () { need().lock(String(role), !!Number(on)); }); }

function option() {
  var args = arrayfromargs(arguments);
  whenReady(function () { need().setOption(String(args[0]), args.length > 1 ? parseValue(args.slice(1).join(' ')) : null); });
}

// Controles de forma del panel (§5): traducción de parámetros de la interfaz a opciones del generador.
var form_state = { density: 0, velMin: 1, velMax: 127 };
function form(name, value) {
  whenReady(function () {
    var c = need();
    var v = Number(value);
    switch (String(name)) {
      case 'densidad': form_state.density = v / 100; c.setOption('transform', v ? { density: v / 100 } : null); break;
      case 'sincopa': c.setOption('syncopation', v > 0 ? v / 100 : null); break;
      case 'microtiempo': c.setOption('microtiming', ['', 'swing_16_62', 'samba', 'telespringar', 'laid_back', 'push'][v] || null); break;
      case 'humanizar': c.setOption('humanize', v > 0 ? { sigmaMs: v, drift: 0.7 } : null); break;
      case 'vel_min': form_state.velMin = v; c.setOption('velocityRange', [form_state.velMin, Math.max(form_state.velMin, form_state.velMax)]); break;
      case 'vel_max': form_state.velMax = v; c.setOption('velocityRange', [Math.min(form_state.velMin, form_state.velMax), form_state.velMax]); break;
      case 'adaptable': c.state.adaptive.amount = v / 100; break;
      case 'seguir_bombo': c.state.adaptive.alignBassToKick = ['auto', true, false][v]; break;
      default: post('SV Ritmic Sequencer: control de forma desconocido «' + name + '»\n');
    }
  });
}

function sync_scale(on) {
  whenReady(function () {
    need().setSyncScale(!!Number(on));
    if (Number(on) && !scaleObservers) {
      var b = SV.bridge.createBridge(LiveAPI, {});
      scaleObservers = b.observeScale(function () { refresh(); });
    }
    if (!Number(on) && scaleObservers) { scaleObservers.forEach(function (o) { o.property = ''; }); scaleObservers = null; }
  });
}

function analyze() { guard(function () { status('Leyendo el set…'); var a = need().analyze(); emit('analysis', a); debugAnalysis(a); refresh(); status('Set leído · audio ' + listenDiag.ok + '/' + listenDiag.keys + (listenDiag.types.length ? ' (' + listenDiag.types.join(',') + ')' : '') + ' · usadas ' + a.audioTracks + ' · tonalidad ' + ((a.key && a.key.name) || '—')); }); }

// Diagnóstico: analysis_debug.json junto al dispositivo (lo leído del dict sv_listen y el análisis resultante).
function debugAnalysis(a) {
  try {
    var dir = deviceFolder();
    if (!dir) return;
    var raw = listenSource();
    var f = new File(dir + 'analysis_debug.json', 'write', 'TEXT');
    if (!f.isopen) return;
    f.writestring(JSON.stringify({ at: Date.now(), listen: raw.map(function (s) { return { track: s.track, name: s.name, level: s.level, updated: s.updated, active: s.active, chroma: s.chroma, kick: s.kick }; }), key: a.key, scale: a.scale && a.scale[0], kick: a.kick, audioTracks: a.audioTracks, read: a.read }).slice(0, 30000));
    f.eof = f.position;
    f.close();
  } catch (e) { post('SV Ritmic Sequencer · diagnóstico: ' + e.message + '\n'); }
}
debugAnalysis.local = 1;
function correct(root, scaleId) { whenReady(function () { need().correctAdaptive(root === 'none' ? null : root, scaleId); }); }

// Preajustes en el [dict ---sv_rs_presets @embed 1] del dispositivo (se guarda con el set).
function presets_dict(name) { presetsDictName = String(name); }
function dictStore() {
  return {
    load: function () {
      if (!presetsDictName) return [];
      try { var d = new Dict(presetsDictName); var j = d.get('json'); return j ? JSON.parse(String(j)) : []; } catch (e) { return []; }
    },
    save: function (arr) {
      if (!presetsDictName) { post('SV Ritmic Sequencer: sin dict de preajustes\n'); return; }
      var d = new Dict(presetsDictName);
      d.set('json', JSON.stringify(arr));
    },
  };
}

// Resúmenes publicados por los SV Listen del set en el [dict sv_listen] global (clave: id de pista; valor: JSON).
// Un valor del dict puede volver como texto o, si Max lo interpretó, como diccionario (Dict) u objeto.
var listenDiag = { keys: 0, ok: 0, types: [] };
var listenDict = null; // referencia permanente (ver sv_listen_v8.js)
function parseListenValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return JSON.parse(v);
  if (typeof v === 'object' && typeof v.stringify === 'function') return JSON.parse(v.stringify());
  if (typeof v === 'object' && !(v instanceof Array)) return v;
  return JSON.parse(String(v instanceof Array ? v.join(' ') : v));
}
parseListenValue.local = 1;
function listenSource() {
  var out = [];
  listenDiag = { keys: 0, ok: 0, types: [] };
  try {
    if (!listenDict) listenDict = new Dict('sv_listen');
    var d = listenDict;
    var keys = d.getkeys();
    if (keys === null || keys === undefined) return out;
    if (!(keys instanceof Array)) keys = [keys];
    for (var i = 0; i < keys.length; i++) {
      var v = d.get(keys[i]);
      listenDiag.keys += 1;
      listenDiag.types.push(v instanceof Array ? 'array' : typeof v);
      try { var s = parseListenValue(v); if (s && s.active !== false) { out.push(s); listenDiag.ok += 1; } } catch (e) { listenDiag.types.push('err:' + e.message.slice(0, 30)); }
    }
  } catch (e) { listenDiag.types.push('dict:' + e.message.slice(0, 30)); return []; }
  return out;
}
listenSource.local = 1;

// Lleva los live.* al estado actual (sin ellos, el set restauraría valores viejos).
function syncParams() {
  var idx = ctl.paramIndices();
  for (var k in idx) if (idx[k] !== -1 && idx[k] !== null && idx[k] !== undefined) outlet(4, k, idx[k]);
}

function written(r) { return r && r.written ? 'Clip escrito en la ranura ' + (r.written.slot + 1) : 'Clip escrito'; }
function afterWrite(r, label) { emit('result', r); outlet(4, 'p_semilla', ctl.state.seed); refresh(); emit('history', ctl.historyList()); status(label + written(r)); }
function generate() { guard(function () { status('Generando…'); afterWrite(need().generate(), ''); }); }
function regenerate() { guard(function () { afterWrite(need().regenerate(), 'Regenerado · '); }); }
function vary() { guard(function () { afterWrite(need().vary(), 'Variación · '); }); }
function undo() { guard(function () { var r = need().undo(); if (r) { emit('result', r); emit('history', ctl.historyList()); } status(r ? 'Deshecho' : 'Nada que deshacer'); }); }
function redo() { guard(function () { var r = need().redo(); if (r) { emit('result', r); emit('history', ctl.historyList()); } status(r ? 'Rehecho' : 'Nada que rehacer'); }); }
function state() { guard(function () { refresh(); emit('history', need().historyList()); emit('presets', ctl.listPresets()); }); }
function preview() { guard(function () { refresh(); }); }

function suggest() {
  guard(function () {
    status('Buscando ritmos para este set…');
    var s = need().suggest();
    emit('suggestions', s);
    status(s.suggestions.length ? 'Sugerencias: ' + s.suggestions.map(function (x) { return x.name; }).join(' · ') : 'Sin sugerencias para este destino');
  });
}
function use_suggestion(i) { guard(function () { if (need().useSuggestion(i)) { syncParams(); refresh(); } }); }
function history() { guard(function () { emit('history', need().historyList()); }); }
function history_goto(i) { guard(function () { var r = need().gotoHistory(i); if (r) { emit('result', r); emit('history', ctl.historyList()); status('Historial: generación ' + (Number(i) + 1)); } }); }
function presets() { guard(function () { emit('presets', need().listPresets()); }); }
function preset_save() {
  var args = arrayfromargs(arguments);
  guard(function () { emit('presets', need().savePreset(args.join(' '))); status('Preajuste guardado'); });
}
function preset_load(i) { guard(function () { var p = need().loadPreset(i); if (p) { syncParams(); refresh(); status('Preajuste: ' + p.name); } }); }
function preset_delete(i) { guard(function () { emit('presets', need().deletePreset(i)); }); }

// Exportar .mid junto al dispositivo (carpeta exports/), visible en el navegador de Live para arrastrarlo.
function export_midi() {
  guard(function () {
    var e = need().exportMidi();
    var dir = deviceFolder();
    if (!dir) throw new Error('No se conoce la carpeta del dispositivo para exportar (reinstala con build_amxd.js --install).');
    var path = dir + 'exports/' + e.name + '.mid';
    var f = new File(path, 'write', 'Midi');
    if (!f.isopen) { path = dir + e.name + '.mid'; f = new File(path, 'write', 'Midi'); }
    if (!f.isopen) throw new Error('No se pudo escribir ' + path);
    f.writebytes(e.bytes);
    f.eof = f.position;
    f.close();
    emit('exported', { path: path, notes: e.notes });
    status('Exportado: ' + path + ' (arrástralo desde la User Library del navegador)');
  });
}

// Escucha previa: toca la vista previa por el instrumento de la pista ([midiformat] → [midiout]) en bucle.
var aud = { on: false, tasks: [], sounding: {} };
function audStop() {
  aud.tasks.forEach(function (t) { t.cancel(); });
  aud.tasks = [];
  for (var p in aud.sounding) outlet(3, Number(p), 0);
  aud.sounding = {};
}
function audPass() {
  if (!aud.on) return;
  var r = need().preview();
  var bpm = 120;
  try { bpm = bridge.setInfo().tempo; } catch (e) { bpm = 120; }
  var ms = 60000 / bpm;
  r.notes.forEach(function (n) {
    var on = new Task(function () { outlet(3, n.pitch, n.velocity); aud.sounding[n.pitch] = 1; }, this);
    var off = new Task(function () { outlet(3, n.pitch, 0); delete aud.sounding[n.pitch]; }, this);
    on.schedule(n.start_time * ms);
    off.schedule((n.start_time + n.duration) * ms);
    aud.tasks.push(on, off);
  });
  var again = new Task(function () { aud.tasks = []; audPass(); }, this);
  again.schedule(r.length_beats * ms);
  aud.tasks.push(again);
}
function audition(on) {
  guard(function () {
    audStop();
    aud.on = !!Number(on);
    if (aud.on) audPass();
    emit('audition', aud.on ? 1 : 0);
    status(aud.on ? 'Escuchando la vista previa…' : 'Escucha detenida');
  });
}

function catalog() {
  var args = arrayfromargs(arguments);
  guard(function () {
    loadEngine();
    var filters = args.length ? parseValue(args.join(' ')) : {};
    var list = SV.core.catalog.search(SV.data.patterns, filters).map(function (p) {
      return { id: p.id, name: p.name, tradition: p.origin.tradition, meter: p.meter, status: p.status, badges: SV.core.catalog.badges(p) };
    });
    emit('catalog', list);
  });
}

function notifydeleted() { audStop(); }
function anything() { post('SV Ritmic Sequencer: mensaje desconocido «' + messagename + '»\n'); }

// funciones auxiliares privadas: no se exponen como mensajes de Max
loadEngine.local = 1; emit.local = 1; status.local = 1; guard.local = 1; parseValue.local = 1; refresh.local = 1;
need.local = 1; whenReady.local = 1; flushPending.local = 1; lists.local = 1; written.local = 1;
dictStore.local = 1; syncParams.local = 1; afterWrite.local = 1;
audStop.local = 1; audPass.local = 1;
requireEngine.local = 1; engineOk.local = 1; utf8.local = 1; readText.local = 1; evalEngine.local = 1; withSlash.local = 1; foundFolder.local = 1; hasEngine.local = 1; filepathFolder.local = 1; deviceFolder.local = 1;

// Si Max recarga este script en caliente (autowatch, p. ej. al reinstalar), live.thisdevice no vuelve a disparar:
// se inicia solo al cabo de un segundo. En la carga normal init llega antes por live.thisdevice (D-047).
if (typeof Task !== 'undefined') {
  var autoInit = new Task(function () { if (!ctl) init(); }, this);
  autoInit.schedule(1000);
}
