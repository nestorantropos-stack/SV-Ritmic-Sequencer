'use strict';
// Construye el dispositivo «SV Ritmic Sequencer» (.amxd + .maxpat) con la interfaz de la Fase 4:
//   · franja [v8ui sv_rs_ui.js strip] de 860 × 169 px con los cuatro pasos;
//   · parámetros live.* ocultos (Destino, Armonía, Raíz, Escala, Ritmo, Repeticiones, Semilla): automatizables y
//     guardados con el set; la interfaz los cambia enviándoles el índice y ellos avisan al motor;
//   · ventana flotante [p sv_rs_panel] (abierta con pcontrol) con el navegador [v8ui … panel], un [textedit] de
//     búsqueda y los controles de forma (live.dial / live.menu) nativos;
//   · escucha previa: motor → [midiformat] → [midiout].
// Uso: node tools/build_amxd.js            → build/device/
//      node tools/build_amxd.js --install  → además copia a la User Library (MIDI Effects/Max MIDI Effect)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Patch, pInt, pFloat, pEnum, amxd, readAmxd } = require('./lib/patcher');
const { build: buildBundle } = require('./bundle');
const { copyAtomic, prepareScript } = require('./lib/install');
const { loadAll } = require('./lib/data');
const core = require('../src/core');
const strip = require('../src/ui/strip');
const panel = require('../src/ui/panel');
const { THEME, rgba } = require('../src/ui/theme');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'device');
const NAME = 'SV Ritmic Sequencer';
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const REPEAT_LABELS = ['Auto', '3', '4', '8', '16', 'Ciclo completo'];
const PANEL_H = 700;

function v8ui(P, mode, x, y, pres) {
  return P.obj(null, x, y, 1, 1, {
    maxclass: 'v8ui', w: pres[2], h: pres[3], pres, filename: 'sv_rs_ui.js', jsarguments: [mode], parameter_enable: 0,
    textfile: { filename: 'sv_rs_ui.js', flags: 0, embed: 0, autowatch: 1 },
  });
}

// Subpatcher de la ventana del navegador.
function panelPatch() {
  const P = new Patch();
  const inl = P.obj(null, 20, 20, 0, 1, { maxclass: 'inlet', index: 1, comment: 'mensajes del motor y pcontrol' });
  const ui = v8ui(P, 'panel', 20, 80, [0, 0, panel.SIZE.width, panel.SIZE.height]);
  P.link(inl, 0, ui);
  const outUi = P.obj(null, 20, 760, 1, 0, { maxclass: 'outlet', index: 1, comment: 'acciones de la interfaz' });
  P.link(ui, 0, outUi);
  // buscador nativo sobre el área reservada por panel.AREAS.search
  const s = panel.AREAS.search;
  const te = P.obj(null, 1100, 80, 1, 4, { maxclass: 'textedit', pres: [s.x, s.y, s.w, s.h], outlettype: ['', 'int', '', ''], outputmode: 1, keymode: 1, tabmode: 0, bangmode: 0, fontname: THEME.font, fontsize: 11, bgcolor: rgba(THEME.surface2), textcolor: rgba(THEME.text), bordercolor: rgba(THEME.line), rounded: 3, text: '' });
  const rt = P.obj('route text', 1100, 130, 2, 2);
  const ps = P.obj('prepend search', 1100, 170, 1, 1);
  P.link(te, 0, rt); P.link(rt, 0, ps); P.link(ps, 0, ui);
  // atajos de teclado (solo con la ventana del panel enfocada)
  const kb = P.obj('key', 1100, 230, 0, 4, { outlettype: ['int', 'int', 'int', 'int'] });
  const pk = P.obj('prepend key', 1100, 270, 1, 1);
  P.link(kb, 0, pk); P.link(pk, 0, ui);
  // controles de forma
  P.obj(null, 0, 0, 1, 0, { maxclass: 'panel', pres: [0, panel.SIZE.height, panel.SIZE.width, PANEL_H - panel.SIZE.height], bgcolor: rgba(THEME.bg), mode: 0, background: 1 });
  P.comment('Forma', 1300, 20, { pres: [12, panel.SIZE.height + 4, 60, 14], textcolor: rgba(THEME.accent), fontsize: 10 });
  const outForm = P.obj(null, 1300, 760, 1, 0, { maxclass: 'outlet', index: 2, comment: 'controles de forma → motor' });
  const controls = [
    { name: 'densidad', label: 'Densidad', kind: 'dial', param: pInt('Densidad', 'Densidad', -100, 100, 0) },
    { name: 'sincopa', label: 'Síncopa', kind: 'dial', param: pInt('Síncopa', 'Síncopa', 0, 100, 0) },
    { name: 'microtiempo', label: 'Microtiempo', kind: 'menu', param: pEnum('Microtiempo', 'Micro', ['Recto', 'Swing 62 %', 'Samba', 'Telespringar', 'Laid-back', 'Push'], 1) },
    { name: 'humanizar', label: 'Humanizar', kind: 'dial', param: pInt('Humanizar', 'Human', 0, 30, 0) },
    { name: 'vel_min', label: 'Vel. mín', kind: 'dial', param: pInt('Velocity mínima', 'Vel min', 1, 127, 1) },
    { name: 'vel_max', label: 'Vel. máx', kind: 'dial', param: pInt('Velocity máxima', 'Vel max', 1, 127, 127) },
    { name: 'adaptable', label: 'Adaptable', kind: 'dial', param: pInt('Complementariedad', 'Adapt', 0, 100, 50) },
    { name: 'seguir_bombo', label: 'Seguir bombo', kind: 'menu', param: pEnum('Seguir bombo', 'Bombo', ['Auto', 'Sí', 'No'], 0) },
  ];
  let x = 80;
  controls.forEach((c, i) => {
    const px = 1300 + i * 90;
    let box;
    if (c.kind === 'dial') {
      box = P.obj(null, px, 80, 1, 2, { maxclass: 'live.dial', pres: [x, panel.SIZE.height + 6, 44, 48], outlettype: ['', 'float'], param: c.param });
      x += 64;
    } else {
      P.comment(c.label, px, 60, { pres: [x, panel.SIZE.height + 8, 100, 14], textcolor: rgba(THEME.dim), fontsize: 9 });
      box = P.obj(null, px, 80, 1, 3, { maxclass: 'live.menu', pres: [x, panel.SIZE.height + 26, 100, 16], outlettype: ['', '', 'float'], param: c.param });
      x += 116;
    }
    const pp = P.obj(`prepend form ${c.name}`, px, 130, 1, 1, { w: 150 });
    P.link(box, 0, pp); P.link(pp, 0, outForm);
  });
  const sub = P.dump({ presentation: true, rect: [120, 120, panel.SIZE.width, PANEL_H] }).patcher;
  return { ...sub, toolbarvisible: 0, statusbarvisible: 0, enablehscroll: 0, enablevscroll: 0, title: 'SV Ritmic Sequencer · Navegador de ritmos' };
}

