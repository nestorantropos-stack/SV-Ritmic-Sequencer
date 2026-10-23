'use strict';
// Validación de los datos: esquemas JSON (ajv) e integridad referencial entre archivos.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Ajv = require('ajv');
const { DATA, readJson, loadAll, flattenTaxonomy } = require('../tools/lib/data');
const core = require('../src/core');

const ajv = new Ajv({ allErrors: true, strict: false });
const schema = (name) => ajv.compile(readJson(path.join(DATA, 'schema', name)));
const fmt = (errs) => (errs || []).map((e) => `${e.instancePath} ${e.message}`).join('\n');

const D = loadAll();
const taxNodes = flattenTaxonomy(D.taxonomy);
const taxIds = new Set(taxNodes.map((n) => n.id));

test('taxonomy.json cumple su esquema', () => {
  const v = schema('taxonomy.schema.json');
  assert.ok(v(D.taxonomy), fmt(v.errors));
});

test('scales.json, drum_maps.json y microtiming.json cumplen su esquema', () => {
  for (const [file, sch] of [['scales', 'scales.schema.json'], ['drumMaps', 'drum_maps.schema.json'], ['microtiming', 'microtiming.schema.json']]) {
    const v = schema(sch);
    assert.ok(v(D[file]), `${file}: ${fmt(v.errors)}`);
  }
});

test('cada familia de patrones cumple el esquema', () => {
  const v = schema('pattern_family.schema.json');
  for (const fam of D.families) {
    const { file, ...data } = fam;
    assert.ok(v(data), `${file}: ${fmt(v.errors)}`);
  }
});

test('la taxonomía tiene los diez ejes del informe y del anexo de reggae', () => {
  assert.deepEqual(D.taxonomy.axes.map((a) => a.id), ['MET', 'ACE', 'SUP', 'MIC', 'CIC', 'PRO', 'FOR', 'COG', 'GRV', 'RGG']);
  const unique = new Set();
  for (const n of taxNodes) { assert.ok(!unique.has(n.id), `ID repetido ${n.id}`); unique.add(n.id); }
  // muestras de cobertura de cada eje
  for (const id of ['MET.2.5', 'MET.4.3', 'ACE.1.6', 'ACE.3.4', 'SUP.4.3', 'MIC.2.7', 'MIC.5.2', 'CIC.3.7', 'CIC.4.3.7', 'CIC.9',
    'PRO.19', 'FOR.2.4', 'COG.3.7', 'COG.4', 'GRV.14', 'RGG.1.3', 'RGG.3.4', 'RGG.8.4', 'RGG.9.4', 'RGG.10.7']) {
    assert.ok(taxIds.has(id), `falta ${id}`);
  }
  // todos los PRO.1..PRO.19 y GRV.1..GRV.14
  for (let i = 1; i <= 19; i++) assert.ok(taxIds.has(`PRO.${i}`), `falta PRO.${i}`);
  for (let i = 1; i <= 14; i++) assert.ok(taxIds.has(`GRV.${i}`), `falta GRV.${i}`);
});

test('IDs de patrón únicos y referencias de taxonomía válidas', () => {
  const ids = new Set();
  for (const p of D.patterns) {
    assert.ok(!ids.has(p.id), `ID repetido ${p.id}`);
    ids.add(p.id);
    const prefix = p.id.split('/')[0];
    assert.ok(taxIds.has(prefix), `${p.id}: prefijo ${prefix} no está en la taxonomía`);
    for (const t of p.taxonomy) assert.ok(taxIds.has(t), `${p.id}: taxonomía ${t} inexistente`);
  }
});

test('categorías, mapas de percusión y plantillas referenciadas existen', () => {
  const cats = new Set(D.taxonomy.destination_categories.map((c) => c.id));
  const maps = new Set(D.drumMaps.maps.map((m) => m.id));
  const tpl = new Set(D.microtiming.templates.map((t) => t.id));
  for (const p of D.patterns) {
    for (const c of p.categories) assert.ok(cats.has(c), `${p.id}: categoría ${c}`);
    if (p.params && p.params.drum_map) assert.ok(maps.has(p.params.drum_map), `${p.id}: mapa ${p.params.drum_map}`);
    for (const k of ['swing_template', 'microtiming_template']) if (p.params && p.params[k]) assert.ok(tpl.has(p.params[k]), `${p.id}: plantilla ${p.params[k]}`);
  }
  for (const d of D.taxonomy.destinations) if (d.drum_map) assert.ok(maps.has(d.drum_map), `destino ${d.id}`);
  for (const m of Object.values(D.drumMaps.destination_defaults)) assert.ok(maps.has(m));
  for (const t of D.families.flatMap((f) => f.transitions || [])) {
    assert.ok(D.patterns.some((p) => p.id === t.from) && D.patterns.some((p) => p.id === t.to), `transición ${t.from} → ${t.to}`);
  }
});

