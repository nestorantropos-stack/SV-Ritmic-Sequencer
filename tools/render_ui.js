'use strict';
// Maquetas SVG de la interfaz con el mismo código de dibujo que usa el v8ui en Max.
// Uso: node tools/render_ui.js  → docs/ui/*.svg
const fs = require('fs');
const path = require('path');
const core = require('../src/core');
const { loadAll } = require('./lib/data');
const { svgCanvas } = require('../src/ui/canvas');
const M = require('../src/ui/model');
const strip = require('../src/ui/strip');
const OUT = path.join(__dirname, '..', 'docs', 'ui');
fs.mkdirSync(OUT, { recursive: true });

const D = loadAll();
const SV = { core, data: D };

function previewFor(m) {
  const p = D.patterns.find((x) => x.id === m.state.patternId);
  const h = M.harmonyOf(m);
  const r = core.generate(p, { destination: m.state.destination, category: p.categories[0], harmony: h, seed: m.state.seed, repeats: m.state.repeats, microtiming: 'swing_16_62' }, D);
  return { length_beats: r.length_beats, plan: r.plan, meta: r.meta, notes: r.notes.map((n) => [n.pitch, n.start_time, n.duration, n.velocity, n.role]) };
}

const scenes = {
  strip_dubtechno: (m) => { m.state = { ...m.state, destination: 'chords', patternId: 'RGG.10.2/stab_weighted', root: 0, scaleId: 'minor', harmonyMode: 'manual' }; },
  strip_adaptable_bajo: (m) => {
    m.state = { ...m.state, destination: 'bassline', patternId: 'RGG.10.2/bass_offbeat', harmonyMode: 'adaptive' };
    m.harmony = { root: 2, intervals: [0, 2, 3, 5, 7, 8, 10], id: 'minor', name: 'Menor natural (eólico)', mode: 'adaptive' };
    m.analysis = { key: { name: 'D menor', confidence: 0.94 } };
  },
  strip_sugerencias: (m) => {
    m.state = { ...m.state, destination: 'chords', patternId: 'RGG.10.2/stab_weighted' };
    m.suggestions = { suggestions: core.suggest.suggest(D.patterns, { tempo: 124, timeSignature: '4/4', names: ['5-Chord Dub Pluck', '6-5P_DDT_Bass_Korg1'], analysis: { occupancy: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], density: 0.25 } }, { destination: 'chords' }) };
    m.showSuggest = true;
  },
  strip_teental: (m) => { m.state = { ...m.state, destination: 'ethnic', patternId: 'CIC.4.1/teental', root: 2, scaleId: 'raga_kafi', harmonyMode: 'random' }; m.harmony = null; m.hover = { help: 'CIC.4.1 · Tala indostánica: ciclos con vibhag, tali (palmada) y khali (vacío); tihai que aterriza en sam.' }; },
};

for (const [name, setup] of Object.entries(scenes)) {
  const m = M.create(SV);
  setup(m);
  m.preview = previewFor(m);
  const g = svgCanvas(strip.SIZE.width, strip.SIZE.height);
  const hits = strip.draw(g, m);
  fs.writeFileSync(path.join(OUT, `${name}.svg`), g.toString());
  console.log(`${name}.svg · ${g.elements()} elementos · ${hits.length} zonas de clic`);
}

// panel ampliado
{
  const panel = require('../src/ui/panel');
  const m = M.create(SV);
  m.state = { ...m.state, destination: 'chords', patternId: 'RGG.10.2/stab_weighted', options: { microtiming: 'swing_16_62' }, locks: ['chord'] };
  m.panel.axis = 'RGG'; m.panel.node = 'RGG.10.2';
  m.panel.selected = 'RGG.10.2/stab_1_7_15';
  m.preview = previewFor(m);
  const g = svgCanvas(panel.SIZE.width, panel.SIZE.height);
  const hits = panel.draw(g, m);
  fs.writeFileSync(path.join(OUT, 'panel.svg'), g.toString());
  console.log(`panel.svg · ${g.elements()} elementos · ${hits.length} zonas de clic`);
}

// índice con los SVG incrustados (se abre como página suelta)
const svgs = fs.readdirSync(OUT).filter((f) => f.endsWith('.svg')).sort();
const html = ['<!doctype html><html lang="es"><head><meta charset="utf-8"><title>SV Ritmic Sequencer · maquetas</title>',
  '<style>body{background:#0d0e11;color:#9aa;font-family:Segoe UI,Arial;margin:16px}h2{font-size:12px;font-weight:600;margin:14px 0 6px}svg{display:block;max-width:100%;height:auto}</style></head><body>'];
for (const f of svgs) html.push(`<h2>${f.replace('.svg', '')}</h2>`, fs.readFileSync(path.join(OUT, f), 'utf8'));
html.push('</body></html>');
fs.writeFileSync(path.join(OUT, 'index.html'), html.join('\n'));
