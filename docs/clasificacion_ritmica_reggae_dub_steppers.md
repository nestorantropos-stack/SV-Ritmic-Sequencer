# Clasificación rítmica del reggae, el dub, el steppers y sus derivados

**Versión:** 1.0 · 17 de octubre de 2026
**Continúa:** `meta_analisis_ritmo_max4live.md` (mismo formato de IDs, rejilla y estatus epistémico).
**Uso previsto:** ampliar la base de conocimiento de **SV Ritmic Sequencer** con la familia jamaicana y sus derivados, lista para convertirse en datos (`data/patterns/`) y en parámetros de dispositivo.

---

## 0. Cómo leer este documento

- **IDs:** prefijo `RGG` (familia reggae) con ramas `RGG.n.m`. Cada ID enlaza con los ejes del informe anterior (`MET`, `ACE`, `SUP`, `MIC`, `CIC`, `PRO`, `FOR`, `COG`, `GRV`).
- **Estatus:** `[H]` hecho documentado · `[I]` interpretación frecuente en la literatura o la pedagogía · `[Hip]` hipótesis · `[V]` por verificar en transcripción o fuente primaria antes de fijarlo como preset (`verify: true`).
- **Rejilla estándar:** 16 pasos por compás de 4/4, paso = semicorchea (`step_value: 0.25`). El paso 0 es el pulso 1; los pasos 4, 8 y 12 son los pulsos 2, 3 y 4. Los patrones se escriben en cuatro grupos de cuatro, separados por `|`; `x` marca un ataque y `.` un silencio.
- **Calidad de fuente:** la sección 10 clasifica cada fuente en tres niveles (A: prensa especializada, entrevistas y publicaciones académicas; B: pedagogía y divulgación; C: foros y blogs). Los datos que descansan en el nivel C llevan `[V]`.

---

## 1. Hallazgos principales

1. **Tres familias de batería sostienen la pedagogía del reggae:** one drop, rockers y steppers. Todas se organizan alrededor del peso del pulso 3 y se distinguen por la actividad del bombo.
2. **El pulso 3 como centro de gravedad.** El one drop deja vacío el pulso 1 y concentra bombo y caja (o aro) en el 3. Esta distribución produce una sensación de mitad de tiempo respecto del ska. El mismo principio reaparece en el dubstep, donde la caja cae en el pulso 3 a 140 BPM.
3. **El vocabulario de rockers y steppers se superpone en las fuentes.** Hay dos definiciones de rockers en circulación (§9.1). El informe anterior fijó una sola; esta versión registra ambas.
4. **El dub contribuye rítmicamente con procedimientos de mezcla:** retirar el ritmo, lanzar ecos y reutilizar el riddim como versión. La base rítmica es la misma del reggae; el dub añade una capa de eventos generados en la consola.
5. **El riddim es la unidad de reutilización.** Una misma pista de bajo y batería circula en cientos de versiones con voces distintas (Sleng Teng, Dem Bow). Esta lógica se traduce directamente en un dispositivo: un patrón base con muchas voces.
6. **Los derivados conservan piezas distintas del original.** El steppers británico conserva el bombo en los cuatro pulsos; el dub techno, la función del acorde de skank procesado con eco; el dubstep, el pulso 3 y el peso del subgrave; el dembow, la interacción entre bombo constante y cajas sincopadas en 3+3+2.

---

## 2. Taxonomía de la familia (árbol de IDs)

```
RGG.1  Raíces rituales y precursores
  RGG.1.1  Nyabinghi (Rastafari)        [uso restringido como patrón]
  RGG.1.2  Burru y kumina               [uso restringido como patrón]
  RGG.1.3  Mento
RGG.2  Eras de la música popular jamaicana
  RGG.2.1  Ska
  RGG.2.2  Rocksteady
  RGG.2.3  Reggae temprano
  RGG.2.4  Roots reggae
  RGG.2.5  Rub-a-dub
  RGG.2.6  Dancehall digital
RGG.3  Batería: familias de bombo y caja
  RGG.3.1  One drop
  RGG.3.2  Rockers
  RGG.3.3  Steppers
  RGG.3.4  Variantes (half drop, two drop, half-time)  [V]
RGG.4  Hi-hat y platillos
  RGG.4.1  Corcheas cerradas
  RGG.4.2  Corcheas con swing
  RGG.4.3  Flying cymbal (flyers)
  RGG.4.4  Rellenos en tresillo "laid-back"
  RGG.4.5  Semicorcheas digitales
RGG.5  Bajo
RGG.6  Guitarra, piano y órgano
  RGG.6.1  Skank en contratiempo
  RGG.6.2  Chop en los pulsos 2 y 4
  RGG.6.3  Bubble (órgano)
  RGG.6.4  Strum con subdivisión de semicorchea
RGG.7  Percusión menor y coros de tambores
RGG.8  Dub: procedimientos con consecuencia rítmica
  RGG.8.1  Versión y riddim
  RGG.8.2  Retirada de capas (drop-out)
  RGG.8.3  Ecos y reverberación como ritmo derivado
  RGG.8.4  Arco de mezcla
RGG.9  Riddim digital y dancehall
RGG.10 Derivados fuera de Jamaica
  RGG.10.1 UK steppers
  RGG.10.2 Dub techno
  RGG.10.3 Dubstep y 2-step
  RGG.10.4 Dembow y reggaetón
  RGG.10.5 Lovers rock
  RGG.10.6 Jungle y ragga
  RGG.10.7 Fusiones de ska (2 Tone, ska punk)
```

