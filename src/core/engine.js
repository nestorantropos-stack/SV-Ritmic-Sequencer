'use strict';
// Motor común de generación: transformaciones → plan de repeticiones → eventos por ciclo con variación
// final → microtiempo (swing, plantillas, rejilla deformable, humanizador) → notas por destino → clip.
const { mod, lcm, clamp, range } = require('./util');
const { createRng } = require('./rng');
const { normalizePattern } = require('./pattern');
const { normalizeWeights, parseMeter } = require('./meter');
const T = require('./transforms');
const { mutateTowardTarget } = require('./syncopation');
const { tihaiStart } = require('./cycles');
const { effectiveSwingRatio, swingOddOffset, gridFromBeatProportions, brownianOffsets, msToBeats, isTextureRate } = require('./timing');
const { euclid } = require('./rhythm');

const EPS = 1e-6;
const MAIN_ROLES = ['timeline', 'bell', 'chord', 'bass', 'hat', 'clap', 'accent', 'darbuka', 'group', 'euclid', 'voice', 'cell', 'beat'];

function mainLayerIndex(norm, preferredRole) {
  if (preferredRole) { const i = norm.layers.findIndex((l) => l.role === preferredRole); if (i >= 0) return i; }
  for (const r of MAIN_ROLES) { const i = norm.layers.findIndex((l) => l.role === r && l.onsets.length); if (i >= 0) return i; }
  let best = 0;
  norm.layers.forEach((l, i) => { if (l.onsets.length > norm.layers[best].onsets.length) best = i; });
  return best;
}

// ---------------------------------------------------------------- transformaciones previas
function applyTransforms(norm, opts, rng, warnings) {
  const tr = opts.transform || {};
  const allowed = new Set(norm.source.transforms_allowed || []);
  const n = norm.cycle_len;
  const main = mainLayerIndex(norm, opts.mainRole);
  const want = (k) => {
    if (tr[k] === undefined || tr[k] === null || tr[k] === false || tr[k] === 0) return false;
    if (!allowed.has(k)) { warnings.push(`La transformación «${k}» no está permitida para ${norm.id}; se ignora.`); return false; }
    return true;
  };
  const locked = [0]; // el inicio del ciclo (sam, gong, pulso 1) no se mueve en density ni síncopa
  const layers = norm.layers.map((l) => ({ ...l, onsets: l.onsets.slice() }));
  const remap = (l, newOnsets) => {
    // conserva los atributos por ataque cuando el ataque sobrevive; los nuevos toman el valor por peso
    const wN = normalizeWeights(norm.weights);
    const idx = new Map(l.onsets.map((o, i) => [o, i]));
    const pick = (k, o, def) => (idx.has(o) ? l[k][idx.get(o)] : def);
    return {
      ...l,
      onsets: newOnsets,
      velocity: newOnsets.map((o) => pick('velocity', o, Math.round(70 + 40 * wN[mod(o, n)]))),
      timbre: newOnsets.map((o) => pick('timbre', o, l.timbre[0] ?? 0)),
      microtiming: newOnsets.map((o) => pick('microtiming', o, 0)),
      gate: newOnsets.map((o) => pick('gate', o, l.gate[0] ?? norm.step_value)),
      probability: newOnsets.map((o) => pick('probability', o, 1)),
    };
  };
  layers.forEach((l, i) => {
    const len = l.cycle_len;
    let on = l.onsets;
    const isMain = i === main || tr.allLayers;
    if (want('rotate') && isMain) on = T.rotate(on, len, tr.rotate);
    if (want('reverse') && isMain) on = T.reverse(on, len);
    if (want('complement') && isMain) on = T.complement(on, len);
    if (want('phase') && tr.phase && tr.phase.layer === i) on = T.phase(on, len, tr.phase.k);
    if (want('binarize') && len === 12 && isMain) {
      warnings.push('Binarización 12→16: hipótesis de Pérez Fernández, como experimento auditivo.');
      on = T.binarize(on, 12, 16, tr.binarizeRounding || 'nearest');
    }
    if (want('density') && (isMain || tr.allLayers) && len === n) on = T.density(on, len, norm.weights, clamp(tr.density, -1, 1), rng, locked);
    if (on !== l.onsets) layers[i] = remap(l, on);
  });
  if (norm.layers.some((l) => l.cycle_len === 12) && tr.binarize && allowed.has('binarize')) {
    // binarizar cambia la longitud del ciclo a 16 y el paso a semicorchea dentro de la misma duración
    norm = { ...norm, cycle_len: 16, step_value: (norm.cycle_len * norm.step_value) / 16, weights: require('./meter').LHL_16 };
    layers.forEach((l) => { l.cycle_len = 16; });
  }
  // síncopa objetivo sobre la capa principal (COG.3.3)
  if (typeof opts.syncopation === 'number' && layers[main] && layers[main].cycle_len === norm.cycle_len && layers[main].onsets.length > 1) {
    const on = mutateTowardTarget(layers[main].onsets, norm.weights, clamp(opts.syncopation, 0, 1), rng.fork('sync'), { locked });
    layers[main] = remap(layers[main], on);
  }
  // modo Adaptable (§6.2): ataques nuevos en los huecos del arreglo
  if (opts.complement && Array.isArray(opts.complement.occupancy) && opts.complement.amount > 0) {
    const setMeter = parseMeter(opts.timeSignature || '4/4');
    const occ = T.resampleOccupancy(opts.complement.occupancy, norm.cycle_len, norm.step_value, (setMeter.num * 4) / setMeter.den);
    const targets = opts.complement.allLayers ? layers.map((_, i) => i) : [main];
    for (const i of targets) {
      if (!layers[i] || layers[i].cycle_len !== norm.cycle_len) continue;
      const on = T.complementTo(layers[i].onsets, norm.cycle_len, occ, clamp(opts.complement.amount, 0, 1), rng.fork('comp' + i), { locked });
      layers[i] = remap(layers[i], on);
    }
  }
  return { ...norm, layers, mainIndex: main };
}

