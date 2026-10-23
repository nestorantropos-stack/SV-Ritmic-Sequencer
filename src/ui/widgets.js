'use strict';
// Componentes de dibujo reutilizables. Cada uno dibuja con el contexto `g` y registra sus zonas de clic en `hits`
// ({ x, y, w, h, action, help }). action: { kind: 'param'|'cmd'|'ui', name, value }.
const { THEME, mix, colorForId, roleColor } = require('./theme');
const { ellipsize } = require('./canvas');
const G = require('./geometry');

const hit = (hits, x, y, w, h, action, help) => { if (hits) hits.push({ x, y, w, h, action, help }); };

function panelBox(g, x, y, w, h, title, active = false) {
  g.rect(x, y, w, h, { fill: THEME.surface, stroke: active ? mix(THEME.line, THEME.accent, 0.35) : THEME.line, lw: 1, r: THEME.radius });
  if (title) g.text(title, x + 8, y + 10, { size: THEME.size.sm, color: active ? THEME.accent : THEME.dim, bold: true });
}

function button(g, hits, x, y, w, h, label, { selected = false, primary = false, disabled = false, action, help, size = THEME.size.md, glyph = null } = {}) {
  const fill = primary ? (disabled ? THEME.surface3 : THEME.accent) : selected ? mix(THEME.surface3, THEME.accent, 0.18) : THEME.surface2;
  const stroke = selected ? THEME.accent : primary ? THEME.accent : THEME.line;
  g.rect(x + 0.5, y + 0.5, w - 1, h - 1, { fill, stroke, lw: 1, r: THEME.radius });
  const color = primary ? THEME.bg : disabled ? THEME.faint : selected ? THEME.text : THEME.dim;
  let tx = x + w / 2;
  if (glyph) { drawGlyph(g, glyph, x + 11, y + h / 2, color); tx = x + 20 + (w - 20) / 2; }
  g.text(ellipsize(g, label, w - (glyph ? 24 : 8), size, primary || selected), tx, y + h / 2, { size, align: 'center', color, bold: primary || selected });
  if (!disabled) hit(hits, x, y, w, h, action, help);
}

function chip(g, x, y, label, color, { filled = false, size = THEME.size.xs } = {}) {
  const w = g.measure(label, size) + 10;
  g.rect(x, y, w, 13, { fill: filled ? color : mix(THEME.surface, color, 0.16), stroke: color, lw: 1, r: 6.5, strokeAlpha: 0.8 });
  g.text(label, x + 5, y + 6.5, { size, color: filled ? THEME.bg : color });
  return w;
}

function badges(g, hits, x, y, list, maxW) {
  const colors = { verificar: THEME.warn, corpus: THEME.corpus, 'datos faltantes': THEME.danger, 'uso restringido': THEME.restricted };
  const helps = { verificar: 'badge.help.verify', corpus: 'badge.help.corpus', 'datos faltantes': 'badge.help.missing', 'uso restringido': 'badge.help.restricted' };
  let cx = x;
  for (const b of list) {
    const w = g.measure(b, THEME.size.xs) + 10;
    if (cx + w > x + maxW) break;
    chip(g, cx, y, b, colors[b] || THEME.dim);
    hit(hits, cx, y, w, 13, { kind: 'ui', name: 'none' }, helps[b]);
    cx += w + 4;
  }
  return cx - x;
}

