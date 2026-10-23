'use strict';
// Pruebas de propiedades de los generadores por destino (Fase 2).
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/core');
const { loadAll } = require('../tools/lib/data');

const D = loadAll();
const P = (id) => { const p = D.patterns.find((x) => x.id === id); assert.ok(p, `no existe ${id}`); return p; };
const gen = (id, opts = {}) => core.generate(P(id), { seed: 'test', ...opts }, D);
const MINOR_C = { root: 0, intervals: [0, 2, 3, 5, 7, 8, 10], id: 'minor' };
const SCALES = [
  { root: 9, intervals: [0, 2, 3, 5, 7, 8, 10] },
  { root: 0, intervals: [0, 2, 4, 5, 7, 9, 11] },
  { root: 2, intervals: [0, 3, 5, 7, 10] },
  { root: 7, intervals: [0, 1, 4, 5, 7, 8, 10] },
];
const MELODIC = new Set(['chords', 'bassline', 'arpeggio', 'others']);
const EPS = 1e-6;
const inLastCycle = (r, n) => n.start_time >= r.length_beats - r.plan.cycleBeats - EPS;

test('todas las combinaciones patrón × destino × escala dan clips válidos y en escala', () => {
  let count = 0;
  for (const p of core.catalog.publicPatterns(D.patterns)) for (const dest of p.destinations) for (const h of SCALES) for (const seed of [1, 'b']) {
    const r = core.generate(p, { destination: dest, seed, harmony: h, category: p.categories[0] }, D);
    count++;
    assert.ok(r.length_beats > 0, `${p.id}/${dest}: longitud`);
    for (const n of r.notes) {
      assert.ok(Number.isInteger(n.pitch) && n.pitch >= 0 && n.pitch <= 127, `${p.id}/${dest}: altura ${n.pitch}`);
      assert.ok(n.velocity >= 1 && n.velocity <= 127, `${p.id}/${dest}: velocity`);
      assert.ok(n.start_time >= 0 && n.start_time < r.length_beats, `${p.id}/${dest}: inicio ${n.start_time}`);
      assert.ok(n.duration > 0 && n.start_time + n.duration <= r.length_beats + EPS, `${p.id}/${dest}: duración`);
      assert.ok(n.probability >= 0 && n.probability <= 1);
    }
    if (MELODIC.has(dest)) assert.deepEqual(core.outOfScale(r, h), [], `${p.id}/${dest}: notas fuera de la escala`);
    const endByPitch = new Map();
    for (const n of r.notes) {
      const end = endByPitch.get(n.pitch);
      assert.ok(end === undefined || end <= n.start_time + EPS, `${p.id}/${dest}: notas de la misma altura solapadas (Live las recorta)`);
      endByPitch.set(n.pitch, n.start_time + n.duration);
    }
    if (!p.missing_data) assert.ok(r.notes.length > 0, `${p.id}/${dest}: sin notas`);
    else assert.ok(r.notes.length > 0 || r.meta.warnings.some((w) => /faltantes/.test(w)), `${p.id}: falta el aviso de datos faltantes`);
  }
  assert.ok(count > 2000, `combinaciones probadas: ${count}`);
});

test('determinismo por semilla', () => {
  for (const [id, dest] of [['RGG.10.2/stab_weighted', 'chords'], ['RGG.5.3/bass_roots_space', 'bassline'], ['GRV.9/trap', 'hihats'], ['CIC.3.4/son_clave_3_2', 'arpeggio']]) {
    const o = { destination: dest, harmony: MINOR_C, rollProb: 0.3, humanize: { sigmaMs: 5 }, category: P(id).categories[0] };
    assert.deepEqual(gen(id, { ...o, seed: 77 }), gen(id, { ...o, seed: 77 }), `${id}: misma semilla, mismo clip`);
  }
  const a = gen('RGG.10.2/stab_weighted', { destination: 'chords', harmony: MINOR_C, seed: 1 }).notes.map((n) => n.start_time);
  const b = gen('RGG.10.2/stab_weighted', { destination: 'chords', harmony: MINOR_C, seed: 2 }).notes.map((n) => n.start_time);
  assert.notDeepEqual(a, b, 'semillas distintas, ritmos distintos');
});

