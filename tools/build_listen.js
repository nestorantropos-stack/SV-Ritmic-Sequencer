'use strict';
// Construye «SV Listen» (Audio Effect de Max for Live, fase A del diseño docs/SV_LISTEN_DISENO.md):
//   · el audio pasa sin cambios (plugin~ → plugout~);
//   · la mezcla mono se graba en un buffer~ circular de 2 s (record~ @loop 1; «---» lo hace único por dispositivo);
//   · cada 20 ms un [metro] pide al transporte (plugsync~) la posición en negras, el tempo y el compás, toma la
//     posición de grabación (snapshot~) y manda «tick» al [v8 sv_listen_v8.js], que analiza los cuadros nuevos
//     (src/core/listen.js) y publica el resumen en el [dict sv_listen] global que lee SV Ritmic Sequencer;
//   · vista [v8ui sv_listen_ui.js] de 300 × 169 y controles live.* (Escuchar, Sensibilidad, Bombo Hz, Compases).
// Uso: node tools/build_listen.js            → build/listen/
//      node tools/build_listen.js --install  → además copia a la User Library (Audio Effects/Max Audio Effect)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Patch, pInt, pFloat, amxd, readAmxd } = require('./lib/patcher');
const { build: buildBundle } = require('./bundle');
const { copyAtomic, prepareScript } = require('./lib/install');
const view = require('../src/ui/listen_view');
const { THEME, rgba } = require('../src/ui/theme');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'listen');
const NAME = 'SV Listen';
const BUF = '---sv_listen_buf';
const CTRL_X = view.SIZE.width; // los controles van a la derecha de la vista
const DEVICE_W = CTRL_X + 96;