// ---------------------------------------------------------------- repeticiones
// repeats: número, 'auto' (política del patrón) o 'full' (ciclo completo contra el compás del set).
function planRepeats(norm, opts = {}) {
  const pol = norm.repeat_policy || { mode: 'fixed', default_repeats: 4, variation_on_last: 'none' };
  const cycleBeats = norm.cycle_len * norm.step_value;
  const setMeter = parseMeter(opts.timeSignature || '4/4');
  const barBeats = (setMeter.num * 4) / setMeter.den;
  let repeats;
  if (opts.repeats === 'full') {
    // mínimo común múltiplo en ticks para que el bucle cierre con el compás del set
    const q = 960;
    const total = lcm(Math.round(cycleBeats * q), Math.round(barBeats * q)) / q;
    repeats = Math.max(1, Math.round(total / cycleBeats));
  } else if (Number.isInteger(opts.repeats) && opts.repeats > 0) repeats = opts.repeats;
  else repeats = pol.default_repeats;
  let extraTihai = 0;
  if (pol.mode === 'tihai' && opts.variation !== 'none' && (opts.variation || pol.variation_on_last) === 'tihai') extraTihai = 1;
  repeats += extraTihai;
  if (pol.mode === 'lcm' && pol.max_bars) {
    const maxCycles = Math.max(1, Math.floor((pol.max_bars * barBeats) / cycleBeats));
    repeats = Math.min(repeats, maxCycles);
  }
  const variation = opts.variation && opts.variation !== 'auto' ? opts.variation : pol.variation_on_last || 'none';
  return {
    mode: pol.mode, repeats, cycleBeats, totalBeats: repeats * cycleBeats, barBeats,
    bars: (repeats * cycleBeats) / barBeats,
    variation, variationCycle: variation === 'none' ? null : repeats - 1,
  };
}

