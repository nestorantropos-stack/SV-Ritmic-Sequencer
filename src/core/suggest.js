'use strict';
// Botón Sugerir (§7): puntúa los ritmos del catálogo contra el contexto del set y propone los mejores con razones.
// Contexto (lo arma el controlador desde la Live API):
//   { tempo, timeSignature, names: [nombres de pistas, dispositivos y clips], analysis: { occupancy, density }, recent: [ids] }
// Componentes (0..1) y pesos: tempo 0,30 · compás 0,20 · complementariedad 0,25 · género 0,20 · variedad 0,05.
const { mod } = require('./util');
const { normalizePattern } = require('./pattern');
const { createRng } = require('./rng');
const { syncopation, maxSyncopation } = require('./syncopation');
const { LHL_16, parseMeter } = require('./meter');
const { publicPatterns, fold } = require('./catalog');

const WEIGHTS = { tempo: 0.3, meter: 0.2, complement: 0.25, genre: 0.2, variety: 0.05 };

// Palabras de nombres de pista que no dicen nada del estilo.
const STOP = new Set(['midi', 'audio', 'track', 'pista', 'rack', 'group', 'grupo', 'return', 'main', 'master', 'instrument', 'sampler', 'simpler', 'operator', 'wavetable', 'analog', 'drift', 'meld', 'delay', 'reverb', 'chord', 'chords', 'bass', 'clip', 'scene', 'core', 'kit', 'producer', 'pal', 'ritmic', 'sequencer']);
// Alias de género: una palabra del set activa estas etiquetas.
const ALIASES = { techno: ['techno', 'dub techno', 'minimal'], dub: ['dub', 'dub techno', 'steppers', 'roots'], ddt: ['dub techno'], reggae: ['reggae', 'roots', 'one drop'], house: ['house', 'disco'], trap: ['trap', 'hiphop'], latin: ['latin', 'salsa', 'son', 'bossa'], salsa: ['salsa', 'son', 'latin'], bossa: ['bossa', 'brasil'], flamenco: ['flamenco'], tabla: ['india', 'tala'], darbuka: ['arabic'], gamelan: ['gamelan'], jungle: ['jungle', 'breakbeat'], dembow: ['dembow', 'reggaeton'], reggaeton: ['reggaeton', 'dembow'] };

function tempoScore(p, tempo) {
  if (!p.bpm_range || !tempo) return { s: 0.5, why: null };
  const [lo, hi] = p.bpm_range;
  const fit = (t) => (t >= lo && t <= hi ? 1 : Math.max(0, 1 - Math.min(Math.abs(t - lo), Math.abs(t - hi)) / 25));
  const direct = fit(tempo);
  const half = Math.max(fit(tempo / 2), fit(tempo * 2)) * 0.75; // medio tiempo o doble tiempo
  const s = Math.max(direct, half);
  if (direct >= 1) return { s, why: `tempo ${Math.round(tempo)} BPM dentro de ${lo}–${hi}` };
  if (half >= 0.75 && half > direct) return { s, why: `tempo ${Math.round(tempo)} BPM a medio o doble tiempo de ${lo}–${hi}` };
  return { s, why: s < 0.3 ? null : `tempo cercano a ${lo}–${hi} BPM` };
}

function meterScore(p, timeSignature) {
  const set = parseMeter(timeSignature || '4/4');
  const pm = parseMeter(p.meter);
  const barBeats = (set.num * 4) / set.den;
  const patBar = (pm.num * 4) / pm.den;
  if (pm.num === set.num && pm.den === set.den) return { s: 1, why: `mismo compás que el set (${p.meter})` };
  const ratio = patBar / barBeats;
  if (Math.abs(ratio - Math.round(ratio)) < 1e-6 || Math.abs(1 / ratio - Math.round(1 / ratio)) < 1e-6) return { s: 0.85, why: `ciclo compatible con ${timeSignature}` };
  if (pm.den === 8 && pm.num % 3 === 0) return { s: 0.6, why: `${p.meter} sobre ${timeSignature}: birritmia` };
  return { s: 0.35, why: `${p.meter} contra ${timeSignature}: polimetría (cierra en el mcm)` };
}

