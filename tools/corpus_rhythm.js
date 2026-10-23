'use strict';
// Análisis rítmico por rol (carril) de un corpus MIDI.
// - Archivos de un solo carril: el rol sale del nombre de archivo (Kick, HiHat, Skank...).
// - Archivos multicarril (Drum Rack, GM): el rol sale de la nota MIDI (mapa GM).
// Mide: patrón de compás más frecuente, histograma de ataques en 16 pasos, swing de semicorchea
// y de corchea, velocity por posición y tempo (de la cabecera o del prefijo del nombre).
// Uso: node tools/corpus_rhythm.js <carpeta> [--gm] [--files]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseSMF } = require('./lib/smf');
const A = require('./lib/analysis');
const { walk } = require('./corpus_scan');

const ROLE_RULES = [
  [/hi-?hat.?open|open.?hat|ohh/i, 'hat_open'],
  [/hi-?hat|hihat|hh/i, 'hat'],
  [/ride/i, 'ride'],
  [/kick|bd\b/i, 'kick'],
  [/rim/i, 'rim'],
  [/snare|clap/i, 'snare'],
  [/shaker|cabasa|maraca/i, 'shaker'],
  [/tamb/i, 'tambourine'],
  [/wood ?block|woodblock/i, 'woodblock'],
  [/conga/i, 'conga'],
  [/timbal/i, 'timbale'],
  [/cowbell/i, 'cowbell'],
  [/triangle/i, 'triangle'],
  [/tom/i, 'tom'],
  [/double.?skank/i, 'double_skank'],
  [/skank/i, 'skank'],
  [/sub.?bass|bass/i, 'bass'],
  [/organ/i, 'organ'],
  [/keys|piano|clav/i, 'keys'],
  [/drum.?rack|drums.?full|full.?kit|steppers|half.?step|percussion/i, 'kit'],
];

// Mapa General MIDI de percusión (canal 10) agrupado por función.
const GM = {
  35: 'kick', 36: 'kick', 37: 'rim', 38: 'snare', 39: 'clap', 40: 'snare', 41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom',
  42: 'hat', 44: 'hat_pedal', 46: 'hat_open', 49: 'crash', 57: 'crash', 51: 'ride', 59: 'ride', 53: 'ride_bell', 52: 'china', 55: 'splash',
  54: 'tambourine', 56: 'cowbell', 58: 'vibraslap',
  60: 'bongo_hi', 61: 'bongo_lo', 62: 'conga_mute', 63: 'conga_open', 64: 'conga_lo',
  65: 'timbale_hi', 66: 'timbale_lo', 67: 'agogo_hi', 68: 'agogo_lo', 69: 'cabasa', 70: 'maracas',
  71: 'whistle', 72: 'whistle', 73: 'guiro', 74: 'guiro', 75: 'claves', 76: 'woodblock_hi', 77: 'woodblock_lo',
  78: 'cuica_mute', 79: 'cuica_open', 80: 'triangle', 81: 'triangle_open',
};

function roleFromName(name) {
  for (const [re, role] of ROLE_RULES) if (re.test(name)) return role;
  return 'other';
}

function bpmFromName(name) {
  const m = /^(\d{2,3})[ _]/.exec(name) || /(?:^|[_ -])(\d{2,3})(?:bpm|[_ -])/i.exec(name);
  const v = m ? +m[1] : null;
  return v && v >= 50 && v <= 200 ? v : null;
}

