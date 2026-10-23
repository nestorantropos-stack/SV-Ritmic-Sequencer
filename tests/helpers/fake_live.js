'use strict';
// Live API simulada para probar el puente en Node. Imita las formas de respuesta de LiveAPI en Max:
// listas planas (["id", 3], [120]), rutas entre comillas y diccionarios devueltos como cadena JSON.

function createFakeLive(model) {
  let nextId = 1;
  const reg = new Map(); // id -> { obj, path, type }
  const idFor = new WeakMap();
  const register = (obj, path, type) => {
    if (!obj) return 0;
    if (!idFor.has(obj)) { const id = nextId++; idFor.set(obj, id); reg.set(id, { obj, path, type }); }
    const id = idFor.get(obj);
    reg.get(id).path = path;
    return id;
  };
  const calls = [];
  const observers = [];

  function resolve(path) {
    const p = path.trim();
    let m = /^id (\d+)$/.exec(p);
    if (m) { const e = reg.get(Number(m[1])); return e ? { ...e } : null; }
    if (p === 'this_device') {
      const t = model.tracks[model.ownTrack];
      const dev = t.devices.find((d) => d.isSV) || t.devices[0];
      return { obj: dev, path: `live_set tracks ${model.ownTrack} devices ${t.devices.indexOf(dev)}`, type: 'Device', parent: t, parentPath: `live_set tracks ${model.ownTrack}` };
    }
    if (p === 'live_set') return { obj: model, path: 'live_set', type: 'Song' };
    if (p === 'live_set view') return { obj: model.view, path: 'live_set view', type: 'Song.View' };
    m = /^live_set tracks (\d+)(.*)$/.exec(p);
    if (!m) return null;
    const ti = Number(m[1]);
    const t = model.tracks[ti];
    if (!t) return null;
    const rest = m[2].trim();
    const tp = `live_set tracks ${ti}`;
    if (!rest) return { obj: t, path: tp, type: 'Track' };
    m = /^clip_slots (\d+)( clip)?$/.exec(rest);
    if (m) {
      const cs = t.clip_slots[Number(m[1])];
      if (!cs) return null;
      if (m[2]) return cs.clip ? { obj: cs.clip, path: `${tp} clip_slots ${m[1]} clip`, type: 'Clip' } : null;
      return { obj: cs, path: `${tp} clip_slots ${m[1]}`, type: 'ClipSlot', track: t };
    }
    m = /^devices (\d+)$/.exec(rest);
    if (m) return t.devices[Number(m[1])] ? { obj: t.devices[Number(m[1])], path: `${tp} devices ${m[1]}`, type: 'Device', parent: t, parentPath: tp } : null;
    m = /^arrangement_clips (\d+)$/.exec(rest);
    if (m) return t.arrangement_clips[Number(m[1])] ? { obj: t.arrangement_clips[Number(m[1])], path: `${tp} arrangement_clips ${m[1]}`, type: 'Clip' } : null;
    return null;
  }

  class LiveAPI {
    constructor(a, b) {
      const cb = typeof a === 'function' ? a : null;
      const path = typeof a === 'function' ? b : a;
      this._cb = cb;
      this._r = resolve(path) || { obj: null, path: '', type: 'none' };
      this.id = String(register(this._r.obj, this._r.path, this._r.type));
      this.path = `"${this._r.path}"`;
      this.type = this._r.type;
    }

    set property(p) { this._prop = p; observers.push(this); }
    get property() { return this._prop; }

    get(prop) {
      const r = this._r;
      const o = r.obj;
      if (!o) return [];
      if (prop === 'canonical_parent') {
        const parentPath = r.parentPath;
        return ['id', register(r.parent, parentPath, 'Track')];
      }
      if (prop === 'highlighted_clip_slot') {
        const h = model.view.highlighted;
        if (!h) return ['id', 0];
        const cs = model.tracks[h.track].clip_slots[h.slot];
        return ['id', register(cs, `live_set tracks ${h.track} clip_slots ${h.slot}`, 'ClipSlot')];
      }
      if (prop === 'has_clip') return [o.clip ? 1 : 0];
      if (prop === 'is_midi_clip') return [o.is_midi_clip ?? 1];
      const v = o[prop];
      if (Array.isArray(v)) return v.slice();
      if (v === undefined) return [];
      return [typeof v === 'boolean' ? (v ? 1 : 0) : v];
    }

    getcount(prop) { const v = this._r.obj && this._r.obj[prop]; return Array.isArray(v) ? v.length : 0; }

    set(prop, value) { calls.push(['set', this._r.path, prop, value]); this._r.obj[prop] = value; }

    call(fn, ...args) {
      calls.push(['call', this._r.path, fn, ...args]);
      const o = this._r.obj;
      switch (fn) {
        case 'create_clip':
          if (o.clip) throw new Error('la ranura ya tiene clip');
          o.clip = { name: '', length: args[0], looping: 0, loop_start: 0, loop_end: args[0], end_marker: args[0], is_midi_clip: 1, notes: [] };
          return null;
        case 'add_new_notes':
          for (const n of args[0].notes) o.notes.push({ ...n });
          return null;
        case 'remove_notes_extended': {
          const [fp, span, ft, tspan] = args;
          o.notes = o.notes.filter((n) => !(n.pitch >= fp && n.pitch < fp + span && n.start_time >= ft && n.start_time < ft + tspan));
          return null;
        }
        case 'get_notes_extended': {
          const [fp, span, ft, tspan] = args;
          return JSON.stringify({ notes: o.notes.filter((n) => n.pitch >= fp && n.pitch < fp + span && n.start_time >= ft && n.start_time < ft + tspan) });
        }
        case 'create_scene':
          model.scenes.push({});
          for (const t of model.tracks) t.clip_slots.push({ clip: null });
          return null;
        default:
          throw new Error(`llamada no simulada: ${fn}`);
      }
    }
  }

  const fire = (prop) => observers.filter((o) => o.property === prop).forEach((o) => o._cb && o._cb(['property', prop]));
  return { LiveAPI, calls, fire, model };
}

