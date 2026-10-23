'use strict';
// Empaqueta el núcleo, el puente, el controlador y los datos en un único archivo CommonJS para el objeto
// v8 de Max (D-003): sin rutas relativas que resolver dentro del dispositivo y con un nombre único.
// Uso: node tools/bundle.js [salida]   (por defecto build/device/sv_rs_engine.js)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadAll } = require('./lib/data');

const ROOT = path.join(__dirname, '..');
const ENTRIES = ['src/core/index.js', 'src/max/live_bridge.js', 'src/max/controller.js', 'src/ui/index.js'];
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

function collect(entry, seen = new Map()) {
  const abs = path.join(ROOT, entry);
  const key = rel(abs);
  if (seen.has(key)) return seen;
  const raw = fs.readFileSync(abs, 'utf8');
  // un .json se incrusta como módulo
  const src = key.endsWith('.json') ? `module.exports = ${JSON.stringify(JSON.parse(raw))};` : raw;
  seen.set(key, src);
  if (key.endsWith('.json')) return seen;
  const re = /require\(\s*'(\.{1,2}\/[^']+)'\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    let dep = path.join(path.dirname(abs), m[1]);
    if (!/\.(js|json)$/.test(dep)) dep += '.js';
    collect(rel(dep), seen);
  }
  // los módulos del núcleo no pueden usar módulos de Node (no existen en v8 de Max)
  const nodeReq = /require\(\s*'(?!\.)([^']+)'\s*\)/.exec(src);
  if (nodeReq) throw new Error(`${key} usa el módulo de Node «${nodeReq[1]}»: no puede ir al bundle`);
  return seen;
}

function build(out = path.join(ROOT, 'build', 'device', 'sv_rs_engine.js')) {
  const mods = new Map();
  for (const e of ENTRIES) collect(e, mods);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const D = loadAll();
  const data = { taxonomy: D.taxonomy, scales: D.scales, drumMaps: D.drumMaps, microtiming: D.microtiming, families: D.families, patterns: D.patterns };
  const parts = [];
  parts.push(`// SV Ritmic Sequencer · motor empaquetado para el objeto v8 de Max for Live.`);
  parts.push(`// Generado por tools/bundle.js (versión ${pkg.version}). No editar a mano: editar src/ y data/.`);
  parts.push(`'use strict';`);
  parts.push('var __svDefs = {};');
  for (const [key, src] of mods) {
    parts.push(`__svDefs[${JSON.stringify(key)}] = function (module, exports, require) {\n${src}\n};`);
  }
  parts.push(`var __svData = ${JSON.stringify(data)};`);
  // sello del contenido: el script v8 construido con este motor lo compara para no usar uno viejo en caché (D-053)
  const stamp = `${pkg.version}+${crypto.createHash('sha1').update(parts.join('\n')).digest('hex').slice(0, 12)}`;
  parts.push(`
var __svCache = {};
function __svJoin(from, req) {
  var base = from.split('/'); base.pop();
  var segs = req.split('/');
  for (var i = 0; i < segs.length; i++) {
    if (segs[i] === '.' || segs[i] === '') continue;
    if (segs[i] === '..') base.pop(); else base.push(segs[i]);
  }
  var p = base.join('/');
  return /\\.(js|json)$/.test(p) ? p : p + '.js';
}
function __svRequire(key) {
  if (__svCache[key]) return __svCache[key].exports;
  if (!__svDefs[key]) throw new Error('SV bundle: módulo ausente ' + key);
  var mod = { exports: {} };
  __svCache[key] = mod;
  __svDefs[key].call(mod.exports, mod, mod.exports, function (req) { return __svRequire(__svJoin(key, req)); });
  return mod.exports;
}
var __sv = {
  version: ${JSON.stringify(pkg.version)},
  build: ${JSON.stringify(stamp)},
  core: __svRequire('src/core/index.js'),
  bridge: __svRequire('src/max/live_bridge.js'),
  controller: __svRequire('src/max/controller.js'),
  ui: __svRequire('src/ui/index.js'),
  data: __svData
};
if (typeof module !== 'undefined' && module.exports) module.exports = __sv;
`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, parts.join('\n'));
  return { out, modules: [...mods.keys()], bytes: fs.statSync(out).size, stamp };
}

if (require.main === module) {
  const r = build(process.argv[2]);
  console.log(`ok: ${r.out} · ${r.modules.length} módulos · ${(r.bytes / 1024).toFixed(0)} KB`);
}

module.exports = { build };
