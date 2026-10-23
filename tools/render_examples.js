'use strict';
// Genera ejemplos de salida de la Fase 2: un .mid por caso en build/examples/ y una página con las rejillas
// en docs/ejemplos_generadores.md. Uso: node tools/render_examples.js
const fs = require('fs');
const path = require('path');
const core = require('../src/core');
const { loadAll } = require('./lib/data');
const { writeSMF } = require('./lib/smf_write');
const { parseSMF } = require('./lib/smf');

const D = loadAll();
const OUT = path.join(__dirname, '..', 'build', 'examples');
fs.mkdirSync(OUT, { recursive: true });

const sc = (id, root) => {
  const s = D.scales.scales.find((x) => x.id === id);
  return { id, root, intervals: s.intervals };
};
const ROOT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9 };

const CASES = [
  { file: '01_chords_dubtechno_generativo_Cm_120', id: 'RGG.10.2/stab_weighted', bpm: 120, o: { destination: 'chords', category: 'dub_techno', harmony: sc('minor', ROOT.C), microtiming: 'swing_16_62', seed: 'sidera' } },
  { file: '02_chords_dubtechno_stab_1-7-15_Am_eco_120', id: 'RGG.10.2/stab_1_7_15', bpm: 120, o: { destination: 'chords', category: 'dub_techno', harmony: sc('minor', ROOT.A), echo: { repeats: 2, feedback: 0.5 }, seed: 'sidera' } },
  { file: '03_chords_dubtechno_m7_colchon_Fm_118', id: 'RGG.10.2/stab_1_11', bpm: 118, o: { destination: 'chords', category: 'dub_techno', harmony: sc('minor', ROOT.F), chordSize: 4, pad: true, seed: 'sidera' } },
  { file: '04_chords_dub_chop_2-4_Gm_75', id: 'RGG.6.2/chop_2_4', bpm: 75, o: { destination: 'chords', category: 'dub_reggae', harmony: sc('minor', ROOT.G), seed: 1 } },
  { file: '05_chords_dub_bubble_Dm_72', id: 'RGG.6.3/bubble', bpm: 72, o: { destination: 'chords', category: 'dub_reggae', harmony: sc('dorian', ROOT.D), seed: 1 } },
  { file: '06_bass_dubtechno_swing16_Cm_120', id: 'RGG.10.2/bass_swung_16', bpm: 120, o: { destination: 'bassline', category: 'dub_techno', harmony: sc('minor', ROOT.C), seed: 'sidera' } },
  { file: '07_bass_roots_espacio_Gm_76', id: 'RGG.5.3/bass_roots_space', bpm: 76, o: { destination: 'bassline', category: 'dub_reggae', harmony: sc('minor', ROOT.G), seed: 2 } },
  { file: '08_bass_tumbao_clave_Am_96', id: 'CIC.3.4/son_clave_3_2', bpm: 96, o: { destination: 'bassline', harmony: sc('minor', ROOT.A), bassStyle: 'tumbao', progression: [0, 3, 4, 0], harmonicRhythmBars: 1, seed: 1 } },
  { file: '09_arp_hemiola_3-2_Em_124', id: 'GRV.1/four_on_the_floor', bpm: 124, o: { destination: 'arpeggio', harmony: sc('minor_pentatonic', ROOT.E), stream: true, rate: 0.25, arpCycle: 3, octaves: 2, seed: 1 } },
  { file: '10_hats_onedrop_relleno_tresillo_75', id: 'RGG.3.1/one_drop', bpm: 75, o: { destination: 'hihats', seed: 1 } },
  { file: '11_hats_trap_redobles_140', id: 'GRV.9/trap', bpm: 140, o: { destination: 'hihats', rollProb: 0.25, seed: 4 } },
  { file: '12_hats_dubtechno_contratiempo_pedal_122', id: 'RGG.4.2/hat_offbeat', bpm: 122, o: { destination: 'hihats', pedal: true, humanize: { sigmaMs: 4, drift: 0.7 }, seed: 1 } },
  { file: '13_drums_steppers_dubkit_132', id: 'RGG.3.3/steppers', bpm: 132, o: { destination: 'ethnic', seed: 1 } },
  { file: '14_drums_maqsum_dum-tak_100', id: 'CIC.4.3.1/maqsum', bpm: 100, o: { destination: 'ethnic', seed: 1 } },
  { file: '15_drums_lancaran_gongan_90', id: 'CIC.5/lancaran', bpm: 90, o: { destination: 'ethnic', seed: 1 } },
  { file: '16_drums_bossa_crossstick_GM_140', id: 'CIC.3.6/bossa_cross_stick_32', bpm: 140, o: { destination: 'ethnic', seed: 1 } },
  { file: '17_drums_teental_tihai_90', id: 'CIC.4.1/teental', bpm: 90, o: { destination: 'ethnic', seed: 1 } },
  { file: '18_drums_solea_llamada_110', id: 'CIC.7/solea', bpm: 110, o: { destination: 'ethnic', seed: 1 } },
];

// Rejilla de texto de los dos primeros compases (16 semicorcheas por compás) por altura.
function grid(r, bars = 2) {
  const rows = new Map();
  const steps = bars * 16;
  for (const n of r.notes) {
    const s = Math.round(n.start_time * 4);
    if (s >= steps) continue;
    if (!rows.has(n.pitch)) rows.set(n.pitch, new Array(steps).fill('.'));
    rows.get(n.pitch)[s] = n.velocity >= 105 ? 'X' : 'x';
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0])
    .map(([p, g]) => `${core.harmony.noteName(p).padEnd(4)} ${g.join('').match(/.{4}/g).join('|')}`).join('\n');
}

const md = ['# Ejemplos de salida de los generadores (Fase 2)', '',
  'Generados con `node tools/render_examples.js`. Los `.mid` están en `build/examples/` (arrástralos a una pista de Live para escucharlos). Nombres de nota con la convención de Live (C3 = 60). Rejilla: dos primeros compases, `x` ataque, `X` acento (velocity ≥ 105).', ''];
for (const c of CASES) {
  const p = D.patterns.find((x) => x.id === c.id);
  const r = core.generate(p, c.o, D);
  const buf = writeSMF(r.notes, { bpm: c.bpm, name: c.file });
  fs.writeFileSync(path.join(OUT, c.file + '.mid'), buf);
  const back = parseSMF(buf); // comprobación de ida y vuelta
  if (back.notes.length !== r.notes.length) throw new Error(`${c.file}: ${back.notes.length} ≠ ${r.notes.length} notas tras releer`);
  md.push(`## ${c.file}`, '',
    `- Patrón: \`${p.id}\` · ${p.name} · ${p.origin.tradition} · estatus \`[${p.status}]\`${p.verify ? ' · **verificar**' : ''}`,
    `- Destino: ${c.o.destination}${c.o.category ? ` › ${c.o.category}` : ''} · ${c.bpm} BPM · semilla \`${c.o.seed}\`${c.o.harmony ? ` · ${core.harmony.PC[c.o.harmony.root]} ${c.o.harmony.id}` : ''}`,
    `- Clip: ${r.length_beats} negras (${r.plan.bars} compases), ${r.plan.repeats} repeticiones de ${r.plan.cycleBeats} negras, variación final: ${r.plan.variation} · ${r.notes.length} notas`,
    ...(r.meta.warnings.length ? [`- Avisos: ${r.meta.warnings.join(' ')}`] : []),
    '', '```', grid(r), '```', '');
}
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'ejemplos_generadores.md'), md.join('\n'));
console.log(`ok: ${CASES.length} ejemplos en ${OUT}`);