test('longitud del clip y repeticiones', () => {
  const clave = gen('CIC.3.4/son_clave_3_2', { destination: 'ethnic' });
  assert.equal(clave.plan.repeats, 4, 'groove corto: 4 repeticiones');
  assert.equal(clave.length_beats, 16);
  for (const n of [3, 4, 8, 16]) assert.equal(gen('CIC.3.4/son_clave_3_2', { destination: 'ethnic', repeats: n }).length_beats, 4 * n);
  const aksak = gen('MET.3.3/aksak_7_223', { destination: 'ethnic', repeats: 'full' });
  assert.equal(aksak.length_beats % 4, 0, '«ciclo completo» cierra con el compás de 4/4');
  assert.equal(aksak.length_beats, 28, 'mcm(3,5 ; 4) = 28 negras');
  const poly = gen('SUP.2.1/polymeter_16_12', { destination: 'ethnic' });
  assert.equal(poly.meta.cycle_len, 48, 'polimetría: el ciclo es el mcm de las capas');
  assert.equal(poly.length_beats, 12);
  const teental = gen('CIC.4.1/teental', { destination: 'ethnic' });
  assert.equal(teental.plan.repeats, 4, 'tala: 3 ciclos + tihai');
  assert.equal(teental.length_beats, 64);
  const gamelan = gen('CIC.5/lancaran', { destination: 'ethnic' });
  assert.equal(gamelan.length_beats, 2 * 8, 'dos gongan de 16 pulsos de corchea');
});

test('variación final en la última repetición', () => {
  const cmp = (r) => {
    const first = r.notes.filter((n) => n.start_time < r.plan.cycleBeats - EPS).map((n) => `${n.pitch}@${n.start_time.toFixed(3)}`);
    const last = r.notes.filter((n) => inLastCycle(r, n)).map((n) => `${n.pitch}@${(n.start_time - (r.length_beats - r.plan.cycleBeats)).toFixed(3)}`);
    return [first, last];
  };
  const fill = gen('GRV.1/four_on_the_floor', { destination: 'ethnic' });
  const [f1, f2] = cmp(fill);
  assert.notDeepEqual(f1, f2, 'fill en el último compás');
  assert.ok(fill.notes.some((n) => n.variation));
  const none = gen('GRV.1/four_on_the_floor', { destination: 'ethnic', variation: 'none' });
  const [n1, n2] = cmp(none);
  assert.deepEqual(n1, n2, 'sin variación, todos los ciclos iguales');
  // tihai: la llegada es el sam del inicio del bucle y el último ciclo contiene tres frases
  const tihai = gen('CIC.4.1/teental', { destination: 'ethnic' });
  assert.ok(tihai.notes.some((n) => n.start_time === 0), 'sam en el inicio del bucle');
  assert.ok(tihai.notes.filter((n) => n.variation).length >= 3);
  // gong: el último golpe de gong es el más fuerte
  const lan = gen('CIC.5/lancaran', { destination: 'ethnic' });
  const gongs = lan.notes.filter((n) => n.role === 'gong');
  assert.equal(gongs.length, 2);
  assert.equal(gongs[1].velocity, 127);
  // drop-out de dub: silencio en la segunda mitad del último ciclo
  const drop = gen('RGG.5.3/bass_roots_space', { destination: 'bassline', harmony: MINOR_C });
  const half = drop.length_beats - drop.plan.cycleBeats / 2;
  assert.ok(!drop.notes.some((n) => n.start_time >= half - EPS), 'drop-out');
  // llamada flamenca: el último compás remata en el 4.º acento (paso 9) y calla después
  const sol = gen('CIC.7/solea', { destination: 'ethnic' });
  const lastStart = sol.length_beats - sol.plan.cycleBeats;
  assert.ok(!sol.notes.some((n) => n.start_time > lastStart + 9 * 0.5 + EPS), 'silencio tras la llamada');
  // relleno de hat en tresillo del one drop
  const od = gen('RGG.3.1/one_drop', { destination: 'hihats' });
  const trip = od.notes.filter((n) => n.variation).map((n) => +(n.start_time % 1).toFixed(3));
  assert.deepEqual(trip, [0, 0.333, 0.667]);
});