test('coherencia interna de cada patrón', () => {
  for (const p of D.patterns) {
    if (!p.generator) assert.ok(Number.isInteger(p.cycle_len), `${p.id}: sin cycle_len ni generador`);
    if (p.grouping && p.cycle_len) assert.equal(p.grouping.reduce((s, g) => s + g, 0), p.cycle_len, `${p.id}: grouping no suma cycle_len`);
    for (const l of p.layers) {
      const len = l.cycle_len || p.cycle_len;
      for (const o of l.onsets) assert.ok(o < len, `${p.id}/${l.role}: onset ${o} ≥ ${len}`);
      assert.equal(new Set(l.onsets).size, l.onsets.length, `${p.id}/${l.role}: onsets repetidos`);
      for (const k of ['velocity', 'timbre', 'microtiming', 'gate', 'probability']) {
        if (l[k]) assert.equal(l[k].length, l.onsets.length, `${p.id}/${l.role}: ${k} no coincide con onsets`);
      }
    }
    if (p.bpm_range) assert.ok(p.bpm_range[0] < p.bpm_range[1], `${p.id}: bpm_range`);
  }
});

test('honestidad del contenido: [V], datos faltantes y corpus', () => {
  for (const p of D.patterns) {
    if (p.status === 'V') assert.equal(p.verify, true, `${p.id}: estado V sin verify`);
    if (p.missing_data) assert.equal(p.verify, true, `${p.id}: datos faltantes sin verify`);
    if (p.status === 'C') assert.ok(p.origin.sources.some((s) => /corpus/i.test(s)) || (p.corpus || []).length, `${p.id}: [C] sin fuente de corpus`);
  }
  // los faltantes del §7 del informe quedan como entradas editables, no inventadas
  for (const id of ['CIC.4.3.5/wahda', 'CIC.4.3.7/samai_thaqil', 'CIC.6.3/maracatu', 'CIC.6.4/candombe', 'CIC.8/zamba', 'CIC.8/chacarera', 'CIC.5/ketawang', 'CIC.5/ladrang', 'GRV.11/breakbeat']) {
    const p = D.patterns.find((x) => x.id === id);
    assert.ok(p, `falta la entrada editable ${id}`);
    assert.equal(p.verify, true, `${id} debe estar marcada para verificar`);
  }
});

test('uso restringido: fuera de la lista pública y solo como principio estructural', () => {
  const restricted = D.patterns.filter(core.catalog.isRestricted);
  assert.ok(restricted.length >= 2, 'se esperan al menos kultrún y nyabinghi');
  for (const p of restricted) {
    assert.equal(p.structural_only, true, `${p.id}: debe ser structural_only`);
    assert.ok(p.cultural_note && p.cultural_note.length > 20, `${p.id}: falta nota de contexto cultural`);
  }
  const pub = core.catalog.publicPatterns(D.patterns);
  for (const p of restricted) assert.ok(!pub.includes(p), `${p.id} aparece en la lista pública`);
  assert.ok(core.catalog.search(D.patterns, { text: 'kultrun' }).length === 0, 'la búsqueda no debe devolver el kultrún');
  assert.equal(core.catalog.structuralPrinciples(D.patterns).length, restricted.length);
});

test('categorías nuevas por destino tienen contenido', () => {
  const s = (f) => core.catalog.search(D.patterns, f);
  assert.ok(s({ category: 'dub_techno', destination: 'chords' }).length >= 6, 'Chords › Dub Techno');
  assert.ok(s({ category: 'dub_reggae', destination: 'chords' }).length >= 4, 'Chords › Dub / Reggae');
  assert.ok(s({ category: 'dub_reggae', destination: 'hihats' }).length >= 8, 'Hi-hats › Dub / Reggae');
  assert.ok(s({ category: 'dub_reggae', destination: 'ethnic' }).length >= 6, 'Ethnic drums › Dub / Reggae');
  assert.ok(s({ category: 'latin_percussion', destination: 'ethnic' }).length >= 10, 'Ethnic drums › Latin percussion');
  assert.ok(s({ category: 'latin_percussion', destination: 'hihats' }).length >= 4, 'Hi-hats › Latin percussion');
  assert.ok(s({ text: 'clave' }).length >= 5, 'búsqueda por texto');
  assert.ok(s({ text: 'solea' }).some((p) => p.id === 'CIC.7/solea'), 'búsqueda sin tildes');
});

test('escalas: intervalos ordenados desde 0 y sin repetir', () => {
  const ids = new Set();
  for (const sc of D.scales.scales) {
    assert.ok(!ids.has(sc.id), `escala repetida ${sc.id}`); ids.add(sc.id);
    assert.equal(sc.intervals[0], 0, sc.id);
    for (let i = 1; i < sc.intervals.length; i++) assert.ok(sc.intervals[i] > sc.intervals[i - 1], `${sc.id} desordenada`);
    if (sc.cents) assert.equal(sc.cents.length, sc.intervals.length, `${sc.id}: cents`);
  }
  assert.ok(D.scales.scales.length >= 50);
});
