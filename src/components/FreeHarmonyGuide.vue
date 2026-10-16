<script setup>
import { computed } from 'vue'
import { SCALES, getScaleNotes, getDiatonicChords } from '../core/scales.js'
const props = defineProps({ tonic: { type: String, required: true }, scale: { type: String, required: true } })
const spanish = note => note.replace(/^[CDEFGAB]/, letter => ({ C:'Do', D:'Re', E:'Mi', F:'Fa', G:'Sol', A:'La', B:'Si' })[letter])
const supported = computed(() => ['major', 'minor'].includes(props.scale))
const definition = computed(() => SCALES[props.scale])
const notes = computed(() => getScaleNotes(props.tonic, props.scale))
const chords = computed(() => getDiatonicChords(props.tonic, props.scale, 'triad'))
const minor = computed(() => props.scale === 'minor')
const roles = computed(() => minor.value
  ? ['Tónica · reposo', 'Preparación', 'Color / contexto', 'Subdominante · preparación', 'Quinto grado menor', 'Color / contexto', 'Color / contexto']
  : ['Tónica · reposo', 'Subdominante · preparación', 'Prolongación / contexto', 'Subdominante · preparación', 'Dominante · tensión', 'Prolongación / contexto', 'Dominante · tensión'])
const example = computed(() => [0, 3, 4, 0].map(index => chords.value[index]?.label).join(' → '))
</script>

<template>
  <details v-if="supported" class="harmony-guide">
    <summary><span aria-hidden="true">💡</span> Guía armónica <span class="guide-key">{{ spanish(tonic) }} {{ definition.name }}</span></summary>
    <div class="guide-content">
      <p class="guide-intro">Comprende tu música, paso a paso. Esta guía sigue la tonalidad general elegida y no modifica tu composición.</p>
      <section>
        <h2>1. Tu escala: las notas con las que empiezas</h2>
        <p>Una escala organiza notas alrededor de una tónica, su centro de referencia. {{ minor ? 'La menor natural tiene esta distribución de tonos y semitonos:' : 'La escala mayor tiene esta distribución de tonos y semitonos:' }}</p>
        <p class="guide-formula">{{ definition.formula }}</p>
        <p>T = tono (dos semitonos). S = semitono, la distancia entre dos teclas contiguas del piano, blancas o negras.</p>
        <p class="guide-notes">{{ notes.map(spanish).join(' · ') }} · {{ spanish(tonic) }} (octava)</p>
        <p v-if="minor">Comparte notas con su relativa mayor, pero cambia el centro de reposo. No basta con empezar en otra nota: el fraseo y la armonía deben afirmar la tónica.</p>
      </section>
      <section>
        <h2>2. Tus grados: de las notas a los acordes</h2>
        <p>Cada posición es un grado. Para formar una tríada, toma una nota, salta una, toma la siguiente y repite: tres notas separadas por terceras dentro de la escala.</p>
        <p>Sobre {{ spanish(tonic) }}: {{ [notes[0], notes[2], notes[4]].map(spanish).join(' + ') }} = {{ chords[0]?.label }}. Mayúsculas: acorde mayor; minúsculas: menor; °: disminuido.</p>
        <div class="guide-table-wrap" tabindex="0" role="region" aria-label="Grados, acordes y funciones de la escala">
          <table>
            <caption>Tríadas de {{ spanish(tonic) }} {{ definition.name }}</caption>
            <thead><tr><th scope="col">Grado</th><th scope="col">Acorde</th><th scope="col">Papel habitual</th></tr></thead>
            <tbody><tr v-for="(chord, index) in chords" :key="chord.degreeNumeral"><th scope="row">{{ chord.degreeNumeral }}</th><td>{{ chord.label }}</td><td>{{ roles[index] }}</td></tr></tbody>
          </table>
        </div>
        <p v-if="minor">Aquí ♭III, ♭VI y ♭VII comparan los grados con la escala mayor de la misma tónica; no indican necesariamente un bemol escrito en el nombre de la nota.</p>
      </section>
      <section>
        <h2>3. Funciones: reposo, preparación y tensión</h2>
        <p><strong>Tónica:</strong> el acorde {{ minor ? 'i' : 'I' }} puede sentirse como llegar a casa.</p>
        <p><strong>Subdominante o predominante:</strong> {{ minor ? 'iv y ii° pueden preparar' : 'IV y ii pueden preparar' }} el camino hacia la dominante.</p>
        <p v-if="!minor"><strong>Dominante:</strong> V y vii° suelen conducir hacia I. La sensible, {{ spanish(notes[6]) }}, está a un semitono de {{ spanish(tonic) }} y suele ascender hacia ella.</p>
        <p v-else><strong>Una diferencia importante:</strong> el v de la menor natural es menor y no contiene sensible. En armonía tonal menor se suele elevar el séptimo grado para obtener V o V7, con una atracción más marcada hacia i. Ese acorde incorpora una nota fuera de la menor natural.</p>
        <p>Estas funciones describen prácticas de armonía tonal. El ritmo, las inversiones, la melodía y el estilo influyen: un grado no tiene un único papel en toda canción, y no todas las músicas siguen este recorrido.</p>
      </section>
      <section>
        <h2>4. Pruébalo en tu partitura</h2>
        <p class="guide-example">{{ example }}</p>
        <p>Escribe un acorde por compás y pulsa Play en Audio &amp; Play. Escucha el primero, la salida hacia el cuarto, el quinto y el regreso. Después termina en el quinto: ¿sientes el mismo cierre?</p>
        <p v-if="minor">Este ejemplo usa i–iv–v–i, con el quinto menor de la escala natural. No lo confundas con i–iv–V–i, que usa la sensible elevada.</p>
        <p v-else>Este recorrido I–IV–V–I ilustra reposo → preparación → tensión → reposo. Es un punto de partida para escuchar, no una obligación al componer.</p>
      </section>
      <a href="https://musictheory.pugetsound.edu/mt21c/HarmonicFunction.html" target="_blank" rel="noopener noreferrer">Profundizar: Music Theory for the 21st-Century Classroom</a>
    </div>
  </details>
</template>

<style scoped>
.harmony-guide{border:1px solid #cbdcab;border-radius:14px;background:#fff;color:#26331d;overflow:hidden;text-align:left}
summary{cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;font-size:13px;font-weight:800;min-height:44px;list-style-position:inside}
summary::before{content:'▸'}details[open]>summary::before{content:'▾'}summary:focus-visible,.guide-table-wrap:focus-visible{outline:3px solid #608e16;outline-offset:-3px}
.guide-key{font-size:11px;font-weight:600;color:#536047;margin-left:auto}
.guide-content{padding:0 16px 16px;max-height:65vh;overflow-y:auto;overscroll-behavior:contain;font-size:14px;line-height:1.65;border-top:1px solid #e1e8d8}
section{margin-top:20px}h2{font-size:15px;font-weight:800;margin-bottom:6px}p{margin:8px 0}.guide-intro{color:#536047}.guide-formula,.guide-example{font-weight:800;background:#f0fadf;border-radius:8px;padding:10px}.guide-notes{font-weight:700}
.guide-table-wrap{overflow-x:auto;margin:12px 0}table{border-collapse:collapse;width:100%;font-size:13px}caption{text-align:left;font-weight:700;padding:6px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #e3e8dc}thead{background:#f4f8ed}a{display:inline-block;color:#456913;text-decoration:underline;margin-top:16px}
@media(max-width:767px){summary{padding:10px}.guide-content{padding:0 12px 12px;max-height:60vh}th,td{padding:7px 5px}}
</style>
