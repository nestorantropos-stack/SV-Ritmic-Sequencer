'use strict';
// Geometría pura de las visualizaciones (§8): círculo rítmico de Toussaint, rejilla de pasos, piano roll,
// línea de repeticiones y rejilla deformable. Devuelve números; el dibujo vive en draw.js.

const TAU = Math.PI * 2;

// Ángulo del paso i de n: el paso 0 arriba, sentido horario.
const stepAngle = (i, n) => -Math.PI / 2 + (TAU * i) / n;

// Círculo de Toussaint: marcas del ciclo, puntos de ataque por capa, polígono y arcos de agrupamiento.
function circleGeometry({ cycleLen, layers = [], grouping = null, weights = null }, cx, cy, r) {
  const n = Math.max(1, cycleLen);
  const ticks = [];
  const minW = weights ? Math.min(...weights) : 0;
  for (let i = 0; i < n; i++) {
    const a = stepAngle(i, n);
    const strength = weights && minW < 0 ? 1 - weights[i] / minW : i === 0 ? 1 : 0;
    ticks.push({ i, a, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, strength });
  }
  const shapes = layers.map((l, li) => {
    const rr = r * (1 - li * 0.14);
    const pts = l.onsets
      .filter((o) => o >= 0 && o < n)
      .map((o, k) => {
        const a = stepAngle(o, n);
        return { step: o, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, velocity: l.velocity ? l.velocity[k] : 100, timbre: l.timbre ? l.timbre[k] : 0 };
      });
    return { role: l.role, radius: rr, points: pts };
  });
  const arcs = [];
  if (Array.isArray(grouping) && grouping.reduce((s, g) => s + g, 0) === n) {
    let pos = 0;
    for (const g of grouping) { arcs.push({ start: stepAngle(pos, n), end: stepAngle(pos + g, n), from: pos, len: g }); pos += g; }
  }
  return { cx, cy, r, ticks, shapes, arcs };
}

// Línea de repeticiones: un bloque por ciclo, el último marcado si lleva variación final.
function repetitionLine(plan, x, y, w, h) {
  const reps = Math.max(1, plan.repeats || 1);
  const gap = reps > 16 ? 1 : 2;
  const bw = (w - gap * (reps - 1)) / reps;
  const blocks = [];
  for (let i = 0; i < reps; i++) blocks.push({ i, x: x + i * (bw + gap), y, w: bw, h, variation: plan.variationCycle === i });
  // marcas de compás dentro de la línea
  const bars = Math.round((plan.totalBeats || reps * plan.cycleBeats) / (plan.barBeats || 4));
  const barTicks = [];
  for (let b = 1; b < bars && bars <= 64; b++) barTicks.push(x + (w * b) / bars);
  return { blocks, barTicks };
}

// Piano roll: rectángulos por nota en un recuadro, con rango de alturas ajustado a las notas.
function pianoRoll(notes, lengthBeats, x, y, w, h, opts = {}) {
  if (!notes.length) return { rects: [], lo: 60, hi: 72 };
  let lo = Math.min(...notes.map((n) => n.pitch));
  let hi = Math.max(...notes.map((n) => n.pitch));
  if (hi - lo < (opts.minSpan || 12)) { const c = Math.round((hi + lo) / 2); lo = c - 6; hi = c + 6; }
  const rows = hi - lo + 1;
  const rh = h / rows;
  const sx = w / Math.max(lengthBeats, 1e-6);
  const rects = notes.map((n) => ({
    x: x + n.start_time * sx,
    y: y + (hi - n.pitch) * rh,
    w: Math.max(1.5, n.duration * sx - 0.5),
    h: Math.max(1.5, rh - (rh > 4 ? 1 : 0)),
    velocity: n.velocity, pitch: n.pitch, role: n.role,
  }));
  return { rects, lo, hi, rowHeight: rh, beatWidth: sx };
}

// Rejilla de pasos por capa para un ciclo: celdas con altura de velocity y desplazamiento de microtiempo.
function stepGrid({ cycleLen, layers }, x, y, w, h) {
  const n = Math.max(1, cycleLen);
  const rows = Math.max(1, layers.length);
  const cw = w / n;
  const rh = h / rows;
  const cells = [];
  layers.forEach((l, r) => {
    l.onsets.forEach((o, k) => {
      const vel = l.velocity ? l.velocity[k] : 100;
      const micro = l.microtiming ? l.microtiming[k] : 0;
      cells.push({ row: r, step: o, x: x + (o + micro) * cw, y: y + r * rh, w: cw - 1, h: rh - 1, velH: (rh - 2) * (vel / 127), velocity: vel, micro });
    });
  });
  const columns = Array.from({ length: n }, (_, i) => ({ i, x: x + i * cw }));
  return { cells, columns, cellWidth: cw, rowHeight: rh };
}

// Rejilla deformable (MIC.3): posición de cada paso según duraciones relativas, comparada con la isócrona.
function deformableGrid(positions, x, w) {
  const n = positions.length;
  return positions.map((p, i) => ({ i, x: x + p * w, isoX: x + (i / n) * w, offset: (p - i / n) * w }));
}

module.exports = { TAU, stepAngle, circleGeometry, repetitionLine, pianoRoll, stepGrid, deformableGrid };
