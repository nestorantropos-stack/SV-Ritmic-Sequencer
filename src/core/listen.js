'use strict';
// SV Listen (fase A): análisis de audio en tiempo real, puro y probado con señales sintéticas.
// El Max de Live no trae sigmund~, bonk~ ni fiddle~ (verificado en Max 9.1.5): el dispositivo graba el audio en un
// buffer~ circular y este módulo calcula, por cuadro, espectro (FFT), croma, ataques por flujo espectral y
// ataques en la banda grave (bombo), y acumula la ocupación por paso del compás en el formato de analysis.js.

// FFT radix-2 en el lugar (re, im de longitud potencia de 2).
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang); const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1; let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar; im[i + k] += ai;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const hannCache = new Map();
function hann(n) {
  if (!hannCache.has(n)) hannCache.set(n, Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  return hannCache.get(n);
}

// Magnitudes (n/2 bins) de un cuadro de muestras con ventana de Hann.
function magnitudes(samples) {
  const n = samples.length;
  const w = hann(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i] * w[i];
  fft(re, im);
  const mags = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) mags[k] = Math.hypot(re[k], im[k]) / (n / 4);
  return mags;
}

// Croma: energía por clase de altura (C = 0) entre fmin y fmax, desde los picos del espectro con frecuencia
// refinada por interpolación parabólica (evita que la fuga de una nota grave caiga en semitonos vecinos).
function chroma(mags, sampleRate, { fmin = 80, fmax = 5000, rel = 0.02 } = {}) {
  const n = mags.length * 2;
  const out = new Array(12).fill(0);
  let max = 0;
  for (let k = 1; k < mags.length; k++) if (mags[k] > max) max = mags[k];
  if (max <= 0) return out;
  for (let k = 2; k < mags.length - 1; k++) {
    const m = mags[k];
    if (m < max * rel || m < mags[k - 1] || m < mags[k + 1]) continue;
    const a = Math.log(mags[k - 1] + 1e-12); const b = Math.log(m + 1e-12); const c = Math.log(mags[k + 1] + 1e-12);
    const den = a - 2 * b + c;
    const delta = den !== 0 ? (0.5 * (a - c)) / den : 0;
    const f = ((k + delta) * sampleRate) / n;
    if (f < fmin || f > fmax) continue;
    const pc = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
    out[pc] += m * m;
  }
  return out;
}

// Energía en una banda (para el bombo: bajo 150 Hz).
function bandEnergy(mags, sampleRate, f0, f1) {
  const n = mags.length * 2;
  let e = 0;
  for (let k = Math.max(1, Math.floor((f0 * n) / sampleRate)); k <= Math.min(mags.length - 1, Math.ceil((f1 * n) / sampleRate)); k++) e += mags[k] * mags[k];
  return e;
}

// Detector de ataques por flujo espectral (rectificado, con compresión logarítmica) y selección de picos:
// un cuadro es ataque si su flujo es máximo local, supera mediana + delta · MAD de la historia reciente y
// pasaron al menos `minGapFrames` cuadros desde el anterior. Responde con un cuadro de retraso
// (devuelve `onset` del cuadro previo, `lag = 1`).
// Ajustado con señales sintéticas (bombo grave + clic): log1p(10·m) y umbral máx(mediana + delta·MAD, 0,2 · máximo
// reciente) detectan 31 de 32 ataques; el ataque real cae ≈ 0,4 cuadros antes del final del cuadro pico.
// Además el flujo relativo (flujo / energía logarítmica del cuadro) debe superar `minRel`: un acorde sostenido
// produce batidos con flujo relativo ≤ 0,07 y los golpes de batería sobre ese acorde, ≥ 0,24.
function createOnsetDetector({ history = 43, delta = 3, minGapFrames = 6, floor = 1e-3, relMax = 0.2, minRel = 0.12 } = {}) {
  let prevMags = null;
  const hist = [];
  let last2 = 0;
  let last1 = 0;
  let last1Rel = 0;
  let since = minGapFrames;
  return {
    lag: 1,
    feed(mags) {
      let flux = 0;
      let eCur = 0;
      let ePrev = 0;
      if (prevMags) {
        for (let k = 0; k < mags.length; k++) {
          const a = Math.log1p(10 * mags[k]); const b = Math.log1p(10 * prevMags[k]);
          if (a > b) flux += a - b;
          eCur += a; ePrev += b;
        }
      }
      const rel = flux / (Math.max(eCur, ePrev) + 1e-9);
      prevMags = mags;
      const sorted = hist.slice().sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      const mad = sorted.length ? sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] : 0;
      const thr = Math.max(med + delta * Math.max(mad, floor) + floor, relMax * Math.max(0, ...hist));
      since += 1;
      // ¿el cuadro anterior fue un pico?
      const onset = hist.length >= 4 && last1 > thr && last1 > last2 && last1 >= flux && last1Rel > minRel && since > minGapFrames;
      if (onset) since = 0;
      hist.push(flux);
      if (hist.length > history) hist.shift();
      last2 = last1;
      last1 = flux;
      last1Rel = rel;
      return { flux, rel, onset };
    },
  };
}