test('Chords › Dub Techno: tríada fija del grado I, registro del corpus, stab corto', () => {
  for (const id of ['RGG.10.2/stab_weighted', 'RGG.10.2/stab_1_7_15', 'RGG.10.2/stab_1_11', 'RGG.10.2/dub_techno_base']) {
    const r = gen(id, { destination: 'chords', harmony: MINOR_C, category: 'dub_techno', microtiming: 'swing_16_62' });
    const pitches = [...new Set(r.notes.map((n) => n.pitch))].sort((a, b) => a - b);
    assert.equal(pitches.length, 3, `${id}: acorde fijo`);
    assert.deepEqual(pitches.map((p) => p - pitches[0]), [0, 3, 7], `${id}: tríada menor en estado fundamental`);
    assert.equal(pitches[0] % 12, 0, `${id}: sobre la tónica`);
    assert.ok(pitches[0] >= 55 && pitches[0] <= 67, `${id}: raíz en el registro del corpus (${pitches[0]})`);
    const byTime = new Map();
    for (const n of r.notes) byTime.set(n.start_time, (byTime.get(n.start_time) || 0) + 1);
    for (const c of byTime.values()) assert.equal(c, 3, `${id}: cada stab es una tríada`);
    for (const n of r.notes) assert.ok(n.duration <= 1, `${id}: stab corto`);
  }
  const ws = gen('RGG.10.2/stab_weighted', { destination: 'chords', harmony: MINOR_C, category: 'dub_techno', seed: 5 });
  const perBar = ws.notes.length / 3 / ws.plan.bars;
  assert.ok(perBar >= 2 && perBar <= 5, `2–5 stabs por compás (${perBar})`);
  // swing de 62 %: una semicorchea impar se retrasa un cuarto de paso (0,0625 negras)
  const sw = core.generate({ ...P('RGG.10.2/stab_1_6_11') }, { destination: 'chords', harmony: MINOR_C, category: 'dub_techno', microtiming: 'swing_16_62', seed: 1 }, D);
  assert.ok(sw.notes.some((n) => Math.abs(n.start_time - 1.3125) < EPS), 'paso 5 con swing → 1,3125');
  // en modo mayor da la tríada mayor del grado I
  const maj = gen('RGG.10.2/stab_1_11', { destination: 'chords', harmony: { root: 7, intervals: [0, 2, 4, 5, 7, 9, 11] }, category: 'dub_techno' });
  const mp = [...new Set(maj.notes.map((n) => n.pitch))].sort((a, b) => a - b);
  assert.deepEqual(mp.map((p) => p - mp[0]), [0, 4, 7]);
  // opciones: séptima, colchón y eco
  const rich = gen('RGG.10.2/stab_1_11', { destination: 'chords', harmony: MINOR_C, category: 'dub_techno', chordSize: 4, pad: true, echo: { repeats: 2, feedback: 0.5 } });
  assert.ok(rich.notes.some((n) => n.role === 'pad' && n.duration > 3), 'colchón largo');
  assert.ok(rich.notes.some((n) => n.role === 'echo'), 'notas de eco a corchea con puntillo');
  assert.equal(new Set(rich.notes.filter((n) => n.role === 'chord').map((n) => n.pitch)).size, 4, 'cuatríada');
});

