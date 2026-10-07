# Exportación musical basada en las referencias

Desarrollo en `codex/security-performance`; no cambia el editor, playback, cuentas, límites ni disponibilidad FREE/PRO. Los modos avanzados siguen sujetos a sus permisos actuales.

## Presentaciones

- Partitura armónica rítmica: una línea, cabezas diagonales, plicas hacia abajo, barras para subdivisiones, cifrado sobre sus posiciones temporales y ligaduras vectoriales.
- Letras rítmicas con armonía de referencia: marcas diagonales sin imponer el ritmo vocal a la armonía; figuras y sílabas debajo.
- Ambas capas rítmicas: compás y distribución temporal comunes, duraciones independientes. El mismo inicio temporal corresponde a la misma posición horizontal.

Las sílabas se toman de sus asociaciones existentes a eventos; no se analiza de nuevo el texto ni se inventan asociaciones. Las barras respetan la agrupación del compás. Las subdivisiones fusionadas conservan su duración. Las ligaduras se toman de los conjuntos existentes y se parten al cambiar fila o página. Las opciones de letras libres y vinculadas conservan sus modos. La ronda posterior corrige el cifrado 6/9 y los quintillos, y omite cifrados consecutivos idénticos dentro del mismo compás para evitar colisiones; no elimina figuras ni modifica la composición.

El PDF se distribuye por densidad y ancho real del cifrado, hasta dos compases por fila en letras rítmicas. Los saltos manuales se respetan. Las repeticiones, casillas, secciones, cambios de métrica y tonalidad conservan el código existente. Se evita dibujar una voz vocal automática en compases sin sílabas ni ritmos configurados.

## Validación

- Suite completa `npm test` y compilación `npm run build:vercel` aprobadas durante la implementación.
- Prueba nueva de posiciones temporales, subdivisiones fusionadas, 6/8, cabezas slash y límites de agrupación de barras.
- Corpus de los cinco formatos, 100 compases por formato: cifrado de todos los compases, secciones y texto dentro de las páginas; contenido textual de letras libres/vinculadas idéntico a la referencia anterior.
- Tres documentos sintéticos generados mediante el exportador real y renderizados con Poppler para inspección visual. Se reproducen con `node tests/pdf-reference-samples.mjs` y se guardan en `output/pdf/`.

Son muestras de desarrollo, no composiciones de usuarios. Esta revisión no certifica todas las combinaciones musicales posibles: conviene revisar también una composición real con agrupaciones irregulares, silencios, cambios locales y ligaduras. La grafía es vectorial propia y no emplea una fuente de notación musical especializada. La interfaz pública no habilita herramientas PRO nuevas.

## Ronda de métricas irregulares

La distribución rítmica ahora usa un único mapa de posiciones temporales que reserva espacio para texto en ambas voces. Una sílaba larga puede ampliar el espacio entre figuras, pero la armonía usa exactamente ese mismo mapa. Los valores temporales de los eventos no cambian. La prueba ampliada y sus límites se describen en `PDF_STRESS_REVIEW.md`.
