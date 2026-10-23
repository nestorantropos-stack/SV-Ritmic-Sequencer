'use strict';
// Microtiempo: swing dependiente del tempo (§4.9), rejilla deformable (§4.10), humanizador browniano (MIC.4),
// fase y polimetría (§4.7).
const { clamp, lcmAll, mod } = require('./util');

// MIC.1.1 · §4.9. La curva es una aproximación de diseño [I]; coeficientes calibrables de oído.
function effectiveSwingRatio(ratio, bpm, coupling = 0) {
  return 1 + (ratio - 1) * clamp(1 - (coupling * (bpm - 90)) / 120, 0, 1);
}

// Desplazamiento de la unidad impar, en fracción de la unidad de swing: (r/(1+r) − 0.5) · 2 = (r−1)/(r+1).
const swingOddOffset = (ratioEff) => (ratioEff / (1 + ratioEff) - 0.5) * 2;

// Desplazamiento en pasos de cada ataque para un swing aplicado a unidades de `unitSteps` pasos
// (unitSteps = 1 para semicorchea en rejilla de 16, 2 para corchea).
function swingOffsets(onsets, unitSteps, ratioEff) {
  const off = swingOddOffset(ratioEff) * unitSteps;
  return onsets.map((s) => (s % unitSteps === 0 && Math.floor(s / unitSteps) % 2 === 1 ? off : 0));
}

// MIC.3 · §4.10. Posición (0..1 del ciclo) del inicio de cada paso.
function gridPositions(stepDurations) {
  const total = stepDurations.reduce((s, d) => s + d, 0);
  const out = [];
  let acc = 0;
  for (const d of stepDurations) { out.push(acc / total); acc += d; }
  return out;
}

// Rejilla deformable desde proporciones de pulso (p. ej. telespringar [0.38,0.34,0.28]) con
// `stepsPerBeat` pasos iguales dentro de cada pulso.
function gridFromBeatProportions(props, stepsPerBeat) {
  const durations = [];
  for (const p of props) for (let i = 0; i < stepsPerBeat; i++) durations.push(p / stepsPerBeat);
  return gridPositions(durations);
}

const timeOfStep = (i, positions, barStart, barLen) => barStart + positions[mod(i, positions.length)] * barLen + Math.floor(i / positions.length) * barLen;

// MIC.4 · humanizador con ruido browniano: la desviación respira en lugar de saltar.
// Devuelve desplazamientos en ms; sigma = desviación típica objetivo, drift 0..1 (0 = ruido blanco).
function brownianOffsets(count, rng, { sigmaMs = 6, biasMs = 0, drift = 0.7 } = {}) {
  const out = [];
  let x = 0;
  const innov = Math.sqrt(1 - drift * drift);
  for (let i = 0; i < count; i++) {
    x = drift * x + innov * rng.gauss();
    out.push(biasMs + sigmaMs * x);
  }
  return out;
}

const msToBeats = (ms, bpm) => (ms / 1000) * (bpm / 60);

// §4.7
const phaseTempo = (tempoA, drift) => tempoA * (1 + drift);
const polymeterStep = (globalStep, layerLen) => mod(globalStep, layerLen);
const realignLength = (layerLens) => lcmAll(layerLens);

// MET.1 · un nivel con intervalos < 100 ms se percibe como textura.
const isTextureRate = (stepValueBeats, bpm) => (stepValueBeats * 60000) / bpm < 100;

module.exports = {
  effectiveSwingRatio, swingOddOffset, swingOffsets, gridPositions, gridFromBeatProportions, timeOfStep,
  brownianOffsets, msToBeats, phaseTempo, polymeterStep, realignLength, isTextureRate,
};
