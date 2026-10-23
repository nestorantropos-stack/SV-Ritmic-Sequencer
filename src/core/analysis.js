'use strict';
// Modo Adaptable (§6): análisis puro de las notas MIDI leídas del set.
// Entrada: pistas [{ name, isDrum, notes: [{ pitch, start_time, duration, velocity }], length }].
const { mod } = require('./util');

// Perfiles de Krumhansl y Kessler (1982), usados por el algoritmo de Krumhansl-Schmuckler.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Histograma de clases de altura ponderado por duración (y levemente por velocity).
function pitchClassHistogram(notes) {
  const h = new Array(12).fill(0);
  for (const n of notes) h[mod(n.pitch, 12)] += (n.duration || 0.25) * (0.5 + (n.velocity || 100) / 254);
  return h;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// Krumhansl-Schmuckler: correlación del histograma con los 24 perfiles rotados.
function estimateKey(hist) {
  const total = hist.reduce((s, v) => s + v, 0);
  if (total <= 0) return { root: null, mode: null, name: null, confidence: 0, ranking: [] };
  const ranking = [];
  for (let r = 0; r < 12; r++) {
    for (const [mode, prof] of [['major', KK_MAJOR], ['minor', KK_MINOR]]) {
      const rot = prof.map((_, i) => prof[mod(i - r, 12)]);
      ranking.push({ root: r, mode, name: `${PC[r]} ${mode === 'major' ? 'mayor' : 'menor'}`, r: pearson(hist, rot) });
    }
  }
  ranking.sort((a, b) => b.r - a.r);
  const best = ranking[0];
  const second = ranking[1];
  // confianza: correlación del ganador y separación respecto del segundo
  const confidence = Math.max(0, Math.min(1, best.r * 0.7 + (best.r - second.r) * 3));
  return { root: best.root, mode: best.mode, name: best.name, r: best.r, confidence, ranking: ranking.slice(0, 5) };
}

// Desempate a favor de las escalas más usadas cuando la evidencia es ambigua.
const COMMON = { minor: 0.015, major: 0.015, dorian: 0.008, mixolydian: 0.008, minor_pentatonic: 0.008, major_pentatonic: 0.008 };

// Escala de la biblioteca que mejor cubre el histograma con la raíz dada (o con cualquier raíz).
// Puntuación: peso cubierto (lo que suena fuera de la escala resta mucho) − pequeña penalización por notas
// de la escala que no suenan + preferencia por los modos diatónicos coherentes con el modo estimado.
// Con pocas clases de altura (p. ej. dos tríadas) muchas escalas exóticas «cubren» todo; la preferencia
// evita elegir hirajōshi para Re–Fa–La–Sib (D-037). La interfaz muestra las cinco candidatas para corregir.
const MODE_PRIOR = {
  minor: { minor: 0.06, dorian: 0.04, phrygian: 0.03, harmonic_minor: 0.02, minor_pentatonic: 0.02 },
  major: { major: 0.06, mixolydian: 0.04, lydian: 0.03, major_pentatonic: 0.02 },
};
function matchScale(hist, scales, root = null, mode = null) {
  const total = hist.reduce((s, v) => s + v, 0) || 1;
  const sounding = hist.filter((v) => v > total * 0.01).length;
  const silentWeight = sounding >= 6 ? 0.04 : 0.01;
  const prior = (mode && MODE_PRIOR[mode]) || {};
  const out = [];
  const roots = root === null ? [...Array(12).keys()] : [root];
  for (const r of roots) for (const sc of scales) {
    const pcs = sc.intervals.map((i) => mod(r + i, 12));
    const covered = pcs.reduce((s, pc) => s + hist[pc], 0) / total;
    const silent = pcs.filter((pc) => hist[pc] <= total * 0.01).length;
    const score = covered - silentWeight * silent - 0.005 * sc.intervals.length + (COMMON[sc.id] || 0) + (prior[sc.id] || 0);
    out.push({ id: sc.id, name: sc.name, root: r, intervals: sc.intervals, score: +score.toFixed(4) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

// Ocupación rítmica: fracción de compases con ataque en cada paso de una rejilla de `steps` por compás.
function rhythmOccupancy(notes, { barBeats = 4, steps = 16, lengthBeats = null } = {}) {
  const occ = new Array(steps).fill(0);
  if (!notes.length) return occ;
  const len = lengthBeats || Math.max(barBeats, Math.ceil(Math.max(...notes.map((n) => n.start_time + 1e-6)) / barBeats) * barBeats);
  const bars = Math.max(1, Math.round(len / barBeats));
  const hit = new Set();
  for (const n of notes) {
    const pos = n.start_time / (barBeats / steps);
    const s = Math.round(pos);
    if (Math.abs(pos - s) > 0.35) continue; // ataques fuera de la rejilla no cuentan como ocupación de paso
    hit.add(`${Math.floor(n.start_time / barBeats)}:${mod(s, steps)}`);
  }
  for (const k of hit) occ[+k.split(':')[1]] += 1;
  return occ.map((v) => Math.min(1, v / bars));
}

// Detecta los bombos de una pista de percusión: C1/B0 (36/35) en Drum Rack o GM.
function kickTimes(track) {
  if (!track || !track.notes) return [];
  const kicks = track.notes.filter((n) => n.pitch === 36 || n.pitch === 35);
  return [...new Set(kicks.map((n) => +n.start_time.toFixed(4)))].sort((a, b) => a - b);
}

const looksDrum = (t) => !!t.isDrum || /kick|drum|beat|perc|bater|bombo|hat|snare|caja/i.test(t.name || '');

// Resumen completo para la interfaz (§6.4): tonalidad, escala, pistas consideradas, densidad, bombo.
// audio: resúmenes de SV Listen ({ name, chroma[12], occupancy[16], kick[16], level }); su croma suma al histograma
// con peso `audioWeight` relativo al MIDI y su ocupación y bombo entran en la complementariedad (D-052).
// Cuánto «suena a alturas» un croma de audio (0–1): parte de la energía en sus tres clases más fuertes. Un pad o un
// acorde concentran ≥ 0,8; una batería reparte su ruido en las 12 clases (≈ 0,3–0,45) y no debe decidir la escala
// (visto en Live: batería + pad en La menor daba «La cromática»).
function tonalness(chroma) {
  const tot = chroma.reduce((s, v) => s + v, 0);
  if (!(tot > 0)) return 0;
  const top3 = chroma.slice().sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0) / tot;
  return Math.max(0, Math.min(1, (top3 - 0.5) / 0.3));
}

function analyzeSet(tracks, { scales = [], barBeats = 4, liveScale = null, audio = [], audioWeight = 0.5 } = {}) {
  const melodic = tracks.filter((t) => !looksDrum(t) && t.notes && t.notes.length);
  const drums = tracks.filter((t) => looksDrum(t) && t.notes && t.notes.length);
  const hist = pitchClassHistogram(melodic.flatMap((t) => t.notes));
  const audible = (audio || []).filter((a) => a && Array.isArray(a.chroma) && a.level > 1e-4);
  if (audible.length) {
    const midiTotal = hist.reduce((s, v) => s + v, 0);
    const scale = midiTotal > 0 ? midiTotal * audioWeight : 1;
    for (const a of audible) {
      const tot = a.chroma.reduce((s, v) => s + v, 0) || 1;
      const w = tonalness(a.chroma);
      a.chroma.forEach((v, i) => { hist[i] += (v / tot) * w * scale / audible.length; });
    }
  }
  const key = estimateKey(hist);
  const scale = key.root === null ? [] : matchScale(hist, scales, key.root, key.mode);
  const kickTrack = drums.find((t) => kickTimes(t).length) || null;
  const perTrack = tracks.map((t) => {
    const len = t.length || barBeats;
    return {
      name: t.name, isDrum: looksDrum(t), notes: (t.notes || []).length, source: 'midi',
      density: +(((t.notes || []).length / Math.max(1, len / 0.25))).toFixed(3),
      occupancy: rhythmOccupancy(t.notes || [], { barBeats, lengthBeats: len }),
    };
  });
  for (const a of audio || []) {
    if (!a || !Array.isArray(a.occupancy)) continue;
    perTrack.push({ name: a.name, isDrum: (a.kicks || 0) > 0, notes: 0, source: 'audio', density: +(a.occupancy.reduce((s, v) => s + v, 0) / 16).toFixed(3), occupancy: a.occupancy.slice(0, 16) });
  }
  // cada clip se mide con su propio bucle y la ocupación del arreglo es el máximo por paso (D-037)
  const occupancy = new Array(16).fill(0).map((_, i) => Math.max(0, ...perTrack.map((t) => t.occupancy[i] || 0)));
  // bombo: el de una pista MIDI de percusión; si no hay, el de una pista de audio escuchada por SV Listen
  let kick = kickTrack ? { track: kickTrack.name, times: kickTimes(kickTrack), length: kickTrack.length || null, source: 'midi' } : null;
  let kickOccupancy = kickTrack ? rhythmOccupancy(kickTrack.notes.filter((x) => x.pitch === 36 || x.pitch === 35), { barBeats, lengthBeats: kickTrack.length || barBeats }) : null;
  if (!kick) {
    const best = (audio || []).filter((a) => a && Array.isArray(a.kick) && a.kick.some((v) => v >= 0.5)).sort((x, y) => y.kick.reduce((s, v) => s + v, 0) - x.kick.reduce((s, v) => s + v, 0))[0];
    if (best) {
      const times = best.kick.map((v, i) => (v >= 0.5 ? (i * barBeats) / 16 : null)).filter((v) => v !== null);
      kick = { track: best.name, times, length: barBeats, source: 'audio' };
      kickOccupancy = best.kick.slice(0, 16);
    }
  }
  return {
    key, scale,
    histogram: hist.map((v) => +v.toFixed(3)),
    occupancy: occupancy.map((v) => +v.toFixed(3)),
    density: +(occupancy.reduce((s, v) => s + v, 0) / occupancy.length).toFixed(3),
    kick,
    kickOccupancy,
    tracks: perTrack,
    audioTracks: (audio || []).length,
    liveScale,
    // si Live 12 tiene una escala activa, se ofrece como alternativa a la estimada
    agreesWithLive: liveScale && key.root !== null ? liveScale.root === key.root : null,
  };
}

// Convierte la escala de Live 12 (root_note, scale_intervals, scale_name) a la armonía del núcleo
// y busca la escala equivalente de la biblioteca por intervalos.
function liveScaleToHarmony(live, scales = []) {
  if (!live || live.root_note === undefined || !Array.isArray(live.scale_intervals)) return null;
  const intervals = live.scale_intervals.map(Number).filter((v) => v >= 0 && v < 12).sort((a, b) => a - b);
  const key = intervals.join(',');
  const match = scales.find((s) => s.intervals.join(',') === key);
  return { root: mod(Number(live.root_note), 12), intervals, id: match ? match.id : null, liveName: live.scale_name || null, name: match ? match.name : live.scale_name || 'Escala de Live' };
}

module.exports = { KK_MAJOR, KK_MINOR, pitchClassHistogram, estimateKey, matchScale, rhythmOccupancy, kickTimes, looksDrum, tonalness, analyzeSet, liveScaleToHarmony };
