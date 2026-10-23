'use strict';
// Controlador del dispositivo: guarda el estado de los cuatro pasos (Destino · Armonía · Ritmo · Generar),
// resuelve la armonía (manual, Live 12, Adaptable, Random), llama al núcleo y escribe con el puente.
// Sin dependencias de Max: el script v8 solo traduce mensajes a estos métodos.

const DEFAULT_PATTERN = {
  chords: 'RGG.10.2/stab_weighted', bassline: 'RGG.10.2/bass_offbeat', arpeggio: 'CIC.3.4/son_clave_3_2',
  hihats: 'RGG.4.2/hat_offbeat', ethnic: 'RGG.3.3/steppers', others: 'PRO.1/e_5_16',
};
const HISTORY_MAX = 32;

// Fracción de ataques de la capa principal que caen en un pulso (negra).
function onBeatShare(p) {
  if (!p || !p.layers || !p.layers.length) return 1;
  const layer = p.layers.find((l) => ['bass', 'kick'].includes(l.role)) || p.layers[0];
  if (!layer.onsets.length) return 1;
  return layer.onsets.filter((o) => Math.abs((o * p.step_value) % 1) < 1e-9).length / layer.onsets.length;
}

// Almacén de preajustes en memoria (en Max se inyecta uno sobre un [dict ---sv_rs_presets @embed 1]).
function memoryStore() { let items = []; return { load: () => items.slice(), save: (arr) => { items = arr.slice(); } }; }

// Campos del estado que guarda un preajuste propio.
const PRESET_FIELDS = ['destination', 'harmonyMode', 'root', 'scaleId', 'randomSeed', 'patternId', 'category', 'repeats', 'seed', 'options', 'locks'];

