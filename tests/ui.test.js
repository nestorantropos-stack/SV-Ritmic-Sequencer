'use strict';
// Interfaz (Fase 4): accesibilidad, cadenas, geometría, dibujo, zonas de clic y el script v8ui en un entorno
// mgraphics simulado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');
const { THEME, contrast } = require('../src/ui/theme');
const { ES } = require('../src/ui/strings');
const G = require('../src/ui/geometry');
const { svgCanvas, recorderCanvas } = require('../src/ui/canvas');
const M = require('../src/ui/model');
const strip = require('../src/ui/strip');
const panel = require('../src/ui/panel');
const { build } = require('../tools/bundle');

const D = loadAll();
const SV = { core, data: D };
const newModel = () => M.create(SV);

test('contraste suficiente (WCAG): texto ≥ 4,5:1 y textos secundarios ≥ 4,5:1 sobre las superficies', () => {
  for (const bg of [THEME.bg, THEME.surface, THEME.surface2]) {
    assert.ok(contrast(THEME.text, bg) >= 7, `texto sobre ${bg}`);
    assert.ok(contrast(THEME.dim, bg) >= 4.5, `secundario sobre ${bg}: ${contrast(THEME.dim, bg).toFixed(2)}`);
  }
  assert.ok(contrast(THEME.bg, THEME.accent) >= 4.5, 'texto del botón principal');
  for (const ax of D.taxonomy.axes) assert.ok(contrast(ax.color, THEME.surface) >= 3, `color del eje ${ax.id}`);
});

test('todas las cadenas usadas en la interfaz existen en strings.es.json', () => {
  const dir = path.join(__dirname, '..', 'src', 'ui');
  const used = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/\bt\('([a-z0-9_.]+)'/g)) used.add(m[1]);
  }
  for (const k of used) assert.ok(ES[k] !== undefined, `falta la cadena «${k}»`);
  for (const id of D.taxonomy.destinations.map((d) => d.id)) assert.ok(ES[`dest.${id}`] && ES[`dest.help.${id}`]);
  for (const v of ['none', 'fill', 'hat_triplet_fill', 'trap_roll', 'tihai', 'gong', 'llamada', 'virada', 'dropout', 'density_up']) assert.ok(ES[`var.${v}`], v);
});

test('geometría: círculo de Toussaint, repeticiones, piano roll y rejilla deformable', () => {
  const c = G.circleGeometry({ cycleLen: 16, layers: [{ role: 'timeline', onsets: [0, 3, 6, 10, 12] }], grouping: [3, 3, 4, 2, 4] }, 50, 50, 40);
  assert.equal(c.ticks.length, 16);
  assert.equal(c.shapes[0].points.length, 5);
  assert.ok(Math.abs(c.shapes[0].points[0].x - 50) < 1e-9 && Math.abs(c.shapes[0].points[0].y - 10) < 1e-9, 'el paso 0 arriba');
  assert.equal(c.arcs.length, 5);
  const rl = G.repetitionLine({ repeats: 4, variationCycle: 3, cycleBeats: 4, totalBeats: 16, barBeats: 4 }, 0, 0, 100, 8);
  assert.equal(rl.blocks.length, 4);
  assert.deepEqual(rl.blocks.map((b) => b.variation), [false, false, false, true]);
  const pr = G.pianoRoll([{ pitch: 60, start_time: 0, duration: 1, velocity: 100 }, { pitch: 67, start_time: 2, duration: 0.5, velocity: 80 }], 4, 0, 0, 400, 100);
  assert.equal(pr.rects.length, 2);
  assert.ok(pr.rects[0].y > pr.rects[1].y, 'las notas agudas quedan arriba');
  assert.equal(pr.rects[1].x, 200);
  const dg = G.deformableGrid(core.gridFromBeatProportions([0.38, 0.34, 0.28], 1), 0, 300);
  assert.deepEqual(dg.map((x) => Math.round(x.x)), [0, 114, 216]);
});

function allHitsInside(hits, w, h) {
  for (const k of hits) assert.ok(k.x >= -0.5 && k.y >= -0.5 && k.x + k.w <= w + 0.5 && k.y + k.h <= h + 0.5, `zona fuera del área: ${JSON.stringify(k.action)}`);
}