---

## 3. RGG.1 · Raíces rituales y precursores

### RGG.1.1 Nyabinghi
- **Definición:** reunión ceremonial rastafari con tambores y cantos; el repertorio de tambor reúne tres voces con funciones propias. `[H]`
- **Voces:**
  - *Thunder / bajo (baandu):* tambor grave de doble parche tocado con maza; golpe abierto en el pulso 1 y golpe amortiguado en el 3, con sincopa ocasional. `[H]`
  - *Funde:* tambor medio que sostiene el pulso estable. Una fuente lo ubica en los pulsos 1 y 3; otra lo describe como un pulso regular de dos tiempos. `[H]` con divergencia → `[V]`
  - *Repeater / akete / kete:* tambor agudo que improvisa sincopas y concentra el acento en los pulsos 2 y 4; en grupos toca un solo repeater a la vez, en conversación con los otros. `[H]`
  - *Shaka (sekere):* sonaja opcional que acentúa. `[H]`
- **Estructura para dispositivo:** ciclo de 4 pulsos con **tres roles** (base, pulso, improvisación). Parámetros: `thunder_syncopation_prob`, `repeater_density`, `repeater_accent_beats` = [2,4].
- **Contexto cultural:** música religiosa con peso espiritual; su ritmo fue precursor cultural del ska y el reggae a través de percusionistas como Count Ossie. `[H]`
- **Uso restringido:** `restricted_use: true`. El dispositivo incorpora el **principio de tres roles** y evita ofrecer toques ceremoniales como preset. Una nota de contexto acompaña a la función.

### RGG.1.2 Burru y kumina
- Tradiciones afrojamaicanas de tambor y canto; el burru usa también tres tambores incluido el bajo. `[H]` Kumina: música ritual afrojamaicana de comunicación con los espíritus mediante tambor, canto y danza. `[H]`
- Datos rítmicos concretos: no se consultaron transcripciones. **Dato faltante.** `restricted_use: true`.

### RGG.1.3 Mento
- Folclor jamaicano de los años cincuenta con guitarra, banjo y tambores, cantado en estrofas y de tono ligero. `[H]`
- Antecedente del ska junto con el rhythm and blues estadounidense. `[H]`

---

## 4. RGG.2 · Eras y marcos rítmicos

| ID | Era | Marco rítmico | Fechas orientativas | Estatus |
|---|---|---|---|---|
| `RGG.2.1` | Ska | 2/4 rápido con acento en el contratiempo; guitarra y piano marcan las partes débiles; bajo en cuatro pulsos | ~1960 a mediados de 1966 | `[H]` |
| `RGG.2.2` | Rocksteady | Tempo percibido más lento, bajo más variado y móvil, mayor peso del pulso fuerte | 1966–1968 | `[H]` |
| `RGG.2.3` | Reggae temprano | Aparece el órgano *bubble* y el strum de guitarra; el one drop se asienta; influencia funk y soul | 1968/69–1974 | `[H]` |
| `RGG.2.4` | Roots reggae | Patrones de guitarra, piano y teclado refinados; progresiones simples; el bajo pasa al primer plano | 1974–1983 | `[H]` |
| `RGG.2.5` | Rub-a-dub | Transición hacia el dancehall; ritmo lento y "rodado"; bajo grave y redondo; batería muy simple | 1979–1985 | `[H]` |
| `RGG.2.6` | Dancehall digital | Riddims programados; Sleng Teng (1985) marca el giro | desde 1983/85 | `[H]` |

- **Variación de fechas:** Chang y Chen sitúan el reggae entre 1969 y 1983 y el dancehall desde 1983; Wikipedia fecha el comienzo del reggae en 1968. `[H]` con divergencia.
- **Teoría del medio tiempo (Jenson, Berklee):** el reggae "cortó el ska por la mitad" y trasladó los contratiempos del ska a un plano secundario en la mano izquierda del órgano. `[I]`
- **Origen del one drop en el rocksteady:** una cita atribuye a Winston Grennan el desarrollo del one drop para el rocksteady, con un golpe fuerte de caja en el pulso 3 que "partía el pulso en dos"; la fama del groove se vincula a Carlton Barrett. La autoría original permanece discutida. `[H]` (atribuciones)

---

## 5. RGG.3 · Batería: familias de bombo y caja

### 5.1 Parámetros comunes
- `drop_beat`: pulso vacío (1 por defecto en one drop).
- `kick_mask`, `backbeat_mask` (caja, aro o cross-stick), `hat_mask`.
- `swing`: proporción de la corchea, usual en el reggae y con valores cercanos a 1:1 en grooves rápidos. `[I]`
- `half_time`: interruptor que traslada el backbeat del 2 y 4 al 3.

### 5.2 Patrones (rejilla de 16 pasos)

#### RGG.3.1 One drop
- **Definición:** el pulso 1 queda libre de bombo; bombo y caja o aro coinciden en el pulso 3. El hi-hat cerrado corre continuo. `[H]`
- **Rejilla:**
  ```
  bombo   : ....|....|x...|....
  caja/aro: ....|....|x...|....
  hat     : x.x.|x.x.|x.x.|x.x.      (corcheas; swing habitual)
  ```