// Set de ejemplo: pad en La menor, batería con bombo en cuatro y la pista del dispositivo.
function sampleModel() {
  const n = (pitch, start_time, duration, velocity = 100) => ({ pitch, start_time, duration, velocity, mute: 0 });
  const pad = [];
  for (let b = 0; b < 2; b++) pad.push(n(57, b * 4, 4), n(60, b * 4, 4), n(64, b * 4, 4));
  pad.push(n(62, 8, 4), n(65, 8, 4), n(69, 8, 4), n(64, 12, 4), n(67, 12, 4), n(71, 12, 4));
  const kicks = [0, 1, 2, 3, 4, 5, 6, 7].map((t) => n(36, t, 0.25, 110));
  const hats = [0.5, 1.5, 2.5, 3.5].map((t) => n(42, t, 0.1, 80));
  const slots = (k, clipAt = {}) => Array.from({ length: k }, (_, i) => ({ clip: clipAt[i] || null }));
  return {
    tempo: 124, signature_numerator: 4, signature_denominator: 4,
    root_note: 9, scale_name: 'Minor', scale_mode: 1, scale_intervals: [0, 2, 3, 5, 7, 8, 10],
    scenes: [{}, {}, {}, {}],
    view: { highlighted: null },
    ownTrack: 2,
    tracks: [
      { name: 'Pad', has_midi_input: 1, playing_slot_index: 0, devices: [{ name: 'Wavetable', class_name: 'InstrumentVector' }], arrangement_clips: [], clip_slots: slots(4, { 0: { name: 'pad', length: 16, is_midi_clip: 1, notes: pad } }) },
      { name: 'Drums', has_midi_input: 1, playing_slot_index: -1, devices: [{ name: 'Drum Rack', class_name: 'DrumGroupDevice' }], arrangement_clips: [], clip_slots: slots(4, { 1: { name: 'beat', length: 2 * 4, is_midi_clip: 1, notes: [...kicks, ...hats] } }) },
      { name: 'SV Chords', has_midi_input: 1, playing_slot_index: -1, devices: [{ name: 'SV Ritmic Sequencer', class_name: 'MxDeviceMidiEffect', isSV: true }, { name: 'Analog', class_name: 'UltraAnalog' }], arrangement_clips: [], clip_slots: slots(4, { 1: { name: 'mi clip', length: 4, is_midi_clip: 1, notes: [n(60, 0, 1)] } }) },
      { name: 'Audio', has_midi_input: 0, playing_slot_index: -1, devices: [], arrangement_clips: [], clip_slots: slots(4) },
    ],
  };
}

module.exports = { createFakeLive, sampleModel };
