# Meta-análisis de tipologías rítmicas para dispositivos Max for Live

**Versión:** 1.0 · 17 de octubre de 2026
**Uso previsto:** base de conocimiento para que Claude Code diseñe y construya dispositivos Max for Live (MIDI Effects y Audio Effects) que generen, transformen y analicen ritmo.
**Autoría del marco:** Sidera Visus / Néstor Paredes Ulloa, con síntesis bibliográfica asistida.

---

## 0. Cómo leer este documento (instrucciones para Claude Code)

1. **Cada concepto tiene un ID estable** con el formato `EJE.n.m` (por ejemplo `SUP.2.1`). Úsalo como nombre de módulo, como etiqueta en el JSON de patrones y como referencia cruzada entre dispositivos.
2. **Cada nodo de la taxonomía trae cuatro capas:** definición, parámetros controlables, algoritmo y objetos de Max sugeridos.
3. **Convenciones de rejilla:**
   - Los pasos se cuentan desde **0**.
   - `x` = ataque, `.` = silencio, `X` = ataque acentuado, `D` = golpe grave (dum), `T` = golpe agudo (tak).
   - Un patrón escrito `x . . x . . x .` ocupa 8 pasos.
   - Los ciclos se definen por número de pasos (`cycle_len`) y por valor del paso (`step_value`, en fracciones de negra: `0.25` = semicorchea).
4. **Estatus epistémico de cada dato:**
   - `[H]` hecho documentado en la fuente citada.
   - `[I]` interpretación analítica compartida en la literatura.
   - `[Hip]` hipótesis abierta.
   - `[V]` dato por verificar en una transcripción o fuente primaria antes de fijarlo en un preset.
5. **Prioridad de implementación:** los patrones `[V]` se cargan como presets editables con la etiqueta `verify: true` visible en la interfaz.

---

## 1. Modelo de datos común

Todos los dispositivos comparten un mismo formato de patrón, guardado en un `[dict]` o en archivos `.json` dentro de la carpeta del proyecto. Así un patrón generado en un dispositivo viaja intacto a otro.

```json
{
  "id": "CIC.4.2/son_clave_3_2",
  "name": "Son clave 3-2",
  "taxonomy": ["CIC.4.2", "SUP.1.3", "ACE.2.1"],
  "origin": {
    "tradition": "Cuba / Caribe afrocubano",
    "genre": ["son", "salsa"],
    "context": "baile social, regulación de arreglos",
    "sources": ["Toussaint 2013", "Pérez Fernández 1987"],
    "restricted_use": false
  },
  "status": "H",
  "verify": false,
  "cycle_len": 16,
  "step_value": 0.25,
  "grouping": [3, 3, 4, 2, 4],
  "meter_weights": "auto",
  "layers": [
    {
      "role": "timeline",
      "onsets": [0, 3, 6, 10, 12],
      "velocity": [110, 90, 100, 100, 110],
      "timbre": [0, 0, 0, 0, 0],
      "microtiming": [0, 0, 0, 0, 0],
      "gate": [0.5, 0.5, 0.5, 0.5, 0.5],
      "probability": [1, 1, 1, 1, 1]
    }
  ],
  "transforms_allowed": ["rotate", "reverse", "density", "swing", "phase"],
  "notes": "La rotación de 8 pasos produce la clave 2-3."
}
```

**Campos clave:**
- `grouping`: agrupamiento métrico o aditivo (suma = `cycle_len`).
- `timbre`: índice de golpe (0 = grave/dum, 1 = agudo/tak, 2 = abierto, 3 = apagado), que el dispositivo traduce a notas MIDI configurables.
- `microtiming`: desplazamiento en **fracción del paso** (−0.5 a +0.5). Se convierte a ms según el tempo.
- `restricted_use`: marca repertorios sagrados o comunitarios cuyo uso requiere consentimiento (véase §7.4).

---

## 2. Taxonomía integrada en ocho ejes

| Prefijo | Eje | Pregunta que responde |
|---|---|---|
| `MET` | Métrica | ¿Cómo se organiza y se divide el tiempo? |
| `ACE` | Acentuación | ¿Qué posiciones reciben peso y por qué medio? |
| `SUP` | Superposición | ¿Cómo conviven varias capas? |
| `MIC` | Microtiempo y expresión | ¿Dónde cae cada ataque respecto de la rejilla? |
| `CIC` | Ciclo y periodicidad | ¿Qué figura recurrente sostiene el tiempo? |
| `PRO` | Procedimiento compositivo | ¿Qué operación transforma el material? |
| `FOR` | Forma temporal y tempo | ¿Cómo evoluciona la velocidad y la densidad a gran escala? |
| `COG` | Cognición y análisis | ¿Cómo se mide y se percibe lo que suena? |

Un mismo patrón ocupa varios ejes a la vez. La clave de son es timeline (`CIC`), patrón euclidiano (`PRO`), polirritmia contra el pulso (`SUP`) y objeto de sincronización corporal (`COG`). Por eso el JSON usa una lista `taxonomy` en lugar de una sola categoría.

---

### 2.1 Eje MET — Métrica

#### MET.1 Pulso, tactus y tempo
- **Definición:** el pulso es una serie isócrona que el oyente infiere y a la que sincroniza el cuerpo; el tactus es el nivel de pulso más saliente; el tempo es su velocidad. `[H]` (Lerdahl y Jackendoff 1983; London 2004)
- **Límites perceptivos:** London sitúa los elementos métricos entre ~100 ms y ~1,5–2 s de intervalo entre ataques, y ciclos completos de hasta 5–6 s. `[H]`
- **Parámetros:** `bpm`, `tactus_level` (qué nivel de la jerarquía se marca como pulso).
- **Implementación:** validar que ningún nivel métrico generado quede bajo 100 ms entre ataques; si ocurre, el dispositivo lo trata como textura (granular) y lo señala en la interfaz.
- **Max:** `[plugsync~]` para la posición de transporte; `[translate notevalues ms]` para convertir valores a ms.

#### MET.2 Jerarquía métrica
- **Definición:** pulsos periódicos anidados: subdivisión → pulso → compás → hipercompás. `[H]`
- **Subtipos:**
  - `MET.2.1` **Binaria:** cada nivel se divide en 2 (2/4, 4/4).
  - `MET.2.2` **Ternaria:** el compás tiene 3 pulsos (3/4: vals, mazurca, jota, sevillanas).
  - `MET.2.3` **Cuaternaria:** 4 pulsos con jerarquía fuerte–débil–semifuerte–débil.
  - `MET.2.4` **Compuesta:** el pulso se divide en 3 (6/8, 9/8, 12/8).
  - `MET.2.5` **Hipermetro:** frases de 2, 4, 8 y 16 compases (Cone, Rothstein). Rige la forma de la música electrónica de baile.
- **Parámetros:** `beats_per_bar`, `beat_division` (2 o 3), `hyper_len`.
- **Algoritmo:** pesos métricos por nivel (véase `COG.3.1`).

#### MET.3 Compases aditivos y no isócronos
- `MET.3.1` **Amalgama (teoría hispana):** suma de compases de igual denominador que conservan sus acentos, como 5/4 = 3/4 + 2/4. `[H]`
- `MET.3.2` **Compás de tiempos desiguales:** un único compás con pulsos de duración distinta, como 7/8 = 2+2+3. `[H]`
- `MET.3.3` **Aksak (Brăiloiu 1951/52):** ritmo construido con dos unidades, breve y larga, en proporción 2:3. Brăiloiu enumeró 1884 combinaciones. `[H]`
- `MET.3.4` **Métrica no isócrona (NI-meter, London):** jerarquía cuyos pulsos tienen dos o más duraciones; London propone que se organiza según la máxima uniformidad posible. `[H]`
- `MET.3.5` **Ritmo aditivo/divisivo (Sachs 1953):** el divisivo subdivide una duración; el aditivo suma unidades desiguales. London advierte que estos dos términos se usan de manera confusa. `[H]`
- **Parámetros:** `grouping` (lista de 2 y 3), `unit` (corchea o semicorchea).
- **Algoritmo:** generador de composiciones de n en 2 y 3 (véase §4.3).

