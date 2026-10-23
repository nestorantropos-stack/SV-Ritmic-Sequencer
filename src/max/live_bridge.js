'use strict';
// Puente con la Live API (adaptador delgado hacia Max). Recibe el constructor LiveAPI por inyección
// para poder probarse en Node con una Live API simulada (tests/live_bridge.test.js).
//
// Rutas y llamadas usadas (Live Object Model, Live 12):
//   this_device → canonical_parent (la pista propia)
//   live_set: tempo, signature_numerator, signature_denominator, root_note, scale_name, scale_mode, scale_intervals,
//             tracks, scenes, create_scene
//   live_set view: highlighted_clip_slot
//   track: name, has_midi_input, playing_slot_index, clip_slots, devices (class_name), arrangement_clips
//   clip_slot: has_clip, create_clip(length), clip
//   clip: length, looping, loop_start, loop_end, name, is_midi_clip, add_new_notes, get_notes_extended,
//         remove_notes_extended
// Lo que solo se verifica dentro de Live está en docs/PRUEBAS_MANUALES.md (PM-003, PM-004, PM-008 a PM-012).

const NOTE_KEYS = ['pitch', 'start_time', 'duration', 'velocity', 'mute', 'probability', 'velocity_deviation', 'release_velocity'];
const SV_PREFIX = 'SV · ';

// La Live API devuelve listas planas: ["id", 3] o [120]. Estas funciones las normalizan.
const first = (v) => (Array.isArray(v) ? v[0] : v);
const idOf = (v) => {
  if (Array.isArray(v)) { const i = v.indexOf('id'); return i >= 0 ? Number(v[i + 1]) : Number(v[v.length - 1]); }
  return Number(v);
};
const str = (v) => {
  const x = Array.isArray(v) ? v.join(' ') : String(v ?? '');
  return x.replace(/^"|"$/g, '');
};
const parseDictResult = (r) => {
  // get_notes_extended devuelve un diccionario; en JavaScript llega como cadena JSON o como objeto
  if (r === null || r === undefined) return { notes: [] };
  if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return { notes: [] }; } }
  if (Array.isArray(r) && typeof r[0] === 'string') { try { return JSON.parse(r.join(' ')); } catch (e) { return { notes: [] }; } }
  return r;
};

