# SV Ritmic Sequencer

MIDI Effect de Max for Live de **Sidera Visus** (Néstor Paredes Ulloa) que construye patrones rítmicos MIDI sobre la teoría musical, la musicología y la etnomusicología reunidas en [`docs/meta_analisis_ritmo_max4live.md`](docs/meta_analisis_ritmo_max4live.md) y [`docs/clasificacion_ritmica_reggae_dub_steppers.md`](docs/clasificacion_ritmica_reggae_dub_steppers.md), más un corpus MIDI de referencia medido ([`docs/analisis_corpus_midi.md`](docs/analisis_corpus_midi.md)).

Flujo en cuatro pasos (**Destino · Armonía · Ritmo · Generar**). El resultado se escribe como clip MIDI en la pista donde vive el dispositivo.

- Objetivo: Ableton Live 12.4+ con Max 9.1 (véase [`docs/DECISIONS.md`](docs/DECISIONS.md)).
- Versión: 0.5.0. Estado: Fases 0 a 5 completas en código y pruebas automáticas; Fase 6 (empaquetado y guía) hecha. Verificado en Live: carga, escritura de clips, escala de Live 12, modo Adaptable y generación desde la interfaz. Pendiente de prueba manual: el resto de la interfaz ([`docs/PRUEBAS_MANUALES.md`](docs/PRUEBAS_MANUALES.md)).

**Guía de uso:** [`docs/GUIA_DE_USO.md`](docs/GUIA_DE_USO.md).

## Contenido

| | |
|---|---|
| Taxonomía | 10 ejes (MET, ACE, SUP, MIC, CIC, PRO, FOR, COG, GRV, RGG), 207 conceptos con definición, estatus y parámetros (217 entradas con los ejes) |
| Ritmos | 135 patrones en 14 familias (133 públicos); 35 marcados para verificar; 24 entradas con datos faltantes, sin inventar |
| Escalas | 55 (modos, pentatónicas, menores y mayores alteradas, simétricas, maqamat aproximados, ragas, gamelan) |
| Mapas de percusión | 12 (Drum Rack, GM, hi-hats, latino, dub, dum/tak, tala, gamelan, flamenco, maracatu, candombe, janggu) |
| Algoritmos | euclidiano, pesos métricos, aksak, tala carnática, tihai, índice de síncopa y mutación hacia objetivo, polirritmia, polimetría, fase, irama, swing dependiente del tempo, rejilla deformable, humanizador browniano, hoquetus, kotekan, jo-ha-kyū; transformaciones rotate, reverse, complement, density, phase, binarize |
| Destinos | Bassline, Chords (con Dub Techno), Arpeggio, Hi-hats, Ethnic drums, Others |
| Live | escritura segura de clips, escala de Live 12, modo Adaptable (tonalidad Krumhansl-Schmuckler, ocupación, bombo), Sugerir, preajustes con el set, historial, exportar .mid, escucha previa |

## Estructura

```
data/        taxonomy.json, patterns/*.json, scales.json, drum_maps.json, microtiming.json, schema/, corpus/
src/core/    núcleo en JavaScript puro (CommonJS), sin dependencias de Max
src/max/     puente con la Live API, controlador, scripts v8 (motor) y v8ui (interfaz)
src/ui/      tema, cadenas (strings.es.json), geometría, dibujo (mgraphics y SVG), franja y panel
tools/       build_amxd, bundle, make_adv, package, analizadores de corpus, ejemplos y maquetas
tests/       pruebas con node:test (Live API, Max y mgraphics simulados)
docs/        informes, DECISIONS, PRUEBAS_MANUALES, GUIA_DE_USO, análisis del corpus, SV Listen, maquetas ui/
build/       salida: device/, examples/, release/
```

## Desarrollo

```bash
npm install
```

```bash
npm test
```

Construir e instalar el dispositivo en la User Library (`Presets/MIDI Effects/Max MIDI Effect/SV Ritmic Sequencer`):

```bash
npm run install-device
```

Paquete de distribución (`build/release/*.zip`):

```bash
npm run package
```

Maquetas de la interfaz (mismo código de dibujo que en Live, en `docs/ui/`) y ejemplos MIDI (`build/examples/`):

```bash
npm run mockups
```

```bash
npm run examples
```

Añadir un ritmo es añadir o editar un archivo en `data/patterns/` (esquema en `data/schema/pattern_family.schema.json`) y reconstruir: las pruebas validan el esquema, la taxonomía, las referencias cruzadas y las reglas de honestidad del contenido.

## Ética de uso

Cada patrón conserva su tradición, función y fuentes. El repertorio ceremonial (kultrún, nyabinghi) queda fuera de las listas y solo se ofrece como principio estructural con nota de contexto. Los datos que las fuentes declaran faltantes se dejan como entradas para verificar, no se inventan.

## Dispositivos y privacidad

Los dispositivos construidos están en `dist/SV Ritmic Sequencer/` y `dist/SV Listen/`. Copia cada carpeta completa a tu User Library. SV Listen se instala como Audio Effect.

Esta publicación incluye las correcciones de recarga en caliente y SV Listen. Véase [publicación y privacidad](docs/PUBLICACION_PRIVACIDAD.md). Las mediciones detalladas del corpus son privadas y no se incluyen.