function devicePatch() {
  const P = new Patch();
  // paso del audio
  const pin = P.obj('plugin~', 20, 20, 2, 2, { outlettype: ['signal', 'signal'] });
  const pout = P.obj('plugout~', 20, 300, 2, 0);
  P.link(pin, 0, pout, 0); P.link(pin, 1, pout, 1);
  // mezcla mono → buffer circular
  const sum = P.obj('+~', 160, 60, 2, 1, { outlettype: ['signal'] });
  const half = P.obj('*~ 0.5', 160, 100, 2, 1, { outlettype: ['signal'] });
  P.link(pin, 0, sum, 0); P.link(pin, 1, sum, 1); P.link(sum, 0, half);
  P.obj(`buffer~ ${BUF} 2000 1`, 160, 220, 1, 2, { w: 200, outlettype: ['float', 'bang'] });
  const rec = P.obj(`record~ ${BUF} @loop 1`, 160, 140, 3, 1, { w: 200, outlettype: ['signal'] });
  P.link(half, 0, rec);
  const snap = P.obj('snapshot~', 160, 180, 2, 1, { outlettype: ['float'] });
  P.link(rec, 0, snap);

  const v8 = P.obj('v8 sv_listen_v8.js', 420, 520, 1, 2, { w: 160 });
  // mantiene vivo el dict compartido mientras el dispositivo exista
  P.obj('dict sv_listen', 620, 520, 2, 4, { w: 110, outlettype: ['dictionary', '', '', ''] });

  // arranque: grabar siempre, nombre del buffer, frecuencia de muestreo e init
  const td = P.obj('live.thisdevice', 420, 20, 1, 3, { outlettype: ['bang', 'int', 'int'] });
  const dl = P.obj('deferlow', 420, 60, 1, 1);
  const tb = P.obj('t b b b', 420, 100, 1, 3, { outlettype: ['bang', 'bang', 'bang'] });
  const mOne = P.msg('1', 160, 20);
  const mBuf = P.msg(`bufname ${BUF}`, 600, 140, { w: 160 });
  const mInit = P.msg('init', 420, 140);
  P.link(td, 0, dl); P.link(dl, 0, tb);
  P.link(tb, 2, mOne); P.link(mOne, 0, rec);
  P.link(tb, 1, mBuf); P.link(mBuf, 0, v8);
  P.link(tb, 0, mInit); P.link(mInit, 0, v8);
  const ds = P.obj('dspstate~', 780, 100, 1, 4, { outlettype: ['int', 'float', 'int', 'int'] });
  const psr = P.obj('prepend sr', 780, 140, 1, 1);
  P.link(td, 0, ds); P.link(ds, 1, psr); P.link(psr, 0, v8);

  // reloj de análisis: transporte → posición de grabación → tick (el trigger va de derecha a izquierda)
  const tog = P.msg('1', 420, 220);
  const metro = P.obj('metro 20', 420, 260, 2, 1, { outlettype: ['bang'] });
  P.link(tb, 0, tog); P.link(tog, 0, metro);
  const tk = P.obj('t b b b', 420, 300, 1, 3, { outlettype: ['bang', 'bang', 'bang'] });
  P.link(metro, 0, tk);
  const ps = P.obj('plugsync~', 600, 340, 1, 9, { outlettype: ['int', 'int', 'int', 'float', 'list', 'float', 'float', 'int', 'int'] });
  P.link(tk, 2, ps);
  P.link(tk, 1, snap);
  const mTick = P.msg(`tick ${BUF}`, 420, 460, { w: 160 });
  P.link(tk, 0, mTick); P.link(mTick, 0, v8);
  const pRec = P.obj('prepend recpos', 160, 260, 1, 1);
  P.link(snap, 0, pRec); P.link(pRec, 0, v8);
  [[0, 'transport'], [4, 'ts'], [5, 'tempo'], [6, 'ppq']].forEach(([o, m], i) => {
    const pp = P.obj(`prepend ${m}`, 600 + i * 100, 400, 1, 1);
    P.link(ps, o, pp); P.link(pp, 0, v8);
  });

  // vista
  const ui = P.obj(null, 20, 600, 1, 0, {
    maxclass: 'v8ui', pres: [0, 0, view.SIZE.width, view.SIZE.height], filename: 'sv_listen_ui.js', parameter_enable: 0,
    textfile: { filename: 'sv_listen_ui.js', flags: 0, embed: 0, autowatch: 1 },
  });
  P.link(v8, 0, ui);

  // controles
  P.obj(null, 0, 0, 1, 0, { maxclass: 'panel', pres: [CTRL_X, 0, DEVICE_W - CTRL_X, view.SIZE.height], bgcolor: rgba(THEME.bg), mode: 0, background: 1 });
  const status = P.comment('', 700, 600, { pres: [CTRL_X + 4, 150, 90, 14], textcolor: rgba(THEME.dim), fontsize: 8 });
  const pSet = P.obj('prepend set', 700, 560, 1, 1);
  P.link(v8, 1, pSet); P.link(pSet, 0, status);
  const controls = [
    { msg: 'on', box: { maxclass: 'live.text', pres: [CTRL_X + 8, 8, 80, 18], mode: 1, text: 'Escuchar', texton: 'Escuchando', param: { ...pInt('Escuchar', 'Escuchar', 0, 1, 1), parameter_type: 2, parameter_enum: ['off', 'on'] } }, outs: 2 },
    { msg: 'sensitivity', box: { maxclass: 'live.dial', pres: [CTRL_X + 4, 30, 44, 48], param: pFloat('Sensibilidad', 'Sensib.', 1, 6, 3, 1) }, outs: 2 },
    { msg: 'kickhz', box: { maxclass: 'live.dial', pres: [CTRL_X + 48, 30, 44, 48], param: pInt('Bombo Hz', 'Bombo', 60, 250, 150, 3) }, outs: 2 },
    { msg: 'bars', box: { maxclass: 'live.numbox', pres: [CTRL_X + 8, 96, 80, 16], param: pInt('Compases', 'Compases', 1, 16, 8) }, outs: 2 },
  ];
  P.comment('Compases', 1000, 80, { pres: [CTRL_X + 8, 82, 80, 14], textcolor: rgba(THEME.dim), fontsize: 9 });
  controls.forEach((c, i) => {
    const x = 1000 + i * 110;
    const box = P.obj(null, x, 120, 1, c.outs, { ...c.box, outlettype: ['', 'float'] });
    const pp = P.obj(`prepend ${c.msg}`, x, 170, 1, 1, { w: 100 });
    P.link(box, 0, pp); P.link(pp, 0, v8);
  });

  return P.dump({ presentation: true, deviceWidth: DEVICE_W, rect: [40, 40, 1500, 800] });
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const b = buildBundle(path.join(OUT, 'sv_listen_engine.js'));
  // los scripts llevan el sello del motor: tras reinstalar, no aceptan el motor viejo de la caché de require (D-053)
  const scripts = ['sv_listen_v8.js', 'sv_listen_ui.js'];
  const src = {};
  for (const f of scripts) {
    src[f] = fs.readFileSync(path.join(ROOT, 'src', 'max', f), 'utf8');
    fs.writeFileSync(path.join(OUT, f), prepareScript(src[f], { build: b.stamp }));
  }
  const patch = devicePatch();
  fs.writeFileSync(path.join(OUT, `${NAME}.maxpat`), JSON.stringify(patch, null, 1));
  const bin = amxd(patch, 'audio');
  fs.writeFileSync(path.join(OUT, `${NAME}.amxd`), bin);
  const back = readAmxd(bin);
  if (back.kind !== 'aaaa' || back.patch.patcher.boxes.length !== patch.patcher.boxes.length) throw new Error('El .amxd no se relee igual');
  console.log(`ok: ${OUT} · ${patch.patcher.boxes.length} cajas · motor ${(b.bytes / 1024).toFixed(0)} KB`);
  if (process.argv.includes('--install')) {
    const dest = path.join(os.homedir(), 'Documents', 'Ableton', 'User Library', 'Presets', 'Audio Effects', 'Max Audio Effect', 'SV Listen');
    fs.mkdirSync(dest, { recursive: true });
    // el motor primero y de forma atómica; los scripts en su sitio para que autowatch los recargue
    copyAtomic(path.join(OUT, 'sv_listen_engine.js'), path.join(dest, 'sv_listen_engine.js'));
    fs.copyFileSync(path.join(OUT, `${NAME}.amxd`), path.join(dest, `${NAME}.amxd`));
    for (const f of scripts) fs.writeFileSync(path.join(dest, f), prepareScript(src[f], { build: b.stamp, installDir: dest }));
    require('./make_adv').writeAdv(path.join(dest, `${NAME}.amxd`), path.join(dest, `${NAME}.adv`), 'audio');
    console.log(`instalado en ${dest}`);
  }
}

if (require.main === module) main();
module.exports = { devicePatch, NAME, BUF };