// Iconos simples de destino dibujados con primitivas.
function drawGlyph(g, kind, cx, cy, color) {
  const s = { stroke: color, lw: 1.4 };
  switch (kind) {
    case 'bassline': g.poly([{ x: cx - 6, y: cy + 2 }, { x: cx - 3, y: cy - 3 }, { x: cx, y: cy + 3 }, { x: cx + 3, y: cy - 2 }, { x: cx + 6, y: cy + 2 }], { ...s, closed: false }); break;
    case 'chords': for (const dy of [-4, 0, 4]) g.circle(cx, cy + dy, 1.8, { fill: color }); break;
    case 'arpeggio': [-5, -1.7, 1.7, 5].forEach((dx, i) => g.circle(cx + dx, cy + 4 - i * 2.7, 1.5, { fill: color })); break;
    case 'hihats': g.line(cx - 6, cy - 2, cx + 6, cy - 4, s); g.line(cx - 6, cy + 1, cx + 6, cy - 1, s); g.line(cx, cy - 3, cx, cy + 6, s); break;
    case 'ethnic': g.circle(cx, cy, 5.5, s); g.line(cx - 5.5, cy, cx + 5.5, cy, { stroke: color, lw: 1 }); break;
    case 'others': for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; const b = -Math.PI / 2 + ((k + 1) * 4 * Math.PI) / 5; g.line(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, cx + Math.cos(b) * 6, cy + Math.sin(b) * 6, { stroke: color, lw: 1 }); } break;
    case 'play': g.poly([{ x: cx - 3, y: cy - 4 }, { x: cx + 4, y: cy }, { x: cx - 3, y: cy + 4 }], { fill: color }); break;
    case 'stop': g.rect(cx - 3.5, cy - 3.5, 7, 7, { fill: color }); break;
    case 'undo': g.arc(cx + 1, cy + 1, 4.5, Math.PI, Math.PI * 1.9, s); g.poly([{ x: cx - 6, y: cy - 1 }, { x: cx - 3.5, y: cy + 3 }, { x: cx - 1, y: cy - 1 }], { fill: color }); break;
    case 'redo': g.arc(cx - 1, cy + 1, 4.5, Math.PI * 1.1, Math.PI * 2, s); g.poly([{ x: cx + 6, y: cy - 1 }, { x: cx + 3.5, y: cy + 3 }, { x: cx + 1, y: cy - 1 }], { fill: color }); break;
    case 'dice': g.rect(cx - 5, cy - 5, 10, 10, { stroke: color, lw: 1.2, r: 2 }); g.circle(cx - 2, cy - 2, 1.1, { fill: color }); g.circle(cx + 2, cy + 2, 1.1, { fill: color }); break;
    case 'lock': g.rect(cx - 4, cy - 1, 8, 6, { fill: color, r: 1 }); g.arc(cx, cy - 1, 3, Math.PI, Math.PI * 2, { stroke: color, lw: 1.3 }); break;
    case 'expand': g.poly([{ x: cx - 5, y: cy - 1 }, { x: cx - 5, y: cy - 5 }, { x: cx - 1, y: cy - 5 }], { ...s, closed: false }); g.poly([{ x: cx + 5, y: cy + 1 }, { x: cx + 5, y: cy + 5 }, { x: cx + 1, y: cy + 5 }], { ...s, closed: false }); break;
    default: break;
  }
}

// Flecha ‹ o › pulsable.
function arrow(g, hits, x, y, dir, action, help) {
  g.rect(x, y, 16, 16, { fill: THEME.surface2, stroke: THEME.line, r: 3 });
  const c = THEME.dim;
  if (dir < 0) g.poly([{ x: x + 10, y: y + 4 }, { x: x + 5, y: y + 8 }, { x: x + 10, y: y + 12 }], { stroke: c, lw: 1.4, closed: false });
  else g.poly([{ x: x + 6, y: y + 4 }, { x: x + 11, y: y + 8 }, { x: x + 6, y: y + 12 }], { stroke: c, lw: 1.4, closed: false });
  hit(hits, x, y, 16, 16, action, help);
}

// Teclado de una octava: teclas de la escala encendidas, raíz marcada; clic → raíz.
function keyboard(g, hits, x, y, w, h, harmony, { action = (pc) => ({ kind: 'param', name: 'p_raiz', value: pc }), help } = {}) {
  const white = [0, 2, 4, 5, 7, 9, 11];
  const blackPos = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };
  const ww = w / 7;
  const pcs = new Set(harmony.intervals.map((i) => (harmony.root + i) % 12));
  white.forEach((pc, k) => {
    const on = pcs.has(pc);
    const isRoot = pc === harmony.root;
    g.rect(x + k * ww + 0.5, y, ww - 1, h, { fill: on ? mix('#D9DCE3', THEME.accent, 0.55) : '#C9CCD3', stroke: THEME.bg, lw: 1, r: 2 });
    if (isRoot) g.circle(x + k * ww + ww / 2, y + h - 7, 3.2, { fill: THEME.bg });
    hit(hits, x + k * ww, y, ww, h, action(pc), help);
  });
  for (const [pcStr, slot] of Object.entries(blackPos)) {
    const pc = Number(pcStr);
    const on = pcs.has(pc);
    const bx = x + slot * ww - ww * 0.32;
    g.rect(bx, y, ww * 0.64, h * 0.58, { fill: on ? mix('#2B2E36', THEME.accent, 0.6) : '#2B2E36', stroke: THEME.bg, lw: 1, r: 2 });
    if (pc === harmony.root) g.circle(bx + ww * 0.32, y + h * 0.58 - 6, 2.6, { fill: THEME.star });
    hit(hits, bx, y, ww * 0.64, h * 0.58, action(pc), help);
  }
  // las negras se registran después: la búsqueda de clics recorre las zonas al revés y gana la de encima
}