// Mide cada carril: lista de ataques en negras -> estadísticas.
function laneStats(starts, velocities, beatsPerBar) {
  const stepsPerBar = beatsPerBar * 4;
  const q = starts.map((s) => A.quantize(s, 0.25));
  const steps = q.map((x) => x.idx);
  const bars = Math.max(1, Math.ceil((Math.max(...steps) + 1) / stepsPerBar));
  // patrón por compás
  const barPatterns = [];
  for (let b = 0; b < bars; b++) {
    const g = new Array(stepsPerBar).fill('.');
    steps.forEach((s, i) => { if (Math.floor(s / stepsPerBar) === b) g[s % stepsPerBar] = velocities[i] >= 100 ? 'X' : 'x'; });
    barPatterns.push(g.join(''));
  }
  // patrón canónico: el compás (o par de compases) más frecuente entre los compases con ataques
  const active = barPatterns.filter((p) => /x/i.test(p));
  const pc = {};
  for (const p of active) pc[p.toLowerCase()] = (pc[p.toLowerCase()] || 0) + 1;
  const canonical = Object.entries(pc).sort((a, b) => b[1] - a[1])[0];
  const pc2 = {};
  for (let b = 0; b + 1 < barPatterns.length; b += 2) {
    const p = (barPatterns[b] + barPatterns[b + 1]).toLowerCase();
    if (/x/.test(p)) pc2[p] = (pc2[p] || 0) + 1;
  }
  const canonical2 = Object.entries(pc2).sort((a, b) => b[1] - a[1])[0];
  const grid = A.bestGrid(starts);
  // swing: desviación media (en pasos de semicorchea) de las semicorcheas impares y de las corcheas a contratiempo
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const odd16 = q.filter((x) => x.idx % 2 === 1).map((x) => x.dev);
  const off8 = q.filter((x) => x.idx % 4 === 2).map((x) => x.dev);
  const on = q.filter((x) => x.idx % 4 === 0).map((x) => x.dev);
  // velocity media por posición dentro del compás
  const velBy = new Array(stepsPerBar).fill(0).map(() => []);
  steps.forEach((s, i) => velBy[s % stepsPerBar].push(velocities[i]));
  return {
    bars,
    hits: starts.length,
    activeBars: active.length,
    canonical: canonical ? { pattern: canonical[0], share: +(canonical[1] / active.length).toFixed(2) } : null,
    canonical2: canonical2 ? { pattern: canonical2[0], share: +(canonical2[1] / Object.values(pc2).reduce((s, v) => s + v, 0)).toFixed(2) } : null,
    distinctBars: Object.keys(pc).length,
    grid: grid.perBeat === 3 ? 'tresillo' : 'semicorchea',
    gridError: +grid.error.toFixed(3),
    histogram: A.histogram(steps, stepsPerBar),
    devOnBeat: on.length ? +mean(on).toFixed(3) : null,
    devOff8: off8.length ? +mean(off8).toFixed(3) : null,
    devOdd16: odd16.length ? +mean(odd16).toFixed(3) : null,
    velByStep: velBy.map((v) => (v.length ? Math.round(mean(v)) : 0)),
  };
}

function analyzeFile(file, root, opts) {
  const buf = fs.readFileSync(file);
  const smf = parseSMF(buf);
  const name = path.basename(file);
  const ts = smf.timeSigs[0] || { num: 4, den: 4 };
  const beatsPerBar = ts.num * 4 / ts.den;
  const bpm = smf.tempos.length ? +smf.tempos[0].bpm.toFixed(1) : bpmFromName(name);
  const nameRole = roleFromName(name);
  const lanes = {};
  for (const n of smf.notes) {
    let role;
    if (opts.gm || nameRole === 'kit') role = (GM[n.pitch] || 'pitch_' + n.pitch);
    else role = nameRole;
    (lanes[role] = lanes[role] || []).push(n);
  }
  const out = {};
  for (const [role, notes] of Object.entries(lanes)) {
    // en carriles melódicos (skank, bajo, teclas) se agrupan acordes antes de medir ritmo
    const events = /skank|bass|keys|organ/.test(role) ? A.groupChords(notes).map((c) => ({ start: c.start, velocity: c.velocity, duration: c.duration })) : notes;
    out[role] = laneStats(events.map((e) => e.start), events.map((e) => e.velocity), beatsPerBar);
    out[role].meanDur16 = +(events.reduce((s, e) => s + e.duration, 0) / events.length / 0.25).toFixed(2);
  }
  const hash = crypto.createHash('sha1').update(JSON.stringify(smf.notes.map((n) => [n.pitch, n.start, n.duration]))).digest('hex').slice(0, 12);
  return { file: path.relative(root, file).replace(/\\/g, '/'), hash, bpm, ts: `${ts.num}/${ts.den}`, role: nameRole, lanes: out };
}

if (require.main === module) {
  const root = process.argv[2];
  const opts = { gm: process.argv.includes('--gm') };
  const seen = new Set();
  const res = [];
  for (const f of walk(root)) {
    const a = analyzeFile(f, root, opts);
    if (seen.has(a.hash)) continue; // descarta duplicados exactos entre packs
    seen.add(a.hash);
    res.push(a);
  }
  console.log(JSON.stringify(res, null, process.argv.includes('--pretty') ? 1 : 0));
}

module.exports = { analyzeFile, laneStats, roleFromName, bpmFromName, GM };