test('franja: dibuja todos los destinos y ritmos sin errores, con zonas de clic válidas', () => {
  const routeParams = { p_destino: 'destinations', p_armonia: 'modes', p_raiz: null, p_escala: 'scales', p_ritmo: 'patterns', p_repeticiones: 'repeats' };
  for (const dest of D.taxonomy.destinations.map((d) => d.id)) {
    for (const mode of M.MODES) {
      const m = newModel();
      m.state.destination = dest;
      m.state.harmonyMode = mode;
      m.state.patternId = M.browseList(m)[0].id;
      const g = recorderCanvas();
      const hits = strip.draw(g, m);
      allHitsInside(hits, strip.SIZE.width, strip.SIZE.height);
      for (const k of hits) {
        if (k.action.kind !== 'param') continue;
        assert.ok(k.action.name in routeParams, k.action.name);
        const list = routeParams[k.action.name];
        const max = list ? m.lists[list].length : 12;
        assert.ok(Number.isInteger(k.action.value) && k.action.value >= 0 && k.action.value < max, `${k.action.name} ${k.action.value}`);
      }
      assert.ok(hits.some((k) => k.action.name === 'generate'));
    }
  }
});

test('franja: clics de destino, tecla negra sobre blanca y navegación de ritmos', () => {
  const m = newModel();
  const hits = strip.draw(recorderCanvas(), m);
  const dest = hits.filter((k) => k.action.name === 'p_destino');
  assert.deepEqual(dest.map((k) => k.action.value), [0, 1, 2, 3, 4, 5]);
  const keys = hits.filter((k) => k.action.name === 'p_raiz');
  const cs = keys.find((k) => k.action.value === 1);
  const at = strip.hitTest(hits, cs.x + cs.w / 2, cs.y + 2);
  assert.equal(at.action.value, 1, 'la tecla negra gana sobre la blanca de debajo');
  const next = hits.find((k) => k.help === ES['rhythm.next']);
  const list = M.browseList(m);
  const pos = list.findIndex((p) => p.id === m.state.patternId);
  assert.equal(m.lists.patterns[next.action.value], list[(pos + 1) % list.length].id);
  const svg = svgCanvas(strip.SIZE.width, strip.SIZE.height);
  strip.draw(svg, m);
  assert.match(svg.toString(), /<svg[\s\S]*Generar[\s\S]*<\/svg>/);
});

test('panel: navegación por ejes, filtros, selección y bloqueo de capas', () => {
  const m = newModel();
  let hits = panel.draw(recorderCanvas(), m);
  allHitsInside(hits, panel.SIZE.width, panel.SIZE.height);
  const axisHit = hits.find((k) => k.action.name === 'node' && k.action.value === 'CIC');
  assert.ok(panel.applyUiAction(m, axisHit.action));
  assert.equal(m.panel.axis, 'CIC');
  const rows = panel.treeRows(m);
  assert.ok(rows.some((r) => r.id === 'CIC.4' && r.depth === 1), 'el eje se despliega');
  panel.applyUiAction(m, { name: 'node', value: 'CIC.4.3' });
  m.panel.onlyDest = false;
  const list = M.panelList(m);
  assert.ok(list.length >= 5 && list.every((p) => p.taxonomy.some((t) => t.startsWith('CIC.4.3'))), 'filtro por nodo');
  hits = panel.draw(recorderCanvas(), m);
  const card = hits.find((k) => k.action.name === 'select');
  panel.applyUiAction(m, card.action);
  assert.equal(m.panel.selected, card.action.value);
  hits = panel.draw(recorderCanvas(), m);
  const use = hits.find((k) => k.action.name === 'p_ritmo');
  assert.equal(m.lists.patterns[use.action.value], m.panel.selected, '«Usar este ritmo» envía su índice');
  panel.applyUiAction(m, { name: 'crumb', value: null });
  assert.equal(m.panel.axis, null);
  M.receive(m, 'search', 'clave');
  m.panel.onlyDest = false;
  assert.ok(M.panelList(m).length >= 5);
  const lockHit = panel.draw(recorderCanvas(), m).find((k) => k.action.name === 'lock');
  assert.equal(lockHit.action.value[1], 1);
  // el kultrún no aparece nunca en el navegador
  M.receive(m, 'search', 'kultrun');
  assert.equal(M.panelList(m).length, 0);
});

