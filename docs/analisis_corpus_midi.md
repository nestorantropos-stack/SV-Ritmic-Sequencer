# Análisis del corpus MIDI de referencia

**Versión:** 1.0 · 17 de octubre de 2026
**Complementa:** `meta_analisis_ritmo_max4live.md` y `clasificacion_ritmica_reggae_dub_steppers.md`.
**Herramientas:** `tools/lib/smf.js` (lector MIDI propio), `tools/corpus_rhythm.js`, `tools/corpus_chords.js`, `tools/corpus_build.js`. Las medidas completas están en `data/corpus/*.json` y se regeneran con `node tools/corpus_build.js`.

## 0. Alcance y honestidad del dato

- **Corpus:** 478 archivos `.mid` de tres carpetas tuyas: DDT (Detroit Dub Techno, 140 archivos), Dub (239 archivos, 195 únicos tras eliminar duplicados exactos entre packs) y Latin MIDI drums (99 archivos General MIDI; los `.zip` contienen los mismos archivos ya extraídos).
- **Nuevo estatus `[C]` (medido en corpus):** posiciones, duraciones y desviaciones medidas en estos archivos. Describe cómo programan los packs comerciales, no una tradición en sí. Cuando una medida coincide con el informe, refuerza el dato; cuando un archivo sugiere un estilo con nombre propio (por ejemplo bossa nova), el nombre se marca `verify: true` hasta contrastarlo con una fuente.
- **Licencia:** los `.mid` son material de packs. El repositorio guarda solo medidas derivadas (patrones de rejilla, histogramas, estadísticas), nunca copias de los archivos.
- **Rejilla:** 16 pasos por compás de 4/4 (paso = semicorchea), escritos en grupos de cuatro con `|`. `dev` = desviación en fracción de paso (+ = retrasado).

---

## 1. DDT · acordes de dub techno (`DDT_MIDI/Chords`, 51 clips)

| Medida | Valor `[C]` |
|---|---|
| Longitud | 1 compás en los 51 clips (bucle corto) |
| Ataques por compás | 3,9 de media (rango 2–10) |
| Tamaño del acorde | tríada en 191 de 200 eventos |
| Forma interválica | `0-3-7` (tríada menor en estado fundamental) en 189 de 200 |
| Relación con la tonalidad del nombre | la tríada sobre la tónica (`0,3,7`) en 170 de 200; el resto, VI (`8,11,3`, 9 eventos) y casos aislados |
| Duración del stab | mediana 2 semicorcheas (p10 = 0,8; p90 = 3,3); notas largas (≥ 1 negra) en 6 clips |
| Velocity | 27–108, media 79 |
| Registro | raíz del acorde entre MIDI 46 y 87 (centro en 57–66) |
| Microtiempo | desviación media 0,09 de paso; las semicorcheas impares tienden a retrasarse (ver §3) |

**Histograma de ataques por paso (51 clips):**

```
paso :  0  1  2  3 |  4  5  6  7 |  8  9 10 11 | 12 13 14 15
cuenta: 41  5 13  9 |  7 12 14  9 | 17  7 15 10 | 12  9 18  2
```

**Lectura para el generador:**
1. **El acorde casi no cambia; cambia el ritmo.** El dub techno de este pack es una tríada menor fija sobre la tónica, con variación puramente rítmica y de velocity. Coincide con `RGG.10.2` («cambios microscópicos sobre un lazo estable») y amplía ese dato: los stabs no se limitan a los contratiempos `[2, 10]` que propone el informe como hipótesis `[V]`.
2. **Ataque en el paso 0 en 41 de 51 clips** y peso secundario en 14, 8, 10 y 6. Los pasos 1 y 15 casi nunca se usan.
3. **Densidad baja:** de 2 a 5 stabs por compás en la mayoría.
4. **Stab corto (≈ 1/8)** con variante de colchón (acorde largo) en una minoría, lo que confirma la capa de acorde sostenido del informe.

Ejemplos de rejilla medidos (los más típicos):

```
x...|..x.|....|..x.     (Cm 09, Cm 16, Gm 42)
x...|....|..x.|....     (Cm 10)
x...|.x..|..x.|....     (Em 26, Dm 21)
x..x|..x.|.X..|x..x     (Am 01, más denso)
x.x.|x.x.|x.x.|x.x.     (Dm 19, corcheas continuas)
```

## 2. DDT · bajos (`Bass`, `Bonus_Bass`, 89 clips)