#### MET.4 Ritmo libre y métricas flexibles
- `MET.4.1` **Ritmo libre / no medido:** duraciones sin pulso isócrono (canto llano, alap, taqsim, baguala).
- `MET.4.2` **Parlando-rubato y tempo giusto (Bartók):** canto ligado al habla frente a canto medido y bailable. `[H]`
- `MET.4.3` **Giusto silábico (Brăiloiu):** cada sílaba toma una de dos duraciones en proporción 1:2. `[H]`
- **Parámetros:** `pulse_strength` (0 = libre, 1 = isócrono), `duration_set` (lista de duraciones permitidas).
- **Implementación:** modo "free" que agenda eventos con `[pipe]` a duraciones tomadas de `duration_set` sin anclarse al transporte; modo "giusto" que cuantiza a dos valores.

---

### 2.2 Eje ACE — Acentuación

#### ACE.1 Fuentes del acento
| ID | Tipo | Medio sonoro | Mapeo MIDI sugerido |
|---|---|---|---|
| `ACE.1.1` | Métrico | Posición en la jerarquía | Peso base de velocity |
| `ACE.1.2` | Dinámico | Intensidad | Velocity |
| `ACE.1.3` | Agógico | Duración o leve retraso | Gate length + microtiming positivo |
| `ACE.1.4` | Tónico | Altura (picos, saltos de octava) | Transposición de nota |
| `ACE.1.5` | Tímbrico | Cambio de color | CC de filtro, índice `timbre` |
| `ACE.1.6` | Armónico/textural | Cambio de acorde o densidad | Disparo de cambio de acorde |

Lerdahl y Jackendoff agrupan estas fuentes en tres categorías: acento fenoménico, estructural y métrico. `[H]`

- **Dispositivo:** `Acentuador` (véase §5) recibe una lista de pesos (0–1) por paso y la reparte entre velocity, gate, transposición y CC según una matriz de mezcla editable.

#### ACE.2 Desplazamiento del acento
- `ACE.2.1` **Síncopa (hispana):** ataque en parte débil que se prolonga sobre la parte fuerte siguiente. `[H]`
  - Rejilla 2/4 en corcheas: `x x~x .`
  - Subtipos por nivel: de compás, de tiempo, de parte; y regular o irregular según la duración relativa de sus mitades.
- `ACE.2.2` **Contratiempo:** ataque en parte débil precedido de silencio en la parte fuerte. `[H]`
  - Rejilla: `. x . x`
  - Es la base del skank de reggae y ska y del hi-hat abierto en contratiempo del house.
- `ACE.2.3` **Anticipación:** el ataque llega antes del tiempo fuerte y lo ocupa (tumbao de la salsa, pushes de acordes).
- `ACE.2.4` **Síncopa amplia (inglés *syncopation*):** cualquier ataque en posición débil seguido de silencio en posición más fuerte. Es la definición operativa de los estudios de groove. `[H]`
- **Parámetros:** `shift_steps`, `tie` (on/off: distingue síncopa de contratiempo), `level`.

#### ACE.3 Posición de inicio y cierre de frase
- `ACE.3.1` **Tético:** la frase empieza en el tiempo fuerte.
- `ACE.3.2` **Anacrúsico:** empieza con notas previas al tiempo fuerte.
- `ACE.3.3` **Acéfalo:** el tiempo fuerte inicial es silencio.
- `ACE.3.4` **Final masculino / femenino:** la frase termina en tiempo fuerte o débil.
- **Parámetros:** `phrase_offset` (pasos de anacrusa), `downbeat_mute`.

---

### 2.3 Eje SUP — Superposición

#### SUP.1 Polirritmia
- **Definición:** capas con agrupamientos distintos dentro de un mismo ciclo, que coinciden periódicamente. `[H]`
- `SUP.1.1` **3:2** sobre 6 pulsos: `x . x . x .` contra `x . . x . .`
- `SUP.1.2` **4:3** sobre 12 pulsos.
- `SUP.1.3` **Polirritmia contra el pulso (contramétrica, Arom):** figura cíclica que contradice sistemáticamente el pulso de la danza. `[H]`
- `SUP.1.4` **Cross-rhythm (A. M. Jones):** ambas capas tienen estatus de pulso.
- **Parámetros:** `ratio_a`, `ratio_b`, `cycle_len` = mcm de los denominadores.
- **Algoritmo:** onsets de la capa a: `i * cycle_len / a` para `i` en `0..a-1`.

#### SUP.2 Polimetría
- **Definición:** métricas o ciclos de distinta longitud superpuestos; las capas se realinean cada mcm de sus longitudes. `[H]`
- `SUP.2.1` **Ciclos de longitud distinta:** 16 contra 12 se realinean a los 48 pasos; 16 contra 5, a los 80.
- `SUP.2.2` **Compases distintos simultáneos:** 3/4 contra 4/4.
- **Debate:** Agawu sostiene que gran parte de lo descrito como "polimetría africana" es polirritmia sobre una métrica única regulada por la danza. `[I]`
- **Parámetros:** `layer_len[]` por capa; indicador de "realineación en N pasos".
- **Max:** un contador `[counter]` por capa alimentado por el mismo reloj de paso.

#### SUP.3 Hemiola y sesquiáltera
- **Definición:** proporción 3:2 aplicada de forma sucesiva (alternancia 6/8–3/4) o simultánea (6/8 sobre 3/4). `[H]`
- `SUP.3.1` **Sucesiva:** compás A en `[0,3]` (6/8), compás B en `[0,2,4]` (3/4).
- `SUP.3.2` **Simultánea (birritmia):** melodía en 6/8 sobre bombo en 3/4, como en zamba y chacarera. `[H]`
- **Parámetros:** `mode` (sucesiva/simultánea), `alternation_pattern` (por ejemplo `AABB`, `ABAB`).

#### SUP.4 Hoquetus y entrelazado
- `SUP.4.1` **Hoquetus:** una línea repartida entre varios ejecutantes que aportan sonidos aislados (ars antiqua, trompas banda-linda, polifonía aka). `[H]`
- `SUP.4.2` **Kotekan balinés:** dos partes complementarias, *polos* (sobre el pulso) y *sangsih* (entre pulsos), que forman una figura rápida continua. `[H]`
- `SUP.4.3` **Siku andino (ira/arka):** el siku se divide en dos mitades de tubos y dos músicos alternan notas para completar la melodía. `[H]`
- **Algoritmo:** distribuir los onsets de una línea entre N voces según una regla (alternancia, registro, posición métrica).
- **Max:** `[route]` por índice de voz, una salida MIDI por canal.

---

### 2.4 Eje MIC — Microtiempo y expresión

#### MIC.1 Subdivisión desigual
- `MIC.1.1` **Swing / shuffle:** corcheas o semicorcheas largas–cortas. La proporción (swing ratio) aumenta a tempos lentos y se acerca a 1:1 a tempos rápidos (Friberg y Sundström 2002). `[H]`
  - **Parámetros:** `ratio` (1.0–3.0), `swing_level` (corchea/semicorchea), `tempo_coupling` (0–1: cuánto se reduce el ratio al subir el tempo).
  - **Fórmula:** offset del paso impar = `(ratio/(1+ratio) − 0.5) * 2` en fracción del paso.
- `MIC.1.2` **Straight:** subdivisión igual 1:1.