// Entorno mgraphics simulado para el script v8ui.
function fakeMgraphics(w, h) {
  const calls = { show_text: [], redraw: 0 };
  const noop = () => {};
  return {
    calls, size: [w, h], relative_coords: 1, autofill: 1,
    init: noop, set_source_rgba: noop, rectangle: noop, rectangle_rounded: noop, fill: noop, fill_preserve: noop, stroke: noop,
    set_line_width: noop, arc: noop, move_to: noop, line_to: noop, close_path: noop, select_font_face: noop, set_font_size: noop,
    save: noop, restore: noop, clip: noop,
    text_measure: (s) => [String(s).length * 6, 12],
    show_text: (s) => calls.show_text.push(s),
    redraw: () => { calls.redraw += 1; },
  };
}

function loadUiScript(mode, size) {
  const out = path.join(os.tmpdir(), `sv_rs_engine_ui_${process.pid}_${mode}.js`);
  build(out);
  const box = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(out, 'utf8'), box);
  fs.unlinkSync(out);
  const mg = fakeMgraphics(size.width, size.height);
  const outlets = [];
  const ctx = {
    mgraphics: mg, jsarguments: ['sv_rs_ui.js', mode], post: () => {}, outlet: (...a) => outlets.push(a),
    require: () => box.module.exports, arrayfromargs: (a) => Array.from(a), messagename: '',
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'max', 'sv_rs_ui.js'), 'utf8'), ctx);
  return { ctx, mg, outlets };
}

test('v8ui franja: pinta, recibe estado, emite parámetros y comandos, muestra ayudas', () => {
  const { ctx, mg, outlets } = loadUiScript('strip', strip.SIZE);
  assert.equal(mg.relative_coords, 0);
  ctx.paint();
  assert.ok(mg.calls.show_text.includes('Generar'));
  ctx.messagename = 'state';
  ctx.anything(JSON.stringify({ destination: 'bassline', patternId: 'RGG.10.2/bass_offbeat' }));
  ctx.paint();
  assert.ok(mg.calls.show_text.some((s) => /Bajo de dub techno/.test(s)), 'el estado llega a la vista');
  const L = strip.layout();
  const gen = L.mods[3];
  ctx.onclick(gen.x + gen.w / 2, gen.y + 30);
  assert.deepEqual(outlets.pop(), [0, 'generate']);
  const d = L.mods[0];
  ctx.onclick(d.x + 10, d.y + 30);
  assert.deepEqual(outlets.pop(), [0, 'p_destino', 0]);
  ctx.onidle(gen.x + gen.w / 2, gen.y + 30);
  ctx.paint();
  assert.ok(mg.calls.show_text.some((s) => /Escribe un clip nuevo/.test(s)), 'ayuda en la línea de estado');
  const before = mg.calls.redraw;
  ctx.onidleout();
  assert.ok(mg.calls.redraw > before);
});

test('v8ui panel: desplazamiento por arrastre, clic dentro de la lista y búsqueda', () => {
  const { ctx, mg } = loadUiScript('panel', panel.SIZE);
  ctx.paint();
  const a = panel.AREAS.cards;
  ctx.onclick(a.x + a.w / 2, a.y + 200);
  ctx.ondrag(a.x + a.w / 2, a.y + 50, 1);
  ctx.ondrag(a.x + a.w / 2, a.y + 50, 0);
  ctx.paint();
  ctx.search('maqsum');
  ctx.paint();
  assert.ok(!mg.calls.show_text.includes('Maqsum'), 'con «Solo Acordes» el maqsum no aparece');
  assert.ok(mg.calls.show_text.some((s) => /para otros destinos/.test(s)), 'el panel avisa de los ocultos');
  // botón «Solo Acordes» (a la izquierda del buscador)
  const s = panel.AREAS.search;
  ctx.onclick(s.x - 214 + 50, s.y + 10);
  ctx.paint();
  assert.ok(mg.calls.show_text.includes('Maqsum'), 'sin el filtro, la búsqueda lo encuentra');
});
