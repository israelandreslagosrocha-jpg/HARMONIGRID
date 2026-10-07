# Banco local de rendimiento

Usa el componente real `src/App.vue`, estilos y motor musical. Solo esta configuración de Vite expone referencias al banco de pruebas; la compilación normal no incluye esa exposición ni la página de pruebas.

```sh
npm run build -- --config tests/browser/vite.config.mjs
npm run preview -- --config tests/browser/vite.config.mjs --host 127.0.0.1 --port 4173
```

Abrir `http://127.0.0.1:4173/HARMONIGRID/tests/browser/index.html`. Elegir cantidad y letras, cargar, medir edición y reproducción. El servidor agrega resultados a `docs/stabilization/browser-results.ndjson`. Las pruebas son sintéticas: todos los compases contienen acordes, subdivisiones y letras alternando libre/rítmico/sincronizado. No usar esta configuración para desplegar el producto.

`paintMs` mide desde la mutación hasta dos requestAnimationFrame posteriores al flush de Vue. La primera carga espera además que termine la transición del wizard. `elapsedMs` incluye 60 ms adicionales para dejar correr conectores; ambos pueden aumentar por tareas largas, planificación del navegador, GC y automatización. El banco también registra tareas largas, cantidad de elementos DOM y `performance.memory` cuando está disponible. El heap es una lectura aproximada, no una prueba de fuga ni la memoria total del proceso. Los ensayos consecutivos conservan historia y están sujetos a GC. No comparar estos tiempos directamente con los benchmarks Node.

La reproducción se mide durante aproximadamente 8 segundos; se comprueba avance de posición y detención. Los intervalos de RAF miden fluidez visual, no latencia ni calidad del sonido. El navegador puede limitar RAF en segundo plano; las tareas largas ofrecen evidencia independiente de bloqueos. La vista 390 × 844 es emulación de tamaño, no prueba en hardware móvil.

Las nuevas pruebas incluyen navegación al último compás y ligaduras entre los dos primeros. Los registros guardan fecha y hash combinado de los componentes. Para guardar una sesión aparte, iniciar preview con `HG_BROWSER_RESULTS=docs/stabilization/browser-optimized-final.ndjson`. Evitar compilaciones y renderizadores PDF concurrentes durante las mediciones. Cada carga vuelve el scroll al inicio. Las herramientas modifican fixtures en memoria; no probar con composiciones personales.

## Comparación de rendimiento del 7 de octubre de 2026

El botón **Ejecutar serie completa** carga 20, 100, 300 y 999 compases, mide tres ediciones de acorde/letra/historia por tamaño, reproducción de ocho segundos y navegación al último compás. La carga restablece selección, foco y proyecto; no conserva un compás fijado de la prueba anterior. La edición de acorde actualiza también la primera subdivisión visible. `stateFlushMs` incluye la mutación y el flush de Vue; `paintMs` añade dos RAF. `idle-paint` mide dos RAF sin edición para detectar variación del navegador. Viewport y altura se registran junto con fase, escenario y hash de fuentes.

Este banco usa el backend simulado de `tests/cloud-browser/mock-supabase.js`. No inicia sesiones reales ni consulta/escribe composiciones en Supabase. Se mide el motor avanzado retenido, con datos sintéticos y letras visibles; no modifica los límites FREE del producto. Una ventana de 390 × 844 es emulación de tamaño, no un iPhone/Android físico.

Para compilar una referencia anterior sin sobrescribir el checkout, `HG_APP_SOURCE=/ruta/absoluta/App.vue HG_BENCH_PHASE=baseline npm run build -- --config tests/browser/vite.config.mjs`. Luego compilar la fuente actual con `HG_BENCH_PHASE=optimized`. Este selector y la exposición de refs existen sólo en la configuración de pruebas; nunca desplegar ese build.
