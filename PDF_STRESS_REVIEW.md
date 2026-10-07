# Pruebas de exportación ampliadas — 7 de octubre de 2026

Se generaron los cinco formatos con 14 casos de origen: dos variantes en 4/4, 5/8, 7/8, 11/8, 5/4, 7/4 y 13/8. Son 70 combinaciones de caso/formato, además de las copias por repetición. Son datos sintéticos, sin cuentas ni composiciones personales.

Cada PDF identifica el caso y su agrupación (por ejemplo, 7/8 como 2+2+3). Incluye negras frente a cuatro sílabas en semicorcheas, dos corcheas frente a las mismas cuatro sílabas, subdivisiones fusionadas, tresillos, quintillos, contratiempos, silencios, figuras con punto, ligaduras dentro de compases y entre filas, repetición simple y casillas.

Cifrados utilizados: Cmaj7(9, #11)/E, F#7(b9, #9, b13)/A#, Bbm7b5(11)/Db, Abmaj7(#5)(9)/C, DmM7(9, 11), G6/9/B y Ebm6/9/Gb. No se afirma que la sucesión de prueba sea una composición o progresión recomendada.

## Resultados verificables

- 149 inicios simultáneos de armonía y voz coinciden en su coordenada horizontal dentro de una tolerancia de 1e-8 mm.
- Los cuatro ataques de «ma-ra-vi-lla» conservan sus posiciones temporales 0, 1/4, 1/2 y 3/4 de un pulso de negra. También se verifica el caso repartido en dos pulsos de corchea.
- El mapa de espacio es común a ambas voces. Si una sílaba necesita espacio, ambos niveles se desplazan mediante el mismo mapa, sin alterar el inicio temporal guardado. No se promete que la distancia en papel sea un cronómetro lineal: es espaciado de notación.
- En las muestras no fue necesario reducir la escala tipográfica por densidad. La comprobación independiente del PDF verifica el orden y un espacio de más de 0,7 mm entre sílabas impresas.
- Los 14 casos de origen se encuentran en los cinco formatos. Las cualidades 6/9 y los bajos separados se conservan. Todo el texto queda dentro de las páginas.
- La versión expandida materializa correctamente la repetición simple y las casillas. Cada copia conserva la agrupación, los inicios, las duraciones y los silencios del compás de origen.
- En los casos válidos del corpus, ninguna figura termina después del límite temporal de su compás.
- Se comprueba que la generación no modifica ningún campo de la composición de entrada y que se emiten los trazados de ligaduras de ambas voces.
- Suite completa de regresión y compilación de producción aprobadas. Sigue el aviso previo por tamaño del bundle.
- Se mantiene además el corpus de 100 compases por cada uno de los cinco formatos. En las opciones libres/vinculadas se comprobó que la única diferencia textual de ese corpus es la eliminación intencional de 100 rótulos G inmediatamente repetidos; el cifrado vigente y el resto del contenido se conservan.

## Problemas encontrados y corregidos

1. Las sílabas de quintillos podían quedar demasiado próximas: se reserva espacio para los textos usando una sola distribución para armonía y voz.
2. El separador `/` confundía 6/9 con un bajo: ahora sólo una nota final, como /B o /Gb, se interpreta como bajo.
3. Tresillos y quintillos contiguos podían compartir la misma barra y perder su número independiente: se separan sus grupos y se deducen las barras de su valor escrito.
4. Los modos libres/vinculados repetían un cifrado idéntico en cada pulso, provocando colisiones en métricas largas: se imprime al cambiar la armonía, conservando todas las figuras. Esto cambia la presentación del PDF, no el contenido ni el editor.
5. Al expandir repeticiones, el índice del compás original podía consultar otra posición del documento expandido y cambiar la agrupación. Se prioriza la agrupación efectiva del compás y se hereda según el orden actual.
6. Una barra final de repetición podía dejar demasiado grueso el recuadro de la sección siguiente: el recuadro restablece su grosor.

## Reproducción

`npm run test:pdf:stress` genera los cinco PDF y los diagnósticos en `output/pdf/pruebas-irregulares/`. `python3 tests/pdf-stress-check.py` verifica los PDF con pdfplumber, pypdf y reportlab. `npm test` incluye las pruebas matemáticas de distribución, barras y cifrado complejo. Los trazados de diagnóstico se añaden únicamente a un módulo temporal de pruebas; no se exponen en la aplicación publicada.

## Alcance pendiente

Son 14 escenarios representativos, no todas las combinaciones musicales posibles. Las comprobaciones temporales de dos voces corresponden al modo de letras rítmicas. Las letras libres y vinculadas conservan su modelo propio y su representación más compacta; no se tratan como sílabas con ritmo vocal independiente. Esta ronda no verifica el audio contra cada figura, dispositivos físicos, otros tamaños de papel ni fuentes internacionales fuera de la tipografía actual. La grafía sigue siendo vectorial propia, no una edición final con fuente musical especializada.

El editor, los datos guardados, el audio y los límites/permisos FREE/PRO no se modificaron. Estos cambios quedan en la rama de desarrollo, sin publicación en producción.
