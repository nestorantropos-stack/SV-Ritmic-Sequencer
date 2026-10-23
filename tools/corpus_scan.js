'use strict';
// Recorre carpetas con .mid y vuelca un resumen por archivo en JSON (una línea por archivo).
// Uso: node tools/corpus_scan.js <carpeta> [<carpeta> ...] > salida.jsonl
const fs = require('fs');
const path = require('path');
const { parseSMF } = require('./lib/smf');

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.midi?$/i.test(e.name)) yield p;
  }
}

function summarize(file, root) {
  const smf = parseSMF(fs.readFileSync(file));
  const n = smf.notes;
  const pitches = n.map((x) => x.pitch);
  return {
    file: path.relative(root, file).replace(/\\/g, '/'),
    ppq: smf.ppq,
    bpm: smf.tempos.length ? +smf.tempos[0].bpm.toFixed(2) : null,
    ts: smf.timeSigs.length ? `${smf.timeSigs[0].num}/${smf.timeSigs[0].den}` : null,
    beats: +smf.endBeats.toFixed(3),
    lastNoteEnd: n.length ? +Math.max(...n.map((x) => x.start + x.duration)).toFixed(3) : 0,
    notes: n.length,
    channels: [...new Set(n.map((x) => x.channel))],
    range: n.length ? [Math.min(...pitches), Math.max(...pitches)] : null,
    distinctPitches: [...new Set(pitches)].sort((a, b) => a - b),
    tracks: smf.tracks.map((t) => t.name).filter(Boolean),
  };
}

if (require.main === module) {
  for (const root of process.argv.slice(2)) {
    for (const f of walk(root)) {
      try { console.log(JSON.stringify(summarize(f, root))); }
      catch (e) { console.log(JSON.stringify({ file: f, error: e.message })); }
    }
  }
}

module.exports = { walk, summarize };