// listenSource(): resúmenes de SV Listen ({ track, name, chroma, occupancy, kick, level, updated }) o [].
function createController({ core, data, bridge = null, post = () => {}, presetStore = memoryStore(), listenSource = () => [] }) {
  const scales = data.scales.scales;
  const findPattern = (id) => data.patterns.find((p) => p.id === id) || null;
  const state = {
    destination: 'chords',
    harmonyMode: 'manual', // manual | live | adaptive | random
    root: 0,
    scaleId: 'minor',
    randomSeed: 1,
    patternId: DEFAULT_PATTERN.chords,
    category: 'dub_techno',
    repeats: 'auto',
    seed: 1,
    options: { microtiming: 'swing_16_62' },
    syncScale: false,
    adaptive: { amount: 0.5, alignBassToKick: 'auto', summary: null, override: null },
    locks: [],
    history: [],
    historyIndex: -1,
    lastSlot: null,
    allowStructural: false,
    suggestions: [],
  };

  const harmonyFrom = (root, scaleId) => {
    const sc = scales.find((s) => s.id === scaleId) || scales.find((s) => s.id === 'minor');
    return { root: ((root % 12) + 12) % 12, intervals: sc.intervals, id: sc.id, name: sc.name };
  };

  // Random dentro de reglas musicales, con semilla visible y reutilizable (§2, Paso 2).
  function randomHarmony(seed) {
    const rng = core.createRng(`harmony:${seed}`);
    const rules = data.scales.random_rules || { family_weights: {} };
    const avoid = new Set((rules.avoid_for_destination || {})[state.destination] || []);
    const fams = data.scales.families.map((f) => f.id);
    const fam = fams[rng.weighted(fams.map((f) => rules.family_weights[f] ?? 1))];
    const pool = scales.filter((s) => s.family === fam && !avoid.has(s.id));
    const sc = rng.pick(pool.length ? pool : scales);
    return harmonyFrom(rng.int(0, 11), sc.id);
  }

  function setInfo() {
    if (!bridge) return { tempo: 120, timeSignature: '4/4', barBeats: 4 };
    try { return bridge.setInfo(); } catch (e) { post(`SV: no se pudo leer el set (${e.message})`); return { tempo: 120, timeSignature: '4/4', barBeats: 4 }; }
  }

  // Modo Adaptable: lee el MIDI del set y estima tonalidad, escala, ocupación y bombo (§6).
  function analyze() {
    if (!bridge) throw new Error('El modo Adaptable necesita Live.');
    const info = setInfo();
    const tracks = bridge.readTracks({ includeArrangement: !!state.options.readArrangement });
    let liveScale = null;
    try { liveScale = core.analysis.liveScaleToHarmony(bridge.readScale(), scales); } catch (e) { liveScale = null; }
    // pistas de audio escuchadas por SV Listen en los últimos 30 s
    let audio = [];
    try { const now = Date.now(); audio = (listenSource() || []).filter((a) => a && (!a.updated || now - a.updated < 30000)); } catch (e) { audio = []; }
    const summary = core.analysis.analyzeSet(tracks, { scales, barBeats: info.barBeats, liveScale, audio, audioWeight: state.adaptive.audioWeight ?? 0.5 });
    summary.read = tracks.map((t) => ({ name: t.name, slot: t.slot, source: t.source, playing: t.playing, notes: t.notes.length, isDrum: t.isDrum }))
      .concat(audio.map((a) => ({ name: a.name, source: 'audio', playing: true, notes: 0, isDrum: (a.kicks || 0) > 0 })));
    state.adaptive.summary = summary;
    return summary;
  }

  function resolveHarmony() {
    switch (state.harmonyMode) {
      case 'random': return { ...randomHarmony(state.randomSeed), mode: 'random', seed: state.randomSeed };
      case 'live': {
        const h = bridge ? core.analysis.liveScaleToHarmony(bridge.readScale(), scales) : null;
        if (h) return { ...h, mode: 'live' };
        post('SV: no se pudo leer la escala de Live; se usa la manual.');
        return { ...harmonyFrom(state.root, state.scaleId), mode: 'manual' };
      }
      case 'adaptive': {
        if (state.adaptive.override) return { ...harmonyFrom(state.adaptive.override.root, state.adaptive.override.scaleId), mode: 'adaptive', corrected: true };
        const s = state.adaptive.summary || analyze();
        const best = s.scale && s.scale[0];
        if (best) return { root: best.root, intervals: best.intervals, id: best.id, name: best.name, mode: 'adaptive', key: s.key.name, confidence: s.key.confidence };
        return { ...harmonyFrom(state.root, state.scaleId), mode: 'manual' };
      }
      default: return { ...harmonyFrom(state.root, state.scaleId), mode: 'manual' };
    }
  }

  function buildOptions(seed) {
    const info = setInfo();
    const harmony = resolveHarmony();
    const o = {
      ...state.options,
      destination: state.destination,
      category: state.category,
      harmony,
      seed,
      repeats: state.repeats,
      bpm: info.tempo,
      timeSignature: info.timeSignature,
      allowStructural: state.allowStructural,
    };
    if (state.harmonyMode === 'adaptive' && state.adaptive.summary) {
      const s = state.adaptive.summary;
      const occ = state.destination === 'bassline' && s.kickOccupancy ? s.kickOccupancy : s.occupancy;
      if (state.adaptive.amount > 0) o.complement = { occupancy: occ, amount: state.adaptive.amount };
      // seguir al bombo: siempre (true), nunca (false) o 'auto' = solo si el patrón de bajo ataca sobre todo en
      // los pulsos; un bajo en contratiempo conserva su ritmo y se coloca entre los bombos (D-038)
      const pattern = findPattern(state.patternId);
      const follow = state.adaptive.alignBassToKick === 'auto' ? onBeatShare(pattern) >= 0.5 : !!state.adaptive.alignBassToKick;
      if (state.destination === 'bassline' && follow && s.kick && s.kick.times.length) {
        // alinea el bajo con el bombo repitiendo su clip hasta cubrir el clip nuevo
        o.bassSource = 'external';
        const len = s.kick.length || 4;
        const times = [];
        for (let off = 0; off < 256; off += len) for (const t of s.kick.times) times.push(off + t);
        o.kickTimes = times;
      }
    }
    return o;
  }

  function pushHistory(entry) {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(entry);
    if (state.history.length > HISTORY_MAX) state.history.shift();
    state.historyIndex = state.history.length - 1;
  }

  function write(result, reuse) {
    if (!bridge) return null;
    const w = bridge.writeClip(result, { reuseSlot: reuse ? state.lastSlot : null, name: result.meta.name });
    state.lastSlot = w.slot;
    return w;
  }

  function summaryOf(result, written) {
    return {
      pattern: result.meta.pattern, name: result.meta.name, destination: result.meta.destination, seed: result.meta.seed,
      harmony: result.meta.harmony, status: result.meta.status, verify: result.meta.verify, tradition: result.meta.tradition,
      length_beats: result.length_beats, bars: result.plan.bars, repeats: result.plan.repeats, variation: result.plan.variation,
      notes: result.notes.length, warnings: result.meta.warnings, cultural_note: result.meta.cultural_note, written,
    };
  }

  const signature = (r) => r.notes.map((n) => `${n.pitch}@${n.start_time}:${n.duration}:${n.velocity}`).join('|');

  function run(seed, { reuse = false, varyIndex = null, mustDiffer = false } = {}) {
    const pattern = findPattern(state.patternId);
    if (!pattern) throw new Error(`Patrón inexistente: ${state.patternId}`);
    let opts = buildOptions(seed);
    const prev = state.history[state.historyIndex];
    if (state.locks.length && prev) opts.lock = { roles: state.locks, previous: prev.result };
    let result = varyIndex === null ? core.generate(pattern, opts, data) : core.vary(pattern, { ...opts, variationIndex: varyIndex }, data);
    // Generar o Regenerar no repiten el clip anterior: primero se prueban semillas siguientes (la nueva queda en
    // state.seed, visible y reutilizable) y, si el patrón es fijo, se aplica una variación suave (D-046)
    for (let k = 1; mustDiffer && varyIndex === null && prev && signature(result) === signature(prev.result) && k <= 8; k++) {
      seed = (Number(seed) || 0) + 1;
      state.seed = seed;
      opts = { ...opts, seed };
      result = core.generate(pattern, opts, data);
    }
    for (let k = 1; mustDiffer && prev && signature(result) === signature(prev.result) && k <= 6; k++) {
      result = core.vary(pattern, { ...opts, variationIndex: state.history.length + k }, data, 0.3 + 0.1 * k);
      result.meta.warnings = [...(result.meta.warnings || []), 'Patrón fijo: Regenerar aplicó una variación suave.'];
    }
    const written = write(result, reuse);
    pushHistory({ seed, patternId: state.patternId, destination: state.destination, result, written });
    return summaryOf(result, written);
  }

  return {
    state,
    setDestination(d) {
      if (!DEFAULT_PATTERN[d]) throw new Error(`Destino desconocido: ${d}`);
      state.destination = d;
      const p = findPattern(state.patternId);
      if (!p || !p.destinations.includes(d)) { state.patternId = DEFAULT_PATTERN[d]; state.category = (findPattern(state.patternId).categories || [])[0] || null; }
      return state.destination;
    },
    setHarmony(root, scaleId) { state.root = Number(root); if (scaleId) state.scaleId = String(scaleId); state.harmonyMode = 'manual'; return resolveHarmony(); },
    setHarmonyMode(mode) {
      if (!['manual', 'live', 'adaptive', 'random'].includes(mode)) throw new Error(`Modo de armonía desconocido: ${mode}`);
      state.harmonyMode = mode;
      return resolveHarmony();
    },
    setRandomSeed(seed) { state.randomSeed = seed; return resolveHarmony(); },
    rerollHarmony() { state.randomSeed = Math.floor(Math.random() * 1e6); state.harmonyMode = 'random'; return resolveHarmony(); },
    correctAdaptive(root, scaleId) { state.adaptive.override = root === null ? null : { root: Number(root), scaleId }; return resolveHarmony(); },
    setPattern(id) {
      const p = findPattern(id);
      if (!p) throw new Error(`Patrón inexistente: ${id}`);
      if (core.catalog.isRestricted(p) && !p.structural_only) throw new Error(`${id} es de uso restringido.`);
      state.patternId = id;
      state.allowStructural = core.catalog.isRestricted(p);
      if (!p.destinations.includes(state.destination)) state.destination = p.destinations[0];
      state.category = (p.categories || [])[0] || null;
      return { id, cultural_note: p.cultural_note || null };
    },
    setCategory(c) { state.category = c; },
    setRepeats(r) { state.repeats = r === 'full' || r === 'auto' ? r : Number(r); },
    setOption(key, value) { if (value === null || value === undefined) delete state.options[key]; else state.options[key] = value; },
    setSeed(s) { state.seed = s; },
    lock(role, on = true) { state.locks = on ? [...new Set([...state.locks, role])] : state.locks.filter((r) => r !== role); return state.locks; },
    setSyncScale(on) { state.syncScale = !!on; if (on) state.harmonyMode = 'live'; return state.syncScale; },
    analyze,
    resolveHarmony,
    // Generar: escribe un clip nuevo. Regenerar: nueva semilla en la misma ranura. Variar: mutación suave.
    generate() { return run(state.seed, { reuse: false, mustDiffer: true }); },
    regenerate() { state.seed = (Number(state.seed) || 0) + 1; return run(state.seed, { reuse: state.lastSlot !== null, mustDiffer: true }); },
    vary() { const n = state.history.length; return run(state.seed, { reuse: state.lastSlot !== null, varyIndex: n }); },
    preview() {
      const p = findPattern(state.patternId);
      return core.generate(p, buildOptions(state.seed), data);
    },
    undo() {
      if (state.historyIndex <= 0) return null;
      state.historyIndex -= 1;
      const h = state.history[state.historyIndex];
      const written = write(h.result, true);
      return summaryOf(h.result, written);
    },
    redo() {
      if (state.historyIndex >= state.history.length - 1) return null;
      state.historyIndex += 1;
      const h = state.history[state.historyIndex];
      const written = write(h.result, true);
      return summaryOf(h.result, written);
    },
    historyList() {
      return state.history.map((h, i) => ({ i, seed: h.seed, pattern: h.patternId, name: (findPattern(h.patternId) || {}).name || h.patternId, destination: h.destination, notes: h.result.notes.length, slot: h.written ? h.written.slot : null, current: i === state.historyIndex }));
    },
    // Vuelve a una generación del historial y la reescribe en su ranura.
    gotoHistory(i) {
      const k = Number(i);
      if (!(k >= 0 && k < state.history.length)) return null;
      state.historyIndex = k;
      const h = state.history[k];
      const written = write(h.result, true);
      return summaryOf(h.result, written);
    },
    // Sugerir (§7): contexto del set → tres ritmos con razones.
    suggest() {
      let info = { tempo: 120, timeSignature: '4/4', tracks: [] };
      if (bridge) { try { info = bridge.describeSet(); } catch (e) { post(`SV: no se pudo leer el set (${e.message})`); } }
      let analysis = state.adaptive.summary;
      if (!analysis && bridge) { try { analysis = analyze(); } catch (e) { analysis = null; } }
      const names = [];
      for (const t of info.tracks || []) names.push(t.name, ...(t.devices || []), ...(t.clips || []));
      const recent = state.history.slice(-8).map((h) => h.patternId);
      state.suggestions = core.suggest.suggest(data.patterns, { tempo: info.tempo, timeSignature: info.timeSignature, names, analysis, recent }, { destination: state.destination });
      return { suggestions: state.suggestions, context: { tempo: info.tempo, timeSignature: info.timeSignature, tracks: (info.tracks || []).length, setPath: info.filePath || null } };
    },
    useSuggestion(i) { const s = state.suggestions[Number(i)]; if (!s) return null; return this.setPattern(s.id); },
    // Preajustes propios (§8): se guardan con el set mediante el almacén inyectado.
    listPresets() { return presetStore.load().map((p, i) => ({ i, name: p.name, pattern: p.state.patternId, destination: p.state.destination })); },
    savePreset(name) {
      const list = presetStore.load();
      const snap = {};
      for (const k of PRESET_FIELDS) snap[k] = JSON.parse(JSON.stringify(state[k] ?? null));
      const p = findPattern(state.patternId);
      const auto = `${p ? p.name : state.patternId} · ${state.destination}`;
      list.push({ name: name && String(name).trim() ? String(name).trim() : auto, created: Date.now(), state: snap });
      presetStore.save(list);
      return this.listPresets();
    },
    loadPreset(i) {
      const p = presetStore.load()[Number(i)];
      if (!p) return null;
      for (const k of PRESET_FIELDS) if (p.state[k] !== undefined && p.state[k] !== null) state[k] = JSON.parse(JSON.stringify(p.state[k]));
      return { name: p.name, state: this.snapshot() };
    },
    deletePreset(i) { const list = presetStore.load(); list.splice(Number(i), 1); presetStore.save(list); return this.listPresets(); },
    // Exportar .mid: bytes del clip actual (o de la vista previa si aún no se generó nada).
    exportMidi() {
      const h = state.history[state.historyIndex];
      const r = h ? h.result : this.preview();
      const info = setInfo();
      const name = `SV ${r.meta.name} ${r.meta.destination} s${r.meta.seed}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
      return { name, bytes: Array.from(core.midifile.writeSMF(r.notes, { bpm: info.tempo, name })), notes: r.notes.length };
    },
    // Índices para sincronizar los live.* con el estado (tras cargar un preajuste o al avanzar la semilla).
    paramIndices() {
      const pub = core.catalog.publicPatterns(data.patterns).map((p) => p.id);
      const reps = ['auto', 3, 4, 8, 16, 'full'];
      return {
        p_destino: data.taxonomy.destinations.findIndex((d) => d.id === state.destination),
        p_armonia: ['manual', 'live', 'adaptive', 'random'].indexOf(state.harmonyMode),
        p_raiz: state.root,
        p_escala: scales.findIndex((s) => s.id === state.scaleId),
        p_ritmo: pub.indexOf(state.patternId),
        p_repeticiones: reps.findIndex((r) => String(r) === String(state.repeats)),
        p_semilla: state.seed,
      };
    },
    snapshot() {
      const { history, adaptive, suggestions, ...rest } = state;
      return { ...rest, adaptive: { amount: adaptive.amount, alignBassToKick: adaptive.alignBassToKick, override: adaptive.override } };
    },
  };
}

module.exports = { createController, DEFAULT_PATTERN, memoryStore, PRESET_FIELDS };
