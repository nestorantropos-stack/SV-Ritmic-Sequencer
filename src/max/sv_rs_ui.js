// SV Ritmic Sequencer · script de interfaz para [v8ui sv_rs_ui.js strip] y [v8ui sv_rs_ui.js panel].
// Dibuja con el mismo código que las maquetas SVG (src/ui) y traduce clics a mensajes:
//   p_<parámetro> <índice>  → a los objetos live.* (automatizables, se guardan con el set)
//   <comando> [args]        → al motor (generate, regenerate, vary, undo, redo, analyze, reroll, audition, lock)
//   open_panel              → abre la ventana del navegador (pcontrol)
// Entrada: los mensajes del motor («state», «harmony», «preview», «result», «analysis», «error», «status»)
// y «search <texto>» desde el [textedit] del panel.

autowatch = 1;
inlets = 1;
outlets = 1;

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var MODE = (typeof jsarguments !== 'undefined' && jsarguments.length > 1) ? String(jsarguments[1]) : 'strip';
var self = this;

// Las escribe tools/build_amxd.js (D-053); en src/ quedan vacías.
var SV_ENGINE_BUILD = ''; // sello del motor con el que se construyó este script
var SV_INSTALL_DIR = ''; // carpeta de instalación: último recurso de deviceFolder()
var ENGINE = 'sv_rs_engine.js';

// Carga del motor: la misma que en los scripts v8 (D-053). Se lee el archivo con File y se evalúa aquí; require
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


// Motor o null: sin motor la vista solo dibuja el aviso (drawMissing) y no atiende mensajes ni ratón.
function loadEngine() {
  var r = requireEngine(ENGINE);
  if (!r.engine) {
    post('SV Ritmic Sequencer UI · ' + r.why.join(' · ') + '\n');
    post('SV Ritmic Sequencer UI: no se pudo cargar ' + ENGINE + ': vuelve a cargar el dispositivo (arrástralo de nuevo o reabre el set)\n');
    return null;
  }
  post('SV Ritmic Sequencer UI: ' + ENGINE + ' ' + (r.engine.build || r.engine.version) + ' cargado' + (r.via === 'archivo' ? ' desde el archivo' : ' con require') + '\n');
  return r.engine;
}
function drawMissing() {
  mgraphics.set_source_rgba(0.9, 0.4, 0.35, 1);
  mgraphics.select_font_face('Arial');
  mgraphics.set_font_size(11);
  mgraphics.move_to(8, 18);
  mgraphics.show_text('No se pudo cargar ' + ENGINE + ': vuelve a cargar el dispositivo');
}

var SV = loadEngine();
var UI = SV ? SV.ui : null;
var view = UI ? (MODE === 'panel' ? UI.panel : UI.strip) : null;
var model = UI ? UI.model.create(SV) : null;
var hits = [];
var drag = null;

function paint() {
  if (!SV) { drawMissing(); return; }
  var size = mgraphics.size;
  var g = UI.canvas.fromMgraphics(mgraphics);
  try { hits = view.draw(g, model, size[0], size[1]); } catch (e) { post('SV UI: ' + e.message + '\n'); }
}

function anything() {
  if (!SV) return;
  var args = arrayfromargs(arguments);
  if (UI.model.receive(model, messagename, args.join(' '))) mgraphics.redraw();
}

function search() {
  if (!SV) return;
  var args = arrayfromargs(arguments);
  UI.model.receive(model, 'search', args.join(' '));
  mgraphics.redraw();
}

function send(action) {
  if (!action || !SV) return;
  if (action.kind === 'param') outlet(0, action.name, action.value);
  else if (action.kind === 'cmd') {
    if (action.name === 'open_panel') outlet(0, 'open_panel');
    else if (Array.isArray(action.value)) outlet(0, [action.name].concat(action.value));
    else if (action.value !== undefined) outlet(0, action.name, action.value);
    else outlet(0, action.name);
  } else if (action.kind === 'ui') {
    if (view.applyUiAction && view.applyUiAction(model, action)) mgraphics.redraw();
  }
  if (action.kind === 'cmd' && action.name === 'use_suggestion') { model.showSuggest = false; mgraphics.redraw(); }
}

// [key] en la ventana del panel → atajos
function key(code) {
  if (!SV || MODE !== 'panel') return;
  var a = UI.panel.keyAction(model, code);
  if (a) { send(a); mgraphics.redraw(); }
}

function onclick(x, y) {
  if (!SV) return;
  var h = UI.strip.hitTest(hits, x, y);
  if (h && h.action && h.action.kind === 'scroll') { drag = { y: y, name: h.action.name, rowH: h.action.rowH, max: h.action.max, start: model.panel[h.action.name] || 0, moved: false, x: x }; return; }
  drag = null;
  if (h) send(h.action);
}

function ondrag(x, y, button) {
  if (!SV) return;
  if (!drag) return;
  if (!button) {
    // soltar sin mover: es un clic sobre un elemento dentro de la zona desplazable
    if (!drag.moved) {
      var inner = hits.filter(function (k) { return k.action && k.action.kind !== 'scroll'; });
      var h = UI.strip.hitTest(inner, drag.x, drag.y);
      if (h) send(h.action);
    }
    drag = null;
    return;
  }
  var steps = Math.round((drag.y - y) / drag.rowH);
  if (steps !== 0) drag.moved = true;
  var v = Math.max(0, Math.min(drag.max, drag.start + steps));
  if (v !== model.panel[drag.name]) { model.panel[drag.name] = v; mgraphics.redraw(); }
}

function ondblclick(x, y) {
  if (!SV) return;
  var h = UI.strip.hitTest(hits.filter(function (k) { return k.action && k.action.kind !== 'scroll'; }), x, y);
  // doble clic en una tarjeta del panel: usar ese ritmo
  if (h && h.action && h.action.name === 'select') send({ kind: 'param', name: 'p_ritmo', value: UI.model.patternIndex(model, h.action.value) });
}

function onidle(x, y) {
  if (!SV) return;
  var inner = hits.filter(function (k) { return k.action && k.action.kind !== 'scroll'; });
  var h = UI.strip.hitTest(inner, x, y);
  var help = h && h.help ? h.help : null;
  var prev = model.hover && model.hover.help;
  if (help !== prev) { model.hover = help ? { help: help } : null; mgraphics.redraw(); }
}

function onidleout() { if (model && model.hover) { model.hover = null; mgraphics.redraw(); } }

function onresize() { mgraphics.redraw(); }

send.local = 1;
