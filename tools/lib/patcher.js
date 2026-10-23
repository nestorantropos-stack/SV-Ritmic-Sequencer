'use strict';
// Constructor de patchers de Max (.maxpat en JSON) y empaquetado .amxd (D-002).
// Formato tomado de dispositivos reales del equipo (Sidera WaveSeq), que cargan en Live 12.

class Patch {
  constructor() { this.boxes = []; this.lines = []; this.n = 0; }

  obj(text, x, y, ins = 1, outs = 1, opts = {}) {
    const o = { ...opts };
    this.n += 1;
    const id = `obj-${this.n}`;
    const b = { id, maxclass: o.maxclass || 'newobj', numinlets: ins, numoutlets: outs, patching_rect: [x, y, o.w || Math.max(40, 7 * String(text || '').length + 12), o.h || 22] };
    delete o.maxclass; delete o.w; delete o.h;
    if (text !== null && text !== undefined) b.text = text;
    if (outs) b.outlettype = o.outlettype || new Array(outs).fill('');
    delete o.outlettype;
    if (o.pres) {
      b.presentation = 1;
      b.presentation_rect = o.pres;
      b.patching_rect = [x, y, o.pres[2], o.pres[3]];
      delete o.pres;
    }
    if (o.param) {
      b.parameter_enable = 1;
      b.saved_attribute_attributes = { valueof: o.param };
      delete o.param;
    }
    Object.assign(b, o);
    this.boxes.push({ box: b });
    return id;
  }

  msg(text, x, y, opts = {}) { return this.obj(text, x, y, 2, 1, { maxclass: 'message', ...opts }); }

  comment(text, x, y, opts = {}) { return this.obj(text, x, y, 1, 0, { maxclass: 'comment', fontsize: 10, ...opts }); }

  link(a, ao, b, bi = 0) { this.lines.push({ patchline: { source: [a, ao], destination: [b, bi] } }); }

  dump({ presentation = true, rect = [60, 60, 1200, 800], deviceWidth = null, extra = {} } = {}) {
    const p = {
      fileversion: 1,
      appversion: { major: 9, minor: 1, revision: 5, architecture: 'x64', modernui: 1 },
      classnamespace: 'box', rect, openinpresentation: presentation ? 1 : 0,
      default_fontsize: 10.0, default_fontname: 'Arial', gridsize: [8.0, 8.0],
      boxes: this.boxes, lines: this.lines, dependency_cache: [], autosave: 0, ...extra,
    };
    if (deviceWidth) p.devicewidth = deviceWidth;
    return { patcher: p };
  }
}

const pInt = (name, short, lo, hi, init, unit = 0) => ({ parameter_longname: name, parameter_shortname: short, parameter_type: 1, parameter_mmin: lo, parameter_mmax: hi, parameter_initial_enable: 1, parameter_initial: [init], parameter_unitstyle: unit });
const pFloat = (name, short, lo, hi, init, unit = 1, exp = 1) => ({ parameter_longname: name, parameter_shortname: short, parameter_type: 0, parameter_mmin: lo, parameter_mmax: hi, parameter_initial_enable: 1, parameter_initial: [init], parameter_unitstyle: unit, parameter_exponent: exp });
const pEnum = (name, short, items, init = 0) => ({ parameter_longname: name, parameter_shortname: short, parameter_type: 2, parameter_enum: items, parameter_mmax: items.length - 1, parameter_initial_enable: 1, parameter_initial: [init] });

// Cabecera .amxd sin congelar: "ampf" u32(4) <tipo> "meta" u32(4) u32(0) "ptch" u32(N) <json + "\n\0">.
const AMXD_TYPES = { midi: 'mmmm', instrument: 'iiii', audio: 'aaaa' };
function amxd(patch, kind = 'midi') {
  const data = Buffer.concat([Buffer.from(JSON.stringify(patch, null, 1), 'utf8'), Buffer.from('\n\0', 'latin1')]);
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  return Buffer.concat([Buffer.from('ampf', 'latin1'), u32(4), Buffer.from(AMXD_TYPES[kind], 'latin1'), Buffer.from('meta', 'latin1'), u32(4), u32(0), Buffer.from('ptch', 'latin1'), u32(data.length), data]);
}

// Lee un .amxd sin congelar y devuelve { kind, patch } (para pruebas y para estudiar dispositivos).
function readAmxd(buf) {
  if (buf.toString('latin1', 0, 4) !== 'ampf') throw new Error('No es un .amxd');
  const kind = buf.toString('latin1', 8, 12);
  if (buf.toString('latin1', 24, 28) !== 'ptch') throw new Error(`Bloque ${buf.toString('latin1', 24, 28)} no soportado (¿dispositivo congelado o cifrado?)`);
  const n = buf.readUInt32LE(28);
  const json = buf.subarray(32, 32 + n).toString('utf8').replace(/\0+$/, '');
  return { kind, patch: JSON.parse(json) };
}

module.exports = { Patch, pInt, pFloat, pEnum, amxd, readAmxd, AMXD_TYPES };
