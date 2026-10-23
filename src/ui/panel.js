'use strict';
// Panel ampliado (ventana flotante): navegador jerárquico por ejes con migas de pan, tarjetas de ritmos,
// detalle con definición, origen, fuentes y estatus, vista previa del clip (piano roll, repeticiones,
// rejilla deformable) y bloqueo de capas. Los controles de forma (live.*) van debajo, nativos.
const { THEME, mix, colorForId, roleColor } = require('./theme');
const { t } = require('./strings');
const { ellipsize } = require('./canvas');
const W = require('./widgets');
const M = require('./model');
const G = require('./geometry');
const { taxonomyIndex } = require('./strip');

const SIZE = { width: 1000, height: 640 };
const AREAS = {
  header: { x: 8, y: 6, w: 984, h: 30 },
  search: { x: 700, y: 9, w: 180, h: 22 }, // aquí va el [textedit] nativo, encima del v8ui
  tree: { x: 8, y: 44, w: 220, h: 404 },
  cards: { x: 236, y: 44, w: 380, h: 404 },
  detail: { x: 624, y: 44, w: 368, h: 404 },
  preview: { x: 8, y: 456, w: 700, h: 176 },
  layers: { x: 716, y: 456, w: 276, h: 176 },
};
const ROW = 18;
const CARD = 54;