#### MIC.2 Plantillas sistemáticas de microtiempo
Estas plantillas son **rasgos estructurales del estilo**: los estudios muestran que el cuerpo de músicos y bailarines reproduce las mismas desviaciones.
- `MIC.2.1` **Samba:** anticipación sistemática de la 3.ª y 4.ª semicorchea de cada pulso, presente también en el taconeo del músico y los pasos del bailarín. `[H]`
  - Perfil inicial editable: `[0, 0, -0.08, -0.06]` en fracción del paso `[V]` (calibrar con mediciones).
- `MIC.2.2` **Samba, detalle espectral (Naveda):** leve retraso del registro grave en la primera semicorchea del pulso, y accelerandos y ritardandos sistemáticos a escala de frases de 2 y 4 pulsos. `[H]`
- `MIC.2.3` **Telespringar noruego:** compás de tres pulsos de duración Larga–Media–Corta, con proporción media 38:34:28. `[H]`
  - Plantilla de pulso: `[0.38, 0.34, 0.28]` del compás.
- `MIC.2.4` **Vals vienés:** segundo pulso adelantado. `[I]` (magnitud por medir `[V]`)
- `MIC.2.5` **Jembe de Malí (Polak):** subdivisiones no isócronas del pulso en la música de jembe. `[I]` (referencia y proporciones `[V]`)
- `MIC.2.6` **Laid-back / push:** colocación sistemática detrás o delante del pulso por instrumento (bajo atrás, hi-hat adelante). `[H]` (Danielsen; Iyer 2002)
- `MIC.2.7` **Maracatu:** perfiles de microtiempo que varían a lo largo de la pieza en la caixa y el tarol, con dependencia del instrumento que se toma como referencia de pulso. `[H]`

#### MIC.3 Rejillas no isócronas como estructura
- **Modelo de Sioros (ISMIR 2023):** genera rejillas no isócronas a partir de pulsos isócronos dentro de una estructura polirrítmica; los patrones de microtiempo observados surgen de esa rejilla estructural. La métrica isócrona es un caso particular del modelo. `[H]`
- **Implementación:** una "rejilla deformable" donde cada paso tiene una posición absoluta editable (vector de 16 o 12 floats que suma 1). Las plantillas `MIC.2.x` son presets de esta rejilla.

#### MIC.4 Discrepancias participativas
- **Definición (Keil 1987):** pequeñas desviaciones procesuales (tiempo) y texturales (afinación, timbre) que dan a la música su poder participativo. `[H]`
- **Crítica:** Berger cuestiona que las discrepancias produzcan participación de manera automática. `[I]`
- **Implementación:** humanizador estocástico con distribución gaussiana por capa (`sigma_ms`), sesgo (`bias_ms`) y correlación temporal (`drift`: ruido browniano en lugar de ruido blanco, para que la desviación respire).

#### MIC.5 Rubato y tempo flexible
- `MIC.5.1` **Rubato chopiniano:** la melodía se desplaza sobre un acompañamiento estable.
- `MIC.5.2` **Rubato global:** el tempo entero se flexiona.
- **Implementación:** el rubato de capa se hace con microtiming acumulativo que regresa a cero al final de la frase; el rubato global, con curvas de tempo (véase `FOR`).

#### Nota técnica sobre microtiempo negativo en Max for Live
Un evento MIDI no puede enviarse antes de que ocurra su disparo. Para anticipar ataques:
1. Agendar con **lookahead**: leer el paso siguiente con `[plugsync~]`/`[phasor~]` y disparar cada nota en `t_step − offset` usando `[pipe]`.
2. Alternativa: retrasar todas las capas una cantidad fija `L` y aplicar offsets en el rango `[−L, +L]`; compensar `L` con el *Track Delay* de Live.

---

### 2.5 Eje CIC — Ciclo y periodicidad

#### CIC.1 Ostinato y riff
- **Definición:** figura repetida de forma persistente; riff es el término en jazz, rock y funk.
- `CIC.1.1` **Ostinato de subdivisión continua con acento melódico:** caso del bajo de Moroder (*I Feel Love*, 1977): corriente de semicorcheas cuantizadas sobre four-on-the-floor, con acentos por altura y filtro. `[I]` (contorno exacto `[V]`)

#### CIC.2 Timeline / patrón guía
- **Definición (Agawu 2006):** figura rítmica de forma distintiva, duración modesta, tocada como ostinato a lo largo de una pieza de danza. Sinónimos: bell pattern, guideline, time keeper, topos. `[H]`
- `CIC.2.1` **Standard pattern (ewe/yoruba, 12 pulsos):** `x . x . x x . x . x . x` → onsets `[0,2,4,5,7,9,11]`, perfil durativo ⟨2212221⟩. `[H]`

#### CIC.3 Familia del tresillo y la clave
| ID | Patrón | Pasos | Onsets | Estado |
|---|---|---|---|---|
| `CIC.3.1` | Tresillo (3+3+2) | 8 | `[0,3,6]` | `[H]` |
| `CIC.3.2` | Habanera | 8 | `[0,3,4,6]` | `[H]` |
| `CIC.3.3` | Cinquillo | 8 | `[0,2,3,5,6]` | `[H]` |
| `CIC.3.4` | Son clave 3-2 | 16 | `[0,3,6,10,12]` | `[H]` |
| `CIC.3.5` | Rumba clave 3-2 | 16 | `[0,3,7,10,12]` | `[H]` |
| `CIC.3.6` | Bossa clave | 16 | `[0,3,6,10,13]` | `[H]` |
| `CIC.3.7` | Claves 2-3 | 16 | rotación de 8 pasos de la 3-2 | `[H]` |

- **Binarización (Pérez Fernández 1987):** proceso histórico por el que patrones ternarios africanos de 12 pulsos se convirtieron en binarios de 8 o 16 en América. `[Hip]` influyente.
- **Implementación:** transformación `ternary_to_binary(pattern12)` que mapea cada onset `i` a `round(i * 16 / 12)` con opciones de redondeo (piso, techo, más cercano). Permite escuchar la hipótesis.

#### CIC.4 Sistemas cíclicos de tradiciones letradas

##### CIC.4.1 Tala indostánica
| Tala | Pulsos | Divisiones (vibhag) | Tali (palmada) | Khali (vacío) |
|---|---|---|---|---|
| Teental | 16 | 4+4+4+4 | 1, 5, 13 | 9 |
| Jhaptal | 10 | 2+3+2+3 | 1, 3, 8 | 6 |
| Rupak | 7 | 3+2+2 | 4, 6 | 1 (sam = khali) |
| Ektal | 12 | 2+2+2+2+2+2 | 1, 5, 9, 11 | 3, 7 |

(numeración desde 1, como en la práctica) `[H]`
- **Laya:** vilambit (lento), madhya (medio), drut (rápido).
- **Tihai:** frase repetida tres veces que termina en *sam*. Fórmula: `total = 3P + 2G`; inicio = `(cycle_len − total) mod cycle_len`.
- **Uso en dispositivos:** sam → acento máximo; khali → timbre agudo (`timbre = 1`) o reducción de grave; tali → acentos secundarios.

##### CIC.4.2 Tala carnática (sistema suladi sapta tala)
- **Componentes (angas):** anudrutam `U` = 1 unidad; drutam `O` = 2; laghu `|` = variable según la *jati*. `[H]`
- **Jati (longitud del laghu):** tisra 3, chatusra 4, khanda 5, misra 7, sankeerna 9. `[H]`
- **Siete familias:**

| Tala | Fórmula | Chatusra jati (unidades) |
|---|---|---|
| Dhruva | `| O | |` | 4+2+4+4 = 14 |
| Matya | `| O |` | 4+2+4 = 10 |
| Rupaka | `O |` | 2+4 = 6 |
| Jhampa | `| U O` | 4+1+2 = 7 |
| Triputa | `| O O` | 4+2+2 = 8 (Adi tala) |
| Ata | `| | O O` | 4+4+2+2 = 12 |
| Eka | `|` | 4 |