// Círculo rítmico de Toussaint dibujado como constelación.
function constellation(g, norm, cx, cy, r, { taxonomy = null, accentColor = THEME.accent, showTicks = true, maxLayers = 3, small = false } = {}) {
  g.circle(cx, cy, r + (small ? 3 : 6), { fill: mix(THEME.bg, accentColor, 0.05) });
  g.circle(cx, cy, r, { stroke: THEME.line, lw: 1 });
  if (!norm) return;
  const layers = norm.layers.filter((l) => l.onsets.length).slice(0, maxLayers);
  const geo = G.circleGeometry({ cycleLen: norm.cycle_len, layers, grouping: norm.grouping, weights: norm.weights }, cx, cy, r);
  for (const a of geo.arcs) g.arc(cx, cy, r + (small ? 2 : 4), a.start + 0.04, a.end - 0.04, { stroke: THEME.accent2, lw: small ? 1.2 : 2, alpha: 0.7 });
  if (showTicks && norm.cycle_len <= 64) {
    for (const tk of geo.ticks) {
      const len = 2 + tk.strength * (small ? 3 : 5);
      const dx = Math.cos(tk.a); const dy = Math.sin(tk.a);
      g.line(cx + dx * (r - len), cy + dy * (r - len), cx + dx * r, cy + dy * r, { stroke: tk.strength > 0.9 ? THEME.dim : THEME.faint, lw: tk.strength > 0.9 ? 1.4 : 1 });
    }
  }
  const roles = norm.layers.map((l) => l.role);
  geo.shapes.forEach((sh, li) => {
    const c = li === 0 ? accentColor : roleColor(sh.role, roles);
    if (sh.points.length > 1) g.poly(sh.points, { stroke: c, lw: small ? 1 : 1.4, strokeAlpha: 0.85, fill: c, fillAlpha: 0.08 });
    for (const p of sh.points) {
      const rr = (small ? 1.6 : 2.4) + (p.velocity / 127) * (small ? 1.6 : 2.8);
      g.circle(p.x, p.y, rr + (small ? 1.5 : 2.5), { fill: c, alpha: 0.18 });
      g.circle(p.x, p.y, rr, { fill: li === 0 ? THEME.star : c });
    }
  });
  if (taxonomy) { /* reservado: color por eje en el centro */ }
}

// Línea de repeticiones con la variación final marcada.
function repetitionBar(g, plan, x, y, w, h) {
  if (!plan) { g.rect(x, y, w, h, { fill: THEME.surface2, r: 2 }); return; }
  const geo = G.repetitionLine(plan, x, y, w, h);
  for (const b of geo.blocks) g.rect(b.x, b.y, b.w, b.h, { fill: b.variation ? THEME.accent2 : mix(THEME.surface3, THEME.accent, 0.35), r: 2 });
}

// Piano roll compacto de la vista previa, coloreado por capa.
function pianoRoll(g, preview, x, y, w, h, { maxBeats = null } = {}) {
  g.rect(x, y, w, h, { fill: THEME.bg, stroke: THEME.line, r: 3 });
  if (!preview || !preview.notes || !preview.notes.length) return;
  const notes = preview.notes.map((n) => (Array.isArray(n) ? { pitch: n[0], start_time: n[1], duration: n[2], velocity: n[3], role: n[4] } : n));
  const len = maxBeats ? Math.min(maxBeats, preview.length_beats) : preview.length_beats;
  const vis = notes.filter((n) => n.start_time < len);
  const geo = G.pianoRoll(vis, len, x + 2, y + 2, w - 4, h - 4);
  const bars = Math.round(len / 4);
  for (let b = 1; b < bars; b++) g.line(x + 2 + (w - 4) * (b / bars), y + 1, x + 2 + (w - 4) * (b / bars), y + h - 1, { stroke: THEME.line, lw: 1, alpha: 0.6 });
  const roles = [...new Set(notes.map((n) => n.role))];
  for (const r of geo.rects) g.rect(r.x, r.y, r.w, r.h, { fill: roleColor(r.role, roles), alpha: 0.35 + 0.65 * (r.velocity / 127), r: 1 });
}

module.exports = { hit, panelBox, button, chip, badges, drawGlyph, arrow, keyboard, constellation, repetitionBar, pianoRoll };
