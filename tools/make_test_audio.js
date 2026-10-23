'use strict';
// WAV de prueba para PM-032..PM-035: batería de 4 compases a 120 BPM (bombo en negras, clic en contratiempo)
// y pad en La menor (A3, C4, E4) de 4 compases. Uso: node tools/make_test_audio.js → build/test_audio/
const fs = require('fs');
const path = require('path');
const SR = 44100;
const OUT = path.join(__dirname, '..', 'build', 'test_audio');

function wav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, file), Buffer.concat([h, data]));
}

const bars = 4;
const spb = SR / 2;
const n = Math.round(bars * 4 * spb);
const drums = new Float64Array(n);
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
for (let b = 0; b < bars * 4; b++) {
  const k = Math.round(b * spb);
  for (let i = 0; i < SR * 0.15 && k + i < n; i++) drums[k + i] += 0.8 * Math.exp(-i / (SR * 0.04)) * Math.sin((2 * Math.PI * 55 * i) / SR);
  const c = Math.round((b + 0.5) * spb);
  for (let i = 0; i < SR * 0.008 && c + i < n; i++) drums[c + i] += 0.5 * rnd() * Math.exp(-i / (SR * 0.002));
}
const pad = new Float64Array(n);
for (const f of [220, 261.63, 329.63]) for (let h = 1; h <= 4; h++) for (let i = 0; i < n; i++) pad[i] += (0.12 / h) * Math.sin((2 * Math.PI * f * h * i) / SR);
fs.mkdirSync(OUT, { recursive: true });
wav('SV_test_drums_120.wav', drums);
wav('SV_test_pad_Am_120.wav', pad);
console.log('ok', OUT);