// Texto en varias líneas dentro de un ancho.
function wrap(g, text, maxW, size) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (g.measure(test, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function paragraph(g, text, x, y, maxW, size, color, maxLines = 6) {
  const lines = wrap(g, text, maxW, size);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = ellipsize(g, `${shown[maxLines - 1]} …`, maxW, size);
  shown.forEach((l, i) => g.text(l, x, y + i * (size + 4), { size, color }));
  return shown.length * (size + 4);
}

// Filas visibles del árbol: ejes; el eje elegido se despliega con sus nodos hasta el nodo elegido.
function treeRows(m) {
  const tax = m.SV.data.taxonomy;
  const rows = [];
  const sel = m.panel.node || m.panel.axis;
  const onPath = (id) => sel && (sel === id || sel.startsWith(id + '.'));
  const walk = (node, depth, axis) => {
    rows.push({ id: node.id, name: node.name, depth, axis, hasChildren: !!(node.children && node.children.length) });
    if (node.children && (onPath(node.id) || sel === node.id)) node.children.forEach((c) => walk(c, depth + 1, axis));
  };
  for (const ax of tax.axes) {
    rows.push({ id: ax.id, name: ax.name, depth: 0, axis: ax.id, isAxis: true, hasChildren: true });
    if (onPath(ax.id)) ax.children.forEach((c) => walk(c, 1, ax.id));
  }
  return rows;
}

function drawHeader(g, hits, m) {
  const a = AREAS.header;
  g.text(t('panel.title'), a.x, a.y + 14, { size: THEME.size.xl, bold: true });
  // migas de pan
  let x = a.x + 190;
  const crumbs = [{ id: null, name: t('panel.all') }];
  const idx = taxonomyIndex(m);
  const sel = m.panel.node || m.panel.axis;
  if (sel) {
    const parts = sel.split('.');
    for (let i = 1; i <= parts.length; i++) {
      const id = parts.slice(0, i).join('.');
      if (idx[id]) crumbs.push({ id, name: i === 1 ? idx[id].name : id });
    }
  }
  crumbs.forEach((c, i) => {
    const label = ellipsize(g, c.name, 120, THEME.size.sm);
    const w = g.measure(label, THEME.size.sm);
    const last = i === crumbs.length - 1;
    g.text(label, x, a.y + 15, { size: THEME.size.sm, color: last ? THEME.text : THEME.dim, bold: last });
    hits.push({ x, y: a.y + 6, w, h: 18, action: { kind: 'ui', name: 'crumb', value: c.id }, help: c.id ? (idx[c.id] && idx[c.id].definition) : t('panel.all') });
    x += w + 6;
    if (!last) { g.text('›', x, a.y + 15, { size: THEME.size.sm, color: THEME.faint }); x += 12; }
  });
  // filtros
  const s = AREAS.search;
  g.rect(s.x, s.y, s.w, s.h, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
  if (!m.panel.text) g.text('Buscar…', s.x + 8, s.y + s.h / 2, { size: THEME.size.sm, color: THEME.faint });
  else g.text(ellipsize(g, m.panel.text, s.w - 12, THEME.size.sm), s.x + 8, s.y + s.h / 2, { size: THEME.size.sm });
  const dest = t(`dest.${m.state.destination}`);
  W.button(g, hits, s.x - 214, s.y, 104, 22, t('panel.only_dest', { dest }), { selected: m.panel.onlyDest, size: THEME.size.xs, action: { kind: 'ui', name: 'toggle', value: 'onlyDest' } });
  W.button(g, hits, s.x - 106, s.y, 100, 22, t('panel.verified'), { selected: m.panel.verifiedOnly, size: THEME.size.xs, action: { kind: 'ui', name: 'toggle', value: 'verifiedOnly' } });
  const n = M.panelList(m).length;
  g.text(t('panel.results', { n }), s.x + s.w + 10, s.y + s.h / 2, { size: THEME.size.sm, color: THEME.dim });
}

function drawTree(g, hits, m) {
  const a = AREAS.tree;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const rows = treeRows(m);
  const tax = m.SV.data.taxonomy;
  const visible = Math.floor((a.h - 8) / ROW);
  const maxScroll = Math.max(0, rows.length - visible);
  m.panel.treeScroll = Math.min(m.panel.treeScroll, maxScroll);
  hits.push({ x: a.x, y: a.y, w: a.w, h: a.h, action: { kind: 'scroll', name: 'treeScroll', rowH: ROW, max: maxScroll } });
  const sel = m.panel.node || m.panel.axis;
  const idx = taxonomyIndex(m);
  rows.slice(m.panel.treeScroll, m.panel.treeScroll + visible).forEach((r, i) => {
    const y = a.y + 4 + i * ROW;
    const x = a.x + 8 + r.depth * 12;
    const active = sel === r.id;
    if (active) g.rect(a.x + 3, y, a.w - 6, ROW - 1, { fill: mix(THEME.surface2, THEME.accent, 0.15), r: 3 });
    const c = colorForId(r.axis, tax);
    if (r.isAxis) g.circle(x + 4, y + ROW / 2, 4, { fill: c });
    else g.circle(x + 4, y + ROW / 2, 2, { fill: c, alpha: 0.8 });
    const label = r.isAxis ? `${r.id} · ${r.name}` : `${r.id}  ${r.name}`;
    g.text(ellipsize(g, label, a.w - (x - a.x) - 22, THEME.size.sm, r.isAxis), x + 12, y + ROW / 2, { size: THEME.size.sm, color: active ? THEME.text : r.isAxis ? THEME.text : THEME.dim, bold: r.isAxis });
    const node = idx[r.id];
    hits.push({ x: a.x, y, w: a.w, h: ROW, action: { kind: 'ui', name: 'node', value: r.id, axis: r.isAxis }, help: node ? `${r.id} · ${node.name}: ${node.definition}` : r.id });
  });
}

function drawCards(g, hits, m) {
  const a = AREAS.cards;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const list = M.panelList(m);
  const visible = Math.floor((a.h - 8) / CARD);
  const maxScroll = Math.max(0, list.length - visible);
  m.panel.scroll = Math.min(m.panel.scroll, maxScroll);
  hits.push({ x: a.x, y: a.y, w: a.w, h: a.h, action: { kind: 'scroll', name: 'scroll', rowH: CARD, max: maxScroll } });
  const tax = m.SV.data.taxonomy;
  const selected = m.panel.selected || m.state.patternId;
  list.slice(m.panel.scroll, m.panel.scroll + visible).forEach((p, i) => {
    const y = a.y + 4 + i * CARD;
    const active = p.id === selected;
    const current = p.id === m.state.patternId;
    g.rect(a.x + 4, y, a.w - 8, CARD - 4, { fill: active ? mix(THEME.surface2, THEME.accent, 0.12) : THEME.surface2, stroke: active ? THEME.accent : current ? THEME.accent2 : THEME.line, r: 4 });
    const norm = M.normalized(m, p.id);
    W.constellation(g, norm, a.x + 30, y + (CARD - 4) / 2, 17, { accentColor: colorForId(p.taxonomy[0], tax), showTicks: false, small: true, maxLayers: 2 });
    const tx = a.x + 56;
    const tw = a.w - 64;
    g.text(ellipsize(g, p.name, tw, THEME.size.md, true), tx, y + 12, { size: THEME.size.md, bold: true });
    const sub = `${p.origin.tradition} · ${p.meter}${norm ? ` · ${norm.cycle_len}` : ''}`;
    g.text(ellipsize(g, sub, tw, THEME.size.xs), tx, y + 26, { size: THEME.size.xs, color: THEME.dim });
    W.badges(g, null, tx, y + 34, m.SV.core.catalog.badges(p), tw);
    hits.push({ x: a.x + 4, y, w: a.w - 8, h: CARD - 4, action: { kind: 'ui', name: 'select', value: p.id }, help: `${p.id} · ${p.origin.context || p.origin.tradition}` });
  });
  if (!list.length) {
    g.text(t('panel.empty'), a.x + a.w / 2, a.y + 40, { align: 'center', color: THEME.dim });
    if (m.panel.onlyDest) {
      const others = M.panelList({ ...m, panel: { ...m.panel, onlyDest: false } }).length;
      if (others) g.text(t('panel.other_dest', { n: others }), a.x + a.w / 2, a.y + 58, { align: 'center', color: THEME.warn, size: THEME.size.sm });
    }
  }
}

function drawDetail(g, hits, m) {
  const a = AREAS.detail;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const id = m.panel.selected || m.state.patternId;
  const p = M.patternOf(m, id);
  if (!p) return;
  const tax = m.SV.data.taxonomy;
  const idx = taxonomyIndex(m);
  const norm = M.normalized(m, p.id);
  const color = colorForId(p.taxonomy[0], tax);
  W.constellation(g, norm, a.x + 72, a.y + 76, 58, { accentColor: color });
  const tx = a.x + 144;
  const tw = a.w - 152;
  paragraph(g, p.name, tx, a.y + 16, tw, THEME.size.lg, THEME.text, 2);
  g.text(ellipsize(g, p.id, tw, THEME.size.xs), tx, a.y + 52, { size: THEME.size.xs, color: THEME.faint });
  g.text(ellipsize(g, p.origin.tradition, tw, THEME.size.sm), tx, a.y + 68, { size: THEME.size.sm, color: THEME.dim });
  g.text(ellipsize(g, `${p.meter}${norm ? ` · ciclo ${norm.cycle_len} · ${+(norm.cycle_len * p.step_value).toFixed(2)} negras` : ''}`, tw, THEME.size.xs), tx, a.y + 84, { size: THEME.size.xs, color: THEME.faint });
  W.badges(g, hits, tx, a.y + 96, m.SV.core.catalog.badges(p).concat([`[${p.status}]`]), tw);
  let y = a.y + 146;
  let cx = a.x + 10;
  for (const tid of p.taxonomy) {
    const w = g.measure(tid, THEME.size.xs) + 10;
    if (cx + w > a.x + a.w - 10) break;
    W.chip(g, cx, y, tid, colorForId(tid, tax));
    const node = idx[tid];
    hits.push({ x: cx, y, w, h: 13, action: { kind: 'ui', name: 'node', value: tid }, help: node ? `${tid} · ${node.name}: ${node.definition}` : tid });
    cx += w + 4;
  }
  y += 22;
  const main = idx[p.taxonomy[0]];
  const section = (title, body, lines = 4) => {
    if (!body) return;
    g.text(title, a.x + 10, y, { size: THEME.size.xs, color: THEME.accent, bold: true });
    y += 12;
    y += paragraph(g, body, a.x + 10, y, a.w - 20, THEME.size.sm, THEME.dim, lines) + 4;
  };
  if (main) section(t('panel.definition'), `${main.name}: ${main.definition}`, 4);
  const o = p.origin;
  section(t('panel.origin'), [o.context, (o.genre || []).join(', '), (o.attributions || []).length ? `Atribución: ${o.attributions.join(', ')}` : ''].filter(Boolean).join(' · '), 3);
  section(t('panel.sources'), (o.sources || []).join(' · '), 2);
  if (p.verify_notes) section('Por verificar', p.verify_notes, 2);
  if (p.cultural_note) section('Contexto cultural', p.cultural_note, 3);
  const by = a.y + a.h - 30;
  const isCurrent = p.id === m.state.patternId;
  W.button(g, hits, a.x + 10, by, 160, 22, t('panel.use'), { primary: !isCurrent, selected: isCurrent, size: THEME.size.sm, action: { kind: 'param', name: 'p_ritmo', value: M.patternIndex(m, p.id) }, help: 'Elige este ritmo en el paso 3.' });
  W.button(g, hits, a.x + 176, by, 90, 22, m.auditioning ? 'Parar' : t('gen.audition'), { glyph: m.auditioning ? 'stop' : 'play', selected: m.auditioning, size: THEME.size.sm, action: { kind: 'cmd', name: 'audition', value: m.auditioning ? 0 : 1 }, help: t('gen.help.audition') });
  W.button(g, hits, a.x + 272, by, 86, 22, t('gen.generate'), { size: THEME.size.sm, action: { kind: 'cmd', name: 'generate' }, help: t('gen.help.generate') });
}

function drawPreview(g, hits, m) {
  const a = AREAS.preview;
  W.panelBox(g, a.x, a.y, a.w, a.h, t('panel.preview'));
  const pv = m.preview;
  W.pianoRoll(g, pv, a.x + 8, a.y + 20, a.w - 16, 100);
  W.repetitionBar(g, pv && pv.plan, a.x + 8, a.y + 126, a.w - 16, 8);
  W.button(g, hits, a.x + a.w - 98, a.y + 2, 90, 16, t('panel.export'), { size: THEME.size.xs, action: { kind: 'cmd', name: 'export_midi' }, help: t('panel.export.help') });
  g.text(ellipsize(g, t('panel.keys'), a.w - 260, THEME.size.xs), a.x + 150, a.y + 10, { size: THEME.size.xs, color: THEME.faint });
  if (pv && pv.plan) {
    const plan = pv.plan;
    g.text(t('gen.summary', { bars: +plan.bars.toFixed(2), repeats: plan.repeats, cycle: +plan.cycleBeats.toFixed(2), variation: t(`var.${plan.variation}`) }), a.x + 8, a.y + 144, { size: THEME.size.xs, color: THEME.dim });
  }
  // rejilla deformable de la plantilla de microtiempo, si la hay
  const tplId = m.state.options && m.state.options.microtiming;
  const tpl = tplId && m.SV.data.microtiming.templates.find((x) => x.id === tplId);
  const gy = a.y + 160;
  g.text(t('panel.grid'), a.x + 8, gy, { size: THEME.size.xs, color: THEME.faint });
  const gx = a.x + 110;
  const gw = a.w - 118;
  let positions = null;
  if (tpl && tpl.beat_proportions) positions = m.SV.core.gridFromBeatProportions(tpl.beat_proportions, 1);
  else if (tpl && tpl.step_offsets) { const n = tpl.step_offsets.length; positions = tpl.step_offsets.map((o, i) => (i + o) / n); }
  const cells = positions ? G.deformableGrid(positions, gx, gw) : Array.from({ length: 4 }, (_, i) => ({ x: gx + (i / 4) * gw, isoX: gx + (i / 4) * gw }));
  g.line(gx, gy, gx + gw, gy, { stroke: THEME.line });
  for (const c of cells) {
    g.line(c.isoX, gy - 5, c.isoX, gy + 5, { stroke: THEME.faint, lw: 1 });
    g.circle(c.x, gy, 3, { fill: Math.abs(c.x - c.isoX) > 0.5 ? THEME.accent2 : THEME.dim });
  }
  g.text(tpl ? tpl.name : 'recto', gx + gw, gy - 9, { size: THEME.size.xs, color: THEME.faint, align: 'right' });
}

// Caja lateral con pestañas: Capas (bloqueo), Historial y Preajustes.
function drawSide(g, hits, m) {
  const a = AREAS.layers;
  W.panelBox(g, a.x, a.y, a.w, a.h, null);
  const tabs = ['layers', 'history', 'presets'];
  const tw = (a.w - 12) / tabs.length;
  tabs.forEach((id, i) => W.button(g, hits, a.x + 6 + i * tw, a.y + 5, tw - 3, 17, t(`panel.tab.${id}`), { selected: m.panel.tab === id, size: THEME.size.xs, action: { kind: 'ui', name: 'tab', value: id } }));
  if (m.panel.tab === 'history') drawHistory(g, hits, m, a);
  else if (m.panel.tab === 'presets') drawPresets(g, hits, m, a);
  else drawLayers(g, hits, m, a);
}

function drawHistory(g, hits, m, a) {
  const list = (m.history || []).slice().reverse().slice(0, 7);
  if (!list.length) { g.text(t('panel.history.empty'), a.x + 10, a.y + 40, { size: THEME.size.sm, color: THEME.dim }); return; }
  list.forEach((h, k) => {
    const y = a.y + 28 + k * 20;
    g.rect(a.x + 6, y, a.w - 12, 18, { fill: h.current ? mix(THEME.surface2, THEME.accent, 0.15) : THEME.surface2, stroke: h.current ? THEME.accent : THEME.line, r: 3 });
    g.text(ellipsize(g, t('panel.history.row', { n: h.i + 1, name: h.name, seed: h.seed }), a.w - 24, THEME.size.xs), a.x + 12, y + 9, { size: THEME.size.xs, color: h.current ? THEME.text : THEME.dim });
    hits.push({ x: a.x + 6, y, w: a.w - 12, h: 18, action: { kind: 'cmd', name: 'history_goto', value: h.i }, help: t('panel.history.help') });
  });
}

function drawPresets(g, hits, m, a) {
  W.button(g, hits, a.x + 6, a.y + 27, a.w - 12, 18, t('panel.presets.save'), { size: THEME.size.xs, action: { kind: 'cmd', name: 'preset_save' }, help: t('panel.presets.save.help') });
  const list = (m.presets || []).slice(0, 6);
  if (!list.length) { g.text(t('panel.presets.empty'), a.x + 10, a.y + 60, { size: THEME.size.sm, color: THEME.dim }); return; }
  list.forEach((p, k) => {
    const y = a.y + 50 + k * 20;
    g.rect(a.x + 6, y, a.w - 34, 18, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
    g.text(ellipsize(g, p.name, a.w - 48, THEME.size.xs), a.x + 12, y + 9, { size: THEME.size.xs });
    hits.push({ x: a.x + 6, y, w: a.w - 34, h: 18, action: { kind: 'cmd', name: 'preset_load', value: p.i }, help: t('panel.presets.help') });
    W.button(g, hits, a.x + a.w - 26, y, 20, 18, '×', { size: THEME.size.sm, action: { kind: 'cmd', name: 'preset_delete', value: p.i }, help: t('panel.presets.delete') });
  });
}

function drawLayers(g, hits, m, a) {
  const norm = M.normalized(m);
  if (!norm) return;
  const roles = norm.layers.map((l) => l.role);
  const locks = new Set(m.state.locks || []);
  roles.slice(0, 6).forEach((r, i) => {
    const y = a.y + 28 + i * 21;
    const on = locks.has(r);
    g.rect(a.x + 8, y, a.w - 16, 18, { fill: on ? mix(THEME.surface2, THEME.warn, 0.15) : THEME.surface2, stroke: on ? THEME.warn : THEME.line, r: 3 });
    g.circle(a.x + 18, y + 9, 4, { fill: roleColor(r, roles) });
    g.text(`${r} · ${norm.layers[i].onsets.length} ataques`, a.x + 28, y + 9, { size: THEME.size.sm, color: on ? THEME.text : THEME.dim });
    W.drawGlyph(g, 'lock', a.x + a.w - 22, y + 9, on ? THEME.warn : THEME.faint);
    hits.push({ x: a.x + 8, y, w: a.w - 16, h: 18, action: { kind: 'cmd', name: 'lock', value: [r, on ? 0 : 1] }, help: `Bloquear «${r}»: al regenerar, esta capa conserva sus notas.` });
  });
}

function draw(g, m, width = SIZE.width, height = SIZE.height) {
  const hits = [];
  g.rect(0, 0, width, height, { fill: THEME.bg });
  drawHeader(g, hits, m);
  drawTree(g, hits, m);
  drawCards(g, hits, m);
  drawDetail(g, hits, m);
  drawPreview(g, hits, m);
  drawSide(g, hits, m);
  if (m.hover && m.hover.help) {
    // ayuda flotante en la parte inferior del detalle
    const a = AREAS.detail;
    const lines = wrap(g, m.hover.help, a.w - 20, THEME.size.sm).slice(0, 3);
    const h = lines.length * 14 + 10;
    g.rect(a.x + 4, a.y + a.h - h - 36, a.w - 8, h, { fill: THEME.surface3, stroke: THEME.accent, r: 4, alpha: 0.97 });
    lines.forEach((l, i) => g.text(l, a.x + 12, a.y + a.h - h - 36 + 12 + i * 14, { size: THEME.size.sm }));
  }
  return hits;
}

// Acciones que el panel resuelve sin pasar por el motor.
function applyUiAction(m, action) {
  const p = m.panel;
  switch (action.name) {
    case 'node': if (action.axis) { p.axis = action.value; p.node = null; } else { p.axis = action.value.slice(0, 3); p.node = action.value; } p.scroll = 0; return true;
    case 'crumb': if (!action.value) { p.axis = null; p.node = null; } else if (action.value.length === 3) { p.axis = action.value; p.node = null; } else p.node = action.value; p.scroll = 0; return true;
    case 'toggle': p[action.value] = !p[action.value]; p.scroll = 0; return true;
    case 'select': p.selected = action.value; return true;
    case 'tab': p.tab = action.value; return true;
    default: return false;
  }
}

// Atajos de teclado del panel ([key] en la ventana). Devuelve la acción a enviar o null.
// [key] recibe también lo que se escribe en el buscador: por eso las letras solo cuentan en mayúscula (Mayús + letra).
// Códigos de [key] en Windows: flechas 28 ← 29 → 30 ↑ 31 ↓, Intro 13.
function keyAction(m, code) {
  const c = Number(code);
  const ch = c >= 65 && c <= 90 ? String.fromCharCode(c) : '';
  if (ch === 'G') return { kind: 'cmd', name: 'generate' };
  if (ch === 'R') return { kind: 'cmd', name: 'regenerate' };
  if (ch === 'V') return { kind: 'cmd', name: 'vary' };
  if (ch === 'Z') return { kind: 'cmd', name: 'undo' };
  if (ch === 'Y') return { kind: 'cmd', name: 'redo' };
  if (ch === 'P') return { kind: 'cmd', name: 'audition', value: m.auditioning ? 0 : 1 };
  const list = M.panelList(m);
  if (!list.length) return null;
  const cur = Math.max(0, list.findIndex((p) => p.id === (m.panel.selected || m.state.patternId)));
  if (c === 28 || c === 30 || c === 29 || c === 31) {
    const next = list[(cur + (c === 28 || c === 30 ? -1 : 1) + list.length) % list.length];
    m.panel.selected = next.id;
    const visible = Math.floor((AREAS.cards.h - 8) / CARD);
    const pos = list.indexOf(next);
    if (pos < m.panel.scroll) m.panel.scroll = pos;
    if (pos >= m.panel.scroll + visible) m.panel.scroll = pos - visible + 1;
    return { kind: 'ui', name: 'none' };
  }
  if (c === 13) return { kind: 'param', name: 'p_ritmo', value: M.patternIndex(m, list[cur].id) };
  return null;
}

module.exports = { SIZE, AREAS, draw, treeRows, wrap, applyUiAction, keyAction };