test('Chords: progresión, ritmo armónico, anticipación y polifonía', () => {
  const r = gen('RGG.6.2/chop_2_4', { destination: 'chords', harmony: MINOR_C, category: 'dub_reggae' });
  const deg = [...new Set(r.notes.map((n) => n.degree))];
  assert.deepEqual(deg, [0, 3], 'i–iv en dub / reggae');
  const prog = gen('CIC.3.4/son_clave_3_2', { destination: 'chords', harmony: MINOR_C, progression: [0, 5, 3, 4], harmonicRhythmBars: 1, repeats: 4 });
  assert.deepEqual([...new Set(prog.notes.map((n) => n.degree))], [0, 5, 3, 4]);
  const ant = gen('GRV.8/skank', { destination: 'chords', harmony: MINOR_C, progression: [0, 4], harmonicRhythmBars: 1, anticipation: true, anticipationBeats: 0.5 });
  const lastStab = ant.notes.filter((n) => n.start_time >= 3.5 - EPS && n.start_time < 4);
  assert.ok(lastStab.every((n) => n.degree === 4), 'la última corchea anticipa el acorde siguiente');
  for (const x of [r, prog, ant]) {
    const byTime = new Map();
    for (const n of x.notes) byTime.set(n.start_time, (byTime.get(n.start_time) || 0) + 1);
    for (const c of byTime.values()) assert.ok(c <= 6, 'polifonía máxima 6');
  }
});

test('Bassline: monofónico, registro grave y estilos', () => {
  const mono = (r) => { const s = r.notes; for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].start_time + s[i - 1].duration <= s[i].start_time + EPS, 'sin solapes'); };
  const roots = gen('RGG.5.3/bass_roots_space', { destination: 'bassline', harmony: MINOR_C, progression: [0] });
  mono(roots);
  for (const n of roots.notes) assert.ok(n.pitch >= 26 && n.pitch <= 60);
  const strong = roots.notes.filter((n) => n.step === 0);
  assert.ok(strong.every((n) => n.pitch % 12 === 0), 'raíz en el pulso 1');
  const mor = gen('GRV.13/moroder_bass', { destination: 'bassline', harmony: MINOR_C, bassStyle: 'moroder' });
  mono(mor);
  assert.equal(mor.notes.length, mor.length_beats * 4, 'semicorcheas continuas');
  assert.equal(mor.notes[1].pitch - mor.notes[0].pitch, 12, 'alternancia raíz / octava');
  const tum = gen('CIC.3.4/son_clave_3_2', { destination: 'bassline', harmony: MINOR_C, bassStyle: 'tumbao', progression: [0, 4], harmonicRhythmBars: 1 });
  assert.deepEqual(tum.notes.slice(0, 2).map((n) => n.start_time), [1.5, 3]);
  assert.equal(tum.notes[1].degree, 4, 'el pulso 4 anticipa el acorde del compás siguiente');
  const od = gen('RGG.5.3/bass_roots_space', { destination: 'bassline', harmony: MINOR_C, bassStyle: 'one_drop' });
  assert.ok(!od.notes.some((n) => Math.abs(n.start_time % 4) < EPS), 'one drop: pulso 1 vacío');
  const ext = gen('CIC.3.4/son_clave_3_2', { destination: 'bassline', harmony: MINOR_C, bassSource: 'external', kickTimes: [0, 1, 2, 3, 4.5] });
  assert.deepEqual(ext.notes.map((n) => n.start_time).slice(0, 5), [0, 1, 2, 3, 4.5], 'sigue el bombo de otra pista');
});

test('Arpeggio: ciclo polimétrico de 3 (hemiola), direcciones y entrelazado', () => {
  const r = gen('GRV.1/four_on_the_floor', { destination: 'arpeggio', harmony: MINOR_C, stream: true, rate: 0.25, arpCycle: 3, octaves: 1 });
  const ps = r.notes.slice(0, 12).map((n) => n.pitch);
  for (let i = 3; i < 12; i++) assert.equal(ps[i], ps[i - 3], 'periodo de 3 notas sobre semicorcheas');
  assert.equal(r.notes.length, r.length_beats * 4);
  const down = gen('CIC.3.4/son_clave_3_2', { destination: 'arpeggio', harmony: MINOR_C, direction: 'down', octaves: 1 });
  assert.ok(down.notes[0].pitch > down.notes[1].pitch);
  const il = gen('CIC.3.4/son_clave_3_2', { destination: 'arpeggio', harmony: MINOR_C, interleave: true });
  assert.deepEqual(il.notes.slice(0, 4).map((n) => n.role), ['arp_a', 'arp_b', 'arp_a', 'arp_b']);
});

