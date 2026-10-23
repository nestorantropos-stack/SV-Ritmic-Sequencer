// SV Listen · script del objeto [v8 sv_listen_v8.js] (Audio Effect de Max for Live).
// El audio de la pista se graba en un buffer~ circular de 2 s; en cada «tick» se analizan los cuadros nuevos
// (2048 muestras, salto 512) con src/core/listen.js y, cada medio segundo, el resumen se publica en el
// [dict sv_listen] global (nombre fijo, visible para SV Ritmic Sequencer) con la clave del id de la pista.
//
// Entradas: init · bufname <nombre> · recpos <0..1> · ppq <negras> · tempo <bpm> · ts <num> <den>
//           transport <0|1> · tick [buffer] · on <0|1> · sensitivity <n> · kickhz <hz> · bars <n> · sr <frecuencia>
// Salidas: outlet 0 → «listen <json>» para la vista; outlet 1 → texto de estado.

autowatch = 1;
inlets = 1;
outlets = 2;

var SV = null;
var lis = null;
var cfg = { sr: 44100, frame: 2048, hop: 512, sensitivity: 3, kickHz: 150, bars: 8 };
var st = { on: true, buf: null, bufName: null, recpos: 0, ppq: null, spb: 22050, num: 4, den: 4, transport: 0, readIdx: null, lastPublish: 0, track: null, name: '' };

var self = this;

// Las escribe tools/build_listen.js (D-053); en src/ quedan vacías.
var SV_ENGINE_BUILD = ''; // sello del motor con el que se construyó este script
var SV_INSTALL_DIR = ''; // carpeta de instalación: último recurso de deviceFolder()
var ENGINE = 'sv_listen_engine.js';

// Carga del motor: la misma que en sv_rs_v8.js (D-053). Se lee el archivo con File y se evalúa aquí; require
// queda como último recurso, porque tras reinstalar da un módulo vacío o el motor viejo de su caché.
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

// Carpeta del dispositivo con «/» final (patcher.filepath sale vacío en Live; ver sv_rs_v8.js).
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
    post('SV Listen · ' + r.why.join(' · ') + '\n');
    throw new Error('No se pudo cargar ' + ENGINE + ': vuelve a cargar el dispositivo (arrástralo de nuevo o reabre el set)');
  }
  SV = r.engine;
  post('SV Listen: ' + ENGINE + ' ' + (SV.build || SV.version) + ' cargado' + (r.via === 'archivo' ? ' desde el archivo' : ' con require') + '\n');
  return SV;
}
function status(t) { outlet(1, t); }
function guard(fn) { try { return fn(); } catch (e) { post('SV Listen · error: ' + e.message + '\n'); status('Error: ' + e.message); st.lastError = e.message; debugWrite(); return null; } }

// Diagnóstico: listen_debug_<pista>.json junto al dispositivo (estado, buffer, transporte, resumen, último error).
var lastDebug = 0;
function debugWrite() {
  try {
    var now = Date.now();
    if (now - lastDebug < 1000) return;
    lastDebug = now;
    var dir = deviceFolder();
    if (!dir) return;
    var info = { at: now, track: st.track, name: st.name, on: st.on, bufName: st.bufName, frames: st.buf ? st.buf.framecount() : null, recpos: st.recpos, readIdx: st.readIdx, transport: st.transport, ppq: st.ppq, spb: st.spb, num: st.num, den: st.den, sr: cfg.sr, filepath: String((self && self.patcher && self.patcher.filepath) || ''), folder: dir, ticks: st.ticks || 0, fed: st.fed || 0, lastError: st.lastError || null, summary: lis ? lis.summary(st.name) : null };
    var f = new File(dir + 'listen_debug_' + (st.track || 'x') + '.json', 'write', 'TEXT');
    if (!f.isopen) return;
    f.writestring(JSON.stringify(info));
    f.eof = f.position;
    f.close();
  } catch (e) { /* el diagnóstico nunca rompe el análisis */ }
}

function newListener() {
  loadEngine();
  lis = SV.core.listen.createListener({ sampleRate: cfg.sr, frameSize: cfg.frame, hopSize: cfg.hop, sensitivity: cfg.sensitivity, kickHz: cfg.kickHz, bars: cfg.bars, barBeats: (st.num * 4) / st.den });
  lis.bpm = (cfg.sr / st.spb) * 60;
  st.readIdx = null;
}

// Los live.* mandan su valor al cargar, antes de init: hasta que init crea el analizador, solo se guarda la configuración.
function reconfigure() { if (lis) newListener(); }

function init() {
  guard(function () {
    loadEngine();
    var dev = new LiveAPI('this_device');
    var parent = dev.get('canonical_parent');
    var id = Number(parent[parent.length - 1]);
    var t = new LiveAPI('id ' + id);
    st.track = String(id);
    st.name = String(t.get('name')).replace(/^"|"$/g, '');
    newListener();
    status('Escuchando · ' + st.name);
  });
}

