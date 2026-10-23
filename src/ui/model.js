'use strict';
// Modelo de la interfaz: recibe los mensajes del motor («state», «harmony», «preview», «result», «analysis»,
// «error», «status») y deriva lo que necesitan las vistas. Las listas de los menús (destinos, modos, escalas,
// ritmos, repeticiones) salen de los mismos datos que los parámetros live.* del dispositivo.

const MODES = ['manual', 'live', 'adaptive', 'random'];
const REPEATS = ['auto', 3, 4, 8, 16, 'full'];

function create(SV) {
  const { data, core } = SV;
  return {
    SV,
    lists: {
      destinations: data.taxonomy.destinations.map((d) => d.id),
      modes: MODES,
      scales: data.scales.scales.map((s) => s.id),
      patterns: core.catalog.publicPatterns(data.patterns).map((p) => p.id),
      repeats: REPEATS,
    },
    state: { destination: 'chords', harmonyMode: 'manual', root: 0, scaleId: 'minor', patternId: 'RGG.10.2/stab_weighted', repeats: 'auto', seed: 1, locks: [] },
    harmony: null,
    preview: null,
    result: null,
    analysis: null,
    status: '',
    error: null,
    auditioning: false,
    hover: null,
    suggestions: null,
    showSuggest: false,
    history: [],
    presets: [],
    exported: null,
    panel: { axis: null, node: null, scroll: 0, treeScroll: 0, selected: null, text: '', onlyDest: true, verifiedOnly: false, tab: 'layers' },
    cache: {},
  };
}

function receive(model, type, payload) {
  let v = payload;
  if (typeof payload === 'string' && /^[[{]/.test(payload.trim())) { try { v = JSON.parse(payload); } catch (e) { v = payload; } }
  switch (type) {
    case 'state': model.state = { ...model.state, ...v }; break;
    case 'harmony': model.harmony = v; break;
    case 'preview': model.preview = v; break;
    case 'result': model.result = v; model.error = null; break;
    case 'analysis': model.analysis = v; break;
    case 'error': model.error = v && v.message ? v.message : String(v); break;
    case 'status': model.status = String(v); break;
    case 'audition': model.auditioning = !!Number(v); break;
    case 'search': model.panel.text = String(v || ''); model.panel.scroll = 0; break;
    case 'suggestions': model.suggestions = v; model.showSuggest = true; break;
    case 'history': model.history = Array.isArray(v) ? v : []; break;
    case 'presets': model.presets = Array.isArray(v) ? v : []; break;
    case 'exported': model.exported = v; break;
    default: return false;
  }
  return true;
}

const patternOf = (model, id) => model.SV.data.patterns.find((p) => p.id === (id || model.state.patternId)) || null;

// Patrón normalizado para dibujar su ciclo (con caché por id y semilla).
function normalized(model, id) {
  const p = patternOf(model, id);
  if (!p) return null;
  const key = `${p.id}@${model.state.seed}`;
  if (!model.cache[key]) {
    try { model.cache[key] = model.SV.core.normalizePattern(p, { rng: model.SV.core.createRng(`ui:${key}`) }); } catch (e) { model.cache[key] = null; }
  }
  return model.cache[key];
}

// Armonía mostrada: la que resolvió el motor, o la manual del estado mientras no llegue.
function harmonyOf(model) {
  if (model.harmony && Array.isArray(model.harmony.intervals)) return model.harmony;
  const sc = model.SV.data.scales.scales.find((s) => s.id === model.state.scaleId) || model.SV.data.scales.scales[0];
  return { root: model.state.root, intervals: sc.intervals, id: sc.id, name: sc.name, mode: model.state.harmonyMode };
}

// Ritmos navegables con las flechas de la franja: los públicos aptos para el destino actual.
function browseList(model) {
  return model.SV.core.catalog.search(model.SV.data.patterns, { destination: model.state.destination });
}

function patternIndex(model, id) { return model.lists.patterns.indexOf(id); }

// Lista del panel según filtros (texto, nodo de taxonomía, destino, solo verificados).
function panelList(model) {
  const f = model.panel;
  return model.SV.core.catalog.search(model.SV.data.patterns, {
    text: f.text, taxonomy: f.node || f.axis || undefined,
    destination: f.onlyDest ? model.state.destination : undefined, verifiedOnly: f.verifiedOnly,
  });
}

module.exports = { create, receive, patternOf, normalized, harmonyOf, browseList, patternIndex, panelList, MODES, REPEATS };