test('Hi-hats: capas, corte del abierto, redobles, patrón sin hats', () => {
  const r = gen('RGG.4.3/flying_cymbal', { destination: 'hihats' });
  const pitches = new Set(r.notes.map((n) => n.pitch));
  assert.ok(pitches.has(42) && pitches.has(46), 'cerrado y abierto (GM)');
  for (const n of r.notes.filter((x) => x.role === 'hat_open')) {
    const next = r.notes.find((m) => m.role === 'hat' && m.start_time > n.start_time);
    if (next) assert.ok(n.start_time + n.duration <= next.start_time, 'el abierto se corta en el cerrado');
  }
  const plain = gen('GRV.9/trap', { destination: 'hihats', variation: 'none' });
  const rolled = gen('GRV.9/trap', { destination: 'hihats', variation: 'none', rollProb: 0.5 });
  assert.ok(rolled.notes.length > plain.notes.length, 'redobles de trap');
  const clave = gen('CIC.3.4/son_clave_3_2', { destination: 'hihats' });
  assert.ok(clave.notes.every((n) => n.pitch === 42), 'timeline tocado con hat cerrado');
  const off = gen('RGG.4.1/hat_8ths', { destination: 'hihats', openOffbeat: true, variation: 'none' });
  assert.ok(off.notes.filter((n) => n.pitch === 46).length === off.length_beats, 'abierto en cada contratiempo');
  const pedal = gen('RGG.4.2/hat_offbeat', { destination: 'hihats', pedal: true });
  assert.ok(pedal.notes.some((n) => n.pitch === 44));
});

test('Ethnic drums: mapas por tradición', () => {
  const maq = gen('CIC.4.3.1/maqsum', { destination: 'ethnic', variation: 'none' });
  assert.deepEqual(maq.notes.slice(0, 5).map((n) => n.pitch), [36, 38, 38, 36, 38], 'dum / tak');
  const lan = gen('CIC.5/lancaran', { destination: 'ethnic' });
  assert.ok(lan.notes.filter((n) => n.role === 'gong').every((n) => n.pitch === 36 && Math.abs((n.start_time % 8) - 7.5) < EPS), 'gong al final del gongan');
  const lat = gen('CIC.6/congas_three_strokes', { destination: 'ethnic' });
  assert.ok(lat.notes.some((n) => n.pitch === 63) && lat.notes.some((n) => n.pitch === 62) && lat.notes.some((n) => n.pitch === 64), 'congas GM');
  const dub = gen('RGG.3.3/steppers', { destination: 'ethnic' });
  assert.deepEqual([...new Set(dub.notes.map((n) => n.pitch))].sort((a, b) => a - b), [36, 37, 42], 'dub kit: bombo, aro, hat');
  const custom = gen('RGG.3.3/steppers', { destination: 'ethnic', drumMap: 'drum_rack_default' });
  assert.ok(custom.notes.every((n) => [36, 37, 42].includes(n.pitch)));
  const tala = gen('CIC.4.1/teental', { destination: 'ethnic', variation: 'none' });
  const dup = new Set();
  for (const n of tala.notes) { const k = `${n.pitch}@${n.start_time}`; assert.ok(!dup.has(k), 'sin notas duplicadas'); dup.add(k); }
});

test('Others: notas libres por capa y textura', () => {
  const r = gen('GRV.2/backbeat', { destination: 'others', notes: [48, 55, 60] });
  assert.deepEqual([...new Set(r.notes.map((n) => n.pitch))].sort((a, b) => a - b), [48, 55, 60]);
  const w = gen('GRV.2/backbeat', { destination: 'others', harmony: MINOR_C, texture: 'walk' });
  assert.deepEqual(core.outOfScale(w, MINOR_C), []);
});

test('uso restringido: solo como principio estructural, con nota cultural', () => {
  assert.throws(() => gen('CIC.9/kultrun_principio', { destination: 'ethnic' }), /restringido/);
  const r = gen('CIC.9/kultrun_principio', { destination: 'ethnic', allowStructural: true });
  assert.ok(r.notes.length > 0);
  assert.match(r.meta.cultural_note, /machi/);
});

