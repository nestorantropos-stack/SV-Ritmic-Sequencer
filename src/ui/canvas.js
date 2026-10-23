'use strict';
// Contexto de dibujo con dos backends: mgraphics (v8ui en Max) y SVG (maquetas y pruebas en Node).
// Las vistas (strip.js, panel.js) solo usan estas primitivas, así el mismo código dibuja en ambos.
const { THEME, rgba } = require('./theme');

// ---------------------------------------------------------------- backend mgraphics
function fromMgraphics(mg) {
  const setColor = (c, a = 1) => { const v = Array.isArray(c) ? c : rgba(c, a); mg.set_source_rgba(v[0], v[1], v[2], v[3] ?? a); };
  const paint = (style) => {
    if (style.fill) { setColor(style.fill, style.fillAlpha ?? style.alpha ?? 1); if (style.stroke) mg.fill_preserve(); else mg.fill(); }
    if (style.stroke) { setColor(style.stroke, style.strokeAlpha ?? style.alpha ?? 1); mg.set_line_width(style.lw || 1); mg.stroke(); }
  };
  const font = (size, bold) => { mg.select_font_face(bold ? THEME.fontBold : THEME.font); mg.set_font_size(size); };
  return {
    kind: 'mgraphics',
    rect(x, y, w, h, style = {}) {
      if (style.r) mg.rectangle_rounded(x, y, w, h, style.r * 2, style.r * 2); else mg.rectangle(x, y, w, h);
      paint(style);
    },
    circle(cx, cy, r, style = {}) { mg.arc(cx, cy, r, 0, Math.PI * 2); paint(style); },
    arc(cx, cy, r, a0, a1, style = {}) { mg.arc(cx, cy, r, a0, a1); paint({ ...style, fill: null }); },
    line(x1, y1, x2, y2, style = {}) { mg.move_to(x1, y1); mg.line_to(x2, y2); paint({ stroke: style.stroke || style.color, lw: style.lw, alpha: style.alpha }); },
    poly(points, style = {}) {
      if (!points.length) return;
      mg.move_to(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) mg.line_to(points[i].x, points[i].y);
      if (style.closed !== false) mg.close_path();
      paint(style);
    },
    measure(str, size = THEME.size.md, bold = false) { font(size, bold); const m = mg.text_measure(String(str)); return m[0]; },
    text(str, x, y, style = {}) {
      const size = style.size || THEME.size.md;
      font(size, style.bold);
      const s = String(str);
      const w = mg.text_measure(s)[0];
      const dx = style.align === 'center' ? -w / 2 : style.align === 'right' ? -w : 0;
      setColor(style.color || THEME.text, style.alpha ?? 1);
      mg.move_to(x + dx, y + size * 0.36); // y = centro vertical de la línea
      mg.show_text(s);
    },
    clip(x, y, w, h) { mg.save(); mg.rectangle(x, y, w, h); mg.clip(); },
    unclip() { mg.restore(); },
  };
}

// ---------------------------------------------------------------- backend SVG
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (c, a = 1) => (Array.isArray(c) ? `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3] ?? a})` : c);
// Ancho aproximado de texto para SVG (Ableton Sans ≈ 0,56 em por carácter medio).
const approxWidth = (s, size, bold) => String(s).length * size * (bold ? 0.6 : 0.56);

function svgCanvas(width, height) {
  const out = [];
  let clipId = 0;
  const clipStack = [];
  const style = (s) => {
    const parts = [];
    parts.push(`fill="${s.fill ? col(s.fill) : 'none'}"`);
    if (s.fill && (s.fillAlpha ?? s.alpha ?? 1) < 1) parts.push(`fill-opacity="${s.fillAlpha ?? s.alpha}"`);
    if (s.stroke) parts.push(`stroke="${col(s.stroke)}" stroke-width="${s.lw || 1}"`);
    if (s.stroke && (s.strokeAlpha ?? s.alpha ?? 1) < 1) parts.push(`stroke-opacity="${s.strokeAlpha ?? s.alpha}"`);
    return parts.join(' ');
  };
  const push = (el) => out.push(clipStack.length ? el.replace(/^<(\w+)/, `<$1 clip-path="url(#c${clipStack[clipStack.length - 1]})"`) : el);
  return {
    kind: 'svg',
    rect(x, y, w, h, s = {}) { push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(0, w).toFixed(2)}" height="${Math.max(0, h).toFixed(2)}"${s.r ? ` rx="${s.r}"` : ''} ${style(s)}/>`); },
    circle(cx, cy, r, s = {}) { push(`<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" ${style(s)}/>`); },
    arc(cx, cy, r, a0, a1, s = {}) {
      const x0 = cx + Math.cos(a0) * r; const y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r; const y1 = cy + Math.sin(a1) * r;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      push(`<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" ${style({ ...s, fill: null })}/>`);
    },
    line(x1, y1, x2, y2, s = {}) { push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ${style({ stroke: s.stroke || s.color, lw: s.lw, alpha: s.alpha })}/>`); },
    poly(points, s = {}) {
      if (!points.length) return;
      const tag = s.closed === false ? 'polyline' : 'polygon';
      push(`<${tag} points="${points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" ${style(s)}/>`);
    },
    measure(str, size = THEME.size.md, bold = false) { return approxWidth(str, size, bold); },
    text(str, x, y, s = {}) {
      const size = s.size || THEME.size.md;
      const anchor = s.align === 'center' ? 'middle' : s.align === 'right' ? 'end' : 'start';
      push(`<text x="${x.toFixed(2)}" y="${(y + size * 0.36).toFixed(2)}" font-family="Ableton Sans, Inter, Segoe UI, Arial, sans-serif" font-size="${size}"${s.bold ? ' font-weight="700"' : ''} text-anchor="${anchor}" fill="${col(s.color || THEME.text)}"${(s.alpha ?? 1) < 1 ? ` fill-opacity="${s.alpha}"` : ''}>${esc(str)}</text>`);
    },
    clip(x, y, w, h) { clipId += 1; out.push(`<clipPath id="c${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`); clipStack.push(clipId); },
    unclip() { clipStack.pop(); },
    toString() { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${out.join('\n')}\n</svg>\n`; },
    elements: () => out.length,
  };
}

// Contexto que solo registra llamadas: para comprobar en pruebas que no se dibuja fuera del área, etc.
function recorderCanvas() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push([name, ...args]); };
  return { kind: 'recorder', calls, rect: rec('rect'), circle: rec('circle'), arc: rec('arc'), line: rec('line'), poly: rec('poly'), text: rec('text'), clip: rec('clip'), unclip: rec('unclip'), measure: (s, size = 11) => String(s).length * size * 0.56 };
}

// Recorta un texto para que quepa en `maxW` (añade «…»).
function ellipsize(g, str, maxW, size, bold) {
  const s = String(str);
  if (g.measure(s, size, bold) <= maxW) return s;
  let lo = 0; let hi = s.length;
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (g.measure(s.slice(0, m) + '…', size, bold) <= maxW) lo = m; else hi = m - 1; }
  return s.slice(0, lo) + '…';
}

module.exports = { fromMgraphics, svgCanvas, recorderCanvas, ellipsize };