- **Combinatoria:** 7 talas × 5 jatis = 35 talas, con longitudes de 3 (tisra eka) a 29 (sankeerna dhruva). Cada unidad se subdivide según la *gati* o *nadai* (3, 4, 5, 7 o 9), lo que da 175 combinaciones. `[H]`
- **Fórmula de matras:** `matras = suma_de_unidades × gati`. Ejemplo: khanda jati matya (12 unidades) en chatusra gati = 48 matras. `[H]`
- **Generador:** `tala(family, jati, gati)` devuelve `cycle_len`, `grouping` por anga y los pesos de acento (inicio de cada anga = acento; inicio del ciclo = máximo).

##### CIC.4.3 Iqa' árabe
- **Definición:** ciclos de golpes graves (*dum*, resonante) y agudos (*tak*, seco), notados como esqueleto que el percusionista ornamenta. Los iqa'at cortos (2/4 a 8/4) dominan el folclor, el tarab y el pop; los largos (7/8 hasta 32/4) pertenecen sobre todo a la *muwashshah*. `[H]`

| ID | Iqa' | Pasos (corcheas o semicorcheas) | Patrón | Estado |
|---|---|---|---|---|
| `CIC.4.3.1` | Maqsum (4/4) | 8 | `D T . T D . T .` | `[H]` |
| `CIC.4.3.2` | Baladi / Masmudi saghir (4/4) | 8 | `D D . T D . T .` | `[H]` |
| `CIC.4.3.3` | Saidi (4/4) | 8 | `D T . D D . T .` | `[H]` |
| `CIC.4.3.4` | Malfuf (2/4) | 8 | `D . . T . . T .` | `[H]` |
| `CIC.4.3.5` | Wahda (4/4) | 8 | dum en el pulso 1 con taks escasos | `[H]` estructura; taks `[V]` |
| `CIC.4.3.6` | Fox (2/4) | 4 | `D T D T` | `[H]` |
| `CIC.4.3.7` | Sama'i thaqil (10/8) | 10 | agrupamiento 3+2+2+3 | `[H]` agrupamiento; golpes `[V]` |

- **Modulación entre iqa'at:** el baladi modula con frecuencia a maqsum y vuelve, y también a malfuf (2 compases de malfuf por 1 de baladi). `[H]` → útil como regla de transición en un dispositivo de cambio de patrón.
- **Ornamentación:** en la práctica, la rejilla útil para ornamentar el maqsum es de 32 posiciones por compás. `[I]`

##### CIC.4.4 Usul otomano
- Ciclos compartidos en gran parte con el repertorio árabe. `[H]`
- Ejemplos: aksak 9/8 = 2+2+2+3; curcuna 10/8 = 3+2+2+3. `[I]`

##### CIC.4.5 Jangdan coreano
- **Definición:** patrón rítmico cíclico tocado en el *janggu* que acompaña al canto; se divide en jangdan de música cortesana (jeong-ak) y de música folclórica (minsok-ak). `[H]`
- **Ejemplos:**
  - Jinyangjo: el más lento del pansori y el sanjo; 6 pulsos por *gak* y 4 *gak* por ciclo = 24 pulsos. `[H]`
  - Jungmori: 12 pulsos. `[H]`
  - Semachi: algo rápido, de tres pulsos. `[H]`
  - Eotmori: muy rápido, en 10/8. `[H]`
  - Jajinmori: rápido, de 4 pulsos ternarios (12/8 occidental). `[H]`
- **Forma *man-jung-sak*:** encadenamiento de jangdan de lento a rápido. `[H]` → ver `FOR.2.2`.
- **Teoría:** Yi Bo-hyung propone una estructura sintáctica del jangdan con nivel profundo y nivel de superficie. `[H]`
- Agrupamiento de eotmori 3+3+2+2 o 3+2+2+3 según escuela `[V]`.

#### CIC.5 Colotomía (gamelan javanés y balinés)
- **Definición:** los gongs marcan subdivisiones jerárquicas de un ciclo (*gongan*); el golpe más importante llega al final del ciclo. `[H]`
- **Lancaran (16 pulsos, convención estándar):** ketuk en pulsos impares; kenong en 4, 8, 12, 16; kempul en 6, 10, 14; gong en 16 (numeración desde 1). `[I]` (variantes regionales `[V]`)
- **Ketawang y ladrang:** ciclos de 16 y 32 pulsos con su propia distribución `[V]`.
- **Irama:** relación de densidad entre la melodía nuclear (*balungan*) y los instrumentos de elaboración. Cinco niveles según los golpes del saron panerus por nota del balungan:

| Irama | Nombre | Golpes por nota del balungan |
|---|---|---|
| ½ | lancar | 1 |
| I | tanggung | 2 |
| II | dados (dadi) | 4 |
| III | wilet | 8 |
| IV | rangkep | 16 |

  Cada irama admite tres *laya* (tempos): seseg (rápido), sedeng (medio), tamban (lento). En los irama lentos hay más espacio y los instrumentos de elaboración ganan protagonismo. `[H]`
- **Implementación:** el dispositivo `Colotomía` separa dos controles:
  - `irama` multiplica la densidad de las capas de elaboración (×2 por nivel) mientras el ciclo de gongs se expande en el tiempo.
  - `laya` cambia el tempo sin tocar la densidad relativa.

#### CIC.6 Ciclos afroamericanos y criollos
| ID | Género | Estructura | Estado |
|---|---|---|---|
| `CIC.6.1` | Dembow (reggaetón) | bombo `[0,4,8,12]`; caja `[3,6,11,14]` en 16 | `[H]` |
| `CIC.6.2` | Samba | surdo con acento en el pulso 2 de 2/4 | `[H]`; tamborim `[V]` |
| `CIC.6.3` | Maracatu de baque virado | alfaia, gonguê (cumple función de clave), caixa, tarol, mineiro, abê; toques: martelo, luanda, arrastão (o toque do elefante), baque parado; las *viradas* rompen la repetición o introducen un nuevo baque | `[H]`; patrones `[V]` |
| `CIC.6.4` | Candombe | tres tambores (chico, repique, piano); *madera* en el casco | `[H]`; patrones `[V]` |
| `CIC.6.5` | Cumbia | llamador en contratiempo, alegre improvisando, guacharaca en corcheas | `[H]` |
| `CIC.6.6` | Festejo y landó (Perú) | 6/8 y 12/8 con cajón | `[H]`; patrones `[V]` |
| `CIC.6.7` | Huayno | 2/4 con célula corchea–dos semicorcheas `x . x x` | `[H]` |

#### CIC.7 Compás flamenco
- **Ciclo de 12 con acentos en 3, 6, 8, 10 y 12** (desde 1) → onsets acentuados `[2,5,7,9,11]` (desde 0). Es la combinación 3+3+2+2+2. `[H]`
- **Variantes:**
  - Soleá: lenta, acentuación de base.
  - Alegrías y cantiñas: misma acentuación.
  - Bulería: rápida y variable; medios compases de 6.
  - Seguiriya: el mismo ciclo empezando en el 8, sentido como 2+2+3+3+2.
- **Parámetro:** `start_offset` (rotación del ciclo), que convierte la soleá en seguiriya.

#### CIC.8 Ciclos sesquiálteros sudamericanos
- **Cueca chilena:** las seis corcheas forman dos grupos de tres o tres de dos; Vega propone notar el segundo caso como 6/8 binario y documenta que la cueca usa ambas especies con fórmulas limitadas. `[H]`
- **Tonada chilena:** fluctuación entre 6/8 y 3/4 en la figura rítmico-melódica y el acompañamiento. `[H]`
- **Zamba, chacarera, joropo, son jarocho:** birritmia 6/8–3/4 con reparto por instrumento. `[H]`
- **Implementación:** `SUP.3` con presets por género; patrones de bombo legüero y rasgueo `[V]`.