- 2 compases en casi todos; tempo de referencia 120 BPM en los nombres de `Bonus_Bass`. `[C]`
- Rango MIDI 26–57; muchos clips usan entre una y tres alturas, con la tónica como nota dominante.
- Patrones dominantes: contratiempo puro `..x.|..x.|..x.|..x.`, contratiempo con nota de paso, y corriente de semicorcheas con acentos de velocity (`DDT_Bass_FilterVelocity`: `xxXx|xXxx|Xxxx|XxxX`, acentos en 2, 5, 8, 12, 15 → agrupamiento 3+3+4+3+3; un patrón tipo `CIC.1.1` con acento por velocity).

## 3. Swing de semicorchea en DDT `[C]`

| Carpeta | Semicorcheas impares medidas | Desviación media | Valor más frecuente | Proporción equivalente |
|---|---|---|---|---|
| Chords | 63 | +0,12 paso | 0 y +0,25 | 56 % (mezcla de recto y swing) |
| Bass | 236 | +0,19 paso | **+0,25 paso** (112 casos) | 59 %; moda 62,5 % |
| Bonus_Bass | 185 | +0,18 paso | **+0,25 paso** (88 casos) | 59 %; moda 62,5 % |

Las semicorcheas pares no se desplazan (±0,01). **Conclusión:** el dub techno de DDT usa un swing de semicorchea de **≈ 62 %** (la semicorchea impar se retrasa un cuarto de paso) en las líneas que lo aplican, y rejilla recta en el resto. Valor de partida para `MIC.1.1` en el destino Chords/Bassline › Dub Techno: `swing_level = 1/16`, `ratio ≈ 1.67`, con interruptor recto/swing.

---

## 4. Dub y reggae (`1. Dub`, 195 archivos únicos)

Packs: DubDeal (Rebel Skank 135 BPM, Dub Front 64, Sinister Dub 116, Rootsquake 137), Sub System Dub (130), Echoes In The Smoke (75, 80, 112, 120, 140), Wicked Dub (jungle), 808 Dub (120) y Minimal Jams (128, acid). Casi todos los archivos son de **un solo carril** (el rol sale del nombre) y de 8 o 16 compases; los Drum Rack se leen por nota.

> Aviso: en los archivos de Maschine y de Drum Rack las alturas son disparos de pad (por ejemplo, todo en MIDI 60), no alturas reales. Las tablas recogen solo ritmo.

### 4.1 Familias de batería: confirmación del informe

| Familia (`RGG`) | Evidencia en el corpus `[C]` | Tempo |
|---|---|---|
| One drop (`RGG.3.1`) | `80_Kick` y `80_Snare`: un único golpe en el paso 8 (`....|....|x...|....`) | 80 BPM |
| One drop en doble tiempo | `64_Kick` y `64_Snare`: golpes en 4 y 12 a 64 BPM, que equivale al paso 8 de cada compás a 128 BPM | 64 (=128) |
| Steppers (`RGG.3.3`) | `x...|x...|x...|x...` en Rebel Skank, Sub System (Kick, Kick 3, Kick_Steppers), Echoes 120 y 140, 808 Dub | 120–140 |
| Steppers con empuje | `112_Kick` `x.x.|x...|x...|x...`; `130_Kick 2` con semicorchea final `x...|x...|x...|x..x` | 112–130 |
| Half-step (`RGG.10.3`) | `Kick_Halfstep` `x.x.|..x.|....|....` con caja en el 3 | 130 |
| Rockers b (bombo en cada pulso) | no se distingue del steppers en el corpus | — |

**Backbeat de caja/aro:** el paso 8 (pulso 3) domina en rim y snare (`Rimshot`, `112_Snare`, `80_Snare`, `RImshot` de Sub System). Aparecen también aro en `[4, 7, 12, 15]` (Dub Front) y aro de stick-shaker en el paso 8.

### 4.2 Hi-hat y platillos (para el destino Hi-hats)

