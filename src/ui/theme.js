'use strict';
// Tema visual de SV Ritmic Sequencer (identidad Sidera Visus): fondo nocturno integrado con el tema oscuro
// de Live, acento celeste y lila «estelar», un color por eje de la taxonomía (taxonomy.json) y el círculo
// rítmico dibujado como una constelación: los ataques son estrellas y el polígono, sus líneas.

const THEME = {
  font: 'Ableton Sans Medium',
  fontBold: 'Ableton Sans Bold',
  bg: '#141519',
  surface: '#1B1D22',
  surface2: '#23262D',
  surface3: '#2D3139',
  line: '#3A3F49',
  text: '#ECEDF0',
  dim: '#A9ADB7',
  faint: '#737884',
  accent: '#8FD6EA', // celeste estelar
  accent2: '#C9B8FF', // lila
  ok: '#86DDA9',
  warn: '#F3C86E',
  danger: '#F29384',
  corpus: '#86BDF5',
  restricted: '#E7A6C4',
  star: '#F7F3DC',
  size: { xs: 9, sm: 10, md: 11, lg: 13, xl: 16 },
  radius: 4,
};

// Etiquetas de rol de capa → color estable (para el piano roll y la constelación multicapa).
const ROLE_COLORS = ['#8FD6EA', '#C9B8FF', '#F3C86E', '#86DDA9', '#F29384', '#86BDF5', '#E7A6C4', '#B9D98A'];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

const rgba = (hex, a = 1) => [...hexToRgb(hex), a];

// Mezcla dos colores (t = 0 → a, 1 → b).
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255).toString(16).padStart(2, '0')).join('');
}

// Contraste WCAG 2.x entre dos colores (para las pruebas de accesibilidad).
function luminance(hex) {
  return hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function axisColors(taxonomy) {
  const out = {};
  for (const ax of (taxonomy && taxonomy.axes) || []) out[ax.id] = ax.color;
  return out;
}

// Color de un ID de taxonomía por su eje (prefijo de tres letras).
const colorForId = (id, taxonomy) => axisColors(taxonomy)[String(id).slice(0, 3)] || THEME.accent;

function roleColor(role, roles) {
  const i = Math.max(0, roles.indexOf(role));
  return ROLE_COLORS[i % ROLE_COLORS.length];
}

module.exports = { THEME, ROLE_COLORS, hexToRgb, rgba, mix, luminance, contrast, axisColors, colorForId, roleColor };