#### CIC.9 Kultrún mapuche
- **Instrumento:** tambor ceremonial de caja semiesférica tallada en madera (canelo, laurel, lenga, lingue), con parche de cuero tensado y objetos en su interior (piedras, cuentas) en grupos de cuatro o sus múltiplos; suena a la vez como membranófono y sonaja. `[H]`
- **Contexto:** instrumento de la machi; su membrana pintada representa el universo mapuche dividido en cuatro. María Ester Grebe lo describe como un microcosmo simbólico (*Revista Musical Chilena*, 1973). `[H]`
- **Terminología:** *ülkantun* para la música cantada; *purrun* para la música instrumental de danza. `[H]`
- **Datos rítmicos:** Grebe cita notaciones de esquemas rítmicos del kultrún de 1934–1949; esas transcripciones no se consultaron en esta revisión. **Dato faltante.**
- **Uso en dispositivos:** como principio estructural (ciclo de cuatro, golpe más sacudida simultánea o independiente) y con `restricted_use: true` para cualquier patrón ceremonial (véase §7.4).

---

### 2.6 Eje PRO — Procedimientos compositivos

| ID | Procedimiento | Definición | Parámetros | Referencia |
|---|---|---|---|---|
| `PRO.1` | Ritmo euclidiano | E(k,n): k ataques repartidos en n pasos de la forma más uniforme | `k`, `n`, `rotation` | Toussaint 2005, 2013 |
| `PRO.2` | Máxima uniformidad | Distribución más pareja posible de k en n; converge con E(k,n) | `k`, `n` | London; Clough y Douthett |
| `PRO.3` | Modos rítmicos | Seis patrones de pies métricos largo/breve (Notre-Dame, s. XII–XIII) | `mode` 1–6 | Johannes de Garlandia |
| `PRO.4` | Isorritmia | Talea (patrón rítmico) independiente del color (patrón de alturas); los ciclos se desfasan | `talea[]`, `color[]` | Ludwig 1904; Vitry, Machaut |
| `PRO.5` | Valor añadido | Valor breve agregado a un ritmo mediante nota, silencio o puntillo | `position`, `value` | Messiaen 1944 |
| `PRO.6` | Ritmo no retrogradable | Palíndromo rítmico en torno a un valor central | `half[]`, `center` | Messiaen 1944 |
| `PRO.7` | Aumentación / disminución | Multiplicar duraciones por un factor | `factor` | Messiaen; tradición del canon |
| `PRO.8` | Personajes rítmicos | Una célula crece, otra decrece, otra permanece | tres células | Messiaen |
| `PRO.9` | Modulación métrica | Nuevo tempo = tempo × (valor común viejo / valor común nuevo) | `ratio` | Carter; Goldman 1951 `[V]` |
| `PRO.10` | Proceso de fase | Dos patrones idénticos a tempos levemente distintos | `drift_ratio` | Reich 1965–67 |
| `PRO.11` | Desplazamiento discreto | Una capa avanza un paso cada N repeticiones | `shift_every` | Reich, *Clapping Music* 1972 |
| `PRO.12` | Canon de tempo | Voces en proporciones fijas de tempo, incluso irracionales | `ratios[]` | Nancarrow |
| `PRO.13` | Serialización de duraciones | Serie de valores permutada | `series[]`, `permutation` | Messiaen, Boulez |
| `PRO.14` | Rotación, retrogradación, inversión | Operaciones de collar (*necklace*) sobre el patrón | `rot`, `retro`, `complement` | Toussaint |
| `PRO.15` | Variación de densidad | Añadir o quitar ataques según peso métrico | `density` 0–1 | práctica de secuenciadores |
| `PRO.16` | Tihai / cadencia triple | Frase ×3 que aterriza en el inicio del ciclo | `P`, `G` | tradición indostánica |
| `PRO.17` | Viradas y fills | Variación que rompe la repetición e introduce un nuevo patrón | `every_n_bars`, `pool[]` | maracatu, batería popular |
| `PRO.18` | Unificación altura–ritmo | Duraciones tratadas como frecuencias subaudibles | `base_hz` | Stockhausen 1957 |
| `PRO.19` | Ritmo de delay (dub) | El eco a corchea con puntillo genera un ritmo derivado | `delay_ratio`, `feedback` | King Tubby, Basic Channel |

---

### 2.7 Eje FOR — Forma temporal y tempo

#### FOR.1 Hipermetro y forma por bloques
- Bloques de 4, 8, 16 y 32 compases con cambios de textura en los bordes; rige la música electrónica de baile. `[I]`
- **Parámetros:** `block_len`, `fill_on_last_bar`.

#### FOR.2 Arcos de tempo y densidad
- `FOR.2.1` **Jo-ha-kyū (Zeami, teatro noh):** principio formal en tres fases (introducción lenta, ruptura o desarrollo que acelera, conclusión rápida) aplicado a escalas sucesivas, desde un gesto hasta una obra completa. `[H]`
- `FOR.2.2` **Man-jung-sak (Corea):** encadenamiento de jangdan de lento a medio a rápido. `[H]`
- `FOR.2.3` **Accelerando de irama (gamelan):** cambios de nivel de irama que "cambian de marcha" la densidad. `[H]`
- `FOR.2.4` **Ma (Japón):** intervalo de tiempo o espacio cargado de sentido; su duración justa se considera señal de maestría del intérprete. `[H]`
- **Implementación:**
  - Curva de tempo o densidad de tres segmentos con puntos editables y recursión opcional (cada fase contiene su propio arco jo-ha-kyū).
  - `Ma` como parámetro de silencio: probabilidad y duración de pausas en los bordes de frase, con tempo de reanudación libre.

#### FOR.3 Laya y relación tempo–densidad
- La laya indostánica y la javanesa distinguen la velocidad del pulso de la densidad de elaboración. `[H]`
- **Regla de diseño:** todo dispositivo separa `tempo` de `density`.

---

### 2.8 Eje COG — Cognición y análisis

#### COG.1 Inducción del pulso
- Los recién nacidos muestran respuesta de discordancia cerebral cuando se omite el tiempo fuerte de un patrón de batería (Winkler, Honing et al. 2009). `[H]`; el alcance innato del efecto sigue en discusión `[Hip]`.

#### COG.2 Sincronización (entrainment) y aculturación
- **Entrainment:** acoplamiento de osciladores atencionales y motores a periodicidades externas (Large y Jones; Clayton, Sager y Will 2005). `[H]`
- **Aculturación:** a los 6 meses los bebés detectan alteraciones en métricas simples y complejas (balcánicas); a los 12 meses la sensibilidad a las complejas ya se ha perdido en contextos que no las usan (Hannon y Trehub 2005). `[H]`
- **Many Meters Hypothesis (London):** cada oyente experto dispone de un repertorio de métricas aprendidas, específicas de tempo y estilo. `[H]`

#### COG.3 Medidas computables
- `COG.3.1` **Pesos métricos (Longuet-Higgins y Lee 1984):** para 16 pasos en 4/4:
  ```
  [0,-4,-3,-4,-2,-4,-3,-4,-1,-4,-3,-4,-2,-4,-3,-4]
  ```
- `COG.3.2` **Índice de síncopa:** cuando un ataque de peso `w` va seguido de un silencio de peso `W > w`, suma `W − w`. Es la base (en la adaptación de Fitch y Rosenfeld 2007) del índice que usaron Witek et al. 2014. `[I]` (adaptación exacta `[V]`)
- `COG.3.3` **Curva de groove en U invertida:** los grados intermedios de síncopa producen más deseo de moverse y más placer (Witek et al. 2014). `[H]` → objetivo de síncopa ajustable en el generador.
- `COG.3.4` **Groove como impulso placentero hacia el movimiento:** el groove percibido disminuye cuando el acoplamiento sensoriomotor bimanual se vuelve difícil (Janata et al. 2012). `[H]`
- `COG.3.5` **Uniformidad (evenness):** distancia del patrón a la distribución máximamente uniforme.
- `COG.3.6` **Densidad:** ataques por paso.
- `COG.3.7` **Entropía de intervalos:** variedad de distancias entre ataques.

