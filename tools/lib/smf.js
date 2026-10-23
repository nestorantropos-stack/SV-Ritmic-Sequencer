'use strict';
// Lector mínimo de Standard MIDI File (formatos 0 y 1), sin dependencias.
// Devuelve notas con tiempos en negras (beats), tempos, compases y nombres de pista.

function readVLQ(buf, pos) {
  let value = 0;
  let b;
  do {
    b = buf[pos++];
    value = (value << 7) | (b & 0x7f);
  } while (b & 0x80);
  return [value, pos];
}

function parseSMF(buf) {
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error('No es un archivo MIDI (falta MThd)');
  const hdrLen = buf.readUInt32BE(4);
  const format = buf.readUInt16BE(8);
  const ntrks = buf.readUInt16BE(10);
  const division = buf.readUInt16BE(12);
  if (division & 0x8000) throw new Error('División SMPTE no soportada');
  const ppq = division;
  let pos = 8 + hdrLen;
  const tracks = [];
  const tempos = [];
  const timeSigs = [];
  const keySigs = [];

  for (let t = 0; t < ntrks && pos < buf.length; t++) {
    const id = buf.toString('latin1', pos, pos + 4);
    const len = buf.readUInt32BE(pos + 4);
    pos += 8;
    const end = pos + len;
    if (id !== 'MTrk') { pos = end; continue; }
    const track = { name: '', notes: [] };
    const open = new Map(); // clave canal:nota -> pila de {tick, vel}
    let tick = 0;
    let status = 0;
    while (pos < end) {
      let delta;
      [delta, pos] = readVLQ(buf, pos);
      tick += delta;
      let b = buf[pos];
      if (b & 0x80) { status = b; pos++; } // si no, running status
      if (status === 0xff) {
        const type = buf[pos++];
        let l;
        [l, pos] = readVLQ(buf, pos);
        const data = buf.subarray(pos, pos + l);
        pos += l;
        if (type === 0x03 && !track.name) track.name = data.toString('latin1');
        else if (type === 0x51) tempos.push({ tick, bpm: 60000000 / ((data[0] << 16) | (data[1] << 8) | data[2]) });
        else if (type === 0x58) timeSigs.push({ tick, num: data[0], den: 2 ** data[1] });
        else if (type === 0x59) keySigs.push({ tick, sf: (data[0] << 24) >> 24, minor: data[1] === 1 });
        else if (type === 0x2f) break;
        status = 0;
      } else if (status === 0xf0 || status === 0xf7) {
        let l;
        [l, pos] = readVLQ(buf, pos);
        pos += l;
        status = 0;
      } else {
        const kind = status & 0xf0;
        const ch = status & 0x0f;
        const d1 = buf[pos++];
        const d2 = (kind === 0xc0 || kind === 0xd0) ? 0 : buf[pos++];
        if (kind === 0x90 && d2 > 0) {
          const k = ch * 128 + d1;
          if (!open.has(k)) open.set(k, []);
          open.get(k).push({ tick, vel: d2 });
        } else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) {
          const st = open.get(ch * 128 + d1);
          if (st && st.length) {
            const on = st.shift();
            track.notes.push({ pitch: d1, channel: ch, startTick: on.tick, endTick: tick, velocity: on.vel });
          }
        }
      }
    }
    // notas sin note-off: se cierran al final de la pista
    for (const [k, st] of open) for (const on of st) {
      track.notes.push({ pitch: k % 128, channel: Math.floor(k / 128), startTick: on.tick, endTick: tick, velocity: on.vel });
    }
    track.endTick = tick;
    pos = end;
    tracks.push(track);
  }

  const toBeats = (tk) => tk / ppq;
  const notes = [];
  tracks.forEach((tr, ti) => {
    for (const n of tr.notes) {
      notes.push({
        pitch: n.pitch, channel: n.channel, track: ti, velocity: n.velocity,
        start: toBeats(n.startTick), duration: toBeats(n.endTick - n.startTick),
      });
    }
  });
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const endBeats = Math.max(0, ...tracks.map((t) => toBeats(t.endTick || 0)));
  return {
    format, ppq,
    tracks: tracks.map((t) => ({ name: t.name, noteCount: t.notes.length })),
    tempos, timeSigs, keySigs, notes, endBeats,
  };
}

module.exports = { parseSMF, readVLQ };
