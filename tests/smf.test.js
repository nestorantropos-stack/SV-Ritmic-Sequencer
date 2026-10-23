'use strict';
// Lector MIDI de las herramientas de corpus: archivo construido en memoria.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSMF } = require('../tools/lib/smf');
const A = require('../tools/lib/analysis');

const vlq = (n) => {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
};

function buildMidi(ppq, events) {
  const body = [];
  for (const [delta, ...bytes] of events) body.push(...vlq(delta), ...bytes);
  body.push(0, 0xff, 0x2f, 0);
  const hdr = Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, ppq >> 8, ppq & 0xff]);
  const trk = Buffer.concat([Buffer.from('MTrk', 'latin1'), Buffer.from([0, 0, 0, 0]), Buffer.from(body)]);
  trk.writeUInt32BE(body.length, 4);
  return Buffer.concat([hdr, trk]);
}

test('parseSMF lee tempo, compás, notas y running status', () => {
  const buf = buildMidi(96, [
    [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], // 120 BPM
    [0, 0xff, 0x58, 4, 4, 2, 24, 8], // 4/4
    [0, 0x90, 60, 100], [0, 63, 90], [0, 67, 80], // tríada con running status
    [48, 0x80, 60, 0], [0, 0x80, 63, 0], [0, 0x80, 67, 0],
    [24, 0x90, 36, 110], [24, 36, 0], // note-off como velocity 0
  ]);
  const s = parseSMF(buf);
  assert.equal(s.ppq, 96);
  assert.equal(Math.round(s.tempos[0].bpm), 120);
  assert.deepEqual([s.timeSigs[0].num, s.timeSigs[0].den], [4, 4]);
  assert.equal(s.notes.length, 4);
  const chords = A.groupChords(s.notes);
  assert.equal(chords[0].intervals.join('-'), '0-3-7');
  assert.equal(chords[0].duration, 0.5);
  assert.equal(chords[1].start, 0.75);
  assert.deepEqual(A.keyFromName('DDT_Chord_31_F#m.mid'), { root: 6, name: 'F#m', minor: true });
  assert.deepEqual(A.quantize(1.3125, 0.25), { idx: 5, dev: 0.25 });
});
