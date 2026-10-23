# SV Ritmic Sequencer 0.5.0 · Informe de estado

17 de octubre de 2026 · Live 12.4.6 Suite · Max 9.1.5 · Node 24

Leyenda: **Auto** = prueba automática (`npm test`, 74 pruebas en verde) · **Live** = comprobado dentro de Live leyendo el set con Producer Pal · **Manual** = pendiente en `docs/PRUEBAS_MANUALES.md`.

## Criterios de aceptación (§11 del encargo)

| Criterio | Auto | Live | Pendiente |
|---|---|---|---|
| Carga en Live 12 como MIDI Effect y muestra los cuatro pasos legibles en la franja | Estructura del patcher, franja ≤ 169 px, contraste WCAG, zonas de clic, v8ui en `mgraphics` simulado | El dispositivo carga, el motor responde («Listo») y la franja genera clips (Hi-hats › Flying cymbal) | Aspecto visual y fuente: PM-016, PM-017 |
| Cada destino genera un clip MIDI válido con longitud y repeticiones coherentes | Más de 2000 combinaciones patrón × destino × escala; repeticiones, ciclo completo, mcm, tihai, gongan, variación final | Chords, Bassline y Hi-hats escritos en Live, idénticos nota a nota al núcleo (PM-003, PM-011, PM-012) | Arpeggio, Ethnic drums y Others dentro de Live |
| Todas las notas respetan la escala y la raíz (o las adaptadas), salvo notas de paso declaradas | Sin notas fuera de escala en todas las combinaciones; las notas de paso son diatónicas | Escala de Live 12 (PM-004) y escala adaptada desde el MIDI del set (PM-011) | — |
| El navegador expone ejes y subcategorías con definición, origen y estado de verificación | Taxonomía completa validada por esquema (10 ejes, 207 conceptos); panel con árbol, migas, detalle e insignias | — | PM-002, PM-021 |
| Sugerir devuelve tres propuestas razonadas desde el contexto del set | Tres propuestas aptas y públicas con razones; tempo, compás, complementariedad, género y variedad | — | PM-025 |
| Random reproducible por semilla; Adaptable con lectura de MIDI y resumen visible | Random y generación deterministas por semilla; análisis Krumhansl-Schmuckler, ocupación y bombo | Lectura del MIDI del set: Re menor estimado contra un set en La menor; bajo sobre el bombo o en contratiempo según el patrón (PM-011) | Resumen visible en la franja: PM-017 |
| Los patrones [V] muestran su insignia; los de uso restringido quedan fuera de la lista pública | Insignias por patrón; restringidos excluidos del catálogo, la búsqueda y Sugerir; solo como principio con nota cultural | — | Insignias en pantalla: PM-016 |
| Pruebas automáticas verdes para núcleo y datos; lista de pruebas manuales completa | 74 pruebas en verde | — | 31 casos manuales; 7 verificados |

## Pruebas manuales

- **Verificadas (7):** PM-001 carga del motor · PM-003 escritura de clip · PM-004 escala de Live 12 · PM-011 modo Adaptable (dos veces) · PM-012 microtiempo en el clip · PM-015 recarga tras reinstalar.
- **Pendientes (24):** sobre todo la interfaz nueva (PM-002, PM-016 a PM-024), deshacer y ranuras (PM-008 a PM-010), restauración del set (PM-013, PM-018), arreglo (PM-014) y Fase 5 (PM-025 a PM-031).

## Errores encontrados en Live y corregidos

1. Botones `live.text` filtrados con `[sel 1]` (emiten bang): Generar no hacía nada (D-035).
2. Live recorta notas de igual altura solapadas en los rellenos: el núcleo ahora hace el mismo recorte (D-036).
3. Modo Adaptable: escala exótica con pocas clases de altura y ocupación mezclando bucles de distinta longitud (D-037).
4. Bajo Adaptable que perdía el contratiempo al seguir el bombo (D-038).
5. Parámetro Semilla con tope de 256 y Generar repetido idéntico (D-046).

## Qué falta

- Completar las pruebas manuales de la interfaz con alguien delante del equipo o con el acceso de escritorio aprobado.
- **SV Listen** (audio): diseño en `docs/SV_LISTEN_DISENO.md`.
- Opciones que quedaron de lado: evolución compás a compás del stab generativo, cuartos de tono por MPE, editor de entradas con datos faltantes desde la interfaz.