- **Sensación:** abierta y suspendida; el pulso 1 se "siente" sin sonar. `[I]`
- **Contexto:** núcleo del roots reggae; asociado a Carlton Barrett y Bob Marley and the Wailers (por ejemplo "One Drop", *Survival*, 1979). `[H]`
- **Taxonomía:** `ACE.2.2`, `MIC.1.1`, `GRV.5`, `FOR` (half-time).
- **Variante half-time:** descrita en material pedagógico; patrón exacto `[V]`.

#### RGG.3.2 Rockers
- **Definición:** el nombre cubre dos prácticas en las fuentes consultadas.
  - **3.2a · Acepción pedagógica:** one drop con bombo añadido en el pulso 1, es decir, bombo en 1 y 3 con el aro anclado en el 3. `[I]`
    ```
    bombo   : x...|....|x...|....
    caja/aro: ....|....|x...|....
    ```
  - **3.2b · Acepción histórica (Sly Dunbar, Channel One, 1976):** bombo constante en cada pulso, más intenso que el one drop, con golpes dobles sobre la caja abierta y un carácter marcial. `[H]` (Gleaner, Dutch Vinyl, Reggae.be)
    ```
    bombo   : x...|x...|x...|x...
    caja    : posiciones de los golpes dobles       [V]
    ```
- **Contexto:** Sly Dunbar y Robbie Shakespeare con The Revolutionaries en Channel One; el estudio pasó de 4 a 16 pistas en 1975. El estilo reemplazó a los *flyers*. `[H]`
- **Tempo:** una fuente divulgativa indica 60–90 BPM; la misma fuente cita el steppers entre 110 y 140. `[I]` con calidad B.
- **Taxonomía:** `GRV.6`, `ACE`, `FOR`.

#### RGG.3.3 Steppers
- **Definición:** bombo en los cuatro pulsos del compás dentro de un groove de reggae; el backbeat permanece en el 3. `[H]`
- **Rejilla:**
  ```
  bombo   : x...|x...|x...|x...
  caja/aro: ....|....|x...|....
  hat     : x.x.|x.x.|x.x.|x.x.
  ```
- **Contexto:** atribuido a Sly Dunbar y los músicos de Channel One; adoptado por el dub británico y el roots del Reino Unido. `[H]`
- **Nota de fuente:** una entrada enciclopédica describe el steppers con bombo en cada corchea; el resto de las fuentes lo ubica en cada negra. Se adopta la segunda. `[V]`
- **Taxonomía:** `GRV.7`, `COG` (pulso inductor de entrainment).

#### RGG.3.4 Variantes mencionadas en la literatura
- **Half drop / two drop:** un tutorial de producción de dub menciona cuatro ritmos básicos del reggae (steppers, one drop, two drop y un patrón sin nombre común llamado *half drop*). Los patrones exactos no se detallan en el fragmento consultado. `[V]`
- **Rub-a-dub:** las notas de una compilación describen una batería muy simple en la que bombo y caja se alternan en el primer pulso de cada compás. Interpretación en rejilla: `[V]`.

---

## 6. RGG.4 · Hi-hat y platillos

| ID | Nombre | Descripción | Rejilla / parámetros | Estatus |
|---|---|---|---|---|
| `RGG.4.1` | Corcheas cerradas | Hi-hat cerrado continuo, base del one drop | `x.x.|x.x.|x.x.|x.x.` | `[H]` |
| `RGG.4.2` | Corcheas con swing | Subdivisión larga–corta; la mayoría de los grooves de reggae la usa; los tempos rápidos tienden a 1:1 | `swing` 1.0–2.0 | `[I]` |
| `RGG.4.3` | Flying cymbal (flyers) | Hi-hat que alterna golpes abiertos y cerrados, con siseo continuo; deriva del *Philly bump* y del backbeat mecanizado de "TSOP"; popular en 1974–75 | máscara de apertura `open_mask`; apertura habitual en los pulsos 2 y 4 en unísono con los chops | `[H]` (origen) · `[V]` (rejilla) |
| `RGG.4.4` | Rellenos en tresillo laid-back | Tresillos de hi-hat retrasados respecto del pulso, recurso típico del one drop | tresillos, `laid_back_ms` | `[I]` |
| `RGG.4.5` | Semicorcheas digitales | Hi-hat en 16 pasos en riddims programados | `x x x x` por pulso, con acentos | `[I]` |

**Detalle del flying cymbal:**
- Carlton "Santa" Davis se atribuye la forma; "None Shall Escape the Judgement" (Johnny Clarke, 1974) es su ejemplo emblemático. `[H]` (entrevista, Factmag)
- Sly Dunbar sitúa el recurso en "Moonlight Lover" (Duke Reid, 1968) y atribuye el nombre a Bunny Lee. `[H]` (entrevista, Red Bull Music Academy)
- El nombre alude al hi-hat, no al platillo crash. `[H]`
- El estilo cedió terreno ante el rockers. `[H]`

---

## 7. RGG.5 · Bajo

- **Papel:** el bajo ocupa el primer plano del roots reggae; la simplificación de progresiones armónicas y la refinación de patrones de guitarra, piano y teclado lo llevaron a ese lugar. `[H]`
- **Rasgos rítmicos:**
  - Frases cortas y repetitivas que rodean el contratiempo, con silencios amplios; el bajo "camina" con valores de nota medidos. `[I]`
  - El hi-hat puede duplicar el diseño rítmico del bajo, lo que genera un flujo de consistencia entre ambos (Sly y Robbie). `[I]`
