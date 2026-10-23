# Cambios

## Sin publicar
### SV Listen · fase A
- Nuevo Audio Effect `SV Listen` (`node tools/build_listen.js --install`): el audio pasa sin cambios; la mezcla mono se graba en un `buffer~` circular y el `v8` la analiza (croma, ataques, bombo, nivel) con `src/core/listen.js`, sin `bonk~` ni `sigmund~`, que no vienen en el Max de Live (D-051).
- Publica un resumen por pista en el `dict sv_listen` global; SV Ritmic Sequencer lo usa en Adaptable y Sugerir: croma con peso 0,5 frente al MIDI, ocupación en la complementariedad y bombo de audio cuando no hay bombo MIDI (D-052).
- Vista de 300 × 169 (nivel, croma, ataques y bombo por paso) y controles Escuchar, Sensibilidad, Bombo Hz y Compases.
- 82 pruebas automáticas en verde (8 nuevas con señales sintéticas y Max simulado); casos manuales PM-032 a PM-035.

## 0.5.0 · 17-10-2026
### Fase 0
- Reconocimiento del entorno: Live 12.4.6 Suite, Max 9.1.5 integrado, Node 24.
- Estudio del formato `.amxd` sobre archivos reales del equipo.
- Estructura de carpetas, registro de decisiones y plan de fases.

### Ajuste del plan
- Nueva base de conocimiento: `docs/clasificacion_ritmica_reggae_dub_steppers.md` (rama `RGG`).
- Lector MIDI propio y analizadores de corpus (`tools/lib/smf.js`, `tools/corpus_*.js`).
- Análisis de 478 MIDI de referencia (DDT, Dub, Latin) en `docs/analisis_corpus_midi.md`, con medidas en `data/corpus/`.
- Nuevas categorías: Chords › Dub Techno y Dub / Reggae; Hi-hats y Ethnic drums › Dub / Reggae y Latin percussion.

### Fase 1 · Núcleo y datos
- `data/taxonomy.json`: 10 ejes (MET, ACE, SUP, MIC, CIC, PRO, FOR, COG, GRV, RGG), 217 nodos con definición, estatus y parámetros; colores por eje; destinos y categorías por destino.
- `data/patterns/`: 14 familias, 135 patrones (133 públicos), 35 marcados para verificar y 24 entradas editables con datos faltantes.
- `data/scales.json` (55 escalas), `data/drum_maps.json` (12 mapas), `data/microtiming.json` (8 plantillas) y esquemas JSON en `data/schema/`.
- `src/core/`: euclidiano, pesos métricos, aksak, tala carnática, tihai, síncopa y mutación hacia objetivo, polirritmia, polimetría, fase, irama, swing dependiente del tempo, rejilla deformable, humanizador browniano, hoquetus, kotekan, jo-ha-kyū, transformaciones (rotate, reverse, complement, density, phase, binarize), normalizador de patrones y catálogo con búsqueda y filtros.
- 27 pruebas automáticas (`npm test`) en verde.

### Fase 2 · Generadores por destino
- Motor común (`src/core/engine.js`): transformaciones permitidas, síncopa objetivo, repeticiones según `repeat_policy` (fijas, ciclo completo, mcm, tihai, gongan), variación final, swing de capa y global, plantillas de microtiempo, rejilla deformable, humanizador browniano, matriz de acento, rango de velocity, bloqueo por capa, variar y cierre limpio del bucle.
- Armonía (`src/core/harmony.js`): escalas en registro, grados, acordes por terceras de la escala, inversiones y conducción de voces.
- Destinos: Chords (Dub Techno, Dub / Reggae, progresión, anticipación, colchón, eco), Bassline (grados por acento, tumbao, one drop, moroder, seguir bombo), Arpeggio (direcciones, ciclos de 3/5/7, entrelazado), Hi-hats (capas, corte del abierto, redobles, pedal, contratiempo abierto), Ethnic drums (mapas por tradición) y Others (notas libres, deriva por grados).
- 18 ejemplos de salida en `build/examples/*.mid` y `docs/ejemplos_generadores.md` (`node tools/render_examples.js`).
- 41 pruebas automáticas en verde, incluidas pruebas de propiedades sobre más de 2000 combinaciones.

### Fase 3 · Integración con Live y modo Adaptable
- Análisis del set (`src/core/analysis.js`): histograma de alturas, Krumhansl-Schmuckler, escala de la biblioteca, ocupación rítmica, bombo y densidad por pista; traducción de la escala de Live 12.
- Complementariedad en el motor (ataques en los huecos del arreglo) y bajo alineado con el bombo leído.
- Puente con la Live API (`src/max/live_bridge.js`): pista propia, ranura destino segura, `create_clip`, `add_new_notes`, `remove_notes_extended`, `get_notes_extended`, escala y observadores, lectura de pistas y del arreglo.
- Controlador (`src/max/controller.js`) y script v8 (`src/max/sv_rs_v8.js`): armonía manual, Live 12, Adaptable y Random con semilla; generar, regenerar, variar, deshacer, rehacer, bloqueo por capa, catálogo.
- Bundle único para v8 (`tools/bundle.js`) y dispositivo de desarrollo `.amxd` (`tools/build_amxd.js`, `--install`).
- 56 pruebas automáticas en verde (Live API y entorno Max simulados); casos PM-001 a PM-014 para probar dentro de Live.

### Fase 4 · Interfaz
- Franja compacta de 860 × 169 px (`[v8ui sv_rs_ui.js strip]`): Destino con iconos, Armonía con modo, teclado de la escala y lectura del set, Ritmo con el círculo de Toussaint como constelación, taxonomía e insignias, Generar con regenerar, variar, deshacer, escucha previa, repeticiones y línea de repeticiones; ayudas en la línea de estado.
- Ventana del navegador (1000 × 700): árbol por ejes con migas de pan, tarjetas, detalle con definición, origen y fuentes, vista previa del clip, rejilla deformable, bloqueo de capas, buscador y controles de forma.
- Parámetros `live.*` automatizables como fuente de verdad; vista previa al instante; escucha previa por `midiformat`.
- Tema, cadenas (`src/ui/strings.es.json`), geometría y dibujo puros con backends `mgraphics` y SVG; maquetas en `docs/ui/` (`node tools/render_ui.js`).
- 68 pruebas automáticas en verde (contraste WCAG, cadenas, zonas de clic, v8ui en `mgraphics` simulado); casos PM-002 y PM-016 a PM-023.

### Fase 5 · Sugerir, preajustes, historial y pulido
- Sugerir: tres ritmos con razones según tempo, compás, huecos y síncopa del arreglo, nombres de pistas, dispositivos y clips, y variedad (`src/core/suggest.js`); superposición en la franja.
- Preajustes propios guardados con el set (`dict @embed 1`), con sincronía de los parámetros de Live; historial navegable; exportar .mid a la carpeta `exports` visible en el navegador; atajos de teclado en el panel.
- Correcciones de la primera sesión real: Semilla sin el tope de 256; Generar/Regenerar sin repetir el clip anterior; inicio automático tras una recarga en caliente; preset `.adv` en la instalación.
- 74 pruebas automáticas en verde; casos PM-025 a PM-031.

### Fase 6 · Empaquetado y documentación
- Versión 0.5.0; `npm run package` crea `build/release/SV_Ritmic_Sequencer_0.5.0.zip` con el dispositivo, sus scripts, la guía y las pruebas manuales.
- Guía de uso en español (`docs/GUIA_DE_USO.md`), README renovado, diseño de SV Listen (`docs/SV_LISTEN_DISENO.md`) e informe de estado (`docs/INFORME_FINAL.md`).
