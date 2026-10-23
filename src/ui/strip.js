'use strict';
// Franja compacta (≤ 169 px de alto): Destino · Armonía · Ritmo · Generar, cada módulo con su estado y su
// resumen visual, y una línea de estado que muestra ayudas (tooltips) al pasar el ratón.
const { THEME, mix, colorForId } = require('./theme');
const { t } = require('./strings');
const { ellipsize } = require('./canvas');
const W = require('./widgets');
const M = require('./model');

const SIZE = { width: 860, height: 169 };
const GLYPHS = { bassline: 'bassline', chords: 'chords', arpeggio: 'arpeggio', hihats: 'hihats', ethnic: 'ethnic', others: 'others' };

// Reparto horizontal de los cuatro módulos.
function layout(width = SIZE.width, height = SIZE.height) {
  const pad = 6;
  const top = 4;
  const statusH = 18;
  const h = height - top - statusH - 6;
  const ratios = [0.19, 0.25, 0.32, 0.24];
  const avail = width - pad * 5;
  const mods = [];
  let x = pad;
  for (const r of ratios) { const w = Math.floor(avail * r); mods.push({ x, y: top, w, h }); x += w + pad; }
  mods[3].w = width - pad - mods[3].x;
  return { mods, status: { x: pad, y: top + h + 4, w: width - pad * 2, h: statusH } };
}

function drawDestination(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step1'));
  const ids = m.lists.destinations;
  const cols = 2;
  const bw = (box.w - 12 - 4) / cols;
  const bh = 26;
  ids.forEach((id, i) => {
    const cx = box.x + 6 + (i % cols) * (bw + 4);
    const cy = box.y + 22 + Math.floor(i / cols) * (bh + 4);
    W.button(g, hits, cx, cy, bw, bh, t(`dest.${id}`), { selected: m.state.destination === id, glyph: GLYPHS[id], size: THEME.size.sm, action: { kind: 'param', name: 'p_destino', value: i }, help: t(`dest.help.${id}`) });
  });
}

function drawHarmony(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step2'));
  const h = M.harmonyOf(m);
  // modo
  const modes = m.lists.modes;
  const sw = (box.w - 12) / modes.length;
  modes.forEach((md, i) => W.button(g, hits, box.x + 6 + i * sw, box.y + 20, sw - (i < modes.length - 1 ? 2 : 0), 17, t(`mode.${md}`), { selected: m.state.harmonyMode === md, size: THEME.size.xs, action: { kind: 'param', name: 'p_armonia', value: i }, help: t(`mode.help.${md}`) }));
  // teclado
  W.keyboard(g, hits, box.x + 6, box.y + 42, box.w - 12, 38, h, { help: t('harmony.root.help') });
  // escala con flechas
  const sy = box.y + 86;
  const si = m.lists.scales.indexOf(h.id);
  W.arrow(g, hits, box.x + 6, sy, -1, { kind: 'param', name: 'p_escala', value: (si - 1 + m.lists.scales.length) % m.lists.scales.length }, t('harmony.scale.prev'));
  W.arrow(g, hits, box.x + box.w - 22, sy, 1, { kind: 'param', name: 'p_escala', value: (si + 1) % m.lists.scales.length }, t('harmony.scale.next'));
  const PC = m.SV.core.harmony.PC;
  const label = `${PC[h.root]} · ${h.name || h.id}`;
  g.text(ellipsize(g, label, box.w - 52, THEME.size.md, true), box.x + box.w / 2, sy + 8, { align: 'center', bold: true, size: THEME.size.md });
  // línea según el modo
  const ly = box.y + 110;
  const mode = m.state.harmonyMode;
  if (mode === 'adaptive') {
    W.button(g, hits, box.x + 6, ly, 64, 18, t('harmony.read'), { size: THEME.size.xs, action: { kind: 'cmd', name: 'analyze' }, help: t('mode.help.adaptive') });
    const a = m.analysis;
    const txt = a && a.key && a.key.name ? t('harmony.read.result', { key: a.key.name, conf: Math.round(a.key.confidence * 100) }) : '—';
    g.text(ellipsize(g, txt, box.w - 82, THEME.size.xs), box.x + 76, ly + 9, { size: THEME.size.xs, color: THEME.dim });
  } else if (mode === 'random') {
    W.button(g, hits, box.x + 6, ly, 64, 18, t('harmony.reroll'), { size: THEME.size.xs, glyph: 'dice', action: { kind: 'cmd', name: 'reroll' }, help: t('mode.help.random') });
    g.text(`${t('harmony.seed')} ${(m.harmony && m.harmony.seed) ?? '—'}`, box.x + 76, ly + 9, { size: THEME.size.xs, color: THEME.dim });
  } else if (mode === 'live') {
    g.text(ellipsize(g, t('mode.help.live'), box.w - 12, THEME.size.xs), box.x + 6, ly + 9, { size: THEME.size.xs, color: THEME.dim });
  } else {
    g.text(ellipsize(g, t('harmony.root.help'), box.w - 12, THEME.size.xs), box.x + 6, ly + 9, { size: THEME.size.xs, color: THEME.faint });
  }
}