- **Subtipos:**
  | ID | Subtipo | Descripción | Estatus |
  |---|---|---|---|
  | `RGG.5.1` | Bajo de ska | Patrón de cuatro pulsos estable | `[H]` |
  | `RGG.5.2` | Bajo de rocksteady | Líneas más variadas y móviles; muchas se reutilizan en la música jamaicana posterior | `[H]` |
  | `RGG.5.3` | Bajo de roots | Ostinato corto, melódico, con espacio, en registro grave y redondo | `[I]` |
  | `RGG.5.4` | Bajo de dub | Línea mínima con retiradas y regresos (drop-outs) | `[I]` |
  | `RGG.5.5` | Bajo digital | Ostinato programado (Sleng Teng, preset de un Casio MT-40) y sub 808 | `[H]` |
- **Parámetros para el dispositivo:** `bass_space` (proporción de silencio), `offbeat_bias` (sesgo hacia el contratiempo), `repeat_len` (1 o 2 compases), `octave_jump_prob`, `lock_to_kick`.
- **Notas de altura:** el generador toma los grados 1, 5 y b7 con adornos pentatónicos en los modos menores. `[I]`

---

## 8. RGG.6 · Guitarra, piano y órgano

### 8.1 Definiciones en las fuentes
Las fuentes usan "skank" y "chop" de dos maneras. El dispositivo ofrece ambas como modos.

| ID | Nombre | Posición | Rejilla | Estatus |
|---|---|---|---|---|
| `RGG.6.1` | Skank en contratiempo | Acorde corto en cada parte débil (el "y" de cada pulso) | `....|..x.|..x.|..x.` completo: `..x.|..x.|..x.|..x.` | `[H]` |
| `RGG.6.2` | Chop en los pulsos 2 y 4 | Acorde en el backbeat, duplicado por guitarra y piano | `....|x...|....|x...` | `[H]` |
| `RGG.6.3` | Bubble (órgano) | Mano izquierda sobre los contratiempos con semicorcheas de enmarque; mano derecha con el chop en 2 y 4 | enmarque en semicorcheas alrededor del contratiempo; patrón exacto `[V]` | `[H]` concepto |
| `RGG.6.4` | Strum de semicorchea | Rasgueo que sustituyó el skank en 2 y 4 en el reggae temprano | `[V]` | `[H]` |

### 8.2 Rasgos de ejecución
- El skank de guitarra añade una semicorchea tras el contratiempo; el bubble de órgano añade semicorcheas antes y después del contratiempo, más graves que la nota central, que forman un marco. `[I]`
- El bubble define si el tema se siente con corcheas rectas o con swing. `[H]`
- El piano recibe con frecuencia eco que se activa en los huecos de bajo y batería. `[I]`
- El cha-cha-chá comparte un patrón de piano casi idéntico al bubble, con el acento de la mano derecha en los pulsos 1 y 3. `[H]`

### 8.3 Parámetros
`skank_mode` (offbeat / backbeat), `bubble_on`, `frame_16ths`, `chord_length_ms`, `swing`, `delay_on_gap`.

---

## 9. RGG.7 · Percusión menor
- Pandereta, bloque de madera, shakers y tambores de mano aportan pulso y textura; el reggae usa pocas capas de percusión, cada una con función clara. `[H]`
- Para dispositivos de **Ethnic drums** y **Hi-hats**: capas `shaker_8ths`, `tambourine_offbeat`, `rim_click_3`, con probabilidad por paso.

---

## 10. RGG.8 · Dub: procedimientos con consecuencia rítmica

### RGG.8.1 Versión y riddim
- **Definición:** el *riddim* es la pista instrumental de batería y bajo; la *versión* reutiliza el riddim con otro contenido (voz, instrumento, mezcla). `[H]`
- Las versiones aparecieron en la cara B de los discos de 45 rpm y circularon en los sound systems. `[H]`
- **Para el dispositivo:** un patrón base (`riddim_id`) con **varias capas intercambiables**, y un modo "versión" que reorganiza la misma base.

### RGG.8.2 Retirada de capas (drop-out)
- King Tubby retiraba el ritmo en lugar de la voz, lo que presentaba ritmo y voz como entidades separadas y daba fuerza al regreso del ritmo. `[H]`
- **Parámetros:** `dropout_layers`, `dropout_len_beats`, `return_accent`.

### RGG.8.3 Eco y reverberación como ritmo derivado
- Los productores usaron el Roland Space Echo y delays de cinta en los años setenta. `[H]`
- Un delay de cinta aplicado al hi-hat genera ritmos adicionales. `[H]` (tutorial)
- **Delays rítmicos de uso común:** negra, corchea, corchea con puntillo, semicorchea. La elección depende de la práctica del productor. `[I]`
- **Parámetros:** `delay_ratio`, `feedback`, `wow` (modulación de cinta), `throw_prob` (probabilidad de lanzar un eco puntual sobre un golpe).

### RGG.8.4 Arco de mezcla
- Mezcla en vivo sobre la consola: mutes, filtros y envíos de efectos como gestos performativos. `[H]`
- **Parámetros:** automatización de `mute_mask` por compás con patrón repetible; coherente con `FOR.2`.

---

## 11. RGG.9 · Riddim digital y dancehall