| Subtipo | Rejilla `[C]` | Archivos |
|---|---|---|
| Contratiempo de corchea | `..x.|..x.|..x.|..x.` | Sinister HiHat 2, Sub System Offbeats y Hihat, Echoes 112 y Steppers 130 |
| Corcheas | `x.x.|x.x.|x.x.|x.x.` | HiHat_8ths, 80_HiHat_2 |
| Semicorcheas | `xxxx|xxxx|xxxx|xxxx` | 64_HiHat_1 y 4, 80_HiHat_1 |
| Negras (pedal) | `x...|x...|x...|x...` | 64_HiHat_2, 130_HiHat 3, hat pedal en Drum Rack 120 |
| Doble semicorchea a contratiempo | `..xx|..xx|..xx|..xx` | 135_HiHat (Rebel Skank) |
| Tresillos (relleno) | `x...|xxx.|x...|x...` (tresillo en el pulso 2) | Hihat_Triplets, Half_Step |
| Abierto en contratiempo de 1 y 3 | `..x.|....|..x.|....` | 64_HiHat_Open_1, 137_HiHat_Open, 140 Drum Rack |
| Abierto en la semicorchea final | `...x|....|...x|....` | 64_HiHat_Open_2 |
| Acento 2 y 4 sobre negras | `....|x...|....|x...` | HiHat_Offbeat (Sub System) |

Estos subtipos cubren `RGG.4.1`, `RGG.4.4` y `RGG.4.5`. El *flying cymbal* (`RGG.4.3`) no aparece como tal en el corpus: sigue `[V]`.

### 4.3 Percusión menor (para Hi-hats y Ethnic drums)

| Instrumento | Rejillas más frecuentes `[C]` |
|---|---|
| Shaker | contratiempo del 1 y 3 `..x.|....|..x.|....`; contratiempo del 2 y 4 `....|..x.|....|..x.`; stick shaker en 2 y 4 |
| Pandereta | corcheas `x.x.|x.x.|x.x.|x.x.`; pulsos 1 y 3; pulsos 2 y 4 |
| Woodblock | `....|..x.|....|....`; `....|....|...x|..x.` |
| Conga | golpe en el 2 `....|x...|....|....`; slap en `x.x.|....` |
| Tom de acento | `.x..|....|.x..|....`; paso 10 |

Coincide con `RGG.7`: «pocas capas de percusión, cada una con función clara».

### 4.4 Skank, chop y bubble (para el destino Chords › Dub / Reggae)

| Subtipo | Rejilla `[C]` | Ejemplos | Duración media |
|---|---|---|---|
| Chop en 2 y 4 (`RGG.6.2`) | `....|x...|....|x...` | Piano/Clav/Guitar Skank en casi todos los packs | 0,6–1,4 semicorcheas |
| Skank en contratiempo (`RGG.6.1`) | `..x.|..x.|..x.|..x.` | Organ Off Skank 135, Organ Skank 137, Horn Skank 64 | 0,4–0,9 |
| Double skank | `....|x.x.|....|x.x.` (chop + corchea siguiente) | Electric Keys Double Skank 137, Electric Skank 1 | 0,5 |
| Bubble de órgano (`RGG.6.3`) | `..x.|x.x.|..x.|x.x.` (contratiempo con enmarque) | 116_F#m_Organ | 0,7 |
| Skank en negras 2, 3, 4 | `....|x...|x...|x...` | 135_G_Clav_Skanky_Groove | 1,0 |

El chop en 2 y 4 domina en el corpus; el skank en contratiempo de cada pulso aparece sobre todo en el órgano y los vientos. El patrón de bubble medido ofrece una primera rejilla concreta para un dato que el informe deja en `[V]`.

### 4.5 Bajo de dub (para Bassline)

- Patrones de 1 a 2 compases con mucho silencio: `x...|....|x...|....` (sub en 1 y 3), `....|....|x.x.|x.x.` (respuesta en la segunda mitad), `....|x...|....|x...` (2 y 4), contratiempo `....|..x.|....|....`. `[C]`
- Sub de notas largas (duración media de 4 a 8 semicorcheas) frente a líneas melódicas cortas. Coincide con `RGG.5.3` y `RGG.5.4` (espacio, drop-outs).

---

## 5. Latin MIDI drums (99 archivos General MIDI)

Fuentes: archivos de mididrumfiles.com (carpetas Latin, ethnic_world, folk, files_34_68, contemporary, dance, jazz_blues, rock), tres archivos largos de bossa nova y un pack «LS» de percusión latina en 4/4, 6/8, 9/8 y 12/8 sin tempo en la cabecera. Los roles salen del mapa GM de percusión (canal 10).

### 5.1 Patrones latinos recurrentes `[C]`