// ---------------------------------------------------------------- eventos
function layerEvents(norm, li, cycle) {
  const l = norm.layers[li];
  const n = norm.cycle_len;
  const params = norm.params || {};
  let onsets = l.onsets;
  // PRO.11 · desplazamiento discreto de una capa cada N ciclos
  if (params.shift_every && params.shift_layer === li) onsets = onsets.map((o) => mod(o + Math.floor(cycle / params.shift_every), l.cycle_len));
  const out = [];
  // una capa con ciclo propio (polimetría) se repite dentro del ciclo del patrón
  for (let start = 0; start < n; start += l.cycle_len) {
    onsets.forEach((o, i) => {
      const s = start + o;
      if (s >= n) return;
      out.push({
        layer: li, role: l.role, cycle, stepInCycle: s, step: cycle * n + s,
        velocity: l.velocity[i], timbre: l.timbre[i], micro: l.microtiming[i], gate: l.gate[i], probability: l.probability[i],
        swing: l.swing,
      });
    });
  }
  return out;
}

function stepsPerBeat(norm) { return Math.max(1, Math.round(1 / norm.step_value)); }

function applyVariation(events, norm, plan, rng) {
  if (plan.variationCycle === null) return events;
  const c = plan.variationCycle;
  const n = norm.cycle_len;
  const spb = stepsPerBeat(norm);
  const main = norm.mainIndex;
  const inLast = (e) => e.cycle === c;
  const lastBeatStart = n - Math.min(n, spb);
  const mainLayer = norm.layers[main] || { role: 'main' };
  const base = (stepInCycle, vel, extra = {}) => ({
    layer: main, role: mainLayer.role, cycle: c, stepInCycle, step: c * n + stepInCycle, velocity: vel,
    timbre: (mainLayer.timbre && mainLayer.timbre[0]) || 0, micro: 0, gate: Math.min(norm.step_value, 0.25), probability: 1, swing: null, variation: true, ...extra,
  });
  const ramp = (k, total) => Math.round(70 + (50 * (k + 1)) / total);
  switch (plan.variation) {
    case 'fill':
    case 'virada':
    case 'density_up': {
      const from = plan.variation === 'fill' ? lastBeatStart : Math.floor(n / 2);
      const amount = plan.variation === 'density_up' ? 0.4 : 0.6;
      const keep = events.filter((e) => !(inLast(e) && e.layer === main && e.stepInCycle >= from));
      const span = range(n - from).map((k) => from + k);
      const existing = events.filter((e) => inLast(e) && e.layer === main && e.stepInCycle >= from).map((e) => e.stepInCycle);
      const extra = span.filter((s) => !existing.includes(s) && rng.chance(amount));
      const all = [...new Set([...existing, ...extra])].sort((a, b) => a - b);
      return [...keep, ...all.map((s, k) => base(s, ramp(k, all.length)))];
    }
    case 'hat_triplet_fill':
    case 'trap_roll': {
      const div = plan.variation === 'trap_roll' ? 8 : 3; // fusas o tresillo por negra
      const keep = events.filter((e) => !(inLast(e) && e.layer === main && e.stepInCycle >= lastBeatStart));
      const add = range(div).map((k) => base(lastBeatStart + (k * spb) / div, ramp(k, div), { gate: 1 / div / 2 }));
      return [...keep, ...add];
    }
    case 'tihai': {
      // PRO.16 · frase de P pasos ×3 con huecos G; la llegada es el sam del inicio del bucle (ciclo 0, paso 0)
      const G = n >= 12 ? 1 : 0;
      const P = Math.max(1, Math.floor((n - 1 - 2 * G) / 3));
      const start = tihaiStart(P, G, n);
      const phrase = euclid(Math.max(1, Math.ceil(P / 2)), P).map((o) => o - (euclid(Math.max(1, Math.ceil(P / 2)), P)[0] || 0));
      const keep = events.filter((e) => !(inLast(e) && e.layer === main && e.stepInCycle >= start));
      const add = [];
      for (let k = 0; k < 3; k++) for (const o of phrase) add.push(base(start + k * (P + G) + o, 100 + 9 * k, { tihai: true }));
      return [...keep, ...add.filter((e) => e.stepInCycle < n)];
    }
    case 'gong':
      return events.map((e) => (inLast(e) && e.role === 'gong' ? { ...e, velocity: 127, gate: e.gate * 2, variation: true } : e));
    case 'llamada': {
      // Aproximación de diseño: el último compás conserva solo los acentos y remata en el 4.º acento;
      // los pasos siguientes quedan en silencio antes de volver al inicio del ciclo.
      const acc = norm.layers.find((l) => l.role === 'accent');
      const accents = acc ? acc.onsets : (norm.grouping ? require('./cycles').groupStarts(norm.grouping) : [0]);
      const stop = accents[Math.min(3, accents.length - 1)];
      return events
        .filter((e) => !inLast(e) || (accents.includes(e.stepInCycle) && e.stepInCycle <= stop))
        .map((e) => (inLast(e) ? { ...e, velocity: 127, variation: true } : e));
    }
    case 'dropout':
      // RGG.8.2 · se retira el ritmo en la segunda mitad del último ciclo; el regreso es el inicio del bucle
      return events.filter((e) => !(inLast(e) && e.stepInCycle >= n / 2));
    default:
      return events;
  }
}