### 11.1 Rasgos
- Dancehall: surge a finales de los setenta; nombre derivado de los bailes de sound system; Henry "Junjo" Lawes se menciona como productor clave de su registro como tal. `[H]` (calidad B)
- Hito digital: "(Under Mi) Sleng Teng" (Wayne Smith, 1985; King Jammy). Surgió de un preset de un teclado Casio y generó cientos de versiones. `[H]`
- Los estudios de Steely & Clevie construyeron riddims con sintetizadores portátiles en la segunda mitad de los ochenta. `[H]`
- Existe un recuento de "tres tipos" de riddim: clásico (por ejemplo Bam Bam para roots, dub y lovers rock), ragga (por ejemplo Juice) y digital (por ejemplo Sleng Teng). `[H]` (calidad B)

### 11.2 Patrones y fichas (rejilla)

| ID | Riddim / patrón | Descripción | Estatus |
|---|---|---|---|
| `RGG.9.1` | Sleng Teng | Línea de bajo ostinata "robótica" sobre batería programada | contorno `[V]` |
| `RGG.9.2` | Dem Bow / Poco Man Jam | Bombo constante y cajas sincopadas en 3+3+2; origen en Steely & Clevie (1989–90) | ver §12.4 |
| `RGG.9.3` | Bam Bam (1992, Sly & Robbie) | Groove elástico con palmas de inspiración india (Lenky) | patrón `[V]` |
| `RGG.9.4` | Punaany / Duck / Juice | Riddims ragga de alta circulación | patrón `[V]` |

- **Aviso de nomenclatura:** "Bam Bam" designa más de un riddim en las fuentes (clásico y de 1992). `[V]`
- **Datos faltantes:** transcripciones de bajo y batería de los riddims digitales.

---

## 12. RGG.10 · Derivados fuera de Jamaica

### 12.1 UK steppers
- **Origen:** dub británico de finales de los setenta y principios de los ochenta; Jah Shaka y su sound system del sur de Londres. `[H]`
- **Rasgos:** bombo constante en 4/4, sirenas de dub, tono militante y espiritual. `[H]`
- **Rejilla base:** igual que RGG.3.3, con tempos a menudo más rápidos que el roots. Tempo exacto `[V]`.
- **Ramas:** *digital steppers* de finales de los ochenta (Dread & Fred, con caja de ritmos y teclados, "Warrior Stance" de 1988 en Jah Shaka); Disciples, Iration Steppas, Mad Professor, Zion Train, Vibronics y otros. `[H]`
- **Difusión:** giras de sound systems por Europa, festivales de dub. `[H]`

### 12.2 Dub techno
- **Origen:** Basic Channel (Moritz von Oswald y Mark Ernestus), Berlín, 1993; *Phylyps Trak*; el sello Chain Reaction (1995); Rhythm & Sound. `[H]`
- **Estructura rítmica:** bombo en cuatro pulsos, hi-hat en contratiempo y **acordes de dub** (stabs) con eco, que recrean digitalmente el skank. `[H]`
- **Rejilla base:**
  ```
  bombo   : x...|x...|x...|x...
  hat     : ..x.|..x.|..x.|..x.     (contratiempo)
  acorde  : ..x.|....|..x.|....     (stab, `[V]` posiciones)
  ```
- **Capa de acorde sostenido:** un acorde largo en canal aparte sirve de colchón. `[H]` (tutorial)
- **Rasgo temporal:** cambios microscópicos sobre un lazo estable; la variación llega por filtros, eco y ruido. `[H]`
- **Taxonomía:** `GRV.14`, `PRO.19`, `MIC.4` (humanización browniana), `FOR.1`.
- **Parámetros:** `stab_positions`, `delay_ratio`, `feedback`, `filter_cutoff_lfo`, `hiss_amount`.

### 12.3 Dubstep y 2-step
- **Origen:** Reino Unido, finales de los noventa; desciende del 2-step garage con dub, jungle y drum and bass. `[H]`
- **Tempo:** 132–142 BPM, con 140 como valor típico. `[H]`
- **Medio tiempo:** caja o palmada en el pulso 3 sobre 140 BPM; sensación de 70 BPM; kick en el 1. `[H]`
- **2-step:** bombo en 1 y 3 con sincopas en el resto del kit; hi-hats con swing heredado del garage; hats en semicorcheas y sextillos. `[H]`
- **Rejilla de medio tiempo:**
  ```
  bombo   : x...|....|....|....
  caja    : ....|....|x...|....
  hat     : x.x.|x.x.|x.x.|x.x.     (o semicorcheas/sextillos)
  ```
- **Consecuencia perceptiva:** los oyentes completan el doble tiempo con el cuerpo (observación de Kode9). `[H]`
- **Taxonomía:** `GRV.3`, `COG.2` (entrainment).

### 12.4 Dembow y reggaetón
- **Cadena de transmisión:** Steely & Clevie, "Poco Man Jam" (Gregory Peck, 1989) → "Fish Market" (1990) → "Dem Bow" (Shabba Ranks, 1990, Bobby Digital) y "Ellos Benia" (Nando Boom, producido por Dennis "the Menace" Thompson) → Panamá → Puerto Rico. `[H]`
- **Estructura:** tresillo 3+3+2 como polirritmia sobre un bombo constante, con sincopa en las cajas. `[H]` (Wikipedia; Bandcamp Daily)
- **Rejilla de trabajo:**
  ```
  bombo   : x...|x...|x...|x...
  caja    : ...x|..x.|...x|..x.        (pasos 3, 6, 11, 14)  [V]
  ```
