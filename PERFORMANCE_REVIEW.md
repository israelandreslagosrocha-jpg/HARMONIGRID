# Revisión de rendimiento — 7 de octubre de 2026

Cambios en la rama `codex/security-performance`. Se conserva el comportamiento musical y los límites FREE. No se despliega esta revisión en producción.

## Cambios

- Reutilizar las filas que mantienen los mismos compases, evitando renderizaciones globales por una edición local.
- Leer la composición destinada al guardado dentro de un componente aislado; el guardado y sus eventos conservan el contrato anterior.
- Sustituir la observación profunda global de conectores por los avisos de los compases afectados y de los cambios de presentación.

## Resultados

Compilación de producción, composición sintética con subdivisiones y letras visibles; backend simulado. Mediana de tres ediciones por tamaño, desde la mutación hasta el flush de Vue y dos requestAnimationFrame. Referencia anterior a estos cambios frente a la versión final. Son mediciones exploratorias locales, sujetas a planificación del navegador y GC.

| Vista | Compases | Acorde anterior → actual (ms) | Letras anterior → actual (ms) |
|---|---:|---:|---:|
| Escritorio 1471×900 | 20 | 75.5 → 25.5 | 129.6 → 41.2 |
| Escritorio 1471×900 | 100 | 116.9 → 41.6 | 82.3 → 53.8 |
| Escritorio 1471×900 | 300 | 214.5 → 109.9 | 300.6 → 40.6 |
| Escritorio 1471×900 | 999 | 393.3 → 136.2 | 343.9 → 49.4 |
| Teléfono emulado 390×844 | 20 | 52.7 → 36 | 107.7 → 33.1 |
| Teléfono emulado 390×844 | 100 | 61.3 → 38.3 | 61.2 → 26.9 |
| Teléfono emulado 390×844 | 300 | 126.8 → 40 | 119.7 → 29.3 |
| Teléfono emulado 390×844 | 999 | 390.1 → 109.6 | 353.2 → 29.1 |

Las ocho pruebas finales de navegación enfocaron el último compás correctamente. Con 999 compases se montaron cinco filas de 250 en escritorio y seis de 999 en vista móvil. Las ocho pruebas de reproducción de aproximadamente ocho segundos avanzaron y se detuvieron correctamente; el percentil 95 de intervalo entre fotogramas fue 17,3–33,2 ms. Hubo fotogramas aislados más largos, por lo que no se afirma ausencia de pausas.

## Verificación y límites

- `npm test`: suite completa aprobada, incluyendo 33 comprobaciones de estabilidad/reflujo, nueve del contrato de guardado y 14 de avisos de actualización de conectores.
- Comparación adicional con la fuente anterior: 48 comprobaciones de estabilidad y 627 de contratos de representación/ligaduras aprobadas.
- `npm run build:vercel` y `git diff --check`: aprobados. Persiste aviso de bundle principal de aproximadamente 1,27 MB minificado.
- Ligaduras musicales y de letras renderizadas en navegador; consola sin errores ni advertencias. Los avisos de conectores se verifican por separado; falta una comprobación geométrica completa de las líneas acorde-letra.
- El primer registro de historial de 999 compases siguió costando aproximadamente 360 ms en la medición Node controlada previa al último ajuste. Ese coste requiere una optimización separada; no se promete arranque instantáneo.
- Tamaño móvil emulado: pendiente iPhone 15, iPhone SE y Android físicos.
- Backend simulado: no verifica sesiones reales, políticas remotas ni concurrencia de usuarios.
- Ocho segundos de reproducción no prueban sesiones prolongadas, latencia ni calidad acústica. Las recomendaciones musicales no se modificaron en esta revisión.
- Tres muestras por caso no constituyen un estudio estadístico. El recolector de tareas largas puede omitir tareas comenzadas antes de la ventana de muestra.

Fuentes de comparación: fases `baseline-v2-20261007` y `optimized-v3-20261007`, escenario `live-subdivision-edit-v2`; se toman las primeras tres muestras de edición por tamaño/vista. Hash combinado de fuente final: `750c91d67b5acbec28ba6bb6c4c3a7dba255d96bb4fb6af25dfb8fea954104a9`. Los registros y la captura completos permanecen en la carpeta local `docs/stabilization/`.