function buildEvents(norm, plan, rng) {
  let events = [];
  for (let c = 0; c < plan.repeats; c++) for (let li = 0; li < norm.layers.length; li++) events.push(...layerEvents(norm, li, c));
  events = applyVariation(events, norm, plan, rng.fork('variation'));
  return events.sort((a, b) => a.step - b.step || a.layer - b.layer);
}

// ---------------------------------------------------------------- tiempo
function resolveTemplate(opts, data) {
  const id = opts.microtiming || null;
  if (!id || !data || !data.microtiming) return null;
  return data.microtiming.templates.find((t) => t.id === id) || null;
}

// Tiempo en negras de cada evento, con swing, plantilla, rejilla deformable y humanizador.
function timeEvents(events, norm, opts, rng, data, warnings) {
  const bpm = opts.bpm || 120;
  const sv = norm.step_value;
  const spb = stepsPerBeat(norm);
  const tpl = resolveTemplate(opts, data);
  const meter = parseMeter(norm.meter);
  const barBeats = (meter.num * 4) / meter.den;
  const barSteps = Math.round(barBeats / sv);
  let grid = null;
  if (tpl && tpl.beat_proportions && tpl.beat_proportions.length === Math.round(barBeats) && Math.abs(Math.round(barBeats) - barBeats) < EPS) {
    grid = gridFromBeatProportions(tpl.beat_proportions, spb);
  } else if (tpl && tpl.beat_proportions) warnings.push(`La plantilla ${tpl.id} requiere ${tpl.beat_proportions.length} pulsos por compás; se ignora.`);
  if (tpl && tpl.step_offsets && tpl.step_offsets.length !== spb) warnings.push(`La plantilla ${tpl.id} tiene ${tpl.step_offsets.length} subdivisiones y el patrón ${spb}; se ignora.`);
  if (tpl && (tpl.step_offsets === null || (tpl.beat_proportions === null && !tpl.step_offsets && tpl.global_offset === undefined))) warnings.push(`La plantilla ${tpl.id} no tiene valores (dato por verificar).`);
  // swing global (opción) en unidades de `unit` pasos
  const sw = opts.swing || null;
  const swUnit = sw ? Math.max(1, Math.round((sw.level || 0.25) / sv)) : 0;
  const swOff = sw ? swingOddOffset(effectiveSwingRatio(sw.ratio || 1, bpm, sw.coupling || 0)) * swUnit : 0;
  // humanizador por capa
  const hum = opts.humanize && opts.humanize.sigmaMs > 0 ? opts.humanize : null;
  const humByLayer = new Map();
  if (hum) {
    for (const li of new Set(events.map((e) => e.layer))) {
      const count = events.filter((e) => e.layer === li).length;
      humByLayer.set(li, { i: 0, offs: brownianOffsets(count, rng.fork('hum' + li), hum) });
    }
  }
  const layerSwingUnit = Math.max(1, Math.round(((norm.params && norm.params.swing_level) || 0.5) / sv));
  return events.map((e) => {
    let off = e.micro || 0; // en pasos
    const s = e.stepInCycle;
    const intStep = Math.abs(s - Math.round(s)) < EPS;
    if (intStep) {
      const si = Math.round(s);
      if (e.swing && e.swing > 1) off += swingOddOffset(effectiveSwingRatio(e.swing, bpm, (norm.params && norm.params.tempo_coupling) || 0)) * (si % layerSwingUnit === 0 && Math.floor(si / layerSwingUnit) % 2 === 1 ? layerSwingUnit : 0);
      if (sw && si % swUnit === 0 && Math.floor(si / swUnit) % 2 === 1) off += swOff;
      if (tpl && tpl.step_offsets && tpl.step_offsets.length === spb) off += tpl.step_offsets[mod(si, spb)];
    }
    if (tpl && typeof tpl.global_offset === 'number') off += tpl.global_offset;
    let t;
    if (grid && intStep && barSteps === grid.length) {
      const absStep = e.cycle * norm.cycle_len + s;
      const bar = Math.floor(absStep / barSteps);
      t = bar * barBeats + grid[mod(Math.round(absStep), barSteps)] * barBeats + off * sv;
    } else t = (e.cycle * norm.cycle_len + s + off) * sv;
    if (hum) { const h = humByLayer.get(e.layer); t += msToBeats(h.offs[h.i++], bpm); }
    return { ...e, time: t };
  });
}