#### COG.4 Ritmo del paisaje sonoro
- Schafer describe ciclos ambientales (diurnos, estacionales, de campanas y máquinas) como parte del paisaje sonoro. `[H]`
- Truax usa "ritmo aditivo" para eventos aleatorios como lluvia o insectos, en una acepción propia de la ecología acústica. `[H]`
- Krause propone el nicho acústico: las especies se reparten bandas de frecuencia y tiempo. `[Hip]`
- **Implementación:** extractor de onsets desde registros de campo que conserva el microtiempo real y lo convierte en patrón con rejilla deformable (véase dispositivo 15).

---

## 3. Grooves de música electrónica y popular (rejillas de 16 pasos)

| ID | Groove | Capas (onsets) | Estado |
|---|---|---|---|
| `GRV.1` | Four-on-the-floor | bombo `[0,4,8,12]`; hat abierto `[2,6,10,14]` | `[H]` |
| `GRV.2` | Backbeat | caja `[4,12]` | `[H]` |
| `GRV.3` | Half-time | caja `[8]` | `[H]` |
| `GRV.4` | Shuffle (rejilla de 12 en tresillos) | `[0,2,3,5,6,8,9,11]` | `[H]` |
| `GRV.5` | One drop (reggae) | bombo y caja juntos `[8]`; pulso 1 vacío | `[H]` |
| `GRV.6` | Rockers | bombo `[0,8]` | `[I]` |
| `GRV.7` | Steppers | bombo `[0,4,8,12]` | `[H]` |
| `GRV.8` | Skank (ska/reggae) | acordes `[2,6,10,14]` o `[4,12]` según el estilo | `[I]` |
| `GRV.9` | Trap | hats en semicorcheas con tresillos y redobles (fusas); caja `[8]` | `[H]` estructura |
| `GRV.10` | Motorik | 4/4 constante con mínima variación | `[H]`; patrón exacto `[V]` |
| `GRV.11` | Breakbeat / Amen break | bucles de *breaks* troceados | `[H]`; transcripción `[V]` |
| `GRV.12` | 2-step / UK garage | bombo que omite tiempos con swing de semicorchea | `[I]`; onsets `[V]` |
| `GRV.13` | Bajo Moroder | semicorcheas continuas con acento por octava y filtro | `[I]`; contorno `[V]` |
| `GRV.14` | Dub techno | stab de acorde en contratiempo + delay a corchea con puntillo | `[I]` |

---

## 4. Algoritmos de referencia (pseudocódigo)

### 4.1 Euclidiano (Bjorklund) y máxima uniformidad
```
function euclid(k, n, rot=0):
    pattern = [ floor((i+1)*k/n) - floor(i*k/n) for i in 0..n-1 ]
    # da 1 donde hay ataque; equivale a una rotación de Bjorklund
    return rotate(pattern, rot)
```
Ejemplos verificables: E(3,8) produce una rotación del tresillo; E(5,8), del cinquillo; E(7,12), del standard pattern; E(5,16), de la bossa clave. `[H]` (Toussaint)

### 4.2 Pesos métricos genéricos
```
function meter_weights(levels):   # levels = [2,2,2,2] para 16 pasos en 4/4
    n = product(levels)
    w = [0]*n
    for i in 0..n-1:
        depth = 0; step = n
        for L in levels:
            step = step / L
            if i % step == 0: break
            depth += 1
        w[i] = -depth
    return w
```
Para compases aditivos se usa `grouping`: el inicio de cada grupo recibe peso −1 y el inicio del ciclo 0.

### 4.3 Generador aksak
```
function aksak(n):           # todas las composiciones de n en partes 2 y 3
    if n == 0: return [[]]
    out = []
    if n >= 2: out += [[2]+r for r in aksak(n-2)]
    if n >= 3: out += [[3]+r for r in aksak(n-3)]
    return out
# aksak(7) -> [2,2,3],[2,3,2],[3,2,2]
```

### 4.4 Tala carnática
```
JATI = {tisra:3, chatusra:4, khanda:5, misra:7, sankeerna:9}
FAM  = {dhruva:"L D L L", matya:"L D L", rupaka:"D L",
        jhampa:"L U D", triputa:"L D D", ata:"L L D D", eka:"L"}
function tala(family, jati, gati):
    angas = [ JATI[jati] if a=="L" else (2 if a=="D" else 1)
              for a in FAM[family].split() ]
    units = sum(angas)
    return { cycle_len: units*gati, grouping: [a*gati for a in angas] }
# tala(triputa, chatusra, 4) -> 32 matras = Adi tala en chatusra nadai
```

### 4.5 Tihai
```
function tihai(P, G, cycle_len):
    total = 3*P + 2*G
    start = (cycle_len - (total % cycle_len)) % cycle_len
    # la última nota de la tercera frase cae en el paso 0 (sam)
    return start
```

### 4.6 Índice de síncopa y objetivo de groove
```
function syncopation(onsets_bool, w):
    s = 0
    for i in 0..n-1:
        if onsets_bool[i]:
            j = next index after i (cíclico)
            if not onsets_bool[j] and w[j] > w[i]:
                s += w[j] - w[i]
    return s

function groove_target_mutate(p, target, w):
    # muta onsets hasta acercar syncopation(p) al valor objetivo
    # el objetivo por defecto se ubica en el tramo medio de la curva en U invertida
```

### 4.7 Fase y polimetría
```
phase:      tempo_B = tempo_A * (1 + drift)       # drift ~ 0.001–0.01
polymeter:  step_layer[k] = global_step % layer_len[k]
realign:    lcm(layer_len[])
```

### 4.8 Irama
```
elaboration_density = base_density * 2^(irama_index)
gong_cycle_duration = base_cycle * 2^(irama_index) / laya_factor
```

### 4.9 Swing dependiente del tempo
```
ratio_eff = 1 + (ratio - 1) * clamp(1 - coupling*(bpm-90)/120, 0, 1)
offset_odd = (ratio_eff/(1+ratio_eff) - 0.5) * 2     # fracción del paso
```
La forma de la curva es una aproximación de diseño `[I]`; Friberg y Sundström documentan la tendencia, y los coeficientes se calibran de oído.

### 4.10 Rejilla deformable (Sioros, simplificado)
```
grid_positions = cumulative(normalize(step_durations))   # vector que suma 1
time_of_step(i) = bar_start + grid_positions[i] * bar_len
```

### 4.11 Distribución en hoquetus / kotekan
```
function hocket(onsets, voices, rule):
    rule = "alternate":  voice = index_of_onset % voices
    rule = "kotekan":    voice = 0 if onset on beat else 1
    rule = "register":   voice según nota MIDI
```

### 4.12 Arco jo-ha-kyū recursivo
```
function jhk(t, depth):        # t en [0,1]
    seg = [0, 0.5, 0.85, 1]    # proporciones editables
    base = piecewise_curve(t, seg, values=[slow, building, fast])
    if depth > 0: base *= 1 + 0.1 * jhk(local_t(t), depth-1)
    return base
```

---

## 5. Catálogo de dispositivos propuestos

Cada dispositivo es un `.amxd` independiente que lee y escribe el formato JSON de §1. Todos comparten un módulo `rhythm-core` en `[v8]` (o `[js]`) con los algoritmos de §4.