function drawRhythm(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step3'));
  const p = M.patternOf(m);
  const norm = M.normalized(m);
  const tax = m.SV.data.taxonomy;
  const color = p ? colorForId(p.taxonomy[0], tax) : THEME.accent;
  const r = Math.min(46, (box.h - 30) / 2);
  const cx = box.x + 10 + r;
  const cy = box.y + 22 + r + 2;
  W.constellation(g, norm, cx, cy, r, { accentColor: color });
  hits.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, action: { kind: 'cmd', name: 'open_panel' }, help: t('rhythm.explore.help') });
  const tx = cx + r + 12;
  const tw = box.x + box.w - tx - 6;
  if (p) {
    g.text(ellipsize(g, p.name, tw, THEME.size.lg, true), tx, box.y + 26, { size: THEME.size.lg, bold: true });
    g.text(ellipsize(g, p.origin.tradition, tw, THEME.size.sm), tx, box.y + 42, { size: THEME.size.sm, color: THEME.dim });
    const list0 = M.browseList(m);
    const pos0 = list0.findIndex((x) => x.id === p.id);
    const cyc = (norm ? t('rhythm.cycle', { n: norm.cycle_len, meter: p.meter }) : p.meter) + (list0.length ? `  ·  ${pos0 + 1}/${list0.length}` : '');
    g.text(ellipsize(g, cyc, tw, THEME.size.xs), tx, box.y + 56, { size: THEME.size.xs, color: THEME.faint });
    // chips de taxonomía (color por eje) con su definición como ayuda
    let cxp = tx;
    const nodes = taxonomyIndex(m);
    for (const id of p.taxonomy.slice(0, 4)) {
      const w = g.measure(id, THEME.size.xs) + 10;
      if (cxp + w > tx + tw) break;
      W.chip(g, cxp, box.y + 66, id, colorForId(id, tax));
      const node = nodes[id];
      hits.push({ x: cxp, y: box.y + 66, w, h: 13, action: { kind: 'ui', name: 'none' }, help: node ? `${id} · ${node.name}: ${node.definition}` : id });
      cxp += w + 4;
    }
    W.badges(g, hits, tx, box.y + 84, m.SV.core.catalog.badges(p), tw);
  }
  // navegación
  const list = M.browseList(m);
  const pos = list.findIndex((x) => p && x.id === p.id);
  const by = box.y + box.h - 24;
  const go = (d) => {
    if (!list.length) return { kind: 'ui', name: 'none' };
    const next = list[((pos < 0 ? 0 : pos + d) + list.length) % list.length];
    return { kind: 'param', name: 'p_ritmo', value: M.patternIndex(m, next.id) };
  };
  W.arrow(g, hits, tx, by, -1, go(-1), t('rhythm.prev'));
  W.arrow(g, hits, tx + 20, by, 1, go(1), t('rhythm.next'));
  W.button(g, hits, box.x + box.w - 84, by - 1, 78, 18, t('rhythm.explore'), { size: THEME.size.xs, glyph: 'expand', action: { kind: 'cmd', name: 'open_panel' }, help: t('rhythm.explore.help') });
  W.button(g, hits, box.x + box.w - 154, by - 1, 66, 18, t('rhythm.suggest'), { size: THEME.size.xs, selected: m.showSuggest, action: { kind: 'cmd', name: 'suggest' }, help: t('rhythm.suggest.help') });
  if (m.showSuggest && m.suggestions) drawSuggestions(g, hits, m, box);

}