- **Divergencias en las fuentes:** una guía sitúa el bombo en 1 y 3; otras lo describen constante en cada pulso. Las cajas se describen como "y" de 2 y de 4 o con posiciones adicionales. `[V]`
- **Tempo del reggaetón:** 85–100 BPM. `[I]`
- **Variantes:** dembow dominicano, más rápido y percusivo; latin trap. `[I]`
- **Genealogía ampliada:** investigadores citan un patrón congoleño llamado *mbilu a makinu* como parentesco rítmico (Wayne Marshall). `[H]` (declaración en artículo divulgativo)
- **Taxonomía:** `CIC.6.1`, `CIC.3.1` (tresillo), `SUP.1`.

### 12.5 Lovers rock
- Estilo del sur de Londres de mediados y finales de los setenta; one drop suave, bajo cálido, guitarras sedosas y teclados envolventes con sensibilidad soul y R&B. `[H]` (calidad B)

### 12.6 Jungle y ragga
- El dancehall británico y el toasting alimentan el ragga jungle; samples de dancehall aparecen en discos como "On a Ragga Tip" (SL2). `[H]`
- Sleng Teng sirve de pista para MCs de dancehall, hip hop, jungle y grime. `[H]`
- Datos rítmicos del amen break: véase el informe anterior (`GRV.11`).

### 12.7 Fusiones de ska
- Ska de la segunda y tercera ola (2 Tone, ska punk, skacore) combina el contratiempo del ska con guitarras de punk. `[H]`

---

## 13. Matriz de la familia contra los ocho ejes

| Eje | Contribución de la familia | IDs destacados |
|---|---|---|
| `MET` | 4/4 con peso del pulso 3; sensación de medio tiempo; 2/4 del ska | RGG.2, RGG.3 |
| `ACE` | Contratiempo del skank; backbeat en 2 y 4 para guitarra y en 3 para batería | RGG.6, RGG.3.1 |
| `SUP` | Capas con función propia: bajo, batería, skank, bubble; tresillo sobre pulso constante en el dembow | RGG.6, RGG.10.4 |
| `MIC` | Swing de corchea, hi-hat laid-back, aflojamiento del pulso | RGG.4 |
| `CIC` | Ciclo de uno o dos compases; riddim como unidad reutilizable | RGG.5, RGG.8.1 |
| `PRO` | Eco como generador de ritmo, retirada de capas, versión | RGG.8 |
| `FOR` | Arco de mezcla y secciones de sound system; half-time | RGG.8.4, RGG.10.3 |
| `COG` | Entrainment del bombo en cuatro pulsos; ausencia del pulso 1 en el one drop como "pulso fantasma" | RGG.3.1, RGG.3.3 |

---

## 14. Meta-análisis

### 14.1 Consensos
1. Las **tres familias de batería** (one drop, rockers, steppers) estructuran la enseñanza y la producción.
2. El **backbeat en el pulso 3** define el reggae de batería.
3. El **contratiempo** de guitarra y teclado es un rasgo central.
4. El **bajo** lidera el roots reggae.
5. El **dub** surge del estudio y reutiliza el riddim.

### 14.2 Debates y divergencias
| Tema | Posiciones | Decisión de diseño |
|---|---|---|
| Rockers | Bombo en 1 y 3 (pedagogía) o bombo en cada pulso con golpes dobles de caja (Sly Dunbar, 1976) | Dos presets, `RGG.3.2a` y `RGG.3.2b` |
| Rockers y steppers | Las fuentes los describen como estilos que se superponen en el uso real | `kick_density` continuo entre 2 y 4 golpes |
| Origen del steppers | Sly Dunbar en Channel One; Jah Shaka y el dub británico como difusores | Ficha con ambos orígenes |
| Origen del one drop | Carlton Barrett y Winston Grennan figuran en las fuentes | Campo `attributions[]` |
| Origen del flying cymbal | Santa Davis; Sly Dunbar lo remonta a 1968; influencia del Philly bump | Campo `attributions[]` |
| Skank | En el contratiempo de cada pulso o en los pulsos 2 y 4 | `skank_mode` con dos valores |
| Primer riddim digital | Sleng Teng (1985) frente a experimentos anteriores de Lee Perry | Ficha con nota histórica |
| Fuente del dembow | "Poco Man Jam" y "Dem Bow" frente a "Ellos Benia" | Ficha con cadena de transmisión |
| Kick del dubstep | Solo en el 1; o en 1 y 3 en el 2-step | Dos presets |
| Tempos publicados | Rangos de divulgación con calidad B | Campo `bpm_range` con `verify: true` |

### 14.3 Implicaciones para SV Ritmic Sequencer
1. Añadir una rama **"Reggae, dub y derivados"** al navegador de ritmos (Paso 3), con subárbol `RGG`.
2. Incorporar los parámetros nuevos: `drop_beat`, `half_time`, `kick_density`, `skank_mode`, `bubble_on`, `open_mask` (flying cymbal), `bass_space`, `dropout_layers`, `delay_ratio`, `throw_prob`.
3. **Modo Sugerir:** las etiquetas `RGG` se activan por tempo (60–100 BPM para roots y rub-a-dub; 130–142 para steppers y dubstep), por nombres de pista ("dub", "stabs") y por la presencia de un bombo en cuatro pulsos.
4. **Destinos:** `Bassline` (RGG.5), `Chords` (RGG.6 y stabs de dub techno), `Hi-hats` (RGG.4), `Ethnic drums` (RGG.1.1 como principio de tres roles, con nota de uso restringido), `Others` (sirenas, efectos de dub).
5. **Arco de versión:** una función que construye 4 u 8 compases de riddim y aplica retiradas y ecos como hace una mezcla de dub.

