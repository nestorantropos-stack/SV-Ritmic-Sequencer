'use strict';
// Escritor mínimo de Standard MIDI File (formato 0): ejemplos de salida y «Exportar .mid» del dispositivo.
// Devuelve un Buffer en Node y una lista de bytes donde no hay Buffer (v8 de Max).
// notes: [{ pitch, start_time, duration, velocity }] con tiempos en negras.

function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

function writeSMF(notes, { bpm = 120, ppq = 480, name = 'SV Ritmic Sequencer', channel = 0, numerator = 4, denominator = 4 } = {}) {
  const ev = [];
  for (const n of notes) {
    const on = Math.round(n.start_time * ppq);
    const off = Math.max(on + 1, Math.round((n.start_time + n.duration) * ppq));
    ev.push({ t: on, order: 1, bytes: [0x90 | channel, n.pitch, Math.max(1, Math.min(127, n.velocity))] });
    ev.push({ t: off, order: 0, bytes: [0x80 | channel, n.pitch, 0] });
  }
  ev.sort((a, b) => a.t - b.t || a.order - b.order);
  const body = [];
  const nameBytes = utf8(name);
  body.push(0, 0xff, 0x03, ...vlq(nameBytes.length), ...nameBytes);
  const mpq = Math.round(60000000 / bpm);
  body.push(0, 0xff, 0x51, 3, (mpq >> 16) & 0xff, (mpq >> 8) & 0xff, mpq & 0xff);
  body.push(0, 0xff, 0x58, 4, numerator, Math.log2(denominator), 24, 8);
  let last = 0;
  for (const e of ev) { body.push(...vlq(e.t - last), ...e.bytes); last = e.t; }
  body.push(0, 0xff, 0x2f, 0);
  const bytes = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff, 0x4d, 0x54, 0x72, 0x6b,
    (body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff, ...body];
  return typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
}

// UTF-8 sin depender de Buffer ni TextEncoder.
function utf8(str) {
  const out = [];
  for (const ch of String(str)) {
    let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

module.exports = { writeSMF, utf8 };