function bufname(n) { st.bufName = String(n); st.buf = null; }
function sr(v) { if (Number(v) === cfg.sr) return; var bpm = (cfg.sr / st.spb) * 60; cfg.sr = Number(v) || 44100; st.spb = (cfg.sr * 60) / bpm; reconfigure(); }
function recpos(v) { st.recpos = Number(v); }
function ppq(v) { st.ppq = Number(v); }
function tempo(v) { if (Number(v) > 0) { st.spb = (cfg.sr * 60) / Number(v); if (lis) lis.bpm = Number(v); } }
function ts(n, d) { if (Number(n) && Number(d) && (Number(n) !== st.num || Number(d) !== st.den)) { st.num = Number(n); st.den = Number(d); reconfigure(); } }
function transport(v) { st.transport = Number(v); }
function on(v) { st.on = !!Number(v); status(st.on ? 'Escuchando · ' + st.name : 'En pausa'); if (!st.on) publish(true); }
function sensitivity(v) { cfg.sensitivity = Number(v); reconfigure(); }
function kickhz(v) { cfg.kickHz = Number(v); reconfigure(); }
function bars(v) { cfg.bars = Math.max(1, Math.round(Number(v))); reconfigure(); }

// Lee `count` muestras que terminan en el índice `end` (excluido), con vuelta al inicio del buffer.
function readFrames(end, count) {
  var len = st.buf.framecount();
  var start = end - count;
  if (start >= 0) return st.buf.peek(1, start, count);
  var a = st.buf.peek(1, len + start, -start);
  var b = st.buf.peek(1, 0, end);
  return [].concat(a, b);
}

// tick [nombre del buffer]: el nombre viaja en cada tick para que una recarga en caliente no lo pierda
function tick(name) {
  guard(function () {
    st.ticks = (st.ticks || 0) + 1;
    if (name !== undefined && String(name) !== st.bufName) bufname(name);
    if (!st.on || !lis || !st.bufName) { debugWrite(); return; }
    if (!st.buf) st.buf = new Buffer(st.bufName);
    var len = st.buf.framecount();
    if (!(len > cfg.frame)) { debugWrite(); return; }
    var w = Math.floor(st.recpos * len);
    if (st.readIdx === null) st.readIdx = w;
    var pending = (w - st.readIdx + len) % len;
    if (pending > len / 2) { st.readIdx = w; return; } // se perdió el hilo (pausa larga): se reanuda desde aquí
    var spbNow = st.spb;
    while (pending >= cfg.hop) {
      st.readIdx = (st.readIdx + cfg.hop) % len;
      pending -= cfg.hop;
      var frame = readFrames(st.readIdx === 0 ? len : st.readIdx, cfg.frame);
      // posición del final del cuadro: la del transporte ahora menos lo que aún falta por leer
      var beat = st.transport && st.ppq !== null ? st.ppq - pending / spbNow : null;
      lis.feed(frame, beat);
      st.fed = (st.fed || 0) + 1;
    }
    publish(false);
    debugWrite();
  });
}

// Referencia permanente al dict compartido: un Dict de JS sin dueño se libera y SV Ritmic Sequencer lo vería vacío
// (visto en Live: «audio 0/0»). El patch tiene además un [dict sv_listen] que lo mantiene vivo.
var shared = null;
function sharedDict() { if (!shared) shared = new Dict('sv_listen'); return shared; }
sharedDict.local = 1;

function publish(force) {
  var now = Date.now();
  if (!force && now - st.lastPublish < 500) return;
  st.lastPublish = now;
  var s = lis.summary(st.name);
  s.track = st.track;
  s.updated = now;
  s.active = st.on;
  sharedDict().set(String(st.track || 'sin_pista'), JSON.stringify(s));
  outlet(0, 'listen', JSON.stringify(s));
}

function notifydeleted() {
  // al borrar el dispositivo, su entrada desaparece del dict compartido
  guard(function () { if (st.track) sharedDict().remove(String(st.track)); });
}

function anything() { post('SV Listen: mensaje desconocido «' + messagename + '»\n'); }

loadEngine.local = 1; status.local = 1; guard.local = 1; newListener.local = 1; reconfigure.local = 1; readFrames.local = 1; publish.local = 1; debugWrite.local = 1;
requireEngine.local = 1; engineOk.local = 1; utf8.local = 1; readText.local = 1; evalEngine.local = 1; withSlash.local = 1; foundFolder.local = 1; hasEngine.local = 1; filepathFolder.local = 1; deviceFolder.local = 1;

// recarga en caliente (autowatch): si no llegó init, se inicia solo
if (typeof Task !== 'undefined') {
  var autoInit = new Task(function () { if (!lis || !st.track) init(); }, this);
  autoInit.schedule(1000);
}