### 14.4 Datos faltantes
- Transcripciones exactas de: flying cymbal, bubble, strum de reggae temprano, rub-a-dub, two drop y half drop, golpes dobles de rockers, Sleng Teng, Bam Bam, Punaany, y posiciones de caja del dembow.
- Tempos de referencia del UK steppers y del dub techno en las fuentes consultadas.
- Esquemas rítmicos de burru y kumina.
- Estudios de microtiempo del reggae (equivalentes a los de samba y maracatu del informe anterior): no se localizaron en esta búsqueda.

---

## 15. Entradas de datos propuestas (`data/patterns/reggae_family.json`)

```json
[
  {
    "id": "RGG.3.1/one_drop",
    "name": "One drop",
    "taxonomy": ["RGG.3.1", "ACE.2.2", "MIC.1.1", "GRV.5"],
    "origin": {
      "tradition": "Jamaica, roots reggae",
      "attributions": ["Carlton Barrett", "Winston Grennan"],
      "sources": ["Wikipedia: One drop rhythm", "MusicRadar", "Bradford College"]
    },
    "status": "H", "verify": false,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick",   "onsets": [8] },
      { "role": "rim",    "onsets": [8] },
      { "role": "hat",    "onsets": [0,2,4,6,8,10,12,14], "swing": 1.5 }
    ],
    "params": { "drop_beat": 1, "half_time": true },
    "repeat_policy": { "default_repeats": 4, "variation_on_last": "hat_triplet_fill" }
  },
  {
    "id": "RGG.3.2a/rockers_pedagogico",
    "name": "Rockers (acepción pedagógica)",
    "taxonomy": ["RGG.3.2", "GRV.6"],
    "status": "I", "verify": true,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick", "onsets": [0, 8] },
      { "role": "rim",  "onsets": [8] },
      { "role": "hat",  "onsets": [0,2,4,6,8,10,12,14], "swing": 1.5 }
    ]
  },
  {
    "id": "RGG.3.2b/rockers_channel_one",
    "name": "Rockers (Channel One, 1976)",
    "taxonomy": ["RGG.3.2", "RGG.3.3"],
    "status": "H", "verify": true,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick",  "onsets": [0, 4, 8, 12] },
      { "role": "snare", "onsets": [], "note": "golpes dobles: posiciones por verificar" }
    ]
  },
  {
    "id": "RGG.3.3/steppers",
    "name": "Steppers",
    "taxonomy": ["RGG.3.3", "GRV.7", "COG.2"],
    "origin": {
      "tradition": "Jamaica / Reino Unido",
      "attributions": ["Sly Dunbar (Channel One)", "Jah Shaka (difusión UK)"]
    },
    "status": "H", "verify": false,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick", "onsets": [0, 4, 8, 12] },
      { "role": "rim",  "onsets": [8] },
      { "role": "hat",  "onsets": [0,2,4,6,8,10,12,14], "swing": 1.0 }
    ],
    "params": { "bpm_range": [110, 140], "bpm_range_verify": true }
  },
  {
    "id": "RGG.6.1/skank_offbeat",
    "name": "Skank en contratiempo",
    "taxonomy": ["RGG.6.1", "ACE.2.2", "GRV.8"],
    "status": "H", "verify": false,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [ { "role": "chord", "onsets": [2, 6, 10, 14], "gate": 0.2 } ]
  },
  {
    "id": "RGG.6.2/chop_2_4",
    "name": "Chop en 2 y 4",
    "taxonomy": ["RGG.6.2", "ACE.2.2"],
    "status": "H", "verify": false,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [ { "role": "chord", "onsets": [4, 12], "gate": 0.2 } ]
  },
  {
    "id": "RGG.10.2/dub_techno_base",
    "name": "Dub techno (base)",
    "taxonomy": ["RGG.10.2", "GRV.14", "PRO.19"],
    "status": "H", "verify": true,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick",  "onsets": [0, 4, 8, 12] },
      { "role": "hat",   "onsets": [2, 6, 10, 14] },
      { "role": "chord", "onsets": [2, 10], "gate": 0.15, "fx": { "delay_ratio": "1/8.", "feedback": 0.55 } }
    ]
  },
  {
    "id": "RGG.10.3/dubstep_halftime",
    "name": "Dubstep (medio tiempo)",
    "taxonomy": ["RGG.10.3", "FOR.3", "GRV.3"],
    "status": "H", "verify": false,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick",  "onsets": [0] },
      { "role": "snare", "onsets": [8] },
      { "role": "hat",   "onsets": [0,2,4,6,8,10,12,14], "swing": 1.3 }
    ],
    "params": { "bpm_range": [132, 142] }
  },
  {
    "id": "RGG.10.4/dembow",
    "name": "Dembow",
    "taxonomy": ["RGG.10.4", "CIC.6.1", "CIC.3.1"],
    "origin": {
      "tradition": "Jamaica → Panamá → Puerto Rico",
      "attributions": ["Steely & Clevie", "Bobby Digital", "Dennis the Menace Thompson"]
    },
    "status": "I", "verify": true,
    "cycle_len": 16, "step_value": 0.25,
    "layers": [
      { "role": "kick",  "onsets": [0, 4, 8, 12] },
      { "role": "snare", "onsets": [3, 6, 11, 14] }
    ],
    "params": { "bpm_range": [85, 100] }
  },
  {
    "id": "RGG.1.1/nyabinghi_roles",
    "name": "Nyabinghi (principio de tres roles)",
    "taxonomy": ["RGG.1.1", "SUP.1"],
    "status": "H", "verify": true,
    "restricted_use": true,
    "structural_only": true,
    "roles": ["base_thunder", "pulse_funde", "improvising_repeater"]
  }
]
```