// Ataques de la capa principal en una rejilla de 16 por compás (o null si el patrón no cae en ella).
function barOnsets(p) {
  let norm;
  try { norm = normalizePattern(p, { rng: createRng(`suggest:${p.id}`) }); } catch (e) { return null; }
  const layer = norm.layers.find((l) => l.onsets.length) || null;
  if (!layer) return null;
  const set = new Set();
  for (const o of layer.onsets) {
    const beats = o * norm.step_value;
    const s = beats / 0.25;
    if (Math.abs(s - Math.round(s)) > 0.2) continue;
    set.add(mod(Math.round(s), 16));
  }
  return [...set];
}

function complementScore(p, analysis) {
  if (!analysis || !Array.isArray(analysis.occupancy)) return { s: 0.5, why: null };
  const on = barOnsets(p);
  if (!on || !on.length) return { s: 0.5, why: null };
  const occ = analysis.occupancy;
  const overlap = on.reduce((s, i) => s + (occ[i] || 0), 0) / on.length;
  // densidad: si el arreglo ya está lleno, mejor algo más escaso; si está vacío, algo más denso
  const setDensity = analysis.density ?? occ.reduce((s, v) => s + v, 0) / occ.length;
  const patDensity = on.length / 16;
  const densityFit = 1 - Math.abs(patDensity - Math.max(0.12, 0.5 - setDensity) * 1.2);
  // síncopa del conjunto: el ritmo nuevo busca llevar la mezcla al tramo medio de la curva en U invertida
  const bools = occ.map((v, i) => v >= 0.5 || on.includes(i));
  const mix = syncopation(bools, LHL_16) / maxSyncopation(LHL_16);
  const syncFit = 1 - Math.min(1, Math.abs(mix - 0.35) * 2);
  const s = Math.max(0, 0.5 * (1 - overlap) + 0.25 * Math.max(0, densityFit) + 0.25 * syncFit);
  const why = overlap <= 0.25 ? `llena huecos del arreglo (solapa ${Math.round(overlap * 100)} %)` : overlap >= 0.7 ? null : `solapa ${Math.round(overlap * 100)} % con el arreglo`;
  return { s, why };
}

function words(names) {
  const out = new Set();
  for (const n of names || []) for (const w of fold(n).split(/[^a-z0-9]+/)) if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) out.add(w);
  return [...out];
}

function genreScore(p, names) {
  const ws = words(names);
  if (!ws.length) return { s: 0, why: null };
  const o = p.origin || {};
  const hay = fold([p.name, o.tradition, (o.genre || []).join(' '), (p.tags || []).join(' '), (p.categories || []).join(' ').replace(/_/g, ' ')].join(' '));
  const hits = [];
  for (const w of ws) {
    const terms = ALIASES[w] || [w];
    if (terms.some((t) => hay.includes(fold(t)))) hits.push(w);
  }
  if (!hits.length) return { s: 0, why: null };
  return { s: Math.min(1, 0.5 + 0.25 * hits.length), why: `el set sugiere ${hits.slice(0, 3).map((h) => `«${h}»`).join(', ')}` };
}

function suggest(patterns, context = {}, { destination = null, top = 3 } = {}) {
  const recent = context.recent || [];
  const scored = [];
  for (const p of publicPatterns(patterns)) {
    if (p.missing_data) continue;
    if (destination && !(p.destinations || []).includes(destination)) continue;
    const parts = {
      tempo: tempoScore(p, context.tempo),
      meter: meterScore(p, context.timeSignature),
      complement: complementScore(p, context.analysis),
      genre: genreScore(p, context.names),
    };
    const uses = recent.filter((id) => id === p.id).length;
    parts.variety = { s: uses ? 0 : 1, why: uses ? null : null };
    let score = Object.entries(parts).reduce((s, [k, v]) => s + WEIGHTS[k] * v.s, 0);
    if (uses) score -= 0.15 * uses;
    if (p.verify) score -= 0.03;
    const reasons = Object.values(parts).map((v) => v.why).filter(Boolean);
    if (uses) reasons.push(`usado hace poco (${uses}×)`);
    scored.push({ id: p.id, name: p.name, tradition: p.origin && p.origin.tradition, score: +score.toFixed(4), reasons, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, +v.s.toFixed(3)])) });
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // diversidad: no proponer tres ritmos de la misma familia de taxonomía si hay alternativas cercanas
  const picked = [];
  for (const s of scored) {
    if (picked.length >= top) break;
    const fam = s.id.split('/')[0];
    const same = picked.filter((x) => x.id.split('/')[0] === fam).length;
    if (same >= 2 && scored.length > top * 3) continue;
    picked.push(s);
  }
  return picked;
}

module.exports = { suggest, WEIGHTS, tempoScore, meterScore, complementScore, genreScore, words };