function createBridge(LiveAPI, env = {}) {
  const log = env.post || (() => {});
  const api = (path) => new LiveAPI(path);

  function ownTrack() {
    const dev = api('this_device');
    const parentId = idOf(dev.get('canonical_parent'));
    const t = api(`id ${parentId}`);
    return { api: t, id: parentId, path: str(t.path) };
  }

  function setInfo() {
    const s = api('live_set');
    const num = Number(first(s.get('signature_numerator'))) || 4;
    const den = Number(first(s.get('signature_denominator'))) || 4;
    return { tempo: Number(first(s.get('tempo'))) || 120, timeSignature: `${num}/${den}`, barBeats: (num * 4) / den, trackCount: s.getcount('tracks'), sceneCount: s.getcount('scenes') };
  }

  // §3.5 · escala de Live 12
  function readScale() {
    const s = api('live_set');
    const intervals = s.get('scale_intervals');
    return {
      root_note: Number(first(s.get('root_note'))),
      scale_name: str(s.get('scale_name')),
      scale_mode: Number(first(s.get('scale_mode'))) === 1,
      scale_intervals: Array.isArray(intervals) ? intervals.map(Number) : [],
    };
  }

  // Observa cambios de escala (interruptor «sincronizar con Live»). Devuelve los observadores para soltarlos.
  function observeScale(onChange) {
    const props = ['root_note', 'scale_name', 'scale_intervals', 'scale_mode'];
    return props.map((p) => {
      const o = new LiveAPI(() => onChange(readScale()), 'live_set');
      o.property = p;
      return o;
    });
  }

  function clipSlotPath(trackPath, index) { return `${trackPath} clip_slots ${index}`; }

  // Ranura destino en la pista propia: la seleccionada si está vacía y es de esta pista; si no, la primera
  // vacía; si no hay ninguna, se crea una escena al final (D-030).
  function targetSlot(track, { preferSelected = true, reuseSlot = null } = {}) {
    if (reuseSlot !== null && reuseSlot !== undefined) return { index: reuseSlot, reused: true };
    const count = track.api.getcount('clip_slots');
    if (preferSelected) {
      const view = api('live_set view');
      const hid = idOf(view.get('highlighted_clip_slot'));
      if (hid) {
        const hs = api(`id ${hid}`);
        const hp = str(hs.path);
        const m = /clip_slots (\d+)$/.exec(hp);
        if (m && hp.startsWith(track.path) && Number(first(hs.get('has_clip'))) === 0) return { index: Number(m[1]), selected: true };
      }
    }
    for (let i = 0; i < count; i++) {
      const cs = api(clipSlotPath(track.path, i));
      if (Number(first(cs.get('has_clip'))) === 0) return { index: i };
    }
    api('live_set').call('create_scene', -1);
    return { index: count, createdScene: true };
  }

  // Notas en el formato de add_new_notes, sin los campos internos del generador.
  function toLiveNotes(notes) {
    return notes.map((n) => {
      const o = {};
      for (const k of NOTE_KEYS) if (n[k] !== undefined) o[k] = n[k];
      o.velocity = Math.max(1, Math.min(127, Math.round(o.velocity)));
      o.mute = o.mute ? 1 : 0;
      return o;
    });
  }

  // Escribe el resultado del generador como clip MIDI en la pista propia (§3.4).
  // Solo sobrescribe clips creados por SV (nombre con prefijo «SV · »); nunca toca otros clips.
  function writeClip(result, { name = null, reuseSlot = null, preferSelected = true } = {}) {
    const track = ownTrack();
    const slot = targetSlot(track, { preferSelected, reuseSlot });
    const cs = api(clipSlotPath(track.path, slot.index));
    const length = result.length_beats;
    if (Number(first(cs.get('has_clip'))) === 1) {
      const existing = api(`${clipSlotPath(track.path, slot.index)} clip`);
      if (!str(existing.get('name')).startsWith(SV_PREFIX)) throw new Error('La ranura tiene un clip que no creó SV Ritmic Sequencer; no se sobrescribe.');
      existing.call('remove_notes_extended', 0, 128, 0, Math.max(length, Number(first(existing.get('length'))) || length));
      existing.set('loop_end', length);
      existing.set('loop_start', 0);
      existing.set('end_marker', length);
    } else {
      cs.call('create_clip', length);
    }
    const clip = api(`${clipSlotPath(track.path, slot.index)} clip`);
    clip.set('looping', 1);
    clip.set('name', SV_PREFIX + (name || (result.meta && result.meta.name) || 'patrón'));
    const notes = toLiveNotes(result.notes);
    clip.call('add_new_notes', { notes });
    log(`SV Ritmic Sequencer: ${notes.length} notas en ranura ${slot.index + 1} (${length} negras)`);
    return { slot: slot.index, length, notes: notes.length, createdScene: !!slot.createdScene, trackPath: track.path };
  }

  // §6.1 · lee las notas MIDI del set: clip en reproducción o, si no hay, el primero con notas de cada pista.
  // Las pistas de audio y la pista propia se omiten. includeArrangement añade los clips del arreglo.
  function readTracks({ includeOwn = false, includeArrangement = false, maxNotesPerTrack = 4000 } = {}) {
    const own = ownTrack();
    const s = api('live_set');
    const n = s.getcount('tracks');
    const out = [];
    for (let i = 0; i < n; i++) {
      const path = `live_set tracks ${i}`;
      const t = api(path);
      if (!includeOwn && Number(t.id) === own.id) continue;
      if (Number(first(t.get('has_midi_input'))) !== 1) continue;
      const name = str(t.get('name'));
      const devCount = t.getcount('devices');
      let isDrum = false;
      for (let d = 0; d < devCount; d++) if (str(api(`${path} devices ${d}`).get('class_name')) === 'DrumGroupDevice') isDrum = true;
      const playing = Number(first(t.get('playing_slot_index')));
      const slots = t.getcount('clip_slots');
      const order = playing >= 0 ? [playing, ...[...Array(slots).keys()].filter((k) => k !== playing)] : [...Array(slots).keys()];
      let clipInfo = null;
      for (const k of order) {
        const cs = api(`${path} clip_slots ${k}`);
        if (Number(first(cs.get('has_clip'))) !== 1) continue;
        const clip = api(`${path} clip_slots ${k} clip`);
        if (Number(first(clip.get('is_midi_clip'))) !== 1) continue;
        const len = Number(first(clip.get('length')));
        const res = parseDictResult(clip.call('get_notes_extended', 0, 128, 0, len));
        const notes = (res.notes || []).filter((x) => !x.mute).slice(0, maxNotesPerTrack);
        if (notes.length) { clipInfo = { slot: k, length: len, notes, playing: k === playing, source: 'session' }; break; }
      }
      if (!clipInfo && includeArrangement) {
        const ac = t.getcount('arrangement_clips');
        for (let k = 0; k < ac && !clipInfo; k++) {
          const clip = api(`${path} arrangement_clips ${k}`);
          if (Number(first(clip.get('is_midi_clip'))) !== 1) continue;
          const len = Number(first(clip.get('length')));
          const res = parseDictResult(clip.call('get_notes_extended', 0, 128, 0, len));
          const notes = (res.notes || []).filter((x) => !x.mute);
          if (notes.length) clipInfo = { slot: null, length: len, notes, playing: false, source: 'arrangement' };
        }
      }
      if (clipInfo) out.push({ index: i, name, isDrum, ...clipInfo });
    }
    return out;
  }

  // Nombres de pistas y dispositivos, para Sugerir (§7) y para mostrar qué se leyó.
  function describeSet() {
    const s = api('live_set');
    const n = s.getcount('tracks');
    const tracks = [];
    for (let i = 0; i < n; i++) {
      const path = `live_set tracks ${i}`;
      const t = api(path);
      const devices = [];
      for (let d = 0; d < t.getcount('devices'); d++) devices.push(str(api(`${path} devices ${d}`).get('name')));
      const clips = [];
      const slots = t.getcount('clip_slots');
      for (let k = 0; k < slots && clips.length < 16; k++) {
        const cs = api(`${path} clip_slots ${k}`);
        if (Number(first(cs.get('has_clip'))) === 1) clips.push(str(api(`${path} clip_slots ${k} clip`).get('name')));
      }
      tracks.push({ index: i, name: str(t.get('name')), midi: Number(first(t.get('has_midi_input'))) === 1, devices, clips });
    }
    // ¿Expone Live la ruta del .als? Se intenta leer; si la propiedad no existe queda en null (PM-025)
    let filePath = null;
    try { const fp = s.get('file_path'); filePath = fp && fp.length ? str(fp) : null; } catch (e) { filePath = null; }
    return { ...setInfo(), tracks, filePath };
  }

  return { ownTrack, setInfo, readScale, observeScale, targetSlot, toLiveNotes, writeClip, readTracks, describeSet, SV_PREFIX };
}

module.exports = { createBridge, parseDictResult, idOf, str, NOTE_KEYS };
