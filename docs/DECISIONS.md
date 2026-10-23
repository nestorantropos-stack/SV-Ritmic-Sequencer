# Registro de decisiones · SV Ritmic Sequencer

Cada entrada indica qué se decidió, por qué y cómo se verificó. Estado: **verificado** (comprobado en el equipo o por prueba automática), **supuesto** (apoyado en documentación o experiencia, pendiente de prueba manual en Live) o **abierto**.

---

## Fase 0 · Reconocimiento del entorno (17-10-2026)

### D-001 · Versión objetivo: Live 12.4.6 Suite + Max 9.1.5 (integrado)
- **Hallazgo (verificado):**
  - `C:\ProgramData\Ableton\Live 12 Suite\` contiene la instalación de Live (no `C:\Program Files\Ableton`, que solo tiene el driver USB).
  - Preferencias en `%APPDATA%\Ableton\Live 12.4.6` → versión de Live **12.4.6**.
  - Max integrado: `Resources\Max\Max.exe`, `FileVersion 9.1.5`. No hay un Max independiente en `Program Files\Cycling '74`.
  - Carpetas de usuario: `Documents\Max 9\` (con `Max for Live Devices`, `Library`, `Packages`) y `Documents\Ableton\User Library\`.
  - Herramientas: Node 24.22.0, git 2.56, Python 3.15.
- **Decisión:** el dispositivo apunta a **Live 12.4+ con Max 9.1**. Se usa `v8`/`v8ui` (disponibles en Max 9, documentados en `refpages/max-ref/v8.maxref.xml` y `v8ui.maxref.xml`) y no el `js` heredado. Se aprovechan las propiedades de escala de Live 12.

### D-002 · Formato `.amxd` estudiado sobre archivos reales
- **Hallazgo (verificado con `xxd` y lectura en Python):**
  - `.amxd` sin congelar (por ejemplo `Sidera_WaveSeq.amxd`, creado por un script tuyo anterior y que carga en Live):
    ```
    "ampf" u32le(4) <tipo 4 bytes> "meta" u32le(4) u32le(0) "ptch" u32le(N) <JSON del patcher + "\n\0">
    ```
    `tipo` = `mmmm` (MIDI Effect, comprobado en los MIDI Effects de fábrica), `iiii` (instrumento), `aaaa` (audio). N incluye el `\n\0` final.
  - Los dispositivos de fábrica usan el bloque `ciph` (cifrado): no sirven como referencia.
  - `Producer_Pal.amxd` (congelado) usa `meta = 7` y un contenedor `mx@c` con dependencias incrustadas. No se replica ese formato.
- **Decisión:** `tools/build_amxd.js` (Node, misma cadena que las pruebas) genera el `.maxpat` desde una especificación legible y empaqueta un `.amxd` **sin congelar** con la cabecera anterior. El congelado (para distribuir un único archivo con el JS dentro) se hace desde Max con el botón *Freeze Device*; queda como paso manual documentado. Se entrega siempre también el `.maxpat`.
- **Referencia útil:** `User Library\Presets\Instruments\Max Instrument\Sidera WaveSeq\herramientas\generar_patches*.py` ya resolvía cajas, parámetros `live.*` (`parameter_longname`, `parameter_type`, `parameter_enum`, …), `presentation_rect` y `devicewidth`. Se reaprovecha el método, no el código.

### D-003 · Núcleo en CommonJS puro, empaquetado en un único archivo para Max
- **Hallazgo (verificado en la guía local `userguide/content/javascript.json`):** `v8` admite `require("archivo.js")` y espera módulos **CommonJS** (`exports` / `module.exports`). Sin DOM; temporizadores vía `Task`.
- **Decisión:**
  - `src/core/` se escribe en CommonJS sin dependencias de Max, probado en Node con `node:test`.
  - Para no depender de cómo `v8` resuelve rutas de `require` dentro de un dispositivo (búsqueda por *search path*, no por ruta relativa; riesgo de colisión de nombres con otros dispositivos), el build genera **un único archivo** `build/sv_rs_engine.js` que concatena los módulos del núcleo y **los datos JSON incrustados**. El adaptador `src/max/` lo carga con un solo `require` de nombre único (`sv_rs_engine`).
  - Estado: **supuesto**; la carga en `v8` se comprueba en la prueba manual PM-001.

### D-004 · Datos como fuente única, incrustados en el build
- **Decisión:** `data/*.json` es la fuente de verdad. La interfaz y el motor leen esos datos; añadir un ritmo = añadir o editar un archivo en `data/patterns/` y reconstruir. Los patrones del usuario viven en un `dict` con `@embed 1` (se guardan con el set).
- **Validación:** esquemas JSON en `data/schema/` y prueba automática con `ajv` (dependencia solo de desarrollo; si no se puede instalar, validador propio mínimo en `tools/`).

### D-005 · Interfaz: franja compacta + ventana ampliada
- **Supuesto:** la vista de dispositivo de Live da ~169 px de alto útil. La franja usa ese alto con los cuatro módulos en fila.
- **Decisión:** el navegador completo, el detalle y las visualizaciones grandes van en un subpatcher que se abre como ventana flotante (`[pcontrol]` → `open`, o `[thispatcher]` → `front`), dibujado con `v8ui` + `mgraphics`. Se verifica en PM-002.

### D-006 · Escritura de clips por Live API desde `v8`
- **Decisión:** el adaptador obtiene la pista propia con `this_device` → `canonical_parent`, elige la ranura de clip (seleccionada o primera vacía), crea el clip con `create_clip(length)`, fija `looping`/`loop_end` y escribe con `add_new_notes` (`pitch`, `start_time`, `duration`, `velocity`, `probability`, `velocity_deviation`, `mute`).
- **Microtiempo:** se escribe directamente en `start_time` (fracciones de negra). Un ataque anticipado en el paso 0 se envuelve al final del bucle para que el ciclo cierre limpio.
- **Restricción conocida:** `LiveAPI` no se puede instanciar en el código global al cargar; se inicializa tras `live.thisdevice`. Estado: **supuesto** → PM-003.

### D-007 · Lectura de escala de Live 12
- `live_set` → `root_note`, `scale_name`, `scale_mode`, `scale_intervals`, con observadores para sincronizar con interruptor. Estado: **supuesto** → PM-004.

### D-008 · Verificación asistida dentro de Live con Producer Pal
- **Hallazgo:** en tu User Library está `Producer_Pal.amxd` y en esta sesión hay herramientas MCP de Producer Pal conectables a Live (leer set, leer y crear clips).
- **Decisión:** en la Fase 3, con Live abierto y tu permiso, se usarán para **leer** los clips que genere SV Ritmic Sequencer y comparar notas con la salida del núcleo. Complementa, sin sustituir, la lista de pruebas manuales.

### D-009 · Cuartos de tono
- La API de clips de Live trabaja con alturas MIDI enteras. Los maqamat se entregan en **aproximación de 12 notas** con la desviación en cents como metadato. La opción de cuartos de tono (vía expresión MPE por nota o pitch bend) queda **abierta** hasta comprobar qué expone la API de notas en Live 12.4.

### D-010 · Estructura de carpeta
- Se adopta la sugerida. El informe se movió a `docs/meta_analisis_ritmo_max4live.md`. Se añade `data/schema/` para los esquemas.

### D-011 · Idioma
- Español por defecto; todas las cadenas visibles en `src/ui/strings.es.json`.

---

## Ajuste del plan (17-10-2026): reggae, dub, dub techno y percusión latina

### D-012 · Segunda base de conocimiento: familia reggae (`RGG`)
- `docs/clasificacion_ritmica_reggae_dub_steppers.md` se suma como fuente de verdad, con el mismo formato de IDs y estatus. La taxonomía gana una rama **`RGG` · Reggae, dub y derivados** en el navegador (Paso 3), además de los ocho ejes y `GRV`.
- Se respetan sus decisiones de diseño: dos presets de rockers (`RGG.3.2a` y `RGG.3.2b`), `skank_mode` con dos valores, campo `attributions[]`, `bpm_range` con `verify`, y nyabinghi, burru y kumina con `restricted_use: true` y solo como principio estructural.

### D-013 · Corpus MIDI de referencia y nuevo estatus `[C]`
- Se analizaron 478 `.mid` de tus carpetas DDT, Dub y Latin MIDI drums con herramientas propias (`tools/lib/smf.js`, `tools/corpus_*.js`). Hallazgos en `docs/analisis_corpus_midi.md`; medidas en `data/corpus/`.
- **Estatus `[C]`** = medido en corpus. Se muestra en la interfaz con su propia insignia (distinta de `[V]`). Un patrón `[C]` que lleva nombre de estilo sin fuente (por ejemplo «bossa nova») se marca además `verify: true`.
- **Licencia:** el repositorio guarda solo medidas derivadas, nunca los `.mid`. Las rutas locales viven en `tools/corpus_sources.json`, y `node tools/corpus_build.js` regenera las medidas.

### D-014 · Nuevas categorías por destino
| Destino | Categoría nueva | Contenido | Fuentes |
|---|---|---|---|
| **Chords** | **Dub Techno** | stabs de tríada fija sobre el I, 1 compás, 2–5 ataques, stab ≈ 1/8, peso en los pasos 0 / 6 / 8 / 10 / 14, swing de semicorchea ≈ 62 % conmutable, colchón opcional, delay a corchea con puntillo como metadato | `RGG.10.2`, `GRV.14`, `PRO.19`, corpus DDT Chords + Dub |
| **Chords** | **Dub / Reggae** | chop 2-4, skank en contratiempo, double skank, bubble de órgano, strum (`[V]`) | `RGG.6`, corpus Dub |
| **Hi-hats** | **Dub / Reggae** (con subcategorías) | corcheas, corcheas con swing, contratiempo, semicorcheas digitales, negras de pedal, doble semicorchea, tresillos laid-back, abierto en contratiempo, flying cymbal (`[V]`); percusión menor (shaker, pandereta, woodblock, aro) | `RGG.4`, `RGG.7`, corpus Dub |
| **Ethnic drums** («percusiones») | **Dub / Reggae** | one drop, rockers a/b, steppers, half-step/dubstep, dembow, nyabinghi como principio de tres roles (restringido) | `RGG.3`, `RGG.10`, `RGG.1.1`, corpus Dub |
| **Ethnic drums** | **Latin percussion** | claves y tresillo del informe; bombo de bossa/baião, cross-stick de bossa, cencerro, campana, güiro, congas abierta/apagada/grave, agogó, timbal, bongó, cabasa, maracas, triángulo; métricas 6/8, 9/8 y 12/8 | `CIC.3`, `CIC.6`, corpus Latin |
| **Hi-hats** | **Latin percussion** (capas agudas) | ride/cabasa en corcheas, maracas en negras, campana en contratiempo, shaker | corpus Latin |
| **Bassline** | **Dub** y **Dub Techno** | bajo con espacio y drop-outs; contratiempo de dub techno con swing | `RGG.5`, corpus DDT Bass |

- `drum_maps.json` incorpora un preset **General MIDI de percusión** (latina) y un preset **Dub kit** (kick, rim, snare, hat cerrado/abierto/pedal, shaker, pandereta, woodblock, conga, tom), editables.

### D-015 · Orden de trabajo ajustado
- Las categorías nuevas entran en la **Fase 1** como datos (`data/patterns/reggae_family.json`, `dub_techno.json`, `latin_percussion.json`) y en la **Fase 2** como estilos de generador. El primer destino que se cierra completo de punta a punta (núcleo → clip en Live) será **Chords › Dub Techno**, porque reúne informe, corpus medido y tu estilo de producción.

---

## Fase 1 · Núcleo y datos (17-10-2026)

### D-016 · `gate` en negras
- El informe no fija la unidad del `gate`. Leídos como fracción de negra, sus valores coinciden con el corpus (skank 0,2 negra = 0,8 semicorcheas; el corpus da 0,4–0,9). Se adopta **gate = duración en negras**, la misma unidad que usa `add_new_notes` de Live.

### D-017 · Corrección del pseudocódigo de pesos métricos (§4.2)
- El pseudocódigo literal asigna peso 0 también al paso 8 de 16. La implementación hace del inicio del ciclo el nivel 0 y resta 1 por nivel, con lo que reproduce exactamente los pesos de Longuet-Higgins y Lee de `COG.3.1` (prueba automática).

### D-018 · Convención del tihai (§4.5)
- Se conserva la fórmula `start = (cycle − (3P + 2G) mod cycle) mod cycle`. `P` cuenta los pasos de cada frase sin el golpe de llegada, que cae en `start + 3P + 2G` ≡ sam. Prueba: la llegada cae en sam para ciclos de 7, 10, 12, 16 y 32 con todo P ≤ 9 y G ≤ 3.

### D-019 · Interpretación del índice de síncopa (§4.6)
- Leer solo el paso inmediato daría síncopa 0 a un contratiempo de corcheas. Se interpreta el «silencio de peso W» como la posición más fuerte entre el ataque y el siguiente ataque. `COG.3.2` sigue marcado `[V]` hasta contrastarlo con Witek et al.

### D-020 · Formato de datos ampliado
- Además del esquema del §1: `destinations`, `categories` (navegación por destino), `tags`, `bpm_range` (para Sugerir), `repeat_policy` (`fixed`, `cycles`, `lcm`, `tihai`, `gongan`), `missing_data`, `structural_only`, `cultural_note`, `corpus`, `fx` y `cycle_len` por capa (polimetría).
- `generator` sustituye a `layers` cuando el patrón es un procedimiento: `euclid`, `carnatic_tala`, `polyrhythm`, `weighted_steps` (stab de dub techno con los pesos del histograma del corpus).
- Los euclidianos se alinean con el primer ataque en el paso 0 cuando `rotation = 0` (más útil en un secuenciador); `align: "raw"` conserva la fórmula literal.
- Elecciones de diseño que no vienen de una fuente quedan anotadas en `notes` del patrón (bombo del trap, timbres de inicio de grupo en usul, golpe apagado y abierto del surdo).

### D-021 · Uso restringido en el catálogo
- `catalog.publicPatterns()` y `catalog.search()` excluyen todo patrón con `restricted_use`. Los que tienen `structural_only` (kultrún, nyabinghi) se ofrecen aparte con `structuralPrinciples()`, siempre con su `cultural_note`. Hay pruebas automáticas para ambas reglas.

### D-022 · Dependencias
- `ajv` **8.18.0**, fijada y solo para desarrollo: la 8.17.1 tiene un aviso de seguridad (ReDoS con `$data`). El núcleo no tiene dependencias en tiempo de ejecución.

---

## Fase 2 · Generadores por destino (17-10-2026)

### D-023 · Chords › Dub Techno
- Valores por defecto tomados del corpus DDT: **tríada del grado I en estado fundamental**, fija en todo el clip (sin progresión), raíz cerca de MIDI 60 (registro del corpus 57–66), stab de duración del patrón (≈ 1/8) y swing de semicorchea de 62 % con la plantilla `swing_16_62`.
- Opciones que no salen del corpus y se ofrecen como elección del usuario: cuatríada (`chordSize: 4`), colchón una octava bajo los stabs (`pad`) y notas de eco a corchea con puntillo (`echo`, PRO.19) para cuando la pista no tenga delay.
- El stab generativo (`weighted_steps`) elige 2–5 ataques con las probabilidades del histograma de 51 clips y repite el mismo compás en todo el clip («lazo estable»). Una opción para que evolucione compás a compás queda para la Fase 5.

### D-024 · Progresiones por defecto
- Dub techno: `[I]`. Dub / reggae: `[i, iv]` cada 2 compases en escalas de 7 notas. Resto: `[I, IV, V, I]` (grados 0, 3, 4, 0) cada 2 compases. Son decisiones de diseño editables (`progression`, `harmonicRhythmBars` = hipermetro de 1, 2, 4 u 8 compases).
- Los acordes apilan terceras **de la escala**: en pentatónicas dan acordes cuartales y en escalas simétricas, sus propias simetrías. Así todas las notas quedan dentro de la escala (prueba automática sobre más de 2000 combinaciones).

### D-025 · Variaciones finales
- `fill`: relleno creciente en el último pulso; `hat_triplet_fill`: tresillo de negra; `trap_roll`: fusas; `virada` y `density_up`: más densidad en la segunda mitad; `dropout`: silencio en la segunda mitad del último ciclo (RGG.8.2, el regreso es el inicio del bucle); `gong`: último gong a velocity máxima; `tihai`: tres frases que aterrizan en el sam del inicio del bucle (ciclo extra); `llamada`: el último compás conserva solo los acentos y remata en el 4.º acento.
- La `llamada` es una **aproximación de diseño** (no una transcripción): una llamada real tiene formas propias por palo.

### D-026 · Estilos de bajo
- `tumbao`: ataques en el «y» del 2 y en el 4, con el 4 anticipando el acorde siguiente (ACE.2.3). `one_drop`: pulso 1 vacío. `moroder`: semicorcheas continuas con alternancia raíz/octava como diseño; el contorno de *I Feel Love* sigue `[V]`. `external`: sigue tiempos de bombo de otra pista (los aportará la Fase 3).
- En dub techno el bajo usa casi solo la tónica (quinta 15 %, notas de paso 5 %, octava 15 %), como el corpus DDT (1–3 alturas por clip). Las notas de paso son siempre diatónicas.

### D-027 · Cierre del bucle y notas duplicadas
- Todo ataque anticipado antes de 0 pasa al final del clip; nada sobrepasa la longitud del clip. Dos capas que caen en la misma nota y el mismo instante (por ejemplo tali y matra en un mapa por timbre) se funden en una, con la velocity más alta.

### D-028 · Elección de mapa de percusión
- Por tradición: iqa'/usul → dum/tak; tala → tali/khali; jangdan → janggu; gamelan → colotómico; flamenco → palmas y cajón; categoría Latin percussion → General MIDI; familia RGG/dub → Dub kit; resto → Drum Rack. El usuario puede imponer cualquier mapa. Los roles sin nota reciben pads libres en orden de aparición.

---

## Fase 3 · Integración con Live y modo Adaptable (17-10-2026)

### D-029 · Arquitectura del adaptador
- `src/max/live_bridge.js` (puente con la Live API, recibe `LiveAPI` por inyección), `src/max/controller.js` (estado de los cuatro pasos, armonía, historial y bloqueo) y `src/max/sv_rs_v8.js` (script del objeto `v8`, solo traduce mensajes). El puente y el controlador se prueban en Node con una Live API simulada (`tests/helpers/fake_live.js`) que imita las respuestas de Max: listas planas, rutas entre comillas y diccionarios como cadena JSON.
- `tools/bundle.js` genera `sv_rs_engine.js` (núcleo, puente, controlador y datos, ~360 KB). Una prueba lo carga en un contexto aislado sin Node y comprueba que genera exactamente lo mismo que los módulos. Si un módulo del bundle usara `fs` o `path`, el build falla.
- Estado: **supuesto** hasta PM-001 (carga del `require` en el `v8` real).

### D-030 · Dónde se escribe el clip
- Primero la ranura seleccionada (`live_set view highlighted_clip_slot`) si es de la pista propia y está vacía; si no, la primera ranura vacía; si no hay ninguna, se crea una escena al final.
- **Regla de seguridad:** solo se reescriben clips cuyo nombre empieza por `SV · `. Un clip del usuario nunca se modifica (prueba automática y PM-009).
- Regenerar, variar, deshacer y rehacer reescriben la ranura de la última generación. El historial propio guarda las últimas 32 generaciones; los cambios hechos por la API también entran en el deshacer de Live (por verificar en PM-008).

### D-031 · Lectura del set
- Pistas MIDI (se omiten las de audio y la propia). Por pista: el clip en reproducción (`playing_slot_index`) o, si no hay, el primero con notas; opcionalmente los clips del arreglo (`arrangement_clips`). Las notas silenciadas se ignoran. Una pista es de percusión si tiene un `DrumGroupDevice` o si su nombre lo sugiere; el bombo son las notas 36/35.
- Estimación de tonalidad: Krumhansl-Schmuckler con perfiles de Krumhansl y Kessler sobre el histograma de clases de altura ponderado por duración, solo con las pistas no percusivas. Después se busca la escala de la biblioteca que mejor cubre el histograma con esa raíz; con evidencia ambigua se prefieren menor, mayor, dórico, mixolidio y pentatónicas.
- La escala de Live 12 se lee de `root_note`, `scale_intervals`, `scale_name` y `scale_mode`, y se traduce comparando intervalos con `scales.json`. La opción «sincronizar» observa esas propiedades.

### D-032 · Complementariedad (§6.2)
- La ocupación del arreglo se mide por compás en 16 pasos (fracción de compases con ataque en cada paso). Con `complement.amount`, cada ataque de la capa principal que cae en un paso ocupado (≥ 0,5) se mueve al paso libre más cercano (±1, ±2, ocupación ≤ 0,25). El inicio del ciclo nunca se mueve.
- Bassline en modo Adaptable sigue los tiempos del bombo leído (repetidos hasta cubrir el clip), con la opción `alignBassToKick`.
- La interfaz muestra lo leído (tonalidad, confianza, escala, pistas, ocupación, bombo) y permite corregir la armonía a mano (`correct`).

### D-033 · Dispositivo de desarrollo
- `tools/build_amxd.js` genera ya un `.amxd` mínimo («SV Ritmic Sequencer dev») para validar en Live la carga del motor, la escritura de clips, la escala y el modo Adaptable antes de diseñar la interfaz (Fase 4). Sus menús envían índices (`destination_index`, `scale_index`, `pattern_index`…); el orden sale de los mismos datos que el bundle. Los mensajes que llegan antes de `init` esperan en cola.
- El MIDI de entrada pasa sin cambios (`midiin → midiout`): el dispositivo escribe clips y no filtra la pista.
- `--install` copia el `.amxd`, `sv_rs_v8.js` y `sv_rs_engine.js` a `User Library/Presets/MIDI Effects/Max MIDI Effect/SV Ritmic Sequencer/`, con los tres archivos juntos para que `v8` los encuentre en la ruta de búsqueda del dispositivo.

### D-034 · Audio (SV Listen), fase posterior
- Se mantiene el orden: primero MIDI (hecho). El diseño de `SV Listen` (Audio Effect con `sigmund~`/`fiddle~` para croma y `bonk~` u onsets, enviando datos por un `dict` o `send`/`receive` globales con nombre fijo dentro del mismo proceso de Live) se documentará en la fase posterior, con sus límites: el análisis es en tiempo real (hay que reproducir la pista), la latencia y los falsos onsets dependen del material, y no hay acceso a los archivos de audio de los clips desde la Live API más allá de propiedades (`file_path`, marcadores de warp, BPM).

### D-035 · Botones `live.text` (corrección tras la primera prueba en Live)
- Primera prueba real (17-10-2026): el dispositivo carga y el `v8` hace `require('sv_rs_engine.js')` sin errores (la línea de estado dice «Listo»), pero Generar no hacía nada.
- Causa: en modo botón, `live.text` envía un **bang** por la salida izquierda (refpage local `m4l-ref/live.text`), no un 1; el patcher lo filtraba con `[sel 1]`. Ahora el botón va directo al mensaje, y una prueba automática impide volver a filtrarlo.

### D-036 · Verificación en Live con Producer Pal y notas solapadas
- 17-10-2026, Live 12.4.6: tres clips escritos por el dispositivo dev se leyeron con Producer Pal y se compararon con la salida del núcleo con los mismos ajustes. Coinciden altura, posición (con swing), velocity, longitud y bucle.
- Diferencia encontrada: Live no admite notas de la misma altura solapadas y acorta la anterior. El núcleo ahora hace ese recorte en `finalizeNotes`, para que el clip escrito sea idéntico a lo generado; una prueba de propiedades lo comprueba en todas las combinaciones.

### D-037 · Modo Adaptable: elección de escala y ocupación (tras preparar PM-011)
- Con pocas clases de altura (Dm y Bb = Re, Fa, La, Sib) muchas escalas exóticas «cubren» todo y se elegía hirajōshi. Ahora la penalización por notas que no suenan es baja cuando suenan menos de 6 clases y hay una preferencia por los modos diatónicos coherentes con el modo estimado (menor → eólico, dórico, frigio…; mayor → jónico, mixolidio, lidio). Las cinco candidatas siguen disponibles para corregir.
- La ocupación se mide por pista con el bucle de su propio clip y se combina por máximo: un bombo de 1 compás junto a un clip de 4 ya no cuenta al 25 %.

### D-038 · Bajo Adaptable: seguir al bombo solo cuando el patrón es de pulso (tras PM-011)
- PM-011 funcionó: el bajo se alineó con el bombo y en Re menor. Pero así un «bajo en contratiempo» perdía su ritmo. `alignBassToKick` pasa a `auto` por defecto: sigue al bombo solo si al menos la mitad de los ataques del patrón caen en pulsos; si no, conserva el patrón y la complementariedad lo coloca entre los bombos.
- Para Bassline la complementariedad usa la ocupación del bombo, no la de todas las pistas (un hat agudo no compite con el bajo).
- El pulso 1 de cada compás tiene peso máximo al seguir al bombo, así que empieza en la raíz.

---

## Fase 4 · Interfaz (17-10-2026)

### D-039 · Arquitectura de la interfaz
- Módulos puros en `src/ui/` (tema, cadenas, geometría, contexto de dibujo, modelo, componentes, franja y panel) y un `v8ui` delgado (`src/max/sv_rs_ui.js`) que solo traduce `paint` y el ratón. El contexto de dibujo tiene dos backends: `mgraphics` (Max) y SVG. Las maquetas de `docs/ui/` (`node tools/render_ui.js`) salen **del mismo código** que se dibuja en Live.
- API usada y verificada en la guía local de Max 9: `mgraphics.init()`, `relative_coords = 0`, `autofill = 0`, `redraw()`; `onclick`, `ondblclick`, `ondrag`, `onidle`, `onidleout`, `onresize`; `jsarguments` para elegir franja o panel. La guía no documenta la rueda del ratón: las listas se desplazan arrastrando.

### D-040 · Parámetros como fuente de verdad
- Destino, Armonía, Raíz, Escala, Ritmo, Repeticiones y Semilla son `live.*` ocultos (automatizables, se guardan con el set y entran en el deshacer de Live). La interfaz no cambia el estado directamente: envía el índice al `live.*` (`p_destino 2`, …) y este avisa al motor. El motor responde con `state`, `harmony` y una **vista previa** (lo que escribiría Generar), que la interfaz dibuja.
- Los controles de forma (densidad, síncopa objetivo, microtiempo, humanizar, rango de velocity, complementariedad, seguir bombo) son `live.dial` / `live.menu` nativos en la ventana del navegador.

### D-041 · Franja y ventana
- Franja de 860 × 169 px con los cuatro pasos y una línea de estado que muestra la ayuda del elemento bajo el ratón (definición de cada concepto de la taxonomía, de cada insignia y de cada botón).
- Ventana flotante de 1000 × 700 px (`[p sv_rs_panel]` abierto con `pcontrol`): árbol por ejes con migas de pan, tarjetas con mini constelación e insignias, detalle con definición, origen, fuentes, notas por verificar y contexto cultural, vista previa del clip (piano roll, línea de repeticiones, rejilla deformable de la plantilla de microtiempo), bloqueo de capas, buscador nativo (`textedit`) y controles de forma. Si el filtro «Solo <destino>» oculta resultados, el panel lo dice.

### D-042 · Identidad visual y accesibilidad
- Fondo nocturno integrado con el tema oscuro de Live, acento celeste y lila, un color por eje (`taxonomy.json`) y el círculo de Toussaint dibujado como **constelación** (los ataques son estrellas). Fuente «Ableton Sans Medium» (las fuentes de Live están en `Resources/Fonts`); si Max no la encuentra usa la del sistema (por verificar en PM-016).
- Prueba automática de contraste WCAG: texto ≥ 7:1, texto secundario ≥ 4,5:1, colores de eje ≥ 3:1. Zonas de clic de 15–26 px.

### D-043 · Escucha previa
- El motor programa con `Task` las notas de la vista previa en bucle y las envía por `[midiformat] → [midiout]` al instrumento de la pista, sin escribir el clip. No es precisa a la muestra ni se sincroniza con el transporte: sirve para audicionar. Se detiene al pulsar de nuevo o al borrar el dispositivo.

### D-044 · Queda para la Fase 5
- Atajos de teclado, arrastrar el clip, preajustes propios, lista visible del historial y Sugerir.

### D-045 · Prueba de la interfaz sin presencia en el equipo (17-10-2026)
- El control de escritorio (computer use) necesita aprobar el acceso a Live en el propio equipo; sin nadie delante se deniega.
- Producer Pal solo carga presets (`.adv`/`.adg`), no un `.amxd`. `tools/make_adv.js` genera un `.adv` de MIDI Effect que apunta al `.amxd` instalado (estructura tomada de un `.adv` real), pero cargarlo por Producer Pal falló con «Live's browser stopped answering». Queda en la User Library para probarlo a mano (PM-024).
- Las pruebas de la interfaz (PM-002, PM-016 a PM-024) quedan pendientes de una sesión con alguien en el equipo o con el acceso de escritorio aprobado.

---

## Fase 5 · Sugerir, preajustes, historial y pulido (17-10-2026)

### D-046 · Hallazgos de la primera sesión real con la interfaz
- El dispositivo cargó en Live 12.4.6 y generó clips correctos desde la franja (Hi-hats › Flying cymbal: hat cerrado 42 y abierto 46 en sus pasos, relleno final), leídos con Producer Pal.
- **Semilla:** Live mostró el parámetro entero 1..9999 con máximo 256. Los enteros de Live se limitan a 256 valores: la semilla pasa a ser flotante con presentación entera y el motor la redondea. Una prueba impide crear enteros de más de 256 valores.
- **Generar repetido:** tres pulsaciones dieron tres clips idénticos (misma semilla). Ahora Generar y Regenerar nunca repiten el clip anterior: prueban la semilla siguiente (que queda visible en el parámetro Semilla) y, si el patrón es fijo, aplican una variación suave con aviso.

### D-047 · Recarga en caliente
- Los scripts usan `autowatch`: al reinstalar, Max los recarga dentro del dispositivo ya cargado y `live.thisdevice` no vuelve a disparar. El motor se inicia solo al cabo de un segundo si no recibió `init`.

### D-048 · Sugerir (§7)
- `src/core/suggest.js`: puntuación 0..1 por ritmo con pesos tempo 0,30 (rango `bpm_range`, también a medio o doble tiempo), compás 0,20 (mismo compás, ciclo compatible, birritmia, polimetría), complementariedad 0,25 (solape con la ocupación del arreglo, densidad y síncopa de la mezcla hacia el tramo medio de la curva en U invertida), género 0,20 (palabras de nombres de pistas, dispositivos y clips contra tradición, género, etiquetas y categorías, con alias como «ddt» → dub techno) y variedad 0,05 (penaliza lo usado hace poco). Excluye repertorio restringido y entradas con datos faltantes; evita tres propuestas de la misma familia si hay alternativas.
- Cada propuesta trae sus razones legibles. En el set de prueba (124 BPM, pistas «Chord Dub Pluck» y «5P_DDT_Bass»), Chords propone dub techno con «tempo 124 BPM dentro de 115–128 · mismo compás · llena huecos · el set sugiere dub, ddt».
- **Ruta del .als:** el puente intenta leer `live_set.file_path`; si Live no la expone queda en `null` (PM-025). La lectura en vivo ya aporta tempo, compás, pistas, dispositivos, clips y notas; leer el archivo solo añadiría lo que no está cargado en el set, así que no se usa.

### D-049 · Preajustes, historial y exportación
- Preajustes propios en `[dict ---sv_rs_presets @embed 1]` (se guarda con el set; `---` lo hace único por dispositivo). Guardan destino, armonía, ritmo, repeticiones, semilla, forma y capas bloqueadas. Al cargar uno, el motor devuelve los índices a los `live.*` (salida 4 → mismo route de la interfaz), para que automatización y restauración queden coherentes.
- Historial visible (últimas 32 generaciones) con vuelta a cualquiera.
- «Arrastrar el clip»: Max for Live no permite arrastrar MIDI desde un dispositivo. En su lugar, «Exportar .mid» escribe el clip en `…/SV Ritmic Sequencer/exports/` dentro de la User Library; desde ahí se arrastra en el navegador de Live (PM-027).
- Atajos en la ventana del panel con `[key]`: Mayús + G, R, V, Z, Y, P; flechas e Intro. Las letras exigen Mayús porque `[key]` también recibe lo que se escribe en el buscador.

### D-050 · Preset .adv
- La instalación escribe también `SV Ritmic Sequencer.adv`, que apunta al `.amxd`. Producer Pal no logró cargarlo; queda como alternativa en el navegador (PM-024).

### D-051 · SV Listen sin bonk~ ni sigmund~: buffer~ circular + análisis en JS
- El diseño inicial contaba con `bonk~` y `sigmund~`, pero el Max 9.1.5 incluido en Live no trae `bonk~`, `sigmund~` ni `fiddle~` (comprobado en `Resources/Max`). Un `pfft~` con un subpatcher exigiría además mandar 1024 bins por cuadro al JS.
- Se graba la mezcla mono de la pista en `[buffer~ ---sv_listen_buf 2000 1]` con `[record~ … @loop 1]`. Cada 20 ms un `[metro]` toma la posición de grabación (`snapshot~`), el transporte de `[plugsync~]` (salida 0 transporte, 4 compás, 5 tempo, 6 negras) y manda `tick` al `[v8 sv_listen_v8.js]`, que lee los cuadros nuevos con la API `Buffer` (2048 muestras, salto 512) y los analiza con `src/core/listen.js`: FFT radix-2, croma por picos con interpolación parabólica, ataques por flujo espectral y bombo por energía en 30 Hz–«Bombo Hz».
- La posición en negras de cada cuadro es la del transporte menos lo que aún falta por leer; el ataque se corrige por el retraso del detector (un salto) y 0,4 cuadros. Con el transporte detenido no se anotan ataques (solo croma y nivel).
- El detector de ataques exige además flujo relativo (flujo / energía logarítmica del cuadro) > 0,12: un acorde sostenido produce batidos de hasta 0,07 y los golpes sobre ese acorde, ≥ 0,24. Los primeros 16 cuadros (≈ 0,19 s) solo llenan la historia de los detectores.
- La ocupación se divide por los compases efectivamente escuchados (hasta «Compases», 8 por defecto), no por la ventana completa.
- Publicación cada 0,5 s en el `[dict sv_listen]` global (sin `---`) con la clave del id de la pista; al borrar el dispositivo su entrada se elimina; «Escuchar» apagado la marca `active: false`.

### D-052 · Audio en el modo Adaptable y en Sugerir
- `controller.analyze()` recibe los resúmenes por `listenSource` (en Live, el dict `sv_listen`), descarta los de más de 30 s y los inactivos, y los pasa a `analysis.analyzeSet`.
- El croma de audio suma al histograma con peso `audioWeight` (0,5 por defecto) relativo al total de MIDI; sin MIDI, pesa por sí solo. Un audio en silencio (nivel ≤ 1e-4) no cuenta.
- La ocupación de cada pista de audio entra en la ocupación del arreglo (máximo por paso, como D-037) y, si no hay bombo MIDI, el bombo del audio con más pasos ≥ 0,5 se usa para «seguir bombo» (`kick.source = 'audio'`).
- Las pistas de audio aparecen en lo leído con la marca «audio».

### D-053 · Correcciones de la prueba en Live de SV Listen (18-10-2026)
- **Dict compartido vacío («audio 0/0»):** un `Dict` de JS creado y soltado en cada publicación no mantiene vivo el diccionario. SV Listen guarda una referencia permanente y su patch tiene un `[dict sv_listen]`; SV Ritmic Sequencer también guarda la suya. La línea de estado de «Leer set» muestra `audio <leídas>/<claves> · usadas · tonalidad` para diagnosticar desde la interfaz.
- **Batería que decide la escala («A cromática»):** el croma de cada audio pesa según `tonalness` (parte de la energía en sus 3 clases más fuertes, escalada de 0,5–0,8 a 0–1). Un pad pesa entero y el ruido de una batería, casi nada.
- **Motores separados:** SV Listen carga `sv_listen_engine.js` y SV Ritmic Sequencer `sv_rs_engine.js`; la instalación copia el motor primero y de forma atómica, y los scripts en su sitio. La copia `sv_rs_engine_alt.js` ya no se usa y la instalación la borra.
- **Recarga en caliente (PM-031):** tras reinstalar, el script recargado recibía de `require` un módulo vacío en los dos dispositivos, incluso con un motor de nombre nuevo; un dispositivo recién arrastrado cargaba bien. La guía de JavaScript de Max 9 (`userguide/content/javascript.json`, sección «require») no documenta la caché de módulos, así que el arreglo no depende de ella:
  - `tools/bundle.js` pone en el motor un sello de contenido `build` (`<versión>+<12 cifras del sha1>`), y `build_amxd.js` / `build_listen.js` lo escriben en `SV_ENGINE_BUILD` del script v8 (`tools/lib/install.js` › `prepareScript`). En `src/` la constante queda vacía y no se comprueba.
  - `loadEngine` lee primero el motor con `File` (por nombre en el search path y, si no, en la carpeta del dispositivo), decodifica el UTF-8 y lo evalúa con `new Function('module', 'exports', 'require', …)`; solo vale si tiene `.core` y el mismo sello. `require` queda como último recurso: tras reinstalar no encuentra el archivo (Max escribe «could not find file …» en rojo aunque el script capture el error), da un módulo vacío o el motor viejo de su caché. Cada script escribe en la consola qué motor cargó y de dónde: «… cargado desde el archivo» o «… cargado con require».
  - Si tampoco así hay motor, el error pide volver a cargar el dispositivo y la consola enumera cada intento.
  - Los `v8ui` (`sv_rs_ui.js`, `sv_listen_ui.js`) usan el mismo cargador y los builders también les escriben `SV_ENGINE_BUILD` (y `SV_INSTALL_DIR` al instalar). Si no hay motor, la vista dibuja «No se pudo cargar …: vuelve a cargar el dispositivo», no atiende mensajes ni ratón, y la consola enumera cada intento.
  - Probado en Live (Max 9.1.5, 18-10-2026, PM-031): `File` abre el motor por nombre y `new Function` está permitido; tras reinstalar con los dispositivos cargados, los dos v8 cargaron el motor nuevo desde el archivo sin recargar nada.
- **Carpeta del dispositivo y `patcher.filepath` (PM-027):** en Live `this.patcher.filepath` no es fiable: en SV Ritmic Sequencer salía vacío y en SV Listen trae la carpeta del dispositivo en vez del `.amxd`, así que quitarle el último trozo daba la carpeta madre (`…/Max Audio Effect/`, donde acababan los `listen_debug_*.json`). `deviceFolder()` (los cuatro scripts) prueba, en orden: la carpeta de `filepath` (la del `.amxd` si termina en extensión, o la propia ruta si no), solo si el motor está dentro; la carpeta donde `File` encuentra el motor por nombre (propiedad `foldername`: el search path del dispositivo incluye su carpeta, por eso `require` lo encuentra); la carpeta de instalación que `--install` escribe en `SV_INSTALL_DIR` (`…/User Library/Presets/MIDI Effects/Max MIDI Effect/SV Ritmic Sequencer/`, o la de SV Listen en Audio Effects); y, sin confirmar, la de `filepath`. «Exportar .mid» escribe en `exports/` dentro de esa carpeta. Los diagnósticos (`analysis_debug.json`, `listen_debug_<pista>.json`) también la usan; el de SV Listen guarda además `filepath` y `folder` para ver qué da Live.
- **Parámetros antes de `init` (SV Listen):** al cargar, los `live.*` mandan Sensibilidad, Bombo Hz y Compases antes de `init`, cuando `require` aún no encuentra el motor, y cada uno intentaba crear el analizador (tres errores rojos por carga aunque luego funcionara). Ahora solo guardan la configuración hasta que `init` crea el analizador.
- **`tick <buffer>`:** el nombre del buffer viaja en cada tick, para no depender del mensaje de arranque.

---

## Plan de fases

| Fase | Entregable | Verificación |
|---|---|---|
| 1 · Núcleo y datos | `taxonomy.json` (8 ejes + `GRV` + `RGG`), `patterns/*.json` (incluye reggae, dub techno y percusión latina), `scales.json`, `drum_maps.json` (GM y Dub kit), esquemas; algoritmos §4 y transformaciones | `node --test` verde, validación de esquemas, ejemplos verificables del informe (E(3,8)=tresillo, tala Adi = 32, tihai, etc.) |
| 2 · Generadores por destino | Bassline, Chords, Arpeggio, Hi-hats, Ethnic drums, Others; `repeat_policy` | Pruebas de propiedades: notas en escala, longitud de ciclo, repeticiones y variación final, determinismo por semilla |
| 3 · Integración con Live | Adaptador `v8`: escritura de clips, lectura de escala, lectura de pistas; modo Adaptable con MIDI | Pruebas del adaptador con un `LiveAPI` simulado + PM-00x en Live |
| 4 · Interfaz | Franja de 169 px, ventana ampliada, círculo de Toussaint, rejilla, línea de repeticiones, rejilla deformable | Capturas en Live + PM |
| 5 · Sugerir y pulido | Puntuación contextual, preajustes, historial, deshacer | Pruebas del puntuador en Node |
| 6 · Empaquetado | `build_amxd.js`, `.amxd` + `.maxpat`, README, guía, pruebas manuales | Carga en Live (PM) |
| Posterior · SV Listen | Diseño de análisis de audio | Documento de diseño |

## Riesgos principales

1. **Resolución de `require` y rutas en `v8` dentro de un `.amxd`** → mitigado con el archivo único `sv_rs_engine.js` (D-003).
2. **Empaquetado `.amxd` sin congelar**: el JS debe estar junto al `.amxd` o en el *search path*. Mitigación: instalar en una carpeta propia de la User Library y documentar el congelado.
3. **Rendimiento de `v8ui` con muchas visualizaciones** en la franja → dibujar solo al cambiar el estado y mantener las vistas pesadas en la ventana ampliada.
4. **Lectura de clips del arreglo** por Live API (más costosa e irregular que la de Session) → empezar por clips de Session en reproducción o seleccionados.
5. **Contenido incompleto del informe** (§7): se carga como entradas editables marcadas para verificar, sin completar con invención.