test('bloqueo por capa, microtiempo con envoltura y rejilla deformable', () => {
  const first = gen('RGG.3.3/steppers', { destination: 'ethnic', seed: 1 });
  const second = gen('RGG.3.3/steppers', { destination: 'ethnic', seed: 2, humanize: { sigmaMs: 8 }, lock: { roles: ['kick'], previous: first } });
  const k1 = first.notes.filter((n) => n.role === 'kick');
  const k2 = second.notes.filter((n) => n.role === 'kick');
  assert.deepEqual(k2, k1, 'el bombo bloqueado no cambia');
  assert.notDeepEqual(second.notes.filter((n) => n.role === 'hat'), first.notes.filter((n) => n.role === 'hat'));
  // push: el ataque del paso 0 se adelanta y pasa al final del bucle
  const push = gen('GRV.7/steppers', { destination: 'ethnic', microtiming: 'push', variation: 'none' });
  assert.ok(push.notes.some((n) => Math.abs(n.start_time - (push.length_beats - 0.015)) < 1e-3), 'envoltura del anticipo');
  assert.ok(!push.notes.some((n) => n.start_time === 0));
  // telespringar sobre un patrón sintético de 3/4
  const tele = {
    id: 'MET.2.2/test', name: 'test', taxonomy: ['MET.2.2'], origin: { tradition: 'prueba', sources: ['test'] }, status: 'H', verify: false,
    cycle_len: 3, step_value: 1, meter: '3/4', layers: [{ role: 'beat', onsets: [0, 1, 2] }], transforms_allowed: [], destinations: ['others'], categories: ['procedures'],
    repeat_policy: { mode: 'fixed', default_repeats: 2, variation_on_last: 'none' },
  };
  const t = core.generate(tele, { destination: 'others', microtiming: 'telespringar', harmony: MINOR_C }, D);
  assert.deepEqual(t.notes.map((n) => +n.start_time.toFixed(3)), [0, 1.14, 2.16, 3, 4.14, 5.16]);
  // swing de capa del one drop (corcheas a 1,5): el contratiempo se retrasa 0,1 negra
  const od = gen('RGG.3.1/one_drop', { destination: 'hihats', variation: 'none' });
  assert.ok(od.notes.some((n) => Math.abs(n.start_time - 0.6) < EPS));
});

test('transformaciones permitidas y síncopa objetivo desde generate', () => {
  const base = gen('CIC.3.4/son_clave_3_2', { destination: 'ethnic', variation: 'none' });
  const rot = gen('CIC.3.4/son_clave_3_2', { destination: 'ethnic', variation: 'none', transform: { rotate: 8 } });
  assert.deepEqual(rot.notes.filter((n) => n.start_time < 4).map((n) => n.start_time), [0.5, 1, 2, 2.75, 3.5], 'rotación a 2-3');
  const notAllowed = gen('CIC.3.4/son_clave_3_2', { destination: 'ethnic', transform: { complement: true } });
  assert.ok(notAllowed.meta.warnings.some((w) => /no está permitida/.test(w)));
  const bin = gen('CIC.2.1/standard_pattern', { destination: 'ethnic', variation: 'none', transform: { binarize: true } });
  assert.equal(bin.meta.cycle_len, 16);
  assert.ok(bin.meta.warnings.some((w) => /Pérez Fernández/.test(w)));
  const syn = gen('GRV.1/four_on_the_floor', { destination: 'ethnic', mainRole: 'hat_open', syncopation: 0.8, variation: 'none' });
  assert.ok(syn.notes.length === base.notes.length || syn.notes.length > 0);
  const v1 = core.vary(P('RGG.10.2/stab_weighted'), { destination: 'chords', harmony: MINOR_C, seed: 3, variationIndex: 1 }, D);
  const v2 = core.vary(P('RGG.10.2/stab_weighted'), { destination: 'chords', harmony: MINOR_C, seed: 3, variationIndex: 1 }, D);
  assert.deepEqual(v1, v2, 'variar también es reproducible');
});
