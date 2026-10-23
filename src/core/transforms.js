'use strict';
// Transformaciones de collar y de densidad (PRO.14, PRO.15, CIC.3 binarización).
// Todas son puras: reciben onsets y devuelven onsets nuevos ordenados.
const { mod, uniqSorted, range } = require('./util');

// rotate(onsets, n, k): desplaza k pasos hacia delante. La 3-2 rotada 8 da la 2-3.
const rotate = (onsets, n, k) => uniqSorted(onsets.map((o) => mod(o + k, n)));

// Retrogradación: el ataque en i pasa a (n − i) mod n, de modo que los intervalos se leen al revés
// y el ataque del paso 0 se conserva.
const reverse = (onsets, n) => uniqSorted(onsets.map((o) => mod(n - o, n)));

const complement = (onsets, n) => {
  const s = new Set(onsets.map((o) => mod(o, n)));
  return range(n).filter((i) => !s.has(i));
};

// PRO.15 · amount en [−1, 1]: negativo quita los ataques más débiles, positivo añade en los huecos más fuertes.
// `locked` protege pasos (por ejemplo el sam o el gong). Desempate determinista con rng (opcional).
function density(onsets, n, weights, amount, rng = null, locked = []) {
  const cur = uniqSorted(onsets.map((o) => mod(o, n)));
  const keep = new Set(locked.map((o) => mod(o, n)));
  const jitter = (i) => (rng ? rng.next() * 0.01 : (i % 7) * 1e-4);
  if (amount < 0) {
    const removable = cur.filter((o) => !keep.has(o));
    const count = Math.round(-amount * removable.length);
    const order = removable.map((o) => ({ o, w: weights[o] + jitter(o) })).sort((a, b) => a.w - b.w);
    const drop = new Set(order.slice(0, count).map((x) => x.o));
    return cur.filter((o) => !drop.has(o));
  }
  if (amount > 0) {
    const empty = range(n).filter((i) => !cur.includes(i));
    const count = Math.round(amount * empty.length);
    const order = empty.map((o) => ({ o, w: weights[o] + jitter(o) })).sort((a, b) => b.w - a.w);
    return uniqSorted([...cur, ...order.slice(0, count).map((x) => x.o)]);
  }
  return cur;
}

// Ajusta a un número exacto de ataques usando los pesos.
function densityTo(onsets, n, weights, targetCount, rng = null, locked = []) {
  const cur = uniqSorted(onsets.map((o) => mod(o, n)));
  if (targetCount === cur.length) return cur;
  if (targetCount < cur.length) {
    const removable = cur.length - locked.length || 1;
    return density(cur, n, weights, -(cur.length - targetCount) / removable, rng, locked);
  }
  const empty = n - cur.length || 1;
  return density(cur, n, weights, (targetCount - cur.length) / empty, rng, locked);
}

// PRO.10/11 · desplazamiento de fase discreto de una capa.
const phase = (onsets, n, k) => rotate(onsets, n, k);

// CIC.3 · §2.5 binarización (Pérez Fernández): i → round(i·16/12) con piso, techo o más cercano.
// Las colisiones se resuelven desplazando al siguiente paso libre.
function binarize(onsets, fromLen = 12, toLen = 16, rounding = 'nearest') {
  const f = rounding === 'floor' ? Math.floor : rounding === 'ceil' ? Math.ceil : Math.round;
  const used = new Set();
  const out = [];
  for (const o of uniqSorted(onsets)) {
    let p = mod(f((o * toLen) / fromLen), toLen);
    let guard = 0;
    while (used.has(p) && guard++ < toLen) p = mod(p + 1, toLen);
    used.add(p);
    out.push(p);
  }
  return uniqSorted(out);
}

// §6.2 · complementariedad (lógica de hoquetus contra el arreglo): cada ataque que cae en un paso muy
// ocupado por otras pistas se mueve, con probabilidad `amount`, al paso libre más cercano (±1, ±2).
// occ: ocupación 0..1 por paso del ciclo. locked: pasos que no se mueven.
function complementTo(onsets, n, occ, amount, rng, { threshold = 0.5, free = 0.25, locked = [] } = {}) {
  const keep = new Set(locked.map((o) => mod(o, n)));
  const taken = new Set(onsets.map((o) => mod(o, n)));
  const out = [];
  for (const o of uniqSorted(onsets.map((x) => mod(x, n)))) {
    if (keep.has(o) || occ[o] < threshold || !(rng ? rng.chance(amount) : amount >= 0.5)) { out.push(o); continue; }
    let moved = null;
    for (const d of [1, -1, 2, -2]) {
      const c = mod(o + d, n);
      if (!taken.has(c) && occ[c] <= free) { moved = c; break; }
    }
    if (moved === null) out.push(o);
    else { taken.delete(o); taken.add(moved); out.push(moved); }
  }
  return uniqSorted(out);
}

// Remuestrea una ocupación por compás (p. ej. 16 semicorcheas) a los pasos de un ciclo cualquiera.
function resampleOccupancy(occBar, cycleLen, stepValue, barBeats = 4) {
  const per = barBeats / occBar.length;
  return range(cycleLen).map((i) => occBar[mod(Math.round(((i * stepValue) % barBeats) / per), occBar.length)]);
}

module.exports = { rotate, reverse, complement, density, densityTo, phase, binarize, complementTo, resampleOccupancy };
