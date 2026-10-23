'use strict';
// Análisis de clips de acordes y bajos: voicings, posiciones en rejilla de 16, duraciones y velocity.
// Uso: node tools/corpus_chords.js <carpeta> [--json]
const fs = require('fs');
const path = require('path');
const { parseSMF } = require('./lib/smf');
const A = require('./lib/analysis');
const { walk } = require('./corpus_scan');

function analyzeFile(file, root) {
  const smf = parseSMF(fs.readFileSync(file));
  const key = A.keyFromName(path.basename(file));
  const chords = A.groupChords(smf.notes);
  const bars = Math.max(1, Math.round(Math.max(smf.endBeats, ...chords.map((c) => c.start + c.duration)) / 4));
  return {
    file: path.relative(root, file).replace(/\\/g, '/'),
    key: key && key.name,
    bars,
    events: chords.map((c) => {
      const q = A.quantize(c.start, 0.25);
      return {
        step: q.idx % 16, bar: Math.floor(q.idx / 16), dev: +q.dev.toFixed(3),
        dur16: +(c.duration / 0.25).toFixed(2), vel: c.velocity,
        size: c.pitches.length, intervals: c.intervals.join('-'),
        rel: key ? A.voicingRelativeTo(c.pitches, key.root).join(',') : null,
        bass: c.pitches[0],
      };
    }),
  };
}

function aggregate(files) {
  const count = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
  const ev = files.flatMap((f) => f.events);
  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
  const durs = ev.map((e) => e.dur16).sort((a, b) => a - b);
  const q = (p) => durs[Math.floor(p * (durs.length - 1))];
  return {
    files: files.length,
    events: ev.length,
    barsPerFile: count(files.map((f) => f.bars)),
    stepHistogram: A.histogram(ev.map((e) => e.step), 16),
    eventsPerBar: +(ev.length / files.reduce((s, f) => s + f.bars, 0)).toFixed(2),
    chordSize: count(ev.map((e) => e.size)),
    topIntervalShapes: top(count(ev.map((e) => e.intervals))),
    topRelativeToKey: top(count(ev.filter((e) => e.rel).map((e) => e.rel))),
    durationIn16ths: { p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9) },
    velocity: { min: Math.min(...ev.map((e) => e.vel)), max: Math.max(...ev.map((e) => e.vel)),
      mean: +(ev.reduce((s, e) => s + e.vel, 0) / ev.length).toFixed(1) },
    meanAbsDev: +(ev.reduce((s, e) => s + Math.abs(e.dev), 0) / ev.length).toFixed(3),
    bassRange: [Math.min(...ev.map((e) => e.bass)), Math.max(...ev.map((e) => e.bass))],
  };
}

if (require.main === module) {
  const root = process.argv[2];
  const files = [...walk(root)].map((f) => analyzeFile(f, root));
  if (process.argv.includes('--json')) console.log(JSON.stringify(files, null, 1));
  else console.log(JSON.stringify(aggregate(files), null, 1));
}

module.exports = { analyzeFile, aggregate };
