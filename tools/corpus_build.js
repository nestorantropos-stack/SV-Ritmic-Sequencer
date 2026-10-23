'use strict';
// Regenera las medidas derivadas del corpus en data/corpus/ a partir de tools/corpus_sources.json.
// Uso: node tools/corpus_build.js
const fs = require('fs');
const path = require('path');
const { walk } = require('./corpus_scan');
const rhythm = require('./corpus_rhythm');
const chords = require('./corpus_chords');

const src = require('./corpus_sources.json');
const out = path.join(__dirname, '..', 'data', 'corpus');
fs.mkdirSync(out, { recursive: true });

function rhythmSet(root, opts) {
  const seen = new Set();
  const res = [];
  for (const f of walk(root)) {
    const a = rhythm.analyzeFile(f, root, opts);
    if (seen.has(a.hash)) continue;
    seen.add(a.hash);
    res.push(a);
  }
  return res;
}

const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1) + '\n');

for (const sub of ['Chords', 'Bass', 'Bonus_Bass']) {
  const root = path.join(src.ddt, sub);
  const files = [...walk(root)].map((f) => chords.analyzeFile(f, root));
  write(`ddt_${sub.toLowerCase()}.json`, { source: `DDT_MIDI/${sub}`, aggregate: chords.aggregate(files), files });
}
write('dub_rhythm.json', { source: '1. Dub', files: rhythmSet(src.dub, { gm: false }) });
write('latin_rhythm.json', { source: 'Latin MIDI drums (GM)', files: rhythmSet(src.latin, { gm: true }) });
console.log('ok:', fs.readdirSync(out).join(', '));