// Superposición con las tres sugerencias sobre el módulo de ritmo.
function drawSuggestions(g, hits, m, box) {
  const x = box.x + 4;
  const y = box.y + 18;
  const w = box.w - 8;
  const h = box.h - 22;
  g.rect(x, y, w, h, { fill: THEME.surface3, stroke: THEME.accent, r: 4, alpha: 0.98 });
  g.text(t('suggest.title'), x + 8, y + 10, { size: THEME.size.sm, bold: true, color: THEME.accent });
  hits.push({ x, y, w, h, action: { kind: 'ui', name: 'none' } });
  W.button(g, hits, x + w - 20, y + 3, 16, 14, '×', { size: THEME.size.sm, action: { kind: 'ui', name: 'close_suggest' }, help: t('suggest.close') });
  const list = (m.suggestions && m.suggestions.suggestions) || [];
  if (!list.length) { g.text(t('suggest.empty'), x + 8, y + 34, { size: THEME.size.sm, color: THEME.dim }); return; }
  const rowH = Math.min(34, (h - 24) / list.length);
  list.forEach((s, i) => {
    const ry = y + 22 + i * rowH;
    g.rect(x + 4, ry, w - 8, rowH - 3, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
    g.text(`${i + 1}. ${ellipsize(g, s.name, w - 70, THEME.size.sm, true)}`, x + 10, ry + 9, { size: THEME.size.sm, bold: true });
    g.text(`${Math.round(s.score * 100)}`, x + w - 12, ry + 9, { size: THEME.size.xs, color: THEME.accent, align: 'right' });
    g.text(ellipsize(g, s.reasons.join(' · '), w - 24, THEME.size.xs), x + 10, ry + 21, { size: THEME.size.xs, color: THEME.dim });
    hits.push({ x: x + 4, y: ry, w: w - 8, h: rowH - 3, action: { kind: 'cmd', name: 'use_suggestion', value: i }, help: t('suggest.use', { name: s.name, why: s.reasons.join(', ') }) });
  });
}

function drawGenerate(g, hits, m, box) {
  W.panelBox(g, box.x, box.y, box.w, box.h, t('step4'), true);
  const x = box.x + 6;
  const w = box.w - 12;
  W.button(g, hits, x, box.y + 20, w, 26, t('gen.generate'), { primary: true, size: THEME.size.lg, action: { kind: 'cmd', name: 'generate' }, help: t('gen.help.generate') });
  const half = (w - 4) / 2;
  W.button(g, hits, x, box.y + 50, half, 18, t('gen.regenerate'), { size: THEME.size.sm, action: { kind: 'cmd', name: 'regenerate' }, help: t('gen.help.regenerate') });
  W.button(g, hits, x + half + 4, box.y + 50, half, 18, t('gen.vary'), { size: THEME.size.sm, action: { kind: 'cmd', name: 'vary' }, help: t('gen.help.vary') });
  const q = (w - 8) / 3;
  W.button(g, hits, x, box.y + 72, q, 18, '', { glyph: 'undo', action: { kind: 'cmd', name: 'undo' }, help: t('gen.undo') });
  W.button(g, hits, x + q + 4, box.y + 72, q, 18, '', { glyph: 'redo', action: { kind: 'cmd', name: 'redo' }, help: t('gen.redo') });
  W.button(g, hits, x + 2 * (q + 4), box.y + 72, q, 18, '', { glyph: m.auditioning ? 'stop' : 'play', selected: m.auditioning, action: { kind: 'cmd', name: 'audition', value: m.auditioning ? 0 : 1 }, help: t('gen.help.audition') });
  // repeticiones
  const reps = m.lists.repeats;
  const rw = (w - (reps.length - 1) * 2) / reps.length;
  reps.forEach((r, i) => {
    const label = r === 'auto' ? t('gen.repeats.auto') : r === 'full' ? t('gen.repeats.full') : String(r);
    W.button(g, hits, x + i * (rw + 2), box.y + 94, rw, 15, label, { selected: String(m.state.repeats) === String(r), size: THEME.size.xs, action: { kind: 'param', name: 'p_repeticiones', value: i }, help: t('gen.repeats.help') });
  });
  const plan = m.preview && m.preview.plan;
  W.repetitionBar(g, plan, x, box.y + 113, w, 7);
  if (plan) {
    const txt = t('gen.summary', { bars: +plan.bars.toFixed(2), repeats: plan.repeats, cycle: +plan.cycleBeats.toFixed(2), variation: t(`var.${plan.variation}`) });
    g.text(ellipsize(g, txt, w, THEME.size.xs), x, box.y + 128, { size: THEME.size.xs, color: THEME.dim });
  }
}

function drawStatus(g, m, box) {
  g.rect(box.x, box.y, box.w, box.h, { fill: THEME.bg, stroke: THEME.line, r: 3 });
  let txt = m.hover && m.hover.help ? m.hover.help : m.error ? `Error: ${m.error}` : m.status || t('status.ready');
  const warn = m.preview && m.preview.meta && m.preview.meta.warnings && m.preview.meta.warnings[0];
  if (!m.hover && !m.error && warn) txt = warn;
  const color = m.error && !m.hover ? THEME.danger : m.hover ? THEME.text : warn ? THEME.warn : THEME.dim;
  g.text(ellipsize(g, txt, box.w - 16, THEME.size.sm), box.x + 8, box.y + box.h / 2, { size: THEME.size.sm, color });
}

function taxonomyIndex(m) {
  if (m.cache.__tax) return m.cache.__tax;
  const idx = {};
  const walk = (n) => { idx[n.id] = n; (n.children || []).forEach(walk); };
  for (const ax of m.SV.data.taxonomy.axes) { idx[ax.id] = { id: ax.id, name: ax.name, definition: ax.question }; ax.children.forEach(walk); }
  m.cache.__tax = idx;
  return idx;
}

// Dibuja la franja y devuelve las zonas de clic.
function draw(g, m, width = SIZE.width, height = SIZE.height) {
  const hits = [];
  g.rect(0, 0, width, height, { fill: THEME.bg });
  const L = layout(width, height);
  drawDestination(g, hits, m, L.mods[0]);
  drawHarmony(g, hits, m, L.mods[1]);
  drawRhythm(g, hits, m, L.mods[2]);
  drawGenerate(g, hits, m, L.mods[3]);
  drawStatus(g, m, L.status);
  return hits;
}

// Zona bajo el puntero (la última registrada gana: es la que se dibujó encima).
function hitTest(hits, x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  }
  return null;
}

// Acciones que la franja resuelve sin pasar por el motor.
function applyUiAction(m, action) {
  if (action.name === 'close_suggest') { m.showSuggest = false; return true; }
  return false;
}

module.exports = { SIZE, layout, draw, hitTest, taxonomyIndex, applyUiAction };