// ---------------------------------------------------------------- acentos, velocity y salida
function accentAndVelocity(events, norm, opts, rng) {
  const wN = normalizeWeights(norm.weights);
  const acc = opts.accent || { velocity: 0, duration: 0, pitch: 0, cc: 0 };
  const vr = opts.velocityRange || null;
  return events.map((e) => {
    const s = wN[mod(Math.round(e.stepInCycle), norm.cycle_len)] ?? 0.5;
    let v = e.velocity * (1 - (acc.velocity || 0) * 0.45 * (1 - s));
    if (vr) v = vr[0] + ((v - 1) / 126) * (vr[1] - vr[0]);
    const gate = e.gate * (1 + (acc.duration || 0) * 0.6 * s);
    const octave = acc.pitch && s > 0.85 && rng.chance(acc.pitch) ? 12 : 0;
    return { ...e, velocity: clamp(Math.round(v), 1, 127), gate, accentStrength: s, accentOctave: octave, cc: acc.cc ? Math.round(127 * s * acc.cc) : null };
  });
}

// Envuelve y recorta para que el bucle cierre: los ataques anticipados en el paso 0 pasan al final (D-006).
function finalizeNotes(notes, totalBeats) {
  const placed = notes
    .map((n) => {
      let st = n.start_time;
      if (st < 0) st += totalBeats;
      if (st >= totalBeats - EPS) st -= totalBeats;
      st = clamp(st, 0, totalBeats - 1e-4);
      const dur = clamp(n.duration, 1 / 64, Math.max(1 / 64, totalBeats - st));
      return { ...n, start_time: +st.toFixed(6), duration: +dur.toFixed(6) };
    });
  // dos capas en la misma nota y el mismo instante (p. ej. tali y matra en un mapa por timbre): queda la más fuerte
  const best = new Map();
  for (const n of placed) {
    const k = `${n.pitch}@${n.start_time.toFixed(4)}`;
    const cur = best.get(k);
    if (!cur || n.velocity > cur.velocity) best.set(k, n);
  }
  const sorted = [...best.values()].sort((a, b) => a.start_time - b.start_time || a.pitch - b.pitch);
  // Live no admite dos notas de la misma altura solapadas: acorta la anterior hasta el inicio de la siguiente
  // (comprobado en Live 12.4.6 con Producer Pal, D-036)
  const lastByPitch = new Map();
  for (const n of sorted) {
    const prev = lastByPitch.get(n.pitch);
    if (prev && prev.start_time + prev.duration > n.start_time) prev.duration = +(n.start_time - prev.start_time).toFixed(6);
    lastByPitch.set(n.pitch, n);
  }
  return sorted;
}

const destinations = {
  chords: () => require('./destinations/chords'),
  bassline: () => require('./destinations/bassline'),
  arpeggio: () => require('./destinations/arpeggio'),
  hihats: () => require('./destinations/hihats'),
  ethnic: () => require('./destinations/ethnic'),
  others: () => require('./destinations/others'),
};