function devicePatch(D) {
  const P = new Patch();
  // MIDI pasa sin cambios; la escucha previa entra por midiformat
  const mi = P.obj('midiin', 20, 20, 1, 1, { outlettype: ['int'] });
  const mo = P.obj('midiout', 20, 520, 1, 0);
  P.link(mi, 0, mo);

  const v8 = P.obj('v8 sv_rs_v8.js', 300, 420, 1, 5, { w: 170 });
  const td = P.obj('live.thisdevice', 300, 20, 1, 3, { outlettype: ['bang', 'int', 'int'] });
  const dl = P.obj('deferlow', 300, 60, 1, 1);
  // primero el nombre del dict de preajustes (--- se vuelve único por dispositivo), después init
  const tb = P.obj('t b b', 300, 100, 1, 2, { outlettype: ['bang', 'bang'] });
  const mInit = P.msg('init', 300, 140);
  const mDict = P.msg('presets_dict ---sv_rs_presets', 420, 140);
  P.obj('dict ---sv_rs_presets @embed 1', 420, 180, 2, 4, { w: 200, outlettype: ['dictionary', '', '', ''] });
  P.link(td, 0, dl); P.link(dl, 0, tb); P.link(tb, 1, mDict); P.link(mDict, 0, v8); P.link(tb, 0, mInit); P.link(mInit, 0, v8);

  const mf = P.obj('midiformat', 20, 470, 7, 2, { outlettype: ['int', ''] });
  P.link(v8, 3, mf); P.link(mf, 0, mo);

  // franja
  const ui = v8ui(P, 'strip', 600, 600, [0, 0, strip.SIZE.width, strip.SIZE.height]);
  P.link(v8, 0, ui);
  const st = P.obj('prepend status', 600, 470, 1, 1);
  P.link(v8, 1, st); P.link(st, 0, ui);

  // parámetros live.* ocultos (fuera de la presentación); el orden de cada menú es el de model.lists
  const pub = core.catalog.publicPatterns(D.patterns);
  const params = [
    { route: 'p_destino', msg: 'destination_index', box: { maxclass: 'live.menu', param: pEnum('Destino', 'Destino', D.taxonomy.destinations.map((d) => d.name), 1) } },
    { route: 'p_armonia', msg: 'harmony_mode_index', box: { maxclass: 'live.menu', param: pEnum('Armonía', 'Armonía', ['Manual', 'Live 12', 'Adaptable', 'Random'], 0) } },
    { route: 'p_raiz', msg: 'root_note', box: { maxclass: 'live.menu', param: pEnum('Raíz', 'Raíz', NOTE_NAMES, 0) } },
    { route: 'p_escala', msg: 'scale_index', box: { maxclass: 'live.menu', param: pEnum('Escala', 'Escala', D.scales.scales.map((s) => s.name), D.scales.scales.findIndex((s) => s.id === 'minor')) } },
    { route: 'p_ritmo', msg: 'pattern_index', box: { maxclass: 'live.menu', param: pEnum('Ritmo', 'Ritmo', pub.map((p) => `${p.name} (${p.id.split('/')[0]})`), pub.findIndex((p) => p.id === 'RGG.10.2/stab_weighted')) } },
    { route: 'p_repeticiones', msg: 'repeats_index', box: { maxclass: 'live.menu', param: pEnum('Repeticiones', 'Repet.', REPEAT_LABELS, 0) } },
    // Live limita los parámetros enteros a 256 valores (visto en Live 12.4.6: Semilla 1..9999 aparecía con máximo 256);
    // la semilla va como flotante con presentación entera y el motor la redondea (D-046)
    { route: 'p_semilla', msg: 'seed', box: { maxclass: 'live.numbox', param: pFloat('Semilla', 'Semilla', 1, 9999, 1, 0) } },
  ];
  const routeNames = [...params.map((p) => p.route), 'open_panel'];
  const route = P.obj(`route ${routeNames.join(' ')}`, 600, 820, 1, routeNames.length + 1, { w: 560 });
  P.link(ui, 0, route);
  params.forEach((p, i) => {
    const x = 600 + i * 120;
    const outs = p.box.maxclass === 'live.numbox' ? 2 : 3;
    const box = P.obj(null, x, 880, 1, outs, { ...p.box, w: 100, h: 18, outlettype: p.box.maxclass === 'live.numbox' ? ['', 'float'] : ['', '', 'float'] });
    const pp = P.obj(`prepend ${p.msg}`, x, 920, 1, 1, { w: 110 });
    P.link(route, i, box); P.link(box, 0, pp); P.link(pp, 0, v8);
  });
  // comandos sin parámetro (generate, regenerate, vary, undo, redo, analyze, reroll, audition, lock…) van al motor
  P.link(route, routeNames.length, v8);
  // el motor sincroniza los live.* (semilla nueva, preajuste cargado) por el mismo route
  P.link(v8, 4, route);

  // ventana del navegador
  const sub = P.obj('p sv_rs_panel', 1200, 600, 1, 2, { w: 120, patcher: panelPatch() });
  const pc = P.obj('pcontrol', 1200, 560, 1, 1);
  const mOpen = P.msg('open', 1200, 520);
  P.link(route, routeNames.indexOf('open_panel'), mOpen);
  P.link(mOpen, 0, pc); P.link(pc, 0, sub);
  P.link(v8, 0, sub);
  P.link(st, 0, sub);
  P.link(sub, 0, route);
  P.link(sub, 1, v8);

  return P.dump({ presentation: true, deviceWidth: strip.SIZE.width, rect: [40, 40, 1600, 1000] });
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const D = loadAll();
  const b = buildBundle(path.join(OUT, 'sv_rs_engine.js'));
  // los scripts llevan el sello del motor: tras reinstalar, no aceptan el motor viejo de la caché de require (D-053)
  const scripts = ['sv_rs_v8.js', 'sv_rs_ui.js'];
  const src = {};
  for (const f of scripts) {
    src[f] = fs.readFileSync(path.join(ROOT, 'src', 'max', f), 'utf8');
    fs.writeFileSync(path.join(OUT, f), prepareScript(src[f], { build: b.stamp }));
  }
  const patch = devicePatch(D);
  fs.writeFileSync(path.join(OUT, `${NAME}.maxpat`), JSON.stringify(patch, null, 1));
  const bin = amxd(patch, 'midi');
  fs.writeFileSync(path.join(OUT, `${NAME}.amxd`), bin);
  const back = readAmxd(bin);
  if (back.kind !== 'mmmm' || back.patch.patcher.boxes.length !== patch.patcher.boxes.length) throw new Error('El .amxd no se relee igual');
  console.log(`ok: ${OUT} · ${patch.patcher.boxes.length} cajas · motor ${(b.bytes / 1024).toFixed(0)} KB`);
  if (process.argv.includes('--install')) {
    const dest = path.join(os.homedir(), 'Documents', 'Ableton', 'User Library', 'Presets', 'MIDI Effects', 'Max MIDI Effect', 'SV Ritmic Sequencer');
    fs.mkdirSync(path.join(dest, 'exports'), { recursive: true });
    // el motor primero: los scripts se recargan solos al cambiar (autowatch) y deben encontrarlo completo
    copyAtomic(path.join(OUT, 'sv_rs_engine.js'), path.join(dest, 'sv_rs_engine.js'));
    fs.rmSync(path.join(dest, 'sv_rs_engine_alt.js'), { force: true }); // respaldo anterior a D-053, ya sin uso
    // los scripts en su sitio (no por renombrado), para que autowatch los recargue; saben su carpeta (Exportar .mid)
    fs.copyFileSync(path.join(OUT, `${NAME}.amxd`), path.join(dest, `${NAME}.amxd`));
    for (const f of scripts) fs.writeFileSync(path.join(dest, f), prepareScript(src[f], { build: b.stamp, installDir: dest }));
    require('./make_adv').writeAdv(path.join(dest, `${NAME}.amxd`), path.join(dest, `${NAME}.adv`));
    console.log(`instalado en ${dest}`);
  }
}

if (require.main === module) main();
module.exports = { devicePatch, panelPatch, NAME };