// Igual que el anterior pero sobre la energía de una banda (bombo).
function createBandDetector({ history = 24, ratio = 2.2, minGap = 4, floor = 1e-6 } = {}) {
  const hist = [];
  let since = minGap;
  let prev = 0;
  return {
    feed(energy) {
      const sorted = hist.slice().sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
      since += 1;
      const rising = energy > prev * 1.5;
      const onset = hist.length >= 4 && rising && energy > ratio * med + floor && since >= minGap;
      if (onset) since = 0;
      prev = energy;
      hist.push(energy);
      if (hist.length > history) hist.shift();
      return { energy, onset };
    },
  };
}

// Escucha de una pista: se alimenta con cuadros y su posición en negras; resume en el formato de analysis.js.
function createListener({ sampleRate = 44100, frameSize = 2048, hopSize = 512, chromaHalfLife = 4, bars = 8, barBeats = 4, kickHz = 150, sensitivity = 3 } = {}) {
  const onsets = createOnsetDetector({ delta: sensitivity });
  const kicks = createBandDetector({});
  const chr = new Array(12).fill(0);
  const hits = []; // { beat, kind: 'onset'|'kick' }
  let level = 0;
  let lastBeat = null;
  let firstBeat = null;
  // los primeros cuadros solo llenan la historia de los detectores: sin ella, la cola del primer golpe se
  // confunde con un ataque tardío (visto con señales sintéticas: falso ataque a 0,29 negras)
  const WARMUP = 16;
  let frames = 0;
  return {
    // samples: cuadro de frameSize muestras; beat: posición del transporte (negras) del final del cuadro
    feed(samples, beat) {
      const mags = magnitudes(samples);
      const c = chroma(mags, sampleRate);
      const dt = (samples.length / sampleRate);
      const decay = Math.pow(0.5, dt / chromaHalfLife);
      for (let i = 0; i < 12; i++) chr[i] = chr[i] * decay + c[i];
      let rms = 0;
      for (let i = 0; i < samples.length; i++) rms += samples[i] * samples[i];
      level = 0.8 * level + 0.2 * Math.sqrt(rms / samples.length);
      const o = onsets.feed(mags);
      const k = kicks.feed(bandEnergy(mags, sampleRate, 30, kickHz));
      // el detector responde un cuadro tarde (lag) y el ataque cae ≈ 0,4 cuadros antes del final de ese cuadro
      const beatsPerSample = (this.bpm || 120) / 60 / sampleRate;
      const at = beat === null || beat === undefined ? null : beat - (hopSize + 0.4 * samples.length) * beatsPerSample;
      frames += 1;
      if (at !== null) {
        if (o.onset && frames > WARMUP) hits.push({ beat: at, kind: 'onset' });
        if (k.onset && frames > WARMUP) hits.push({ beat: at, kind: 'kick' });
        lastBeat = beat;
        if (firstBeat === null) firstBeat = beat;
        const keep = lastBeat - bars * barBeats;
        while (hits.length && hits[0].beat < keep) hits.shift();
      }
      return { onset: o.onset, kick: k.onset, flux: o.flux };
    },
    bpm: 120,
    summary(name = '') {
      const occ = (kind) => {
        const steps = new Array(16).fill(0);
        if (lastBeat === null) return steps;
        const seen = new Set();
        for (const h of hits.filter((x) => kind === 'any' || x.kind === kind)) {
          const bar = Math.floor(h.beat / barBeats);
          const s = Math.round(((h.beat - bar * barBeats) / barBeats) * 16) % 16;
          seen.add(`${bar}:${s}`);
        }
        // compases efectivamente escuchados (no los de la ventana completa si aún no se llenó)
        const heard = lastBeat - Math.max(firstBeat, lastBeat - bars * barBeats);
        const nbars = Math.max(1, Math.min(bars, Math.round(heard / barBeats)));
        for (const key of seen) steps[Number(key.split(':')[1])] += 1;
        return steps.map((v) => +Math.min(1, v / nbars).toFixed(3));
      };
      const total = chr.reduce((s, v) => s + v, 0) || 1;
      return {
        name, kind: 'audio', level: +level.toFixed(4),
        chroma: chr.map((v) => +(v / total).toFixed(4)),
        occupancy: occ('onset'), kick: occ('kick'),
        onsets: hits.filter((h) => h.kind === 'onset').length, kicks: hits.filter((h) => h.kind === 'kick').length,
        bars, updatedBeat: lastBeat,
      };
    },
  };
}

module.exports = { fft, hann, magnitudes, chroma, bandEnergy, createOnsetDetector, createBandDetector, createListener };
