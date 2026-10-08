# Continuidad armónica — 2026-10-07

Rama codex/security-performance. Cambio en el sonido con continuidad activada: se asignan las notas del acorde destino a voces ascendentes para minimizar la suma de movimientos en semitonos. Las notas comunes se favorecen en empates; no se impone una dirección global. C4–E4–G4 hacia F mayor produce C4–F4–A4, en lugar de F4–A4–C5.

Se conservan todas las alturas de clase del acorde, incluidas tensiones y multiplicidades, sin modificar datos guardados. Bajo explícito fijo; voces superiores siempre por encima del bajo. Primera armonía sin antecedente y continuidad desactivada conservan el voicing existente (fundamental, inversiones, Drop 2). Se mantiene la misma integración de playback y visualización de voces.

Algoritmo acotado al registro MIDI 0–127 y al registro anterior ampliado una octava por extremo. Con distinta cantidad de voces, se interpolan posiciones de referencia entre las voces anteriores: es una política de distribución, no identidad permanente de voces. Búsqueda dinámica sin cruces; caché de 256 transiciones como máximo, con copias al devolver para impedir mutación. No aplica todas las reglas de contrapunto clásico ni analiza funciones para resolver sensibles o séptimas. La elección de voicing inicia la secuencia; la continuidad puede cambiar su disposición posterior.

Validación: 72 tríadas contrastadas con un oráculo exhaustivo independiente de mínimo movimiento; casos de notas comunes, slash bass, extensiones, distinta cantidad de voces y preservación de entradas. Suite general y compilación Vercel correctas. Benchmark exploratorio local de 1000 transiciones con acordes de hasta nueve notas: aproximadamente 5,4 segundos sin caché; 189 ms con caché en la misma secuencia repetida. No equivale a latencia por pulsación ni a prueba acústica en teléfonos reales. Persiste aviso de tamaño del bundle.

Referencia musical: https://openmusictheory.github.io/melodicKeyboardStyle.html . Pendiente escucha del usuario en preview actualizado; no se publicó en producción ni se modificó main.
