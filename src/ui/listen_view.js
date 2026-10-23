'use strict';
// Vista de SV Listen (franja de 300 × 169): nivel, croma (12 barras), ocupación de ataques y bombo por paso.
const { THEME, mix } = require('./theme');
const { ellipsize } = require('./canvas');
const W = require('./widgets');

const SIZE = { width: 300, height: 169 };
const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function draw(g, s, width = SIZE.width, height = SIZE.height) {
  g.rect(0, 0, width, height, { fill: THEME.bg });
  W.panelBox(g, 4, 4, width - 8, height - 8, 'SV Listen', true);
  const name = s && s.name ? s.name : '—';
  g.text(ellipsize(g, name, width - 120, THEME.size.sm), 84, 14, { size: THEME.size.sm, color: THEME.dim });
  // nivel
  const lv = s ? Math.min(1, (s.level || 0) * 4) : 0;
  g.rect(width - 52, 9, 40, 6, { fill: THEME.surface2, r: 2 });
  g.rect(width - 52, 9, 40 * lv, 6, { fill: lv > 0.9 ? THEME.danger : THEME.ok, r: 2 });
  // croma
  const cx = 12;
  const cw = (width - 24) / 12;
  const top = 30;
  const ch = 56;
  const chroma = (s && s.chroma) || new Array(12).fill(0);
  const max = Math.max(0.0001, ...chroma);
  chroma.forEach((v, i) => {
    const h = (v / max) * ch;
    const strong = v / max > 0.6;
    g.rect(cx + i * cw + 1, top + ch - h, cw - 2, h, { fill: strong ? THEME.accent : mix(THEME.surface3, THEME.accent, 0.4), r: 1 });
    g.text(PC[i], cx + i * cw + cw / 2, top + ch + 8, { size: THEME.size.xs, align: 'center', color: strong ? THEME.text : THEME.faint });
  });
  // ocupación y bombo
  const rows = [['ataques', (s && s.occupancy) || []], ['bombo', (s && s.kick) || []]];
  rows.forEach(([label, arr], r) => {
    const y = top + ch + 20 + r * 16;
    g.text(label, 12, y + 5, { size: THEME.size.xs, color: THEME.faint });
    const gx = 60;
    const gw = (width - gx - 12) / 16;
    for (let i = 0; i < 16; i++) {
      const v = arr[i] || 0;
      g.rect(gx + i * gw + 1, y, gw - 2, 11, { fill: v > 0 ? (r ? THEME.accent2 : THEME.accent) : THEME.surface2, fillAlpha: v > 0 ? 0.25 + 0.75 * v : 1, r: 2 });
    }
  });
  const info = s ? `${s.onsets || 0} ataques · ${s.kicks || 0} bombos en ${s.bars || 8} compases${s.active === false ? ' · en pausa' : ''}` : 'Esperando audio…';
  g.text(ellipsize(g, info, width - 24, THEME.size.xs), 12, height - 14, { size: THEME.size.xs, color: THEME.dim });
}

module.exports = { SIZE, draw };