| # | Dispositivo | Tipo | Ejes | Función | Objetos Max clave |
|---|---|---|---|---|---|
| 1 | **Ciclo** | MIDI Effect | MET, CIC | Motor de ciclo de cualquier longitud con `grouping` y pesos métricos; reloj común para otros dispositivos | `[plugsync~]`, `[phasor~]`, `[counter]`, `[dict]` |
| 2 | **Euclides** | MIDI Effect | PRO.1, PRO.14 | E(k,n) por capa con rotación, complemento y retrogradación; hasta 4 capas | `[v8]`, `[live.step]` o `[live.grid]` |
| 3 | **Aksak** | MIDI Effect | MET.3 | Elige n y recorre las combinaciones 2+3; acentúa inicios de grupo | `[v8]`, `[umenu]` |
| 4 | **Tala** | MIDI Effect | CIC.4.1, CIC.4.2, PRO.16 | Teental, jhaptal, rupak, ektal; generador carnático tala × jati × gati; calculadora de tihai | `[v8]`, `[live.tab]` |
| 5 | **Timeline** | MIDI Effect | CIC.2, CIC.3, CIC.6 | Biblioteca de claves, tresillo, cinquillo, standard pattern, dembow; conversión 12→16 (binarización) | `[dict]`, `[live.menu]` |
| 6 | **Iqa'** | MIDI Effect | CIC.4.3 | Patrones dum/tak con capa de ornamentación probabilística a 32 posiciones; transiciones baladi ↔ maqsum ↔ malfuf | `[v8]`, `[random]` |
| 7 | **Colotomía** | MIDI Effect | CIC.5, FOR.2.3 | Capas de gong (gong, kenong, kempul, ketuk) más elaboración; controles `irama` y `laya` separados | `[counter]`, `[v8]` |
| 8 | **Hoquetus** | MIDI Effect | SUP.4 | Reparte una línea entrante entre 2–8 voces (alternancia, kotekan, registro); una salida MIDI por canal | `[route]`, `[midiformat]` |
| 9 | **Polímetro / Fase** | MIDI Effect | SUP.2, PRO.10, PRO.11 | Capas de longitud independiente; deriva de fase continua o desplazamiento discreto; muestra el ciclo de realineación | `[phasor~]` por capa, `[rate~]` |
| 10 | **Sesquiáltera** | MIDI Effect | SUP.3, CIC.8 | Alterna o superpone 6/8 y 3/4 con presets de cueca, zamba, chacarera y joropo `[V]` | `[v8]` |
| 11 | **Microtiempo** | MIDI Effect | MIC | Rejilla deformable; plantillas samba, telespringar, vals, laid-back; swing dependiente del tempo; humanizador browniano por capa | `[pipe]`, `[v8]`, `[live.multislider]` |
| 12 | **Acentuador** | MIDI Effect | ACE | Reparte pesos de acento entre velocity, gate, transposición y CC (matriz de mezcla) | `[live.matrix]` o `[matrix]`, `[ctlout]` |
| 13 | **Síncopa / Groove** | MIDI Effect | COG.3 | Mide el índice de síncopa en vivo; muta el patrón hacia un objetivo en la curva en U invertida | `[v8]`, `[live.dial]` |
| 14 | **Arco** | MIDI Effect | FOR.2, PRO.9 | Curvas jo-ha-kyū y man-jung-sak para tempo interno, densidad y modulación métrica; parámetro `Ma` de silencios | `[function]`, `[line]`, `live.object` (tempo) |
| 15 | **Escucha de campo** | Audio Effect | COG.4, MIC.3 | Detecta onsets en registros de campo y los exporta como patrón con rejilla deformable y microtiempo real | `[sigmund~]` o `[bonk~]`, `[v8]`, `[dict]` |
| 16 | **Eco rítmico** | Audio Effect | PRO.19 | Delay sincronizado con ratios rítmicos (corchea con puntillo, tresillo, aksak) y feedback filtrado | `[tapin~]`/`[tapout~]`, `[translate]` |

**Notas de arquitectura:**
- **Reloj único:** el dispositivo 1 publica la posición de paso por `[send~]` o por un nombre `[dict]` compartido; los demás pueden usar su propio `[plugsync~]` para no depender del orden de pistas.
- **Cambio de tempo global:** `live.object` sobre `live_set` → `tempo` modifica todo el set. Para modulación métrica local, el dispositivo escala su propio reloj interno y deja el tempo global intacto.
- **Persistencia:** `[pattr]` y `[pattrstorage]` guardan los parámetros con el set de Live; los patrones JSON se guardan en `[dict]` con `@embed 1`.
- **Interfaz:** cada patrón con `verify: true` muestra un indicador visible.

---

## 6. Meta-análisis

### 6.1 Zonas de consenso
1. **Jerarquía métrica:** pulsos periódicos anidados como base de la métrica (GTTM, London, solfeo hispano).
2. **Periodicidad cíclica y patrón guía:** isoperiodicidad y timeline en África, Caribe, India, mundo árabe, Corea y gamelan (Arom, Agawu, Nketia).
3. **Microtiempo estilístico:** las desviaciones son sistemáticas y propias de cada estilo; aparecen también en el cuerpo de músicos y bailarines (samba, telespringar).
4. **Separación tempo/densidad:** laya e irama, y la práctica de half-time y double-time, distinguen la velocidad del pulso de la densidad de eventos.
5. **Groove y síncopa:** relación en U invertida entre síncopa y deseo de moverse.

### 6.2 Zonas de debate
| Debate | Posiciones | Consecuencia de diseño |
|---|---|---|
| Aditivo frente a divisivo | Sachs propone la dicotomía; London la considera confusa | Representar todo como `grouping` + rejilla, sin forzar la dicotomía |
| Polimetría africana | Jones la describe; Agawu la considera un mito y propone polirritmia sobre una métrica única regulada por la danza | El JSON permite ambas lecturas: capas con igual `cycle_len` (polirritmia) o distinto (polimetría) |
| Microtiempo como desviación o como estructura | Modelos expresivos frente a rejillas no isócronas (Sioros; Haugen y Danielsen) | Rejilla deformable como estructura, humanizador como capa separada |
| Discrepancias participativas | Keil: causan participación; Berger: la acompañan | El humanizador se ofrece como herramienta, sin promesa de efecto |
| Binarización | Pérez Fernández la propone como proceso histórico | Transformación 12→16 disponible como experimento auditivo |
| Innatismo del pulso | Winkler y Honing: innato; revisiones posteriores matizan | Sin consecuencia directa de diseño |
| Terminología hispana | Amalgama, irregular, dispar y complejo usados como sinónimos o diferenciados | El dispositivo usa `grouping` y muestra ambas etiquetas |

