<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getDiatonicChords, SCALES, getScaleNotes } from './core/scales.js'
import { formatChord } from './core/chords.js'
import { generatePDF } from './core/pdfExport.js'
import { getKeySignatureString, getKeySignature, getParentKeyRoot, SCALE_PARENTS } from './core/keySignatures.js'
import { getSuggestionsForSystem, applySuggestion, getChordDegree, analyzeModulationRelationship } from './core/suggestions.js'
import { NOTE_TO_INDEX, transposeNote } from './core/notes.js'
const generateUniqueId = () => {
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
}
// --- FREE vs PRO STATE ---
const currentPlan = ref('FREE')
const viewMode = ref('compact')
const isUpgradeModalOpen = ref(false)
const upgradeReason = ref('')
// --- WIZARD / SETUP STATE ---
const isSetupMode = ref(true)
const configTitle = ref('Mi Canción')
const configMeasuresCount = ref(8)
const configKey = ref('C')
const configScale = ref('major')
const configTimeSignature = ref(4)
const handleMeasuresInput = (event) => {
  let val = parseInt(event.target.value, 10)
  if (isNaN(val)) {
    return
  }
  if (currentPlan.value === 'FREE') {
    if (val > 20) {
      configMeasuresCount.value = 20
      event.target.value = 20
      upgradeReason.value = 'limit'
      isUpgradeModalOpen.value = true
      return
    }
  } else {
    if (val > 999) {
      configMeasuresCount.value = 999
      event.target.value = 999
      return
    }
  }
  if (val < 1) {
    configMeasuresCount.value = 1
    event.target.value = 1
    return
  }
  configMeasuresCount.value = val
}
const handleMeasuresBlur = (event) => {
  let val = parseInt(event.target.value, 10)
  if (isNaN(val) || val < 1) {
    configMeasuresCount.value = 8
    event.target.value = 8
  }
}
const keysNatural = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const keysSharp = ['C#', 'D#', 'F#', 'G#', 'A#']
const keysFlat = ['Db', 'Eb', 'Gb', 'Ab', 'Bb']
const SECTIONS = ['Ninguna', 'INTRO', 'A', 'B', 'C', 'PRE CORO', 'CORO', 'PUENTE', 'OUTRO', 'SOLO']
// --- PROJECT STATE ---
const title = ref('')
const timeSignature = ref(4)
const key = ref('C')
const scaleType = ref('major')
const measures = ref([])
const repeats = ref([])
const globalGroove = ref('Ninguno')
const tempMeasureGroove = ref('global')
// --- KEY SIGNATURE EDUCATIONAL MODAL STATE ---
const isKeyInfoOpen = ref(false)
const isVerMasExpanded = ref(false)
const setPlan = (plan) => {
  currentPlan.value = plan
  if (plan === 'FREE') {
    viewMode.value = 'compact'
    repeats.value = repeats.value.filter(r => r.type !== 'casilla')
    if (measures.value.length > 20) {
      measures.value = measures.value.slice(0, 20)
    }
    if (configMeasuresCount.value > 20) {
      configMeasuresCount.value = 20
    }
    // Si la escala seleccionada en el editor es PRO, revertir a Major
    const mainScaleDef = SCALES[scaleType.value]
    if (mainScaleDef && mainScaleDef.isPro) {
      scaleType.value = 'major'
    }
    // Si la escala seleccionada en el wizard es PRO, revertir a Major
    const configScaleDef = SCALES[configScale.value]
    if (configScaleDef && configScaleDef.isPro) {
      configScale.value = 'major'
    }
    
    // Reset global groove and rhythmic overrides under FREE plan
    globalGroove.value = 'Ninguno'
    measures.value.forEach(m => {
      m.groove = 'global'
      m.beats.forEach(b => {
        b.harmonicRhythm = 'auto'
        delete b.subdivisions
      })
    })
  }
}
const startProject = () => {
  title.value = configTitle.value || 'Sin Título'
  timeSignature.value = configTimeSignature.value
  key.value = configKey.value
  scaleType.value = configScale.value
  globalGroove.value = 'Ninguno'
  
  const limit = currentPlan.value === 'PRO' ? 999 : 20
  const count = Math.min(Math.max(configMeasuresCount.value, 1), limit)
  const emptyMeasures = []
  for(let i = 0; i < count; i++) {
    const emptyBeats = Array.from({ length: timeSignature.value }, () => ({ root: '', type: '' }))
    emptyMeasures.push({
      id: generateUniqueId(),
      beats: emptyBeats,
      sectionLabel: null
    })
  }
  measures.value = emptyMeasures
  repeats.value = []
  isSetupMode.value = false
}
// --- TRANSLATION AND HELPERS ---
const translateNoteToSpanish = (note) => {
  if (!note) return ''
  const baseNotes = {
    'C': 'Do',
    'D': 'Re',
    'E': 'Mi',
    'F': 'Fa',
    'G': 'Sol',
    'A': 'La',
    'B': 'Si'
  }
  const letter = note[0].toUpperCase()
  const acc = note.slice(1)
  const spanishBase = baseNotes[letter] || letter
  const formattedAcc = acc.replace(/##/g, '𝄪').replace(/bb/g, '𝄫').replace(/#/g, '♯').replace(/b/g, '♭')
  return spanishBase + formattedAcc
}
const translateCategory = (cat) => {
  const dict = {
    major_minor: 'Mayor / Menor',
    greek_modes: 'Modo Griego',
    harmonic_minor_modes: 'Modo de la Menor Armónica',
    melodic_minor_modes: 'Modo de la Menor Melódica',
    symmetric: 'Escala Simétrica',
    popular: 'Escala Popular / Práctica'
  }
  return dict[cat] || cat
}
// --- GLOBAL COMPUTEDS ---
const keySignatureStr = computed(() => getKeySignatureString(key.value, scaleType.value))
const currentScaleName = computed(() => {
  const scale = SCALES[scaleType.value]
  return scale ? scale.name : scaleType.value
})
const currentConfigScaleName = computed(() => {
  const scale = SCALES[configScale.value]
  return scale ? scale.name : configScale.value
})
const groupedScales = computed(() => {
  const groups = {
    major_minor: { label: 'Mayor / Menor', items: [] },
    greek_modes: { label: 'Modos Griegos', items: [] },
    harmonic_minor_modes: { label: 'Modos de la Menor Armónica', items: [] },
    melodic_minor_modes: { label: 'Modos de la Menor Melódica', items: [] },
    symmetric: { label: 'Escalas Simétricas', items: [] },
    popular: { label: 'Populares y Prácticas', items: [] }
  }
  
  for (const [key, val] of Object.entries(SCALES)) {
    if (groups[val.category]) {
      groups[val.category].items.push({ id: key, ...val })
    }
  }
  return Object.values(groups)
})
const keySignatureFormatted = computed(() => {
  const sig = getKeySignature(key.value, scaleType.value)
  if (sig.count === 0) return 'Limpia'
  const symbol = sig.type === 'sharp' ? '♯' : '♭'
  return `${sig.count}${symbol}`
})
const getDynamicScaleExplanation = (keyRoot, scaleId, notesSpanish, parentRoot) => {
  const spanishKey = translateNoteToSpanish(keyRoot)
  const scaleDef = SCALES[scaleId]
  if (!scaleDef) return ''
  const scaleName = `${spanishKey} ${scaleDef.name}`
  const parentKeySpanish = translateNoteToSpanish(parentRoot)
  const notesStr = notesSpanish.join(', ')
  switch (scaleId) {
    // Mayor / Menor
    case 'major':
      return `La escala mayor es la escala diatónica fundamental de la música occidental. Su estructura de intervalos de tono y semitono (T–T–S–T–T–T–S) define el modo mayor, caracterizado por una sonoridad brillante, estable y alegre. En el caso de <strong>${scaleName}</strong>, sus notas son <strong>${notesStr}</strong>, organizadas según este patrón intervalar.`
    case 'minor':
      return `La escala de <strong>${scaleName}</strong> (también conocida como modo eólico) se construye a partir del sexto (6.º) grado de su escala mayor relativa, que es <strong>${parentKeySpanish} Mayor</strong>. Comparte exactamente la misma armadura de clave, pero comienza en su sexto grado, lo que le otorga una sonoridad melancólica, reflexiva y natural. En este tono, sus notas son <strong>${notesStr}</strong>.`
    // Modos Griegos
    case 'dorian':
      return `El modo de <strong>${scaleName}</strong> (modo dórico) es el segundo (2.º) modo de la escala mayor. En este caso, <strong>${scaleName}</strong> se construye a partir del segundo grado de su escala mayor madre, que es <strong>${parentKeySpanish} Mayor</strong>. Es una escala menor con la sexta nota mayor (<strong>${notesSpanish[5]}</strong>), lo que le da un carácter más brillante dentro de las escalas menores, muy utilizada en el jazz, el rock y la música modal. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – 2 – ♭3 – 4 – 5 – 6 – ♭7).`
    case 'phrygian':
      return `El modo de <strong>${scaleName}</strong> (modo frigio) es el tercer (3.º) modo de la escala mayor. En este caso, <strong>${scaleName}</strong> se construye a partir del tercer grado de su escala mayor madre, que es <strong>${parentKeySpanish} Mayor</strong>. Es una escala menor con la segunda menor (<strong>♭2</strong> / <strong>${notesSpanish[1]}</strong>), lo que le otorga un carácter tenso, oscuro y de fuerte influencia flamenca o española. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♭2 – ♭3 – 4 – 5 – ♭6 – ♭7).`
    case 'lydian':
      return `El modo de <strong>${scaleName}</strong> (modo lidio) es el cuarto (4.º) modo de la escala mayor. Se construye a partir del cuarto grado de la escala mayor de <strong>${parentKeySpanish} Mayor</strong>. Es una escala mayor con la cuarta nota aumentada (<strong>#4</strong> / <strong>${notesSpanish[3]}</strong>), lo que genera una sonoridad sumamente brillante, de ensueño y cinematográfica. Sus notas específicas son <strong>${notesStr}</strong>.`
    case 'mixolydian':
      return `El modo de <strong>${scaleName}</strong> (modo mixolidio) es el quinto (5.º) modo de la escala mayor. Se construye a partir del quinto grado de su escala mayor madre, que es <strong>${parentKeySpanish} Mayor</strong>. Consiste en una estructura mayor con la séptima nota menor (<strong>♭7</strong> / <strong>${notesSpanish[6]}</strong>), lo que suaviza la tensión de sensible y la convierte en la escala base del blues, el rock y el funk. Sus notas específicas son <strong>${notesStr}</strong>.`
    case 'locrian':
      return `El modo de <strong>${scaleName}</strong> (modo locrio) es el séptimo (7.º) modo de la escala mayor. En este caso, <strong>${scaleName}</strong> se construye a partir del séptimo grado de su escala mayor madre, que es <strong>${parentKeySpanish} Mayor</strong>. Su sonoridad es disminuida e inestable debido a que posee una quinta disminuida (<strong>♭5</strong> / <strong>${notesSpanish[4]}</strong>) y una segunda menor (<strong>♭2</strong> / <strong>${notesSpanish[1]}</strong>), siendo el modo más tenso y sombrío del sistema diatónico. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♭2 – ♭3 – 4 – ♭5 – ♭6 – ♭7).`
    // Menores Avanzadas
    case 'harmonic_minor':
      return `La escala de <strong>${scaleName}</strong> (menor armónica) se construye a partir de la escala menor natural elevando medio tono el séptimo grado (sensible, la nota <strong>${notesSpanish[6]}</strong>). En este tono, está formada por <strong>${notesStr}</strong>. Este cambio busca generar un acorde de dominante mayor sobre el quinto grado (V), permitiendo una resolución tonal fuerte hacia la tónica, dotándola de una sonoridad dramática y exótica.`
    case 'melodic_minor':
      return `La escala de <strong>${scaleName}</strong> (menor melódica) surge para suavizar el intervalo de segunda aumentada de la menor armónica, ascendiendo medio tono tanto el sexto grado (<strong>${notesSpanish[5]}</strong>) como el séptimo grado (<strong>${notesSpanish[6]}</strong>) respecto a la menor natural. En este tono, sus notas son <strong>${notesStr}</strong>. En el jazz moderno, se emplea de forma ascendente y descendente, siendo la escala madre de algunos de los modos más sofisticados.`
    // Modos de Menor Armónica
    case 'locrian_sharp6':
      return `La escala de <strong>${scaleName}</strong> es el segundo (2.º) modo de la escala menor armónica. En este caso, <strong>${scaleName}</strong> se construye a partir del segundo grado de <strong>${parentKeySpanish} Menor Armónica</strong>. Conserva la tensión característica del locrio (con su quinta disminuida), pero al elevar la sexta a una sexta mayor (<strong>${notesSpanish[5]}</strong>), se obtiene un color más abierto y sofisticado, muy útil sobre acordes m7♭5. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♭2 – ♭3 – 4 – ♭5 – 6 – ♭7).`
    case 'ionian_sharp5':
      return `La escala de <strong>${scaleName}</strong> es el tercer (3.º) modo de la escala menor armónica. En este caso, <strong>${scaleName}</strong> se construye a partir del tercer grado de <strong>${parentKeySpanish} Menor Armónica</strong>. Es una escala mayor con la quinta aumentada (<strong>♯5</strong> / <strong>${notesSpanish[4]}</strong>), generando un sonido de acorde aumentado, misterioso, flotante e impresionista sobre acordes Maj7(♯5). Sus notas son <strong>${notesStr}</strong>.`
    case 'dorian_sharp4':
      return `La escala de <strong>${scaleName}</strong> es el cuarto (4.º) modo de la escala menor armónica. En este caso, <strong>${scaleName}</strong> se construye a partir del cuarto grado de <strong>${parentKeySpanish} Menor Armónica</strong>. Combina la base menor del dórico con la tensión de una cuarta aumentada (<strong>♯4</strong> / <strong>${notesSpanish[3]}</strong>), típica de la música folclórica de Europa del Este (escala gitana). Sus notas son <strong>${notesStr}</strong>.`
    case 'phrygian_dominant':
      return `La escala de <strong>${scaleName}</strong> es el quinto (5.º) modo de la escala menor armónica. En este caso, <strong>${scaleName}</strong> surge a partir del quinto grado de <strong>${parentKeySpanish} Menor Armónica</strong>. Es el modo más popular de este sistema; posee una tercera mayor combinada con una segunda menor, generando el clásico sonido exótico del flamenco, el heavy metal y las bandas sonoras. Sus notas específicas son <strong>${notesStr}</strong>.`
    case 'lydian_sharp2':
      return `La escala de <strong>${scaleName}</strong> es el sexto (6.º) modo de la escala menor armónica. En este caso, <strong>${scaleName}</strong> se construye a partir del sexto grado de <strong>${parentKeySpanish} Menor Armónica</strong>. Es una escala mayor con una segunda aumentada (<strong>♯2</strong> / <strong>${notesSpanish[1]}</strong>) y una cuarta aumentada (<strong>♯4</strong> / <strong>${notesSpanish[3]}</strong>), lo que produce una sonoridad inusual, tensa y de carácter místico o cinematográfico. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♯2 – 3 – ♯4 – 5 – ♭6 – ♭7).`
    case 'ultralocrian':
      return `La escala de <strong>${scaleName}</strong> (Superlocrio Disminuido o locrio ♭♭7) es el séptimo (7.º) modo de la escala menor armónica. En este caso, <strong>${scaleName}</strong> se construye a partir del séptimo grado de <strong>${parentKeySpanish} Menor Armónica</strong>. Su sonoridad es extremadamente inestable y oscura debido a que posee una quinta disminuida (<strong>♭5</strong>) y una séptima disminuida (<strong>♭♭7</strong> / <strong>${notesSpanish[6]}</strong>), siendo una escala más teórica que práctica. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♭2 – ♭3 – 4 – ♭5 – ♭6 – ♭♭7).`
    // Modos de Menor Melódica
    case 'dorian_flat2':
      return `La escala de <strong>${scaleName}</strong> (y todas las escalas dóricas ♭2) es el segundo (2.º) modo de la escala menor melódica. En este caso, <strong>${scaleName}</strong> se construye a partir del segundo grado de <strong>${parentKeySpanish} Menor Melódica</strong>. Mezcla la tensión de la segunda menor (<strong>♭2</strong>) con la sexta mayor característica del modo dórico, generando una sonoridad muy utilizada en el jazz moderno y la fusión. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♭2 – ♭3 – 4 – 5 – 6 – ♭7).`
    case 'lydian_augmented':
      return `El modo de <strong>${scaleName}</strong> es el tercer (3.º) modo de la escala menor melódica. En este caso, <strong>${scaleName}</strong> se construye a partir del tercer grado de <strong>${parentKeySpanish} Menor Melódica</strong>. Es una escala de tipo mayor con la cuarta aumentada (<strong>♯4</strong> / <strong>${notesSpanish[3]}</strong>) y la quinta aumentada (<strong>♯5</strong> / <strong>${notesSpanish[4]}</strong>), lo que genera una sonoridad muy suspendida e ideal para acordes Maj7(♯5), formada por las notas <strong>${notesStr}</strong>.`
    case 'lydian_dominant':
      return `El modo de <strong>${scaleName}</strong> es el cuarto (4.º) modo de la escala menor melódica. En este caso, <strong>${scaleName}</strong> se construye a partir del cuarto grado de <strong>${parentKeySpanish} Menor Melódica</strong>. Combina la cuarta aumentada (<strong>♯4</strong> / <strong>${notesSpanish[3]}</strong>) con la séptima menor (<strong>♭7</strong> / <strong>${notesSpanish[6]}</strong>), siendo la opción predilecta en el jazz para dominantes no funcionales con extensión ♯11. Sus notas son <strong>${notesStr}</strong>.`
    case 'mixolydian_flat6':
      return `El modo de <strong>${scaleName}</strong> es el quinto (5.º) modo de la escala menor melódica. En este caso, <strong>${scaleName}</strong> se construye a partir del quinto grado de <strong>${parentKeySpanish} Menor Melódica</strong>. Consiste en una estructura mayor con la sexta menor (<strong>♭6</strong> / <strong>${notesSpanish[5]}</strong>) y la séptima menor (<strong>♭7</strong> / <strong>${notesSpanish[6]}</strong>), lo que aporta un color cálido pero melancólico sobre acordes dominantes antes de resolver. Sus notas son <strong>${notesStr}</strong>.`
    case 'locrian_sharp2':
      return `La escala de <strong>${scaleName}</strong> (y todas las escalas locrias ♯2) es el sexto (6.º) modo de la escala menor melódica. En este caso, <strong>${scaleName}</strong> se construye a partir del sexto grado de <strong>${parentKeySpanish} Menor Melódica</strong>. Es un modo locrio con la segunda mayor, lo que lo hace mucho más estable y una opción clave para improvisar sobre acordes semidisminuidos (m7♭5). Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – 2 – ♭3 – 4 – ♭5 – ♭6 – ♭7).`
    case 'altered':
      return `La escala de <strong>${scaleName}</strong> (también llamada escala superlocria) es el séptimo (7.º) modo de la escala menor melódica. En este caso, <strong>${scaleName}</strong> se construye a partir del séptimo grado de <strong>${parentKeySpanish} Menor Melódica</strong>. Contiene todas las alteraciones posibles sobre un acorde dominante (♭9, ♯9, ♭5, ♯5), siendo la escala de máxima tensión para acordes dominantes alterados. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♭2 – ♯2 – 3 – ♭5 – ♯5 – ♭7).`
    // Simétricas
    case 'diminished_wh':
      return `La escala de <strong>${scaleName}</strong> es una estructura simétrica octatónica (de ocho notas) que se construye alternando intervalos de Tono (T) y Semitono (S). En este caso, sus notas son <strong>${notesStr}</strong>. Se repite de forma idéntica cada tercera menor, convirtiéndola en la herramienta definitiva para improvisar sobre acordes disminuidos con séptima disminuida (dim7).`
    case 'diminished_hw':
      return `La escala de <strong>${scaleName}</strong> es una estructura simétrica octatónica que se construye alternando Semitono (S) y Tono (T). En este tono, se forma con las notas <strong>${notesStr}</strong>. Se utiliza para generar máxima tensión sobre acordes dominantes, generando tensiones de novena bemol (<strong>♭9</strong>), novena aumentada (<strong>♯9</strong>) y quinta bemol (<strong>♭5</strong>).`
    case 'whole_tone':
      return `La escala de <strong>${scaleName}</strong> es una estructura simétrica hexatónica (de seis notas) compuesta exclusivamente por intervalos de tono entero. En este tono, sus notas son <strong>${notesStr}</strong>. Al no tener quintas justas ni semitonos, carece de centro tonal fuerte, produciendo una sonoridad suspendida y etérea típica del impresionismo francés.`
    // Populares
    case 'pentatonic_major':
      return `La escala de <strong>${scaleName}</strong> (pentatónica mayor) es una estructura de cinco notas derivada de la escala de <strong>${spanishKey} Mayor</strong>, omitiendo el cuarto y séptimo grado para eliminar los semitonos disonantes. En este caso, sus notas son <strong>${notesStr}</strong>. Su ausencia de tensiones la hace sumamente fluida y popular en el pop, el rock y la música folclórica.`
    case 'pentatonic_minor':
      return `La escala de <strong>${scaleName}</strong> (pentatónica menor) es una estructura de cinco notas que se deriva de la escala de <strong>${spanishKey} Menor Natural</strong>, omitiendo el segundo y sexto grado. En este caso, está compuesta por las notas <strong>${notesStr}</strong>. Es el bloque fundamental de la guitarra moderna, el rock y el blues.`
    case 'blues':
      return `La escala de <strong>${scaleName}</strong> (escala de blues) se construye sobre la base de la escala pentatónica menor, incorporando la emblemática nota de blues o quinta disminuida (<strong>♭5</strong> / <strong>${notesSpanish[3]}</strong>) como nota de paso cromática. En esta tonalidad, se compone de las notas <strong>${notesStr}</strong>, aportando su carácter melancólico y expresivo.`
    case 'harmonic_major':
      return `La escala de <strong>${scaleName}</strong> (mayor armónica) es una variación de la escala mayor natural con el sexto grado rebajado medio tono (<strong>♭6</strong>). Aporta una sonoridad brillante pero con un matiz exótico y melancólico, muy utilizada en la rearmonización de jazz y música para cine. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – 2 – 3 – 4 – 5 – ♭6 – 7).`
    case 'hungarian_gypsy_minor':
      return `La escala de <strong>${scaleName}</strong> (menor húngara o doble armónica menor) posee dos segundas aumentadas en su estructura. Ofrece una sonoridad intensa y muy dramática, típica del folclore gitano, la música de Europa del Este y muy apreciada en el rock y metal. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – 2 – ♭3 – ♯4 – 5 – ♭6 – 7).`
    case 'hungarian_major':
      return `La escala de <strong>${scaleName}</strong> (mayor húngara) es una escala mayor exótica que combina una segunda aumentada (<strong>♯2</strong>), una cuarta aumentada (<strong>♯4</strong>) y una séptima menor (<strong>♭7</strong>). Genera una sonoridad altamente inusual y disonante, excelente para fraseos de jazz moderno y fusión avanzada para tocar "outside" (fuera de la tonalidad). Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – ♯2 – 3 – ♯4 – 5 – 6 – ♭7).`
    case 'bebop_dominant':
      return `La escala de <strong>${scaleName}</strong> (bebop dominante) es una escala mixolidia que incorpora la séptima mayor como nota de paso entre la séptima menor y la octava. Al tener ocho notas, permite que las notas del acorde (1, 3, 5, ♭7) caigan siempre en los tiempos fuertes al tocar corcheas, siendo la base del fraseo de jazz bebop. Sus notas son <strong>${notesStr}</strong> (fórmula: 1 – 2 – 3 – 4 – 5 – 6 – ♭7 – 7).`
    default:
      return scaleDef.explanation
  }
}
const keyInfoData = computed(() => {
  const currentKey = key.value
  const currentScaleId = scaleType.value
  const scaleDef = SCALES[currentScaleId]
  if (!scaleDef) return null
  
  const spelledNotes = getScaleNotes(currentKey, currentScaleId)
  const sig = getKeySignature(currentKey, currentScaleId)
  
  const ordinals = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava']
  const accidentalsList = []
  
  spelledNotes.forEach((n, idx) => {
    const isFlat = n.includes('b')
    const isSharp = n.includes('#')
    if (isFlat || isSharp) {
      accidentalsList.push({
        note: translateNoteToSpanish(n),
        position: ordinals[idx] || `${idx + 1}.ª`,
        type: isFlat ? 'flat' : 'sharp'
      })
    }
  })
  
  const notesSpanish = spelledNotes.map(translateNoteToSpanish)
  
  const intervalLabels = scaleDef.intervals.map((semitones) => {
    const intervalNames = {
      0: 'R',
      1: 'b2', 2: '2M', 3: 'b3', 4: '3M', 5: '4P',
      6: 'b5', 7: '5P', 8: 'b6', 9: '6M', 10: 'b7', 11: '7M'
    }
    return intervalNames[semitones] || `${semitones}st`
  })
  
  let circleExplanation = ''
  const parentRoot = getParentKeyRoot(currentKey, currentScaleId)
  const parentMapping = SCALE_PARENTS[currentScaleId]
  
  let scaleAccidentalType = sig.type
  const hasFlats = accidentalsList.some(item => item.type === 'flat')
  
  if (parentMapping && parentMapping.parentType === 'none') {
    circleExplanation = `Esta escala es simétrica y no utiliza una armadura de clave tradicional en el círculo de quintas. Se escribe con alteraciones accidentales según el contexto musical.`
    scaleAccidentalType = hasFlats ? 'flat' : 'sharp'
  } else if (sig.count > 0) {
    const accType = sig.type === 'sharp' ? 'sostenidos' : 'bemoles'
    const parentScaleName = parentMapping && parentMapping.parentType === 'minor' ? 'Menor Natural' : 'Mayor'
    circleExplanation = `Esta escala hereda su armadura de clave de su escala madre o relativa (${translateNoteToSpanish(parentRoot)} ${parentScaleName}), la cual contiene ${sig.count} ${accType} debido a su posición en el círculo de quintas.`
  } else {
    const parentScaleName = parentMapping && parentMapping.parentType === 'minor' ? 'Menor Natural' : 'Mayor'
    circleExplanation = `Esta escala hereda su armadura de clave limpia (sin sostenidos ni bemoles) de su escala madre o relativa (${translateNoteToSpanish(parentRoot)} ${parentScaleName}).`
  }
  
  const isStandardDiatonic = ['major_minor', 'greek_modes'].includes(scaleDef.category)
  const explanation = getDynamicScaleExplanation(currentKey, currentScaleId, notesSpanish, parentRoot)
  
  return {
    key: translateNoteToSpanish(currentKey),
    scaleName: scaleDef.name,
    categoryName: translateCategory(scaleDef.category),
    accidentalsCountScale: accidentalsList.length,
    accidentalsCountSig: sig.count,
    accidentalType: scaleAccidentalType,
    accidentalsList,
    notesSpanish,
    intervals: scaleDef.intervals,
    intervalLabels,
    formula: scaleDef.formula,
    characteristic: scaleDef.characteristic,
    explanation,
    circleExplanation,
    isStandardDiatonic
  }
})
const selectConfigScale = (scaleId) => {
  const scale = SCALES[scaleId]
  if (!scale) return
  
  if (scale.isPro && currentPlan.value !== 'PRO') {
    upgradeReason.value = 'escalas'
    isUpgradeModalOpen.value = true
    activeDropdown.value = null
    return
  }
  
  configScale.value = scaleId
  activeDropdown.value = null
}
const selectMainScale = (scaleId) => {
  const scale = SCALES[scaleId]
  if (!scale) return
  
  if (scale.isPro && currentPlan.value !== 'PRO') {
    upgradeReason.value = 'escalas'
    isUpgradeModalOpen.value = true
    activeDropdown.value = null
    return
  }
  
  scaleType.value = scaleId
  activeDropdown.value = null
}
const getRepeatStart = (mIdx) => {
  if (viewMode.value === 'expanded') return false
  return repeats.value.some(r => r.startMeasure === mIdx + 1)
}
const getRepeatEnd = (mIdx) => {
  if (viewMode.value === 'expanded') return false
  return repeats.value.find(r => r.endMeasure === mIdx + 1)
}
const getCasillaData = (mIdx) => {
  if (viewMode.value === 'expanded') return null
  const mNum = mIdx + 1
  for (const r of repeats.value) {
    if (r.type === 'casilla') {
      if (mNum >= r.casilla1Start && mNum <= r.endMeasure) {
        return {
          type: 1,
          isStart: mNum === r.casilla1Start,
          isEnd: mNum === r.endMeasure,
          times: r.times
        }
      }
      if (mNum >= r.casilla2Start && mNum <= r.casilla2End) {
        return {
          type: 2,
          isStart: mNum === r.casilla2Start,
          isEnd: mNum === r.casilla2End,
          times: r.times
        }
      }
    }
  }
  return null
}
// --- PROJECTION ENGINE (COMPACT VS EXPANDED) ---
const measuresWithKey = computed(() => {
  let currentKey = key.value
  let currentScale = scaleType.value
  
  return measures.value.map((m, idx) => {
    if (currentPlan.value === 'PRO' && m.keyChange) {
      currentKey = m.keyChange.key
      currentScale = m.keyChange.scaleType || 'major'
    }
    return {
      ...m,
      originalMeasureIndex: idx,
      activeKey: currentKey,
      activeScale: currentScale
    }
  })
})
const displayedMeasures = computed(() => {
  if (currentPlan.value === 'FREE' || viewMode.value === 'compact') {
    return measuresWithKey.value.map((m, idx) => ({
      ...m,
      originalMeasureIndex: idx,
      displayedMeasureIndex: idx,
      isExpandedCopy: false,
      displayPass: null
    }))
  }
  
  // Expanded Mode (PRO)
  const sortedRepeats = [...repeats.value].sort((a, b) => a.startMeasure - b.startMeasure)
  const result = []
  let i = 0
  
  while (i < measuresWithKey.value.length) {
    const measureNum = i + 1
    const r = sortedRepeats.find(rep => rep.startMeasure === measureNum)
    
    if (r) {
      if (r.startMeasure > measuresWithKey.value.length) {
        const origM = measuresWithKey.value[i]
        result.push({
          ...origM,
          originalMeasureIndex: i,
          isExpandedCopy: false,
          displayPass: null
        })
        i++
        continue
      }
      
      if (r.type === 'casilla') {
        const times = Number(r.times) || 2
        const casilla1Start = Number(r.casilla1Start) || r.startMeasure
        const casilla2Start = Number(r.casilla2Start) || (r.endMeasure + 1)
        const casilla2End = Number(r.casilla2End) || casilla2Start
        
        if (casilla1Start < r.startMeasure || casilla1Start > r.endMeasure || casilla2Start > measuresWithKey.value.length || casilla2End < casilla2Start) {
          const origM = measuresWithKey.value[i]
          result.push({
            ...origM,
            originalMeasureIndex: i,
            isExpandedCopy: false,
            displayPass: null
          })
          i++
          continue
        }
        
        const pushRange = (start, end, pass) => {
          for (let m = start; m <= end; m++) {
            const origM = measuresWithKey.value[m - 1]
            if (origM) {
              result.push({
                ...origM,
                id: `${origM.id}-exp-${pass}-${m}`,
                originalMeasureIndex: m - 1,
                isExpandedCopy: true,
                displayPass: pass
              })
            }
          }
        }
        
        for (let pass = 1; pass <= times; pass++) {
          if (casilla1Start > r.startMeasure) {
            pushRange(r.startMeasure, casilla1Start - 1, pass)
          }
          pushRange(casilla1Start, r.endMeasure, pass)
        }
        
        const finalPass = times + 1
        if (casilla1Start > r.startMeasure) {
          pushRange(r.startMeasure, casilla1Start - 1, finalPass)
        }
        pushRange(casilla2Start, casilla2End, finalPass)
        
        i = Math.max(r.endMeasure, casilla2End)
      } else {
        const times = Number(r.times) || 2
        const start = r.startMeasure
        const end = r.endMeasure
        
        if (start >= end || end > measuresWithKey.value.length) {
          const origM = measuresWithKey.value[i]
          result.push({
            ...origM,
            originalMeasureIndex: i,
            isExpandedCopy: false,
            displayPass: null
          })
          i++
          continue
        }
        
        for (let pass = 1; pass <= times; pass++) {
          for (let m = start; m <= end; m++) {
            const origM = measuresWithKey.value[m - 1]
            if (origM) {
              result.push({
                ...origM,
                id: `${origM.id}-exp-simple-${pass}-${m}`,
                originalMeasureIndex: m - 1,
                isExpandedCopy: true,
                displayPass: pass
              })
            }
          }
        }
        i = end
      }
    } else {
      const origM = measuresWithKey.value[i]
      result.push({
        ...origM,
        originalMeasureIndex: i,
        isExpandedCopy: false,
        displayPass: null
      })
      i++
    }
  }
  return result.map((m, idx) => ({
    ...m,
    displayedMeasureIndex: idx
  }))
})
// --- GRID & MODAL STATE ---
const isModalOpen = ref(false)
const selectedBeat = ref(null)
const modalComplexity = ref('tetrad') 
// --- DETECCION DE SUGERENCIAS Y EDICIÓN AVANZADA ---
const activeTensionExplanation = ref(null)
const activeEditingBeat = computed(() => {
  if (!selectedBeat.value) return null
  const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
  const beat = measures.value[measureIndex]?.beats[beatIndex]
  if (!beat) return null
  if (subdivisionIndex !== undefined && beat.subdivisions && beat.subdivisions[subdivisionIndex]) {
    return beat.subdivisions[subdivisionIndex]
  }
  return beat || null
})
const SCALE_EXTENSIONS_DB = {
  major: {
    'I': { available: ['9', '13', '#11'], avoid: ['11'], reason: 'Choque de semitono con la tercera mayor (Mi).' },
    'ii': { available: ['9', '11', '13'], avoid: [], reason: '' },
    'iii': { available: ['9', '11'], avoid: ['13'], reason: 'Choque con la tónica de la escala (Do).' },
    'IV': { available: ['9', '#11', '13'], avoid: ['11'], reason: 'Choque con la tercera mayor (La).' },
    'V': { available: ['9', '13', 'b9', '#9', '#11', 'b13'], avoid: ['11'], reason: 'Choque con la tercera mayor (Si).' },
    'vi': { available: ['9', '11', '13'], avoid: [], reason: '' },
    'vii°': { available: ['9', '11', 'b13'], avoid: [], reason: '' }
  },
  natural_minor: {
    'i': { available: ['9', '11', '13'], avoid: [], reason: '' },
    'ii°': { available: ['9', '11', 'b13'], avoid: [], reason: '' },
    'III': { available: ['9', '#11', '13'], avoid: ['11'], reason: 'Choque con la tercera mayor.' },
    'iv': { available: ['9', '11', '13'], avoid: [], reason: '' },
    'v': { available: ['9', '11'], avoid: ['13'], reason: 'Evitar para prevenir choque de semitono.' },
    'VI': { available: ['9', '#11', '13'], avoid: ['11'], reason: 'Choque con la tercera mayor.' },
    'VII': { available: ['9', 'b9', '#9', '#11', 'b13'], avoid: [], reason: '' }
  },
  harmonic_minor: {
    'i': { available: ['9', '11', '13'], avoid: [], reason: '' },
    'ii°': { available: ['b9', '11', 'b13'], avoid: [], reason: '' },
    'III+': { available: ['9', '#11'], avoid: [], reason: '' },
    'iv': { available: ['9', '#11', '13'], avoid: [], reason: '' },
    'V': { available: ['b9', '#9', 'b13'], avoid: [], reason: '' },
    'VI': { available: ['#11'], avoid: [], reason: '' },
    'vii°': { available: [], avoid: [], reason: '' }
  },
  melodic_minor: {
    'i': { available: ['9', '11', '13'], avoid: [], reason: '' },
    'ii': { available: ['b9', '11', '13'], avoid: [], reason: '' },
    'III+': { available: ['9', '#11'], avoid: [], reason: '' },
    'IV': { available: ['9', '#11', '13'], avoid: [], reason: '' },
    'V': { available: ['b9', '#9', 'b13'], avoid: [], reason: '' },
    'vi°': { available: ['9', '11', 'b13'], avoid: [], reason: '' },
    'vii°': { available: ['b9', '#9', 'b5', '#5'], avoid: [], reason: '' }
  }
}
const TENSION_DESCRIPTIONS = {
  '9': {
    simple: 'Añade apertura y suavidad',
    detail: 'Proporciona una sonoridad abierta y melódica. Es una de las tensiones más seguras y usadas para embellecer acordes mayores y menores.'
  },
  'b9': {
    simple: 'Tensión dramática de dominante',
    detail: 'Proviene típicamente del modo frigio o de la escala menor armónica. Añade una gran inestabilidad y tensión dramática antes de resolver en la tónica.'
  },
  '#9': {
    simple: 'Color blues / Acorde Hendrix',
    detail: 'Tensión punzante y expresiva, muy típica del blues y del jazz (acorde dominante alterado). Genera un sonido agresivo pero sumamente sofisticado.'
  },
  '11': {
    simple: 'Riqueza en menores y suspensión',
    detail: 'Muy común en acordes menores para añadir color estable, o en acordes dominantes/sus4 como nota de suspensión temporal.'
  },
  '#11': {
    simple: 'Color Lidio cinematográfico',
    detail: 'Característica del modo Lidio. Genera un sonido brillante, etéreo, místico y de ensueño, ampliamente utilizado en bandas sonoras de películas y jazz fusión.'
  },
  'b13': {
    simple: 'Resolución menor fuerte',
    detail: 'Añade tensión dramática que tira fuertemente hacia la quinta o tónica del acorde de resolución. Muy usada en contextos menores o jazz.'
  },
  '13': {
    simple: 'Brillo suave y jazzeado',
    detail: 'Extensión sofisticada que añade un color brillante y limpio, excelente para suavizar acordes dominantes o dar un toque de bossa nova.'
  },
  'b5': {
    simple: 'Tensión inestable alterada',
    detail: 'Color alterado que incrementa la inestabilidad armónica, ideal para improvisaciones modernas y acordes de paso en el jazz.'
  },
  '#5': {
    simple: 'Sonoridad flotante aumentada',
    detail: 'Crea una atmósfera impresionista, suspendida y sin centro tonal claro. Muy típica de acordes aumentados o composiciones de ensueño.'
  }
}
const activeChordExtensions = computed(() => {
  if (!activeEditingBeat.value || !activeEditingBeat.value.root) return null
  
  const root = activeEditingBeat.value.root
  const type = activeEditingBeat.value.type
  
  const measureIdx = selectedBeat.value ? selectedBeat.value.measureIndex : 0
  const beatIdx = selectedBeat.value ? selectedBeat.value.beatIndex : 0
  const { key: activeKey, scale: activeScale } = getBeatKeyAndScale(measureIdx, beatIdx)
  
  const degree = getChordDegree(root, type, activeKey, activeScale)
  
  const normDeg = degree
  const scaleDb = SCALE_EXTENSIONS_DB[activeScale]
  let dbInfo = scaleDb ? scaleDb[normDeg] : null
  
  if (!dbInfo) {
    if (type === '7') {
      dbInfo = { available: ['9', '13', 'b9', '#9', '#11', 'b13'], avoid: ['11'], reason: 'Evitar la 11 justa por choque de semitono con la tercera mayor.' }
    } else if (['maj7', 'maj'].includes(type)) {
      dbInfo = { available: ['9', '13', '#11'], avoid: ['11'], reason: 'Evitar la 11 justa por choque de semitono con la tercera mayor.' }
    } else if (['m7', 'min', 'minor'].includes(type)) {
      dbInfo = { available: ['9', '11', '13'], avoid: [], reason: '' }
    } else if (['m7b5', 'dim', 'dim7'].includes(type)) {
      dbInfo = { available: ['9', '11', 'b13'], avoid: [], reason: '' }
    } else {
      dbInfo = { available: ['9', '11', '13'], avoid: [], reason: '' }
    }
  }
  
  return {
    degree,
    available: dbInfo.available.map(t => ({ name: t, ...TENSION_DESCRIPTIONS[t] })),
    avoid: dbInfo.avoid.map(t => ({ name: t, reason: dbInfo.reason, ...TENSION_DESCRIPTIONS[t] }))
  }
})
const getChordInversionNotes = (root, type) => {
  let thirdOffset = 4
  let fifthOffset = 7
  
  if (['min', 'm7', 'm7b5', 'dim', 'dim7', 'mM7', 'minor'].includes(type)) {
    thirdOffset = 3
  }
  if (['dim', 'dim7', 'm7b5'].includes(type)) {
    fifthOffset = 6
  } else if (['aug', 'maj7#5'].includes(type)) {
    fifthOffset = 8
  }
  
  const measureIdx = selectedBeat.value ? selectedBeat.value.measureIndex : 0
  const beatIdx = selectedBeat.value ? selectedBeat.value.beatIndex : 0
  const { key: activeKey } = getBeatKeyAndScale(measureIdx, beatIdx)
  
  const third = transposeNote(root, thirdOffset, activeKey)
  const fifth = transposeNote(root, fifthOffset, activeKey)
  return { third, fifth }
}
const getSurroundingChords = () => {
  if (!selectedBeat.value) return { prev: null, next: null }
  const { measureIndex, beatIndex } = selectedBeat.value
  
  let prev = null
  let next = null
  
  const activeList = []
  measures.value.forEach((m, mIdx) => {
    m.beats.forEach((b, bIdx) => {
      if (b.root) {
        activeList.push({
          root: b.root,
          type: b.type,
          measureIndex: mIdx,
          beatIndex: bIdx
        })
      }
    })
  })
  
  const curIdx = activeList.findIndex(x => x.measureIndex === measureIndex && x.beatIndex === beatIndex)
  if (curIdx !== -1) {
    if (curIdx > 0) prev = activeList[curIdx - 1]
    if (curIdx < activeList.length - 1) next = activeList[curIdx + 1]
  }
  
  return { prev, next }
}
const suggestedBassNotes = computed(() => {
  if (!activeEditingBeat.value || !activeEditingBeat.value.root) return []
  
  const root = activeEditingBeat.value.root
  const type = activeEditingBeat.value.type
  const { prev, next } = getSurroundingChords()
  
  const suggestions = []
  const { third, fifth } = getChordInversionNotes(root, type)
  
  if (third) {
    suggestions.push({
      note: third,
      label: 'Inversión estable (1ra inversión / tercera)',
      description: 'Suaviza el sonido y da una sonoridad más fluida.'
    })
  }
  if (fifth) {
    suggestions.push({
      note: fifth,
      label: 'Inversión estable (2da inversión / quinta)',
      description: 'Genera estabilidad y es muy útil para retardos cadenciales.'
    })
  }
  
  const measureIdx = selectedBeat.value ? selectedBeat.value.measureIndex : 0
  const beatIdx = selectedBeat.value ? selectedBeat.value.beatIndex : 0
  const { key: activeKey, scale: activeScale } = getBeatKeyAndScale(measureIdx, beatIdx)
  const scaleNotes = getScaleNotes(activeKey, activeScale)
  
  if (prev && next) {
    const prevDeg = getChordDegree(prev.root, prev.type, activeKey, activeScale)
    const nextDeg = getChordDegree(next.root, next.type, activeKey, activeScale)
    const curDeg = getChordDegree(root, type, activeKey, activeScale)
    
    if (prevDeg === 'I' && nextDeg === 'vi' && curDeg === 'V') {
      const noteB = scaleNotes[6]
      if (noteB && !suggestions.some(s => s.note === noteB)) {
        suggestions.unshift({
          note: noteB,
          label: 'Movimiento descendente fluido (C ➔ B ➔ A)',
          description: 'Crea una línea de bajo descendente continua de gran elegancia pop.'
        })
      }
    }
  }
  
  return suggestions
})
const toggleExtension = (tension) => {
  if (!activeEditingBeat.value) return
  if (!activeEditingBeat.value.tensions) {
    activeEditingBeat.value.tensions = []
  }
  const idx = activeEditingBeat.value.tensions.indexOf(tension)
  if (idx === -1) {
    activeEditingBeat.value.tensions.push(tension)
  } else {
    activeEditingBeat.value.tensions.splice(idx, 1)
  }
  activeEditingBeat.value.tension = activeEditingBeat.value.tensions.length > 0 ? activeEditingBeat.value.tensions[0] : null
}
const selectBassNote = (note) => {
  if (!activeEditingBeat.value) return
  activeEditingBeat.value.bass = note === activeEditingBeat.value.root ? null : note
}
const isSystemSuggestionsModalOpen = ref(false)
const activeSystemIndex = ref(0)
const activeSystemSuggestions = ref([])
const defaultMeasuresPerSystem = ref(4)
const isOrderingModeActive = ref(false)
const getSuggestionsByCategory = (categoryKey) => {
  return activeSystemSuggestions.value.filter(s => s.category === categoryKey)
}
const toggleSystemBreak = (measureOriginalIndex) => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'custom_layout'
    isUpgradeModalOpen.value = true
    return
  }
  const measure = measures.value[measureOriginalIndex]
  if (measure) {
    measure.systemBreak = !measure.systemBreak
  }
}
const setMeasuresPerSystem = (num) => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'custom_layout'
    isUpgradeModalOpen.value = true
    return
  }
  defaultMeasuresPerSystem.value = num
}
const systems = computed(() => {
  const result = []
  let currentSystem = []
  
  displayedMeasures.value.forEach((measure, idx) => {
    currentSystem.push(measure)
    
    const isLast = idx === displayedMeasures.value.length - 1
    const isPro = currentPlan.value === 'PRO'
    const maxPerSystem = isPro ? defaultMeasuresPerSystem.value : 4
    
    const hasExplicitBreak = isPro && measure.systemBreak === true
    const reachedMax = currentSystem.length >= maxPerSystem
    
    if (isLast || hasExplicitBreak || reachedMax) {
      result.push({
        id: `sys-${result.length}`,
        measures: currentSystem
      })
      currentSystem = []
    }
  })
  
  if (currentSystem.length > 0) {
    result.push({
      id: `sys-${result.length}`,
      measures: currentSystem
    })
  }
  
  return result
})
const getSuggestionsForSystemLocal = (system) => {
  if (!system || !system.measures || system.measures.length === 0) return []
  const systemStartIdx = measures.value.findIndex(m => m.id === system.measures[0].id)
  if (systemStartIdx === -1) return []
  const startMeasure = measuresWithKey.value[systemStartIdx]
  const sysKey = startMeasure ? startMeasure.activeKey : key.value
  const sysScale = startMeasure ? startMeasure.activeScale : scaleType.value
  return getSuggestionsForSystem(system.measures, systemStartIdx, sysKey, sysScale)
}
const openSystemSuggestions = (system) => {
  // Close all other bottom-sheet modals first to avoid stacking issues
  isModalOpen.value = false
  isMeasureOptionsOpen.value = false
  isRepeatMenuOpen.value = false
  activeSystemIndex.value = systems.value.findIndex(s => s.id === system.id)
  const systemStartIdx = measures.value.findIndex(m => m.id === system.measures[0].id)
  if (systemStartIdx === -1) return
  const startMeasure = measuresWithKey.value[systemStartIdx]
  const sysKey = startMeasure ? startMeasure.activeKey : key.value
  const sysScale = startMeasure ? startMeasure.activeScale : scaleType.value
  activeSystemSuggestions.value = getSuggestionsForSystem(system.measures, systemStartIdx, sysKey, sysScale)
  isSystemSuggestionsModalOpen.value = true
}
const runSuggestion = (suggestion) => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'suggestions'
    isUpgradeModalOpen.value = true
    return
  }
  measures.value = applySuggestion(measures.value, suggestion.payload)
  isSystemSuggestionsModalOpen.value = false
}
const isMeasureOptionsOpen = ref(false)
const selectedMeasureIndex = ref(null)
const tempSectionLabel = ref('Ninguna')
// --- KEY CHANGE / MODULATION STATE ---
const isKeyChangeSubMenuOpen = ref(false)
const keyChangeStep = ref(1)
const tempKeyChangeKey = ref('C')
const tempKeyChangeScale = ref('major')
const tempKeyChangeBeatIndex = ref(0)
const isKeyChangeInfoOpen = ref(false)
const activeKeyChangeMeasure = ref(null)
const getBeatKeyAndScale = (measureIdx, beatIdx) => {
  let currentKey = key.value
  let currentScale = scaleType.value
  if (currentPlan.value !== 'PRO') {
    return { key: currentKey, scale: currentScale }
  }
  for (let i = 0; i <= measureIdx; i++) {
    const m = measures.value[i]
    if (m && m.keyChange) {
      if (i < measureIdx) {
        currentKey = m.keyChange.key
        currentScale = m.keyChange.scaleType || 'major'
      } else {
        // i === measureIdx
        const triggerBeat = m.keyChange.beatIndex !== undefined ? m.keyChange.beatIndex : 0
        if (beatIdx >= triggerBeat) {
          currentKey = m.keyChange.key
          currentScale = m.keyChange.scaleType || 'major'
        }
      }
    }
  }
  return { key: currentKey, scale: currentScale }
}
const getKeyAccidentalsStr = (keyVal, scaleTypeVal) => {
  const sig = getKeySignature(keyVal, scaleTypeVal)
  if (sig.count === 0) return 'Limpia'
  const symbol = sig.type === 'sharp' ? '#' : 'b'
  return `${sig.count}${symbol}`
}
const getSystemColumnCount = (system, sIdx) => {
  let count = 0
  system.measures.forEach(m => {
    if (isMeasureDense(m)) {
      count += 2
    } else {
      count += 1
    }
    
    if (currentPlan.value === 'PRO' && m.keyChange) {
      count += 1
    }
  })
  
  if (viewMode.value === 'compact' && sIdx === systems.value.length - 1) {
    if (currentPlan.value === 'PRO' || measures.value.length < 20) {
      count += 1
    }
  }
  
  return count
}
const startKeyChangeSetup = () => {
  if (currentPlan.value !== 'PRO') {
    upgradeReason.value = 'modulacion'
    isUpgradeModalOpen.value = true
    return
  }
  isKeyChangeSubMenuOpen.value = true
  keyChangeStep.value = 1
}
const saveKeyChange = () => {
  if (selectedMeasureIndex.value !== null) {
    const m = measures.value[selectedMeasureIndex.value]
    m.keyChange = {
      key: tempKeyChangeKey.value,
      scaleType: tempKeyChangeScale.value,
      beatIndex: tempKeyChangeBeatIndex.value
    }
  }
  isKeyChangeSubMenuOpen.value = false
  isMeasureOptionsOpen.value = false
}
const removeKeyChange = () => {
  if (selectedMeasureIndex.value !== null) {
    const m = measures.value[selectedMeasureIndex.value]
    if (m.keyChange) {
      delete m.keyChange
    }
  }
  isKeyChangeSubMenuOpen.value = false
  isMeasureOptionsOpen.value = false
}
const openKeyChangeInfo = (measure) => {
  activeKeyChangeMeasure.value = measure
  isKeyChangeInfoOpen.value = true
}
const removeKeyChangeFromMeasure = (measure) => {
  const origIdx = measure.originalMeasureIndex
  if (origIdx !== undefined && measures.value[origIdx]) {
    delete measures.value[origIdx].keyChange
  }
  isKeyChangeInfoOpen.value = false
}
const modulationAnalysis = computed(() => {
  if (!activeKeyChangeMeasure.value || !activeKeyChangeMeasure.value.keyChange) return null
  const m = activeKeyChangeMeasure.value
  const origIdx = m.originalMeasureIndex
  const beatIdx = m.keyChange.beatIndex !== undefined ? m.keyChange.beatIndex : 0
  
  // Find key/scale just before this key change
  let prevKey = key.value
  let prevScale = scaleType.value
  
  if (origIdx > 0 || beatIdx > 0) {
    let checkMeasure = origIdx
    let checkBeat = beatIdx - 1
    if (checkBeat < 0) {
      checkMeasure = origIdx - 1
      checkBeat = timeSignature.value - 1
    }
    const prevSig = getBeatKeyAndScale(checkMeasure, checkBeat)
    prevKey = prevSig.key
    prevScale = prevSig.scale
  }
  
  const toKey = m.keyChange.key
  const toScale = m.keyChange.scaleType || 'major'
  
  const analysis = analyzeModulationRelationship(prevKey, prevScale, toKey, toScale)
  return {
    fromKey: prevKey,
    fromScale: prevScale,
    toKey: toKey,
    toScale: toScale,
    ...analysis
  }
})
const isSelectionMode = ref(false)
const selectedRangeStart = ref(null)
const selectedRangeEnd = ref(null)
const isSelectionDragging = ref(false)
const isTimesModalOpen = ref(false)
const customTimes = ref(2)
const isRepeatMenuOpen = ref(false)
const isAnyModalOpen = computed(() => {
  return isRepeatMenuOpen.value || isMeasureOptionsOpen.value || isModalOpen.value || isSystemSuggestionsModalOpen.value
})
const minSelectedMeasure = computed(() => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return 0
  return Math.min(selectedRangeStart.value, selectedRangeEnd.value) + 1
})
const maxSelectedMeasure = computed(() => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return 0
  return Math.max(selectedRangeStart.value, selectedRangeEnd.value) + 1
})
const isCasillasAvailable = computed(() => {
  if (currentPlan.value !== 'PRO') return false
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return false
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  // Allow if selection end is within OR equal to a repeat's end measure
  // This lets user select just the last measure of a repeat for casilla
  return repeats.value.some(r => r.type === 'simple' && r.startMeasure <= end && r.endMeasure >= end)
})
const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  clearSelection()
}
const clearSelection = () => {
  selectedRangeStart.value = null
  selectedRangeEnd.value = null
  isSelectionDragging.value = false
}
const toggleMeasureSelection = (index) => {
  if (selectedRangeStart.value === null) {
    selectedRangeStart.value = index
    selectedRangeEnd.value = index
  } else {
    if (selectedRangeStart.value === index && selectedRangeEnd.value === index) {
      clearSelection()
    } else {
      selectedRangeEnd.value = index
    }
  }
}
const startSelectionDrag = (index) => {
  isSelectionDragging.value = true
  selectedRangeStart.value = index
  selectedRangeEnd.value = index
}
const continueSelectionDrag = (index) => {
  if (isSelectionDragging.value) {
    selectedRangeEnd.value = index
  }
}
const handleGlobalMouseUp = () => {
  isSelectionDragging.value = false
}
const isMeasureSelected = (originalIndex) => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return false
  const start = Math.min(selectedRangeStart.value, selectedRangeEnd.value)
  const end = Math.max(selectedRangeStart.value, selectedRangeEnd.value)
  return originalIndex >= start && originalIndex <= end
}
// --- DROPDOWN STATE ---
const activeDropdown = ref(null)
const toggleDropdown = (name) => {
  activeDropdown.value = activeDropdown.value === name ? null : name
}
// --- QUICK EDIT POPOVERS ---
const activeQuickChordPopover = ref(null)
const activeRhythmSelector = ref(null)
const RHYTHM_FIGURES = [
  { value: 'quarter', label: 'Negras (1x)', icon: '♩', isPro: false },
  { value: 'eighth', label: 'Corcheas (2x)', icon: '♫', isPro: false },
  { value: 'offbeat', label: 'Contratiempo', icon: '↷', isPro: false },
  { value: 'sixteenth', label: 'Semicorcheas (4x)', icon: '♬', isPro: true },
  { value: 'triplet', label: 'Tresillo (3x)', icon: '3️⃣', isPro: true },
  { value: 'quintuplet', label: 'Quintillo (5x)', icon: '5️⃣', isPro: true }
]
const clickBeat = (measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex) => {
  if (isSelectionMode.value) {
    toggleMeasureSelection(measureIndex)
    return
  }
  const isSame = activeQuickChordPopover.value &&
    activeQuickChordPopover.value.measureIndex === measureIndex &&
    activeQuickChordPopover.value.beatIndex === beatIndex &&
    activeQuickChordPopover.value.subdivisionIndex === subdivisionIndex
    
  if (isSame) {
    activeQuickChordPopover.value = null
  } else {
    activeDropdown.value = null
    activeRhythmSelector.value = null
    isMeasureOptionsOpen.value = false
    isRepeatMenuOpen.value = false
    isSystemSuggestionsModalOpen.value = false
    activeQuickChordPopover.value = { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex }
  }
  openModal(measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex)
}
const selectQuickChord = (chordObj) => {
  if (activeQuickChordPopover.value) {
    const { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex } = activeQuickChordPopover.value
    selectedBeat.value = { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex }
    selectChord(chordObj)
    activeQuickChordPopover.value = null
  }
}
const deleteQuickChord = () => {
  if (activeQuickChordPopover.value) {
    const { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex } = activeQuickChordPopover.value
    selectedBeat.value = { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex }
    selectChord({ root: '', type: '' })
    activeQuickChordPopover.value = null
  }
}
const openAdvancedDetails = () => {
  if (activeQuickChordPopover.value) {
    const { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex } = activeQuickChordPopover.value
    activeQuickChordPopover.value = null
    openModal(measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex)
  }
}
const changeQuickRhythm = (rhythmType) => {
  if (activeQuickChordPopover.value) {
    const { measureIndex, beatIndex } = activeQuickChordPopover.value
    const m = measures.value[measureIndex]
    const beat = m?.beats[beatIndex]
    if (beat) {
      const figObj = RHYTHM_FIGURES.find(f => f.value === rhythmType)
      if (figObj && figObj.isPro && currentPlan.value === 'FREE') {
        activeQuickChordPopover.value = null
        upgradeReason.value = 'ritmo_armonico'
        isUpgradeModalOpen.value = true
        return
      }
      changeBeatHarmonicRhythm(beat, rhythmType)
      m.groove = 'custom'
      activeQuickChordPopover.value = null
    }
  }
}
const openRhythmSelector = (measureIndex, beatIndex) => {
  const isSame = activeRhythmSelector.value &&
    activeRhythmSelector.value.measureIndex === measureIndex &&
    activeRhythmSelector.value.beatIndex === beatIndex
    
  if (isSame) {
    activeRhythmSelector.value = null
  } else {
    activeDropdown.value = null
    activeQuickChordPopover.value = null
    isMeasureOptionsOpen.value = false
    isRepeatMenuOpen.value = false
    isSystemSuggestionsModalOpen.value = false
    activeRhythmSelector.value = { measureIndex, beatIndex }
  }
}
const selectRhythmFigure = (rhythmType) => {
  if (activeRhythmSelector.value) {
    const { measureIndex, beatIndex } = activeRhythmSelector.value
    const m = measures.value[measureIndex]
    const beat = m?.beats[beatIndex]
    if (beat) {
      const figObj = RHYTHM_FIGURES.find(f => f.value === rhythmType)
      if (figObj && figObj.isPro && currentPlan.value === 'FREE') {
        activeRhythmSelector.value = null
        upgradeReason.value = 'ritmo_armonico'
        isUpgradeModalOpen.value = true
        return
      }
      changeBeatHarmonicRhythm(beat, rhythmType)
      m.groove = 'custom'
      activeRhythmSelector.value = null
    }
  }
}
const closeDropdowns = (e) => {
  if (!e.target.closest('.dropdown-container') && !e.target.closest('.quick-popover-container') && !e.target.closest('.rhythm-popover-container')) {
    activeDropdown.value = null
    activeQuickChordPopover.value = null
    activeRhythmSelector.value = null
  }
}
onMounted(() => {
  document.addEventListener('click', closeDropdowns)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})
onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})
const diatonicChords = computed(() => {
  if (selectedBeat.value) {
    const measureIdx = selectedBeat.value.measureIndex
    const beatIdx = selectedBeat.value.beatIndex
    const { key: activeKey, scale: activeScale } = getBeatKeyAndScale(measureIdx, beatIdx)
    return getDiatonicChords(activeKey, activeScale, modalComplexity.value)
  }
  return getDiatonicChords(key.value, scaleType.value, modalComplexity.value)
})
const wasBeatAlreadySet = ref(false)
const openModal = (measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex) => {
  // Close all other bottom-sheet modals first to prevent stacking
  isMeasureOptionsOpen.value = false
  isRepeatMenuOpen.value = false
  isSystemSuggestionsModalOpen.value = false
  selectedBeat.value = { measureIndex, beatIndex, displayedMeasureIndex, subdivisionIndex }
  const m = measures.value[measureIndex]
  const b = m ? m.beats[beatIndex] : null
  
  let wasSet = false
  if (b) {
    const slots = getBeatSlots(m, b, beatIndex)
    if (subdivisionIndex !== undefined && slots[subdivisionIndex]) {
      wasSet = !!slots[subdivisionIndex].root
    } else {
      wasSet = !!b.root
    }
  }
  
  wasBeatAlreadySet.value = wasSet
  activeTensionExplanation.value = null // Reset explanation
  isModalOpen.value = true
}
const selectChord = (chordObj) => {
  if (selectedBeat.value) {
    const { measureIndex, beatIndex, subdivisionIndex } = selectedBeat.value
    const m = measures.value[measureIndex]
    const beat = m.beats[beatIndex]
    
    if (subdivisionIndex !== undefined) {
      const rhythm = getEffectiveRhythm(m, beat, beatIndex)
      const subCount = getSubdivisionCount(rhythm)
      if (!beat.subdivisions || beat.subdivisions.length !== subCount) {
        beat.subdivisions = getBeatSlots(m, beat, beatIndex).map(s => ({
          root: s.root,
          type: s.type,
          tensions: [...(s.tensions || [])],
          tension: s.tension,
          bass: s.bass,
          isSilence: s.isSilence || false
        }))
      }
      beat.subdivisions[subdivisionIndex] = {
        root: chordObj.root,
        type: chordObj.type,
        tensions: [],
        tension: null,
        bass: null
      }
      
      const isOffbeat = rhythm === 'offbeat'
      if ((subdivisionIndex === 0 && !isOffbeat) || (subdivisionIndex === 1 && isOffbeat)) {
        beat.root = chordObj.root
        beat.type = chordObj.type
        beat.tensions = []
        beat.tension = null
        beat.bass = null
      }
      
      m.groove = 'custom'
    } else {
      m.beats[beatIndex] = {
        root: chordObj.root,
        type: chordObj.type,
        tensions: [],
        tension: null,
        bass: null
      }
    }
    activeTensionExplanation.value = null
    
    // Cierra el modal inmediatamente al seleccionar o borrar un acorde
    isModalOpen.value = false
    if (chordObj.root) {
      wasBeatAlreadySet.value = true
    }
  }
}
const isMeasureDense = (measure) => {
  if (!measure || !measure.beats) return false
  const activeBeats = measure.beats.filter(b => b.root)
  if (activeBeats.length >= 3) return true
  if (activeBeats.length === 2) {
    return activeBeats.some(b => {
      const formatted = formatChord(b)
      return formatted.length > 6
    })
  }
  return false
}
const getMeasureFontSizeClass = (measure) => {
  if (!measure || !measure.beats) return 'text-xl sm:text-[22px] md:text-[28px] lg:text-[30px] font-black leading-none'
  const activeBeats = measure.beats.filter(b => b.root)
  if (activeBeats.length === 0) return 'text-xl sm:text-[22px] md:text-[28px] lg:text-[30px] font-black leading-none'
  
  let maxLen = 0
  activeBeats.forEach(b => {
    const len = formatChord(b).length
    if (len > maxLen) maxLen = len
  })
  const count = activeBeats.length
  if (count >= 3) {
    if (maxLen > 6) {
      return 'text-[9px] sm:text-[11px] md:text-[14px] lg:text-[16px] font-extrabold leading-none tracking-tighter'
    }
    return 'text-[11px] sm:text-[13px] md:text-[17px] lg:text-[19px] font-black leading-none tracking-tight'
  }
  
  if (count === 2) {
    if (maxLen > 7) {
      return 'text-[11px] sm:text-[13px] md:text-[17px] lg:text-[19px] font-extrabold leading-none tracking-tight'
    }
    if (maxLen > 5) {
      return 'text-[13px] sm:text-[15px] md:text-[20px] lg:text-[22px] font-black leading-none'
    }
    return 'text-[16px] sm:text-[18px] md:text-[24px] lg:text-[26px] font-black leading-none'
  }
  
  // Only 1 chord
  if (maxLen > 8) {
    return 'text-[13px] sm:text-[15px] md:text-[20px] lg:text-[22px] font-extrabold leading-none tracking-tight'
  }
  if (maxLen > 5) {
    return 'text-[16px] sm:text-[18px] md:text-[24px] lg:text-[26px] font-black leading-none'
  }
  return 'text-xl sm:text-[22px] md:text-[28px] lg:text-[30px] font-black leading-none'
}
const openMeasureOptions = (mIdx) => {
  selectedMeasureIndex.value = mIdx
  const m = measures.value[mIdx]
  tempSectionLabel.value = m.sectionLabel || 'Ninguna'
  tempMeasureGroove.value = m.groove || 'global'
  isKeyChangeSubMenuOpen.value = false
  keyChangeStep.value = 1
  
  if (m.keyChange) {
    tempKeyChangeKey.value = m.keyChange.key
    tempKeyChangeScale.value = m.keyChange.scaleType || 'major'
    tempKeyChangeBeatIndex.value = m.keyChange.beatIndex !== undefined ? m.keyChange.beatIndex : 0
  } else {
    const mWithKey = measuresWithKey.value[mIdx]
    tempKeyChangeKey.value = mWithKey ? mWithKey.activeKey : key.value
    tempKeyChangeScale.value = mWithKey ? mWithKey.activeScale : scaleType.value
    tempKeyChangeBeatIndex.value = 0
  }
  
  isMeasureOptionsOpen.value = true
}
const changeBeatHarmonicRhythm = (beat, rhythmType) => {
  const prevRhythm = beat.harmonicRhythm || 'quarter';
  if (prevRhythm === rhythmType) return;
  
  beat.harmonicRhythm = rhythmType;
  
  if (rhythmType === 'quarter') {
    if (beat.subdivisions && beat.subdivisions.length > 0) {
      // Sync beat with first subdivision if it has root
      const firstSub = beat.subdivisions[0];
      if (firstSub && firstSub.root) {
        beat.root = firstSub.root;
        beat.type = firstSub.type;
        beat.tensions = firstSub.tensions || [];
        beat.tension = firstSub.tension || null;
        beat.bass = firstSub.bass || null;
      }
    }
    delete beat.subdivisions;
  } else {
    let subCount = 2;
    if (rhythmType === 'eighth') subCount = 2;
    else if (rhythmType === 'sixteenth') subCount = 4;
    else if (rhythmType === 'offbeat') subCount = 2;
    else if (rhythmType === 'triplet') subCount = 3;
    else if (rhythmType === 'quintuplet') subCount = 5;
    
    const existingSubs = beat.subdivisions || [];
    const newSubs = [];
    
    for (let i = 0; i < subCount; i++) {
      if (rhythmType === 'offbeat' && i === 0) {
        newSubs.push({
          root: '',
          type: '',
          tensions: [],
          tension: null,
          bass: null,
          isSilence: true
        });
      } else {
        let existing = existingSubs[i];
        if (!existing && i === 0 && beat.root && rhythmType !== 'offbeat') {
          existing = {
            root: beat.root,
            type: beat.type,
            tensions: [...(beat.tensions || [])],
            tension: beat.tension,
            bass: beat.bass
          };
        } else if (!existing && i === 1 && beat.root && rhythmType === 'offbeat') {
          existing = {
            root: beat.root,
            type: beat.type,
            tensions: [...(beat.tensions || [])],
            tension: beat.tension,
            bass: beat.bass
          };
        }
        
        newSubs.push({
          root: existing?.root || '',
          type: existing?.type || '',
          tensions: existing?.tensions ? [...existing.tensions] : [],
          tension: existing?.tension || null,
          bass: existing?.bass || null
        });
      }
    }
    beat.subdivisions = newSubs;
    
    // Sync root beat properties for backward compatibility
    if (rhythmType !== 'offbeat' && newSubs[0]) {
      beat.root = newSubs[0].root;
      beat.type = newSubs[0].type;
      beat.tensions = [...newSubs[0].tensions];
      beat.tension = newSubs[0].tension;
      beat.bass = newSubs[0].bass;
    } else if (rhythmType === 'offbeat' && newSubs[1]) {
      beat.root = newSubs[1].root;
      beat.type = newSubs[1].type;
      beat.tensions = [...newSubs[1].tensions];
      beat.tension = newSubs[1].tension;
      beat.bass = newSubs[1].bass;
    }
  }
}
const selectBeatHarmonicRhythm = (rhythmType) => {
  if (rhythmType !== 'quarter' && rhythmType !== 'auto' && currentPlan.value === 'FREE') {
    isModalOpen.value = false;
    upgradeReason.value = 'ritmo_armonico';
    isUpgradeModalOpen.value = true;
    return;
  }
  
  if (selectedBeat.value) {
    const { measureIndex, beatIndex } = selectedBeat.value;
    const m = measures.value[measureIndex];
    const beat = m?.beats[beatIndex];
    if (beat) {
      changeBeatHarmonicRhythm(beat, rhythmType);
      if (rhythmType !== 'auto') {
        m.groove = 'custom';
      } else {
        if (!m.beats.some(b => b.harmonicRhythm && b.harmonicRhythm !== 'auto')) {
          m.groove = 'global';
        }
      }
      isModalOpen.value = false;
    }
  }
}
const flattenParentBeat = () => {
  if (selectedBeat.value) {
    const { measureIndex, beatIndex } = selectedBeat.value;
    const m = measures.value[measureIndex];
    const beat = m?.beats[beatIndex];
    if (beat) {
      changeBeatHarmonicRhythm(beat, 'quarter');
      m.groove = 'custom';
      selectedBeat.value = { ...selectedBeat.value, subdivisionIndex: undefined };
      isModalOpen.value = false;
    }
  }
}
const GROOVE_DETAILS = {
  Ninguno: {
    name: 'Ninguno',
    subdivision: 'Negras',
    description: 'Sin subdivisiones automáticas.',
    previewHeader: '1   2   3   4',
    previewLine:   '.   .   .   .',
    icon: '♩',
    badge: 'negras simples'
  },
  Pop: {
    name: 'Pop',
    subdivision: 'Negras / Corcheas',
    description: 'Anticipa acordes antes del tiempo fuerte. Pop moderno.',
    previewHeader: '1 & 2 & 3 & 4 &',
    previewLine:   'x . x . x . x .',
    icon: '♪',
    badge: 'anticipado'
  },
  Ballad: {
    name: 'Balada',
    subdivision: 'Negras',
    description: 'Acordes largos, ideal para música lenta y emocional.',
    previewHeader: '1   2   3   4',
    previewLine:   'x . . . x . . .',
    icon: '—',
    badge: 'espacio amplio'
  },
  Funk: {
    name: 'Funk',
    subdivision: 'Corcheas',
    description: 'Énfasis en contratiempos con síncopas marcadas.',
    previewHeader: '1 & 2 & 3 & 4 &',
    previewLine:   'x x . x x . x x',
    icon: '♬',
    badge: 'síncopas'
  },
  Latin: {
    name: 'Latin',
    subdivision: 'Corcheas',
    description: 'Movimiento continuo, sensación de empuje.',
    previewHeader: '1 & 2 & 3 & 4 &',
    previewLine:   'x . x x . x x .',
    icon: '♫',
    badge: 'empuje'
  },
  Bossa: {
    name: 'Bossa Nova',
    subdivision: 'Corcheas',
    description: 'El bajo marca el pulso, los acordes responden en contratiempo.',
    previewHeader: '1 & 2 & 3 & 4 &',
    previewLine:   'x . x . x . x .',
    icon: '↷',
    badge: 'bajo + contratiempo'
  },
  Rock: {
    name: 'Rock',
    subdivision: 'Negras',
    description: 'Directo y sólido en el tiempo, sin síncopas.',
    previewHeader: '1   2   3   4',
    previewLine:   'x   x   x   x',
    icon: '♩',
    badge: 'sólido'
  },
  Upbeat: {
    name: 'Upbeat',
    subdivision: 'Corcheas',
    description: 'El groove vive fuera del pulso (reggae / ska).',
    previewHeader: '1 & 2 & 3 & 4 &',
    previewLine:   '. x . x . x . x',
    icon: '↷',
    badge: 'contratiempo'
  },
  'Half-time': {
    name: 'Half-time',
    subdivision: 'Negras',
    description: 'Sensación lenta con menos cambios de acorde.',
    previewHeader: '1   2   3   4',
    previewLine:   'x . . . . . . .',
    icon: '—',
    badge: 'lento'
  },
  Arpegio: {
    name: 'Arpegio',
    subdivision: 'Corcheas',
    description: 'El acorde se desarma de forma arpegiada.',
    previewHeader: '1 & 2 & 3 & 4 &',
    previewLine:   'x x x x x x x x',
    icon: '🎜',
    badge: 'arpegiado'
  },
  'Push final': {
    name: 'Push Final',
    subdivision: 'Semicor.',
    description: 'Mayor intensidad rítmica, ideal para clímax.',
    previewHeader: '1e&a 2e&a 3e&a 4e&a',
    previewLine:   'xxxx xxxx xxxx xxxx',
    icon: '♬',
    badge: 'clímax'
  }
}
const GROOVE_OPTIONS = ['Ninguno', 'Pop', 'Ballad', 'Funk', 'Latin', 'Bossa', 'Rock', 'Upbeat', 'Half-time', 'Arpegio', 'Push final']
const GROOVE_PATTERNS = {
  Ninguno: ['quarter', 'quarter', 'quarter', 'quarter'],
  Pop: ['quarter', 'quarter', 'quarter', 'eighth'],
  Ballad: ['quarter', 'quarter', 'quarter', 'quarter'],
  Funk: ['eighth', 'eighth', 'eighth', 'eighth'],
  Latin: ['eighth', 'eighth', 'eighth', 'eighth'],
  Bossa: ['quarter', 'offbeat', 'quarter', 'offbeat'],
  Rock: ['quarter', 'quarter', 'quarter', 'quarter'],
  Upbeat: ['offbeat', 'offbeat', 'offbeat', 'offbeat'],
  'Half-time': ['quarter', 'quarter', 'quarter', 'quarter'],
  Arpegio: ['eighth', 'eighth', 'eighth', 'eighth'],
  'Push final': ['sixteenth', 'sixteenth', 'sixteenth', 'sixteenth']
}
const translateGrooveName = (g) => {
  if (g === 'Ninguno') return 'Ninguno'
  if (g === 'Pop') return 'Pop'
  if (g === 'Ballad') return 'Balada'
  if (g === 'Funk') return 'Funk'
  if (g === 'Latin') return 'Latin'
  if (g === 'Bossa') return 'Bossa Nova'
  if (g === 'Rock') return 'Rock'
  if (g === 'Upbeat') return 'Upbeat'
  if (g === 'Half-time') return 'Half-time'
  if (g === 'Arpegio') return 'Arpegio'
  if (g === 'Push final') return 'Push Final'
  return g
}
const getSubdivisionCount = (rhythm) => {
  if (rhythm === 'eighth' || rhythm === 'offbeat') return 2
  if (rhythm === 'sixteenth') return 4
  if (rhythm === 'triplet') return 3
  if (rhythm === 'quintuplet') return 5
  return 1
}
const getEffectiveRhythm = (measure, beat, beatIdx) => {
  if (!beat) return 'quarter'
  if (beat.harmonicRhythm && beat.harmonicRhythm !== 'auto') {
    return beat.harmonicRhythm
  }
  
  const mGroove = measure?.groove || 'global'
  if (mGroove === 'neutral') {
    return 'quarter'
  }
  if (mGroove === 'custom') {
    return 'quarter'
  }
  
  const pattern = GROOVE_PATTERNS[globalGroove.value] || GROOVE_PATTERNS.Ninguno
  return pattern[beatIdx] || 'quarter'
}
const getBeatSlots = (measure, beat, beatIdx) => {
  const rhythm = getEffectiveRhythm(measure, beat, beatIdx)
  const subCount = getSubdivisionCount(rhythm)
  
  if (subCount === 1) return []
  
  if (beat.subdivisions && beat.subdivisions.length === subCount) {
    return beat.subdivisions
  }
  
  const slots = []
  for (let i = 0; i < subCount; i++) {
    if (rhythm === 'offbeat' && i === 0) {
      slots.push({ root: '', type: '', tensions: [], tension: null, bass: null, isSilence: true })
    } else {
      const isPrimary = (rhythm !== 'offbeat' && i === 0) || (rhythm === 'offbeat' && i === 1)
      slots.push({
        root: isPrimary ? beat.root : '',
        type: isPrimary ? beat.type : '',
        tensions: isPrimary ? [...(beat.tensions || [])] : [],
        tension: isPrimary ? beat.tension : null,
        bass: isPrimary ? beat.bass : null
      })
    }
  }
  return slots
}
const hasBeatRhythmOverride = (measure, beat, beatIdx) => {
  if (!beat) return false
  const inherited = GROOVE_PATTERNS[globalGroove.value]?.[beatIdx] || 'quarter'
  const mGroove = measure?.groove || 'global'
  
  if (mGroove === 'neutral') {
    return beat.harmonicRhythm && beat.harmonicRhythm !== 'auto' && beat.harmonicRhythm !== 'quarter'
  }
  
  return beat.harmonicRhythm && beat.harmonicRhythm !== 'auto' && beat.harmonicRhythm !== inherited
}
const selectGlobalGroove = (g) => {
  if (g !== 'Ninguno' && currentPlan.value === 'FREE') {
    activeDropdown.value = null;
    upgradeReason.value = 'ritmo_armonico';
    isUpgradeModalOpen.value = true;
    return;
  }
  globalGroove.value = g;
  activeDropdown.value = null;
}
const getActiveMeasureRhythms = (measure) => {
  const rhythms = []
  if (measure && measure.beats) {
    measure.beats.forEach((b, bIdx) => {
      const effRhythm = getEffectiveRhythm(measure, b, bIdx)
      if (effRhythm && effRhythm !== 'quarter') {
        const sym = getRhythmSymbol(effRhythm)
        if (sym && !rhythms.includes(sym)) {
          rhythms.push(sym)
        }
      }
    })
  }
  return rhythms
}
const getSubdivisionIcon = (rhythm) => {
  if (rhythm === 'eighth') return '♪'
  if (rhythm === 'offbeat') return '↷'
  if (rhythm === 'sixteenth') return '♬'
  if (rhythm === 'triplet') return '3'
  if (rhythm === 'quintuplet') return '5'
  if (rhythm === 'quarter') return '♩'
  return ''
}
const getSubdivisionFontSizeClass = (subCount) => {
  if (subCount >= 4) {
    return 'text-[9px] sm:text-[10px] md:text-[11px] lg:text-[13px] font-black'
  }
  if (subCount >= 3) {
    return 'text-[11px] sm:text-[12px] md:text-[13px] lg:text-[15px] font-black'
  }
  return 'text-[13px] sm:text-[14px] md:text-[16px] lg:text-[18px] font-black'
}
const getRhythmSymbol = (rhythm) => {
  if (rhythm === 'eighth') return '♪'
  if (rhythm === 'sixteenth') return '♬'
  if (rhythm === 'offbeat') return '↷'
  if (rhythm === 'triplet') return '3'
  if (rhythm === 'quintuplet') return '5'
  return ''
}
const translateRhythmName = (rhythm) => {
  if (rhythm === 'eighth') return 'Corcheas'
  if (rhythm === 'sixteenth') return 'Semicorcheas'
  if (rhythm === 'offbeat') return 'Contratiempo'
  if (rhythm === 'triplet') return 'Tresillo'
  if (rhythm === 'quintuplet') return 'Quintillo'
  if (rhythm === 'auto') return 'Automático'
  return 'Normal'
}
const saveMeasureOptions = () => {
  if (selectedMeasureIndex.value !== null) {
    const m = measures.value[selectedMeasureIndex.value]
    m.sectionLabel = tempSectionLabel.value === 'Ninguna' ? null : tempSectionLabel.value
    
    // Save groove configuration
    const prevGroove = m.groove || 'global'
    if (tempMeasureGroove.value !== prevGroove) {
      m.groove = tempMeasureGroove.value
      
      // If switching to global or neutral, reset all beat-level overrides in this measure
      if (tempMeasureGroove.value === 'global' || tempMeasureGroove.value === 'neutral') {
        m.beats.forEach(beat => {
          beat.harmonicRhythm = 'auto'
          delete beat.subdivisions
        })
      }
    }
  }
  isMeasureOptionsOpen.value = false
}
const openTimesSelector = () => {
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  if (start >= end) {
    alert("Para repetir compases, debes seleccionar al menos 2 compases (un rango).")
    return
  }
  customTimes.value = 2
  isTimesModalOpen.value = true
}
const confirmTimes = (timesVal) => {
  const times = Number(timesVal)
  if (isNaN(times) || times < 2) {
    alert("Por favor, introduce un número de repeticiones válido (2 o más).")
    return
  }
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  
  // Clean overlapping repeats
  repeats.value = repeats.value.filter(r => {
    const rStart = r.startMeasure
    const rEnd = r.type === 'casilla' ? Math.max(r.endMeasure, r.casilla2End) : r.endMeasure
    return !(Math.max(rStart, start) <= Math.min(rEnd, end))
  })
  
  repeats.value.push({
    id: generateUniqueId(),
    type: 'simple',
    startMeasure: start,
    endMeasure: end,
    times: times
  })
  
  isTimesModalOpen.value = false
  isSelectionMode.value = false
  clearSelection()
}
const convertRepeatToCasilla = () => {
  if (currentPlan.value !== 'PRO') return
  if (selectedRangeStart.value === null || selectedRangeEnd.value === null) return
  
  const start = minSelectedMeasure.value
  const end = maxSelectedMeasure.value
  
  // Find repeat that covers the selected end measure (handles both full range and single-last-measure selection)
  const rep = repeats.value.find(r => r.type === 'simple' && r.startMeasure <= end && r.endMeasure >= end)
  if (!rep) return
  
  rep.type = 'casilla'
  rep.casilla1Start = rep.startMeasure  // Casilla 1 always starts at repeat start
  rep.casilla2Start = rep.endMeasure + 1
  rep.casilla2End = rep.endMeasure + 1
  
  // Auto add measures for Casilla 2 if needed
  while (measures.value.length < rep.casilla2End) {
    const emptyBeats = Array.from({ length: timeSignature.value }, () => ({ root: '', type: '' }))
    measures.value.push({
      id: generateUniqueId(),
      beats: emptyBeats,
      sectionLabel: null
    })
  }
  
  isSelectionMode.value = false
  clearSelection()
}
const removeRepeat = (id) => {
  repeats.value = repeats.value.filter(r => r.id !== id)
}
const addMeasure = () => {
  if (currentPlan.value === 'FREE' && measures.value.length >= 20) {
    upgradeReason.value = 'limit'
    isUpgradeModalOpen.value = true
    return
  }
  const emptyBeats = Array.from({ length: timeSignature.value }, () => ({ root: '', type: '' }))
  measures.value.push({
    id: generateUniqueId(),
    beats: emptyBeats,
    sectionLabel: null
  })
}
const formatDisplayChord = (beat) => {
  if (!beat.root) return '-'
  return formatChord(beat)
}
const exportPdf = () => {
  if (currentPlan.value === 'PRO' && viewMode.value === 'expanded') {
    generatePDF({
      title: title.value,
      key: key.value,
      scaleType: scaleType.value,
      timeSignature: timeSignature.value,
      measures: displayedMeasures.value,
      repeats: [],
      keySignatureStr: keySignatureStr.value,
      viewMode: 'expanded',
      globalGroove: globalGroove.value
    })
  } else {
    generatePDF({
      title: title.value,
      key: key.value,
      scaleType: scaleType.value,
      timeSignature: timeSignature.value,
      measures: measuresWithKey.value,
      repeats: repeats.value,
      keySignatureStr: keySignatureStr.value,
      viewMode: 'compact',
      globalGroove: globalGroove.value
    })
  }
}
</script>
<template>
  <div class="h-[100dvh] w-full flex flex-col bg-[#F9FBF9] text-[#1C1C1E] font-sans antialiased overflow-hidden">
    
    <transition name="fade" mode="out-in">
      
      <!-- ==================== WIZARD (GREEN ACCENT) ==================== -->
      <div v-if="isSetupMode" class="flex-1 flex flex-col w-full h-full overflow-y-auto">
        <div class="max-w-2xl mx-auto w-full pt-12 pb-8 px-4 sm:px-6">
          <div class="flex items-center justify-between mb-8 px-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-[#34C759] rounded-xl flex items-center justify-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              </div>
              <h1 class="text-[34px] leading-tight font-bold text-black tracking-tight flex items-center gap-2">
                HarmoniGrid
                <span v-if="currentPlan === 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[12px] px-2.5 py-0.5 rounded-full font-black shadow-sm">PRO</span>
              </h1>
            </div>
            
            <!-- Plan Toggle Switch in Wizard -->
            <div class="flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200/80 shadow-inner">
              <button 
                @click="setPlan('FREE')" 
                :class="currentPlan === 'FREE' ? 'bg-[#34C759] text-white shadow-sm font-black' : 'text-gray-500 font-bold hover:text-gray-700'"
                class="px-3 py-1 text-xs rounded-full transition-all"
              >
                FREE
              </button>
              <button 
                @click="setPlan('PRO')" 
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-black' : 'text-gray-500 font-bold hover:text-gray-700'"
                class="px-3 py-1 text-xs rounded-full transition-all flex items-center gap-0.5"
              >
                👑 PRO
              </button>
            </div>
          </div>
          <div class="space-y-6">
            <!-- Bloque 1: General -->
            <div class="bg-white rounded-2xl shadow-sm border border-[#34C759]/10 overflow-visible">
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Título de la canción</span>
                <input v-model="configTitle" type="text" class="text-[17px] text-right text-[#34C759] font-semibold focus:outline-none w-1/2 bg-transparent" placeholder="Ej: Mi Canción" />
              </div>
              
              <div class="flex items-center justify-between p-4 border-b border-gray-100">
                <span class="text-[17px] font-semibold text-gray-800">Compases Iniciales</span>
                <div class="flex items-center gap-3">
                  <button @click="configMeasuresCount = Math.max(1, configMeasuresCount - 1)" class="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center active:bg-[#34C759]/20">-</button>
                  <input 
                    :value="configMeasuresCount" 
                    @input="handleMeasuresInput" 
                    @blur="handleMeasuresBlur" 
                    type="number" 
                    min="1" 
                    class="text-[17px] font-bold w-16 text-center bg-gray-50 border border-gray-200 rounded-lg focus:border-[#34C759] focus:bg-white focus:outline-none transition-all py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                  />
                  <button @click="currentPlan === 'PRO' ? configMeasuresCount++ : (configMeasuresCount >= 20 ? (upgradeReason='limit', isUpgradeModalOpen=true) : configMeasuresCount++)" class="w-8 h-8 rounded-full bg-[#34C759]/10 text-[#34C759] flex items-center justify-center active:bg-[#34C759]/20">+</button>
                </div>
              </div>
              <!-- CUSTOM DROPDOWN: Cifra Indicadora -->
              <div class="relative dropdown-container border-b border-gray-100 z-30">
                <button @click="toggleDropdown('timeSignature')" class="flex items-center justify-between w-full p-4 active:bg-gray-50 transition-colors">
                  <span class="text-[17px] font-semibold text-gray-800">Cifra Indicadora</span>
                  <div class="flex items-center gap-1 text-[#34C759]">
                    <span class="text-[17px] font-semibold">{{ configTimeSignature }}/4</span>
                    <svg class="w-4 h-4 transition-transform" :class="{'rotate-180': activeDropdown === 'timeSignature'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </button>
                <transition name="dropdown">
                  <div v-if="activeDropdown === 'timeSignature'" class="absolute top-full right-4 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <button @click="configTimeSignature = 4; activeDropdown = null" class="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-[#34C759]/5 text-[17px] flex justify-between">4 / 4 <span v-if="configTimeSignature===4" class="text-[#34C759]">✓</span></button>
                    <button @click="configTimeSignature = 3; activeDropdown = null" class="w-full text-left px-4 py-3 hover:bg-[#34C759]/5 text-[17px] flex justify-between">3 / 4 <span v-if="configTimeSignature===3" class="text-[#34C759]">✓</span></button>
                  </div>
                </transition>
              </div>
            </div>
            <!-- Bloque 2: Tonalidad -->
            <div class="bg-white rounded-2xl shadow-sm border border-[#34C759]/10 p-5">
              <span class="block text-[17px] font-semibold text-gray-800 mb-5">Tonalidad Central</span>
              
              <div class="space-y-4">
                <div class="flex flex-wrap gap-2">
                  <button v-for="k in keysNatural" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#34C759] text-white shadow-md shadow-[#34C759]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-11 h-11 rounded-full font-bold text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="k in keysSharp" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#34C759] text-white shadow-md shadow-[#34C759]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-11 h-11 rounded-full font-bold text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="k in keysFlat" :key="k" @click="configKey = k" :class="configKey === k ? 'bg-[#34C759] text-white shadow-md shadow-[#34C759]/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'" class="w-11 h-11 rounded-full font-bold text-[16px] transition-all flex items-center justify-center">{{ k }}</button>
                </div>
              </div>
              <!-- CUSTOM DROPDOWN: Escala -->
              <div class="mt-6 border-t border-gray-100 pt-2 relative dropdown-container z-20">
                <button @click="toggleDropdown('configScale')" class="flex items-center justify-between w-full p-3 -mx-3 rounded-lg active:bg-gray-50 transition-colors">
                  <span class="text-[17px] font-semibold text-gray-800">Tipo de Escala</span>
                  <div class="flex items-center gap-1 text-[#34C759]">
                    <span class="text-[17px] font-semibold">{{ currentConfigScaleName }}</span>
                    <svg class="w-4 h-4 transition-transform" :class="{'rotate-180': activeDropdown === 'configScale'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </button>
                <transition name="dropdown">
                  <div v-if="activeDropdown === 'configScale'" class="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-y-auto max-h-80 z-50 p-2 space-y-3">
                    <div v-for="group in groupedScales" :key="group.label" class="space-y-1">
                      <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1">{{ group.label }}</div>
                      <button v-for="s in group.items" :key="s.id" @click="selectConfigScale(s.id)" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-[14px] flex justify-between font-medium items-center">
                        <div class="flex flex-col">
                          <span class="text-gray-800 font-semibold">{{ s.name }}</span>
                          <span class="text-[10px] text-gray-400 font-normal leading-tight">{{ s.characteristic }}</span>
                        </div>
                        <span v-if="configScale === s.id" class="text-[#34C759]">✓</span>
                        <span v-else-if="s.isPro && currentPlan !== 'PRO'" class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                      </button>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </div>
          <button @click="startProject" class="w-full mt-8 bg-[#34C759] active:bg-[#248A3D] text-white font-bold text-[18px] py-4 rounded-2xl shadow-lg shadow-[#34C759]/30 transition-all transform active:scale-[0.98]">
            Crear Partitura
          </button>
        </div>
      </div>
      <!-- ==================== MAIN EDITOR ==================== -->
      <div v-else class="flex-1 flex flex-col h-full bg-[#F9FBF9] relative">
        
        <!-- HEADER -->
        <header class="flex items-center justify-between px-4 h-16 bg-white/90 backdrop-blur-xl border-b border-gray-200 z-20 sticky top-0 shadow-sm">
          <button @click="isSetupMode = true" class="text-[#34C759] font-medium text-[16px] w-24 text-left flex items-center hover:opacity-70 transition-opacity">
            <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg> Atrás
          </button>
          
          <div class="flex-1 text-center font-bold text-[18px] text-gray-900 truncate px-2">
            <input v-model="title" class="bg-transparent text-center focus:outline-none w-full placeholder-gray-400 font-extrabold" />
          </div>
          
          <div class="flex items-center gap-3">
            <!-- Plan Toggle Switch in Editor Header -->
            <div class="flex items-center bg-gray-100 p-0.5 rounded-full border border-gray-200/80 shadow-inner">
              <button 
                @click="setPlan('FREE')" 
                :class="currentPlan === 'FREE' ? 'bg-[#34C759] text-white shadow-sm font-black' : 'text-gray-500 font-bold hover:text-gray-700'"
                class="px-2.5 py-1 text-[11px] rounded-full transition-all duration-300"
              >
                FREE
              </button>
              <button 
                @click="setPlan('PRO')" 
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-black' : 'text-gray-500 font-bold hover:text-gray-700'"
                class="px-2.5 py-1 text-[11px] rounded-full transition-all duration-300 flex items-center gap-0.5"
              >
                👑 PRO
              </button>
            </div>
            
            <button @click="exportPdf" class="text-white bg-[#34C759] hover:bg-[#248A3D] px-3 py-1.5 rounded-full font-bold text-[14px] w-24 text-center shadow-md shadow-[#34C759]/20 transition-all">
              Exportar
            </button>
          </div>
        </header>
        <!-- TOOLBAR (Key & Repeats) -->
        <div class="px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap justify-between items-center z-10 gap-2">
          
          <div class="flex items-center gap-2">
            <!-- Custom Main Key Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('mainKey')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1 hover:border-[#34C759] transition-colors">
                {{ key }} <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'mainKey'" class="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 grid grid-cols-5 gap-1 z-50">
                  <button v-for="k in [...keysNatural, ...keysSharp, ...keysFlat]" :key="k" @click="key = k; activeDropdown = null" :class="key === k ? 'bg-[#34C759] text-white' : 'hover:bg-gray-100 text-gray-700'" class="py-2 rounded-lg font-bold text-sm text-center transition-colors">{{k}}</button>
                </div>
              </transition>
            </div>
            <!-- Custom Main Scale Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('mainScale')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1 hover:border-[#34C759] transition-colors">
                {{ currentScaleName }} <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'mainScale'" class="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-y-auto max-h-80 z-50 p-2 space-y-3">
                  <div v-for="group in groupedScales" :key="group.label" class="space-y-1">
                    <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1">{{ group.label }}</div>
                    <button v-for="s in group.items" :key="s.id" @click="selectMainScale(s.id)" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 text-[14px] flex justify-between font-medium items-center">
                      <div class="flex flex-col">
                        <span class="text-gray-800 font-semibold">{{ s.name }}</span>
                        <span class="text-[10px] text-gray-400 font-normal leading-tight">{{ s.characteristic }}</span>
                      </div>
                      <span v-if="scaleType === s.id" class="text-[#34C759]">✓</span>
                      <span v-else-if="s.isPro && currentPlan !== 'PRO'" class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                    </button>
                  </div>
                </div>
              </transition>
            </div>
            <!-- Custom Global Groove Dropdown -->
            <div class="relative dropdown-container">
              <button @click="toggleDropdown('globalGroove')" class="text-[15px] bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-lg px-3 py-1.5 outline-none flex items-center gap-1.5 hover:border-[#34C759] transition-colors">
                <span>🎵 Groove: {{ translateGrooveName(globalGroove) }}</span>
                <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <transition name="dropdown">
                <div v-if="activeDropdown === 'globalGroove'" class="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 space-y-1">
                  <div 
                    v-for="g in GROOVE_OPTIONS" 
                    :key="g" 
                    class="relative group/item"
                  >
                    <button 
                      @click="selectGlobalGroove(g)" 
                      class="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-[14px] flex flex-col font-semibold transition-all duration-150 relative"
                      :class="globalGroove === g ? 'bg-[#34C759]/10 text-[#34C759]' : 'text-gray-700'"
                    >
                      <div class="flex items-center justify-between w-full">
                        <span class="font-bold flex items-center gap-1.5">
                          <span>{{ GROOVE_DETAILS[g]?.icon || '🎵' }}</span>
                          <span>{{ translateGrooveName(g) }}</span>
                        </span>
                        <div class="flex items-center gap-1.5">
                          <span v-if="GROOVE_DETAILS[g]?.badge" class="text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded border border-gray-200/50">
                            {{ GROOVE_DETAILS[g].badge }}
                          </span>
                          <span v-if="globalGroove === g" class="text-[#34C759]">✓</span>
                          <span v-else-if="g !== 'Ninguno' && currentPlan !== 'PRO'" class="text-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wide">👑 PRO</span>
                        </div>
                      </div>
                    </button>
                    <!-- Hover/Tooltip card for Groove detail -->
                    <div class="pointer-events-none opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 absolute left-full top-0 ml-2 w-64 bg-slate-900 text-slate-100 rounded-xl shadow-2xl p-3 z-50 border border-slate-800 flex flex-col gap-1.5">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-black text-violet-400 uppercase tracking-wide">{{ translateGrooveName(g) }}</span>
                        <span class="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold">{{ GROOVE_DETAILS[g]?.subdivision }}</span>
                      </div>
                      <p class="text-[11px] text-slate-350 leading-normal">{{ GROOVE_DETAILS[g]?.description }}</p>
                      <div class="mt-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 font-mono text-[10px] leading-tight select-none">
                        <div class="text-slate-500 whitespace-pre">{{ GROOVE_DETAILS[g]?.previewHeader }}</div>
                        <div class="text-[#34C759] font-bold whitespace-pre mt-0.5">{{ GROOVE_DETAILS[g]?.previewLine }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
            </div>
          <div class="flex items-center gap-3">
            <!-- Segmented Control for Compact/Expanded mode (PRO only, Promo in FREE) -->
            <div v-if="currentPlan === 'PRO'" class="flex p-0.5 bg-gray-100 rounded-lg border border-gray-200 shadow-inner">
              <button 
                @click="viewMode = 'compact'" 
                :class="viewMode === 'compact' ? 'bg-white shadow-sm text-gray-800 font-bold' : 'text-gray-500 hover:text-gray-700 font-medium'" 
                class="px-3 py-1.5 text-[12px] rounded-md transition-all"
              >
                Mostrar repeticiones
              </button>
              <button 
                @click="viewMode = 'expanded'" 
                :class="viewMode === 'expanded' ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm font-bold animate-pulse' : 'text-gray-500 hover:text-gray-700 font-medium'" 
                class="px-3 py-1.5 text-[12px] rounded-md transition-all flex items-center gap-1"
              >
                ✨ Expandir compases
              </button>
            </div>
            
            <div v-else class="flex p-0.5 bg-gray-100/50 rounded-lg border border-gray-200 opacity-70 cursor-pointer" @click="upgradeReason = 'feature'; isUpgradeModalOpen = true">
              <button class="px-3 py-1.5 text-[12px] text-gray-400 font-bold" disabled>Mostrar repeticiones</button>
              <button class="px-3 py-1.5 text-[12px] text-gray-400 font-bold flex items-center gap-1" disabled>
                Expandir compases <span class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1 rounded font-black">PRO</span>
              </button>
            </div>
            <!-- Modo Selección Toggle -->
            <button 
              @click="toggleSelectionMode" 
              class="text-[14px] font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border"
              :class="isSelectionMode 
                ? (currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' : 'bg-[#34C759] text-white border-transparent shadow-sm') 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              {{ isSelectionMode ? 'Seleccionando...' : 'Seleccionar compases' }}
            </button>
            <!-- Ver lista de repeticiones -->
            <button 
              @click="isRepeatMenuOpen = true" 
              class="text-[14px] font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Ver lista
              <span v-if="repeats.length" class="bg-gray-100 text-gray-800 text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-black border border-gray-200">{{ repeats.length }}</span>
            </button>
            <!-- Ordenar compases -->
            <button 
              @click="currentPlan === 'PRO' ? (isOrderingModeActive = !isOrderingModeActive) : (upgradeReason = 'custom_layout', isUpgradeModalOpen = true)" 
              class="text-[14px] font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              :class="isOrderingModeActive 
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' 
                : 'bg-white hover:bg-gray-50 text-gray-700'"
            >
              <span>⚙️ Ordenar compases</span>
              <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black">PRO</span>
            </button>
          </div>
        </div>
        <!-- SUB-TOOLBAR PROMO/EXPLANATION CAPTION -->
        <div class="px-4 py-1.5 bg-gray-50 border-b border-gray-200/80 text-[12px] text-gray-500 flex items-center gap-1.5 select-none shrink-0">
          <span v-if="currentPlan === 'FREE'" class="flex items-center gap-1.5">
            <span class="w-2 h-2 bg-[#34C759] rounded-full animate-ping"></span>
            <span><strong>FREE:</strong> Usa repeticiones para optimizar tu estructura.</span>
          </span>
          <span v-else class="flex items-center gap-1.5">
            <span class="w-2 h-2 bg-violet-500 rounded-full animate-ping"></span>
            <span><strong>PRO:</strong> Expande tu música y visualízala completamente, sin límites ni repeticiones ocultas.</span>
          </span>
        </div>
        <!-- GRID AREA -->
        <main class="flex-1 overflow-y-auto px-2 py-6 md:p-8 relative" @click="closeDropdowns">
          <div class="w-full max-w-[1450px] mx-auto flex gap-2 md:gap-6 px-2 md:px-6">
            
            <!-- GLOBAL INDICATORS -->
            <div class="flex flex-col items-center pt-2 flex-shrink-0 select-none text-center min-w-[96px] md:min-w-[120px] gap-3">
              <!-- Interactive Key Signature Info Badge (Now above Time Signature) -->
              <button 
                @click="isKeyInfoOpen = true; isVerMasExpanded = false" 
                class="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-[#34C759] active:scale-[0.97] transition-all w-full text-center shadow-sm animate-scale-up"
                :class="{'hover:border-violet-500': currentPlan === 'PRO'}"
              >
                <span class="text-[10px] md:text-[11px] font-black text-gray-700 leading-tight uppercase tracking-wider block w-full truncate">
                  {{ translateNoteToSpanish(key) }} {{ currentScaleName }}
                </span>
                <span 
                  :class="keySignatureFormatted === 'Limpia' ? 'text-gray-400 bg-gray-200/80' : (currentPlan === 'PRO' ? 'text-violet-600 bg-violet-50 border border-violet-100/50' : 'text-[#34C759] bg-[#34C759]/10 border border-[#34C759]/20')" 
                  class="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black tracking-wide animate-pulse-subtle flex items-center justify-center gap-0.5 w-max mx-auto"
                >
                  {{ keySignatureFormatted }}
                </span>
              </button>
              <div class="flex flex-col items-center mt-1">
                <div class="text-4xl md:text-5xl font-serif font-bold leading-none text-gray-800">{{ timeSignature }}</div>
                <div class="text-4xl md:text-5xl font-serif font-bold leading-none -mt-1 text-gray-800">4</div>
              </div>
            </div>
            
            <!-- MEASURES SYSTEMS GRID -->
            <div class="flex-1 space-y-12">
              <!-- Groove Banner -->
              <div 
                v-if="globalGroove !== 'Ninguno'" 
                class="bg-gradient-to-r from-violet-50/90 to-indigo-50/90 border border-violet-100 rounded-2xl p-3 flex items-center justify-between text-xs text-violet-850 shadow-sm animate-scale-up"
              >
                <div class="flex items-center gap-3 flex-wrap">
                  <span class="flex items-center gap-1.5 font-bold">
                    <span>{{ GROOVE_DETAILS[globalGroove]?.icon || '🎵' }}</span>
                    <span>Groove Activo: {{ translateGrooveName(globalGroove) }}</span>
                  </span>
                  <span class="text-[9px] bg-violet-200/50 text-violet-750 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {{ GROOVE_DETAILS[globalGroove]?.subdivision }}
                  </span>
                  <span class="text-gray-300">|</span>
                  <div class="font-mono text-[10px] bg-slate-900 text-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-3 border border-slate-800">
                    <span class="text-slate-500">{{ GROOVE_DETAILS[globalGroove]?.previewHeader }}</span>
                    <span class="text-[#34C759] font-bold">{{ GROOVE_DETAILS[globalGroove]?.previewLine }}</span>
                  </div>
                </div>
                <div class="text-[11px] text-violet-600 font-medium italic hidden md:block pr-1">
                  "{{ GROOVE_DETAILS[globalGroove]?.description }}"
                </div>
              </div>
              <div 
                v-for="(system, sIdx) in systems" 
                :key="system.id"
                class="system-row gap-x-3 gap-y-10 w-full relative"
                :style="{ gridTemplateColumns: `repeat(${getSystemColumnCount(system, sIdx)}, minmax(0, 1fr))` }"
              >
                <template v-for="(measure, mIdx) in system.measures" :key="measure.id">
                  
                  <!-- Recuadro de nueva escala (Between measures, only in PRO) -->
                  <div 
                    v-if="currentPlan === 'PRO' && measure.keyChange"
                    class="flex flex-col items-center justify-center pt-2 flex-shrink-0 select-none text-center min-w-[96px] md:min-w-[120px] max-w-[140px] h-28 self-center animate-scale-up"
                  >
                    <button 
                      @click.stop="openKeyChangeInfo(measure)"
                      class="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/90 hover:bg-gray-100 hover:border-violet-500 active:scale-[0.97] transition-all w-full text-center shadow-sm"
                    >
                      <span class="text-[10px] md:text-[11px] font-black text-gray-700 leading-tight uppercase tracking-wider block w-full truncate">
                        {{ translateNoteToSpanish(measure.keyChange.key) }} {{ measure.keyChange.scaleType === 'major' ? 'Mayor' : 'Menor' }}
                      </span>
                      <span 
                        class="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black tracking-wide"
                        :class="getKeyAccidentalsStr(measure.keyChange.key, measure.keyChange.scaleType) === 'Limpia' ? 'text-gray-400 bg-gray-200/80' : 'text-violet-600 bg-violet-50 border border-violet-100/50'"
                      >
                        {{ getKeyAccidentalsStr(measure.keyChange.key, measure.keyChange.scaleType) }}
                      </span>
                    </button>
                  </div>
                  <!-- Measure Card -->
                  <div 
                    class="relative bg-white border-2 border-gray-300 rounded-lg flex overflow-visible h-28 shadow-sm transition-all hover:border-[#34C759] group"
                    :class="{
                      'border-l-[4px] border-l-black': getRepeatStart(measure.originalMeasureIndex), 
                      'border-r-[4px] border-r-black': getRepeatEnd(measure.originalMeasureIndex),
                      'border-[#a78bfa] hover:border-[#8b5cf6]': measure.isExpandedCopy,
                      'border-[#34C759] bg-[#34C759]/5': isSelectionMode && isMeasureSelected(measure.originalMeasureIndex) && currentPlan === 'FREE',
                      'border-violet-500 bg-violet-50/50 shadow-md shadow-violet-100': isSelectionMode && isMeasureSelected(measure.originalMeasureIndex) && currentPlan === 'PRO',
                      'md:col-span-2 lg:col-span-2': isMeasureDense(measure),
                      'z-40': activeRhythmSelector && activeRhythmSelector.measureIndex === measure.originalMeasureIndex
                    }"
                  >
                    <!-- Selection Mode Overlay -->
                    <div 
                      v-if="isSelectionMode"
                      @mousedown.prevent="startSelectionDrag(measure.originalMeasureIndex)"
                      @mouseenter="continueSelectionDrag(measure.originalMeasureIndex)"
                      @click.stop="toggleMeasureSelection(measure.originalMeasureIndex)"
                      class="absolute inset-0 z-30 cursor-pointer rounded-lg transition-all duration-200"
                      :class="[
                        isMeasureSelected(measure.originalMeasureIndex)
                          ? (currentPlan === 'PRO' ? 'bg-violet-500/10 hover:bg-violet-500/20' : 'bg-[#34C759]/10 hover:bg-[#34C759]/20')
                          : 'hover:bg-gray-100/50'
                      ]"
                    ></div>
                    <!-- CASILLA BRACKET (COMPACT MODE ONLY) -->
                    <div v-if="viewMode === 'compact' && getCasillaData(measure.displayedMeasureIndex)" class="absolute -top-7 left-0 right-0 h-6 pointer-events-none select-none flex flex-col justify-end z-20">
                      <div class="flex items-center text-[10px] font-black text-gray-700 px-1 leading-none mb-0.5">
                        <span v-if="getCasillaData(measure.displayedMeasureIndex).isStart" class="bg-white/95 px-1 rounded-sm shadow-sm border border-gray-200">
                          {{ getCasillaData(measure.displayedMeasureIndex).type === 1 ? `1. (x${getCasillaData(measure.displayedMeasureIndex).times})` : `2.` }}
                        </span>
                      </div>
                      <div class="h-1.5 border-t-2 border-gray-800"
                           :class="{
                             'border-l-2 rounded-tl-sm': getCasillaData(measure.displayedMeasureIndex).isStart,
                             'border-r-2 rounded-tr-sm': getCasillaData(measure.displayedMeasureIndex).isEnd
                           }">
                      </div>
                    </div>
                    <!-- SECTION LABEL (INSIDE CARD TO AVOID BRACKET CONFLICTS) -->
                    <div v-if="measure.sectionLabel" class="absolute top-1.5 left-2 bg-[#34C759] text-white px-1.5 py-0.5 text-[10px] font-black rounded z-10 shadow-sm uppercase tracking-wider">
                      {{ measure.sectionLabel }}
                    </div>
                    
                    <!-- REPEAT DOTS -->
                    <div v-if="getRepeatStart(measure.originalMeasureIndex)" class="absolute top-1/2 -translate-y-1/2 left-2 flex flex-col gap-1.5 z-10">
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                    </div>
                    <div v-if="getRepeatEnd(measure.originalMeasureIndex)" class="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-1.5 z-10">
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                      <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
                    </div>
                    <div v-if="getRepeatEnd(measure.originalMeasureIndex)" class="absolute -top-6 right-0 text-[12px] font-bold text-gray-700 z-10 bg-white px-1 border border-b-0 border-gray-300 rounded-t-md">
                      (x{{ getRepeatEnd(measure.originalMeasureIndex).times }})
                    </div>
                    
                    <!-- Key display on first measure only -->
                    <div v-if="measure.displayedMeasureIndex === 0" class="absolute top-1 right-2 text-[10px] font-black text-[#34C759]/50">
                      {{ key }}{{ scaleType === 'minor' ? 'm' : '' }}
                    </div>
                    <!-- Measure groove override indicator -->
                    <div 
                      v-if="measure.groove && measure.groove !== 'global'" 
                      class="absolute top-1.5 bg-violet-100 text-violet-750 border border-violet-200 px-1.5 py-0.5 text-[8px] font-black rounded z-10 uppercase tracking-wide"
                      :class="[
                        measure.sectionLabel ? 'left-14' : 'left-2'
                      ]"
                      title="Anulación de groove en este compás"
                    >
                      {{ measure.groove === 'neutral' ? 'Neutral' : 'Custom' }}
                    </div>
                    <!-- Harmonic Rhythm Indicators (♪, ♬, ↷, 3, 5) -->
                    <div 
                      v-if="getActiveMeasureRhythms(measure).length > 0" 
                      class="absolute top-1.5 bg-gray-100 text-gray-600 px-1.5 py-0.5 text-[9px] font-black rounded z-10 border border-gray-200 flex items-center gap-1"
                      :class="measure.displayedMeasureIndex === 0 ? 'right-12' : 'right-2'"
                      title="Ritmo Armónico Activo"
                    >
                      <span 
                        v-for="(symbol, sIdx) in getActiveMeasureRhythms(measure)" 
                        :key="sIdx"
                        class="text-[10px] leading-none"
                      >
                        {{ symbol }}
                      </span>
                    </div>
                    <!-- Measure Options Button (Hide in Expanded Mode) -->
                    <button 
                      v-if="viewMode === 'compact'"
                      @click.stop="openMeasureOptions(measure.originalMeasureIndex)"
                      class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-white text-gray-400 hover:text-[#34C759] hover:border-[#34C759] border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center text-xs z-20 shadow-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >⚙️</button>
                    
                    <!-- MEASURE INDEX & PROJECTION BADGE -->
                    <div class="absolute bottom-1 left-2 text-[10px] font-bold text-gray-300 pointer-events-none flex items-center gap-1.5">
                      <span>#{{ measure.displayedMeasureIndex + 1 }}</span>
                      <span v-if="measure.isExpandedCopy" class="text-violet-600 font-extrabold bg-violet-50 px-1 rounded-sm border border-violet-100 text-[9px] scale-90 origin-left">
                        Original {{ measure.originalMeasureIndex + 1 }} (Vta. {{ measure.displayPass }})
                      </span>
                    </div>
                    
                    <!-- BEATS -->
                    <div class="flex-1 flex z-0 relative ml-4 mr-4">
                      <!-- Center horizontal line -->
                      <div class="absolute top-1/2 left-0 right-0 h-px bg-gray-200 -translate-y-1/2 pointer-events-none z-0"></div>
                      <div 
                        v-for="(beat, bIdx) in measure.beats.slice(0, timeSignature)" 
                        :key="bIdx"
                        class="flex-1 flex h-full z-10 relative m-0.5"
                      >
                        <!-- Normal Beat -->
                        <button
                          v-if="getEffectiveRhythm(measure, beat, bIdx) === 'quarter'"
                          @click.stop="clickBeat(measure.originalMeasureIndex, bIdx, measure.displayedMeasureIndex)"
                          class="w-full h-full flex flex-col items-center justify-center active:bg-[#34C759]/10 hover:bg-[#34C759]/5 relative transition-colors rounded-lg group/beat"
                        >
                          <span :class="[getMeasureFontSizeClass(measure), 'text-gray-800 leading-none mb-1 group-hover/beat:scale-105 group-hover/beat:text-[#34C759] transition-transform']">
                            {{ beat.root ? formatDisplayChord(beat) : '' }}
                          </span>
                          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-gray-300 transform rotate-12 group-hover/beat:opacity-0" v-if="!beat.root"></div>
                          
                          <!-- Beat override icon -->
                          <span 
                            v-if="hasBeatRhythmOverride(measure, beat, bIdx)" 
                            class="text-[9px] font-black text-violet-600 absolute top-1 right-2 select-none"
                            title="Anulación de ritmo en este acorde"
                          >
                            {{ getSubdivisionIcon(beat.harmonicRhythm) }}
                          </span>
                          <!-- Quick Chord Popover for Normal Beat -->
                          <transition name="dropdown">
                            <div 
                              v-if="activeQuickChordPopover && activeQuickChordPopover.measureIndex === measure.originalMeasureIndex && activeQuickChordPopover.beatIndex === bIdx && activeQuickChordPopover.subdivisionIndex === undefined"
                              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 quick-popover-container text-white text-left font-sans cursor-default"
                              @click.stop
                            >
                              <!-- Popover Header -->
                              <div class="flex items-center justify-between">
                                <span class="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                  {{ translateNoteToSpanish(getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).key) }} {{ getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).scale === 'major' ? 'Mayor' : 'Menor' }}
                                </span>
                                <span class="text-[9px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                                  Pulso Entero
                                </span>
                              </div>
                              <!-- Chord Grade / Label Preview -->
                              <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                                <div class="flex flex-col">
                                  <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Acorde actual</span>
                                  <span class="text-sm font-black text-slate-200">
                                    {{ beat.root ? formatDisplayChord(beat) : 'Silencio' }}
                                  </span>
                                </div>
                                <!-- Triad/Tetrad toggle button -->
                                <div class="flex p-0.5 bg-slate-850 rounded-lg text-[10px] font-bold border border-slate-800/80 shadow-inner w-32 shrink-0">
                                  <button @click.stop="modalComplexity = 'triad'" :class="modalComplexity === 'triad' ? 'bg-slate-700 text-[#34C759]' : 'text-slate-400 hover:text-slate-300'" class="flex-1 py-1 rounded transition-all">Tríadas</button>
                                  <button @click="modalComplexity = 'tetrad'" :class="modalComplexity === 'tetrad' ? 'bg-slate-700 text-[#34C759]' : 'text-slate-400 hover:text-slate-300'" class="flex-1 py-1 rounded transition-all">Tétradas</button>
                                </div>
                              </div>
                              <!-- Quick Diatonic Grids -->
                              <div class="grid grid-cols-4 gap-1.5">
                                <button 
                                  v-for="chord in getDiatonicChords(getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).key, getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).scale, modalComplexity)" 
                                  :key="chord.degreeNumeral"
                                  @click.stop="selectQuickChord(chord)"
                                  class="bg-slate-850 hover:bg-slate-800 border border-slate-800/50 rounded-xl py-2 flex flex-col items-center justify-center transition-all active:scale-95 text-center group/chord"
                                >
                                  <span class="text-[8px] text-slate-500 font-black uppercase tracking-widest group-hover/chord:text-violet-400">{{ chord.degreeNumeral }}</span>
                                  <span class="text-[12px] font-black text-slate-100 group-hover/chord:text-[#34C759]">{{ chord.label }}</span>
                                </button>
                              </div>
                              <!-- Rhythm Figure row -->
                              <div class="space-y-1 border-t border-slate-800/60 pt-2">
                                <span class="block text-[8px] text-slate-500 font-extrabold uppercase tracking-wider">Figura Rítmica del Pulso</span>
                                <div class="flex bg-slate-850 rounded-lg p-0.5 border border-slate-800/80 justify-between items-center text-xs">
                                  <button 
                                    v-for="fig in RHYTHM_FIGURES" 
                                    :key="fig.value"
                                    @click.stop="changeQuickRhythm(fig.value)"
                                    class="flex-1 py-1 rounded text-center transition-all font-bold"
                                    :class="getEffectiveRhythm(measure, beat, bIdx) === fig.value ? 'bg-[#34C759]/20 text-[#34C759]' : 'text-slate-400 hover:text-slate-200'"
                                    :title="fig.label"
                                  >
                                    {{ fig.icon }}
                                  </button>
                                </div>
                              </div>
                              <!-- Footer Buttons -->
                              <div class="flex gap-2 border-t border-slate-800/60 pt-2 shrink-0">
                                <button 
                                  @click.stop="deleteQuickChord"
                                  class="flex-1 bg-red-950/40 hover:bg-red-950/70 border border-red-900/30 text-red-400 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <span>🗑️</span> Borrar / Vacío
                                </button>
                                <button 
                                  @click.stop="openAdvancedDetails"
                                  class="flex-1 bg-violet-950/40 hover:bg-violet-950/70 border border-violet-900/30 text-violet-300 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span>👑 Det. PRO</span>
                                </button>
                              </div>
                            </div>
                          </transition>
                        </button>
                        <!-- Subdivided Beat -->
                        <div 
                          v-else
                          class="w-full h-full flex flex-col border border-gray-200 rounded-lg overflow-visible bg-white relative shadow-sm"
                        >
                          <!-- SVG Rhythmic Beam Display with Click to Edit Rhythm -->
                          <div 
                            @click.stop="openRhythmSelector(measure.originalMeasureIndex, bIdx)"
                            class="h-6 w-full bg-gray-50/70 hover:bg-[#34C759]/10 border-b border-gray-100 flex items-center justify-center select-none relative group/rhythm transition-colors outline-none cursor-pointer shrink-0"
                            title="Cambiar figura rítmica del pulso"
                          >
                            <svg class="h-4 w-full text-[#34C759]" viewBox="0 0 100 24" preserveAspectRatio="none">
                              <!-- eighth -->
                              <template v-if="getEffectiveRhythm(measure, beat, bIdx) === 'eighth'">
                                <circle cx="25" cy="17" r="2.5" fill="currentColor"/>
                                <circle cx="75" cy="17" r="2.5" fill="currentColor"/>
                                <line x1="25" y1="17" x2="25" y2="5" stroke="currentColor" stroke-width="1.5"/>
                                <line x1="75" y1="17" x2="75" y2="5" stroke="currentColor" stroke-width="1.5"/>
                                <line x1="25" y1="5" x2="75" y2="5" stroke="currentColor" stroke-width="2.5"/>
                              </template>
                              <!-- offbeat -->
                              <template v-else-if="getEffectiveRhythm(measure, beat, bIdx) === 'offbeat'">
                                <text x="25" y="16" font-size="12" text-anchor="middle" fill="#9CA3AF" class="font-serif">𝄾</text>
                                <circle cx="75" cy="17" r="2.5" fill="currentColor"/>
                                <line x1="75" y1="17" x2="75" y2="5" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M 75 5 Q 82 9 80 15" stroke="currentColor" stroke-width="1.5" fill="none"/>
                              </template>
                              <!-- sixteenth -->
                              <template v-else-if="getEffectiveRhythm(measure, beat, bIdx) === 'sixteenth'">
                                <circle cx="12.5" cy="17" r="2" fill="currentColor"/>
                                <circle cx="37.5" cy="17" r="2" fill="currentColor"/>
                                <circle cx="62.5" cy="17" r="2" fill="currentColor"/>
                                <circle cx="87.5" cy="17" r="2" fill="currentColor"/>
                                <line x1="12.5" y1="17" x2="12.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
                                <line x1="37.5" y1="17" x2="37.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
                                <line x1="62.5" y1="17" x2="62.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
                                <line x1="87.5" y1="17" x2="87.5" y2="5" stroke="currentColor" stroke-width="1.2"/>
                                <line x1="12.5" y1="5" x2="87.5" y2="5" stroke="currentColor" stroke-width="2"/>
                                <line x1="12.5" y1="8.5" x2="87.5" y2="8.5" stroke="currentColor" stroke-width="2"/>
                              </template>
                              <!-- triplet -->
                              <template v-else-if="getEffectiveRhythm(measure, beat, bIdx) === 'triplet'">
                                <circle cx="16.6" cy="17" r="2.2" fill="currentColor"/>
                                <circle cx="50" cy="17" r="2.2" fill="currentColor"/>
                                <circle cx="83.3" cy="17" r="2.2" fill="currentColor"/>
                                <line x1="16.6" y1="17" x2="16.6" y2="6" stroke="currentColor" stroke-width="1.3"/>
                                <line x1="50" y1="17" x2="50" y2="6" stroke="currentColor" stroke-width="1.3"/>
                                <line x1="83.3" y1="17" x2="83.3" y2="6" stroke="currentColor" stroke-width="1.3"/>
                                <line x1="16.6" y1="6" x2="83.3" y2="6" stroke="currentColor" stroke-width="2"/>
                                <text x="50" y="5" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">3</text>
                              </template>
                              <!-- quintuplet -->
                              <template v-else-if="getEffectiveRhythm(measure, beat, bIdx) === 'quintuplet'">
                                <circle cx="10" cy="17" r="1.8" fill="currentColor"/>
                                <circle cx="30" cy="17" r="1.8" fill="currentColor"/>
                                <circle cx="50" cy="17" r="1.8" fill="currentColor"/>
                                <circle cx="70" cy="17" r="1.8" fill="currentColor"/>
                                <circle cx="90" cy="17" r="1.8" fill="currentColor"/>
                                <line x1="10" y1="17" x2="10" y2="7" stroke="currentColor" stroke-width="1"/>
                                <line x1="30" y1="17" x2="30" y2="7" stroke="currentColor" stroke-width="1"/>
                                <line x1="50" y1="17" x2="50" y2="7" stroke="currentColor" stroke-width="1"/>
                                <line x1="70" y1="17" x2="70" y2="7" stroke="currentColor" stroke-width="1"/>
                                <line x1="90" y1="17" x2="90" y2="7" stroke="currentColor" stroke-width="1"/>
                                <line x1="10" y1="7" x2="90" y2="7" stroke="currentColor" stroke-width="1.8"/>
                                <line x1="10" y1="10" x2="90" y2="10" stroke="currentColor" stroke-width="1.8"/>
                                <text x="50" y="6" font-size="6" font-weight="950" text-anchor="middle" fill="currentColor" class="font-sans">5</text>
                              </template>
                            </svg>
                            <span class="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[#34C759]/75 group-hover/rhythm:text-[#34C759] group-hover/rhythm:scale-110 transition-all font-bold">✏️</span>
                            <!-- Rhythm Selector Popover -->
                            <transition name="dropdown">
                              <div 
                                v-if="activeRhythmSelector && activeRhythmSelector.measureIndex === measure.originalMeasureIndex && activeRhythmSelector.beatIndex === bIdx"
                                class="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-1 rhythm-popover-container text-white text-left font-sans cursor-default"
                                @click.stop
                              >
                                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 text-center font-sans">Figura Rítmica</div>
                                <button 
                                  v-for="fig in RHYTHM_FIGURES" 
                                  :key="fig.value"
                                  @click.stop="selectRhythmFigure(fig.value)"
                                  class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                                  :class="getEffectiveRhythm(measure, beat, bIdx) === fig.value ? 'bg-[#34C759]/20 text-[#34C759]' : 'text-slate-200'"
                                >
                                  <span class="flex items-center gap-2">
                                    <span class="text-sm font-mono">{{ fig.icon }}</span>
                                    <span>{{ fig.label }}</span>
                                  </span>
                                  <span v-if="fig.isPro && currentPlan !== 'PRO'" class="text-[8px] bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wide">👑 PRO</span>
                                  <span v-else-if="getEffectiveRhythm(measure, beat, bIdx) === fig.value" class="text-[#34C759]">✓</span>
                                </button>
                              </div>
                            </transition>
                          </div>
                          <!-- Subdivided Slots -->
                          <div class="flex-1 flex divide-x divide-gray-200">
                            <button
                              v-for="(sub, subIdx) in getBeatSlots(measure, beat, bIdx)"
                              :key="subIdx"
                              :disabled="getEffectiveRhythm(measure, beat, bIdx) === 'offbeat' && subIdx === 0"
                              @click.stop="clickBeat(measure.originalMeasureIndex, bIdx, measure.displayedMeasureIndex, subIdx)"
                              class="flex-1 h-full flex flex-col items-center justify-center relative transition-colors"
                              :class="[
                                getEffectiveRhythm(measure, beat, bIdx) === 'offbeat' && subIdx === 0 
                                  ? 'bg-gray-100 cursor-not-allowed text-gray-450' 
                                  : 'active:bg-[#34C759]/10 hover:bg-[#34C759]/5 text-gray-800'
                              ]"
                            >
                              <!-- Mini override rhythm indicator over chord -->
                              <span 
                                v-if="hasBeatRhythmOverride(measure, beat, bIdx) && !(getEffectiveRhythm(measure, beat, bIdx) === 'offbeat' && subIdx === 0)"
                                class="text-[9px] font-black text-violet-600 leading-none scale-75 select-none absolute top-1"
                                title="Anulación de ritmo en este acorde"
                              >
                                {{ getSubdivisionIcon(beat.harmonicRhythm) }}
                              </span>
                              <!-- Silence indicator for offbeat (contratiempo) or empty subdivisions -->
                              <div 
                                v-if="getEffectiveRhythm(measure, beat, bIdx) === 'offbeat' && subIdx === 0" 
                                class="flex flex-col items-center justify-center pt-1"
                              >
                                <span class="text-[9px] font-bold text-gray-400 select-none">𝄾</span>
                                <span class="text-[7px] font-black text-gray-300 uppercase tracking-tight scale-90 mt-0.5">Silencio</span>
                              </div>
                              <span 
                                v-else
                                :class="[
                                  getSubdivisionFontSizeClass(getBeatSlots(measure, beat, bIdx).length),
                                  'leading-none font-bold text-center mt-2'
                                ]"
                              >
                                {{ sub.root ? formatDisplayChord(sub) : '𝄾' }}
                              </span>
                              <!-- Quick Chord Popover for Subdivided Slot -->
                              <transition name="dropdown">
                                <div 
                                  v-if="activeQuickChordPopover && activeQuickChordPopover.measureIndex === measure.originalMeasureIndex && activeQuickChordPopover.beatIndex === bIdx && activeQuickChordPopover.subdivisionIndex === subIdx"
                                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 quick-popover-container text-white text-left font-sans cursor-default"
                                  @click.stop
                                >
                                  <!-- Popover Header -->
                                  <div class="flex items-center justify-between">
                                    <span class="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                      {{ translateNoteToSpanish(getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).key) }} {{ getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).scale === 'major' ? 'Mayor' : 'Menor' }}
                                    </span>
                                    <span class="text-[9px] bg-slate-800 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                                      Subdiv. {{ subIdx + 1 }}
                                    </span>
                                  </div>
                                  <!-- Chord Grade / Label Preview -->
                                  <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                                    <div class="flex flex-col">
                                      <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Acorde actual</span>
                                      <span class="text-sm font-black text-slate-200">
                                        {{ sub.root ? formatDisplayChord(sub) : 'Silencio' }}
                                      </span>
                                    </div>
                                    <!-- Triad/Tetrad toggle button -->
                                    <div class="flex p-0.5 bg-slate-850 rounded-lg text-[10px] font-bold border border-slate-800/80 shadow-inner w-32 shrink-0">
                                      <button @click.stop="modalComplexity = 'triad'" :class="modalComplexity === 'triad' ? 'bg-slate-700 text-[#34C759]' : 'text-slate-400 hover:text-slate-350'" class="flex-1 py-1 rounded transition-all">Tríadas</button>
                                      <button @click="modalComplexity = 'tetrad'" :class="modalComplexity === 'tetrad' ? 'bg-slate-700 text-[#34C759]' : 'text-slate-400 hover:text-slate-350'" class="flex-1 py-1 rounded transition-all">Tétradas</button>
                                    </div>
                                  </div>
                                  <!-- Quick Diatonic Grids -->
                                  <div class="grid grid-cols-4 gap-1.5">
                                    <button 
                                      v-for="chord in getDiatonicChords(getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).key, getBeatKeyAndScale(measure.originalMeasureIndex, bIdx).scale, modalComplexity)" 
                                      :key="chord.degreeNumeral"
                                      @click.stop="selectQuickChord(chord)"
                                      class="bg-slate-850 hover:bg-slate-800 border border-slate-800/50 rounded-xl py-2 flex flex-col items-center justify-center transition-all active:scale-95 text-center group/chord"
                                    >
                                      <span class="text-[8px] text-slate-500 font-black uppercase tracking-widest group-hover/chord:text-violet-400">{{ chord.degreeNumeral }}</span>
                                      <span class="text-[12px] font-black text-slate-100 group-hover/chord:text-[#34C759]">{{ chord.label }}</span>
                                    </button>
                                  </div>
                                  <!-- Rhythm Figure row -->
                                  <div class="space-y-1 border-t border-slate-800/60 pt-2">
                                    <span class="block text-[8px] text-slate-500 font-extrabold uppercase tracking-wider">Figura Rítmica del Pulso</span>
                                    <div class="flex bg-slate-850 rounded-lg p-0.5 border border-slate-800/80 justify-between items-center text-xs">
                                      <button 
                                        v-for="fig in RHYTHM_FIGURES" 
                                        :key="fig.value"
                                        @click.stop="changeQuickRhythm(fig.value)"
                                        class="flex-1 py-1 rounded text-center transition-all font-bold"
                                        :class="getEffectiveRhythm(measure, beat, bIdx) === fig.value ? 'bg-[#34C759]/20 text-[#34C759]' : 'text-slate-400 hover:text-slate-200'"
                                        :title="fig.label"
                                      >
                                        {{ fig.icon }}
                                      </button>
                                    </div>
                                  </div>
                                  <!-- Footer Buttons -->
                                  <div class="flex gap-2 border-t border-slate-800/60 pt-2 shrink-0">
                                    <button 
                                      @click.stop="deleteQuickChord"
                                      class="flex-1 bg-red-950/40 hover:bg-red-950/70 border border-red-900/30 text-red-400 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                      <span>🗑️</span> Borrar / Vacío
                                    </button>
                                    <button 
                                      @click.stop="openAdvancedDetails"
                                      class="flex-1 bg-violet-950/40 hover:bg-violet-950/70 border border-violet-900/30 text-violet-300 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                                    >
                                      <span>👑 Det. PRO</span>
                                    </button>
                                  </div>
                                </div>
                              </transition>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- Bulb icon for suggestions (💡 Ampolleta de ideas) -->
                    <button 
                      v-if="!isOrderingModeActive && system.measures.length === 4 && mIdx === 3 && getSuggestionsForSystemLocal(system).length > 0"
                      @click.stop="openSystemSuggestions(system)"
                      class="absolute -right-5 top-1/2 -translate-y-1/2 bg-amber-50 border border-amber-200 rounded-full w-9 h-9 flex items-center justify-center text-lg z-30 shadow-lg shadow-amber-100 hover:bg-amber-100 active:scale-95 transition-all animate-pulse"
                      title="💡 Sugerencias disponibles para este sistema"
                    >💡</button>
                    <!-- System Break Toggle Button (Ordering Mode only, PRO only) -->
                    <button
                      v-if="isOrderingModeActive"
                      @click.stop="toggleSystemBreak(measure.originalMeasureIndex)"
                      class="absolute -right-5 top-1/2 -translate-y-1/2 rounded-full w-9 h-9 flex items-center justify-center text-sm z-30 shadow-lg transition-all border font-bold"
                      :class="measure.systemBreak 
                        ? 'bg-violet-600 border-violet-700 text-white hover:bg-violet-750' 
                        : 'bg-white border-gray-200 text-gray-400 hover:text-gray-650 hover:border-gray-300'"
                      title="Insertar/Eliminar Salto de Sistema después de este compás"
                    >
                      ↵
                    </button>
                  </div>
                </template>
                
                <!-- ADD MEASURE BUTTON (Hide in Expanded Mode) -->
                <button 
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && (currentPlan === 'PRO' || measures.length < 20)"
                  @click="addMeasure"
                  class="h-28 border-2 border-dashed border-gray-300 bg-white/50 rounded-lg text-gray-400 flex items-center justify-center hover:bg-[#34C759]/5 hover:border-[#34C759] hover:text-[#34C759] transition-all group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                </button>
                <!-- Promocional de compases cuando se llega al límite en versión FREE -->
                <button 
                  v-if="viewMode === 'compact' && sIdx === systems.length - 1 && currentPlan === 'FREE' && measures.length >= 20"
                  @click="upgradeReason = 'limit'; isUpgradeModalOpen = true"
                  class="h-28 border-2 border-dashed border-violet-300 bg-violet-50/20 rounded-lg text-violet-500 flex flex-col gap-1 items-center justify-center hover:bg-violet-50/50 hover:border-violet-400 hover:text-violet-600 transition-all group px-4 text-center cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 group-hover:scale-110 transition-transform mb-0.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span class="text-xs font-black">20 compases max en FREE</span>
                  <span class="text-[10px] text-violet-600 font-bold">🚀 Pasar a PRO para ilimitados</span>
                </button>
              </div>
            </div>
          </div>
        </main>
        <!-- Floating Bottom Action Bar for Custom System Layouts (Ordering Mode) -->
        <transition name="fade">
          <div 
            v-if="isOrderingModeActive && currentPlan === 'PRO'" 
            class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl bg-white/90 backdrop-blur-xl border border-violet-200 rounded-2xl shadow-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all animate-scale-up"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-violet-100 text-violet-750 flex items-center justify-center font-bold text-lg">
                ⚙️
              </div>
              <div class="text-left">
                <span class="block text-[11px] font-black text-violet-600 uppercase tracking-wider">Modo Ordenar Compases</span>
                <span class="text-xs text-gray-500 leading-tight">Haz clic en <strong>↵</strong> al final de cualquier compás para forzar un salto de fila.</span>
              </div>
            </div>
            <!-- Default columns layout select -->
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-gray-600">Por fila predeterminado:</span>
              <div class="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                <button 
                  v-for="num in [2, 3, 4, 5, 6]" 
                  :key="num"
                  @click="setMeasuresPerSystem(num)"
                  class="px-2.5 py-1 text-xs font-black rounded-md transition-all"
                  :class="defaultMeasuresPerSystem === num ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                >
                  {{ num }}
                </button>
              </div>
            </div>
            <button 
              @click="isOrderingModeActive = false" 
              class="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-xl shadow-lg shadow-violet-200 active:scale-95 transition-all w-full md:w-auto"
            >
              Listo
            </button>
          </div>
        </transition>
        <!-- Floating Bottom Action Bar for Range Selection -->
        <transition name="fade">
          <div 
            v-if="isSelectionMode && selectedRangeStart !== null && selectedRangeEnd !== null" 
            class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl bg-white/85 backdrop-blur-xl border border-gray-200/80 rounded-2xl shadow-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all"
            :class="currentPlan === 'PRO' ? 'border-violet-200 shadow-violet-100/50' : 'border-[#34C759]/20 shadow-green-100/50'"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                   :class="currentPlan === 'PRO' ? 'bg-violet-100 text-violet-700' : 'bg-[#34C759]/10 text-[#34C759]'">
                <span class="text-sm">#</span>
              </div>
              <div class="text-left">
                <span class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Compases Seleccionados</span>
                <span class="text-sm font-extrabold text-gray-800">
                  Desde compás {{ minSelectedMeasure }} al {{ maxSelectedMeasure }}
                  <span class="text-gray-400 font-medium">({{ maxSelectedMeasure - minSelectedMeasure + 1 }} {{ (maxSelectedMeasure - minSelectedMeasure + 1) === 1 ? 'compás' : 'compases' }})</span>
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button 
                @click="openTimesSelector" 
                class="flex-1 sm:flex-initial px-4 py-2 text-[14px] font-bold text-white rounded-xl transition-all shadow-md active:scale-95"
                :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-200/50' : 'bg-[#34C759] shadow-[#34C759]/20'"
              >
                REPETIR
              </button>
              
              <button 
                v-if="isCasillasAvailable"
                @click="convertRepeatToCasilla" 
                class="flex-1 sm:flex-initial px-4 py-2 text-[14px] font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl transition-all shadow-md shadow-violet-200/50 active:scale-95 flex items-center justify-center gap-1"
              >
                👑 CASILLAS
              </button>
              
              <button 
                @click="clearSelection" 
                class="px-4 py-2 text-[14px] font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all active:scale-95"
              >
                Limpiar
              </button>
            </div>
          </div>
        </transition>
        <!-- Floating Instruction Tip (when in selection mode but nothing selected yet) -->
        <transition name="fade">
          <div 
            v-if="isSelectionMode && (selectedRangeStart === null || selectedRangeEnd === null)" 
            class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 select-none"
          >
            <span class="w-2 h-2 bg-[#34C759] rounded-full animate-ping" :class="{'bg-violet-400': currentPlan === 'PRO'}"></span>
            <span>Haz clic/toca o arrastra sobre los compases para seleccionar un rango</span>
            <button @click="isSelectionMode = false" class="ml-2 text-gray-400 hover:text-white font-black">X</button>
          </div>
        </transition>
        <!-- Times Selector Modal (Inside Editor to align correctly) -->
        <transition name="fade">
          <div v-if="isTimesModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div class="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 text-center animate-scale-up">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md"
                   :class="currentPlan === 'PRO' ? 'bg-violet-100 text-violet-700' : 'bg-[#34C759]/10 text-[#34C759]'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              
              <h3 class="text-lg font-extrabold text-gray-900 mb-1">Configurar Repetición</h3>
              <p class="text-xs text-gray-500 mb-5">
                ¿Cuántas veces quieres repetir el rango de los compases {{ minSelectedMeasure }} al {{ maxSelectedMeasure }}?
              </p>
              <!-- Quick access options -->
              <div class="grid grid-cols-4 gap-2 mb-4">
                <button 
                  v-for="t in [2, 3, 4, 8]" 
                  :key="t"
                  @click="confirmTimes(t)"
                  class="py-2.5 rounded-xl font-extrabold text-[15px] border transition-all active:scale-95"
                  :class="customTimes === t
                    ? (currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' : 'bg-[#34C759] text-white border-transparent shadow-sm')
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'"
                >
                  x{{ t }}
                </button>
              </div>
              <!-- Custom times input -->
              <div class="bg-gray-50 p-3 rounded-2xl border border-gray-200/50 mb-6 flex items-center justify-between">
                <span class="text-sm font-bold text-gray-500">Personalizado</span>
                <div class="flex items-center gap-2">
                  <button 
                    @click="customTimes = Math.max(2, customTimes - 1)" 
                    class="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center font-bold active:bg-gray-50"
                  >-</button>
                  <input 
                    type="number" 
                    v-model.number="customTimes" 
                    min="2" 
                    class="w-12 text-center font-extrabold text-lg text-gray-800 bg-transparent focus:outline-none"
                  />
                  <button 
                    @click="customTimes++" 
                    class="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center font-bold active:bg-gray-50"
                  >+</button>
                </div>
              </div>
              <div class="flex gap-2">
                <button 
                  @click="isTimesModalOpen = false" 
                  class="flex-1 py-3 text-gray-500 hover:text-gray-700 bg-gray-100 font-bold rounded-xl text-sm transition-all"
                >
                  Cancelar
                </button>
                <button 
                  @click="confirmTimes(customTimes)" 
                  class="flex-1 py-3 text-white font-extrabold rounded-xl text-sm transition-all shadow-md active:scale-95"
                  :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-200/50' : 'bg-[#34C759] shadow-[#34C759]/20'"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
    <!-- ==================== iOS BOTTOM SHEETS ==================== -->
    <transition name="fade">
      <div v-if="isAnyModalOpen" class="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm transition-all" :class="{'pointer-events-none': !isAnyModalOpen}">
        
        <div class="absolute inset-0" @click="isRepeatMenuOpen=false; isMeasureOptionsOpen=false; isModalOpen=false; isSystemSuggestionsModalOpen=false"></div>
        
        <!-- REPEATS MODAL -->
        <div v-if="isRepeatMenuOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe max-h-[90vh] flex flex-col z-10 md:w-[500px] md:mx-auto md:rounded-3xl md:mb-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 shadow-sm rounded-t-[16px] md:rounded-t-3xl shrink-0">
            <h3 class="text-[17px] font-bold text-gray-900 text-center w-full absolute left-0 pointer-events-none">Lista de Repeticiones</h3>
            <button @click="isRepeatMenuOpen = false" class="text-[#34C759] text-[17px] font-bold ml-auto relative z-10 bg-[#34C759]/10 px-3 py-1 rounded-full hover:bg-[#34C759]/20 transition-colors">Hecho</button>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto">
            <div v-if="repeats.length > 0" class="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div v-for="(r, i) in repeats" :key="r.id" class="flex items-center justify-between p-4" :class="{'border-b border-gray-100': i !== repeats.length - 1}">
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[16px] font-semibold text-gray-800">
                      Compás <span class="text-[#34C759] font-bold">{{ r.startMeasure }}</span> al <span class="text-[#34C759] font-bold">{{ r.endMeasure }}</span> 
                      <span class="text-gray-500 font-medium ml-1">(x{{ r.times }})</span>
                    </span>
                    <span v-if="r.type === 'casilla'" class="bg-violet-100 text-violet-700 text-[10px] px-1.5 py-0.5 rounded font-black uppercase">Casillas</span>
                  </div>
                  <div v-if="r.type === 'casilla'" class="text-xs text-gray-400 mt-0.5">
                    Casilla 1: {{ r.casilla1Start }}-{{ r.endMeasure }} | Casilla 2: {{ r.casilla2Start }}-{{ r.casilla2End }}
                  </div>
                </div>
                
                <button @click="removeRepeat(r.id)" class="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
              </div>
            </div>
            <!-- Empty State -->
            <div v-else class="text-center py-12 px-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl animate-bounce">
                🔁
              </div>
              <h4 class="text-base font-extrabold text-gray-800 mb-1">No hay repeticiones activas</h4>
              <p class="text-sm text-gray-500 max-w-xs mx-auto mb-6">
                Usa la función de selección para crear repeticiones y casillas interactivamente en la partitura.
              </p>
              <button 
                @click="isRepeatMenuOpen = false; isSelectionMode = true" 
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-[#34C759] text-white text-sm font-bold rounded-xl shadow-md hover:bg-[#248A3D] transition-colors"
              >
                Seleccionar compases
              </button>
            </div>
          </div>
        </div>
        <!-- MEASURE OPTIONS / KEY CHANGE MODAL -->
        <div v-if="isMeasureOptionsOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe z-10 flex flex-col max-h-[90vh]">
          
          <!-- MAIN MENU -->
          <template v-if="!isKeyChangeSubMenuOpen">
            <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 rounded-t-[16px] shrink-0">
              <button @click="isMeasureOptionsOpen = false" class="text-gray-500 text-[17px] font-medium">Cancelar</button>
              <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">Compás {{ selectedMeasureIndex + 1 }}</h3>
              <button @click="saveMeasureOptions" class="text-[#34C759] text-[17px] font-bold">Guardar</button>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-6">
              <!-- Section dropdown -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative dropdown-container">
                <button @click="toggleDropdown('sectionLabel')" class="w-full flex items-center justify-between p-4 active:bg-gray-50 rounded-2xl">
                  <span class="text-[17px] font-semibold text-gray-800">Sección</span>
                  <span class="text-[17px] text-[#34C759] font-bold flex items-center gap-1">
                    {{ tempSectionLabel }} 
                    <svg class="w-4 h-4" :class="{'rotate-180': activeDropdown === 'sectionLabel'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </span>
                </button>
                
                <transition name="dropdown">
                  <div v-if="activeDropdown === 'sectionLabel'" class="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 z-40">
                    <button v-for="s in SECTIONS" :key="s" @click="tempSectionLabel = s; activeDropdown = null" class="w-full text-left p-4 border-b border-gray-100 font-semibold text-[16px] hover:bg-[#34C759]/5" :class="tempSectionLabel === s ? 'text-[#34C759]' : 'text-gray-700'">{{ s }}</button>
                  </div>
                </transition>
              </div>
              
              <!-- Groove del Compás -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                <span class="block text-xs font-bold text-gray-400 uppercase tracking-wider">🥁 Ritmo del Compás</span>
                
                <div class="flex flex-col gap-2">
                  <!-- Usar groove global -->
                  <button 
                    @click="tempMeasureGroove = 'global'"
                    class="w-full flex items-center justify-between p-3 rounded-xl border text-left active:scale-98 transition-all hover:bg-gray-50 bg-white"
                    :class="tempMeasureGroove === 'global' ? 'border-[#34C759] bg-[#34C759]/5' : 'border-gray-200'"
                  >
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Usar Groove Global</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Sigue el patrón de la canción: <strong class="text-violet-650">{{ translateGrooveName(globalGroove) }}</strong></span>
                    </div>
                    <div class="w-5 h-5 rounded-full border flex items-center justify-center" :class="tempMeasureGroove === 'global' ? 'border-[#34C759] bg-[#34C759]' : 'border-gray-300'">
                      <div v-if="tempMeasureGroove === 'global'" class="w-2.5 h-2.5 rounded-full bg-white"></div>
                    </div>
                  </button>
                  <!-- Neutral -->
                  <button 
                    @click="tempMeasureGroove = 'neutral'"
                    class="w-full flex items-center justify-between p-3 rounded-xl border text-left active:scale-98 transition-all hover:bg-gray-550 bg-white"
                    :class="tempMeasureGroove === 'neutral' ? 'border-[#34C759] bg-[#34C759]/5' : 'border-gray-200'"
                  >
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Neutral (sin groove)</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Fuerza el compás a su comportamiento neutral (negras normales ♩)</span>
                    </div>
                    <div class="w-5 h-5 rounded-full border flex items-center justify-center" :class="tempMeasureGroove === 'neutral' ? 'border-[#34C759] bg-[#34C759]' : 'border-gray-300'">
                      <div v-if="tempMeasureGroove === 'neutral'" class="w-2.5 h-2.5 rounded-full bg-white"></div>
                    </div>
                  </button>
                  <!-- Personalizado (Only if has overrides or already custom) -->
                  <button 
                    v-if="tempMeasureGroove === 'custom'"
                    disabled
                    class="w-full flex items-center justify-between p-3 rounded-xl border text-left bg-gray-50 border-gray-200 cursor-not-allowed opacity-80"
                  >
                    <div>
                      <span class="block text-[15px] font-bold text-gray-800">Personalizado</span>
                      <span class="block text-[11px] text-gray-400 mt-0.5">Este compás contiene variaciones manuales hechas a nivel de acorde.</span>
                    </div>
                    <div class="w-5 h-5 rounded-full border border-violet-500 bg-violet-500 flex items-center justify-center">
                      <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
                    </div>
                  </button>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                <button @click="isMeasureOptionsOpen = false; isSelectionMode = true; clearSelection()" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">🔁</span>
                    <div>
                      <span class="block text-[16px] font-bold text-gray-800">Repetir compases (Rango)</span>
                      <span class="block text-xs text-gray-400 mt-0.5">Seleccionar varios compases para repetir</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
                
                <button @click="isMeasureOptionsOpen = false; isSelectionMode = true; clearSelection()" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">🔢</span>
                    <div>
                      <span class="block text-[16px] font-bold text-gray-800">Crear Casillas (Rango)</span>
                      <span class="block text-xs text-gray-400 mt-0.5">Casillas de 1ra y 2da vuelta (PRO)</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <button @click="startKeyChangeSetup" class="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">🔑</span>
                    <div>
                      <span class="block text-[16px] font-bold text-gray-800 flex items-center gap-2">
                        Nueva tonalidad
                        <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                      </span>
                      <span class="block text-xs text-gray-400 mt-0.5">Modulación a partir de este compás</span>
                    </div>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>
            </div>
          </template>
          
          <!-- KEY CHANGE SETUP SUB-MENU -->
          <template v-else-if="isKeyChangeSubMenuOpen">
            <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 rounded-t-[16px] shrink-0">
              <button @click="keyChangeStep === 2 ? keyChangeStep = 1 : isKeyChangeSubMenuOpen = false" class="text-gray-500 text-[17px] font-medium">Atrás</button>
              <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none">Nueva Tonalidad</h3>
              <button v-if="keyChangeStep === 2" @click="saveKeyChange" class="text-violet-650 text-[17px] font-bold">Aplicar</button>
              <div v-else class="w-12"></div>
            </div>
            
            <div class="p-6 overflow-y-auto space-y-6">
              <!-- Step 1: "¿Desde qué acorde?" -->
              <div v-if="keyChangeStep === 1" class="space-y-4">
                <div>
                  <h4 class="text-base font-extrabold text-gray-800">¿Desde qué acorde quieres cambiar?</h4>
                  <p class="text-xs text-gray-500 mt-1 font-medium">Selecciona el pulso en el compás {{ selectedMeasureIndex + 1 }} para iniciar la modulación:</p>
                </div>
                
                <div class="space-y-2">
                  <button 
                    v-for="(beat, idx) in (measures[selectedMeasureIndex] ? measures[selectedMeasureIndex].beats.slice(0, timeSignature) : [])"
                    :key="idx"
                    @click="tempKeyChangeBeatIndex = idx; keyChangeStep = 2"
                    class="w-full flex items-center justify-between p-4 rounded-xl border text-left active:scale-98 transition-all hover:bg-gray-550 bg-white border-gray-200"
                  >
                    <div class="flex items-center gap-3">
                      <span class="w-7 h-7 rounded-full bg-violet-50 text-violet-750 flex items-center justify-center text-xs font-black">
                        {{ idx + 1 }}
                      </span>
                      <div>
                        <span class="block text-[15px] font-bold text-gray-800">
                          {{ beat.root ? formatDisplayChord(beat) : 'Silencio / Vacío' }}
                        </span>
                        <span class="block text-[11px] text-gray-400 font-medium">Pulso {{ idx + 1 }} del compás</span>
                      </div>
                    </div>
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>
              </div>
              
              <!-- Step 2: "Selecciona nueva tonalidad" -->
              <div v-if="keyChangeStep === 2" class="space-y-6">
                <div class="space-y-4">
                  <h4 class="text-base font-extrabold text-gray-800">Selecciona la nueva tonalidad</h4>
                  
                  <!-- Root Key Grid -->
                  <div class="grid grid-cols-4 gap-2">
                    <button 
                      v-for="k in ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']" 
                      :key="k"
                      @click="tempKeyChangeKey = k"
                      class="p-2 text-center rounded-xl font-bold border transition-all active:scale-95 text-[15px]"
                      :class="tempKeyChangeKey === k 
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                    >
                      {{ translateNoteToSpanish(k) }}
                    </button>
                  </div>
                  
                  <!-- Scale Mode Selectors -->
                  <div class="flex gap-3">
                    <button 
                      @click="tempKeyChangeScale = 'major'"
                      class="flex-1 py-3 text-center rounded-xl font-bold border transition-all active:scale-95 text-[15px]"
                      :class="tempKeyChangeScale === 'major' 
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                    >
                      Mayor
                    </button>
                    <button 
                      @click="tempKeyChangeScale = 'minor'"
                      class="flex-1 py-3 text-center rounded-xl font-bold border transition-all active:scale-95 text-[15px]"
                      :class="tempKeyChangeScale === 'minor' 
                        ? 'bg-violet-600 border-violet-600 text-white shadow-md' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-550'"
                    >
                      Menor
                    </button>
                  </div>
                </div>
                
                <!-- Remove Key Change Option -->
                <div v-if="measures[selectedMeasureIndex] && measures[selectedMeasureIndex].keyChange" class="pt-4 border-t border-gray-200">
                  <button 
                    @click="removeKeyChange"
                    class="w-full py-3 bg-red-50 text-red-600 font-extrabold rounded-xl border border-red-100 hover:bg-red-100 transition-colors active:scale-98"
                  >
                    Eliminar cambio de tonalidad
                  </button>
                </div>
              </div>
            </div>
          </template>
          
        </div>
        <!-- CHORD SELECTION MODAL (Unified Chord Editor) -->
        <div v-if="isModalOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe flex flex-col max-h-[90vh] z-10 md:w-[600px] md:mx-auto md:rounded-3xl md:mb-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 shrink-0 rounded-t-[16px] md:rounded-t-3xl shadow-sm">
            <button @click="isModalOpen = false" class="text-gray-500 text-[17px] font-medium bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">Cerrar</button>
            <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none flex flex-col items-center">
              <span>{{ key }} {{ scaleType === 'major' ? 'Mayor' : 'Menor' }}</span>
              <span v-if="selectedBeat" class="text-xs text-gray-400 font-normal">
                Editando Compás {{ selectedBeat.measureIndex + 1 }}
                <span v-if="viewMode === 'expanded' && displayedMeasures[selectedBeat.displayedMeasureIndex]?.displayPass" class="text-violet-600 font-bold ml-0.5">
                  (Vuelta {{ displayedMeasures[selectedBeat.displayedMeasureIndex].displayPass }})
                </span>
              </span>
            </h3>
            <button @click="selectChord({root:'', type:''})" class="text-red-500 text-[17px] font-bold bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors">Borrar</button>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto space-y-6">
            
            <!-- 1. ACORDE ACTIVO / PREVIEW CARD (Only if a chord is selected) -->
            <div v-if="activeEditingBeat && activeEditingBeat.root" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden">
              <div class="absolute right-0 top-0 opacity-5 pointer-events-none font-black text-7xl select-none uppercase tracking-widest text-[#34C759]">
                {{ activeChordExtensions ? activeChordExtensions.degree : '' }}
              </div>
              
              <span class="text-[11px] text-[#34C759] font-black uppercase tracking-widest mb-1">
                {{ activeChordExtensions?.degree ? `${activeChordExtensions.degree} Grado` : 'Acorde Personalizado' }}
              </span>
              
              <span class="text-4xl font-black text-gray-800 tracking-tight mb-1">
                {{ formatDisplayChord(activeEditingBeat) }}
              </span>
              
              <span class="text-xs text-gray-400 font-bold">
                {{ activeEditingBeat.root }} {{ activeEditingBeat.type === 'maj' ? 'Mayor' : (activeEditingBeat.type === 'min' ? 'Menor' : activeEditingBeat.type) }}
              </span>
            </div>
            
            <!-- 2. BASS NOTE SELECTOR (SLASH CHORDS) -->
            <div v-if="currentPlan === 'PRO' && activeEditingBeat && activeEditingBeat.root && wasBeatAlreadySet" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-gray-800 flex items-center gap-1.5">
                  <span>🎹</span> <span>Bajo Alternativo</span>
                </h4>
                <span v-if="activeEditingBeat.bass" class="text-xs text-[#34C759] font-bold">
                  Bajo en: {{ translateNoteToSpanish(activeEditingBeat.bass) }}
                </span>
              </div>
              
              <!-- Suggestions for Bass (PRO feature) -->
              <div v-if="suggestedBassNotes.length > 0" class="space-y-2">
                <span class="block text-[11px] font-black text-violet-600 uppercase tracking-wider flex items-center gap-1">
                  👑 Sugerencias de bajo
                </span>
                
                <div class="grid grid-cols-1 gap-2">
                  <button 
                    v-for="s in suggestedBassNotes" 
                    :key="s.note"
                    @click="currentPlan === 'PRO' ? selectBassNote(s.note) : (upgradeReason = 'feature', isUpgradeModalOpen = true)"
                    class="flex items-start text-left p-2.5 rounded-xl border transition-all text-xs"
                    :class="activeEditingBeat.bass === s.note 
                      ? 'border-violet-500 bg-violet-50/50' 
                      : 'border-violet-100 bg-violet-50/10 hover:bg-violet-50/30'"
                  >
                    <span class="font-extrabold text-sm text-violet-700 mr-2 bg-violet-100 rounded-lg w-8 h-8 flex items-center justify-center shrink-0">
                      /{{ translateNoteToSpanish(s.note) }}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="font-bold text-gray-800 flex items-center gap-1.5">
                        {{ s.label }}
                        <span v-if="currentPlan !== 'PRO'" class="text-[9px] bg-violet-100 text-violet-700 px-1 py-0.2 rounded font-black shrink-0">PRO</span>
                      </div>
                      <div class="text-[10px] text-gray-500">{{ s.description }}</div>
                    </div>
                  </button>
                </div>
              </div>
              
              <!-- Manual note selector grid -->
              <div class="space-y-2.5 pt-2 border-t border-gray-100">
                <span class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Seleccionar nota del bajo
                </span>
                
                <div class="space-y-1">
                  <span class="block text-[10px] text-gray-400 font-semibold">Notas de la Escala</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button 
                      @click="selectBassNote(activeEditingBeat.root)"
                      :class="!activeEditingBeat.bass ? 'bg-[#34C759] text-white border-transparent' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
                      class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors"
                    >
                      {{ translateNoteToSpanish(activeEditingBeat.root) }} (Fund.)
                    </button>
                    <button 
                      v-for="note in getScaleNotes(key, scaleType).filter(n => n !== activeEditingBeat.root)" 
                      :key="note"
                      @click="selectBassNote(note)"
                      :class="activeEditingBeat.bass === note ? 'bg-[#34C759] text-white border-transparent' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                      class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all"
                    >
                      /{{ translateNoteToSpanish(note) }}
                    </button>
                  </div>
                </div>
                
                <div class="pt-1.5">
                  <details class="group">
                    <summary class="list-none text-xs text-[#34C759] font-black cursor-pointer hover:underline flex items-center gap-1">
                      <span>+ Ver todas las notas cromáticas</span>
                      <svg class="w-3 h-3 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </summary>
                    <div class="flex flex-wrap gap-1.5 mt-2 p-2 bg-gray-50 rounded-xl">
                      <button 
                        v-for="note in (keySignatureFormatted.includes('♭') ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']).filter(n => !getScaleNotes(key, scaleType).includes(n) && n !== activeEditingBeat.root)"
                        :key="note"
                        @click="selectBassNote(note)"
                        :class="activeEditingBeat.bass === note ? 'bg-[#34C759] text-white border-transparent' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                        class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all"
                      >
                        /{{ translateNoteToSpanish(note) }}
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </div>
            
            <!-- 3. CHORD EXTENSIONS SELECTOR -->
            <div v-if="currentPlan === 'PRO' && activeEditingBeat && activeEditingBeat.root && activeChordExtensions && wasBeatAlreadySet" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-gray-800 flex items-center gap-1.5">
                  <span>🎨</span> <span>Extensiones de Color</span>
                </h4>
                <span class="text-xs text-gray-400 font-bold uppercase tracking-wider">
                  Función: {{ activeChordExtensions.degree }}
                </span>
              </div>
              
              <div class="space-y-2">
                <span class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Recomendadas para este grado</span>
                <div class="flex flex-wrap gap-2">
                  <button 
                    v-for="tension in activeChordExtensions.available" 
                    :key="tension.name"
                    @click="toggleExtension(tension.name); activeTensionExplanation = tension"
                    :class="activeEditingBeat.tensions?.includes(tension.name) 
                      ? (currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-sm' : 'bg-[#34C759] text-white border-transparent shadow-sm')
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                    class="px-3.5 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-1"
                  >
                    <span>{{ tension.name }}</span>
                    <span class="text-[10px] text-gray-400 font-normal">({{ tension.simple }})</span>
                  </button>
                </div>
              </div>
              
              <div v-if="activeChordExtensions.avoid.length > 0" class="space-y-2">
                <span class="block text-[11px] font-bold text-red-500 uppercase tracking-wider">No recomendadas (Choque armónico)</span>
                <div class="flex flex-wrap gap-2">
                  <button 
                    v-for="tension in activeChordExtensions.avoid" 
                    :key="tension.name"
                    @click="toggleExtension(tension.name); activeTensionExplanation = tension"
                    :class="activeEditingBeat.tensions?.includes(tension.name) 
                      ? 'bg-red-500 text-white border-transparent shadow-sm'
                      : 'bg-red-50/50 border-red-200 text-red-700 hover:bg-red-50'"
                    class="px-3.5 py-2 rounded-xl text-xs font-black border border-dashed transition-all flex items-center gap-1"
                  >
                    <span>⚠️ {{ tension.name }}</span>
                    <span class="text-[10px] text-red-500/80 font-normal">({{ tension.simple }})</span>
                  </button>
                </div>
              </div>
              
              <!-- Pedagogical Capa Educativa Box -->
              <transition name="fade">
                <div v-if="activeTensionExplanation" class="bg-gray-50 border border-gray-200/50 rounded-2xl p-4 text-left relative">
                  <button @click="activeTensionExplanation = null" class="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600 font-black text-sm">X</button>
                  
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="text-sm font-extrabold text-gray-800">Tensión {{ activeTensionExplanation.name }}</span>
                    <span v-if="activeTensionExplanation.reason" class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black uppercase">Evitar</span>
                    <span v-else class="text-[9px] bg-[#34C759]/10 text-[#34C759] px-1.5 py-0.5 rounded font-black uppercase">Recomendada</span>
                  </div>
                  
                  <p class="text-xs text-gray-600 leading-relaxed mb-2.5">
                    {{ activeTensionExplanation.simple }}. {{ activeTensionExplanation.reason ? activeTensionExplanation.reason : '' }}
                  </p>
                  
                  <div class="pt-2 border-t border-gray-200/60">
                    <div v-if="currentPlan === 'PRO'" class="p-2.5 bg-indigo-50/40 border border-indigo-100/40 rounded-xl">
                      <span class="block text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">🎓 Detalle Pedagógico</span>
                      <p class="text-[11px] text-indigo-950 leading-relaxed">{{ activeTensionExplanation.detail }}</p>
                    </div>
                    <button 
                      v-else 
                      @click="upgradeReason = 'escalas'; isUpgradeModalOpen = true"
                      class="w-full py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 font-extrabold rounded-xl flex items-center justify-center gap-1 text-[11px] transition-all"
                    >
                      <span>Ver explicación teórica completa 👑 PRO</span>
                    </button>
                  </div>
                </div>
              </transition>
            </div>
            <!-- RITMO ARMONICO SECTION -->
            <div v-if="activeEditingBeat && (wasBeatAlreadySet || getEffectiveRhythm(measures[selectedBeat.measureIndex], measures[selectedBeat.measureIndex]?.beats[selectedBeat.beatIndex], selectedBeat.beatIndex) !== 'quarter') && currentPlan === 'PRO'" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-black text-gray-800 flex items-center gap-2">
                  <span>🥁</span> <span>Ritmo Armónico</span>
                </h4>
                <span v-if="currentPlan !== 'PRO'" class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide">👑 PRO</span>
              </div>
              
              <!-- If we are editing a main beat (not a subdivision slot) -->
              <div v-if="selectedBeat && selectedBeat.subdivisionIndex === undefined" class="space-y-3">
                <!-- Automático Button -->
                <button 
                  @click="selectBeatHarmonicRhythm('auto')"
                  class="w-full p-2.5 text-center rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5"
                  :class="!activeEditingBeat.harmonicRhythm || activeEditingBeat.harmonicRhythm === 'auto'
                    ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                >
                  <span>🔄</span>
                  <span>Automático (según groove)</span>
                </button>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button 
                    @click="selectBeatHarmonicRhythm('quarter')"
                    class="p-2.5 text-center rounded-xl font-bold border transition-all text-xs flex flex-col items-center justify-center gap-1"
                    :class="activeEditingBeat.harmonicRhythm === 'quarter'
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                  >
                    <span class="text-base">♩</span>
                    <span>Normal</span>
                  </button>
                  <button 
                    @click="selectBeatHarmonicRhythm('eighth')"
                    class="p-2.5 text-center rounded-xl font-bold border transition-all text-xs flex flex-col items-center justify-center gap-1"
                    :class="activeEditingBeat.harmonicRhythm === 'eighth'
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                  >
                    <span class="text-base">♪</span>
                    <span>Corcheas</span>
                  </button>
                  <button 
                    @click="selectBeatHarmonicRhythm('sixteenth')"
                    class="p-2.5 text-center rounded-xl font-bold border transition-all text-xs flex flex-col items-center justify-center gap-1"
                    :class="activeEditingBeat.harmonicRhythm === 'sixteenth'
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                  >
                    <span class="text-base">♬</span>
                    <span>Semicorcheas</span>
                  </button>
                  <button 
                    @click="selectBeatHarmonicRhythm('offbeat')"
                    class="p-2.5 text-center rounded-xl font-bold border transition-all text-xs flex flex-col items-center justify-center gap-1"
                    :class="activeEditingBeat.harmonicRhythm === 'offbeat'
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-555'"
                  >
                    <span class="text-base">↷</span>
                    <span>Contratiempo</span>
                  </button>
                </div>
                
                <!-- Advanced subdivisions row -->
                <div class="flex gap-2">
                  <button 
                    @click="selectBeatHarmonicRhythm('triplet')"
                    class="flex-1 p-2 text-center rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5"
                    :class="activeEditingBeat.harmonicRhythm === 'triplet'
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                  >
                    <span>3️⃣</span>
                    <span>Tresillos</span>
                  </button>
                  <button 
                    @click="selectBeatHarmonicRhythm('quintuplet')"
                    class="flex-1 p-2 text-center rounded-xl font-bold border transition-all text-xs flex items-center justify-center gap-1.5"
                    :class="activeEditingBeat.harmonicRhythm === 'quintuplet'
                      ? 'bg-violet-600 border-violet-600 text-white shadow-md' 
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-555'"
                  >
                    <span>5️⃣</span>
                    <span>Quintillos</span>
                  </button>
                </div>
              </div>
              
              <!-- If we are editing a subdivided slot -->
              <div v-else class="flex items-center justify-between bg-violet-50/55 p-3 rounded-xl border border-violet-100">
                <div>
                  <span class="block text-xs font-bold text-violet-900">Ranura de Subdivisión Activa</span>
                  <span class="block text-[10px] text-violet-700 mt-0.5" v-if="selectedBeat">
                    Modo del pulso: <strong class="uppercase font-black">{{ translateRhythmName(getEffectiveRhythm(measures[selectedBeat.measureIndex], measures[selectedBeat.measureIndex]?.beats[selectedBeat.beatIndex], selectedBeat.beatIndex)) }}</strong>
                  </span>
                </div>
                <button 
                  @click="flattenParentBeat" 
                  class="px-3 py-1.5 bg-white border border-violet-200 hover:bg-violet-50 text-violet-750 font-bold text-xs rounded-lg transition-colors active:scale-95 shadow-sm"
                >
                  Volver a Normal ♩
                </button>
              </div>
            </div>
            
            <!-- 4. DIATONIC CHORDS GRID (To change the core root/type) -->
            <div class="space-y-3 pt-4 border-t border-gray-200">
              <span class="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Cambiar acorde base (Grados Diatónicos)
              </span>
              
              <div class="flex p-1 bg-gray-200/80 rounded-xl mb-4 max-w-sm mx-auto shadow-inner">
                <button @click="modalComplexity = 'triad'" :class="modalComplexity === 'triad' ? 'bg-white shadow-sm text-[#34C759] font-bold' : 'text-gray-500 font-medium'" class="flex-1 py-1.5 text-[14px] rounded-lg transition-all">Tríadas</button>
                <button @click="modalComplexity = 'tetrad'" :class="modalComplexity === 'tetrad' ? 'bg-white shadow-sm text-[#34C759] font-bold' : 'text-gray-500 font-medium'" class="flex-1 py-1.5 text-[14px] rounded-lg transition-all">Tétradas</button>
              </div>
              
              <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                <button 
                  v-for="chord in diatonicChords" 
                  :key="chord.degreeNumeral"
                  @click="selectChord(chord)"
                  class="bg-white border border-gray-100 rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm active:scale-95 active:bg-[#34C759]/5 transition-all group"
                >
                  <span class="text-[11px] text-gray-400 font-bold mb-0.5 uppercase tracking-widest group-active:text-[#34C759]/50">{{ chord.degreeNumeral }}</span>
                  <span class="text-lg font-black text-gray-800 group-active:text-[#34C759]">{{ chord.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <!-- SUGGESTIONS MODAL (AMPOLLETA DE IDEAS) -->
        <div v-if="isSystemSuggestionsModalOpen" @click.stop class="relative bg-[#F2F2F7] w-full rounded-t-[16px] shadow-2xl animate-slide-up-ios pb-safe flex flex-col max-h-[85vh] z-10 md:w-[600px] md:mx-auto md:rounded-3xl md:mb-10">
          <div class="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200 shrink-0 rounded-t-[16px] md:rounded-t-3xl shadow-sm">
            <button @click="isSystemSuggestionsModalOpen = false" class="text-gray-500 text-[17px] font-medium bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">Cerrar</button>
            <h3 class="text-[17px] font-bold text-gray-900 pointer-events-none flex flex-col items-center">
              <span>💡 Ampolleta de Ideas</span>
              <span class="text-xs text-[#34C759] font-bold mt-0.5">Sistema {{ activeSystemIndex + 1 }} (Compases {{ activeSystemIndex * 4 + 1 }} - {{ (activeSystemIndex + 1) * 4 }})</span>
            </h3>
            <div class="w-16"></div>
          </div>
          
          <div class="p-4 md:p-6 overflow-y-auto space-y-6">
            <div v-for="cat in [
              { key: 'enrich', label: '1. Enriquecer acordes', badgeClass: 'bg-emerald-100 text-emerald-700' },
              { key: 'movement', label: '2. Agregar movimiento', badgeClass: 'bg-amber-100 text-amber-700' },
              { key: 'color', label: '3. Color / Estilo', badgeClass: 'bg-blue-100 text-blue-700' },
              { key: 'voice_leading', label: '4. Voice Leading', badgeClass: 'bg-rose-100 text-rose-700' }
            ]" :key="cat.key">
              <div v-if="getSuggestionsByCategory(cat.key).length > 0" class="space-y-3">
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                  {{ cat.label }}
                </h4>
                
                <div v-for="suggestion in getSuggestionsByCategory(cat.key)" :key="suggestion.id" class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3 relative overflow-hidden">
                  <div class="flex items-center justify-between">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider" :class="cat.badgeClass">
                      {{ cat.label.substring(3) }}
                    </span>
                    <span v-if="currentPlan !== 'PRO'" class="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
                  </div>
                  
                  <h5 class="text-sm font-extrabold text-gray-800">{{ suggestion.title }}</h5>
                  
                  <p class="text-xs text-gray-600 leading-relaxed">{{ suggestion.text }}</p>
                  
                  <div class="bg-gray-50 rounded-xl p-2.5 font-mono text-xs text-center border border-gray-100">
                    <span class="text-gray-400 block text-[9px] uppercase font-bold tracking-wider mb-1">Efecto / Cambio</span>
                    <span class="font-bold text-gray-800 text-[13px]">{{ suggestion.preview }}</span>
                  </div>
                  
                  <div class="pt-2 border-t border-gray-100 flex justify-end">
                    <button 
                      @click="runSuggestion(suggestion)"
                      class="px-4 py-2 text-xs font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 text-white"
                      :class="currentPlan === 'PRO' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-150' : 'bg-[#34C759] shadow-[#34C759]/20'"
                    >
                      <span>Aplicar idea</span>
                      <span v-if="currentPlan !== 'PRO'">👑</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    <!-- ==================== KEY SIGNATURE EDUCATIONAL MODAL ==================== -->
    <transition name="fade">
      <div v-if="isKeyInfoOpen && keyInfoData" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full border border-gray-100 relative animate-scale-up max-h-[90vh] overflow-y-auto">
          <!-- Close Button -->
          <button @click="isKeyInfoOpen = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-50 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <!-- Header -->
          <div class="flex items-center gap-3.5 mb-5">
            <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shadow-md border"
              :class="keyInfoData.accidentalsCountScale === 0 ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-[#34C759]/10 border-[#34C759]/20 text-[#34C759]'">
              {{ keyInfoData.accidentalsCountScale > 0 ? (keyInfoData.accidentalType === 'sharp' ? '♯' : '♭') : '𝄞' }}
            </div>
            <div class="text-left">
              <h3 class="text-xl font-extrabold text-gray-900 leading-tight">
                {{ keyInfoData.key }} {{ keyInfoData.scaleName }}
              </h3>
              <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">{{ keyInfoData.categoryName }}</span>
            </div>
          </div>
          <!-- Basic Section (FREE / PRO) -->
          <div class="space-y-4 text-left">
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Armadura de Clave</h4>
              
              <!-- Caso 1: La escala no tiene notas alteradas -->
              <div v-if="keyInfoData.accidentalsCountScale === 0" class="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                <p class="text-sm text-gray-500 font-medium">
                  ✨ Esta escala tiene una <strong>armadura limpia</strong>. No contiene sostenidos ni bemoles.
                </p>
              </div>
              <!-- Caso 2: La escala tiene notas alteradas -->
              <div v-else class="space-y-2">
                <p class="text-sm text-gray-600">
                  <span v-if="keyInfoData.isStandardDiatonic">
                    Esta escala requiere <strong class="text-gray-800">{{ keyInfoData.accidentalsCountScale }} {{ keyInfoData.accidentalsCountScale === 1 ? 'alteración' : 'alteraciones' }}</strong> ({{ keyInfoData.accidentalType === 'sharp' ? 'sostenidos' : 'bemoles' }}) en su armadura de clave:
                  </span>
                  <span v-else>
                    Esta escala contiene <strong class="text-gray-800">{{ keyInfoData.accidentalsCountScale }} {{ keyInfoData.accidentalsCountScale === 1 ? 'nota alterada' : 'notas alteradas' }}</strong> en su estructura (de un total de {{ keyInfoData.accidentalsCountSig }} {{ keyInfoData.accidentalType === 'sharp' ? 'sostenidos' : 'bemoles' }} de su tonalidad madre):
                  </span>
                </p>
                
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <li v-for="item in keyInfoData.accidentalsList" :key="item.note" class="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <span :class="item.type === 'sharp' ? 'text-[#34C759]' : 'text-blue-500'" class="font-black text-sm">
                      {{ item.note.includes('𝄪') ? '𝄪' : (item.note.includes('𝄫') ? '𝄫' : (item.type === 'sharp' ? '♯' : '♭')) }}
                    </span>
                    <span>Nota <strong class="text-gray-900 font-bold">{{ item.note }}</strong> ({{ item.position }} nota)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <!-- Ver más / Locked Area -->
          <div v-if="!isVerMasExpanded">
            <div class="mt-6 pt-4 border-t border-gray-100">
              <button 
                v-if="currentPlan === 'PRO'"
                @click="isVerMasExpanded = true"
                class="w-full py-3 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all"
              >
                <span>Ver más (Detalles teóricos)</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <button 
                v-else
                @click="upgradeReason = 'escalas'; isUpgradeModalOpen = true"
                class="w-full py-3 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-500 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all"
              >
                <span>Ver más (Detalles teóricos)</span>
                <span class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 PRO</span>
              </button>
            </div>
          </div>
          <!-- Expanded Theoretical Section (PRO ONLY) -->
          <div v-else class="mt-5 pt-4 border-t border-gray-100 space-y-5 animate-slide-down text-left">
            <!-- Explicación Teórica Pedagógica -->
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Explicación Teórica</h4>
              <div class="p-3.5 bg-indigo-50/40 border border-indigo-100/40 rounded-2xl flex gap-2.5">
                <span class="text-lg">🎓</span>
                <p class="text-xs text-indigo-950 leading-relaxed font-medium" v-html="keyInfoData.explanation"></p>
              </div>
            </div>
            <!-- Tonal Formula & Character -->
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Estructura Tonal</h4>
              <div class="p-3 bg-violet-50/50 border border-violet-100/50 rounded-2xl">
                <div class="font-mono text-xs font-extrabold text-violet-800 tracking-wider text-center py-1.5 bg-violet-50 rounded-xl mb-2">
                  {{ keyInfoData.formula }}
                </div>
                <p class="text-xs text-gray-500 leading-relaxed italic">
                  "{{ keyInfoData.characteristic }}"
                </p>
              </div>
            </div>
            <!-- Notes of the Scale -->
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notas de la Escala</h4>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="(n, i) in keyInfoData.notesSpanish" :key="i" 
                  class="px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-extrabold text-gray-800 flex items-center gap-1">
                  <span class="text-[10px] text-gray-400 font-bold">{{ i + 1 }}.</span>
                  {{ n }}
                </span>
              </div>
            </div>
            <!-- Interval Relationship Table -->
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Relación Intervalar</h4>
              <div class="overflow-x-auto border border-gray-100 rounded-2xl bg-gray-50/30 p-2">
                <div class="grid gap-1.5 text-center min-w-[280px]" :style="{ gridTemplateColumns: `repeat(${keyInfoData.notesSpanish.length}, minmax(36px, 1fr))` }">
                  <!-- Grados numéricos -->
                  <div v-for="i in keyInfoData.notesSpanish.length" :key="'g-'+i" class="text-[9px] font-extrabold text-gray-400">
                    {{ i }}
                  </div>
                  <!-- Notas -->
                  <div v-for="(note, i) in keyInfoData.notesSpanish" :key="'n-'+i" class="text-[11px] font-black text-gray-800 bg-white rounded-lg py-1.5 shadow-sm border border-gray-100">
                    {{ note }}
                  </div>
                  <!-- Intervalos -->
                  <div v-for="(inv, i) in keyInfoData.intervalLabels" :key="'inv-'+i" class="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100/50 rounded-lg py-1">
                    {{ inv }}
                  </div>
                </div>
              </div>
            </div>
            <!-- Circle of Fifths Theory Box -->
            <div>
              <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Lógica en Círculo de Quintas</h4>
              <div class="p-3 bg-amber-50/50 border border-amber-100/50 rounded-2xl flex gap-2.5">
                <span class="text-lg">💡</span>
                <p class="text-xs text-amber-900 leading-relaxed font-medium">
                  {{ keyInfoData.circleExplanation }}
                </p>
              </div>
            </div>
            <!-- Collapse Button -->
            <button 
              @click="isVerMasExpanded = false"
              class="w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all border border-gray-200/50"
            >
              <span>Ver menos</span>
              <svg class="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </transition>
    <!-- ==================== PREMIUM UPGRADE MODAL ==================== -->
    <transition name="fade">
      <div v-if="isUpgradeModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 text-center animate-scale-up">
          <div class="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <span class="text-3xl">👑</span>
          </div>
          <h3 class="text-xl font-extrabold text-gray-900 mb-2">HarmoniGrid PRO</h3>
          
          <p class="text-sm text-gray-600 mb-6" v-if="upgradeReason === 'limit'">
            Has alcanzado el límite de 20 compases.<br><strong class="text-violet-600">🚀 Pásate a PRO para compases ilimitados</strong> y escribe piezas musicales más largas.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'escalas'">
            Has seleccionado una escala avanzada o modo PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO para usar las 26 escalas y modos</strong> y enriquecer tu vocabulario armónico.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'custom_layout'">
            La ordenación personalizada de compases es una función PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO para ordenar compases a tu gusto</strong>, cambiar la cantidad de compases por fila e insertar saltos de sistema.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'modulacion'">
            El análisis de modulación y consejos de arreglos avanzados es una función PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO para desbloquear el análisis Berklee</strong> y recibir consejos profesionales sobre transiciones de tonalidad.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else-if="upgradeReason === 'ritmo_armonico'">
            El Ritmo Armónico con subdivisiones de corcheas, semicorcheas y contratiempos es una función PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO para usar alta densidad armónica y cortes de banda</strong>.
          </p>
          <p class="text-sm text-gray-600 mb-6" v-else>
            Esta función requiere la versión PRO.<br><strong class="text-violet-600">🚀 Pásate a PRO</strong> para usar casillas avanzadas y expandir tus compases sin límites.
          </p>
          
          <div class="bg-violet-50 rounded-2xl p-4 text-left mb-6 space-y-2 border border-violet-100/50">
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>Compases Ilimitados</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>Expandir Repeticiones linealmente</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>Casillas avanzadas para partituras reales</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>26 escalas y modos griegos exclusivos 👑</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>Ritmo Armónico y subdivisiones rítmicas 👑</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>Teoría de intervalos y círculo de quintas interactivo 👑</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-violet-900 font-semibold">
              <span>✔️</span> <span>Análisis de modulación y consejos Berklee 👑</span>
            </div>
          </div>
          
          <button @click="currentPlan = 'PRO'; isUpgradeModalOpen = false" class="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-200/50 transition-all active:scale-[0.98]">
            Pasar a PRO 🚀
          </button>
          <button @click="isUpgradeModalOpen = false" class="w-full mt-2 py-2 text-gray-400 hover:text-gray-600 font-bold text-sm">
            Quizás más tarde
          </button>
        </div>
      </div>
    </transition>
    <!-- ==================== KEY CHANGE INFO MODAL ==================== -->
    <transition name="fade">
      <div v-if="isKeyChangeInfoOpen && activeKeyChangeMeasure" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div class="absolute inset-0" @click="isKeyChangeInfoOpen = false"></div>
        
        <div class="relative bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full border border-gray-150 text-left animate-scale-up z-10 flex flex-col max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <span class="text-xl">🔑</span>
              <h3 class="text-lg font-black text-gray-900">Cambio de Tonalidad</h3>
            </div>
            <button @click="isKeyChangeInfoOpen = false" class="text-gray-400 hover:text-gray-655 text-sm font-bold bg-gray-100 w-7 h-7 rounded-full flex items-center justify-center">✕</button>
          </div>
          
          <div class="py-4 space-y-4 flex-1">
            <!-- Location details -->
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div>
                <span class="block text-[10px] text-gray-400 uppercase font-black tracking-wider">Ubicación</span>
                <span class="text-sm font-bold text-gray-800">
                  Compás {{ activeKeyChangeMeasure.originalMeasureIndex + 1 }}, Pulso {{ (activeKeyChangeMeasure.keyChange.beatIndex !== undefined ? activeKeyChangeMeasure.keyChange.beatIndex : 0) + 1 }}
                </span>
              </div>
              <div class="text-right">
                <span class="block text-[10px] text-gray-400 uppercase font-black tracking-wider">Nueva Tonalidad</span>
                <span class="text-sm font-black text-violet-600">
                  {{ translateNoteToSpanish(activeKeyChangeMeasure.keyChange.key) }} {{ activeKeyChangeMeasure.keyChange.scaleType === 'major' ? 'Mayor' : 'Menor' }}
                </span>
              </div>
            </div>
            <!-- Accidentals visualizer -->
            <div class="flex items-center justify-between bg-violet-50/40 border border-violet-100/50 p-3 rounded-2xl">
              <span class="text-xs text-gray-600 font-bold">Armadura de clave:</span>
              <span class="text-xs font-black text-violet-750 bg-violet-100 px-2.5 py-0.5 rounded-full uppercase">
                {{ getKeyAccidentalsStr(activeKeyChangeMeasure.keyChange.key, activeKeyChangeMeasure.keyChange.scaleType) }}
              </span>
            </div>
            <!-- Academic / Educational section -->
            <div class="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <!-- Header of analysis -->
              <div class="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span class="text-xs font-black text-gray-400 uppercase tracking-wider">Análisis Armónico Berklee</span>
                <span v-if="currentPlan === 'FREE'" class="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight">PRO</span>
              </div>
              
              <!-- FREE VIEW (Teaser / Locked) -->
              <div v-if="currentPlan === 'FREE'" class="p-4 space-y-3 bg-white text-center">
                <div class="text-3xl text-gray-300">🔒</div>
                <h4 class="text-sm font-bold text-gray-800">Desbloquea el análisis de modulación</h4>
                <p class="text-xs text-gray-500 max-w-xs mx-auto">
                  Aprende cómo se conecta esta nueva tonalidad con la anterior (Relativa, Paralela, Directa, etc.) y recibe recomendaciones de arreglos de nivel profesional.
                </p>
                <button 
                  @click="upgradeReason = 'modulacion'; isUpgradeModalOpen = true"
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 mt-1"
                >
                  Ver Análisis PRO 🚀
                </button>
              </div>
              
              <!-- PRO VIEW (Full academic analysis) -->
              <div v-else class="p-4 space-y-3 bg-white">
                <div v-if="modulationAnalysis" class="space-y-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs text-violet-750 font-extrabold bg-violet-50 px-2.5 py-0.5 rounded-md border border-violet-100">
                      Tipo: {{ modulationAnalysis.type }}
                    </span>
                  </div>
                  
                  <p class="text-xs text-gray-600 leading-relaxed font-medium">
                    {{ modulationAnalysis.description }}
                  </p>
                  
                  <div class="mt-3 pt-3 border-t border-gray-100">
                    <span class="block text-[10px] text-gray-400 uppercase font-black tracking-wider mb-1">Guía del Arreglista</span>
                    <div class="bg-violet-50/50 p-2.5 rounded-xl border border-violet-100 text-xs text-violet-950 font-medium">
                      💡 <strong>Consejo:</strong> 
                      <span v-if="modulationAnalysis.type && modulationAnalysis.type.includes('Relativa')">
                        Aprovecha acordes de paso o pivote (como el II grado de la nueva tonalidad) para conectar sin brusquedad, o modula directamente si buscas un golpe de contraste sorpresivo.
                      </span>
                      <span v-else-if="modulationAnalysis.type && modulationAnalysis.type.includes('Energía')">
                        Este cambio es ideal para la última repetición del coro. Intenta retrasar la entrada de la tónica medio pulso para crear mayor anticipación y emoción en el oyente.
                      </span>
                      <span v-else-if="modulationAnalysis.type && modulationAnalysis.type.includes('Dominante')">
                        Usa el acorde dominante secundario (V7 de la nueva clave) al final del compás previo para resolver con total fuerza tonal en el acorde objetivo.
                      </span>
                      <span v-else>
                        Las modulaciones directas o distantes funcionan excelentemente en puentes melódicos o secciones instrumentales de transición para cambiar radicalmente el color de la pieza.
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="text-xs text-gray-400">
                  Cargando análisis de modulación...
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-100 flex gap-3">
            <button 
              @click="removeKeyChangeFromMeasure(activeKeyChangeMeasure)"
              class="flex-1 py-2.5 bg-red-50 text-red-655 border border-red-100 rounded-xl hover:bg-red-100 text-xs font-bold text-center active:scale-98 transition-all"
            >
              Eliminar Cambio
            </button>
            <button 
              @click="isKeyChangeInfoOpen = false"
              class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-250 text-gray-600 rounded-xl text-xs font-bold text-center active:scale-98 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
<style>
/* CSS Reset Minimal & Utilities */
:root { --sat: env(safe-area-inset-top); --sab: env(safe-area-inset-bottom); }
.pb-safe { padding-bottom: max(1.5rem, var(--sab)); }
html, body { overscroll-behavior-y: none; }
/* Transitions */
.fade-enter-active { transition: opacity 0.15s ease-out; }
.fade-leave-active { transition: opacity 0.1s ease-in; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.dropdown-enter-active, .dropdown-leave-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: top; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: scaleY(0.95) translateY(-5px); transform-origin: top; }
.grid-anim-enter-active, .grid-anim-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.grid-anim-enter-from, .grid-anim-leave-to { opacity: 0; transform: scale(0.95) translateY(10px); }
.grid-anim-leave-active { position: absolute; }
/* Animations */
@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes pulseSubtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
}
.animate-pulse-subtle {
  animation: pulseSubtle 3s infinite ease-in-out;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-down {
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
/* Responsive Grid layout for system rows */
.system-row {
  display: grid;
}
@media (max-width: 639px) {
  .system-row {
    grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
    gap: 1.5rem 0.75rem !important;
  }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .system-row {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 2rem 0.75rem !important;
  }
}
</style>
