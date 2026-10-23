# SV Listen · Diseño

Dispositivo compañero de **SV Ritmic Sequencer** que aporta información de las **pistas de audio** al modo Adaptable y a Sugerir. La fase A está implementada (D-051, D-052); la fase C queda para después.

## 1. Opciones evaluadas

| Vía | Qué aporta | Límites | Decisión |
|---|---|---|---|
| **A · Audio Effect compañero en tiempo real** (`SV Listen.amxd` en cada pista de audio) | Croma (12 clases de altura), ataques por paso del compás, banda grave (bombo), nivel | Solo mientras suena; precisión limitada en material polifónico; consume CPU por pista | **Implementada** |
| **B · Propiedades del clip por la Live API** | Nombre, `file_path`, BPM y marcadores de warp, posición en el arreglo | No da notas ni alturas; el nombre solo sugiere género | Se usa ya como contexto de nombres en Sugerir; los marcadores sirven a la vía C |
| **C · Análisis del archivo del clip** (leer `file_path` a un `buffer~` y analizarlo sin tiempo real) | Croma y ataques de todo el clip sin reproducirlo | Hay que mapear muestras a negras con los marcadores de warp; archivos largos cuestan memoria y tiempo; clips congelados o sin archivo | **Segunda fase**, tras A |

## 2. Fase A · Arquitectura

```
Pista de audio ─► [plugin~] ─────────────────────────────► [plugout~]   (el audio pasa sin cambios)
                     │ mezcla mono
                     ▼
              [record~ ---sv_listen_buf @loop 1] ─► buffer~ circular de 2 s
                     │ posición (snapshot~)
[metro 20] ─► [plugsync~] (transporte, compás, tempo, negras) ─► [v8 sv_listen_v8.js] ─► [dict sv_listen] (global)
                                                                         │                      ▲
                                                                         ▼                      │
                                                              [v8ui sv_listen_ui.js]   SV Ritmic Sequencer (v8)
```

- **Por qué no `bonk~` / `sigmund~`:** el Max 9.1.5 incluido en Live no trae `bonk~`, `sigmund~` ni `fiddle~` (D-051). Todo el análisis se hace en JavaScript sobre el buffer, con el módulo puro `src/core/listen.js`, que se prueba en Node con señales sintéticas.
- **Comunicación:** todos los dispositivos Max for Live comparten un proceso de Max dentro de Live. El `[dict sv_listen]` tiene **nombre fijo** (sin el prefijo `---`, que lo haría local) y es visible desde SV Ritmic Sequencer. Cada SV Listen escribe su entrada con la clave del id de su pista (`this_device` → `canonical_parent`) y la borra al eliminarse.
- **Análisis por cuadro de 2048 muestras con salto de 512:**
  - *Espectro:* ventana de Hann y FFT radix-2.
  - *Croma:* picos del espectro entre 80 Hz y 5 kHz con frecuencia refinada por interpolación parabólica, plegados a 12 clases; decaimiento exponencial con vida media de 4 s.
  - *Ataques:* flujo espectral rectificado con compresión logarítmica; umbral adaptativo (mediana + «Sensibilidad» · MAD, y 0,2 del máximo reciente), flujo relativo > 0,12 y separación mínima de 6 cuadros.
  - *Bombo:* subida de la energía entre 30 Hz y «Bombo Hz» (150 por defecto) por encima de 2,2 veces la mediana reciente.
  - *Posición:* negra del transporte (`plugsync~`) menos lo que aún falta por leer del buffer, corregida por el retraso del detector; se cuantiza a 16 pasos del compás.
  - *Ocupación:* para cada paso, la fracción de los compases escuchados (hasta «Compases», 8 por defecto) con ataque; el mismo formato que `analysis.rhythmOccupancy`.
- **Formato en el dict:** `{ track, name, kind: 'audio', chroma: [12], occupancy: [16], kick: [16], level, onsets, kicks, bars, updatedBeat, updated, active }`, publicado cada 0,5 s.
- **Integración en el motor (D-052):** `controller.analyze()` lee `sv_listen` y añade cada pista de audio reciente (< 30 s) y activa: su croma suma al histograma de Krumhansl-Schmuckler con peso 0,5 frente al MIDI, su ocupación entra en la complementariedad y, si no hay bombo MIDI, su bombo alimenta «seguir bombo». Lo leído marca esas pistas como «audio».
- **Controles:** Escuchar (encendido/pausa), Sensibilidad (1–6), Bombo Hz (60–250), Compases (1–16). Vista de 300 × 169 con nivel, croma, ataques y bombo por paso.

## 3. Límites que se explicarán al usuario

- Solo analiza mientras la pista suena con el transporte en marcha: hay que reproducir unos compases antes de pulsar «Leer set».
- En mezclas densas la croma es aproximada; la tonalidad estimada debe tomarse como sugerencia (con corrección manual, ya disponible).
- Material con mucha reverberación o pads con ataque lento puede dar falsos ataques o perderlos; «Sensibilidad» sube o baja el umbral.
- El audio sin warp puede derivar respecto del tempo del set; la ocupación por paso supone audio con warp.
- Coste: una FFT de 2048 puntos cada 11,6 ms por pista, en el hilo de Max; «Escuchar» apagado detiene el análisis.

## 4. Fase C (análisis del archivo)

1. Leer `clip.file_path`, `warping` y los marcadores de warp por la Live API.
2. Cargar el archivo en un `buffer~` y analizarlo en bloques fuera de tiempo real con el mismo `src/core/listen.js`.
3. Mapear segundos a negras con los marcadores de warp (interpolación lineal entre marcadores).
4. Guardar el resultado en el mismo `dict sv_listen` con `source: 'file'`.

## 5. Pruebas

- Automáticas (`tests/listen.test.js`): FFT de un seno; croma y tonalidad de La menor (A3, C4, E4); bombo en las negras y ataques en cada corchea, solos y mezclados con un acorde sostenido; Adaptable con audio (bombo de audio, peso del croma, audio en silencio); controlador con resúmenes recientes y viejos; patch del dispositivo; script v8 con Max simulado (buffer circular, dict compartido, pausa y borrado); vista.
- Manuales: PM-032 a PM-035 en `docs/PRUEBAS_MANUALES.md`.
