'use strict';
// Carga de los datos en Node (pruebas y herramientas). En Max los datos van incrustados en el bundle.
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function loadAll() {
  const patternFiles = fs.readdirSync(path.join(DATA, 'patterns')).filter((f) => f.endsWith('.json')).sort();
  const families = patternFiles.map((f) => ({ file: f, ...readJson(path.join(DATA, 'patterns', f)) }));
  return {
    taxonomy: readJson(path.join(DATA, 'taxonomy.json')),
    scales: readJson(path.join(DATA, 'scales.json')),
    drumMaps: readJson(path.join(DATA, 'drum_maps.json')),
    microtiming: readJson(path.join(DATA, 'microtiming.json')),
    families,
    patterns: families.flatMap((fam) => fam.patterns.map((p) => ({ ...p, family: fam.family }))),
  };
}

// Todos los nodos de la taxonomía en una lista plana.
function flattenTaxonomy(tax) {
  const out = [];
  const walk = (node, axis, parent) => {
    out.push({ ...node, axis, parent });
    for (const c of node.children || []) walk(c, axis, node.id);
  };
  for (const ax of tax.axes) {
    out.push({ id: ax.id, name: ax.name, axis: ax.id, parent: null, isAxis: true });
    for (const c of ax.children) walk(c, ax.id, ax.id);
  }
  return out;
}

module.exports = { DATA, readJson, loadAll, flattenTaxonomy };