| Patrón | Rejilla | Dónde aparece | Lectura | Estado |
|---|---|---|---|---|
| Bombo de bossa / baião | `x...|..x.|x...|..x.` | Azure-Bossa-Nova, Bossa-Nova, Schuld…Bossa-Nova, Latin9, Latin24 | negra con puntillo + corchea, dos veces por compás | `[C]`; nombre «bossa» `verify` |
| Cross-stick de bossa (2 compases) | `....|x...|..x.|....|x...|..x.|....|x...` | Azure-Bossa-Nova (rim), Schuld (cowbell) | ataques cada 6 semicorcheas (6+6+6+6+8): un ciclo de 32 pasos casi uniforme | `[C]`; comparar con `CIC.3.6` |
| Ride/cabasa en corcheas | `x.x.|x.x.|…` y cabasa en contratiempo `..x.|..x.|…` | bossas | capa continua de subdivisión | `[C]` |
| Maracas en negras | `x...|x...|x...|x...` | Azure-Bossa-Nova | pulso | `[C]` |
| Cencerro en negras | `x...|x...|x...|x...` | Latin2, Latin15, Latin24, ethnic5 | pulso de cencerro | `[C]` |
| Campana del ride en contratiempo | `..x.|..x.|..x.|..x.` | Latin2, Latin15 | contratiempo | `[C]` |
| Bombo 3+3+2 por pulso | `x..x|x..x|x..x|x..x` | Latin6, Latin21 | tresillo comprimido a negra | `[C]` |
| Caja sincopada | `...x|...x|..x.|.xx.` | Latin2, Latin15 | — | `[C]` |
| Güiro | `..xx|..xx|..xx|.xx.` | LS 4/4 FullKit 124 | raspado de corchea con anticipación | `[C]` |
| Conga abierta/apagada/grave | p. ej. `....|..xx|....|..x.` (abierta), `...x|....|...x|....` (apagada), `....|....|....|x...` (grave) | ethnic5, Latin34time1, LS 6/8 Congas | tumbao repartido por golpe | `[C]` |
| Agogó | `x.xx|x.xx|xxx.|..x.` (2 compases) | ethnic5, Latin29, Latin39 | figura de campana | `[C]` |

### 5.2 Métricas ternarias y aditivas

| Archivo | Métrica | Rejilla medida `[C]` (pasos de semicorchea) | Observación |
|---|---|---|---|
| Latin68time1, LS 6/8 FullKit 135 | 6/8 | bombo `x...|..x.|..x.`; caja `....|x...|x...`; hat `xx..|xxxx|xx..` | bombo en las corcheas 1, 4 y 6 |
| LS 12/8 FullKit 142 | 12/8 | cencerro `x.x.|x..x|..x.|x..x|.x..|....`; woodblock `x...|..x.|..x.|..x.|x...|..x.` | figura de campana en 12 corcheas, candidata a comparar con `CIC.2.1` |
| LS 9/8 Triangles / Maracas / Cowbell / Cabasa | 9/8 | triángulo `x.x|.x.|..x|.x.|x..|.x.` | material aditivo para `MET.3.3` (aksak) |
| Latin34time1 | 3/4 | conga abierta `x.x.|.x..|.x..` | vals latino |

### 5.3 Microtiempo

- Los archivos GM están casi cuantizados. El pack LS muestra un desfase constante (−0,033 de paso) que no es swing.
- Los archivos marcados «MedSwg» y «HrdSwg» encajan mejor en una rejilla de tresillo (`grid: tresillo`): son shuffle y no se tratan como latinos.
- Conclusión: el corpus latino aporta **ritmo y asignación de golpes**, no plantillas de microtiempo. Las plantillas de samba siguen saliendo del informe (`MIC.2.1`, `[V]`).

---

## 6. Consecuencias para el producto

1. **Chords › Dub Techno:** tríada menor (o del modo elegido) sobre el grado I, voicing cerrado en estado fundamental por defecto, 1 compás, 2–5 stabs, stab de ≈ 1/8, ataque en el paso 0 con alta probabilidad, peso en los pasos 6, 8, 10 y 14; swing de semicorchea 62 % conmutable; capa opcional de colchón; variación por ritmo y velocity antes que por armonía. La rejilla se genera con pesos derivados del histograma de §1.
2. **Chords › Dub / Reggae:** modos chop 2-4, skank en contratiempo, double skank y bubble, con las rejillas de §4.4.
3. **Hi-hats › Dub / Reggae:** los nueve subtipos de §4.2 más la percusión menor de §4.3.
4. **Ethnic drums › Latin percussion:** mapa GM de percusión como preset de `drum_maps.json` y patrones de §5 con su estatus `[C]`.
5. **Bassline › Dub:** patrones de §4.5 y swing de §3 en la variante dub techno.
6. **Sugerir:** tempos medidos en el corpus (75–80 para one drop, 112–140 para steppers, 120–128 para dub techno) como rangos `[C]` que complementan los del informe.
