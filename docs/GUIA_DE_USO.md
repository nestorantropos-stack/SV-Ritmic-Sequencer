# SV Ritmic Sequencer · Guía de uso

MIDI Effect de Max for Live de **Sidera Visus** que construye patrones rítmicos MIDI a partir de teoría musical, musicología y etnomusicología, y los escribe como clip en la pista donde vive.

Requiere **Ableton Live 12** (probado en 12.4.6 Suite) con Max for Live (Max 9.1).

---

## 1. Instalación

1. Copia la carpeta `SV Ritmic Sequencer` en
   `Documentos\Ableton\User Library\Presets\MIDI Effects\Max MIDI Effect\`
   con sus cuatro archivos juntos: `SV Ritmic Sequencer.amxd`, `sv_rs_v8.js`, `sv_rs_ui.js` y `sv_rs_engine.js`, más la carpeta `exports`.
2. En el navegador de Live: **User Library › Presets › MIDI Effects › Max MIDI Effect › SV Ritmic Sequencer**.
3. Arrastra **SV Ritmic Sequencer** a una pista MIDI que tenga un instrumento.

Si el dispositivo muestra «Listo» en su línea de estado, el motor está cargado.

> Para distribuirlo como un único archivo: ábrelo en Max (clic derecho en el título del dispositivo › *Editar*) y pulsa **Freeze Device**; guarda. El `.amxd` congelado incluye los tres scripts.

---

## 2. Los cuatro pasos

La franja del dispositivo muestra los cuatro pasos a la vez. Al pasar el ratón por cualquier elemento, la **línea de estado** de abajo explica qué hace; sobre los chips de taxonomía muestra la definición del concepto.

### Paso 1 · Destino
Para qué instrumento o canal se genera:

| Destino | Qué hace |
|---|---|
| **Bajo** | Raíz y grados fuertes sobre los acentos; notas de paso diatónicas y saltos de octava en posiciones débiles. Estilos: ostinato continuo, tumbao anticipado, one drop, seguir el bombo. |
| **Acordes** | Voicings por grado y modo, stabs, anticipaciones, ritmo armónico. Con **Dub Techno**: tríada fija del grado I, stab corto y swing de semicorchea de 62 %, como en el corpus de referencia. |
| **Arpegio** | Direcciones y ciclos de 3, 5 o 7 notas sobre la rejilla (hemiolas) y entrelazado de dos voces. |
| **Hi-hats** | Cerrado, abierto y pedal; el abierto se corta en el siguiente cerrado; tresillos y redobles. |
| **Percusión** | Golpes con timbre mapeados por tradición: dum/tak, tali/khali, gongs, congas, kit de dub… |
| **Otros** | Cualquier voz, con notas libres o grados de la escala. |

### Paso 2 · Armonía
- **Manual**: elige la raíz en el teclado (las teclas encendidas son las notas de la escala) y la escala con ‹ ›.
- **Live**: usa la escala activa del set de Live 12 (botón *Scale* de la barra de control).
- **Adapt.**: pulsa **Leer set**. El dispositivo lee el MIDI de las otras pistas (clip en reproducción o el primero con notas), estima tonalidad y escala, mide dónde ya hay ataques y encuentra el bombo. El bajo puede seguir al bombo; los demás destinos colocan sus ataques en los huecos.
- **Azar**: escala y raíz al azar dentro de reglas musicales, con una semilla que puedes reutilizar. **Otra** cambia la semilla.

### Paso 3 · Ritmo
- El círculo es el **ciclo rítmico de Toussaint dibujado como constelación**: cada estrella es un ataque, su tamaño es la intensidad y los arcos lila marcan el agrupamiento (por ejemplo 3+3+4+2+4 en la clave).
- Debajo: tradición, compás, longitud del ciclo, conceptos de la taxonomía (un color por eje) e **insignias**:
  - **verificar**: dato por contrastar con una transcripción o fuente primaria;
  - **corpus**: medido en el corpus MIDI de referencia (describe una práctica de programación);
  - **datos faltantes**: el informe declara este dato faltante; la entrada está para completarse.
- ‹ › recorren los ritmos aptos para el destino. **Explorar** abre el navegador completo.
- **Sugerir** propone tres ritmos para este set según tempo, compás, huecos del arreglo, nombres de pistas y dispositivos, y lo usado hace poco. Cada propuesta explica por qué; clic para elegirla.

### Paso 4 · Generar
- **Generar** escribe un clip nuevo en la ranura seleccionada de esta pista si está vacía, o en la primera vacía. Si no hay ranuras libres, crea una escena. **Nunca modifica un clip que no haya creado SV** (los suyos empiezan por «SV · »).
- **Regenerar** prueba otra semilla en la misma ranura; **Variar** aplica una mutación suave. Ninguno repite el clip anterior.
- ↶ ↷ deshacen y rehacen dentro del historial del dispositivo (Live también registra los cambios en su propio deshacer).
- ▶ **Escuchar** toca la vista previa por el instrumento de la pista, sin escribir el clip.
- **Repeticiones**: *Auto* sigue la naturaleza del ritmo (4 ciclos para un groove corto, tala + tihai, uno o dos gongan…); 3, 4, 8, 16; **∞** cierra el ciclo completo contra el compás del set (por ejemplo, un 7/8 en un set de 4/4 dura 28 negras).
- La **línea de repeticiones** muestra cada ciclo; el lila marca la variación final (fill, tihai, gong, llamada, drop-out…).

---

## 3. El navegador (Explorar)

Ventana de 1000 × 700:

- **Árbol por ejes** a la izquierda: MET (métrica), ACE (acentuación), SUP (superposición), MIC (microtiempo), CIC (ciclos), PRO (procedimientos), FOR (forma), COG (cognición), GRV (grooves) y RGG (reggae, dub y derivados). Las migas de pan permiten volver atrás.
- **Buscador** (sin tildes ni mayúsculas) y filtros «Solo <destino>» y «Solo verificados». Si un filtro oculta resultados, el panel lo avisa.
- **Tarjetas**: clic muestra el detalle; doble clic o **Usar este ritmo** lo elige. Arrastra la lista para desplazarla.
- **Detalle**: constelación grande, definición del concepto principal, origen (contexto, géneros, atribuciones), fuentes, notas por verificar y contexto cultural.
- **Vista previa del clip**: piano roll del clip completo, línea de repeticiones y **rejilla deformable** de la plantilla de microtiempo (cuánto se desplaza cada paso respecto de la rejilla recta).
- **Capas / Historial / Preajustes**:
  - *Capas*: bloquea una capa (por ejemplo el bombo) para que no cambie al regenerar.
  - *Historial*: vuelve a cualquiera de las últimas 32 generaciones.
  - *Preajustes*: guarda la configuración actual; se guarda con el set.
- **Exportar .mid**: escribe el clip actual en la carpeta `exports` del dispositivo, que aparece en el navegador de Live para arrastrarlo a cualquier pista.
- **Forma** (abajo): Densidad, Síncopa objetivo (0 = sin cambio; ~35 es el tramo medio de la curva de groove), Microtiempo (recto, swing 62 %, samba, telespringar, laid-back, push), Humanizar (ms, ruido browniano), velocity mínima y máxima, Complementariedad (modo Adaptable) y Seguir bombo (Auto / Sí / No).
- **Atajos** con la ventana enfocada: Mayús + G generar · R regenerar · V variar · Z deshacer · Y rehacer · P escuchar; ← → para elegir; Intro para usar.

---

## 4. Automatización y guardado

Destino, Armonía, Raíz, Escala, Ritmo, Repeticiones, Semilla y los controles de Forma son **parámetros de Live**: se pueden automatizar, entran en el deshacer de Live y se guardan con el set.

---

## 5. Contenido y ética de uso

- Todo el catálogo viene de `docs/meta_analisis_ritmo_max4live.md`, `docs/clasificacion_ritmica_reggae_dub_steppers.md` y del corpus MIDI medido (`docs/analisis_corpus_midi.md`). Cada ritmo conserva su tradición, función y fuentes.
- Los datos que el informe declara faltantes no se inventan: quedan como entradas marcadas para verificar.
- **Repertorio de uso restringido** (kultrún mapuche, toques ceremoniales de nyabinghi): no aparece en las listas. Solo se ofrece como principio estructural, con una nota de contexto cultural. Cuando una obra use un patrón tradicional reconocible, nombra la tradición y, si existe, a quien te lo enseñó.

---

## 6. Límites conocidos

- La escucha previa no está sincronizada con el transporte ni es precisa a la muestra: sirve para audicionar.
- El modo Adaptable lee MIDI; el audio queda para **SV Listen** (diseño en `docs/SV_LISTEN_DISENO.md`).
- Los cuartos de tono de los maqamat se escriben en su aproximación de 12 notas (los cents quedan como dato).
- La rueda del ratón no desplaza las listas del panel: arrastra o usa las flechas.

---

## 7. Si algo falla

- Abre la consola de Max (clic derecho en el título del dispositivo › *Abrir en Max* › ventana Max). Los errores empiezan por «SV Ritmic Sequencer · error».
- Si reinstalas con el dispositivo cargado, al cabo de un segundo vuelve a «Listo»; si no, quítalo de la pista y vuelve a arrastrarlo.