// Punto de entrada. pattern: patrón de data/patterns; data: { drumMaps, microtiming } (opcional).
// opts: { destination, harmony: {root, intervals, id}, seed, repeats, variation, bpm, timeSignature,
//         transform, syncopation, swing, microtiming, humanize, accent, velocityRange, lock, allowStructural,
//         category, … opciones propias del destino }
function generate(pattern, opts = {}, data = {}) {
  const warnings = [];
  const restricted = !!(pattern.restricted_use || (pattern.origin && pattern.origin.restricted_use));
  if (restricted && !(pattern.structural_only && opts.allowStructural)) {
    throw new Error(`${pattern.id} es de uso restringido; solo se admite como principio estructural (allowStructural).`);
  }
  const destination = opts.destination || (pattern.destinations && pattern.destinations[0]) || 'others';
  if (!destinations[destination]) throw new Error(`Destino desconocido: ${destination}`);
  if (pattern.destinations && !pattern.destinations.includes(destination)) warnings.push(`${pattern.id} no está pensado para ${destination}; se genera igualmente.`);
  const seed = opts.seed ?? 1;
  const rng = createRng(seed);
  let norm = normalizePattern(pattern, { rng: rng.fork('pattern') });
  norm = applyTransforms(norm, opts, rng.fork('transform'), warnings);
  if (isTextureRate(norm.step_value, opts.bpm || 120)) warnings.push('Hay intervalos menores de 100 ms: se perciben como textura (MET.1).');
  const plan = planRepeats(norm, opts);
  let events = buildEvents(norm, plan, rng.fork('events'));
  events = timeEvents(events, norm, opts, rng.fork('timing'), data, warnings);
  events = accentAndVelocity(events, norm, opts, rng.fork('accent'));
  const ctx = { norm, plan, opts, rng: rng.fork('dest:' + destination), data, warnings, category: opts.category || (pattern.categories || [])[0] || null };
  let notes = destinations[destination]().render(events, ctx);
  // capas bloqueadas: se copian las notas previas de esos roles (bloqueo por capa)
  if (opts.lock && opts.lock.previous && Array.isArray(opts.lock.roles) && opts.lock.roles.length) {
    const locked = new Set(opts.lock.roles);
    notes = [...notes.filter((n) => !locked.has(n.role)), ...opts.lock.previous.notes.filter((n) => locked.has(n.role))];
  }
  notes = finalizeNotes(notes, plan.totalBeats);
  if (!notes.length) warnings.push(pattern.missing_data ? 'El patrón tiene datos faltantes (por verificar): complétalo en el editor antes de generar.' : 'La generación no produjo notas con estos ajustes.');
  return {
    notes,
    length_beats: plan.totalBeats,
    loop: { start: 0, end: plan.totalBeats },
    plan,
    meta: {
      pattern: pattern.id, name: pattern.name, destination, seed, status: pattern.status, verify: !!pattern.verify,
      tradition: pattern.origin && pattern.origin.tradition, sources: pattern.origin && pattern.origin.sources,
      harmony: opts.harmony || null, cultural_note: pattern.cultural_note || null, warnings,
      cycle_len: norm.cycle_len, step_value: norm.step_value, cycle_beats: plan.cycleBeats,
    },
  };
}

// Variación suave: misma configuración con una semilla derivada y una mutación pequeña de síncopa.
function vary(pattern, opts = {}, data = {}, amount = 0.3) {
  const seed = `${opts.seed ?? 1}~v${opts.variationIndex ?? 1}`;
  const base = typeof opts.syncopation === 'number' ? opts.syncopation : 0.3;
  const delta = (createRng(seed).next() - 0.5) * amount;
  return generate(pattern, { ...opts, seed, syncopation: clamp(base + delta, 0, 1) }, data);
}

// Para la interfaz y las pruebas: notas que no pertenecen a la escala (debería estar vacío salvo notas de paso declaradas).
function outOfScale(result, harmony) {
  const pcs = new Set(harmony.intervals.map((i) => mod(harmony.root + i, 12)));
  return result.notes.filter((n) => !n.passing && !pcs.has(mod(n.pitch, 12)));
}

module.exports = { generate, vary, planRepeats, applyTransforms, buildEvents, timeEvents, finalizeNotes, mainLayerIndex, outOfScale, stepsPerBeat };