---

## 16. Fuentes

**Nivel A (prensa especializada, entrevistas, publicaciones)**
- Red Bull Music Academy Daily, "The (Not So Clear-Cut) History of the Flying Cymbal". https://daily.redbullmusicacademy.com/2013/07/flying-cymbal-feature
- FACT Magazine, entrevista a Carlton "Santa" Davis sobre los *flying cymbals*. https://factmag.com/2016/04/02/santa-davis-flying-cymbals-reggae-drummer-interview
- Berklee, "Bubblin'" (Matt Jenson). https://www.berklee.edu/berklee-today/spring-2015/The-Woodshed-Bubblin
- Berklee, "What Is Dembow?" (con Wayne Marshall). https://college.berklee.edu/news/what-is-dembow-tracing-the-roots-of-a-global-phenomenon
- Berklee Online, entrevista a Sly Dunbar. https://online.berklee.edu/takenote/?p=16481
- Jamaica Gleaner (8 feb 2026), semblanza de Sly Dunbar. https://web5.jamaica-gleaner.com/article/entertainment/20260208/lowell-sly-dunbar-drumbar-destiny
- Resident Advisor, "Rewind: Basic Channel – Phylyps Trak". https://ra.co/reviews/24143
- Wayne & Wax, "Desperately Seeking Dembow". https://wayneandwax.com/?p=7697
- Chang, K. O. y Chen, W., *Reggae Routes: The Story of Jamaican Music* (Temple University Press). https://www.prestomusic.com/books/products/8567674--reggae-routes-the-story-of-jamaican-music
- Okayplayer, "The Most Influential Dancehall and Soca Riddims of All Time". https://www.okayplayer.com/the-most-influential-dancehall-and-soca-riddims-of-all-time/1433338
- Clash Music, "Under Mi Sleng Teng: The Birth of Digital Dancehall". https://www.clashmusic.com/?p=238114
- Attack Magazine, "Basic Channel style dub techno". https://www.attackmagazine.com/technique/beat-dissected/basic-channel-style-dub-techno/
- Attack Magazine, "Dub-style drum processing". https://www.attackmagazine.com/technique/tutorials/dub-style-drum-processing-for-character-and-groove/
- Reggae.be, "R.I.P. Joseph 'Jo Jo' Hookim". https://www.reggae.be/en/magazine/archive/2018-09-22-r-i-p-joseph-jo-jo-hookim-vader-van-channel-one/
- The Vinyl Factory, "How Jamaica shaped the creative spirit and evolution of music production". https://thevinylfactory.com/features/how-jamaica-shaped-the-creative-spirit-and-evolution-of-music-production/
- Seddon, "King Tubby's Reign", Dread Library (UVM). https://www.uvm.edu/~debate/dreadlibrary/seddon.html
- Modern Drummer, "The Dubstep Beat". https://www.moderndrummer.com/?p=34026

**Nivel B (pedagogía y divulgación)**
- Wikipedia: One drop rhythm; Rocksteady; Ska; Dub music; Dub techno; Dubstep; Dembow beat; Riddim; Nyabinghi rhythm; Sly and Robbie; Channel One Studios; List of reggae genres.
- MusicRadar, "How to program a typical one drop reggae beat". https://www.musicradar.com/how-to/how-to-program-a-typical-one-drop-reggae-beat-and-add-fills
- Soundbrenner, "Reggae rhythm" y "Steppers rhythm". https://www.soundbrenner.com/blogs/articles/reggae-rhythm
- zZounds Blog, "Foundational beats: reggae drums". https://blog.zzounds.com/?p=16868
- Bax Shop, "Reggae drumming: rhythms, sounds and cues". https://www.bax-shop.co.uk/blog/drums/reggae-drumming-rhythms-sounds-and-cues/
- Bradford College, "Influences". https://digitalspace.bradfordcollege.ac.uk/10559357/influences/
- Stretta Music, "Intro: Reggae". https://www.stretta-music.dk/journal/intro-reggae
- Future Proof Music School, géneros dub techno y dubstep. https://genreexplorer.futureproofmusicschool.com/genre/dub-techno
- Musical-U, "Rhythm: how dubstep works". https://www.musical-u.com/learn/rhythm-how-dubstep-works
- All Around This World, "Nyabinghi drumming". https://www.allaroundthisworld.com/country/jamaica/
- Orphiq, "What is dancehall?" y "What is dembow?". https://orphiq.com/resources/what-is-dancehall
- Bass Culture (Dubmatix), "Militant Dub: The Rise of UK Steppers" y notas sobre percusión en el reggae. https://bassculture.substack.com/p/militant-dub-the-rise-of-uk-steppers
- Jahtari, historia de Dread & Fred y de Steely & Clevie. https://jahtari.org/archive/magazine/uk-dub/dreadfred.htm

**Nivel C (foros y blogs; requieren verificación)**
- DubRoom, "Making Dub With Computers", capítulos 5 y 7. https://www.dubroom.org/studio/tutorials-computerdub05.htm
- Roots Archives, foros sobre el flying cymbal y el rub-a-dub. https://www.roots-archives.com/forum/viewtopic.php?p=93562