### 6.3 Tradiciones terminológicas
- **Hispana:** prescriptiva, basada en el solfeo; distingue con precisión síncopa/contratiempo y amalgama/tiempos desiguales.
- **Anglosajona:** cognitiva y analítica (GTTM, London, estudios de groove, microtiempo).
- **Francesa:** etnomusicológica y estructural (Brăiloiu, Rouget, Arom) y compositiva (Messiaen, Boulez).
- **Alemana:** histórico-comparativa (Sachs, Hornbostel; Ludwig para la isorritmia).
- **Tradiciones con teoría propia:** la carnática (tala, jati, gati, matra), la indostánica (tala, laya, tihai), la árabe (iqa', dum/tak), la otomana (usul), la coreana (jangdan, gak, man-jung-sak), la javanesa (irama, laya, colotomía) y la japonesa (ma, jo-ha-kyū). Cada una ofrece unidades de medida y nombres que el dispositivo debe conservar en su interfaz.

### 6.4 Ética de uso de repertorios
1. **Contexto como dato:** cada patrón lleva su tradición, género y función. La crítica de Agawu a la "invención del ritmo africano" muestra que separar un patrón de su contexto lo convierte en emblema de diferencia; el campo `origin` mantiene la referencia.
2. **Repertorio sagrado:** los patrones ceremoniales (kultrún de la machi, toques de candomblé, jangdan de rituales chamánicos de la costa este coreana) llevan `restricted_use: true`. Su inclusión en presets públicos depende del consentimiento de las comunidades o especialistas que los sostienen.
3. **Crédito:** cuando una obra use un patrón tradicional reconocible, el crédito nombra la tradición y, si existe, el grupo o maestro de quien se aprendió.

---

## 7. Datos faltantes y verificaciones pendientes

- Transcripciones de esquemas rítmicos del kultrún citadas por Grebe (1934–1949).
- Patrones de surdo, tamborim y partido alto en samba; toques de maracatu (martelo, luanda, arrastão, baque parado); candombe por tambor.
- Patrones de bombo legüero en zamba y chacarera, y de rasgueo en cueca y tonada.
- Golpes exactos de wahda, sama'i thaqil, masmudi kabir y ayyub.
- Agrupamiento de eotmori y distribución colotómica de ketawang y ladrang.
- Magnitudes del adelanto del segundo pulso en el vals vienés y proporciones del jembe malí (Polak).
- Contorno de octavas del bajo de *I Feel Love*.
- Adaptación exacta del índice de síncopa usada por Witek et al. 2014.
- Autoría y fecha del término "metric modulation" (Goldman 1951 o 1957, o Carter).

---

## 8. Fuentes

### Teoría, cognición y groove
- Lerdahl, F. y Jackendoff, R. (1983). *A Generative Theory of Tonal Music*. MIT Press.
- London, J. (2004; 2.ª ed. 2012). *Hearing in Time*. Oxford University Press. https://academic.oup.com/book/9899
- Sachs, C. (1953). *Rhythm and Tempo*. Norton.
- Longuet-Higgins, H. C. y Lee, C. S. (1984). "The rhythmic interpretation of monophonic music". *Music Perception* 1(4).
- Winkler, I., Háden, G., Ladinig, O., Sziller, I. y Honing, H. (2009). "Newborn infants detect the beat in music". *PNAS* 106(7).
- Hannon, E. y Trehub, S. (2005). "Metrical categories in infancy and adulthood". *Psychological Science* 16(1).
- Janata, P., Tomic, S. y Haberman, J. (2012). *Journal of Experimental Psychology: General* 141(1).
- Witek, M. et al. (2014). "Syncopation, Body-Movement and Pleasure in Groove Music". *PLoS ONE* 9(4). https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0094446
- Witek, M. (2017). "Filling In: Syncopation, Pleasure and Distributed Embodiment in Groove". *Music Analysis*. https://onlinelibrary.wiley.com/doi/10.1111/musa.12082
- Keil, C. (1987). "Participatory Discrepancies and the Power of Music". *Cultural Anthropology* 2(3).
- Danielsen, A. (2006). *Presence and Pleasure: The Funk Grooves of James Brown and Parliament*. Wesleyan.
- Friberg, A. y Sundström, A. (2002). "Swing ratios and ensemble timing in jazz performance". *Music Perception* 19(3).
- Sioros, G. (2023). "Polyrhythmic modelling of non-isochronous and microtiming patterns". *Proceedings of ISMIR 2023*. https://archives.ismir.net/ismir2023/paper/000016.pdf
- Haugen, M. y Danielsen, A. "Rhythmical structures in music and body motion in Afro-Brazilian samba and Norwegian telespringar". https://journals.gold.ac.uk/sysmus14/article/view/233
- Naveda, L. et al. "Microtiming patterns and interactions with musical properties in samba music".
- Thalwitzer, T. H. *Microrhythmic analyses of caixa recordings from maracatu-nação*. Universität Wien. https://utheses.univie.ac.at/detail/25147
- Estudio computacional de microtiempo en maracatu de baque solto, ISMIR 2020. https://program.ismir2020.net/static/posters/113.pdf

### Etnomusicología y tradiciones
- Agawu, K. (1995). "The Invention of African Rhythm". *JAMS* 48(3). https://online.ucpress.edu/jams/article/48/3/380/49602/The-Invention-of-African-Rhythm
- Agawu, K. (2003). *Representing African Music*. Routledge.
- Agawu, K. (2006). "Structural Analysis or Cultural Analysis? Competing Perspectives on the 'Standard Pattern' of West African Rhythm". *JAMS* 59(1).
- Arom, S. (1985/1991). *African Polyphony and Polyrhythm*. Cambridge University Press.
- Brăiloiu, C. (1951/1952). "Le rythme aksak". *Revue de musicologie* 33.
- Jones, A. M. (1959). *Studies in African Music*. Oxford University Press.
- Nketia, J. H. K. (1974). *The Music of Africa*. Norton.
- Toussaint, G. (2005). "The Euclidean Algorithm Generates Traditional Musical Rhythms". *Bridges*; (2013) *The Geometry of Musical Rhythm*. CRC.
- Pérez Fernández, R. A. (1987). *La binarización de los ritmos ternarios africanos en América Latina*. Casa de las Américas.
- Vega, C. *La forma de la cueca chilena*. Universidad de Chile.
- Spencer Espinosa, C. (2021). "Principales ejes de estudio de la cueca chilena: una actualización". *Revista NEUMA* 14(1).
- Grebe, M. E. (1973). "El kultrún mapuche: un microcosmo simbólico". *Revista Musical Chilena*. https://elhuron.uchile.cl/index.php/RMCH/article/viewFile/11946/12306
- Memoria Chilena, "Instrumentos musicales mapuche". https://www.memoriachilena.gob.cl/602/w3-article-94741.html
- Museo de Instrumentos Musicales, UNLP, ficha del kultrún. https://unlp.edu.ar/?p=11633
- MaqamWorld, "Arabic Rhythms / Iqa'at". https://ftp.maqamworld.com/en/iqaa.php ; Iqa' Baladi: https://www.maqamworld.com/en/iqaa/baladi.php
- Sistema carnático de talas: https://www.acharyanet.com/fundamentals-of-rhythm/ ; https://karnatik.com/ctaala.shtml ; https://www.narthaki.com/info/articles/art232.html
- Irama y laya en el gamelan javanés: https://en.wikipedia.org/wiki/Irama ; Sumarsam, materiales de Wesleyan: https://sumarsam.faculty.wesleyan.edu/files/2023/01/INTRO_THEORY_ANALYSIS-.pdf
- Jangdan coreano: https://en.wikipedia.org/wiki/Traditional_Korean_rhythm ; Yi Bo-hyung, *Studies in Korean Music*: https://www.earticle.net/Article/A299227
- Lee, B. (2025). Informe de tesis sobre jangdan de la música ritual chamánica de la costa este de Corea, Sorbonne Université / EFEO. https://www.efeo.fr/uploads/2026/01/alter-2025-2_lee-bomi.pdf
- Jo-ha-kyū y ma: Esipova, M. (2023), *Journal of the Society for Music Theory* (Rusia), https://eng.journal-otmroo.ru/node/174 ; Kapuscinski, J., "Orchestrating Time: The Changing Colors of Gagaku Music". https://fass.nus.edu.sg/performct/?p=113
- Maracatu de baque virado: ANPPOM 2025, https://anppom.org.br/anais/anaiscongresso_anppom_2025/papers/84.pdf ; Sambapedia, https://kalango.com/en/community/sambapedia/styles/maracatu

### Procedimientos compositivos
- Messiaen, O. (1944). *Technique de mon langage musical*. Leduc.
- Carter, E. (1965). "The Time Dimension in Music"; Goldman, R. F. (1951). *Musical Quarterly* 37(1).
- Reich, S. (2002). *Writings on Music 1965–2000*. Oxford University Press.
- Gann, K. (1995). *The Music of Conlon Nancarrow*. Cambridge University Press.

### Paisaje sonoro
- Schafer, R. M. (1977). *The Tuning of the World*. Knopf.
- Truax, B. (1978). *Handbook for Acoustic Ecology*. A.R.C.
- Krause, B. (2012). *The Great Animal Orchestra*. Little, Brown.
